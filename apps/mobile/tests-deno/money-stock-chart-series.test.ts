/**
 * Hermetic tests for lib/money/stockChartSeries.ts (3e, M2 live chart).
 * The six ranges, greying and gain are lib/chart/chartRanges.ts (tests-deno/chart-ranges.test.ts);
 * this pins what the stock's series feeds them: 1W = the past five sessions, the windows, no base line.
 * Run with: cd apps/mobile/tests-deno && deno test .
 */
import { assertEquals } from 'jsr:@std/assert';
import { axisRangeLabel, layoutAxis, pointName } from '../components/sp/logic/chartAxis.ts';
import type { MarketCalendarSession } from '../lib/time/marketWeek.ts';
import {
  historyStartOf,
  stockLineSeries as lineSeries,
  stockScrubLabel,
  type DailyBar,
} from '../lib/money/stockChartSeries.ts';

/** The stock series with no season by default (the tests below are about the ranges' windows). */
const stockLineSeries = (input: Omit<Parameters<typeof lineSeries>[0], 'seasonStart'> & { seasonStart?: string | null }) => lineSeries({ seasonStart: null, ...input });

const NOW = new Date('2026-10-05T20:00:00Z');

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

Deno.test('stock 1M / 3M / 6M: dated axes, the window\'s first close as base, the live price last', () => {
  const bars = closes(['2026-08-24', '2026-09-18', '2026-09-21', '2026-09-22', '2026-09-23'], 90);
  const input = { bars, price: 106, todayEt: '2026-09-24', now: new Date('2026-09-24T17:37:00Z'), sessions: [] as MarketCalendarSession[] };
  const m = stockLineSeries({ ...input, range: '1M' });
  assertEquals(m.axis, { kind: 'dated', start: '2026-08-24', end: '2026-09-24' });
  assertEquals(m.base, 90);
  assertEquals(m.points[m.points.length - 1], { t: 31, value: 106 });
  for (const range of ['3M', '6M'] as const) {
    const w = stockLineSeries({ ...input, range });
    assertEquals(w.axis, { kind: 'dated', start: '2026-08-24', end: '2026-09-24' });
    assertEquals(w.points.length, 6);
  }
});

Deno.test('stock Season: since the league\'s draft day, the same window for any stock; nothing without a season', () => {
  const bars = closes(['2026-09-01', '2026-09-10', '2026-09-18', '2026-09-23'], 100);
  const input = { bars, price: 120, todayEt: '2026-09-24', now: new Date('2026-09-24T17:37:00Z'), sessions: [] as MarketCalendarSession[] };
  const s = stockLineSeries({ ...input, range: 'Season', seasonStart: '2026-09-10' });
  assertEquals(s.axis, { kind: 'dated', start: '2026-09-10', end: '2026-09-24' });
  assertEquals(s.base, 101, 'the first close on or after the draft day');
  assertEquals(s.points, [{ t: 0, value: 101 }, { t: 8, value: 102 }, { t: 13, value: 103 }, { t: 14, value: 120 }]);
  assertEquals(stockLineSeries({ ...input, range: 'Season', seasonStart: null }).points, [], 'before the draft / no league: nothing to draw');
});

Deno.test('stock YTD starts at the year\'s first day (its first trading day\'s bar)', () => {
  const bars = closes(['2025-12-30', '2026-01-02', '2026-03-10', '2026-09-23'], 100);
  const y = stockLineSeries({ bars, range: 'YTD', price: 150, todayEt: '2026-09-24', now: new Date('2026-09-24T17:37:00Z'), sessions: [] });
  assertEquals(y.axis, { kind: 'dated', start: '2026-01-02', end: '2026-09-24' });
  assertEquals(y.base, 101, 'Dec 30 is last year\'s: the first bar of the year is the baseline');
});

Deno.test('historyStartOf: the first bar of a stock (null with none)', () => {
  assertEquals(historyStartOf([{ date: '2026-09-23', close: 2 }, { date: '2026-09-01', close: 1 }]), '2026-09-01');
  assertEquals(historyStartOf([]), null);
});

// No dotted/base line on ANY chart (Giorgio, 2026-11-16 stock chart; 2026-11-17 every chart).
import stockChartSource from '../components/money/StockChart.tsx' with { type: 'text' };
import chartSource from '../components/sp/gn/Chart.tsx' with { type: 'text' };

Deno.test('no chart draws a dotted or base line: the Chart has no showBase and no dash; nobody passes it', () => {
  assertEquals(/showBase|strokeDasharray/.test(chartSource), false);
  assertEquals(/showBase/.test(stockChartSource), false);
});

// ── DL conditions on PR #480 (the short windows) ─────────────────────────────────────────
import { buildLine } from '../components/sp/logic/lineChart.ts';

const BOX = { width: 390, height: 140, padLeft: 2, padRight: 12, padTop: 12, padBottom: 9 };

Deno.test('stock 1W with ONE session: the dot and its one label, never a line across', () => {
  const s = stockLineSeries({ range: '1W', bars: closes(['2026-10-02']), price: null, todayEt: '2026-10-03', now: new Date('2026-10-03T17:00:00Z'), sessions: [] });
  assertEquals(dayIsos(s), ['2026-10-02']);
  assertEquals(s.points.length, 1);
  const g = buildLine(s.points, [0, 0], s.base, BOX);
  assertEquals(g.path, ''); // nothing to stroke
  assertEquals(g.length, 0);
  assertEquals(g.end !== null, true); // the dot
  const labels = layoutAxis(s.axis, 366, (t) => g.toX(t), () => 24);
  assertEquals(labels.map((l) => l.text), ['Fri']);
  assertEquals(labels[0].align, 'right'); // under the dot, which sits at the right end
});

Deno.test('stock 1W with ONE session that is today (a first-day listing, live price): still a lone dot', () => {
  const s = stockLineSeries({ range: '1W', bars: [], price: 12, todayEt: '2026-10-05', now: new Date('2026-10-05T17:00:00Z'), sessions: sess('2026-10-05') });
  assertEquals(s.points, [{ t: 0, value: 12 }]);
  assertEquals(buildLine(s.points, [0, 0], s.base, BOX).path, '');
});

Deno.test('stock 1W LOADING (no bars yet): no points and no labels, so the axis row is empty but keeps its own fixed height', () => {
  const s = stockLineSeries({ range: '1W', bars: [], price: null, todayEt: '2026-10-05', now: new Date('2026-10-05T12:00:00Z'), sessions: sess('2026-10-05') });
  assertEquals(s.points, []);
  assertEquals(layoutAxis(s.axis, 366, (t) => t, () => 24), []);
  assertEquals(axisRangeLabel(s.axis), ''); // Chart drops the empty part: no dangling comma in VoiceOver
});

// The labels are absolutely positioned inside a row whose height is set from the font scale alone,
// so labels arriving cannot move anything below the chart (the 1 s-later frame is a sim still).
import chartSource2 from '../components/sp/gn/Chart.tsx' with { type: 'text' };
Deno.test('Chart: the axis row\'s height does not depend on its labels', () => {
  assertEquals(/\{ height: AXIS_LINE_HEIGHT \* fontScale \+ 2 \}/.test(chartSource2), true);
  assertEquals(/label: \{\s*position: 'absolute'/.test(chartSource2), true);
  assertEquals(chartSource2.includes("[accessibilityLabel, range, last ? formatValue(last.value) : ''].filter(Boolean)"), true);
});

Deno.test('StockChart: while the bars load, the axis has no labels (no lone "Mon" under an empty chart)', () => {
  assertEquals(stockChartSource.includes("const LOADING_AXIS: AxisSpec = { kind: 'sessions', days: [] };"), true);
  assertEquals(/axis=\{ready \? series\.axis : LOADING_AXIS\}/.test(stockChartSource), true);
  assertEquals(/points=\{ready \? series\.points : \[\]\}/.test(stockChartSource), true);
  assertEquals(layoutAxis({ kind: 'sessions', days: [] }, 366, (t) => t, () => 24), []);
});
