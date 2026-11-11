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

/** A live draft for the fake to serve (otherwise every table reads as empty):
 * members A, B, C in that order, 3 rounds, `picks` drafts rows, and
 * get_draft_clock reporting `clockPicks` picks made, past its deadline. `listed`
 * says which pass lists pick `listedPick`: the overdue pass or the deleted-seat
 * pass (unclocked_deleted_seat_turns). */
interface DraftFixture {
  picks: number;
  clockPicks: number;
  listedPick: number;
  listed: 'overdue' | 'deleted_seat';
}
const ORDER = ['A', 'B', 'C'];

function install(claim: Claim, opts: { leaguesGate?: Promise<void>; draft?: DraftFixture } = {}) {
  const d = opts.draft;
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
    if (rpc === 'overdue_draft_turns') {
      if (d && d.listed !== 'overdue') return jsonRes([]);
      return jsonRes([{ league_id: L, pick_number: d?.listedPick ?? 3, deadline_at: new Date(Date.now() - 5000).toISOString() }]);
    }
    if (d && rpc === 'unclocked_deleted_seat_turns') {
      return jsonRes(d.listed === 'deleted_seat' ? [{ league_id: L, pick_number: d.listedPick }] : []);
    }
    if (d && rpc === 'get_draft_clock') {
      const now = Date.now();
      return jsonRes([{
        draft_status: 'in_progress',
        clock_running: d.listed === 'overdue',
        pick_seconds: 60,
        picks_made: d.clockPicks,
        turn_started_at: new Date(now - 70_000).toISOString(),
        deadline_at: new Date(now - 10_000).toISOString(),
        server_now: new Date(now).toISOString(),
      }]);
    }
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
    if (d && method === 'GET') {
      if (url.pathname === '/rest/v1/leagues') {
        return jsonRes([{
          id: L, name: 'Lease League', commissioner_id: 'A', num_rounds: 3, draft_status: 'in_progress',
          stake_mode: 'no_budget', budget_amount: null, notional_per_slot: 1000, allow_undraftable: false,
          league_type: 'duration', num_weeks: 4, duration_days: 28, playoff_teams: 0,
        }]);
      }
      if (url.pathname === '/rest/v1/league_members') return jsonRes(ORDER.map((user_id) => ({ user_id })));
      if (url.pathname === '/rest/v1/league_draft_order') return jsonRes(ORDER.map((user_id, i) => ({ position: i + 1, user_id })));
      if (url.pathname === '/rest/v1/drafts') {
        return jsonRes(Array.from({ length: d.picks }, (_, i) => ({
          user_id: ORDER[i % ORDER.length], symbol: `S${i + 1}`, entry_price: 10, quantity: 1, pick_number: i + 1, slot_id: null,
        })));
      }
    }
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

// ---------------------------------------------------------------------------
// The leased turn is the worked turn (Orchestrator mutant M16, 2026-11-11).
// workTurn acts only if the listed pick_number is still current by BOTH the
// context it read (ctx.picks) and the clock it read (get_draft_clock), because
// the lease is keyed on the LISTED pick: acting on any other turn would work a
// turn this sweep holds no lease on. Mutations: the guard replaced by false
// (M16); either side of its || dropped.
// ---------------------------------------------------------------------------

/** One sweep against `draft`; every write and every off-stub call is recorded
 * (an Alpaca or Expo call throws in the fake, and so cannot pass unnoticed). */
async function staleRun(draft: DraftFixture) {
  const h = await load();
  const f = install('stateful', { draft });
  try {
    const body = await quiet(async () => (await call(h)).json());
    const claims = f.seen.filter((s) => s.path === '/rest/v1/rpc/claim_draft_turn_lease');
    const releases = f.seen.filter((s) => s.path === '/rest/v1/draft_turn_leases' && s.method === 'DELETE');
    const writes = f.seen.filter((s) => s.method !== 'GET' && !s.path.startsWith('/rest/v1/rpc/') && s.path !== '/rest/v1/draft_turn_leases');
    const rpcs = f.seen.filter((s) => s.path.startsWith('/rest/v1/rpc/')).map((s) => s.path.split('/').pop());
    // league_members is read once by loadDraftContext; the deleted-seat decision's
    // seatReader reads it again, so a second read means the seat was looked up.
    const memberReads = f.seen.filter((s) => s.path === '/rest/v1/league_members').length;
    return { body, claims, releases, writes, rpcs, memberReads, leases: f.leases };
  } finally {
    f.restore();
  }
}

/** Nothing past the stale check ran: no stall/outage reads (autoPickTurn's
 * first steps), no search, no seat read, nothing written, the lease released. */
function assertStaleNoWork(r: Awaited<ReturnType<typeof staleRun>>, pick: number) {
  assertEquals(r.body.results, [{ league_id: L, pick_number: pick, outcome: 'stale_pick_number' }]);
  assertEquals(r.body.errors, []);
  assertEquals(r.claims.length, 1);
  assertEquals((r.claims[0].body as Record<string, unknown>).p_pick_number, pick, 'the lease was taken on the LISTED pick');
  assertEquals(r.writes, [], 'nothing written');
  for (const name of ['auto_pick_search_candidates', 'note_draft_bounded', 'record_live_prices']) {
    assert(!r.rpcs.includes(name), `${name} must not run for a stale turn`);
  }
  assertEquals(r.releases.length, 1);
  assertEquals(r.releases[0].params.get('holder'), `eq.${(r.claims[0].body as Record<string, unknown>).p_holder}`);
  assertEquals(r.leases.size, 0, 'the lease was released');
}

Deno.test('(a) OVERDUE: the listed pick landed before the lease was won (ctx and clock both moved on) -> stale_pick_number, no work', async () => {
  // Pick 3 was listed; by the time this sweep holds the lease, 3 picks exist.
  assertStaleNoWork(await staleRun({ listed: 'overdue', listedPick: 3, picks: 3, clockPicks: 3 }), 3);
});

Deno.test('(b) DELETED SEAT: the listed pick landed before the lease was won -> stale_pick_number, no seat read, no work', async () => {
  const r = await staleRun({ listed: 'deleted_seat', listedPick: 3, picks: 3, clockPicks: 3 });
  assertStaleNoWork(r, 3);
  assertEquals(r.memberReads, 1, 'only the context load read league_members: the seat was never looked up');
});

Deno.test('(c1) the CLOCK has moved on but the context has not (ctx.picks + 1 = N, clock.picksMade = N) -> stale_pick_number (pins the clock side of the ||)', async () => {
  assertStaleNoWork(await staleRun({ listed: 'overdue', listedPick: 3, picks: 2, clockPicks: 3 }), 3);
  assertStaleNoWork(await staleRun({ listed: 'deleted_seat', listedPick: 3, picks: 2, clockPicks: 3 }), 3);
});

Deno.test('(c2) the CONTEXT has moved on but the clock has not (ctx.picks = N, clock.picksMade + 1 = N) -> stale_pick_number (pins the context side of the ||)', async () => {
  assertStaleNoWork(await staleRun({ listed: 'overdue', listedPick: 3, picks: 3, clockPicks: 2 }), 3);
  assertStaleNoWork(await staleRun({ listed: 'deleted_seat', listedPick: 3, picks: 3, clockPicks: 2 }), 3);
});

Deno.test('control: a CURRENT listed turn (ctx and clock agree) passes the guard and is worked under the lease', async () => {
  // Same fixture, in sync: the overdue turn reaches autoPickTurn (its stall read
  // and search run); the deleted-seat turn reaches the seat decision. So the
  // stale cases above are refused by the guard, not by a broken fixture.
  const over = await staleRun({ listed: 'overdue', listedPick: 3, picks: 2, clockPicks: 2 });
  assert(over.body.results.concat(over.body.errors).every((e: { outcome: string }) => e.outcome !== 'stale_pick_number'), JSON.stringify(over.body));
  assert(over.rpcs.includes('auto_pick_search_candidates'), `the overdue turn was searched: ${over.rpcs}`);
  assertEquals(over.leases.size, 0);
  const seat = await staleRun({ listed: 'deleted_seat', listedPick: 3, picks: 2, clockPicks: 2 });
  const out = seat.body.results.concat(seat.body.errors);
  assertEquals(out.length, 1);
  assert(out[0].outcome !== 'stale_pick_number', JSON.stringify(seat.body));
  assert(seat.memberReads >= 2, `the in-sync deleted-seat turn looked the seat up (${seat.memberReads} member reads)`);
  assertEquals(seat.leases.size, 0);
});

Deno.test('env restored', () => {
  for (const [k, v] of SAVED_ENV) { if (v === undefined) Deno.env.delete(k); else Deno.env.set(k, v); }
});
