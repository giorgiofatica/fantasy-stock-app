/**
 * A finished season's Portfolio (Giorgio, 2026-11-18, pick A: "just the chart"; the value stops at the
 * season's last day). Pinned:
 *   F3  dailyValues({ endEt }) runs to and including endEt, never past it, at real closes only (a missing
 *       bar is the last close before it, never a guess or $0); finishedPortfolioSeries is Season, no live
 *       point, its axis from the draft to endEt; today plays no part.
 *   F4  teamPortfolioView finished: the hero = the sum of the holding rows = the chart's last point; the
 *       gain is that value minus the draft-day value; no today, no slots facts, no cash, no buy row.
 *   F7  nothing in a finished season reads the live quote: feeding wild live prices, or moving the market
 *       after the season, changes nothing (logic), and the hooks never request or seam-read a quote then
 *       (source).
 * Run: cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { dailyValues, finishedPortfolioSeries, seasonEndCloses, type ChartActivityRow } from '../lib/money/portfolioChart.ts';
import { teamPortfolioView, type TeamPortfolioInput } from '../lib/money/teamPortfolioView.ts';
import { playerPortfolio } from '../lib/money/playerPortfolio.ts';
import { rangeGain } from '../lib/chart/chartRanges.ts';
import { formatMoney } from '../components/sp/logic/money.ts';
import type { PortfolioLedger } from '../lib/money/portfolioLedger.ts';
import { seasonEndEt } from '../lib/money/seasonEnd.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const DRAFT_AT = '2026-09-01T00:30:00.000Z'; // Mon Aug 31, 8:30 PM ET
const STAKE = { stakeMode: 'budget_cap' as const, notionalPerSlot: null, numRounds: 2 };
const ROWS: ChartActivityRow[] = [
  { kind: 'draft', action: 'buy', symbol: 'NVDA', quantity: 1, price: 100, occurredAt: DRAFT_AT },
  { kind: 'draft', action: 'buy', symbol: 'AAPL', quantity: 2, price: 25, occurredAt: DRAFT_AT },
];
// The season ends Thu Sep 3. AAPL has no bar on Sep 2. Everything after Sep 3 is the market moving on.
const BARS = {
  NVDA: [{ date: '2026-09-01', close: 110 }, { date: '2026-09-02', close: 120 }, { date: '2026-09-03', close: 90 }, { date: '2026-09-04', close: 130 }, { date: '2026-09-08', close: 200 }],
  AAPL: [{ date: '2026-09-01', close: 30 }, { date: '2026-09-03', close: 28 }, { date: '2026-09-04', close: 40 }, { date: '2026-09-08', close: 50 }],
};
const END = '2026-09-03';

// ── F3: the line ───────────────────────────────────────────────────────────────────────

Deno.test('F3: the days run to and including the season\'s last day, never past it', () => {
  const d = dailyValues({ rows: ROWS, bars: BARS, stake: STAKE, todayEt: '2026-11-18', endEt: END });
  assertEquals(d, [
    { date: '2026-08-31', value: 150 },
    { date: '2026-09-01', value: 170 },
    // AAPL's missing Sep 2 bar is its Sep 1 close, never a guess or $0.
    { date: '2026-09-02', value: 180 },
    { date: '2026-09-03', value: 146 },
  ]);
  assert(d.every((x) => x.date <= END), 'no point after endEt');
});

Deno.test('F3: today plays no part once the season is over (any today, the same line)', () => {
  const a = dailyValues({ rows: ROWS, bars: BARS, stake: STAKE, todayEt: '2026-09-02', endEt: END });
  const b = dailyValues({ rows: ROWS, bars: BARS, stake: STAKE, todayEt: '2027-06-01', endEt: END });
  assertEquals(a, b);
});

Deno.test('F3: the last point is the last REAL close on or before endEt (a weekend end reads Friday)', () => {
  // Ends Sat Sep 5: the last close on or before it is Fri Sep 4.
  const d = dailyValues({ rows: ROWS, bars: BARS, stake: STAKE, todayEt: '2026-11-18', endEt: '2026-09-05' });
  assertEquals(d[d.length - 1], { date: '2026-09-04', value: 130 + 2 * 40 });
  assertEquals(seasonEndCloses(BARS, ['NVDA', 'aapl'], '2026-09-05'), { NVDA: 130, AAPL: 40 });
});

Deno.test('F3: a stock with no bar by the season\'s end counts at cost, never $0', () => {
  const rows = [...ROWS, { kind: 'draft' as const, action: 'buy' as const, symbol: 'NEW', quantity: 4, price: 10, occurredAt: DRAFT_AT }];
  const bars = { ...BARS, NEW: [{ date: '2026-09-08', close: 99 }] };
  const d = dailyValues({ rows, bars, stake: STAKE, todayEt: '2026-11-18', endEt: END });
  assertEquals(d[d.length - 1].value, 146 + 40);
  assertEquals(seasonEndCloses(bars, ['NEW'], END), {});
});

Deno.test('F3: the finished series is Season, with no live point, on an axis from the draft to endEt', () => {
  const daily = dailyValues({ rows: ROWS, bars: BARS, stake: STAKE, todayEt: '2026-11-18', endEt: END });
  const s = finishedPortfolioSeries({ daily, endEt: END });
  assertEquals(s.points.map((p) => p.value), [150, 170, 180, 146]);
  assertEquals(s.base, 150);
  assertEquals(s.axis, { kind: 'dated', start: '2026-08-31', end: END });
  assertEquals(rangeGain(s.points, s.base)?.money, -4);
  // A Saturday end: the last close is Friday's, the axis still reaches the season's last day.
  const sat = finishedPortfolioSeries({ daily: dailyValues({ rows: ROWS, bars: BARS, stake: STAKE, todayEt: '2026-11-18', endEt: '2026-09-05' }), endEt: '2026-09-05' });
  assertEquals(sat.axis, { kind: 'dated', start: '2026-08-31', end: '2026-09-05' });
  assertEquals(sat.points[sat.points.length - 1].value, 210);
});

// ── F4: the view ───────────────────────────────────────────────────────────────────────

function input(over: Partial<TeamPortfolioInput> = {}): TeamPortfolioInput {
  return {
    drafts: [{ symbol: 'NVDA', entryPrice: 100, quantity: 1 }, { symbol: 'AAPL', entryPrice: 25, quantity: 2 }],
    trades: [],
    chartRows: ROWS,
    names: { NVDA: 'NVIDIA Corp', AAPL: 'Apple Inc.' },
    stake: STAKE,
    live: { prices: { NVDA: 140, AAPL: 45 }, prevCloses: { NVDA: 130, AAPL: 40 } },
    bars: BARS,
    endEt: END,
    buyRow: { stakeMode: 'budget_cap', sales: [], budgetLeft: 500, rosterFull: false, openSlotLabels: [] },
    ...over,
  };
}

Deno.test('F4: the hero = the sum of the holding rows = the chart\'s last point', () => {
  const { view, liveValue } = teamPortfolioView(input());
  const chartLast = finishedPortfolioSeries({ daily: dailyValues({ rows: ROWS, bars: BARS, stake: STAKE, todayEt: '2026-11-18', endEt: END }), endEt: END }).points.at(-1)!.value;
  const rowsSum = view.rows.reduce((a, r) => a + r.value, 0);
  assertEquals(view.valueText, formatMoney(146));
  assertEquals(rowsSum, 146);
  assertEquals(chartLast, 146);
  assertEquals(liveValue, null, 'no live point');
  // Each row is shares × its close on or before endEt.
  assertEquals(view.rows.map((r) => [r.symbol, r.value, r.valueIsCost]), [['NVDA', 90, false], ['AAPL', 56, false]]);
});

Deno.test('F4: "since the draft" is the value minus the draft-day value, and nothing live is left', () => {
  const { view } = teamPortfolioView(input());
  assertEquals(view.valueLabel, 'Portfolio value');
  assertEquals(view.gainMoneyText, formatMoney(-4, { sign: 'always' }));
  assertEquals(view.gainTone, 'loss');
  assertEquals([view.todayText, view.todayMoneyText, view.todayPctText, view.todayTone], [null, null, null, null]);
  assertEquals(view.rows.map((r) => r.todayText), [null, null]);
  assertEquals([view.slotsText, view.perSlotText, view.cashText, view.cashValueText, view.buyRowText], [null, null, null, null, null]);
});

Deno.test('F4: a fixed-notional league loses its facts row ("N of N slots invested") once over', () => {
  const stake = { stakeMode: 'fixed_notional' as const, notionalPerSlot: 75, numRounds: 2 };
  const live = teamPortfolioView(input({ stake, endEt: null }));
  const over = teamPortfolioView(input({ stake }));
  assert(live.view.slotsText != null, 'the live view has its facts row');
  assertEquals(over.view.slotsText, null);
  assertEquals(over.view.perSlotText, null);
});

Deno.test('F4: a live season is unchanged (the quote, today, the buy row)', () => {
  const { view, liveValue } = teamPortfolioView(input({ endEt: null }));
  assertEquals(liveValue, 140 + 90);
  assertEquals(view.valueText, formatMoney(230));
  assert(view.todayText != null);
  assert(view.rows.every((r) => r.todayText != null));
});

// ── F7: no live quote in a finished season ──────────────────────────────────────────────

Deno.test('F7: wild live prices change nothing once the season is over', () => {
  const quiet = teamPortfolioView(input({ live: { prices: {}, prevCloses: {} } }));
  const wild = teamPortfolioView(input({ live: { prices: { NVDA: 9999, AAPL: 0.01 }, prevCloses: { NVDA: 1, AAPL: 1 } } }));
  assertEquals(wild, quiet);
});

Deno.test('F7: the market moving on after the season changes nothing (the frozen proof)', () => {
  const later = {
    NVDA: [...BARS.NVDA, { date: '2026-10-01', close: 500 }],
    AAPL: [...BARS.AAPL, { date: '2026-10-01', close: 500 }],
  };
  assertEquals(teamPortfolioView(input({ bars: later })), teamPortfolioView(input()));
});

const LEDGER: PortfolioLedger = {
  activity: [
    { kind: 'draft', user_id: 'm2', symbol: 'NVDA', action: 'buy', quantity: 1, round: 1, pick_number: 2, occurred_at: DRAFT_AT, total_value: null, price: 100 },
    { kind: 'draft', user_id: 'm2', symbol: 'AAPL', action: 'buy', quantity: 2, round: 2, pick_number: 3, occurred_at: DRAFT_AT, total_value: null, price: 25 },
  ],
  symbol_names: { NVDA: 'NVIDIA Corp', AAPL: 'Apple Inc.' },
  members: [{ user_id: 'm2', display_name: 'Paolo M.', is_bot: false }],
} as PortfolioLedger;

Deno.test('F6/F7: a manager\'s finished team is the same figures, and never reads their live prices', () => {
  const base = { ledger: LEDGER, userId: 'm2', stakeMode: 'budget_cap' as const, notionalPerSlot: null, numRounds: 2 };
  const quiet = playerPortfolio({ ...base, prices: {}, prevCloses: {}, finished: { endEt: END, bars: BARS } })!;
  const wild = playerPortfolio({ ...base, prices: { NVDA: 9999, AAPL: 9999 }, prevCloses: { NVDA: 1, AAPL: 1 }, finished: { endEt: END, bars: BARS } })!;
  assertEquals(wild, quiet);
  assertEquals(quiet.view.valueText, formatMoney(146));
  assertEquals(quiet.view.rows.reduce((a, r) => a + r.value, 0), 146);
  assertEquals(quiet.view.todayText, null);
  assertEquals(quiet.view.cashValueText, null);
  // Live, the same team reads its quote (the finished mode is what froze it).
  const live = playerPortfolio({ ...base, prices: { NVDA: 140, AAPL: 45 }, prevCloses: { NVDA: 130, AAPL: 40 } })!;
  assertEquals(live.view.valueText, formatMoney(230));
});

// The hooks: no quote request and no seam quote once the season is over (a regression here would
// put a live price within reach of the view again, whatever teamPortfolioView does with it).
const src = (p: string) => Deno.readTextFileSync(new URL(p, import.meta.url));

Deno.test('F7 (source): the hooks read bars only, never the quote, in a finished season', () => {
  for (const file of ['../lib/money/usePortfolioData.ts', '../lib/money/usePlayerPortfolioData.ts']) {
    const s = src(file);
    assert(/readPriceMarks\([^\n]*barsOnly: finished/.test(s), `${file}: the real read passes barsOnly: finished`);
    assert(/finished \? null : seamQuote\(/.test(s), `${file}: the seam never quotes a finished season`);
  }
  const reads = src('../lib/money/priceReads.ts');
  assert(/if \(!opts\.barsOnly\) \{\s*out\.requests \+= 1;\s*const \{ data: quoteData, error: quoteError \} = await supabase\.functions\.invoke\('quote'/.test(reads), 'barsOnly skips the quote request');
  const hook = src('../lib/money/usePortfolioData.ts');
  assert(/endEt: finished \? endEt : null,/.test(hook), 'the view is built in finished mode');
  // The stress market's live prices are skipped too.
  assert(/if \(!finished\) \{\s*for \(const \[sym, p\] of Object\.entries\(market\.prices\)\)/.test(hook));
});

Deno.test('F5 (source): the finished Portfolio has no pills, no facts, no buy row, no live dot, a "Value" header', () => {
  const s = src('../components/money/PortfolioScreen.tsx');
  assert(s.includes('const finished = isSeasonOver(activeLeague, new Date(), marketCalendar);'));
  assert(/\{over \? null : \(\s*<View style=\{styles\.pillsRow\}>\s*<RangePills/.test(s), 'no range pills');
  assert(s.includes("{!over && (v.cashValueText || v.slotsText) ? ("), 'no facts block');
  assert(!s.includes('portfolio-buy-a-stock'), 'no Buy a stock (it left Portfolio entirely, 2026-11-18: buying lives on the Stocks tab)');
  assert(s.includes('live={over ? false : marketOpen}'), 'no live dot');
  assert(s.includes("{over ? 'Value' : 'Value · today'}"), 'the holdings header');
  assert(s.includes('{!over && v.todayMoneyText && v.todayPctText ? ('), 'no today line');
  assert(s.includes('<PhaseChip phase="season_complete" label="Final" />'), 'the Final chip');
  assert(!/season_status ===/.test(s), 'no new season_status check: isSeasonOver is the one predicate');
  const p = src('../components/money/PlayerPortfolioScreen.tsx');
  assert(p.includes('const finished = isSeasonOver(activeLeague, new Date(), marketCalendar);'));
  assert(p.includes("{finished ? 'Value' : 'Value · today'}"));
  assert(!/season_status ===/.test(p));
});

// buildPortfolioView's own finished guards, fed what a careless caller could pass: previous closes
// and real cash. (teamPortfolioView nulls the closes first; these pin the view itself.)
import { buildPortfolioView } from '../lib/money/portfolioView.ts';

Deno.test('F4: buildPortfolioView finished drops today even when previous closes are passed', () => {
  const v = buildPortfolioView({
    value: 300, cash: 0, stake: 250, numRounds: 1, perSlotNotional: null, stakeMode: 'budget_cap',
    holdings: [{ symbol: 'NVDA', quantity: 2, costBasis: 200, price: 150, prevClose: 140, name: 'NVIDIA Corp' }],
    finished: { draftValue: 200 },
  });
  assertEquals([v.todayText, v.todayMoneyText, v.todayPctText, v.todayTone], [null, null, null, null]);
  assertEquals(v.rows[0].todayText, null);
  assertEquals(v.rows[0].value, 300);
  // The gain is from the draft-day value (200), not the stake (250).
  assertEquals(v.gainMoneyText, formatMoney(100, { sign: 'always' }));
});

Deno.test('F4: buildPortfolioView finished shows no cash, no slots facts and no buy row even when they exist', () => {
  const buyRow = { stakeMode: 'budget_cap' as const, sales: [], budgetLeft: 500, rosterFull: false, openSlotLabels: [] };
  const base = {
    value: 300, cash: 75, stake: 250, numRounds: 1, perSlotNotional: 250,
    holdings: [{ symbol: 'NVDA', quantity: 2, costBasis: 200, price: 150, prevClose: 140, name: 'NVIDIA Corp' }], buyRow,
  };
  const live = buildPortfolioView({ ...base, stakeMode: 'budget_cap' });
  assert(live.cashValueText != null && live.buyRowText != null, 'the live view has them (the mutant would pass otherwise)');
  const over = buildPortfolioView({ ...base, stakeMode: 'budget_cap', finished: { draftValue: 200 } });
  assertEquals([over.cashText, over.cashValueText, over.buyRowText, over.slotsText], [null, null, null, null]);
  // A finished team's cash is not a row, but it IS in the value: the label says so (the live screen's own words).
  assert(over.valueLabel.includes('includes cash'), over.valueLabel);
  assertEquals(over.valueLabel, live.valueLabel);
});

Deno.test('F4: a finished team with no cash keeps the plain "Portfolio value" label', () => {
  const v = buildPortfolioView({
    value: 300, cash: 0, stake: 250, numRounds: 1, perSlotNotional: null, stakeMode: 'budget_cap',
    holdings: [{ symbol: 'NVDA', quantity: 2, costBasis: 200, price: 150, prevClose: null, name: 'NVIDIA Corp' }],
    finished: { draftValue: 200 },
  });
  assertEquals(v.valueLabel, 'Portfolio value');
});

// ── The finished chart's axis ends at the season's last day, whatever the clock says ─────────────────

Deno.test('a finished chart\'s axis ends at the season\'s last day, not today, with the clock weeks later', () => {
  // The league's matchups end Fri Sep 25 (the final's week_end, Sep 25 4 PM ET); the season was stamped complete
  // on Nov 20; today is Dec 31. The last day is the latest SCORED matchup's (team1_gain posted, #555), never
  // completed_at's, never today.
  const matchups = [{ week_end: '2026-09-18T20:00:00.000Z', team1_gain: 1.5 }, { week_end: '2026-09-25T20:00:00.000Z', team1_gain: -0.4 }];
  const endEt = seasonEndEt(matchups, '2026-11-20T15:00:00.000Z');
  assertEquals(endEt, '2026-09-25');
  for (const todayEt of ['2026-09-26', '2026-11-18', '2026-12-31']) {
    const daily = dailyValues({ rows: ROWS, bars: BARS, stake: STAKE, todayEt, endEt });
    const s = finishedPortfolioSeries({ daily, endEt: endEt! });
    assertEquals(s.axis, { kind: 'dated', start: '2026-08-31', end: '2026-09-25' }, `today ${todayEt}`);
  }
  // With NO matchups read at all, completed_at's ET date is the (only) fallback: a league whose last day is
  // really that late ends there, by design. A capture fixture with no matchups therefore shows a long axis.
  assertEquals(seasonEndEt([], '2026-11-20T15:00:00.000Z'), '2026-11-20');
  assertEquals(seasonEndEt([], null), null);
});

Deno.test('Portfolio\'s finished branch builds its series and days from the season end, today plays no part', () => {
  const code = (SOURCES['components/money/PortfolioScreen.tsx'] ?? '').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  // The end is the WHOLE league's last scored week (useSeasonEnd, #555), never Home's caller-scoped matchups.
  assert(code.includes("const endEt = finished && seasonEnd.status === 'ready' ? seasonEnd.endEt : null;"));
  assert(!code.includes('seasonEndEt(leagueRaw'), 'never the caller-scoped matchups');
  assert(code.includes('dailyValues({ rows: chart.rows, bars: chart.bars, stake: chart.stake, todayEt, endEt: chartEnd })'));
  assert(code.includes('chartEnd ? finishedPortfolioSeries({ daily, endEt: chartEnd })'), 'finished: the series is the season-end one');
  assert(code.indexOf('finishedPortfolioSeries({ daily, endEt: chartEnd })') < code.indexOf('portfolioSeries({ range: shownRange'), 'checked before the live path');
  assert(!/finishedPortfolioSeries\([^)]*todayEt/.test(code), 'the finished series is never handed todayEt');
});
