import { useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { fontScaleKey, inputRemountKey, remountAutoFocus } from './logic/remeasureKey';

/** Keys a TextInput host by the font scale while it is unfocused, so an unfocused field re-measures
 * after a Dynamic Type change and a focused one keeps its keyboard (remeasureKey.ts). Put `key` and
 * `autoFocus` on the TextInput and call `onFocus` / `onBlur` from its handlers; `focused` is the
 * field's focus state. */
export function useInputRemountKey(autoFocus: boolean | undefined) {
  const { fontScale } = useWindowDimensions();
  const currentKey = fontScaleKey(fontScale);
  const [keyAtFocus, setKeyAtFocus] = useState<string | null>(null);
  const focused = keyAtFocus !== null;
  const key = inputRemountKey(focused, keyAtFocus ?? currentKey, currentKey);
  // Once the key has moved off the first mount's, the host has been remounted: never autoFocus again.
  const firstKey = useRef(key);
  const remounted = useRef(false);
  if (key !== firstKey.current) remounted.current = true;
  return {
    key,
    focused,
    autoFocus: remountAutoFocus(autoFocus, remounted.current),
    onFocus: () => setKeyAtFocus(key),
    onBlur: () => setKeyAtFocus(null),
  };
}
