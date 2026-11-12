/**
 * Create-league Season and Draft copy and bounds (3c). The copy follows the board
 * (Create league · Draft step). Pure, so the tests run without the app.
 * NEW copy where noted, flagged for the Design Lead.
 */
import { playoffPlan } from '../playoffs';

export type DraftOrderMode = 'random' | 'manual';

export const DRAFT_ORDER_OPTIONS: { value: DraftOrderMode; label: string }[] = [
  { value: 'random', label: 'Random' },
  { value: 'manual', label: 'Manual' },
];

/** "Season: 11 weeks + 2 playoff weeks". Playoff weeks come from the playoff plan. */
export function seasonCaption(regularWeeks: number, playoffTeams: number): string {
  const plan = playoffPlan(playoffTeams);
  if (!plan) return `Season: ${regularWeeks} ${regularWeeks === 1 ? 'week' : 'weeks'}`;
  const pw = plan.weeks;
  return `Season: ${regularWeeks} ${regularWeeks === 1 ? 'week' : 'weeks'} + ${pw} playoff ${pw === 1 ? 'week' : 'weeks'}`;
}

/** Playoff teams run from 2 up to the league size, equal included (flexible playoffs). */
export function playoffTeamsBounds(size: number): { min: number; max: number } {
  return { min: 2, max: Math.max(2, size) };
}

/** The pick-clock steps. leagues.pick_seconds CHECKs exactly these (30..90 by 15). */
export const PICK_SECONDS_OPTIONS: { value: number; label: string }[] = [30, 45, 60, 75, 90].map((v) => ({
  value: v,
  label: `${v}s`,
}));

export const DEFAULT_PICK_SECONDS = 60;

/** Frozen once the draft starts: trg_leagues_pick_clock refuses a change, so the picker is disabled. */
export function pickClockLocked(draftStatus: 'not_started' | 'in_progress' | 'completed'): boolean {
  return draftStatus !== 'not_started';
}
