/**
 * useSeasonEnd: the last day of a season that is over (finished-season Portfolio, Giorgio 2026-11-18), from a
 * LEAGUE-WIDE read of the matchups (seasonEnd.readSeasonEnd). get_home_league's `matchups` is CALLER-SCOPED (only
 * the caller's own games, 20261126000000), so its latest week_end is the caller's LAST GAME: a manager eliminated
 * before the final, or one who missed the playoffs, would freeze the Portfolio at a day too early. This reads the
 * league's matchups (a member can: matchups SELECT is is_member(league_id)), newest week_end first, one row.
 *
 *  - 'loading' while the read is in flight or the league just changed (the day is unknown: the screen holds its
 *    skeleton); 'error' when the read FAILED (the day stays unknown and the screen shows its load failure: it never
 *    falls back to the caller's own matchups); 'ready' with the day (completed_at's date only when the league has
 *    no dated matchups at all).
 *  - `fixture` (the DEV capture seams, which have no database): the fixture's own matchups.
 * The decisions are pure (resolveSeasonEnd, readSeasonEnd), so tests-deno/money-season-end.test.ts pins them.
 *
 * Started by the finished-season worker (uncommitted when it stopped); finished here.
 */
import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { readSeasonEnd, resolveSeasonEnd, type MatchupEndsRead, type SeasonEndStatus } from './seasonEnd';

export type { SeasonEndStatus } from './seasonEnd';

export interface SeasonEnd {
  status: SeasonEndStatus;
  /** The season's last day (ET, YYYY-MM-DD); null until ready, and null when nothing could be read. */
  endEt: string | null;
  refresh: () => void;
}

/** A dev fixture's matchups (rows null: not loaded yet), or null in production. */
export type SeasonEndFixture = { rows: readonly { week_end: string | null }[] | null } | null;

/** The league's newest dated week_end. `nullsFirst: false`: week_end is nullable, and Postgres sorts NULLs FIRST in
 * a descending order, so without it one undated row would be the "newest" and hide the final. */
const readLeagueEnds: MatchupEndsRead = (leagueId) =>
  supabase
    .from('matchups')
    .select('week_end')
    .eq('league_id', leagueId)
    .order('week_end', { ascending: false, nullsFirst: false })
    .limit(1);

export function useSeasonEnd(leagueId: string | null, enabled: boolean, completedAt: string | null, fixture: SeasonEndFixture = null): SeasonEnd {
  const [state, setState] = useState<{ leagueId: string; status: 'ready' | 'error'; endEt: string | null } | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled || !leagueId || fixture) return;
    let cancelled = false;
    void readSeasonEnd(readLeagueEnds, leagueId, completedAt).then((r) => {
      if (cancelled) return;
      if (r.status === 'error') console.warn('[season-end] matchups read failed');
      setState({ leagueId, ...r });
    });
    return () => {
      cancelled = true;
    };
    // `tick` re-runs the read on Try again; completed_at is read when the league changes.
  }, [leagueId, enabled, tick, !!fixture]); // eslint-disable-line react-hooks/exhaustive-deps

  const view = resolveSeasonEnd({ enabled, leagueId, completedAt, fixtureRows: fixture ? fixture.rows : undefined, state });
  return { ...view, refresh };
}
