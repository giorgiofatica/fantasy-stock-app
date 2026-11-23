// Hermetic tests for record-trade's LIST preview (preview-list.ts): the row
// bound, own-watchlist filtering (and the read order that keeps an unsaved
// symbol's category unread), slot-less leagues, missing prices, and that each
// row's answer is the single preview's answer for the same price.
// The real handler end to end: supabase/tests/record_trade_list_preview.test.ts.
//   deno test supabase/functions/record-trade/preview-list.test.ts
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert';
import { type LedgerState, slotPreview } from './commit.ts';
import {
  answerPreviewRows,
  MAX_PREVIEW_ROWS,
  parsePreviewRows,
  type PreviewRowRequest,
  previewRows,
  type RowReads,
} from './preview-list.ts';

const ME = '11111111-1111-1111-1111-111111111111';
const LO = { id: 's-lo', slot_index: 0, slot_count: 1, price_min: '0', price_max: '200', category_id: null };
const HI = { id: 's-hi', slot_index: 1, slot_count: 1, price_min: '200', price_max: null, category_id: null };
const TECH = 'cat-tech';
const CAT = { id: 's-cat', slot_index: 0, slot_count: 1, price_min: null, price_max: null, category_id: TECH };
const FLEX = { id: 's-flex', slot_index: 1, slot_count: 1, price_min: null, price_max: null, category_id: null };

function state(over: Partial<LedgerState> = {}): LedgerState {
  return {
    league: {
      draft_status: 'completed',
      season_status: 'active',
      stake_mode: 'price_tiers',
      budget_amount: 1000,
      notional_per_slot: 1000,
      num_rounds: 4,
      allow_undraftable: false,
    },
    // NVDA holds the $200+ slot; the $0–$200 slot is free.
    picks: [{ id: 'd1', user_id: ME, symbol: 'NVDA', entry_price: 900, quantity: 1, pick_number: 1, slot_id: HI.id }],
    trades: [],
    slots: [LO, HI],
    eligibleCategories: new Set(),
    ...over,
  };
}

/** Fake reads that record every call, so a test can assert what was looked up. */
function reads(saved: string[], opts: { savedError?: boolean; elig?: Record<string, string[]>; eligThrows?: boolean } = {}) {
  const calls = { savedAmong: [] as string[][], eligibilityFor: [] as string[][] };
  const r: RowReads = {
    savedAmong: (syms) => {
      calls.savedAmong.push([...syms]);
      if (opts.savedError) return Promise.resolve({ ok: false as const });
      return Promise.resolve({ ok: true as const, saved: new Set(saved) });
    },
    eligibilityFor: (syms) => {
      calls.eligibilityFor.push([...syms]);
      if (opts.eligThrows) return Promise.reject(new Error('eligibility_fetch_failed'));
      const m = new Map<string, Set<string>>();
      for (const s of syms) m.set(s, new Set(opts.elig?.[s] ?? []));
      return Promise.resolve(m);
    },
  };
  return { r, calls };
}

const row = (symbol: string | null, price: number | null): PreviewRowRequest => ({ symbol, price });

// ---------------------------------------------------------------------------
// parsePreviewRows: shape and bound
// ---------------------------------------------------------------------------

Deno.test('parsePreviewRows: the bound is the watchlist cap — 50 rows parse, 51 are a bad_request (never a silent cut)', () => {
  assertEquals(MAX_PREVIEW_ROWS, 50);
  const fifty = Array.from({ length: 50 }, (_, i) => ({ symbol: `S${i}`, price: 10 }));
  const p = parsePreviewRows(fifty);
  assert(p.ok);
  assertEquals(p.rows.length, 50);
  assertEquals(parsePreviewRows([...fifty, { symbol: 'X', price: 1 }]), { ok: false });
});

Deno.test('parsePreviewRows: not an array is a bad_request; an empty list is fine', () => {
  for (const bad of [null, undefined, {}, 'AAPL', 5, { 0: { symbol: 'A', price: 1 }, length: 1 }]) {
    assertEquals(parsePreviewRows(bad), { ok: false }, JSON.stringify(bad));
  }
  assertEquals(parsePreviewRows([]), { ok: true, rows: [] });
});

Deno.test('parsePreviewRows: elements parse leniently — an unusable symbol or price is null, never an error', () => {
  const p = parsePreviewRows([
    { symbol: ' aapl ', price: 150 },       // trimmed + upper-cased, as the single preview does
    { symbol: 'MSFT', price: '210.5' },      // a numeric string, as Number(body.price) accepts
    { symbol: 'GOOG' },                      // a price that did not load
    { symbol: 'GOOG', price: null },
    { symbol: 'GOOG', price: 0 },
    { symbol: 'GOOG', price: -3 },
    { symbol: 'GOOG', price: 'abc' },
    { symbol: 'GOOG', price: true },
    { price: 10 },                           // no symbol
    { symbol: 'TOOLONGSYMBOL', price: 10 },  // 13 chars: the table cannot hold it
    { symbol: 'A,B', price: 10 },            // a character that is not plain in an in.() filter
    { symbol: 'A"B', price: 10 },
    { symbol: 'BRK.B', price: 10 },
    'AAPL',
    null,
    [1, 2],
  ]);
  assert(p.ok);
  assertEquals(p.rows, [
    row('AAPL', 150),
    row('MSFT', 210.5),
    row('GOOG', null),
    row('GOOG', null),
    row('GOOG', null),
    row('GOOG', null),
    row('GOOG', null),
    row('GOOG', null),
    row(null, 10),
    row(null, 10),
    row(null, 10),
    row(null, 10),
    row('BRK.B', 10),
    row(null, null),
    row(null, null),
    row(null, null),
  ]);
});

// ---------------------------------------------------------------------------
// previewRows: own-watchlist filtering and read order
// ---------------------------------------------------------------------------

Deno.test('previewRows: a symbol NOT on the caller\'s watchlist gets null, exactly like a row with no price', async () => {
  const { r } = reads(['AAPL']);
  const res = await previewRows(state(), ME, [row('AAPL', 150), row('TSLA', 150), row('MSFT', null)], r);
  assert(res.ok);
  assertEquals(res.value[0]?.symbol, 'AAPL');
  assertEquals(res.value[0]?.would_fill?.slot_id, LO.id);
  // Unsaved and unpriced read the same: the answer never says WHY.
  assertEquals(res.value[1], null);
  assertEquals(res.value[2], null);
});

Deno.test('previewRows: the saved set is read first, and only for priced rows; eligibility only for SAVED symbols', async () => {
  const st = state({ slots: [CAT, FLEX], picks: [] });
  const { r, calls } = reads(['AAPL'], { elig: { AAPL: [TECH], TSLA: [TECH] } });
  const res = await previewRows(st, ME, [row('AAPL', 150), row('TSLA', 150), row('GOOG', null)], r);
  assert(res.ok);
  assertEquals(calls.savedAmong, [['AAPL', 'TSLA']], 'GOOG has no price: not even asked about');
  assertEquals(calls.eligibilityFor, [['AAPL']], 'TSLA is not saved: its category is never read');
  assertEquals(res.value[0]?.would_fill?.slot_id, CAT.id);
  assertEquals(res.value[1], null);
});

Deno.test('previewRows: a "saved" answer for a symbol that was not asked about is ignored', async () => {
  // Defence in depth against a read that returns more than it was asked.
  const { r, calls } = reads(['AAPL', 'TSLA'], { elig: { AAPL: [TECH], TSLA: [TECH] } });
  const st = state({ slots: [CAT, FLEX], picks: [] });
  const res = await previewRows(st, ME, [row('AAPL', 150)], r);
  assert(res.ok);
  assertEquals(calls.eligibilityFor, [['AAPL']]);
  assertEquals(res.value.length, 1);
});

Deno.test('previewRows: nothing saved among the rows -> every row null and no category read', async () => {
  const { r, calls } = reads([]);
  const res = await previewRows(state({ slots: [CAT, FLEX] }), ME, [row('AAPL', 150), row('TSLA', 9)], r);
  assertEquals(res, { ok: true, value: [null, null] });
  assertEquals(calls.eligibilityFor, []);
});

Deno.test('previewRows: a league with NO slots -> every row null, and no read at all', async () => {
  const { r, calls } = reads(['AAPL']);
  const res = await previewRows(state({ slots: [] }), ME, [row('AAPL', 150), row('MSFT', 20)], r);
  assertEquals(res, { ok: true, value: [null, null] });
  assertEquals(calls, { savedAmong: [], eligibilityFor: [] });
  // slots: null (as a sell's ledger would carry) reads the same
  const res2 = await previewRows(state({ slots: null }), ME, [row('AAPL', 150)], r);
  assertEquals(res2, { ok: true, value: [null] });
});

Deno.test('previewRows: every price missing -> every row null, and no read at all', async () => {
  const { r, calls } = reads(['AAPL']);
  const res = await previewRows(state(), ME, [row('AAPL', null), row(null, 5)], r);
  assertEquals(res, { ok: true, value: [null, null] });
  assertEquals(calls, { savedAmong: [], eligibilityFor: [] });
});

Deno.test('previewRows: a watchlist READ ERROR is the preview\'s 500, never a page of nulls that reads as "Available"', async () => {
  const { r } = reads([], { savedError: true });
  const res = await previewRows(state(), ME, [row('AAPL', 150)], r);
  assertEquals(res, { ok: false, reply: { status: 500, body: { ok: false, reason: 'unhandled' } } });
});

Deno.test('previewRows: an eligibility read error throws (index.ts\'s catch answers 500), never a flex-only guess', async () => {
  const { r } = reads(['AAPL'], { eligThrows: true });
  await assertRejects(() => previewRows(state({ slots: [CAT, FLEX] }), ME, [row('AAPL', 150)], r));
});

Deno.test('previewRows: the answer is aligned with the request — same order, same length, duplicates answered each at their own price', async () => {
  const { r } = reads(['AAPL', 'MSFT']);
  const res = await previewRows(state(), ME, [row('MSFT', 500), row('AAPL', 150), row('AAPL', 250), row('ZZZ', 1)], r);
  assert(res.ok);
  assertEquals(res.value.length, 4);
  assertEquals(res.value[0]?.symbol, 'MSFT');
  assertEquals(res.value[0]?.price, 500);
  assertEquals(res.value[1]?.price, 150);
  assertEquals(res.value[2]?.price, 250);
  assertEquals(res.value[3], null);
});

// ---------------------------------------------------------------------------
// answerPreviewRows: the buy's own rule, worded as the single preview words it
// ---------------------------------------------------------------------------

Deno.test('answerPreviewRows: each row is EXACTLY the single preview\'s would_fill / open_slots at that price', () => {
  // Price tiers: $150 fits the free $0–$200 slot; $500 finds the $200+ slot held.
  const st = state();
  const saved = new Set(['AAPL', 'MSFT']);
  const out = answerPreviewRows(st, ME, [row('AAPL', 150), row('MSFT', 500), row('AAPL', 1e30)], saved, new Map());
  for (const [i, price] of [[0, 150], [1, 500], [2, 1e30]] as const) {
    const single = slotPreview(st, ME, price);
    const { symbol: _s, price: _p, ...fit } = out[i]!;
    const expected: Record<string, unknown> = { would_fill: single.would_fill };
    if ('open_slots' in single) expected.open_slots = single.open_slots;
    assertEquals(fit, expected, `price ${price}`);
  }
  assertEquals(out[0], {
    symbol: 'AAPL',
    price: 150,
    would_fill: { slot_id: LO.id, slot_index: 0, slot_count: 1, price_min: 0, price_max: 200, category_id: null },
  });
  assertEquals(out[1], {
    symbol: 'MSFT',
    price: 500,
    would_fill: null,
    open_slots: [{ slot_id: LO.id, slot_index: 0, slot_count: 1, price_min: 0, price_max: 200, category_id: null }],
  });
});

Deno.test('answerPreviewRows: a category league uses each symbol\'s OWN eligibility; one without an entry gets null, not a flex guess', () => {
  const st = state({ slots: [CAT, FLEX], picks: [] });
  const saved = new Set(['AAPL', 'XOM', 'GHOST']);
  const elig = new Map([['AAPL', new Set([TECH])], ['XOM', new Set<string>()]]);
  const out = answerPreviewRows(st, ME, [row('AAPL', 150), row('XOM', 100), row('GHOST', 100)], saved, elig);
  assertEquals(out[0]?.would_fill?.slot_id, CAT.id, 'a tech stock takes the tech slot first');
  assertEquals(out[1]?.would_fill?.slot_id, FLEX.id, 'a non-tech stock only fits the flex slot');
  assertEquals(out[2], null, 'no eligibility came back for GHOST');
});

Deno.test('answerPreviewRows: only the CALLER\'s positions count (a neighbour holding the free tier changes nothing)', () => {
  const st = state({
    trades: [{ id: 't1', user_id: 'someone-else', symbol: 'MSFT', action: 'buy', quantity: 1, price: 100, slot_id: LO.id, created_at: '2026-10-01T15:00:00Z' }],
  });
  const out = answerPreviewRows(st, ME, [row('AAPL', 150)], new Set(['AAPL']), new Map());
  assertEquals(out[0]?.would_fill?.slot_id, LO.id);
});
