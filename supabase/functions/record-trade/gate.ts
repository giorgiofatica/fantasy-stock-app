/**
 * Pure league-state gate for record-trade. No DB, no Deno runtime APIs, so it is
 * tested hermetically in gate.test.ts.
 *
 * Trading opens once the draft is done (draft_not_completed). A FINISHED season
 * closes the market (season_completed): a finished league stays in the league
 * sheet next to its successor under Run it back, and a stray trade there would
 * change a season that is already scored and frozen (get_league_history).
 *
 * "Finished" is EITHER of two facts (Giorgio, 2026-11-18: "A finished season is
 * closed to buying and selling."):
 *   1. season_status = 'completed' -- the flag process-week-results sets when it
 *      completes the season (Fri 21:15Z, or later via a heal);
 *   2. the season's last scoring window has closed BY DATE -- now is after the
 *      latest matchups.week_end for the league. Without this, the gap between
 *      the final window's close and the completion run (longer if completion is
 *      healed late) was open to a direct API call.
 *
 * record_trade_atomic (20261207000000) re-checks BOTH under its lock with the
 * same definition; seasonEndFromMatchups below is the TS twin of that SQL.
 */

export type TradeRefusal = 'draft_not_completed' | 'season_completed';

/** One matchups row, as the season-end read selects it. */
export interface SeasonMatchupRow {
  week_end: string | null;
  is_playoff: boolean | null;
}

/**
 * The instant the league's season ends: the latest matchups.week_end -- but ONLY
 * when the league's whole schedule is written. Otherwise null, and the date
 * check does not apply (the status flag still does).
 *
 * WHY "only when the schedule is written" (the partial-state trap, CLAUDE.md):
 * playoff rows are not created with the regular season. start_league_playoffs
 * inserts the whole bracket in one atomic call AFTER the regular season is
 * scored. Before that, the latest week_end is the end of the REGULAR season, and
 * "now > latest week_end" would lock trading between the regular season's close
 * and the bracket insert (for days if that transition is refused and healed),
 * then unlock it again once the bracket lands. So:
 *   - no matchups at all (e.g. a leftover Duration test league) -> null: today's
 *     behaviour, status flag only;
 *   - matchups but no playoff row (regular season, or a transition that has not
 *     run yet) -> null: the schedule is not complete, the season is not over;
 *   - any matchup with a NULL week_end -> null: the end is unknown, and a max
 *     over the rest would be a verdict drawn from a subset;
 *   - otherwise the max week_end over ALL the league's matchups (the final
 *     playoff round's, once the bracket exists).
 * A week_end that does not parse is treated like NULL.
 */
export function seasonEndFromMatchups(rows: readonly SeasonMatchupRow[]): Date | null {
  if (rows.length === 0) return null;
  if (!rows.some((r) => r.is_playoff === true)) return null;
  let end: number | null = null;
  for (const r of rows) {
    if (r.week_end == null) return null;
    const t = Date.parse(r.week_end);
    if (Number.isNaN(t)) return null;
    if (end === null || t > end) end = t;
  }
  return end === null ? null : new Date(end);
}

/**
 * `seasonEnd` is seasonEndFromMatchups' result (null = no date check). The
 * comparison is STRICT (now > seasonEnd): process-week-results scores trades
 * with created_at <= week_end, so a trade at exactly week_end still belongs to
 * the final window; only one after it falls outside every window.
 */
export function tradeRefusalReason(
  league: { draft_status: string | null; season_status: string | null },
  seasonEnd: Date | null,
  now: Date,
): TradeRefusal | null {
  if (league.draft_status !== 'completed') return 'draft_not_completed';
  if (league.season_status === 'completed') return 'season_completed';
  if (seasonEnd !== null && now.getTime() > seasonEnd.getTime()) return 'season_completed';
  return null;
}
