/**
 * seasonEnd: the season's last day, for a league whose season is over (finished-season Portfolio,
 * Giorgio 2026-11-18, pick A: the value is frozen at the season's last day). Pure, so
 * tests-deno/money-season-end.test.ts pins it.
 *
 * The last day is the ET date of the LATEST matchup week_end in the league, the playoff final included.
 * Not league_seasons.completed_at: the heal pass (process-week-results' healUncompletedSeasons) can stamp
 * that days after the final closed, and every close in between would leak into the frozen value. With
 * no matchups at all (none read), completed_at's ET date is the fallback; with neither, null (no end is
 * ever guessed).
 */
import { etDateOf } from '../game/matchupRoster';

export function seasonEndEt(
  matchups: readonly { week_end: string | null | undefined }[] | null | undefined,
  completedAt: string | null | undefined = null,
): string | null {
  let last: string | null = null;
  for (const m of matchups ?? []) {
    if (!m.week_end) continue;
    const d = etDateOf(m.week_end);
    if (d && (last == null || d > last)) last = d;
  }
  if (last) return last;
  return completedAt ? etDateOf(completedAt) : null;
}
