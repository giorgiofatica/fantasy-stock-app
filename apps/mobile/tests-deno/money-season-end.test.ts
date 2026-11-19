/**
 * lib/money/seasonEnd.ts + weekStatus.isSeasonOver — a finished season's last day, and the ONE
 * "season over" predicate (finished-season Portfolio, Giorgio 2026-11-18, pick A). Pinned:
 *   - the last day is the ET date of the latest matchup week_end, the playoff final included;
 *   - a late completed_at (the heal pass stamping it days after the final) never moves it;
 *   - completed_at is only the fallback with no matchups, and with neither there is no day (null);
 *   - isSeasonOver is getSeasonPhase === 'completed' (the league switcher chip's own source).
 * Run: cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .
 */
import { assertEquals } from 'jsr:@std/assert';
import { seasonEndEt } from '../lib/money/seasonEnd.ts';
import { getSeasonPhase, isSeasonOver } from '../lib/weekStatus.ts';

// schedule.ts's nominal week: Tuesday 14:30Z to Friday 21:00Z (Fri 4 or 5 PM ET).
const week = (n: number, friday: string, isPlayoff = false) => ({ week_number: n, week_start: `${friday}T00:00:00Z`, week_end: `${friday}T21:00:00.000Z`, is_playoff: isPlayoff });

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
  assertEquals(seasonEndEt([{ week_end: '2026-09-19T00:30:00.000Z' }]), '2026-09-18');
});

Deno.test('no matchups: completed_at\'s ET date is the fallback', () => {
  assertEquals(seasonEndEt([], '2026-09-19T01:00:00Z'), '2026-09-18');
  assertEquals(seasonEndEt(null, '2026-09-21T15:00:00Z'), '2026-09-21');
});

Deno.test('neither matchups nor completed_at: no day (never a guessed one)', () => {
  assertEquals(seasonEndEt([], null), null);
  assertEquals(seasonEndEt(undefined), null);
  assertEquals(seasonEndEt([{ week_end: null }, { week_end: 'not a date' }]), null);
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
