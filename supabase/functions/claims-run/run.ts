// claims-run's run: which leagues, in what order, and what the job reports. The I/O is injected
// (deps.ts wires the real clients), so run.test.ts drives every path hermetically.
//
// PER LEAGUE, at most MAX_ATTEMPTS rounds of: read (claims_run_state + the ledger), price, plan
// (plan.ts), commit (commit_claims_run: ONE transaction, all or nothing). A commit that refuses tells
// us why, and the next round re-reads and re-plans:
//   already_ran                  another overlapping run committed this league: done, not an error.
//   claims_changed/order_changed a cancel or the weekly reset landed between read and commit.
//   step_refused + ledger_changed  a live trade or a rule edit landed: re-read, re-validate.
//   step_refused + season_completed | draft_not_completed | league_not_found
//                                every due claim fails with that reason (the buy path's own refusal).
//   step_refused + any other refusal (not_a_member, proceeds_unavailable, ...)
//                                that ONE claim fails with it; the rest are re-planned.
//   bad_plan                     our bug: the league is reported failed and retried next minute.
// One league's failure never stops another's (CLAUDE.md, partial-state family: per participant).
//
// WHAT THE JOB REPORTS (CLAUDE.md "success signals"): runJob writes one 'running' and one terminal
// status on every path, a throw included.
//   success "market not open" / "no claims due" (work 0)   nothing to do
//   success "committed N; deferred D"                      work = leagues committed
//   failed  "... failed L"                                 any league failed (read, price, commit, bug)
//   failed  "... late"                                     a league committed after the hold lifted
//                                                          (open + 10 min): the plan says a late run
//                                                          is surfaced, not hidden
// A deferred league (a price not printed yet) is not a failure: the next minute's post retries it,
// and the hold keeps live trading closed meanwhile, for at most 10 minutes.
// Verify by DATA, never by this status: claims_runs has a row per league-day; every claim due that
// day is terminal; trades holds the winners' rows.
import { type JobRun, type JobStatusWriter, runJob } from '../_shared/run-job.ts';
import { type DraftRow, type LeagueRow, type SlotRow } from '../record-trade/commit.ts';
import { type TradeRow } from '../_shared/draft-validation.ts';
import { type ClaimRow, type CommitPlan, type OrderRow, planLeague } from './plan.ts';

export const MAX_ATTEMPTS = 4;
/** The hold on live trading lifts this long after the open (claims_hold_active, SQL). */
export const HOLD_MS = 10 * 60_000;

/** Refusals from record_trade_atomic that close the WHOLE league, not one claim. */
export const LEAGUE_REFUSALS = new Set(['season_completed', 'draft_not_completed', 'league_not_found']);

export type R<T> = { ok: true; value: T } | { ok: false; error: string };

export interface RunDay {
  open: boolean;
  sessionDate: string | null;
  sessionOpenMs: number | null;
  due: string[];
}

export interface LeagueState {
  alreadyRan: boolean;
  claims: ClaimRow[];
  order: OrderRow[];
}

export interface Ledger {
  league: LeagueRow;
  seasonEnd: Date | null;
  picks: DraftRow[];
  trades: TradeRow[];
  slots: SlotRow[];
  draftable: Set<string>;
  eligibility: Map<string, Set<string>>;
  heldEligibility?: Map<string, Set<string>>;
}

export interface Prices {
  prices: Map<string, number>;
  /** Symbols whose price REQUEST failed (not "no price"): never read as a missing price early. */
  fetchFailed: Set<string>;
}

export type CommitReply =
  | { ok: true; won: number; lost: number; failed: number; missed: number }
  | { ok: false; reason: string; refusal?: string; claim_id?: string; detail?: unknown };

export interface RunDeps {
  now(): Date;
  runDay(): Promise<R<RunDay>>;
  leagueState(leagueId: string, runDate: string): Promise<R<LeagueState>>;
  ledger(leagueId: string, claims: ClaimRow[]): Promise<R<Ledger>>;
  prices(symbols: string[], sessionDate: string, sessionOpenMs: number): Promise<R<Prices>>;
  commit(leagueId: string, runDate: string, plan: CommitPlan): Promise<R<CommitReply>>;
  log?: (msg: string, detail?: unknown) => void;
}

export type LeagueResult =
  | { league_id: string; result: 'committed'; won: number; lost: number; failed: number; missed: number; late: boolean }
  | { league_id: string; result: 'already_ran' | 'nothing_pending' }
  | { league_id: string; result: 'deferred'; missing: string[] }
  | { league_id: string; result: 'failed'; error: string };

export interface RunResult extends Record<string, unknown> {
  ok: boolean;
  session_date: string | null;
  leagues: LeagueResult[];
}

export async function runLeague(deps: RunDeps, leagueId: string, day: { date: string; openMs: number }): Promise<LeagueResult> {
  const forced = new Map<string, string>();
  let forcedLeague: string | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const st = await deps.leagueState(leagueId, day.date);
    if (!st.ok) return { league_id: leagueId, result: 'failed', error: `state: ${st.error}` };
    if (st.value.alreadyRan) return { league_id: leagueId, result: 'already_ran' };
    if (st.value.claims.length === 0) return { league_id: leagueId, result: 'nothing_pending' };

    const ld = await deps.ledger(leagueId, st.value.claims);
    if (!ld.ok) return { league_id: leagueId, result: 'failed', error: `ledger: ${ld.error}` };

    const symbols = new Set<string>();
    for (const c of st.value.claims) {
      if (c.run_date < day.date) continue; // missed: never priced
      symbols.add(c.symbol);
      if (c.sell_symbol) symbols.add(c.sell_symbol);
    }
    let prices = new Map<string, number>();
    if (symbols.size > 0 && !forcedLeague) {
      const pr = await deps.prices([...symbols].sort(), day.date, day.openMs);
      if (!pr.ok) {
        if (deps.now().getTime() < day.openMs + HOLD_MS) return { league_id: leagueId, result: 'deferred', missing: [...symbols] };
        return { league_id: leagueId, result: 'failed', error: `prices: ${pr.error}` };
      }
      // A FAILED request is not "no price": wait for it while the hold lasts.
      const failedNeeded = [...symbols].filter((s) => pr.value.fetchFailed.has(s));
      if (failedNeeded.length > 0 && deps.now().getTime() < day.openMs + HOLD_MS) {
        return { league_id: leagueId, result: 'deferred', missing: failedNeeded.sort() };
      }
      prices = pr.value.prices;
    }

    const nowMs = deps.now().getTime();
    const planned = planLeague({
      runDate: day.date,
      sessionOpenMs: day.openMs,
      nowMs,
      league: ld.value.league,
      seasonEnd: ld.value.seasonEnd,
      picks: ld.value.picks,
      trades: ld.value.trades,
      slots: ld.value.slots,
      claims: st.value.claims,
      order: st.value.order,
      prices,
      draftable: ld.value.draftable,
      eligibility: ld.value.eligibility,
      heldEligibility: ld.value.heldEligibility,
      forced,
      forcedLeague,
    });
    if (planned.kind === 'defer') return { league_id: leagueId, result: 'deferred', missing: planned.missing };

    const c = await deps.commit(leagueId, day.date, planned.plan);
    if (!c.ok) return { league_id: leagueId, result: 'failed', error: `commit: ${c.error}` };
    const reply = c.value;
    if (reply.ok) {
      return {
        league_id: leagueId, result: 'committed',
        won: reply.won, lost: reply.lost, failed: reply.failed, missed: reply.missed,
        late: deps.now().getTime() >= day.openMs + HOLD_MS,
      };
    }
    deps.log?.(`commit refused on attempt ${attempt}/${MAX_ATTEMPTS}`, { league_id: leagueId, ...reply });
    switch (reply.reason) {
      case 'already_ran':
        return { league_id: leagueId, result: 'already_ran' };
      case 'claims_changed':
      case 'order_changed':
        continue;
      case 'step_refused': {
        const refusal = reply.refusal ?? 'unhandled';
        if (refusal === 'ledger_changed') continue;
        if (LEAGUE_REFUSALS.has(refusal)) {
          forcedLeague = refusal;
          continue;
        }
        if (!reply.claim_id || forced.has(reply.claim_id)) {
          return { league_id: leagueId, result: 'failed', error: `step refused: ${refusal}` };
        }
        forced.set(reply.claim_id, refusal);
        continue;
      }
      default:
        return { league_id: leagueId, result: 'failed', error: `commit refused: ${reply.reason}` };
    }
  }
  return { league_id: leagueId, result: 'failed', error: `no commit after ${MAX_ATTEMPTS} attempts` };
}

export async function runClaims(deps: RunDeps): Promise<JobRun<RunResult>> {
  const out: RunResult = { ok: false, session_date: null, leagues: [] };
  const day = await deps.runDay();
  if (!day.ok) {
    return { outcome: { status: 'failed', attempt: 1, message: `run day read failed: ${day.error}` }, response: out };
  }
  out.session_date = day.value.sessionDate;
  if (!day.value.open || !day.value.sessionDate || day.value.sessionOpenMs == null) {
    out.ok = true;
    return { outcome: { status: 'success', attempt: 1, work: 0, message: 'market not open' }, response: out };
  }
  if (day.value.due.length === 0) {
    out.ok = true;
    return { outcome: { status: 'success', attempt: 1, work: 0, message: 'no claims due' }, response: out };
  }

  for (const leagueId of day.value.due) {
    let r: LeagueResult;
    try {
      r = await runLeague(deps, leagueId, { date: day.value.sessionDate, openMs: day.value.sessionOpenMs });
    } catch (e) {
      r = { league_id: leagueId, result: 'failed', error: e instanceof Error ? e.message : String(e) };
    }
    out.leagues.push(r);
  }

  const committed = out.leagues.filter((l) => l.result === 'committed') as Extract<LeagueResult, { result: 'committed' }>[];
  const failed = out.leagues.filter((l) => l.result === 'failed');
  const deferred = out.leagues.filter((l) => l.result === 'deferred');
  const late = committed.filter((l) => l.late);
  const message = `committed ${committed.length}; deferred ${deferred.length}; failed ${failed.length}` +
    (late.length ? `; late ${late.length} (after the hold lifted)` : '') +
    ` of ${day.value.due.length} due`;
  out.ok = failed.length === 0 && late.length === 0;
  return {
    outcome: { status: out.ok ? 'success' : 'failed', attempt: 1, work: committed.length, message },
    response: out,
  };
}

export function runClaimsJob(deps: RunDeps, write: JobStatusWriter): Promise<RunResult> {
  return runJob<RunResult>({
    attempt: 1,
    write,
    body: () => runClaims(deps),
    onThrow: (e): Promise<JobRun<RunResult>> => {
      const name = e instanceof Error ? e.name : 'error';
      return Promise.resolve({
        outcome: { status: 'failed', attempt: 1, message: `unhandled: ${name}` },
        response: { ok: false, session_date: null, leagues: [], error: name },
      });
    },
  });
}
