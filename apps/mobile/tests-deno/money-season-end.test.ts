/**
 * lib/money/seasonEnd.ts + weekStatus.isSeasonOver — a finished season's last day, and the ONE
 * "season over" predicate (finished-season Portfolio, Giorgio 2026-11-18, pick A). Pinned:
 *   - the last day is the ET date of the latest matchup week_end, the playoff final included;
 *   - a late completed_at (the heal pass stamping it days after the final) never moves it;
 *   - completed_at is only the fallback with no matchups, and with neither there is no day (null);
 *   - isSeasonOver is getSeasonPhase === 'completed' (the league switcher chip's own source).
 * Run: cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { readSeasonEnd, resolveSeasonEnd, seasonEndEt, type MatchupEndsRead } from '../lib/money/seasonEnd.ts';
import { SOURCES } from './sourceManifest.generated.ts';
import { getSeasonPhase, isSeasonOver } from '../lib/weekStatus.ts';

// schedule.ts's nominal week: Tuesday 14:30Z to Friday 21:00Z (Fri 4 or 5 PM ET).
// Scored by default (team1_gain posted); `gain: null` is an unscored row.
const week = (n: number, friday: string, isPlayoff = false, gain: number | null = 12.5) => ({ week_number: n, week_start: `${friday}T00:00:00Z`, week_end: `${friday}T21:00:00.000Z`, is_playoff: isPlayoff, team1_gain: gain });

const REGULAR = [week(1, '2026-09-04'), week(2, '2026-09-11'), week(3, '2026-09-18')];

Deno.test('regular season only: the last week\'s Friday', () => {
  assertEquals(seasonEndEt(REGULAR), '2026-09-18');
});

Deno.test('with playoffs: the final\'s week, after the regular season', () => {
  assertEquals(seasonEndEt([...REGULAR, week(4, '2026-09-25', true), week(5, '2026-10-02', true)]), '2026-10-02');
});

Deno.test('the order of the rows does not matter (the latest week_end wins)', () => {
  assertEquals(seasonEndEt([week(5, '2026-10-02', true), ...REGULAR, week(4, '2026-09-25', true)]), '2026-10-02');
});

Deno.test('a late completed_at (the heal pass, days after the final) never moves the last day', () => {
  assertEquals(seasonEndEt(REGULAR, '2026-09-23T14:00:00Z'), '2026-09-18');
});

Deno.test('week_end is read in ET: Friday 8:30 PM ET (00:30Z Saturday) is still Friday', () => {
  assertEquals(seasonEndEt([{ week_end: '2026-09-19T00:30:00.000Z', team1_gain: 1 }]), '2026-09-18');
});

Deno.test('no matchups: completed_at\'s ET date is the fallback', () => {
  assertEquals(seasonEndEt([], '2026-09-19T01:00:00Z'), '2026-09-18');
  assertEquals(seasonEndEt(null, '2026-09-21T15:00:00Z'), '2026-09-21');
});

Deno.test('neither matchups nor completed_at: no day (never a guessed one)', () => {
  assertEquals(seasonEndEt([], null), null);
  assertEquals(seasonEndEt(undefined), null);
  assertEquals(seasonEndEt([{ week_end: null, team1_gain: 1 }, { week_end: 'not a date', team1_gain: 1 }]), null);
});

const LEAGUE = { draft_status: 'completed', league_start_date: '2026-08-31T13:30:00Z', current_week: 6, num_weeks: 6 };
const NOW = new Date('2026-11-18T15:00:00Z');

Deno.test('isSeasonOver is the switcher chip\'s phase read as completed, and nothing else', () => {
  for (const season_status of ['active', 'playoffs', 'completed']) {
    const l = { ...LEAGUE, season_status };
    assertEquals(isSeasonOver(l, NOW), getSeasonPhase(l, NOW) === 'completed', season_status);
  }
  assertEquals(isSeasonOver({ ...LEAGUE, season_status: 'completed' }, NOW), true);
  assertEquals(isSeasonOver({ ...LEAGUE, season_status: 'playoffs' }, NOW), false);
  assertEquals(isSeasonOver({ ...LEAGUE, season_status: 'active' }, NOW), false);
  // Never over before the draft, whatever season_status a fresh row defaults to.
  assertEquals(isSeasonOver({ ...LEAGUE, draft_status: 'not_started', season_status: 'completed' }, NOW), false);
  assertEquals(isSeasonOver(null, NOW), false);
});

// ── The LEAGUE-WIDE read (get_home_league's matchups are the caller's own games only) ─────────────

const strip = (src: string) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
type Row = { team1: string; team2: string | null; week_end: string | null; team1_gain: number | null };
const g = (team1: string, team2: string | null, friday: string | null): Row => ({ team1, team2, week_end: friday ? `${friday}T21:00:00.000Z` : null, team1_gain: 3 });
// A 4-team league: Paolo is knocked out in the semifinal (Sep 25); the final is Oct 2 between Roberto and Gianluigi.
const GAMES: Row[] = [
  g('paolo', 'roberto', '2026-09-11'), g('gianluigi', 'atlas', '2026-09-11'),
  g('paolo', 'atlas', '2026-09-18'), g('roberto', 'gianluigi', '2026-09-18'),
  g('paolo', 'roberto', '2026-09-25'), g('gianluigi', 'atlas', '2026-09-25'),
  g('roberto', 'gianluigi', '2026-10-02'),
];
/** What a member's read of `matchups` returns: EVERY row of the league (RLS is is_member), newest dated first. */
const leagueRead: MatchupEndsRead = async () => ({
  data: [...GAMES].filter((r) => r.week_end).sort((a, b) => (a.week_end! < b.week_end! ? 1 : -1)).slice(0, 1).map((r) => ({ week_end: r.week_end, team1_gain: r.team1_gain })),
  error: null,
});

Deno.test('eliminated before the final: the CALLER-scoped matchups would end the season early; the league read gives the final', async () => {
  const callerScoped = GAMES.filter((r) => r.team1 === 'paolo' || r.team2 === 'paolo');
  assertEquals(seasonEndEt(callerScoped), '2026-09-25', 'the trap: Paolo\'s own last game, not the final');
  assertEquals(await readSeasonEnd(leagueRead, 'L1', null), { status: 'ready', endEt: '2026-10-02' });
  // Missed the playoffs entirely (last game Sep 18): the same league read, the same final.
  assertEquals(seasonEndEt(GAMES.filter((r) => r.team1 === 'atlas' || r.team2 === 'atlas').slice(0, 2)), '2026-09-18');
  assertEquals((await readSeasonEnd(leagueRead, 'L1', null)).endEt, '2026-10-02');
});

Deno.test('a FAILED read is unknown (null), never a fallback: neither completed_at nor the caller\'s games', async () => {
  const failed: MatchupEndsRead = async () => ({ data: null, error: { message: 'permission denied' } });
  assertEquals(await readSeasonEnd(failed, 'L1', '2026-10-02T22:00:00Z'), { status: 'error', endEt: null });
  const threw: MatchupEndsRead = () => Promise.reject(new Error('network'));
  assertEquals(await readSeasonEnd(threw, 'L1', '2026-10-02T22:00:00Z'), { status: 'error', endEt: null });
  // A successful read of NO dated matchups is the one case completed_at answers.
  const none: MatchupEndsRead = async () => ({ data: [], error: null });
  assertEquals(await readSeasonEnd(none, 'L1', '2026-10-02T22:00:00Z'), { status: 'ready', endEt: '2026-10-02' });
});

Deno.test('resolveSeasonEnd: idle when not over; loading (null) until THIS league\'s read lands; then its answer', () => {
  const base = { enabled: true, leagueId: 'L1', completedAt: null };
  assertEquals(resolveSeasonEnd({ ...base, enabled: false, state: null }), { status: 'idle', endEt: null });
  assertEquals(resolveSeasonEnd({ ...base, leagueId: null, state: null }), { status: 'idle', endEt: null });
  assertEquals(resolveSeasonEnd({ ...base, state: null }), { status: 'loading', endEt: null });
  assertEquals(resolveSeasonEnd({ ...base, state: { leagueId: 'L0', status: 'ready', endEt: '2026-09-18' } }), { status: 'loading', endEt: null }, 'another league\'s answer, mid-switch');
  assertEquals(resolveSeasonEnd({ ...base, state: { leagueId: 'L1', status: 'ready', endEt: '2026-10-02' } }), { status: 'ready', endEt: '2026-10-02' });
  assertEquals(resolveSeasonEnd({ ...base, state: { leagueId: 'L1', status: 'error', endEt: null } }), { status: 'error', endEt: null });
  // Capture fixtures: their own rows (null = still loading).
  assertEquals(resolveSeasonEnd({ ...base, fixtureRows: null, state: null }), { status: 'loading', endEt: null });
  assertEquals(resolveSeasonEnd({ ...base, fixtureRows: [{ week_end: '2026-10-02T21:00:00Z', team1_gain: 4 }], state: null }), { status: 'ready', endEt: '2026-10-02' });
});

Deno.test('source: both Portfolio screens take the end from useSeasonEnd, never Home\'s caller-scoped matchups', () => {
  for (const f of ['components/money/PortfolioScreen.tsx', 'components/money/PlayerPortfolioScreen.tsx']) {
    const src = strip(SOURCES[f]);
    assert(src.includes('useSeasonEnd(activeLeagueId, finished, completedAt,'), f);
    assert(src.includes("const endEt = finished && seasonEnd.status === 'ready' ? seasonEnd.endEt : null;"), f);
    assert(!src.includes('seasonEndEt('), `${f}: no direct seasonEndEt over Home's matchups`);
    assert(src.includes("seasonEnd.status === 'error'"), `${f}: a failed read shows the load failure`);
  }
  const hook = strip(SOURCES['lib/money/useSeasonEnd.ts']);
  assert(hook.includes(".from('matchups')") && hook.includes(".eq('league_id', leagueId)"), 'a league-wide read');
  assert(hook.includes(".select('week_end, team1_gain')") && hook.includes(".not('team1_gain', 'is', null)"), 'scored matchups only (DL P3)');
  assert(hook.includes("order('week_end', { ascending: false, nullsFirst: false })"), 'an undated row never sorts first');
  assert(hook.includes('.limit(1)'));
});

// ── Scored matchups only (DL P3) ───────────────────────────────────────────────────────────

Deno.test('an UNSCORED later row never stretches the season: the end is the last SCORED week', () => {
  // A completed league whose last scored week is the Oct 2 final, with a later placeholder round never scored.
  const rows = [...REGULAR, week(4, '2026-09-25', true), week(5, '2026-10-02', true), week(6, '2026-10-09', true, null)];
  assertEquals(seasonEndEt(rows), '2026-10-02');
  // A league completed by the legacy current_week > num_weeks fallback: its later weeks exist but were never scored.
  assertEquals(seasonEndEt([...REGULAR, week(4, '2026-09-25', false, null), week(5, '2026-10-02', false, null)]), '2026-09-18');
  // Nothing scored at all: completed_at is the fallback, as with no matchups.
  assertEquals(seasonEndEt([week(1, '2026-09-04', false, null)], '2026-09-06T15:00:00Z'), '2026-09-06');
  // A scored zero (a flat week) is scored: 0 is a gain, not a missing one.
  assertEquals(seasonEndEt([...REGULAR, week(4, '2026-09-25', false, 0)]), '2026-09-25');
});

Deno.test('the league-wide read path applies the same rule (a read that returned an unscored row still ignores it)', async () => {
  const read: MatchupEndsRead = async () => ({ data: [{ week_end: '2026-10-09T21:00:00.000Z', team1_gain: null }], error: null });
  assertEquals(await readSeasonEnd(read, 'L1', '2026-10-03T01:00:00Z'), { status: 'ready', endEt: '2026-10-02' }, 'completed_at, never the unscored row');
});

Deno.test('resolveSeasonEnd: completed_at is applied at render, so one that arrives AFTER a no-scored-rows read still fills the day (Copilot #555)', () => {
  const ready = { leagueId: 'L1', status: 'ready' as const, endEt: null };
  // The read landed while completed_at was still unknown: no day yet.
  assertEquals(resolveSeasonEnd({ enabled: true, leagueId: 'L1', completedAt: null, state: ready }), { status: 'ready', endEt: null });
  // A later LeagueContext refresh supplies it: the same read now answers with its ET date, no re-read.
  assertEquals(resolveSeasonEnd({ enabled: true, leagueId: 'L1', completedAt: '2026-10-03T01:00:00Z', state: ready }), { status: 'ready', endEt: '2026-10-02' });
  // A scored row still wins over completed_at, and an error never falls back.
  assertEquals(resolveSeasonEnd({ enabled: true, leagueId: 'L1', completedAt: '2026-10-09T15:00:00Z', state: { ...ready, endEt: '2026-10-02' } }), { status: 'ready', endEt: '2026-10-02' });
  assertEquals(resolveSeasonEnd({ enabled: true, leagueId: 'L1', completedAt: '2026-10-09T15:00:00Z', state: { leagueId: 'L1', status: 'error', endEt: null } }), { status: 'error', endEt: null });
});

Deno.test('useSeasonEnd: the read carries the rows only; completed_at is never baked into the stored result', () => {
  const src = strip(SOURCES['lib/money/useSeasonEnd.ts']);
  assert(src.includes('readSeasonEnd(readLeagueEnds, leagueId, null)'), 'the hook reads the rows only');
  assert(!src.includes('readSeasonEnd(readLeagueEnds, leagueId, completedAt)'), 'completed_at baked into state would go stale');
});
