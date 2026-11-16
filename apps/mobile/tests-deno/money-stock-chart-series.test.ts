/**
 * Hermetic tests for lib/money/stockChartSeries.ts (3e, M2 live chart).
 * Giorgio's chart-ranges ruling (A): 1W/1M/3M/1Y, 1W default, NO 1D.
 * Run with: cd apps/mobile/tests-deno && deno test .
 */
import { assertEquals } from 'jsr:@std/assert';
import { axisRangeLabel, layoutAxis, pointName } from '../components/sp/logic/chartAxis.ts';
import type { MarketCalendarSession } from '../lib/time/marketWeek.ts';
import {
  barsForRange,
  CHART_RANGES,
  DEFAULT_CHART_RANGE,
  deltaSeries,
  rangeLookbackDays,
  SESSIONS_1W,
  stockLineSeries,
  stockScrubLabel,
  type DailyBar,
} from '../lib/money/stockChartSeries.ts';

Deno.test("Giorgio's ruling (A): the ranges are 1W/1M/3M/1Y in that order, default 1W, no 1D", () => {
  assertEquals(CHART_RANGES, ['1W', '1M', '3M', '1Y']);
  assertEquals(DEFAULT_CHART_RANGE, '1W');
  assertEquals(CHART_RANGES.includes('1D' as never), false);
});

Deno.test('rangeLookbackDays: a calendar-day window for 1M/3M/1Y (1W counts sessions, not days)', () => {
  assertEquals(SESSIONS_1W, 5);
  assertEquals(rangeLookbackDays('1M'), 31);
  assertEquals(rangeLookbackDays('3M'), 93);
  assertEquals(rangeLookbackDays('1Y'), 366);
});

const BARS: DailyBar[] = [
  { date: '2026-09-01', close: 100 },
  { date: '2026-09-20', close: 110 },
  { date: '2026-10-01', close: 120 },
  { date: '2026-10-05', close: 130 },
];
const NOW = new Date('2026-10-05T20:00:00Z');

Deno.test('barsForRange: 1W is the last five bars (sessions), not a calendar window, oldest first', () => {
  // Only four bars exist (a month of gaps): 1W takes all of them, however old.
  const r = barsForRange(BARS, '1W', NOW);
  assertEquals(r.map((b) => b.date), ['2026-09-01', '2026-09-20', '2026-10-01', '2026-10-05']);
  const six: DailyBar[] = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-05'].map((date, i) => ({ date, close: 100 + i }));
  assertEquals(barsForRange(six, '1W', NOW).map((b) => b.date), ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-05']);
});

Deno.test('barsForRange: 1M keeps the whole month window', () => {
  const r = barsForRange(BARS, '1M', NOW);
  assertEquals(r.map((b) => b.date), ['2026-09-20', '2026-10-01', '2026-10-05']);
});

Deno.test('barsForRange: never invents a bar for a day with no row (real bars only)', () => {
  const r = barsForRange(BARS, '1Y', NOW);
  assertEquals(r.length, BARS.length);
  for (const b of r) assertEquals(BARS.some((raw) => raw.date === b.date && raw.close === b.close), true);
});

Deno.test('barsForRange: 1M excludes a bar one day outside its window', () => {
  const bars: DailyBar[] = [{ date: '2026-09-03', close: 90 }, { date: '2026-09-04', close: 91 }];
  // NOW - 31 days = 2026-09-04T20:00Z -> cutoff date string 2026-09-04.
  assertEquals(barsForRange(bars, '1M', NOW).map((b) => b.date), ['2026-09-04']);
});

Deno.test('deltaSeries: each close relative to the baseline (previous close)', () => {
  assertEquals(deltaSeries(BARS, 115), [-15, -5, 5, 15]);
});

Deno.test('deltaSeries: an empty series stays empty', () => {
  assertEquals(deltaSeries([], 100), []);
});

Deno.test('stockScrubLabel: date, price, and the change vs the range baseline, signed', () => {
  const label = stockScrubLabel({ date: '2026-10-01', close: 306.68 }, 301.85, false, NOW);
  assertEquals(label.primary, 'Thu, Oct 1');
  assertEquals(label.price, '$306.68');
  assertEquals(label.money, '+$4.83');
  assertEquals(label.percent, '+1.60%');
  assertEquals(label.gain, true);
});

Deno.test('stockScrubLabel: a loss is signed negative and gain is false', () => {
  const label = stockScrubLabel({ date: '2026-10-01', close: 95 }, 100, false, NOW);
  assertEquals(label.money.startsWith('−'), true); // the shared formatter's minus sign
  assertEquals(label.percent, '−5.00%');
  assertEquals(label.gain, false);
});

Deno.test('stockScrubLabel: the latest point in the range reads "Today", not its date', () => {
  const label = stockScrubLabel({ date: '2026-10-05', close: 130 }, 120, true, NOW);
  assertEquals(label.primary, 'Today');
});

Deno.test('stockScrubLabel: no year for a bar from the current year', () => {
  assertEquals(stockScrubLabel({ date: '2026-10-01', close: 1 }, 1, false, NOW).primary, 'Thu, Oct 1');
});

Deno.test('stockScrubLabel: a year shown, no weekday, for a bar from a different year', () => {
  assertEquals(stockScrubLabel({ date: '2025-10-01', close: 1 }, 1, false, NOW).primary, 'Oct 1, 2025');
});

Deno.test('stockScrubLabel: an unparsable date falls back to the raw string', () => {
  assertEquals(stockScrubLabel({ date: 'not-a-date', close: 10 }, 10, false, NOW).primary, 'not-a-date');
});

// Fixture seam (lib/money/stressFixture.ts stressChartBars): 3e's chart data,
// offline. Deterministic and weekend-free, same shape as a real bars response.
Deno.test('stressChartBars: 400 weekday-only bars, oldest first, ending before now', async () => {
  const { stressChartBars } = await import('../lib/money/stressFixture.ts');
  const now = new Date('2026-10-05T20:00:00Z'); // a Monday
  const bars = stressChartBars('S010', now);
  assertEquals(bars.length, 400);
  for (const b of bars) {
    const day = new Date(`${b.date}T00:00:00Z`).getUTCDay();
    assertEquals(day === 0 || day === 6, false, `weekend date ${b.date}`);
  }
  for (let i = 1; i < bars.length; i++) assertEquals(bars[i - 1].date < bars[i].date, true);
  assertEquals(bars[bars.length - 1].date < '2026-10-05', true);
});

Deno.test('stressChartBars: deterministic for the same symbol and now', async () => {
  const { stressChartBars } = await import('../lib/money/stressFixture.ts');
  const now = new Date('2026-10-05T20:00:00Z');
  assertEquals(stressChartBars('S010', now), stressChartBars('S010', now));
});

Deno.test('stressChartBars: an unknown symbol gets no bars, never guessed ones', async () => {
  const { stressChartBars } = await import('../lib/money/stressFixture.ts');
  assertEquals(stressChartBars('ZZZZ', new Date()), []);
});

// ── stockLineSeries: 1W is the past five trading sessions (Giorgio, 2026-11-16) ──────────
// A normal Mon–Fri session (09:30–16:00 ET) for each ISO date given.
const sess = (...dates: string[]): MarketCalendarSession[] => dates.map((sessionDate) => ({ sessionDate, openEt: '09:30:00', closeEt: '16:00:00' }));
const closes = (dates: string[], from = 100): DailyBar[] => dates.map((date, i) => ({ date, close: from + i }));
const dayIsos = (s: ReturnType<typeof stockLineSeries>) => (s.axis.kind === 'sessions' ? [...s.axis.days] : null);

// Fri Sep 25 .. Thu Oct 1 2026 bars (a Mon Oct 5 has no bar yet).
const WEEK_BARS = closes(['2026-09-24', '2026-09-25', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);

Deno.test('stock 1W on a MONDAY after the open: last four closes + the live price, five sessions, not one stroke', () => {
  const s = stockLineSeries({ range: '1W', bars: WEEK_BARS, price: 140, todayEt: '2026-10-05', now: new Date('2026-10-05T17:00:00Z'), sessions: sess('2026-10-05', '2026-10-06') });
  assertEquals(dayIsos(s), ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-05']);
  assertEquals(s.points, [{ t: 0, value: 103 }, { t: 1, value: 104 }, { t: 2, value: 105 }, { t: 3, value: 106 }, { t: 4, value: 140 }]);
  assertEquals(s.base, 103);
});

Deno.test('stock 1W on a Monday BEFORE the open: the five latest closes, today not yet a point', () => {
  const s = stockLineSeries({ range: '1W', bars: WEEK_BARS, price: 106, todayEt: '2026-10-05', now: new Date('2026-10-05T12:00:00Z'), sessions: sess('2026-10-05') });
  assertEquals(dayIsos(s), ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
  assertEquals(s.points.length, 5);
  assertEquals(s.points[4].value, 106);
});

Deno.test('stock 1W mid-week (Wed, open): four prior closes + live; the axis names the weekdays', () => {
  const s = stockLineSeries({ range: '1W', bars: WEEK_BARS.filter((b) => b.date <= '2026-09-29'), price: 120, todayEt: '2026-09-30', now: new Date('2026-09-30T15:00:00Z'), sessions: sess('2026-09-28', '2026-09-29', '2026-09-30') });
  assertEquals(dayIsos(s), ['2026-09-24', '2026-09-25', '2026-09-28', '2026-09-29', '2026-09-30']);
  assertEquals(s.points.map((p) => p.value), [100, 101, 102, 103, 120]);
  assertEquals([0, 1, 2, 3, 4].map((t) => pointName(s.axis, t)), ['Thu', 'Fri', 'Mon', 'Tue', 'Wed']);
  assertEquals(axisRangeLabel(s.axis, 4), 'from Thu to Wed');
});

Deno.test('stock 1W on a WEEKEND: the window ends on Friday\'s close, no phantom Saturday point', () => {
  const s = stockLineSeries({ range: '1W', bars: WEEK_BARS, price: 106, todayEt: '2026-10-03', now: new Date('2026-10-03T17:00:00Z'), sessions: sess('2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02') });
  assertEquals(dayIsos(s), ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
  assertEquals(s.points[4], { t: 4, value: 106 });
});

Deno.test('stock 1W in a week with a market HOLIDAY: sessions are counted, the holiday takes no slot', () => {
  // Thu Nov 26 2026 (Thanksgiving) has no bar and no session; Fri Nov 27 is open.
  const bars = closes(['2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27']);
  const s = stockLineSeries({ range: '1W', bars, price: null, todayEt: '2026-11-28', now: new Date('2026-11-28T15:00:00Z'), sessions: sess('2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27') });
  assertEquals(dayIsos(s), ['2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27']);
  assertEquals(s.points.map((p) => p.t), [0, 1, 2, 3, 4]); // even spacing: no empty Thursday
  // Fri Nov 20 and Fri Nov 27 are both in the window, so "Fri" would be ambiguous: dates instead.
  assertEquals([0, 1, 2, 3, 4].map((t) => pointName(s.axis, t)), ['Nov 20', 'Nov 23', 'Nov 24', 'Nov 25', 'Nov 27']);
});

Deno.test('stock 1W with fewer than five bars (a new listing): draws what exists, never pads', () => {
  const s = stockLineSeries({ range: '1W', bars: closes(['2026-10-01', '2026-10-02']), price: null, todayEt: '2026-10-03', now: new Date('2026-10-03T17:00:00Z'), sessions: [] });
  assertEquals(dayIsos(s), ['2026-10-01', '2026-10-02']);
  assertEquals(s.points.length, 2);
  const none = stockLineSeries({ range: '1W', bars: [], price: null, todayEt: '2026-10-03', now: new Date('2026-10-03T17:00:00Z'), sessions: [] });
  assertEquals(none.points, []);
  assertEquals(layoutAxis(none.axis, 300, (t) => t * 10), []);
});

Deno.test('stock 1W axis: labels are the session weekdays, first left and last right of the plot', () => {
  const s = stockLineSeries({ range: '1W', bars: WEEK_BARS, price: 140, todayEt: '2026-10-05', now: new Date('2026-10-05T17:00:00Z'), sessions: sess('2026-10-05') });
  const labels = layoutAxis(s.axis, 300, (t) => (t / 4) * 300);
  assertEquals(labels.map((l) => l.text), ['Tue', 'Wed', 'Thu', 'Fri', 'Mon']);
  assertEquals(labels[0].left, 0);
  assertEquals(labels[4].left + labels[4].width, 300);
});

Deno.test('stock 1W: nothing is drawn for a reference line any more (no referenceLine export)', async () => {
  const mod = await import('../lib/money/stockChartSeries.ts');
  assertEquals('referenceLine' in mod, false);
});

Deno.test('stock 1M / 3M / 1Y are unchanged: dated axes, the window\'s first close as base, the live price last', () => {
  const bars = closes(['2026-08-24', '2026-09-18', '2026-09-21', '2026-09-22', '2026-09-23'], 90);
  const input = { bars, price: 106, todayEt: '2026-09-24', now: new Date('2026-09-24T17:37:00Z'), sessions: [] as MarketCalendarSession[] };
  const m = stockLineSeries({ ...input, range: '1M' });
  assertEquals(m.axis, { kind: 'dated', start: '2026-08-24', end: '2026-09-24', months: false });
  assertEquals(m.base, 90);
  assertEquals(m.points[m.points.length - 1], { t: 31, value: 106 });
  const q = stockLineSeries({ ...input, range: '3M' });
  assertEquals(q.axis, { kind: 'dated', start: '2026-08-24', end: '2026-09-24', months: false });
  const y = stockLineSeries({ ...input, range: '1Y' });
  assertEquals(y.axis.kind === 'dated' && y.axis.months, true);
  assertEquals(y.points.length, 6);
});

// The dashed base is gone from the stock chart (Giorgio, 2026-11-16) but stays on Home/Portfolio's
// charts: StockChart opts out, and Chart keeps it on by default.
import stockChartSource from '../components/money/StockChart.tsx' with { type: 'text' };
import chartSource from '../components/sp/gn/Chart.tsx' with { type: 'text' };

Deno.test('the stock chart turns the dashed base off; the shared Chart still draws it by default', () => {
  assertEquals(/<Chart[\s\S]*?showBase=\{false\}/.test(stockChartSource), true);
  assertEquals(chartSource.includes('showBase = true'), true);
  assertEquals(/\{showBase \? <Line/.test(chartSource), true);
});
