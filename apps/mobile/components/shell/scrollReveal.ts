import { createContext, useContext } from 'react';
import type { View } from 'react-native';

import { revealOffset } from '@/components/sp/logic/searchField';
import { REVEAL_MARGIN, revealMargin } from '@/components/shell/topBarFade';

// queue-search-keyboard (2026-11-06): a field low on a tab (the draft queue's search) must scroll up above the keyboard
// WITH its results list, not just sit above it. BarsRefresh provides this beside ScrollFold (optional: a screen without it
// simply does not scroll the field up). `reveal(node)` scrolls the scroll view so `node` sits just under its top edge.

/** `below`: how many points under the status-bar fade the node's top lands (default REVEAL_MARGIN). */
export type ScrollReveal = (node: View | null, below?: number) => void;

export const ScrollRevealContext = createContext<ScrollReveal | null>(null);

export function useScrollReveal(): ScrollReveal | null {
  return useContext(ScrollRevealContext);
}

/** The slice of a ScrollView the reveal needs (the Animated one has it too). */
interface RevealScroll {
  scrollTo(opts: { y: number; animated: boolean }): void;
  getInnerViewRef?: () => unknown;
}

/** The provider's side: the node's top in the scroll CONTENT (measured against the inner content view), then a scroll to it. The
 * top bar scrolls away inside the content, so the node lands `below` points under the status-bar fade (topBarFade.revealMargin of
 * `getTopInset()`), never under a bar that has gone. */
export function makeScrollReveal(getScroll: () => RevealScroll | null | undefined, getTopInset: () => number = () => 0): ScrollReveal {
  return (node, below = REVEAL_MARGIN) => {
    const scroll = getScroll();
    const inner = scroll?.getInnerViewRef?.();
    if (!node || !scroll || !inner) return;
    node.measureLayout(
      inner as never,
      (_x, y) => scroll.scrollTo({ y: revealOffset(y, revealMargin(getTopInset(), below)), animated: true }),
      () => {},
    );
  };
}
