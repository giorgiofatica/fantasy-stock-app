/**
 * Your queue saves as you go (PRODUCT_RULES, 2026-11-11, "B saves as you go"; board #call-queue-save). Every add,
 * remove or reorder saves on its own a moment after you stop, before the draft and in the room. No "Save queue",
 * no "Not saved yet.". A failed save shows "Your queue couldn't be saved." in place with "Try again", and the list
 * stays as you left it.
 *
 * Pure (no RN): the clock and the save call are injected, so tests-deno drives every order of events.
 *
 * THE MACHINE. One per league (`attachQueueAutosave`), so a remount, or the lobby and the room open together, never
 * makes two writers for one queue.
 *   list      what the screen shows: your edits, re-based on what the server did (a drafted stock leaves it)
 *   seq       bumps on every edit (never on a re-base: a change the SERVER made is not yours to save)
 *   savedSeq  the newest edit the server confirmed. Unsaved edits <=> seq > savedSeq
 *   status    idle | pending (debounce running) | saving (one call in flight) | failed (the newest save failed)
 *   failure   the line shown in place; stays through a retry and clears on the next accepted save
 * edit -> pending; the timer fires -> saving; ok -> idle (or pending again, if you edited meanwhile); refused or
 * error -> failed when it was the newest edit, else the newer edit's own save takes over (no flash).
 *
 * LAST EDIT WINS: at most ONE set_draft_queue is in flight. set_draft_queue replaces the whole list and carries no
 * version, so two calls in flight could land in either order and the older could be stored last; nothing on the
 * client can reorder them once sent. A timer that fires while a call is in flight waits for it, then sends the
 * list as it is THEN (the newest), so the last call sent is always the newest list.
 */
import { queueRefusalLine } from './draftQueue';
import { savedQueueFrom } from './draftQueueRead';

/** "A moment after you stop". Longer than the gap between taps when you walk a stock up the list with its arrow
 * (repeat taps ~250–450 ms apart) or remove a run of rows, so one burst is one save; short enough that the save has
 * usually landed before you look away (leaving the screen saves at once anyway). */
export const QUEUE_SAVE_DELAY_MS = 800;
/** A burst of taps that never pauses still saves this often, so a crash mid-burst loses at most this much. */
export const QUEUE_SAVE_MAX_WAIT_MS = 3000;

export type QueueSaveStatus = 'idle' | 'pending' | 'saving' | 'failed';
export interface QueueSaveView {
  list: string[];
  status: QueueSaveStatus;
  /** The line shown in place of the list's foot (with "Try again"), or null. */
  failure: string | null;
}

/** A supabase-js call's resolved shape. `.rpc()` resolves with `error` on a Postgres error, it never throws. */
export type RpcResult = { data: unknown; error: unknown };
export type SaveOutcome = { ok: true; stored: string[] } | { ok: false; line: string };

/** set_draft_queue's answer, read the CLAUDE.md way: an `error` is a failure whatever `data` says, and only
 * `data.ok === true` is a save. The stored list is the server's (`symbols`, drafted stocks already dropped). */
export function readSaveResult(res: RpcResult | null | undefined, sent: string[]): SaveOutcome {
  if (!res || res.error) return { ok: false, line: queueRefusalLine('unknown') };
  const d = res.data as { ok?: unknown; reason?: unknown; symbols?: unknown } | null;
  if (!d || d.ok !== true) return { ok: false, line: queueRefusalLine(String(d?.reason ?? 'unknown'), d?.symbols) };
  return { ok: true, stored: savedQueueFrom(d, sent) };
}

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}
export const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface QueueSaveHandlers {
  /** One set_draft_queue call with the whole list. */
  send(symbols: string[]): Promise<RpcResult>;
  /** An accepted save: the list the server stored (the parent adopts it, so a remount seeds from it). */
  onStored?(stored: string[]): void;
}

function same(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

export class QueueAutosave {
  private list: string[];
  private seq = 0;
  private sentSeq = 0;
  private savedSeq = 0;
  private inFlight = false;
  /** A save was due while one was in flight: send the newest list the moment it resolves. */
  private queued = false;
  private timer: unknown = null;
  private burstStart: number | null = null;
  private failure: string | null = null;
  private listeners = new Set<() => void>();
  private view: QueueSaveView;

  constructor(
    initial: string[],
    private handlers: QueueSaveHandlers,
    private clock: Clock = realClock,
    private delayMs = QUEUE_SAVE_DELAY_MS,
    private maxWaitMs = QUEUE_SAVE_MAX_WAIT_MS,
  ) {
    this.list = initial.slice();
    this.view = this.makeView();
  }

  setHandlers(h: QueueSaveHandlers) {
    this.handlers = h;
  }

  /** Edits not yet confirmed by the server (pending, in flight, or failed). */
  get hasUnsaved(): boolean {
    return this.seq > this.savedSeq;
  }
  get listenerCount(): number {
    return this.listeners.size;
  }

  snapshot(): QueueSaveView {
    return this.view;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Your add / remove / reorder: the list changes now; the save follows a moment after you stop. */
  edit(next: string[]) {
    this.list = next.slice();
    this.seq += 1;
    this.schedule();
    this.emit();
  }

  /**
   * The server moved (decision 19: a pick pruned your queue; a re-read; your own save landing). Never an edit, so
   * it never schedules a save and never touches `failure`: no flash of the failure state.
   *   - nothing unsaved: the screen takes the server's list;
   *   - unsaved edits: yours stay, minus the drafted stocks. Only two things remove a row from YOUR queue on the
   *     server: your own save, and a pick (the trigger in 20261129000000), and a pick is in `drafted`. So the
   *     manual-save editor's "minus what the server dropped" (rebaseQueue) is NOT applied here: with saves landing
   *     under your taps, a dropped-looking stock is usually one you just added, and dropping it would lose it.
   *     A pick the drafted set has not shown yet stays one read longer; the server drops it from the next save.
   * Silent (the caller is rendering and reads `snapshot()` next); `notify()` tells other screens after.
   */
  rebase(nextBase: string[], drafted: ReadonlySet<string>): boolean {
    const next = this.hasUnsaved ? this.list.filter((s) => !drafted.has(s)) : nextBase.slice();
    if (same(next, this.list)) return false;
    this.list = next;
    this.view = this.makeView();
    return true;
  }

  /** A screen opened on this league's queue: the same rule as a re-base. Silent. */
  attach(baseline: string[], drafted: ReadonlySet<string>) {
    this.rebase(baseline, drafted);
  }

  /** Tell subscribers after a silent change (call outside render). */
  notify() {
    this.emit();
  }

  /** Leaving the screen or the app going to the background: save now whatever is unsaved (a running debounce, or
   * a failed save), or right after the call in flight. */
  flush() {
    if (!this.hasUnsaved) return;
    this.clearTimer();
    if (this.inFlight) {
      // The call in flight already carries everything up to sentSeq; resend only for newer edits.
      if (this.seq > this.sentSeq) this.queued = true;
    } else void this.send();
    this.emit();
  }

  /** "Try again". */
  retry() {
    if (this.inFlight || !this.hasUnsaved) return;
    this.clearTimer();
    void this.send();
  }

  private schedule() {
    this.clearTimer();
    const now = this.clock.now();
    if (this.burstStart === null) this.burstStart = now;
    const wait = Math.max(0, Math.min(this.delayMs, this.burstStart + this.maxWaitMs - now));
    this.timer = this.clock.setTimeout(() => this.due(), wait);
  }

  private clearTimer() {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  private due() {
    this.timer = null;
    if (this.inFlight) this.queued = true;
    else void this.send();
  }

  private async send() {
    this.burstStart = null;
    this.queued = false;
    const seqAt = this.seq;
    const sent = this.list.slice();
    this.sentSeq = seqAt;
    this.inFlight = true;
    this.emit();
    let res: RpcResult;
    try {
      res = await this.handlers.send(sent);
    } catch (err) {
      res = { data: null, error: err ?? new Error('send threw') };
    }
    this.inFlight = false;
    const out = readSaveResult(res, sent);
    if (out.ok) {
      this.savedSeq = Math.max(this.savedSeq, seqAt);
      this.failure = null;
      try {
        this.handlers.onStored?.(out.stored.slice());
      } catch {
        // The parent's bookkeeping never turns an accepted save into a failure.
      }
    } else if (seqAt === this.seq && !this.queued) {
      // The newest edit failed: say so, keep the list. An older one failing is covered by the newer save.
      this.failure = out.line;
    }
    if (this.queued) void this.send();
    else this.emit();
  }

  private makeView(): QueueSaveView {
    const status: QueueSaveStatus = this.inFlight ? 'saving' : this.timer !== null || this.queued ? 'pending' : this.failure ? 'failed' : 'idle';
    return { list: this.list.slice(), status, failure: this.failure };
  }

  private emit() {
    this.view = this.makeView();
    for (const fn of [...this.listeners]) fn();
  }
}

/** One machine per league, kept while a screen shows it or its edits are unsaved, so a save in flight when you
 * leave still lands (and a failed one is still on screen when you come back). */
const machines = new Map<string, QueueAutosave>();

export function attachQueueAutosave(
  key: string,
  baseline: string[],
  drafted: ReadonlySet<string>,
  handlers: QueueSaveHandlers,
  make: (initial: string[], h: QueueSaveHandlers) => QueueAutosave = (i, h) => new QueueAutosave(i, h),
): QueueAutosave {
  const existing = machines.get(key);
  if (existing && (existing.hasUnsaved || existing.listenerCount > 0)) {
    existing.setHandlers(handlers);
    existing.attach(baseline, drafted);
    return existing;
  }
  const m = make(baseline, handlers);
  machines.set(key, m);
  return m;
}

/** Tests only: forget every machine. */
export function resetQueueAutosaves() {
  machines.clear();
}
