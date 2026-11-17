/**
 * lib/money/portfolioChart.ts — the Portfolio value line (W4, Game Night; Giorgio,
 * 2026-10-12: "the Portfolio chart with range pills: yes"). Pinned:
 *   - the season starts at the stake (every stock at its draft price);
 *   - each day's value is teamValue at that day's close, so the line's end IS the header;
 *   - a buy or sale moves money between stake/cash and holdings, never the line;
 *   - 1W lives on the Mon…Fri axis, starting at the last close before Monday;
 *   - 1M enters at the value on the window's first day.
 * Run: cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .
 */
import { assertEquals, assertAlmostEquals } from 'jsr:@std/assert';
import { dailyValues, DEFAULT_PORTFOLIO_RANGE, mondayOf, PORTFOLIO_RANGES, portfolioSeries, type ChartActivityRow, type PortfolioRange } from '../lib/money/portfolioChart.ts';
import { standardWeekSessions } from '../lib/time/marketWeek.ts';

const STAKE = { stakeMode: 'budget_cap' as const, notionalPerSlot: null, numRounds: 2 };
// Drafted Mon Aug 31, 8:30 PM ET.
const DRAFT_AT = '2026-09-01T00:30:00.000Z';
const ROWS: ChartActivityRow[] = [
  { kind: 'draft', action: 'buy', symbol: 'NVDA', quantity: 1, price: 100, occurredAt: DRAFT_AT },
  { kind: 'draft', action: 'buy', symbol: 'AAPL', quantity: 1, price: 50, occurredAt: DRAFT_AT },
];
const BARS = {
  NVDA: [{ date: '2026-09-01', close: 110 }, { date: '2026-09-02', close: 120 }, { date: '2026-09-03', close: 90 }],
  AAPL: [{ date: '2026-09-01', close: 55 }, { date: '2026-09-02', close: 50 }, { date: '2026-09-03', close: 60 }],
};

Deno.test('the season starts at the stake, then each close prices the roster', () => {
  const d = dailyValues({ rows: ROWS, bars: BARS, stake: STAKE, todayEt: '2026-09-04' });
  assertEquals(d, [
    { date: '2026-08-31', value: 150 },
    { date: '2026-09-01', value: 165 },
    { date: '2026-09-02', value: 170 },
    { date: '2026-09-03', value: 150 },
  ]);
});

Deno.test('today is never a daily value: the live value is the line\'s last point (the header)', () => {
  const d = dailyValues({ rows: ROWS, bars: BARS, stake: STAKE, todayEt: '2026-09-03' });
  assertEquals(d.map((x) => x.date).includes('2026-09-03'), false);
  const s = portfolioSeries({ range: 'Season', daily: d, liveValue: 151.25, todayEt: '2026-09-03', now: new Date('2026-09-03T17:00:00Z'), sessions: [] });
  assertEquals(s.points[s.points.length - 1], { t: 3, value: 151.25 });
  assertEquals(s.base, 150);
  assertEquals(s.axis, { kind: 'dated', start: '2026-08-31', end: '2026-09-03' });
});

Deno.test('a buy inside the budget does not move the line (money changes form, defect b)', () => {
  // Sep 2: buy one KO at $70 with budget headroom. The day's value is holdings only (no
  // negative cash), and KO is worth what was paid, so the value rises by exactly KO's $70…
  const rows = [...ROWS, { kind: 'trade' as const, action: 'buy' as const, symbol: 'KO', quantity: 1, price: 70, occurredAt: '2026-09-02T15:00:00Z' }];
  const bars = { ...BARS, KO: [{ date: '2026-09-02', close: 70 }, { date: '2026-09-03', close: 71 }] };
  const d = dailyValues({ rows, bars, stake: STAKE, todayEt: '2026-09-04' });
  assertEquals(d.find((x) => x.date === '2026-09-02')!.value, 170 + 70);
  // …and never dips below the roster's own worth, as negative cash would have made it.
  assertEquals(d.find((x) => x.date === '2026-09-03')!.value, 150 + 71);
});

Deno.test('a stock with no bar yet counts at cost, never $0', () => {
  const d = dailyValues({ rows: ROWS, bars: { NVDA: BARS.NVDA }, stake: STAKE, todayEt: '2026-09-04' });
  assertEquals(d.find((x) => x.date === '2026-09-02')!.value, 120 + 50);
});

Deno.test('1W: the past five sessions on the sessions axis (not the calendar week), the live value last', () => {
  // Thu Sep 24, 1:37 PM ET: five sessions = the four closes before today, then the live value.
  const daily = [
    { date: '2026-09-17', value: 1000 }, { date: '2026-09-18', value: 1010 },
    { date: '2026-09-21', value: 1020 }, { date: '2026-09-22', value: 1005 }, { date: '2026-09-23', value: 1030 },
  ];
  const now = new Date('2026-09-24T17:37:00Z');
  const s = portfolioSeries({ range: '1W', daily, liveValue: 1042, todayEt: '2026-09-24', now, sessions: standardWeekSessions('2026-09-24T16:00:00Z') });
  assertEquals(s.axis, { kind: 'sessions', days: ['2026-09-18', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'] });
  assertEquals(s.base, 1010, "the first of the five, not Monday's");
  assertEquals(s.points, [{ t: 0, value: 1010 }, { t: 1, value: 1020 }, { t: 2, value: 1005 }, { t: 3, value: 1030 }, { t: 4, value: 1042 }]);
});

Deno.test('1W on a MONDAY is still five sessions (the Mon…Fri axis is gone): last Tue … Mon', () => {
  const daily = [
    { date: '2026-09-15', value: 990 }, { date: '2026-09-16', value: 1000 }, { date: '2026-09-17', value: 1005 },
    { date: '2026-09-18', value: 1010 },
  ];
  const s = portfolioSeries({ range: '1W', daily, liveValue: 1001, todayEt: '2026-09-21', now: new Date('2026-09-21T21:00:00Z'), sessions: standardWeekSessions('2026-09-21T16:00:00Z') });
  assertEquals(s.points.map((p) => p.value), [990, 1000, 1005, 1010, 1001]);
  assertEquals(s.axis.kind === 'sessions' && s.axis.days.length, 5);
});

Deno.test('1W before today\'s open (a weekend): the window ends on the last close, no live point', () => {
  const daily = [{ date: '2026-09-17', value: 1000 }, { date: '2026-09-18', value: 1010 }];
  const s = portfolioSeries({ range: '1W', daily, liveValue: 1010, todayEt: '2026-09-19', now: new Date('2026-09-19T15:00:00Z'), sessions: [] });
  assertEquals(s.points, [{ t: 0, value: 1000 }, { t: 1, value: 1010 }]);
});

Deno.test('1M / 3M / 6M / YTD: each window starts at its first value on or after the range start (the baseline)', () => {
  const daily = [{ date: '2026-01-02', value: 100 }, { date: '2026-05-18', value: 130 }, { date: '2026-08-18', value: 140 }, { date: '2026-10-14', value: 150 }, { date: '2026-11-02', value: 160 }];
  const now = new Date('2026-11-16T17:00:00Z');
  const at = (range: PortfolioRange) => portfolioSeries({ range, daily, liveValue: 170, todayEt: '2026-11-16', now, sessions: [] });
  assertEquals(at('1M').base, 160, '31 days back is Oct 16: the first value on or after it is Nov 2');
  assertEquals(at('3M').base, 140, '93 days back is Aug 15: Aug 18');
  assertEquals(at('6M').base, 130, '186 days back is May 14: May 18');
  assertEquals(at('YTD').base, 100, 'the first value of the year');
  assertEquals(at('Season').base, 100);
  assertEquals(at('Season').points[0], { t: 0, value: 100 });
  for (const r of ['1M', '3M', '6M', 'YTD', 'Season'] as const) assertEquals(at(r).points[at(r).points.length - 1].value, 170, `${r} ends on the live value`);
});

Deno.test('the Portfolio chart has the six ranges, opening on Season', () => {
  assertEquals([...PORTFOLIO_RANGES], ['1W', '1M', '3M', '6M', 'Season', 'YTD']);
  assertEquals(DEFAULT_PORTFOLIO_RANGE, 'Season');
});

Deno.test('a season drafted today is one point: the live value over the stake\'s base', () => {
  const s = portfolioSeries({ range: 'Season', daily: [{ date: '2026-10-13', value: 150 }], liveValue: 151.4, todayEt: '2026-10-13', now: new Date(), sessions: [] });
  assertEquals(s.points, [{ t: 0, value: 151.4 }]);
  // The base stays the stake, so the one dot is measured from it (no line is drawn for it).
  assertEquals(s.base, 150);
  assertEquals(s.axis, { kind: 'dated', start: '2026-10-13', end: '2026-10-13' });
});

Deno.test('mondayOf: weekdays to their Monday; the weekend belongs to the week just ended', () => {
  assertEquals(mondayOf('2026-09-24'), '2026-09-21');
  assertEquals(mondayOf('2026-09-21'), '2026-09-21');
  assertEquals(mondayOf('2026-09-26'), '2026-09-21');
  assertEquals(mondayOf('2026-09-27'), '2026-09-21');
});

