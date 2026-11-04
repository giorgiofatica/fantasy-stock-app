/**
 * The week's ending band on Matchup (G3; its look restored by the game-screens gate,
 * GS-2). The board's `.ks-winner`: "Roberto B. wins Week 6" on the left, the record on
 * the right ("W · 5–1"). Pure, so tests-deno can check the words and the outcome that
 * picks the band's fill (your colour when you won, neutral when you lost or tied).
 */
import { formatRecord } from '../shell/leagueSheet';
import { byResult, type WeekResult } from './weekResult';

export type FinalOutcome = 'won' | 'lost' | 'tied';

export interface FinalBannerInput {
  week: number;
  /** The week's result, from the one decider (lib/game/weekResult: the server's winner, else
   * dollars). Never re-derived here from the two gains. */
  result: WeekResult;
  youName: string;
  oppName: string;
  /** Your record with this week counted; null when it isn't known. */
  record: { wins: number; losses: number; ties: number } | null;
  /** A playoff game: the standings record is the regular season's, so only the letter shows. */
  isPlayoff: boolean;
}

export interface FinalBannerModel {
  outcome: FinalOutcome;
  /** "Roberto B. wins Week 6" / "Tied in Week 6". */
  text: string;
  /** "W · 5–1" (board), or the bare letter when no record applies. */
  recordText: string;
  a11yLabel: string;
}

const LETTER: Record<FinalOutcome, string> = { won: 'W', lost: 'L', tied: 'T' };
const OUTCOME: Record<WeekResult, FinalOutcome> = { W: 'won', L: 'lost', T: 'tied' };

/** "Tied in Week 6": the one tie line (Matchup's band, and Home's scored card). */
export function tiedWeekLine(week: number): string {
  return `Tied in Week ${week}`;
}
const SPOKEN: Record<FinalOutcome, string> = { won: 'Win', lost: 'Loss', tied: 'Tie' };

export function buildFinalBanner(input: FinalBannerInput): FinalBannerModel {
  const { week, result, youName, oppName, record, isPlayoff } = input;
  const outcome = OUTCOME[result];
  const text = byResult(result, { W: `${youName} wins Week ${week}`, L: `${oppName} wins Week ${week}`, T: tiedWeekLine(week) });
  const recordPart = record && !isPlayoff ? formatRecord(record.wins, record.losses, record.ties) : null;
  return {
    outcome,
    text,
    recordText: recordPart ? `${LETTER[outcome]} · ${recordPart}` : LETTER[outcome],
    a11yLabel: recordPart ? `${text}. ${SPOKEN[outcome]}, record ${recordPart}.` : `${text}. ${SPOKEN[outcome]}.`,
  };
}
