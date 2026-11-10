/**
 * The pre-draft order read's rules (usePreDraftData), pure so tests-deno sees them.
 *
 * Found on League B, build 1.3.0 (12), 2026-11-10: the hook read get_draft_order ONCE (its effect keyed on the
 * league alone), so a League tab or Home opened before T-1h kept "Draft order · waiting" after the server set the
 * order. The hook now re-reads with the auto-start status (useDraftAutoStart's statusKey: the T-1h and T
 * boundaries, the 3 s poll from T, every fix and pull-to-refresh). Two rules make that re-read safe:
 *
 *   1. A re-read never blanks what is shown. A FAILED re-read (the resolved { error }, or a throw) keeps the last
 *      answer of that read; only an answer replaces it. `loading` is true only until the first read lands.
 *   2. The T-1h re-read can land a beat early on the server's clock (the phone's offset is estimated from one
 *      round trip) or before the gate has cleared the league, and the next boundary is an hour away. So when the
 *      server says the order is due (or within a minute of due) but not set, the hook re-checks shortly, a
 *      bounded number of times, instead of showing "waiting" for the whole hour. A postponement clears the draft
 *      time (finalize_at null), which ends the re-checks.
 */
import { parseDraftOrder } from '../draftOrder';

export interface PreDraftMember {
  userId: string;
  displayName: string;
  isBot: boolean;
}

export interface PreDraftData {
  waiting: boolean | null;
  orderRevealed: string[] | null;
  members: PreDraftMember[];
  loading: boolean;
  /** draft_date - 1h, or the later time the order actually finalized
   * (DraftOrderInfo.finalizeAt) -- board: "Draft order set Sat 6:00 PM
   * ET, an hour before the draft". Null while `waiting` is true (there is
   * no set time yet to show -- OrderWaiting's own bar covers that case). */
  finalizeAt: string | null;
  memberCount: number;
  minMembers: number;
}

export const PRE_DRAFT_EMPTY: PreDraftData = {
  waiting: null, orderRevealed: null, members: [], loading: true, finalizeAt: null, memberCount: 0, minMembers: 0,
};

/** A read's resolved outcome ({ data, error }, as supabase-js resolves an rpc). */
export interface ReadResult {
  data: unknown;
  error: unknown;
}

/** Fold one pair of reads into the state. `prev` is the state shown for THIS league (null on its first read). */
export function nextPreDraftData(prev: PreDraftData | null, order: ReadResult, names: ReadResult): PreDraftData {
  const base = prev ?? PRE_DRAFT_EMPTY;
  let next: PreDraftData = { ...base, loading: false };
  // Rule 1: an order read that failed keeps the last answer; the first read shows the not-revealed state (as before).
  if (!order.error || prev === null) {
    const parsed = order.error ? null : parseDraftOrder(order.data);
    next = {
      ...next,
      waiting: parsed?.waitingForMembers ?? null,
      orderRevealed: parsed?.order ?? null,
      finalizeAt: parsed?.finalizeAt ?? null,
      memberCount: parsed?.memberCount ?? 0,
      minMembers: parsed?.minMembers ?? 0,
    };
  }
  if (!names.error || prev === null) {
    const rows = (names.error ? [] : names.data ?? []) as { user_id: string; display_name: string; is_bot: boolean }[];
    next = { ...next, members: rows.map((n) => ({ userId: n.user_id, displayName: n.display_name, isBot: n.is_bot })) };
  }
  return next;
}

/** Re-check spacing after the order should have been set, and how many re-checks one key may make (~2 min). */
export const ORDER_RECHECK_MS = 5000;
export const ORDER_RECHECK_MAX = 24;
/** How close to finalize_at (server clock) a not-yet-set order counts as "about to be set". */
export const ORDER_DUE_WINDOW_MS = 60_000;

/** Rule 2: ms until the next re-check of an order that is due (or within a minute of due) but not set yet, or
 * null (set, below four members, no draft time, a failed read, or out of re-checks). */
export function orderRecheckDelayMs(order: ReadResult, attempts: number): number | null {
  if (order.error || attempts >= ORDER_RECHECK_MAX) return null;
  const p = parseDraftOrder(order.data);
  if (!p || p.revealed || p.waitingForMembers || p.state !== 'open' || !p.finalizeAt) return null;
  const left = Date.parse(p.finalizeAt) - Date.parse(p.serverNow);
  if (!Number.isFinite(left) || left > ORDER_DUE_WINDOW_MS) return null;
  return Math.max(0, left) + ORDER_RECHECK_MS;
}
