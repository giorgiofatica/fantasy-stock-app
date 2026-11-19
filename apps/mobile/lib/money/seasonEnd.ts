/**
 * seasonEnd: the season's last day, for a league whose season is over (finished-season Portfolio,
 * Giorgio 2026-11-18, pick A: the value is frozen at the season's last day). Pure, so
 * tests-deno/money-season-end.test.ts pins it.
 *
 * The last day is the ET date of the LATEST matchup week_end in the league, the playoff final included.
 * Not league_seasons.completed_at: the heal pass (process-week-results' healUncompletedSeasons) can stamp
 * that days after the final closed, and every close in between would leak into the frozen value. With
 * no matchups at all (none read), completed_at's ET date is the fallback; with neither, null (no end is
 * ever guessed).
 */
import { etDateOf } from '../game/matchupRoster';

export function seasonEndEt(
  matchups: readonly { week_end: string | null | undefined }[] | null | undefined,
  completedAt: string | null | undefined = null,
): string | null {
  let last: string | null = null;
  for (const m of matchups ?? []) {
    if (!m.week_end) continue;
    const d = etDateOf(m.week_end);
    if (d && (last == null || d > last)) last = d;
  }
  if (last) return last;
  return completedAt ? etDateOf(completedAt) : null;
}

/** One page of matchup `week_end`s, as supabase-js's PromiseLike query resolves it (the read never throws on a
 * Postgres error: it resolves `{ data, error }`, CLAUDE.md "success signals" #5). */
export type MatchupEndsRead = (leagueId: string) => PromiseLike<{
  data: readonly { week_end: string | null }[] | null;
  error: { message: string } | null;
}>;

/**
 * The season's last day from a LEAGUE-WIDE read of the matchups (every row, the playoff final included), never
 * get_home_league's `matchups`: those are CALLER-SCOPED (only the caller's own games, 20261126000000), so a manager
 * eliminated before the final, or one who missed the playoffs, would get their own last game as the season's end
 * and freeze the finished view early. A failed read is 'error' with no day: it never falls back to anything else.
 */
export async function readSeasonEnd(
  read: MatchupEndsRead,
  leagueId: string,
  completedAt: string | null,
): Promise<{ status: 'ready' | 'error'; endEt: string | null }> {
  let res: Awaited<ReturnType<MatchupEndsRead>>;
  try {
    res = await read(leagueId);
  } catch {
    return { status: 'error', endEt: null };
  }
  if (res.error) return { status: 'error', endEt: null };
  return { status: 'ready', endEt: seasonEndEt(res.data ?? [], completedAt) };
}

export type SeasonEndStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * What the screens see. Not over (or no league): 'idle'. A capture fixture: its own rows (null = still loading).
 * Otherwise this league's read result; none yet, or one for ANOTHER league (a switch mid-read): 'loading', the day
 * unknown (null), so nothing is frozen to a wrong date.
 */
export function resolveSeasonEnd(input: {
  enabled: boolean;
  leagueId: string | null;
  completedAt: string | null;
  fixtureRows?: readonly { week_end: string | null }[] | null;
  state: { leagueId: string; status: 'ready' | 'error'; endEt: string | null } | null;
}): { status: SeasonEndStatus; endEt: string | null } {
  const { enabled, leagueId, completedAt, fixtureRows, state } = input;
  if (!enabled || !leagueId) return { status: 'idle', endEt: null };
  if (fixtureRows !== undefined) {
    return fixtureRows === null ? { status: 'loading', endEt: null } : { status: 'ready', endEt: seasonEndEt(fixtureRows, completedAt) };
  }
  if (!state || state.leagueId !== leagueId) return { status: 'loading', endEt: null };
  return { status: state.status, endEt: state.endEt };
}
