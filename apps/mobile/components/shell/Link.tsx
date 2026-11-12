/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { Pressable, StyleSheet } from 'react-native';

import { type } from '@/constants/tokens';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { WARN_TEXT_MAX_SCALE } from '@/components/sp/WarnPanel';

// The takeover landing's text link ("Open the league", "Try again", the muted "Not now"), moved out of TakeoverLanding so
// RefusalScreen's "Not now" is the very same control: 44pt tall, bold headline face, capped so it stays a link at XXXL.

export function Link({ label, onPress, muted = false, disabled = false }: { label: string; onPress: () => void; muted?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="link" style={styles.link}>
      <Text variant="body" maxFontSizeMultiplier={WARN_TEXT_MAX_SCALE} color={muted ? colors.text2 : colors.accent} style={styles.bold}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  bold: {
    fontFamily: type.headline.fontFamily,
  },
});
