/**
 * seasonRecap: the Matchup tab after a season (Giorgio, 2026-11-18, the recap, look A;
 * docs/PRODUCT_RULES.md): the season's weeks, newest first (the final on top), each row
 * opening that week's matchup.
 *
 * Built from ONE league-wide read of `matchups` (useSeasonRecap), never from
 * get_home_league's caller-scoped list (that list caused #545's season-end bug). Pure, so
 * tests-deno/season-recap.test.ts checks the order, the labels, a tie, a bye, an eliminated
 * manager's last game, and that a short read is refused.
 *
 * The result is the ONE decider's (lib/game/weekResult: the server's winner, else dollars),
 * so a tie reads "T" here exactly as on League › Schedule and Home.
 */
import { playoffRoundLabelForWeek, playoffRoundShortName } from '../playoffs';
import { seasonTileWeekLabel } from '../home/homeCopy';
import { checkRowsComplete } from './readGuard';
import { serverVerdict, weekResult, type WeekResult } from './weekResult';

/** A `matchups` row, as useSeasonRecap reads it. */
export interface RecapMatchup {
  week_number: number;
  team1_user_id: string | null;
  team2_user_id: string | null;
  team1_gain: number | null;
  team2_gain: number | null;
  winner_user_id: string | null;
  is_tie: boolean | null;
  is_playoff: boolean;
  week_start: string | null;
  week_end: string | null;
}

/** What a row opens: app/matchup-week (league, week, a = the left side, b = the right). */
export interface RecapOpen {
  week: number;
  a: string;
  b: string;
}

/** One of MY weeks (the "My matchup" list). */
export interface RecapRow {
  week: number;
  /** "Wk N", or the playoff round's name ("Semifinals"): spoken, and All matchups' section head. */
  label: string;
  /** The row's chip on a playoff week: the round's SHORT name (SF / F / WC, Giorgio's chip names,
   * 2026-10-04; DL gate 2026-11-18: the full name squeezed the opponent's name); null on a regular week. */
  chip: string | null;
  isPlayoff: boolean;
  /** Null for a bye. '' when the name is unknown (never invented). */
  opponentName: string | null;
  bye: boolean;
  /** W / L / T once both gains post; null for a bye or a week that never posted. */
  result: WeekResult | null;
  /** My posted gain, or null when it never posted. */
  myGain: number | null;
  /** The opponent's posted gain (null for a bye or before posting). */
  oppGain: number | null;
  /** Null for a bye (E2) and for a week whose gains never posted (E3): no chevron, no tap. */
  opens: RecapOpen | null;
}

export interface RecapSide {
  userId: string;
  name: string;
  gain: number | null;
}

/** One game (the "All matchups" list). */
export interface RecapGame {
  a: RecapSide;
  /** Null for a bye. */
  b: RecapSide | null;
  /** True when the game involves the caller (the caller is then side a). */
  mine: boolean;
  /** True once both gains (or the bye's one gain) posted. */
  final: boolean;
  opens: RecapOpen | null;
}

export interface RecapWeek {
  week: number;
  label: string;
  isPlayoff: boolean;
  games: RecapGame[];
}

/** How my season ended. Null when the rows can't say (an unscored last playoff game). */
export type RecapStatus =
  | { kind: 'champion' }
  | { kind: 'runner_up' }
  | { kind: 'eliminated'; round: string | null }
  | { kind: 'missed_playoffs' }
  | null;

export interface SeasonRecap {
  mine: RecapRow[];
  all: RecapWeek[];
  status: RecapStatus;
}

export interface RecapInput {
  matchups: readonly RecapMatchup[];
  myUserId: string;
  names: readonly { user_id: string; display_name: string }[];
  numWeeks: number | null;
  playoffTeams: number | null;
}

/** "Wk N", or the round's name for a playoff week (falls back to "Wk N" when the round can't be named). */
export function recapWeekLabel(week: number, isPlayoff: boolean, numWeeks: number | null, playoffTeams: number | null): string {
  if (isPlayoff) {
    const round = playoffRoundLabelForWeek(week, numWeeks, playoffTeams);
    if (round) return round;
  }
  return seasonTileWeekLabel(week);
}

function isScored(m: RecapMatchup): boolean {
  return m.team1_gain !== null && (m.team2_user_id === null || m.team2_gain !== null);
}

/** A's result in a game with an opponent (the one decider), or null while unscored. */
function resultFor(m: RecapMatchup, userId: string): WeekResult | null {
  const isT1 = m.team1_user_id === userId;
  const myGain = isT1 ? m.team1_gain : m.team2_gain;
  const oppGain = isT1 ? m.team2_gain : m.team1_gain;
  return weekResult({ myGain, oppGain, verdict: serverVerdict(m, userId) });
}

/** How my season ended, from my playoff games: none = missed the playoffs; the last one won
 * in the season's last playoff week = champion; lost in the Final = runner-up; lost earlier =
 * out in that round. A playoff bye is no row at all (playoff-bracket.ts), so it never counts. */
export function recapStatus(matchups: readonly RecapMatchup[], myUserId: string, numWeeks: number | null, playoffTeams: number | null): RecapStatus {
  const playoff = matchups.filter((m) => m.is_playoff);
  const minePlayoff = playoff
    .filter((m) => m.team1_user_id === myUserId || m.team2_user_id === myUserId)
    .sort((x, y) => x.week_number - y.week_number);
  if (minePlayoff.length === 0) return { kind: 'missed_playoffs' };
  const last = minePlayoff[minePlayoff.length - 1];
  const finalWeek = Math.max(...playoff.map((m) => m.week_number));
  const result = last.team2_user_id === null ? null : resultFor(last, myUserId);
  if (result === null) return null;
  const isFinal = last.week_number === finalWeek;
  if (result === 'W') return isFinal ? { kind: 'champion' } : null;
  if (result === 'L') {
    if (isFinal) return { kind: 'runner_up' };
    return { kind: 'eliminated', round: playoffRoundLabelForWeek(last.week_number, numWeeks, playoffTeams) };
  }
  // A playoff game never ties (the higher seed wins); a 'T' here is a row the rows can't place.
  return null;
}

export function buildRecap(input: RecapInput): SeasonRecap {
  const { matchups, myUserId, names, numWeeks, playoffTeams } = input;
  const nameOf = (id: string) => names.find((n) => n.user_id === id)?.display_name ?? '';
  const label = (m: RecapMatchup) => recapWeekLabel(m.week_number, m.is_playoff, numWeeks, playoffTeams);
  // A row with no team 1 is skipped, never thrown on (allMatchups' rule).
  const valid = matchups.filter((m) => m.team1_user_id !== null);
  const newestFirst = [...valid].sort((x, y) => y.week_number - x.week_number);

  const mine: RecapRow[] = newestFirst
    .filter((m) => m.team1_user_id === myUserId || m.team2_user_id === myUserId)
    .map((m) => {
      const isT1 = m.team1_user_id === myUserId;
      const bye = m.team2_user_id === null;
      const oppId = bye ? null : isT1 ? m.team2_user_id! : m.team1_user_id!;
      const myGain = isT1 ? m.team1_gain : m.team2_gain;
      const oppGain = bye ? null : isT1 ? m.team2_gain : m.team1_gain;
      const result = bye ? null : resultFor(m, myUserId);
      return {
        week: m.week_number,
        label: label(m),
        chip: m.is_playoff && playoffRoundLabelForWeek(m.week_number, numWeeks, playoffTeams) ? playoffRoundShortName(label(m)) : null,
        isPlayoff: m.is_playoff,
        opponentName: oppId === null ? null : nameOf(oppId),
        bye,
        result,
        myGain,
        oppGain,
        opens: bye || result === null || oppId === null ? null : { week: m.week_number, a: myUserId, b: oppId },
      };
    });

  const weeks = new Map<number, RecapWeek>();
  for (const m of newestFirst) {
    const t1 = m.team1_user_id!;
    const t2 = m.team2_user_id;
    const isMine = t1 === myUserId || t2 === myUserId;
    // Your game puts you first (allMatchups' rule), so your half is the shaded one.
    const flip = t2 === myUserId;
    const aId = flip ? t2! : t1;
    const bId = flip ? t1 : t2;
    const aGain = flip ? m.team2_gain : m.team1_gain;
    const bGain = flip ? m.team1_gain : m.team2_gain;
    const final = isScored(m);
    const game: RecapGame = {
      a: { userId: aId, name: nameOf(aId), gain: aGain },
      b: bId === null ? null : { userId: bId, name: nameOf(bId), gain: bGain },
      mine: isMine,
      final,
      opens: bId === null || !final ? null : { week: m.week_number, a: aId, b: bId },
    };
    const w = weeks.get(m.week_number) ?? { week: m.week_number, label: label(m), isPlayoff: m.is_playoff, games: [] };
    w.games.push(game);
    weeks.set(m.week_number, w);
  }
  // Within a week, your game first (as All matchups does live); the rest keep the read's order.
  const all = [...weeks.values()].map((w) => ({ ...w, games: [...w.games.filter((g) => g.mine), ...w.games.filter((g) => !g.mine)] }));

  return { mine, all, status: recapStatus(valid, myUserId, numWeeks, playoffTeams) };
}

/** A user's regular-season record through `week` (the week's FinalBanner reads "W · 5–1"
 * as it stood THAT week, not the season's end). Null when the user played no scored game. */
export function recordThrough(matchups: readonly RecapMatchup[], userId: string, week: number): { wins: number; losses: number; ties: number } | null {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let any = false;
  for (const m of matchups) {
    if (m.is_playoff || m.week_number > week) continue;
    if (m.team1_user_id !== userId && m.team2_user_id !== userId) continue;
    if (m.team2_user_id === null) continue; // a bye is in no record
    const r = resultFor(m, userId);
    if (r === null) continue;
    any = true;
    if (r === 'W') wins++;
    else if (r === 'L') losses++;
    else ties++;
  }
  return any ? { wins, losses, ties } : null;
}

/** The read guard: a short read is a FAILURE, never a shorter season. */
export function recapReadComplete(received: number, count: number | null): boolean {
  return checkRowsComplete(received, count).ok;
}

/** One finished game for the week detail (app/matchup-week): the row for `week` between `a`
 * and `b` (either order), read from side a. Null when no such game exists, or it never posted
 * (a row only opens once scored, so a link to an unscored game is a stale link). */
export interface RecapGameDetail {
  week: number;
  isPlayoff: boolean;
  aGain: number;
  bGain: number;
  /** Side a's result (the one decider). */
  result: WeekResult;
  weekStart: string | null;
  weekEnd: string | null;
}

export function recapGameDetail(matchups: readonly RecapMatchup[], week: number, a: string, b: string): RecapGameDetail | null {
  const m = matchups.find((x) => x.week_number === week && ((x.team1_user_id === a && x.team2_user_id === b) || (x.team1_user_id === b && x.team2_user_id === a)));
  if (!m || !isScored(m)) return null;
  const aIsT1 = m.team1_user_id === a;
  const result = resultFor(m, a);
  if (result === null) return null;
  return {
    week,
    isPlayoff: m.is_playoff,
    aGain: (aIsT1 ? m.team1_gain : m.team2_gain)!,
    bGain: (aIsT1 ? m.team2_gain : m.team1_gain)!,
    result,
    weekStart: m.week_start,
    weekEnd: m.week_end,
  };
}

/** Home's bars with the week's own Friday closes (week_snapshots.week_end_price) laid in on
 * the week's last close date, so a past week's roster orders by THAT week's close and its
 * rows' prices are that close, never today's quote. Pure; bars stay date-ordered. */
export function withWeekCloses(
  bars: Readonly<Record<string, readonly { date: string; close: number }[]>>,
  closes: Readonly<Record<string, number>>,
  date: string | null,
): Record<string, { date: string; close: number }[]> {
  const out: Record<string, { date: string; close: number }[]> = {};
  for (const [sym, series] of Object.entries(bars)) out[sym] = [...series];
  if (!date) return out;
  for (const [sym, close] of Object.entries(closes)) {
    const series = (out[sym] ?? []).filter((b) => b.date !== date);
    series.push({ date, close });
    series.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
    out[sym] = series;
  }
  return out;
}
