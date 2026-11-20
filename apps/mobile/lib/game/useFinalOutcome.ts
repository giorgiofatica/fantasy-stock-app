/**
 * useFinalOutcome: the stored reason a finished week was decided the way it was
 * (matchups.outcome_reason + the two stored percents, migration 20261208000000), for the Matchup
 * tab's "My matchup" finished week. That tab's own data is get_home_league, an RPC with a fixed
 * column list that does not carry the new columns; extending it would need a migration (DROP +
 * CREATE + grants), so this reads the `matchups` table directly instead (members can SELECT it
 * under RLS), once, for the one finished week. The recap's week detail and All matchups already
 * read the table (useSeasonRecap, useAllMatchups) and select the columns there.
 *
 * Never blocks the card: until the read lands, and when it fails, the outcome is undefined and the
 * line keeps #566's rule (lib/game/outcomeLine finalLine). The result is keyed by league, week and
 * user, so league A's reason never shows under league B's card.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { seamTable } from './seamCalls';
import { finalOutcomeKey, outcomeFromRows, type OutcomeColumns, type RecordedOutcome } from './outcomeLine';

export const FINAL_OUTCOME_COLUMNS = 'team1_user_id, team2_user_id, outcome_reason, team1_percent_gain, team2_percent_gain';

export function useFinalOutcome(leagueId: string | null, week: number | null, userId: string | null, enabled: boolean): RecordedOutcome | undefined {
  const [state, setState] = useState<{ key: string; outcome: RecordedOutcome | undefined } | null>(null);
  const key = enabled && leagueId && week !== null && userId ? finalOutcomeKey(leagueId, week, userId) : null;
  useEffect(() => {
    if (key === null || !leagueId || week === null || !userId) return;
    let cancelled = false;
    void seamTable<OutcomeColumns>('matchups_week', () =>
      supabase.from('matchups').select(FINAL_OUTCOME_COLUMNS).eq('league_id', leagueId).eq('week_number', week),
    ).then((res) => {
      if (cancelled) return;
      if (res.error) {
        console.warn('[game:final-outcome] read failed', (res.error as { message?: string })?.message);
        setState({ key, outcome: undefined });
        return;
      }
      setState({ key, outcome: outcomeFromRows(res.data ?? [], userId) });
    });
    return () => {
      cancelled = true;
    };
  }, [key, leagueId, week, userId]);
  return state !== null && state.key === key ? state.outcome : undefined;
}
