import { useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { remountOnScaleChange, type RemountProps } from '@/lib/inputRemount';
import { fontScaleKey, inputHostKey, inputRemountKey, remountAutoFocus, scaledInputFont } from './logic/remeasureKey';

/** Keys a TextInput host by the font scale while it is unfocused, so an unfocused field re-measures
 * after a Dynamic Type change and a focused one keeps its keyboard (remeasureKey.ts). A credential
 * host (password or account identifier, lib/inputRemount.ts) is never keyed by the scale. Put `key` and `autoFocus` on the
 * TextInput and call `onFocus` / `onBlur` from its handlers; `focused` is the field's focus state.
 * `fontProps(baseFontSize)` is the field's explicit size (style `fontSize` + `allowFontScaling`), or null for a
 * credential host: spread it onto the TextInput, or a remounted field can reuse a recycled native view that keeps
 * its old placeholder size (remeasureKey.ts, "The PLACEHOLDER"). */
export function useInputRemountKey(autoFocus: boolean | undefined, props: RemountProps = {}) {
  const { fontScale } = useWindowDimensions();
  const currentKey = fontScaleKey(fontScale);
  const keyAtMount = useRef(currentKey);
  // Latched: a host that has ever been a credential host stays one, whatever its props do later
  // (a show-password toggle turns secureTextEntry off while the field still holds the password).
  const credentialHost = useRef(false);
  if (!remountOnScaleChange(props)) credentialHost.current = true;
  const [keyAtFocus, setKeyAtFocus] = useState<string | null>(null);
  const focused = keyAtFocus !== null;
  const key = inputHostKey(
    !credentialHost.current,
    keyAtMount.current,
    inputRemountKey(focused, keyAtFocus ?? currentKey, currentKey)
  );
  // Once the key has moved off the first mount's, the host has been remounted: never autoFocus again.
  const remounted = useRef(false);
  if (key !== keyAtMount.current) remounted.current = true;
  return {
    key,
    focused,
    autoFocus: remountAutoFocus(autoFocus, remounted.current),
    onFocus: () => setKeyAtFocus(key),
    onBlur: () => setKeyAtFocus(null),
    fontProps: (baseFontSize: number) => scaledInputFont(baseFontSize, fontScale, !credentialHost.current),
  };
}
