/**
 * Tests for ./run.ts: the order of one enrich-symbols run, and how runs behave
 * over time as the stalest-first queue comes round (docs/plans/
 * 2026-11-23-claims-fix-themselves.md, "Settled during the build" point 1).
 *
 * The REAL runJudged / decideRun / holdValues run here. Only the I/O is faked:
 * an in-memory symbols table, a selection that mirrors batch.ts's stalest-first
 * query (order by enriched_at asc), and writers that apply exactly the values
 * runJudged hands them, as batch.ts's PostgREST writers do.
 *
 * Run from repo root:
 *   deno test --allow-read --allow-env supabase/functions/enrich-symbols/run.test.ts
 */
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert';
import { MARK_QUIET_MS, planRow, type ProfileOutcome, type RowPlan, type SymbolRow } from './plan.ts';
import {
  outcomeFields,
  PRICE_PHASE_BUDGET_MS,
  RUN_FETCH_DEADLINE_MS,
  runJudged,
  type RunDeps,
  SUPPLIER_CALL_TIMEOUT_MS,
} from './run.ts';

const BIG = 5_000_000_000;
const HOUR = 60 * 60 * 1000;
const T0 = Date.parse('2026-11-24T15:00:00.000Z');

const okNoSize: ProfileOutcome = { status: 'ok', industry: 'Banking', marketCap: null };
const okBig: ProfileOutcome = { status: 'ok', industry: 'Banking', marketCap: BIG };
const okTiny: ProfileOutcome = { status: 'ok', industry: 'Banking', marketCap: 10_000_000 };

type Stored = SymbolRow & { enriched_at: string; price_unsupported: boolean };
type Answer = ProfileOutcome | 'transient';

/** An in-memory symbols table and a run loop shaped like batch.ts. */
class Queue {
  table = new Map<string, Stored>();
  clock = T0;

  constructor(n: number) {
    for (let i = 0; i < n; i++) {
      this.table.set(`S${i}`, {
        symbol: `S${i}`,
        exchange: 'NYSE',
        is_etf: false,
        active: true,
        gics_industry: 'Banking',
        last_price: 40,
        market_cap: BIG,
        is_draftable: true,
        list_drop_held_at: null,
        price_unsupported: false,
        // Distinct, in the past, in symbol order: S0 is the stalest.
        enriched_at: new Date(T0 - 10 * 24 * HOUR + i).toISOString(),
      });
    }
  }

  /** batch.ts's stalest-first selection (order by enriched_at asc). */
  select(n: number): Stored[] {
    return [...this.table.values()]
      .filter((r) => r.active)
      .sort((a, b) => a.enriched_at.localeCompare(b.enriched_at) || a.symbol.localeCompare(b.symbol))
      .slice(0, n);
  }

  snapshot() {
    return structuredClone([...this.table.entries()]);
  }

  deps(rows: Stored[], answer: (s: string) => Answer, over: Partial<RunDeps> = {}): RunDeps {
    return {
      rows: rows.map((r) => ({ ...r })),
      judge: async (row) => {
        const a = answer(row.symbol);
        return a === 'transient' ? 'transient' : planRow(row, a, undefined, false);
      },
      recentMarkExists: async () =>
        [...this.table.values()].some((r) =>
          r.list_drop_held_at !== null && Date.parse(r.list_drop_held_at) > this.clock - MARK_QUIET_MS
        ),
      writeHolds: async (symbols, values) => {
        for (const s of symbols) this.table.set(s, { ...this.table.get(s)!, ...values });
        return null;
      },
      writeRow: async (symbol, values) => {
        this.table.set(symbol, { ...this.table.get(symbol)!, ...values });
        return null;
      },
      nowMs: () => this.clock,
      deadlineMs: this.clock + RUN_FETCH_DEADLINE_MS,
      ...over,
    };
  }

  /** One run of `n` at time `at`. */
  run(n: number, at: number, answer: (s: string) => Answer, over: Partial<RunDeps> = {}) {
    this.clock = at;
    return runJudged(this.deps(this.select(n), answer, over));
  }

  get(s: string) {
    return this.table.get(s)!;
  }
}

const bad = (...syms: string[]) => (s: string): Answer => (syms.includes(s) ? okTiny : okNoSize);
const allGood = (_: string): Answer => okNoSize;
const allBad = (_: string): Answer => okTiny;
const THREE = ['S0', 'S1', 'S2'];

// ---------------------------------------------------------------------------
// The plan's tests
// ---------------------------------------------------------------------------

Deno.test('run: 50 with 3 drops writes none of the three and applies the other 47', async () => {
  const q = new Queue(100);
  const before = q.snapshot();
  const o = await q.run(50, T0, bad(...THREE));
  const f = outcomeFields(o);
  assertEquals(f.ok, false);
  assertEquals(f.error, 'mass_drop_refused');
  assertEquals(f.list_held_symbols, THREE);
  for (const s of THREE) {
    const r = q.get(s);
    const was = before.find(([k]) => k === s)![1];
    // Nothing but the cursor and the mark.
    assertEquals({ ...r, enriched_at: was.enriched_at, list_drop_held_at: null }, was);
    assertEquals(r.list_drop_held_at, new Date(T0).toISOString());
    assertEquals(r.enriched_at, new Date(T0).toISOString());
  }
  for (let i = 3; i < 50; i++) assertEquals(q.get(`S${i}`).enriched_at, new Date(T0).toISOString());
  for (let i = 50; i < 100; i++) assertEquals(q.get(`S${i}`), before[i][1]);
});

Deno.test('run: the three held stocks are not in the next run (the queue moves on, no jam)', async () => {
  const q = new Queue(100);
  await q.run(50, T0, bad(...THREE));
  const next = q.select(50).map((r) => r.symbol);
  for (const s of THREE) assert(!next.includes(s), `${s} is in the next run`);
  assertEquals(next, Array.from({ length: 50 }, (_, i) => `S${i + 50}`));
});

Deno.test('run: on their next turn with good numbers the marks clear and nothing left the list', async () => {
  const q = new Queue(100);
  await q.run(50, T0, bad(...THREE));
  await q.run(50, T0 + 2 * HOUR, allGood); // the other half
  const o = await q.run(50, T0 + 4 * HOUR, allGood); // the three come round
  assertEquals(o.decision.cleared.sort(), THREE);
  assertEquals(outcomeFields(o).ok, true);
  for (const s of THREE) {
    assertEquals(q.get(s).list_drop_held_at, null);
    assertEquals(q.get(s).is_draftable, true);
    assertEquals(q.get(s).market_cap, BIG);
  }
});

Deno.test('run: on their next turn with the same numbers, a quiet day behind them, all three are dropped', async () => {
  const q = new Queue(100);
  await q.run(50, T0, bad(...THREE));
  await q.run(50, T0 + 12 * HOUR, allGood);
  const o = await q.run(50, T0 + 25 * HOUR, bad(...THREE)); // last hold was 25 h ago
  assertEquals(o.decision.refused, false); // marked stocks are not new drops
  assertEquals(o.decision.dropped.sort(), THREE);
  assertEquals(outcomeFields(o).ok, true);
  for (const s of THREE) {
    assertEquals(q.get(s).is_draftable, false);
    assertEquals(q.get(s).list_drop_held_at, null);
  }
});

Deno.test('run: with every run refusing for two full turns of the queue, no stock leaves the list', async () => {
  const q = new Queue(100);
  for (let k = 0; k < 4; k++) { // 100 stocks / 50 a run = a turn every 2 runs
    const o = await q.run(50, T0 + k * 10 * 60 * 1000, allBad);
    const f = outcomeFields(o);
    assertEquals(f.ok, false, `run ${k} should report failed`);
    // Turn 1 refuses new drops; turn 2 holds the second readings again.
    assertEquals(f.error, k < 2 ? 'mass_drop_refused' : 'drops_held_again');
    assertEquals(f.list_recent_mark_read_failed, false);
    assertEquals(o.decision.dropped, []);
  }
  for (const r of q.table.values()) {
    assertEquals(r.is_draftable, true);
    assertEquals(r.market_cap, BIG);
    assert(r.list_drop_held_at !== null);
  }
});

Deno.test('run: a single drop on a quiet day is applied at once', async () => {
  const q = new Queue(100);
  const o = await q.run(50, T0, bad('S0'));
  assertEquals(outcomeFields(o).ok, true);
  assertEquals(o.decision.dropped, ['S0']);
  assertEquals(q.get('S0').is_draftable, false);
  assertEquals(q.get('S0').list_drop_held_at, null);
});

Deno.test('run: a run cut off before its end leaves no drop and no mark (nothing at all)', async () => {
  const q = new Queue(100);
  const before = q.snapshot();
  q.clock = T0;
  const deps = q.deps(q.select(50), bad(...THREE));
  const judge = deps.judge;
  deps.judge = async (row) => {
    if (row.symbol === 'S10') throw new Error('worker killed');
    return judge(row);
  };
  await assertRejects(() => runJudged(deps), Error, 'worker killed');
  assertEquals(q.snapshot(), before);
});

// ---------------------------------------------------------------------------
// The two run conditions (the Planner, 2026-11-24)
// ---------------------------------------------------------------------------

Deno.test('run: a supplier abort part way writes the judged stocks, with the guard applied over them', async () => {
  const q = new Queue(100);
  const before = q.snapshot();
  const answer = (s: string): Answer => (s === 'S10' ? 'transient' : bad(...THREE)(s));
  const o = await q.run(50, T0, answer);
  const f = outcomeFields(o);
  assertEquals(f.stopped, 'transient_abort');
  assertEquals(f.transient_abort, true);
  assertEquals(f.judged, 10);
  assertEquals(f.list_drop_limit, 2); // over the 10 judged, not the 50 asked
  assertEquals(f.error, 'mass_drop_refused');
  for (const s of THREE) assertEquals(q.get(s).list_drop_held_at, new Date(T0).toISOString());
  for (let i = 3; i < 10; i++) assertEquals(q.get(`S${i}`).enriched_at, new Date(T0).toISOString());
  // S10 (the transient one) and everything after it: untouched, retried next run.
  for (let i = 10; i < 100; i++) assertEquals(q.get(`S${i}`), before[i][1]);
});

Deno.test('run: a hung supplier call past the run deadline writes what it has, reports it, and writes nothing for unjudged stocks', async () => {
  const q = new Queue(100);
  const before = q.snapshot();
  q.clock = T0;
  const deps = q.deps(q.select(50), bad('S0', 'S7', 'S8', 'S9'), {
    nowMs: Date.now,
    deadlineMs: Date.now() + 80,
  });
  const judge = deps.judge;
  deps.judge = (row) => (row.symbol === 'S5' ? new Promise<RowPlan>(() => {}) : judge(row)); // never answers
  const o = await runJudged(deps);
  const f = outcomeFields(o);
  assertEquals(f.stopped, 'deadline');
  assertEquals(f.judged, 5);
  assertEquals(o.decision.dropped, ['S0']); // one drop among the judged: applied
  assertEquals(q.get('S0').is_draftable, false);
  // S5 (hung) and every stock after it, the bad S7-S9 included: no drop, no mark, no write.
  for (let i = 5; i < 100; i++) assertEquals(q.get(`S${i}`), before[i][1]);
});

Deno.test('run: a deadline already passed judges nothing and writes nothing', async () => {
  const q = new Queue(10);
  const before = q.snapshot();
  const o = await q.run(10, T0, allBad, { deadlineMs: T0 - 1 });
  assertEquals(o.stopped, 'deadline');
  assertEquals(o.decision.judged, 0);
  assertEquals(q.snapshot(), before);
});

Deno.test('run: the budgets sit well inside the 150 s edge wall clock', () => {
  assert(PRICE_PHASE_BUDGET_MS < RUN_FETCH_DEADLINE_MS);
  assert(SUPPLIER_CALL_TIMEOUT_MS < PRICE_PHASE_BUDGET_MS);
  // The judging deadline plus one call that started just before it, and the writes.
  assert(RUN_FETCH_DEADLINE_MS + SUPPLIER_CALL_TIMEOUT_MS <= 130_000);
});

// ---------------------------------------------------------------------------
// Failing closed
// ---------------------------------------------------------------------------

Deno.test('run: a failed "any recent hold?" read counts as yes (hold again, never drop)', async () => {
  const q = new Queue(100);
  await q.run(50, T0, bad(...THREE));
  await q.run(50, T0 + 12 * HOUR, allGood);
  const o = await q.run(50, T0 + 25 * HOUR, bad(...THREE), {
    recentMarkExists: () => Promise.reject(new Error('read failed')),
  });
  assertEquals(o.decision.heldAgain.sort(), THREE);
  assertEquals(o.decision.dropped, []);
  for (const s of THREE) assertEquals(q.get(s).is_draftable, true);
  const f = outcomeFields(o);
  assertEquals(f.error, 'drops_held_again'); // not a mass drop: told apart in the line
  assertEquals(f.list_recent_mark_read_failed, true);
});

Deno.test('run: a failed hold write reports the run failed', async () => {
  const q = new Queue(100);
  const o = await q.run(50, T0, bad(...THREE), { writeHolds: async () => 'permission denied' });
  const f = outcomeFields(o);
  assertEquals(f.ok, false);
  assertEquals(f.hold_write_error, 'permission denied');
});

Deno.test('run: a clean run reports ok, stopped complete, and the supplier tally adds up to the judged', async () => {
  const q = new Queue(50);
  const answer = (s: string): Answer => (s === 'S1' ? { status: 'empty' } : s === 'S2' ? okBig : okNoSize);
  const f = outcomeFields(await q.run(50, T0, answer));
  assertEquals(f.ok, true);
  assertEquals(f.stopped, 'complete');
  assertEquals(f.error, undefined);
  assertEquals([f.profile_ok_size, f.profile_ok_no_size, f.profile_empty, f.profile_skipped_etf], [1, 48, 1, 0]);
  assertEquals(f.profile_empty_symbols, ['S1']);
  assertEquals((f.profile_ok_no_size_symbols as string[]).length, 20);
});
