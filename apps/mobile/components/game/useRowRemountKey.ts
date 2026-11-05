import { useFocusRemountKey } from '@/components/sp/useFocusRemountKey';

/** The React key for a CONTAINER of text fields (a row of side-by-side Fields), so the row starts its layout over after
 * a Dynamic Type change. The #318 pattern (SetupRows' `remountKey`) for a row that holds inputs: after L -> AX5 -> L the
 * Create league slot row kept its AX5 widths and pushed "Max" off the card, because Fabric re-measures a view only when
 * it gets new props and the wrapper Views' flex layout from the old size survived. Put `key` on the row's container and
 * `onFocus` / `onBlur` on every Field inside it. Frozen while any field in the row is focused (a remount would drop the
 * keyboard, as in useInputRemountKey), with one remount on blur, including after a size that went away and came back
 * during focus (focusRoundTrip.ts). A tap from one field of the row to the next keeps the keyboard: the blur and the
 * focus reach React in one batch, and the remount waits for the last blur. The values live above the key (the screen's
 * state), so typing survives the remount. */
export function useRowRemountKey() {
  const { key, onFocus, onBlur } = useFocusRemountKey();
  return { key, onFocus, onBlur };
}
