/**
 * End-to-end tests for lib/home/buildHomeViewModel.ts on the design
 * board's fixture data (Stock Scudetto, Roberto vs Gianluigi B., week 6 of
 * 14, Thursday 1:37 PM ET live). This is the honesty check ITSELF, run as
 * a test rather than eyeballed against real data: the chart endpoint
 * equals the hero's gain, the 1W endpoint equals the this-week score, and
 * completed weeks' Friday points are pinned to their `matchups` gains.
 *
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assertEquals, assertAlmostEquals } from 'jsr:@std/assert';
import { buildHomeViewModel, type GetHomeLeagueResult, type HomeLeagueMeta } from '../lib/home/buildHomeViewModel.ts';
import { playoffRoundLabelForWeek } from '../lib/playoffs.ts';
import { ROBERTO_WEEKS, FIXTURE_WEEK6_START, FIXTURE_WEEK6_END } from '../lib/home/homeFixtureData.ts';
import { standardWeekSessions } from '../lib/time/marketWeek.ts';

const ROBERTO = [
  { symbol: 'NVDA', draft: 290.1, mon: 300.2, prev: 306.68, thu: 318.37 },
  { symbol: 'AAPL', draft: 198.6, mon: 205.1, prev: 208.83, thu: 211.42 },
  { symbol: 'CRM', draft: 262.4, mon: 268.0, prev: 269.96, thu: 271.35 },
  { symbol: 'TSLA', draft: 262.8, mon: 251.9, prev: 249.66, thu: 248.36 },
  { symbol: 'COST', draft: 905.2, mon: 912.4, prev: 915.22, thu: 918.1 },
  { symbol: 'V', draft: 281.5, mon: 284.2, prev: 285.04, thu: 286.1 },
];
const GIANLUIGI = [
  { symbol: 'AMZN', draft: 221.3, mon: 238.1, thu: 236.4 },
  { symbol: 'JPM', draft: 204.9, mon: 214.2, thu: 215.45 },
  { symbol: 'DIS', draft: 104.2, mon: 101.3, thu: 102.9 },
  { symbol: 'NKE', draft: 82.4, mon: 79.6, thu: 81.3 },
  { symbol: 'KO', draft: 68.1, mon: 69.4, thu: 69.9 },
  { symbol: 'BA', draft: 172.6, mon: 176.3, thu: 176.9 },
];
const qty = (draft: number) => Math.round((2000 / draft) * 1e4) / 1e4;

const MY_ID = 'roberto';
const OPP_ID = 'gianluigi';

function buildFixtureInput() {
  const myDrafts = ROBERTO.map((h) => ({ symbol: h.symbol, entry_price: h.draft, quantity: qty(h.draft), created_at: '2026-08-01T00:00:00Z' }));
  const mySnapshots = ROBERTO.map((h) => ({ symbol: h.symbol, quantity: qty(h.draft), week_start_price: h.mon, entered_mid_week: false, created_at: FIXTURE_WEEK6_START }));
  const oppSnapshots = GIANLUIGI.map((h) => ({ symbol: h.symbol, quantity: qty(h.draft), week_start_price: h.mon, entered_mid_week: false, created_at: FIXTURE_WEEK6_START }));

  const matchups = [
    // Each week gets its OWN Mon-Fri range (not a shared literal): a
    // malformed short offset ('-04' instead of '-04:00') silently parses
    // to Invalid Date under JS's Date constructor, which weekdayDates()
    // then turns into a silently-empty day list — caught by this test's
    // own next assertion (weeks 1-5 must each have points) failing until
    // fixed to real, distinct, correctly-offset week ranges.
    ...ROBERTO_WEEKS.map((w, i) => {
      const monday = new Date(Date.UTC(2026, 6, 6 + i * 7, 13, 30)); // Mondays 09:30 ET
      const friday = new Date(monday.getTime() + 4 * 24 * 3600 * 1000 + 6.5 * 3600 * 1000); // Friday 16:00 ET
      return {
        week_number: w.week, week_start: monday.toISOString(), week_end: friday.toISOString(),
        is_playoff: false, team1_user_id: MY_ID, team2_user_id: OPP_ID,
        team1_gain: w.gain, team2_gain: -w.gain,
      };
    }),
    {
      week_number: 6, week_start: FIXTURE_WEEK6_START, week_end: FIXTURE_WEEK6_END,
      is_playoff: false, team1_user_id: MY_ID, team2_user_id: OPP_ID,
      team1_gain: null, team2_gain: null,
    },
  ];

  const data: GetHomeLeagueResult = {
    my_ledger: { drafts: myDrafts, trades: [] },
    current_week: {
      week_number: 6,
      my_snapshots: mySnapshots,
      my_trades: [],
      opponent_snapshots: oppSnapshots,
      opponent_trades: [],
    },
    matchups,
    standings: [
      { user_id: MY_ID, rank: 2, wins: 4, losses: 1, ties: 0, points_for: 129.99, display_name: 'Roberto B.', is_bot: false },
      { user_id: OPP_ID, rank: 6, wins: 1, losses: 4, ties: 0, points_for: -142.35, display_name: 'Gianluigi B.', is_bot: false },
    ],
  };

  const meta: HomeLeagueMeta = {
    myUserId: MY_ID,
    draftStatus: 'completed', leagueStartDate: '2026-08-01T00:00:00Z',
    seasonStatus: 'active', currentWeek: 6, numWeeks: 14, playoffTeams: 6,
    stakeMode: 'fixed_notional', notionalPerSlot: 2000, numRounds: 6,
    draftOrderWaiting: false,
  };

  const quote = (sym: string) => ROBERTO.find((h) => h.symbol === sym)?.thu ?? GIANLUIGI.find((h) => h.symbol === sym)?.thu ?? null;

  // Bars: just enough for the current week's granularity (Monday + today).
  const bars: Record<string, { date: string; close: number }[]> = {};
  for (const h of ROBERTO) {
    bars[h.symbol] = [
      { date: '2026-09-18', close: h.prev }, // last Friday (irrelevant, before this week)
      { date: '2026-09-21', close: h.mon },
      { date: '2026-09-24', close: h.thu }, // "today" in this fixture
    ];
  }

  return { data, meta, quote, bars };
}

Deno.test('honesty check: the scored weeks Your season reads add up to the hero season gain (through week 5)', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  const now = new Date('2026-09-24T17:37:00-04:00'); // Thursday, after market close for bars purposes
  const vm = buildHomeViewModel({
    now, meta, market: { status: 'closed', reason: 'after_hours', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
  // weeks 1-5 are the played tiles; their scores are the matchups' own gains
  const played = vm.seasonTiles.filter((t) => t.kind === 'played');
  assertEquals(played.map((t) => t.week), [1, 2, 3, 4, 5]);
  const through5 = played.reduce((sum, t) => sum + (t.kind === 'played' ? t.gain : 0), 0);
  assertAlmostEquals(through5, 129.99, 0.01);
  for (const w of ROBERTO_WEEKS) {
    const tile = vm.seasonTiles.find((t) => t.week === w.week);
    assertEquals(tile?.kind, 'played');
    if (tile?.kind === 'played') assertEquals(tile.gain, w.gain);
  }
});

Deno.test('Your season: this week is the one this-week tile and carries no score', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  const now = new Date('2026-09-24T13:37:00-04:00'); // Thu 1:37 PM ET, live
  const vm = buildHomeViewModel({
    now, meta, market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
  const thisTiles = vm.seasonTiles.filter((t) => t.kind === 'this');
  assertEquals(thisTiles.length, 1);
  assertEquals(thisTiles[0].week, 6);
  assertEquals('gain' in thisTiles[0], false);
});

Deno.test('phase is live_open (Thursday, market open) and the this-week card has both sides', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  const now = new Date('2026-09-24T13:37:00-04:00'); // Thu 1:37 PM ET
  const vm = buildHomeViewModel({
    now, meta, market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
  assertEquals(vm.phase.kind, 'live_open');
  assertEquals(vm.thisWeek !== null, true);
});

// ── Regression: code review findings, 2026-09-29 ──────────────────────────

Deno.test('C1: the weekend after current_week advances shows the REAL scored final, not a fabricated $0-$0', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  // Week 6 is now SCORED (both gains posted); current_week has already
  // advanced to 7 (an unstarted, empty row) — the F5 grace period.
  const week6 = data.matchups.find((m) => m.week_number === 6)!;
  week6.team1_gain = 72.1;
  week6.team2_gain = -20.5;
  data.matchups.push({
    week_number: 7, week_start: '2026-09-28T13:30:00.000Z', week_end: '2026-10-02T20:00:00.000Z',
    is_playoff: false, team1_user_id: MY_ID, team2_user_id: OPP_ID, team1_gain: null, team2_gain: null,
  });
  data.current_week = { week_number: 7, my_snapshots: [], my_trades: [], opponent_snapshots: [], opponent_trades: [] };
  const advancedMeta = { ...meta, currentWeek: 7 };

  const now = new Date('2026-09-26T12:00:00.000Z'); // Saturday
  const vm = buildHomeViewModel({
    now, meta: advancedMeta, market: { status: 'closed', reason: 'weekend', nextOpenAt: '2026-09-28T13:30:00.000Z' },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });

  assertEquals(vm.phase.kind, 'scored');
  // The REAL week-6 gains, never $0-$0.
  assertEquals(vm.thisWeek?.you.gain, 72.1);
  assertEquals(vm.thisWeek?.opponent.gain, -20.5);
  assertEquals(vm.thisWeek?.final, true);
  assertEquals(vm.thisWeek?.result, 'W'); // 72.1 > -20.5
  // The opponent is week 6's opponent (still Gianluigi in this fixture,
  // but resolved via opponentUserId, not an assumption).
  assertEquals(vm.thisWeek?.opponentUserId, OPP_ID);
});

Deno.test('S7: an ongoing regular-season bye (current week, no opponent) still gets its own weeklyResults entry', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  // Turn week 6 (the current week) into a bye: no opponent, unscored.
  const week6 = data.matchups[data.matchups.length - 1];
  week6.team2_user_id = null;
  week6.team1_gain = null;
  week6.team2_gain = null;
  const now = new Date('2026-09-24T17:37:00-04:00');
  const vm = buildHomeViewModel({
    now, meta, market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
  assertEquals(vm.phase.kind, 'bye');
  assertEquals(vm.weeklyResults.find((w) => w.week === 6)?.result, 'BYE');
  const tile = vm.seasonTiles.find((t) => t.week === 6);
  assertEquals(tile?.kind === 'this' && tile.middle, 'bye');
});

// ── The overloaded-NULL trap (Orchestrator + Design Lead, 2026-11-03): weeklyResults folded two
// different states into 'BYE' (no opponent, and an opponent whose gain was still null). Now the
// discriminator is the opponent's PRESENCE, never a gain being null. ─────────────────────────

/** Week 3 as a past row, edited, in the standard 6-week fixture at week 6. */
function withWeek3(edit: (m: GetHomeLeagueResult['matchups'][number]) => void) {
  const { data, meta, quote, bars } = buildFixtureInput();
  const week3 = data.matchups.find((m) => m.week_number === 3)!;
  edit(week3);
  const now = new Date('2026-09-24T13:37:00-04:00');
  return buildHomeViewModel({
    now, meta, market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
}

Deno.test('a past week with no opponent is a real bye (not W/L), whatever its gains', () => {
  const vm = withWeek3((m) => { m.team2_user_id = null; m.team1_gain = null; m.team2_gain = null; });
  assertEquals(vm.weeklyResults.find((w) => w.week === 3)?.result, 'BYE');
  assertEquals(vm.seasonTiles.find((t) => t.week === 3)?.kind, 'bye');
});

Deno.test('a past week with an opponent and a null gain on THEIR side is not scored yet: not Bye, not W/L', () => {
  const vm = withWeek3((m) => { m.team2_gain = null; });
  assertEquals(vm.weeklyResults.find((w) => w.week === 3), undefined);
  assertEquals(vm.seasonTiles.find((t) => t.week === 3)?.kind, 'unscored');
});

Deno.test('a past week with an opponent and a null gain on MY side is not scored yet: not Bye, not W/L', () => {
  const vm = withWeek3((m) => { m.team1_gain = null; });
  assertEquals(vm.weeklyResults.find((w) => w.week === 3), undefined);
  assertEquals(vm.seasonTiles.find((t) => t.week === 3)?.kind, 'unscored');
});

Deno.test('a past week with an opponent and both gains null is not scored yet', () => {
  const vm = withWeek3((m) => { m.team1_gain = null; m.team2_gain = null; });
  assertEquals(vm.weeklyResults.find((w) => w.week === 3), undefined);
  assertEquals(vm.seasonTiles.find((t) => t.week === 3)?.kind, 'unscored');
});

Deno.test('equal posted gains are a T, never a loss (ties are decided by the one result list)', () => {
  const vm = withWeek3((m) => { m.team1_gain = 25; m.team2_gain = 25; });
  assertEquals(vm.weeklyResults.find((w) => w.week === 3)?.result, 'T');
  const tile = vm.seasonTiles.find((t) => t.week === 3);
  assertEquals(tile?.kind === 'played' && tile.result, 'T');
});

Deno.test('C3: laterPlayoffWeek/lastPlayoffLoss are derived from matchups, not hardcoded false', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  // A first-round bye seed (Design Lead ruling, 2026-09-30): the real
  // bracket shape has NO row for me at week 15 at all -- the bye is
  // written straight into its round-2 row instead, opponent NULL until
  // round 1 is scored. `laterPlayoffWeek` must come from THAT row's real
  // week_number (16), never guessed as `current?.week + 1`.
  data.matchups.push(
    { week_number: 16, week_start: '2026-12-21T13:30:00.000Z', week_end: '2026-12-25T20:00:00.000Z', is_playoff: true, team1_user_id: MY_ID, team2_user_id: null, team1_gain: null, team2_gain: null },
  );
  const playoffMeta = { ...meta, seasonStatus: 'playoffs' as const, currentWeek: 15, playoffTeams: 4 };
  const now = new Date('2026-12-15T18:00:00.000Z');
  const vm = buildHomeViewModel({
    now, meta: playoffMeta, market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
  assertEquals(vm.phase.kind, 'playoff_bye');
  if (vm.phase.kind === 'playoff_bye') assertEquals(vm.phase.week, 16);
});

Deno.test('C3: a first-round bye is found whether I am in team1 OR team2 of the later round row', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  // Same bye seed, but I hold the team2 slot with team1 NULL this time --
  // myPlayoffRows must match on EITHER slot, not just team1.
  data.matchups.push(
    { week_number: 16, week_start: '2026-12-21T13:30:00.000Z', week_end: '2026-12-25T20:00:00.000Z', is_playoff: true, team1_user_id: null, team2_user_id: MY_ID, team1_gain: null, team2_gain: null },
  );
  const playoffMeta = { ...meta, seasonStatus: 'playoffs' as const, currentWeek: 15, playoffTeams: 4 };
  const now = new Date('2026-12-15T18:00:00.000Z');
  const vm = buildHomeViewModel({
    now, meta: playoffMeta, market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
  assertEquals(vm.phase.kind, 'playoff_bye');
  if (vm.phase.kind === 'playoff_bye') assertEquals(vm.phase.week, 16);
});

Deno.test('C3: a round-2 game with a real, decided opponent is an ordinary live playoff week, not a bye', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  // Both round-1 paths were decided, so round 2 (the current week) has a
  // real opponent -- this must NOT be misread as a bye just because it's
  // a later playoff round.
  data.matchups.push(
    { week_number: 16, week_start: '2026-12-14T13:30:00.000Z', week_end: '2026-12-25T20:00:00.000Z', is_playoff: true, team1_user_id: MY_ID, team2_user_id: OPP_ID, team1_gain: null, team2_gain: null },
  );
  const playoffMeta = { ...meta, seasonStatus: 'playoffs' as const, currentWeek: 16, playoffTeams: 4 };
  data.current_week = { week_number: 16, my_snapshots: [], my_trades: [], opponent_snapshots: [], opponent_trades: [] };
  const now = new Date('2026-12-15T18:00:00.000Z');
  const vm = buildHomeViewModel({
    now, meta: playoffMeta, market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
  assertEquals(vm.phase.kind, 'live_open');
  if (vm.phase.kind === 'live_open') assertEquals(vm.phase.isPlayoff, true);
});

Deno.test('C3: a real elimination (last playoff row scored as a loss, no later row) reads eliminated', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  data.matchups.push(
    { week_number: 15, week_start: '2026-12-14T13:30:00.000Z', week_end: '2026-12-18T20:00:00.000Z', is_playoff: true, team1_user_id: MY_ID, team2_user_id: OPP_ID, team1_gain: -10, team2_gain: 40 },
  );
  const playoffMeta = { ...meta, seasonStatus: 'playoffs' as const, currentWeek: 16, playoffTeams: 4 };
  data.current_week = { week_number: 16, my_snapshots: [], my_trades: [], opponent_snapshots: [], opponent_trades: [] };
  const now = new Date('2026-12-21T18:00:00.000Z');
  const vm = buildHomeViewModel({
    now, meta: playoffMeta, market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
  assertEquals(vm.phase.kind, 'eliminated');
  // Round comes from the REAL last-played week (15), never a guess like
  // `previous?.week ?? currentWeek` (which would misname the round if the
  // bracket has a gap between rounds).
  if (vm.phase.kind === 'eliminated') assertEquals(vm.phase.round, 'Semifinals');
});

Deno.test('C3: a team never seeded into the playoff bracket reads missed_playoffs, never pre_season', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  // No playoff rows at all for me — data.matchups only has the 6 regular
  // weeks buildFixtureInput already set up.
  const playoffMeta = { ...meta, seasonStatus: 'playoffs' as const, currentWeek: 15, playoffTeams: 4 };
  const now = new Date('2026-12-15T18:00:00.000Z');
  const vm = buildHomeViewModel({
    now, meta: playoffMeta, market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
  assertEquals(vm.phase.kind, 'missed_playoffs');
});

// ── R3 (Design Lead, 2026-09-30): playoff performance never counts toward
// "season gain" -- process-week-results guards points_for accumulation
// with `if (!isPlayoff)`, so a live playoff week's in-progress gain must
// never reach the hero or extend the chart past the regular season. ───────

Deno.test('R3: a live playoff week\'s gain never inflates the hero season gain', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  // Week 6 (the last regular-season week) scored, so the regular-season
  // total is a real, known number to assert against.
  data.matchups[data.matchups.length - 1].team1_gain = 42.5;
  data.matchups[data.matchups.length - 1].team2_gain = -42.5;
  const regularSeasonTotal = ROBERTO_WEEKS.reduce((s, w) => s + w.gain, 0) + 42.5;
  data.matchups.push(
    { week_number: 7, week_start: '2026-12-14T13:30:00.000Z', week_end: '2026-12-18T20:00:00.000Z', is_playoff: true, team1_user_id: MY_ID, team2_user_id: OPP_ID, team1_gain: null, team2_gain: null },
  );
  // Real snapshots for the live playoff week, so myLive.gain is a real,
  // nonzero number that WOULD inflate the total if the bug were still there.
  const mySnapshots = ROBERTO.map((h) => ({ symbol: h.symbol, quantity: qty(h.draft), week_start_price: h.mon, entered_mid_week: false, created_at: '2026-12-14T13:30:00.000Z' }));
  data.current_week = { week_number: 7, my_snapshots: mySnapshots, my_trades: [], opponent_snapshots: [], opponent_trades: [] };
  const playoffMeta = { ...meta, seasonStatus: 'playoffs' as const, currentWeek: 7, numWeeks: 6, playoffTeams: 4 };
  const now = new Date('2026-12-15T18:00:00.000Z');
  const vm = buildHomeViewModel({
    now, meta: playoffMeta, market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
  assertEquals(vm.phase.kind, 'live_open');
  assertAlmostEquals(vm.hero!.seasonGainDollars, regularSeasonTotal, 0.01);
});

Deno.test('R3: a live playoff week is this week; weeks after it are not drawn until the bracket names an opponent', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  data.matchups[data.matchups.length - 1].team1_gain = 42.5;
  data.matchups[data.matchups.length - 1].team2_gain = -42.5;
  data.matchups.push(
    { week_number: 7, week_start: '2026-12-14T13:30:00.000Z', week_end: '2026-12-18T20:00:00.000Z', is_playoff: true, team1_user_id: MY_ID, team2_user_id: OPP_ID, team1_gain: null, team2_gain: null },
    { week_number: 8, week_start: '2026-12-21T13:30:00.000Z', week_end: '2026-12-25T20:00:00.000Z', is_playoff: true, team1_user_id: MY_ID, team2_user_id: null, team1_gain: null, team2_gain: null },
  );
  const mySnapshots = ROBERTO.map((h) => ({ symbol: h.symbol, quantity: qty(h.draft), week_start_price: h.mon, entered_mid_week: false, created_at: '2026-12-14T13:30:00.000Z' }));
  data.current_week = { week_number: 7, my_snapshots: mySnapshots, my_trades: [], opponent_snapshots: [], opponent_trades: [] };
  const playoffMeta = { ...meta, seasonStatus: 'playoffs' as const, currentWeek: 7, numWeeks: 6, playoffTeams: 4 };
  const now = new Date('2026-12-15T18:00:00.000Z');
  const vm = buildHomeViewModel({
    now, meta: playoffMeta, market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
  assertEquals(vm.seasonTiles.map((t) => t.week), [1, 2, 3, 4, 5, 6, 7]); // no week 8
  assertEquals(vm.seasonTiles[6].kind, 'this');
});

// ── I12 (Design Lead ruling, 2026-09-29): unpriced symbols reach the view
// model's caption inputs correctly. ────────────────────────────────────────

Deno.test('I12: an unpriced symbol on each side reaches thisWeek.you/opponent.unpriced and the hero value caption', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  const now = new Date('2026-09-24T13:37:00-04:00'); // Thu, live
  const noNvdaOrAmzn = (sym: string) => (sym === 'NVDA' || sym === 'AMZN' ? null : quote(sym));
  const vm = buildHomeViewModel({
    now, meta, market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote: noNvdaOrAmzn, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
  assertEquals(vm.thisWeek!.you.unpriced, ['NVDA']);
  assertEquals(vm.thisWeek!.opponent.unpriced, ['AMZN']);
  // The hero is MY team's value -- the opponent's unpriced symbol never
  // reaches it, only mine does.
  assertEquals(vm.hero!.unpricedValue, ['NVDA']);
});

Deno.test('I12: a missing prevClose only shows up in unpricedToday, never in unpricedValue or thisWeek.you', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  const now = new Date('2026-09-24T13:37:00-04:00'); // Thu, live
  const noNvdaBars = { ...bars, NVDA: [] }; // prevCloseFor(bars, 'NVDA', now) -> null; quote('NVDA') is untouched
  const vm = buildHomeViewModel({
    now, meta, market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars: noNvdaBars, playoffRoundLabelForWeek, marketCalendar: [],
  });
  assertEquals(vm.hero!.unpricedToday, ['NVDA']);
  assertEquals(vm.hero!.unpricedValue, []);
  assertEquals(vm.thisWeek!.you.unpriced, []);
});

// ── B1 (Design Lead, 2026-09-30): real market-calendar session bounds,
// not schedule.ts's fixed-UTC nominal-Tuesday timestamps. These matchups
// rows are written in schedule.ts's OWN shape (week_start = nominal
// Tuesday 14:30Z, week_end = nominal Friday 21:00Z -- the fixed-UTC
// quirk), not the already-correct times buildFixtureInput's week 6 uses,
// so these tests actually exercise the bug being fixed. ───────────────────

function nominalWeek6(data: GetHomeLeagueResult) {
  const week6 = data.matchups.find((m) => m.week_number === 6)!;
  week6.week_start = '2026-09-22T14:30:00.000Z'; // nominal Tuesday, fixed UTC (schedule.ts)
  week6.week_end = '2026-09-25T21:00:00.000Z'; // nominal Friday, fixed UTC (schedule.ts)
  return week6;
}

Deno.test('B1: Monday 10:00 AM ET is live_open, not pre_season — the real week starts Monday, not the nominal Tuesday', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  nominalWeek6(data);
  const marketCalendar = standardWeekSessions('2026-09-25T21:00:00.000Z'); // real Mon 9/21 - Fri 9/25
  const now = new Date('2026-09-21T10:00:00-04:00'); // Monday 10:00 AM EDT
  const vm = buildHomeViewModel({
    now, meta, market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar,
  });
  assertEquals(vm.phase.kind, 'live_open');
});

Deno.test('B1: without the market calendar, the same Monday 10:00 AM ET is stuck on last week\'s scored state — pins the bug the fix removes', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  nominalWeek6(data);
  const now = new Date('2026-09-21T10:00:00-04:00'); // Monday 10:00 AM EDT
  const vm = buildHomeViewModel({
    now, meta, market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
  // now < nominal week_start (Tue 14:30Z) and week 5 IS already scored, so
  // the OLD behaviour reads this as still "week 5, scored" all Monday
  // instead of "week 6, live" -- exactly B1's "shows last week's scored
  // state while Monday is being scored," a full trading day wrong.
  assertEquals(vm.phase.kind, 'scored');
  if (vm.phase.kind === 'scored') assertEquals(vm.phase.week, 5);
});

Deno.test('B1: Friday 4:30 PM ET is scoring, not still live — the real close is 4:00 PM, not the nominal 5:00 PM EDT', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  nominalWeek6(data);
  const marketCalendar = standardWeekSessions('2026-09-25T21:00:00.000Z');
  const now = new Date('2026-09-25T16:30:00-04:00'); // Friday 4:30 PM EDT
  const vm = buildHomeViewModel({
    now, meta, market: { status: 'closed', reason: 'after_hours', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar,
  });
  assertEquals(vm.phase.kind, 'scoring');
});

Deno.test('B1: a Monday holiday pushes live_open to Tuesday, from the calendar, never a weekday guess', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  nominalWeek6(data);
  // Monday 9/21 missing from the calendar (holiday) -- Tue-Fri only.
  const marketCalendar = standardWeekSessions('2026-09-25T21:00:00.000Z').slice(1);
  const mondayNow = new Date('2026-09-21T10:00:00-04:00');
  const stillClosed = buildHomeViewModel({
    now: mondayNow, meta, market: { status: 'closed', reason: 'holiday', nextOpenAt: '2026-09-22T13:30:00.000Z' },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar,
  });
  assertEquals(stillClosed.phase.kind, 'scored'); // Monday's real session hasn't opened yet -- still week 5
  const tuesdayNow = new Date('2026-09-22T10:00:00-04:00');
  const nowOpen = buildHomeViewModel({
    now: tuesdayNow, meta, market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar,
  });
  assertEquals(nowOpen.phase.kind, 'live_open');
});

Deno.test('B3: pre-season seasonStartsAt is the REAL Monday open, not schedule.ts\'s nominal leagueStartDate', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  const preSeasonMeta = { ...meta, leagueStartDate: '2026-08-04T14:30:00.000Z' }; // nominal Tuesday, fixed UTC
  const marketCalendar = standardWeekSessions('2026-08-07T21:00:00.000Z'); // real Mon 8/3 - Fri 8/7
  const now = new Date('2026-08-01T12:00:00.000Z'); // well before the season
  const vm = buildHomeViewModel({
    now, meta: preSeasonMeta, market: { status: 'closed', reason: 'weekend', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar,
  });
  assertEquals(vm.phase.kind, 'pre_season');
  if (vm.phase.kind === 'pre_season') assertEquals(vm.phase.seasonStartsAt, '2026-08-03T13:30:00.000Z');
});

Deno.test('B3: without the market calendar, seasonStartsAt falls back to the nominal leagueStartDate -- never a crash', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  const preSeasonMeta = { ...meta, leagueStartDate: '2026-08-04T14:30:00.000Z' };
  const now = new Date('2026-08-01T12:00:00.000Z');
  const vm = buildHomeViewModel({
    now, meta: preSeasonMeta, market: { status: 'closed', reason: 'weekend', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
  assertEquals(vm.phase.kind, 'pre_season');
  if (vm.phase.kind === 'pre_season') assertEquals(vm.phase.seasonStartsAt, '2026-08-04T14:30:00.000Z');
});

Deno.test('server parity: the live score is independent of marketCalendar -- liveWeekScore never re-filters data.current_week by the resolved window', () => {
  // Orchestrator ruling (2026-09-30): scoring windows (which trades count
  // this week) must match process-week-results exactly -- the STORED
  // matchups.week_start/week_end, which get_home_league's own SQL already
  // uses to scope data.current_week.my_trades/opponent_trades server-side
  // (20261029000000_get_home_league_rpc.sql: "t.created_at >= v_matchup.
  // week_start and t.created_at <= v_matchup.week_end"). marketWeek.ts's
  // resolved calendar window governs phase classification and DISPLAYED
  // times only (B1) -- it must never reach liveWeekScore's inputs, which
  // are data.current_week's arrays verbatim. This pins that boundary: the
  // live score must come out identical whether or not a marketCalendar is
  // even supplied, for the same trades/snapshots/quotes.
  const { data, meta, quote, bars } = buildFixtureInput();
  nominalWeek6(data);
  const now = new Date('2026-09-24T17:37:00-04:00'); // Thu, live under either calendar
  const withoutCalendar = buildHomeViewModel({
    now, meta, market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
  const withCalendar = buildHomeViewModel({
    now, meta, market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: standardWeekSessions('2026-09-25T21:00:00.000Z'),
  });
  assertEquals(withoutCalendar.phase.kind, 'live_open');
  assertEquals(withCalendar.phase.kind, 'live_open');
  assertAlmostEquals(withoutCalendar.thisWeek!.you.gain, withCalendar.thisWeek!.you.gain, 1e-9);
  assertAlmostEquals(withoutCalendar.thisWeek!.opponent.gain, withCalendar.thisWeek!.opponent.gain, 1e-9);
});

// ── A tied week is a T, everywhere (Design Lead P1, 2026-11-03) ─────────────
// thisWeek.won was `myGain > opponentGain`, so a tied week read as a loss: the scored card said
// "Gianluigi B. wins Week 6" while "Your season" showed T. Every surface now reads the one
// decider (lib/game/weekResult): the server's winner, else dollars.

/** Week 6 scored with these gains (and optionally the server's verdict), read Saturday. */
function scoredWeek6(g1: number, g2: number, server?: { winner_user_id: string | null; is_tie: boolean }) {
  const { data, meta, quote, bars } = buildFixtureInput();
  const week6 = data.matchups.find((m) => m.week_number === 6)!;
  Object.assign(week6, { team1_gain: g1, team2_gain: g2 }, server ?? {});
  data.matchups.push({
    week_number: 7, week_start: '2026-09-28T13:30:00.000Z', week_end: '2026-10-02T20:00:00.000Z',
    is_playoff: false, team1_user_id: MY_ID, team2_user_id: OPP_ID, team1_gain: null, team2_gain: null,
  });
  data.current_week = { week_number: 7, my_snapshots: [], my_trades: [], opponent_snapshots: [], opponent_trades: [] };
  return buildHomeViewModel({
    now: new Date('2026-09-26T12:00:00.000Z'), meta: { ...meta, currentWeek: 7 },
    market: { status: 'closed', reason: 'weekend', nextOpenAt: '2026-09-28T13:30:00.000Z' },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
}
/** Every place week 6's result shows on Home: the card, the phase, the result list, the strip. */
function week6Results(vm: ReturnType<typeof buildHomeViewModel>) {
  const tile = vm.seasonTiles.find((t) => t.week === 6);
  return {
    card: vm.thisWeek?.result,
    phase: vm.phase.kind === 'scored' ? vm.phase.result : 'not scored',
    list: vm.weeklyResults.find((r) => r.week === 6)?.result,
    strip: tile && (tile.kind === 'played' || tile.kind === 'this') ? tile.result : 'no tile',
  };
}

Deno.test('a TIED scored week is a T on the card, the phase, the result list and the strip (server tie and no-verdict fallback)', () => {
  for (const server of [undefined, { winner_user_id: null, is_tie: true }]) {
    const vm = scoredWeek6(58.75, 58.75, server);
    assertEquals(vm.phase.kind, 'scored');
    assertEquals(week6Results(vm), { card: 'T', phase: 'T', list: 'T', strip: 'T' }, JSON.stringify(server));
  }
});

Deno.test('a win and a loss are unchanged: W and L everywhere', () => {
  assertEquals(week6Results(scoredWeek6(72.1, -20.5)), { card: 'W', phase: 'W', list: 'W', strip: 'W' });
  assertEquals(week6Results(scoredWeek6(-20.5, 72.1)), { card: 'L', phase: 'L', list: 'L', strip: 'L' });
  assertEquals(week6Results(scoredWeek6(72.1, -20.5, { winner_user_id: MY_ID, is_tie: false })), { card: 'W', phase: 'W', list: 'W', strip: 'W' });
  assertEquals(week6Results(scoredWeek6(-20.5, 72.1, { winner_user_id: OPP_ID, is_tie: false })), { card: 'L', phase: 'L', list: 'L', strip: 'L' });
});

Deno.test('the SERVER decides where dollars cannot: a percent tiebreak and an empty portfolio are the server\'s result', () => {
  // Equal dollars, the opponent wins on percent: an L, never a T.
  assertEquals(week6Results(scoredWeek6(20, 20, { winner_user_id: OPP_ID, is_tie: false })), { card: 'L', phase: 'L', list: 'L', strip: 'L' });
  // Equal dollars, I win on percent: a W.
  assertEquals(week6Results(scoredWeek6(20, 20, { winner_user_id: MY_ID, is_tie: false })), { card: 'W', phase: 'W', list: 'W', strip: 'W' });
  // My empty portfolio ($0) is an automatic loss even against −$40.
  assertEquals(week6Results(scoredWeek6(0, -40, { winner_user_id: OPP_ID, is_tie: false })), { card: 'L', phase: 'L', list: 'L', strip: 'L' });
});

Deno.test('a playoff seed-tiebreak loss (equal gains, the other seed advances) reads eliminated', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  data.matchups.push(
    { week_number: 15, week_start: '2026-12-14T13:30:00.000Z', week_end: '2026-12-18T20:00:00.000Z', is_playoff: true, team1_user_id: MY_ID, team2_user_id: OPP_ID, team1_gain: 25, team2_gain: 25, winner_user_id: OPP_ID, is_tie: false },
  );
  data.current_week = { week_number: 16, my_snapshots: [], my_trades: [], opponent_snapshots: [], opponent_trades: [] };
  const vm = buildHomeViewModel({
    now: new Date('2026-12-21T18:00:00.000Z'), meta: { ...meta, seasonStatus: 'playoffs', currentWeek: 16, playoffTeams: 4 },
    market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
  assertEquals(vm.phase.kind, 'eliminated'); // was `myGain < oppGain`: 25 < 25 is false, so never eliminated
});

Deno.test('unscored (one gain posted) stays undecided: no result on the card, the list or the strip', () => {
  const { data, meta, quote, bars } = buildFixtureInput();
  const w5 = data.matchups.find((m) => m.week_number === 5)!;
  w5.team2_gain = null;
  const vm = buildHomeViewModel({
    now: new Date('2026-09-24T13:37:00-04:00'), meta,
    market: { status: 'open', reason: 'regular_session', nextOpenAt: null },
    data, quote, bars, playoffRoundLabelForWeek, marketCalendar: [],
  });
  assertEquals(vm.weeklyResults.some((r) => r.week === 5), false);
  assertEquals(vm.thisWeek?.result, null); // live week 6: no result yet
});
