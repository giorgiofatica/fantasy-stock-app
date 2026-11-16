/**
 * stockChartSeries: the pure data behind the stock sheet's chart (3e, M2).
 * Ranges are daily bars only (Giorgio's chart-ranges ruling (A), 2026-09-30:
 * 1W/1M/3M/1Y, 1W default, NO 1D — overrides the older board mock and spec
 * text, which both still show 1D). A range reads real bars only: this never
 * synthesizes a point for a day with no bar (a closed market, a feed gap).
 *
 * 1W is the PAST FIVE TRADING SESSIONS, one point a day, whatever day it is (Giorgio,
 * 2026-11-16: "A now, B later with the supplier"; not this calendar week, which on a Monday was
 * one stroke). 1M / 3M / 1Y are calendar-day windows. There is no dashed reference line any
 * more (same day): the range's first value only decides the line's gain/loss colour.
 */
import { formatMoney, formatPercent } from '../../components/sp/logic/money';
import { dayOffset, type AxisSpec } from '../../components/sp/logic/chartAxis';
import type { LinePointIn } from '../../components/sp/logic/lineChart';
import { etWallClockToUtcIso, type MarketCalendarSession } from '../time/marketWeek';

export interface DailyBar {
  /** YYYY-MM-DD. */
  date: string;
  close: number;
}

export type ChartRange = '1W' | '1M' | '3M' | '1Y';

/** Order matters: this is the segmented control's left-to-right order. */
export const CHART_RANGES: ChartRange[] = ['1W', '1M', '3M', '1Y'];
export const DEFAULT_CHART_RANGE: ChartRange = '1W';

/** 1W is counted in trading sessions (SESSIONS_1W), not calendar days. This calendar-day entry
 * only keeps the Record total; nothing reads it for 1W. */
const LOOKBACK_DAYS: Record<ChartRange, number> = {
  '1W': 7,
  '1M': 31,
  '3M': 93,
  '1Y': 366,
};

/** Calendar days to look back for a range — a window, not a trading-day count
 * (the bars themselves are already trading days only; weekends and holidays
 * have no row, so they fall out of the window on their own). */
export const SESSIONS_1W = 5;

export function rangeLookbackDays(range: ChartRange): number {
  return LOOKBACK_DAYS[range];
}

/** The bars within `range` of `now`, oldest first, real bars only — no
 * interpolation, no synthesized day. 1W is the last five bars (trading sessions: a weekend or
 * holiday has no bar, so it takes no slot); the other ranges are calendar-day windows, and a
 * bar dated exactly on the cutoff is kept (>=). */
export function barsForRange(bars: DailyBar[], range: ChartRange, now: Date): DailyBar[] {
  const nowIso = now.toISOString().slice(0, 10);
  const upToNow = bars.filter((b) => b.date <= nowIso).sort((a, b) => a.date.localeCompare(b.date));
  if (range === '1W') return upToNow.slice(-SESSIONS_1W);
  const cutoff = new Date(now.getTime() - rangeLookbackDays(range) * 86_400_000);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return upToNow.filter((b) => b.date >= cutoffIso);
}

/** Each bar's close, relative to `baseline` — chartGeometry's zero-baseline
 * gain/loss math is reused unchanged by feeding it this delta series. */
export function deltaSeries(bars: DailyBar[], baseline: number): number[] {
  return bars.map((b) => b.close - baseline);
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

// ── Game Night (W4): the sheet's line on the §9C X axis ─────────────────────────────────

function isWeekdayIso(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow >= 1 && dow <= 5;
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * The stock sheet's line for one range, on the Game Night Chart (§9C "The X axis"):
 *   - 1W: the past five trading sessions (Giorgio, 2026-11-16), one point each on the sessions
 *     axis (weekday names): the last closes, then the live price as today's point once today's
 *     session has opened. Not the calendar week: from a Monday it still shows five sessions.
 *     Fewer than five bars (a new listing) draws what there is.
 *   - 1M / 3M / 1Y: a dated axis from the range's first close to today ("MMM d"; 1Y in months),
 *     the closes in the window, then the live price as today's point.
 * `base` is the range's first value (the Design Lead's 2026-10-06 ruling, the range's FIRST
 * close, not the previous close). It is no longer drawn; it only sets the line's tone. Real bars only: a day with no
 * bar is never invented.
 */
export function stockLineSeries(input: {
  range: ChartRange;
  bars: readonly DailyBar[];
  price: number | null;
  todayEt: string;
  now: Date;
  /** This week's sessions: whether today is a trading day, and whether it has opened. */
  sessions: readonly MarketCalendarSession[];
}): { points: LinePointIn[]; base: number; axis: AxisSpec } {
  const { range, price, todayEt, now, sessions } = input;
  const bars = [...input.bars].filter((b) => b.close > 0).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (range === '1W') {
    // Today is a point only on a session day that has opened (with no calendar to ask, a
    // weekday): on a weekend, a holiday or before the open, the window ends on the last close.
    const todaySession = sessions.find((s) => s.sessionDate === todayEt);
    const openIso = todaySession ? etWallClockToUtcIso(todaySession.sessionDate, todaySession.openEt) : null;
    const todayOpen = todaySession
      ? openIso != null && now.getTime() >= new Date(openIso).getTime()
      : sessions.length === 0 && isWeekdayIso(todayEt);
    const withToday = todayOpen && price != null;
    const days = bars.filter((b) => (withToday ? b.date < todayEt : b.date <= todayEt)).slice(-(withToday ? SESSIONS_1W - 1 : SESSIONS_1W));
    const points: LinePointIn[] = days.map((b, i) => ({ t: i, value: b.close }));
    const dayIsos = days.map((b) => b.date);
    if (withToday) {
      points.push({ t: points.length, value: price });
      dayIsos.push(todayEt);
    }
    return { points, base: points[0]?.value ?? 0, axis: { kind: 'sessions', days: dayIsos } };
  }
  const cutoff = addDaysIso(todayEt, -rangeLookbackDays(range));
  const inWindow = bars.filter((b) => b.date >= cutoff && (price == null ? b.date <= todayEt : b.date < todayEt));
  const series = price != null ? [...inWindow, { date: todayEt, close: price }] : inWindow;
  const start = series[0]?.date ?? todayEt;
  return {
    points: series.map((b) => ({ t: dayOffset(start, b.date), value: b.close })),
    base: series[0]?.close ?? price ?? 0,
    axis: { kind: 'dated', start, end: todayEt < start ? start : todayEt, months: range === '1Y' },
  };
}
