import { createContext, useContext } from 'react';
import type { View } from 'react-native';

import { revealOffset } from '@/components/sp/logic/searchField';

// queue-search-keyboard (2026-11-06): a field low on a tab (the draft queue's search) must scroll up above the keyboard
// WITH its results list, not just sit above it. BarsRefresh provides this beside ScrollFold (optional: a screen without it
// simply does not scroll the field up). `reveal(node)` scrolls the scroll view so `node` sits just under its top edge.

export type ScrollReveal = (node: View | null, margin?: number) => void;

export const ScrollRevealContext = createContext<ScrollReveal | null>(null);

export function useScrollReveal(): ScrollReveal | null {
  return useContext(ScrollRevealContext);
}

/** The slice of a ScrollView the reveal needs (the Animated one has it too). */
interface RevealScroll {
  scrollTo(opts: { y: number; animated: boolean }): void;
  getInnerViewRef?: () => unknown;
}

/** The provider's side: the field's top in the scroll CONTENT (measured against the inner content view), then a scroll to it. */
export function makeScrollReveal(getScroll: () => RevealScroll | null | undefined): ScrollReveal {
  return (node, margin = 16) => {
    const scroll = getScroll();
    const inner = scroll?.getInnerViewRef?.();
    if (!node || !scroll || !inner) return;
    node.measureLayout(
      inner as never,
      (_x, y) => scroll.scrollTo({ y: revealOffset(y, margin), animated: true }),
      () => {},
    );
  };
}
