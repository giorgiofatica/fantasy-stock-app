/**
 * League › Schedule (3c, D4 = keep, Giorgio 2026-10-05). Every regular-season
 * week: the result with your score for a posted week, "● Live" for this week
 * until it posts, "Next" for the week after, a bye as a neutral row (never
 * W or L), and the playoffs as a line. The order is the week order. Run: `deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { buildSchedule, isUnscoredPast } from '../lib/game/schedule.ts';
import { SEASON_TILE_UNSCORED } from '../lib/home/homeCopy.ts';
import { SOURCES } from './sourceManifest.generated.ts';
import { buildSeasonTiles } from '../lib/home/yourSeason.ts';
import type { PhaseResult } from '../lib/home/homePhase.ts';

const names = [
  { user_id: 'roberto', display_name: 'Roberto B.' },
  { user_id: 'paolo', display_name: 'Paolo M.' },
  { user_id: 'gianluigi', display_name: 'Gianluigi B.' },
];

// The rows get_home_league returns: gains, not the winner.
const m = (week: number, t1: string, t2: string | null, g1: number | null, g2: number | null, playoff = false) =>
  ({ week_number: week, team1_user_id: t1, team2_user_id: t2, team1_gain: g1, team2_gain: g2, is_playoff: playoff });

Deno.test('a posted week shows the result and your score, from your side', () => {
  const rows = buildSchedule({
    myUserId: 'roberto', currentWeek: 3, numWeeks: 4, names,
    matchups: [m(1, 'roberto', 'paolo', 213.6, 90.44), m(2, 'gianluigi', 'roberto', 10, -4)],
  });
  assertEquals(rows[0], { week: 1, opponent: 'Paolo M.', bye: false, state: 'past', result: 'W', gain: 213.6, oppGain: 90.44 });
  // From your side: you were team2 in week 2, so your gain is team2_gain (-4), and you lost to 10.
  assertEquals(rows[1].result, 'L');
  assertEquals(rows[1].gain, -4);
  assertEquals(rows[1].oppGain, 10);
});

Deno.test('equal dollars: the server\'s winner decides (a percent tiebreak); with none carried, a T, never an L', () => {
  // Was `won: false, tie: false`, which ScheduleList drew as an L.
  const bare = buildSchedule({ myUserId: 'roberto', currentWeek: 2, numWeeks: 2, names, matchups: [m(1, 'roberto', 'paolo', 5, 5)] });
  assertEquals(bare[0].result, 'T');
  const tie = buildSchedule({ myUserId: 'roberto', currentWeek: 2, numWeeks: 2, names, matchups: [{ ...m(1, 'roberto', 'paolo', 5, 5), winner_user_id: null, is_tie: true }] });
  assertEquals(tie[0].result, 'T');
  const onPercent = buildSchedule({ myUserId: 'roberto', currentWeek: 2, numWeeks: 2, names, matchups: [{ ...m(1, 'roberto', 'paolo', 5, 5), winner_user_id: 'paolo', is_tie: false }] });
  assertEquals(onPercent[0].result, 'L');
});

Deno.test('a half-posted past week (one gain only) has no result, never an L', () => {
  const rows = buildSchedule({ myUserId: 'roberto', currentWeek: 3, numWeeks: 2, names, matchups: [m(1, 'roberto', 'paolo', 5, null)] });
  assertEquals(rows[0].result, null);
});

Deno.test('a past week not scored yet is the season tile\'s dash: half-posted either way, or not posted at all', () => {
  const rows = buildSchedule({
    myUserId: 'roberto', currentWeek: 5, numWeeks: 5, names,
    matchups: [m(1, 'roberto', 'paolo', 5, null), m(2, 'gianluigi', 'roberto', 3, null), m(3, 'roberto', 'gianluigi', null, null)],
  });
  assertEquals(rows.slice(0, 3).map(isUnscoredPast), [true, true, true]);
});

Deno.test('no dash on a scored week (W, L or T), a bye, a week with no matchup, or a week not played yet', () => {
  const rows = buildSchedule({
    myUserId: 'roberto', currentWeek: 6, numWeeks: 8, names,
    matchups: [
      m(1, 'roberto', 'paolo', 5, 1), m(2, 'roberto', 'paolo', 1, 5), m(3, 'roberto', 'paolo', 5, 5),
      m(4, 'roberto', null, 7, null),
      // week 5: no matchup row at all
      m(6, 'roberto', 'gianluigi', null, null), m(7, 'roberto', 'paolo', null, null), m(8, 'roberto', 'gianluigi', null, null),
    ],
  });
  assertEquals(rows.map((r) => r.state), ['past', 'past', 'past', 'past', 'past', 'live', 'next', 'future']);
  assertEquals(rows.map(isUnscoredPast), [false, false, false, false, false, false, false, false]);
});

Deno.test('parity: from the same rows, Schedule draws the dash on exactly the weeks Home\'s season tile does', () => {
  // Week 6 live. Past: 1 scored, 2 half-posted (yours only), 3 half-posted (theirs only),
  // 4 not posted at all, 5 a bye. The weekly results hold only the scored week.
  const rows = [
    m(1, 'roberto', 'paolo', 5, 1), m(2, 'roberto', 'gianluigi', 3, null), m(3, 'paolo', 'roberto', 4, null),
    m(4, 'roberto', 'gianluigi', null, null), m(5, 'roberto', null, 2, null), m(6, 'roberto', 'paolo', null, null),
  ];
  const live: PhaseResult = { kind: 'live_open', week: 6, isPlayoff: false, round: null, weekEnd: '', numWeeks: 6 };
  const tiles = buildSeasonTiles({
    myUserId: 'roberto', phase: live, currentWeek: 6, matchups: rows,
    weeklyResults: [{ week: 1, gain: 5, result: 'W' }], nameOf: (id) => id,
  });
  const schedule = buildSchedule({ myUserId: 'roberto', currentWeek: 6, numWeeks: 6, names, matchups: rows });
  const tileDash = tiles.filter((t) => t.week < 6).map((t) => t.kind === 'unscored');
  const rowDash = schedule.filter((r) => r.week < 6).map(isUnscoredPast);
  assertEquals(tileDash, [false, true, true, true, false]);
  assertEquals(rowDash, tileDash);
});

Deno.test('League › Schedule draws the dash from the season tile\'s own copy, and VoiceOver keeps "Week N, against X"', () => {
  assertEquals(SEASON_TILE_UNSCORED, '–');
  const src = SOURCES['components/game/ScheduleList.tsx'];
  assert(src.includes("import { SEASON_TILE_UNSCORED } from '@/lib/home/homeCopy';"));
  assert(src.includes(") : isUnscoredPast(r) ? ("));
  assert(src.includes("maxFontSizeMultiplier={ROW_TEXT_CAP}>{SEASON_TILE_UNSCORED}</Text>"));
  // The label for an unscored row is unchanged: no result word, no score.
  assert(src.includes("if (r.gain === null || r.result === null) return `Week ${r.week}, ${what}`;"));
  assert(SOURCES['components/home/YourSeason.tsx'].includes('{SEASON_TILE_UNSCORED}</Text>'));
});

Deno.test('this week is LIVE until it posts; the week after is NEXT; later weeks are future', () => {
  const rows = buildSchedule({
    myUserId: 'roberto', currentWeek: 2, numWeeks: 4, names,
    matchups: [m(1, 'roberto', 'paolo', 1, 0.5), m(2, 'roberto', 'gianluigi', null, null), m(3, 'roberto', 'paolo', null, null)],
  });
  assertEquals(rows.map((r) => r.state), ['past', 'live', 'next', 'future']);
  assertEquals(rows[3].opponent, null); // week 4 has no matchup row yet
});

Deno.test('a bye is a neutral row: no result, no W or L', () => {
  const rows = buildSchedule({ myUserId: 'roberto', currentWeek: 2, numWeeks: 2, names, matchups: [m(1, 'roberto', null, 7, null)] });
  assertEquals(rows[0].bye, true);
  assertEquals(rows[0].result, null);
  assertEquals(rows[0].gain, 7);
  assertEquals(rows[0].opponent, null);
});

Deno.test('playoff rows are not in the regular-season list', () => {
  const rows = buildSchedule({ myUserId: 'roberto', currentWeek: 1, numWeeks: 1, names, matchups: [m(2, 'roberto', 'paolo', 1, 1, true)] });
  assertEquals(rows.map((r) => r.week), [1]);
});

Deno.test('an unknown opponent name is never invented', () => {
  const rows = buildSchedule({ myUserId: 'roberto', currentWeek: 2, numWeeks: 2, names: [], matchups: [m(1, 'roberto', 'paolo', 1, 1)] });
  assertEquals(rows[0].opponent, '');
});
