/**
 * The player card for a stock in a FINISHED season (Giorgio, 2026-11-18, pick A: "this is a previous season.
 * Today's pricing doesn't really matter... The season's over."). Pinned:
 *   - GONE: the Price figure, the Week gain figure, the six range buttons, Sell (and Save: a season that is over
 *     is closed to trading, in the app as on the server);
 *   - SHOWN: the header, "Yours", the gain "since the draft" frozen to the season's last day, the chart from the
 *     draft to that day with no live point, and "How you got it";
 *   - the frozen line reads real closes on or before the season's last day only, so the market moving on after
 *     the season changes nothing;
 *   - a LIVE card is unchanged (every one of those is still there).
 * Run: cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { finishedStockSeries } from '../lib/money/stockChartSeries.ts';
import { holdingRangeGain } from '../lib/game/playerCardModel.ts';
import { rangeGain, rangeGainText } from '../lib/chart/chartRanges.ts';

// Drafted Tue Sep 1 at $100 (2 shares). The season ends Thu Sep 3; the stock keeps trading after it.
const LOTS = [{ date: '2026-09-01', quantity: 2, price: 100 }];
const BARS = [
  { date: '2026-09-01', close: 100 }, { date: '2026-09-02', close: 110 }, { date: '2026-09-03', close: 105 },
  { date: '2026-09-04', close: 150 }, { date: '2026-09-08', close: 300 },
];
const END = '2026-09-03';

Deno.test('the frozen line is Season from the draft to the season\'s last day, with no live point', () => {
  const s = finishedStockSeries({ bars: BARS, endEt: END, seasonStart: '2026-09-01' });
  assertEquals(s.points.map((p) => p.value), [100, 110, 105]);
  assertEquals(s.base, 100);
  assertEquals(s.axis, { kind: 'dated', start: '2026-09-01', end: END });
  assertEquals(s.endPrice, 105);
});

Deno.test('a bar after the season\'s last day is never read (the market moving on changes nothing)', () => {
  const a = finishedStockSeries({ bars: BARS, endEt: END, seasonStart: '2026-09-01' });
  const b = finishedStockSeries({ bars: BARS.filter((x) => x.date <= END), endEt: END, seasonStart: '2026-09-01' });
  const c = finishedStockSeries({ bars: [...BARS, { date: '2026-10-01', close: 9999 }], endEt: END, seasonStart: '2026-09-01' });
  assertEquals(a, b);
  assertEquals(a, c);
});

Deno.test('the end price is the last REAL close on or before the last day (a weekend end reads Friday), or null', () => {
  const sat = finishedStockSeries({ bars: BARS, endEt: '2026-09-05', seasonStart: '2026-09-01' });
  assertEquals(sat.endPrice, 150);
  assertEquals(sat.axis, { kind: 'dated', start: '2026-09-01', end: '2026-09-05' });
  const none = finishedStockSeries({ bars: [{ date: '2026-09-08', close: 5 }], endEt: END, seasonStart: '2026-09-01' });
  assertEquals(none.endPrice, null);
  assertEquals(none.points, []);
});

Deno.test('"since the draft" is the holding\'s P/L to the season-end close, never to today\'s price', () => {
  const s = finishedStockSeries({ bars: BARS, endEt: END, seasonStart: '2026-09-01' });
  const frozen = holdingRangeGain({ lots: LOTS, start: '2026-09-01', base: s.base, price: s.endPrice })!;
  assertEquals(frozen.money, 10); // 2 × (105 − 100)
  const live = holdingRangeGain({ lots: LOTS, start: '2026-09-01', base: s.base, price: 300 })!;
  assert(live.money !== frozen.money, 'the live price would read a different gain');
  assertEquals(rangeGainText('Season', frozen).words, 'since the draft');
  // The line's own per-share move agrees in sign with the holding's P/L.
  assertEquals(rangeGain(s.points, s.base)!.money, 5);
});

// ── the card and the chart, as written ─────────────────────────────────────────────────────

const src = (p: string) => Deno.readTextFileSync(new URL(p, import.meta.url));

Deno.test('finished card: no Price, no Week gain, no Sell/Save; the chart gets the season\'s last day', () => {
  const s = src('../components/sp/gn/PlayerCard.tsx');
  assert(s.includes('const over = seasonEnd != null;'));
  assert(s.includes('const action = over ? null : cardAction(props);'), 'no Sell or Save in a finished season');
  assert(/\{over \? null : \(\s*<View style=\{\[styles\.strip, \{ backgroundColor: colors\.inset \}\]\}>\s*<Figure label="Price"[\s\S]*?<Figure label="Week gain"/.test(s), 'the two figures are one block, gone when over');
  assert(s.includes('endEt={seasonEnd}'), 'the chart is bounded to the season\'s last day');
  // Kept: the header, "Yours", How you got it, the credit.
  assert(s.includes('>Yours</Text>') && s.includes('howTitle(') && s.includes('MONEY_COPY.alpacaCredit'));
});

Deno.test('finished chart: no range buttons, no live dot, the gain measured to the frozen end price', () => {
  const s = src('../components/money/StockChart.tsx');
  assert(s.includes("const range: ChartRange = over ? 'Season' : selectableRange(picked, greyed);"));
  assert(s.includes('{over ? null : <RangePills'), 'no range buttons');
  assert(s.includes('live={over ? false : live}'), 'no breathing dot');
  assert(s.includes('price: gainPrice'), 'the holding\'s gain uses the frozen end price');
  assert(s.includes('const gainPrice = frozen ? frozen.endPrice : price;'));
  assert(s.includes('useStockChartData(symbol, true, over ? { start: seasonStart, end: endEt } : null)'), 'the bars read stops at the last day');
  // The hook: the window reaches the request.
  const h = src('../lib/money/useStockChartData.ts');
  assert(h.includes('...(windowEnd ? { end: windowEnd } : {})'));
});

Deno.test('live card is unchanged: Price, Week gain, six ranges and the action are all still there', () => {
  const card = src('../components/sp/gn/PlayerCard.tsx');
  assert(card.includes('<Figure label="Price" value={formatMoney(price)}'));
  assert(card.includes('<Figure label="Week gain"'));
  assert(card.includes('seasonEnd = null,'), 'absent seasonEnd = a live season');
  const chart = src('../components/money/StockChart.tsx');
  assert(chart.includes('options={CHART_RANGES}'));
  assert(chart.includes('defaultRange = SHEET_DEFAULT_RANGE'));
  // A live league's call sites pass no seasonEnd, or null (a finished-only prop).
  assert(src('../components/money/PortfolioScreen.tsx').includes('seasonEnd={chartEnd}'), 'chartEnd is null for a live league');
});

Deno.test('call sites: Portfolio, a manager\'s team and Matchup all close Sell once the season is over', () => {
  const p = src('../components/money/PortfolioScreen.tsx');
  assert(p.includes('ownership = card.data.held > 0 && !chartEnd'), 'Portfolio: no onSell when finished');
  assert(/const price = chartEnd\s*\? frozenPrice \?\? openingOf\(me, shown, ledgerState\.ledger\.activity\)\?\.price \?\? null\s*: data\.prices\[shown\] \?\? raw\.quote\(shown\);/.test(p), 'Portfolio: the card never reads the live quote when finished');
  const t = src('../components/money/PlayerPortfolioScreen.tsx');
  assert(t.includes('seasonEnd={finished ? endEt : null}'));
  assert(t.includes('const priceOf = (symbol: string) => (finished ? frozenPriceOf(symbol) : data.prices[symbol] ?? raw?.quote(symbol) ?? null);'), 'team: the card and canOpen never read the live quote when finished');
  // The Matchup roster (the tab and the recap's week detail) is components/game/MatchupRoster.tsx.
  const m = src('../components/game/MatchupRoster.tsx');
  assert(m.includes('card.data.held > 0 && !isSeasonOver(activeLeague, new Date(), marketCalendar)'), 'Matchup: no Sell in a finished league');
  for (const f of [p, t, m]) assert(!/season_status ===/.test(f), 'isSeasonOver is the one predicate');
});
