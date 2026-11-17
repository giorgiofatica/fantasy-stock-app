/**
 * seasonStart: the first day of "Season" on a stock's chart (Giorgio, 2026-11-17; the Design Lead's
 * spec): the day THIS league drafted, the same window for every stock, owned or not. It is the
 * earliest draft pick's ET date in the league's ledger, the very day Portfolio's Season starts
 * (portfolioChart.draftDateOf). Null while there is no season yet: no active league, or a league
 * that has not finished its draft. Season is grey on a stock's chart until then. Pure, so
 * tests-deno/chart-ranges.test.ts pins it.
 */
import { etDateOf } from '../game/matchupRoster';

export function seasonStartOf(draftComplete: boolean, activity: readonly { kind: string; occurred_at: string }[] | null | undefined): string | null {
  if (!draftComplete || !activity) return null;
  let first: string | null = null;
  for (const r of activity) {
    if (r.kind !== 'draft') continue;
    const d = etDateOf(r.occurred_at);
    if (d && (first == null || d < first)) first = d;
  }
  return first;
}
