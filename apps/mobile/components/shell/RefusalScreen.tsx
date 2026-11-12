/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';
import { Button } from '@/components/sp/Button';
import { DELETED_GLYPH_RATIO } from '@/components/sp/Avatar';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { ICON_GLYPHS, type IconName } from '@/components/sp/logic/icon';
import { AuthScaffold } from '@/components/shell/AuthScaffold';
import { Link } from '@/components/shell/Link';
import { ScreenTitle } from '@/components/shell/ScreenTitle';
import { WARN_TEXT_MAX_SCALE } from '@/components/sp/WarnPanel';

// A dead end that is built like the takeover QUESTION screen (PRODUCT_RULES, "The 'already taken' screen is built like the
// takeover question", 2026-11-12), so every refusal of the family can share one frame: a 64pt neutral disc with a drawn icon,
// the sentence as the screen's heading, an optional one-line follow-up, and the way out docked in the AuthScaffold footer as a
// full-width pill, with an optional muted "Not now" under it. No warning panel and no centred text link.

/** The disc: the takeover question's neutral Avatar (64pt, `inset` fill, the glyph at the board's 0.58, never scaled with text). */
export const REFUSAL_DISC = 64;

/** The heading's own ceiling: the takeover question's (1.15 of `display`), so the two screens break the same way at XXXL. */
export const REFUSAL_TITLE_MAX_SCALE = 1.15;

export interface RefusalScreenProps {
  /** The drawn icon on the disc (a semantic name, never a glyph). */
  icon: IconName;
  /** The sentence the screen says, as the heading. */
  heading: string;
  /** An optional one-line follow-up under the heading. */
  line?: string;
  /** The docked full-width pill. */
  primary: { label: string; onPress: () => void };
  /** An optional muted "Not now" under the pill. */
  secondary?: { label: string; onPress: () => void };
}

export function RefusalScreen({ icon, heading, line, primary, secondary }: RefusalScreenProps) {
  const { colors } = useTheme();
  return (
    <AuthScaffold
      centerBody
      footer={
        <View style={styles.actions}>
          <Button label={primary.label} onPress={primary.onPress} fullWidth />
          {secondary ? <Link label={secondary.label} onPress={secondary.onPress} muted /> : null}
        </View>
      }
    >
      <View style={styles.block}>
        <View testID="refusal-disc" style={[styles.disc, { backgroundColor: colors.inset }]}>
          <Ionicons name={ICON_GLYPHS[icon] as React.ComponentProps<typeof Ionicons>['name']} size={Math.round(REFUSAL_DISC * DELETED_GLYPH_RATIO)} color={colors.text2} />
        </View>
        <ScreenTitle style={styles.title} maxFontSizeMultiplier={REFUSAL_TITLE_MAX_SCALE}>{heading}</ScreenTitle>
        {line ? (
          <Text variant="body" tone="secondary" maxFontSizeMultiplier={WARN_TEXT_MAX_SCALE} style={styles.title}>{line}</Text>
        ) : null}
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  block: {
    alignItems: 'center',
    gap: space[4],
  },
  disc: {
    width: REFUSAL_DISC,
    height: REFUSAL_DISC,
    borderRadius: REFUSAL_DISC / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
  },
  actions: {
    gap: space[3],
  },
});
