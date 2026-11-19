/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
/**
 * StocksScreen: the Stocks tab, the fifth and last (Giorgio, 2026-11-18; docs/plans/2026-11-18-stocks-tab.md, part 2;
 * board `design/stocks-list-1118`, A + C, modelled on ESPN's Players tab).
 *
 * The top is every tab's (the league pill and the avatar, first in the scrolling page). Under it ONE control row: the
 * search icon, then the chips ("All", then our categories) scrolling sideways. The search icon swaps that row for a
 * field and Cancel, and the list for the existing search's results (with prices; an owned stock says "Owned by {name}").
 *
 * The list is the stocks nobody in the league owns, largest company first, 25 a page as the manager scrolls until the
 * server says no more follow (useStocksList). A row is a round "+" at the left edge (ONE accent look in every state: no
 * amber or Claim look, claims aren't built), the ticker disc, the ticker, "Company · Category", and the price. The "+"
 * and a tap on the row both open the EXISTING stock sheet and its review: a buy never happens in one tap.
 *
 * PRICES are live, for the rows on screen only (useRowPrices), and "–" until one arrives. The stored price is never
 * shown (it can be two trading days old) and the list read does not return it.
 *
 * Edge states (the Design Lead's spec, from existing copy: no new words): before the draft, during it and after the
 * close the "+" is drawn and the sheet says why a buy can't start (draftNotCompleted, marketClosedOpens, ...); a full
 * roster or no free slot is the sheet's own reason; a FINISHED season starts no buy (no "+": showsBuyPlus).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';

import { radius, space } from '@/constants/tokens';
import { Button } from '@/components/sp/Button';
import { Icon } from '@/components/sp/Icon';
import { PressableScale } from '@/components/sp/PressableScale';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { useInputRemountKey } from '@/components/sp/useInputRemountKey';
import { DISC_PT, discTickerScale, VALUE_PT, valueScale } from '@/components/sp/logic/holdingFit';
import { BarsRefresh } from '@/components/shell/BarsRefresh';
import { ShellHeader } from '@/components/shell/ShellHeader';
import { useScrollFold } from '@/components/shell/scrollFold';
import { LoadFailure } from '@/components/money/LoadFailure';
import { useStockSheet } from '@/components/money/MoneyHost';
import { SearchRow, useSearchOwnership } from '@/components/money/StockSearchScreen';
import { Skeleton } from '@/components/Skeleton';
import { keepMoney } from '@/lib/game/keepDots';
import { useLeagueContext } from '@/lib/LeagueContext';
import { fetchCategories } from '@/lib/categoryData';
import { SEAM_ON } from '@/lib/game/devSeam';
import { COPY } from '@/lib/money/moneyCopy';
import { useMoneyStockSearch } from '@/lib/money/useMoneyStockSearch';
import { useCaptureAction } from '@/lib/money/captureScript';
import { isSeasonOver } from '@/lib/weekStatus';
import type { ShapedSearchResult } from '@/lib/symbolSearch';
import { SEAM_STOCK_CATEGORIES } from '@/lib/stocks/seamStocks';
import { useStocksList } from '@/lib/stocks/useStocksList';
import { useRowPrices } from '@/lib/stocks/useRowPrices';
import {
  CHIP_TEXT_MAX_SCALE,
  ROW_TEXT_MAX_SCALE,
  chipsFrom,
  controlReducer,
  isNearEnd,
  listView,
  priceUnderName,
  rowCategoryName,
  rowLabel,
  rowPriceText,
  showsBuyPlus,
  symbolsOnScreen,
  type ChipCategory,
  type ControlRow,
  type ListRow,
} from '@/lib/stocks/stocksList';

/** Search's text follows Dynamic Type to 1.6× (the sheet's ceiling); rows keep their 1.3× (StockSearchScreen's rule). */
const SEARCH_TEXT_MAX_SCALE = 1.6;
/** The search field's text size (pt, before Dynamic Type): the style below and the scale-aware props both read it. */
const SEARCH_INPUT_FONT_SIZE = 17;
const NBSP = ' ';
/** The skeleton's rows while the first page loads (search's existing skeleton had 3; the list asked for 8). */
const SKELETON_ROWS = 8;
/** The "+": a 26pt disc in a 44pt target (the board). */
const PLUS_DISC = 26;

export function StocksScreen() {
  const { colors } = useTheme();
  const { activeLeague, marketCalendar } = useLeagueContext();
  const leagueId = activeLeague?.id ?? null;
  const list = useStocksList(leagueId);
  const [control, setControl] = useState<ControlRow>({ mode: 'chips', query: '' });
  const dispatchControl = useCallback((action: Parameters<typeof controlReducer>[1]) => setControl((c) => controlReducer(c, action)), []);

  // DEV capture only (captureScript): the same handlers a tap runs.
  useCaptureAction('chip', (id) => list.selectCategory(id && id !== 'all' ? id : null));
  useCaptureAction('searchopen', () => dispatchControl({ type: 'open_search' }));
  useCaptureAction('query', (q) => {
    dispatchControl({ type: 'open_search' });
    dispatchControl({ type: 'type', query: q ?? '' });
  });

  const onRefresh = control.mode === 'chips' ? list.refresh : undefined;
  return (
    <View style={[styles.screen, { backgroundColor: colors.moneyBg }]}>
      <BarsRefresh onRefresh={onRefresh} header={<ShellHeader title="Stocks" showAvatar />} fadeColor={colors.moneyBg} contentContainerStyle={styles.content}>
        <StocksBody
          list={list}
          control={control}
          dispatchControl={dispatchControl}
          seasonOver={isSeasonOver(activeLeague, new Date(), marketCalendar)}
        />
      </BarsRefresh>
    </View>
  );
}

function useCategories(): ChipCategory[] | null {
  const [categories, setCategories] = useState<ChipCategory[] | null>(SEAM_ON ? [...SEAM_STOCK_CATEGORIES] : null);
  useEffect(() => {
    if (SEAM_ON) return;
    let live = true;
    void fetchCategories().then((c) => {
      if (live && c.length > 0) setCategories(c);
    });
    return () => {
      live = false;
    };
  }, []);
  return categories;
}

function StocksBody({
  list,
  control,
  dispatchControl,
  seasonOver,
}: {
  list: ReturnType<typeof useStocksList>;
  control: ControlRow;
  dispatchControl: (a: Parameters<typeof controlReducer>[1]) => void;
  seasonOver: boolean;
}) {
  const categories = useCategories();
  const chips = useMemo(() => chipsFrom(categories ?? []), [categories]);
  return (
    <View style={styles.body}>
      {control.mode === 'chips' ? (
        <ChipRow chips={chips} selected={list.state.categoryId} onSelect={list.selectCategory} onSearch={() => dispatchControl({ type: 'open_search' })} />
      ) : (
        <SearchField query={control.query} onChange={(q) => dispatchControl({ type: 'type', query: q })} onCancel={() => dispatchControl({ type: 'cancel' })} />
      )}
      {control.mode === 'chips' ? (
        <AvailableList list={list} categories={categories ?? []} seasonOver={seasonOver} />
      ) : (
        <SearchResults query={control.query} />
      )}
    </View>
  );
}

// ── The control row ──────────────────────────────────────────────────────────────────────────

function ChipRow({ chips, selected, onSelect, onSearch }: { chips: { categoryId: string | null; label: string }[]; selected: string | null; onSelect: (id: string | null) => void; onSearch: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.chipRow}>
      {/* C: search is the first icon in the chip row. It stays put; only the chips scroll. */}
      <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={onSearch} style={[styles.searchIcon, { backgroundColor: colors.sunken }]} testID="stocks-search-icon">
        <Icon name="search" size="body" tone="text" />
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
        {chips.map((c) => (
          <StockChip key={c.categoryId ?? 'all'} label={c.label} on={selected === c.categoryId} onPress={() => onSelect(c.categoryId)} />
        ))}
      </ScrollView>
    </View>
  );
}

/** A chip: the app's selected pairing (accent on accentTint, the verified-contrast one, as sp/Chip), the label capped at 1.3× and on one line. */
function StockChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      haptic={false}
      style={[styles.chip, { backgroundColor: on ? colors.accentTint : colors.sunken }]}
      testID={`stocks-chip-${label}`}
    >
      <Text variant="callout" color={on ? colors.accent : colors.text2} maxFontSizeMultiplier={CHIP_TEXT_MAX_SCALE} numberOfLines={1} style={styles.bold}>{label}</Text>
    </PressableScale>
  );
}

function SearchField({ query, onChange, onCancel }: { query: string; onChange: (q: string) => void; onCancel: () => void }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(true);
  // The field is keyed by the scale while unfocused, frozen while focused, and a remount never re-runs autoFocus
  // (remeasureKey.ts). `focused` above stays the border's: it starts true.
  const searchRemount = useInputRemountKey(true);
  // The scale goes in the props too, or a remounted field can reuse a recycled native view that keeps its old
  // placeholder size (remeasureKey.ts, "The PLACEHOLDER").
  const searchFont = searchRemount.fontProps(SEARCH_INPUT_FONT_SIZE);
  return (
    <View style={styles.searchRow}>
      <View style={[styles.field, { backgroundColor: colors.inset, borderColor: focused ? colors.accent : colors.rim }]}>
        <Icon name="search" size="body" tone="text2" />
        <TextInput
          key={searchRemount.key}
          style={[styles.input, { color: colors.text }, searchFont && { fontSize: searchFont.fontSize }]}
          allowFontScaling={searchFont ? searchFont.allowFontScaling : undefined}
          maxFontSizeMultiplier={SEARCH_TEXT_MAX_SCALE}
          value={query}
          onChangeText={onChange}
          placeholder={COPY.stockSearchPlaceholder}
          placeholderTextColor={colors.text2}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={searchRemount.autoFocus}
          numberOfLines={1}
          onFocus={() => {
            setFocused(true);
            searchRemount.onFocus();
          }}
          onBlur={() => {
            setFocused(false);
            searchRemount.onBlur();
          }}
          accessibilityLabel={COPY.stockSearchPlaceholder}
          testID="stocks-search-field"
        />
      </View>
      <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={8} style={styles.cancel} testID="stocks-search-cancel">
        <Text variant="callout" color={colors.accent} maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} style={styles.semi}>Cancel</Text>
      </Pressable>
    </View>
  );
}

// ── Search: the existing search's results, with prices; an owned stock is marked ──────────

function SearchResults({ query }: { query: string }) {
  const { open } = useStockSheet();
  const { results, loading, error, retry } = useMoneyStockSearch(query, '');
  const ownershipFor = useSearchOwnership();
  const select = (item: ShapedSearchResult) => {
    if (item.selectable) open(item.symbol, { name: item.name, originRef: 'stocks-search' });
  };
  // DEV capture only: pick a result as a tap would.
  useCaptureAction('pick', (sym) => {
    const item = results.find((r) => r.symbol === sym);
    if (item) select(item);
  });
  if (error) return <LoadFailure title={COPY.stockSearchLoadTitle} message={COPY.loadRetryMessage} onRetry={retry} />;
  if (query.length === 0) return null;
  if (loading && results.length === 0) return <ListSkeleton rows={3} plus={false} />;
  if (!loading && results.length === 0) {
    return (
      <View style={styles.empty}>
        <Text variant="headline" maxFontSizeMultiplier={SEARCH_TEXT_MAX_SCALE} style={[styles.center, styles.extraBold]}>{COPY.noStockMatches(query)}</Text>
        <Text variant="callout" maxFontSizeMultiplier={SEARCH_TEXT_MAX_SCALE} tone="secondary" style={styles.center}>{COPY.tryTickerOrName}</Text>
      </View>
    );
  }
  return (
    <View>
      <View style={styles.results}>
        {results.map((item) => {
          const suffix = !item.selectable ? { text: COPY.notInLeagueList, mine: false } : ownershipFor(item.symbol);
          return <SearchRow key={item.symbol} item={item} status={suffix} onPress={() => select(item)} />;
        })}
      </View>
      {/* The Alpaca credit on every price surface (PRODUCT_RULES), under the results. */}
      <Text variant="caption" maxFontSizeMultiplier={SEARCH_TEXT_MAX_SCALE} tone="secondary" style={[styles.center, styles.credit]}>{COPY.alpacaCredit}</Text>
    </View>
  );
}

// ── The list ─────────────────────────────────────────────────────────────────────────────────

function AvailableList({ list, categories, seasonOver }: { list: ReturnType<typeof useStocksList>; categories: ChipCategory[]; seasonOver: boolean }) {
  const { open } = useStockSheet();
  const { state, loadMore, retry } = list;
  const fold = useScrollFold();
  const listRef = useRef<View>(null);
  const footRef = useRef<View>(null);
  const boxes = useRef(new Map<string, { y: number; height: number }>());
  const latest = useRef({ rows: state.rows, loadMore });
  latest.current = { rows: state.rows, loadMore };
  const [onScreen, setOnScreen] = useState<string[]>([]);
  const priceOf = useRowPrices(onScreen);
  const plus = showsBuyPlus(seasonOver);

  // Which rows are on screen, and whether the foot is near: both measured in window coordinates on the page's
  // throttled scroll signal (BarsRefresh's fold), as the standings table measures its row.
  const measure = useCallback(() => {
    const vp = fold?.viewport() ?? null;
    if (!vp) return;
    listRef.current?.measureInWindow((_x, y) => {
      const asBoxes = latest.current.rows.flatMap((r) => {
        const b = boxes.current.get(r.symbol);
        return b ? [{ symbol: r.symbol, y: b.y, height: b.height }] : [];
      });
      const next = symbolsOnScreen(asBoxes, y, vp);
      setOnScreen((prev) => (prev.join(',') === next.join(',') ? prev : next));
    });
    footRef.current?.measureInWindow((_x, y) => {
      if (isNearEnd(y, vp)) latest.current.loadMore();
    });
  }, [fold]);

  const rowsKey = state.rows.length;
  useEffect(() => {
    measure();
    return fold?.subscribe(measure);
  }, [fold, measure, rowsKey, state.status]);

  const view = listView(state, state.rows.length);

  const openSheet = (row: ListRow, ref: string) => open(row.symbol, { name: row.name, originRef: ref });
  // DEV capture only (captureScript): the same handler a tap on a row's "+" runs.
  useCaptureAction('plus', (sym) => {
    const row = latest.current.rows.find((r) => r.symbol === sym);
    if (row) openSheet(row, 'stocks-plus');
  });

  if (view.kind === 'first_failed') return <LoadFailure title={COPY.stockSearchLoadTitle} message={COPY.loadRetryMessage} onRetry={retry} />;
  if (view.kind === 'first_loading') return <ListSkeleton rows={SKELETON_ROWS} plus />;
  if (view.kind === 'empty') {
    // E8: search's own empty state, with the category as the query.
    const name = categories.find((c) => c.id === state.categoryId)?.name ?? '';
    return (
      <View style={styles.empty}>
        <Text variant="headline" maxFontSizeMultiplier={SEARCH_TEXT_MAX_SCALE} style={[styles.center, styles.extraBold]}>{COPY.noStockMatches(name)}</Text>
        <Text variant="callout" maxFontSizeMultiplier={SEARCH_TEXT_MAX_SCALE} tone="secondary" style={styles.center}>{COPY.tryTickerOrName}</Text>
      </View>
    );
  }
  return (
    <View>
      <View ref={listRef} collapsable={false}>
        {state.rows.map((row) => (
          <StockRow
            key={row.symbol}
            row={row}
            category={rowCategoryName(row.categoryIds, categories)}
            priceText={rowPriceText(priceOf(row.symbol))}
            plus={plus}
            onOpen={() => openSheet(row, 'stocks-row')}
            onPlus={() => openSheet(row, 'stocks-plus')}
            onBox={(b) => {
              boxes.current.set(row.symbol, b);
              measure();
            }}
          />
        ))}
      </View>
      <View ref={footRef} collapsable={false}>
        {view.foot === 'loading' ? <ListSkeleton rows={1} plus /> : null}
        {view.foot === 'failed' ? (
          // E7: a later page failed. The loaded rows stay; this retries only that page.
          <View style={styles.footFail} testID="stocks-foot-failed">
            <Text variant="callout" tone="secondary" maxFontSizeMultiplier={SEARCH_TEXT_MAX_SCALE} style={styles.center}>{COPY.loadRetryMessage}</Text>
            <Button label={COPY.tryAgain} variant="ghost" size="sm" onPress={retry} testID="stocks-foot-retry" />
          </View>
        ) : null}
      </View>
      {!state.hasMore && state.status === 'ready' ? (
        // The Alpaca credit on every price surface (PRODUCT_RULES), once the list is whole.
        <Text variant="caption" maxFontSizeMultiplier={SEARCH_TEXT_MAX_SCALE} tone="secondary" style={[styles.center, styles.credit]}>{COPY.alpacaCredit}</Text>
      ) : null}
    </View>
  );
}

/** One stock: the "+" at the left edge, the ticker disc, the ticker, "Company · Category", the price. */
function StockRow({
  row,
  category,
  priceText,
  plus,
  onOpen,
  onPlus,
  onBox,
}: {
  row: ListRow;
  category: string | null;
  priceText: string;
  plus: boolean;
  onOpen: () => void;
  onPlus: () => void;
  onBox: (b: { y: number; height: number }) => void;
}) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  // The row's width, once laid out (null until then: full size, never a guess; no iOS adjustsFontSizeToFit on an unlaid row).
  const [rowWidth, setRowWidth] = useState<number | null>(null);
  const under = priceUnderName(fontScale);
  const sub = category ? `${row.name}${NBSP}· ${category}` : row.name;
  const price = (
    <Text
      testID="stocks-row-price"
      variant="score.sm"
      maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE}
      numberOfLines={1}
      style={[styles.price, !under && { fontSize: VALUE_PT * valueScale(rowWidth, priceText, fontScale) }]}
    >
      {keepMoney(priceText)}
    </Text>
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
      <PressableScale accessibilityRole="button" accessibilityLabel={rowLabel(row, category, priceText)} onPress={onOpen} style={styles.rowMain} testID={`stocks-row-${row.symbol}`}>
        <View style={[styles.disc, { backgroundColor: colors.inset }]}>
          <Text variant="ticker.tile" allowFontScaling={false} numberOfLines={1} style={{ fontSize: DISC_PT * discTickerScale(row.symbol) }}>{row.symbol}</Text>
        </View>
        <View style={styles.lead}>
          <Text variant="ticker" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE}>{row.symbol}</Text>
          {sub ? <Text variant="caption" tone="secondary" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} numberOfLines={2}>{sub}</Text> : null}
          {under ? price : null}
        </View>
        {under ? null : <View style={styles.trail}>{price}</View>}
        {plus ? null : <Icon name="chevronRight" size="callout" tone="text2" />}
      </PressableScale>
    </View>
  );
}

/** E6: search's existing skeleton rows (VoiceOver: "Loading results", busy), plus a 26pt circle for each "+". */
function ListSkeleton({ rows, plus }: { rows: number; plus: boolean }) {
  return (
    <View accessible accessibilityLabel="Loading results" accessibilityState={{ busy: true }} testID="stocks-skeleton">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.skeletonRow}>
          {plus ? (
            <View style={styles.plusTarget}>
              <Skeleton width={PLUS_DISC} height={PLUS_DISC} borderRadius={PLUS_DISC / 2} />
            </View>
          ) : null}
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
  screen: { flex: 1 },
  content: { paddingHorizontal: space[6], paddingTop: space[2], paddingBottom: space[9] },
  body: { gap: space[3] },
  // The control row: the search icon (a fixed 44pt target), then the chips scrolling sideways.
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  searchIcon: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  chipScroll: { flex: 1 },
  chips: { gap: space[3], alignItems: 'center', paddingRight: space[6] },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space[5], borderRadius: radius.pill },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  field: { flex: 1, minWidth: 0, minHeight: 48, borderRadius: radius.lg, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: 14 },
  input: { flex: 1, minHeight: 44, fontSize: SEARCH_INPUT_FONT_SIZE, fontFamily: 'Archivo-Medium' },
  cancel: { minHeight: 44, justifyContent: 'center' },
  results: { gap: space[1] },
  // A row: the "+" target (44pt), then the row's own button (disc, name, price).
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  rowMain: { flex: 1, minWidth: 0, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[4], paddingVertical: space[3] },
  plusTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  plusDisc: { width: PLUS_DISC, height: PLUS_DISC, borderRadius: PLUS_DISC / 2, alignItems: 'center', justifyContent: 'center' },
  disc: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[1] },
  lead: { flex: 1, minWidth: 0, gap: space[1] },
  trail: { flexShrink: 0, maxWidth: '45%', alignItems: 'flex-end' },
  // A money number: 700 (800 is for game numbers, §9C rule 5), tabular.
  price: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  skeletonRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[4], paddingVertical: space[3] },
  skeletonLines: { flex: 1, gap: space[2] },
  empty: { paddingVertical: space[7], gap: space[2], alignItems: 'center' },
  footFail: { paddingVertical: space[5], gap: space[2], alignItems: 'center' },
  credit: { paddingTop: space[5] },
  bold: { fontWeight: '700' },
  semi: { fontWeight: '600' },
  extraBold: { fontWeight: '800' },
  center: { textAlign: 'center' },
});
