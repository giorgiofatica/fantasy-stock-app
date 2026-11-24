/**
 * Unit tests for ./plan.ts: fix 3 of docs/plans/2026-11-23-claims-fix-themselves.md.
 *   - an "ok" answer with no size keeps the known size and the list place;
 *   - a run that would take a tenth of its stocks off the list changes none of
 *     them and reports itself failed;
 *   - running each twice does its work once.
 * Hermetic: no DB, no Finnhub, no Alpaca. The "table" is an in-memory Map that
 * applies exactly what batch.ts would write (the update + an enriched_at stamp).
 *
 * Run from repo root:
 *   deno test --allow-read --allow-env supabase/functions/enrich-symbols/plan.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  decideMassDrop,
  MASS_DROP_MIN,
  massDropLimit,
  mergeProfile,
  planRow,
  type ProfileOutcome,
  type SymbolRow,
  verdictFields,
} from './plan.ts';

const BIG = 5_000_000_000; // $5B, well over the $250M floor

function onList(symbol: string, over: Partial<SymbolRow> = {}): SymbolRow {
  return {
    symbol,
    exchange: 'NYSE',
    is_etf: false,
    active: true,
    gics_industry: 'Banking',
    last_price: 40,
    market_cap: BIG,
    is_draftable: true,
    ...over,
  };
}

const okNoSize: ProfileOutcome = { status: 'ok', industry: 'Banking', marketCap: null };
const okBlank: ProfileOutcome = { status: 'ok', industry: null, marketCap: null };
const okTiny: ProfileOutcome = { status: 'ok', industry: 'Banking', marketCap: 10_000_000 }; // $10M: under the floor

// ---------------------------------------------------------------------------
// mergeProfile — a known value is never wiped by an incomplete answer
// ---------------------------------------------------------------------------

Deno.test('mergeProfile: ok with no size keeps the known size', () => {
  assertEquals(mergeProfile({ industry: 'Banking', marketCap: BIG }, okNoSize), { industry: 'Banking', marketCap: BIG });
});

Deno.test('mergeProfile: ok with no industry keeps the known industry', () => {
  assertEquals(mergeProfile({ industry: 'Banking', marketCap: BIG }, okBlank), { industry: 'Banking', marketCap: BIG });
});

Deno.test('mergeProfile: a real new value replaces the known one', () => {
  assertEquals(
    mergeProfile({ industry: 'Banking', marketCap: BIG }, { status: 'ok', industry: 'Insurance', marketCap: 7e9 }),
    { industry: 'Insurance', marketCap: 7e9 },
  );
});

Deno.test('mergeProfile: a first value fills an unknown one', () => {
  assertEquals(
    mergeProfile({ industry: null, marketCap: null }, { status: 'ok', industry: 'Banking', marketCap: BIG }),
    { industry: 'Banking', marketCap: BIG },
  );
});

Deno.test('mergeProfile: empty and skipped answers change nothing', () => {
  const known = { industry: 'Banking', marketCap: BIG };
  assertEquals(mergeProfile(known, { status: 'empty' }), known);
  assertEquals(mergeProfile(known, { status: 'skipped' }), known);
});

// ---------------------------------------------------------------------------
// planRow — Done means 3
// ---------------------------------------------------------------------------

Deno.test('planRow (Done 3): ok with no size leaves size and list place unchanged', () => {
  const p = planRow(onList('BAC'), okNoSize, 41, false);
  assertEquals(p.update.market_cap, BIG); // the size the list is ordered by
  assertEquals(p.update.is_draftable, true); // still on the list
  assertEquals(p.update.last_price, 41);
  assertEquals(p.wasOnList, true);
});

Deno.test('planRow: market_cap stored as a numeric string (PostgREST numeric) is kept as a number', () => {
  const p = planRow(onList('BAC', { market_cap: '5000000000' }), okNoSize, undefined, false);
  assertEquals(p.update.market_cap, BIG);
  assertEquals(p.update.is_draftable, true);
});

Deno.test('planRow: no new price keeps the last price', () => {
  assertEquals(planRow(onList('BAC'), okNoSize, undefined, false).update.last_price, 40);
});

Deno.test('planRow: a real size under the floor DOES take the stock off (genuine news)', () => {
  const p = planRow(onList('TINY'), okTiny, 40, false);
  assertEquals(p.update.market_cap, 10_000_000);
  assertEquals(p.update.is_draftable, false);
});

Deno.test('planRow: a stock with no known size and no size in the answer stays off', () => {
  const p = planRow(onList('NEW', { market_cap: null, is_draftable: false }), okNoSize, 40, false);
  assertEquals(p.update.market_cap, null);
  assertEquals(p.update.is_draftable, false);
  assertEquals(p.wasOnList, false);
});

Deno.test('planRow: an ETF keeps its fields and is judged on price + exchange', () => {
  const p = planRow(onList('SPY', { is_etf: true, market_cap: null, gics_industry: null }), { status: 'skipped' }, 500, false);
  assertEquals(p.update.is_draftable, true);
  assertEquals(p.update.market_cap, null);
});

// ---------------------------------------------------------------------------
// decideMassDrop — Done means 4
// ---------------------------------------------------------------------------

Deno.test('massDropLimit: never below the fixed minimum; the share takes over for large runs', () => {
  assertEquals(massDropLimit(1), MASS_DROP_MIN);
  assertEquals(massDropLimit(10), MASS_DROP_MIN);
  assert(massDropLimit(1000) > MASS_DROP_MIN);
});

Deno.test('massDropLimit: a tenth of a normal run (5 of 50) or of a maximum run (8 of 80) is over the limit', () => {
  assert(5 > massDropLimit(50));
  assert(8 > massDropLimit(80));
});

/** A run of `n` on-list stocks of which the first `drops` get a sub-floor size. */
function runPlans(n: number, drops: number) {
  return Array.from({ length: n }, (_, i) =>
    planRow(onList(`S${i}`), i < drops ? okTiny : okNoSize, 40, false)
  );
}

Deno.test('decideMassDrop: drops within the limit apply (one stock leaving is news about the stock)', () => {
  const v = decideMassDrop(runPlans(50, massDropLimit(50)), 50);
  assertEquals(v.refused, false);
  assertEquals(v.apply.length, 50);
  assertEquals(v.held.length, 0);
  assertEquals(v.drops.length, massDropLimit(50));
  assertEquals(verdictFields(v).ok, true);
  assertEquals(verdictFields(v).list_drops, massDropLimit(50));
});

Deno.test('decideMassDrop (Done 4): a tenth of the run dropping changes none of them and reports failed', () => {
  const v = decideMassDrop(runPlans(50, 5), 50);
  assertEquals(v.refused, true);
  assertEquals(v.held.map((p) => p.symbol), ['S0', 'S1', 'S2', 'S3', 'S4']);
  // None of the dropping stocks is in the write set …
  assertEquals(v.apply.filter((p) => !p.update.is_draftable), []);
  // … and the run's other stocks still apply.
  assertEquals(v.apply.length, 45);
  const f = verdictFields(v);
  assertEquals(f.ok, false);
  assertEquals(f.error, 'mass_drop_refused');
  assertEquals(f.list_drops, 0);
  assertEquals(f.list_drops_held, 5);
  assertEquals(f.list_drop_symbols, ['S0', 'S1', 'S2', 'S3', 'S4']);
});

Deno.test('decideMassDrop: stocks that were already off, or that join the list, are not drops', () => {
  const plans = [
    ...Array.from({ length: 10 }, (_, i) =>
      planRow(onList(`OFF${i}`, { market_cap: null, is_draftable: false }), okNoSize, 40, false)
    ),
    ...Array.from({ length: 10 }, (_, i) =>
      planRow(onList(`JOIN${i}`, { market_cap: null, is_draftable: false }), { status: 'ok', industry: 'Banking', marketCap: BIG }, 40, false)
    ),
  ];
  const v = decideMassDrop(plans, 50);
  assertEquals(v.drops, []);
  assertEquals(v.refused, false);
});

Deno.test('decideMassDrop: the limit is set by the stocks SELECTED, not by how far a transient abort got', () => {
  // A run selected 50 but aborted after 6, of which 3 drop: 3 > limit(50), refused.
  const v = decideMassDrop(runPlans(6, 3), 50);
  assertEquals(v.limit, massDropLimit(50));
  assertEquals(v.refused, 3 > massDropLimit(50));
});

// ---------------------------------------------------------------------------
// Done means 5 — running each twice does its work once
// ---------------------------------------------------------------------------

type Stored = SymbolRow & { price_unsupported: boolean; enriched_at: number | null };

/** One run against the in-memory table: plan, decide, write exactly what batch.ts writes. */
function runOnce(table: Map<string, Stored>, answers: Map<string, ProfileOutcome>, clock: number) {
  const rows = [...table.values()];
  const plans = rows.map((r) => planRow(r, answers.get(r.symbol) ?? { status: 'empty' }, undefined, false));
  const v = decideMassDrop(plans, rows.length);
  for (const p of v.apply) {
    table.set(p.symbol, { ...table.get(p.symbol)!, ...p.update, enriched_at: clock });
  }
  return verdictFields(v);
}

const tableOf = (rows: SymbolRow[]) =>
  new Map(rows.map((r) => [r.symbol, { ...r, price_unsupported: false, enriched_at: 0 } as Stored]));

const lessStamp = (t: Map<string, Stored>) => [...t.values()].map(({ enriched_at: _e, ...rest }) => rest);

Deno.test('twice (Done 5): an ok-with-no-size refresh, run twice, keeps the size both times', () => {
  const table = tableOf(Array.from({ length: 50 }, (_, i) => onList(`S${i}`)));
  const before = lessStamp(table);
  const answers = new Map([...table.keys()].map((s) => [s, okNoSize]));
  assertEquals(runOnce(table, answers, 1).ok, true);
  const afterOne = lessStamp(table);
  assertEquals(runOnce(table, answers, 2).ok, true);
  assertEquals(lessStamp(table), afterOne);
  assertEquals(afterOne, before); // nothing about the stocks changed at all
});

Deno.test('twice (Done 5): a refused mass drop, run twice, refuses twice and writes the dropping stocks never', () => {
  const table = tableOf(Array.from({ length: 50 }, (_, i) => onList(`S${i}`)));
  const answers = new Map([...table.keys()].map((s, i) => [s, i < 5 ? okTiny : okNoSize]));
  const first = runOnce(table, answers, 1);
  const afterOne = structuredClone([...table.entries()]);
  const second = runOnce(table, answers, 2);
  assertEquals(first.ok, false);
  assertEquals(second.ok, false);
  for (let i = 0; i < 5; i++) {
    const row = table.get(`S${i}`)!;
    assertEquals(row.is_draftable, true); // still on the list
    assertEquals(row.market_cap, BIG); // the broken size never landed
    assertEquals(row.enriched_at, 0); // never written, so the next run re-reads it
  }
  // The other 45 applied once; the second run wrote the same values again.
  assertEquals(
    lessStamp(table),
    afterOne.map(([, r]) => r).map(({ enriched_at: _e, ...rest }) => rest),
  );
});

Deno.test('twice: once the bad data clears, the held stocks refresh on the next run', () => {
  const table = tableOf(Array.from({ length: 50 }, (_, i) => onList(`S${i}`)));
  const bad = new Map([...table.keys()].map((s, i) => [s, i < 5 ? okTiny : okNoSize]));
  assertEquals(runOnce(table, bad, 1).ok, false);
  const good = new Map([...table.keys()].map((s) => [s, okNoSize]));
  assertEquals(runOnce(table, good, 2).ok, true);
  assertEquals(table.get('S0')!.enriched_at, 2);
  assertEquals(table.get('S0')!.is_draftable, true);
});
