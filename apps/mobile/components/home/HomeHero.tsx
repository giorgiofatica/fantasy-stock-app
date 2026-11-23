/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { space, type } from '@/constants/tokens';
import { Text } from '@/components/sp/Text';
import { keepTime } from '@/lib/game/keepDots';
import { useTheme } from '@/components/sp/ThemeProvider';
import { useMotion } from '@/components/sp/motion';
import { Icon } from '@/components/sp/Icon';
import { gainGap } from '@/components/sp/logic/gainGap';
import { formatGainPair, formatMoney, formatPercent, GAIN_PAIR_CLOSE, GAIN_PAIR_OPEN, isZeroMoney } from '@/components/sp/logic/money';
import { RollingMoney } from '@/components/home/RollingMoney';
import { HERO_SEASON_GAIN_LABEL, HERO_TODAY_LABEL, heroAccessibilityLabel, heroUnpricedCaption } from '@/lib/home/homeCopy';
import { ordinal } from '@/lib/home/ordinal';
import { heroLines, heroMetaLine } from '@/lib/home/calmHome';

// Stockpile — <HomeHero> (Phase 3b-2, D1 Concept A; Game Night, W4). The big number is
// team VALUE; the line under it is the scored season gain plus today's
// live change, labelled "season gain" — never "since the draft" (that
// label is Portfolio's alone, a different number: value − cost).
//
// H1 (hero roll): the value and the gain roll per changed digit on every
// live update, never on first paint — RollingMoney handles both (it
// diffs against itself on mount/a league switch, so nothing rolls then).
// H5: RollingMoney is keyed by `leagueId`, so switching leagues never
// presents a different league's number as a change.
//
// Zero is grey (never green/red) via Money/RollingMoney's caller passing
// colors.zero explicitly when the value rounds to zero cents — matching
// the app-wide "money flat" rule (§9A).
//
// Game Night (§9C, the board's HeroText): the value in `hero` (46/800, the screen's one
// standout); the sub-line's numbers (and the percent's brackets) at 700 in their sign's colour, its
// words ("season gain", "today") and the dot before "today" at 500 in `text2`; the meta line a `caption`.

export interface HomeHeroProps {
  leagueId: string;
  /** Null hides the "Nth of M ·" segment entirely — the board's
   * pre-season hero has no rank yet (Design Lead ruling, 2026-09-30, B3):
   * nobody has played a week, so a rank is a fabricated ordering. */
  rank: number | null;
  totalPlayers: number;
  record: string;
  /** "Week N of M" in the regular season, the playoff round name during
   * playoffs, or null once the season is past playing entirely (missed
   * the playoffs, complete) — see homeCopy.ts's heroWeekOrRoundLabel,
   * Design Lead ruling 2026-09-30. Dropping the segment removes its
   * leading " · " too. */
  weekOrRound: string | null;
  value: number;
  seasonGainDollars: number;
  seasonGainPct: number;
  /** Null hides the "today" segment entirely (a non-trading day). */
  today: number | null;
  /** Symbols with no live price counted into `value`/`seasonGainDollars`
   * at cost, and into `today` at zero gain (see lib/plCoverage.ts). Drives
   * the caption under the gain row — Design Lead ruling, 2026-09-29. */
  unpricedValue: string[];
  unpricedToday: string[];
  /** Pre-season override (Design Lead ruling, 2026-09-30, B3): the board's
   * HomePreSeason hero has no pct and no "today" at all -- just ONE pair,
   * "$0.00 · {label}", in zero grey (board: "Season starts Mon 9:30 AM
   * ET"). Set to replace the whole gain/pct/today line with that pair;
   * leave null/undefined for every other state. */
  preSeasonLabel?: string | null;
  /** The league plays in weeks (leagueHasWeeks). False drops the meta line and the gain line
   * (heroLines): a Duration league has no week and no scored season to show. Default true. */
  hasWeeks?: boolean;
  /** True when this mount was caused by a LEAGUE SWITCH, not Home's first
   * open (H5, Design Lead ruling 2026-09-29, Blocking 1) — the hero comes
   * in already settled, with no H4 rise. */
  skipEntrance?: boolean;
}


export function HomeHero({ leagueId, rank, totalPlayers, record, weekOrRound, value, seasonGainDollars, seasonGainPct, today, unpricedValue, unpricedToday, preSeasonLabel, hasWeeks = true, skipEntrance = false }: HomeHeroProps) {
  const { colors } = useTheme();
  const { reduced, duration, easing, withTiming } = useMotion();

  // H4: the hero rises in on first appearance — translateY 8 -> 0 at
  // `slow`/`settle` under full motion; Reduce Motion drops the rise for a
  // plain `quick` opacity crossfade (§5: "translate/scale -> crossfade").
  // A custom mount-driven value (not the built-in FadeInDown, whose
  // default offset isn't the spec's exact 8px) run once, never again —
  // this is an ENTER moment, not a live-update roll. `skipEntrance` (a
  // league-switch remount, not Home's first open) starts already settled
  // — no rise to replay (H5, Design Lead ruling 2026-09-29, Blocking 1).
  const enterProgress = useSharedValue(skipEntrance ? 1 : 0);
  useEffect(() => {
    if (skipEntrance) return;
    enterProgress.value = withTiming(1, {
      duration: reduced ? duration.quick : duration.slow,
      easing: reduced ? easing.settle : easing.settle,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only, intentionally not re-running on prop changes.
  }, []);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enterProgress.value,
    transform: reduced ? [] : [{ translateY: (1 - enterProgress.value) * 8 }],
  }));

  // One space's width at the callout size (logic/gainGap.ts): the gap between the gain line's units, given to the row.
  const { fontScale } = useWindowDimensions();
  const gap = gainGap(type.callout.fontSize, fontScale);
  const gainColor = isZeroMoney(seasonGainDollars) ? colors.zero : seasonGainDollars > 0 ? colors.gain : colors.loss;
  const todayColor = today == null ? colors.text2 : isZeroMoney(today) ? colors.zero : today > 0 ? colors.gain : colors.loss;

  const valueText = formatMoney(value);
  // Two roller units, not one string: RollingMoney is a non-wrapping row,
  // so a single "+$X · +Y%" string clipped at XXXL text sizes. Split, the
  // percent can wrap to its own line inside gainRow (XL check, 2026-10-05).
  const gainDollarsText = formatMoney(seasonGainDollars, { sign: 'always' });
  const gainPctText = formatPercent(seasonGainPct, { sign: 'always' });
  const todayText = today != null ? formatMoney(today, { sign: 'always' }) : null;

  const caption = heroUnpricedCaption(unpricedValue, unpricedToday);
  const lines = heroLines(hasWeeks);
  // No gain line (a league without weeks): VoiceOver says the value alone, with no "$0.00".
  const a11yLabel = !lines.gainLine
    ? `Your team, ${valueText}.`
    : preSeasonLabel != null
    ? `Your team, ${valueText}. $0.00, ${preSeasonLabel}.`
    : heroAccessibilityLabel(
        valueText,
        formatGainPair(seasonGainDollars, seasonGainPct).spoken,
        todayText,
        caption,
      );

  return (
    <Animated.View style={[styles.wrap, enterStyle]}>
      <View style={styles.metaRow}>
        <Text variant="caption" tone="secondary">
          Your team
        </Text>
        {/* The meta text wraps to a second line at XXXL sizes instead of
            running off the edge (XL check, 2026-10-05); at default size it
            fits one line and lays out exactly as before. */}
        {lines.meta ? (
          <Text variant="caption" tone="secondary" style={[styles.metaNum, styles.metaRight]}>
            {rank != null
              ? heroMetaLine([`${ordinal(rank)} of ${totalPlayers}`, record, weekOrRound])
              // Pre-season (rank null, board: "Week 1 of 14 · 0–0"): the
              // week/round leads, since there's no record worth leading
              // with yet -- the one case where this order differs from
              // every other state's "record · week" (Design Lead, B3).
              : heroMetaLine([weekOrRound, record])}
          </Text>
        ) : null}
      </View>

      {/* Blocking 2 (Design Lead, code review 2026-09-29): the whole hero
          is ONE accessible element — the value, the gain row, today, and
          the caption were four separately focusable pieces, and
          RollingMoney renders one Text per character, so VoiceOver could
          land on a single digit of the value or the gain. */}
      <View accessible accessibilityLabel={a11yLabel} style={styles.heroBody}>
        {/* §9C: the team value is the one standout, `hero` 46/800 (the board's HeroText). */}
        <RollingMoney text={valueText} size="hero" rollKey={leagueId} />

        {!lines.gainLine ? null : preSeasonLabel != null ? (
          <View style={[styles.gainRow, { columnGap: gap }]} testID="hero-gain-row">
            {/* The dot stays with the figure before it (a dot may end a line, never start one), and the gaps are
                the row's, not spaces in the strings: a wrapped line starts flush (P3, 2026-11-22). */}
            <View style={[styles.unit, { columnGap: gap }]}>
              <RollingMoney text={formatMoney(0, { sign: 'always' })} size="callout" color={colors.zero} rollKey={leagueId} fontWeight="700" />
              <Text variant="callout" tone="secondary">{HERO_DOT}</Text>
            </View>
            <Text variant="callout" tone="secondary">{keepTime(preSeasonLabel)}</Text>
          </View>
        ) : (
          <View style={[styles.gainRow, { columnGap: gap }]} testID="hero-gain-row">
            <RollingMoney text={gainDollarsText} size="callout" color={gainColor} rollKey={leagueId} fontWeight="700" />
            {/* The percent in brackets (Giorgio, 2026-11-17, pick A): "(" and ")" travel with the percent as
                ONE non-wrapping unit, so a wrapped line never strands a bracket. Only the numbers and
                their brackets take the gain colour; the words stay grey (2026-11-18, pick A). */}
            <View style={styles.pctUnit}>
              <Text variant="callout" style={{ color: gainColor, fontWeight: '700' }}>{GAIN_PAIR_OPEN}</Text>
              <RollingMoney text={gainPctText} size="callout" color={gainColor} rollKey={leagueId} fontWeight="700" />
              <Text variant="callout" style={{ color: gainColor, fontWeight: '700' }}>{GAIN_PAIR_CLOSE}</Text>
            </View>
            {/* P3 (2026-11-22): the gaps between the units are the row's `columnGap`, never a space inside a
                string, so a wrapped line starts flush. The dot is glued to "season gain" in one non-wrapping
                unit: it may end a line, never start one. */}
            {todayText ? (
              <>
                <View style={[styles.unit, { columnGap: gap }]}>
                  <Text variant="callout" tone="secondary">{HERO_SEASON_GAIN_LABEL}</Text>
                  <Text variant="callout" tone="secondary">{HERO_DOT}</Text>
                </View>
                <RollingMoney text={todayText} size="callout" color={todayColor} rollKey={leagueId} fontWeight="700" />
                <Text variant="callout" tone="secondary">{HERO_TODAY_LABEL}</Text>
              </>
            ) : (
              <Text variant="callout" tone="secondary">{HERO_SEASON_GAIN_LABEL}</Text>
            )}
          </View>
        )}

        {preSeasonLabel == null && caption ? (
          <Text variant="caption" tone="secondary">
            <Icon name="info" size="caption" tone="text2" />{' '}
            {caption}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

/** The grey dot between two facts on the gain row ("season gain · +$Z today"), a unit of its own so it can be glued. */
const HERO_DOT = '·';

const styles = StyleSheet.create({
  wrap: {
    gap: space[2],
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  metaNum: {
    fontVariant: ['tabular-nums'],
  },
  metaRight: {
    flexShrink: 1,
    textAlign: 'right',
  },
  heroBody: {
    gap: space[2],
  },
  pctUnit: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  // Two things that never wrap apart (a figure and its dot, "season gain" and its dot).
  unit: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  gainRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
});
