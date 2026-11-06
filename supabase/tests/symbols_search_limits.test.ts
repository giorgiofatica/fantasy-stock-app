/**
 * symbols-search's spend guard (2026-11-05), run against the REAL index.ts with
 * fetch faked (GoTrue, PostgREST, the limiter rpc, Alpaca). Proves EFFECTS, not
 * statuses: a refused call reaches neither the symbols table nor Alpaca; the
 * batch mode is one Alpaca request; the cache makes a repeat zero.
 *
 * Run: deno test --allow-read --allow-env supabase/tests/symbols_search_limits.test.ts
 * (part of `deno test --allow-read --allow-env supabase/tests/`).
 */
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';

const PUBLISHABLE = 'sb_publishable_test-not-a-secret';
const SECRET = 'sb_secret_test-not-a-secret';
const USER_JWT = 'header.real-user-jwt.sig';
const ANON_JWT = 'header.anon-role-jwt.sig';
const FAKE_ENV: Record<string, string> = {
  SUPABASE_URL: 'http://stub.supabase.test',
  SB_PUBLISHABLE_KEY: PUBLISHABLE,
  SB_SECRET_KEY_INTERNAL: SECRET,
  ALPACA_API_KEY: 'test-alpaca-id',
  ALPACA_API_SECRET: 'test-alpaca-secret',
};
const SAVED_ENV = new Map(Object.keys(FAKE_ENV).map((k) => [k, Deno.env.get(k)]));

type Handler = (req: Request) => Promise<Response>;
type Limiter = 'ok' | 'limited' | 'error' | 'throw';

interface Upstreams {
  symbolsReads: number;
  limiter: Array<{ body: Record<string, unknown>; apikey: string | null }>;
  alpaca: string[];
  restore: () => void;
}

function install(opts: { limiter?: Limiter; alpacaStatus?: number; alpacaBody?: string; trades?: Record<string, number> } = {}): Upstreams {
  const u: Upstreams = { symbolsReads: 0, limiter: [], alpaca: [], restore: () => {} };
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(req.url);
    if (url.pathname === '/auth/v1/user') {
      return req.headers.get('Authorization') === `Bearer ${USER_JWT}`
        ? new Response(JSON.stringify({ id: 'user-1', aud: 'authenticated', role: 'authenticated' }), { status: 200 })
        : new Response(JSON.stringify({ code: 403, msg: 'invalid claim: missing sub claim' }), { status: 403 });
    }
    if (url.pathname === '/rest/v1/rpc/check_and_bump_rate_limit') {
      u.limiter.push({ body: await req.json(), apikey: req.headers.get('apikey') });
      const mode = opts.limiter ?? 'ok';
      if (mode === 'throw') throw new TypeError('network down');
      if (mode === 'error') {
        return new Response(JSON.stringify({ code: 'XX000', message: 'limiter broken' }),
          { status: 500, headers: { 'content-type': 'application/json' } });
      }
      return new Response(mode === 'ok' ? 'true' : 'false', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.pathname === '/rest/v1/symbols') {
      u.symbolsReads++;
      const filter = decodeURIComponent(url.search).toUpperCase();
      const catalog = [{ symbol: 'ZETA', name: 'Zeta Global', is_draftable: true }, { symbol: 'YOTA', name: 'Yota Corp', is_draftable: true }];
      const rows = catalog.filter((r) => filter.includes(r.symbol));
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.hostname === 'data.alpaca.markets') {
      u.alpaca.push(url.toString());
      if (opts.alpacaStatus) return new Response('{"message":"forbidden. secret vendor text"}', { status: opts.alpacaStatus });
      if (opts.alpacaBody !== undefined) return new Response(opts.alpacaBody, { status: 200 });
      const asked = (url.searchParams.get('symbols') ?? '').split(',');
      const trades = Object.fromEntries(asked.filter((s) => opts.trades?.[s] !== undefined).map((s) => [s, { p: opts.trades![s] }]));
      return new Response(JSON.stringify({ trades }), { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
  u.restore = () => { globalThis.fetch = original; };
  return u;
}

async function load(): Promise<Handler> {
  let captured: Handler | undefined;
  const original = Deno.serve;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (h: Handler) => { captured = h; return {}; };
  try {
    // A fresh module instance (its own price cache), apart from symbols_readers.test.ts.
    await import(new URL('../functions/symbols-search/index.ts?limits', import.meta.url).href);
  } finally {
    Deno.serve = original;
  }
  assert(captured, 'symbols-search/index.ts did not call Deno.serve');
  return captured;
}

const post = (h: Handler, jwt: string, body: unknown) =>
  h(new Request('http://localhost/fn', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, apikey: PUBLISHABLE, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));

Deno.test({
  name: 'symbols-search: per-user limit, batch prices, cache (real handler)',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    for (const [k, v] of Object.entries(FAKE_ENV)) Deno.env.set(k, v);
    const fn = await load();
    try {
      await t.step('the limiter is bumped once per call, per USER, at 120/min, with the secret key', async () => {
        const u = install({ trades: { ZETA: 12.5 } });
        try {
          const res = await post(fn, USER_JWT, { q: 'zeta' });
          assertEquals(res.status, 200);
          const body = await res.json();
          assertEquals(body.items[0], { symbol: 'ZETA', name: 'Zeta Global', is_draftable: true, price: 12.5 });
          assertEquals(body.priceErrors, []);
          assertEquals(u.limiter, [{
            body: { p_bucket: 'symbols-search', p_subject: 'user:user-1', p_limit: 120 },
            apikey: SECRET,
          }]);
        } finally { u.restore(); }
      });

      for (const [limiter, status, error] of [
        ['limited', 429, 'rate_limited'],
        ['error', 503, 'rate_limit_unavailable'],
        ['throw', 503, 'rate_limit_unavailable'],
      ] as const) {
        await t.step(`limiter ${limiter} -> ${status}, and NOTHING behind it runs (search and batch)`, async () => {
          const u = install({ limiter, trades: { ZETA: 1, AAPL: 2 } });
          try {
            for (const body of [{ q: 'zeta' }, { symbols: ['AAPL'] }]) {
              const res = await post(fn, USER_JWT, body);
              assertEquals(res.status, status);
              assertEquals((await res.json()).error, error);
            }
            assertEquals(u.symbolsReads, 0, 'a refused call must not read symbols');
            assertEquals(u.alpaca, [], 'a refused call must not spend the Alpaca key');
          } finally { u.restore(); }
        });
      }

      await t.step('secret key missing -> 503 (fail closed), not a pass', async () => {
        const u = install({ trades: { AAPL: 2 } });
        Deno.env.delete('SB_SECRET_KEY_INTERNAL');
        try {
          const res = await post(fn, USER_JWT, { symbols: ['AAPL'] });
          assertEquals(res.status, 503);
          assertEquals(u.limiter, []);
          assertEquals(u.alpaca, []);
        } finally { Deno.env.set('SB_SECRET_KEY_INTERNAL', SECRET); u.restore(); }
      });

      await t.step('no real user (anon JWT) -> 401 before the limiter, the table, or Alpaca', async () => {
        const u = install();
        try {
          for (const body of [{ q: 'zeta' }, { symbols: ['AAPL'] }]) {
            const res = await post(fn, ANON_JWT, body);
            assertEquals(res.status, 401);
          }
          assertEquals([u.limiter.length, u.symbolsReads, u.alpaca.length], [0, 0, 0]);
        } finally { u.restore(); }
      });

      await t.step('batch: 50 exact tickers = ONE Alpaca request, no symbols read; invalid reported', async () => {
        const syms = Array.from({ length: 49 }, (_, i) => `Q${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`);
        const trades = Object.fromEntries(syms.slice(1).map((s, i) => [s, 5 + i]));
        const u = install({ trades });
        try {
          const res = await post(fn, USER_JWT, { symbols: [...syms, 'bad!'] });
          assertEquals(res.status, 200);
          const body = await res.json();
          assertEquals(u.alpaca.length, 1);
          assertEquals(new URL(u.alpaca[0]).searchParams.get('symbols')!.split(',').length, 49);
          assertEquals(new URL(u.alpaca[0]).searchParams.get('feed'), 'iex');
          assertEquals(u.symbolsReads, 0, 'batch mode is prices only: no search, no fuzzy matching');
          assertEquals(Object.keys(body.prices).length, 49);
          assertEquals(body.prices[syms[0]], null, 'answered, no trade: null');
          assertEquals(body.prices[syms[1]], 5);
          assertEquals(body.failed, []);
          assertEquals(body.invalid, ['BAD!']);
          // The same batch inside 60 s: zero Alpaca requests, same answer.
          const again = await post(fn, USER_JWT, { symbols: syms });
          assertEquals(u.alpaca.length, 1, 'the server-side cache must answer a repeat');
          assertEquals((await again.json()).prices, body.prices);
        } finally { u.restore(); }
      });

      await t.step('batch over the cap -> 400 before the guard runs anything', async () => {
        const u = install();
        try {
          const res = await post(fn, USER_JWT, { symbols: Array.from({ length: 51 }, (_, i) => `X${i}`) });
          assertEquals(res.status, 400);
          assertEquals((await res.json()).error, 'too_many_symbols');
          assertEquals([u.limiter.length, u.alpaca.length], [0, 0]);
        } finally { u.restore(); }
      });

      await t.step('Alpaca refusing -> batch is 502 with every ticker in failed; no vendor text; not cached', async () => {
        const u = install({ alpacaStatus: 401 });
        try {
          const res = await post(fn, USER_JWT, { symbols: ['RRRA', 'RRRB'] });
          assertEquals(res.status, 502);
          const text = await res.text();
          assertFalse(text.includes('vendor'), 'Alpaca error text must never be returned');
          const body = JSON.parse(text);
          assertEquals(body.error, 'price_unavailable');
          assertEquals(body.failed, ['RRRA', 'RRRB']);
          assertEquals(body.prices, {});
          assertEquals(u.alpaca.length, 1, 'a 401 key is one request, never bisected');
        } finally { u.restore(); }
        // The failure was not cached: once Alpaca answers, the same tickers are asked again.
        const v = install({ trades: { RRRA: 3 } });
        try {
          const res = await post(fn, USER_JWT, { symbols: ['RRRA', 'RRRB'] });
          assertEquals((await res.json()).prices, { RRRA: 3, RRRB: null });
          assertEquals(v.alpaca.length, 1);
        } finally { v.restore(); }
      });

      await t.step('a malformed Alpaca 200 ({}, trades:null, an error shape) is FAILED, not a cached "no price"', async () => {
        for (const alpacaBody of ['{}', '{"trades":null}', '{"message":"something else"}', 'not json']) {
          const u = install({ alpacaBody });
          try {
            const res = await post(fn, USER_JWT, { symbols: ['MALA', 'MALB'] });
            assertEquals(res.status, 502, alpacaBody);
            const body = await res.json();
            assertEquals(body.failed, ['MALA', 'MALB']);
            assertEquals(body.prices, {});
          } finally { u.restore(); }
        }
        // Not cached: a real answer next time is asked for and used.
        const v = install({ trades: { MALA: 9 } });
        try {
          assertEquals((await (await post(fn, USER_JWT, { symbols: ['MALA', 'MALB'] })).json()).prices, { MALA: 9, MALB: null });
          assertEquals(v.alpaca.length, 1);
        } finally { v.restore(); }
      });

      await t.step('guard misconfigured (no publishable key) -> 503 with CORS, not an uncaught throw', async () => {
        const u = install();
        Deno.env.delete('SB_PUBLISHABLE_KEY');
        try {
          const res = await post(fn, USER_JWT, { symbols: ['AAPL'] });
          assertEquals(res.status, 503);
          assert(res.headers.get('Access-Control-Allow-Origin'));
          assertEquals([u.limiter.length, u.alpaca.length], [0, 0]);
        } finally { Deno.env.set('SB_PUBLISHABLE_KEY', PUBLISHABLE); u.restore(); }
      });

      await t.step('search with Alpaca failing: results still returned, price null, and priceErrors names them', async () => {
        const u = install({ alpacaStatus: 503 });
        try {
          const res = await post(fn, USER_JWT, { q: 'yota' });
          const body = await res.json();
          assertEquals(res.status, 200);
          assertEquals(body.items, [{ symbol: 'YOTA', name: 'Yota Corp', is_draftable: true, price: null }]);
          assertEquals(body.priceErrors, ['YOTA'], 'a failed price read must not look like "no price"');
          assertEquals(u.alpaca.length, 1);
        } finally { u.restore(); }
      });

      await t.step('search: a price read in the last 60 s is served from the cache (zero Alpaca)', async () => {
        const u = install({ alpacaStatus: 503 }); // would fail if it were asked
        try {
          const body = await (await post(fn, USER_JWT, { q: 'zeta' })).json();
          assertEquals(body.items[0].price, 12.5);
          assertEquals(body.priceErrors, []);
          assertEquals(u.alpaca, []);
        } finally { u.restore(); }
      });

      await t.step('an empty query is answered with no guard, no read and no Alpaca (unchanged)', async () => {
        const u = install();
        try {
          assertEquals(await (await post(fn, ANON_JWT, { q: '' })).json(), { items: [] });
          assertEquals(await (await post(fn, ANON_JWT, { symbols: [] })).json(), { prices: {}, failed: [], invalid: [] });
          assertEquals([u.limiter.length, u.symbolsReads, u.alpaca.length], [0, 0, 0]);
        } finally { u.restore(); }
      });
    } finally {
      for (const [k, v] of SAVED_ENV) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
    }
  },
});
