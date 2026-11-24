/**
 * Unit tests for ./plan.ts: the verdicts of fix 3 in
 * docs/plans/2026-11-23-claims-fix-themselves.md ("Settled during the build"
 * point 1). The run ORDER and the multi-run behaviour (the queue coming round,
 * second readings, deadlines) are in run.test.ts.
 * Hermetic: no DB, no Finnhub, no Alpaca.
 *
 * Run from repo root:
 *   deno test --allow-read --allow-env supabase/functions/enrich-symbols/plan.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  DAILY_DROP_BUDGET,
  decideRun,
  DROP_WINDOW_MS,
  MARK_MIN_AGE_MS,
  MASS_DROP_MIN,
  MASS_DROP_SHARE,
  massDropLimit,
  mergeProfile,
  planRow,
  type ProfileOutcome,
  type SymbolRow,
  tallyProfiles,
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
    list_drop_held_at: null,
    ...over,
  };
}

const okNoSize: ProfileOutcome = { status: 'ok', industry: 'Banking', marketCap: null };
const okBlank: ProfileOutcome = { status: 'ok', industry: null, marketCap: null };
const okTiny: ProfileOutcome = { status: 'ok', industry: 'Banking', marketCap: 10_000_000 }; // $10M: under the floor
const okBig: ProfileOutcome = { status: 'ok', industry: 'Banking', marketCap: BIG };
const MARKED = '2026-11-20T15:00:00.000Z';

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
  assertEquals(mergeProfile({ industry: null, marketCap: null }, okBig), { industry: 'Banking', marketCap: BIG });
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
  assertEquals(p.marked, false);
});

Deno.test('planRow: a numeric-string market_cap (PostgREST numeric) is kept as a number', () => {
  const p = planRow(onList('BAC', { market_cap: '5000000000' }), okNoSize, undefined, false);
  assertEquals(p.update.market_cap, BIG);
  assertEquals(p.update.is_draftable, true);
});

Deno.test('planRow: no new price keeps the last price', () => {
  assertEquals(planRow(onList('BAC'), okNoSize, undefined, false).update.last_price, 40);
});

Deno.test('planRow: a real size under the floor judges the stock off (genuine news)', () => {
  const p = planRow(onList('TINY'), okTiny, 40, false);
  assertEquals(p.update.market_cap, 10_000_000);
  assertEquals(p.update.is_draftable, false);
});

Deno.test('planRow: no known size and none in the answer stays off', () => {
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

Deno.test('planRow: a held stock is marked', () => {
  assertEquals(planRow(onList('H', { list_drop_held_at: MARKED }), okBig, 40, false).marked, true);
});

// ---------------------------------------------------------------------------
// The limit
// ---------------------------------------------------------------------------

Deno.test('limit: MASS_DROP_MIN is 2 and may never exceed 4 (5 of 50 is the tenth that must be refused)', () => {
  assertEquals(MASS_DROP_MIN, 2);
  assert(MASS_DROP_MIN <= 4);
  assertEquals(MASS_DROP_SHARE, 0.05);
});

Deno.test('limit: a full run of 50 refuses at 3, of 80 at 5; a tenth is always over', () => {
  assertEquals(massDropLimit(50), 2);
  assertEquals(massDropLimit(80), 4);
  assert(5 > massDropLimit(50));
  assert(8 > massDropLimit(80));
});

Deno.test('limit: never below the fixed minimum; the share takes over for large runs', () => {
  assertEquals(massDropLimit(0), MASS_DROP_MIN);
  assertEquals(massDropLimit(10), MASS_DROP_MIN);
  assertEquals(massDropLimit(1000), 50);
});

// ---------------------------------------------------------------------------
// decideRun — new drops, the per-run limit, the daily budget
// ---------------------------------------------------------------------------

/** `n` on-list stocks, the first `bad` of which get a sub-floor size. */
function plans(n: number, bad: number, over: Partial<SymbolRow> = {}) {
  return Array.from({ length: n }, (_, i) =>
    planRow(onList(`S${i}`, over), i < bad ? okTiny : okNoSize, 40, false)
  );
}

const NOW = Date.parse('2026-11-24T15:00:00.000Z');
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
/** A run's context: now, and how many drops were applied in the past 24 h. */
const ctx = (dropsInWindow = 0) => ({ nowMs: NOW, dropsInWindow });

Deno.test('budget: DAILY_DROP_BUDGET is 20 and the window is 24 h; marks must be 24 h old', () => {
  assertEquals(DAILY_DROP_BUDGET, 20);
  assertEquals(DROP_WINDOW_MS, 24 * HOUR);
  assertEquals(MARK_MIN_AGE_MS, 24 * HOUR);
});

Deno.test('decideRun: drops within the limit apply at once, stamped with list_dropped_at', () => {
  const d = decideRun(plans(50, 2), ctx());
  assertEquals(d.refused, false);
  assertEquals(d.dropped, ['S0', 'S1']);
  assertEquals([d.markNew, d.cursorOnly], [[], []]);
  assertEquals(d.rows.length, 50);
  const s0 = d.rows.find((r) => r.symbol === 'S0')!.values;
  assertEquals([s0.is_draftable, s0.list_dropped_at], [false, iso(NOW)]);
});

Deno.test('decideRun: list_dropped_at is written only for an applied drop, never cleared', () => {
  const d = decideRun(plans(50, 1), ctx());
  for (const r of d.rows) {
    if (r.symbol === 'S0') assertEquals(r.values.list_dropped_at, iso(NOW));
    else assert(!('list_dropped_at' in r.values), `${r.symbol} must not touch list_dropped_at`);
  }
});

Deno.test('decideRun (Done 4): a tenth of the run dropping holds all of them with a new mark, writes the rest', () => {
  const d = decideRun(plans(50, 5), ctx());
  assertEquals(d.refused, true);
  assertEquals(d.markNew, ['S0', 'S1', 'S2', 'S3', 'S4']);
  assertEquals(d.heldForRefusal, d.markNew);
  assertEquals(d.dropped, []);
  assertEquals(d.rows.length, 45);
  assertEquals(d.rows.filter((r) => !r.values.is_draftable), []);
});

Deno.test('decideRun: stocks already off, or joining, are not drops', () => {
  const ps = [
    ...Array.from({ length: 10 }, (_, i) => planRow(onList(`OFF${i}`, { market_cap: null, is_draftable: false }), okNoSize, 40, false)),
    ...Array.from({ length: 10 }, (_, i) => planRow(onList(`JOIN${i}`, { market_cap: null, is_draftable: false }), okBig, 40, false)),
  ];
  const d = decideRun(ps, ctx());
  assertEquals(d.newDrops, []);
  assertEquals(d.refused, false);
});

Deno.test('decideRun: the limit is over the stocks JUDGED (a short run of 10 with 3 drops refuses)', () => {
  const d = decideRun(plans(10, 3), ctx());
  assertEquals([d.judged, d.limit, d.refused], [10, 2, true]);
});

Deno.test('decideRun: every normal write clears the hold mark', () => {
  for (const r of decideRun(plans(50, 0), ctx()).rows) assertEquals(r.values.list_drop_held_at, null);
});

Deno.test('budget: with 20 drops in the past 24 h a further new drop is held with a new mark and reported', () => {
  const d = decideRun(plans(50, 1), ctx(20));
  assertEquals(d.budgetLeft, 0);
  assertEquals(d.dropped, []);
  assertEquals(d.heldForBudget, ['S0']);
  assertEquals(d.markNew, ['S0']);
});

Deno.test('budget: with 20 drops in the past 24 h a held-before stock still failing is held, mark kept', () => {
  const d = decideRun([planRow(onList('H', { list_drop_held_at: iso(NOW - 30 * HOUR) }), okTiny, 40, false)], ctx(20));
  assertEquals(d.heldForBudget, ['H']);
  assertEquals(d.cursorOnly, ['H']);
  assertEquals(d.markNew, []);
});

Deno.test('budget: held-before stocks take the allowance first, oldest mark first, then new drops', () => {
  const ps = [
    planRow(onList('NEW'), okTiny, 40, false),
    planRow(onList('YOUNGER', { list_drop_held_at: iso(NOW - 30 * HOUR) }), okTiny, 40, false),
    planRow(onList('OLDEST', { list_drop_held_at: iso(NOW - 50 * HOUR) }), okTiny, 40, false),
  ];
  const d = decideRun(ps, ctx(DAILY_DROP_BUDGET - 1)); // one left
  assertEquals(d.dropped, ['OLDEST']);
  assertEquals(d.heldForBudget.sort(), ['NEW', 'YOUNGER']);
  assertEquals(d.markNew, ['NEW']);
  assertEquals(d.cursorOnly, ['YOUNGER']);
});

Deno.test('budget: a count over the budget (a failed read is counted as the whole budget) leaves 0, never negative', () => {
  assertEquals(decideRun(plans(5, 1), ctx(999)).budgetLeft, 0);
});

// ---------------------------------------------------------------------------
// decideRun — second readings (mark = first held, never refreshed)
// ---------------------------------------------------------------------------

const heldAgo = (hours: number) => ({ list_drop_held_at: iso(NOW - hours * HOUR) });

Deno.test('second reading: fresh numbers pass -> mark cleared, still on the list', () => {
  const d = decideRun([planRow(onList('H', heldAgo(30)), okBig, 40, false)], ctx());
  assertEquals(d.cleared, ['H']);
  assertEquals(d.rows[0].values.is_draftable, true);
  assertEquals(d.rows[0].values.list_drop_held_at, null);
});

Deno.test('second reading: a mark only an hour old whose numbers now pass is cleared at once', () => {
  const d = decideRun([planRow(onList('H', heldAgo(1)), okBig, 40, false)], ctx());
  assertEquals(d.cleared, ['H']);
  assertEquals(d.deferredYoung, []);
  assertEquals(d.rows[0].values.list_drop_held_at, null);
});

Deno.test('second reading: a mark under 24 h old still failing -> cursor only, mark kept, no verdict', () => {
  const d = decideRun([planRow(onList('H', heldAgo(23)), okTiny, 40, false)], ctx());
  assertEquals(d.deferredYoung, ['H']);
  assertEquals(d.cursorOnly, ['H']);
  assertEquals([d.dropped, d.rows, d.heldForBudget, d.heldForRefusal], [[], [], [], []]);
});

Deno.test('second reading: still failing, mark 24 h old or more, run not refusing, budget left -> dropped', () => {
  const d = decideRun([planRow(onList('H', heldAgo(24)), okTiny, 40, false)], ctx());
  assertEquals(d.dropped, ['H']);
  assertEquals(d.rows[0].values.is_draftable, false);
  assertEquals(d.rows[0].values.list_drop_held_at, null);
  assertEquals(d.rows[0].values.list_dropped_at, iso(NOW));
});

Deno.test('second reading: still failing while this run refuses new drops -> held again, mark kept', () => {
  const ps = [...plans(50, 3), planRow(onList('H', heldAgo(30)), okTiny, 40, false)];
  const d = decideRun(ps, ctx());
  assertEquals(d.refused, true);
  assertEquals(d.heldForRefusal.includes('H'), true);
  assertEquals(d.cursorOnly, ['H']);
  assertEquals(d.dropped, []);
});

Deno.test('second reading: a held stock is not a new drop, so a group coming round together is not refused for being a group', () => {
  const d = decideRun(plans(50, 10, heldAgo(30)), ctx());
  assertEquals(d.newDrops, []);
  assertEquals(d.refused, false);
  assertEquals(d.dropped.length, 10);
});

// ---------------------------------------------------------------------------
// tallyProfiles — the supplier's answers, report only
// ---------------------------------------------------------------------------

Deno.test('tallyProfiles: the four counts add up to the stocks judged', () => {
  const ps = [
    ...Array.from({ length: 7 }, (_, i) => planRow(onList(`A${i}`), okBig, 40, false)),
    ...Array.from({ length: 5 }, (_, i) => planRow(onList(`B${i}`), okNoSize, 40, false)),
    ...Array.from({ length: 4 }, (_, i) => planRow(onList(`C${i}`), { status: 'empty' }, 40, false)),
    ...Array.from({ length: 3 }, (_, i) => planRow(onList(`E${i}`, { is_etf: true }), { status: 'skipped' }, 40, false)),
  ];
  const t = tallyProfiles(ps);
  assertEquals([t.profile_ok_size, t.profile_ok_no_size, t.profile_empty, t.profile_skipped_etf], [7, 5, 4, 3]);
  assertEquals(t.profile_ok_size + t.profile_ok_no_size + t.profile_empty + t.profile_skipped_etf, ps.length);
  assertEquals(t.profile_ok_no_size_symbols, ['B0', 'B1', 'B2', 'B3', 'B4']);
  assertEquals(t.profile_empty_symbols, ['C0', 'C1', 'C2', 'C3']);
});

Deno.test('tallyProfiles: the symbol lists cap at 20; the counts do not', () => {
  const ps = [
    ...Array.from({ length: 30 }, (_, i) => planRow(onList(`B${i}`), okNoSize, 40, false)),
    ...Array.from({ length: 25 }, (_, i) => planRow(onList(`C${i}`), { status: 'empty' }, 40, false)),
  ];
  const t = tallyProfiles(ps);
  assertEquals(t.profile_ok_no_size, 30);
  assertEquals(t.profile_empty, 25);
  assertEquals(t.profile_ok_no_size_symbols.length, 20);
  assertEquals(t.profile_empty_symbols.length, 20);
});

Deno.test('tallyProfiles: symbols and counts only (no supplier payload can reach the line)', () => {
  const t = tallyProfiles([planRow(onList('A'), okBig, 40, false)]);
  for (const v of Object.values(t)) {
    assert(typeof v === 'number' || (Array.isArray(v) && v.every((s) => typeof s === 'string')));
  }
});
