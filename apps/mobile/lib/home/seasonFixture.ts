/**
 * Home's "Your season" capture knobs (EXPO_PUBLIC_SEASON_FIXTURE, dev only; the Home dev fixture
 * seam in useHomeLeague). Pure data transforms on the fixture's matchup rows: the knob changes
 * the rows the real code reads, once, at the source; the strip's own render carries no flag.
 *
 *  - unset          the board's league: weeks 1-5 played, week 6 this week, weeks 7-14 ahead.
 *  - 'tie_past'     week 2 ended in a tie (equal gains).
 *  - 'bye_past'     week 2 was a bye (nobody across).
 *  - 'unscored_past' week 3 has no gains posted yet, though its opponent is known.
 *  - 'week11'       ten weeks played, week 11 this week, weeks 12-14 ahead (see useHomeLeague).
 *
 * The playoff_pending Home state is its own HOME_FIXTURE (devFixture.ts).
 */

export type SeasonFixtureVariant = 'default' | 'tie_past' | 'bye_past' | 'unscored_past' | 'week11';

export function parseSeasonFixture(raw: string | undefined): SeasonFixtureVariant {
  return raw === 'tie_past' || raw === 'bye_past' || raw === 'unscored_past' || raw === 'week11' ? raw : 'default';
}

/** The weeks the schedule already holds ahead of this one: week 7 is Paolo M. (the board's
 * "Wk 7"), then the others in turn, to the league's last regular week. Dates run a week apart
 * from the real Monday 9:30 AM ET / Friday 4:00 PM ET of week 7. */
const AHEAD_OPPONENTS = ['paolo', 'luca', 'chiara', 'marco', 'gianluigi'];
export function scheduleAhead(args: { firstWeek: number; lastWeek: number; me: string; firstStartMs: number }): MatchupRowShape[] {
  const out: MatchupRowShape[] = [];
  for (let w = args.firstWeek; w <= args.lastWeek; w++) {
    const start = new Date(args.firstStartMs + (w - args.firstWeek) * 7 * 24 * 3600 * 1000);
    out.push({
      week_number: w,
      week_start: start.toISOString(),
      week_end: new Date(start.getTime() + 4 * 24 * 3600 * 1000 + 6.5 * 3600 * 1000).toISOString(),
      is_playoff: false,
      team1_user_id: args.me,
      team2_user_id: AHEAD_OPPONENTS[(w - args.firstWeek) % AHEAD_OPPONENTS.length],
      team1_gain: null,
      team2_gain: null,
    });
  }
  return out;
}

export interface MatchupRowShape {
  week_number: number; week_start: string; week_end: string; is_playoff: boolean;
  team1_user_id: string | null; team2_user_id: string | null; team1_gain: number | null; team2_gain: number | null;
}

/** The past-week knobs, applied to a copy of the rows. `week11` is built where the weeks are made. */
export function applySeasonVariant<T extends MatchupRowShape>(rows: T[], variant: SeasonFixtureVariant): T[] {
  if (variant === 'tie_past') return rows.map((r) => (r.week_number === 2 ? { ...r, team1_gain: 58.75, team2_gain: 58.75 } : r));
  if (variant === 'bye_past') return rows.map((r) => (r.week_number === 2 ? { ...r, team2_user_id: null, team1_gain: null, team2_gain: null } : r));
  if (variant === 'unscored_past') return rows.map((r) => (r.week_number === 3 ? { ...r, team1_gain: null, team2_gain: null } : r));
  return rows;
}

/** What get_home_league carries from 20261126000000: the server's `winner_user_id` / `is_tie`,
 * written as process-week-results writes them for these rows (no fixture has an empty portfolio,
 * a percent tiebreak or a playoff tie): the higher dollar gain wins; equal gains in the regular
 * season are a tie (winner null, is_tie true); an unscored row or a bye has no winner and no tie. */
export function withServerResults<T extends MatchupRowShape>(rows: T[]): (T & { winner_user_id: string | null; is_tie: boolean })[] {
  return rows.map((r) => {
    const scored = r.team1_user_id !== null && r.team2_user_id !== null && r.team1_gain !== null && r.team2_gain !== null;
    if (!scored) return { ...r, winner_user_id: null, is_tie: false };
    const g1 = r.team1_gain!;
    const g2 = r.team2_gain!;
    return { ...r, winner_user_id: g1 > g2 ? r.team1_user_id : g2 > g1 ? r.team2_user_id : null, is_tie: g1 === g2 };
  });
}
