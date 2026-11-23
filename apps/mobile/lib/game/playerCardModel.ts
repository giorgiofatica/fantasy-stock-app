/**
 * playerCardModel (W4): the player card's numbers for one stock on one manager's roster,
 * from data the app already has (PRODUCT_RULES "The stock player card": how it was got,
 * with the date and the price per share; the season line; this week's line). Pure, so
 * tests-deno/player-card-model.test.ts pins it.
 *
 *  - How it was got: the event that OPENED the held position — the last BUY, else the
 *    draft pick (the server's userSlotOccupancy rule). A draft reads "Drafted Nth overall";
 *    a buy reads "Bought". trades carry no waiver marker (trades.action is buy/sell only),
 *    so "Claimed off waivers" can't be told apart yet and is never invented.
 *  - The week figure: the server's own accounting (liveWeekScore) over this one stock, so
 *    it is exactly the row's number.
 *  - The card's range gain is the HOLDING's P/L, not a per-share move (Design Lead gate, 2026-11-17):
 *    Σ over the lots held now of shares × (price now − basis), where a lot's basis is the stock's
 *    price at the range's start, or the lot's OWN entry price if it was opened on or after the
 *    range's first day (so Season on a drafted stock = (price − draft price) × shares, the very
 *    figure "How you got it" implies). openLots / holdingRangeGain below; the stock sheet stays per share.
 *  - The chart is NOT here any more: the card shows the stock's own six-range chart
 *    (components/money/StockChart, opening on Season; Giorgio 2026-11-17), so the card carries
 *    Price (with today), Week gain, and `seasonStart` (the league's draft day, Season's first day).
 *    Week gain stays the matchup week (Monday to now), which is NOT 1W (the past five sessions).
 */
import { liveWeekScore, type LiveSnapshot, type LiveTrade } from '../home/liveWeekScore';
import type { LedgerActivityRow } from '../money/portfolioLedger';
import { seasonStartOf } from '../money/seasonStart';
import { etDateOf } from './matchupRoster';
import type { Acquisition } from '../../components/sp/logic/gameNight';
import { formatAxisDate } from '../../components/sp/logic/chartAxis';
import type { RangeGain } from '../chart/chartRanges';

export interface Opening {
  acquisition: Acquisition;
  /** ET calendar date of the opening event (the season line's start). */
  dateIso: string;
  price: number;
  /** Shares held now (buys − sells, every event for the symbol). */
  quantity: number;
}

/** The opening event of `userId`'s position in `symbol`, from the league's activity. Null
 * when the ledger has no draft or buy for it (never a guessed acquisition). */
export function openingOf(userId: string, symbol: string, activity: readonly LedgerActivityRow[]): Opening | null {
  const sym = symbol.toUpperCase();
  const rows = activity
    .filter((r) => r.user_id === userId && r.symbol.toUpperCase() === sym)
    .sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : 0));
  let quantity = 0;
  for (const r of rows) quantity += r.action === 'sell' ? -r.quantity : r.quantity;
  const lastBuy = [...rows].reverse().find((r) => r.kind === 'trade' && r.action === 'buy');
  const draft = rows.find((r) => r.kind === 'draft');
  const open = lastBuy ?? draft;
  if (!open || open.price == null) return null;
  const dateIso = etDateOf(open.occurred_at);
  if (!dateIso) return null;
  const date = formatAxisDate(dateIso);
  const acquisition: Acquisition = open.kind === 'draft' && open.pick_number != null
    ? { kind: 'drafted', pick: open.pick_number, date, price: open.price }
    : { kind: 'bought', date, price: open.price };
  return { acquisition, dateIso, price: open.price, quantity: Math.max(0, Math.round(quantity * 1e6) / 1e6) };
}

/** A week percent: the gain over the week basis. Null when there is no basis (nothing cost
 * anything at the week's start): a percent of nothing is unknown, not 0%. */
export function weekPctOf(gain: number, basis: number): number | null {
  return basis > 0 ? (gain / basis) * 100 : null;
}

/**
 * This one stock's week: the row's own gain and percent (liveWeekScore over its lots). Null when the
 * week has nothing for it: no week-start row and no trade this week (or no live price), so
 * liveWeekScore has no number for it. That is UNKNOWN, never $0.00 (Giorgio, 2026-11-18: a missing
 * number never shows as zero); the percent is null with it, or when the lots cost nothing.
 */
export function stockWeek(symbol: string, snapshots: readonly LiveSnapshot[], trades: readonly LiveTrade[], price: number | null): { gain: number | null; pct: number | null } {
  const sym = symbol.toUpperCase();
  const r = liveWeekScore(
    snapshots.filter((s) => s.symbol.toUpperCase() === sym),
    trades.filter((t) => t.symbol.toUpperCase() === sym),
    () => price,
  );
  // A stock that is partly unpriced (sold some this week, no live price for the rest) has only
  // its sale in bySymbol: that is a part, not the week, so it is unknown too (CLAUDE.md, partial state).
  const gain = sym in r.bySymbol && !r.unpriced.includes(sym) ? r.bySymbol[sym] : null;
  return { gain, pct: gain === null ? null : weekPctOf(gain, r.startValue) };
}

/** This stock's week basis: what its lots cost at the week's start (a Monday open, or a mid-
 * week entry price) — liveWeekScore's startValue over this one stock, independent of any
 * live or closing price. A row's week percent is its own gain over this, so the percent always
 * agrees with the number the row scores, live or final. */
export function stockBasis(symbol: string, snapshots: readonly LiveSnapshot[], trades: readonly LiveTrade[]): number {
  const sym = symbol.toUpperCase();
  return liveWeekScore(
    snapshots.filter((s) => s.symbol.toUpperCase() === sym),
    trades.filter((t) => t.symbol.toUpperCase() === sym),
    () => 0, // any non-null price: startValue counts every lot at its own entry
  ).startValue;
}

/** The last close strictly before today (ET): today's percent is measured from it. */
export function prevCloseOf(bars: readonly { date: string; close: number }[], todayEt: string): number | null {
  const before = bars.filter((b) => b.date < todayEt);
  return before.length ? before[before.length - 1].close : null;
}

/** One lot of a position held now: when it was opened (ET date), how many shares of it remain, its entry price. */
export interface HoldingLot {
  date: string;
  quantity: number;
  price: number;
}

/**
 * The lots `userId` holds in `symbol` now, from the league's activity. Every buy (a draft pick or a
 * trade) opens a lot at its own price; a sale shrinks EVERY open lot in proportion (the position's
 * cost basis falls proportionally, as the stock sheet's "Your position" does), so a half sale halves
 * each lot and keeps its entry price. A buy with no price is left out (never a guessed basis).
 */
export function openLots(userId: string, symbol: string, activity: readonly LedgerActivityRow[]): HoldingLot[] {
  const sym = symbol.toUpperCase();
  const rows = activity
    .filter((r) => r.user_id === userId && r.symbol.toUpperCase() === sym)
    .sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : 0));
  let lots: HoldingLot[] = [];
  for (const r of rows) {
    if (r.action === 'sell') {
      const total = lots.reduce((n, l) => n + l.quantity, 0);
      lots = total > r.quantity ? lots.map((l) => ({ ...l, quantity: l.quantity * ((total - r.quantity) / total) })) : [];
      continue;
    }
    const date = etDateOf(r.occurred_at);
    if (date && r.price != null && r.quantity > 0) lots.push({ date, quantity: r.quantity, price: r.price });
  }
  return lots;
}

const centsOf = (n: number) => Math.round(n * 100);

/**
 * The card's gain for a range: the holding's P/L. A lot opened on or after the range's first day
 * (`start`) is measured from its own entry price; an older lot from `base`, the stock's price at the
 * range's start. Percent = P/L ÷ Σ(shares × basis). The tone is the P/L's own sign (so the chart line
 * and the gain line agree even when the stock rose over the range but your lot was bought above it).
 * Null with no lots, no live price or no range.
 */
export function holdingRangeGain(input: { lots: readonly HoldingLot[]; start: string | null; base: number; price: number | null }): RangeGain | null {
  const { lots, start, base, price } = input;
  if (!lots.length || price == null || start == null) return null;
  let pl = 0;
  let cost = 0;
  for (const l of lots) {
    const basis = l.date >= start ? l.price : base;
    pl += l.quantity * (price - basis);
    cost += l.quantity * basis;
  }
  const c = centsOf(pl);
  return { money: pl, pct: cost > 0 ? (pl / cost) * 100 : 0, tone: c > 0 ? 'gain' : c < 0 ? 'loss' : 'zero' };
}

/** Everything the card shows for one stock, or null when the ledger has no opening event
 * for it (then the row isn't pressable: a card without "How you got it" is never shown). */
export interface PlayerCardData {
  ticker: string;
  company: string;
  price: number;
  /** Today's change, percent: the Price figure's own line ("+1.70% today"). */
  todayPct: number;
  /** Week gain: the matchup week (Monday to now), NOT 1W (the past five sessions). Null = no
   * week figure: unknown (a week that has nothing for this stock: the card shows "–"), or a
   * league without weeks (then `hasWeeks` is false and the figure is left out). */
  weekGain: number | null;
  weekPct: number | null;
  /** The league plays in weeks (leagueHasWeeks). False: no Week gain figure at all. */
  hasWeeks: boolean;
  acquisition: Acquisition;
  /** The lots held now (the range gain is their P/L). */
  lots: HoldingLot[];
  /** Season's first day on the card's chart: the league's draft day (ET), the same window for
   * any stock. Null before the league's draft is done (the card is never opened then). */
  seasonStart: string | null;
  /** Shares held now: 0 = sold this week (still on this week's roster). */
  held: number;
}

/**
 * The card's Week gain input. A season that is over has no current week, so the card has no week
 * gain: null ("no week"), never a stand-in 0, which says "$0.00 this week" (CLAUDE.md, "Overloaded
 * NULLs": a 0 for "no value" is the same bug; Giorgio, 2026-11-18: a missing number never shows as
 * zero). The card hides the figure in a finished season anyway (its seasonEnd); the data now says
 * the same thing. A live season reads its own week, and only then (the read is skipped when over).
 */
export function cardWeekGain(seasonOver: boolean, liveWeek: () => number | null): number | null {
  return seasonOver ? null : liveWeek();
}

export function playerCardData(input: {
  symbol: string;
  company: string;
  userId: string;
  activity: readonly LedgerActivityRow[];
  snapshots: readonly LiveSnapshot[];
  trades: readonly LiveTrade[];
  /** The row's own week gain (its whole cents), so the card and the row agree. Null = unknown. */
  weekGain: number | null;
  /** leagueHasWeeks(league_type): false drops the week figure whatever `weekGain` says. */
  hasWeeks: boolean;
  price: number;
  /** Home's bars for the symbol (the week and the day before it): today's percent is
   * measured from the last close before today. */
  bars: readonly { date: string; close: number }[];
  now: Date;
}): PlayerCardData | null {
  const { symbol, company, userId, activity, snapshots, trades, price, bars, now, hasWeeks } = input;
  // No weeks (a Duration league: the server runs no weekly jobs for it): no week number at all.
  const weekGain = hasWeeks ? input.weekGain : null;
  const opening = openingOf(userId, symbol, activity);
  if (!opening) return null;
  const todayEt = etDateOf(now) ?? '';
  const prev = prevCloseOf(bars, todayEt);
  return {
    ticker: symbol.toUpperCase(),
    company,
    price,
    todayPct: prev ? ((price - prev) / prev) * 100 : 0,
    weekGain,
    // The row's own gain over the stock's week basis: the card says what the row scores.
    weekPct: weekGain === null ? null : weekPctOf(weekGain, stockBasis(symbol, snapshots, trades)),
    hasWeeks,
    acquisition: opening.acquisition,
    lots: openLots(userId, symbol, activity),
    seasonStart: seasonStartOf(true, activity),
    held: opening.quantity,
  };
}
