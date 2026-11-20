/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { radius, space } from '@/constants/tokens';
import { Icon } from '@/components/sp/Icon';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { NOTICE_MAX_SCALE, noticeIconMetrics, priceNoticeDisplay } from '@/lib/game/priceNotice';

// Stockpile — the Matchup price notice (Giorgio, 2026-11-19, PR #562, colour pick A; Design Lead spec the
// same day). The app's teal accent as a soft tint (`accentTint`, no edge: the tint is its own edge, as on
// the live chip) with an `info` icon in `accent`; never yellow, never warnTint. WarnPanel's box (radius.lg,
// space[4] top and bottom, 14 at the sides) so the app's two message boxes match. The sentence is `text`,
// callout, REGULAR weight: not teal (two lines of teal read as a link) and not bold (bold is the refusal
// panel's). It names the stocks whose live price is missing (lib/game/priceNotice.ts holds the approved
// words) and sits under the "My matchup | All matchups" switch, above the totals; it scrolls with the page.

export function PriceNotice({ text, symbols }: { text: string; symbols: readonly string[] }) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const icon = noticeIconMetrics(fontScale);
  return (
    // ONE element for VoiceOver, role text (nothing was refused, so not an alert): the plain sentence. The icon
    // is inside it, so VoiceOver skips it.
    <View style={[styles.box, { backgroundColor: colors.accentTint }]} accessible accessibilityRole="text" accessibilityLabel={text} testID="price-notice">
      <View style={{ marginTop: icon.top }}>
        <Icon name="info" size="callout" tone="accent" pt={icon.pt} />
      </View>
      <Text variant="callout" color={colors.text} maxFontSizeMultiplier={NOTICE_MAX_SCALE} style={styles.text}>
        {priceNoticeDisplay(text, symbols)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    borderRadius: radius.lg,
    paddingVertical: space[4],
    paddingHorizontal: 14,
  },
  text: {
    flex: 1,
    minWidth: 0,
    fontWeight: '400',
  },
});
