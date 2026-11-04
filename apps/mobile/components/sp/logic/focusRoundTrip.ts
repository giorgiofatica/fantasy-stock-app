// Stockpile — the focus-frozen scale key, with the round trip counted. Pure, for tests-deno.
//
// remeasureKey.ts freezes a field's key while it is focused (a remount would drop the keyboard) and gives it the current
// scale's key at blur. That compared two ENDPOINTS: the scale at focus and the scale at blur. A size that went
// L -> AX5 -> L while the keyboard was up ended where it began, so nothing remounted at blur and the field or row kept
// the box Fabric had measured at AX5 (2026-11-04, Design Lead: "remount once on blur if the text size changed at any
// point during focus, even if it came back"). The same shape as the all-or-nothing guards in CLAUDE.md: a comparison of
// the ends cannot see what happened in between, so the state has to REMEMBER that the scale moved.
//
// A session is one stretch of focus. It notes the first render at a scale other than the one the focus began at; at blur a
// noted session adds one to `bumps`, and the key carries the count as a suffix (`fs-1:1`), so the blur remounts even
// though the scale is back where it was. A session that never saw another scale adds nothing: an ordinary blur at a fixed
// size still remounts nothing.
//
// A blur followed by a focus in the same batch (a tap from one field of a row to the next: React batches the two, so the
// key never changes between them) keeps the key frozen at the one the focus took, and the bump already counted at the blur
// takes effect at the LAST blur, when the row is left. So moving between the row's fields never drops the keyboard.

import { inputRemountKey } from './remeasureKey';

export type FocusSession = { keyAtFocus: string; scaleAtFocus: string; changed: boolean };
export type FocusRemountState = { bumps: number; session: FocusSession | null };

export const FOCUS_REMOUNT_INITIAL: FocusRemountState = { bumps: 0, session: null };

/** The scale's key with the round trips counted so far: the bare scale key until one has been counted. */
export function bumpedKey(scaleKey: string, bumps: number): string {
  return bumps > 0 ? `${scaleKey}:${bumps}` : scaleKey;
}

/** A field took focus: the key it took focus with is frozen, and the scale it began at is remembered. */
export function focusStart(state: FocusRemountState, keyAtFocus: string, scaleAtFocus: string): FocusRemountState {
  return { bumps: state.bumps, session: { keyAtFocus, scaleAtFocus, changed: false } };
}

/** Does a render at `scaleKey` have to be noted? Only a focused session that has not yet seen another scale. */
export function needsScaleNote(state: FocusRemountState, scaleKey: string): boolean {
  return state.session !== null && !state.session.changed && state.session.scaleAtFocus !== scaleKey;
}

/** A render at `scaleKey` during focus: remember that the scale moved, even if it later comes back. */
export function scaleNoted(state: FocusRemountState, scaleKey: string): FocusRemountState {
  return needsScaleNote(state, scaleKey) && state.session ? { bumps: state.bumps, session: { ...state.session, changed: true } } : state;
}

/** The field blurred: a session that saw the scale move counts one round trip, so the key changes even at the same scale. */
export function focusEnd(state: FocusRemountState): FocusRemountState {
  return { bumps: state.bumps + (state.session?.changed ? 1 : 0), session: null };
}

/** The key to render: the one the focus took while focused, the current scale's (with its round trips) otherwise. */
export function focusRemountKey(state: FocusRemountState, scaleKey: string): string {
  const current = bumpedKey(scaleKey, state.bumps);
  return inputRemountKey(state.session !== null, state.session?.keyAtFocus ?? current, current);
}

export type FocusRemountAction =
  | { type: 'focus'; keyAtFocus: string; scaleAtFocus: string }
  | { type: 'scale'; scaleKey: string }
  | { type: 'blur' };

export function focusRemountReducer(state: FocusRemountState, action: FocusRemountAction): FocusRemountState {
  switch (action.type) {
    case 'focus':
      return focusStart(state, action.keyAtFocus, action.scaleAtFocus);
    case 'scale':
      return scaleNoted(state, action.scaleKey);
    case 'blur':
      return focusEnd(state);
  }
}
