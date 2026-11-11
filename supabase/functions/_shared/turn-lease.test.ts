/**
 * Hermetic tests for the sweep's per-turn lease (./turn-lease.ts). The fake
 * admin emulates public.claim_draft_turn_lease (20261202000000) on an in-memory
 * table with a controllable clock: a claim wins when there is no row or the row
 * has expired. The PGlite suite (supabase/tests/draft_turn_lease.pglite.test.ts)
 * proves the SQL itself. Run:
 *
 *   deno test supabase/functions/_shared/turn-lease.test.ts
 *
 * Mutations these catch: withTurnLease running the work without a won claim (no
 * lease); a lease that never expires (claim ignores expires_at, or the TTL grows
 * past the SQL clamp); a release that is not scoped to its holder; a claim error
 * that stops the turn (fail closed).
 */
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert';
import { WALL_BUDGET_MS } from './auto-pick.ts';
import { claimTurnLease, LEASE_MARGIN_MS, TURN_LEASE_TTL_MS, withTurnLease } from './turn-lease.ts';

interface Lease { holder: string; expiresAt: number }

// deno-lint-ignore no-explicit-any
function leaseAdmin(opts: { claimError?: boolean; claimData?: unknown } = {}): any {
  const clock = { now: 1_000_000 };
  const leases = new Map<string, Lease>();
  const calls: string[] = [];
  const ttls: number[] = [];
  const key = (l: unknown, p: unknown) => `${l}:${p}`;
  const rpc = async (name: string, a: Record<string, unknown>) => {
    calls.push(`rpc.${name}`);
    await Promise.resolve(); // a real round trip: let concurrent callers interleave
    if (opts.claimError) return { data: null, error: { code: '42883', message: 'missing' } };
    if (opts.claimData !== undefined) return { data: opts.claimData, error: null };
    const ttl = Math.min(Math.max(Number(a.p_ttl_ms) || 0, 1000), 120000); // the SQL clamp
    ttls.push(Number(a.p_ttl_ms));
    const k = key(a.p_league_id, a.p_pick_number);
    const cur = leases.get(k);
    if (cur && cur.expiresAt > clock.now) return { data: false, error: null };
    leases.set(k, { holder: String(a.p_holder), expiresAt: clock.now + ttl });
    return { data: true, error: null };
  };
  const from = (table: string) => {
    const eqs: Record<string, unknown> = {};
    let op = 'select';
    // deno-lint-ignore no-explicit-any
    const b: any = {
      delete() { op = 'delete'; return b; },
      eq(k: string, v: unknown) { eqs[k] = v; return b; },
      then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
        if (table === 'draft_turn_leases' && op === 'delete') {
          calls.push(`release:${eqs.holder}`);
          const k = key(eqs.league_id, eqs.pick_number);
          // Scoped by holder, exactly like the real .eq('holder', ...) filter.
          if (leases.get(k)?.holder === eqs.holder) leases.delete(k);
        }
        return Promise.resolve({ data: null, error: null }).then(res, rej);
      },
    };
    return b;
  };
  return { clock, leases, calls, ttls, rpc, from };
}

const quiet = async <T>(fn: () => Promise<T>): Promise<T> => {
  const e = console.error;
  console.error = () => {};
  try { return await fn(); } finally { console.error = e; }
};

Deno.test('two overlapping sweeps on one turn: exactly ONE works it, the other is held and spends nothing', async () => {
  const admin = leaseAdmin();
  let runs = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const slowAttempt = async () => {
    runs++;
    await gate; // a slow outage attempt, still running when the next tick lands
    return 'done';
  };
  const first = withTurnLease(admin, 'L1', 7, slowAttempt);
  await Promise.resolve();
  await Promise.resolve();
  const second = await withTurnLease(admin, 'L1', 7, slowAttempt);
  assertEquals(second, { kind: 'held' });
  release();
  assertEquals(await first, { kind: 'ran', value: 'done', leased: true });
  assertEquals(runs, 1);
  assertEquals(admin.leases.size, 0, 'the holder released its lease');
  // Released: the next tick works the turn at once.
  assertEquals((await withTurnLease(admin, 'L1', 7, () => Promise.resolve(1))).kind, 'ran');
});

Deno.test('ten concurrent claims on one turn: one runs (the D/2 stack is gone)', async () => {
  const admin = leaseAdmin();
  let runs = 0;
  const out = await Promise.all(Array.from({ length: 10 }, () => withTurnLease(admin, 'L1', 3, async () => { runs++; await new Promise((r) => setTimeout(r, 5)); })));
  assertEquals(runs, 1);
  assertEquals(out.filter((o) => o.kind === 'held').length, 9);
});

Deno.test('different turns and leagues never block each other', async () => {
  const admin = leaseAdmin();
  const never = new Promise<void>(() => {});
  void withTurnLease(admin, 'L1', 3, () => never); // left holding
  await Promise.resolve();
  await Promise.resolve();
  assertEquals((await withTurnLease(admin, 'L1', 4, () => Promise.resolve(0))).kind, 'ran');
  assertEquals((await withTurnLease(admin, 'L2', 3, () => Promise.resolve(0))).kind, 'ran');
});

Deno.test('TIME-BOUNDED: a holder that died before releasing blocks its turn only until the TTL, then the next sweep takes over', async () => {
  const admin = leaseAdmin();
  // A crashed holder: it claimed and never released (CPU limit, deploy, crash).
  assertEquals(await claimTurnLease(admin, 'L1', 5, 'dead-holder'), 'claimed');
  admin.clock.now += TURN_LEASE_TTL_MS - 1;
  assertEquals((await withTurnLease(admin, 'L1', 5, () => Promise.resolve(0))).kind, 'held', 'still live inside the TTL');
  admin.clock.now += 1;
  const r = await withTurnLease(admin, 'L1', 5, () => Promise.resolve('picked'));
  assertEquals(r, { kind: 'ran', value: 'picked', leased: true }, 'expired: taken over');
  assert(admin.ttls.every((t: number) => t === TURN_LEASE_TTL_MS), 'every claim asks for the TTL');
});

Deno.test('the release is scoped to its holder: a slow holder whose lease expired cannot drop the new owner\'s', async () => {
  const admin = leaseAdmin();
  let releaseSlow!: () => void;
  const slow = withTurnLease(admin, 'L1', 9, () => new Promise<void>((r) => (releaseSlow = r)), { holder: 'slow' });
  await Promise.resolve();
  await Promise.resolve();
  admin.clock.now += TURN_LEASE_TTL_MS; // the slow attempt outlived its lease
  let releaseNew!: () => void;
  const fresh = withTurnLease(admin, 'L1', 9, () => new Promise<void>((r) => (releaseNew = r)), { holder: 'new' });
  await Promise.resolve();
  await Promise.resolve();
  releaseSlow();
  await slow;
  assertEquals(admin.leases.get('L1:9')?.holder, 'new', 'the late release left the new owner\'s lease');
  assertEquals((await withTurnLease(admin, 'L1', 9, () => Promise.resolve(0))).kind, 'held');
  releaseNew();
  await fresh;
  assertEquals(admin.leases.size, 0);
});

Deno.test('a work that throws still releases its lease, and the throw reaches the caller', async () => {
  const admin = leaseAdmin();
  await assertRejects(() => withTurnLease(admin, 'L1', 2, () => Promise.reject(new Error('boom'))), Error, 'boom');
  assertEquals(admin.leases.size, 0);
});

Deno.test('FAIL OPEN: a claim error (e.g. the function deployed before the migration) still works the turn, reported unleased, with no release', async () => {
  for (const admin of [leaseAdmin({ claimError: true }), leaseAdmin({ claimData: null }), leaseAdmin({ claimData: 'yes' })]) {
    let runs = 0;
    const r = await quiet(() => withTurnLease(admin, 'L1', 2, () => Promise.resolve(++runs)));
    assertEquals(r, { kind: 'ran', value: 1, leased: false });
    assert(!admin.calls.some((c: string) => c.startsWith('release:')), 'nothing to release');
  }
  // A throwing client is an error too, not a crash.
  const throwing = { rpc: () => Promise.reject(new Error('network')), from: () => { throw new Error('unused'); } };
  assertEquals(await quiet(() => claimTurnLease(throwing, 'L1', 2, 'h')), 'error');
});

Deno.test('the TTL outlasts one attempt (the walk plus the write) and fits inside the SQL clamp', () => {
  assert(TURN_LEASE_TTL_MS >= WALL_BUDGET_MS + LEASE_MARGIN_MS, `${TURN_LEASE_TTL_MS} < ${WALL_BUDGET_MS} + ${LEASE_MARGIN_MS}`);
  assert(TURN_LEASE_TTL_MS <= 120_000, 'the SQL clamps above 120 s: a longer TTL would silently shrink');
});
