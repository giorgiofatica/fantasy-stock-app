/**
 * Re-price mode for snapshot-week-start (2026-11-17): repair a week's STARTING
 * prices to the session's official 1Day bar OPEN.
 *
 * WHY. Until the ../_shared/week-price.ts fix, a symbol with no IEX bar at 14:35Z
 * was priced from its latest quote, ASK first. On Mon 2026-11-16 that stored TM,
 * AVAL, BCH, KB and others 13-17% away from the market. By the next day the
 * session's IEX 1Day bar is complete for every symbol that traded on IEX that
 * day, and its open is a real trade, so it is the price the row should have had.
 *
 * WHY HERE, NOT A NEW FUNCTION OR A SQL FUNCTION. The Alpaca key lives only in
 * the edge-function secrets, so a SQL function cannot read the bar. A one-off
 * function would be a new deploy surface with its own auth to get right. This
 * mode reuses everything snapshot-week-start already has and has proven: the
 * constant-time cron-key gate (checked BEFORE the body is read), the market
 * calendar, planWeekWindow (which gives each league-week's real open session),
 * selectTargetWeeks, and the shared price fetch with `live: null` (bar or
 * nothing: never a trade or a quote).
 *
 * SAFETY PROPERTIES (each is tested in reprice.test.ts):
 *  - OFF unless asked: the cron and its retries post `{}`, which is the normal
 *    run. Only `mode: "reprice_week_start"` reaches this code. Any other
 *    non-empty body (bad JSON, a non-object, a missing or unknown mode, an
 *    unknown key) is refused (400), never run as the normal job.
 *  - DRY RUN BY DEFAULT: only `dry_run: false` (the boolean) writes. A missing,
 *    `true`, or any other value reports and writes nothing.
 *  - EXPLICIT SESSION: `session_date` is required, and only league-weeks whose
 *    real open session IS that date are touched. Run late, after the next week
 *    has opened, it finds nothing rather than re-pricing the wrong week.
 *  - SCOPE: only that week's rows with entered_mid_week = false. A mid-week
 *    row's week_start_price is a purchase price, not an open, and is never read
 *    for writing.
 *  - NEVER A CLOSED WEEK: a league-week with ANY week_end_price is skipped whole,
 *    and so is any league-week whose real close has passed. Re-basing a closed
 *    week would pair a new start with an old end.
 *  - NEVER ZERO OR NULL: a row is written only with a positive bar open. A
 *    symbol with no bar is reported (`no_bar`) and its row is left as it is.
 *  - IDEMPOTENT: a row whose price already equals the open (at the column's 4 dp)
 *    is `unchanged`; a second run writes nothing. Each write is also guarded on
 *    the old price, mid-week flag and NULL end price, so a row that changed
 *    between the read and the write is reported `conflict`, not overwritten.
 *  - NO STATUS WRITE: this mode never touches cron_job_status, so it cannot
 *    overwrite the real job's evidence for the day.
 */

import type { WeekPrices } from '../_shared/week-price.ts';

export const REPRICE_MODE = 'reprice_week_start';

export interface RepriceRequest {
  sessionDate: string;
  /** True unless the caller sent the boolean `false`. */
  dryRun: boolean;
  /** Restrict to these leagues, or null for every in-season league. */
  leagueIds: string[] | null;
}

export type ParsedRepriceBody =
  | { kind: 'none' }
  | { kind: 'reprice'; request: RepriceRequest }
  | { kind: 'invalid'; error: string };

/**
 * Decide what a request body asks for, from its RAW text. PURE.
 * STRICT on purpose (review, 2026-11-17): the cron and its retries post exactly
 * `{}`, so only an empty body or an object with NO keys is the normal run. A
 * body that does not parse, is not an object, or carries any key without a
 * valid `mode` is refused (400). A typo in a hand-sent dry run must never fall
 * through to the real, writing job.
 */
export function parseRepriceBody(text: string): ParsedRepriceBody {
  if (text.trim().length === 0) return { kind: 'none' };
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { kind: 'invalid', error: 'body is not JSON' };
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return { kind: 'invalid', error: 'body must be an object' };
  const b = body as Record<string, unknown>;
  if (Object.keys(b).length === 0) return { kind: 'none' };
  if (b.mode !== REPRICE_MODE) return { kind: 'invalid', error: 'unknown or missing mode' };
  const sessionDate = b.session_date;
  if (typeof sessionDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate) || !Number.isFinite(Date.parse(`${sessionDate}T00:00:00Z`))) {
    return { kind: 'invalid', error: 'session_date (YYYY-MM-DD) is required' };
  }
  const unknownKeys = Object.keys(b).filter((k) => !['mode', 'session_date', 'dry_run', 'league_ids'].includes(k));
  if (unknownKeys.length > 0) return { kind: 'invalid', error: `unknown key(s): ${unknownKeys.join(', ')}` };
  let leagueIds: string[] | null = null;
  if (b.league_ids !== undefined && b.league_ids !== null) {
    if (!Array.isArray(b.league_ids) || b.league_ids.length === 0 || !b.league_ids.every((x) => typeof x === 'string' && x.length > 0)) {
      return { kind: 'invalid', error: 'league_ids must be a non-empty array of strings' };
    }
    leagueIds = b.league_ids as string[];
  }
  return { kind: 'reprice', request: { sessionDate, dryRun: b.dry_run !== false, leagueIds } };
}

/** week_snapshots.week_start_price is numeric(12,4). */
export function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export interface SnapshotPriceRow {
  id: string;
  league_id: string;
  user_id: string;
  symbol: string;
  week_number: number;
  week_start_price: number | string | null;
  entered_mid_week: boolean | null;
  week_end_price: number | string | null;
}

export type RepriceAction = 'reprice' | 'unchanged' | 'no_bar';

export interface RepriceItem {
  id: string;
  league_id: string;
  week_number: number;
  user_id: string;
  symbol: string;
  old_price: number;
  new_price: number | null;
  source: 'bar_open' | null;
  action: RepriceAction;
}

export type LeagueWeekGate =
  | { ok: true }
  | { ok: false; reason: 'end_priced' | 'mid_week_only' | 'no_rows' };

/**
 * Whether a league-week may be re-priced at all. ANY end price means the week
 * is closed (or being closed): skip it whole, never part of it. PURE.
 */
export function gateLeagueWeek(rows: ReadonlyArray<SnapshotPriceRow>): LeagueWeekGate {
  if (rows.length === 0) return { ok: false, reason: 'no_rows' };
  if (rows.some((r) => r.week_end_price !== null && r.week_end_price !== undefined)) return { ok: false, reason: 'end_priced' };
  if (!rows.some((r) => r.entered_mid_week !== true)) return { ok: false, reason: 'mid_week_only' };
  return { ok: true };
}

/**
 * One item per non-mid-week row: what the run would do to it. Only bar opens
 * are used (`opens` comes from a `live: null` fetch), and only a positive one.
 * PURE.
 */
export function planRepriceRows(
  rows: ReadonlyArray<SnapshotPriceRow>,
  opens: ReadonlyMap<string, number>,
): RepriceItem[] {
  const items: RepriceItem[] = [];
  for (const r of rows) {
    if (r.entered_mid_week === true) continue; // a purchase price, never re-based
    const oldPrice = Number(r.week_start_price);
    const sym = String(r.symbol).toUpperCase();
    const open = opens.get(sym);
    const base = { id: r.id, league_id: r.league_id, week_number: r.week_number, user_id: r.user_id, symbol: sym, old_price: oldPrice };
    if (open === undefined || !Number.isFinite(open) || round4(open) <= 0) {
      items.push({ ...base, new_price: null, source: null, action: 'no_bar' });
      continue;
    }
    const newPrice = round4(open);
    const same = Number.isFinite(oldPrice) && Math.abs(round4(oldPrice) - newPrice) < 0.00005;
    items.push({ ...base, new_price: newPrice, source: 'bar_open', action: same ? 'unchanged' : 'reprice' });
  }
  return items;
}

/** Bar opens only: the `prices` of a fetch whose every source is 'bar_open'. PURE. */
export function barOpensOnly(p: WeekPrices): Map<string, number> {
  const out = new Map<string, number>();
  for (const [s, price] of p.prices) if (p.sources.get(s) === 'bar_open') out.set(s, price);
  return out;
}

/** The narrow write the real run makes per row; injected so the guard is testable. */
export type GuardedWrite = (item: RepriceItem) => Promise<'repriced' | 'conflict' | 'write_error'>;

/**
 * Apply the `reprice` items. Each write is guarded on the row still being what
 * was planned from (see the supabase implementation in index.ts). Never writes
 * a non-`reprice` item, never a null or non-positive price.
 */
export async function applyReprice(
  items: ReadonlyArray<RepriceItem>,
  write: GuardedWrite,
): Promise<Map<string, 'repriced' | 'conflict' | 'write_error'>> {
  const out = new Map<string, 'repriced' | 'conflict' | 'write_error'>();
  for (const it of items) {
    if (it.action !== 'reprice' || it.new_price === null || !(it.new_price > 0)) continue;
    out.set(it.id, await write(it));
  }
  return out;
}
