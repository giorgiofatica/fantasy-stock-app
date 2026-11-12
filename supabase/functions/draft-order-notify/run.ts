// draft-order-notify: ONE run (open due rooms, finalize due orders, deliver
// pending notices). Moved VERBATIM out of index.ts's Deno.serve body on
// 2026-11-11 so it can run under EdgeRuntime.waitUntil (./handler.ts) and be
// tested with an in-memory table (./run.test.ts). Changes from the old body,
// and nothing else:
//   - every sendExpoPush passes { timeoutMs: PUSH_TIMEOUT_MS } (4 s). A timeout
//     resolves { sent:false, reason:'expo_error' } (never throws, see
//     _shared/push.ts), so the row takes nextPushStatus('expo_error', n): back
//     to 'pending' for the next tick, 'failed' once MAX_PUSH_ATTEMPTS is spent,
//     the same path as any other failed send. Before, an Expo fetch had no
//     bound, so one hung push could hold the run (and pg_net's queue) for
//     ~150 s.
//   - the clock, Expo and the token lookup are injected (RunDeps), for tests.
//   - the result is returned, not answered: ./handler.ts logs it as one line.
//   - two guards for overlapping runs (below): a reclaim at the attempt cap is
//     settled 'failed' unsent, and a settle only lands on the run's own claim.
//
// OVERLAP: see plan.ts STALE_SENDING_MS. In short, the CLAIM is a conditional
// UPDATE on the (push_status, push_attempts) pair the run READ, so of two runs
// holding the same snapshot exactly one claims; push_attempts grows on every
// claim, so it is a version number and an old snapshot can never claim again.
// BOTH halves matter: the status alone cannot separate two runs that read the
// same STALE 'sending' row ('sending' -> 'sending' matches twice), and the
// count alone cannot tell a row settled since the read (a settle leaves the
// count alone). A claimed row is invisible to other runs' selects until
// STALE_SENDING_MS has passed since its claim, which is longer than any live
// run can hold it.
//   GUARD (a), reclaimExhausted: a stale 'sending' row that already used its
//     last attempt is claimed and settled 'failed' (push_error
//     'attempts_exhausted') WITHOUT a send, so a row is pushed at most
//     MAX_PUSH_ATTEMPTS times even if every settle keeps failing.
//   GUARD (b): the settle matches push_attempts = the count this run wrote, so
//     a run never overwrites a newer claim; a settle that matches nothing is
//     `settle_lost` (another run owns the row), distinct from `settle_failed`
//     (a write error: the row stays 'sending' and is reclaimed later).
import { getTargetToken as realGetTargetToken, type PushMessage, type PushSendResult, sendExpoPush as realSendExpoPush } from '../_shared/push.ts';
import { PUSH_TIMEOUT_MS } from '../_shared/notice-delivery.ts';
import {
  decideNotice,
  DELIVERED_KINDS,
  type DeliveryOutcome,
  fairOrder,
  isDebouncing,
  MAX_PUSHES_PER_RUN,
  nextPushStatus,
  type NoticeContext,
  reclaimExhausted,
  RENEWAL_KINDS,
  type RenewalKind,
  renewalNoticeMessage,
  STALE_SENDING_MS,
} from './plan.ts';

// deno-lint-ignore no-explicit-any
type Admin = any;

export interface NoticeRow {
  id: string;
  league_id: string;
  user_id: string;
  kind: string;
  created_at: string;
  subject_user_id: string | null;
  detail: Record<string, unknown> | null;
  push_status: string;
  push_attempts: number;
}

export interface RunDeps {
  admin: Admin;
  sendExpoPush?: (token: string, msg: PushMessage, opts?: { timeoutMs?: number }) => Promise<PushSendResult>;
  getTargetToken?: typeof realGetTargetToken;
  /** ms since epoch. One clock for the stale cutoff, the debounce and the claim stamp. */
  now?: () => number;
}

export type NotifyResult = Record<string, unknown> & { ok: boolean };

export async function runDraftOrderNotify(deps: RunDeps): Promise<NotifyResult> {
  const admin = deps.admin;
  const sendExpoPush = deps.sendExpoPush ?? realSendExpoPush;
  const getTargetToken = deps.getTargetToken ?? realGetTargetToken;
  const now = deps.now ?? Date.now;

  // ---- 1. Open due rooms (creates the room-open notices) ---------------------
  // Destructure-and-check: .rpc() resolves to { error } on a Postgres error.
  // A failure here does not stop delivery of notices that already exist.
  const { data: opened, error: openErr } = await admin.rpc('open_due_draft_rooms');
  if (openErr) console.error('open_due_draft_rooms failed', JSON.stringify(openErr));

  // ---- 2. On-time finalize for everything else (#67) -------------------------
  const { data: finalized, error: finErr } = await admin.rpc('finalize_due_draft_orders');
  if (finErr) console.error('finalize_due_draft_orders failed', JSON.stringify(finErr));

  // ---- 3. Deliver ------------------------------------------------------------
  const staleIso = new Date(now() - STALE_SENDING_MS).toISOString();
  const { data: rows, error: selErr } = await admin
    .from('league_notifications')
    .select('id, league_id, user_id, kind, created_at, subject_user_id, detail, push_status, push_attempts')
    .in('kind', [...DELIVERED_KINDS, ...RENEWAL_KINDS])
    .or(`push_status.eq.pending,and(push_status.eq.sending,push_attempted_at.lt.${staleIso})`)
    .order('created_at', { ascending: true })
    .limit(MAX_PUSHES_PER_RUN * 4); // oldest first, then shared fairly across leagues (fairOrder)
  if (selErr) {
    console.error('notice select failed', JSON.stringify(selErr));
    // ok:false: the run did NOT complete (was the old HTTP 500 body).
    return { ok: false, reason: 'notice_query_failed', opened: opened ?? null, finalized: finalized ?? null };
  }

  const counts: Record<string, number> = {};
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);

  // Run it back only: a cached league name lookup (renewalNoticeMessage needs
  // nothing else). draft_notice_context covers DELIVERED_KINDS' own league info.
  interface RenewalLeagueInfo { name: string }
  const renewalLeagues = new Map<string, RenewalLeagueInfo | null>();
  async function leagueInfo(id: string): Promise<RenewalLeagueInfo | null | undefined> {
    if (renewalLeagues.has(id)) return renewalLeagues.get(id);
    const { data, error } = await admin.from('leagues').select('name').eq('id', id).maybeSingle();
    if (error) return undefined; // lookup failed: not cached, retried next row/tick
    const info = data ? { name: String(data.name ?? 'Your league') } : null;
    renewalLeagues.set(id, info);
    return info;
  }

  async function deliver(row: NoticeRow): Promise<DeliveryOutcome> {
    // Run it back: renewal notices carry their whole content in `detail`, and
    // their recipient is not in a draft order and may not be a league member yet
    // (a pending invitee), so they skip draft_notice_context entirely and use
    // their own lookup (league name only).
    if ((RENEWAL_KINDS as readonly string[]).includes(row.kind)) {
      const rl = await leagueInfo(row.league_id);
      if (rl === undefined) return 'lookup_failed';
      if (rl === null) return 'not_in_order';   // league deleted (a cancelled renewal cascades here)
      const message = renewalNoticeMessage({
        kind: row.kind as RenewalKind,
        leagueName: rl.name,
        leagueId: row.league_id,
        detail: row.detail ?? {},
      });
      if (!message) return 'unknown_kind';
      const { token, enabled, lookupFailed } = await getTargetToken(admin, row.user_id);
      if (lookupFailed) return 'lookup_failed';
      if (!token || !enabled) return 'no_token';
      const rr = await sendExpoPush(token, message, { timeoutMs: PUSH_TIMEOUT_MS }); // bounded
      return rr.sent ? 'sent' : rr.reason;
    }

    // Every other DELIVERED_KINDS row: the generic auto-start context + decision.
    const { data: ctx, error: ctxErr } = await admin.rpc('draft_notice_context', { p_notice_id: row.id });
    if (ctxErr) return 'lookup_failed';
    if (!ctx) return 'not_in_order'; // league deleted since (cascade would normally remove the row)
    const decision = decideNotice(ctx as NoticeContext);
    if (!decision.send) return decision.outcome;

    const { token, enabled, lookupFailed } = await getTargetToken(admin, row.user_id);
    if (lookupFailed) return 'lookup_failed';
    if (!token || !enabled) return 'no_token';

    const res = await sendExpoPush(token, decision.message, { timeoutMs: PUSH_TIMEOUT_MS }); // bounded
    return res.sent ? 'sent' : res.reason;
  }

  // A draft-time change waits for 2 quiet minutes (plan.ts TIME_SET_QUIET_MS):
  // left pending and unclaimed, so a further change can still re-stamp it.
  const nowDate = new Date(now());
  for (const row of fairOrder(((rows ?? []) as NoticeRow[]).filter((r) => !(r.push_status === 'pending' && isDebouncing(r.kind, r.created_at, nowDate))), MAX_PUSHES_PER_RUN)) {
    const attempts = Number(row.push_attempts) + 1;
    // CLAIM: only if nobody moved the row since we read it. (push_status,
    // push_attempts) is the version: every claim bumps push_attempts, so an
    // overlapping run holding the same snapshot matches zero rows here.
    const { data: claimed, error: claimErr } = await admin
      .from('league_notifications')
      .update({ push_status: 'sending', push_attempts: attempts, push_attempted_at: new Date(now()).toISOString() })
      .eq('id', row.id)
      .eq('push_status', row.push_status)
      .eq('push_attempts', row.push_attempts)
      .select('id')
      .maybeSingle();
    if (claimErr) { bump('claim_failed'); console.error('claim failed', row.id, JSON.stringify(claimErr)); continue; }
    if (!claimed) { bump('claim_lost'); continue; }

    let outcome: DeliveryOutcome;
    if (reclaimExhausted(row)) {
      // GUARD (a): claimed (so no other run takes it), but NOT sent. Its last
      // allowed attempt is already spent; a send that may have gone out is not
      // repeated. Bounds every row at MAX_PUSH_ATTEMPTS sends in total.
      outcome = 'attempts_exhausted';
    } else {
      try {
        outcome = await deliver(row);
      } catch (e) {
        console.error('deliver threw', row.id, String(e));
        outcome = 'expo_error';
      }
    }
    const status = nextPushStatus(outcome, attempts);
    // Check the EFFECT, not just the error: an UPDATE matching zero rows
    // resolves { data: null, error: null } (CLAUDE.md success signals #5).
    // GUARD (b): settle only OUR claim (status AND the attempt count we wrote),
    // so a run can never overwrite a newer claim by another run.
    const { data: settled, error: setErr } = await admin
      .from('league_notifications')
      .update({ push_status: status, push_error: outcome === 'sent' ? null : outcome })
      .eq('id', row.id)
      .eq('push_status', 'sending')
      .eq('push_attempts', attempts)
      .select('id')
      .maybeSingle();
    if (setErr) {
      // The row stays 'sending' and is reclaimed after STALE_SENDING_MS — a
      // possible duplicate push (capped by guard (a)), never a lost one.
      bump('settle_failed');
      console.error('settle failed', row.id, JSON.stringify(setErr));
      continue;
    }
    if (!settled) {
      // Our claim is no longer the row's latest: another run reclaimed it (or
      // it was moved on). That run owns the row and settles it; not an error.
      bump('settle_lost');
      console.log('settle lost: row re-claimed by another run', row.id);
      continue;
    }
    bump(status === 'pending' ? `retry_${outcome}` : status);
  }

  return {
    ok: true, // the run COMPLETED — not a claim that any push was delivered
    opened: openErr ? null : opened,
    open_error: openErr ? 'open_due_draft_rooms_failed' : null,
    finalized: finErr ? null : finalized,
    finalize_error: finErr ? 'finalize_due_draft_orders_failed' : null,
    examined: (rows ?? []).length,
    outcomes: counts,
  };
}
