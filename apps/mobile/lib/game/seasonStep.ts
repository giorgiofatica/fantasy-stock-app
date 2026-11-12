/**
 * Create league's Season step, "B" (PRODUCT_RULES, "The Season step in Create league", Giorgio
 * 2026-11-10; board #call-season-step): three identical steppers with no line under any label, a
 * season strip, one bye line, and a limit's reason only while its stepper is at that limit. Pure,
 * so the rules are tested under Deno (tests-deno/season-step.test.ts).
 */
import { playoffByePhrase, playoffPlan, playoffRoundShortName } from '../playoffs';
import { seasonCaption } from './createLeagueSetup';

// ── The steppers ────────────────────────────────────────────────────────

/** "11 wks" on screen: a unit, lowercase, like "30 seconds" (board, "The case of 'wks'"). */
export const WEEKS_UNIT_SHOWN = 'wks';
/** What VoiceOver says for the same value: "11 weeks". */
export const WEEKS_UNIT_SPOKEN = 'weeks';

/** The value cell's width at Large (board: 84), so the three boxes are identical whatever their
 * value ("6", "11 wks"). It grows with the text size up to the headline variant's own cap (1.6),
 * the size the value stops growing at. */
export const UNIFORM_VALUE_WIDTH = 84;
const VALUE_MAX_SCALE = 1.6;

export function uniformValueWidth(fontScale: number): number {
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  return Math.round(UNIFORM_VALUE_WIDTH * Math.min(scale, VALUE_MAX_SCALE));
}

// ── The strip ───────────────────────────────────────────────────────────

export type SeasonStripTile =
  | { kind: 'week'; week: number }
  | { kind: 'playoff'; week: number; chip: string };

export interface SeasonStripModel {
  tiles: SeasonStripTile[];
  /** Under the first tile: "Wk 1". */
  first: string;
  /** Under the last tile, the season's last week: "Wk 14". */
  last: string;
  /** What VoiceOver says for the strip (the board's label): "Season: 11 weeks + 3 playoff weeks". */
  spoken: string;
}

/** One tile per regular-season week, then one per playoff week, named with the season chart's
 * chips (playoffRoundShortName: WC / SF / F, QF / R16 for bigger brackets). */
export function seasonStrip(regularWeeks: number, playoffTeams: number): SeasonStripModel {
  const weeks = Math.max(0, Math.floor(regularWeeks));
  const rounds = playoffPlan(playoffTeams)?.rounds ?? [];
  const tiles: SeasonStripTile[] = [
    ...Array.from({ length: weeks }, (_, i): SeasonStripTile => ({ kind: 'week', week: i + 1 })),
    ...rounds.map((r, i): SeasonStripTile => ({ kind: 'playoff', week: weeks + i + 1, chip: playoffRoundShortName(r) })),
  ];
  return {
    tiles,
    first: 'Wk 1',
    last: `Wk ${Math.max(1, tiles.length)}`,
    spoken: seasonCaption(weeks, playoffTeams),
  };
}

/** The gap between tiles: 3 pt (board), 1 pt once the strip holds more than 24 tiles, so a long
 * season (weeks have no ceiling) keeps its week tiles visible instead of spending the row on gaps. */
export function stripGap(tileCount: number): number {
  return tileCount > 24 ? 1 : 3;
}

// ── The line under the strip ────────────────────────────────────────────

/** The playoff line's bye clause as a sentence: "The top 3 seeds get first-round byes.", "No byes." */
export function seasonByeLine(playoffTeams: number): string | null {
  const plan = playoffPlan(playoffTeams);
  if (!plan) return null;
  const phrase = playoffByePhrase(plan.byes);
  return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.`;
}
