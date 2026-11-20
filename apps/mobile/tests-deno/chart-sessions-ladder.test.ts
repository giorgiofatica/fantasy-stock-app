/**
 * The price ladder counts real MARKET SESSIONS (Copilot review of #557, comments 4625246566 / 4625246603 / 4625246635 /
 * 4625246526). Pinned:
 *   - MAX_GAP_DAYS = 5 is right: the longest closure the app reads is five calendar days (Hurricane Sandy, Fri 26 Oct to
 *     Wed 31 Oct 2012), so exactly 5 days apart is NOT a hole and 6 is;
 *   - the look-back (PREV_CLOSE_MAX_SESSIONS = 5) counts the exchange's sessions, not the dates some other stock has a bar on:
 *     AAPL's last bar five sessions back (a holiday in between does not count as one) carries, six does not;
 *   - the season-end close is anchored at the season's last SESSION (not the newest bar anyone has), the same five-session
 *     bound; the player card uses the same decision, so no usable end price means no frozen line.
 * Run: cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { isMarketSession, marketHolidays, sessionOnOrBefore, sessionsBefore } from '../lib/money/marketSessions.ts';
import { dailyValues, MAX_GAP_DAYS, PREV_CLOSE_MAX_SESSIONS, seasonEndClose, seasonEndCloses, type ChartActivityRow } from '../lib/money/portfolioChart.ts';
import { finishedStockSeries } from '../lib/money/stockChartSeries.ts';

const bar = (date: string, close: number) => ({ date, close });
const STAKE = { stakeMode: 'budget_cap' as const, notionalPerSlot: null, numRounds: 2 };
const TODAY = '2026-11-18';

// ── the session calendar ───────────────────────────────────────────────────────────────────────

Deno.test('2026 closures: the published holidays, with Saturday and Sunday ones observed on the nearest weekday', () => {
  assertEquals([...marketHolidays(2026)].sort(), [
    '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  ]);
});

Deno.test('other years: Good Friday follows Easter, Sunday holidays move to Monday, a Saturday New Year is not observed', () => {
  assert(marketHolidays(2025).has('2025-04-18'), 'Good Friday 2025 (Easter 20 Apr)');
  assert(marketHolidays(2027).has('2027-07-05'), '4 July 2027 is a Sunday: observed Monday');
  assert(marketHolidays(2027).has('2027-12-24'), 'Christmas 2027 is a Saturday: observed Friday');
  assert(isMarketSession('2027-12-31'), '1 Jan 2028 is a Saturday: the exchange does NOT close on the Friday before');
  assert(marketHolidays(2023).has('2023-01-02') && isMarketSession('2023-01-03'), '1 Jan 2023 is a Sunday: observed Monday 2 Jan');
  assert(!marketHolidays(2021).has('2021-06-18'), 'Juneteenth is not a closure before 2022');
  assert(marketHolidays(2022).has('2022-06-20'), 'Juneteenth 2022 (Sunday) observed Monday');
});

Deno.test('unscheduled closures: Hurricane Sandy closed Mon 29 and Tue 30 Oct 2012', () => {
  assert(!isMarketSession('2012-10-29') && !isMarketSession('2012-10-30'));
  assertEquals(sessionsBefore('2012-10-31', 2), ['2012-10-26', '2012-10-25']);
});

Deno.test('sessionsBefore skips weekends and holidays: five sessions before Thu 10 Sep 2026 reach Wed 2 Sep (Labor Day is no session)', () => {
  assertEquals(sessionsBefore('2026-09-10', 5), ['2026-09-09', '2026-09-08', '2026-09-04', '2026-09-03', '2026-09-02']);
  assertEquals(sessionOnOrBefore('2026-09-07'), '2026-09-04');
  assertEquals(sessionOnOrBefore('2026-09-05'), '2026-09-04');
  assertEquals(sessionOnOrBefore('2026-09-04'), '2026-09-04');
});

// ── 1. MAX_GAP_DAYS: the boundary ──────────────────────────────────────────────────────────────

const ROWS_JAN: ChartActivityRow[] = [
  { kind: 'draft', action: 'buy', symbol: 'NVDA', quantity: 1, price: 100, occurredAt: '2026-01-05T01:30:00.000Z' },
  { kind: 'draft', action: 'buy', symbol: 'AAPL', quantity: 1, price: 50, occurredAt: '2026-01-05T01:30:00.000Z' },
];

Deno.test('MAX_GAP_DAYS = 5: two real points five days apart are NOT a hole, six days apart are', () => {
  assertEquals(MAX_GAP_DAYS, 5);
  const days = ['2026-01-05', '2026-01-09', '2026-01-14', '2026-01-20']; // 4, 5, 6 days apart
  const bars = { NVDA: days.map((d, i) => bar(d, 101 + i)), AAPL: days.map((d, i) => bar(d, 51 + i)) };
  const d = dailyValues({ rows: ROWS_JAN, bars, stake: STAKE, todayEt: TODAY, endEt: '2026-01-20' });
  assertEquals(d.filter((x) => x.breakBefore).map((x) => x.date), ['2026-01-20'], 'only the six-day stretch breaks');
});

Deno.test('Hurricane Sandy (Fri 26 Oct to Wed 31 Oct 2012, five calendar days) is a real closure, not a hole', () => {
  const rows = ROWS_JAN.map((r) => ({ ...r, occurredAt: '2012-10-24T14:00:00.000Z' }));
  const days = ['2012-10-25', '2012-10-26', '2012-10-31', '2012-11-01'];
  const bars = { NVDA: days.map((d, i) => bar(d, 101 + i)), AAPL: days.map((d, i) => bar(d, 51 + i)) };
  const d = dailyValues({ rows, bars, stake: STAKE, todayEt: '2012-11-05', endEt: '2012-11-01' });
  assertEquals(d.filter((x) => x.breakBefore), [], 'no break across the closure');
  assertEquals(d.map((x) => x.date), ['2012-10-24', '2012-10-25', '2012-10-26', '2012-10-31', '2012-11-01']);
});

// ── 2. the look-back counts market sessions, not the dates in the bar universe ───────────────

// Drafted Sun 30 Aug 2026, 9:30 PM ET: NVDA ×1 at $100, AAPL ×1 at $50 (stake 150).
const ROWS_SEP: ChartActivityRow[] = ROWS_JAN.map((r) => ({ ...r, occurredAt: '2026-08-31T01:30:00.000Z' }));

Deno.test('the stale-carry example: AAPL\'s last bar is six sessions back and NVDA\'s next date is a "session" only to the bar universe: NOT drawn', () => {
  // Universe = {Sep 1, Sep 10}. By universe position Sep 1 is ONE entry back from Sep 10 (the old look-back carried it);
  // by MARKET sessions it is the sixth (9, 8, 4, 3, 2 are the five between), so AAPL has no price on Sep 10.
  const bars = { NVDA: [bar('2026-09-01', 101), bar('2026-09-10', 110)], AAPL: [bar('2026-09-01', 51)] };
  const d = dailyValues({ rows: ROWS_SEP, bars, stake: STAKE, todayEt: TODAY, endEt: '2026-09-10' });
  assertEquals(d.map((x) => x.date), ['2026-08-30', '2026-09-01'], 'Sep 10 is not drawn: a stale AAPL close is not a price');
  assert(!d.some((x) => x.value === 110 + 51), 'and no 110 + 51 sum');
});

Deno.test('five sessions back carries (Labor Day is no session); the sixth does not', () => {
  const five = dailyValues({
    rows: ROWS_SEP, stake: STAKE, todayEt: TODAY, endEt: '2026-09-10',
    bars: { NVDA: [bar('2026-09-02', 101), bar('2026-09-10', 110)], AAPL: [bar('2026-09-02', 52)] },
  });
  assert(five.some((x) => x.date === '2026-09-10' && x.value === 110 + 52), 'Sep 2 is the fifth session before Sep 10 (3, 4, 8, 9 and itself): carried');
  const six = dailyValues({
    rows: ROWS_SEP, stake: STAKE, todayEt: TODAY, endEt: '2026-09-10',
    bars: { NVDA: [bar('2026-09-01', 101), bar('2026-09-10', 110)], AAPL: [bar('2026-09-01', 51)] },
  });
  assert(!six.some((x) => x.date === '2026-09-10'));
  assertEquals(PREV_CLOSE_MAX_SESSIONS, 5);
});

// ── 3. the season-end close is anchored at endEt's session ───────────────────────────────────

Deno.test('every feed stops long before the season\'s end: no season-end close for anyone (the newest bar is not the anchor)', () => {
  const bars = { NVDA: [bar('2026-08-27', 100), bar('2026-08-28', 101)], AAPL: [bar('2026-08-27', 50), bar('2026-08-28', 51)] };
  assertEquals(seasonEndCloses(bars, ['NVDA', 'AAPL'], '2026-09-10'), {}, 'Aug 28 is the sixth session before Sep 10');
  assertEquals(seasonEndCloses(bars, ['NVDA', 'AAPL'], '2026-09-18'), {});
});

Deno.test('the boundary: five sessions back is priced, six is not', () => {
  const stop = (last: string) => ({ NVDA: [bar(last, 101)], AAPL: [bar(last, 51)] });
  assertEquals(seasonEndCloses(stop('2026-09-02'), ['NVDA', 'AAPL'], '2026-09-10'), { NVDA: 101, AAPL: 51 });
  assertEquals(seasonEndCloses(stop('2026-09-01'), ['NVDA', 'AAPL'], '2026-09-10'), {});
});

Deno.test('a weekend end anchors the ladder at the last SESSION: five sessions before Fri 11 Sep reach Thu 3 Sep, not Sep 2', () => {
  // Sat 12 Sep: the last session is Fri 11 Sep; the five before it are 10, 9, 8, 4, 3.
  assertEquals(seasonEndClose([bar('2026-09-03', 7)], '2026-09-12'), 7);
  assertEquals(seasonEndClose([bar('2026-09-02', 7)], '2026-09-12'), null);
  assertEquals(seasonEndClose([bar('2026-09-03', 7)], '2026-09-11'), 7, 'the same on the session itself');
});

Deno.test('a weekend or holiday end reads the last session on or before it; a later bar is never read', () => {
  const bars = { NVDA: [bar('2026-09-04', 101), bar('2026-09-08', 999)] };
  assertEquals(seasonEndClose(bars.NVDA, '2026-09-06'), 101, 'Sunday: Friday\'s close');
  assertEquals(seasonEndClose(bars.NVDA, '2026-09-07'), 101, 'Labor Day: Friday\'s close, and Tuesday\'s bar is after the end');
  assertEquals(seasonEndClose(bars.NVDA, '2026-09-08'), 999);
  assertEquals(seasonEndClose(undefined, '2026-09-08'), null);
  assertEquals(seasonEndClose([{ date: '2026-09-08', close: 0 }], '2026-09-08'), null, 'a zero close is never a price');
});

// ── 4. the player card uses the same bounded decision ────────────────────────────────────────

Deno.test('the card: a stock whose last bar is weeks before the end has no end price and NO frozen line', () => {
  const bars = [bar('2026-09-01', 100), bar('2026-09-02', 101)];
  const s = finishedStockSeries({ bars, endEt: '2026-09-25', seasonStart: '2026-09-01' });
  assertEquals(s.endPrice, null);
  assertEquals(s.points, [], 'not drawn at an old close: the card\'s chart block collapses');
});

Deno.test('the card: within the five-session bound the line and the end price are the stock\'s own', () => {
  const bars = [bar('2026-09-01', 100), bar('2026-09-02', 101), bar('2026-09-04', 103)];
  const s = finishedStockSeries({ bars, endEt: '2026-09-10', seasonStart: '2026-09-01' });
  assertEquals(s.endPrice, 103, 'Sep 4 is four sessions before Sep 10 (Labor Day is none)');
  assertEquals(s.points.length, 3);
  const stale = finishedStockSeries({ bars: [bar('2026-09-01', 100)], endEt: '2026-09-10', seasonStart: '2026-09-01' });
  assertEquals(stale.endPrice, null);
});

Deno.test('the card and the Portfolio read one decision (seasonEndClose), so they cannot disagree on a stock', () => {
  const src = Deno.readTextFileSync(new URL('../lib/money/stockChartSeries.ts', import.meta.url));
  assert(src.includes('const endPrice = seasonEndClose(bars, endEt);'));
  const pc = Deno.readTextFileSync(new URL('../lib/money/portfolioChart.ts', import.meta.url));
  assert(pc.includes('const close = seasonEndClose(bars[up] ?? bars[sym], endEt);'));
  assert(pc.includes('for (const d of sessionsBefore(date, PREV_CLOSE_MAX_SESSIONS)) {'), 'the value line counts market sessions');
});

// ── review 2 of #557: the hero is ONE number, the rows' ───────────────────────────────────────

import { teamPortfolioView } from '../lib/money/teamPortfolioView.ts';
import { portfolioSummary } from '../lib/money/portfolioModel.ts';

Deno.test('finished: a late purchase after the last bar is in the hero as it is in the rows (hero = rows)', () => {
  // Every feed stops Wed 2 Sep; MSFT is bought Wed 9 Sep at $38 (qty 2); the season ends Thu 10 Sep. Sep 2 is the fifth
  // session before Sep 10 (Labor Day is none), so every holding is priced at its Sep 2 close. The value line's last point
  // is Sep 2 and cannot contain the purchase; the hero must.
  const rows: ChartActivityRow[] = [
    { kind: 'draft', action: 'buy', symbol: 'NVDA', quantity: 1, price: 100, occurredAt: '2026-08-31T01:30:00.000Z' },
    { kind: 'draft', action: 'buy', symbol: 'AAPL', quantity: 2, price: 25, occurredAt: '2026-08-31T01:30:00.000Z' },
    { kind: 'trade', action: 'buy', symbol: 'MSFT', quantity: 2, price: 38, occurredAt: '2026-09-09T15:00:00.000Z' },
  ];
  const bars = {
    NVDA: [bar('2026-09-01', 110), bar('2026-09-02', 120)],
    AAPL: [bar('2026-09-01', 30), bar('2026-09-02', 30)],
    MSFT: [bar('2026-09-02', 40)],
  };
  const stake = { ...STAKE, numRounds: 2 };
  const base = {
    drafts: [{ symbol: 'NVDA', entryPrice: 100, quantity: 1 }, { symbol: 'AAPL', entryPrice: 25, quantity: 2 }],
    chartRows: rows, names: {}, stake, bars, endEt: '2026-09-10',
    live: { prices: {}, prevCloses: {} },
  };
  const trades = [{ symbol: 'MSFT', action: 'buy' as const, quantity: 2, price: 38 }];
  const withBuy = teamPortfolioView({ ...base, trades })!;
  const line = dailyValues({ rows, bars, stake, todayEt: TODAY, endEt: '2026-09-10' });
  assertEquals(line[line.length - 1].date, '2026-09-02', 'the line cannot reach the Sep 9 purchase');
  // The one season-end value: every ledger row, priced at the bounded season-end closes.
  const closes = seasonEndCloses(bars, ['NVDA', 'AAPL', 'MSFT'], '2026-09-10');
  assertEquals(closes, { NVDA: 120, AAPL: 30, MSFT: 40 });
  const expected = portfolioSummary({ ...stake, drafts: base.drafts, trades, price: (s) => closes[s.toUpperCase()] ?? null }).value;
  assertEquals(withBuy.value, expected, 'the hero is the season-end value with the late purchase in it');
  assert(withBuy.value !== line[line.length - 1].value, 'not the value line\'s last point, which ends before the purchase');
  assert(withBuy.view.rows.some((r) => r.symbol === 'MSFT'), 'and the rows hold the purchase too');
});

// ── review 2 of #557: a line is a connected segment, not a point count ──────────────────────

Deno.test('a series whose only second point has a break before it draws no chart block (source pin)', () => {
  const src = Deno.readTextFileSync(new URL('../lib/money/portfolioChart.ts', import.meta.url));
  assert(src.includes('const hasSegment = (pts: readonly Breakable[]): boolean => pts.some((p, i) => i > 0 && !p.gapBefore && !p.breakBefore);'));
});
