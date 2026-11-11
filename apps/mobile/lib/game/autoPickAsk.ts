/**
 * autoPickAsk: when the draft room asks the server to make an expired turn's
 * auto-pick, and when it asks again. Pure (no React, no I/O), so the timing is
 * tested in tests-deno/auto-pick-ask.test.ts.
 *
 * Giorgio, 2026-11-10 (PRODUCT_RULES › Draft, "The auto-pick is instant"): "the
 * selection needs to be instant so the draft flow continues". Build 12 measured
 * every auto-pick 8–48 s after zero because the room's ask keyed on the LAST
 * SERVER READ of the clock, which only turns 'auto_picking' on a re-read, and a
 * re-read only follows a pick. So the ask never fired and every pick waited for
 * the cron sweep. Here:
 *
 *   * TRIGGER. The ask is due at the server's deadline converted to the device's
 *     clock through the read's own offset (autoPickDueAt). Never a read's clock
 *     kind, never a jitter.
 *   * RETRY. not_overdue (the device fired a beat early), a transport failure or
 *     a server fault (5xx) asks again after AUTO_PICK_RETRY_MS. A pick, a lost
 *     race, a stall, a price outage or any other refusal stops (nextAskStep).
 *   * BOUNDED. At most AUTO_PICK_MAX_ASKS asks, and none later than
 *     AUTO_PICK_CAP_MS after the first, per turn. The server sweep covers the
 *     rest. The ask count stays well under validate-and-record-pick's 60 a minute
 *     per user, which a manager's own manual pick shares.
 *   * NOTHING IS LOST. The state only changes when an ask is SENT or ANSWERED
 *     (askSent / askAnswered), never when a timer is set, so a timer cancelled by
 *     a re-render costs nothing: the next render sets it again from the same state.
 *
 * The server is the authority (decideAutoPickGate on the DB clock; the
 * (league_id, pick_number) unique index settles every race). Nothing here decides
 * a pick; the room only shows what the server recorded.
 */
import type { FunctionRefusal } from '../functionRefusal';

/** Re-ask spacing after not_overdue, a transport failure or a 5xx. */
export const AUTO_PICK_RETRY_MS = 500;
/** No ask later than this after the turn's first ask. */
export const AUTO_PICK_CAP_MS = 30_000;
/** At most this many asks per turn: validate-and-record-pick allows 60 a minute per user,
 * shared with the manager's own picks, so the auto-pick ask never takes more than a quarter. */
export const AUTO_PICK_MAX_ASKS = 15;

/** The device time (ms) the turn's deadline falls at: the server's deadline,
 * moved by the server-minus-device offset of the read that carried it. `sentAtMs`
 * is the device time the read was SENT: the server's clock was read after that,
 * so the estimate can only be early (by the request's travel time), and an early
 * ask is answered not_overdue and asked again. Null when no clock runs. */
export function autoPickDueAt(read: { running: boolean; deadlineAt: string | null; serverNow: string | null; sentAtMs: number }): number | null {
  if (!read.running || read.deadlineAt === null || read.serverNow === null) return null;
  const deadline = Date.parse(read.deadlineAt);
  const serverNow = Date.parse(read.serverNow);
  if (!Number.isFinite(deadline) || !Number.isFinite(serverNow) || !Number.isFinite(read.sentAtMs)) return null;
  return read.sentAtMs + (deadline - serverNow);
}

/** One turn's ask. `stopped`: nothing more to ask this turn (see nextAskStep). */
export interface AskState {
  pick: number;
  asks: number;
  firstAskAt: number | null;
  /** Device time the next ask may go (a retry's spacing); null = at the deadline. */
  nextAt: number | null;
  inFlight: boolean;
  stopped: boolean;
}

export const NO_ASK: AskState = { pick: 0, asks: 0, firstAskAt: null, nextAt: null, inFlight: false, stopped: true };

/** The ask for the turn on the clock: kept as it is while the turn is the same
 * (a re-render, a re-read, a new deadline reading), a fresh one when it moves. */
export function askForTurn(cur: AskState, pick: number): AskState {
  if (cur.pick === pick) return cur;
  return { pick, asks: 0, firstAskAt: null, nextAt: null, inFlight: false, stopped: false };
}

/** How long to wait before sending the ask (0 = now), or null: don't ask (no
 * clock, stopped, already in flight, or the bound is reached). */
export function askWaitMs(ask: AskState, dueAt: number | null, now: number): number | null {
  if (dueAt === null || ask.stopped || ask.inFlight) return null;
  if (ask.asks >= AUTO_PICK_MAX_ASKS) return null;
  if (ask.firstAskAt !== null && now - ask.firstAskAt >= AUTO_PICK_CAP_MS) return null;
  const at = Math.max(dueAt, ask.nextAt ?? dueAt);
  return Math.max(0, at - now);
}

/** The ask went out (the ONLY place an ask is counted). */
export function askSent(ask: AskState, now: number): AskState {
  return { ...ask, asks: ask.asks + 1, firstAskAt: ask.firstAskAt ?? now, inFlight: true };
}

/** What the server's answer means for this turn. */
export type AskStep =
  /** Ask again in `delayMs`. */
  | { kind: 'retry'; delayMs: number }
  /** The pick is recorded (by this ask, a racing one, or the sweep): re-read. */
  | { kind: 'done' }
  /** No legal stock: the stalled card (the existing UI). */
  | { kind: 'stalled' }
  /** Waiting for prices (a vendor outage): the existing caption. The sweep retries. */
  | { kind: 'waiting_for_prices' }
  /** Any other refusal (rate_limited, clock_not_running, draft_not_in_progress …): stop, re-read. */
  | { kind: 'stop' };

/** The next step from an answer. not_overdue waits for the server's own deadline
 * (from its answer) when that is sooner than the retry spacing. */
export function nextAskStep(r: FunctionRefusal): AskStep {
  if (r.transport) return { kind: 'retry', delayMs: AUTO_PICK_RETRY_MS };
  const reason = r.reason ?? (typeof r.body.reason === 'string' ? r.body.reason : null);
  if (reason === null) return { kind: 'done' }; // ok, or ok + already_recorded
  if (reason === 'stalled') return { kind: 'stalled' };
  if (reason === 'price_unavailable') return { kind: 'waiting_for_prices' };
  if (reason === 'pick_conflict' || reason === 'draft_complete') return { kind: 'done' };
  if (reason === 'not_overdue') {
    const left = Date.parse(String(r.body.deadline_at)) - Date.parse(String(r.body.server_now));
    const delayMs = Number.isFinite(left) ? Math.min(AUTO_PICK_RETRY_MS, Math.max(50, left + 50)) : AUTO_PICK_RETRY_MS;
    return { kind: 'retry', delayMs };
  }
  // A server fault may succeed on the next ask; a 429 must not be hammered.
  if (r.status !== null && r.status >= 500) return { kind: 'retry', delayMs: AUTO_PICK_RETRY_MS };
  return { kind: 'stop' };
}

/** The answer arrived for `pick`. An answer for a turn that has moved on changes
 * nothing (the new turn has its own ask). */
export function askAnswered(ask: AskState, pick: number, step: AskStep, now: number): AskState {
  if (ask.pick !== pick) return ask;
  if (step.kind === 'retry') return { ...ask, inFlight: false, nextAt: now + step.delayMs };
  return { ...ask, inFlight: false, stopped: true };
}
