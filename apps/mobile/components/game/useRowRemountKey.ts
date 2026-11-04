import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { fontScaleKey, inputRemountKey } from '@/components/sp/logic/remeasureKey';

/** The React key for a CONTAINER of text fields (a row of side-by-side Fields), so the row starts its layout over after
 * a Dynamic Type change. The #318 pattern (SetupRows' `remountKey`) for a row that holds inputs: after L -> AX5 -> L the
 * Create league slot row kept its AX5 widths and pushed "Max" off the card, because Fabric re-measures a view only when
 * it gets new props and the wrapper Views' flex layout from the old size survived. Put `key` on the row's container and
 * `onFocus` / `onBlur` on every Field inside it. Frozen while any field in the row is focused (a remount would drop the
 * keyboard, as in useInputRemountKey), with one remount on blur. The values live above the key (the screen's state), so
 * typing survives the remount. */
export function useRowRemountKey() {
  const { fontScale } = useWindowDimensions();
  const currentKey = fontScaleKey(fontScale);
  const [keyAtFocus, setKeyAtFocus] = useState<string | null>(null);
  const key = inputRemountKey(keyAtFocus !== null, keyAtFocus ?? currentKey, currentKey);
  return {
    key,
    onFocus: () => setKeyAtFocus(key),
    onBlur: () => setKeyAtFocus(null),
  };
}
