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
  decideRun,
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
// decideRun — new drops
// ---------------------------------------------------------------------------

/** `n` on-list stocks, the first `bad` of which get a sub-floor size. */
function plans(n: number, bad: number, over: Partial<SymbolRow> = {}) {
  return Array.from({ length: n }, (_, i) =>
    planRow(onList(`S${i}`, over), i < bad ? okTiny : okNoSize, 40, false)
  );
}

Deno.test('decideRun: drops within the limit apply at once', () => {
  const d = decideRun(plans(50, 2), false);
  assertEquals(d.refused, false);
  assertEquals(d.dropped, ['S0', 'S1']);
  assertEquals(d.hold, []);
  assertEquals(d.rows.length, 50);
  assertEquals(d.rows.find((r) => r.symbol === 'S0')!.values.is_draftable, false);
});

Deno.test('decideRun: a single drop applies at once even with a recent hold elsewhere (the 24 h rule is for second readings)', () => {
  const d = decideRun(plans(50, 1), true);
  assertEquals(d.dropped, ['S0']);
  assertEquals(d.hold, []);
});

Deno.test('decideRun (Done 4): a tenth of the run dropping holds all of them and writes the rest', () => {
  const d = decideRun(plans(50, 5), false);
  assertEquals(d.refused, true);
  assertEquals(d.hold, ['S0', 'S1', 'S2', 'S3', 'S4']);
  assertEquals(d.heldNew, d.hold);
  assertEquals(d.dropped, []);
  assertEquals(d.rows.length, 45);
  assertEquals(d.rows.filter((r) => !r.values.is_draftable), []);
});

Deno.test('decideRun: stocks already off, or joining, are not drops', () => {
  const ps = [
    ...Array.from({ length: 10 }, (_, i) => planRow(onList(`OFF${i}`, { market_cap: null, is_draftable: false }), okNoSize, 40, false)),
    ...Array.from({ length: 10 }, (_, i) => planRow(onList(`JOIN${i}`, { market_cap: null, is_draftable: false }), okBig, 40, false)),
  ];
  const d = decideRun(ps, false);
  assertEquals(d.newDrops, []);
  assertEquals(d.refused, false);
});

Deno.test('decideRun: the limit is over the stocks JUDGED (a short run of 10 with 3 drops refuses)', () => {
  const d = decideRun(plans(10, 3), false);
  assertEquals(d.judged, 10);
  assertEquals(d.limit, 2);
  assertEquals(d.refused, true);
});

Deno.test('decideRun: every normal write clears the mark', () => {
  for (const r of decideRun(plans(50, 0), false).rows) assertEquals(r.values.list_drop_held_at, null);
});

// ---------------------------------------------------------------------------
// decideRun — second readings
// ---------------------------------------------------------------------------

Deno.test('second reading: fresh numbers pass -> mark cleared, still on the list', () => {
  const d = decideRun([planRow(onList('H', { list_drop_held_at: MARKED }), okBig, 40, false)], false);
  assertEquals(d.cleared, ['H']);
  assertEquals(d.rows[0].values.is_draftable, true);
  assertEquals(d.rows[0].values.list_drop_held_at, null);
});

Deno.test('second reading: still failing on a quiet day, run not refusing -> dropped, mark cleared', () => {
  const d = decideRun([planRow(onList('H', { list_drop_held_at: MARKED }), okTiny, 40, false)], false);
  assertEquals(d.dropped, ['H']);
  assertEquals(d.rows[0].values.is_draftable, false);
  assertEquals(d.rows[0].values.list_drop_held_at, null);
});

Deno.test('second reading: still failing with a hold in the last 24 h -> held again', () => {
  const d = decideRun([planRow(onList('H', { list_drop_held_at: MARKED }), okTiny, 40, false)], true);
  assertEquals(d.heldAgain, ['H']);
  assertEquals(d.rows, []);
});

Deno.test('second reading: still failing while this run refuses -> held again', () => {
  const ps = [...plans(50, 3), planRow(onList('H', { list_drop_held_at: MARKED }), okTiny, 40, false)];
  const d = decideRun(ps, false);
  assertEquals(d.refused, true);
  assertEquals(d.heldAgain, ['H']);
  assertEquals(d.dropped, []);
});

Deno.test('second reading: a held stock is not a new drop, so a group coming round together is not refused for being a group', () => {
  const ps = plans(50, 10, { list_drop_held_at: MARKED });
  const d = decideRun(ps, false);
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
