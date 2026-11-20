/**
 * lineupLedger: the per-stock lineup rows for Matchup (3c). The rule from
 * the board: "Both lineups, each stock's dollar contribution this week. They
 * add up to the score exactly." Each row is shown in whole cents, and the
 * cents must sum to the scoreboard's own cents, so the rounding is
 * largest-remainder, not per-row Math.round (which can print a total one
 * cent off the score).
 *
 * `scoreCents` is the scoreboard's total on the same footing: the gain
 * rounded to whole cents, ties toward +infinity (Math.round, as
 * formatSignedCurrency does), so the rows and the score agree everywhere.
 */

export interface LineupRow {
  symbol: string;
  /** Signed whole cents. */
  cents: number;
}

export function scoreCents(gain: number): number {
  return Math.round(gain * 100);
}

/**
 * Rows in the caller's input order. Each row gets floor(exact cents); the
 * leftover cents (always 0..n) go, one each, to the rows with the largest
 * fractional part, so the cents sum to scoreCents(gain) exactly.
 */
export function lineupRows(bySymbol: Record<string, number>, gain: number): LineupRow[] {
  const symbols = Object.keys(bySymbol);
  if (symbols.length === 0) return [];
  const target = scoreCents(gain);
  const exact = symbols.map((s) => bySymbol[s] * 100);
  const floors = exact.map((v) => Math.floor(v));
  const fracs = exact.map((v, i) => v - floors[i]);
  let leftover = target - floors.reduce((a, b) => a + b, 0);
  // Largest fraction first; ties keep input order (stable sort).
  const order = symbols.map((_, i) => i).sort((a, b) => fracs[b] - fracs[a]);
  const cents = [...floors];
  for (let k = 0; leftover > 0; k++, leftover--) cents[order[k % order.length]] += 1;
  for (let k = order.length - 1; leftover < 0; k--, leftover++) cents[order[k % order.length]] -= 1;
  return symbols.map((symbol, i) => ({ symbol, cents: cents[i] }));
}

/**
 * A team's LIVE total as the Scoreboard shows it (Giorgio, 2026-11-19, PR #562: "row has the dash but up
 * top accounts for total without that stock"; "i want the running total to not be zero if there is an issue
 * with one stock"): the sum of the rows of the stocks that DO have a live price. A stock with no price shows
 * "–" on its row and is left out here, so the visible numbers add up to the total exactly. Never a dash, and
 * never a stand-in for the missing stock. (A POSTED week is the server's own number: it waits for every price.)
 */
export function pricedTotal(lineup: readonly LineupRow[], unpriced: readonly string[]): number {
  const missing = new Set(unpriced.map((s) => s.toUpperCase()));
  const cents = lineup.reduce((sum, r) => (missing.has(r.symbol.toUpperCase()) ? sum : sum + r.cents), 0);
  return cents / 100;
}
