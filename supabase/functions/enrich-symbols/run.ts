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
//   3. One read: how many drops were applied in the past 24 h (the daily
//      budget). A failed read counts as the budget spent (hold, never drop).
//   4. Decide every verdict (plan.ts decideRun).
//   5. Write the holds FIRST (new marks, then cursor-only), each as ONE
//      statement, so a refusal is never half-recorded; then the normal writes.

import {
  DAILY_DROP_BUDGET,
  decideRun,
  type RowPlan,
  type RowValues,
  type RunDecision,
  type SymbolRow,
  tallyProfiles,
} from './plan.ts';

/** Per supplier call (Finnhub profile2, one Alpaca snapshots request). */
export const SUPPLIER_CALL_TIMEOUT_MS = 10_000;
/** The whole Alpaca price phase (bisection included): past it, the rest of the price requests fail fast. */
export const PRICE_PHASE_BUDGET_MS = 30_000;
/** Judging stops this long after the run starts; the writes that follow take seconds. Edge wall clock: 150 s. */
export const RUN_FETCH_DEADLINE_MS = 110_000;

/**
 * A NEW hold writes the cursor and the first-held mark and NOTHING else. The
 * cursor MUST move on: selection is stalest-first, so a held stock left at its
 * old enriched_at would be in every later run and jam the refresh.
 */
export type MarkValues = { enriched_at: string; list_drop_held_at: string };
export function markValues(at: string): MarkValues {
  return { enriched_at: at, list_drop_held_at: at };
}
/**
 * A stock already marked (held again, or a second reading deferred) gets the
 * cursor ONLY: the mark keeps the time it was FIRST held. Refreshing it would
 * let held groups round the queue keep each other held for ever.
 */
export type CursorValues = { enriched_at: string };
export function cursorValues(at: string): CursorValues {
  return { enriched_at: at };
}

/** A normal write: the judged values, the mark cleared, the cursor moved on. */
export type StampedRowValues = RowValues & { enriched_at: string };

export type Stopped = 'complete' | 'transient_abort' | 'deadline';

export interface RunDeps {
  /** The batch, in selection order. */
  rows: SymbolRow[];
  /** Fetch one stock's fresh numbers and plan it, or report a transient supplier stop. */
  judge: (row: SymbolRow) => Promise<RowPlan | 'transient'>;
  /** Drops applied in the past DROP_WINDOW_MS. May throw; a throw counts as the budget spent. */
  dropsInWindow: () => Promise<number>;
  /** Write `values` to every symbol in `symbols` in ONE statement. Resolves to an error message or null. */
  writeHolds: (symbols: string[], values: MarkValues | CursorValues) => Promise<string | null>;
  /** Write `values` to one symbol. Resolves to an error message or null. */
  writeRow: (symbol: string, values: StampedRowValues) => Promise<string | null>;
  nowMs: () => number;
  /** Epoch ms after which no new stock is judged. */
  deadlineMs: number;
}

export interface RunOutcome {
  decision: RunDecision;
  /** The drops-in-window read failed (counted as the budget spent). */
  dropsReadFailed: boolean;
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

  const nowMs = deps.nowMs();
  let dropsInWindow: number;
  let dropsReadFailed = false;
  try {
    dropsInWindow = await deps.dropsInWindow();
  } catch {
    dropsInWindow = DAILY_DROP_BUDGET;
    dropsReadFailed = true;
  }

  const decision = decideRun(plans, { nowMs, dropsInWindow });
  const at = new Date(nowMs).toISOString();

  let holdWriteError: string | null = null;
  if (decision.markNew.length > 0) holdWriteError = await deps.writeHolds(decision.markNew, markValues(at));
  if (decision.cursorOnly.length > 0) {
    holdWriteError = (await deps.writeHolds(decision.cursorOnly, cursorValues(at))) ?? holdWriteError;
  }
  let rowWriteErrors = 0;
  for (const r of decision.rows) {
    if ((await deps.writeRow(r.symbol, { ...r.values, enriched_at: at })) !== null) rowWriteErrors++;
  }
  return { decision, dropsReadFailed, profiles: tallyProfiles(plans), stopped, holdWriteError, rowWriteErrors };
}

const SYMBOLS_LOGGED = 20;

/**
 * The run outcome's list fields. A run that held any stock off a drop is a
 * FAILED run (ok:false) with the held stocks named, never a clean line with a
 * count tucked inside it (CLAUDE.md "success signals" #4/#7):
 *   mass_drop_refused    this run's NEW drops were over the per-run limit;
 *   drop_budget_reached  the daily budget held at least one drop (the read
 *                        may have failed: list_drops_read_failed);
 *   hold_write_failed    the holds could not be recorded.
 * A second reading deferred for a young mark is not a hold (the stock was
 * already reported when first held); it is counted in list_deferred_young.
 *
 * WS2's repair log writes ONE row for a run with heldForRefusal or
 * heldForBudget non-empty (batch.ts REPAIR-LOG HOOK).
 */
export function outcomeFields(o: RunOutcome): Record<string, unknown> & { ok: boolean } {
  const d = o.decision;
  const held = [...d.heldForRefusal, ...d.heldForBudget];
  return {
    ok: held.length === 0 && o.holdWriteError === null,
    ...(d.refused
      ? { error: 'mass_drop_refused' }
      : d.heldForBudget.length > 0
      ? { error: 'drop_budget_reached' }
      : o.holdWriteError
      ? { error: 'hold_write_failed' }
      : {}),
    stopped: o.stopped,
    transient_abort: o.stopped === 'transient_abort',
    judged: d.judged,
    list_drop_limit: d.limit,
    list_new_drops: d.newDrops.length,
    list_dropped: d.dropped.length,
    list_drops_past_24h: d.dropsInWindow,
    list_drops_past_24h_after: d.dropsInWindow + d.dropped.length,
    list_drop_budget_left: d.budgetLeft,
    list_held_for_refusal: d.heldForRefusal.length,
    list_held_for_budget: d.heldForBudget.length,
    list_deferred_young: d.deferredYoung.length,
    list_marks_cleared: d.cleared.length,
    list_drops_read_failed: o.dropsReadFailed,
    list_held_symbols: held.slice(0, SYMBOLS_LOGGED),
    list_dropped_symbols: d.dropped.slice(0, SYMBOLS_LOGGED),
    ...(o.holdWriteError ? { hold_write_error: o.holdWriteError } : {}),
    row_write_errors: o.rowWriteErrors,
    ...o.profiles,
  };
}
