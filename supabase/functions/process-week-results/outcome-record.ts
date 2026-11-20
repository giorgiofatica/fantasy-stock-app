/**
 * What process-week-results STORES about why a matchup came out as it did
 * (docs/plans/2026-11-19-matchup-outcome-reason.md, migration 20261208000000).
 *
 * Pure: no DB, no Deno APIs. The handler spreads recordOutcome(...) into the
 * ONE matchups update that writes the winner, so the reason, the percents and
 * the winner are written together or not at all.
 *
 * Two things differ from decideMatchupOutcome's own return, and only in what
 * is stored. Who wins, and who advances, never changes here:
 *
 * 1. A seed reason is stored only when BOTH seeds were present and different.
 *    resolveBySeed reads a missing seed as 999 and gives equal seeds to team 2,
 *    so with bad data it still names a winner. "Advances as the higher seed"
 *    would then describe a comparison that did not happen. Such a row stores
 *    'playoff_seed_unresolved' instead ("The seed line cannot lie").
 *    "Present" matches what resolveBySeed compared: it uses `seed || 999`, so a
 *    seed it replaced with 999 (null, undefined, 0) was not present.
 *
 * 2. A side's percent is stored only when that side held stocks
 *    (hasPositions), and only when it is a finite number. A side with no
 *    stocks has no percent; 0 would be a zero standing in for nothing. A
 *    non-finite value would become null in JSON anyway; this makes that
 *    explicit. A percent_tiebreak row always has both (both sides held stocks,
 *    and a NaN cannot win a `>` comparison), which the table's CHECK enforces.
 */

import type { Outcome, OutcomeReason, PlayoffMatchup, TeamScore } from './playoff-progression.ts';

/** Every value matchups.outcome_reason may hold (the migration's CHECK list). */
export type RecordedOutcomeReason = OutcomeReason | 'playoff_seed_unresolved' | 'not_recorded';

/** The CHECK list of 20261208000000, in the same order. The PGlite test pins them equal. */
export const RECORDED_OUTCOME_REASONS: readonly RecordedOutcomeReason[] = [
  'bye_no_result',
  'both_empty_tie',
  'both_empty_playoff_seed_tiebreak',
  'playoff_no_opponent',
  'team1_empty_auto_loss',
  'team2_empty_auto_loss',
  'dollar_gain',
  'percent_tiebreak',
  'playoff_seed_tiebreak',
  'regular_season_true_tie',
  'playoff_seed_unresolved',
  'not_recorded',
];

/** The three columns this adds to the result update. */
export interface OutcomeRecord {
  outcome_reason: RecordedOutcomeReason;
  team1_percent_gain: number | null;
  team2_percent_gain: number | null;
}

const SEED_REASONS: ReadonlySet<OutcomeReason> = new Set<OutcomeReason>([
  'playoff_seed_tiebreak',
  'both_empty_playoff_seed_tiebreak',
]);

/** A seed resolveBySeed actually compared (it replaces a falsy seed with 999). */
function seedPresent(seed: number | null | undefined): seed is number {
  return typeof seed === 'number' && Number.isFinite(seed) && seed !== 0;
}

/** The reason to store for this outcome. */
export function recordedReason(m: PlayoffMatchup, outcome: Outcome): RecordedOutcomeReason {
  if (!SEED_REASONS.has(outcome.reason)) return outcome.reason;
  const ok = seedPresent(m.team1Seed) && seedPresent(m.team2Seed) && m.team1Seed !== m.team2Seed;
  return ok ? outcome.reason : 'playoff_seed_unresolved';
}

/** A side's stored percent: its percent if it held stocks, else NULL. */
export function storedPercent(score: TeamScore | null): number | null {
  if (!score || !score.hasPositions) return null;
  return Number.isFinite(score.percentGain) ? score.percentGain : null;
}

/**
 * The columns to add to the result update. `team2Score` is null on a bye
 * (there is no second team, so no second percent).
 */
export function recordOutcome(
  m: PlayoffMatchup,
  outcome: Outcome,
  team1Score: TeamScore,
  team2Score: TeamScore | null,
): OutcomeRecord {
  return {
    outcome_reason: recordedReason(m, outcome),
    team1_percent_gain: storedPercent(team1Score),
    team2_percent_gain: storedPercent(team2Score),
  };
}
