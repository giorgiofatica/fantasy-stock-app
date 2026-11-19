/**
 * teamPortfolioView: one team's Portfolio figures from its ledger rows, for your Portfolio
 * (usePortfolioData) and a leaguemate's (playerPortfolio), live or finished. Pure, so
 * tests-deno/money-finished-season.test.ts pins both modes.
 *
 * Live: holdings at the live quote (unpriced ones at cost), today from the previous closes, the
 * value the header and the line's live end share.
 *
 * Finished (`endEt`, Giorgio 2026-11-18, pick A: the value stops at the season's last day): the
 * `live` marks are NOT read. Every holding is priced at its close on or before endEt
 * (seasonEndCloses), the value is the value line's last point (dailyValues to endEt), and "since the
 * draft" is that value minus the line's first point. So the hero, the holding rows and the chart are one
 * set of numbers, and none of them can move with today's market.
 */
import { buildPortfolioView, type PortfolioView, type ViewHolding } from './portfolioView';
import { portfolioHoldings, portfolioSummary } from './portfolioModel';
import { dailyValues, draftValueOf, seasonEndCloses, symbolsMissingSeasonEndClose, type ChartActivityRow, type ChartStake } from './portfolioChart';
import type { BuyRowInput } from './buyRowLine';
import type { DailyBar } from './prevClose';

export interface TeamPortfolioInput {
  drafts: { symbol: string; entryPrice: number; quantity: number }[];
  trades: { symbol: string; action: 'buy' | 'sell'; quantity: number; price: number }[];
  /** The same rows, as the value line reads them. */
  chartRows: ChartActivityRow[];
  names: Record<string, string>;
  stake: ChartStake & { numRounds: number };
  /** The live quote and previous closes. Never read when `endEt` is set. */
  live: { prices: Record<string, number>; prevCloses: Record<string, number> };
  /** Daily bars per symbol ever held, from the draft on. */
  bars: Record<string, readonly DailyBar[]>;
  /** A finished season's last day (ET); null: the season is live. */
  endEt: string | null;
  slotLabels?: Record<string, string>;
  buyRow?: BuyRowInput;
}

export interface TeamPortfolio {
  view: PortfolioView;
  /** The header's value as the line's live end; null in a finished season (no live point). */
  liveValue: number | null;
}

/**
 * Null when a finished season's value cannot be worked out: ANY holding with no real close on or before the season's last day
 * (a value at cost, with a caption about a live price that does not apply to a finished season, would be a stand-in figure,
 * Design Lead gate 2026-11-18). The screens then show their existing load failure with Try again (a refetch of the bars).
 * Per holding: one missing close makes it unknown, however many bars the others have.
 */
export function teamPortfolioView(i: TeamPortfolioInput): TeamPortfolio | null {
  const held = portfolioHoldings(i.drafts, i.trades);
  const endEt = i.endEt;
  if (endEt && symbolsMissingSeasonEndClose(i.bars, held.map((h) => h.symbol), endEt).length > 0) return null;
  // Finished: the season-end closes and nothing else. Live: the quote.
  const marks = endEt ? seasonEndCloses(i.bars, held.map((h) => h.symbol), endEt) : i.live.prices;
  const price = (sym: string) => marks[sym.toUpperCase()] ?? marks[sym] ?? null;
  const summary = portfolioSummary({ ...i.stake, drafts: i.drafts, trades: i.trades, price });
  const endDaily = endEt ? dailyValues({ rows: i.chartRows, bars: i.bars, stake: i.stake, todayEt: endEt, endEt }) : null;

  const holdings: ViewHolding[] = held.map((h) => ({
    symbol: h.symbol,
    quantity: h.quantity,
    costBasis: h.costBasis,
    price: price(h.symbol),
    prevClose: endEt ? null : i.live.prevCloses[h.symbol] ?? i.live.prevCloses[h.symbol.toUpperCase()] ?? null,
    name: i.names[h.symbol] ?? i.names[h.symbol.toUpperCase()] ?? null,
  }));

  const view = buildPortfolioView({
    value: endDaily?.length ? endDaily[endDaily.length - 1].value : summary.value,
    cash: summary.cash,
    stake: summary.stake,
    holdings,
    numRounds: i.stake.numRounds,
    perSlotNotional: i.stake.notionalPerSlot,
    stakeMode: i.stake.stakeMode,
    slotLabels: i.slotLabels,
    buyRow: i.buyRow,
    // The stake at cost, a real number even when the line starts late (missing early bars).
    ...(endEt ? { finished: { draftValue: draftValueOf(i.chartRows, i.stake) ?? summary.stake } } : {}),
  });
  return { view, liveValue: endEt ? null : summary.value };
}
