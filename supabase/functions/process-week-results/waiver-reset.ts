/**
 * The waiver order's weekly reset (Stocks tab part 3, workstream 6; the October plan: "after each
 * week is scored the order resets to reverse standings, last place first, standings tiebreaks
 * apply").
 *
 * The rule lives in SQL, public.reset_due_waiver_orders() (20261211000000): for every drafted,
 * unfinished league, once EVERY matchup through a week is scored and that week is past the one the
 * order was last reset through, the order becomes the reverse of league_standings_ranked through it.
 * It is idempotent and called on EVERY run of this job (the 21:15Z run, the 22:00Z and Saturday
 * heals), so a reset that failed is retried by the next run: never a one-shot that a failure strands
 * (CLAUDE.md, the partial-state family).
 *
 * supabase-js resolves .rpc() to { data, error } and does NOT throw on a Postgres error (CLAUDE.md
 * "success signals" #5): the error is checked, and a reply that is not the expected shape is a
 * failure, never a success. One league's failure is reported in `failed` (the SQL isolates it).
 * Never throws: the caller folds the result into the job's terminal status.
 */

export interface WaiverResetResult {
  ok: boolean;
  reset: number;
  failed: Array<{ league_id: string; error: string }>;
  error?: string;
}

export async function resetDueWaiverOrders(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<WaiverResetResult> {
  try {
    const { data, error } = await supabase.rpc('reset_due_waiver_orders');
    if (error) return { ok: false, reset: 0, failed: [], error: error.code ?? error.message ?? 'error' };
    const d = data as { reset?: unknown; failed?: unknown } | null;
    if (!d || typeof d.reset !== 'number' || !Array.isArray(d.failed)) {
      return { ok: false, reset: 0, failed: [], error: 'unexpected reply' };
    }
    const failed = d.failed.map((f) => ({
      league_id: String((f as { league_id?: unknown })?.league_id ?? ''),
      error: String((f as { error?: unknown })?.error ?? ''),
    }));
    return { ok: failed.length === 0, reset: d.reset, failed };
  } catch (e) {
    return { ok: false, reset: 0, failed: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/** The suffix the job's terminal message carries, and whether the reset turns the run 'failed'. */
export function waiverResetNote(r: WaiverResetResult): { note: string; failed: boolean } {
  if (r.ok) return { note: r.reset > 0 ? `; waiver orders reset ${r.reset}` : '', failed: false };
  const detail = r.error ?? `${r.failed.length} league(s): ${r.failed.map((f) => f.league_id).join(',')}`;
  return { note: `; waiver order reset FAILED (${detail})`, failed: true };
}
