/**
 * The six ranges on EVERY chart (Giorgio, 2026-11-17; the Design Lead's chart-ranges-1117
 * acceptance): 1W · 1M · 3M · 6M · Season · YTD on Portfolio, the stock sheet and the player card.
 * Pinned here:
 *   (a) the six ranges, no 1Y, no 1D, the same set on all three charts;
 *   (b) the defaults: Portfolio and the card open on Season, the sheet on 1W, nothing remembered;
 *   (c) ONE greying helper ("a range longer than the history behind it is grey"): Portfolio's
 *       history is the league's age, a stock's is its first bar; Season is grey on a stock before the
 *       draft or with no league; 1W NEVER greys; a grey pill is inert, dimmed and never selected;
 *   (d) the gain format "+$X (+Y%) words": dollars first, the percent in brackets, NO dot;
 *       its colour is the line's colour;
 *   (e) the period words, and the break rule: unbroken figures, unbroken phrase, one break between;
 *   (f) the gain follows the range;
 *   (g) the stock sheet drops its "today" line; (h) the card's two figures; (i) six pills on one row.
 * Run: cd apps/mobile/tests-deno && deno test --no-check --sloppy-imports --unstable-raw-imports --allow-read --allow-env .
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  CHART_RANGES, FALLBACK_RANGE, RANGE_WORDS, SEASON_DEFAULT_RANGE, SHEET_DEFAULT_RANGE, asChartRange, greyedRanges, isRangeGrey,
  rangeGain, rangeGainText, rangeSeries, rangeStartDate, selectableRange, todaySessionOpen, type ChartRange, type GreyContext,
} from '../lib/chart/chartRanges.ts';
import { dailyValues, DEFAULT_PORTFOLIO_RANGE, PORTFOLIO_RANGES, portfolioGreyedRanges, portfolioHistoryStart, portfolioRangeChoice, portfolioRangePick, portfolioSeries } from '../lib/money/portfolioChart.ts';
import { historyStartOf, stockGreyedRanges, stockLineSeries } from '../lib/money/stockChartSeries.ts';
import { seasonStartOf } from '../lib/money/seasonStart.ts';
import { lineTone } from '../components/sp/logic/lineChart.ts';
import { NBSP, WORD_JOINER } from '../lib/game/keepDots.ts';
import { standardWeekSessions } from '../lib/time/marketWeek.ts';
import chartSrc from '../components/sp/gn/Chart.tsx' with { type: 'text' };
import pillsSrc from '../components/sp/gn/RangePills.tsx' with { type: 'text' };
import gainLineSrc from '../components/sp/gn/RangeGainLine.tsx' with { type: 'text' };
import stockChartSrc from '../components/money/StockChart.tsx' with { type: 'text' };
import stockSheetSrc from '../components/money/StockSheetBody.tsx' with { type: 'text' };
import portfolioSrc from '../components/money/PortfolioScreen.tsx' with { type: 'text' };
import gainPairSrc from '../components/money/RollingGainPair.tsx' with { type: 'text' };
import cardSrc from '../components/sp/gn/PlayerCard.tsx' with { type: 'text' };

const SIX = ['1W', '1M', '3M', '6M', 'Season', 'YTD'];
const strip = (src: string) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

// ── (a) the six ranges, on every chart ───────────────────────────────────────────────────

Deno.test('(a) the six ranges in order: 1W 1M 3M 6M Season YTD; no 1Y, no 1D', () => {
  assertEquals([...CHART_RANGES], SIX);
  assertEquals(CHART_RANGES.includes('1Y' as never), false);
  assertEquals(CHART_RANGES.includes('1D' as never), false);
});

Deno.test('(a) Portfolio, the stock sheet and the player card all draw the SAME six (one list, three charts)', () => {
  assertEquals([...PORTFOLIO_RANGES], SIX);
  // The sheet and the card are one component, <StockChart>, whose pills are CHART_RANGES.
  assert(stockChartSrc.includes('<RangePills options={CHART_RANGES}'));
  assert(strip(cardSrc).includes('<StockChart'), 'the card draws the stock chart');
  assert(strip(stockSheetSrc).includes('<StockChart'), 'the sheet draws the stock chart');
  assert(portfolioSrc.includes('<RangePills options={PORTFOLIO_RANGES}'));
  for (const src of [stockChartSrc, portfolioSrc]) assert(src.includes('disabled={greyed}'), 'every chart passes its grey set to the pills');
});

Deno.test('(a) 1W is five sessions on weekday labels; the other five are dated; YTD starts at the year\'s first day', () => {
  const values = [{ date: '2026-01-02', value: 100 }, { date: '2026-06-01', value: 110 }, { date: '2026-11-12', value: 120 }, { date: '2026-11-13', value: 121 }];
  const base = { values, live: 125, liveToday: true, todayEt: '2026-11-16', seasonStart: '2026-11-01' };
  assertEquals(rangeSeries({ ...base, range: '1W' }).axis.kind, 'sessions');
  for (const r of ['1M', '3M', '6M', 'Season', 'YTD'] as const) assertEquals(rangeSeries({ ...base, range: r }).axis.kind, 'dated', r);
  assertEquals(rangeStartDate('YTD', '2026-11-16', null), '2026-01-01');
  assertEquals(rangeSeries({ ...base, range: 'YTD' }).axis, { kind: 'dated', start: '2026-01-02', end: '2026-11-16' });
});

// ── (b) the defaults ─────────────────────────────────────────────────────────────────────

Deno.test('(b) defaults: Portfolio and the card open on Season, the stock sheet on 1W', () => {
  assertEquals(DEFAULT_PORTFOLIO_RANGE, 'Season');
  assertEquals(SEASON_DEFAULT_RANGE, 'Season');
  assertEquals(SHEET_DEFAULT_RANGE, '1W');
  assert(stockChartSrc.includes('defaultRange = SHEET_DEFAULT_RANGE'), 'the sheet: no prop = 1W');
  assert(strip(cardSrc).includes('defaultRange={SEASON_DEFAULT_RANGE}'), 'the card: Season');
  assert(portfolioSrc.includes('useState<PortfolioRangePick>({ leagueId: activeLeagueId, range: DEFAULT_PORTFOLIO_RANGE })'), 'Portfolio: Season');
});

Deno.test('(b) nothing is remembered between opens: the range is plain component state, never stored', () => {
  for (const src of [stockChartSrc, portfolioSrc]) assert(!/AsyncStorage|localStorage|SecureStore|MMKV/.test(src));
  assert(/useState<ChartRange>\(defaultRange\)/.test(stockChartSrc));
});

// ── (c) greying: ONE helper ──────────────────────────────────────────────────────────────

const ctx = (over: Partial<GreyContext> = {}): GreyContext => ({ todayEt: '2026-11-16', historyStart: '2020-03-02', seasonStart: '2026-11-02', ...over });

Deno.test('(c) a range longer than the history behind it is grey; shorter ones are not', () => {
  // A league drafted two weeks ago: Portfolio's history = the draft day.
  const young = ctx({ historyStart: '2026-11-02', seasonStart: '2026-11-02' });
  assertEquals(greyedRanges(young), ['1M', '3M', '6M', 'YTD']);
  assertEquals(isRangeGrey('Season', young), false, 'Season never greys on Portfolio: its history IS the season');
  assertEquals(isRangeGrey('1W', young), false);
  // 40 days old: 1M lights up (31-day window) and the longer ones stay grey.
  const forty = ctx({ historyStart: '2026-10-07', seasonStart: '2026-10-07' });
  assertEquals(greyedRanges(forty), ['3M', '6M', 'YTD']);
  // Older than the year: nothing is grey.
  assertEquals(greyedRanges(ctx({ historyStart: '2025-12-01', seasonStart: '2025-12-01' })), []);
});

Deno.test('(c) YTD lights up once the history reaches January 1', () => {
  assertEquals(isRangeGrey('YTD', ctx({ historyStart: '2026-01-01' })), false);
  assertEquals(isRangeGrey('YTD', ctx({ historyStart: '2026-01-02' })), true);
});

Deno.test('(c) a stock: its history is its first bar; an old stock greys nothing but a recent listing greys 3M, 6M, YTD', () => {
  assertEquals(greyedRanges(ctx({ historyStart: '2018-06-01' })), []);
  // Listed 2026-10-01 (a recent IPO): 1M (Oct 16) is covered, 3M / 6M / YTD are not.
  assertEquals(greyedRanges(ctx({ historyStart: '2026-10-01', seasonStart: '2026-10-01' })), ['3M', '6M', 'YTD']);
});

Deno.test('(c) Season is grey on a stock before the league has drafted, or with no league at all', () => {
  assertEquals(isRangeGrey('Season', ctx({ seasonStart: null })), true);
  assertEquals(greyedRanges(ctx({ seasonStart: null })), ['Season']);
  // …and also when the stock is younger than the draft (nothing behind the Season window).
  assertEquals(isRangeGrey('Season', ctx({ historyStart: '2026-11-10', seasonStart: '2026-11-02' })), true);
});

Deno.test('(c) 1W NEVER greys: a stock a day old, no history, no league, nothing loaded', () => {
  for (const c of [ctx({ historyStart: '2026-11-16' }), ctx({ historyStart: null }), ctx({ seasonStart: null, historyStart: '2026-11-16' }), ctx({ historyStart: '2099-01-01' })]) {
    assertEquals(isRangeGrey('1W', c), false);
  }
  // A stock under a week old draws only the days that exist.
  const s = rangeSeries({ range: '1W', values: [{ date: '2026-11-13', value: 10 }, { date: '2026-11-16', value: 11 }], live: null, liveToday: false, todayEt: '2026-11-16', seasonStart: null });
  assertEquals(s.points.length, 2);
});

Deno.test('(c) while the history is not known yet (loading) nothing is compared, except a Season that cannot exist', () => {
  assertEquals(greyedRanges(ctx({ historyStart: null })), []);
  assertEquals(greyedRanges(ctx({ historyStart: null, seasonStart: null })), ['Season']);
});

Deno.test('(c) the helper decides both histories: Portfolio\'s from its daily values, a stock\'s from its bars', () => {
  const daily = [{ date: '2026-11-02', value: 150 }, { date: '2026-11-03', value: 152 }];
  assertEquals(portfolioHistoryStart(daily), '2026-11-02');
  assertEquals(portfolioHistoryStart([]), null);
  assertEquals(historyStartOf([{ date: '2026-10-01', close: 5 }, { date: '2026-10-02', close: 6 }]), '2026-10-01');
  const portfolioGrey = greyedRanges({ todayEt: '2026-11-16', historyStart: portfolioHistoryStart(daily), seasonStart: portfolioHistoryStart(daily) });
  assertEquals(portfolioGrey, ['1M', '3M', '6M', 'YTD']);
});

Deno.test('(c) the two screens\' own greying: Portfolio from the league\'s age, a stock from its bars and the draft', () => {
  const young = [{ date: '2026-11-02', value: 150 }, { date: '2026-11-03', value: 152 }];
  assertEquals(portfolioGreyedRanges(young, '2026-11-16'), ['1M', '3M', '6M', 'YTD'], 'a two-week-old league: Season and 1W stay lit');
  assertEquals(portfolioGreyedRanges([{ date: '2025-12-20', value: 1 }], '2026-11-16'), [], 'older than the year: nothing grey');
  assertEquals(portfolioGreyedRanges([], '2026-11-16'), ['Season'], 'nothing drafted: no season');
  // A stock: bars from 2024, the league drafted on Nov 2 → everything lit; before the draft → Season grey.
  const old = [{ date: '2024-03-01', close: 10 }, { date: '2026-11-13', close: 12 }];
  assertEquals(stockGreyedRanges({ bars: old, ready: true, todayEt: '2026-11-16', seasonStart: '2026-11-02' }), []);
  assertEquals(stockGreyedRanges({ bars: old, ready: true, todayEt: '2026-11-16', seasonStart: null }), ['Season']);
  // A recent listing (first bar Oct 1): 3M, 6M and YTD are grey, 1W and 1M are not.
  const ipo = [{ date: '2026-10-01', close: 10 }, { date: '2026-11-13', close: 12 }];
  assertEquals(stockGreyedRanges({ bars: ipo, ready: true, todayEt: '2026-11-16', seasonStart: '2026-11-02' }), ['3M', '6M', 'YTD']);
  assertEquals(stockGreyedRanges({ bars: ipo, ready: true, todayEt: '2026-11-16', seasonStart: null }), ['3M', '6M', 'Season', 'YTD']);
  // Still loading: no history to compare, so only a Season that cannot exist is grey.
  assertEquals(stockGreyedRanges({ bars: [], ready: false, todayEt: '2026-11-16', seasonStart: '2026-11-02' }), []);
  // A stock under a week old: every range but 1W is grey, and 1W draws what exists.
  assertEquals(stockGreyedRanges({ bars: [{ date: '2026-11-13', close: 5 }], ready: true, todayEt: '2026-11-16', seasonStart: '2026-11-02' }), ['1M', '3M', '6M', 'Season', 'YTD']);
});

Deno.test('(c) a grey range is never the selected one: it falls back to 1W, which never greys', () => {
  assertEquals(FALLBACK_RANGE, '1W');
  assertEquals(selectableRange('Season', ['Season']), '1W');
  assertEquals(selectableRange('6M', ['3M', '6M', 'YTD']), '1W');
  assertEquals(selectableRange('1M', ['3M', '6M', 'YTD']), '1M');
  // The capture/DEV `range` action can name only a real range.
  assertEquals(asChartRange('6M'), '6M');
  assertEquals(asChartRange('1Y'), null);
  assertEquals(asChartRange(undefined), null);
});

Deno.test('(c) a TEAM chart falls back to Season, never 1W; the stock sheet still falls back to 1W', () => {
  // build 17: YTD picked in an older league, then a younger league where YTD is grey.
  const young = portfolioGreyedRanges([{ date: '2026-11-11', value: 1000 }, { date: '2026-11-17', value: 1010 }], '2026-11-18');
  assert(young.includes('YTD') && !young.includes('Season'), 'YTD grey, Season never');
  assertEquals(selectableRange('YTD', young, DEFAULT_PORTFOLIO_RANGE), 'Season');
  assertEquals(selectableRange('6M', ['3M', '6M', 'YTD'], 'Season'), 'Season');
  assertEquals(selectableRange('1M', ['3M', '6M', 'YTD'], 'Season'), '1M', 'a live pick stays');
  // The stock sheet passes no fallback: 1W, as before.
  assertEquals(selectableRange('YTD', ['3M', '6M', 'YTD']), '1W');
  // A fallback that is itself grey (the player card's Season on a stock younger than the
  // league) drops to 1W, which never greys.
  assertEquals(selectableRange('Season', ['1M', '3M', '6M', 'Season', 'YTD'], 'Season'), '1W');
  // Wiring: Portfolio passes its Season fallback; StockChart passes none.
  assert(strip(portfolioSrc).includes('selectableRange(range, greyed, DEFAULT_PORTFOLIO_RANGE)'), 'Portfolio falls back to Season');
  assert(strip(stockChartSrc).includes('selectableRange(picked, greyed)'), 'the sheet falls back to 1W');
});

Deno.test('(c) switching league reopens the team chart on Season; the pick never carries over', () => {
  const inA = { leagueId: 'league-a', range: 'YTD' as const };
  // Same league: the same object (so the screen sets no state and does not loop).
  assert(portfolioRangePick(inA, 'league-a') === inA);
  // Another league: a fresh Season pick.
  assertEquals(portfolioRangePick(inA, 'league-b'), { leagueId: 'league-b', range: 'Season' });
  // Back to the first league: still Season (the pick was reset, not remembered per league).
  const inB = portfolioRangePick(inA, 'league-b');
  assertEquals(portfolioRangePick(inB, 'league-a'), { leagueId: 'league-a', range: 'Season' });
  // The write side: a pill tap in league L survives the next render's read in L (the pills are
  // never dead), and still resets once the league changes.
  for (const r of ['1W', '1M', '3M', '6M', 'YTD'] as const) {
    const chosen = portfolioRangeChoice('league-a', r);
    assertEquals(portfolioRangePick(chosen, 'league-a').range, r);
    assertEquals(portfolioRangePick(chosen, 'league-b').range, 'Season');
  }
  // The screen derives its range from the pick for the league on screen and resets during render.
  const src = strip(portfolioSrc);
  assert(src.includes('setRangePick(portfolioRangeChoice(activeLeagueId, next))'), 'a tap is recorded against the league on screen');
  assert(src.includes('const currentPick = portfolioRangePick(rangePick, activeLeagueId);'));
  assert(src.includes('if (currentPick !== rangePick) setRangePick(currentPick);'));
  assert(src.includes('const range = currentPick.range;'));
});

Deno.test('(c) a grey pill keeps its place, is dimmed and inert: disabled, never selected, a tap does nothing', () => {
  const src = strip(pillsSrc);
  assert(src.includes('disabled?: readonly R[]'));
  assert(src.includes('const selected = option === value && !dead;'), 'never selected, even if `value` names it');
  assert(src.includes('accessibilityState={{ selected, disabled: dead }}'), 'VoiceOver reads it as dimmed');
  assert(src.includes('disabled={dead}'));
  assert(src.includes('if (selected || dead) return;'), 'a tap does nothing (no onChange)');
  assert(src.includes('dead ? styles.dead : null') && /dead: \{\s*opacity: 0\.5,/.test(src), 'the disabled pill style: the app\'s one disabled look, 50% (Stepper, SetupRows)');
  // It stays in the row (the map is over every option) and there is no explanation line.
  assert(src.includes('options.map((option) => {'));
  assert(!/explain|because|older than/i.test(src));
});

// ── Portfolio's greying and baselines come from the existing series ─────────────────────

Deno.test('Portfolio: a young league\'s long ranges are grey; the baseline per range is computable from the daily series', () => {
  const STAKE = { stakeMode: 'budget_cap' as const, notionalPerSlot: null, numRounds: 1 };
  const rows = [{ kind: 'draft' as const, action: 'buy' as const, symbol: 'NVDA', quantity: 1, price: 100, occurredAt: '2026-11-02T19:00:00Z' }];
  const bars = { NVDA: [{ date: '2026-11-03', close: 104 }, { date: '2026-11-04', close: 108 }, { date: '2026-11-05', close: 106 }] };
  const daily = dailyValues({ rows, bars, stake: STAKE, todayEt: '2026-11-06' });
  assertEquals(daily[0], { date: '2026-11-02', value: 100 }, 'the series starts at the draft, at cost');
  const grey = greyedRanges({ todayEt: '2026-11-06', historyStart: portfolioHistoryStart(daily), seasonStart: portfolioHistoryStart(daily) });
  assertEquals(grey, ['1M', '3M', '6M', 'YTD']);
  const now = new Date('2026-11-06T17:00:00Z');
  const season = portfolioSeries({ range: 'Season', daily, liveValue: 107, todayEt: '2026-11-06', now, sessions: [] });
  assertEquals(season.base, 100, 'Season measures from the stake at cost');
  const week = portfolioSeries({ range: '1W', daily, liveValue: 107, todayEt: '2026-11-06', now, sessions: standardWeekSessions('2026-11-06T16:00:00Z') });
  assertEquals(week.base, 100, '1W in a league under a week old: the days that exist, from the first');
});

// ── (d)(e)(f) the gain ───────────────────────────────────────────────────────────────────

Deno.test('(e) the period words are the approved copy', () => {
  assertEquals(RANGE_WORDS, {
    '1W': 'past week', '1M': 'past month', '3M': 'past 3 months', '6M': 'past 6 months', Season: 'since the draft', YTD: 'this year',
  });
});

Deno.test('(d) the gain SHOWS "+$54.60 (+41.42%)" and SAYS "+$54.60, +41.42% past 6 months": dollars first, NO dot', () => {
  const g = rangeGain([{ t: 0, value: 131.82 }, { t: 100, value: 186.42 }], 131.82)!;
  const t = rangeGainText('6M', g);
  assertEquals(t.figures, '+$54.60 (+41.42%)');
  // VoiceOver: comma-joined, never the brackets (Design Lead, #546).
  assertEquals(t.label, '+$54.60, +41.42% past 6 months');
  assert(!t.label.includes('·') && !t.figures.includes('·'), 'no dot between the numbers');
  assertEquals([t.money, t.pct], ['+$54.60', '+41.42%']);
  assertEquals(rangeGainText('Season', g).label, '+$54.60, +41.42% since the draft');
  assertEquals(rangeGainText('YTD', g).label, '+$54.60, +41.42% this year');
  assertEquals(rangeGainText('1W', g).label, '+$54.60, +41.42% past week');
  assertEquals(rangeGainText('1M', g).label, '+$54.60, +41.42% past month');
  assertEquals(rangeGainText('3M', g).label, '+$54.60, +41.42% past 3 months');
});

Deno.test('(d) a loss reads −$ and −%, in the loss tone; the tone IS the line\'s tone (same points, same base)', () => {
  const pts = [{ t: 0, value: 200 }, { t: 5, value: 150.5 }];
  const g = rangeGain(pts, 200)!;
  assertEquals(g.tone, 'loss');
  assertEquals(g.tone, lineTone(pts, 200));
  assertEquals(rangeGainText('1M', g).figures, '−$49.50 (−24.75%)');
  const up = rangeGain([{ t: 0, value: 1 }, { t: 1, value: 2 }], 1)!;
  assertEquals(up.tone, lineTone([{ t: 0, value: 1 }, { t: 1, value: 2 }], 1));
  assertEquals(rangeGain([], 5), null);
  const flat = rangeGain([{ t: 0, value: 3 }, { t: 1, value: 3 }], 3)!;
  assertEquals([flat.tone, flat.money, flat.pct], ['zero', 0, 0]);
});

Deno.test('(d) the gain line colours its NUMBERS by the sign (the same colors[tone] the Chart strokes with); its words are grey', () => {
  assert(strip(gainLineSrc).includes('const color = colors[gain.tone];'));
  assert(strip(chartSrc).includes('const tone = toneOverride ?? lineTone(points, base);') && strip(chartSrc).includes('const lineColor = colors[tone];'));
  // Word colour (Giorgio, 2026-11-18, pick A): the line hands its colour to RollingGainPair, which gives it
  // to the two numbers and the percent's two brackets ONLY; the words are the app's grey, regular weight.
  assert(strip(gainLineSrc).includes('color={color}') && strip(gainLineSrc).includes('words={text.keptWords}'));
  const g = strip(gainPairSrc);
  assertEquals((g.match(/color=\{color\}/g) ?? []).length, 4, 'both numbers and both brackets, never the words');
  const words = g.slice(g.indexOf('{words ? ('));
  assert(/tone="secondary"/.test(words) && !/color=\{/.test(words) && /regular\b/.test(words), 'the words: grey token, regular weight');
});

Deno.test('(e) the break rule: the figures are one non-wrapping run, the period phrase another, one break between', () => {
  const g = rangeGain([{ t: 0, value: 131.82 }, { t: 1, value: 186.42 }], 131.82)!;
  for (const range of CHART_RANGES) {
    const t = rangeGainText(range, g);
    // The phrase never breaks: every space in it is a no-break space.
    assert(!t.keptWords.includes(' ') && t.keptWords.replaceAll(NBSP, ' ') === RANGE_WORDS[range], `${range}: the phrase never breaks`);
    assertEquals(t.figures.replace(' (', ' ('), `${t.money} (${t.pct})`);
  }
  // The component (RollingGainPair): [nowrap group: money, " (", percent, ")"] then the phrase, in a wrapping
  // row, so the only break is between the two groups. The gap before the bracket and before the phrase is a
  // no-break space, so neither can start a line.
  const src = strip(gainPairSrc);
  assert(/row: \{ flexDirection: 'row', flexWrap: 'wrap'/.test(src) && /nowrap: \{ flexDirection: 'row'/.test(src) && !/flexWrap: 'wrap'[^}]*nowrap/.test(src));
  assert(src.includes('{`${NBSP}${GAIN_PAIR_OPEN}`}') && src.includes('{`${NBSP}${words}`}'));
  assert(src.indexOf('<View style={styles.nowrap}>') < src.indexOf('text={money}') && src.indexOf('text={pct}') < src.indexOf('{words ? ('));
});

Deno.test('(f) the gain follows the range: tapping a pill changes the line, the gain and the axis together (one source)', () => {
  const bars = [
    { date: '2026-01-05', close: 100 }, { date: '2026-06-01', close: 120 }, { date: '2026-09-01', close: 130 }, { date: '2026-10-20', close: 140 },
    { date: '2026-11-02', close: 150 }, { date: '2026-11-12', close: 160 }, { date: '2026-11-13', close: 158 },
  ];
  const input = { bars, price: 165, todayEt: '2026-11-16', now: new Date('2026-11-16T17:00:00Z'), sessions: [], seasonStart: '2026-11-02' };
  const gains = CHART_RANGES.map((range) => {
    const s = stockLineSeries({ ...input, range });
    return { range, base: s.base, axisKind: s.axis.kind, text: rangeGainText(range, rangeGain(s.points, s.base)!).label };
  });
  assertEquals(gains.map((g) => g.base), [140, 140, 130, 120, 150, 100]);
  assertEquals(gains.map((g) => g.axisKind), ['sessions', 'dated', 'dated', 'dated', 'dated', 'dated']);
  assertEquals(new Set(gains.map((g) => g.text)).size, 6, 'six ranges, six different gain lines');
  assertEquals(gains.find((g) => g.range === 'Season')!.text, '+$15.00, +10.00% since the draft');
  // The component renders all three from ONE `range` (gain, chart, drawKey, pills).
  const src = strip(stockChartSrc);
  assert(src.includes('<RangeGainLine range={range} gain={gain} rollKey={`${symbol}-${range}`} />') && src.includes('drawKey={`${symbol}-${range}`}') && src.includes('value={range}'));
  assert(strip(portfolioSrc).includes('<RangeGainLine range={gainRange} gain={gain} rollKey={`${rollKey}-${gainRange}`} />') && strip(portfolioSrc).includes('drawKey={gainRange}'));
});

Deno.test('(f) the gain is measured from the range\'s first value to the LIVE value (the end of the drawn line)', () => {
  const s = stockLineSeries({ range: '1M', bars: [{ date: '2026-10-20', close: 100 }, { date: '2026-11-13', close: 120 }], price: 110, todayEt: '2026-11-16', now: new Date('2026-11-16T17:00:00Z'), sessions: [], seasonStart: null });
  assertEquals(rangeGain(s.points, s.base)!.money, 10);
});

// ── the draft day: Season's first day ────────────────────────────────────────────────────

Deno.test('Season\'s first day is the league\'s draft day; null before the draft or with no league', () => {
  const activity = [
    { kind: 'draft', occurred_at: '2026-11-02T01:30:00Z' }, // 8:30 PM ET on Nov 1
    { kind: 'draft', occurred_at: '2026-11-02T01:45:00Z' },
    { kind: 'trade', occurred_at: '2026-11-10T15:00:00Z' },
  ];
  assertEquals(seasonStartOf(true, activity), '2026-11-01', 'the ET day of the first pick, not the UTC one');
  assertEquals(seasonStartOf(false, activity), null, 'the draft is not finished');
  assertEquals(seasonStartOf(true, null), null, 'no ledger');
  assertEquals(seasonStartOf(true, [{ kind: 'trade', occurred_at: '2026-11-10T15:00:00Z' }]), null);
  assert(strip(stockSheetSrc).includes("activeLeague ? activeLeague.draft_status === 'completed' :"), 'no league at all: not drafted');
});

Deno.test('1W today-point: today is a point only once its session has opened (a weekend or holiday is not)', () => {
  const sessions = standardWeekSessions('2026-11-16T16:00:00Z');
  assertEquals(todaySessionOpen(sessions, '2026-11-16', new Date('2026-11-16T15:00:00Z')), true);
  assertEquals(todaySessionOpen(sessions, '2026-11-16', new Date('2026-11-16T12:00:00Z')), false);
  assertEquals(todaySessionOpen(sessions, '2026-11-21', new Date('2026-11-21T15:00:00Z')), false);
});

// ── (g)(h)(i) the screens ────────────────────────────────────────────────────────────────

Deno.test('(g) the stock sheet drops its "+1.70% today" line: today is 1W\'s last point', () => {
  const src = strip(stockSheetSrc);
  assert(!/model\.todayChange/.test(src), 'nothing renders the day\'s change under the price');
  assert(!/ today<\/Text>/.test(src));
});

Deno.test('(h) the player card: two figures (Price with today, Week gain), the range gain above the chart, the chart on Season', () => {
  const src = strip(cardSrc);
  assertEquals((src.match(/<Figure /g) ?? []).length, 2);
  assert(src.includes('label="Price"') && src.includes('sub={`${pct(todayPct)} today`}'), '"today" stays inside the Price figure');
  assert(src.includes('label="Week gain"'));
  assert(!src.includes('Since the draft') && !/sinceGain|sincePct/.test(src));
  assert(src.indexOf('<Figure label="Week gain"') < src.indexOf('<StockChart'), 'figures above, the chart (its gain line first) below');
  assert(strip(stockChartSrc).indexOf('<RangeGainLine') < strip(stockChartSrc).search(/<Chart\s/), 'the gain line sits directly above the chart');
  assert(!/useLargeText|stacked/.test(src), 'at AX5 the two figures keep their columns');
});

Deno.test('(i) the six pills stay on ONE row at the largest size: capped at 1.3x, no wrap, a label shrinks rather than wraps', () => {
  const src = strip(pillsSrc);
  assert(src.includes('const LABEL_MAX_SCALE = 1.3;'));
  assert(src.includes('maxFontSizeMultiplier={LABEL_MAX_SCALE} numberOfLines={1} adjustsFontSizeToFit'));
  assert(/pill: \{[^}]*flexShrink: 1,/.test(src));
  assert(!/flexWrap/.test(src), 'the row never wraps');
  assert(/gap: space\[2\]/.test(src) && /paddingHorizontal: space\[3\]/.test(src), '8pt fill each side, 4pt apart: six fit a phone at 1.3x');
});

Deno.test('no chart has a dotted or base line: Chart takes no showBase, nothing passes one', () => {
  assert(!/showBase|strokeDasharray/.test(chartSrc));
  for (const src of [stockChartSrc, portfolioSrc, cardSrc]) assert(!/showBase/.test(src));
});

// ── (Design Lead gate P2-2) the range gain rolls on a quote refresh; a pill tap swaps it at once ─────

Deno.test('the range gain rolls its two numbers (RollingMoney) and a pill tap never rolls: the roll key carries the range', () => {
  const g = strip(gainPairSrc);
  assertEquals((g.match(/<RollingMoney /g) ?? []).length, 2, 'money and percent, each their own rolling figure');
  assert(g.includes('rollKey={rollKey}') && strip(gainLineSrc).includes('rollKey={rollKey}'));
  // RollingMoney diffs against ITSELF when its key changes (no roll): the key must change with the range.
  assert(strip(stockChartSrc).includes('rollKey={`${symbol}-${range}`}'));
  assert(strip(portfolioSrc).includes('rollKey={`${rollKey}-${gainRange}`}'));
});

// ── (Design Lead gate P2-3) one disabled look ───────────────────────────────────────────────

Deno.test('a grey pill is the app\'s one disabled look: 50% opacity, as Stepper and SetupRows', async () => {
  assert(/dead: \{\s*opacity: 0\.5,/.test(pillsSrc));
  assert(!pillsSrc.includes('0.38'));
  const stepper = await Deno.readTextFile(new URL('../components/game/Stepper.tsx', import.meta.url));
  assert(/opacity: 0\.5,/.test(stepper), 'the look it mirrors');
});

// ── (Design Lead gate P2-1) Portfolio's today line ──────────────────────────────────────────

Deno.test('Portfolio\'s today line: "+$121.27 (+0.99%) today" in the bracket format; the numbers take the gain colour, "today" is grey', () => {
  const src = strip(portfolioSrc);
  assert(!src.includes('function HeroLine'), 'the line is RollingGainPair, shared, not a Portfolio copy');
  assert(src.includes('<RollingGainPair') && src.includes('words="today"'));
  assert(src.includes('accessibilityLabel={`${v.todaySpoken} today`}'), 'VoiceOver says it in the same order, comma-joined (todaySpoken), never the brackets');
  assert(src.includes('color={toneColor(colors, v.todayTone)}'), 'the colour is the sign\'s (zero is the neutral grey)');
  const pair = strip(gainPairSrc);
  assert(pair.includes('GAIN_PAIR_OPEN') && pair.includes('GAIN_PAIR_CLOSE'), 'a bracket around the percent');
  assert(!pair.includes('·'), 'no dot between the numbers');
});

Deno.test('the card passes its lots to the chart (P/L gain, the line coloured by it); the stock sheet stays per share', () => {
  assert(strip(cardSrc).includes('lots={lots}'));
  assert(!/lots=/.test(strip(stockSheetSrc)), 'the sheet draws per share');
  const src = strip(stockChartSrc);
  // A live season measures to today's price (todayEt, `price`); a finished one to its frozen end price (gainPrice).
  assert(src.includes('holdingRangeGain({ lots, start: rangeFirstDay(range, series.axis, frozen ? endEt! : todayEt, seasonStart), base: series.base, price: gainPrice })'));
  assert(src.includes('const gainPrice = frozen ? frozen.endPrice : price;'));
  assert(src.includes('const gain = ready ? holding ?? rangeGain(series.points, series.base) : null;'));
  assert(src.includes('tone={holding ? holding.tone : undefined}'), 'the colour follows the gain line when it is the holding\'s P/L');
});
