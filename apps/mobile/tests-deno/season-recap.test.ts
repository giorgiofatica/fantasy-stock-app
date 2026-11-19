/**
 * The Matchup recap after a season (Giorgio, 2026-11-18, look A): the season's weeks, newest
 * first (the final on top), each row opening that week's matchup. Pure: lib/game/seasonRecap.
 * Run: `deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { buildRecap, recapGameDetail, recapReadComplete, recapStatus, recordThrough, withWeekCloses, type RecapMatchup } from '../lib/game/seasonRecap.ts';
import { matchupWeekHref, parseMatchupWeekParams } from '../lib/game/matchupWeekLink.ts';
import { SOURCES } from './sourceManifest.generated.ts';
import { COPY } from '../lib/game/gameCopy.ts';
import { seasonEndEt } from '../lib/money/seasonEnd.ts';

const names = [
  { user_id: 'me', display_name: 'Roberto B.' },
  { user_id: 'paolo', display_name: 'Paolo M.' },
  { user_id: 'gigi', display_name: 'Gianluigi B.' },
  { user_id: 'sara', display_name: 'Sara T.' },
  { user_id: 'odd', display_name: 'Odd K.' },
];

function m(week: number, t1: string, t2: string | null, g1: number | null, g2: number | null, extra: Partial<RecapMatchup> = {}): RecapMatchup {
  const scored = g1 !== null && (t2 === null || g2 !== null);
  const winner = !scored || t2 === null ? null : g1! > g2! ? t1 : g1! < g2! ? t2 : null;
  return {
    week_number: week, team1_user_id: t1, team2_user_id: t2, team1_gain: g1, team2_gain: g2,
    winner_user_id: winner, is_tie: scored && t2 !== null && winner === null, is_playoff: false,
    week_start: null, week_end: null, ...extra,
  };
}
const po = (week: number, t1: string, t2: string, g1: number, g2: number) => m(week, t1, t2, g1, g2, { is_playoff: true });

// 4 managers, 3 regular weeks, 4 playoff teams: week 4 = Semifinals, week 5 = Final.
const season: RecapMatchup[] = [
  m(1, 'me', 'paolo', 50, 20), m(1, 'gigi', 'sara', 10, 30),
  m(2, 'gigi', 'me', 15, 15), m(2, 'paolo', 'sara', 5, -5),
  m(3, 'me', 'sara', -10, 40), m(3, 'paolo', 'gigi', 0, 1),
  po(4, 'me', 'gigi', 80, 10), po(4, 'sara', 'paolo', 30, 20),
  po(5, 'sara', 'me', 25, 60),
];
const base = { names, numWeeks: 3, playoffTeams: 4 };

Deno.test('my weeks are newest first, the Final on top', () => {
  const r = buildRecap({ ...base, matchups: season, myUserId: 'me' });
  assertEquals(r.mine.map((x) => x.week), [5, 4, 3, 2, 1]);
  assertEquals(r.mine[0].label, 'Final');
});

Deno.test('a playoff week is labelled by its round, a regular week "Wk N"', () => {
  const r = buildRecap({ ...base, matchups: season, myUserId: 'me' });
  // The row chip is the round's short name (Giorgio's chip names); a regular week has none.
  assertEquals(r.mine.map((x) => x.chip), ['F', 'SF', null, null, null]);
  assertEquals(r.mine.map((x) => x.label), ['Final', 'Semifinals', 'Wk 3', 'Wk 2', 'Wk 1']);
  assertEquals(r.mine.map((x) => x.isPlayoff), [true, true, false, false, false]);
  assertEquals(r.all.map((w) => w.label), ['Final', 'Semifinals', 'Wk 3', 'Wk 2', 'Wk 1']);
});

Deno.test('results come from the one decider; a tie is "T" and still opens', () => {
  const r = buildRecap({ ...base, matchups: season, myUserId: 'me' });
  assertEquals(r.mine.map((x) => x.result), ['W', 'W', 'L', 'T', 'W']);
  const tie = r.mine.find((x) => x.week === 2)!;
  assertEquals(tie.opponentName, 'Gianluigi B.');
  assertEquals(tie.myGain, 15);
  assertEquals(tie.opens, { week: 2, a: 'me', b: 'gigi' });
});

Deno.test("the server's winner decides, not the gains (a percent tiebreak)", () => {
  const rows = [m(1, 'me', 'paolo', 10, 10, { winner_user_id: 'paolo', is_tie: false })];
  const r = buildRecap({ ...base, matchups: rows, myUserId: 'me' });
  assertEquals(r.mine[0].result, 'L');
});

Deno.test('the row opens with me as side a, whichever team I was', () => {
  const r = buildRecap({ ...base, matchups: season, myUserId: 'me' });
  assertEquals(r.mine[0].opens, { week: 5, a: 'me', b: 'sara' });
  assertEquals(r.mine[0].myGain, 60);
  assertEquals(r.mine[0].oppGain, 25);
});

Deno.test('a bye is neutral: no result, no opponent, opens nothing', () => {
  const rows = [m(1, 'me', null, 12, null), m(1, 'paolo', 'gigi', 1, 2)];
  const r = buildRecap({ ...base, matchups: rows, myUserId: 'me' });
  const bye = r.mine[0];
  assert(bye.bye);
  assertEquals(bye.result, null);
  assertEquals(bye.opponentName, null);
  assertEquals(bye.opens, null);
  assertEquals(r.all[0].games[0].b, null);
  assertEquals(r.all[0].games[0].opens, null);
});

Deno.test('a week whose gains never posted has no result and opens nothing (the dash)', () => {
  const rows = [m(1, 'me', 'paolo', null, null), m(1, 'gigi', 'sara', 3, null)];
  const r = buildRecap({ ...base, matchups: rows, myUserId: 'me' });
  assertEquals(r.mine[0].result, null);
  assertEquals(r.mine[0].opens, null);
  assertEquals(r.all[0].games.map((g) => g.final), [false, false]);
  assertEquals(r.all[0].games.map((g) => g.opens), [null, null]);
});

Deno.test("an eliminated manager's rows stop at their last game; status names the round", () => {
  const r = buildRecap({ ...base, matchups: season, myUserId: 'gigi' });
  assertEquals(r.mine.map((x) => x.week), [4, 3, 2, 1]);
  assertEquals(r.status, { kind: 'eliminated', round: 'Semifinals' });
});

Deno.test('champion, runner-up, missed the playoffs', () => {
  assertEquals(recapStatus(season, 'me', 3, 4), { kind: 'champion' });
  assertEquals(recapStatus(season, 'sara', 3, 4), { kind: 'runner_up' });
  const five = [...season, m(1, 'odd', null, 1, null)];
  assertEquals(recapStatus(five, 'odd', 3, 4), { kind: 'missed_playoffs' });
});

Deno.test('a win that is not in the Final makes no champion (the rows cannot place it)', () => {
  // My last playoff game is a Semifinal win, but the Final (week 5) is between two others.
  const rows = [...season.slice(0, 8), po(5, 'sara', 'paolo', 25, 60)];
  assertEquals(recapStatus(rows, 'me', 3, 4), null);
});

Deno.test('an unscored last playoff game decides no status (no made-up line)', () => {
  const rows = [...season.slice(0, 8), m(5, 'sara', 'me', null, null, { is_playoff: true })];
  assertEquals(recapStatus(rows, 'me', 3, 4), null);
});

Deno.test('all matchups: grouped by week newest first, my game first and me as side a', () => {
  const r = buildRecap({ ...base, matchups: season, myUserId: 'me' });
  assertEquals(r.all.map((w) => w.week), [5, 4, 3, 2, 1]);
  const wk2 = r.all.find((w) => w.week === 2)!;
  assertEquals(wk2.games.length, 2);
  assert(wk2.games[0].mine);
  assertEquals(wk2.games[0].a.userId, 'me');
  assertEquals(wk2.games[0].b?.userId, 'gigi');
  assertEquals(wk2.games[1].opens, { week: 2, a: 'paolo', b: 'sara' });
  const fin = r.all[0].games[0];
  assertEquals([fin.a.userId, fin.a.gain, fin.b?.userId, fin.b?.gain], ['me', 60, 'sara', 25]);
});

Deno.test('a row with no team 1 is skipped, never thrown on', () => {
  const rows = [...season, { ...m(3, 'x', 'y', 1, 2), team1_user_id: null }];
  const r = buildRecap({ ...base, matchups: rows, myUserId: 'me' });
  assertEquals(r.all.find((w) => w.week === 3)!.games.length, 2);
});

Deno.test('the record through a week counts that week, not the season (playoffs and byes excluded)', () => {
  assertEquals(recordThrough(season, 'me', 1), { wins: 1, losses: 0, ties: 0 });
  assertEquals(recordThrough(season, 'me', 2), { wins: 1, losses: 0, ties: 1 });
  assertEquals(recordThrough(season, 'me', 5), { wins: 1, losses: 1, ties: 1 });
  assertEquals(recordThrough([m(1, 'me', null, 3, null)], 'me', 1), null);
});

Deno.test('a short read is refused, never a shorter season', () => {
  assert(recapReadComplete(9, 9));
  assert(!recapReadComplete(8, 9));
  assert(!recapReadComplete(9, null));
});

Deno.test('the week detail reads the game from side a, either team order; an unscored game is no detail', () => {
  assertEquals(recapGameDetail(season, 5, 'me', 'sara'), { week: 5, isPlayoff: true, aGain: 60, bGain: 25, result: 'W', weekStart: null, weekEnd: null });
  assertEquals(recapGameDetail(season, 5, 'sara', 'me')?.result, 'L');
  assertEquals(recapGameDetail(season, 2, 'me', 'gigi')?.result, 'T');
  assertEquals(recapGameDetail(season, 5, 'me', 'paolo'), null);
  assertEquals(recapGameDetail([m(1, 'me', 'paolo', 3, null)], 1, 'me', 'paolo'), null);
});

Deno.test("the week's Friday closes are laid into the bars on the close date, replacing that day", () => {
  const bars = { AAPL: [{ date: '2026-09-21', close: 1 }, { date: '2026-09-25', close: 2 }] };
  const out = withWeekCloses(bars, { AAPL: 9, MSFT: 4 }, '2026-09-25');
  assertEquals(out.AAPL, [{ date: '2026-09-21', close: 1 }, { date: '2026-09-25', close: 9 }]);
  assertEquals(out.MSFT, [{ date: '2026-09-25', close: 4 }]);
  assertEquals(bars.AAPL[1].close, 2); // the input is never written
  assertEquals(withWeekCloses(bars, { AAPL: 9 }, null).AAPL[1].close, 2);
});

Deno.test('the recap link round-trips its params; a bad week is refused', () => {
  const href = matchupWeekHref('L1', { week: 9, a: 'me', b: 'paolo' });
  assertEquals(href.pathname, '/matchup-week');
  assertEquals(parseMatchupWeekParams(href.params), { league: 'L1', week: 9, a: 'me', b: 'paolo' });
  assertEquals(parseMatchupWeekParams({ ...href.params, week: '0' }), null);
  assertEquals(parseMatchupWeekParams({ ...href.params, week: 'x' }), null);
  assertEquals(parseMatchupWeekParams({ league: 'L1', week: '2', a: 'me' }), null);
});

// ── Source guards: the read, the tab's switch, the rows ─────────────────────────────

Deno.test('useSeasonRecap: ONE league-wide matchups read (never get_home_league), exact count, a short read fails', () => {
  const src = SOURCES['lib/game/useSeasonRecap.ts'];
  assert(src.includes(".select('week_number, team1_user_id, team2_user_id, team1_gain, team2_gain, winner_user_id, is_tie, is_playoff, week_start, week_end', { count: 'exact' })"));
  assert(src.includes(".eq('league_id', leagueId));"), 'the whole season: no week filter');
  assert(src.includes("seamTable('matchups_season', () => supabase\n          .from('matchups')"), 'the table itself, not the caller-scoped get_home_league');
  assert(!/\.rpc\(/.test(src));
  assert(src.includes("if (!recapReadComplete(data.length, res.count ?? null)) throw new Error('matchups read incomplete');"));
  assert(src.includes('if (!enabled || !leagueId || !user?.id) return;'), 'only while the view is complete');
});

Deno.test("the Matchup tab: after the season, the recap replaces the body; the week's All matchups is not read", () => {
  const src = SOURCES['app/(tabs)/matchup.tsx'];
  assert(src.includes("const complete = m.derived?.view.kind === 'complete';"));
  assert(src.includes('m.names, complete);'), 'the recap reads only when complete');
  assert(src.includes("segment === 'all' && !complete);"), 'All matchups (the week) is off once complete');
  assert(src.includes('{complete && activeLeagueId ? ('));
  assert(src.includes('<SeasonRecap key={activeLeagueId} segment={segment} state={recap} leagueId={activeLeagueId} />'));
  // The switch stays.
  assert(src.includes("options={[{ label: 'My matchup', value: 'mine' }, { label: 'All matchups', value: 'all' }]}"));
});

Deno.test('the recap rows: Schedule\'s row, a chevron only on a row that opens; a bye or a never-posted game never opens', () => {
  const recap = SOURCES['components/game/SeasonRecap.tsx'];
  const row = SOURCES['components/game/ScheduleList.tsx'];
  assert(recap.includes('<ScheduleWeekRow'));
  assert(recap.includes('onPress={r.opens ? () => open(r.opens!) : undefined}'));
  assert(recap.includes('<LoadFailure title={RECAP_LOAD_FAILED} message={MONEY_COPY.loadRetryMessage} onRetry={state.retry} />'));
  assert(recap.includes(`export const RECAP_LOAD_FAILED = "Matchups didn't load";`));
  // A CUT of the existing title, never new words (DL gate P2): "This week's matchups didn't load" minus "This week's".
  assert(COPY.allMatchupsLoadFailed.endsWith("matchups didn't load"));
  // The row chip is the round's SHORT name; VoiceOver still says the full one; a name never splits.
  assert(recap.includes('weekLabel={r.chip ?? r.label}'));
  assert(recap.includes('roundChip={r.chip !== null}'));
  assert(recap.includes('spokenWeek={r.label}'));
  assert(row.includes("vsOpponentLabel(keepName(r.opponent))"));
  assert(row.includes('if (!onPress) {'), 'no onPress → the plain tile, no chevron');
  assert(row.indexOf('<Icon name="chevronRight"') > row.indexOf('if (!onPress) {'), 'the chevron is drawn only on the pressable row');
  const schedule = row.slice(row.indexOf('export function ScheduleList('), row.indexOf('export interface ScheduleWeekRowProps'));
  assert(schedule.includes('<ScheduleWeekRow key={r.week} row={r} />'), "Schedule passes no label, chip or onPress: its rows are unchanged");
});

Deno.test('status line: out in a round, or missed the playoffs; nothing for the champion or runner-up', () => {
  const src = SOURCES['components/game/SeasonRecap.tsx'];
  assert(src.includes("if (status.kind === 'eliminated') return eliminatedLabel(status.round);"));
  assert(src.includes(`if (status.kind === 'missed_playoffs') return "You didn't make the playoffs.";`));
  // The tab's existing string, verbatim.
  assert(SOURCES['app/(tabs)/matchup.tsx'].includes(`: "You didn't make the playoffs.";`));
});

Deno.test("a card opened from the recap's detail is the finished-season card (#545): no Price, Week gain or ranges", () => {
  // The season's last day comes from the recap's league-wide read: the latest week_end, the Final's.
  const rows = season.map((m) => ({ ...m, week_end: `2026-0${Math.min(m.week_number, 9)}-1${m.week_number % 10}T20:00:00Z` }));
  assertEquals(seasonEndEt(rows, null), '2026-05-15');
  const screen = SOURCES['app/matchup-week.tsx'];
  assert(screen.includes("const seasonEnd = recapState.status === 'ready' && isSeasonOver(lg, new Date(), marketCalendar) ? seasonEndEt(recapState.matchups, completedAt) : null;"));
  assert(screen.includes('seasonEnd={seasonEnd}'));
  assert(SOURCES['components/game/FinishedWeek.tsx'].includes('seasonEnd={seasonEnd}'));
  const roster = SOURCES['components/game/MatchupRoster.tsx'];
  assert(roster.includes('          seasonEnd={seasonEnd}\n        />'), 'the card gets the season end');
  // The card itself: with a seasonEnd there is no Price / Week gain strip, no ranges (StockChart's endEt), no Sell.
  const card = SOURCES['components/sp/gn/PlayerCard.tsx'];
  assert(card.includes('const over = seasonEnd != null;'));
  assert(card.includes('const action = over ? null : cardAction(props);'));
  assert(card.includes('{over ? null : ('));
  assert(card.includes('endEt={seasonEnd}'));
});
