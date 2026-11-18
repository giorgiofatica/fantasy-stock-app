/**
 * No week figures without weeks (build 18): a league without weeks (Duration: the server's weekly
 * jobs are matchup-only) shows no week figure anywhere, and in a Matchup league a holding the week
 * has nothing for is UNKNOWN, never "$0.00 / 0.00%" (Giorgio, 2026-11-18: a missing number never
 * shows as zero). The predicate is ONE pure helper, lib/game/leagueWeeks.ts, keyed on league_type.
 *   cd apps/mobile/tests-deno && deno test .
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { leagueHasWeeks } from '../lib/game/leagueWeeks.ts';
import { playerCardData, stockWeek, weekPctOf } from '../lib/game/playerCardModel.ts';
import { WEEK_UNKNOWN, cardWeekFigure, rosterHalfFigures, rosterHalfLabel } from '../components/sp/logic/gameNight.ts';
import { SEASON_TILE_UNSCORED } from '../lib/home/homeCopy.ts';
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

const cardIn = (over: { snapshots?: typeof snap; weekGain: number | null; hasWeeks: boolean }) => ({
  symbol: 'NVDA', company: 'NVIDIA', userId: 'me', activity: fixtureLedger('unslotted', 'me', 'g').activity,
  snapshots: over.snapshots ?? snap, trades: [], weekGain: over.weekGain, hasWeeks: over.hasWeeks, price: nvda.thu,
  bars: [{ date: '2026-09-23', close: nvda.prev }], now: new Date('2026-09-24T17:37:00Z'),
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

Deno.test('stockWeek: a REAL zero week (row present, price flat) is 0 and 0%, never unknown', () => {
  const w = stockWeek('NVDA', snap, [], nvda.mon);
  assertEquals(w, { gain: 0, pct: 0 });
  // …and the card shows the Week gain FIGURE for it ($0.00, 0.00%), not the unknown dash.
  const d = playerCardData(cardIn({ weekGain: w.gain, hasWeeks: true }))!;
  assertEquals([d.weekGain, d.weekPct], [0, 0]);
  assertEquals(cardWeekFigure(d.weekGain, d.weekPct, d.hasWeeks), { kind: 'figure', value: '$0.00', sub: '0.00%', tone: 'zero' });
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

Deno.test('playerCardData: a Duration league has no week number, even when one is passed', () => {
  const d = playerCardData(cardIn({ weekGain: 62.4, hasWeeks: false }))!;
  assert(d, 'the card still opens (Price, the chart, how it was got)');
  assertEquals([d.weekGain, d.weekPct, d.hasWeeks], [null, null, false]);
  assertEquals(cardWeekFigure(d.weekGain, d.weekPct, d.hasWeeks), null, 'the figure is left out');
});

Deno.test('playerCardData: a Matchup league with no week-start row stays unknown -> the card\'s "–"', () => {
  const d = playerCardData(cardIn({ snapshots: [], weekGain: stockWeek('NVDA', [], [], nvda.thu).gain, hasWeeks: true }))!;
  assertEquals([d.weekGain, d.weekPct, d.hasWeeks], [null, null, true]);
  assertEquals(cardWeekFigure(d.weekGain, d.weekPct, d.hasWeeks), { kind: 'unknown', value: '–' });
});

Deno.test('playerCardData: a Matchup league with a row -> the figure', () => {
  const gain = stockWeek('NVDA', snap, [], nvda.thu).gain!;
  const d = playerCardData(cardIn({ weekGain: gain, hasWeeks: true }))!;
  const f = cardWeekFigure(d.weekGain, d.weekPct, d.hasWeeks);
  assertEquals(f?.kind, 'figure');
  assertEquals(d.weekGain, gain);
});

Deno.test('cardWeekFigure: absent without weeks; the Schedule dash when unknown; the figure when known', () => {
  assertEquals(WEEK_UNKNOWN, SEASON_TILE_UNSCORED, 'the same mark League › Schedule uses for an unscored week');
  assertEquals(cardWeekFigure(62.4, 6.05, false), null);
  assertEquals(cardWeekFigure(null, null, false), null);
  assertEquals(cardWeekFigure(null, null), { kind: 'unknown', value: '–' });
  assertEquals(cardWeekFigure(null, 1), { kind: 'unknown', value: '–' });
  assertEquals(cardWeekFigure(62.4, null), { kind: 'unknown', value: '–' });
  assertEquals(cardWeekFigure(62.4, 6.05), { kind: 'figure', value: '+$62.40', sub: '+6.05%', tone: 'gain' });
  // A REAL zero week (a row, flat price) still reads $0.00: only a missing number is a dash.
  const zero = cardWeekFigure(0, 0);
  assertEquals(zero?.kind === 'figure' ? zero.value : null, '$0.00');
});

Deno.test('PlayerCard: Week gain from cardWeekFigure; the dash alone (no percent, no words); absent without weeks', () => {
  const src = strip(SOURCES['components/sp/gn/PlayerCard.tsx']);
  assert(src.includes('const week = cardWeekFigure(weekGain, weekPct, hasWeeks);'));
  assert(src.includes('{week ? (\n          <Figure label="Week gain"\n            value={week.value}'), 'one Week gain figure, drawn only when cardWeekFigure gives one');
  assert(src.includes("sub={week.kind === 'figure' ? week.sub : undefined}"), 'the dash has no percent line');
  assert(src.includes("valueColor={week.kind === 'figure' ? colors[week.tone] : colors.text2}"), 'the dash is secondary, as on Schedule');
  assert(src.includes("a11yLabel={week.kind === 'unknown' ? 'Week gain' : undefined}"), 'VoiceOver says the label alone');
  assert(src.includes('{sub !== undefined ?'), 'a figure with no sub draws no sub line');
  assert(!/money\(weekGain\)|pct\(weekPct\)/.test(src), 'no path formats a raw week figure');
});

Deno.test('Portfolio and the manager portfolio key the card on the league type', () => {
  for (const f of ['components/money/PortfolioScreen.tsx', 'components/money/PlayerPortfolioScreen.tsx']) {
    const src = strip(SOURCES[f]);
    assert(src.includes('weekGain: stockWeek(shown, snapshots, trades, price).gain,'), f);
    assert(src.includes('hasWeeks: leagueHasWeeks(activeLeague?.league_type),'), f);
  }
});

// ── The guard: no week figure renders "$0.00" for a missing row ──────────────────

Deno.test('guard: a missing row never renders "$0.00" / "0.00%" on the card or a roster half', () => {
  for (const hasWeeks of [true, false]) {
    const gain = stockWeek('NVTS', snap, [], 7.5).gain;
    const d = playerCardData({ ...cardIn({ weekGain: gain, hasWeeks }) })!;
    const fig = cardWeekFigure(d.weekGain, d.weekPct, d.hasWeeks);
    const shown = fig === null ? '' : fig.kind === 'figure' ? `${fig.value} ${fig.sub}` : fig.value;
    assert(!NO_ZERO.test(shown), `hasWeeks=${hasWeeks}: ${shown}`);
    assertEquals(fig, hasWeeks ? { kind: 'unknown', value: '–' } : null);
  }
  // A no-basis percent is unknown too, so a known gain over nothing is a dash, never "0.00%".
  assertEquals(cardWeekFigure(5, weekPctOf(5, 0)), { kind: 'unknown', value: '–' });
  // A roster half with an unknown week: no figures, and VoiceOver says no number.
  const half = { ticker: 'NVTS', company: 'Navitas', weekGain: null, weekPct: null };
  assertEquals(rosterHalfFigures(half), null);
  assert(!NO_ZERO.test(rosterHalfLabel('Yours', half)), rosterHalfLabel('Yours', half));
  assertEquals(rosterHalfFigures({ ...half, weekGain: 1, weekPct: null }), null);
  assertEquals(rosterHalfFigures({ ...half, weekGain: 1, weekPct: 2, figures: false }), null);
  assertEquals(rosterHalfFigures({ ...half, weekGain: 1, weekPct: 2 }), { gain: 1, pct: 2 });
  assert(strip(SOURCES['components/sp/gn/RosterRow.tsx']).includes('const figs = rosterHalfFigures(half);'));
});

// ── Home ─────────────────────────────────────────────────────────────────────────

Deno.test('Home: a league without weeks has no This week card, gated before every phase branch', () => {
  const src = strip(SOURCES['app/(tabs)/index.tsx']);
  const gate = src.indexOf('const hasWeeks = leagueHasWeeks(league?.league_type);');
  assert(gate > 0, 'Home keys the card on leagueHasWeeks');
  const chain = src.slice(gate, src.indexOf('const showSeason ='));
  assert(chain.startsWith("const hasWeeks = leagueHasWeeks(league?.league_type);\n  if (!hasWeeks) {\n    middleCard = null;\n  } else if (phase.kind === 'pre_season') {"), 'the gate is the first branch: no phase can draw the card without weeks');
  assertEquals((chain.match(/<ThisWeekCard/g) ?? []).length, (src.match(/<ThisWeekCard/g) ?? []).length, 'every This week card is behind the gate');
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
