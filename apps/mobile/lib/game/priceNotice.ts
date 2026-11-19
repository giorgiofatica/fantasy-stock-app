/**
 * The Matchup price notice (Giorgio, 2026-11-19, PR #562): while a stock in this matchup has no live
 * price, a notice under the "My matchup | All matchups" switch names it. The totals still show (each the
 * sum of the stocks that DO have a price, lineupLedger.pricedTotal) and the stock's row shows "–"; the
 * notice says why. Shown during a LIVE week only, never on a scored one. It replaces the old
 * "N holdings counted at cost" caption on that screen.
 *
 * The copy is Giorgio's approved text, exactly (any change goes to the Planner). How three or more
 * stocks are joined is the Design Lead's call; until it rules, "A, B and C" (commas, "and" before the
 * last). Pure, so tests-deno/matchup-unpriced.test.ts pins it.
 */

/** Both teams' unpriced stocks, each once (upper-case), yours first, each side in its own order. */
export function missingPriceSymbols(mine: readonly string[], theirs: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const s of [...mine, ...(theirs ?? [])]) {
    const sym = s.toUpperCase();
    if (!out.includes(sym)) out.push(sym);
  }
  return out;
}

/** "AAPL", "AAPL and JPM", "AAPL, JPM and KO". */
function joinSymbols(symbols: readonly string[]): string {
  if (symbols.length <= 1) return symbols[0] ?? '';
  return `${symbols.slice(0, -1).join(', ')} and ${symbols[symbols.length - 1]}`;
}

/** The notice's text, or null when every price is in (then nothing is drawn). */
export function priceNoticeText(symbols: readonly string[]): string | null {
  if (symbols.length === 0) return null;
  if (symbols.length === 1) {
    return `The price for ${symbols[0]} isn't loading right now. We're working on it, and the totals will update when it's back.`;
  }
  return `Prices for ${joinSymbols(symbols)} aren't loading right now. We're working on it, and the totals will update when they're back.`;
}
