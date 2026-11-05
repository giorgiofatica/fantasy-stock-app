import { useReducer } from 'react';
import { useWindowDimensions } from 'react-native';

import {
  FOCUS_REMOUNT_INITIAL, focusRemountKey, focusRemountReducer, needsScaleNote,
} from './logic/focusRoundTrip';
import { fontScaleKey } from './logic/remeasureKey';

/** The focus-frozen, scale-driven React key shared by useInputRemountKey (one TextInput host) and useRowRemountKey (a row's
 * container): the current scale's key while nothing here is focused, the key the focus took while something is (a remount
 * would drop the keyboard), and ONE remount at blur if the scale moved at any point during focus, even if it came back
 * (focusRoundTrip.ts). `onFocus` / `onBlur` go on every field the key covers. */
export function useFocusRemountKey() {
  const { fontScale } = useWindowDimensions();
  const scaleKey = fontScaleKey(fontScale);
  const [state, dispatch] = useReducer(focusRemountReducer, FOCUS_REMOUNT_INITIAL);
  // Note the scale move while a field is focused, even if it comes back before the blur. A dispatch during render is
  // React's own derive-state-from-props pattern: the render restarts before anything is committed, and the guard ends it.
  if (needsScaleNote(state, scaleKey)) dispatch({ type: 'scale', scaleKey });
  const key = focusRemountKey(state, scaleKey);
  return {
    key,
    scaleKey,
    fontScale,
    focused: state.session !== null,
    onFocus: () => dispatch({ type: 'focus', keyAtFocus: key, scaleAtFocus: scaleKey }),
    onBlur: () => dispatch({ type: 'blur' }),
  };
}
