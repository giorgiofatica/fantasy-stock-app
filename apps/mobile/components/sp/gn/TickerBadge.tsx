/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { DISC_PT, discTickerScale, type TickerBadgeSize } from '@/components/sp/logic/holdingFit';

// Stockpile — <TickerBadge>: THE round ticker badge, the only one in the app (there were six hand-made copies).
// A circle in `inset` with the ticker in `ticker.tile` (13/800), at one of two sizes: 40pt on a row (Holdings, the
// Stocks list, search, Trade history), 52pt in a header (the stock sheet, the player card).
//
// The ticker shrinks to fit the circle with no floor: Giorgio's pick A, PRODUCT_RULES "A long ticker shrinks to fit
// its round badge (A)" (2026-11-19, board #call-ticker-disc), the one exception to the 11pt floor
// (DISC_EXCEPTION_MIN_SCALE in components/sp/logic/holdingFit). Never cut to "GO…" (clip, never an ellipsis), never
// iOS's adjustsFontSizeToFit (it shrinks text on an unlaid frame to nothing), never Dynamic Type (the full ticker
// beside the badge carries the size). Decorative: no accessibility props of its own; the host names the stock.

export interface TickerBadgeProps {
  symbol: string;
  /** 40 on a row (the default), 52 in a header. */
  size?: TickerBadgeSize;
  /** The host's own extra look (search dims an off-list stock's badge). Never a size: that is `size`. */
  style?: StyleProp<ViewStyle>;
}

export function TickerBadge({ symbol, size = 40, style }: TickerBadgeProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.inset }, style]}>
      <Text variant="ticker.tile" allowFontScaling={false} numberOfLines={1} ellipsizeMode="clip" style={{ fontSize: DISC_PT * discTickerScale(symbol, size) }}>{symbol}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[1],
  },
});
