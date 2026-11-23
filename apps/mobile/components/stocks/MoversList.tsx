/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
/**
 * MoversList: the "Top movers" chip under Available (plan part 3, workstream 5; board #call-stocks-tab-lists, section 6).
 *
 * Up to 25 stocks nobody in the league owns, in the SERVER's order (biggest move first, up or down: topMovers.ts never re-sorts).
 * A row is the board's: the "+" at the left edge (the same one Available draws), the ticker disc, the ticker and the company
 * name (no category: the board draws none here), the live price with today's change under it, and the star at the right edge.
 * The read returns NO price and NO change (the accurate-prices rule): each row takes both from the live single-symbol lookup,
 * for the rows on screen only, through the Watching rows' own quote store (useRowQuotes), so the two figures on a row come from
 * one read. While the market is closed the change is the last session's, named by its day ("+11.2% Fri"); that is all the
 * closed market changes (no extra line).
 *
 * What it says when it has nothing to show is the existing "Stocks didn't load" with Try again, for every cause (an empty reply,
 * a refused or paced read, a ranking more than 20 minutes old while the market is open): topMovers.ts moversVerdict.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { space } from '@/constants/tokens';
import { Icon } from '@/components/sp/Icon';
import { PressableScale } from '@/components/sp/PressableScale';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { VALUE_PT, valueScale } from '@/components/sp/logic/holdingFit';
import { TickerBadge } from '@/components/sp/gn/TickerBadge';
import { useScrollFold } from '@/components/shell/scrollFold';
import { LoadFailure } from '@/components/money/LoadFailure';
import { useStockSheet } from '@/components/money/MoneyHost';
import { StarButton } from '@/components/stocks/StarButton';
import { Skeleton } from '@/components/Skeleton';
import { priceLabel } from '@/lib/game/queueRow';
import { keepMoney } from '@/lib/game/keepDots';
import { COPY } from '@/lib/money/moneyCopy';
import { moverLabel, moversVerdict, type LastSession } from '@/lib/stocks/topMovers';
import type { UseTopMovers } from '@/lib/stocks/useTopMovers';
import { useRowQuotes } from '@/lib/stocks/useRowQuotes';
import { ROW_TEXT_MAX_SCALE, priceUnderName, symbolsOnScreen, type ListRow } from '@/lib/stocks/stocksList';
import { changeSpoken, changeText, changeTone, type RowQuote } from '@/lib/stocks/rowQuotes';
import { isSaved, type LeagueWatch } from '@/lib/stocks/watchlist';

const PLUS_DISC = 26;
const SKELETON_ROWS = 8;
const SEARCH_TEXT_MAX_SCALE = 1.6;
const NO_PRICE = priceLabel(null);

export interface MoversListProps {
  movers: UseTopMovers;
  /** True ONLY when the market is known to be closed (an unknown market is judged as open: the old-ranking rule applies). */
  marketClosed: boolean;
  /** The most recent trading session (topMovers.ts lastSessionBefore), judged from the market calendar; null when the calendar cannot name it. Only read while closed. */
  lastSession: LastSession | null;
  /** "today" while the market is open, the last close's short weekday ("Fri") while it is closed, null when unknown. */
  dayWord: string | null;
  /** The "+" at each row's left edge: the same predicate Available uses (a finished season starts no buy). */
  plus: boolean;
  watch: LeagueWatch;
  onStar: (symbol: string) => void;
}

export function MoversList({ movers, marketClosed, lastSession, dayWord, plus, watch, onStar }: MoversListProps) {
  const verdict = movers.status === 'ready' ? moversVerdict(movers.read, marketClosed, movers.now, lastSession) : null;
  if (movers.status === 'loading') return <MoversSkeleton />;
  if (movers.status === 'failed' || !verdict || verdict.kind === 'failed') {
    return <LoadFailure title={COPY.stockSearchLoadTitle} message={COPY.loadRetryMessage} onRetry={() => void movers.reload()} />;
  }
  return <MoverRows rows={verdict.rows} dayWord={dayWord} plus={plus} watch={watch} onStar={onStar} />;
}

function MoverRows({ rows, dayWord, plus, watch, onStar }: { rows: ListRow[]; dayWord: string | null; plus: boolean; watch: LeagueWatch; onStar: (symbol: string) => void }) {
  const { open } = useStockSheet();
  const fold = useScrollFold();
  const listRef = useRef<View>(null);
  const boxes = useRef(new Map<string, { y: number; height: number }>());
  const latest = useRef(rows);
  latest.current = rows;
  const [onScreen, setOnScreen] = useState<string[]>([]);
  const quoteOf = useRowQuotes(onScreen);

  // Which rows are on screen: the only rows whose figures are asked for (the page's throttled scroll signal, as Available's list).
  const measure = useCallback(() => {
    const vp = fold?.viewport() ?? null;
    if (!vp) return;
    listRef.current?.measureInWindow((_x, y) => {
      const asBoxes = latest.current.flatMap((r) => {
        const b = boxes.current.get(r.symbol);
        return b ? [{ symbol: r.symbol, y: b.y, height: b.height }] : [];
      });
      const next = symbolsOnScreen(asBoxes, y, vp);
      setOnScreen((prev) => (prev.join(',') === next.join(',') ? prev : next));
    });
  }, [fold]);
  const rowsKey = rows.map((r) => r.symbol).join(',');
  useEffect(() => {
    measure();
    return fold?.subscribe(measure);
  }, [fold, measure, rowsKey]);

  return (
    <View ref={listRef} collapsable={false}>
      {rows.map((row) => (
        <MoverRow
          key={row.symbol}
          row={row}
          quote={quoteOf(row.symbol)}
          dayWord={dayWord}
          plus={plus}
          saved={isSaved(watch, row.symbol)}
          onStar={() => onStar(row.symbol)}
          // The same sheet and the same review as Available's rows: a tap looks, the "+" asks for the buy review, and nothing buys in one tap.
          onOpen={() => open(row.symbol, { name: row.name, originRef: 'stocks-row', startReview: null })}
          onPlus={() => open(row.symbol, { name: row.name, originRef: 'stocks-plus', startReview: 'buy' })}
          onBox={(b) => {
            boxes.current.set(row.symbol, b);
            measure();
          }}
        />
      ))}
      {/* The Alpaca credit on every price surface (PRODUCT_RULES), under the rows. */}
      <Text variant="caption" maxFontSizeMultiplier={SEARCH_TEXT_MAX_SCALE} tone="secondary" style={[styles.center, styles.credit]}>{COPY.alpacaCredit}</Text>
    </View>
  );
}

function MoverRow({
  row,
  quote,
  dayWord,
  plus,
  saved,
  onStar,
  onOpen,
  onPlus,
  onBox,
}: {
  row: ListRow;
  quote: RowQuote | undefined;
  dayWord: string | null;
  plus: boolean;
  saved: boolean;
  onStar: () => void;
  onOpen: () => void;
  onPlus: () => void;
  onBox: (b: { y: number; height: number }) => void;
}) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  // The row's width, once laid out (null until then: full size, never a guess).
  const [rowWidth, setRowWidth] = useState<number | null>(null);
  const under = priceUnderName(fontScale);
  const ready = quote && quote.status === 'ready' ? quote : null;
  const priceText = priceLabel(ready?.price);
  const pct = ready?.changePct ?? null;
  const change = changeText(pct, dayWord);
  const tone = changeTone(pct);
  const changeColor = tone === 'loss' ? colors.loss : tone === 'gain' ? colors.gain : colors.text2;
  const figures = (
    <View style={under ? styles.figuresUnder : styles.figures}>
      <Text
        testID="stocks-mover-price"
        variant="score.sm"
        maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE}
        numberOfLines={1}
        style={[styles.price, !under && { fontSize: VALUE_PT * valueScale(rowWidth, priceText, fontScale) }]}
      >
        {keepMoney(priceText)}
      </Text>
      {change ? (
        <Text testID="stocks-mover-change" variant="caption" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} color={changeColor} numberOfLines={1} style={[styles.bold, styles.tabular]}>{keepMoney(change)}</Text>
      ) : null}
    </View>
  );
  return (
    <View
      style={styles.row}
      onLayout={(e) => {
        const { y, height, width } = e.nativeEvent.layout;
        setRowWidth(width);
        onBox({ y, height });
      }}
    >
      {plus ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Buy ${row.symbol}`} onPress={onPlus} style={styles.plusTarget} testID={`stocks-plus-${row.symbol}`}>
          <View style={[styles.plusDisc, { backgroundColor: colors.accent }]}>
            <Icon name="add" size="caption" tone="onAccent" />
          </View>
        </Pressable>
      ) : null}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={moverLabel(row.symbol, row.name, priceText, NO_PRICE, changeSpoken(pct, dayWord))}
        onPress={onOpen}
        style={styles.rowMain}
        testID={`stocks-row-${row.symbol}`}
      >
        <TickerBadge symbol={row.symbol} />
        <View style={styles.lead}>
          <Text variant="ticker" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE}>{row.symbol}</Text>
          {row.name ? <Text variant="caption" tone="secondary" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} numberOfLines={2}>{row.name}</Text> : null}
          {under ? figures : null}
        </View>
        {under ? null : <View style={styles.trail}>{figures}</View>}
        {plus ? null : <Icon name="chevronRight" size="callout" tone="text2" />}
      </PressableScale>
      {/* The star: the right edge, never beside the "+" (board). */}
      <StarButton symbol={row.symbol} saved={saved} onPress={onStar} />
    </View>
  );
}

/** The first read's skeleton: Available's rows (VoiceOver: "Loading results", busy), with a 26pt circle for each "+". */
function MoversSkeleton() {
  return (
    <View accessible accessibilityLabel="Loading results" accessibilityState={{ busy: true }} testID="stocks-movers-skeleton">
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={styles.plusTarget}>
            <Skeleton width={PLUS_DISC} height={PLUS_DISC} borderRadius={PLUS_DISC / 2} />
          </View>
          <Skeleton width={40} height={40} borderRadius={20} />
          <View style={styles.skeletonLines}>
            <Skeleton width={64} height={14} />
            <Skeleton width={140} height={12} />
          </View>
          <Skeleton width={64} height={14} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  rowMain: { flex: 1, minWidth: 0, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[4], paddingVertical: space[3] },
  plusTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  plusDisc: { width: PLUS_DISC, height: PLUS_DISC, borderRadius: PLUS_DISC / 2, alignItems: 'center', justifyContent: 'center' },
  lead: { flex: 1, minWidth: 0, gap: space[1] },
  trail: { flexShrink: 0, maxWidth: '45%', alignItems: 'flex-end' },
  figures: { alignItems: 'flex-end' },
  figuresUnder: { alignItems: 'flex-start' },
  // A money number: 700 (800 is for game numbers, §9C rule 5), tabular.
  price: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  skeletonRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[4], paddingVertical: space[3] },
  skeletonLines: { flex: 1, gap: space[2] },
  credit: { paddingTop: space[5] },
  bold: { fontWeight: '700' },
  tabular: { fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
});
