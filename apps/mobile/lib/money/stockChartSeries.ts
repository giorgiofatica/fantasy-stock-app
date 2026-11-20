/**
 * stockChartSeries: the pure data behind a stock's chart (the stock sheet and the player card).
 * Daily bars only, no 1D (Giorgio, 2026-09-30). The six ranges, their windows, the greying and
 * the gain are lib/chart/chartRanges.ts (one definition for every chart); this file feeds it a
 * stock's closes. A range reads real bars only: it never synthesizes a point for a day with no
 * bar (a closed market, a feed gap).
 *
 * 1W is the PAST FIVE TRADING SESSIONS, one point a day, whatever day it is (Giorgio,
 * 2026-11-16: "A now, B later with the supplier"). There is no dashed reference line on any
 * chart: the range's first value only decides the line's gain/loss colour and the gain.
 */
import { formatMoney, formatPercent } from '../../components/sp/logic/money';
import type { AxisSpec } from '../../components/sp/logic/chartAxis';
import type { LinePointIn } from '../../components/sp/logic/lineChart';
import { greyedRanges, rangeSeries, todaySessionOpen, type ChartRange } from '../chart/chartRanges';
import type { MarketCalendarSession } from '../time/marketWeek';
import { seasonEndClose } from './portfolioChart';

export type { ChartRange } from '../chart/chartRanges';

export interface DailyBar {
  /** YYYY-MM-DD. */
  date: string;
  close: number;
}

export interface ScrubLabel {
  /** A readable date ("Wed, Oct 1" / "Oct 1, 2025"), or "Today" for the latest point. */
  primary: string;
  price: string;
  /** Signed, vs the range's baseline (never the previous bar, never prevClose). */
  money: string;
  /** Signed, vs the range's baseline. */
  percent: string;
  /** For the caller's gain/loss colour — colour is never the only code (the
   * sign is already in `money` and `percent`). */
  gain: boolean;
}

const SCRUB_DATE_THIS_YEAR: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
const SCRUB_DATE_OTHER_YEAR: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };

function scrubDateLabel(dateIso: string, now: Date): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateIso;
  // No year unless the bar isn't from this year (Design Lead ruling).
  const opts = d.getUTCFullYear() === now.getUTCFullYear() ? SCRUB_DATE_THIS_YEAR : SCRUB_DATE_OTHER_YEAR;
  return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' }).format(d);
}

/**
 * The scrub's floating label (Design Lead ruling, 2026-10-06): date, close,
 * and the change vs the range's baseline, signed, in gain/loss colour. The
 * latest point in the range reads "Today" instead of its date. Never calls
 * Intl's formatToParts — date-only strings don't carry the Hermes
 * hour/hourCycle gap formatToParts has, but this sidesteps it on principle
 * (Deno can't see that gap either way, so there is nothing to pin a test on).
 */
export function stockScrubLabel(bar: DailyBar, baseline: number, isLatest: boolean, now: Date): ScrubLabel {
  const delta = bar.close - baseline;
  const pct = baseline !== 0 ? (delta / baseline) * 100 : 0;
  return {
    primary: isLatest ? 'Today' : scrubDateLabel(bar.date, now),
    price: formatMoney(bar.close),
    money: formatMoney(delta, { sign: 'always' }),
    percent: formatPercent(pct, { sign: 'always' }),
    gain: delta >= 0,
  };
}

// ── The stock's line on the Game Night Chart (§9C "The X axis") ─────────────────────────

/** The first day of a stock's price history: its first bar (null with none, or while loading). */
export function historyStartOf(bars: readonly DailyBar[]): string | null {
  let first: string | null = null;
  for (const b of bars) if (b.close > 0 && (first == null || b.date < first)) first = b.date;
  return first;
}

/**
 * The ranges that are grey on a stock's chart: those longer than the stock's own trading history
 * (its first bar; not known yet while the bars load, so nothing is compared then), and Season when
 * there is no season yet (the league has not drafted, or there is no league). 1W never is.
 */
export function stockGreyedRanges(input: { bars: readonly DailyBar[]; ready: boolean; todayEt: string; seasonStart: string | null }): ChartRange[] {
  return greyedRanges({ todayEt: input.todayEt, historyStart: input.ready ? historyStartOf(input.bars) : null, seasonStart: input.seasonStart });
}

/**
 * A stock's line for one range, from its daily bars and the live price (chartRanges.rangeSeries).
 * `base` is the range's FIRST close: it only sets the line's tone and the gain, and is never
 * drawn. `seasonStart` is the league's draft day (null before the draft, or with no league: the
 * Season range then has nothing to draw, and its pill is grey).
 */
export function stockLineSeries(input: {
  range: ChartRange;
  bars: readonly DailyBar[];
  price: number | null;
  todayEt: string;
  now: Date;
  /** This week's sessions: whether today is a trading day, and whether it has opened. */
  sessions: readonly MarketCalendarSession[];
  seasonStart: string | null;
}): { points: LinePointIn[]; base: number; axis: AxisSpec } {
  const { range, bars, price, todayEt, now, sessions, seasonStart } = input;
  return rangeSeries({
    range,
    values: bars.filter((b) => b.close > 0).map((b) => ({ date: b.date, value: b.close })),
    live: price,
    liveToday: todaySessionOpen(sessions, todayEt, now),
    todayEt,
    seasonStart,
  });
}

/**
 * A stock's line for a season that is over (Giorgio, 2026-11-18, pick A on the player card: "this is a
 * previous season. Today's pricing doesn't really matter"): Season, from the league's draft day to the
 * season's last day. Closes on or before `endEt` ONLY (a later bar is never read), no live point. `endPrice` is the
 * bounded season-end close (seasonEndClose: the last session's own bar, else a real close within five market sessions,
 * the same decision the Portfolio's holdings use) — null with none, never a guess, and then there is NO line: a stock
 * whose last bar is weeks before the end is not shown at an old close. The same output whenever it is read.
 */
export function finishedStockSeries(input: {
  bars: readonly DailyBar[];
  endEt: string;
  seasonStart: string | null;
}): { points: LinePointIn[]; base: number; axis: AxisSpec; endPrice: number | null } {
  const { bars, endEt, seasonStart } = input;
  const endPrice = seasonEndClose(bars, endEt);
  const values = endPrice == null ? [] : bars.filter((b) => b.close > 0 && b.date <= endEt).map((b) => ({ date: b.date, value: b.close }));
  const s = rangeSeries({ range: 'Season', values, live: null, liveToday: false, todayEt: endEt, seasonStart });
  return { ...s, endPrice };
}
