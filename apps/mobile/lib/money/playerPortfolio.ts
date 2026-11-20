/**
 * playerPortfolio: another manager's portfolio in a league (3e), read-only. The
 * same accounting as the caller's Portfolio (holdings, team value, gain since
 * the draft), built from the league ledger for that manager. It carries no trade
 * action: nothing here can buy or sell for anyone. Pure.
 *
 * A season that is over (`endEt`, Giorgio 2026-11-18, pick A): their value, "since the draft" and
 * every holding at the closes on or before the season's last day, the same figures their own Portfolio
 * shows; no today, no cash. The live prices are not read at all then.
 */
import type { ChartActivityRow } from './portfolioChart';
import { teamPortfolioView } from './teamPortfolioView';
import type { DailyBar } from './prevClose';
import type { PortfolioView } from './portfolioView';
import type { PortfolioLedger } from './portfolioLedger';
import type { StakeMode } from '../home/teamValue';

export interface PlayerPortfolio {
  displayName: string;
  isBot: boolean;
  view: PortfolioView;
}

export function playerPortfolio(i: {
  ledger: PortfolioLedger;
  userId: string;
  stakeMode: StakeMode;
  notionalPerSlot: number | null;
  numRounds: number;
  prices: Record<string, number>;
  prevCloses: Record<string, number>;
  /** A finished season's last day, with the daily bars it is priced from. Absent: a live season. */
  finished?: { endEt: string; bars: Record<string, DailyBar[]> };
}): PlayerPortfolio | null {
  const member = i.ledger.members.find((m) => m.user_id === i.userId);
  if (!member) return null;
  const mine = i.ledger.activity.filter((a) => a.user_id === i.userId);
  const drafts = mine.filter((a) => a.kind === 'draft' && a.price != null)
    .map((a) => ({ symbol: a.symbol, entryPrice: a.price!, quantity: a.quantity }));
  const trades = mine.filter((a) => a.kind === 'trade' && a.price != null)
    .map((a) => ({ symbol: a.symbol, action: a.action as 'buy' | 'sell', quantity: a.quantity, price: a.price! }));
  const rows: ChartActivityRow[] = mine.filter((a) => a.price != null).map((a) => ({
    kind: a.kind, action: a.action as 'buy' | 'sell', symbol: a.symbol.toUpperCase(), quantity: a.quantity, price: a.price!, occurredAt: a.occurred_at,
  }));
  // Upper-cased marks, as the ledger's symbols may not be.
  const upper = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k.toUpperCase(), v]));
  const team = teamPortfolioView({
    drafts,
    trades,
    chartRows: rows,
    names: i.ledger.symbol_names,
    stake: { stakeMode: i.stakeMode, notionalPerSlot: i.notionalPerSlot, numRounds: i.numRounds },
    // Finished: never read (teamPortfolioView prices at the season-end closes alone).
    live: { prices: upper(i.prices), prevCloses: upper(i.prevCloses) },
    bars: i.finished?.bars ?? {},
    endEt: i.finished?.endEt ?? null,
  });
  // A finished season with a holding that has no season-end close has no value: no portfolio (the screen's load failure).
  if (!team) return null;
  return { displayName: member.display_name, isBot: member.is_bot, view: team.view };
}
