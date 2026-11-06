// supabase/functions/symbols-search/index.ts
// The draft/trade stock search, and (2026-11-05) a batch price read for the
// pre-draft queue. Every price here is a request on the SHARED app key
// (ALPACA_API_KEY), the key the snapshot jobs, record-trade and ticker-quotes
// depend on, so:
//   * a real signed-in user (getUser, not just a gateway-valid JWT: the public
//     anon key passes verify_jwt) is required, under a FAIL-CLOSED per-user
//     limit, checked before any symbols read or Alpaca call;
//   * prices come from a 60 s server-side cache first (./prices.ts);
//   * `{ symbols: [...] }` prices up to 50 exact tickers in ONE Alpaca request
//     (no search, no fuzzy matching), so the queue is one call, not fifty.
// Alpaca error text is never returned.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { guardSignedInCaller } from '../_shared/market-guard.ts';
import { ALPACA_TIMEOUT_MS } from '../_shared/alpaca-price.ts';
import type { BatchFetchResult } from '../_shared/price-bisect.ts';
import { isLatestTradesBody, lookupPrices, parseRequest, PriceCache, pricesFromLatestTrades } from './prices.ts';

/**
 * Calls per signed-in user per minute (60 s fixed window, both modes together).
 * Sized from real use, 2026-11-05:
 *   * the pre-draft queue (useQueueQuotes, feat/queue-row-a) asks ONE call per
 *     queued stock when the card opens, 4 at a time, then reuses an answer for
 *     60 s; the queue holds at most 50 -> at most 50 calls per opening, and the
 *     60 s reuse means a second burst lands in a later window;
 *   * draft-room / trade search types through a 300 ms debounce, so a call
 *     fires only after a pause: ~20-40 a minute of hard searching;
 *   * a stock added to the queue costs one more call each.
 * Peak legitimate ~= 50 + 40 + a few = under 100. 120 (ticker-quotes' number)
 * leaves headroom over that without letting a loop run free: 120 calls is at
 * most 120 x MAX_ALPACA_REQUESTS_PER_CALL Alpaca requests, and far fewer with
 * the cache. Once the queue switches to the batch mode (one call per opening),
 * the peak drops to ~45 and this can come down to 60.
 */
export const USER_LIMIT_PER_MIN = 120;

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  // Allow any vercel.app subdomain (production and previews)
  if (origin.endsWith('.vercel.app') && origin.startsWith('https://')) return true;
  if (origin.startsWith('http://localhost:')) return true;
  return false;
}

// Per request, not module state: the guard, the limiter and Alpaca are awaits,
// and a module-level origin could be overwritten by a concurrent request in the
// same isolate before this one answers.
function getCorsHeaders(requestOrigin: string) {
  const allowedOrigin = isAllowedOrigin(requestOrigin) ? requestOrigin : 'https://fantasy-stock-app.vercel.app';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}


function env(k: string) { return Deno.env.get(k) ?? ''; }

/** Per isolate; best effort (a cold isolate starts empty). */
const priceCache = new PriceCache();

/** ONE multi-symbol latest-trades request. A failure is a status, never a
 * throw and never an empty success (prices.ts decides what a status means). */
async function fetchLatestTrades(symbols: string[]): Promise<BatchFetchResult> {
  const key = env('ALPACA_API_KEY');
  const secret = env('ALPACA_API_SECRET');
  if (!key || !secret) return { ok: false, status: 0 };
  const url = `https://data.alpaca.markets/v2/stocks/trades/latest?symbols=${symbols.map(encodeURIComponent).join(',')}&feed=iex`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(ALPACA_TIMEOUT_MS),
      headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret, 'Accept': 'application/json' },
    });
    if (!res.ok) {
      console.error('symbols-search: alpaca trades/latest failed', res.status);
      await res.body?.cancel();
      return { ok: false, status: res.status };
    }
    // A 200 that is not a latest-trades body ({}, an error shape, trades: null)
    // is a FAILED read, never "no trades": otherwise every symbol would be
    // cached as a clean null for 60 s (reviewers, 2026-11-05).
    const body = await res.json().catch(() => null);
    if (!isLatestTradesBody(body)) {
      console.error('symbols-search: alpaca trades/latest returned a non-trades body');
      return { ok: false, status: 0 };
    }
    return { ok: true, prices: pricesFromLatestTrades(body, symbols) };
  } catch (e) {
    console.error('symbols-search: alpaca trades/latest error', String(e).slice(0, 120));
    return { ok: false, status: 0 };
  }
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get('Origin') || '');
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...cors } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const parsed = parseRequest(await req.json().catch(() => ({})));
  if (parsed.mode === 'bad') return json({ error: parsed.error, message: parsed.message }, 400);
  if (parsed.mode === 'empty') return json(parsed.batch ? { prices: {}, failed: [], invalid: [] } : { items: [] });

  // The guard, before any symbols read or Alpaca call.
  const guard = await guardSignedInCaller(req, 'symbols-search', USER_LIMIT_PER_MIN);
  if (!guard.ok) return json(guard.body, guard.status);

  // ── Batch price mode: exact tickers, one Alpaca request, no symbols read. ──
  // `prices` holds every asked ticker that got an ANSWER (a number, or null =
  // no trade); `failed` is a read that did not happen (retry it; it is not a
  // "no price"); `invalid` is input that is not a ticker. Nothing is dropped.
  if (parsed.mode === 'batch') {
    const r = await lookupPrices(parsed.symbols, { cache: priceCache, fetchLatest: fetchLatestTrades });
    const prices: Record<string, number | null> = {};
    for (const s of parsed.symbols) if (r.prices.has(s)) prices[s] = r.prices.get(s) ?? null;
    const body = { prices, failed: r.failed, invalid: parsed.invalid };
    if (r.failed.length > 0 && r.prices.size === 0) return json({ error: 'price_unavailable', ...body }, 502);
    return json(body);
  }
  const { query, limit, includePrices } = parsed;

  // Query AS THE CALLER (publishable key + the caller's JWT), never as bare
  // anon and never with the secret key: symbols is signed-in only
  // (20261114000000), so a signed-in player reads it through RLS and an
  // anon-JWT caller gets zero rows (and so no Alpaca price fetch either).
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SB_PUBLISHABLE_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  // Smart search with relevance-based ordering
  // Priority: 1) Exact symbol, 2) Symbol starts-with, 3) Name starts-with, 4) Symbol/Name contains
  let items: Array<{ symbol: string; name: string; price?: number | null; is_draftable?: boolean }> = [];
  const maxResults = limit;
  const seen = new Set<string>();

  // A failed read must never look like "no matches" (CLAUDE.md success
  // signals #5: .from() resolves { data, error }, it does not throw). After
  // 20261114000000 an anon-JWT caller is refused here (42501) and must get an
  // error, not an empty list; a signed-in breakage must surface the same way.
  let readFailed = false;
  const addItems = (
    newItems: Array<{ symbol: string; name: string; is_draftable?: boolean }> | null,
    error?: unknown,
  ) => {
    if (error) readFailed = true;
    if (!newItems) return;
    for (const item of newItems) {
      if (!seen.has(item.symbol) && items.length < maxResults) {
        seen.add(item.symbol);
        items.push(item);
      }
    }
  };

  // 1. Exact symbol match (highest priority)
  const { data: exactSymbol, error: exactSymbolErr } = await supabase
    .from('symbols')
    .select('symbol,name,is_draftable')
    .eq('symbol', query)
    .limit(1);
  addItems(exactSymbol, exactSymbolErr);

  // 2. Symbol starts with query
  if (items.length < maxResults) {
    const { data: symbolStartsWith, error: symbolStartsWithErr } = await supabase
      .from('symbols')
      .select('symbol,name,is_draftable')
      .like('symbol', `${query}%`)
      .order('symbol')
      .limit(maxResults);
    addItems(symbolStartsWith, symbolStartsWithErr);
  }

  // 3. Name starts with query (e.g., "Intel" -> "Intel Corporation")
  if (items.length < maxResults) {
    const { data: nameStartsWith, error: nameStartsWithErr } = await supabase
      .from('symbols')
      .select('symbol,name,is_draftable')
      .ilike('name', `${query}%`)
      .order('symbol')
      .limit(maxResults);
    addItems(nameStartsWith, nameStartsWithErr);
  }

  // 4. Symbol contains query
  if (items.length < maxResults) {
    const { data: symbolContains, error: symbolContainsErr } = await supabase
      .from('symbols')
      .select('symbol,name,is_draftable')
      .ilike('symbol', `%${query}%`)
      .order('symbol')
      .limit(maxResults);
    addItems(symbolContains, symbolContainsErr);
  }

  // 5. Name contains query (lowest priority)
  if (items.length < maxResults) {
    const { data: nameContains, error: nameContainsErr } = await supabase
      .from('symbols')
      .select('symbol,name,is_draftable')
      .ilike('name', `%${query}%`)
      .order('symbol')
      .limit(maxResults);
    addItems(nameContains, nameContainsErr);
  }

  if (readFailed) return json({ items: [], error: 'lookup_failed' }, 500);

  // Items are already deduplicated via the seen Set in addItems

  // Optionally fetch prices for search results (cache first, one Alpaca
  // request for the rest). `priceErrors` names the results whose price read
  // FAILED, so a failure is never mistaken for "this stock has no price".
  let priceErrors: string[] = [];
  if (includePrices && items.length > 0) {
    const r = await lookupPrices(items.map((item) => item.symbol), { cache: priceCache, fetchLatest: fetchLatestTrades });
    for (const item of items) item.price = r.prices.get(item.symbol) ?? null;
    priceErrors = r.failed;
  }

  return json({ items, priceErrors });
});
