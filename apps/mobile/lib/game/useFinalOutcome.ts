/**
 * useFinalOutcome: the stored reason a finished week was decided the way it was
 * (matchups.outcome_reason + the two stored percents, migration 20261208000000), for the Matchup
 * tab's "My matchup" finished week. That tab's own data (the card's winner, tie and gains) is
 * get_home_league, an RPC with a fixed column list that carries neither the new columns nor a matchup
 * id; extending it would need a migration (DROP + CREATE + grants), so this makes ONE second read of
 * the `matchups` table (members can SELECT it under RLS). The recap's week detail and All matchups
 * read the table already (useSeasonRecap, useAllMatchups) and select the columns there.
 *
 * Because the card takes its winner from one read and its reason from another, and the line NAMES the
 * winner, the reason is only believed while the two agree (Planner, 2026-11-20):
 *  - ONE matchup: the read is keyed on league_id + the RPC row's own week_number, team1_user_id and
 *    team2_user_id exactly as given (a team appears once per week: unique(league_id, week_number,
 *    team1_user_id) and the same for team2), with `.maybeSingle()`: zero rows, or more than one (its
 *    error), give no reason. A row with no team 2 (a bye, an unfilled playoff slot) makes NO read.
 *  - AGREE: the hook returns the row; `agreedOutcome` (lib/game/outcomeLine) shows its reason only when
 *    the row's winner_user_id and is_tie equal the card's. The winner's NAME always comes from the card.
 *  - ERRORS: supabase-js resolves `{ data, error }` rather than throwing, so `error` is checked; an
 *    error, no row, a NULL reason, 'not_recorded' and 'playoff_seed_unresolved' all keep #566's rule.
 *    No retry loop.
 *  - FINISHED WEEKS ONLY: the caller passes a card only for a finished week; null makes no read.
 *
 * Never blocks the card: until the read lands, and when it fails, the row is undefined.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { seamTable } from './seamCalls';
import { outcomeReadKey, pickOutcomeRow, type CardMatchup, type OutcomeRead } from './outcomeLine';

export const FINAL_OUTCOME_COLUMNS = 'team1_user_id, team2_user_id, outcome_reason, team1_percent_gain, team2_percent_gain, winner_user_id, is_tie';

export function useFinalOutcome(card: CardMatchup | null): OutcomeRead | undefined {
  const [state, setState] = useState<{ key: string; row: OutcomeRead | undefined } | null>(null);
  const key = card ? outcomeReadKey(card) : null;
  useEffect(() => {
    if (!card || key === null) return;
    let cancelled = false;
    void seamTable<OutcomeRead>('matchups_week', () =>
      supabase.from('matchups').select(FINAL_OUTCOME_COLUMNS)
        .eq('league_id', card.leagueId).eq('week_number', card.week)
        .eq('team1_user_id', card.team1).eq('team2_user_id', card.team2)
        .maybeSingle()
        // maybeSingle resolves { data: row | null, error } (more than one row is its error); seamTable wants rows.
        .then((r) => ({ data: r.data ? [r.data as unknown as OutcomeRead] : [], error: r.error })),
    ).then((res) => {
      if (cancelled) return;
      if (res.error) {
        console.warn('[game:final-outcome] read failed', (res.error as { message?: string })?.message);
        setState({ key, row: undefined });
        return;
      }
      setState({ key, row: pickOutcomeRow(res.data ?? [], card) ?? undefined });
    });
    return () => {
      cancelled = true;
    };
    // `card` is keyed by outcomeReadKey: a new object for the same matchup does not re-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state !== null && state.key === key ? state.row : undefined;
}
