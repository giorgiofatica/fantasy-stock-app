/**
 * draftable: the ONE test for "this stock cannot be bought in this league", read by the Watching row's line and by the stock sheet's
 * pre-review block, so the two can never disagree (and neither disagrees with the server).
 *
 * It is the buy path's own test (supabase/functions/_shared/draft-validation.ts, reason `not_draftable`): the server's draftable flag is false
 * AND the league has not turned on "Allow non-draftable stocks (full universe)" (`leagues.allow_undraftable`). In a full-universe league the flag
 * alone never blocks a buy. The flag reaches the app on the watchlist read (`is_draftable`) and on a search result.
 */
export function notDraftableHere(isDraftable: boolean, allowUndraftable: boolean): boolean {
  return !isDraftable && !allowUndraftable;
}
