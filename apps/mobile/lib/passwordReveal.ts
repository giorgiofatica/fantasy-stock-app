// Stockpile — a password field's show / hide toggle (Giorgio, 2026-11-06: "a hide/view eye icon for the
// password so you can see what you are typing"). Pure, for tests-deno. The control is
// components/shell/PasswordReveal.tsx; components/shell/Field.tsx draws it for every secure field.
//
// The rules it holds:
// - Every secure field starts HIDDEN on every mount; nothing remembers the choice across screens.
// - The label and the glyph name the ACTION the tap takes: "Show password" with an open eye while the
//   password is hidden, "Hide password" with the struck-through eye while it is shown.
// - Only the `secureTextEntry` prop changes. The TextInput is the same element in both states and is
//   never keyed on the toggle: remounting a filled password field raises iOS's "Save Password?" sheet
//   (lib/inputRemount.ts), and a remount would also drop the keyboard.
// - A field the caller did not mark secure never takes the toggle.
//
// Known iOS behaviour, NOT fixed here (measured on the iOS 27 simulator, 2026-11-06, L and AX5): once a
// secure field has been shown and is hidden again, UIKit clears its content on the NEXT keystroke (the
// system's secure-entry "clear on insertion"; a blur and refocus does the same). So show -> hide -> type
// replaces the whole password with the typed characters. Typing while it is SHOWN keeps everything, and so
// does hiding without typing afterwards. If the Design Lead wants it handled, the fix is a one-shot in
// Field: after a show -> hide, treat the first onChangeText that is not an edit of the previous value
// (neither a prefix of it nor an extension of it) as an insertion and append it to the previous value.

export const SHOW_PASSWORD = 'Show password';
export const HIDE_PASSWORD = 'Hide password';

/** The toggle's state on every mount: hidden. */
export const INITIAL_REVEALED = false;

/** The toggle's tap target, both sides (pt): the 44 pt floor (DESIGN_DIRECTION §9B). */
export const REVEAL_HIT_PT = 44;

export interface RevealState {
  /** Whether the field draws the toggle at all: only a field its caller marked secure. */
  hasToggle: boolean;
  /** What the TextInput's `secureTextEntry` prop is now. */
  secureTextEntry: boolean;
  /** The toggle's VoiceOver label (and the action a tap takes). */
  label: typeof SHOW_PASSWORD | typeof HIDE_PASSWORD;
  /** The sp Icon name the toggle draws. */
  icon: 'eye' | 'eyeOff';
}

/** The field's state for a caller's `secureTextEntry` and the toggle's `revealed`. */
export function revealState(callerSecure: boolean | undefined, revealed: boolean): RevealState {
  const hasToggle = callerSecure === true;
  const shown = hasToggle && revealed;
  return {
    hasToggle,
    secureTextEntry: hasToggle && !shown,
    label: shown ? HIDE_PASSWORD : SHOW_PASSWORD,
    icon: shown ? 'eyeOff' : 'eye',
  };
}

/** The toggle's right margin (pt, negative): it pulls the 44 pt target into the box's right padding so
 * the GLYPH's right edge, not the target's, sits on the text's inset. Never more than the padding. */
export function revealTrailingMargin(glyphPt: number, boxPaddingPt: number): number {
  if (!Number.isFinite(glyphPt) || glyphPt <= 0 || glyphPt >= REVEAL_HIT_PT) return 0;
  const inset = (REVEAL_HIT_PT - glyphPt) / 2;
  return -Math.min(inset, Math.max(boxPaddingPt, 0));
}
