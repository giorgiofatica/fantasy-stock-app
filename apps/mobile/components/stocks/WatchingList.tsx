/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
/**
 * WatchingList: the Stocks tab's second view, the stocks you saved in THIS league (board #call-stocks-tab-lists, section 3).
 *
 * A row: the "+" at the left when the stock can be bought, the ticker disc, the ticker and ONE status line (no company name:
 * October ruling 13c, so a row with a button stays at two lines), the live price with today's change under it, the star at the
 * right edge. The status line (watchlist.ts statusLine) is, in the Planner's order: who else owns it ("Owned by {name}"), then
 * "No longer tradable", then the slot lines (the server's, from the list preview: useWatchSlots). A stock YOU hold is not listed at all
 * (Giorgio, 2026-11-23: it is in your portfolio). A price we do not have reads "–" (never $0.00). Nothing to show: the star and "Star a stock to watch it here."
 *
 * The read returns NO price (the accurate-prices rule): each row takes its price AND its change from the live lookup, for the
 * rows on screen only (useRowQuotes). While the market is closed the change is the last session's, named by its day ("+1.4% Fri").
 * Unstarring a row takes it off the list at once; a removal that does not go through puts it back.
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
import { useWatchSlots } from '@/lib/stocks/useWatchSlots';
import { keepMoney } from '@/lib/game/keepDots';
import { COPY } from '@/lib/money/moneyCopy';
import { useStockOwnership } from '@/lib/stocks/useSearchOwnership';
import { useRowQuotes } from '@/lib/stocks/useRowQuotes';
import { ROW_TEXT_MAX_SCALE, priceUnderName, symbolsOnScreen } from '@/lib/stocks/stocksList';
import { changeSpoken, changeText, changeTone, type RowQuote } from '@/lib/stocks/rowQuotes';
import { statusLine, watchRowHasPlus, watchingRows, type LeagueWatch, type StatusKind, type WatchRow as WatchRowData } from '@/lib/stocks/watchlist';

const PLUS_DISC = 26;

/** The price a row is showing: the live lookup's, or null ("–"). */
function priceOf(q: RowQuote | undefined): number | null {
  return q && q.status === 'ready' ? q.price : null;
}
const SKELETON_ROWS = 5;
const SEARCH_TEXT_MAX_SCALE = 1.6;

export interface WatchingListProps {
  leagueId: string | null;
  watch: LeagueWatch;
  allowUndraftable: boolean;
  seasonOver: boolean;
  /** "today" while the market is open, the last close's short weekday ("Fri") while it is closed, null when unknown. */
  dayWord: string | null;
  onToggle: (symbol: string) => void;
  onRetry: () => void;
}

export function WatchingList({ leagueId, watch, allowUndraftable, seasonOver, dayWord, onToggle, onRetry }: WatchingListProps) {
  const { colors } = useTheme();
  const { open } = useStockSheet();
  const ownership = useStockOwnership();
  const fold = useScrollFold();
  // A stock you hold is left out (watchlist.ts watchingRows); nothing is hidden while the ledger is unknown.
  const rows = watchingRows(watch, (sym) => ownership.ownerFor(sym)?.kind === 'me');
  const listRef = useRef<View>(null);
  const boxes = useRef(new Map<string, { y: number; height: number }>());
  const latest = useRef(rows);
  latest.current = rows;
  const [onScreen, setOnScreen] = useState<string[]>([]);
  const quoteOf = useRowQuotes(onScreen);
  // The server's slot lines: ONE list call for the rows that show a price (never one per row), each answer kept only for the price it was given for.
  const slotOf = useWatchSlots(leagueId, rows.map((r) => ({ symbol: r.symbol, price: priceOf(quoteOf(r.symbol)) })));

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

  // Nothing known yet (the first read is in flight): the skeleton. A first read that failed has nothing to keep: the full failure.
  if (watch.status === 'failed' && rows.length === 0) {
    return <LoadFailure title={COPY.stockSearchLoadTitle} message={COPY.loadRetryMessage} onRetry={onRetry} />;
  }
  // Saved but not yet named by the read (a first read in flight, or a just-saved stock): the skeleton, never a blank or the empty state.
  const unnamed = watch.symbols.some((s) => !watch.rows.some((r) => r.symbol === s));
  if (rows.length === 0 && (watch.status === 'idle' || watch.status === 'loading' || unnamed) && !(watch.status === 'ready' && watch.symbols.length === 0)) return <WatchSkeleton />;
  if (rows.length === 0) {
    return (
      <View style={styles.empty} testID="stocks-watching-empty">
        <Icon name="star" size="title" tone="text2" />
        <Text variant="headline" maxFontSizeMultiplier={SEARCH_TEXT_MAX_SCALE} style={[styles.center, styles.extraBold]}>{COPY.watchingEmpty}</Text>
      </View>
    );
  }
  return (
    <View ref={listRef} collapsable={false}>
      {rows.map((r) => {
        const owner = ownership.ownerFor(r.symbol);
        const slot = slotOf(r.symbol, priceOf(quoteOf(r.symbol)));
        const status = statusLine({
          owner: owner?.kind === 'other' ? { name: owner.name } : null,
          isDraftable: r.isDraftable,
          allowUndraftable,
          slotLine: slot ? { text: slot.text, full: slot.full } : null,
          roomless: ownership.roomless,
        });
        return (
          <WatchRow
            key={r.symbol}
            row={r}
            status={status}
            plus={watchRowHasPlus(status, seasonOver)}
            quote={quoteOf(r.symbol)}
            dayWord={dayWord}
            onOpen={() => open(r.symbol, { name: r.name, originRef: 'stocks-row' })}
            onPlus={() => open(r.symbol, { name: r.name, originRef: 'stocks-plus', startReview: 'buy' })}
            onStar={() => onToggle(r.symbol)}
            onBox={(b) => {
              boxes.current.set(r.symbol, b);
              measure();
            }}
          />
        );
      })}
      <Text variant="caption" maxFontSizeMultiplier={SEARCH_TEXT_MAX_SCALE} tone="secondary" style={[styles.center, styles.credit]}>{COPY.alpacaCredit}</Text>
    </View>
  );
}

function WatchRow({
  row,
  status,
  plus,
  quote,
  dayWord,
  onOpen,
  onPlus,
  onStar,
  onBox,
}: {
  row: WatchRowData;
  status: { text: string; kind: StatusKind };
  plus: boolean;
  quote: RowQuote | undefined;
  dayWord: string | null;
  onOpen: () => void;
  onPlus: () => void;
  onStar: () => void;
  onBox: (b: { y: number; height: number }) => void;
}) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState<number | null>(null);
  const under = priceUnderName(fontScale);
  const ready = quote && quote.status === 'ready' ? quote : null;
  const priceText = priceLabel(ready?.price);
  const pct = ready?.changePct ?? null;
  const change = changeText(pct, dayWord);
  const tone = changeTone(pct);
  const changeColor = tone === 'loss' ? colors.loss : tone === 'gain' ? colors.gain : colors.text2;
  const label = [row.symbol, status.text, priceText === priceLabel(null) ? 'price unavailable' : priceText, changeSpoken(pct, dayWord)].filter(Boolean).join(', ');
  const figures = (
    <View style={under ? styles.figuresUnder : styles.figures}>
      <Text
        testID="stocks-watch-price"
        variant="score.sm"
        maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE}
        numberOfLines={1}
        style={[styles.price, !under && { fontSize: VALUE_PT * valueScale(rowWidth, priceText, fontScale) }]}
      >
        {keepMoney(priceText)}
      </Text>
      {change ? (
        <Text testID="stocks-watch-change" variant="caption" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} color={changeColor} numberOfLines={1} style={[styles.bold, styles.tabular]}>{keepMoney(change)}</Text>
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
      ) : (
        // The empty slot where the "+" would be, so every row's disc lines up (the board draws it so).
        <View style={styles.plusTarget} />
      )}
      <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onOpen} style={styles.rowMain} testID={`stocks-row-${row.symbol}`}>
        <TickerBadge symbol={row.symbol} />
        <View style={styles.lead}>
          <Text variant="ticker" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE}>{row.symbol}</Text>
          <Text
            testID="stocks-watch-status"
            variant="caption"
            maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE}
            tone="secondary"
            numberOfLines={2}
            style={styles.bold}
          >
            {status.text}
          </Text>
          {under ? figures : null}
        </View>
        {under ? null : <View style={styles.trail}>{figures}</View>}
      </PressableScale>
      <StarButton symbol={row.symbol} saved onPress={onStar} />
    </View>
  );
}

function WatchSkeleton() {
  return (
    <View accessible accessibilityLabel="Loading results" accessibilityState={{ busy: true }} testID="stocks-watching-skeleton">
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <View key={i} style={styles.skeletonRow}>
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
  price: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  skeletonRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[4], paddingVertical: space[3] },
  skeletonLines: { flex: 1, gap: space[2] },
  empty: { paddingVertical: space[9], gap: space[4], alignItems: 'center' },
  credit: { paddingTop: space[5] },
  bold: { fontWeight: '700' },
  extraBold: { fontWeight: '800' },
  tabular: { fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
});
