/**
 * chartRanges: the ONE definition of a chart's six ranges, shared by the Portfolio chart, the
 * stock sheet's chart and the player card (PRODUCT_RULES "Every chart has the same six ranges",
 * Giorgio 2026-11-17; the Design Lead's chart-ranges-1117 acceptance). Pure, so
 * tests-deno/chart-ranges.test.ts pins it.
 *
 *   - Ranges: 1W · 1M · 3M · 6M · Season · YTD. No 1Y, no 1D.
 *   - 1W is the past five trading sessions (Giorgio, 2026-11-16), on the weekday-named axis; the
 *     other five are calendar windows on a dated axis. Season is "since THIS league's draft"
 *     (the same window for every stock, owned or not); YTD starts at the year's first day.
 *   - Greying: ONE helper, `isRangeGrey`: "a range longer than the history behind it is grey".
 *     1W never greys (a stock under a week old draws only the days that exist).
 *   - The gain beside the chart follows the range: "+$X (+Y%) words", dollars first, the percent
 *     in brackets, no dot between the numbers; its colour is the LINE's colour (both read
 *     lineTone), so they can never disagree.
 *   - There is no dotted base line on any chart (Giorgio, 2026-11-16/17); `base` only decides the
 *     line's tone and the gain.
 */
import { dayOffset, type AxisSpec } from '../../components/sp/logic/chartAxis';
import { lineTone, type LinePointIn, type LineTone } from '../../components/sp/logic/lineChart';
import { formatMoney, formatPercent } from '../../components/sp/logic/money';
import { NBSP } from '../game/keepDots';
import { etWallClockToUtcIso, type MarketCalendarSession } from '../time/marketWeek';

export type ChartRange = '1W' | '1M' | '3M' | '6M' | 'Season' | 'YTD';

/** The pills' left-to-right order. */
export const CHART_RANGES: readonly ChartRange[] = ['1W', '1M', '3M', '6M', 'Season', 'YTD'];

/** The stock sheet opens on 1W (what the stock did lately); Portfolio and the player card on
 * Season (your team's whole run) — Giorgio 2026-11-17, "go with B". Nothing is remembered. */
export const SHEET_DEFAULT_RANGE: ChartRange = '1W';
export const SEASON_DEFAULT_RANGE: ChartRange = 'Season';

/** The range that never greys, so a chart always has something to open on. */
export const FALLBACK_RANGE: ChartRange = '1W';

/** The approved period words (Giorgio, 2026-11-17: "A both numbers and A with past 6 months word"). */
export const RANGE_WORDS: Record<ChartRange, string> = {
  '1W': 'past week',
  '1M': 'past month',
  '3M': 'past 3 months',
  '6M': 'past 6 months',
  Season: 'since the draft',
  YTD: 'this year',
};

/** 1W is counted in trading sessions, not calendar days. */
export const SESSIONS_1W = 5;

/** Calendar-day windows for the three rolling ranges. */
const LOOKBACK_DAYS = { '1M': 31, '3M': 93, '6M': 186 } as const;

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * The first calendar day a range reaches back to, or null when it has none: 1W (counted in
 * sessions) and Season with no season yet (no league, or the league has not drafted).
 */
export function rangeStartDate(range: ChartRange, todayEt: string, seasonStart: string | null): string | null {
  if (range === '1W') return null;
  if (range === 'Season') return seasonStart;
  if (range === 'YTD') return `${todayEt.slice(0, 4)}-01-01`;
  return addDaysIso(todayEt, -LOOKBACK_DAYS[range]);
}

/**
 * The first calendar day the DRAWN range covers: 1W's first session, a dated range's nominal start
 * (or, with none, its first point). The player card measures a lot opened on or after it from the
 * lot's own entry price.
 */
export function rangeFirstDay(range: ChartRange, axis: AxisSpec, todayEt: string, seasonStart: string | null): string | null {
  if (axis.kind === 'sessions') return axis.days[0] ?? null;
  return rangeStartDate(range, todayEt, seasonStart) ?? (axis.kind === 'dated' ? axis.start : null);
}

export interface GreyContext {
  todayEt: string;
  /** The first day of the history behind the chart: a stock's first bar, a league's draft day.
   * Null while it is not known yet (the bars are loading): nothing is compared. */
  historyStart: string | null;
  /** Since-the-draft's first day: the league's draft day once it has finished its draft; null
   * before that, or with no league at all. */
  seasonStart: string | null;
}

/**
 * THE greying rule, one helper for every chart: a range longer than the history behind it is
 * grey. 1W never greys. Season with no season yet is grey (the stock sheet before the draft).
 * A grey pill keeps its place in the row; the caller draws it dimmed and inert.
 */
export function isRangeGrey(range: ChartRange, ctx: GreyContext): boolean {
  if (range === '1W') return false;
  if (range === 'Season' && ctx.seasonStart == null) return true;
  if (ctx.historyStart == null) return false;
  const start = rangeStartDate(range, ctx.todayEt, ctx.seasonStart);
  return start != null && ctx.historyStart > start;
}

export function greyedRanges(ctx: GreyContext): ChartRange[] {
  return CHART_RANGES.filter((r) => isRangeGrey(r, ctx));
}

/** The range a chart actually shows: a grey one is never selected, it falls back to 1W. */
export function selectableRange(range: ChartRange, greyed: readonly ChartRange[]): ChartRange {
  return greyed.includes(range) ? FALLBACK_RANGE : range;
}

/** Narrow a capture/DEV string to a range (the capture script's `range` action). */
export function asChartRange(value: string | undefined): ChartRange | null {
  return (CHART_RANGES as readonly string[]).includes(value ?? '') ? (value as ChartRange) : null;
}

function isWeekdayIso(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow >= 1 && dow <= 5;
}

/**
 * Whether today's session has opened, so the live value is 1W's last point: a point only on a
 * session day that has opened (with no calendar to ask, a weekday). On a weekend, a holiday or
 * before the open, the window ends on the last close.
 */
export function todaySessionOpen(sessions: readonly MarketCalendarSession[], todayEt: string, now: Date): boolean {
  const today = sessions.find((s) => s.sessionDate === todayEt);
  if (!today) return sessions.length === 0 && isWeekdayIso(todayEt);
  const openIso = etWallClockToUtcIso(today.sessionDate, today.openEt);
  return openIso != null && now.getTime() >= new Date(openIso).getTime();
}

// ── The series ──────────────────────────────────────────────────────────────────────────

export interface DatedValue {
  /** ET trading date, YYYY-MM-DD. */
  date: string;
  value: number;
}

export interface RangeSeries {
  points: LinePointIn[];
  /** The range's first value: sets the line's tone and the gain. Never drawn. */
  base: number;
  axis: AxisSpec;
}

/**
 * One range's line from daily values (closes or portfolio values), oldest first, for any chart.
 *   - 1W: the last five sessions, one point each on the sessions axis (weekday names); today's
 *     live value is the last point only when `liveToday` (today's session has opened).
 *   - the rest: the values inside the window, then the live value as today's point, on a dated
 *     axis from the first value to today. Real values only: a day with no value is never invented.
 * `live` null: no live point (the line stops at the last close).
 */
export function rangeSeries(input: {
  range: ChartRange;
  values: readonly DatedValue[];
  live: number | null;
  /** 1W only: today's session has opened, so the live value is today's point. */
  liveToday: boolean;
  todayEt: string;
  seasonStart: string | null;
}): RangeSeries {
  const { range, live, liveToday, todayEt, seasonStart } = input;
  const values = [...input.values].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (range === '1W') {
    const withToday = liveToday && live != null;
    const days = values.filter((v) => (withToday ? v.date < todayEt : v.date <= todayEt)).slice(-(withToday ? SESSIONS_1W - 1 : SESSIONS_1W));
    const points: LinePointIn[] = days.map((v, i) => ({ t: i, value: v.value }));
    const dayIsos = days.map((v) => v.date);
    if (withToday) {
      points.push({ t: points.length, value: live });
      dayIsos.push(todayEt);
    }
    return { points, base: points[0]?.value ?? 0, axis: { kind: 'sessions', days: dayIsos } };
  }
  const start = rangeStartDate(range, todayEt, seasonStart);
  if (start == null) return { points: [], base: 0, axis: { kind: 'dated', start: todayEt, end: todayEt } };
  // The value the range STARTS from is its first value on or after the window start, even
  // when today's live point then replaces that day's own (a season drafted today: one live dot
  // measured from the stake).
  const inWindow = values.filter((v) => v.date >= start && v.date <= todayEt);
  const series = live != null ? [...inWindow.filter((v) => v.date < todayEt), { date: todayEt, value: live }] : inWindow;
  const first = series[0]?.date ?? todayEt;
  return {
    points: series.map((v) => ({ t: dayOffset(first, v.date), value: v.value })),
    base: inWindow[0]?.value ?? live ?? 0,
    axis: { kind: 'dated', start: first, end: todayEt < first ? first : todayEt },
  };
}

// ── The gain beside the chart ────────────────────────────────────────────────────────────

export interface RangeGain {
  /** last − first, in the chart's own unit (a share's price, or the team's value). */
  money: number;
  /** Percent of the first value. */
  pct: number;
  /** The LINE's tone (lineTone over the same points and base), so text and line agree. */
  tone: LineTone;
}

/** The gain over the drawn range; null with nothing drawn. */
export function rangeGain(points: readonly LinePointIn[], base: number): RangeGain | null {
  if (!points.length) return null;
  const money = points[points.length - 1].value - base;
  return { money, pct: base !== 0 ? (money / base) * 100 : 0, tone: lineTone(points as LinePointIn[], base) };
}

export interface RangeGainText {
  /** The dollars, signed ("+$54.60"). */
  money: string;
  /** The percent, signed ("+41.42%"), shown in brackets. */
  pct: string;
  /** "+$54.60 (+41.42%)": dollars, the percent in brackets, no dot. */
  figures: string;
  /** The approved period words ("past 6 months"). */
  words: string;
  /** Everything, plain, for VoiceOver. */
  label: string;
  /** The words with a no-break space between each: the period phrase never breaks. */
  keptWords: string;
}

/**
 * "+$54.60 (+41.42%) past 6 months". The only place the line may break is between the figures and the
 * words: the component draws the figures as one non-wrapping run (each number a rolling figure) and the
 * phrase as one run whose spaces are no-break (keptWords).
 */
export function rangeGainText(range: ChartRange, gain: RangeGain): RangeGainText {
  const money = formatMoney(gain.money, { sign: 'always' });
  const pct = formatPercent(gain.pct, { sign: 'always' });
  const words = RANGE_WORDS[range];
  const figures = `${money} (${pct})`;
  return { money, pct, figures, words, label: `${figures} ${words}`, keptWords: words.replace(/ /g, NBSP) };
}
