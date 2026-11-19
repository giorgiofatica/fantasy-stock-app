/**
 * The Stocks tab's list (docs/plans/2026-11-18-stocks-tab.md, part 2): the pure rules in lib/stocks/stocksList.ts.
 * Paging / cursor, the has_more stop, a chip → category id, "–" until a price arrives (never the stored price, never
 * $0.00), E3 no "+", E7 later-page retry, the search swap, and the prices asked for only for rows on screen.
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  ALL_CHIP_LABEL,
  PAGE_SIZE,
  answersFromQuote,
  chipsFrom,
  controlReducer,
  initialListState,
  isFailedRead,
  isNearEnd,
  listReducer,
  listView,
  mergeRows,
  pageArgs,
  parsePage,
  priceUnderName,
  rowCategoryName,
  rowLabel,
  rowPriceText,
  showsBuyPlus,
  symbolsOnScreen,
  type ListRow,
  type ListState,
} from '../lib/stocks/stocksList.ts';

const row = (symbol: string, categoryIds: string[] = []): ListRow => ({ symbol, name: `${symbol} Inc`, categoryIds });
const data = (symbols: string[], hasMore: boolean) => symbols.map((s) => ({ symbol: s, name: `${s} Inc`, category_ids: [], has_more: hasMore }));
const settle = (s: ListState, symbols: string[], hasMore: boolean): ListState => listReducer(s, { type: 'loaded', id: s.pending!.id, page: parsePage(data(symbols, hasMore))! });

// ── the read's shape ──
Deno.test('parsePage: rows, has_more from the page, a bad row is dropped, a non-array is not a page', () => {
  assertEquals(parsePage(data(['MSFT', 'AAPL'], true)), { rows: [row('MSFT'), row('AAPL')], hasMore: true });
  assertEquals(parsePage([{ symbol: ' aapl ', name: ' Apple ', category_ids: ['c1'], has_more: false }]), { rows: [{ symbol: 'AAPL', name: 'Apple', categoryIds: ['c1'] }], hasMore: false });
  assertEquals(parsePage([]), { rows: [], hasMore: false });
  assertEquals(parsePage([{ symbol: '', name: 'x', category_ids: [], has_more: true }, null, { name: 'no symbol' }]), { rows: [], hasMore: false });
  assertEquals(parsePage(null), null);
  assertEquals(parsePage({ error: 'x' }), null);
});

Deno.test('a read that errors, or answers something that is not a page, is a failed read (never "no stocks")', () => {
  assertEquals(isFailedRead({ data: null, error: { code: 'PT429' } }), true);
  assertEquals(isFailedRead({ data: null, error: { code: '42501' } }), true);
  assertEquals(isFailedRead({ data: null, error: null }), true);
  assertEquals(isFailedRead({ data: [], error: null }), false);
});

Deno.test('pageArgs: the cursor is the last ticker, the category id is passed, the limit is the server cap (25)', () => {
  assertEquals(PAGE_SIZE, 25);
  assertEquals(pageArgs('L1', null, null), { p_league_id: 'L1', p_category_id: null, p_after_symbol: null, p_limit: 25 });
  assertEquals(pageArgs('L1', 'cat-tech', 'AVGO'), { p_league_id: 'L1', p_category_id: 'cat-tech', p_after_symbol: 'AVGO', p_limit: 25 });
});

// ── paging ──
Deno.test('paging: the first page, then the next page asks AFTER the last ticker, and rows append', () => {
  let s = initialListState();
  assertEquals(s.pending, { id: 1, after: null, replace: true });
  s = settle(s, ['A', 'B'], true);
  assertEquals(s.cursor, 'B');
  s = listReducer(s, { type: 'more' });
  assertEquals(s.pending?.after, 'B');
  s = settle(s, ['C', 'D'], true);
  assertEquals(s.rows.map((r) => r.symbol), ['A', 'B', 'C', 'D']);
  assertEquals(s.cursor, 'D');
});

Deno.test('has_more false stops the paging: "more" asks for nothing', () => {
  let s = settle(initialListState(), ['A', 'B'], false);
  const before = s;
  s = listReducer(s, { type: 'more' });
  assertEquals(s, before);
  assertEquals(s.hasMore, false);
});

Deno.test('"more" asks for nothing while a request is in flight or before the first page lands', () => {
  const s = initialListState();
  assertEquals(listReducer(s, { type: 'more' }), s);
  const ready = settle(s, ['A'], true);
  const asked = listReducer(ready, { type: 'more' });
  assertEquals(listReducer(asked, { type: 'more' }), asked);
});

Deno.test('a ticker repeated across pages (the order shifted) is dropped, not drawn twice', () => {
  assertEquals(mergeRows([row('A'), row('B')], [row('B'), row('C')]).map((r) => r.symbol), ['A', 'B', 'C']);
});

Deno.test('a chip starts a NEW list; an answer still in flight for the old category is dropped', () => {
  let s = initialListState();
  s = settle(s, ['A', 'B'], true);
  s = listReducer(s, { type: 'more' }); // in flight for "All"
  const old = s.pending!.id;
  s = listReducer(s, { type: 'start', categoryId: 'cat-health' });
  assertEquals(s.categoryId, 'cat-health');
  assertEquals(s.rows, []);
  assertEquals(s.pending?.after, null);
  const late = listReducer(s, { type: 'loaded', id: old, page: parsePage(data(['Z'], true))! });
  assertEquals(late, s, 'the stale answer changes nothing');
  assertEquals(listReducer(s, { type: 'failed', id: old }), s);
});

Deno.test('refresh asks for the first page again and keeps the rows until it lands, then replaces them', () => {
  let s = settle(initialListState(), ['A', 'B'], true);
  s = listReducer(s, { type: 'refresh' });
  assertEquals(s.rows.length, 2);
  assertEquals(s.pending, { id: s.seq, after: null, replace: true });
  s = settle(s, ['X'], false);
  assertEquals(s.rows.map((r) => r.symbol), ['X']);
});

// ── the chips ──
Deno.test('chips: "All" first and selected by default, then our categories in order, Misc left out', () => {
  const chips = chipsFrom([
    { id: 'c1', name: 'Technology', is_misc: false },
    { id: 'c2', name: 'Financials', is_misc: false },
    { id: 'cm', name: 'Misc', is_misc: true },
  ]);
  assertEquals(chips, [{ categoryId: null, label: 'All' }, { categoryId: 'c1', label: 'Technology' }, { categoryId: 'c2', label: 'Financials' }]);
  assertEquals(ALL_CHIP_LABEL, 'All');
  assertEquals(initialListState().categoryId, null);
});

Deno.test('a chip narrows by category: its id goes to the read as p_category_id; "All" passes null', () => {
  const s = listReducer(initialListState(), { type: 'start', categoryId: 'c2' });
  assertEquals(pageArgs('L1', s.categoryId, s.pending!.after).p_category_id, 'c2');
  assertEquals(pageArgs('L1', listReducer(s, { type: 'start', categoryId: null }).categoryId, null).p_category_id, null);
});

Deno.test('a row names its first category; an unclassified stock names Misc', () => {
  const cats = [{ id: 'c1', name: 'Technology', is_misc: false }, { id: 'cm', name: 'Misc', is_misc: true }];
  assertEquals(rowCategoryName(['c1'], cats), 'Technology');
  assertEquals(rowCategoryName([], cats), 'Misc');
  assertEquals(rowCategoryName(['unknown'], cats), null);
});

// ── prices ──
Deno.test('a row price is "–" until a live price arrives: loading, absent, null and unusable are all "–", never $0.00', () => {
  assertEquals(rowPriceText(undefined), '–');
  assertEquals(rowPriceText({ status: 'loading' }), '–');
  assertEquals(rowPriceText({ status: 'ready', price: null }), '–');
  assertEquals(rowPriceText({ status: 'ready', price: 0 }), '–');
  assertEquals(rowPriceText({ status: 'ready', price: 0.004 }), '–');
  assertEquals(rowPriceText({ status: 'ready', price: 512.3 }), '$512.30');
  assert(!rowPriceText(undefined).includes('$0'));
});

Deno.test('the list rows carry NO price field: the stored price can never reach a row', () => {
  const page = parsePage([{ symbol: 'MSFT', name: 'Microsoft', category_ids: [], has_more: false, last_price: 1, price: 2 }])!;
  assertEquals(Object.keys(page.rows[0]).sort(), ['categoryIds', 'name', 'symbol']);
});

Deno.test('answersFromQuote: a usable number is an answer; zero, a missing symbol, or a broken body is a failed read', () => {
  const a = answersFromQuote({ prices: { MSFT: 512.3, AAPL: 0, brk: 3 } }, ['MSFT', 'AAPL', 'GOOGL']);
  assertEquals(a.MSFT, { ok: true, price: 512.3 });
  assertEquals(a.AAPL, { ok: false });
  assertEquals(a.GOOGL, { ok: false });
  assertEquals(answersFromQuote(null, ['MSFT']).MSFT, { ok: false });
  assertEquals(answersFromQuote({ prices: [1] }, ['MSFT']).MSFT, { ok: false });
});

Deno.test('rowLabel: the price is said in words when missing, never a spoken dash', () => {
  assertEquals(rowLabel(row('MSFT'), 'Technology', '–'), 'MSFT, MSFT Inc, Technology, price unavailable');
  assertEquals(rowLabel(row('MSFT'), null, '$512.30'), 'MSFT, MSFT Inc, $512.30');
});

// ── only the rows on screen ──
Deno.test('symbolsOnScreen: only rows inside the viewport; nothing until the list is placed', () => {
  const boxes = Array.from({ length: 10 }, (_, i) => ({ symbol: `S${i}`, y: i * 60, height: 60 }));
  assertEquals(symbolsOnScreen(boxes, 100, { top: 0, bottom: 300 }), ['S0', 'S1', 'S2', 'S3']);
  assertEquals(symbolsOnScreen(boxes, 100, { top: 400, bottom: 700 }), ['S5', 'S6', 'S7', 'S8', 'S9']);
  assertEquals(symbolsOnScreen(boxes, null, { top: 0, bottom: 300 }), []);
  assertEquals(symbolsOnScreen(boxes, 100, null), []);
  assertEquals(symbolsOnScreen([{ symbol: 'X', y: 0, height: 0 }], 0, { top: 0, bottom: 500 }), [], 'an unmeasured row is not asked for');
});

Deno.test('isNearEnd: the next page is asked for when the foot is near the viewport bottom, not before', () => {
  assertEquals(isNearEnd(3000, { top: 0, bottom: 800 }), false);
  assertEquals(isNearEnd(1200, { top: 0, bottom: 800 }), true);
  assertEquals(isNearEnd(null, { top: 0, bottom: 800 }), false);
});

// ── E3: a finished season ──
Deno.test('E3: a finished season shows no "+"; a live one does (before the draft, mid-draft, after the close too)', () => {
  assertEquals(showsBuyPlus(true), false);
  assertEquals(showsBuyPlus(false), true);
});

// ── E6 / E7 / E8: what the list area draws ──
Deno.test('E6: the first page loading is the skeleton; the next page is ONE skeleton row at the foot', () => {
  assertEquals(listView(initialListState(), 0), { kind: 'first_loading' });
  const ready = settle(initialListState(), ['A', 'B'], true);
  assertEquals(listView(ready, 2), { kind: 'rows', foot: 'none' });
  assertEquals(listView(listReducer(ready, { type: 'more' }), 2), { kind: 'rows', foot: 'loading' });
  // A pull to refresh keeps its rows with no foot (the bars are the progress).
  assertEquals(listView(listReducer(ready, { type: 'refresh' }), 2), { kind: 'rows', foot: 'none' });
});

Deno.test('E7: a failed first page is the full failure; a failed later page keeps the rows and retries ONLY that page', () => {
  let s = initialListState();
  s = listReducer(s, { type: 'failed', id: s.pending!.id });
  assertEquals(listView(s, 0), { kind: 'first_failed' });
  s = listReducer(s, { type: 'retry' });
  assertEquals(s.pending?.after, null);
  s = settle(s, ['A', 'B'], true);

  s = listReducer(s, { type: 'more' });
  const failedAfter = s.pending!.after;
  s = listReducer(s, { type: 'failed', id: s.pending!.id });
  assertEquals(s.rows.length, 2, 'the loaded rows stay');
  assertEquals(listView(s, 2), { kind: 'rows', foot: 'failed' });
  s = listReducer(s, { type: 'retry' });
  assertEquals(s.pending?.after, failedAfter, 'the retry asks for exactly that page');
  assertEquals(s.pending?.replace, false);
  s = settle(s, ['C'], false);
  assertEquals(s.rows.map((r) => r.symbol), ['A', 'B', 'C']);
});

Deno.test('E7: retry with nothing failed does nothing', () => {
  const s = settle(initialListState(), ['A'], true);
  assertEquals(listReducer(s, { type: 'retry' }), s);
});

Deno.test('E8: an empty list with nothing more is the empty state; an empty page WITH more is still loading', () => {
  assertEquals(listView(settle(initialListState(), [], false), 0), { kind: 'empty' });
  const emptyButMore = { ...settle(initialListState(), ['A'], true), rows: [] as ListRow[] };
  assertEquals(listView(emptyButMore, 0), { kind: 'first_loading' });
});

// ── E9: AX5 ──
Deno.test('E9: at font scale 1.35 and up the price moves under the name; below it stays on the right', () => {
  assertEquals(priceUnderName(1.34), false);
  assertEquals(priceUnderName(1.35), true);
  assertEquals(priceUnderName(3.1), true);
});

// ── the search swap (C) ──
Deno.test('C: the search icon swaps the chips for a field; Cancel puts the chips back and forgets the query', () => {
  let c = { mode: 'chips' as const, query: '' } as ReturnType<typeof controlReducer>;
  assertEquals(controlReducer(c, { type: 'type', query: 'x' }), c, 'typing without the field open does nothing');
  c = controlReducer(c, { type: 'open_search' });
  assertEquals(c.mode, 'search');
  c = controlReducer(c, { type: 'type', query: 'jp' });
  assertEquals(c, { mode: 'search', query: 'jp' });
  assertEquals(controlReducer(c, { type: 'cancel' }), { mode: 'chips', query: '' });
});

// ── the capture fixture (DEV seam) answers like the server ──
import { parseStocksKnob, resetSeamStocks, seamStocksRead, SEAM_STOCK_COUNT } from '../lib/stocks/seamStocks.ts';

Deno.test('seam fixture: pages of 25 by cursor with has_more, a category filter, and the failure knobs', () => {
  const none = parseStocksKnob(null);
  const p1 = parsePage(seamStocksRead(pageArgs('L', null, null), none)!.data)!;
  assertEquals(p1.rows.length, 25);
  assertEquals(p1.hasMore, SEAM_STOCK_COUNT > 25);
  const p2 = parsePage(seamStocksRead(pageArgs('L', null, p1.rows[24].symbol), none)!.data)!;
  assertEquals(p2.rows.length, Math.min(25, SEAM_STOCK_COUNT - 25));
  assert(!p2.rows.some((r) => p1.rows.some((q) => q.symbol === r.symbol)), 'no repeats across pages');
  const tech = parsePage(seamStocksRead(pageArgs('L', 'cat-tech', null), none)!.data)!;
  assert(tech.rows.length > 0 && tech.rows.every((r) => r.categoryIds[0] === 'cat-tech'));
  assertEquals(seamStocksRead(pageArgs('L', null, null), parseStocksKnob('loading')), null);
  assert(seamStocksRead(pageArgs('L', null, null), parseStocksKnob('fail'))!.error);
  resetSeamStocks();
  const k = parseStocksKnob('page2_fail');
  assertEquals(seamStocksRead(pageArgs('L', null, null), k)!.error, null);
  assert(seamStocksRead(pageArgs('L', null, 'MSFT'), k)!.error, 'the second page fails once');
  assertEquals(seamStocksRead(pageArgs('L', null, 'MSFT'), k)!.error, null, 'then answers');
  assertEquals(seamStocksRead(pageArgs('L', null, null), parseStocksKnob('empty'))!.data, []);
  const sm = parsePage(seamStocksRead(pageArgs('L', null, null), parseStocksKnob('small'))!.data)!;
  assertEquals([sm.rows.length, sm.hasMore], [6, true], 'small: pages of 6');
  const pl = parseStocksKnob('page2_loading');
  assertEquals(seamStocksRead(pageArgs('L', null, null), pl)!.error, null);
  assertEquals(seamStocksRead(pageArgs('L', null, 'MSFT'), pl), null, 'the second page never answers');
});
