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
// (components/sp/logic/fitScale's rule) with the element's OWN floor (the disc has none: pick A, 2026-11-19,
// see DISC_EXCEPTION_MIN_SCALE), and an unmeasured row renders at full size (never shrinks on a guess).
import { fitScale, estimateMoneyWidth } from './fitScale';

/** The disc's ticker: 13pt, never scaled by Dynamic Type, and shrunk to fit its round badge (below). */
export const DISC_PT = 13;
/**
 * THE ONE EXCEPTION to the app's 11pt floor (§9B; DESIGN_DIRECTION "The 11pt floor stands"). Giorgio's pick A,
 * PRODUCT_RULES "A long ticker shrinks to fit its round badge (A)" (2026-11-19, board #call-ticker-disc, PR #565):
 * the badge stays a circle (40pt on a row, 52pt in a header) and ONLY its ticker shrinks, under 11pt when it must (GOOGL ≈ 9.3pt, BRK.B
 * ≈ 10.8pt, AMGN ≈ 11.0pt), so a ticker is never cut to "GO…". Allowed because the full ticker is printed at full
 * size right beside the badge, so the badge's text is never the only place to read it. No floor: any ticker the
 * app can hold fits (0: no floor). Scoped to discTickerScale; every other fitted text keeps its own ≥ 11pt floor.
 */
export const DISC_EXCEPTION_MIN_SCALE = 0;
/** The row badge is 40pt wide with 2pt of padding on each side (components/sp/gn/TickerBadge's styles.badge). */
export const DISC_SIZE = 40;
export const DISC_PADDING = 2;
export const DISC_TEXT_ROOM = DISC_SIZE - 2 * DISC_PADDING;
/**
 * The round ticker badge's two sizes, the only two (TickerBadge): 40pt on a row (Holdings, the Stocks list, search,
 * Trade history), 52pt in a header (the stock sheet, the player card). The same fit, the same exception, in both.
 * In 52pt the room is 48pt: GOOGL ≈ 12.4pt, BRK.B and AMGN keep 13pt, and even "WWWWW" stays ≈ 9.8pt.
 */
export const TICKER_BADGE_SIZES = [40, 52] as const;
export type TickerBadgeSize = (typeof TICKER_BADGE_SIZES)[number];
/** The ticker's room in a badge `size` wide: the circle less its padding. */
export function badgeTextRoom(size: TickerBadgeSize): number {
  return size - 2 * DISC_PADDING;
}

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

/**
 * Archivo ExtraBold's advance widths in em (unitsPerEm 1000), for the characters a ticker holds, read
 * from assets/fonts/archivo/Archivo-ExtraBold.ttf (fontTools, hmtx). `ticker.tile` has no letter-spacing, so a
 * ticker's width is the sum at DISC_PT. A generic capital-letter estimate over-stated narrow letters (L, T, F,
 * S) and shrank AAPL ~1.7pt more than iOS's own fit did (Design Lead P3, 2026-11-18); the real widths do not.
 * Measured at 13pt: NVDA 39.2pt, AMZN 40.7pt and MSFT 38.1pt are WIDER than the 36pt room (they shrink to
 * ~0.92 / 0.88 / 0.94, as iOS's fit already did); AAPL 36.6, TSLA 35.6, NFLX 36.2 and PLTR 35.7 are at or
 * within it (≥ 0.98); GOOGL 50.3, BRK.B 43.3 and AMGN 42.4 shrink to ~0.72 / 0.83 / 0.849 (pick A, no floor).
 */
export const TICKER_EM: Readonly<Record<string, number>> = {
  A: 0.746, B: 0.745, C: 0.752, D: 0.755, E: 0.699, F: 0.641, G: 0.815,
  H: 0.787, I: 0.329, J: 0.63, K: 0.77, L: 0.623, M: 0.914, N: 0.787,
  O: 0.81, P: 0.698, Q: 0.81, R: 0.75, S: 0.697, T: 0.675, U: 0.783,
  V: 0.729, W: 0.979, X: 0.736, Y: 0.732, Z: 0.682, '0': 0.625, '1': 0.625,
  '2': 0.625, '3': 0.625, '4': 0.626, '5': 0.625, '6': 0.625, '7': 0.625, '8': 0.625,
  '9': 0.625, '.': 0.318, '-': 0.333,
};
/** A character not in the table (a ticker never holds one) is a wide capital, so it shrinks sooner, never clips. */
const TICKER_EM_FALLBACK = 0.8;

/** The width of `symbol` at `fontPt`, from the real glyph advances. */
export function tickerWidth(symbol: string, fontPt: number): number {
  let em = 0;
  for (const ch of symbol.toUpperCase()) em += TICKER_EM[ch] ?? TICKER_EM_FALLBACK;
  return em * fontPt;
}

/**
 * The scale of a badge's ticker (its room is constant: no measuring, so no first-pass guess). It fits the room
 * with no floor: the DISC_EXCEPTION_MIN_SCALE exception above. Never enlarged past 13pt.
 */
export function discTickerScale(symbol: string, size: TickerBadgeSize = DISC_SIZE): number {
  return flooredFitScale(badgeTextRoom(size), tickerWidth(symbol, DISC_PT), DISC_EXCEPTION_MIN_SCALE);
}

/** The scale of the value for a row `rowWidth` wide (null: not laid out yet, so full size). */
export function valueScale(rowWidth: number | null, valueText: string, fontScale: number): number {
  const room = rowWidth == null ? null : rowWidth * TRAIL_SHARE;
  return flooredFitScale(room, estimateMoneyWidth(valueText, VALUE_PT * Math.min(fontScale, VALUE_MAX_SCALE)), VALUE_MIN_SCALE);
}

// fitScale is re-exported so a caller needs one import for the family.
export { fitScale };
