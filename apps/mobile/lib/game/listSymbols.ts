/**
 * "A", "A and B", "A, B and C" (no comma before "and"): the ONE joiner for a list of tickers in a
 * sentence. Extracted from draftQueue (the queue's refusal line) for the Matchup price notice (Design Lead,
 * 2026-11-19: reuse it, never a second joiner). Pure.
 */
export function listSymbols(symbols: readonly string[]): string {
  return symbols.length < 2 ? symbols.join('') : `${symbols.slice(0, -1).join(', ')} and ${symbols[symbols.length - 1]}`;
}
