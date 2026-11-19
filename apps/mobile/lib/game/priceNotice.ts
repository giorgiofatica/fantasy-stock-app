/**
 * The Matchup price notice (Giorgio, 2026-11-19, PR #562): while a stock in this matchup has no live
 * price, a notice under the "My matchup | All matchups" switch names it. The totals still show (each the
 * sum of the stocks that DO have a price, lineupLedger.pricedTotal) and the stock's row shows "–"; the
 * notice says why. Shown during a LIVE week only, never on a scored one. It replaces the old
 * "N holdings counted at cost" caption on that screen.
 *
 * The copy is Giorgio's approved text, exactly (any change goes to the Planner). Three or more stocks join
 * as "AAPL, JPM and KO" through the app's one joiner (listSymbols; Design Lead, 2026-11-19). A long list is
 * never cut: every ticker, and the text wraps. Pure, so tests-deno/matchup-unpriced.test.ts pins it.
 */
import { keepCode } from './keepDots';
import { listSymbols } from './listSymbols';

/** Both teams' unpriced stocks, each once (upper-case), yours first, each side in its own order. */
export function missingPriceSymbols(mine: readonly string[], theirs: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const s of [...mine, ...(theirs ?? [])]) {
    const sym = s.toUpperCase();
    if (!out.includes(sym)) out.push(sym);
  }
  return out;
}

/** The notice's text, or null when every price is in (then nothing is drawn). */
export function priceNoticeText(symbols: readonly string[]): string | null {
  if (symbols.length === 0) return null;
  if (symbols.length === 1) {
    return `The price for ${symbols[0]} isn't loading right now. We're working on it, and the totals will update when it's back.`;
  }
  return `Prices for ${listSymbols(symbols)} aren't loading right now. We're working on it, and the totals will update when they're back.`;
}

/**
 * The notice as DRAWN: each ticker kept whole (keepCode: no line ever breaks inside one, so BRK.B never splits
 * at its dot). Display only: VoiceOver reads the plain sentence (priceNoticeText). A ticker is matched as a
 * whole word, so "A" never matches inside "AAPL".
 */
export function priceNoticeDisplay(text: string, symbols: readonly string[]): string {
  const tickers = new Set(symbols);
  // Whole tokens only (no regex lookbehind, which Hermes may lack): "AAPL," keeps its comma outside the join.
  return text
    .split(/(\s+)/)
    .map((tok) => {
      const comma = tok.endsWith(',') ? ',' : '';
      const word = comma ? tok.slice(0, -1) : tok;
      return tickers.has(word) ? `${keepCode(word)}${comma}` : tok;
    })
    .join('');
}

/** The notice's text cap: the Matchup rows' (1.3x), so it never outranks the Scoreboard under it, and at 1.3x the
 * icon still fits beside the text (Design Lead spec, 2026-11-19). */
export const NOTICE_MAX_SCALE = 1.3;
/** callout's size and line height (constants/tokens/type.ts), for the icon to follow the capped text. */
const CALLOUT_PT = 13;
const CALLOUT_LINE = 18;

/** The icon's size and its top offset at a Dynamic Type scale: callout's size at the capped scale, centred on the
 * FIRST line (Design Lead P2, 2026-11-19: top-aligned it sat 2.3pt high at L and 4pt high at AX5, poking above the
 * capitals). The offset is (line height - icon size) / 2, both at the capped scale. */
export function noticeIconMetrics(fontScale: number): { pt: number; top: number } {
  const s = Math.min(fontScale, NOTICE_MAX_SCALE);
  return { pt: CALLOUT_PT * s, top: ((CALLOUT_LINE - CALLOUT_PT) * s) / 2 };
}
