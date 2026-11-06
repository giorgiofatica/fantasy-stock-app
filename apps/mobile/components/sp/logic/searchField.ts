/**
 * The shared stock search field's two pure rules (queue-search-keyboard, 2026-11-06; Giorgio's build 10 recording).
 *
 * 1. After a pick the box is EMPTY, every time. The field is a controlled TextInput whose JS value goes to '' on a pick,
 *    but the native box is a separate buffer: a change event it sends AFTER the pick (the blur that Keyboard.dismiss()
 *    causes, a recycled view re-announcing its old text) would write the typed text back ("GRN" stayed after GRNB was
 *    picked, and its results list reopened). A pick closes the field for input until the next focus: a person cannot
 *    type into a field that is not focused, so any change event between a pick and the next focus is not theirs.
 * 2. The field and its whole results list stay above the keyboard: the scroll view moves so the field sits just under the
 *    top edge (revealOffset), when the field takes focus and when its results open.
 */

/** 'typing': focused, input accepted. 'picked': a result was just chosen; input is shut until the next focus.
 * 'idle': neither (before the first focus, or after a blur with no pick). */
export type FieldPhase = 'idle' | 'typing' | 'picked';

export type FieldEvent = 'focus' | 'blur' | 'pick';

export function nextPhase(phase: FieldPhase, event: FieldEvent): FieldPhase {
  switch (event) {
    case 'focus':
      return 'typing';
    case 'pick':
      return 'picked';
    case 'blur':
      // A blur keeps a pick shut (the late event this guards against arrives after the blur); it only ends plain typing.
      return phase === 'picked' ? 'picked' : 'idle';
  }
}

/** Whether a change event from the native box is the person's typing. */
export function acceptsChange(phase: FieldPhase): boolean {
  return phase !== 'picked';
}

/** The scroll offset that puts a field `margin` below the top of the scroll view, given the field's top in the scroll
 * content. Never negative: a field already near the top does not pull the content down past its start. */
export function revealOffset(fieldTopInContent: number, margin: number): number {
  return Math.max(0, fieldTopInContent - margin);
}

/** Whether the results list has just opened (so the field should be brought up above the keyboard again: the page grew). */
export function listJustOpened(wasOpen: boolean, isOpen: boolean): boolean {
  return !wasOpen && isOpen;
}
