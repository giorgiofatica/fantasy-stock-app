/**
 * The team's value line never draws an invented stretch (the Planner's ruling under Giorgio's "never
 * incorrect, never old, never missing", 2026-11-18). Pinned:
 *   (i)   a date is drawn only when EVERY stock held on it has a real close ON that date: no carried-forward
 *         close, no stock valued at cost, no partial sum; the line starts at the first such date;
 *   (ii)  the axis starts at that date, not the draft day (nothing labelled for the missing stretch);
 *   (iii) "since the draft" is last value minus the stake at cost, unchanged when the line starts late;
 *   (iv)  with no such date there is no line (the series is empty; the screen then draws the chart's own
 *         designed 0-point frame, never a made-up segment);
 *   (v)   a hole in the MIDDLE breaks the line (a restart of the path), it is never bridged; the live point
 *         never bridges a stretch of missing bars either.
 * Run: cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  dailyValues, draftValueOf, finishedPortfolioSeries, MAX_GAP_DAYS, portfolioSeries, sinceTheDraftGain, type ChartActivityRow,
} from '../lib/money/portfolioChart.ts';
import { rangeGain } from '../lib/chart/chartRanges.ts';
import { buildLine } from '../components/sp/logic/lineChart.ts';
import { partialLinePath } from '../lib/chart/chartGeometry.ts';
import { standardWeekSessions } from '../lib/time/marketWeek.ts';

const STAKE = { stakeMode: 'budget_cap' as const, notionalPerSlot: null, numRounds: 2 };
// Drafted Sun Jan 4, 8:30 PM ET: NVDA ×1 at $100, AAPL ×1 at $50 (stake 150).
const JAN_DRAFT = '2026-01-05T01:30:00.000Z';
const ROWS: ChartActivityRow[] = [
  { kind: 'draft', action: 'buy', symbol: 'NVDA', quantity: 1, price: 100, occurredAt: JAN_DRAFT },
  { kind: 'draft', action: 'buy', symbol: 'AAPL', quantity: 1, price: 50, occurredAt: JAN_DRAFT },
];
const bar = (date: string, close: number) => ({ date, close });
const TODAY = '2026-11-18';

// ── (i) + (ii): the line starts where every holding has a real close ───────────────────────────

Deno.test('a late-starting stock: its missing days draw nothing, no partial sum and no stock at cost', () => {
  // NVDA has bars from Mar 2; AAPL's begin Apr 1. Mar 2 and Mar 3 have only NVDA: a part shown as the whole.
  const bars = { NVDA: [bar('2026-03-02', 130), bar('2026-03-03', 132), bar('2026-04-01', 140)], AAPL: [bar('2026-04-01', 60)] };
  const d = dailyValues({ rows: ROWS, bars, stake: STAKE, todayEt: TODAY, endEt: '2026-04-01' });
  // Only Apr 1 has a real close for both (140 + 60); the draft-day point and Mar 2/3 are not drawn.
  assertEquals(d, [{ date: '2026-04-01', value: 200 }]);
});

Deno.test('early bars missing for everyone (the 407-day clamp): the line starts where the real data starts, no bridge from the draft day', () => {
  const bars = { NVDA: [bar('2026-03-02', 130), bar('2026-03-03', 132)], AAPL: [bar('2026-03-02', 55), bar('2026-03-03', 54)] };
  const d = dailyValues({ rows: ROWS, bars, stake: STAKE, todayEt: TODAY, endEt: '2026-03-03' });
  assertEquals(d, [{ date: '2026-03-02', value: 185 }, { date: '2026-03-03', value: 186 }]);
  // The draft is 57 days before the first real date: far more than any market closure.
  assert(57 > MAX_GAP_DAYS);
  // (ii) the axis starts at the first real date, not the draft day.
  const s = finishedPortfolioSeries({ daily: d, endEt: '2026-03-03' });
  assertEquals(s.axis, { kind: 'dated', start: '2026-03-02', end: '2026-03-03' });
  assertEquals(s.points.map((p) => p.t), [0, 1]);
});

Deno.test('complete data keeps the draft-day point: the first session after the draft joins it', () => {
  const bars = { NVDA: [bar('2026-01-05', 101), bar('2026-01-06', 103)], AAPL: [bar('2026-01-05', 51), bar('2026-01-06', 52)] };
  const d = dailyValues({ rows: ROWS, bars, stake: STAKE, todayEt: TODAY, endEt: '2026-01-06' });
  assertEquals(d, [{ date: '2026-01-04', value: 150 }, { date: '2026-01-05', value: 152 }, { date: '2026-01-06', value: 155 }]);
});

Deno.test('a Friday-evening draft joins Monday\'s close (a weekend is not a hole)', () => {
  const rows = ROWS.map((r) => ({ ...r, occurredAt: '2026-01-10T01:30:00.000Z' })); // Fri Jan 9, 8:30 PM ET
  const bars = { NVDA: [bar('2026-01-12', 101)], AAPL: [bar('2026-01-12', 51)] };
  const d = dailyValues({ rows, bars, stake: STAKE, todayEt: TODAY, endEt: '2026-01-12' });
  assertEquals(d.map((x) => x.date), ['2026-01-09', '2026-01-12']);
  assertEquals(d[1].breakBefore, undefined);
});

// ── (v): a hole in the middle breaks the line ─────────────────────────────────────────────────

// ── the zero-volume day: the server's ladder (PREV_CLOSE_MAX_SESSIONS = 5 sessions) ──────────────────────

const DAYS = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-12', '2026-01-13', '2026-01-14'];

Deno.test('one session with no bar carries the stock\'s previous real close (no break, no invented value)', () => {
  const bars = {
    NVDA: DAYS.slice(0, 4).map((d, i) => bar(d, 101 + i)),
    AAPL: [bar('2026-01-05', 51), bar('2026-01-07', 53), bar('2026-01-08', 54)], // no bar on Jan 6
  };
  const d = dailyValues({ rows: ROWS, bars, stake: STAKE, todayEt: TODAY, endEt: '2026-01-08' });
  assertEquals(d.map((x) => [x.date, x.value, x.breakBefore === true]), [
    ['2026-01-04', 150, false], ['2026-01-05', 152, false],
    ['2026-01-06', 153, false], // NVDA 102 + AAPL's previous real close 51
    ['2026-01-07', 156, false], ['2026-01-08', 158, false],
  ]);
});

Deno.test('five sessions in a row with no bar still carry; the SIXTH breaks the line (the same look-back as the server)', () => {
  // AAPL's last real bar is Jan 5; NVDA trades every day. Sessions with no AAPL bar: Jan 6, 7, 8, 9, 12 (five), then Jan 13 (six).
  const bars = { NVDA: DAYS.map((d, i) => bar(d, 101 + i)), AAPL: [bar('2026-01-05', 51), bar('2026-01-14', 60)] };
  const d = dailyValues({ rows: ROWS, bars, stake: STAKE, todayEt: TODAY, endEt: '2026-01-14' });
  const dates = d.map((x) => x.date);
  for (const day of ['2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-12']) assert(dates.includes(day), `${day} carries (within 5 sessions of Jan 5)`);
  assert(!dates.includes('2026-01-13'), 'the sixth no-bar session has no price: not drawn');
  const back = d.find((x) => x.date === '2026-01-14')!;
  assertEquals(back.breakBefore, true, 'and the line breaks across it rather than bridging');
  assertEquals(back.value, 108 + 60, 'AAPL\'s own bar again');
});

Deno.test('a mid-gap longer than the ladder breaks the line, it does not bridge', () => {
  // AAPL has no bar from Jan 6 to Jan 13 (six sessions); NVDA trades every day.
  const bars = { NVDA: DAYS.map((d, i) => bar(d, 101 + i)), AAPL: [bar('2026-01-05', 51), bar('2026-01-14', 60)] };
  const d = dailyValues({ rows: ROWS, bars, stake: STAKE, todayEt: TODAY, endEt: '2026-01-14' });
  assertEquals(d.filter((x) => x.breakBefore).map((x) => x.date), ['2026-01-14']);
});

Deno.test('the geometry of a break: the path restarts and the stroke length leaves the gap out', () => {
  const daily = [
    { date: '2026-01-04', value: 150 }, { date: '2026-01-05', value: 152 },
    { date: '2026-01-07', value: 156, breakBefore: true }, { date: '2026-01-08', value: 158 },
  ];
  const s = finishedPortfolioSeries({ daily, endEt: '2026-01-08' });
  const box = { width: 400, height: 100, padLeft: 0, padRight: 0, padTop: 0, padBottom: 0 };
  const g = buildLine(s.points, [0, 4], s.base, box);
  assertEquals((g.path.match(/M/g) ?? []).length, 2, 'two strokes');
  assertEquals(g.points.map((p) => p.gapBefore === true), [false, false, true, false]);
  const joined = buildLine(s.points.map((p) => ({ t: p.t, value: p.value })), [0, 4], s.base, box);
  assert(g.length < joined.length, 'the unbridged line is shorter than the bridged one');
});

Deno.test('a mid-gap where EVERY stock lacks bars for more than a closure also breaks (no date between to look at)', () => {
  const bars = {
    NVDA: [bar('2026-01-05', 101), bar('2026-01-06', 102), bar('2026-02-02', 120), bar('2026-02-03', 121)],
    AAPL: [bar('2026-01-05', 51), bar('2026-01-06', 52), bar('2026-02-02', 60), bar('2026-02-03', 61)],
  };
  const d = dailyValues({ rows: ROWS, bars, stake: STAKE, todayEt: TODAY, endEt: '2026-02-03' });
  assertEquals(d.map((x) => [x.date, x.breakBefore === true]), [
    ['2026-01-04', false], ['2026-01-05', false], ['2026-01-06', false], ['2026-02-02', true], ['2026-02-03', false],
  ]);
});

Deno.test('a long weekend is not a hole (a holiday Monday: Friday to Tuesday joins)', () => {
  const bars = { NVDA: [bar('2026-01-09', 101), bar('2026-01-13', 103)], AAPL: [bar('2026-01-09', 51), bar('2026-01-13', 52)] };
  const d = dailyValues({ rows: ROWS, bars, stake: STAKE, todayEt: TODAY, endEt: '2026-01-13' });
  assertEquals(d.find((x) => x.date === '2026-01-13')!.breakBefore, undefined);
});

// ── who must have a bar: only what is held on that date ──────────────────────────────────────

Deno.test('a stock sold earlier, or bought later, needs no bar on the days it is not held', () => {
  const rows: ChartActivityRow[] = [
    ...ROWS,
    { kind: 'trade', action: 'sell', symbol: 'AAPL', quantity: 1, price: 55, occurredAt: '2026-01-06T15:00:00Z' }, // sold Jan 6
    { kind: 'trade', action: 'buy', symbol: 'KO', quantity: 2, price: 30, occurredAt: '2026-01-07T15:00:00Z' }, // bought Jan 7
  ];
  const bars = {
    NVDA: [bar('2026-01-05', 101), bar('2026-01-06', 102), bar('2026-01-07', 103), bar('2026-01-08', 104)],
    AAPL: [bar('2026-01-05', 51)], // no bars after it is sold
    KO: [bar('2026-01-07', 31), bar('2026-01-08', 32)], // none before it is bought
  };
  const d = dailyValues({ rows, bars, stake: STAKE, todayEt: TODAY, endEt: '2026-01-08' });
  assertEquals(d.map((x) => x.date), ['2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08']);
  assert(d.every((x) => x.breakBefore === undefined), 'no hole: nothing was missing for a holding');
  // The day AFTER the buy but with KO's bar missing would be a hole.
  const noKo = dailyValues({ rows, bars: { ...bars, KO: [bar('2026-01-08', 32)] }, stake: STAKE, todayEt: TODAY, endEt: '2026-01-08' });
  assert(!noKo.some((x) => x.date === '2026-01-07'), 'KO is held on Jan 7 and has no bar: not drawn');
});

// ── (iv): no line ───────────────────────────────────────────────────────────────────────────────

Deno.test('all missing: no date has a real close for every holding, so there is no line (and nothing at cost)', () => {
  assertEquals(dailyValues({ rows: ROWS, bars: {}, stake: STAKE, todayEt: TODAY, endEt: '2026-03-03' }), []);
  assertEquals(dailyValues({ rows: ROWS, bars: { NVDA: [bar('2026-03-02', 130)] }, stake: STAKE, todayEt: TODAY, endEt: '2026-03-03' }), []);
  const s = finishedPortfolioSeries({ daily: [], endEt: '2026-03-03', draftValue: 150 });
  assertEquals(s.points, []);
});

Deno.test('a league drafted just now has no bars yet and that is no hole: the draft-day point and the live one join', () => {
  const rows = ROWS.map((r) => ({ ...r, occurredAt: '2026-11-18T15:00:00Z' }));
  const d = dailyValues({ rows, bars: {}, stake: STAKE, todayEt: '2026-11-18' });
  assertEquals(d, [{ date: '2026-11-18', value: 150 }]);
  const s = portfolioSeries({ range: 'Season', daily: d, liveValue: 155, todayEt: '2026-11-18', now: new Date('2026-11-18T17:00:00Z'), sessions: standardWeekSessions('2026-11-18T16:00:00Z'), draftValue: 150 });
  assertEquals(s.points, [{ t: 0, value: 155 }]);
  assertEquals(rangeGain(s.points, s.base)!.money, 5);
});

Deno.test('a league drafted long ago whose bars never loaded draws no line from the draft to the live value', () => {
  const d = dailyValues({ rows: ROWS, bars: {}, stake: STAKE, todayEt: TODAY });
  assertEquals(d, [], 'no draft-day point to bridge from');
  const s = portfolioSeries({ range: 'Season', daily: d, liveValue: 190, todayEt: TODAY, now: new Date('2026-11-18T17:00:00Z'), sessions: standardWeekSessions('2026-11-18T16:00:00Z'), draftValue: 150 });
  assertEquals(s.points, [], 'nothing drawn for Season: no line, no made-up segment');
  // The number is untouched: since the draft is the live value minus the stake at cost (a real number).
  const g = sinceTheDraftGain(190, draftValueOf(ROWS, STAKE))!;
  assertEquals([g.money, Math.round(g.pct * 100) / 100, g.tone], [40, 26.67, 'gain']);
});

// ── (iii): since the draft is unchanged ──────────────────────────────────────────────────────────

Deno.test('"since the draft" is last value minus the stake at cost, even when the line starts late', () => {
  assertEquals(draftValueOf(ROWS, STAKE), 150);
  const bars = { NVDA: [bar('2026-03-02', 130), bar('2026-03-03', 132)], AAPL: [bar('2026-03-02', 55), bar('2026-03-03', 54)] };
  const d = dailyValues({ rows: ROWS, bars, stake: STAKE, todayEt: TODAY, endEt: '2026-03-03' });
  const s = finishedPortfolioSeries({ daily: d, endEt: '2026-03-03', draftValue: draftValueOf(ROWS, STAKE) });
  assertEquals(s.base, 150);
  assertEquals(rangeGain(s.points, s.base)!.money, 36, '186 − 150, not 186 − 185 (the first drawn point)');
  // Without the late start nothing changes: the base is the draft-day point's own value.
  const full = { NVDA: [bar('2026-01-05', 101)], AAPL: [bar('2026-01-05', 51)] };
  const f = finishedPortfolioSeries({ daily: dailyValues({ rows: ROWS, bars: full, stake: STAKE, todayEt: TODAY, endEt: '2026-01-05' }), endEt: '2026-01-05', draftValue: 150 });
  assertEquals(f.base, 150);
});

Deno.test('the live point never bridges a stretch of missing bars; it joins when the bars are current', () => {
  const sessions = standardWeekSessions('2026-11-18T16:00:00Z');
  const now = new Date('2026-11-18T17:00:00Z');
  const stale = portfolioSeries({ range: 'Season', daily: [{ date: '2026-03-02', value: 185 }, { date: '2026-03-03', value: 186 }], liveValue: 190, todayEt: TODAY, now, sessions });
  assertEquals(stale.points.map((p) => p.gapBefore === true), [false, false, true], 'bars end months ago: the live dot stands alone');
  // A late-starting live line is still measured from the stake at cost (Season = since the draft).
  const late = portfolioSeries({ range: 'Season', daily: [{ date: '2026-03-02', value: 185 }, { date: '2026-03-03', value: 186 }], liveValue: 190, todayEt: TODAY, now, sessions, draftValue: 150 });
  assertEquals(late.base, 150);
  assertEquals(rangeGain(late.points, late.base)!.money, 40);
  const current = portfolioSeries({ range: 'Season', daily: [{ date: '2026-11-16', value: 185 }, { date: '2026-11-17', value: 186 }], liveValue: 190, todayEt: TODAY, now, sessions });
  assertEquals(current.points.map((p) => p.gapBefore === true), [false, false, false]);
});

// ── the geometry ────────────────────────────────────────────────────────────────────────────

Deno.test('the draw-in restarts the stroke at a break, never joining across it', () => {
  const pts = [{ x: 0, y: 10 }, { x: 10, y: 20 }, { x: 40, y: 5, gapBefore: true }, { x: 50, y: 15 }];
  assertEquals(partialLinePath(pts, 1, 100), 'M0.00,10.00 L10.00,20.00 M40.00,5.00 L50.00,15.00');
  const half = partialLinePath(pts, 0.5, 2 * Math.hypot(10, 10));
  assert(half.includes('M40.00,5.00'), half);
});

Deno.test('with no break the geometry is unchanged: one stroke through every point', () => {
  const g = buildLine([{ t: 0, value: 1 }, { t: 1, value: 2 }, { t: 2, value: 3 }], [0, 2], 1, { width: 100, height: 100, padLeft: 0, padRight: 0, padTop: 0, padBottom: 0 });
  assertEquals((g.path.match(/M/g) ?? []).length, 1);
  assertEquals((g.path.match(/L/g) ?? []).length, 2);
});

// ── the same series feeds every screen ───────────────────────────────────────────────────────────

Deno.test('own Portfolio, the finished season and a manager\'s team all read dailyValues / draftValueOf', () => {
  const read = (p: string) => Deno.readTextFileSync(new URL(p, import.meta.url));
  const screen = read('../components/money/PortfolioScreen.tsx');
  assert(screen.includes("gainRange === 'Season' ? sinceTheDraftGain(lastValue, draftValue)"), 'Season says since the draft from the stake at cost');
  assert(screen.includes('finishedPortfolioSeries({ daily, endEt: chartEnd, draftValue })'));
  assert(screen.includes('portfolioSeries({ range: shownRange, daily, liveValue: chart.liveValue, todayEt, now, sessions, draftValue })'));
  const team = read('../lib/money/teamPortfolioView.ts');
  assert(team.includes('draftValueOf(i.chartRows, i.stake) ?? summary.stake'), 'finished gain basis = the stake at cost');
  assert(read('../lib/money/playerPortfolio.ts').includes('teamPortfolioView('), 'the manager portfolio goes through it');
});

// ── the capture knob that shows these states (seam only) ──────────────────────────────────────────

import { applyBarsFault, parseBarsFault } from '../lib/money/barsFault.ts';

Deno.test('capture knob: parseBarsFault reads from / late / gap / none and nothing else', () => {
  assertEquals(parseBarsFault('from:2026-09-10'), { kind: 'from', date: '2026-09-10' });
  assertEquals(parseBarsFault('late:aapl:2026-09-10'), { kind: 'late', symbol: 'AAPL', date: '2026-09-10' });
  assertEquals(parseBarsFault('gap:NVDA:2026-09-08:2026-09-14'), { kind: 'gap', symbol: 'NVDA', from: '2026-09-08', to: '2026-09-14' });
  assertEquals(parseBarsFault('none'), { kind: 'none' });
  for (const bad of [null, undefined, '', 'from:soon', 'late:AAPL', 'gap:NVDA:2026-09-08', 'none:1', 'whatever']) assertEquals(parseBarsFault(bad), null, String(bad));
});

Deno.test('capture knob: applyBarsFault removes only what it names', () => {
  const b = [bar('2026-09-01', 1), bar('2026-09-08', 2), bar('2026-09-12', 3), bar('2026-09-15', 4)];
  assertEquals(applyBarsFault('X', b, null), b);
  assertEquals(applyBarsFault('X', b, { kind: 'none' }), []);
  assertEquals(applyBarsFault('X', b, { kind: 'from', date: '2026-09-10' }).map((x) => x.date), ['2026-09-12', '2026-09-15']);
  assertEquals(applyBarsFault('AAPL', b, { kind: 'late', symbol: 'AAPL', date: '2026-09-10' }).length, 2);
  assertEquals(applyBarsFault('NVDA', b, { kind: 'late', symbol: 'AAPL', date: '2026-09-10' }), b, 'another symbol is untouched');
  assertEquals(applyBarsFault('NVDA', b, { kind: 'gap', symbol: 'NVDA', from: '2026-09-08', to: '2026-09-12' }).map((x) => x.date), ['2026-09-01', '2026-09-15']);
});

// ── the empty frame (the Planner, 2026-11-19): the app's "–", never a blank; Season still says since the draft ──────

Deno.test('no line: the chart keeps its empty frame, the gain line is the app\'s dash (not a blank), no stray axis label', () => {
  const read = (p: string) => Deno.readTextFileSync(new URL(p, import.meta.url));
  const line = read('../components/sp/gn/RangeGainLine.tsx');
  assert(line.includes("const UNKNOWN_DASH = '\\u2013';"), 'the en dash, the one Schedule and the card use');
  assert(line.includes('if (!gain && unknown) {') && line.includes('{UNKNOWN_DASH}'));
  const screen = read('../components/money/PortfolioScreen.tsx');
  assert(screen.includes('unknown={series.points.length === 0}'));
  assert(screen.includes('axis={series.points.length ? series.axis : EMPTY_FRAME_AXIS}'), 'no axis labels under an empty chart');
  assert(screen.includes("const EMPTY_FRAME_AXIS: AxisSpec = { kind: 'sessions', days: [] };"));
  // No new words and no screen-level failure for it.
  assert(!/LoadFailure[^\n]*seasonEnd[^\n]*points/.test(screen));
});

Deno.test('Season still says since the draft when there is no line and the value is real (live); with no real value it is the dash', () => {
  assertEquals(sinceTheDraftGain(190, 150)!.money, 40);
  assertEquals(sinceTheDraftGain(null, 150), null, 'a finished season with no real value: no figure, so the dash');
});
