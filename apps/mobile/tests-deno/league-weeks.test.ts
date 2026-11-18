/**
 * No week figures without weeks (build 18): a league without weeks (Duration: the server's weekly
 * jobs are matchup-only) shows no week figure anywhere, and in a Matchup league a holding the week
 * has nothing for is UNKNOWN, never "$0.00 / 0.00%" (Giorgio, 2026-11-18: a missing number never
 * shows as zero). The predicate is ONE pure helper, lib/game/leagueWeeks.ts, keyed on league_type.
 *   cd apps/mobile/tests-deno && deno test .
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { leagueHasWeeks } from '../lib/game/leagueWeeks.ts';
import { cardWeekGain, playerCardData, stockWeek, weekPctOf } from '../lib/game/playerCardModel.ts';
import { cardWeekFigure, rosterHalfFigures, rosterHalfLabel } from '../components/sp/logic/gameNight.ts';
import { accessibleLeagueRow, sheetChipShown, type SheetLeague } from '../lib/shell/leagueSheet.ts';
import { getMatchupScreenState } from '../lib/matchupScreenState.ts';
import { fixtureLedger } from '../lib/game/matchupFixture.ts';
import { ROBERTO_HOLDINGS, fixtureQty } from '../lib/home/homeFixtureData.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const strip = (src: string) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

const nvda = ROBERTO_HOLDINGS[0];
const snap = [{ symbol: 'NVDA', quantity: fixtureQty(nvda), weekStartPrice: nvda.mon, enteredMidWeek: false }];
const NO_ZERO = /\$0\.00|0\.00%/;

// ── The one predicate ─────────────────────────────────────────────────────────────

Deno.test('leagueHasWeeks: only a Matchup league plays in weeks (the server keys on the same thing)', () => {
  assertEquals(leagueHasWeeks('matchup'), true);
  assertEquals(leagueHasWeeks('duration'), false);
  // Not loaded yet / unknown: no weeks, so nothing is shown before the app knows.
  assertEquals(leagueHasWeeks(null), false);
  assertEquals(leagueHasWeeks(undefined), false);
  assertEquals(leagueHasWeeks(''), false);
  assertEquals(leagueHasWeeks('Matchup'), false, 'the column is lower case; no fuzzy match');
});

Deno.test('matchupScreenState decides Matchup vs Duration by the same helper', () => {
  assertEquals(getMatchupScreenState({ leaguesLoading: false, leagueCount: 1, activeLeague: { league_type: 'matchup' } }), 'matchup');
  assertEquals(getMatchupScreenState({ leaguesLoading: false, leagueCount: 1, activeLeague: { league_type: 'duration' } }), 'duration');
  assert(strip(SOURCES['lib/matchupScreenState.ts']).includes('leagueHasWeeks(activeLeague.league_type)'));
});

// ── stockWeek: a missing row is unknown, not 0 ────────────────────────────────────

Deno.test('stockWeek: no week-start row and no trade -> unknown (null), never 0', () => {
  const w = stockWeek('NVTS', snap, [], 7.5);
  assertEquals(w.gain, null);
  assertEquals(w.pct, null);
  // No rows at all (a Duration league's week): unknown too.
  assertEquals(stockWeek('NVDA', [], [], nvda.thu), { gain: null, pct: null });
});

Deno.test('stockWeek: with a row -> the row\'s own number', () => {
  const w = stockWeek('NVDA', snap, [], nvda.thu);
  assertEquals(Math.round(w.gain! * 100), Math.round(fixtureQty(nvda) * (nvda.thu - nvda.mon) * 100));
  assertEquals(Math.round(w.pct! * 100) / 100, Math.round(((nvda.thu - nvda.mon) / nvda.mon) * 10000) / 100);
});

Deno.test('stockWeek: a row with no live price -> unknown (liveWeekScore leaves it unpriced)', () => {
  assertEquals(stockWeek('NVDA', snap, [], null), { gain: null, pct: null });
});

Deno.test('weekPctOf: no basis -> unknown (null), not 0%', () => {
  assertEquals(weekPctOf(5, 0), null);
  assertEquals(weekPctOf(0, 0), null);
  assertEquals(weekPctOf(5, 100), 5);
  assertEquals(weekPctOf(0, 100), 0, 'a real zero week stays a real zero');
});

// ── The player card ──────────────────────────────────────────────────────────────

Deno.test('cardWeekGain: a Duration league has no week figure, even with a row', () => {
  const input = { symbol: 'NVDA', snapshots: snap, trades: [], price: nvda.thu };
  assertEquals(cardWeekGain({ ...input, leagueType: 'duration' }), null);
  assertEquals(cardWeekGain({ ...input, leagueType: null }), null);
  const m = cardWeekGain({ ...input, leagueType: 'matchup' });
  assertEquals(Math.round(m! * 100), Math.round(fixtureQty(nvda) * (nvda.thu - nvda.mon) * 100));
  // A Matchup league, a holding with no row: unknown.
  assertEquals(cardWeekGain({ ...input, symbol: 'NVTS', leagueType: 'matchup' }), null);
});

Deno.test('playerCardData: an unknown week stays unknown (gain AND percent null)', () => {
  const d = playerCardData({
    symbol: 'NVDA', company: 'NVIDIA', userId: 'me', activity: fixtureLedger('unslotted', 'me', 'g').activity,
    snapshots: [], trades: [], weekGain: null, price: nvda.thu,
    bars: [{ date: '2026-09-23', close: nvda.prev }], now: new Date('2026-09-24T17:37:00Z'),
  })!;
  assert(d, 'the card still opens (Price, the chart, how it was got)');
  assertEquals(d.weekGain, null);
  assertEquals(d.weekPct, null);
});

Deno.test('cardWeekFigure: null when either half is unknown; the figure when both are known', () => {
  assertEquals(cardWeekFigure(null, null), null);
  assertEquals(cardWeekFigure(null, 1), null);
  assertEquals(cardWeekFigure(62.4, null), null);
  assertEquals(cardWeekFigure(62.4, 6.05), { value: '+$62.40', sub: '+6.05%', tone: 'gain' });
  // A REAL zero week (a row, flat price) still reads $0.00: only a missing number is hidden.
  assertEquals(cardWeekFigure(0, 0)?.value, '$0.00');
});

Deno.test('PlayerCard draws Week gain only from cardWeekFigure, and leaves it out when null', () => {
  const src = strip(SOURCES['components/sp/gn/PlayerCard.tsx']);
  assert(src.includes('const week = cardWeekFigure(weekGain, weekPct);'));
  assert(src.includes('{week ? <Figure label="Week gain" value={week.value}'));
  assert(!/money\(weekGain\)|pct\(weekPct\)/.test(src), 'no path formats a raw week figure');
});

Deno.test('Portfolio and the manager portfolio feed the card through cardWeekGain, keyed on the league type', () => {
  for (const f of ['components/money/PortfolioScreen.tsx', 'components/money/PlayerPortfolioScreen.tsx']) {
    const src = strip(SOURCES[f]);
    assert(src.includes('weekGain: cardWeekGain({ leagueType: activeLeague?.league_type, symbol: shown, snapshots, trades, price }),'), f);
    assert(!src.includes('stockWeek('), `${f}: no direct stockWeek (it would skip the league gate)`);
  }
});

// ── The guard: no week figure renders "$0.00" for a missing row ──────────────────

Deno.test('guard: a missing row never renders "$0.00" / "0.00%" on the card or a roster half', () => {
  for (const leagueType of ['matchup', 'duration', null]) {
    const gain = cardWeekGain({ leagueType, symbol: 'NVTS', snapshots: snap, trades: [], price: 7.5 });
    const fig = cardWeekFigure(gain, gain === null ? null : weekPctOf(gain, 0));
    assertEquals(fig, null, `${leagueType}: no figure`);
  }
  // A Duration league with the stock's own row: still no figure.
  assertEquals(cardWeekFigure(cardWeekGain({ leagueType: 'duration', symbol: 'NVDA', snapshots: snap, trades: [], price: nvda.thu }), 1), null);
  // A roster half with an unknown week: no figures, and VoiceOver says no number.
  const half = { ticker: 'NVTS', company: 'Navitas', weekGain: null, weekPct: null };
  assertEquals(rosterHalfFigures(half), null);
  assert(!NO_ZERO.test(rosterHalfLabel('Yours', half)), rosterHalfLabel('Yours', half));
  assertEquals(rosterHalfFigures({ ...half, weekGain: 1, weekPct: null }), null);
  assertEquals(rosterHalfFigures({ ...half, weekGain: 1, weekPct: 2, figures: false }), null);
  assertEquals(rosterHalfFigures({ ...half, weekGain: 1, weekPct: 2 }), { gain: 1, pct: 2 });
  assert(strip(SOURCES['components/sp/gn/RosterRow.tsx']).includes('const figs = rosterHalfFigures(half);'));
});

// ── The league list ──────────────────────────────────────────────────────────────

function league(over: Partial<SheetLeague> = {}): SheetLeague {
  return {
    id: 'l1', name: 'test_081126', seasonPhase: 'regular', marketOpen: true, rank: 1, rankCount: 2,
    wins: 0, losses: 0, ties: 0, membersJoined: 2, capacity: 2, isChampion: false, seasonLabel: '',
    leagueType: 'matchup', currentWeek: 3, numWeeks: 10, playoffTeams: 2, draftDate: null, ...over,
  };
}

Deno.test('league list: a Duration league in season shows no "Week N" chip; a Matchup league does', () => {
  assertEquals(sheetChipShown(league()), true);
  assertEquals(sheetChipShown(league({ leagueType: 'duration', numWeeks: null })), false);
  assertEquals(sheetChipShown(league({ leagueType: 'duration', numWeeks: null, marketOpen: false })), false);
  assert(accessibleLeagueRow(league(), false).includes('Week 3'));
  assert(!accessibleLeagueRow(league({ leagueType: 'duration', numWeeks: null }), false).includes('Week'), 'VoiceOver says no week either');
  // Phases that are not a week keep their chip in a Duration league (the draft, "Final").
  assertEquals(sheetChipShown(league({ leagueType: 'duration', seasonPhase: 'pre_draft' })), true);
  assertEquals(sheetChipShown(league({ leagueType: 'duration', seasonPhase: 'completed' })), true);
  const row = strip(SOURCES['components/shell/LeagueSheetRow.tsx']);
  assert(row.includes('const chip = sheetChipShown(league) ?'), 'the row draws the chip only when sheetChipShown');
  assert(row.includes('{stacked && chip ?'), 'no empty stacked chip wrapper');
});
