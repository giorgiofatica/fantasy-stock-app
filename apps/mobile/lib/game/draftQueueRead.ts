/**
 * Reading my draft queue before the draft (3c-2; board "Draft lobby · Your
 * queue"). Pure, so the rules tests see it. draft_queue is owner-only under
 * RLS, so a league-scoped select returns just the caller's rows.
 *
 * A failed read is NOT an empty queue: set_draft_queue replaces the whole
 * list, so an editor seeded with [] after a failed read would wipe the saved
 * queue on its first save. The read reports 'error' and the editor isn't shown.
 */
export type QueueRead = { status: 'loading' } | { status: 'error' } | { status: 'ready'; queue: string[] };

/** The read's outcome from the query's resolved { data, error } (a query
 * error resolves, it doesn't throw). Rows come back ordered by position;
 * they're re-sorted here so the order never depends on the caller. */
export function queueRead(res: { data: { symbol: string; position: number }[] | null; error: unknown }): QueueRead {
  if (res.error || !res.data) return { status: 'error' };
  const queue = res.data
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((r) => r.symbol);
  return { status: 'ready', queue };
}

/** A re-read after the first one (the live room re-reads on every pick; the
 * lobby after a save). A failed re-read keeps the last good list: it is real
 * server data from this session, and hiding the editor mid-draft would throw
 * away unsaved edits. Only a read that never succeeded is an error, so the
 * editor is never seeded with an empty list it didn't read. */
export function nextQueueRead(
  prev: QueueRead,
  res: { data: { symbol: string; position: number }[] | null; error: unknown },
): QueueRead {
  const next = queueRead(res);
  if (next.status === 'error' && prev.status === 'ready') return prev;
  return next;
}

/** The load-failure line (Design Lead ruling: the house "X didn't load" form, with Try again). */
export const QUEUE_LOAD_FAILED = "Your queue didn't load.";

/** The live draft room's load failure, in the same form. */
export const DRAFT_ROOM_LOAD_FAILED = "The draft room didn't load.";

/** A renewed league's Run it back flow (LeagueRenewal), in the same form. */
export const RENEWAL_LOAD_FAILED = "The renewal didn't load.";

/**
 * The lobby's queue as the editor sees it: the read plus `generation`, the
 * editor's remount key. The editor seeds its local list from `initial` only
 * when it mounts, so the key must change when the DATA changes, never when a
 * re-read is merely requested. Keying on the request (origin/main up to this
 * fix: `refresh` bumped a counter that was also the key) remounted the editor
 * on Save with the pre-save list still current; the re-read then landed with
 * no second remount, so the editor showed the old list beside "Not saved yet."
 * and a second Save would have written the old list over the saved one
 * (Giorgio's phone, 1.3.0 (9), 2026-11-05).
 *
 * The state also belongs to ONE league (`leagueId`). The League tab keeps the
 * same hook instance when the pill switches leagues, so without that, B would
 * show A's list while B's read is in flight, and (two empty queues being the
 * common case) A's unsaved edits would survive into B, where Save writes them.
 */
export type QueueState = { leagueId: string | null; read: QueueRead; generation: number };

/** A league's queue before its first read. */
export function queueStateStart(leagueId: string | null): QueueState {
  return { leagueId, read: { status: 'loading' }, generation: 0 };
}

/** The state as it belongs to `leagueId`: another league's state is dropped
 * for a fresh, loading one (the same render, so no frame shows A's list as B's). */
export function queueStateFor(prev: QueueState, leagueId: string | null): QueueState {
  return prev.leagueId === leagueId ? prev : queueStateStart(leagueId);
}

/** The editor's remount key: the league AND the loaded data's generation. */
export function queueEditorKey(state: QueueState): string {
  return `${state.leagueId ?? ''}:${state.generation}`;
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

/** Move to `next`. A ready list that differs from the current one is new data
 * (generation + 1, the editor remounts on it); the same list keeps the
 * generation, so a confirming re-read never remounts over edits in progress.
 * Loading/error never bump: the editor isn't shown for them. */
function moveTo(prev: QueueState, next: QueueRead): QueueState {
  if (next === prev.read) return prev;
  if (next.status === 'ready' && prev.read.status === 'ready' && sameList(next.queue, prev.read.queue)) return prev;
  return { ...prev, read: next, generation: next.status === 'ready' ? prev.generation + 1 : prev.generation };
}

/** A read for `leagueId` landed (keeps nextQueueRead's rule: a failed re-read
 * keeps the last good list). A read for any other league than the state's is
 * ignored: it can't be this state's data. */
export function queueStateOnRead(
  prev: QueueState,
  leagueId: string | null,
  res: { data: { symbol: string; position: number }[] | null; error: unknown },
): QueueState {
  if (prev.leagueId !== leagueId) return prev;
  return moveTo(prev, nextQueueRead(prev.read, res));
}

/** A save the server accepted for `leagueId`: what it stored is now that
 * league's queue, at once, so the editor is clean on the saved list with no
 * wait for the re-read. A save for any other league than the state's (the
 * user switched while it was in flight) is ignored. */
export function queueStateOnSaved(prev: QueueState, leagueId: string | null, saved: string[]): QueueState {
  if (prev.leagueId !== leagueId) return prev;
  return moveTo(prev, { status: 'ready', queue: saved.slice() });
}

/** The list set_draft_queue stored, from its ok result (`symbols`, normalized
 * server side). An ok result without a string list falls back to what was
 * sent: the call replaces the whole queue, so an accepted save stored it. */
export function savedQueueFrom(res: { symbols?: unknown } | null, sent: string[]): string[] {
  const s = res?.symbols;
  return Array.isArray(s) && s.every((x) => typeof x === 'string') ? (s as string[]).slice() : sent.slice();
}
