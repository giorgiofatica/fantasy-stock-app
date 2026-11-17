/**
 * portfolioChart (W4, Game Night): the Portfolio value line under the hero (§9C "Chart",
 * "The X axis"; Giorgio, 2026-10-12: "the Portfolio chart with range pills: yes"). Pure, so
 * tests-deno/money-portfolio-chart.test.ts pins it.
 *
 * What it plots: the team value (teamValue, the SAME formula as the header and Home) at each
 * trading day's close since the draft, then the live value now. Each day's value is
 * teamValue over the ledger rows up to that day, priced at that day's close (the last close
 * on or before it; a stock with no bar yet counts at cost, never $0). So the line's last point
 * is exactly the header's number, and a buy or a sale moves only the cash/stake split, never
 * the line (the money just changes form).
 *
 * The ranges are the six every chart shares (lib/chart/chartRanges.ts; Giorgio 2026-11-17): 1W · 1M
 * · 3M · 6M · Season · YTD. Season is the whole line from the draft; the others are windows of it,
 * each measured from the value at the window's start (the first daily value on or after it).
 * A range longer than the league has existed is grey (chartRanges.isRangeGrey, history = the
 * league's age); Season never greys here, since the line starts at the draft by construction.
 * No dashed base: the range's first value only sets the line's tone and the gain.
 */
import { teamValue, type StakeMode } from '../home/teamValue';
import { etDateOf } from '../game/matchupRoster';
import type { MarketCalendarSession } from '../time/marketWeek';
import { CHART_RANGES, SEASON_DEFAULT_RANGE, rangeSeries, todaySessionOpen, type ChartRange, type RangeSeries } from '../chart/chartRanges';

export type PortfolioRange = ChartRange;
/** The pills' order, left to right: the same six on every chart. */
export const PORTFOLIO_RANGES: readonly PortfolioRange[] = CHART_RANGES;
/** Portfolio opens on Season (Giorgio, 2026-11-17: your team's whole run). */
export const DEFAULT_PORTFOLIO_RANGE: PortfolioRange = SEASON_DEFAULT_RANGE;

export interface ChartActivityRow {
  kind: 'draft' | 'trade';
  action: 'buy' | 'sell';
  symbol: string;
  quantity: number;
  price: number;
  /** ISO instant. */
  occurredAt: string;
}

export interface ChartStake {
  stakeMode: StakeMode;
  notionalPerSlot: number | null;
  numRounds: number | null;
}

export interface DailyValue {
  /** ET trading date, YYYY-MM-DD. */
  date: string;
  value: number;
}

type Bars = Record<string, readonly { date: string; close: number }[]>;

const cents = (v: number) => Math.round(v * 100) / 100;

/** The ET date a row happened on; rows with no readable instant are left out (never guessed). */
function rowDate(r: ChartActivityRow): string | null {
  return etDateOf(r.occurredAt);
}

/** teamValue over the rows that happened on or before `date`, priced by `priceOf`. */
function valueThrough(rows: readonly ChartActivityRow[], date: string, stake: ChartStake, priceOf: (symbol: string) => number | null): number {
  const upTo = rows.filter((r) => {
    const d = rowDate(r);
    return d !== null && d <= date;
  });
  return teamValue({
    stakeMode: stake.stakeMode,
    notionalPerSlot: stake.notionalPerSlot,
    numRounds: stake.numRounds,
    drafts: upTo.filter((r) => r.kind === 'draft').map((r) => ({ symbol: r.symbol.toUpperCase(), entryPrice: r.price, quantity: r.quantity })),
    trades: upTo.filter((r) => r.kind === 'trade').map((r) => ({ symbol: r.symbol.toUpperCase(), action: r.action, quantity: r.quantity, price: r.price })),
    price: priceOf,
  }).value;
}

/** The last close on or before `date` (bars ascending or not). */
function closeOnOrBefore(bars: readonly { date: string; close: number }[] | undefined, date: string): number | null {
  if (!bars) return null;
  let best: { date: string; close: number } | null = null;
  for (const b of bars) {
    if (!(b.close > 0) || b.date > date) continue;
    if (!best || b.date > best.date) best = b;
  }
  return best ? best.close : null;
}

/** The first day of the season: the earliest draft row's ET date (null: nothing drafted). */
export function draftDateOf(rows: readonly ChartActivityRow[]): string | null {
  let first: string | null = null;
  for (const r of rows) {
    if (r.kind !== 'draft') continue;
    const d = rowDate(r);
    if (d && (!first || d < first)) first = d;
  }
  return first;
}

/**
 * The value at the draft (the stake at cost), then at each trading day's close after the draft
 * day and before today. Trading days are the dates any held-or-ever-held symbol has a bar.
 */
export function dailyValues(input: { rows: readonly ChartActivityRow[]; bars: Bars; stake: ChartStake; todayEt: string }): DailyValue[] {
  const { rows, bars, stake, todayEt } = input;
  const start = draftDateOf(rows);
  if (!start) return [];
  // The draft day: every stock at its draft price, so the value is the stake.
  const out: DailyValue[] = [{ date: start, value: cents(valueThrough(rows, start, stake, () => null)) }];
  const dates = new Set<string>();
  for (const series of Object.values(bars)) {
    for (const b of series) if (b.date > start && b.date < todayEt && b.close > 0) dates.add(b.date);
  }
  for (const date of [...dates].sort()) {
    const value = valueThrough(rows, date, stake, (sym) => closeOnOrBefore(bars[sym] ?? bars[sym.toUpperCase()], date));
    out.push({ date, value: cents(value) });
  }
  return out;
}

export type PortfolioSeries = RangeSeries;

/** The first day of the league's history: the draft day (null: nothing drafted). Season starts
 * here, and no range reaching back before it can be drawn (it is grey). */
export function portfolioHistoryStart(daily: readonly DailyValue[]): string | null {
  return daily[0]?.date ?? null;
}

/** The Monday of `iso`'s week (Saturday and Sunday belong to the week just ended). */
export function mondayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sun … 6 Sat
  const delta = dow === 0 ? -6 : 1 - dow;
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/**
 * The line for one range. `liveValue` is the header's value now (null: no live point, the
 * line stops at the last close). 1W is the past five sessions on the sessions axis, the live
 * value its last point once today's session has opened.
 */
export function portfolioSeries(input: {
  range: PortfolioRange;
  daily: readonly DailyValue[];
  liveValue: number | null;
  todayEt: string;
  now: Date;
  /** This week's sessions: whether today has opened (the 1W window's last point). */
  sessions: readonly MarketCalendarSession[];
}): PortfolioSeries {
  const { range, daily, liveValue, todayEt, now, sessions } = input;
  return rangeSeries({
    range,
    values: daily,
    live: liveValue,
    liveToday: todaySessionOpen(sessions, todayEt, now),
    todayEt,
    seasonStart: portfolioHistoryStart(daily),
  });
}
