/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/tokens';
import { Icon } from '@/components/sp/Icon';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';

// Stockpile — the Matchup price notice (Giorgio, 2026-11-19, PR #562, colour pick A): the app's teal
// accent as a soft tint (`accentTint`) with an info icon in `accent`; never yellow, never warnTint. It
// names the stocks whose live price is missing (lib/game/priceNotice.ts holds the approved words) and
// sits under the "My matchup | All matchups" switch, above the totals. The Design Lead sets its final
// tokens and Dark; these are the provisional ones it was asked to confirm.

/** The notice's text follows Dynamic Type to the app's row ceiling, then wraps. */
const NOTICE_MAX_SCALE = 1.6;

export function PriceNotice({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: colors.accentTint }]} accessible accessibilityLabel={text} testID="price-notice">
      <Icon name="info" size="callout" tone="accent" />
      <Text variant="callout" maxFontSizeMultiplier={NOTICE_MAX_SCALE} style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    borderRadius: radius.md,
    paddingVertical: space[4],
    paddingHorizontal: space[5],
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
});
