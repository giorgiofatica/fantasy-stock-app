/**
 * leagueHasWeeks: does this league play in weeks? Only a Matchup league does. The server keys its
 * weekly jobs on the same thing (snapshot-week-start, snapshot-week-end and process-week-results
 * all filter `league_type = 'matchup'`), so a Duration league has no week snapshots and no
 * matchups: a week figure there would be a stand-in, never a real number.
 *
 * Keyed on the LEAGUE TYPE, not on a missing row: a missing row in a Matchup league is a gap
 * (playerCardModel's stockWeek reports it as unknown), while a Duration league has no weeks at all.
 * An unknown type (the league not loaded yet) is treated as no weeks, so nothing is shown before
 * the app knows. Pure, so tests-deno/league-weeks.test.ts pins it.
 */
export function leagueHasWeeks(leagueType: string | null | undefined): boolean {
  return leagueType === 'matchup';
}
