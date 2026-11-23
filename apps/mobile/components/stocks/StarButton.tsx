/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
/**
 * StarButton: the watchlist's star at a stock row's right edge (board #call-stocks-tab-lists: tap to watch it in this league;
 * filled means watching; the "+" stays at the left edge, so the two are never side by side). A 44pt target around a drawn star
 * (outline = not saved, filled in the accent = saved). The state it shows is the store's: the tap flips it at once and a save
 * that does not go through puts it back (watchlist.ts), so this draws what it is given and nothing of its own.
 */
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/sp/Icon';
import { starLabel } from '@/lib/stocks/watchlist';

export function StarButton({ symbol, saved, onPress }: { symbol: string; saved: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={starLabel(symbol, saved)}
      accessibilityState={{ selected: saved }}
      onPress={onPress}
      hitSlop={4}
      style={styles.target}
      testID={`stocks-star-${symbol}`}
    >
      <Icon name={saved ? 'starFilled' : 'star'} size="headline" tone={saved ? 'accent' : 'text2'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
