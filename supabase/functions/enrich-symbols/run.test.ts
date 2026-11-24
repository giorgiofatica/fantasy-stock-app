/**
 * Tests for ./run.ts: the order of one enrich-symbols run, and how runs behave
 * over time as the stalest-first queue comes round (docs/plans/
 * 2026-11-23-claims-fix-themselves.md, "Settled during the build" point 1, as
 * corrected 2026-11-24: first-held marks, a 24 h minimum age for a drop, and
 * at most 20 stocks leaving the list in any 24 hours).
 *
 * The REAL runJudged / decideRun / markValues / cursorValues run here. Only the
 * I/O is faked: an in-memory symbols table, a selection that mirrors batch.ts's
 * stalest-first query (order by enriched_at asc), writers that apply exactly
 * the values runJudged hands them (as batch.ts's PostgREST writers do), and the
 * drops-in-window count batch.ts reads (list_dropped_at > now - 24 h).
 *
 * Run from repo root:
 *   deno test --allow-read --allow-env supabase/functions/enrich-symbols/run.test.ts
 */
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert';
import {
  DAILY_DROP_BUDGET,
  DROP_WINDOW_MS,
  planRow,
  type ProfileOutcome,
  type RowPlan,
  type SymbolRow,
} from './plan.ts';
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
const iso = (ms: number) => new Date(ms).toISOString();

const okNoSize: ProfileOutcome = { status: 'ok', industry: 'Banking', marketCap: null };
const okBig: ProfileOutcome = { status: 'ok', industry: 'Banking', marketCap: BIG };
const okTiny: ProfileOutcome = { status: 'ok', industry: 'Banking', marketCap: 10_000_000 };

type Stored = SymbolRow & { enriched_at: string; price_unsupported: boolean; list_dropped_at: string | null };
type Answer = ProfileOutcome | 'transient';

/** An in-memory symbols table and a run loop shaped like batch.ts. */
class Queue {
  table = new Map<string, Stored>();
  clock = T0;
  /** Every applied drop: [time, symbol]. */
  departures: [number, string][] = [];

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
        list_dropped_at: null,
        price_unsupported: false,
        // Distinct, in the past, in symbol order: S0 is the stalest.
        enriched_at: iso(T0 - 10 * 24 * HOUR + i),
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
      // batch.ts: count of list_dropped_at > now - 24 h (never cleared).
      dropsInWindow: async () =>
        [...this.table.values()].filter((r) =>
          r.list_dropped_at !== null && Date.parse(r.list_dropped_at) > this.clock - DROP_WINDOW_MS
        ).length,
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
  async run(n: number, at: number, answer: (s: string) => Answer, over: Partial<RunDeps> = {}) {
    this.clock = at;
    const o = await runJudged(this.deps(this.select(n), answer, over));
    for (const s of o.decision.dropped) this.departures.push([at, s]);
    return o;
  }

  get(s: string) {
    return this.table.get(s)!;
  }

  /** The most departures inside any half-open 24 h window [t, t + 24 h). */
  maxDeparturesIn24h(): number {
    let most = 0;
    for (const [t] of this.departures) {
      most = Math.max(most, this.departures.filter(([u]) => u >= t && u < t + DROP_WINDOW_MS).length);
    }
    return most;
  }
}

const bad = (...syms: string[]) => (s: string): Answer => (syms.includes(s) ? okTiny : okNoSize);
const allGood = (_: string): Answer => okNoSize;
const allBad = (_: string): Answer => okTiny;
const THREE = ['S0', 'S1', 'S2'];

// ---------------------------------------------------------------------------
// Held stocks move on and fix themselves
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
    // Nothing but the cursor and the first-held mark.
    assertEquals({ ...r, enriched_at: was.enriched_at, list_drop_held_at: null }, was);
    assertEquals(r.list_drop_held_at, iso(T0));
    assertEquals(r.enriched_at, iso(T0));
  }
  for (let i = 3; i < 50; i++) assertEquals(q.get(`S${i}`).enriched_at, iso(T0));
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
  await q.run(50, T0 + 12 * HOUR, allGood);
  const o = await q.run(50, T0 + 25 * HOUR, allGood);
  assertEquals(o.decision.cleared.sort(), THREE);
  assertEquals(outcomeFields(o).ok, true);
  for (const s of THREE) {
    assertEquals([q.get(s).list_drop_held_at, q.get(s).is_draftable, q.get(s).market_cap], [null, true, BIG]);
  }
  assertEquals(q.departures, []);
});

Deno.test('run: on their next turn with the same numbers (mark 24 h old) all three are dropped', async () => {
  const q = new Queue(100);
  await q.run(50, T0, bad(...THREE));
  await q.run(50, T0 + 12 * HOUR, allGood);
  const o = await q.run(50, T0 + 25 * HOUR, bad(...THREE));
  assertEquals(o.decision.refused, false); // marked stocks are not new drops
  assertEquals(o.decision.dropped.sort(), THREE);
  assertEquals(outcomeFields(o).ok, true);
  for (const s of THREE) {
    assertEquals([q.get(s).is_draftable, q.get(s).list_drop_held_at, q.get(s).list_dropped_at], [false, null, iso(T0 + 25 * HOUR)]);
  }
});

Deno.test('run: two groups held 12 h apart both drop on their second reading (no group keeps another held)', async () => {
  const q = new Queue(100);
  const groupA = ['S0', 'S1', 'S2'];
  const groupB = ['S50', 'S51', 'S52'];
  const answer = bad(...groupA, ...groupB);
  await q.run(50, T0, answer); // A held
  await q.run(50, T0 + 12 * HOUR, answer); // B held
  const third = await q.run(50, T0 + 25 * HOUR, answer); // A's second reading; B's mark is only 13 h old
  assertEquals(third.decision.dropped.sort(), groupA);
  const fourth = await q.run(50, T0 + 37 * HOUR, answer); // B's second reading
  assertEquals(fourth.decision.dropped.sort(), groupB);
});

Deno.test('run: a stock coming round again inside 24 h keeps its FIRST-held mark and is not dropped', async () => {
  const q = new Queue(50); // the whole queue every run
  await q.run(50, T0, bad(...THREE));
  const o = await q.run(50, T0 + HOUR, bad(...THREE));
  assertEquals(o.decision.deferredYoung.sort(), THREE);
  assertEquals(o.decision.dropped, []);
  for (const s of THREE) {
    assertEquals(q.get(s).list_drop_held_at, iso(T0)); // not refreshed
    assertEquals(q.get(s).enriched_at, iso(T0 + HOUR)); // the cursor moved on
    assertEquals(q.get(s).is_draftable, true);
  }
  // Once the mark is 24 h old the same numbers drop them.
  const later = await q.run(50, T0 + 24 * HOUR, bad(...THREE));
  assertEquals(later.decision.dropped.sort(), THREE);
});

Deno.test('run: a stock held an hour ago whose numbers now pass is cleared at once', async () => {
  const q = new Queue(50);
  await q.run(50, T0, bad(...THREE));
  const o = await q.run(50, T0 + HOUR, allGood);
  assertEquals(o.decision.cleared.sort(), THREE);
  for (const s of THREE) assertEquals([q.get(s).list_drop_held_at, q.get(s).is_draftable], [null, true]);
});

// ---------------------------------------------------------------------------
// The daily budget: at most 20 leave in any 24 hours
// ---------------------------------------------------------------------------

Deno.test('budget: with 20 drops in the past 24 h a further drop, new and held-before, is held and reported', async () => {
  const q = new Queue(60);
  // 20 stocks left the list 2 h ago.
  for (let i = 40; i < 60; i++) {
    q.table.set(`S${i}`, { ...q.get(`S${i}`), is_draftable: false, list_dropped_at: iso(T0 - 2 * HOUR), enriched_at: iso(T0 - 2 * HOUR) });
  }
  // S0 was held 30 h ago (second reading due); S1 is a new drop.
  q.table.set('S0', { ...q.get('S0'), list_drop_held_at: iso(T0 - 30 * HOUR) });
  const o = await q.run(40, T0, bad('S0', 'S1'));
  const f = outcomeFields(o);
  assertEquals(f.ok, false);
  assertEquals(f.error, 'drop_budget_reached');
  assertEquals(f.list_drops_past_24h, 20);
  assertEquals(f.list_held_for_budget, 2);
  assertEquals((f.list_held_symbols as string[]).sort(), ['S0', 'S1']);
  assertEquals([q.get('S0').is_draftable, q.get('S0').list_drop_held_at], [true, iso(T0 - 30 * HOUR)]); // mark kept
  assertEquals([q.get('S1').is_draftable, q.get('S1').list_drop_held_at], [true, iso(T0)]); // newly marked
});

Deno.test('budget: with every run failing for two full turns of the queue, no more than 20 leave in any 24 h', async () => {
  const q = new Queue(200); // 50 a run: a full turn is 4 runs; one run every 12 h = a 48 h turn
  for (let k = 0; k < 8; k++) {
    const o = await q.run(50, T0 + k * 12 * HOUR, allBad);
    assertEquals(outcomeFields(o).ok, false, `run ${k} should report failed`);
  }
  assert(q.departures.length > 0, 'some leave once their marks are 24 h old');
  assertEquals(q.maxDeparturesIn24h(), DAILY_DROP_BUDGET);
});

Deno.test('budget: a stock dropped on bad numbers is back on its next turn with good ones, and still counts toward that day\'s 20', async () => {
  const q = new Queue(50);
  await q.run(50, T0, bad('S0'));
  assertEquals(q.get('S0').is_draftable, false);
  // Good numbers = a real size over the floor (an "ok" with no size would keep the known $10M one).
  const o = await q.run(50, T0 + HOUR, () => okBig);
  assertEquals(q.get('S0').is_draftable, true); // back on the list: rejoining is never guarded
  assertEquals(q.get('S0').list_dropped_at, iso(T0)); // never cleared
  assertEquals(outcomeFields(o).list_drops_past_24h, 1); // counted though it came back
});

Deno.test('budget: a single drop on an ordinary day is applied at once', async () => {
  const q = new Queue(100);
  const o = await q.run(50, T0, bad('S0'));
  const f = outcomeFields(o);
  assertEquals([f.ok, f.list_dropped, f.list_drops_past_24h, f.list_drops_past_24h_after], [true, 1, 0, 1]);
  assertEquals([q.get('S0').is_draftable, q.get('S0').list_dropped_at], [false, iso(T0)]);
});

Deno.test('budget: an unreadable count applies no drop, reports it, and the next run tries again', async () => {
  const q = new Queue(100);
  const o = await q.run(50, T0, bad('S0'), { dropsInWindow: () => Promise.reject(new Error('read failed')) });
  const f = outcomeFields(o);
  assertEquals([f.ok, f.error, f.list_drops_read_failed, f.list_dropped], [false, 'drop_budget_reached', true, 0]);
  assertEquals([q.get('S0').is_draftable, q.get('S0').list_drop_held_at], [true, iso(T0)]);
  // The next run reads again and applies its drop.
  const next = await q.run(50, T0 + 10 * 60 * 1000, bad('S50'));
  assertEquals(outcomeFields(next).list_drops_read_failed, false);
  assertEquals(next.decision.dropped, ['S50']);
});

// ---------------------------------------------------------------------------
// Cut off, stopped early, hung
// ---------------------------------------------------------------------------

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

Deno.test('run: a supplier abort part way writes the judged stocks, with the guard applied over them', async () => {
  const q = new Queue(100);
  const before = q.snapshot();
  const answer = (s: string): Answer => (s === 'S10' ? 'transient' : bad(...THREE)(s));
  const f = outcomeFields(await q.run(50, T0, answer));
  assertEquals([f.stopped, f.transient_abort, f.judged, f.list_drop_limit, f.error], ['transient_abort', true, 10, 2, 'mass_drop_refused']);
  for (const s of THREE) assertEquals(q.get(s).list_drop_held_at, iso(T0));
  for (let i = 3; i < 10; i++) assertEquals(q.get(`S${i}`).enriched_at, iso(T0));
  // S10 (the transient one) and everything after it: untouched, retried next run.
  for (let i = 10; i < 100; i++) assertEquals(q.get(`S${i}`), before[i][1]);
});

Deno.test('run: a hung supplier call past the run deadline writes what it has, reports it, and writes nothing for unjudged stocks', async () => {
  const q = new Queue(100);
  const before = q.snapshot();
  q.clock = T0;
  const deps = q.deps(q.select(50), bad('S0', 'S7', 'S8', 'S9'), { nowMs: Date.now, deadlineMs: Date.now() + 80 });
  const judge = deps.judge;
  deps.judge = (row) => (row.symbol === 'S5' ? new Promise<RowPlan>(() => {}) : judge(row)); // never answers
  const o = await runJudged(deps);
  const f = outcomeFields(o);
  assertEquals([f.stopped, f.judged], ['deadline', 5]);
  assertEquals(o.decision.dropped, ['S0']); // one drop among the judged: applied
  assertEquals(q.get('S0').is_draftable, false);
  // S5 (hung) and every stock after it, the bad S7-S9 included: no drop, no mark, no write.
  for (let i = 5; i < 100; i++) assertEquals(q.get(`S${i}`), before[i][1]);
});

Deno.test('run: a deadline already passed judges nothing and writes nothing', async () => {
  const q = new Queue(10);
  const before = q.snapshot();
  const o = await q.run(10, T0, allBad, { deadlineMs: T0 - 1 });
  assertEquals([o.stopped, o.decision.judged], ['deadline', 0]);
  assertEquals(q.snapshot(), before);
});

Deno.test('run: the budgets sit well inside the 150 s edge wall clock', () => {
  assert(PRICE_PHASE_BUDGET_MS < RUN_FETCH_DEADLINE_MS);
  assert(SUPPLIER_CALL_TIMEOUT_MS < PRICE_PHASE_BUDGET_MS);
  // The judging deadline plus one call that started just before it, and the writes.
  assert(RUN_FETCH_DEADLINE_MS + SUPPLIER_CALL_TIMEOUT_MS <= 130_000);
});

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

Deno.test('run: a failed hold write reports the run failed', async () => {
  const q = new Queue(100);
  const f = outcomeFields(await q.run(50, T0, bad(...THREE), { writeHolds: async () => 'permission denied' }));
  assertEquals([f.ok, f.hold_write_error], [false, 'permission denied']);
});

Deno.test('run: a clean run reports ok, stopped complete, and the supplier tally adds up to the judged', async () => {
  const q = new Queue(50);
  const answer = (s: string): Answer => (s === 'S1' ? { status: 'empty' } : s === 'S2' ? okBig : okNoSize);
  const f = outcomeFields(await q.run(50, T0, answer));
  assertEquals([f.ok, f.stopped, f.error], [true, 'complete', undefined]);
  assertEquals([f.profile_ok_size, f.profile_ok_no_size, f.profile_empty, f.profile_skipped_etf], [1, 48, 1, 0]);
  assertEquals(f.profile_empty_symbols, ['S1']);
  assertEquals((f.profile_ok_no_size_symbols as string[]).length, 20);
});
