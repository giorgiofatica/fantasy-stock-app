/**
 * The quote and ticker-quotes functions show a price through the SAME chain a
 * fill pays (_shared/alpaca-price.ts fetchFillPrice): trade, bar, a sane
 * two-sided midpoint, the last daily close, else no price. A lone bid or a lone
 * ask is NEVER shown (2026-11-17). Driven through the REAL index.ts handlers:
 * Deno.serve is captured, fetch is a fake GoTrue + limiter + Alpaca.
 *
 * Run: deno test --allow-read --allow-env --no-check supabase/tests/quote_price_chain.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert';

const URL_ = 'http://stub.supabase.test';
const USER_JWT = 'header.real-user.sig';
const USER_ID = '00000000-0000-4000-8000-0000000000bb';
const FAKE_ENV: Record<string, string> = {
  SUPABASE_URL: URL_,
  SB_PUBLISHABLE_KEY: 'sb_publishable_test-not-a-secret',
  SB_SECRET_KEY_INTERNAL: 'test-internal-key-not-a-secret',
  ALPACA_API_KEY: 'test-alpaca-id',
  ALPACA_API_SECRET: 'test-alpaca-secret',
};

type Handler = (req: Request) => Promise<Response>;

/** Per-symbol Alpaca answers. A symbol absent from a map answers `{}` (no data). */
interface Market {
  trade?: Record<string, number>;
  quote?: Record<string, Record<string, unknown>>;
  close?: Record<string, number>;
}

function install(m: Market): { restore: () => void; alpaca: string[] } {
  const alpaca: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(req.url);
    const ok = (b: unknown, status = 200) =>
      new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
    if (url.hostname === 'data.alpaca.markets') {
      alpaca.push(url.pathname + url.search);
      const sym = decodeURIComponent(url.pathname.split('/')[3] ?? '');
      if (url.pathname.endsWith('/trades/latest')) {
        return ok(m.trade?.[sym] ? { trade: { p: m.trade[sym], t: '2026-11-17T14:59:00Z' } } : {});
      }
      if (url.pathname.endsWith('/bars/latest')) return ok({});
      if (url.pathname.endsWith('/quotes/latest')) {
        return ok(m.quote?.[sym] ? { quote: { t: '2026-11-17T14:59:00Z', ...m.quote[sym] } } : {});
      }
      if (url.pathname.endsWith('/snapshot')) return ok({ prevDailyBar: { c: 200 } });
      if (url.pathname.endsWith(`/${sym}/bars`) && url.searchParams.get('timeframe') === '1Day') {
        const c = m.close?.[sym];
        if (url.searchParams.get('start')) {
          // the fill chain's stage 4: the last real daily close
          const t = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) + 'T05:00:00Z';
          return ok({ bars: c ? [{ t, o: c, h: c, l: c, c, v: 1 }] : [] });
        }
        return ok({ bars: [] }); // the prevClose fallback (no start): nothing
      }
      return ok({});
    }
    if (url.pathname === '/auth/v1/user') {
      return req.headers.get('Authorization') === `Bearer ${USER_JWT}`
        ? ok({ id: USER_ID, aud: 'authenticated', role: 'authenticated' })
        : ok({ code: 403, msg: 'bad_jwt' }, 403);
    }
    if (url.pathname === '/rest/v1/rpc/check_and_bump_rate_limit') return ok(true);
    throw new Error(`unexpected fetch ${req.method} ${url}`);
  }) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; }, alpaca };
}

const handlers = new Map<string, Handler>();
async function load(fn: string): Promise<Handler> {
  const cached = handlers.get(fn);
  if (cached) return cached;
  let captured: Handler | undefined;
  const original = Deno.serve;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (h: Handler) => { captured = h; return {}; };
  try {
    await import(new URL(`../functions/${fn}/index.ts`, import.meta.url).href);
  } finally {
    Deno.serve = original;
  }
  assert(captured, `${fn}: index.ts did not call Deno.serve`);
  handlers.set(fn, captured);
  return captured;
}

function post(h: Handler, body: unknown): Promise<Response> {
  return h(new Request('http://localhost/fn', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${USER_JWT}` },
    body: JSON.stringify(body),
  }));
}

async function withMarket<T>(m: Market, fn: (alpaca: string[]) => Promise<T>): Promise<T> {
  for (const [k, v] of Object.entries(FAKE_ENV)) Deno.env.set(k, v);
  const { restore, alpaca } = install(m);
  try { return await fn(alpaca); } finally { restore(); }
}

// Every symbol is used once per handler: both functions cache 30-60 s per symbol.
const MARKET: Market = {
  trade: { TRD: 212.1 },
  quote: {
    ASK1: { ap: 247.75, as: 100 },        // the 2026-11-16 TM case
    BID1: { bp: 199, bs: 100 },
    ASK2: { ap: 247.75, as: 100 },        // a lone ask AND no close: no price
    MID: { bp: 211.9, bs: 3, ap: 212.1, as: 2 },
    WIDE: { bp: 200, bs: 1, ap: 227, as: 1 },
  },
  close: { ASK1: 212, BID1: 212, WIDE: 213, CLS: 210 },
};

const EXPECT: Array<[string, number | null, string | null]> = [
  ['TRD', 212.1, 'trade.p'],
  ['ASK1', 212, 'bar1d.c'],
  ['BID1', 212, 'bar1d.c'],
  ['MID', 212, 'quote.mid'],
  ['WIDE', 213, 'bar1d.c'],
  ['CLS', 210, 'bar1d.c'],
  ['ASK2', null, null],
];

for (const fn of ['quote', 'ticker-quotes']) {
  Deno.test({
    name: `${fn}: single symbol shows trade / sane midpoint / last close, never a lone side`,
    sanitizeResources: false,
    sanitizeOps: false,
    async fn() {
      const h = await load(fn);
      for (const [sym, price, source] of EXPECT) {
        await withMarket(MARKET, async () => {
          const res = await post(h, { symbol: sym });
          const body = await res.json();
          if (price === null) {
            assertEquals([res.status, body.error, body.price], [404, 'no_price', undefined], sym);
          } else {
            assertEquals([res.status, body.price, body.source], [200, price, source], sym);
            // the response shape is unchanged
            assertEquals(Object.keys(body).sort(), ['changePercent', 'prevClose', 'price', 'source', 'symbol', 'todayOpen'], sym);
          }
        });
      }
    },
  });
}

Deno.test({
  name: 'quote: batch shows the same chain; a lone-side-only symbol is left out, never priced at its side',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const h = await load('quote');
    // Fresh symbols (the single-symbol test above may share this module's cache).
    const batch: Market = {
      trade: { BTRD: 50 },
      quote: { BASK: { ap: 247.75, as: 100 }, BMID: { bp: 99.5, bs: 1, ap: 100.5, as: 1 }, BLONE: { bp: 9, bs: 1 } },
      close: { BASK: 212 },
    };
    await withMarket(batch, async (alpaca) => {
      const res = await post(h, { symbols: ['BTRD', 'BASK', 'BMID', 'BLONE'] });
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.prices, { BTRD: 50, BASK: 212, BMID: 100 });
      assert(alpaca.some((u) => u.startsWith('/v2/stocks/BLONE/bars?')), 'BLONE never reached the close stage');
    });
  },
});
