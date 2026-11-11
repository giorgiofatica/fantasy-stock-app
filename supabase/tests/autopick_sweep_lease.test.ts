/**
 * The per-turn lease, proven through the REAL draft-autopick-sweep handler
 * (supabase/functions/draft-autopick-sweep/index.ts), not a copy.
 *
 * HOW (same harness shape as cron_status_handlers.test.ts): Deno.serve is replaced
 * during the import so the handler is captured, and globalThis.fetch is a fake
 * PostgREST. One overdue turn is listed; claim_draft_turn_lease answers per
 * scenario; everything else reads as empty, so a worked turn ends at
 * 'league_not_found' after reading /rest/v1/leagues. That read is the observable
 * "this sweep worked the turn" (it is the first thing the work does).
 *
 * Mutations these catch: the sweep calling the work without withTurnLease (no
 * lease: a held turn is read and worked anyway); the lease claimed AFTER the read
 * (a held turn still reads leagues); a release that is not the claimer's holder;
 * a claim error that stops the turn (fail closed).
 *
 * Run:
 *   deno test --allow-read --allow-env supabase/tests/autopick_sweep_lease.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert';

const CRON_KEY = 'test-cron-key-not-a-secret';
const FAKE_ENV: Record<string, string> = {
  SB_SECRET_KEY_CRON: CRON_KEY,
  SUPABASE_URL: 'http://stub.supabase.test',
  SB_SECRET_KEY_INTERNAL: 'test-internal-key-not-a-secret',
  ALPACA_API_KEY: 'test-alpaca-id',
  ALPACA_API_SECRET: 'test-alpaca-secret',
};
const SAVED_ENV = new Map(Object.keys(FAKE_ENV).map((k) => [k, Deno.env.get(k)]));
for (const [k, v] of Object.entries(FAKE_ENV)) Deno.env.set(k, v);

const L = '00000000-0000-4000-8000-0000000000c1';
const HEADERS = { 'content-type': 'application/json', 'content-range': '*/0' };
const jsonRes = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: HEADERS });

interface Seen { method: string; path: string; params: URLSearchParams; body: unknown }

type Claim = 'true' | 'false' | 'error' | 'stateful';

function install(claim: Claim, opts: { leaguesGate?: Promise<void> } = {}) {
  const seen: Seen[] = [];
  const leases = new Map<string, string>();
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
    const req = input instanceof Request ? input : null;
    const url = new URL(req ? req.url : String(input));
    const method = (req?.method ?? init?.method ?? 'GET').toUpperCase();
    const raw = req ? await req.text() : (init?.body as string | undefined);
    const body = raw ? JSON.parse(raw) : undefined;
    if (url.host !== 'stub.supabase.test') throw new Error(`unexpected network call ${url}`); // no Alpaca, no Expo
    seen.push({ method, path: url.pathname, params: url.searchParams, body });
    const rpc = url.pathname.startsWith('/rest/v1/rpc/') ? url.pathname.split('/').pop() : null;
    if (rpc === 'overdue_draft_turns') return jsonRes([{ league_id: L, pick_number: 3, deadline_at: new Date(Date.now() - 5000).toISOString() }]);
    if (rpc === 'claim_draft_turn_lease') {
      if (claim === 'error') return jsonRes({ code: '42883', message: 'function does not exist' }, 404);
      if (claim === 'stateful') {
        const k = `${body.p_league_id}:${body.p_pick_number}`;
        if (leases.has(k)) return jsonRes(false);
        leases.set(k, body.p_holder);
        return jsonRes(true);
      }
      return jsonRes(claim === 'true');
    }
    if (rpc) return jsonRes([]); // due_draft_starts, draft_watch_due, unclocked_deleted_seat_turns
    if (url.pathname === '/rest/v1/draft_turn_leases' && method === 'DELETE') {
      const holder = url.searchParams.get('holder')?.replace('eq.', '');
      const k = `${url.searchParams.get('league_id')?.replace('eq.', '')}:${url.searchParams.get('pick_number')?.replace('eq.', '')}`;
      if (leases.get(k) === holder) leases.delete(k);
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/rest/v1/leagues' && opts.leaguesGate) await opts.leaguesGate;
    return jsonRes([]);
  }) as typeof fetch;
  return { seen, leases, restore: () => { globalThis.fetch = original; } };
}

type Handler = (req: Request) => Promise<Response>;
let handler: Handler | undefined;
async function load(): Promise<Handler> {
  if (handler) return handler;
  let captured: Handler | undefined;
  const original = Deno.serve;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (h: Handler) => { captured = h; return {}; };
  try {
    await import(new URL('../functions/draft-autopick-sweep/index.ts', import.meta.url).href);
  } finally {
    Deno.serve = original;
  }
  assert(captured, 'draft-autopick-sweep: index.ts did not call Deno.serve');
  handler = captured;
  return captured;
}

const call = (h: Handler) =>
  h(new Request('http://localhost/fn', { method: 'POST', headers: { apikey: CRON_KEY, 'content-type': 'application/json' }, body: '{}' }));

async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const o = { log: console.log, error: console.error, warn: console.warn };
  console.log = console.error = console.warn = () => {};
  try { return await fn(); } finally { Object.assign(console, o); }
}

const leagueReads = (seen: Seen[]) => seen.filter((s) => s.path === '/rest/v1/leagues').length;

Deno.test('a turn another sweep holds is reported lease_held and NOT read or worked (no Alpaca, nothing written)', async () => {
  const h = await load();
  const f = install('false');
  try {
    const body = await quiet(async () => (await call(h)).json());
    assertEquals(body.results, [{ league_id: L, pick_number: 3, outcome: 'lease_held' }]);
    assertEquals(body.errors, []);
    assertEquals(leagueReads(f.seen), 0, 'the held turn was never read');
    assertEquals(f.seen.filter((s) => s.method !== 'GET' && !s.path.startsWith('/rest/v1/rpc/')), [], 'nothing written');
  } finally {
    f.restore();
  }
});

Deno.test('a won lease: the turn is claimed FIRST, then read and worked, then released by the SAME holder', async () => {
  const h = await load();
  const f = install('true');
  try {
    const body = await quiet(async () => (await call(h)).json());
    assertEquals(body.errors, [{ league_id: L, pick_number: 3, outcome: 'league_not_found' }]);
    const claimAt = f.seen.findIndex((s) => s.path === '/rest/v1/rpc/claim_draft_turn_lease');
    const readAt = f.seen.findIndex((s) => s.path === '/rest/v1/leagues');
    const releaseAt = f.seen.findIndex((s) => s.path === '/rest/v1/draft_turn_leases' && s.method === 'DELETE');
    assert(claimAt >= 0 && claimAt < readAt && readAt < releaseAt, `order claim ${claimAt} < read ${readAt} < release ${releaseAt}`);
    const claim = f.seen[claimAt].body as Record<string, unknown>;
    assertEquals([claim.p_league_id, claim.p_pick_number, claim.p_ttl_ms], [L, 3, 60_000]);
    const rel = f.seen[releaseAt].params;
    assertEquals(rel.get('holder'), `eq.${claim.p_holder}`, 'released by its own holder token');
    assertEquals([rel.get('league_id'), rel.get('pick_number')], [`eq.${L}`, 'eq.3']);
  } finally {
    f.restore();
  }
});

Deno.test('FAIL OPEN: a claim error still works the turn (reported lease_error), and releases nothing', async () => {
  const h = await load();
  const f = install('error');
  try {
    const body = await quiet(async () => (await call(h)).json());
    assertEquals(body.errors, [{ league_id: L, pick_number: 3, outcome: 'league_not_found', lease_error: true }]);
    assertEquals(leagueReads(f.seen), 1);
    assertEquals(f.seen.filter((s) => s.path === '/rest/v1/draft_turn_leases').length, 0);
  } finally {
    f.restore();
  }
});

Deno.test('two overlapping sweeps (2 s ticks over a slow attempt): ONE works the turn, the other is held', async () => {
  const h = await load();
  let open!: () => void;
  const gate = new Promise<void>((r) => (open = r));
  const f = install('stateful', { leaguesGate: gate }); // the first sweep's read is slow
  try {
    await quiet(async () => {
      const first = call(h);
      // Wait until the first sweep has claimed and is inside its (slow) work.
      for (let i = 0; i < 200 && leagueReads(f.seen) === 0; i++) await new Promise((r) => setTimeout(r, 1));
      assertEquals(leagueReads(f.seen), 1);
      const second = await (await call(h)).json();
      assertEquals(second.results, [{ league_id: L, pick_number: 3, outcome: 'lease_held' }]);
      open();
      const firstBody = await (await first).json();
      assertEquals(firstBody.errors, [{ league_id: L, pick_number: 3, outcome: 'league_not_found' }]);
    });
    assertEquals(leagueReads(f.seen), 1, 'the turn was worked once');
    assertEquals(f.leases.size, 0, 'released after the work');
  } finally {
    f.restore();
  }
});

Deno.test('env restored', () => {
  for (const [k, v] of SAVED_ENV) { if (v === undefined) Deno.env.delete(k); else Deno.env.set(k, v); }
});
