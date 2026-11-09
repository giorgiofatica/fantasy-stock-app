/**
 * auth-fields-above-keyboard (2026-11-06, Giorgio's recording of build 1.3.0 (11)): with the keyboard up on Create account the
 * Password field was invisible, so the form read as email-only. AuthScaffold docks its footer OUTSIDE the ScrollView, so with
 * the keyboard up the scroll view's visible window is only what sits between the top of the screen and the footer, and nothing
 * moved the fields into it.
 *
 * Build 13 (Giorgio's recording of 1.3.0 (12): "it shoots the screen up super high ... a huge gap, and then the create account
 * button"): build 12 fixed that by scrolling the focused field's LABEL to the TOP of the window, which overshoots. His ruling: scroll
 * the MINIMUM needed, so the focused field, with its error and rules, just clears the docked footer (the existing breathing room),
 * and never pin it to the top. A field already in the window does not move the page at all.
 *
 * The rule is containment, not placement: take the region that must be on screen, and move the offset only as far as it takes to bring
 * that region inside the window (see `revealOffset`). Create account at the default size: Password focused scrolls a few dozen points,
 * and Email stays on screen above it.
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

/** A sliver of the content above the field's label, so the label does not sit hard against the window's edge. */
export const TOP_BREATHING = 4;
/** Clear space kept under the region (above the docked footer). */
export const BOTTOM_BREATHING = 6;

export interface RevealInput {
  /** The scroll view's offset right now. */
  current: number;
  /** The whole Field (its label at the top, its error and rules at the bottom), in the scroll CONTENT's coordinates. */
  blockTop: number;
  blockBottom: number;
  /** The focused input's box, same coordinates. */
  inputTop: number;
  inputBottom: number;
  /** The scroll view's visible height right now (it shrinks when the keyboard opens). */
  viewportHeight: number;
  /** The scrolled content's full height. */
  contentHeight: number;
}

/** The offsets (top, bottom) a region needs on screen, widest first: what the person should see, then less and less of it, down to the box. */
function regions(i: RevealInput): Array<[number, number]> {
  return [
    [i.blockTop - TOP_BREATHING, i.blockBottom + BOTTOM_BREATHING], // the field with its error and rules
    [i.blockTop - TOP_BREATHING, i.inputBottom + BOTTOM_BREATHING], // its label and box (the rules give way)
    [i.inputTop - TOP_BREATHING, i.inputBottom + BOTTOM_BREATHING], // the box alone (the label gives way)
  ];
}

/**
 * The scroll offset after a field takes focus: the CURRENT one when the region that matters already sits inside the window, else the
 * smallest move that brings it in. The region is the widest of {field + rules, label + box, box} that fits the window; where even the box
 * does not fit, its bottom edge (the line being typed on) is kept in. Never negative, never past the end of the content.
 */
export function revealOffset(i: RevealInput): number {
  const room = i.viewportHeight;
  const max = Math.max(0, i.contentHeight - room);
  const region = regions(i).find(([top, bottom]) => bottom - top <= room);
  let target = i.current;
  if (!region) {
    target = i.inputBottom + BOTTOM_BREATHING - room; // not even the box fits: show the bottom of it
  } else if (region[0] < i.current) {
    target = region[0]; // above the window: scroll up just far enough
  } else if (region[1] > i.current + room) {
    target = region[1] - room; // under the window: scroll down just far enough
  }
  return Math.min(Math.max(0, target), max);
}

/**
 * A screen that fits does not scroll (build 13, Giorgio: "There really should not be a reason why it should be able to scroll.").
 * With the keyboard down Create account's content fits the window, yet build 12 let it scroll, bounce, and REST at different offsets (the
 * brand at y 67 / 113 / 150, the title under the status bar): a reveal had scrolled it while the keyboard was up, and UIKit never
 * re-clamps an offset when the window GROWS back. So:
 *   - scrolling (and the bounce) is on only while the content is taller than the window (`contentFits`);
 *   - whenever the window or the content changes, the offset is clamped into the range it can have now (`settleOffset`): content that
 *     fits rests at 0, and an offset past the end comes back to the end.
 * #345's reveal sets no content inset, so the stale offset was the whole of it.
 */
const FIT_SLACK = 0.5; // layout rounds to the pixel: half a point of overflow is not a reason to scroll

/** Whether the content fits the window (nothing to scroll). Before either has been measured it counts as fitting, so nothing scrolls or bounces on a blank frame. */
export function contentFits(contentHeight: number, viewportHeight: number): boolean {
  if (!(contentHeight > 0) || !(viewportHeight > 0)) return true;
  return contentHeight <= viewportHeight + FIT_SLACK;
}

/** The offset to snap to when the current one is outside what the content can scroll to now, or null when it is fine where it is. */
export function settleOffset(current: number, contentHeight: number, viewportHeight: number): number | null {
  if (!(viewportHeight > 0) || !(contentHeight > 0)) return null; // not measured yet: leave it
  const max = contentFits(contentHeight, viewportHeight) ? 0 : contentHeight - viewportHeight;
  if (current < 0 || current > max) return Math.min(Math.max(current, 0), max);
  return null;
}

/**
 * The docked footer's SECONDARY line (create account's "Already have an account? Sign in") is hidden while the keyboard is up.
 * At the largest accessibility size that one line, wrapped to three lines, took ~200pt of a window the keyboard had already cut
 * to ~130pt, so only one field fitted above the footer: the bug again, at Giorgio's size (Design Lead gate on #345). With the
 * keyboard up the footer is its primary button alone; the line returns when the keyboard closes. The look with the keyboard
 * down does not change.
 */
export type KeyboardPhase = 'show' | 'hide';

/** Whether the keyboard is up after this event (the screen reads it from keyboardWillShow / keyboardWillHide, so the line goes
 * BEFORE the keyboard has finished rising and nothing jumps). */
export function keyboardUpAfter(event: KeyboardPhase): boolean {
  return event === 'show';
}

export function footerSecondaryShown(keyboardUp: boolean): boolean {
  return !keyboardUp;
}
