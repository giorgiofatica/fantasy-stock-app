// draft-autopick-sweep — the pick clock's SERVER BACKSTOP.
//
// Connected clients fire validate-and-record-pick action:'auto_pick' the
// moment a turn's clock hits zero; that is the responsive path. This function
// is the one that makes the product rule true when NOBODY is connected: "a
// draft must never be permanently stuck". Scheduled by the deferred cron
// migration supabase/migrations/deferred/20261010000001_schedule_draft_autopick_sweep.sql,
// whose command only posts here WHERE EXISTS an overdue turn — so an idle
// system makes no edge calls at all.
//
// DRAFT AUTO-START (2026-10-06; ../_shared/draft-start.ts, policy in
// ../_shared/draft-start-policy.ts), two passes before the overdue pass:
//   START: every league public.due_draft_starts() lists (at/past its time, not
//     postponed) goes through startDraftIfDue — the same path draft-control's
//     start runs: it starts, or is POSTPONED (blocked, or its room never
//     opened; no late start), or retries a system hiccup for up to 5 minutes.
//   WATCH: every league public.draft_watch_due() lists (a changed or stale
//     verdict, the T-2h reminder, or the gate window) goes through
//     watchLeague: the verdict is recorded (the commissioner is warned when it
//     becomes blocked), and in the gate window a blocked league is postponed
//     and a clear one is cleared to open its room at T-1h.
// A just-started draft's first turn is pick_seconds away, so the start pass
// never collides with the overdue pass below. A 'started' league's first
// picker is pushed "It's your turn" right after the committed start
// (notifyFirstPicker); its outcome is the entry's turn_push.
//
// Per overdue row of public.overdue_draft_turns() (service role):
//   * league no longer in_progress         -> 'not_in_progress' (nothing to do)
//   * every pick made, finalize failed     -> re-run the idempotent finalize
//     (heals a transient finalize failure without anyone opening the app)
//   * otherwise re-read get_draft_clock (the overdue list may be stale by the
//     time we reach this row) and run the SAME gate + autoPickTurn the client
//     path uses (../_shared/draft-write.ts). A bot's turn picks as a bot; a
//     human's turn picks from their queue, then best available.
// Races with clients (or an overlapping sweep) end at the drafts
// (league_id, pick_number) unique index: the loser gets 'pick_conflict' and
// writes nothing. Chained timeouts cannot burst: each recorded pick is the
// next turn's clock anchor, so the next turn is simply not overdue yet.
//
// ONE ATTEMPT PER TURN (supabase review P1 on #384, ../_shared/turn-lease.ts): the
// cron posts every 2 s while a turn is overdue, and a slow attempt (a vendor
// outage that times out, up to WALL_BUDGET_MS) outlives many ticks. Each row is
// worked under a per-turn lease on (league_id, pick_number), claimed BEFORE the
// turn is read: an overlapping sweep gets 'lease_held' and spends nothing. Client
// auto_pick / bot_pick asks take the SAME lease (draft-write.ts
// autoPickTurnLeased), so a sweep and a client never work one turn at once. The
// lease is time-bounded (a dead holder's turn is taken over after
// TURN_LEASE_TTL_MS) and fails OPEN on a claim error (reported as lease_error),
// because correctness is still the unique index's. Under the lease the turn is
// re-read, and acted on only if it is still the leased pick_number.
//
// OUTAGE PACE: autoPickTurn answers price_unavailable without calling Alpaca
// while the turn's last outage attempt is under OUTAGE_RETRY_MS old (the same
// 10 s the cron's outage throttle uses), so the outage retry pace holds even
// for a sweep the cron posted for another league.
//
// DELETED SEATS (account deletion, 2026-10-21): in an UNCLOCKED draft a deleted seat would
// stall the draft forever (auto-pick never fires without a clock). A third pass takes every
// turn public.unclocked_deleted_seat_turns() lists (an unclocked live draft with a deleted
// seat somewhere) and, only when the CURRENT turn's picker is that deleted seat, runs the
// same gate + autoPickTurn (../_shared/deleted-seat.ts). Giorgio's rule: a player always
// gets a pick. A live manager's seat in an unclocked draft is never auto-picked.
//
// SUCCESS-SIGNAL DISCIPLINE (CLAUDE.md): the response's top-level `ok` means
// ONLY "the sweep ran to completion". Per-league outcomes are in `results`
// and `errors`; nothing here claims every overdue turn was picked. The cron's
// net.http_post "succeeds" on enqueue regardless — verify by DATA (drafts rows
// with pick_source auto_*/bot and their recorded_at gaps), never by
// cron.job_run_details or net._http_response.
//
// AUTH: verify_jwt=false; the shared constant-time apikey guard
// (../_shared/cron-auth.ts, SB_SECRET_KEY_CRON, fail-closed) is the entire
// boundary — same contract as every other cron-only function here.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { isAuthorized } from '../_shared/cron-auth.ts';
import { decideAutoPickGate } from '../_shared/auto-pick.ts';
import { decideDeletedSeatPick, listUnclockedDeletedSeatTurns, seatReader, selectSeatTurns } from '../_shared/deleted-seat.ts';
import { autoPickTurn, fetchDraftClock, finalizeDraft, isDraftFull, loadDraftContext } from '../_shared/draft-write.ts';
import { startDraftIfDue, watchLeague } from '../_shared/draft-start.ts';
import { withTurnLease } from '../_shared/turn-lease.ts';

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

// Bounds per invocation. The cron re-fires every tick (every 2 s,
// 20261201000000), so anything past these is picked up next tick rather than
// risking the edge wall-clock limit.
const MAX_LEAGUES_PER_RUN = 20;
const CONCURRENCY = 4;
// Starts and watches first, but capped, so a burst of drafts all set for noon
// cannot starve overdue turns; the rest go on the next tick (2 s later).
const MAX_STARTS_PER_RUN = 10;
// Deleted-seat leagues per run (the cron re-fires every tick, so the rest wait one tick, 2 s).
const MAX_DELETED_SEAT_PER_RUN = 10;
const MAX_WATCHES_PER_RUN = 10;

interface StartResult {
  league_id: string;
  outcome: string;
  reason?: string;
  turn_push?: string; // a 'started' league: pick 1's turn push (best effort, never the outcome)
}

interface LeagueOutcome {
  league_id: string;
  pick_number: number;
  outcome: string;
  pick_source?: string;
  lease_error?: true; // the lease claim failed and the turn was worked unleased (fail open)
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);
  // Generic 401: no detail about why (missing vs wrong vs unset).
  if (!isAuthorized(req)) return json({ error: 'Unauthorized' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SECRET_KEY = Deno.env.get('SB_SECRET_KEY_INTERNAL')!;
  const ALPACA_KEY = Deno.env.get('ALPACA_API_KEY') ?? '';
  const ALPACA_SECRET = Deno.env.get('ALPACA_API_SECRET') ?? '';
  const admin = createClient(SUPABASE_URL, SECRET_KEY);

  // ---- start + watch passes ---------------------------------------------------
  // A failure here never blocks the overdue pass: live drafts keep moving.
  // Per-league outcomes are reported, never folded into `ok` (CLAUDE.md #7).
  const starts: StartResult[] = [];
  const startErrors: StartResult[] = [];
  const watches: StartResult[] = [];
  let dueTotal = 0;
  let watchTotal = 0;
  async function bounded<T>(rows: T[], fn: (row: T) => Promise<void>) {
    for (let i = 0; i < rows.length; i += CONCURRENCY) await Promise.all(rows.slice(i, i + CONCURRENCY).map(fn));
  }

  // Destructure-and-check: .rpc() resolves to { error } on a Postgres error.
  const { data: due, error: dueErr } = await admin.rpc('due_draft_starts');
  if (dueErr) {
    console.error('due_draft_starts failed', JSON.stringify(dueErr));
    startErrors.push({ league_id: '', outcome: 'due_query_failed' });
  } else {
    const dueRows = (due ?? []) as Array<{ league_id: string }>;
    dueTotal = dueRows.length;
    await bounded(dueRows.slice(0, MAX_STARTS_PER_RUN), async (row) => {
      const leagueId = String(row.league_id);
      const res = await startDraftIfDue(admin, leagueId, new Date());
      // started / postponed / retry / not_due ... are game-flow outcomes; only 'error' is a failure.
      const entry: StartResult = { league_id: leagueId, outcome: res.outcome };
      if ('reason' in res) entry.reason = res.reason;
      if (res.outcome === 'started') entry.turn_push = res.turnPush;
      (res.outcome === 'error' ? startErrors : starts).push(entry);
    });
  }

  const { data: watch, error: watchErr } = await admin.rpc('draft_watch_due');
  if (watchErr) {
    console.error('draft_watch_due failed', JSON.stringify(watchErr));
    startErrors.push({ league_id: '', outcome: 'watch_query_failed' });
  } else {
    const watchRows = (watch ?? []) as Array<{ league_id: string }>;
    watchTotal = watchRows.length;
    await bounded(watchRows.slice(0, MAX_WATCHES_PER_RUN), async (row) => {
      const leagueId = String(row.league_id);
      const res = await watchLeague(admin, leagueId, new Date());
      const entry: StartResult = { league_id: leagueId, outcome: res.outcome };
      if ('reason' in res) entry.reason = res.reason;
      if (res.outcome === 'recorded') entry.reason = res.notified ?? (res.gateCleared ? 'gate_cleared' : undefined);
      (res.outcome === 'error' ? startErrors : watches).push(entry);
    });
  }

  // ---- overdue pass ----------------------------------------------------------
  // Auto-pick prices candidates through Alpaca; starting does not (cached
  // prices only), so a missing Alpaca secret stops picks, never starts.
  if (!ALPACA_KEY || !ALPACA_SECRET) {
    return json({ ok: false, reason: 'server_config_error', due_total: dueTotal, starts, watches, start_errors: startErrors }, 500);
  }
  const { data: overdue, error: odErr } = await admin.rpc('overdue_draft_turns');
  if (odErr) {
    console.error('overdue_draft_turns failed', JSON.stringify(odErr));
    return json({ ok: false, reason: 'overdue_query_failed', starts, watches, start_errors: startErrors }, 500);
  }
  const rows = ((overdue ?? []) as Array<{ league_id: string; pick_number: number }>).slice(0, MAX_LEAGUES_PER_RUN);

  const results: LeagueOutcome[] = [];
  const errors: LeagueOutcome[] = [];

  // DELETED-SEAT PASS input. A failure to list is reported and never blocks the overdue
  // pass (live clocked drafts keep moving); it is never read as "no deleted seats".
  const seatList = await listUnclockedDeletedSeatTurns(admin);
  if (seatList.error) startErrors.push({ league_id: '', outcome: 'deleted_seat_list_failed' });
  const overdueIds = new Set(rows.map((r) => String(r.league_id)));
  const seatRows = selectSeatTurns(seatList.turns, overdueIds, MAX_DELETED_SEAT_PER_RUN)
    .map((t) => ({ league_id: t.leagueId, pick_number: t.pickNumber, viaDeletedSeat: true }));

  async function sweepOne(row: { league_id: string; pick_number: number; viaDeletedSeat?: boolean }) {
    const base = { league_id: String(row.league_id), pick_number: Number(row.pick_number) };
    try {
      // The lease BEFORE the read: whoever holds it reads the turn fresh, so a
      // sweep that waited out another's attempt never works a stale context.
      const leased = await withTurnLease(admin, base.league_id, base.pick_number, () => workTurn(row, base));
      if (leased.kind === 'held') return results.push({ ...base, outcome: 'lease_held' });
      const out = leased.value;
      if (!leased.leased) out.entry.lease_error = true;
      return (out.failed ? errors : results).push(out.entry);
    } catch (e) {
      console.error('sweep: league failed', base.league_id, String(e));
      return errors.push({ ...base, outcome: 'unhandled' });
    }
  }

  // One turn's work, run only under its lease. Returns the entry instead of
  // pushing it, so the lease outcome can be attached first.
  async function workTurn(
    row: { league_id: string; pick_number: number; viaDeletedSeat?: boolean },
    base: { league_id: string; pick_number: number },
  ): Promise<{ entry: LeagueOutcome; failed: boolean }> {
    const ok = (entry: LeagueOutcome) => ({ entry, failed: false });
    const fail = (entry: LeagueOutcome) => ({ entry, failed: true });
    const loaded = await loadDraftContext(admin, base.league_id);
    if (!loaded.ok) return fail({ ...base, outcome: loaded.reason });
    const ctx = loaded.ctx;
    if (ctx.league.draft_status !== 'in_progress') return ok({ ...base, outcome: 'not_in_progress' });

    if (isDraftFull(ctx)) {
      // The deleted-seat pass is only about PICKING for a deleted seat. A draft with every pick made has
      // no picker (W2: its listed pick_number is one past the last pick), so there is nothing to do here;
      // finalizing is the overdue pass's job and is not widened to unclocked drafts by this pass.
      if (row.viaDeletedSeat) return ok({ ...base, outcome: 'no_turn' });
      const finalizeError = await finalizeDraft(admin, ctx.league, ctx.order);
      return finalizeError === null
        ? ok({ ...base, outcome: 'finalize_healed' })
        : fail({ ...base, outcome: `finalize_failed:${finalizeError}` });
    }

    const clock = await fetchDraftClock(admin, base.league_id);
    if (!clock) return fail({ ...base, outcome: 'clock_read_failed' });
    // Act only on the LEASED turn. If a pick landed since the row was listed, the
    // current turn is another pick_number (one this sweep holds no lease on), and
    // it is not overdue yet anyway (the landed pick is its clock anchor); the
    // next tick lists it. Both passes: the deleted-seat list asserts a turn too.
    if (base.pick_number !== ctx.picks.length + 1 || base.pick_number !== clock.picksMade + 1) {
      return ok({ ...base, outcome: 'stale_pick_number' });
    }
    if (row.viaDeletedSeat) {
      // The list only says "a deleted seat is somewhere in this unclocked draft". Whether it
      // is THIS turn's picker, and whether the gate then agrees, is decided here, in JS.
      const d = await decideDeletedSeatPick(ctx, clock, seatReader(admin, base.league_id));
      if (d.kind !== 'go') {
        return d.why === 'seat_read_failed' ? fail({ ...base, outcome: d.why }) : ok({ ...base, outcome: d.why });
      }
    } else {
      const gate = decideAutoPickGate(base.pick_number, clock);
      if (gate.kind !== 'go') return ok({ ...base, outcome: gate.kind });
    }

    const res = await autoPickTurn(
      admin,
      { alpacaKey: ALPACA_KEY, alpacaSecret: ALPACA_SECRET },
      ctx,
      base.pick_number,
    );
    if (res.ok) {
      const out = { ...base, pick_number: Number(res.pick?.pick_number ?? base.pick_number), outcome: 'picked', pick_source: res.pickSource };
      return res.statusError ? fail({ ...out, outcome: `picked_finalize_failed:${res.statusError}` }) : ok(out);
    }
    // pick_conflict = someone else recorded it first: a success for the draft.
    if (res.reason === 'pick_conflict') return ok({ ...base, outcome: 'pick_conflict' });
    return fail({ ...base, outcome: res.reason });
  }

  // Bounded parallelism: leagues are independent; one slow Alpaca chain must
  // not serialize every other overdue draft behind it.
  const work = [...rows, ...seatRows];
  for (let i = 0; i < work.length; i += CONCURRENCY) {
    await Promise.all(work.slice(i, i + CONCURRENCY).map(sweepOne));
  }

  if (errors.length > 0) console.error('sweep errors', JSON.stringify(errors));
  if (startErrors.length > 0) console.error('sweep start errors', JSON.stringify(startErrors));
  return json({
    ok: true, // the sweep RAN — not a claim that every overdue turn was picked or every due draft started
    examined: rows.length,
    deleted_seat_total: seatList.turns.length, // unclocked live drafts with a deleted seat (per-league outcomes are in results/errors)
    overdue_total: (overdue ?? []).length,
    results,
    errors,
    due_total: dueTotal,
    starts, // per-league start outcomes; verify by DATA (leagues.draft_status / draft_started_at)
    watch_total: watchTotal,
    watches, // per-league watch/gate outcomes; verify by DATA (draft_start_watch / draft_postponements)
    start_errors: startErrors,
  });
});
