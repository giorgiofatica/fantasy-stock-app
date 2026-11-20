/**
 * outcome-record.ts: what process-week-results stores about why a matchup came
 * out as it did. Hermetic (no DB, no network):
 *   deno test supabase/functions/process-week-results/outcome-record.test.ts
 */
import { assertEquals } from 'jsr:@std/assert';
import {
  decideMatchupOutcome,
  type OutcomeReason,
  type PlayoffMatchup,
  type TeamScore,
} from './playoff-progression.ts';
import { RECORDED_OUTCOME_REASONS, recordOutcome, recordedReason, storedPercent } from './outcome-record.ts';

const held = (dollarGain: number, percentGain: number): TeamScore => ({ dollarGain, percentGain, hasPositions: true });
const EMPTY: TeamScore = { dollarGain: 0, percentGain: 0, hasPositions: false };
const m = (over: Partial<PlayoffMatchup> = {}): PlayoffMatchup => ({
  team1UserId: 'a', team2UserId: 'b', team1Seed: null, team2Seed: null, isPlayoff: false, ...over,
});

// A compile-time exhaustive map: adding a reason to OutcomeReason without
// listing it here fails the type check, and the test below then fails until it
// is also in RECORDED_OUTCOME_REASONS (and so in the migration's CHECK, which
// matchup_outcome_reason.pglite.test.ts pins to the same list).
const EVERY_DECIDED_REASON: Record<OutcomeReason, true> = {
  bye_no_result: true,
  both_empty_tie: true,
  both_empty_playoff_seed_tiebreak: true,
  playoff_no_opponent: true,
  team1_empty_auto_loss: true,
  team2_empty_auto_loss: true,
  dollar_gain: true,
  percent_tiebreak: true,
  playoff_seed_tiebreak: true,
  regular_season_true_tie: true,
};

Deno.test('every reason decideMatchupOutcome returns is storable, plus exactly the two markers', () => {
  const decided = Object.keys(EVERY_DECIDED_REASON);
  assertEquals(
    [...RECORDED_OUTCOME_REASONS].sort(),
    [...decided, 'playoff_seed_unresolved', 'not_recorded'].sort(),
  );
});

Deno.test('non-seed reasons are stored as decided', () => {
  const cases: Array<[PlayoffMatchup, TeamScore, TeamScore, OutcomeReason]> = [
    [m({ team2UserId: null }), held(1, 1), EMPTY, 'bye_no_result'],
    [m(), EMPTY, EMPTY, 'both_empty_tie'],
    [m(), EMPTY, held(1, 1), 'team1_empty_auto_loss'],
    [m(), held(1, 1), EMPTY, 'team2_empty_auto_loss'],
    [m(), held(2, 1), held(1, 1), 'dollar_gain'],
    [m(), held(1, 2), held(1, 1), 'percent_tiebreak'],
    [m(), held(1, 1), held(1, 1), 'regular_season_true_tie'],
    // playoff_no_opponent: resolveBySeed with no team 2. Not a seed comparison,
    // so it is stored as decided even with no seeds at all.
    [m({ isPlayoff: true, team2UserId: null }), EMPTY, EMPTY, 'playoff_no_opponent'],
  ];
  for (const [mm, s1, s2, want] of cases) {
    const outcome = decideMatchupOutcome(mm, s1, s2);
    assertEquals(outcome.reason, want);
    assertEquals(recordedReason(mm, outcome), want);
  }
});

Deno.test('a seed reason is stored only when both seeds are present and different', () => {
  const seeds: Array<[number | null, number | null, boolean]> = [
    [1, 4, true],
    [4, 1, true],
    [2, 2, false], // equal: resolveBySeed handed it to team 2 without a real comparison
    [null, 3, false],
    [3, null, false],
    [null, null, false],
    [0, 2, false], // resolveBySeed reads `0 || 999`: a 0 was not compared either
  ];
  for (const [team1Seed, team2Seed, compared] of seeds) {
    for (const [s1, s2, reason] of [
      [held(1, 1), held(1, 1), 'playoff_seed_tiebreak'],
      [EMPTY, EMPTY, 'both_empty_playoff_seed_tiebreak'],
    ] as const) {
      const mm = m({ isPlayoff: true, team1Seed, team2Seed });
      const outcome = decideMatchupOutcome(mm, s1, s2);
      assertEquals(outcome.reason, reason);
      assertEquals(
        recordedReason(mm, outcome),
        compared ? reason : 'playoff_seed_unresolved',
        `${reason} seeds ${team1Seed} vs ${team2Seed}`,
      );
    }
  }
});

Deno.test('who wins never changes: the record carries no winner', () => {
  const mm = m({ isPlayoff: true, team1Seed: 2, team2Seed: 2 });
  const outcome = decideMatchupOutcome(mm, held(1, 1), held(1, 1));
  const record = recordOutcome(mm, outcome, held(1, 1), held(1, 1));
  assertEquals(Object.keys(record).sort(), ['outcome_reason', 'team1_percent_gain', 'team2_percent_gain']);
  assertEquals(outcome.winnerId, 'b');
});

Deno.test('a percent is stored for a side with stocks, NULL for a side with none or no side at all', () => {
  assertEquals(storedPercent(held(5, 1.76)), 1.76);
  assertEquals(storedPercent(held(-5, -0.74)), -0.74);
  assertEquals(storedPercent(held(0, 0)), 0); // a real 0% on a held portfolio is a number
  assertEquals(storedPercent(EMPTY), null);
  assertEquals(storedPercent({ dollarGain: 0, percentGain: 3, hasPositions: false }), null);
  assertEquals(storedPercent(null), null); // a bye's missing team 2
  assertEquals(storedPercent(held(1, Number.NaN)), null);
  assertEquals(storedPercent(held(1, Number.POSITIVE_INFINITY)), null);
});

Deno.test('a percent_tiebreak record always carries both percents (the table CHECK)', () => {
  // Every pair that decides on percent: both sides held stocks, so both stored.
  for (const [p1, p2] of [[1.76, 0.74], [0.74, 1.76], [-1, -2], [0, 0.01]]) {
    const outcome = decideMatchupOutcome(m(), held(10, p1), held(10, p2));
    assertEquals(outcome.reason, 'percent_tiebreak');
    const r = recordOutcome(m(), outcome, held(10, p1), held(10, p2));
    assertEquals([r.team1_percent_gain, r.team2_percent_gain], [p1, p2]);
  }
  // A NaN percent fails every `>` both ways, so a NaN side never reaches a
  // percent_tiebreak row (it falls through to the tie): storedPercent's NULL for
  // a non-finite value can never meet the CHECK.
  assertEquals(decideMatchupOutcome(m(), held(10, Number.NaN), held(10, 1)).reason, 'regular_season_true_tie');
  assertEquals(decideMatchupOutcome(m(), held(10, Number.NaN), held(10, Number.NaN)).reason, 'regular_season_true_tie');
});
