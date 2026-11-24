// enrich-symbols run: the ORDER of one run, with the I/O injected so tests can
// drive the exact code prod runs (run.test.ts). ./batch.ts supplies Finnhub,
// Alpaca and the symbols writes; ./plan.ts supplies every verdict.
//
// ORDER (docs/plans/2026-11-23-claims-fix-themselves.md, "Settled during the
// build" point 1):
//   1. Judge stocks one by one (supplier calls). NOTHING is written here, so a
//      run cut off part way has written no drop and no mark; those stocks are
//      simply judged again by a later run.
//   2. Stop judging early, and keep what was judged, when:
//        - the supplier says stop (a transient answer: 429/5xx/network/timeout);
//        - the run's OWN deadline passes (RUN_FETCH_DEADLINE_MS from the start).
//          A judge still in flight at the deadline is abandoned, so one hung
//          supplier call cannot take the whole run.
//      Either way the stocks judged so far are written, with the mass-drop
//      guard applied over THOSE stocks (massDropLimit(judged)). Writing
//      nothing on an early stop would stop the refresh entirely if the
//      supplier cut most runs short.
//   3. One read: is any stock held within the last 24 h? A failed read counts
//      as yes (hold, never drop).
//   4. Decide every verdict (plan.ts decideRun).
//   5. Write the holds FIRST, as ONE statement (cursor + mark, nothing else),
//      so a refusal is never half-recorded; then the normal writes.

import { decideRun, tallyProfiles, type RowPlan, type RowValues, type RunDecision, type SymbolRow } from './plan.ts';

/** Per supplier call (Finnhub profile2, one Alpaca snapshots request). */
export const SUPPLIER_CALL_TIMEOUT_MS = 10_000;
/** The whole Alpaca price phase (bisection included): past it, the rest of the price requests fail fast. */
export const PRICE_PHASE_BUDGET_MS = 30_000;
/** Judging stops this long after the run starts; the writes that follow take seconds. Edge wall clock: 150 s. */
export const RUN_FETCH_DEADLINE_MS = 110_000;

/**
 * A hold writes the cursor and the mark and NOTHING else. The cursor MUST move
 * on: selection is stalest-first, so a held stock left at its old enriched_at
 * would be in every later run and jam the refresh (./plan.ts header).
 */
export type HoldValues = { enriched_at: string; list_drop_held_at: string };
export function holdValues(at: string): HoldValues {
  return { enriched_at: at, list_drop_held_at: at };
}

/** A normal write: the judged values, the mark cleared, the cursor moved on. */
export type StampedRowValues = RowValues & { enriched_at: string };

export type Stopped = 'complete' | 'transient_abort' | 'deadline';

export interface RunDeps {
  /** The batch, in selection order. */
  rows: SymbolRow[];
  /** Fetch one stock's fresh numbers and plan it, or report a transient supplier stop. */
  judge: (row: SymbolRow) => Promise<RowPlan | 'transient'>;
  /**
   * Is any stock held within MARK_QUIET_MS? May throw; a throw counts as true
   * (and is reported as list_recent_mark_read_failed). This counts EVERY mark,
   * the judged stocks' own included, as the Planner's rule reads ("no stock has
   * been held in the past 24 hours"). That is safe while the queue's turn is
   * longer than 24 h (about 4 days on 2026-11-24): a stock's own mark is then
   * always older than 24 h at its second reading.
   */
  recentMarkExists: () => Promise<boolean>;
  /** Write `values` to every symbol in `symbols` in ONE statement. Resolves to an error message or null. */
  writeHolds: (symbols: string[], values: HoldValues) => Promise<string | null>;
  /** Write `values` to one symbol. Resolves to an error message or null. */
  writeRow: (symbol: string, values: StampedRowValues) => Promise<string | null>;
  nowMs: () => number;
  /** Epoch ms after which no new stock is judged. */
  deadlineMs: number;
}

export interface RunOutcome {
  decision: RunDecision;
  /** The "any recent hold?" read failed (counted as a recent hold). */
  recentMarkReadFailed: boolean;
  /** What the supplier answered over the judged stocks (report only). */
  profiles: ReturnType<typeof tallyProfiles>;
  stopped: Stopped;
  holdWriteError: string | null;
  rowWriteErrors: number;
}

/** Run one batch in the order above. Rejects only if a judge rejects (then nothing was written). */
export async function runJudged(deps: RunDeps): Promise<RunOutcome> {
  const plans: RowPlan[] = [];
  let stopped: Stopped = 'complete';

  for (const row of deps.rows) {
    const left = deps.deadlineMs - deps.nowMs();
    if (left <= 0) {
      stopped = 'deadline';
      break;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<'deadline'>((r) => (timer = setTimeout(() => r('deadline'), left)));
    let res: RowPlan | 'transient' | 'deadline';
    // A judge that throws rejects the run before anything is written (the same
    // place a killed worker stops). One abandoned at the deadline must not
    // become an unhandled rejection later, so it gets a no-op catch.
    const judging = deps.judge(row);
    judging.catch(() => {});
    try {
      res = await Promise.race([judging, deadline]);
    } finally {
      clearTimeout(timer);
    }
    if (res === 'deadline') {
      stopped = 'deadline';
      break;
    }
    if (res === 'transient') {
      // The supplier said stop: this stock's cursor is NOT advanced, next run retries it.
      stopped = 'transient_abort';
      break;
    }
    plans.push(res);
  }

  let recentMark: boolean;
  let recentMarkReadFailed = false;
  try {
    recentMark = await deps.recentMarkExists();
  } catch {
    recentMark = true;
    recentMarkReadFailed = true;
  }

  const decision = decideRun(plans, recentMark);
  const at = new Date(deps.nowMs()).toISOString();

  const holdWriteError = decision.hold.length > 0 ? await deps.writeHolds(decision.hold, holdValues(at)) : null;
  let rowWriteErrors = 0;
  for (const r of decision.rows) {
    if ((await deps.writeRow(r.symbol, { ...r.values, enriched_at: at })) !== null) rowWriteErrors++;
  }
  return { decision, recentMarkReadFailed, profiles: tallyProfiles(plans), stopped, holdWriteError, rowWriteErrors };
}

const SYMBOLS_LOGGED = 20;

/**
 * The run outcome's list fields. Any hold is a FAILED run (ok:false) with the
 * held stocks named, never a clean line with a count tucked inside it
 * (CLAUDE.md "success signals" #4/#7):
 *   mass_drop_refused  this run's NEW drops were over the limit (some held stocks may be second readings too);
 *   drops_held_again   no refusal of its own: second readings held again
 *                      (a hold in the last 24 h, or the recent-hold read failed);
 *   hold_write_failed  the holds could not be recorded.
 */
export function outcomeFields(o: RunOutcome): Record<string, unknown> & { ok: boolean } {
  const d = o.decision;
  const held = d.hold.length > 0;
  return {
    ok: !held && o.holdWriteError === null,
    ...(d.refused
      ? { error: 'mass_drop_refused' }
      : held
      ? { error: 'drops_held_again' }
      : o.holdWriteError
      ? { error: 'hold_write_failed' }
      : {}),
    stopped: o.stopped,
    transient_abort: o.stopped === 'transient_abort',
    judged: d.judged,
    list_drop_limit: d.limit,
    list_new_drops: d.newDrops.length,
    list_dropped: d.dropped.length,
    list_held_new: d.heldNew.length,
    list_held_again: d.heldAgain.length,
    list_marks_cleared: d.cleared.length,
    list_recent_mark: d.recentMark,
    list_recent_mark_read_failed: o.recentMarkReadFailed,
    list_held_symbols: d.hold.slice(0, SYMBOLS_LOGGED),
    list_dropped_symbols: d.dropped.slice(0, SYMBOLS_LOGGED),
    ...(o.holdWriteError ? { hold_write_error: o.holdWriteError } : {}),
    row_write_errors: o.rowWriteErrors,
    ...o.profiles,
  };
}
