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
 *      end: it reads the caller's saved stocks through get_league_watchlist WITH
 *      THE CALLER'S TOKEN (so RLS and the reader's held/stale rule decide; never
 *      the table, 20261211), answers only saved symbols, reads category eligibility only
 *      for saved symbols, refuses an over-long list before any league read,
 *      and refuses a request naming both shapes.
 *
 *   3. The GATE and the PACING (plan part 3 point 7, preview-gate.ts): a preview
 *      naming a stock the buy would refuse as not_draftable answers that refusal
 *      and reads no category; a preview that reads a category is counted on its
 *      own hour/day buckets (past either: 200 preview_limited, not the minute's
 *      429 rate_limited); a buy and a sell run (to a recorded trade) with
 *      those buckets exhausted.
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
  /** rows get_league_watchlist leaves out (the caller holds the stock, or the row is stale:
   * 20261210500000). They are still in the TABLE: a table read would count them. */
  hiddenByReader?: string[];
  /** the category-override read fails (fetchEligibleCategoryIds* throw on it) */
  eligibilityError?: boolean;
  /** symbols.is_draftable false for these (every other catalog symbol is true) */
  undraftable?: string[];
  /** catalog symbols with no industry (unclassified), beyond `industries` */
  extraSymbols?: string[];
  /** a read of symbols.is_draftable fails */
  draftableError?: boolean;
  /** the rate limiter's counters, `${bucket}|${subject}` -> hits (it really counts) */
  counters: Map<string, number>;
  /** the limiter answers an error for these buckets */
  limiterError?: string[];
  /** today is a full-day trading session (buys and sells pass the market gate) */
  marketOpen?: boolean;
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
    counters: new Map(),
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
  /** an rpc's JSON arguments */
  rpcBody?: Record<string, unknown>;
}

const json = (b: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json', ...extra } });

/** PostgREST's answer to a list read: rows + an exact count (readAllPages trusts it). */
const rowsResponse = (rows: unknown[]) =>
  json(rows, 200, { 'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0' });

/** An `in.(...)` list as PostgREST parses it: values may be double-quoted
 * (supabase-js quotes any value holding , ( or )). */
function parseInList(v: string): string[] {
  const body = v.slice(4, -1);
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of body) {
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** Today's date in New York, as market_calendar keys it. */
function etToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** eq./in. filters, as PostgREST reads them from the query string. */
function filterRows<T extends Record<string, unknown>>(rows: T[], q: URLSearchParams): T[] {
  return rows.filter((r) => {
    for (const [k, v] of q) {
      if (k === 'select' || k === 'order' || k === 'offset' || k === 'limit') continue;
      if (v.startsWith('eq.')) { if (String(r[k]) !== v.slice(3)) return false; continue; }
      if (v.startsWith('in.(')) {
        if (!parseInList(v).includes(String(r[k]))) return false;
        continue;
      }
    }
    return true;
  });
}

function install(world: World, seen: Seen[]): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(req.url);
    // Alpaca's latest trade: every symbol fills at $150.
    if (url.hostname === 'data.alpaca.markets') return json({ trade: { p: 150 } });
    if (url.pathname === '/auth/v1/user') {
      return req.headers.get('Authorization') === `Bearer ${USER_JWT}`
        ? json({ id: USER_ID, aud: 'authenticated', role: 'authenticated' })
        : json({ code: 403, error_code: 'bad_jwt', msg: 'invalid JWT' }, 403);
    }
    const table = url.pathname.replace(/^\/rest\/v1\//, '');
    seen.push({ method: req.method, table, query: url.searchParams, authorization: req.headers.get('Authorization'), apikey: req.headers.get('apikey') });
    if (table.startsWith('rpc/')) {
      // Take this call's entry BEFORE awaiting: concurrent rpcs (the two pacing
      // bumps run in parallel) would otherwise all write the last entry.
      const entry = seen[seen.length - 1];
      const args = await req.json().catch(() => ({})) as Record<string, unknown>;
      entry.rpcBody = args;
      if (table === 'rpc/check_and_bump_rate_limit') {
        // The real limiter's contract: bump, then true while hits <= p_limit.
        if (world.limiterError?.includes(String(args.p_bucket))) return json({ code: 'XX000', message: 'boom' }, 500);
        const key = `${args.p_bucket}|${args.p_subject}`;
        const hits = (world.counters.get(key) ?? 0) + 1;
        world.counters.set(key, hits);
        return json(hits <= Number(args.p_limit));
      }
      if (table === 'rpc/get_league_watchlist') {
        // The reader, modelled: the CALLER's rows in that league (auth.uid() + is_member), minus
        // what it leaves out (held or stale). Called without the caller's token it raises 42501.
        if (world.watchlistError) return json({ code: 'XX000', message: 'boom' }, 500);
        if (req.headers.get('Authorization') !== `Bearer ${USER_JWT}`) return json({ code: '42501', message: 'not authenticated' }, 403);
        const hidden = new Set(world.hiddenByReader ?? []);
        return json(world.watchlist
          .filter((w) => w.user_id === USER_ID && w.league_id === args.p_league_id && !hidden.has(w.symbol))
          .map((w) => ({ symbol: w.symbol, name: `${w.symbol} Inc.`, category_ids: [], is_draftable: true, saved_at: '2026-11-23T00:00:00Z' })));
      }
      if (table === 'rpc/record_trade_atomic') {
        return json({ ok: true, trade: { id: 'new-trade', symbol: args.p_symbol, action: args.p_action, price: args.p_price } });
      }
      return json({ code: 'PGRST202', message: `unexpected rpc ${table}` }, 404);
    }
    const single = (req.headers.get('accept') ?? '').includes('vnd.pgrst.object');
    const q = url.searchParams;
    switch (table) {
      // Never refreshed -> market: null (deterministic), unless the world opens it.
      case 'market_calendar_coverage':
        return json(world.marketOpen ? { covered_from: etToday(), covered_through: etToday() } : null);
      case 'market_calendar':
        return rowsResponse(world.marketOpen ? [{ session_date: etToday(), open_et: '00:00:00', close_et: '23:59:59' }] : []);
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
        if (world.draftableError && (q.get('select') ?? '').includes('is_draftable')) {
          return json({ code: 'XX000', message: 'boom' }, 500);
        }
        const off = new Set(world.undraftable ?? []);
        const all = [
          ...Object.entries(world.industries).map(([symbol, gics_industry]) => ({ symbol, gics_industry })),
          ...(world.extraSymbols ?? []).map((symbol) => ({ symbol, gics_industry: null })),
        ].map((r) => ({ ...r, is_draftable: !off.has(r.symbol) }));
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
  assertEquals(none.seen.filter((s) => s.table === 'watchlist' || s.table === 'rpc/get_league_watchlist'), []);
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

Deno.test({ name: 'list preview: saved stocks are read through get_league_watchlist with the CALLER\'s token, never the table or the secret key', ...opts, async fn() {
  const r = await call(tierWorld(), { action: 'preview', league_id: LEAGUE_ID, rows: [{ symbol: 'AAPL', price: 150 }] });
  assertEquals(r.seen.filter((s) => s.table === 'watchlist'), [], 'the table is never read directly');
  const reads = r.seen.filter((s) => s.table === 'rpc/get_league_watchlist');
  assertEquals(reads.length, 1);
  assertEquals(reads[0].authorization, `Bearer ${USER_JWT}`);
  assertEquals(reads[0].apikey, PUBLISHABLE);
  // Only the league: the reader keys on auth.uid(); no requested string reaches it.
  assertEquals(reads[0].rpcBody, { p_league_id: LEAGUE_ID });
}});

Deno.test({ name: 'list preview: a HELD or STALE saved row (left out by the reader) is not answered, though the table still has it', ...opts, async fn() {
  // AAPL and MSFT are both in the caller's table rows; the reader leaves out MSFT (say the caller
  // bought it while a save raced: a stranded held row, or one bought and sold since: stale).
  const r = await call(tierWorld({ hiddenByReader: ['MSFT'] }), {
    action: 'preview', league_id: LEAGUE_ID, rows: [{ symbol: 'AAPL', price: 150 }, { symbol: 'MSFT', price: 150 }],
  });
  assertEquals(r.status, 200);
  const rows = r.body.rows as Array<{ symbol: string } | null>;
  assertEquals(rows[0]?.symbol, 'AAPL');
  assertEquals(rows[1], null, 'MSFT does not count as saved');
  // And its category is never looked up (only saved symbols reach the category read).
  const catReads = r.seen.filter((s) => ['symbol_category_overrides', 'category_rules'].includes(s.table));
  for (const s of catReads) assert(!(s.query.get('symbol') ?? '').includes('MSFT'), 'no category read for MSFT');
}});

Deno.test({ name: 'list preview: a saved symbol with $ / ^ / = (the table allows them) is answered like any other', ...opts, async fn() {
  const world = tierWorld();
  for (const symbol of ['BF$B', '^GSPC', 'ABC=W', 'A,B']) world.watchlist.push({ league_id: LEAGUE_ID, user_id: USER_ID, symbol });
  // In the catalog and draftable, so the buy's gate (point 7) lets them through.
  world.extraSymbols = ['BF$B', '^GSPC', 'ABC=W', 'A,B'];
  const r = await call(world, {
    action: 'preview', league_id: LEAGUE_ID,
    rows: [{ symbol: 'AAPL', price: 150 }, { symbol: 'bf$b', price: 150 }, { symbol: '^GSPC', price: 150 }, { symbol: 'ABC=W', price: 150 }, { symbol: 'A,B', price: 150 }],
  });
  assertEquals(r.status, 200);
  const rows = r.body.rows as Array<{ symbol: string; would_fill: unknown } | null>;
  assert(rows[0] !== null, 'AAPL is answered');
  for (const [i, sym] of [[1, 'BF$B'], [2, '^GSPC'], [3, 'ABC=W'], [4, 'A,B']] as const) {
    assert(rows[i] !== null, `${sym} is saved and gets an answer`);
    assertEquals(rows[i]?.symbol, sym);
    assertEquals(rows[i]?.would_fill, rows[0]?.would_fill, `${sym} fits as AAPL does at the same price`);
  }
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
  assertEquals(r.seen.filter((s) => s.table === 'watchlist' || s.table === 'rpc/get_league_watchlist'), []);
}});

Deno.test({ name: 'list preview: 51 rows is a bad_request before any league read', ...opts, async fn() {
  const rows = Array.from({ length: 51 }, (_, i) => ({ symbol: `S${i}`, price: 10 }));
  const r = await call(tierWorld(), { action: 'preview', league_id: LEAGUE_ID, rows });
  assertEquals(r.status, 400);
  assertEquals(r.body, { ok: false, reason: 'bad_request' });
  assertEquals(r.seen.filter((s) => ['leagues', 'watchlist', 'rpc/get_league_watchlist', 'drafts', 'trades'].includes(s.table)), []);
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

// ---------------------------------------------------------------------------
// 3. The gate and the pacing (plan part 3 point 7, preview-gate.ts)
// ---------------------------------------------------------------------------

const HOUR = 'record-trade-preview-hour';
const DAY = 'record-trade-preview-day';
const CATEGORY_TABLES = ['symbol_category_overrides', 'category_rules'];
const NOT_DRAFTABLE = JSON.stringify({ ok: false, reason: 'not_draftable' });

/** The preview buckets' bumps in one call (the buy/sell limiter's are not). */
const previewBumps = (seen: Seen[]) =>
  seen.filter((s) => s.table === 'rpc/check_and_bump_rate_limit' && String(s.rpcBody?.p_bucket).startsWith('record-trade-preview'));
/** Any read that looks up a category: the overrides, the rules, or symbols.gics_industry. */
const categoryReads = (seen: Seen[]) =>
  seen.filter((s) => CATEGORY_TABLES.includes(s.table) || (s.table === 'symbols' && (s.query.get('select') ?? '').includes('gics_industry')));
const catWorld = (over: Partial<World> = {}) => tierWorld({ slots: [CAT, FLEX], drafts: [], ...over });
const hits = (world: World, bucket: string) => world.counters.get(`${bucket}|user:${USER_ID}`) ?? 0;

Deno.test({ name: 'gate: a not-draftable stock gets the buy\'s own refusal, no would_fill, and its category is never read', ...opts, async fn() {
  const world = catWorld({ undraftable: ['XOM'] });
  const r = await call(world, { action: 'preview', league_id: LEAGUE_ID, symbol: 'XOM', price: 90 });
  assertEquals(r.status, 200);
  assertEquals(r.text, NOT_DRAFTABLE);
  assertEquals(categoryReads(r.seen), [], 'the category read is never made');
  assertEquals(r.seen.filter((s) => ['drafts', 'trades', 'league_draft_slots'].includes(s.table)), [], 'answered before the ledger read');
  assertEquals(previewBumps(r.seen), [], 'no category read, so not counted');
}});

Deno.test({ name: 'gate: the refusal is the BUY\'s, byte for byte (same body as a buy of that stock)', ...opts, async fn() {
  const world = catWorld({ undraftable: ['XOM'], marketOpen: true });
  const preview = await call(world, { action: 'preview', league_id: LEAGUE_ID, symbol: 'XOM', price: 90 });
  const buy = await call(world, { action: 'buy', league_id: LEAGUE_ID, symbol: 'XOM' });
  assertEquals(buy.status, preview.status);
  assertEquals(buy.text, preview.text);
}});

Deno.test({ name: 'gate: applies to every preview naming a stock (price tiers, and a slot-less budget_cap league too)', ...opts, async fn() {
  const tiers = await call(tierWorld({ undraftable: ['AAPL'] }), { action: 'preview', league_id: LEAGUE_ID, symbol: 'AAPL', price: 150 });
  assertEquals(tiers.text, NOT_DRAFTABLE);
  const budget = await call(tierWorld({ undraftable: ['AAPL'], slots: [], league: league({ stake_mode: 'budget_cap', budget_amount: 1000 }) }), {
    action: 'preview', league_id: LEAGUE_ID, symbol: 'AAPL', price: 150,
  });
  assertEquals(budget.text, NOT_DRAFTABLE);
  // A symbol named with no price is still a stock named.
  const noPrice = await call(catWorld({ undraftable: ['XOM'] }), { action: 'preview', league_id: LEAGUE_ID, symbol: 'XOM' });
  assertEquals(noPrice.text, NOT_DRAFTABLE);
  assertEquals(categoryReads(noPrice.seen), []);
}});

Deno.test({ name: 'gate: a stock with no catalog row is not draftable, as for the buy', ...opts, async fn() {
  const r = await call(catWorld(), { action: 'preview', league_id: LEAGUE_ID, symbol: 'NOPE', price: 10 });
  assertEquals(r.text, NOT_DRAFTABLE);
  assertEquals(categoryReads(r.seen), []);
}});

Deno.test({ name: 'gate: the same stock in a full-universe league (allow_undraftable) is answered, and counted once', ...opts, async fn() {
  const world = catWorld({ undraftable: ['XOM'], league: league({ allow_undraftable: true }) });
  const r = await call(world, { action: 'preview', league_id: LEAGUE_ID, symbol: 'XOM', price: 90 });
  assertEquals(r.status, 200);
  assertEquals(r.body.ok, true);
  assertEquals(r.body.would_fill, { slot_id: 's-flex', slot_index: 1, slot_count: 1, price_min: null, price_max: null, category_id: null });
  assertEquals([hits(world, HOUR), hits(world, DAY)], [1, 1]);
}});

Deno.test({ name: 'gate: an is_draftable read error is a 500 (single and list), never an answer or a refusal', ...opts, async fn() {
  const single = await call(catWorld({ draftableError: true }), { action: 'preview', league_id: LEAGUE_ID, symbol: 'AAPL', price: 150 });
  assertEquals(single.status, 500);
  assertEquals(single.body, { ok: false, reason: 'unhandled' });
  assertEquals(categoryReads(single.seen), []);
  const list = await call(catWorld({ draftableError: true }), { action: 'preview', league_id: LEAGUE_ID, rows: [{ symbol: 'AAPL', price: 150 }] });
  assertEquals(list.status, 500);
  assertEquals(list.body, { ok: false, reason: 'unhandled' });
}});

Deno.test({ name: 'pacing: a category preview bumps its OWN hour (200) and day (500) buckets, per person', ...opts, async fn() {
  const world = catWorld();
  const r = await call(world, { action: 'preview', league_id: LEAGUE_ID, symbol: 'AAPL', price: 150 });
  assertEquals(r.status, 200);
  assertEquals(previewBumps(r.seen).map((s) => s.rpcBody), [
    { p_bucket: HOUR, p_subject: `user:${USER_ID}`, p_limit: 200, p_window_seconds: 3600 },
    { p_bucket: DAY, p_subject: `user:${USER_ID}`, p_limit: 500, p_window_seconds: 86400 },
  ]);
  // Bumped through the service-role client (the limiter is service_role-only).
  for (const s of previewBumps(r.seen)) assertEquals(s.apikey, SECRET);
}});

Deno.test({ name: 'pacing: the 200th category preview in the hour is answered, the 201st gets preview_limited with no category read', ...opts, async fn() {
  const world = catWorld();
  world.counters.set(`${HOUR}|user:${USER_ID}`, 199);
  const ok = await call(world, { action: 'preview', league_id: LEAGUE_ID, symbol: 'AAPL', price: 150 });
  assertEquals(ok.status, 200);
  assertEquals(ok.body.ok, true);
  const refused = await call(world, { action: 'preview', league_id: LEAGUE_ID, symbol: 'AAPL', price: 150 });
  // Its own reason, as a 200 refusal: distinguishable from the per-minute 429 rate_limited.
  assertEquals(refused.status, 200);
  assertEquals(refused.text, JSON.stringify({ ok: false, reason: 'preview_limited' }));
  assertEquals(categoryReads(refused.seen), [], 'refused before the read it protects');
}});

Deno.test({ name: 'pacing: the 501st category preview in the day is refused', ...opts, async fn() {
  const world = catWorld();
  world.counters.set(`${DAY}|user:${USER_ID}`, 500);
  const r = await call(world, { action: 'preview', league_id: LEAGUE_ID, symbol: 'AAPL', price: 150 });
  assertEquals(r.status, 200);
  assertEquals(r.text, JSON.stringify({ ok: false, reason: 'preview_limited' }));
  assertEquals(categoryReads(r.seen), []);
}});

Deno.test({ name: 'pacing: with both preview buckets exhausted, a buy and a sell still go through (and never touch them)', ...opts, async fn() {
  const world = catWorld({
    marketOpen: true,
    drafts: [{ id: 'd1', user_id: USER_ID, symbol: 'XOM', entry_price: 90, quantity: 1, pick_number: 1, slot_id: 's-flex' }],
  });
  world.counters.set(`${HOUR}|user:${USER_ID}`, 10_000);
  world.counters.set(`${DAY}|user:${USER_ID}`, 10_000);
  const paced = await call(world, { action: 'preview', league_id: LEAGUE_ID, symbol: 'AAPL', price: 150 });
  assertEquals(paced.body, { ok: false, reason: 'preview_limited' }, 'the preview is refused');
  const buy = await call(world, { action: 'buy', league_id: LEAGUE_ID, symbol: 'AAPL' });
  assertEquals(buy.status, 200);
  assertEquals(buy.body.ok, true, buy.text);
  assertEquals(buy.seen.filter((s) => s.table === 'rpc/record_trade_atomic').length, 1, 'the buy was recorded');
  assertEquals(previewBumps(buy.seen), []);
  const sell = await call(world, { action: 'sell', league_id: LEAGUE_ID, symbol: 'XOM' });
  assertEquals(sell.status, 200);
  assertEquals(sell.body.ok, true, sell.text);
  assertEquals(previewBumps(sell.seen), []);
}});

Deno.test({ name: 'pacing: NOT counted when no category is read (no stock named; a price-tier league; the list preview)', ...opts, async fn() {
  const world = catWorld();
  await call(world, { action: 'preview', league_id: LEAGUE_ID });
  await call(world, { action: 'preview', league_id: LEAGUE_ID, price: 150 });
  await call(world, { action: 'preview', league_id: LEAGUE_ID, rows: [{ symbol: 'AAPL', price: 150 }] });
  const tiers = tierWorld();
  await call(tiers, { action: 'preview', league_id: LEAGUE_ID, symbol: 'AAPL', price: 150 });
  assertEquals([hits(world, HOUR), hits(world, DAY), hits(tiers, HOUR), hits(tiers, DAY)], [0, 0, 0, 0]);
  // A symbol-less preview stays answerable with the buckets exhausted.
  world.counters.set(`${HOUR}|user:${USER_ID}`, 10_000);
  const r = await call(world, { action: 'preview', league_id: LEAGUE_ID });
  assertEquals(r.status, 200);
  assertEquals(r.body.ok, true);
}});

Deno.test({ name: 'pacing: a limiter error is a 500 (fail-closed), never preview_limited and never an unpaced read', ...opts, async fn() {
  for (const bucket of [HOUR, DAY]) {
    const r = await call(catWorld({ limiterError: [bucket] }), { action: 'preview', league_id: LEAGUE_ID, symbol: 'AAPL', price: 150 });
    assertEquals(r.status, 500, bucket);
    assertEquals(r.body, { ok: false, reason: 'unhandled' });
    assertEquals(categoryReads(r.seen), [], `${bucket}: no category read`);
  }
}});

Deno.test({ name: 'list preview: the gate per row: a saved not-draftable stock is null and its category is never read', ...opts, async fn() {
  const world = catWorld({ undraftable: ['MSFT'] });
  const r = await call(world, { action: 'preview', league_id: LEAGUE_ID, rows: [{ symbol: 'AAPL', price: 150 }, { symbol: 'MSFT', price: 150 }] });
  assertEquals(r.status, 200);
  const rows = r.body.rows as Array<{ would_fill: { slot_id: string } | null } | null>;
  assertEquals(rows[0]?.would_fill?.slot_id, 's-cat');
  assertEquals(rows[1], null);
  for (const s of categoryReads(r.seen)) {
    const filter = s.query.get('symbol') ?? s.query.get('gics_industry') ?? '';
    assert(!/MSFT|Software/.test(filter), `${s.table} was asked about a not-draftable stock: ${filter}`);
  }
  // In a full-universe league the same saved stock is answered.
  const full = await call(catWorld({ undraftable: ['MSFT'], league: league({ allow_undraftable: true }) }), {
    action: 'preview', league_id: LEAGUE_ID, rows: [{ symbol: 'MSFT', price: 150 }],
  });
  assertEquals((full.body.rows as Array<{ would_fill: { slot_id: string } } | null>)[0]?.would_fill?.slot_id, 's-cat');
}});

Deno.test({ name: 'pacing: the per-minute limiter still answers its own 429 rate_limited (the two are told apart)', ...opts, async fn() {
  const world = catWorld();
  world.counters.set(`record-trade|user:${USER_ID}`, 30);
  const r = await call(world, { action: 'preview', league_id: LEAGUE_ID, symbol: 'AAPL', price: 150 });
  assertEquals(r.status, 429);
  assertEquals(r.body, { ok: false, reason: 'rate_limited' });
}});
