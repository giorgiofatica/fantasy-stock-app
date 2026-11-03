/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { router } from 'expo-router';

import { space } from '@/constants/tokens';
import { RIM_WIDTH } from '@/constants/tokens/elevation';
import { Avatar } from '@/components/sp/Avatar';
import { Icon } from '@/components/sp/Icon';
import { PressableScale } from '@/components/sp/PressableScale';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { useMotion } from '@/components/sp/motion';
import { toneOf } from '@/components/sp/logic/gameNight';
import { formatMoney } from '@/components/sp/logic/money';
import { fontScaleKey } from '@/components/sp/logic/remeasureKey';
import { keepMoney } from '@/lib/game/keepDots';
import { LIVE_CHIP, SEASON_TILE_BYE, SEASON_TILE_UNSCORED, YOUR_SEASON_TITLE } from '@/lib/home/homeCopy';
import { SCHEDULE_HREF, THIS_WEEK_HREF } from '@/lib/home/calmHome';
import {
  anchorIndex, GLYPH_MAX_SCALE, initialOffset, OPENS_SCHEDULE_HINT, ROW_LEAD, SCORE_MIN_FONT_SCALE, TILE_GAP, TILE_RADIUS,
  tileHint, tileLabel, tileMinHeight, tileTargetsMatchup, tileWeekText, tileWidth, type SeasonResult, type SeasonTile,
} from '@/lib/home/yourSeason';

// Stockpile — <YourSeason> (Home, decided A, 2026-11-03; PRODUCT_RULES "No chart on Home"). One
// row of tiles, one per week, scrolling sideways: a played week shows "Wk N", W / L / T and YOUR
// score; this week is your tint and a 1.5pt outline in your colour and never repeats the score
// (This week is right above it); the weeks ahead show who you play. The tiles come from
// lib/home/yourSeason, fed by the same matchup rows League › Schedule reads.
//
// The row bleeds to the screen's edges with a 20pt leading inset (Wk 1 lines up with the
// content). It opens with this week's tile in view at the right and the next one peeking.
// Dynamic Type: a tile is 54pt × min(fontScale, 2.1) wide (all the same width), the score is one
// line that shrinks to fit (money never wraps), the W / L / T caps at 2.0×. The root is keyed
// by the font scale (a live change leaves containers at the old layout, remeasureKey.ts).

export interface YourSeasonProps {
  tiles: SeasonTile[];
  /** A league switch mounted this Home body: the tiles are already in place, no entrance. */
  skipEntrance?: boolean;
}

/** The live / ring marker, scaled with the type like the board's. */
const DOT = 9;

export function YourSeason({ tiles, skipEntrance = false }: YourSeasonProps) {
  const { fontScale, width } = useWindowDimensions();
  const { reduced, stagger, spring } = useMotion();
  // The schedule read failed or has no row for you: nothing at all (no title, no skeleton).
  if (tiles.length === 0) return null;

  const offset = initialOffset({ tileCount: tiles.length, anchorIndex: anchorIndex(tiles), fontScale, viewportWidth: width });
  return (
    // The root carries the scale key; the ScrollView inside takes its initial offset on that
    // remount (a scale change recomputes it, nothing is persisted).
    <View key={fontScaleKey(fontScale)} style={styles.root} testID="your-season">
      {/* One role per element: the container is the heading, the pressable inside it the button. */}
      <View accessibilityRole="header">
        <PressableScale
          onPress={() => router.push(SCHEDULE_HREF)}
          accessibilityRole="button"
          accessibilityLabel={YOUR_SEASON_TITLE}
          accessibilityHint={OPENS_SCHEDULE_HINT}
          style={styles.titleRow}
          testID="your-season-title"
        >
          {/* The Standings card's title: headline, 800. */}
          <Text variant="headline" style={styles.title}>{YOUR_SEASON_TITLE}</Text>
          <Icon name="chevronRight" size="callout" tone="text2" />
        </PressableScale>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // No paging, no snapping: a plain strip. The offset is a mount-time value.
        contentOffset={{ x: offset, y: 0 }}
        style={styles.bleed}
        contentContainerStyle={styles.row}
        testID="your-season-row"
      >
        {tiles.map((tile, i) => {
          const entering = reduced || skipEntrance
            ? undefined
            : FadeInDown.delay(stagger.delayFor(i))
                .springify()
                .damping(spring.snappy.damping)
                .stiffness(spring.snappy.stiffness)
                .reduceMotion(ReduceMotion.System);
          return (
            <Animated.View key={tile.week} entering={entering}>
              <Tile tile={tile} fontScale={fontScale} />
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Tile({ tile, fontScale }: { tile: SeasonTile; fontScale: number }) {
  const { colors } = useTheme();
  const w = tileWidth(fontScale);
  const dot = DOT * Math.min(Math.max(fontScale, 1), 2);
  const toneColor = (r: SeasonResult) => (r === 'W' ? colors.gain : r === 'L' ? colors.loss : colors.text2);

  const isThis = tile.kind === 'this';
  const upcoming = tile.kind === 'upcoming';
  // Fill and edge: played / unscored / bye on the surface with the card rim; this week on your
  // tint with a 1.5pt outline in your colour; the weeks ahead no fill, a 1pt line.
  const fill = isThis ? colors.youTint : upcoming ? undefined : colors.surface;
  const edge = isThis ? { width: 1.5, color: colors.you } : upcoming ? { width: 1, color: colors.line } : { width: RIM_WIDTH, color: colors.rim };

  let middle: ReactNode = null;
  let bottom: ReactNode = null;
  switch (tile.kind) {
    case 'played':
      middle = <Glyph letter={tile.result} color={toneColor(tile.result)} />;
      bottom = (
        <Text
          variant="score.sm"
          color={colors[toneOf(tile.gain)]}
          style={styles.score}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={SCORE_MIN_FONT_SCALE}
        >
          {keepMoney(formatMoney(tile.gain, { sign: 'always' }))}
        </Text>
      );
      break;
    case 'unscored':
      // A past week with no score yet: a dash, no score, never a W / L.
      middle = <Text variant="caption" tone="secondary" style={styles.word}>{SEASON_TILE_UNSCORED}</Text>;
      break;
    case 'bye':
      middle = <Text variant="caption" tone="secondary" style={styles.word}>{SEASON_TILE_BYE}</Text>;
      break;
    case 'upcoming':
      middle = <Avatar name={tile.opponent} size={26} tone="opp" />;
      // One line, cut at the tail (the default); VoiceOver reads the full name from the tile's label.
      bottom = (
        <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.name}>
          {tile.opponent}
        </Text>
      );
      break;
    case 'this':
      if (tile.middle === 'live') middle = <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: colors.live }} />;
      else if (tile.middle === 'ring') middle = <View style={{ width: dot, height: dot, borderRadius: dot / 2, borderWidth: 1.5, borderColor: colors.text2 }} />;
      else if (tile.middle === 'bye') middle = <Text variant="caption" tone="secondary" style={styles.word}>{SEASON_TILE_BYE}</Text>;
      else if (tile.result) middle = <Glyph letter={tile.result} color={toneColor(tile.result)} />;
      // "Live", only while the market is open; never a score.
      if (tile.showLive) bottom = <Text variant="caption" color={colors.liveText} style={styles.live}>{LIVE_CHIP}</Text>;
      break;
  }

  return (
    <PressableScale
      onPress={() => router.push(tileTargetsMatchup(tile) ? THIS_WEEK_HREF : SCHEDULE_HREF)}
      accessibilityRole="button"
      accessibilityLabel={tileLabel(tile)}
      accessibilityHint={tileHint(tile)}
      style={[styles.tile, { width: w, minHeight: tileMinHeight(fontScale), backgroundColor: fill }]}
      testID={`season-tile-${tile.week}`}
    >
      <View pointerEvents="none" style={[styles.edge, { borderWidth: edge.width, borderColor: edge.color }]} />
      <Text variant="caption" tone="secondary" style={styles.weekText}>{tileWeekText(tile)}</Text>
      <View style={styles.middle}>{middle}</View>
      {/* Every tile keeps the bottom line's height, so the middle sits at one height across the row. */}
      <View style={styles.bottom}>{bottom ?? <Text variant="caption" style={styles.spacer}>{' '}</Text>}</View>
    </PressableScale>
  );
}

function Glyph({ letter, color }: { letter: SeasonResult; color: string }) {
  // "Score weight": 22pt, ExtraBold, capped at 2.0× (the cap is an explicit size, cappedType.ts).
  return (
    <Text variant="score.lg" color={color} maxFontSizeMultiplier={GLYPH_MAX_SCALE} style={styles.glyph}>
      {letter}
    </Text>
  );
}

const styles = StyleSheet.create({
  // The block's own gap to its title (the Standings card's header is 12pt over its rows).
  root: {
    gap: space[1],
  },
  // 44pt target; the title's box is ~22pt, so it is centred in 44.
  titleRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontWeight: '800',
  },
  // The row runs to the screen's edges: the Home content has a 20pt gutter, undone here, and
  // the row's own leading inset puts Wk 1 back on it.
  bleed: {
    marginHorizontal: -space[6],
    flexGrow: 0,
  },
  row: {
    paddingHorizontal: ROW_LEAD,
    columnGap: TILE_GAP,
  },
  // flexGrow: every tile fills the row's height (the tallest tile, an upcoming one at large
  // text, sets it), so the row reads as one strip of equal tiles.
  tile: {
    flexGrow: 1,
    borderRadius: TILE_RADIUS,
    paddingTop: space[2],
    paddingBottom: space[2],
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  edge: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TILE_RADIUS,
  },
  weekText: {
    textAlign: 'center',
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  glyph: {
    fontSize: 22,
    lineHeight: 26,
  },
  score: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  word: {
    fontWeight: '700',
    textAlign: 'center',
  },
  name: {
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  live: {
    fontWeight: '800',
    textAlign: 'center',
  },
  spacer: {
    opacity: 0,
  },
});
