/**
 * The Stepper's "i" (UX rule 13) is a 44 pt target, but the label it sits beside is one line of the
 * callout variant (18 pt at Large, growing with the text size). If the "i" counted at its full 44 pt in
 * the label row, the row was as tall as the "i", not the label, and the Playoff teams stepper's label-to-box
 * gap differed from Managers' and Regular season's (the DL's P2-1, 2026-11-11). So the "i" slot's vertical
 * margin is NEGATIVE by half of what the target exceeds the smallest label line: the row is then never taller
 * than the label, at any size, while the 44 pt target is untouched (a margin changes the slot's footprint in
 * the row, not its own box) and reaches past the label on both sides. Pure, so the rule is tested under Deno
 * (tests-deno/season-step.test.ts).
 */
import { type as typeTokens } from '../../constants/tokens/type';

/** The "i"'s touch target (InfoButton's `infoHit`). */
export const INFO_TARGET = 44;

/** The smallest the label's line ever is: the callout variant's line height at Large (it only grows). */
export const LABEL_MIN_LINE = typeTokens.callout.lineHeight;

/** The slot's top and bottom margin: -13 for a 44 pt target beside an 18 pt line. */
export function infoSlotMargin(target: number = INFO_TARGET, line: number = LABEL_MIN_LINE): number {
  return -Math.ceil(Math.max(0, target - line) / 2);
}

/** How much height the slot adds to the label row: its box plus its two margins. Never above the label's line. */
export function infoSlotFootprint(target: number = INFO_TARGET, line: number = LABEL_MIN_LINE): number {
  return target + 2 * infoSlotMargin(target, line);
}
