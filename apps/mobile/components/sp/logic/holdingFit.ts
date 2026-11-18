// Stockpile — the Holding row's two fitted texts, sized by measured widths instead of iOS's
// `adjustsFontSizeToFit`. Pure, for tests-deno.
//
// The bug (Design Lead gate, 2026-11-18, the finished manager portfolio at AX5, 4 of 4): the FIRST row's
// ticker disc ("XOM") and its value ("$4,109.14") drew at roughly 40% size, far under their own
// minimumFontScale (0.85 and 0.75), while every other row was right. It is the failure
// RosterRow.tsx already documents: `adjustsFontSizeToFit` on a frame iOS has not laid out yet shrinks the
// text to nothing. A finished season's rows have no "today" line, which changes the first layout pass; a
// live row has one and passed, so the live screens only hid it.
//
// The fix is RosterRow's: never ask iOS to fit. The disc is a fixed 40pt circle, so its text room is a
// constant; the value's room is the trail's share of the measured ROW width. Each is a uniform scale
// (components/sp/logic/fitScale's rule) with the element's OWN floor, and an unmeasured row renders at full
// size (never shrinks on a guess).
import { fitScale, estimateMoneyWidth } from './fitScale';
import { estimateNameWidth } from './gameNight';

/** The disc's ticker: 13pt, never scaled by Dynamic Type, floored at 11pt (13 × 0.85, §9B). */
export const DISC_PT = 13;
export const DISC_MIN_SCALE = 0.85;
/** The disc is 40pt wide with 2pt of padding on each side (HoldingRow's styles.disc). */
export const DISC_SIZE = 40;
export const DISC_PADDING = 2;
export const DISC_TEXT_ROOM = DISC_SIZE - 2 * DISC_PADDING;

/** The value: score.sm 15pt, capped at 1.3× by the row, floored at 0.75. */
export const VALUE_PT = 15;
export const VALUE_MAX_SCALE = 1.3;
export const VALUE_MIN_SCALE = 0.75;
/** The trail (the value's column) is at most this share of the row (HoldingRow's styles.trail.maxWidth). */
export const TRAIL_SHARE = 0.45;

/** `fitScale`'s rule with the element's own floor: [floor, 1], and 1 until both widths are known. */
export function flooredFitScale(room: number | null, natural: number | null, floor: number): number {
  if (room == null || natural == null || natural <= 0) return 1;
  return Math.min(1, Math.max(floor, room / natural));
}

/** The scale of the disc's ticker (its room is constant: no measuring, so no first-pass guess). */
export function discTickerScale(symbol: string): number {
  return flooredFitScale(DISC_TEXT_ROOM, estimateNameWidth(symbol, DISC_PT), DISC_MIN_SCALE);
}

/** The scale of the value for a row `rowWidth` wide (null: not laid out yet, so full size). */
export function valueScale(rowWidth: number | null, valueText: string, fontScale: number): number {
  const room = rowWidth == null ? null : rowWidth * TRAIL_SHARE;
  return flooredFitScale(room, estimateMoneyWidth(valueText, VALUE_PT * Math.min(fontScale, VALUE_MAX_SCALE)), VALUE_MIN_SCALE);
}

// fitScale is re-exported so a caller needs one import for the family.
export { fitScale };
