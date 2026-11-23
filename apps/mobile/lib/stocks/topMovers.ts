/**
 * topMovers: the "Top movers" chip's rules, pure (docs/plans/2026-11-18-stocks-tab.md, Part 3, "Top movers: how it works", and
 * "Settled during the build" point 8; board `#call-stocks-tab-lists`, section 6). No React Native, no network: tests-deno pins
 * every rule.
 *
 * WHAT THE READ IS. `get_league_top_movers(p_league_id)` (20261210000000): signed-in league members only, at most 25 rows, the
 * biggest move first (up OR down), each row `place, symbol, name, category_ids, ranked_at`. NO price and NO change: a row takes
 * its price and "+11.2% today" from the live lookup (rowQuotes.ts), so the ORDER may be minutes old and the numbers are current.
 * The server paces it (PT429); the app words a refusal like any read that did not load.
 *
 * THE FOUR READINGS (plan point 8, all accepted):
 *   an EMPTY reply            "Stocks didn't load", with Try again. Zero rows carry no ranking time, so the app cannot tell "no
 *                             ranking was ever written" from "this league owns every ranked stock"; both mean there is nothing
 *                             to show.
 *   a refusal or PT429        the same words. No new copy.
 *   an OLD ranking, open      "Stocks didn't load". While the market is open the job re-ranks every 5 minutes, so a ranking more
 *                             than 20 minutes old is not shown as current. A market we cannot read (unknown, or not read yet) is
 *                             treated as open: the conservative reading never shows an old ranking as current.
 *   a ranking, closed         shown ONLY if it was made during the MOST RECENT trading session, judged by the market calendar the
 *                             app already reads (the Planner, 2026-11-23); any older ranking, a ranking with no readable time, and a
 *                             calendar that cannot name the last session are "Stocks didn't load". No line of its own (the board:
 *                             "Top movers while the market is closed takes no extra line; the day goes on the figure": "+11.2% Fri"),
 *                             and that day is the most recent SESSION's, never the weekday of the ranking's own time.
 */
import { etWallClockToUtcIso, type MarketCalendarSession } from '../time/marketWeek';
import { shortWeekdayEt } from './rowQuotes';
import type { ListRow } from './stocksList';

/** A ranking older than this, while the market is open, is not shown as current (the plan: 20 minutes). */
export const MOVERS_MAX_AGE_MS = 20 * 60 * 1000;
/** The chip's id in the chip row. A category id is a uuid, so this can never be one. */
export const TOP_MOVERS_CHIP_ID = '__top_movers__';
/** The chip's label: approved by Giorgio, 2026-11-22 ("yes to all the words"). */
export const TOP_MOVERS_LABEL = 'Top movers';
/** The server's own cap (get_league_top_movers): the chip never shows more. */
export const MOVERS_MAX_ROWS = 25;

/** The ranking as the server answered it: the rows in the server's order, and the time of the ranking (ms), or null if none parses. */
export interface MoversRead {
  rows: ListRow[];
  rankedAt: number | null;
}

/** The read's arguments. */
export function moversArgs(leagueId: string): { p_league_id: string } {
  return { p_league_id: leagueId };
}

/**
 * The answer's `data` as a ranking. Anything that is not an array is NOT a ranking (null): the caller treats it as a failed read,
 * never as "no movers". The server's order is the order shown (never re-sorted here: the app has no change to sort by). A row
 * without a usable ticker is left out, and a ticker named twice is shown once, at its first place. The ranking's time is the NEWEST
 * `ranked_at` on any row (they all carry the run's time; the newest is the least likely to mislabel a fresh ranking as old).
 */
export function parseMovers(data: unknown): MoversRead | null {
  if (!Array.isArray(data)) return null;
  const rows: ListRow[] = [];
  const seen = new Set<string>();
  let rankedAt: number | null = null;
  for (const raw of data) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as { symbol?: unknown; name?: unknown; category_ids?: unknown; ranked_at?: unknown };
    if (typeof r.symbol !== 'string' || r.symbol.trim() === '') continue;
    const symbol = r.symbol.trim().toUpperCase();
    if (typeof r.ranked_at === 'string') {
      const t = Date.parse(r.ranked_at);
      if (Number.isFinite(t) && (rankedAt === null || t > rankedAt)) rankedAt = t;
    }
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    rows.push({
      symbol,
      name: typeof r.name === 'string' ? r.name.trim() : '',
      categoryIds: Array.isArray(r.category_ids) ? r.category_ids.filter((c): c is string => typeof c === 'string') : [],
    });
  }
  return { rows: rows.slice(0, MOVERS_MAX_ROWS), rankedAt };
}

/** A refusal or a transport error, PT429 included, or an answer that is not a list: a read that did not load. */
export function isFailedMoversRead(result: { data: unknown; error: unknown }): boolean {
  return !!result.error || parseMovers(result.data) === null;
}

/** The most recent trading session at or before `now`: its ET date, and its open and close as instants (ms). */
export interface LastSession {
  sessionDate: string;
  openMs: number;
  closeMs: number;
  /** The close as an ISO instant: what the day word on a figure is named from (rowQuotes.ts shortWeekdayEt). */
  closeIso: string;
}

/**
 * The most recent session whose CLOSE is at or before `now`, from the app's own market calendar (market_calendar, read by
 * LeagueContext). Null when no session qualifies (an empty calendar, a failed read, a calendar that starts later) or its times do not
 * parse: the caller then cannot name the last session, and a closed market shows "didn't load" rather than guess a number of days.
 */
export function lastSessionBefore(now: Date, sessions: readonly MarketCalendarSession[]): LastSession | null {
  const nowMs = now.getTime();
  let best: LastSession | null = null;
  for (const s of sessions) {
    // A malformed row makes the time helper throw (Intl: Invalid time value): it names no session, and must not take the screen down.
    let closeIso: string | null;
    let openIso: string | null;
    try {
      closeIso = etWallClockToUtcIso(s.sessionDate, s.closeEt);
      openIso = etWallClockToUtcIso(s.sessionDate, s.openEt);
    } catch {
      continue;
    }
    if (!closeIso || !openIso) continue;
    const closeMs = Date.parse(closeIso);
    const openMs = Date.parse(openIso);
    if (!Number.isFinite(closeMs) || !Number.isFinite(openMs) || closeMs > nowMs) continue;
    if (!best || closeMs > best.closeMs) best = { sessionDate: s.sessionDate, openMs, closeMs, closeIso };
  }
  return best;
}

/** The short weekday ("Fri") a figure is labelled with while the market is closed: the last SESSION's day, null when unknown. */
export function lastSessionDayWord(session: LastSession | null): string | null {
  return session ? shortWeekdayEt(session.closeIso) : null;
}

/** True when the ranking has a readable time no more than MOVERS_MAX_AGE_MS old (a time in the future, from a skewed clock, counts as fresh). */
export function rankingIsFresh(read: MoversRead | null, nowMs: number): boolean {
  return !!read && read.rankedAt !== null && nowMs - read.rankedAt <= MOVERS_MAX_AGE_MS;
}

/** What the chip draws once a read has landed: the rows, or the existing "didn't load" state. */
export type MoversVerdict = { kind: 'rows'; rows: ListRow[] } | { kind: 'failed' };

/**
 * The one decision. `marketClosed` is true ONLY when the market is known to be closed (the caller passes false for open, unknown
 * and not-yet-read). Empty is always "didn't load". While the market is not known to be closed, a ranking with no readable time,
 * or one older than MOVERS_MAX_AGE_MS, is "didn't load"; a ranking dated in the future (a skewed clock) counts as fresh.
 * While it IS closed, `lastSession` (lastSessionBefore) decides: the ranking shows only if its time is at or after that session's
 * OPEN (a ranking is made while the market is open, so one at or after the last open was made in the last session or since); no
 * readable time, an older one, or no known last session is "didn't load".
 */
export function moversVerdict(read: MoversRead | null, marketClosed: boolean, nowMs: number, lastSession: LastSession | null = null): MoversVerdict {
  if (!read || read.rows.length === 0) return { kind: 'failed' };
  if (marketClosed) {
    return lastSession && read.rankedAt !== null && read.rankedAt >= lastSession.openMs ? { kind: 'rows', rows: read.rows } : { kind: 'failed' };
  }
  return rankingIsFresh(read, nowMs) ? { kind: 'rows', rows: read.rows } : { kind: 'failed' };
}

/** The chip row with "Top movers" right after "All" (the board's order: search, All, Top movers, then the categories). */
export function chipsWithMovers<T extends { categoryId: string | null; label: string }>(chips: readonly T[]): { categoryId: string | null; label: string }[] {
  const out: { categoryId: string | null; label: string }[] = [];
  let placed = false;
  for (const c of chips) {
    out.push(c);
    if (!placed && c.categoryId === null) {
      out.push({ categoryId: TOP_MOVERS_CHIP_ID, label: TOP_MOVERS_LABEL });
      placed = true;
    }
  }
  if (!placed) out.unshift({ categoryId: TOP_MOVERS_CHIP_ID, label: TOP_MOVERS_LABEL });
  return out;
}

/** The chip that reads as selected: Top movers while it is on, else the list's category (null: All). */
export function selectedChipId(moversOn: boolean, categoryId: string | null): string | null {
  return moversOn ? TOP_MOVERS_CHIP_ID : categoryId;
}

/** What VoiceOver reads for a mover's row: ticker, company, price, change in words. Never a dash, never a glyph. */
export function moverLabel(symbol: string, name: string, priceText: string, noPriceText: string, changeWords: string | null): string {
  return [symbol, name || null, priceText === noPriceText ? 'price unavailable' : priceText, changeWords].filter(Boolean).join(', ');
}
