/**
 * record-trade's preview, driven through the REAL index.ts (Deno.serve captured
 * on import, globalThis.fetch replaced by a fake PostgREST + GoTrue; the
 * handler_auth_boundary.test.ts pattern). Two things are pinned here:
 *
 *   1. The SINGLE preview is unchanged. Its whole response body, for a
 *      price-tier league and a fixed_notional league, with and without a
 *      `price`, is snapshotted as a literal. These snapshots were checked
 *      against record-trade as it was on main before the list preview existed
 *      (65fb06aa), so a change to the old shape fails here.
 *   2. The LIST preview (`rows`, plan part 3 point 4, preview-list.ts) end to
 *      end: it reads the caller's watchlist WITH THE CALLER'S TOKEN (so RLS
 *      decides), answers only saved symbols, reads category eligibility only
 *      for saved symbols, refuses an over-long list before any league read,
 *      and refuses a request naming both shapes.
 *
 * The fake PostgREST models the watchlist's RLS: a watchlist read that does not
 * carry the signed-in user's token sees no rows. Every token is fabricated.
 *
 * Run: deno test --allow-read --allow-env supabase/tests/record_trade_list_preview.test.ts
 * (part of `deno test --allow-read --allow-env supabase/tests/`).
 */
import { assert, assertEquals } from 'jsr:@std/assert';

const URL_ = 'http://stub.supabase.test';
const PUBLISHABLE = 'sb_publishable_test-not-a-secret';
const SECRET = 'sb_secret_test-not-a-secret';
const USER_ID = '00000000-0000-4000-8000-0000000000aa';
const OTHER_ID = '00000000-0000-4000-8000-0000000000cc';
const LEAGUE_ID = '00000000-0000-4000-8000-0000000000bb';
/** The one session token the fake sign-in server knows. Fabricated, built at run
 * time (a junk signature over test claims), as handler_auth_boundary.test.ts does. */
const b64url = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const USER_JWT = `${b64url({ alg: 'ES256', typ: 'JWT' })}.${b64url({ sub: USER_ID, role: 'authenticated' })}.issued-by-the-fake-gotrue`;
const TECH = '00000000-0000-4000-8000-00000000c001';

const FAKE_ENV: Record<string, string> = {
  SUPABASE_URL: URL_,
  SB_PUBLISHABLE_KEY: PUBLISHABLE,
  SB_SECRET_KEY_INTERNAL: SECRET,
  ALPACA_API_KEY: 'test-alpaca-id',
  ALPACA_API_SECRET: 'test-alpaca-secret',
};

// ---------------------------------------------------------------------------
// Fixtures: one league, the caller's ledger, slots, watchlist, categories
// ---------------------------------------------------------------------------

interface World {
  league: Record<string, unknown>;
  drafts: Record<string, unknown>[];
  trades: Record<string, unknown>[];
  slots: Record<string, unknown>[];
  /** every user's watchlist rows; RLS (modelled) shows only the caller's */
  watchlist: Array<{ league_id: string; user_id: string; symbol: string }>;
  /** symbol -> gics_industry; industry -> category */
  industries: Record<string, string>;
  rules: Record<string, string>;
  watchlistError?: boolean;
  /** the category-override read fails (fetchEligibleCategoryIds* throw on it) */
  eligibilityError?: boolean;
}

const LO = { id: 's-lo', slot_index: 0, slot_count: 1, price_min: 0, price_max: 200, category_id: null };
const HI = { id: 's-hi', slot_index: 1, slot_count: 1, price_min: 200, price_max: null, category_id: null };
const CAT = { id: 's-cat', slot_index: 0, slot_count: 1, price_min: null, price_max: null, category_id: TECH };
const FLEX = { id: 's-flex', slot_index: 1, slot_count: 1, price_min: null, price_max: null, category_id: null };

function league(over: Record<string, unknown> = {}) {
  return {
    id: LEAGUE_ID, num_rounds: 2, draft_status: 'completed', season_status: 'active',
    stake_mode: 'price_tiers', budget_amount: null, notional_per_slot: null, allow_undraftable: false,
    ...over,
  };
}

function tierWorld(over: Partial<World> = {}): World {
  return {
    league: league(),
    // NVDA holds the $200+ slot; the $0–$200 slot is free.
    drafts: [{ id: 'd1', user_id: USER_ID, symbol: 'NVDA', entry_price: 900, quantity: 1, pick_number: 1, slot_id: 's-hi' }],
    trades: [],
    slots: [LO, HI],
    watchlist: [
      { league_id: LEAGUE_ID, user_id: USER_ID, symbol: 'AAPL' },
      { league_id: LEAGUE_ID, user_id: USER_ID, symbol: 'MSFT' },
      // Someone else's save, and the caller's save in another league: neither counts.
      { league_id: LEAGUE_ID, user_id: OTHER_ID, symbol: 'TSLA' },
      { league_id: '00000000-0000-4000-8000-0000000000dd', user_id: USER_ID, symbol: 'GOOG' },
    ],
    industries: { AAPL: 'Tech Hardware', MSFT: 'Software', TSLA: 'Autos', GOOG: 'Interactive Media', XOM: 'Oil' },
    rules: { 'Tech Hardware': TECH, Software: TECH, 'Interactive Media': TECH },
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Fake network
// ---------------------------------------------------------------------------

interface Seen {
  method: string;
  table: string;
  query: URLSearchParams;
  authorization: string | null;
  apikey: string | null;
}

const json = (b: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json', ...extra } });

/** PostgREST's answer to a list read: rows + an exact count (readAllPages trusts it). */
const rowsResponse = (rows: unknown[]) =>
  json(rows, 200, { 'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0' });

/** eq./in. filters, as PostgREST reads them from the query string. */
function filterRows<T extends Record<string, unknown>>(rows: T[], q: URLSearchParams): T[] {
  return rows.filter((r) => {
    for (const [k, v] of q) {
      if (k === 'select' || k === 'order' || k === 'offset' || k === 'limit') continue;
      if (v.startsWith('eq.')) { if (String(r[k]) !== v.slice(3)) return false; continue; }
      if (v.startsWith('in.(')) {
        const list = v.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, ''));
        if (!list.includes(String(r[k]))) return false;
        continue;
      }
    }
    return true;
  });
}

function install(world: World, seen: Seen[]): () => void {
  const original = globalThis.fetch;
  // deno-lint-ignore require-await
  globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(req.url);
    if (url.pathname === '/auth/v1/user') {
      return req.headers.get('Authorization') === `Bearer ${USER_JWT}`
        ? json({ id: USER_ID, aud: 'authenticated', role: 'authenticated' })
        : json({ code: 403, error_code: 'bad_jwt', msg: 'invalid JWT' }, 403);
    }
    const table = url.pathname.replace(/^\/rest\/v1\//, '');
    seen.push({ method: req.method, table, query: url.searchParams, authorization: req.headers.get('Authorization'), apikey: req.headers.get('apikey') });
    if (table.startsWith('rpc/')) return json(true); // the rate limiter: under the limit
    const single = (req.headers.get('accept') ?? '').includes('vnd.pgrst.object');
    const q = url.searchParams;
    switch (table) {
      case 'market_calendar_coverage': return json(null); // never refreshed -> market: null (deterministic)
      case 'market_calendar': return rowsResponse([]);
      case 'leagues': return json(single ? world.league : [world.league]);
      case 'league_members': return json(single ? { user_id: USER_ID } : [{ user_id: USER_ID }]);
      case 'matchups': return rowsResponse([]);
      case 'drafts': return rowsResponse(world.drafts);
      case 'trades': return rowsResponse(world.trades);
      case 'league_draft_slots': return rowsResponse(world.slots);
      case 'watchlist': {
        if (world.watchlistError) return json({ code: 'XX000', message: 'boom' }, 500);
        // RLS, modelled: only a request carrying the signed-in user's token sees
        // that user's rows (user_id = auth.uid() and is_member).
        const caller = req.headers.get('Authorization') === `Bearer ${USER_JWT}` ? USER_ID : null;
        const visible = world.watchlist.filter((w) => w.user_id === caller);
        return rowsResponse(filterRows(visible, q).map((w) => ({ symbol: w.symbol })));
      }
      case 'symbol_category_overrides':
        return world.eligibilityError ? json({ code: 'XX000', message: 'boom' }, 500) : rowsResponse([]);
      case 'symbols': {
        const all = Object.entries(world.industries).map(([symbol, gics_industry]) => ({ symbol, gics_industry }));
        const rows = filterRows(all, q);
        return single ? json(rows[0] ?? null) : rowsResponse(rows);
      }
      case 'category_rules': {
        const all = Object.entries(world.rules).map(([gics_industry, category_id]) => ({ gics_industry, category_id }));
        const rows = filterRows(all, q);
        return single ? json(rows[0] ?? null) : rowsResponse(rows);
      }
    }
    return json({ code: 'PGRST205', message: `unexpected table ${table}` }, 404);
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

type Handler = (req: Request) => Promise<Response>;
let handler: Handler | undefined;
async function load(): Promise<Handler> {
  if (handler) return handler;
  for (const [k, v] of Object.entries(FAKE_ENV)) Deno.env.set(k, v);
  const original = Deno.serve;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (h: Handler) => { handler = h; return {}; };
  try {
    await import(new URL('../functions/record-trade/index.ts', import.meta.url).href);
  } finally {
    Deno.serve = original;
  }
  assert(handler, 'record-trade/index.ts did not call Deno.serve');
  return handler;
}

async function call(world: World, body: unknown): Promise<{ status: number; text: string; body: Record<string, unknown>; seen: Seen[] }> {
  for (const [k, v] of Object.entries(FAKE_ENV)) Deno.env.set(k, v);
  const h = await load();
  const seen: Seen[] = [];
  const restore = install(world, seen);
  const o = { log: console.log, error: console.error, warn: console.warn };
  console.log = console.error = console.warn = () => {};
  try {
    const res = await h(new Request('http://localhost/fn', {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: PUBLISHABLE, Authorization: `Bearer ${USER_JWT}`, 'x-forwarded-for': '203.0.113.7' },
      body: JSON.stringify(body),
    }));
    const text = await res.text();
    return { status: res.status, text, body: JSON.parse(text), seen };
  } finally {
    Object.assign(console, o);
    restore();
  }
}

const opts = { sanitizeResources: false, sanitizeOps: false };

// ---------------------------------------------------------------------------
// 1. The single preview: byte-for-byte the shape it had before the list existed
// ---------------------------------------------------------------------------

const SLOT_MAP = [
  { slot_id: 's-lo', slot_index: 0, slot_count: 1, price_min: 0, price_max: 200, category_id: null, held: [], open: 1 },
  { slot_id: 's-hi', slot_index: 1, slot_count: 1, price_min: 200, price_max: null, category_id: null, held: ['NVDA'], open: 0 },
];

Deno.test({ name: 'single preview (price tiers, no price): unchanged body', ...opts, async fn() {
  const r = await call(tierWorld(), { action: 'preview', league_id: LEAGUE_ID });
  assertEquals(r.status, 200);
  assertEquals(r.text, JSON.stringify({
    ok: true, stake_mode: 'price_tiers', stake: null, unfilled_slots: 0, sources: [], market: null,
    slots: SLOT_MAP, unplaced: [],
  }));
}});

Deno.test({ name: 'single preview (price tiers, with a price): unchanged body, would_fill / open_slots at the top level', ...opts, async fn() {
  const fits = await call(tierWorld(), { action: 'preview', league_id: LEAGUE_ID, symbol: 'AAPL', price: 150 });
  assertEquals(fits.text, JSON.stringify({
    ok: true, stake_mode: 'price_tiers', stake: null, unfilled_slots: 0, sources: [], market: null,
    slots: SLOT_MAP, unplaced: [],
    would_fill: { slot_id: 's-lo', slot_index: 0, slot_count: 1, price_min: 0, price_max: 200, category_id: null },
  }));
  const none = await call(tierWorld(), { action: 'preview', league_id: LEAGUE_ID, symbol: 'AAPL', price: 500 });
  assertEquals(none.text, JSON.stringify({
    ok: true, stake_mode: 'price_tiers', stake: null, unfilled_slots: 0, sources: [], market: null,
    slots: SLOT_MAP, unplaced: [],
    would_fill: null,
    open_slots: [{ slot_id: 's-lo', slot_index: 0, slot_count: 1, price_min: 0, price_max: 200, category_id: null }],
  }));
  // The single preview never reads anyone's watchlist.
  assertEquals(none.seen.filter((s) => s.table === 'watchlist'), []);
}});

Deno.test({ name: 'single preview (fixed_notional, slot-less): unchanged body', ...opts, async fn() {
  const world = tierWorld({
    league: league({ stake_mode: 'fixed_notional', notional_per_slot: 1000 }),
    slots: [],
    drafts: [{ id: 'd1', user_id: USER_ID, symbol: 'NVDA', entry_price: 900, quantity: 1.111111, pick_number: 1, slot_id: null }],
    trades: [{ id: 't1', user_id: USER_ID, symbol: 'NVDA', action: 'sell', quantity: 1.111111, price: 950, total_value: 1055.56, created_at: '2026-11-02T15:00:00Z', funded_by_trade_id: null, slot_id: null }],
  });
  const r = await call(world, { action: 'preview', league_id: LEAGUE_ID, price: 150 });
  assertEquals(r.text, JSON.stringify({
    ok: true, stake_mode: 'fixed_notional', stake: 1000, unfilled_slots: 0,
    sources: [{ trade_id: 't1', symbol: 'NVDA', amount: 1055.56 }], market: null,
    slots: [], unplaced: [],
  }));
}});

Deno.test({ name: 'single preview (category league, symbol + price): unchanged body — the path wouldFillBody was extracted from', ...opts, async fn() {
  const world = tierWorld({ slots: [CAT, FLEX], drafts: [] });
  const catMap = [
    { slot_id: 's-cat', slot_index: 0, slot_count: 1, price_min: null, price_max: null, category_id: TECH, held: [], open: 1 },
    { slot_id: 's-flex', slot_index: 1, slot_count: 1, price_min: null, price_max: null, category_id: null, held: [], open: 1 },
  ];
  const tech = await call(world, { action: 'preview', league_id: LEAGUE_ID, symbol: 'AAPL', price: 150 });
  assertEquals(tech.text, JSON.stringify({
    ok: true, stake_mode: 'price_tiers', stake: null, unfilled_slots: 0, sources: [], market: null,
    slots: catMap, unplaced: [],
    would_fill: { slot_id: 's-cat', slot_index: 0, slot_count: 1, price_min: null, price_max: null, category_id: TECH },
  }));
  const oil = await call(world, { action: 'preview', league_id: LEAGUE_ID, symbol: 'XOM', price: 90 });
  assertEquals(oil.text, JSON.stringify({
    ok: true, stake_mode: 'price_tiers', stake: null, unfilled_slots: 0, sources: [], market: null,
    slots: catMap, unplaced: [],
    would_fill: { slot_id: 's-flex', slot_index: 1, slot_count: 1, price_min: null, price_max: null, category_id: null },
  }));
  // Flex held: a non-tech stock has nowhere to go -> null + the open tech slot.
  const full = await call(tierWorld({
    slots: [CAT, FLEX],
    drafts: [{ id: 'd1', user_id: USER_ID, symbol: 'XOM', entry_price: 90, quantity: 1, pick_number: 1, slot_id: 's-flex' }],
  }), { action: 'preview', league_id: LEAGUE_ID, symbol: 'XOM', price: 90 });
  assertEquals(full.text, JSON.stringify({
    ok: true, stake_mode: 'price_tiers', stake: null, unfilled_slots: 0, sources: [], market: null,
    slots: [catMap[0], { ...catMap[1], held: ['XOM'], open: 0 }], unplaced: [],
    would_fill: null,
    open_slots: [{ slot_id: 's-cat', slot_index: 0, slot_count: 1, price_min: null, price_max: null, category_id: TECH }],
  }));
}});

// ---------------------------------------------------------------------------
// 2. The list preview
// ---------------------------------------------------------------------------

Deno.test({ name: 'list preview: answers only the caller\'s own saved symbols in THIS league; the rest are null', ...opts, async fn() {
  const r = await call(tierWorld(), {
    action: 'preview', league_id: LEAGUE_ID,
    rows: [
      { symbol: 'AAPL', price: 150 },   // saved, fits the free $0–$200 slot
      { symbol: 'MSFT', price: 500 },   // saved, $200+ slot is held
      { symbol: 'TSLA', price: 150 },   // someone ELSE saved it
      { symbol: 'GOOG', price: 150 },   // the caller saved it in ANOTHER league
      { symbol: 'XOM', price: 150 },    // nobody saved it
      { symbol: 'AAPL', price: null },  // price did not load
    ],
  });
  assertEquals(r.status, 200);
  // Same body as the single preview, without a top-level would_fill, plus `rows` last.
  assertEquals(r.text, JSON.stringify({
    ok: true, stake_mode: 'price_tiers', stake: null, unfilled_slots: 0, sources: [], market: null,
    slots: SLOT_MAP, unplaced: [],
    rows: [
      { symbol: 'AAPL', price: 150, would_fill: { slot_id: 's-lo', slot_index: 0, slot_count: 1, price_min: 0, price_max: 200, category_id: null } },
      { symbol: 'MSFT', price: 500, would_fill: null, open_slots: [{ slot_id: 's-lo', slot_index: 0, slot_count: 1, price_min: 0, price_max: 200, category_id: null }] },
      null,
      null,
      null,
      null,
    ],
  }));
}});

Deno.test({ name: 'list preview: the watchlist is read with the CALLER\'s token and the public key, never the secret key', ...opts, async fn() {
  const r = await call(tierWorld(), { action: 'preview', league_id: LEAGUE_ID, rows: [{ symbol: 'AAPL', price: 150 }] });
  const reads = r.seen.filter((s) => s.table === 'watchlist');
  assertEquals(reads.length, 1);
  assertEquals(reads[0].authorization, `Bearer ${USER_JWT}`);
  assertEquals(reads[0].apikey, PUBLISHABLE);
  assertEquals(reads[0].query.get('league_id'), `eq.${LEAGUE_ID}`);
  assertEquals(reads[0].query.get('user_id'), `eq.${USER_ID}`);
  assertEquals(reads[0].query.get('symbol'), 'in.(AAPL)');
}});

Deno.test({ name: 'list preview (category league): eligibility is read only for SAVED symbols', ...opts, async fn() {
  const world = tierWorld({ slots: [CAT, FLEX], drafts: [] });
  const r = await call(world, {
    action: 'preview', league_id: LEAGUE_ID,
    rows: [{ symbol: 'AAPL', price: 150 }, { symbol: 'TSLA', price: 150 }, { symbol: 'XOM', price: 90 }],
  });
  assertEquals(r.status, 200);
  const rows = r.body.rows as Array<{ would_fill: { slot_id: string } | null } | null>;
  assertEquals(rows[0]?.would_fill?.slot_id, 's-cat', 'AAPL (tech) takes the tech slot');
  assertEquals(rows[1], null);
  assertEquals(rows[2], null);
  // Every category read named AAPL alone: an unsaved symbol's category is never looked up.
  const catReads = r.seen.filter((s) => ['symbol_category_overrides', 'symbols', 'category_rules'].includes(s.table));
  assert(catReads.length > 0, 'the category reads ran');
  for (const s of catReads) {
    const filter = s.query.get('symbol') ?? s.query.get('gics_industry') ?? '';
    assert(!/TSLA|XOM|Autos|Oil/.test(filter), `${s.table} was asked about an unsaved symbol: ${filter}`);
  }
}});

Deno.test({ name: 'list preview: a league with no slots answers null for every row and never reads the watchlist', ...opts, async fn() {
  const r = await call(tierWorld({ slots: [], league: league({ stake_mode: 'budget_cap', budget_amount: 1000 }) }), {
    action: 'preview', league_id: LEAGUE_ID, rows: [{ symbol: 'AAPL', price: 150 }, { symbol: 'MSFT', price: 20 }],
  });
  assertEquals(r.status, 200);
  assertEquals(r.body.rows, [null, null]);
  assertEquals(r.seen.filter((s) => s.table === 'watchlist'), []);
}});

Deno.test({ name: 'list preview: 51 rows is a bad_request before any league read', ...opts, async fn() {
  const rows = Array.from({ length: 51 }, (_, i) => ({ symbol: `S${i}`, price: 10 }));
  const r = await call(tierWorld(), { action: 'preview', league_id: LEAGUE_ID, rows });
  assertEquals(r.status, 400);
  assertEquals(r.body, { ok: false, reason: 'bad_request' });
  assertEquals(r.seen.filter((s) => ['leagues', 'watchlist', 'drafts', 'trades'].includes(s.table)), []);
  // 50 is fine
  const ok = await call(tierWorld(), { action: 'preview', league_id: LEAGUE_ID, rows: rows.slice(0, 50) });
  assertEquals(ok.status, 200);
  assertEquals((ok.body.rows as unknown[]).length, 50);
}});

Deno.test({ name: 'list preview: rows that are not a list, or rows together with a single symbol/price, are a bad_request', ...opts, async fn() {
  for (const body of [
    { action: 'preview', league_id: LEAGUE_ID, rows: 'AAPL' },
    { action: 'preview', league_id: LEAGUE_ID, rows: null },
    { action: 'preview', league_id: LEAGUE_ID, rows: [{ symbol: 'AAPL', price: 150 }], price: 150 },
    { action: 'preview', league_id: LEAGUE_ID, rows: [{ symbol: 'AAPL', price: 150 }], symbol: 'AAPL' },
  ]) {
    const r = await call(tierWorld(), body);
    assertEquals(r.status, 400, JSON.stringify(body));
    assertEquals(r.body, { ok: false, reason: 'bad_request' });
  }
}});

Deno.test({ name: 'list preview: a watchlist read error is a 500, never a page of nulls', ...opts, async fn() {
  const r = await call(tierWorld({ watchlistError: true }), { action: 'preview', league_id: LEAGUE_ID, rows: [{ symbol: 'AAPL', price: 150 }] });
  assertEquals(r.status, 500);
  assertEquals(r.body, { ok: false, reason: 'unhandled' });
}});

Deno.test({ name: 'list preview: `rows` on a buy or sell is ignored (the list is a preview-only shape)', ...opts, async fn() {
  // A buy with rows still goes down the buy path: here the market gate (no
  // coverage -> calendar_unavailable) answers first, exactly as without rows.
  const withRows = await call(tierWorld(), { action: 'buy', league_id: LEAGUE_ID, symbol: 'AAPL', rows: [{ symbol: 'AAPL', price: 1 }] });
  const without = await call(tierWorld(), { action: 'buy', league_id: LEAGUE_ID, symbol: 'AAPL' });
  assertEquals(withRows.status, without.status);
  assertEquals(withRows.text, without.text);
}});

Deno.test({ name: 'list preview (fixed_notional, slotted): the funding body is unchanged and `rows` comes last', ...opts, async fn() {
  const world = tierWorld({ league: league({ stake_mode: 'fixed_notional', notional_per_slot: 1000 }) });
  const single = await call(world, { action: 'preview', league_id: LEAGUE_ID });
  const list = await call(world, { action: 'preview', league_id: LEAGUE_ID, rows: [{ symbol: 'AAPL', price: 150 }, { symbol: 'XOM', price: 150 }] });
  assertEquals(list.status, 200);
  const { rows, ...rest } = list.body;
  assertEquals(rest, single.body, 'everything but rows is the single preview body');
  assertEquals(Object.keys(list.body).at(-1), 'rows');
  assertEquals(rows, [
    { symbol: 'AAPL', price: 150, would_fill: { slot_id: 's-lo', slot_index: 0, slot_count: 1, price_min: 0, price_max: 200, category_id: null } },
    null,
  ]);
}});

Deno.test({ name: 'list preview (category league): an eligibility read error is a 500, never a flex-only guess', ...opts, async fn() {
  const r = await call(tierWorld({ slots: [CAT, FLEX], drafts: [], eligibilityError: true }), {
    action: 'preview', league_id: LEAGUE_ID, rows: [{ symbol: 'AAPL', price: 150 }],
  });
  assertEquals(r.status, 500);
  assertEquals(r.body, { ok: false, reason: 'unhandled' });
}});
