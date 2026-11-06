/**
 * symbols-search's pure parts (2026-11-05): request parsing, the exact-symbol
 * price mapping, the server-side price cache, and the price lookup over an
 * INJECTED Alpaca fetch. index.ts wires them to the network; prices.test.ts
 * drives them with no network, no DB and no secrets.
 *
 * WHY THIS EXISTS: every price this function returns is one request on the
 * shared app key (ALPACA_API_KEY), the key the snapshot jobs, record-trade and
 * ticker-quotes depend on. An exhausted or 401ing key makes isMarketOpenToday
 * report "closed" and the cron jobs exit "successfully" having done nothing
 * (CLAUDE.md success signals #1). So the spend is bounded three ways:
 *   1. a per-user limit (index.ts, the shared fail-closed market-guard);
 *   2. this cache: a price read in the last PRICE_TTL_MS is not re-asked;
 *   3. a batch mode, so the pre-draft queue can price 50 stocks in ONE call
 *      instead of 50, and a bisect bound of MAX_ALPACA_REQUESTS_PER_CALL.
 */
import type { BatchFetchResult, FetchPricesFn } from '../_shared/price-bisect.ts';
import { fetchPricesBisecting } from '../_shared/price-bisect.ts';
import { ALPACA_TICKER_RE } from '../enrich-symbols/price-batch.ts';

/** Batch mode's ceiling. The pre-draft queue holds at most 50 stocks. */
export const MAX_BATCH_SYMBOLS = 50;
/** Search results are capped at this many rows (unchanged from before). */
export const MAX_SEARCH_RESULTS = 15;
/** A search query longer than this is refused: nobody types a 64-character
 * ticker or company prefix, and it bounds the LIKE patterns sent to Postgres. */
export const MAX_QUERY_LENGTH = 64;
/** A batch entry longer than this is refused, not echoed back in `invalid`
 * (the longest real ticker is 9 characters, e.g. ABCDEF.GH). */
export const MAX_SYMBOL_LENGTH = 16;
/** LIKE / PostgREST wildcards and the LIKE escape character. Stripped from a
 * search query, so `%` or `_` cannot turn the search into a catalog dump (no
 * ticker contains one; a company name with one still matches on the rest). */
const LIKE_SPECIALS = /[%_*\\]/g;
/** A price is reused this long, server-side (matches ticker-quotes' 60 s and the
 * mobile queue's own 60 s PRICE_TTL_MS). */
export const PRICE_TTL_MS = 60_000;
/** Cache entries kept per isolate. 14,754 active symbols exist; the cache only
 * needs the ones people are looking at right now. */
export const PRICE_CACHE_MAX = 2_000;
/**
 * Alpaca requests ONE call may make. The multi-symbol endpoint can 400 a whole
 * request for one bad symbol, and fetchPricesBisecting halves on a 400; 3 is the
 * full request plus one split. Every symbol is pre-filtered by ALPACA_TICKER_RE
 * (the same filter that let it be priced at all), so a 400 should not happen in
 * real use; the bound only caps what a crafted batch can cost: at most 3 Alpaca
 * requests per admitted call, never 13. Symbols left unresolved are reported
 * `failed`, never guessed.
 */
export const MAX_ALPACA_REQUESTS_PER_CALL = 3;

export type ParsedRequest =
  | { mode: 'search'; query: string; limit: number; includePrices: boolean }
  | { mode: 'batch'; symbols: string[]; invalid: string[] }
  | { mode: 'empty'; batch: boolean }
  | { mode: 'bad'; error: string; message: string };

const bad = (error: string, message: string): ParsedRequest => ({ mode: 'bad', error, message });

/**
 * The request body -> one mode. `{ q, limit?, includePrices? }` is the search
 * (unchanged); `{ symbols: string[] }` is the batch price read. Both at once is
 * refused rather than guessed. Batch symbols are trimmed, uppercased and
 * deduped in order; a string that is not an Alpaca-format ticker is REPORTED in
 * `invalid` (never priced, never silently dropped).
 */
export function parseRequest(body: unknown): ParsedRequest {
  const b = (body && typeof body === 'object' && !Array.isArray(body)) ? body as Record<string, unknown> : {};
  const hasQ = b.q !== undefined && b.q !== null && b.q !== '';
  if (b.symbols !== undefined) {
    if (hasQ) return bad('ambiguous_request', 'Send either q or symbols, not both.');
    if (!Array.isArray(b.symbols)) return bad('invalid_symbols', 'symbols must be an array of tickers.');
    if (b.symbols.length > MAX_BATCH_SYMBOLS) {
      return bad('too_many_symbols', `At most ${MAX_BATCH_SYMBOLS} symbols per call.`);
    }
    if (!b.symbols.every((s) => typeof s === 'string' && s.trim().length <= MAX_SYMBOL_LENGTH)) {
      return bad('invalid_symbols', 'symbols must be an array of tickers.');
    }
    const seen = new Set<string>();
    const symbols: string[] = [];
    const invalid: string[] = [];
    for (const raw of b.symbols as string[]) {
      const s = raw.trim().toUpperCase();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      (ALPACA_TICKER_RE.test(s) ? symbols : invalid).push(s);
    }
    if (symbols.length === 0 && invalid.length === 0) return { mode: 'empty', batch: true };
    return { mode: 'batch', symbols, invalid };
  }
  const query = String(hasQ ? b.q : '').replace(LIKE_SPECIALS, '').trim().toUpperCase();
  if (!query) return { mode: 'empty', batch: false };
  if (query.length > MAX_QUERY_LENGTH) return bad('query_too_long', `At most ${MAX_QUERY_LENGTH} characters.`);
  const n = Math.floor(Number(b.limit));
  const limit = Number.isFinite(n) && n >= 1 ? Math.min(MAX_SEARCH_RESULTS, n) : 10;
  return { mode: 'search', query, limit, includePrices: b.includePrices !== false };
}

/** A price worth returning: a finite number above zero. */
export function usablePrice(p: unknown): number | null {
  const n = typeof p === 'number' ? p : typeof p === 'string' && p.trim() !== '' ? Number(p) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** A real latest-trades body: `trades` is an object (possibly empty = no symbol
 * traded). Anything else from a 200 is a failed read, not "no trades". */
export function isLatestTradesBody(body: unknown): body is { trades: Record<string, unknown> } {
  const t = (body as { trades?: unknown } | null)?.trades;
  return !!body && typeof body === 'object' && !!t && typeof t === 'object' && !Array.isArray(t);
}

/**
 * Prices out of ONE /v2/stocks/trades/latest body, for EXACTLY the symbols
 * asked: a key Alpaca returns that was not asked is ignored, and a symbol is
 * matched by its exact key only (no case folding, no prefix, no name). An
 * asked symbol with no usable trade is simply absent (a clean "no price").
 */
export function pricesFromLatestTrades(body: unknown, asked: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  const trades = (body as { trades?: unknown } | null)?.trades;
  if (!trades || typeof trades !== 'object') return out;
  for (const s of asked) {
    if (!Object.hasOwn(trades, s)) continue;
    const p = usablePrice((trades as Record<string, { p?: unknown } | null>)[s]?.p);
    if (p !== null) out.set(s, p);
  }
  return out;
}

/** Per-isolate price cache. Holds only clean answers (a price, or null = Alpaca
 * answered with no trade), never a failed read, so a failure is asked again. */
export class PriceCache {
  private entries = new Map<string, { price: number | null; at: number }>();
  constructor(
    private readonly ttlMs = PRICE_TTL_MS,
    private readonly max = PRICE_CACHE_MAX,
    private readonly now: () => number = Date.now,
  ) {}

  /** undefined = not cached (or expired); null = cached "no price". */
  get(symbol: string): number | null | undefined {
    const e = this.entries.get(symbol);
    if (!e) return undefined;
    if (this.now() - e.at >= this.ttlMs) {
      this.entries.delete(symbol);
      return undefined;
    }
    return e.price;
  }

  set(symbol: string, price: number | null): void {
    this.entries.delete(symbol); // re-insert so Map order stays oldest-first
    this.entries.set(symbol, { price, at: this.now() });
    if (this.entries.size <= this.max) return;
    const t = this.now();
    for (const [k, v] of this.entries) if (t - v.at >= this.ttlMs) this.entries.delete(k);
    for (const k of this.entries.keys()) {
      if (this.entries.size <= this.max) break;
      this.entries.delete(k);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}

export interface PriceLookup {
  /** Every asked symbol that got an ANSWER: a price, or null (no trade, or a
   * ticker format Alpaca cannot price). */
  prices: Map<string, number | null>;
  /** Asked symbols whose read FAILED (Alpaca refused, timed out, or the
   * request bound ran out). Not cached; distinct from a null price. */
  failed: string[];
  /** Alpaca requests actually sent (cache hits and short-circuits cost none). */
  alpacaRequests: number;
}

/**
 * Prices for `symbols` (already uppercased): cache first, then ONE multi-symbol
 * Alpaca request for the misses, bisected on a 400 within `maxRequests`. A
 * non-400 failure (401, 429, 5xx, a timeout) is not bisected: it is the key or
 * Alpaca failing, not one symbol, so every remaining miss fails without another
 * request -- a broken key costs one request per call, not three.
 */
export async function lookupPrices(
  symbols: readonly string[],
  deps: { cache: PriceCache; fetchLatest: FetchPricesFn; maxRequests?: number },
): Promise<PriceLookup> {
  const prices = new Map<string, number | null>();
  const misses: string[] = [];
  for (const s of new Set(symbols)) {
    if (!ALPACA_TICKER_RE.test(s)) {
      prices.set(s, null); // a format Alpaca does not price: a clean "no price", no request
      continue;
    }
    const c = deps.cache.get(s);
    if (c === undefined) misses.push(s);
    else prices.set(s, c);
  }
  if (misses.length === 0) return { prices, failed: [], alpacaRequests: 0 };

  let fatal: number | null = null;
  let sent = 0;
  const guarded: FetchPricesFn = async (chunk) => {
    if (fatal !== null) return { ok: false, status: fatal };
    sent++;
    let r: BatchFetchResult;
    try {
      r = await deps.fetchLatest(chunk);
    } catch {
      r = { ok: false, status: 0 };
    }
    if (!r.ok && r.status !== 400) fatal = r.status ?? 0;
    return r;
  };
  const res = await fetchPricesBisecting(misses, guarded, deps.maxRequests ?? MAX_ALPACA_REQUESTS_PER_CALL);
  const failed = new Set(res.failed);
  for (const s of misses) {
    if (failed.has(s)) continue;
    const p = res.prices.get(s) ?? null;
    prices.set(s, p);
    deps.cache.set(s, p);
  }
  return { prices, failed: misses.filter((s) => failed.has(s)), alpacaRequests: sent };
}
