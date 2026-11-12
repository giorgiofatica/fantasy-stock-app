/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
// Create league › Season, B (PRODUCT_RULES, "The Season step in Create league"; board
// #call-season-step): one tile per regular-season week, then the playoff weeks, wider and named
// with the season chart's chips (WC / SF / F; QF / R16), "Wk 1" under the first tile and the
// season's last week under the last. The tiles come from lib/game/seasonStep.ts (seasonStrip).
//
// Large text: the strip stays ONE row at every size (no wrap, no scroll). Only the chips and the two
// "Wk" labels carry text, capped at the tag/label scale (1.4, the board's cap), so they never clip;
// the week tiles carry none and give up their width instead. A wrapped strip would break the season's
// left-to-right shape (the reason Giorgio picked it), and a scrolled one would hide its last week.
// For VoiceOver it is one image with the board's label ("Season: 11 weeks + 3 playoff weeks").
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { radius, space } from '@/constants/tokens';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { keepWeek } from '@/lib/game/keepDots';
import { seasonStrip, stripGap } from '@/lib/game/seasonStep';

/** The strip's text cap and the tile height's (board: fs(…, x, 1.4) and 30 × min(x, 1.4)). */
export const STRIP_MAX_SCALE = 1.4;
const TILE_HEIGHT = 30;

export function SeasonStrip({ regularWeeks, playoffTeams }: { regularWeeks: number; playoffTeams: number }) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const strip = seasonStrip(regularWeeks, playoffTeams);
  const height = Math.round(TILE_HEIGHT * Math.min(Math.max(fontScale, 1), STRIP_MAX_SCALE));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={strip.spoken} style={styles.strip}>
      <View style={[styles.row, { gap: stripGap(strip.tiles.length) }]}>
        {strip.tiles.map((t) =>
          t.kind === 'week' ? (
            <View key={t.week} style={[styles.week, { height, backgroundColor: colors.inset, borderColor: colors.border }]} />
          ) : (
            <View key={t.week} style={[styles.playoff, { height, backgroundColor: colors.accentTint, borderColor: colors.accent }]}>
              <Text variant="tag" maxFontSizeMultiplier={STRIP_MAX_SCALE} numberOfLines={1}>
                {t.chip}
              </Text>
            </View>
          ),
        )}
      </View>
      <View style={styles.ends}>
        <Text variant="caption" tone="secondary" maxFontSizeMultiplier={STRIP_MAX_SCALE} style={styles.tabular}>
          {keepWeek(strip.first)}
        </Text>
        <Text variant="caption" tone="secondary" maxFontSizeMultiplier={STRIP_MAX_SCALE} style={styles.tabular}>
          {keepWeek(strip.last)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    gap: space[3],
  },
  row: {
    flexDirection: 'row',
  },
  // No text: it gives up its width first. Every tile shares the free width equally; a playoff tile
  // also keeps its chip's own width on top, so it is the wider one.
  week: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: radius.sm - 2,
  },
  playoff: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 'auto',
    paddingHorizontal: space[3] - 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.sm - 2,
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space[3],
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
