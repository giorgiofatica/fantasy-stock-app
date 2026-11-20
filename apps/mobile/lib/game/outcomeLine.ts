/**
 * outcomeLine: the ONE place a FINISHED week's line under the card is worked out
 * (docs/plans/2026-11-19-matchup-outcome-reason.md, workstream 2). Pure: no RN, no I/O.
 *
 * The line is keyed on the reason the SERVER stored with the result (matchups.outcome_reason,
 * migration 20261208000000, written by process-week-results/outcome-record.ts), never worked
 * out from the totals. The words are Giorgio's pick A, winner first (2026-11-19, board
 * `#call-tiebreak-words`; docs/PRODUCT_RULES.md "Scoring and standings"), copied verbatim:
 *
 *   dollar_gain                       "{winner} won by $X"                         (as before)
 *   regular_season_true_tie           "Dead even"                                  (as before)
 *   both_empty_tie                    "Dead even", each total a dash
 *   percent_tiebreak                  "{winner} won the tiebreak, +1.76% to +0.74%" (winner's first)
 *   team1/team2_empty_auto_loss       "{winner} won. {loser} had no stocks"
 *   playoff_seed_tiebreak             "Tied. {winner} advances as the higher seed"
 *   both_empty_playoff_seed_tiebreak  "No stocks on either side. {winner} advances as the higher seed"
 *
 * The percents are the two STORED values (team1/team2_percent_gain), formatted and never
 * computed: nothing here divides or multiplies a gain. They are read only for percent_tiebreak
 * (the table's CHECK guarantees both there); nothing branches on whether a percent is NULL.
 *
 * Everything else keeps #566's interim rule exactly (interimFinalLine): 'not_recorded' (weeks
 * scored before the column), 'playoff_seed_unresolved', a scored row with a NULL reason, a row
 * that lacks the column (an older cached response), any value this build does not know, and a
 * reason the row's own winner or totals contradict. That rule shows a line only when it is
 * provably true: the server's winner is the dollar leader ("won by"), or there is no winner and
 * the dollars are equal ("Dead even"); otherwise no line.
 */
import { formatMoney, formatPercent } from '../../components/sp/logic/money';
import type { ServerVerdict } from './weekResult';

/** The card's two sides: `you` is the LEFT half (your game: you), `opp` the right. */
export type CardSide = 'you' | 'opp';

export interface LineSide {
  name: string;
  gain: number;
}

/** The three outcome columns as a read returns them, with the two team ids to orient them.
 * Every outcome field may be ABSENT (an older cached response): absent reads as NULL. */
export interface OutcomeColumns {
  team1_user_id: string | null;
  team2_user_id: string | null;
  outcome_reason?: string | null;
  team1_percent_gain?: number | string | null;
  team2_percent_gain?: number | string | null;
}

/** A row's recorded outcome, oriented to the card's left side. */
export interface RecordedOutcome {
  /** matchups.outcome_reason as stored; null when NULL or absent. */
  reason: string | null;
  /** Which stored team the card's LEFT side is (so team1_/team2_ reasons name the right half). */
  leftIs: 'team1' | 'team2';
  /** The left and right sides' STORED percent gains (percent units: 1.76 = 1.76%). */
  leftPercent: number | null;
  rightPercent: number | null;
}

/** A stored numeric as a number, or null. PostgREST sends numeric as a JSON number; a string
 * form is accepted, never altered. Not a calculation: the value is the server's. */
function storedNumber(v: number | string | null | undefined): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** The row's outcome from `leftUserId`'s side, or undefined when that user is not on the row. */
export function recordedOutcome(row: OutcomeColumns, leftUserId: string): RecordedOutcome | undefined {
  const leftIs = row.team1_user_id === leftUserId ? 'team1' : row.team2_user_id === leftUserId ? 'team2' : null;
  if (leftIs === null) return undefined;
  const p1 = storedNumber(row.team1_percent_gain);
  const p2 = storedNumber(row.team2_percent_gain);
  const reason = typeof row.outcome_reason === 'string' ? row.outcome_reason : null;
  return { reason, leftIs, leftPercent: leftIs === 'team1' ? p1 : p2, rightPercent: leftIs === 'team1' ? p2 : p1 };
}

/** The outcome for `userId`'s game among a week's rows, oriented to userId as the left side. */
export function outcomeFromRows(rows: readonly OutcomeColumns[], userId: string): RecordedOutcome | undefined {
  for (const row of rows) {
    const o = recordedOutcome(row, userId);
    if (o) return o;
  }
  return undefined;
}

/** useFinalOutcome's read key: league A's reason never shows under league B's card. */
export function finalOutcomeKey(leagueId: string, week: number, userId: string): string {
  return `${leagueId}:${week}:${userId}`;
}

export interface FinalLine {
  /** The server's winner on the card, or null (a tie, or a verdict not read). */
  leader: CardSide | null;
  /** The line under the card, or null: no line. */
  line: string | null;
  /** A side the server recorded as holding no stocks: its total is drawn as a dash, never
   * $0.00 (Giorgio, 2026-11-18: "A missing number never shows as zero"; the board drew "–").
   * Known only from the reason, never from a NULL percent. */
  noStocks: { you: boolean; opp: boolean };
  /** True for the four new reason lines (percent tiebreak, no stocks, the two seed lines) and only them: the
   * ones the Design Lead's break rules apply to at render (keepOutcomeLine). "won by $X" and "Dead even" are not. */
  reasoned?: boolean;
}

const NONE = { you: false, opp: false } as const;

/** #566's rule (review 2 on #566; Planner, 2026-11-19), unchanged: the line names the SERVER's
 * winner only when the dollars say the same; a server tie says "Dead even" only on equal dollars. */
export function interimFinalLine(you: LineSide, opp: LineSide, verdict: ServerVerdict | undefined): FinalLine {
  const dollarLeader: CardSide | null = you.gain === opp.gain ? null : you.gain > opp.gain ? 'you' : 'opp';
  if (verdict === undefined) return { leader: null, line: null, noStocks: NONE };
  if (verdict === 'nobody') return { leader: null, line: dollarLeader === null ? 'Dead even' : null, noStocks: NONE };
  const winner: CardSide = verdict === 'me' ? 'you' : 'opp';
  if (winner !== dollarLeader) return { leader: winner, line: null, noStocks: NONE };
  const margin = formatMoney(Math.abs(you.gain - opp.gain));
  return { leader: winner, line: `${winner === 'you' ? you.name : opp.name} won by ${margin}`, noStocks: NONE };
}

/** The line under a FINISHED week's card. `verdict` is the server's winner from the left side
 * (weekResult's serverVerdict); `outcome` is the stored reason (recordedOutcome). */
export function finalLine(you: LineSide, opp: LineSide, verdict: ServerVerdict | undefined, outcome?: RecordedOutcome): FinalLine {
  const interim = interimFinalLine(you, opp, verdict);
  if (!outcome || verdict === undefined) return interim;
  const winner: CardSide | null = verdict === 'me' ? 'you' : verdict === 'opponent' ? 'opp' : null;
  const name = (s: CardSide) => (s === 'you' ? you.name : opp.name);
  const sideOf = (team: 'team1' | 'team2'): CardSide => (team === outcome.leftIs ? 'you' : 'opp');
  const level = you.gain === opp.gain;

  switch (outcome.reason) {
    case 'both_empty_tie':
      // A regular-season week with no stocks on either side: a tie, each total a dash.
      return winner === null && level ? { leader: null, line: 'Dead even', noStocks: { you: true, opp: true } } : interim;
    case 'percent_tiebreak': {
      if (winner === null || !level) return interim;
      const winnerPct = winner === 'you' ? outcome.leftPercent : outcome.rightPercent;
      const loserPct = winner === 'you' ? outcome.rightPercent : outcome.leftPercent;
      // The server compared these two and the winner's was higher; a row that says otherwise is not stated.
      if (winnerPct === null || loserPct === null || !(winnerPct > loserPct)) return interim;
      const pct = (p: number) => formatPercent(p, { sign: 'always' });
      return { leader: winner, line: `${name(winner)} won the tiebreak, ${pct(winnerPct)} to ${pct(loserPct)}`, noStocks: NONE, reasoned: true };
    }
    case 'team1_empty_auto_loss':
    case 'team2_empty_auto_loss': {
      const loser = sideOf(outcome.reason === 'team1_empty_auto_loss' ? 'team1' : 'team2');
      if (winner === null || winner === loser) return interim;
      return { leader: winner, line: `${name(winner)} won. ${name(loser)} had no stocks`, noStocks: { you: loser === 'you', opp: loser === 'opp' }, reasoned: true };
    }
    case 'playoff_seed_tiebreak':
      if (winner === null || !level) return interim;
      return { leader: winner, line: `Tied. ${name(winner)} advances as the higher seed`, noStocks: NONE, reasoned: true };
    case 'both_empty_playoff_seed_tiebreak':
      if (winner === null || !level) return interim;
      return { leader: winner, line: `No stocks on either side. ${name(winner)} advances as the higher seed`, noStocks: { you: true, opp: true }, reasoned: true };
    // dollar_gain and regular_season_true_tie say what #566 says ("won by" / "Dead even"), and it
    // checks them against the totals. not_recorded, playoff_seed_unresolved, NULL, an absent column
    // and any unknown value keep #566's rule. bye_no_result / playoff_no_opponent have no second side.
    default:
      return interim;
  }
}
