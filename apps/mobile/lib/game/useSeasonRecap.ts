/**
 * useSeasonRecap: the Matchup recap's data (Giorgio, 2026-11-18, look A). ONE league-wide
 * read of the season's `matchups`, every week and every game, with an exact count (the
 * useAllMatchups pattern). NOT get_home_league's caller-scoped list: that list caused
 * #545's season-end bug. A short read is a FAILURE (readGuard), never a shorter season.
 * Names come from the standings (useMatchup's `names`, no request). Runs only while
 * `enabled` (the 'complete' view), so a season in progress never pays for it.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { seamTable } from './seamCalls';
import { useAuth } from '../useAuth';
import { buildRecap, recapReadComplete, recapReadKey, resolveRecapRows, type RecapMatchup, type RecapRowsState, type SeasonRecap } from './seasonRecap';
import { CAPTURE_DELAY_MS, SEAM_ON } from './devSeam';

export interface SeasonRecapState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  recap: SeasonRecap | null;
  /** The raw rows, for the week detail's record-through-that-week. */
  matchups: RecapMatchup[];
  retry: () => void;
}

export function useSeasonRecap(
  leagueId: string | null,
  league: { numWeeks: number | null; playoffTeams: number | null },
  names: { user_id: string; display_name: string }[],
  enabled: boolean,
): SeasonRecapState {
  const { user } = useAuth();
  const [state, setState] = useState<RecapRowsState | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Which read this render wants. The rows on screen are only ever THIS read's (resolveRecapRows):
  // switching from completed league A to B reads as loading at once, never A's games under B.
  const key = enabled && leagueId && user?.id ? recapReadKey(leagueId, user.id, attempt) : null;

  useEffect(() => {
    if (key === null || !leagueId) return;
    let cancelled = false;
    (async () => {
      try {
        // DEV capture only (EXPO_PUBLIC_CAPTURE_DELAY_MS): hold the read so the loading state can be shot.
        if (SEAM_ON && CAPTURE_DELAY_MS > 0) await new Promise((r) => setTimeout(r, CAPTURE_DELAY_MS));
        const res = await seamTable('matchups_season', () => supabase
          .from('matchups')
          .select('week_number, team1_user_id, team2_user_id, team1_gain, team2_gain, winner_user_id, is_tie, is_playoff, week_start, week_end, outcome_reason, team1_percent_gain, team2_percent_gain', { count: 'exact' })
          .eq('league_id', leagueId));
        if (res.error) throw res.error;
        const data = (res.data ?? []) as RecapMatchup[];
        // Read-cap guard: a partial read must fail visibly, never render a shorter season.
        if (!recapReadComplete(data.length, res.count ?? null)) throw new Error('matchups read incomplete');
        if (__DEV__) console.log('[game:season-recap] 1 request (matchups, whole season)');
        if (cancelled) return;
        setState({ key, status: 'ready', matchups: data });
      } catch (err) {
        if (cancelled) return;
        console.warn('[game:season-recap] failed', (err as Error).message);
        setState({ key, status: 'error', matchups: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, leagueId]);

  const rows = useMemo(() => resolveRecapRows({ enabled, key, state }), [enabled, key, state]);
  const namesKey = names.map((n) => `${n.user_id}:${n.display_name}`).join('|');
  const recap = useMemo(
    () => (rows.status === 'ready' && user?.id
      ? buildRecap({ matchups: rows.matchups, myUserId: user.id, names, numWeeks: league.numWeeks, playoffTeams: league.playoffTeams })
      : null),
    // `names` is keyed by namesKey so a new array of the same names doesn't rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, user?.id, namesKey, league.numWeeks, league.playoffTeams],
  );

  return { status: rows.status, recap, matchups: rows.matchups, retry: () => setAttempt((a) => a + 1) };
}
