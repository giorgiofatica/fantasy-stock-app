/**
 * NYSE market sessions by rule: Monday to Friday minus the full-day closures. The chart's price ladder counts
 * SESSIONS (a stock with no bar on a session takes its previous real close from within PREV_CLOSE_MAX_SESSIONS
 * sessions before it, the way the server does, _shared/week-price.ts), never the dates some other stock happens to
 * have a bar on. The client holds no season-long market calendar (the home read carries the current week's), so the
 * sessions are computed from the exchange's published holiday rules. Pure: no clock, no I/O.
 *
 * Closures covered: New Year's Day (a Saturday 1 Jan is NOT observed on the Friday), Martin Luther King Jr. Day,
 * Presidents Day, Good Friday, Memorial Day, Juneteenth (from 2022), Independence Day, Labor Day, Thanksgiving,
 * Christmas (a weekend one is observed on the nearest weekday), and the unscheduled full-day closures inside the
 * window the app reads (Sandy 2012, the day of mourning for President Bush 2018 and for President Carter 2025).
 * A closure missing here only makes the look-back reach one session further than the server's, never a different
 * price; a stock still needs a REAL close inside it.
 */

const pad = (n: number): string => String(n).padStart(2, '0');
const isoOf = (y: number, m: number, d: number): string => `${y}-${pad(m)}-${pad(d)}`;

/** `date` plus `n` calendar days (YYYY-MM-DD, UTC arithmetic: no time zone, no DST). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 Sunday … 6 Saturday

/** The day of the month of the `n`th `dow` of month `m` (1-12). */
function nthWeekday(y: number, m: number, dow: number, n: number): number {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return 1 + ((dow - first + 7) % 7) + (n - 1) * 7;
}

/** The day of the month of the last `dow` of month `m` (1-12). */
function lastWeekday(y: number, m: number, dow: number): number {
  const end = new Date(Date.UTC(y, m, 0));
  return end.getUTCDate() - ((end.getUTCDay() - dow + 7) % 7);
}

/** Easter Sunday (month, day), the anonymous Gregorian algorithm. */
function easter(y: number): { m: number; d: number } {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const mm = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * mm + 114) / 31);
  const day = ((h + l - 7 * mm + 114) % 31) + 1;
  return { m: month, d: day };
}

/** A fixed-date holiday: Saturday is observed the Friday before, Sunday the Monday after. */
function observed(y: number, m: number, d: number): string {
  const date = isoOf(y, m, d);
  const dow = weekdayOf(date);
  return dow === 6 ? addDays(date, -1) : dow === 0 ? addDays(date, 1) : date;
}

/** Unscheduled full-day closures inside the window the app reads (bars reach back 407 days). */
const UNSCHEDULED_CLOSURES: ReadonlySet<string> = new Set([
  '2012-10-29', '2012-10-30', // Hurricane Sandy: Friday 26 Oct to Wednesday 31 Oct is five calendar days
  '2018-12-05', // National Day of Mourning, President George H. W. Bush
  '2025-01-09', // National Day of Mourning, President Jimmy Carter
]);

const holidayCache = new Map<number, ReadonlySet<string>>();

/** The full-day closures of year `y`, as YYYY-MM-DD. */
export function marketHolidays(y: number): ReadonlySet<string> {
  const cached = holidayCache.get(y);
  if (cached) return cached;
  const set = new Set<string>();
  const newYears = isoOf(y, 1, 1);
  // A Sunday 1 Jan is observed Monday; a Saturday one is NOT observed on the Friday before (31 Dec stays a session).
  set.add(weekdayOf(newYears) === 0 ? isoOf(y, 1, 2) : newYears);
  set.add(isoOf(y, 1, nthWeekday(y, 1, 1, 3))); // Martin Luther King Jr. Day
  set.add(isoOf(y, 2, nthWeekday(y, 2, 1, 3))); // Presidents Day
  const e = easter(y);
  set.add(addDays(isoOf(y, e.m, e.d), -2)); // Good Friday
  set.add(isoOf(y, 5, lastWeekday(y, 5, 1))); // Memorial Day
  if (y >= 2022) set.add(observed(y, 6, 19)); // Juneteenth
  set.add(observed(y, 7, 4)); // Independence Day
  set.add(isoOf(y, 9, nthWeekday(y, 9, 1, 1))); // Labor Day
  set.add(isoOf(y, 11, nthWeekday(y, 11, 4, 4))); // Thanksgiving
  set.add(observed(y, 12, 25)); // Christmas
  for (const d of UNSCHEDULED_CLOSURES) if (d.startsWith(`${y}-`)) set.add(d);
  holidayCache.set(y, set);
  return set;
}

/** Is `date` (YYYY-MM-DD) a market session: a weekday that is not a closure. */
export function isMarketSession(date: string): boolean {
  const dow = weekdayOf(date);
  if (dow === 0 || dow === 6) return false;
  return !marketHolidays(Number(date.slice(0, 4))).has(date);
}

/** The last market session on or before `date` (the date itself when it is one). */
export function sessionOnOrBefore(date: string): string {
  let d = date;
  for (let i = 0; i < 14; i++) {
    if (isMarketSession(d)) return d;
    d = addDays(d, -1);
  }
  return date;
}

/** Up to `n` market sessions strictly before `date`, nearest first. */
export function sessionsBefore(date: string, n: number): string[] {
  const out: string[] = [];
  let d = date;
  for (let guard = 0; out.length < n && guard < n * 4 + 14; guard++) {
    d = addDays(d, -1);
    if (isMarketSession(d)) out.push(d);
  }
  return out;
}
