/**
 * symbols-search's pure parts (./prices.ts): batch input validation and its
 * cap, the exact-symbol price mapping, the server-side cache, and the bounded
 * price lookup. Hermetic: no network, no DB, no secrets.
 *
 * Run: deno test supabase/functions/symbols-search/prices.test.ts
 */
import { assertEquals } from 'jsr:@std/assert';
import type { BatchFetchResult } from '../_shared/price-bisect.ts';
import {
  isLatestTradesBody,
  lookupPrices,
  MAX_ALPACA_REQUESTS_PER_CALL,
  MAX_BATCH_SYMBOLS,
  MAX_QUERY_LENGTH,
  MAX_SYMBOL_LENGTH,
  parseRequest,
  PRICE_TTL_MS,
  PriceCache,
  pricesFromLatestTrades,
} from './prices.ts';

// ── parseRequest ────────────────────────────────────────────────────────────

Deno.test('parseRequest: the search body is unchanged (q, limit clamped to 1..15, prices on by default)', () => {
  assertEquals(parseRequest({ q: ' aap ' }), { mode: 'search', query: 'AAP', limit: 10, includePrices: true });
  assertEquals(parseRequest({ q: 'a', limit: 1, includePrices: true }), { mode: 'search', query: 'A', limit: 1, includePrices: true });
  assertEquals(parseRequest({ q: 'a', limit: 99 }), { mode: 'search', query: 'A', limit: 15, includePrices: true });
  // A zero, negative or junk limit is the default, never a negative LIMIT.
  for (const limit of [0, -5, 'x', null]) assertEquals((parseRequest({ q: 'a', limit }) as { limit: number }).limit, 10);
  assertEquals(parseRequest({ q: 'a', includePrices: false }), { mode: 'search', query: 'A', limit: 10, includePrices: false });
});

Deno.test('parseRequest: an empty body, an empty q, or an empty list is "empty" (no work, no guard needed)', () => {
  assertEquals(parseRequest({}), { mode: 'empty', batch: false });
  assertEquals(parseRequest(null), { mode: 'empty', batch: false });
  assertEquals(parseRequest({ q: '   ' }), { mode: 'empty', batch: false });
  assertEquals(parseRequest({ symbols: [] }), { mode: 'empty', batch: true });
  assertEquals(parseRequest({ symbols: ['  ', ''] }), { mode: 'empty', batch: true });
});

Deno.test('parseRequest: a query past MAX_QUERY_LENGTH is refused', () => {
  assertEquals(parseRequest({ q: 'A'.repeat(MAX_QUERY_LENGTH) }).mode, 'search');
  assertEquals((parseRequest({ q: 'A'.repeat(MAX_QUERY_LENGTH + 1) }) as { error: string }).error, 'query_too_long');
});

Deno.test('parseRequest batch: trimmed, uppercased, deduped in order; non-tickers REPORTED as invalid', () => {
  assertEquals(parseRequest({ symbols: [' aapl', 'AAPL', 'brk.b', 'msft', 'BAD!', 'ABC.WS.X', 'TOOLONGX'] }), {
    mode: 'batch',
    symbols: ['AAPL', 'BRK.B', 'MSFT'],
    invalid: ['BAD!', 'ABC.WS.X', 'TOOLONGX'],
  });
  // Only invalid input is still a batch: the caller is told, not given a silent {}.
  assertEquals(parseRequest({ symbols: ['%%'] }), { mode: 'batch', symbols: [], invalid: ['%%'] });
});

Deno.test('parseRequest batch: the cap is exactly MAX_BATCH_SYMBOLS, counted on the RAW list', () => {
  assertEquals(MAX_BATCH_SYMBOLS, 50);
  const fifty = Array.from({ length: 50 }, (_, i) => `S${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`);
  const ok = parseRequest({ symbols: fifty });
  assertEquals(ok.mode, 'batch');
  assertEquals((ok as { symbols: string[] }).symbols.length, 50);
  assertEquals((parseRequest({ symbols: [...fifty, 'AAPL'] }) as { error: string }).error, 'too_many_symbols');
  // Raw, not deduped: 51 copies of one ticker is still over the cap (bounded work before dedupe).
  assertEquals((parseRequest({ symbols: Array(51).fill('AAPL') }) as { error: string }).error, 'too_many_symbols');
});

Deno.test('parseRequest batch: wrong shapes and an ambiguous body are refused, never guessed', () => {
  assertEquals((parseRequest({ symbols: 'AAPL' }) as { error: string }).error, 'invalid_symbols');
  assertEquals((parseRequest({ symbols: ['AAPL', 7] }) as { error: string }).error, 'invalid_symbols');
  assertEquals((parseRequest({ symbols: [null] }) as { error: string }).error, 'invalid_symbols');
  assertEquals((parseRequest({ symbols: ['AAPL'], q: 'AAPL' }) as { error: string }).error, 'ambiguous_request');
});

// ── pricesFromLatestTrades: exact-symbol mapping ────────────────────────────

Deno.test('pricesFromLatestTrades: exact keys only, asked symbols only, usable prices only', () => {
  const body = {
    trades: {
      AAPL: { p: 195.5 },
      AAP: { p: 70 }, // a prefix of nothing asked here: ignored
      aapl: { p: 1 }, // case-folded key: not AAPL
      MSFT: { p: 0 }, // not usable
      NVDA: { p: -3 },
      INTC: { p: 'x' },
      KO: { p: '61.25' }, // a numeric string is a price (the old code's Number() read)
      T: null,
    },
  };
  const got = pricesFromLatestTrades(body, ['AAPL', 'MSFT', 'NVDA', 'INTC', 'KO', 'T', 'ZZZ']);
  assertEquals([...got.entries()], [['AAPL', 195.5], ['KO', 61.25]]);
  assertEquals(pricesFromLatestTrades(body, ['AA']).size, 0, 'a prefix never matches');
});

Deno.test('pricesFromLatestTrades: a malformed body is no prices, not a throw; prototype keys are not trades', () => {
  for (const b of [null, {}, { trades: null }, { trades: 'x' }, []]) assertEquals(pricesFromLatestTrades(b, ['AAPL']).size, 0);
  assertEquals(pricesFromLatestTrades({ trades: {} }, ['CONSTRUCTOR', 'TOSTRING']).size, 0);
});

// ── PriceCache ──────────────────────────────────────────────────────────────

Deno.test('PriceCache: a price (or a clean null) is reused for PRICE_TTL_MS, then asked again', () => {
  let t = 1_000;
  const c = new PriceCache(PRICE_TTL_MS, 100, () => t);
  c.set('AAPL', 195.5);
  c.set('ZZZ', null);
  assertEquals(c.get('AAPL'), 195.5);
  assertEquals(c.get('ZZZ'), null, 'a cached "no price" is null, not a miss');
  assertEquals(c.get('MSFT'), undefined);
  t += PRICE_TTL_MS - 1;
  assertEquals(c.get('AAPL'), 195.5);
  t += 1;
  assertEquals(c.get('AAPL'), undefined, 'expired at exactly the TTL');
});

Deno.test('PriceCache: bounded; expired entries go first, then the oldest', () => {
  let t = 0;
  const c = new PriceCache(1_000, 3, () => t);
  c.set('A', 1);
  t = 500;
  c.set('B', 2);
  c.set('C', 3);
  t = 1_200; // A expired
  c.set('D', 4);
  assertEquals([c.get('A'), c.get('B'), c.get('C'), c.get('D')], [undefined, 2, 3, 4]);
  c.set('E', 5); // nothing expired: the oldest (B) goes
  assertEquals(c.size, 3);
  assertEquals([c.get('B'), c.get('C'), c.get('E')], [undefined, 3, 5]);
});

// ── lookupPrices ────────────────────────────────────────────────────────────

/** A fake latest-trades port: records every request; per-symbol answers. */
function fakeAlpaca(opts: { priced?: Record<string, number>; reject400?: string[]; status?: number; throws?: boolean } = {}) {
  const calls: string[][] = [];
  const fn = (chunk: string[]): Promise<BatchFetchResult> => {
    calls.push([...chunk]);
    if (opts.throws) return Promise.reject(new DOMException('timed out', 'TimeoutError'));
    if (opts.status) return Promise.resolve({ ok: false, status: opts.status });
    if (chunk.some((s) => opts.reject400?.includes(s))) return Promise.resolve({ ok: false, status: 400 });
    const prices = new Map<string, number>();
    for (const s of chunk) if (opts.priced?.[s] !== undefined) prices.set(s, opts.priced[s]);
    return Promise.resolve({ ok: true, prices });
  };
  return { calls, fn };
}

Deno.test('lookupPrices: ONE Alpaca request for 50 symbols; answers and clean nulls cached', async () => {
  const syms = Array.from({ length: 50 }, (_, i) => `S${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`);
  const priced = Object.fromEntries(syms.slice(0, 49).map((s, i) => [s, 10 + i]));
  const a = fakeAlpaca({ priced });
  const cache = new PriceCache();
  const r = await lookupPrices(syms, { cache, fetchLatest: a.fn });
  assertEquals(a.calls.length, 1);
  assertEquals(r.alpacaRequests, 1);
  assertEquals(r.failed, []);
  assertEquals(r.prices.size, 50);
  assertEquals(r.prices.get(syms[49]), null, 'answered with no trade: a clean null');
  // Second call inside the TTL: zero Alpaca requests, same answers.
  const again = await lookupPrices(syms, { cache, fetchLatest: a.fn });
  assertEquals(a.calls.length, 1);
  assertEquals(again.alpacaRequests, 0);
  assertEquals([...again.prices.entries()], [...r.prices.entries()]);
});

Deno.test('lookupPrices: only the cache misses are asked', async () => {
  const cache = new PriceCache();
  cache.set('AAPL', 195.5);
  const a = fakeAlpaca({ priced: { MSFT: 420 } });
  const r = await lookupPrices(['AAPL', 'MSFT'], { cache, fetchLatest: a.fn });
  assertEquals(a.calls, [['MSFT']]);
  assertEquals([...r.prices.entries()], [['AAPL', 195.5], ['MSFT', 420]]);
});

Deno.test('lookupPrices: a ticker format Alpaca cannot price is a null with no request', async () => {
  const a = fakeAlpaca();
  const r = await lookupPrices(['ABC.WS.X', 'BAD$'], { cache: new PriceCache(), fetchLatest: a.fn });
  assertEquals(a.calls, []);
  assertEquals([...r.prices.entries()], [['ABC.WS.X', null], ['BAD$', null]]);
});

Deno.test('lookupPrices: a 401/429/5xx/timeout costs ONE request, fails every miss, caches nothing', async () => {
  for (const opts of [{ status: 401 }, { status: 429 }, { status: 503 }, { throws: true }]) {
    const a = fakeAlpaca(opts);
    const cache = new PriceCache();
    const r = await lookupPrices(['AAPL', 'MSFT', 'NVDA', 'KO'], { cache, fetchLatest: a.fn });
    assertEquals(a.calls.length, 1, `${JSON.stringify(opts)}: a broken key must not be bisected`);
    assertEquals(r.failed, ['AAPL', 'MSFT', 'NVDA', 'KO']);
    assertEquals(r.prices.size, 0, 'a failed read is never a null "no price"');
    assertEquals(cache.size, 0, 'a failure is not cached, so the next call asks again');
  }
});

Deno.test('lookupPrices: a 400 is bisected within MAX_ALPACA_REQUESTS_PER_CALL; the rest is reported failed', async () => {
  assertEquals(MAX_ALPACA_REQUESTS_PER_CALL, 3);
  // Bad symbol in the second half: full (400) -> first half (ok) -> second half (400): 3 requests.
  const a = fakeAlpaca({ priced: { AAPL: 1, MSFT: 2, NVDA: 3, KO: 4 }, reject400: ['KO'] });
  const cache = new PriceCache();
  const r = await lookupPrices(['AAPL', 'MSFT', 'NVDA', 'KO'], { cache, fetchLatest: a.fn });
  assertEquals(a.calls.length, 3);
  assertEquals([...r.prices.entries()], [['AAPL', 1], ['MSFT', 2]]);
  assertEquals(r.failed, ['NVDA', 'KO'], 'unresolved when the bound ran out: failed, not guessed');
  assertEquals(cache.get('NVDA'), undefined);
  // A crafted batch of all-400 symbols never costs more than the bound.
  const b = fakeAlpaca({ reject400: ['AA', 'BB', 'CC', 'DD', 'EE', 'FF', 'GG', 'HH'] });
  await lookupPrices(['AA', 'BB', 'CC', 'DD', 'EE', 'FF', 'GG', 'HH'], { cache: new PriceCache(), fetchLatest: b.fn });
  assertEquals(b.calls.length, MAX_ALPACA_REQUESTS_PER_CALL);
});

// ── reviewer fixes (2026-11-05) ─────────────────────────────────────────────

Deno.test('isLatestTradesBody: only an object `trades` is a real answer; any other 200 is a failed read', () => {
  assertEquals(isLatestTradesBody({ trades: {} }), true, 'no symbol traded is still a real answer');
  assertEquals(isLatestTradesBody({ trades: { AAPL: { p: 1 } } }), true);
  for (const b of [null, {}, { trades: null }, { trades: [] }, { trades: 'x' }, { message: 'forbidden' }, [], 'x']) {
    assertEquals(isLatestTradesBody(b), false, JSON.stringify(b));
  }
});

Deno.test('parseRequest: LIKE / PostgREST wildcards are stripped, so "%" or "_" is not a catalog dump', () => {
  assertEquals(parseRequest({ q: '%' }), { mode: 'empty', batch: false });
  assertEquals(parseRequest({ q: '_' }), { mode: 'empty', batch: false });
  assertEquals(parseRequest({ q: '*\\' }), { mode: 'empty', batch: false });
  assertEquals((parseRequest({ q: 'a%p_l*' }) as { query: string }).query, 'APL');
  assertEquals((parseRequest({ q: 'brk.b' }) as { query: string }).query, 'BRK.B', 'a dot is not a wildcard');
});

Deno.test('parseRequest batch: an entry longer than MAX_SYMBOL_LENGTH is refused, never echoed back', () => {
  assertEquals((parseRequest({ symbols: ['A'.repeat(MAX_SYMBOL_LENGTH)] }) as { mode: string }).mode, 'batch');
  assertEquals((parseRequest({ symbols: ['AAPL', 'A'.repeat(MAX_SYMBOL_LENGTH + 1)] }) as { error: string }).error, 'invalid_symbols');
});
