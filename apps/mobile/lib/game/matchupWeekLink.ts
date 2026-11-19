/**
 * The recap's link to one finished game (app/matchup-week): the league, the week, and the two
 * sides, `a` on the left (you, in your own game) and `b` on the right. Pure, so the params a
 * row pushes and the ones the screen reads are checked against each other in tests-deno.
 */
export interface MatchupWeekParams {
  league: string;
  week: number;
  a: string;
  b: string;
}

export function matchupWeekHref(leagueId: string, open: { week: number; a: string; b: string }) {
  return {
    pathname: '/matchup-week' as const,
    params: { league: leagueId, week: String(open.week), a: open.a, b: open.b },
  };
}

/** The screen's params back, or null when any is missing or the week isn't a positive integer. */
export function parseMatchupWeekParams(p: { league?: string | string[]; week?: string | string[]; a?: string | string[]; b?: string | string[] }): MatchupWeekParams | null {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const league = one(p.league);
  const a = one(p.a);
  const b = one(p.b);
  const week = Number(one(p.week));
  if (!league || !a || !b || !Number.isInteger(week) || week < 1) return null;
  return { league, week, a, b };
}
