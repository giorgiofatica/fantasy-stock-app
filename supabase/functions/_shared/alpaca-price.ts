/**
 * App-key latest-price fetch for simulator fills (Phase 3, DR-001).
 *
 * One fallback chain on the app-wide ALPACA_API_KEY (no per-user credentials),
 * shared by every place a player PAYS a price (record-trade, validate-and-record-
 * pick, the draft auto-pick) and every place the in-app quote is SHOWN (quote,
 * ticker-quotes; 2026-11-17, so the number a player sees is the number a fill
 * would use). quote / ticker-quotes keep their own prevClose / changePercent and
 * caches; only the price chain is this module's.
 *
 * THE CHAIN. The first stage that yields a price wins:
 *   1. the latest trade ('trade.p')
 *   2. the latest bar's close ('bar.c')
 *   3. the bid/ask MIDPOINT ('quote.mid'), only when it is sane: both sides with
 *      size, not crossed, spread at most MAX_MID_SPREAD_FRACTION. The same test
 *      as week-price.ts midpointPrice (imported, not copied).
 *   4. the most recent real daily close ('bar1d.c'): the latest 1Day bar's `c`
 *      within FILL_CLOSE_LOOKBACK_DAYS.
 *   Otherwise price null: the callers' existing "no_price" refusal.
 * A bid alone or an ask alone is NEVER a price (2026-11-17: the week-start
 * snapshot stored TM's lone IEX ask, 247.75 against ~212; an offer nobody
 * traded at). Stages 1 and 2 have no time window: that is HELD for a Giorgio
 * ruling, so stage 3 passes an open window too.
 *
 * "Market-hours handling can be 'last available quote' for launch" (spec):
 * outside market hours the latest trade/bar is simply the last session's —
 * no market-hours gate here by design. (2026-09-30: record-trade itself now
 * refuses off-hours buys/sells before it ever calls this — see
 * ./market-hours.ts — so this module's "last available quote" behavior is
 * exercised only by preview, which has no gate. This function's own
 * contract is unchanged.)
 */

import { MAX_MID_SPREAD_FRACTION, midpointPrice } from './week-price.ts';

const BASE = 'https://data.alpaca.markets/v2';
const FEED_QS = '?feed=iex';

/** Per-request timeout (2026-10-13): a hung Alpaca request must not hold an edge
 * invocation (or a draft turn) open. A timeout rejects like a network error. */
export const ALPACA_TIMEOUT_MS = 5_000;

async function alpacaGet(url: string, key: string, secret: string) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(ALPACA_TIMEOUT_MS),
    headers: {
      'APCA-API-KEY-ID': key,
      'APCA-API-SECRET-KEY': secret,
      'Accept': 'application/json',
    },
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    return { ok: false as const, status: res.status, preview: text.slice(0, 400) };
  }
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = {};
  }
  return { ok: true as const, status: res.status, body: body as Record<string, unknown> };
}

export interface FillPrice {
  price: number | null;
  source: string;
  error?: { step: string; status: number } | null;
}

/** One fallback stage. A network error or the ALPACA_TIMEOUT_MS abort is that
 * STAGE failing (status 0), never an exception out of fetchFillPrice (review L5,
 * 2026-10-13): the chain moves on to the next stage, and if every stage fails the
 * caller gets price null, its existing "no price" path, not a 500. */
async function stage(url: string, key: string, secret: string) {
  try {
    return await alpacaGet(url, key, secret);
  } catch (e) {
    console.error('alpaca stage failed', String(e).slice(0, 120));
    return { ok: false as const, status: 0, preview: '' };
  }
}

/** How far back stage 4 looks for a daily close, in calendar days: two trading
 * weeks' worth of calendar, so a long weekend plus a holiday still leaves a
 * week of sessions (the same reach as the mobile price reads' bars). */
export const FILL_CLOSE_LOOKBACK_DAYS = 10;

/** The look-back's first date (YYYY-MM-DD, UTC) for `now`. PURE. */
export function fillCloseStart(now: Date): string {
  return new Date(now.getTime() - FILL_CLOSE_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Stage 4: the close of the LATEST-dated 1Day bar on or after `startDate`, or
 * null. A bar with no readable date, a date before the look-back, or no positive
 * close is skipped, never guessed; the order Alpaca returns them in does not
 * matter. PURE.
 */
export function latestDailyClose(bars: unknown, startDate: string): number | null {
  if (!Array.isArray(bars)) return null;
  let best: { ms: number; c: number } | null = null;
  for (const b of bars) {
    if (!b || typeof b !== 'object') continue;
    const bar = b as Record<string, unknown>;
    const ms = typeof bar.t === 'string' ? Date.parse(bar.t) : NaN;
    const c = Number(bar.c);
    if (!Number.isFinite(ms) || !Number.isFinite(c) || c <= 0) continue;
    if (new Date(ms).toISOString().slice(0, 10) < startDate) continue;
    if (best === null || ms > best.ms) best = { ms, c };
  }
  return best ? best.c : null;
}

/** Latest usable price for one symbol (the chain in the file doc), or price:null. */
export async function fetchFillPrice(
  symbol: string,
  key: string,
  secret: string,
  now: Date = new Date(),
): Promise<FillPrice> {
  const sym = encodeURIComponent(symbol.toUpperCase());
  let lastErr: { step: string; status: number } | null = null;

  // 1) latest trade — most reliable in the IEX feed
  {
    const r = await stage(`${BASE}/stocks/${sym}/trades/latest${FEED_QS}`, key, secret);
    if (r.ok) {
      const p = Number((r.body?.trade as Record<string, unknown>)?.p);
      if (Number.isFinite(p) && p > 0) return { price: p, source: 'trade.p' };
    } else {
      lastErr = { step: 'trade', status: r.status };
    }
  }

  // 2) latest bar close
  {
    const r = await stage(`${BASE}/stocks/${sym}/bars/latest${FEED_QS}`, key, secret);
    if (r.ok) {
      const c = Number((r.body?.bar as Record<string, unknown>)?.c);
      if (Number.isFinite(c) && c > 0) return { price: c, source: 'bar.c' };
    } else {
      lastErr = { step: 'bar', status: r.status };
    }
  }

  // 3) a sane two-sided midpoint. Never one side alone (file doc).
  {
    const r = await stage(`${BASE}/stocks/${sym}/quotes/latest${FEED_QS}`, key, secret);
    if (r.ok) {
      const m = midpointPrice(r.body?.quote, {}, MAX_MID_SPREAD_FRACTION);
      if (m && 'price' in m) return { price: m.price, source: 'quote.mid' };
    } else {
      lastErr = { step: 'quote', status: r.status };
    }
  }

  // 4) the most recent real daily close
  {
    const start = fillCloseStart(now);
    const r = await stage(`${BASE}/stocks/${sym}/bars${FEED_QS}&timeframe=1Day&start=${start}`, key, secret);
    if (r.ok) {
      const c = latestDailyClose(r.body?.bars, start);
      if (c !== null) return { price: c, source: 'bar1d.c' };
    } else {
      lastErr = { step: 'close', status: r.status };
    }
  }

  return { price: null, source: '', error: lastErr };
}

/**
 * The auto-pick SCREEN's prices out of one /v2/stocks/snapshots body (2026-10-13).
 * The same two sources fetchFillPrice tries first, in the same order: the latest
 * trade, then the latest minute bar's close. A symbol with neither (only a quote,
 * or no data) is left out, so the caller prices it with fetchFillPrice instead.
 * PURE.
 */
export function parseSnapshotPrices(body: unknown, symbols: string[]): Map<string, number> {
  const out = new Map<string, number>();
  if (!body || typeof body !== 'object') return out;
  const rows = body as Record<string, unknown>;
  for (const sym of symbols) {
    const snap = rows[sym] as Record<string, unknown> | null | undefined;
    if (!snap || typeof snap !== 'object') continue;
    const trade = Number((snap.latestTrade as Record<string, unknown> | undefined)?.p);
    const bar = Number((snap.minuteBar as Record<string, unknown> | undefined)?.c);
    const p = Number.isFinite(trade) && trade > 0 ? trade : Number.isFinite(bar) && bar > 0 ? bar : null;
    if (p != null) out.set(sym, p);
  }
  return out;
}

/**
 * ONE multi-symbol snapshots request (IEX feed, the app key). The endpoint is
 * all-or-nothing: one symbol Alpaca does not list 400s the whole request, so the
 * caller bisects (./price-bisect.ts fetchPricesBisecting). Network
 * errors propagate.
 */
export async function fetchSnapshotPrices(
  symbols: string[],
  key: string,
  secret: string,
): Promise<{ ok: true; prices: Map<string, number> } | { ok: false; status: number }> {
  const syms = symbols.map((s) => s.toUpperCase());
  const r = await alpacaGet(`${BASE}/stocks/snapshots?symbols=${syms.map(encodeURIComponent).join(',')}&feed=iex`, key, secret);
  if (!r.ok) return { ok: false, status: r.status };
  return { ok: true, prices: parseSnapshotPrices(r.body, syms) };
}
