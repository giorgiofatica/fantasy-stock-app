/**
 * Tests for batch.ts selectBatch: an unpriced stock is asked again at most
 * once a day from the priority tier (the Planner, 2026-11-24; counted that day:
 * the 388 unpriced stocks were re-asked every ~2.5 h and ~400 asks in 3.6 h
 * priced 3).
 *
 * The REAL selectBatch runs here, building its real PostgREST queries
 * (filters, the or() string from priorityRetryFilter, order, limit, not-in).
 * Only the client is faked: an in-memory table that evaluates exactly the
 * calls it receives, and throws on any it does not model, so a query this
 * fake cannot read fails the test instead of passing it.
 *
 * Run from repo root:
 *   deno test --allow-read --allow-env supabase/functions/enrich-symbols/batch_select.test.ts
 */
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert';
import { PRIORITY_RETRY_MS, priorityRetryFilter, selectBatch, type SymbolsClient } from './batch.ts';

const HOUR = 3_600_000;
const NOW = Date.parse('2026-11-24T22:30:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

type Row = Record<string, unknown>;

/** One PostgREST-shaped query over an in-memory table. */
class FakeQuery {
  private preds: ((r: Row) => boolean)[] = [];
  private orderBy: { col: string; nullsFirst: boolean } | null = null;
  private max = Infinity;
  constructor(private rows: Row[], private fail: string | null) {}
  select(_cols: string) {
    return this;
  }
  eq(col: string, v: unknown) {
    this.preds.push((r) => r[col] === v);
    return this;
  }
  is(col: string, v: null) {
    if (v !== null) throw new Error(`fake: is(${col}, ${v}) not modelled`);
    this.preds.push((r) => r[col] === null);
    return this;
  }
  /** PostgREST or(): `col.op.value,...`; the value may itself contain dots (an ISO time). */
  or(expr: string) {
    const terms = expr.split(',').map((t) => {
      const [col, op, ...rest] = t.split('.');
      const val = rest.join('.');
      if (op === 'is' && val === 'null') return (r: Row) => r[col] === null;
      if (op === 'lt') return (r: Row) => r[col] !== null && String(r[col]) < val;
      throw new Error(`fake: or term ${t} not modelled`);
    });
    this.preds.push((r) => terms.some((f) => f(r)));
    return this;
  }
  not(col: string, op: string, list: string) {
    if (op !== 'in' || !list.startsWith('(') || !list.endsWith(')')) throw new Error(`fake: not(${op}) not modelled`);
    const out = new Set(list.slice(1, -1).split(','));
    this.preds.push((r) => !out.has(String(r[col])));
    return this;
  }
  order(col: string, opts: { ascending: boolean; nullsFirst: boolean }) {
    if (!opts.ascending) throw new Error('fake: descending order not modelled');
    this.orderBy = { col, nullsFirst: opts.nullsFirst };
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  then<T>(resolve: (v: { data: Row[] | null; error: { message: string } | null }) => T) {
    if (this.fail) return Promise.resolve(resolve({ data: null, error: { message: this.fail } }));
    let out = this.rows.filter((r) => this.preds.every((p) => p(r)));
    if (this.orderBy) {
      const { col, nullsFirst } = this.orderBy;
      out = [...out].sort((a, b) => {
        const x = a[col], y = b[col];
        if (x === null && y === null) return 0;
        if (x === null) return nullsFirst ? -1 : 1;
        if (y === null) return nullsFirst ? 1 : -1;
        return String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0;
      });
    }
    return Promise.resolve(resolve({ data: out.slice(0, this.max), error: null }));
  }
}

function client(rows: Row[], failOnCall: number | null = null): SymbolsClient {
  let calls = 0;
  return {
    from(table: 'symbols') {
      if (table !== 'symbols') throw new Error(`fake: table ${table}`);
      calls++;
      return new FakeQuery(rows, calls === failOnCall ? 'boom' : null);
    },
  };
}

/** A stock row. `asked` = hours since last asked (null = never); `price` null = unpriced. */
function stock(symbol: string, asked: number | null, price: number | null, over: Row = {}): Row {
  return {
    symbol,
    exchange: 'NYSE',
    is_etf: false,
    active: true,
    gics_industry: 'Banking',
    last_price: price,
    market_cap: 5e9,
    is_draftable: price !== null,
    list_drop_held_at: null,
    price_unsupported: false,
    enriched_at: asked === null ? null : iso(NOW - asked * HOUR),
    ...over,
  };
}

/** `n` priced stocks, last asked 30..(30+n) h ago (the stalest pool's normal stock). */
const priced = (n: number) => Array.from({ length: n }, (_, i) => stock(`P${i}`, 100 - i, 40));
const symbols = (rows: { symbol: unknown }[]) => rows.map((r) => String(r.symbol));

Deno.test('priority retry: the window is a day and the filter is never-asked OR asked before the cutoff', () => {
  assertEquals(PRIORITY_RETRY_MS, 24 * HOUR);
  assertEquals(priorityRetryFilter(NOW), `enriched_at.is.null,enriched_at.lt.${iso(NOW - 24 * HOUR)}`);
});

Deno.test('priority retry: an unpriced stock asked 1 h ago is NOT in the priority pick (a held stock, price kept, is never in this tier either)', async () => {
  const rows = [stock('U1H', 1, null), ...priced(10)];
  const batch = await selectBatch(client(rows), 4, NOW);
  assert(!symbols(batch).includes('U1H'), 'asked an hour ago: not re-asked yet');
  assertEquals(symbols(batch), ['P0', 'P1', 'P2', 'P3']); // the stalest pool fills the batch
});

Deno.test('priority retry: a never-asked unpriced stock IS picked, at the front (a held stock, price kept, is never in this tier)', async () => {
  const rows = [...priced(10), stock('UNEW', null, null)];
  const batch = await selectBatch(client(rows), 4, NOW);
  assertEquals(symbols(batch)[0], 'UNEW');
  assertEquals(symbols(batch), ['UNEW', 'P0', 'P1', 'P2']);
});

Deno.test('priority retry: an unpriced stock last asked more than a day ago is picked again, before the stalest pool', async () => {
  const rows = [...priced(10), stock('U25H', 25, null)];
  const batch = await selectBatch(client(rows), 4, NOW);
  assertEquals(symbols(batch)[0], 'U25H');
});

Deno.test('priority retry: with the backlog asked today, the run fills from the stalest pool (a held stock, price kept, is never in the priority tier)', async () => {
  // 388 unpriced stocks all asked in the last few hours, as counted on 2026-11-24.
  const backlog = Array.from({ length: 388 }, (_, i) => stock(`U${i}`, (i % 20) / 10 + 0.1, null));
  const rows = [...backlog, ...priced(100)];
  const batch = await selectBatch(client(rows), 50, NOW);
  assertEquals(batch.length, 50);
  assertEquals(symbols(batch), Array.from({ length: 50 }, (_, i) => `P${i}`));
});

Deno.test('priority retry: the half cap and the price_unsupported exclusion are unchanged', async () => {
  const due = Array.from({ length: 40 }, (_, i) => stock(`U${i}`, null, null));
  const unsupported = stock('UNSUP', null, null, { price_unsupported: true });
  const rows = [unsupported, ...due, ...priced(100)];
  const batch = symbols(await selectBatch(client(rows), 50, NOW));
  // The tier's picks come first in the merge: exactly half the batch, UNSUP not among them.
  assertEquals(batch.slice(0, 25), Array.from({ length: 25 }, (_, i) => `U${i}`));
  // The stalest pool (every active stock, nulls first) then fills the rest; UNSUP
  // can come back through it, as before this change.
  assertEquals(batch[25], 'UNSUP');
  assertEquals(batch.length, 50);
});

Deno.test('priority retry: a held stock (cursor advanced, price kept) is never in the priority tier, however stale', async () => {
  // Batch of 2 (tier cap 1). H is held with a price and is the stalest row of all;
  // U was asked 30 h ago. Were H tier-eligible it would come first.
  const rows = [
    stock('H', 500, 40, { list_drop_held_at: iso(NOW - 30 * HOUR) }),
    stock('U', 30, null),
    ...priced(5),
  ];
  const batch = await selectBatch(client(rows), 2, NOW);
  assertEquals(symbols(batch), ['U', 'H']); // U from the tier, H from the stalest pool
});

Deno.test('priority retry: a failed read still throws select_failed (nothing judged, nothing written)', async () => {
  await assertRejects(() => selectBatch(client(priced(5), 1), 4, NOW), Error, 'select_failed (priority)');
  await assertRejects(() => selectBatch(client(priced(5), 2), 4, NOW), Error, 'select_failed (stalest)');
});
