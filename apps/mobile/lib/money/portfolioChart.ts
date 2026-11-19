/**
 * portfolioChart (W4, Game Night): the Portfolio value line under the hero (§9C "Chart",
 * "The X axis"; Giorgio, 2026-10-12: "the Portfolio chart with range pills: yes"). Pure, so
 * tests-deno/money-portfolio-chart.test.ts pins it.
 *
 * What it plots: the team value (teamValue, the SAME formula as the header and Home) at each
 * trading day's close since the draft, then the live value now. Each day's value is teamValue
 * over the ledger rows up to that day, priced at that very day's REAL closes. A day is drawn only
 * when every stock held on it has such a close; there is no carried-forward close, no stock valued
 * at cost and no partial sum (a part shown as the whole), and a hole breaks the line instead of
 * bridging it (see dailyValues; the Planner's no-invented-stretch rule, 2026-11-18). A buy or a
 * sale moves only the cash/stake split, never the line (the money just changes form).
 *
 * The ranges are the six every chart shares (lib/chart/chartRanges.ts; Giorgio 2026-11-17): 1W · 1M
 * · 3M · 6M · Season · YTD. Season is the whole line from the draft; the others are windows of it,
 * each measured from the value at the window's start (the first daily value on or after it).
 * A range longer than the league has existed is grey (chartRanges.isRangeGrey, history = the
 * league's age, from the first drawn date); Season never greys here, since it starts where the line does.
 * No dashed base: the range's first value only sets the line's tone and the gain.
 */
import { teamValue, type StakeMode } from '../home/teamValue';
import { etDateOf } from '../game/matchupRoster';
import type { MarketCalendarSession } from '../time/marketWeek';
import { dayOffset } from '../../components/sp/logic/chartAxis';
import { CHART_RANGES, SEASON_DEFAULT_RANGE, greyedRanges, rangeSeries, todaySessionOpen, type ChartRange, type RangeGain, type RangeSeries } from '../chart/chartRanges';
import { lineTone } from '../../components/sp/logic/lineChart';

export type PortfolioRange = ChartRange;
/** The pills' order, left to right: the same six on every chart. */
export const PORTFOLIO_RANGES: readonly PortfolioRange[] = CHART_RANGES;
/** Portfolio opens on Season (Giorgio, 2026-11-17: your team's whole run). */
export const DEFAULT_PORTFOLIO_RANGE: PortfolioRange = SEASON_DEFAULT_RANGE;

/** The picked range and the league it was picked in. */
export interface PortfolioRangePick {
  leagueId: string | null;
  range: PortfolioRange;
}

/**
 * The pick for the league on screen: the same object while the league is the one it was picked
 * in; a fresh Season pick once the league changes. A team chart opens on Season in every league
 * (Giorgio 2026-11-17); a range picked in one league never carries into another (build 17: YTD
 * in one league became 1W in a younger one).
 */
export function portfolioRangePick(pick: PortfolioRangePick, leagueId: string | null): PortfolioRangePick {
  return pick.leagueId === leagueId ? pick : { leagueId, range: DEFAULT_PORTFOLIO_RANGE };
}

/** A pill tap: the range, recorded against the league on screen (so portfolioRangePick keeps it). */
export function portfolioRangeChoice(leagueId: string | null, range: PortfolioRange): PortfolioRangePick {
  return { leagueId, range };
}

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
  /** Real data is missing between the previous point and this one: the line breaks here (dailyValues). */
  breakBefore?: boolean;
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

/** The last close on or before `date` (bars ascending or not); null with none (never a guess, never $0). */
export function closeOnOrBefore(bars: readonly { date: string; close: number }[] | undefined, date: string): number | null {
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

/** The server's price ladder look-back (supabase/functions/_shared/week-price.ts PREV_CLOSE_MAX_SESSIONS): a session with no bar
 * takes the stock's previous real close from within this many market sessions before it, never an older one. */
export const PREV_CLOSE_MAX_SESSIONS = 5;

/** No market closure is longer than this many calendar days (a weekend plus a holiday is 4), so two real
 * points further apart than this have DATA missing between them, not a closed market. */
export const MAX_GAP_DAYS = 5;

/** The stake at cost on the draft day (every stock at its draft price): the "since the draft" basis,
 * a real number whether or not the line starts there. Null: nothing drafted. */
export function draftValueOf(rows: readonly ChartActivityRow[], stake: ChartStake): number | null {
  const start = draftDateOf(rows);
  return start ? cents(valueThrough(rows, start, stake, () => null)) : null;
}

/** The symbols held after every row on or before `date` (net shares above zero), upper-case. */
function heldOn(rows: readonly ChartActivityRow[], date: string): string[] {
  const net = new Map<string, number>();
  for (const r of rows) {
    const d = rowDate(r);
    if (d === null || d > date) continue;
    const sym = r.symbol.toUpperCase();
    if (sym === 'SKIP') continue;
    net.set(sym, (net.get(sym) ?? 0) + (r.action === 'sell' ? -r.quantity : r.quantity));
  }
  return [...net].filter(([, q]) => q > 1e-9).map(([sym]) => sym);
}

/**
 * The team's value line: the stake at cost on the draft day, then each trading day's close after it
 * (before today, or up to the season's last day with `endEt`). NEVER an invented stretch (Giorgio,
 * 2026-11-18: "never incorrect, never old, never missing"):
 *   - a date is drawn only when EVERY stock held on it has a REAL close: its own bar, or, for a session with no
 *     bar (a zero-volume day), its PREVIOUS REAL CLOSE within PREV_CLOSE_MAX_SESSIONS (5) market sessions, the same
 *     ladder the server scores a week with (_shared/week-price.ts, #513), so the chart agrees with the score. Past
 *     that: no stock valued at cost, no partial sum of the stocks that do have bars, and the date is not drawn;
 *   - a hole breaks the line (`breakBefore`) instead of joining its two sides: a date in the middle that is
 *     not complete, or two drawn dates further apart than any market closure (MAX_GAP_DAYS);
 *   - the draft-day point (the stake) joins the line only when real data follows it directly; otherwise it
 *     is dropped and the line starts at the first date whose closes are all real (the 407-day bars clamp
 *     leaves a league older than that with no early bars). Nothing is drawn for the missing stretch.
 * Trading days are the dates any symbol has a bar. With no complete date there is no line at all.
 *
 * `endEt` (a season that is over): the days run up to AND INCLUDING the season's last day instead, and
 * today plays no part, so the line is the same whenever it is read; a bar after endEt is never read.
 */
export function dailyValues(input: { rows: readonly ChartActivityRow[]; bars: Bars; stake: ChartStake; todayEt: string; endEt?: string | null }): DailyValue[] {
  const { rows, bars, stake, todayEt, endEt } = input;
  const start = draftDateOf(rows);
  if (!start) return [];
  const inRange = endEt ? (d: string) => d <= endEt : (d: string) => d < todayEt;
  // Each symbol's closes by date: a date counts for a stock only when it has a real close ON it.
  const closes = new Map<string, Map<string, number>>();
  const dates = new Set<string>();
  for (const [sym, series] of Object.entries(bars)) {
    const by = closes.get(sym.toUpperCase()) ?? new Map<string, number>();
    for (const b of series) {
      if (!(b.close > 0)) continue;
      by.set(b.date, b.close);
      if (b.date > start && inRange(b.date)) dates.add(b.date);
    }
    closes.set(sym.toUpperCase(), by);
  }
  const universe = [...dates].sort();
  // A stock's price on session `i` of the universe: its own bar, else its most recent real close within the previous
  // PREV_CLOSE_MAX_SESSIONS sessions (the server's ladder), else none.
  const priceOn = (sym: string, i: number): number | null => {
    const by = closes.get(sym.toUpperCase());
    if (!by) return null;
    const own = by.get(universe[i]);
    if (own != null) return own;
    for (let j = i - 1; j >= Math.max(0, i - PREV_CLOSE_MAX_SESSIONS); j--) {
      const c = by.get(universe[j]);
      if (c != null) return c;
    }
    return null;
  };

  // Every date whose closes are all real, in order; each says whether a hole lies before it.
  const points: DailyValue[] = [];
  let prev: { date: string; complete: boolean } = { date: start, complete: true };
  for (const [i, date] of universe.entries()) {
    const held = heldOn(rows, date);
    const complete = held.every((sym) => priceOn(sym, i) != null);
    if (complete) {
      const value = valueThrough(rows, date, stake, (sym) => priceOn(sym, i));
      const breaks = !prev.complete || dayOffset(prev.date, date) > MAX_GAP_DAYS;
      points.push({ date, value: cents(value), ...(breaks ? { breakBefore: true } : {}) });
    }
    prev = { date, complete };
  }

  // The draft-day point (the stake) joins the line only when the very next drawn point follows it directly
  // (that point's own flag compares it with the draft day). With no complete date at all the line is that
  // point and the live one alone, but only for a league drafted just now (no bars yet is no hole), never
  // across a stretch whose bars are missing; a finished season with no complete date has no line.
  const keepAnchor = points.length > 0 ? !points[0].breakBefore : !endEt && universe.length === 0 && dayOffset(start, todayEt) <= MAX_GAP_DAYS;
  const out: DailyValue[] = keepAnchor ? [{ date: start, value: cents(valueThrough(rows, start, stake, () => null)) }] : [];
  // The first point of a line that starts late has nothing before it to break from.
  for (const [i, p] of points.entries()) out.push(i === 0 ? { date: p.date, value: p.value } : p);
  return out;
}

export type PortfolioSeries = RangeSeries;

/** The first day of the league's history: the draft day (null: nothing drafted). Season starts
 * here, and no range reaching back before it can be drawn (it is grey). */
export function portfolioHistoryStart(daily: readonly DailyValue[]): string | null {
  return daily[0]?.date ?? null;
}

/**
 * Is there a LINE to draw? One point (a lone live value, a lone draft-day anchor) is a dot, not a line, so it
 * does not earn a chart block. `dailyCount` keeps the buttons when the window picked has one point but a longer
 * range has a line (the viewer must be able to switch to it).
 */
export function drawsALine(windowPoints: number, dailyCount: number): boolean {
  return windowPoints >= 2 || dailyCount >= 2;
}

/** The ranges that are grey on Portfolio: those longer than the league has existed (history = the
 * league's age, from the draft). Season never is (its first day IS the draft day); 1W never is. */
export function portfolioGreyedRanges(daily: readonly DailyValue[], todayEt: string): ChartRange[] {
  const start = portfolioHistoryStart(daily);
  return greyedRanges({ todayEt, historyStart: start, seasonStart: start });
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
  /** The stake at cost on the draft day (draftValueOf): Season's gain is measured from it ("since the draft"),
   * even when the line starts later because early bars are missing. */
  draftValue?: number | null;
}): PortfolioSeries {
  const { range, daily, liveValue, todayEt, now, sessions, draftValue } = input;
  const s = rangeSeries({
    range,
    values: daily,
    live: liveValue,
    liveToday: todaySessionOpen(sessions, todayEt, now),
    todayEt,
    seasonStart: portfolioHistoryStart(daily),
    // The live point never bridges a stretch whose bars are missing.
    breakLiveOverDays: MAX_GAP_DAYS,
  });
  return range === 'Season' && draftValue != null && s.points.length ? { ...s, base: draftValue } : s;
}

/**
 * A season that is over (Giorgio, 2026-11-18, pick A: "just the chart"): the whole line, Season, from the
 * draft to the season's last day. No live point and no today: `daily` must come from
 * dailyValues({ endEt }), and the axis ends at endEt (a final whose last close fell on an earlier
 * session still reaches the season's last day). The same output whenever it is read.
 */
export function finishedPortfolioSeries(input: { daily: readonly DailyValue[]; endEt: string; draftValue?: number | null }): PortfolioSeries {
  const { daily, endEt, draftValue } = input;
  const s = rangeSeries({
    range: 'Season',
    values: daily.filter((v) => v.date <= endEt),
    live: null,
    liveToday: false,
    todayEt: endEt,
    seasonStart: portfolioHistoryStart(daily),
  });
  // "Since the draft" is the last value minus the stake at cost, even when the line starts late.
  return draftValue != null && s.points.length ? { ...s, base: draftValue } : s;
}

/**
 * Each symbol's close at the season's last day (a finished season's holding prices): its own bar on the last session on or
 * before `endEt`, else its previous real close within PREV_CLOSE_MAX_SESSIONS (5) sessions before it, the same ladder the server
 * scores a week with and the value line uses (dailyValues). A close from before that window is NOT the season-end price: a stock
 * whose last bar is weeks earlier is left out (never priced at that old close, and never at cost), so the caller's value is
 * unknown (teamPortfolioView: no view; the screens' load failure). Sessions are the dates any symbol in `bars` has a bar.
 */
export function seasonEndCloses(bars: Bars, symbols: readonly string[], endEt: string): Record<string, number> {
  const dates = new Set<string>();
  for (const series of Object.values(bars)) for (const b of series) if (b.close > 0 && b.date <= endEt) dates.add(b.date);
  // The last session on or before the season's end, then up to PREV_CLOSE_MAX_SESSIONS sessions before it, newest first.
  const window = [...dates].sort().slice(-(PREV_CLOSE_MAX_SESSIONS + 1)).reverse();
  const out: Record<string, number> = {};
  for (const sym of symbols) {
    const up = sym.toUpperCase();
    const series = bars[up] ?? bars[sym];
    if (!series) continue;
    for (const d of window) {
      const hit = series.find((b) => b.date === d && b.close > 0);
      if (hit) {
        out[up] = hit.close;
        break;
      }
    }
  }
  return out;
}

/**
 * "Since the draft" (Season, and a finished season): the last value minus the stake at cost, both real
 * numbers (Giorgio, 2026-11-18: unchanged when the line starts late or cannot be drawn at all). It does not
 * read the drawn points' first value, which is the draft-day point only when real data follows the draft
 * directly. Null with no last value or no cost.
 */
export function sinceTheDraftGain(last: number | null, draftValue: number | null): RangeGain | null {
  if (last == null || draftValue == null) return null;
  const money = last - draftValue;
  return { money, pct: draftValue !== 0 ? (money / draftValue) * 100 : 0, tone: lineTone([{ t: 0, value: last }], draftValue) };
}

/**
 * The held symbols with NO real close on or before the season's last day (a finished season's value is the season-end
 * closes, so one missing makes it unknown). Judged per holding, never "are there any bars at all" (the partial-state
 * family): an empty list means every holding has its close.
 */
export function symbolsMissingSeasonEndClose(bars: Bars, symbols: readonly string[], endEt: string): string[] {
  const have = seasonEndCloses(bars, symbols, endEt);
  return symbols.filter((s) => have[s.toUpperCase()] == null);
}
