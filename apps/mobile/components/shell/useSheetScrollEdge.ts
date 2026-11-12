import { useCallback, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { sheetEdgeShown } from '@/components/shell/sheetBarLogic';

/** Whether the content has scrolled under the sheet bar. State changes only when that flips (once at the top edge, once back),
 * not on every scroll event. Hand `onScroll` to the ScrollView / FlatList (with `scrollEventThrottle={16}`) and `edge` to SheetBar. */
export function useSheetScrollEdge() {
  const [edge, setEdge] = useState(false);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = sheetEdgeShown(e.nativeEvent.contentOffset.y);
    setEdge((prev) => (prev === next ? prev : next));
  }, []);
  return { edge, onScroll };
}
