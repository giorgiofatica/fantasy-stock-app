/**
 * auth-fields-above-keyboard (2026-11-06, Giorgio's recording of build 1.3.0 (11)): with the keyboard up on Create account the
 * Password field was invisible, so the form read as email-only. AuthScaffold docks its footer OUTSIDE the ScrollView, so with
 * the keyboard up the scroll view's visible window is only what sits between the top of the screen and the footer, and nothing
 * moved the fields into it.
 *
 * The rule: a field that takes focus is scrolled to the TOP of that window (its label just under the edge). Whatever fits
 * below it (the next field, its rule checklist) is then in the window too, and the brand lockup, heading and "Continue with
 * Apple" scroll off the top. The focused INPUT always stays fully in the window, even where the window is too short for the
 * label above it too (the largest accessibility text size): then the label gives way, never the box being typed into.
 *
 * Pure (no React Native imports) so the rules are testable under Deno.
 */

export type RevealEvent = 'focus' | 'blur' | 'layout' | 'keyboard';

/**
 * Whether the person is in a field, and whether this event should (re)scroll to it.
 * - focus: scroll to the field (also covers moving Email -> Password with the keyboard staying up).
 * - layout / keyboard: the keyboard has just resized the scroll view (a focus can land BEFORE that, when the window is still
 *   the full height and the content cannot scroll). Scroll again, but ONLY while a field is focused: with the keyboard down
 *   a layout change (rotation, a banner appearing) must never move a screen.
 * - blur: nothing to scroll to.
 */
export function stepReveal(focused: boolean, event: RevealEvent): { focused: boolean; reveal: boolean } {
  switch (event) {
    case 'focus':
      return { focused: true, reveal: true };
    case 'blur':
      return { focused: false, reveal: false };
    case 'layout':
    case 'keyboard':
      return { focused, reveal: focused };
  }
}

/** The Field label's line height (the `callout` token), its gap to the box, and the box's border: see components/shell/Field.tsx. */
export const LABEL_LINE_HEIGHT = 18;
export const LABEL_GAP = 6; // space[2] + 2
export const BOX_BORDER = 2;
/** A sliver of the content above the label, so the label does not sit hard against the window's edge. */
export const TOP_BREATHING = 4;
/** Clear space kept under the input's box (above the docked footer). */
export const BOTTOM_BREATHING = 6;

/** How far above the INPUT's top the field's label starts, at this font scale (the label is a callout Text, which scales with the system size). */
export function labelReach(fontScale: number): number {
  const scale = fontScale > 0 ? fontScale : 1;
  return Math.ceil(LABEL_LINE_HEIGHT * scale) + LABEL_GAP + BOX_BORDER;
}

export interface RevealInput {
  /** The focused input's top and height, in the scroll CONTENT's coordinates. */
  inputTop: number;
  inputHeight: number;
  /** The scroll view's visible height right now (it shrinks when the keyboard opens). */
  viewportHeight: number;
  fontScale: number;
}

/**
 * The scroll offset for a focused field. Label at the top of the window; but never so little that the input's bottom edge falls
 * below the window, and never negative (a field already near the top does not pull the content past its start).
 */
export function fieldRevealOffset({ inputTop, inputHeight, viewportHeight, fontScale }: RevealInput): number {
  const labelAtTop = inputTop - labelReach(fontScale) - TOP_BREATHING;
  const inputBottomVisible = inputTop + inputHeight + BOTTOM_BREATHING - viewportHeight;
  return Math.max(0, labelAtTop, inputBottomVisible);
}
