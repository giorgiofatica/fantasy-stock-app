import { createContext, useContext, useEffect, type ReactNode } from 'react';

// The draft room's pinned clock (draftClockChip.ts) lives at the top of the PAGE, not in the scroll content: it must not scroll. The
// element that draws it is BarsRefresh's `pinned` slot, but the room that knows what to pin is a CHILD of BarsRefresh, so the slot is
// filled through context: BarsRefresh provides `setPinned`, a child calls `usePinned(node)`. The node is cleared when the child
// unmounts (leaving the room), so nothing outlives the screen that asked for it.

export type SetPinned = (node: ReactNode | null) => void;

export const PinnedSlotContext = createContext<SetPinned | null>(null);

/** Fill the enclosing BarsRefresh's `pinned` slot with `node` (null: nothing). Without a BarsRefresh it does nothing. */
export function usePinned(node: ReactNode | null): void {
  const set = useContext(PinnedSlotContext);
  useEffect(() => {
    set?.(node);
  }, [set, node]);
  useEffect(() => () => set?.(null), [set]);
}
