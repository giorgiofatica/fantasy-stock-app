/**
 * yourSeason: the tiles of Home's "Your season" strip (Design Lead build spec, 2026-11-03;
 * PRODUCT_RULES "No chart on Home"). Pure, so the rules are tested under Deno
 * (tests-deno/home-your-season.test.ts).
 *
 * One tile per week that has a row for YOU in the same matchup rows League › Schedule reads.
 * A week with no row is not drawn: a playoff week before the bracket names your opponent,
 * and the weeks after you are eliminated or missed the playoffs.
 *
 * The result of a played week is NEVER derived here from two gains (a tie would read as a
 * loss): it comes from the view model's `weeklyResults`, the one list that decides W / L / T.
 * A past week with no gain yet is `unscored`: a dash, never a W, an L or a Bye (the partial
 * state: the guards here were keyed on "scored or not scored", and a half-posted week read
 * as a bye).
 */

import { formatMoney } from '../../components/sp/logic/money';
import { seasonTileWeekLabel, SEASON_TILE_BYE, SEASON_TILE_UNSCORED } from './homeCopy';
import type { PhaseResult } from './homePhase';

export type SeasonResult = 'W' | 'L' | 'T';

/** A result row, as `buildHomeViewModel.weeklyResults` carries it. */
export interface SeasonWeeklyResult {
  week: number;
  gain: number;
  result: SeasonResult | 'BYE';
}

/** The raw matchup rows `get_home_league` returns. */
export interface SeasonMatchupRow {
  week_number: number;
  is_playoff: boolean;
  team1_user_id: string | null;
  team2_user_id: string | null;
  team1_gain: number | null;
  team2_gain: number | null;
}

/** What the THIS WEEK tile shows in its middle: the live dot, the hollow ring (market closed,
 * scoring, a playoff opponent not named yet), the result letter, or "Bye". Never a score. */
export type ThisWeekMiddle = 'live' | 'ring' | 'result' | 'bye';

export type SeasonTile =
  | { kind: 'played'; week: number; result: SeasonResult; gain: number }
  | { kind: 'unscored'; week: number }
  | { kind: 'bye'; week: number }
  | { kind: 'this'; week: number; middle: ThisWeekMiddle; result: SeasonResult | null; reason: 'live' | 'closed' | 'scoring' | 'pending' | 'scored' | 'bye'; showLive: boolean }
  | { kind: 'upcoming'; week: number; opponent: string };

/** The week the This week card is about, or null when Home has no this-week tile. A playoff
 * bye's own `week` names the LATER round (homePhase's laterPlayoffWeek), so the week you sit
 * out is the league's current week. */
export function thisWeekNumber(phase: PhaseResult, currentWeek: number): number | null {
  switch (phase.kind) {
    case 'live_open':
    case 'live_closed':
    case 'scoring':
    case 'scored':
    case 'bye':
    case 'playoff_pending':
      return phase.week;
    case 'playoff_bye':
      return currentWeek;
    default:
      return null;
  }
}

/** Whether the strip shows at all: in-season Home phases only. */
export function seasonStripShown(phaseKind: PhaseResult['kind']): boolean {
  return !['pre_draft', 'drafting', 'pre_season', 'complete'].includes(phaseKind);
}

function thisTile(phase: PhaseResult, week: number, r: SeasonWeeklyResult | undefined): SeasonTile {
  switch (phase.kind) {
    case 'live_open':
      return { kind: 'this', week, middle: 'live', result: null, reason: 'live', showLive: true };
    case 'live_closed':
      return { kind: 'this', week, middle: 'ring', result: null, reason: 'closed', showLive: false };
    case 'scoring':
      return { kind: 'this', week, middle: 'ring', result: null, reason: 'scoring', showLive: false };
    case 'playoff_pending':
      return { kind: 'this', week, middle: 'ring', result: null, reason: 'pending', showLive: false };
    case 'bye':
    case 'playoff_bye':
      return { kind: 'this', week, middle: 'bye', result: null, reason: 'bye', showLive: false };
    case 'scored':
      // A scored week with nobody across was a bye; one with a result shows its letter.
      if (r && r.result === 'BYE') return { kind: 'this', week, middle: 'bye', result: null, reason: 'bye', showLive: false };
      if (r) return { kind: 'this', week, middle: 'result', result: r.result as SeasonResult, reason: 'scored', showLive: false };
      // Scored per the phase but no result in the list: never a guessed letter.
      return { kind: 'this', week, middle: 'ring', result: null, reason: 'scoring', showLive: false };
    default:
      return { kind: 'this', week, middle: 'ring', result: null, reason: 'scoring', showLive: false };
  }
}

export function buildSeasonTiles(args: {
  myUserId: string;
  phase: PhaseResult;
  currentWeek: number;
  matchups: SeasonMatchupRow[];
  weeklyResults: SeasonWeeklyResult[];
  nameOf: (userId: string) => string;
}): SeasonTile[] {
  const { myUserId, phase, currentWeek, matchups, weeklyResults, nameOf } = args;
  const thisWeek = thisWeekNumber(phase, currentWeek);
  const resultOf = new Map(weeklyResults.map((r) => [r.week, r]));

  const mine = matchups
    .filter((m) => m.team1_user_id === myUserId || m.team2_user_id === myUserId)
    .sort((a, b) => a.week_number - b.week_number);

  const tiles: SeasonTile[] = [];
  const seen = new Set<number>();
  for (const m of mine) {
    if (seen.has(m.week_number)) continue;
    seen.add(m.week_number);
    const week = m.week_number;
    const isMe1 = m.team1_user_id === myUserId;
    const opponentId = isMe1 ? m.team2_user_id : m.team1_user_id;
    // A regular-season row with nobody across is a bye; a PLAYOFF row with nobody across is
    // a bracket slot not named yet, which is not a bye and is not drawn until it is named.
    const noOpponent = opponentId === null;
    const bye = noOpponent && !m.is_playoff;
    const r = resultOf.get(week);

    if (thisWeek !== null && week === thisWeek) {
      tiles.push(thisTile(phase, week, r));
      continue;
    }
    if (thisWeek !== null && week > thisWeek) {
      if (bye) tiles.push({ kind: 'bye', week });
      else if (!noOpponent) tiles.push({ kind: 'upcoming', week, opponent: nameOf(opponentId) });
      continue;
    }
    // A past week.
    if (bye) tiles.push({ kind: 'bye', week });
    else if (noOpponent) continue;
    else if (r && r.result !== 'BYE') tiles.push({ kind: 'played', week, result: r.result, gain: r.gain });
    else tiles.push({ kind: 'unscored', week });
  }

  // The week you sit out in the playoffs has no row of your own: its tile is the league's
  // current week, drawn from the phase alone, in its place among the others. (Any other phase
  // that names a week has a row for it: with none, nothing is invented.)
  if (phase.kind === 'playoff_bye' && thisWeek !== null && !tiles.some((t) => t.week === thisWeek)) {
    const at = tiles.findIndex((t) => t.week > thisWeek);
    const tile = thisTile(phase, thisWeek, undefined);
    if (at === -1) tiles.push(tile);
    else tiles.splice(at, 0, tile);
  }
  return tiles;
}

// ── Look ───────────────────────────────────────────────────────────────────
/** The tile, at Large text. */
export const TILE_WIDTH = 54;
export const TILE_MIN_HEIGHT = 76;
export const TILE_RADIUS = 12;
export const TILE_GAP = 6;
/** The row's leading inset: Wk 1 lines up with the content. */
export const ROW_LEAD = 20;
/** How much of the next tile peeks at the right edge. */
export const PEEK = 20;
/** Tiles scale with the text size to this factor; the W / L / T glyph caps at 2.0x. */
export const TILE_MAX_SCALE = 2.1;
export const GLYPH_MAX_SCALE = 2.0;
export const SCORE_MIN_FONT_SCALE = 0.7;

export function tileScale(fontScale: number): number {
  return Number.isFinite(fontScale) ? Math.min(Math.max(fontScale, 1), TILE_MAX_SCALE) : 1;
}
export function tileWidth(fontScale: number): number {
  return TILE_WIDTH * tileScale(fontScale);
}
export function tileMinHeight(fontScale: number): number {
  return TILE_MIN_HEIGHT * tileScale(fontScale);
}

/**
 * Where the row opens: the this-week tile (or the last drawn one when there is none) fully in
 * view at the right edge, the next tile peeking, never past the content's end. 0 while it all
 * fits (weeks 1 to 6 at Large). Computed, never persisted; the row is remounted on a league
 * switch and a font-scale change, so it is computed again then.
 */
export function initialOffset(args: { tileCount: number; anchorIndex: number; fontScale: number; viewportWidth: number }): number {
  const { tileCount, anchorIndex, viewportWidth } = args;
  if (tileCount <= 0 || anchorIndex < 0 || !(viewportWidth > 0)) return 0;
  const w = tileWidth(args.fontScale);
  const contentWidth = ROW_LEAD + tileCount * w + (tileCount - 1) * TILE_GAP + ROW_LEAD;
  const anchorRight = ROW_LEAD + (anchorIndex + 1) * w + anchorIndex * TILE_GAP;
  const hasNext = anchorIndex < tileCount - 1;
  const wanted = hasNext ? anchorRight + TILE_GAP + PEEK - viewportWidth : anchorRight + ROW_LEAD - viewportWidth;
  return Math.max(0, Math.min(wanted, contentWidth - viewportWidth));
}

/** The tile the row opens on: this week's, else the last drawn. */
export function anchorIndex(tiles: SeasonTile[]): number {
  const i = tiles.findIndex((t) => t.kind === 'this');
  return i >= 0 ? i : tiles.length - 1;
}

// ── Taps ───────────────────────────────────────────────────────────────────
export const OPENS_SCHEDULE_HINT = 'Opens League schedule';
export const OPENS_THIS_WEEK_HINT = "Opens this week's matchup";

/** This week opens Matchup; every other tile opens League › Schedule (interim, until a
 * past-week matchup screen exists). */
export function tileTargetsMatchup(tile: SeasonTile): boolean {
  return tile.kind === 'this';
}
export function tileHint(tile: SeasonTile): string {
  return tileTargetsMatchup(tile) ? OPENS_THIS_WEEK_HINT : OPENS_SCHEDULE_HINT;
}

// ── VoiceOver ──────────────────────────────────────────────────────────────
const WORD: Record<SeasonResult, string> = { W: 'won', L: 'lost', T: 'tied' };
const THIS_WEEK_WORDS: Record<Extract<SeasonTile, { kind: 'this' }>['reason'], string> = {
  live: 'live',
  closed: 'market closed',
  scoring: 'scoring',
  pending: 'opponent not set yet',
  scored: '',
  bye: 'bye',
};

/** "Week 3, lost, −$96.40" · "Week 5, bye" · "Week 6, this week, live" · "Week 7, against Paolo M." ·
 * "Week 3, not scored yet". The money is the on-screen amount, read as written. */
export function tileLabel(tile: SeasonTile): string {
  const head = `Week ${tile.week}`;
  switch (tile.kind) {
    case 'played':
      return `${head}, ${WORD[tile.result]}, ${formatMoney(tile.gain, { sign: 'always' })}`;
    case 'unscored':
      return `${head}, not scored yet`;
    case 'bye':
      return `${head}, bye`;
    case 'upcoming':
      return `${head}, against ${tile.opponent}`;
    case 'this':
      return tile.reason === 'scored' && tile.result ? `${head}, this week, ${WORD[tile.result]}` : `${head}, this week, ${THIS_WEEK_WORDS[tile.reason]}`;
  }
}

/** The tile's top line, "Wk N". */
export function tileWeekText(tile: SeasonTile): string {
  return seasonTileWeekLabel(tile.week);
}
export { SEASON_TILE_BYE, SEASON_TILE_UNSCORED };
