/**
 * The queue card's search, as the list's last row (board #call-queue-card, B; Giorgio 2026-11-16, "B"): "+ Search by ticker or name"
 * in the accent colour with no box. A tap turns the row into the search field in place; it turns back on a blur with nothing
 * typed, or after a pick. At 50 of 50 there is no row and no field. Pure, so tests-deno pins every rule;
 * components/game/QueueSearchRow.tsx draws the row and QueueEditor binds the state.
 */
import { QUEUE_MAX } from './draftQueue';

/** The row's text follows Dynamic Type to 1.6x, as the boxed field's own text does (SEARCH_TEXT_MAX_SCALE on Buy a stock). */
export const QUEUE_SEARCH_ROW_MAX_SCALE = 1.6;

export type QueueSearchMode = 'hidden' | 'row' | 'field';

/** What the card draws after the list: nothing when the queue is full, the boxed field while it is open or holds text, else the row. */
export function queueSearchMode(a: { queueLength: number; open: boolean; text: string }): QueueSearchMode {
  if (a.queueLength >= QUEUE_MAX) return 'hidden';
  return a.open || a.text.length > 0 ? 'field' : 'row';
}

/** A blur puts the row back only when nothing is typed: a dismissed keyboard over typed text keeps the field (and its results). */
export function blurReturnsToRow(text: string): boolean {
  return text.length === 0;
}
