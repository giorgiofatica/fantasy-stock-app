/**
 * The ONE price rule for a week snapshot or a score: "the price of this symbol at
 * time T" (2026-11-17).
 *
 * WHY THIS EXISTS. snapshot-week-start, snapshot-week-end and process-week-results
 * each carried their own copy of the same fallback: when Alpaca had no 1Day bar
 * for a symbol yet, they read /stocks/quotes/latest and took
 * `Number(quote.ap) || Number(quote.bp)`, the ASK first. The week-start job runs
 * at 14:35Z, five minutes after the open, so a thinly traded name (a foreign ADR)
 * with no IEX trade yet took that fallback, and its IEX ask could sit far from
 * the market. Prod, Mon 2026-11-16: TM was stored at 247.75 against a market of
 * ~212 (+16.6%), AVAL +14.6%, BCH +13.0%; KB got three different "opens"
 * (120.18 / 120.03 / 120.02) in three leagues a second apart, which only a live
 * quote can do. A one-sided quote is an offer, not a price: nobody traded there.
 *
 * THE RULE, in order. The first step that yields a price wins:
 *   1. The official bar: the session's 1Day bar, its OPEN for a week start and
 *      its CLOSE for a week end. (process-week-results asks for no bar: its
 *      fallback scorer wants the price now.)
 *   2. The LAST TRADE (/stocks/trades/latest): a real execution, and only one
 *      that happened inside the caller's time window (see PriceWindow).
 *   3. The bid/ask MIDPOINT, only when BOTH sides exist with size, the quote is
 *      not crossed, it is inside the window, and the spread is at most
 *      MAX_MID_SPREAD_FRACTION of the midpoint.
 *   4. Otherwise NO price. The symbol is reported in `unpriced` and the caller
 *      writes nothing for it, so its existing all-or-nothing gate aborts the
 *      league and the retry / heal path prices it later. Never a guess.
 * An ask alone or a bid alone is NEVER a price, at any step.
 *
 * THE SPREAD BAND (2%). Whatever the market's real price is inside a two-sided
 * quote, the midpoint is at most half the spread away from it, so a 2% band
 * bounds the midpoint's error at 1%. The bad prices above were 13-17% off, an
 * order of magnitude outside that. A liquid name's IEX spread is a few basis
 * points, so the band refuses only quotes that are too thin to trust, and a
 * refusal costs a retry, not a wrong score. IEX quotes are IEX's own book, not the
 * NBBO; a narrow two-sided IEX book still brackets the market, because an IEX
 * side through the market would be traded against at once.
 *
 * THE TIME WINDOW. A "latest" trade or quote is the latest EVER, not the latest
 * today: for a name that has not traded on IEX this session it is Friday's, or
 * last month's. Labelling that the week's open would be the same mislabel the
 * functions already refuse for a past session's bar. So steps 2 and 3 accept a
 * trade or quote only if its timestamp lies inside the caller's window (week
 * start: this session's open .. now; week end: the close session's open .. its
 * close). A caller that passes `live: null` (a historical session) gets the bar
 * or nothing, exactly as before.
 *
 * Which step priced each symbol is returned in `sources`. There is no column for
 * it on week_snapshots (adding one is a schema change, not made here), so the
 * callers log it.
 */

const ALPACA_BASE = 'https://data.alpaca.markets/v2';

/** Widest bid/ask spread, as a fraction of the midpoint, that a midpoint may price. See the file doc. */
export const MAX_MID_SPREAD_FRACTION = 0.02;

/** Slack on a live window's upper bound for a trade stamped slightly ahead of this host's clock. */
export const CLOCK_SKEW_MS = 5_000;

/** Per-request timeout: a hung Alpaca request must not hold a cron invocation open. */
export const WEEK_PRICE_TIMEOUT_MS = 10_000;

/** Symbols per Alpaca request (keeps URLs bounded; the endpoints take comma lists). */
export const WEEK_PRICE_CHUNK = 100;

/** A guard against an Alpaca pagination loop that never ends. */
const MAX_BAR_PAGES = 20;

export type PriceSource = 'bar_open' | 'bar_close' | 'last_trade' | 'midpoint';

/** Why a symbol got no price (logged, never written). */
export type UnpricedReason =
  | 'no_bar_no_live'   // no bar, and the caller asked for no live fallback
  | 'bar_fetch_failed' // the bar request for this symbol failed: retry, never a live price instead
  | 'no_data'          // no bar, no trade, no quote
  | 'stale_trade'      // a trade exists but outside the window
  | 'stale_quote'      // a quote exists but outside the window
  | 'ask_only'         // a quote with no usable bid
  | 'bid_only'         // a quote with no usable ask
  | 'crossed'          // ask below bid
  | 'wide_spread';     // spread above MAX_MID_SPREAD_FRACTION

/**
 * Inclusive bounds, in epoch ms, on a trade's or quote's timestamp. An omitted
 * bound is open. `{}` accepts any time (process-week-results' "price now").
 */
export interface PriceWindow {
  fromMs?: number;
  toMs?: number;
}

/**
 * The live-fallback window for a session, or null when that session is not
 * today (UTC date, as both snapshot functions have always compared it). A
 * "latest" trade or quote reflects now, so a past session gets the bar or
 * nothing; the window bounds also refuse anything stale on its own. PURE.
 */
export function liveWindowFor(sessionDate: string, now: Date, fromMs: number, toMs: number): PriceWindow | null {
  if (sessionDate !== now.toISOString().slice(0, 10)) return null;
  return { fromMs, toMs };
}

export type ResolvedPrice =
  | { price: number; source: PriceSource }
  | { price: null; reason: UnpricedReason };

const positive = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Alpaca's RFC 3339 timestamps (nanosecond fractions included) to epoch ms, or null. */
export function alpacaTimeMs(t: unknown): number | null {
  if (typeof t !== 'string' || t.length === 0) return null;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

function inWindow(t: unknown, window: PriceWindow): boolean {
  const ms = alpacaTimeMs(t);
  if (ms === null) return false; // an undated trade or quote cannot be placed in time
  if (window.fromMs !== undefined && ms < window.fromMs) return false;
  if (window.toMs !== undefined && ms > window.toMs) return false;
  return true;
}

/** The session's bar price: the LAST bar's open ('o') or close ('c'). PURE. */
export function barPrice(bars: unknown, field: 'o' | 'c'): number | null {
  if (!Array.isArray(bars) || bars.length === 0) return null;
  const last = bars[bars.length - 1] as Record<string, unknown> | null;
  return last ? positive(last[field]) : null;
}

/** A trade's price if it is a real execution inside the window, else why not. PURE. */
export function tradePrice(trade: unknown, window: PriceWindow): number | 'stale' | null {
  if (!trade || typeof trade !== 'object') return null;
  const t = trade as Record<string, unknown>;
  const p = positive(t.p);
  if (p === null) return null;
  return inWindow(t.t, window) ? p : 'stale';
}

/**
 * A quote's midpoint, or the reason it cannot price. PURE. Both sides must exist
 * with a positive price (and a positive size when Alpaca reports one), the quote
 * must not be crossed, it must lie in the window, and the spread must be within
 * MAX_MID_SPREAD_FRACTION of the midpoint.
 */
export function midpointPrice(
  quote: unknown,
  window: PriceWindow,
  maxSpreadFraction = MAX_MID_SPREAD_FRACTION,
): { price: number } | { reason: UnpricedReason } | null {
  if (!quote || typeof quote !== 'object') return null;
  const q = quote as Record<string, unknown>;
  const sideOk = (price: unknown, size: unknown) =>
    positive(price) !== null && (size === undefined || size === null || positive(size) !== null);
  const bidOk = sideOk(q.bp, q.bs);
  const askOk = sideOk(q.ap, q.as);
  if (!bidOk && !askOk) return null;
  if (!bidOk) return { reason: 'ask_only' };
  if (!askOk) return { reason: 'bid_only' };
  if (!inWindow(q.t, window)) return { reason: 'stale_quote' };
  const bid = Number(q.bp);
  const ask = Number(q.ap);
  if (ask < bid) return { reason: 'crossed' };
  const mid = (bid + ask) / 2;
  if ((ask - bid) / mid > maxSpreadFraction) return { reason: 'wide_spread' };
  return { price: mid };
}

/**
 * Apply the rule to one symbol's inputs. PURE: this is the whole decision, and
 * the hermetic tests drive it directly.
 *  - `bar`: the session bar's price (barPrice), or null.
 *  - `barSource`: what that bar price is ('bar_open' / 'bar_close').
 *  - `live`: null for "bar or nothing" (a historical session). Otherwise the
 *    window the trade / quote must lie in, and the raw trade / quote objects.
 */
export function resolvePrice(input: {
  bar: number | null;
  barSource: 'bar_open' | 'bar_close' | null;
  live: { window: PriceWindow; trade: unknown; quote: unknown } | null;
}): ResolvedPrice {
  if (input.bar !== null && input.barSource !== null) {
    return { price: input.bar, source: input.barSource };
  }
  if (input.live === null) return { price: null, reason: 'no_bar_no_live' };

  const { window, trade, quote } = input.live;
  const t = tradePrice(trade, window);
  if (typeof t === 'number') return { price: t, source: 'last_trade' };

  const m = midpointPrice(quote, window);
  if (m && 'price' in m) return { price: m.price, source: 'midpoint' };

  // No price. Report the most specific reason: a quote's defect beats a stale
  // trade (the quote was the last thing tried), and a stale trade beats nothing.
  if (m && 'reason' in m) return { price: null, reason: m.reason };
  if (t === 'stale') return { price: null, reason: 'stale_trade' };
  return { price: null, reason: 'no_data' };
}

// ── IO ──────────────────────────────────────────────────────────────────────

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export interface WeekPriceRequest {
  symbols: string[];
  /** The session bar to read first, or null for none (process-week-results). */
  bar: { sessionDate: string; field: 'o' | 'c' } | null;
  /** The live fallback window, or null for "bar or nothing". */
  live: PriceWindow | null;
}

export interface WeekPrices {
  /** symbol (upper case) -> price. Only priced symbols appear. */
  prices: Map<string, number>;
  /** symbol -> which step priced it. Same keys as `prices`. */
  sources: Map<string, PriceSource>;
  /** symbol -> why it has no price. Every requested symbol is in `prices` or here. */
  unpriced: Map<string, UnpricedReason>;
  /** Alpaca request failures (status or exception), for the log. */
  errors: string[];
}

function chunks<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

async function getJson(
  fetchFn: FetchFn,
  url: string,
  key: string,
  secret: string,
  errors: string[],
  label: string,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetchFn(url, {
      signal: AbortSignal.timeout(WEEK_PRICE_TIMEOUT_MS),
      headers: {
        'APCA-API-KEY-ID': key,
        'APCA-API-SECRET-KEY': secret,
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      errors.push(`${label} ${res.status} ${body.slice(0, 160)}`);
      return null;
    }
    const data = await res.json();
    return data && typeof data === 'object' ? data as Record<string, unknown> : null;
  } catch (e) {
    errors.push(`${label} error ${String(e).slice(0, 160)}`);
    return null;
  }
}

/**
 * symbol -> bars, following next_page_token, plus every symbol whose bar request
 * FAILED (any page of its chunk errored, or the page cap was hit). A failed bar
 * request is not "no bar": the bar may well exist, so those symbols must not
 * fall through to a live trade or quote (review, 2026-11-17). They stay unpriced
 * and the league retries.
 */
async function fetchBars(
  fetchFn: FetchFn, symbols: string[], sessionDate: string, key: string, secret: string, errors: string[],
): Promise<{ bars: Map<string, unknown>; failed: Set<string> }> {
  const out = new Map<string, unknown>();
  const failed = new Set<string>();
  for (const group of chunks(symbols, WEEK_PRICE_CHUNK)) {
    let pageToken: string | null = null;
    let complete = false;
    for (let page = 0; page < MAX_BAR_PAGES; page++) {
      const url = `${ALPACA_BASE}/stocks/bars?symbols=${encodeURIComponent(group.join(','))}` +
        `&timeframe=1Day&start=${sessionDate}&end=${sessionDate}&feed=iex&limit=10000` +
        (pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : '');
      const data = await getJson(fetchFn, url, key, secret, errors, 'bars');
      if (!data || (data.bars !== undefined && data.bars !== null && typeof data.bars !== 'object')) break;
      const bars = data.bars as Record<string, unknown[]> | undefined;
      if (bars && typeof bars === 'object') {
        for (const [sym, list] of Object.entries(bars)) {
          const prev = out.get(sym.toUpperCase());
          out.set(sym.toUpperCase(), Array.isArray(prev) ? [...prev, ...(list ?? [])] : list);
        }
      }
      pageToken = typeof data.next_page_token === 'string' && data.next_page_token ? data.next_page_token : null;
      if (!pageToken) { complete = true; break; }
    }
    if (!complete) for (const s of group) failed.add(s);
  }
  return { bars: out, failed };
}

/** symbol -> latest trade or quote object. `kind` picks the endpoint and the body key. */
async function fetchLatest(
  fetchFn: FetchFn, kind: 'trades' | 'quotes', symbols: string[], key: string, secret: string, errors: string[],
): Promise<Map<string, unknown>> {
  const out = new Map<string, unknown>();
  for (const group of chunks(symbols, WEEK_PRICE_CHUNK)) {
    const url = `${ALPACA_BASE}/stocks/${kind}/latest?symbols=${encodeURIComponent(group.join(','))}&feed=iex`;
    const data = await getJson(fetchFn, url, key, secret, errors, `${kind}/latest`);
    const rows = data?.[kind] as Record<string, unknown> | undefined;
    if (rows && typeof rows === 'object') {
      for (const [sym, row] of Object.entries(rows)) out.set(sym.toUpperCase(), row);
    }
  }
  return out;
}

/**
 * Price every symbol by the rule above. Network and HTTP failures never throw:
 * they leave symbols unpriced (and are listed in `errors`), which the callers
 * already treat as "abort this league and retry". Only symbols the bar did not
 * price are sent to the live endpoints, and the quote endpoint is asked only for
 * symbols the trade step did not price.
 */
export async function fetchWeekPrices(
  req: WeekPriceRequest,
  key: string,
  secret: string,
  fetchFn: FetchFn = fetch,
): Promise<WeekPrices> {
  const result: WeekPrices = { prices: new Map(), sources: new Map(), unpriced: new Map(), errors: [] };
  const symbols = [...new Set(req.symbols.map((s) => s.toUpperCase()))];
  if (symbols.length === 0) return result;

  const barSource = req.bar ? (req.bar.field === 'o' ? 'bar_open' : 'bar_close') : null;
  const { bars, failed: barFailed } = req.bar
    ? await fetchBars(fetchFn, symbols, req.bar.sessionDate, key, secret, result.errors)
    : { bars: new Map<string, unknown>(), failed: new Set<string>() };

  const barOf = (s: string) => (req.bar ? barPrice(bars.get(s), req.bar.field) : null);
  // A symbol whose bar REQUEST failed never goes to the live steps: retry instead.
  const needLive = symbols.filter((s) => barOf(s) === null && !barFailed.has(s));

  let trades = new Map<string, unknown>();
  let quotes = new Map<string, unknown>();
  if (req.live && needLive.length > 0) {
    trades = await fetchLatest(fetchFn, 'trades', needLive, key, secret, result.errors);
    const window = req.live;
    const needQuote = needLive.filter((s) => typeof tradePrice(trades.get(s), window) !== 'number');
    if (needQuote.length > 0) quotes = await fetchLatest(fetchFn, 'quotes', needQuote, key, secret, result.errors);
  }

  for (const s of symbols) {
    if (barOf(s) === null && barFailed.has(s)) {
      result.unpriced.set(s, 'bar_fetch_failed');
      continue;
    }
    const r = resolvePrice({
      bar: barOf(s),
      barSource,
      live: req.live ? { window: req.live, trade: trades.get(s), quote: quotes.get(s) } : null,
    });
    if (r.price !== null) {
      result.prices.set(s, r.price);
      result.sources.set(s, r.source);
    } else {
      result.unpriced.set(s, r.reason);
    }
  }
  return result;
}

/** One log line's worth of a WeekPrices: counts per source, the non-bar symbols, and every unpriced one. */
export function describeWeekPrices(p: WeekPrices): string {
  const counts: Record<string, number> = {};
  const nonBar: string[] = [];
  for (const [s, src] of p.sources) {
    counts[src] = (counts[src] ?? 0) + 1;
    if (src === 'last_trade' || src === 'midpoint') nonBar.push(`${s}=${src}@${p.prices.get(s)}`);
  }
  const unpriced = [...p.unpriced].map(([s, r]) => `${s}:${r}`);
  return JSON.stringify({ counts, nonBar, unpriced, errors: p.errors.length });
}
