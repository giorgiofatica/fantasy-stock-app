/**
 * schedule (3c, League › Schedule). Built from the caller's own matchups for
 * every week (get_home_league returns them, so no request). Each regular-season
 * week is one row: past (result and your score), live (this week, not yet
 * posted), next (the week after), or future. A bye has no result and is never
 * a W or L. Playoff rows are not in this list; they are shown as a line.
 */
import { serverVerdict, weekResult, type WeekResult } from './weekResult';

/** The rows get_home_league returns for the caller: the gains and, from 20261126000000, the
 * server's winner (lib/game/weekResult decides W / L / T from them). */
export interface ScheduleMatchup {
  week_number: number;
  team1_user_id: string | null;
  team2_user_id: string | null;
  team1_gain: number | null;
  team2_gain: number | null;
  is_playoff: boolean;
  winner_user_id?: string | null;
  is_tie?: boolean | null;
}

export interface ScheduleRow {
  week: number;
  /** The opponent's display name, or '' when unknown (never invented), or null when there is no matchup. */
  opponent: string | null;
  bye: boolean;
  state: 'past' | 'live' | 'next' | 'future';
  /** W / L / T once both gains post (lib/game/weekResult); null for a bye or before posting. */
  result: WeekResult | null;
  /** Your dollar gain for the week, or null when not yet posted. */
  gain: number | null;
  /** The opponent's gain (null for a bye or before posting), for the W/L decision. */
  oppGain: number | null;
}

export function buildSchedule(input: {
  myUserId: string;
  currentWeek: number;
  numWeeks: number;
  names: { user_id: string; display_name: string }[];
  matchups: ScheduleMatchup[];
}): ScheduleRow[] {
  const nameOf = (id: string | null) => (id === null ? '' : input.names.find((n) => n.user_id === id)?.display_name ?? '');
  const rows: ScheduleRow[] = [];
  for (let week = 1; week <= input.numWeeks; week++) {
    const m = input.matchups.find((x) => x.week_number === week && !x.is_playoff) ?? null;
    const mine = m !== null && m.team1_user_id === input.myUserId;
    const theirs = m !== null && m.team2_user_id === input.myUserId;
    const isMine = mine || theirs;
    const myGain = !isMine || !m ? null : mine ? m.team1_gain : m.team2_gain;
    const posted = myGain !== null;
    const bye = isMine && m!.team2_user_id === null;
    const opponentId = !isMine || !m ? null : mine ? m.team2_user_id : m.team1_user_id;
    const oppGain = !isMine || !m || bye ? null : mine ? m.team2_gain : m.team1_gain;
    const state: ScheduleRow['state'] =
      week < input.currentWeek ? 'past'
      : week === input.currentWeek ? (posted ? 'past' : 'live')
      : week === input.currentWeek + 1 ? 'next'
      : 'future';
    rows.push({
      week,
      opponent: !isMine ? null : bye ? null : nameOf(opponentId),
      bye,
      state,
      // The one decider: the server's winner (a percent tiebreak, an empty portfolio's
      // automatic loss), else dollars. Was `won: myGain > oppGain` with `tie: false`, which
      // drew a tied week as an L.
      result: !isMine || !m || bye ? null : weekResult({ myGain, oppGain, verdict: serverVerdict(m, input.myUserId) }),
      gain: myGain,
      oppGain,
    });
  }
  return rows;
}
