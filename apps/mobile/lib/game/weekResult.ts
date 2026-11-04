/**
 * weekResult: the ONE place a decided week's result is worked out: W, L or T, never a
 * boolean. A `won: boolean` folded a tie into a loss ("Gianluigi B. wins Week 6" on a tied
 * week, Design Lead P1, 2026-11-03). With a three-way type, every consumer has to say what a
 * tie shows: `byResult` takes all three cases, and tests-deno/week-result.test.ts fails on a
 * two-way test of a result anywhere in the app.
 *
 * THE RULE is the server's, not the gains'. process-week-results (decideMatchupOutcome)
 * writes `matchups.winner_user_id`, and the standings (league_standings_ranked) count a
 * scored row as a win for the winner, a loss for the other side, and a tie (0.5) when the
 * winner is null. The two gains alone disagree with the server in three cases:
 *   1. a dollar tie that percent breaks (the server names a winner);
 *   2. an empty portfolio, an automatic loss even when the other side's gain is negative;
 *   3. a playoff dollar-and-percent tie, which the higher seed wins (a playoff never ties).
 * get_home_league carries `winner_user_id` and `is_tie` from migration 20261126000000. A row
 * from an older RPC without them falls back to dollars (> W, < L, = T), and in those three
 * cases it can differ from the standings until that migration is applied.
 *
 * Decided means SCORED: both gains posted (the standings' own `team1_gain is not null`).
 * The winner being null alone never decides a row, since an unscored row's winner is null too.
 */

export type WeekResult = 'W' | 'L' | 'T';

/** The server's verdict on a row, from my side. 'nobody' = winner_user_id null on a scored
 * row: a tie, as the standings count it. */
export type ServerVerdict = 'me' | 'opponent' | 'nobody';

/** A matchups row as get_home_league returns it. `winner_user_id` / `is_tie` are absent
 * (undefined) on an RPC from before 20261126000000. */
export interface VerdictRow {
  team1_user_id: string | null;
  team2_user_id: string | null;
  winner_user_id?: string | null;
  is_tie?: boolean | null;
}

/** The server's verdict on `row` for `myUserId`, or undefined when the row doesn't carry one
 * (an older RPC), or when its winner names neither side (not a verdict on this game). `is_tie`
 * is not read: the standings count on the winner alone, so the winner decides when the two disagree. */
export function serverVerdict(row: VerdictRow, myUserId: string): ServerVerdict | undefined {
  if (row.winner_user_id === undefined) return undefined;
  const winner = row.winner_user_id;
  if (winner === null) return 'nobody';
  if (winner === myUserId) return 'me';
  const opponent = row.team1_user_id === myUserId ? row.team2_user_id : row.team1_user_id;
  return winner === opponent ? 'opponent' : undefined;
}

const FROM_VERDICT: Record<ServerVerdict, WeekResult> = { me: 'W', opponent: 'L', nobody: 'T' };

/** A game's result, or null while it isn't scored (either gain still null: undecided, never
 * a W, an L or a T). Only for a game with an opponent: a bye has no result. */
export function weekResult(input: { myGain: number | null; oppGain: number | null; verdict?: ServerVerdict }): WeekResult | null {
  const { myGain, oppGain, verdict } = input;
  if (myGain === null || oppGain === null) return null;
  if (verdict !== undefined) return FROM_VERDICT[verdict];
  // An older RPC (no verdict): dollars decide, an exact dollar tie reads as a tie.
  return myGain > oppGain ? 'W' : myGain < oppGain ? 'L' : 'T';
}

/** Branch on a result with all three cases named, so a tie can't fall through as a loss. */
export function byResult<V>(result: WeekResult, cases: Record<WeekResult, V>): V {
  return cases[result];
}
