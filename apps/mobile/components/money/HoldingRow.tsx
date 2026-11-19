/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { forwardRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { radius, space } from '@/constants/tokens';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { PressableScale } from '@/components/sp/PressableScale';
import { CategoryPill, ROW_PILL_MAX_SCALE } from '@/components/sp/gn/CategoryPill';
import type { Category } from '@/components/sp/logic/gameNight';
import { DISC_PT, discTickerScale, VALUE_PT, valueScale } from '@/components/sp/logic/holdingFit';
import type { HoldingRow as HoldingRowData } from '@/lib/money/portfolioView';

// Stockpile — <HoldingRow>, Game Night (W4 Portfolio; the board's Portfolio frame, A): one
// holding as a roster row. The ticker disc (40pt, `inset`), the ticker in `ticker` (16/800)
// with its slot pill in slotted leagues (a category's CategoryPill, a price tier's band), the
// company and shares under it; on the right the value (15/800, tabular) and today's percent
// in its sign's colour. NO sparkline (Giorgio, 2026-10-12: "I don't want that like line thing
// there visible"): the player card carries the lines. No rule between rows: separation is
// space (§9C rule 2). The whole row is one 44pt+ target that opens the player card.

/** The row's small text never outgrows the ticker beside it, nor the value: 1.3× at most. */
export const ROW_TEXT_MAX_SCALE = 1.3;
const NBSP = '\u00a0';
// The disc's ticker (floor 11pt, §9B) and the value (floor 0.75) are fitted by a MEASURED scale
// (components/sp/logic/holdingFit), never by iOS's adjustsFontSizeToFit: on a frame not yet laid out it
// shrank the first row's two texts to ~40% at AX5 (the finished manager portfolio, DL gate 2026-11-18).

export interface HoldingRowProps {
  row: HoldingRowData;
  /** The slot pill: a category slot's category, a price tier's band; none when unslotted. */
  pill: { category: Category } | { slot: string } | null;
  /** Opens the player card. Absent: the row is information only (a leaguemate's stock whose
   * card can't be whole), drawn as a plain row, never a button that does nothing. */
  onPress?: () => void;
}

export const HoldingRow = forwardRef<View, HoldingRowProps>(function HoldingRow({ row, pill, onPress }, ref) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  // The row's width, once laid out (null until then: full size, never a guess).
  const [rowWidth, setRowWidth] = useState<number | null>(null);
  const tone = row.todayTone ? colors[row.todayTone] : colors.text2;
  const pillText = pill && 'slot' in pill ? pill.slot : null;
  const label = `${row.symbol}, ${row.name}, ${row.quantityText} shares, ${row.valueText}${row.todayText ? `, ${row.todayText} today` : ''}`;
  const inner = (
    <>
      <View style={[styles.disc, { backgroundColor: colors.inset }]}>
        <Text variant="ticker.tile" allowFontScaling={false} numberOfLines={1} style={{ fontSize: DISC_PT * discTickerScale(row.symbol) }}>{row.symbol}</Text>
      </View>
      <View style={styles.lead}>
        <View style={styles.tickerLine}>
          <Text variant="ticker" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE}>{row.symbol}</Text>
          {pill && 'category' in pill ? <CategoryPill category={pill.category} size="row" /> : null}
          {pillText ? (
            <View style={[styles.slotPill, { backgroundColor: colors.inset }]}>
              <Text variant="caption" maxFontSizeMultiplier={ROW_PILL_MAX_SCALE} style={styles.bold}>{pillText}</Text>
            </View>
          ) : null}
        </View>
        {/* Two Texts (W4 DL gate): the company truncates, " · N sh" never does. */}
        <View style={styles.subLine}>
          <Text testID="holding-row-company" variant="caption" tone="secondary" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} numberOfLines={1} style={styles.company}>
            {row.name}
          </Text>
          <Text testID="holding-row-shares" variant="caption" tone="secondary" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} numberOfLines={1} style={styles.shares}>
            {`${NBSP}· ${row.quantityText}${NBSP}sh`}
          </Text>
        </View>
      </View>
      <View style={styles.trail}>
        {/* A money number: 700 (800 is for game numbers, §9C rule 5). */}
        <Text variant="score.sm" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} numberOfLines={1} style={[styles.money, { fontSize: VALUE_PT * valueScale(rowWidth, row.valueText, fontScale) }]}>{row.valueText}</Text>
        {row.todayText ? (
          <Text variant="caption" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} color={tone} style={[styles.bold, styles.tabular]}>{row.todayText}</Text>
        ) : null}
      </View>
    </>
  );
  return (
    <View ref={ref} collapsable={false} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
      {onPress ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Opens its player card"
          onPress={onPress}
          style={styles.row}
          testID={`holding-row-${row.symbol}`}
        >
          {inner}
        </PressableScale>
      ) : (
        <View accessible accessibilityLabel={label} style={styles.row} testID={`holding-row-${row.symbol}`}>
          {inner}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingVertical: space[3],
  },
  disc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[1],
  },
  lead: {
    flex: 1,
    minWidth: 0,
    gap: space[1],
  },
  tickerLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: space[3],
    rowGap: space[1],
  },
  slotPill: {
    minHeight: 20,
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  trail: {
    alignItems: 'flex-end',
    gap: space[1],
    flexShrink: 0,
    maxWidth: '45%',
  },
  subLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    minWidth: 0,
  },
  company: {
    flexShrink: 1,
    minWidth: 0,
  },
  shares: {
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
  },
  money: {
    fontWeight: '700',
  },
  bold: {
    fontWeight: '700',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
