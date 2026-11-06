/**
 * pickLogRow (Design Lead P1, 2026-11-06, build 12): the draft room's "Latest picks" rows at the large text sizes.
 * At AX5 the one-line row ("12  AAPL  · Auto-picked · from their queue") squeezed its label into a sliver beside the
 * pick number and the ticker: a lone "·", then "Auto" / "-" / "pick" one word per line, the number and ticker pushed
 * off the screen. The ruling:
 *  - From the large-text step up the row is TWO lines: the pick number and the ticker, then the label under the
 *    ticker. Below it, one line, exactly as before.
 *  - Every part of the row stops growing at PICK_LOG_MAX_SCALE, like the other rows.
 *  - On its own line the label drops its leading "·" (nothing to separate it from); on one line it keeps it, glued to
 *    the first word so it can never sit alone.
 *  - No word breaks in the middle, "Auto-picked" at its hyphen included (keepHyphens), and an inner "·" may end a
 *    line, never start one (keepDots).
 * Display only: the labels themselves (pickLogLine) and every accessibilityLabel keep their plain text. Pure, so
 * tests-deno pins it.
 */
import { LARGE_TEXT_SCALE, isLargeText } from '../../components/sp/logic/largeText';
import { NBSP, keepDots, keepHyphens } from './keepDots';

/** The row's text stops growing here, as the queue, Holdings and Schedule rows do. */
export const PICK_LOG_MAX_SCALE = 1.3;

/** The step at which the row splits into two lines: the app-wide large-text step (the cap is the same number, so the
 * one-line row is drawn at every size below it, untouched). */
export const PICK_LOG_SPLIT_SCALE = LARGE_TEXT_SCALE;

export type PickLogLayout = 'one-line' | 'two-line';

/** One line below the split step; two lines from it up. A scale that isn't a finite number stays one line. */
export function pickLogLayout(fontScale: number): PickLogLayout {
  return isLargeText(fontScale) ? 'two-line' : 'one-line';
}

/** The label as drawn. One line: "· label", the dot glued to the first word (a no-break space), then keepDots and
 * keepHyphens. Two lines: the label alone (its inner "·" still stays with the segment before it). */
export function pickLogLabelText(label: string, layout: PickLogLayout): string {
  const text = layout === 'two-line' ? label : `·${NBSP}${label}`;
  return keepHyphens(keepDots(text));
}
