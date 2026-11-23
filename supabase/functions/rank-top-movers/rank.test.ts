// Hermetic: no network, no DB, no --allow flags.
//   deno test supabase/functions/rank-top-movers/
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  BATCH_SIZE,
  chunk,
  decideRanking,
  type Evaluation,
  evaluateSnapshot,
  FRESH_MAX_AGE_MS,
  passesFreshGate,
  RANKING_ROWS,
  SET_SIZE,
  skipCounts,
} from './rank.ts';

const NOW = new Date('2026-12-14T16:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const snap = (p: number, prev: number, tradeAt = ago(60_000), extra: Record<string, unknown> = {}) => ({
  latestTrade: { p, t: tradeAt },
  prevDailyBar: { c: prev },
  ...extra,
});

Deno.test('the plan numbers', () => {
  assertEquals([SET_SIZE, BATCH_SIZE, FRESH_MAX_AGE_MS, RANKING_ROWS], [500, 50, 900_000, 100]);
  assertEquals(chunk(Array.from({ length: 500 }, (_, i) => i), 50).length, 10);
  assertEquals(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assertEquals(chunk([], 50), []);
});

Deno.test('evaluateSnapshot: today\'s change is the trade against the previous close', () => {
  const e = evaluateSnapshot('AAA', snap(110, 100), NOW);
  assert(e.fresh);
  assertEquals([e.price, e.prevClose], [110, 100]);
  assert(Math.abs(e.changePct - 10) < 1e-9);
  const down = evaluateSnapshot('BBB', snap(45, 50), NOW);
  assert(down.fresh && Math.abs(down.changePct + 10) < 1e-9);
});

Deno.test('evaluateSnapshot: the price is the trade, never a bid, an ask or the minute bar', () => {
  // A wild one-sided quote and a different minute bar are present; neither is the price.
  const e = evaluateSnapshot('AAA', snap(101, 100, ago(1000), {
    latestQuote: { ap: 999, as: 1, bp: 0, bs: 0 },
    minuteBar: { c: 150 },
    dailyBar: { c: 140 },
  }), NOW);
  assert(e.fresh);
  assertEquals(e.price, 101);
  // No trade at all, only a bar and a quote: left out, not priced from them.
  const noTrade = evaluateSnapshot('AAA', { minuteBar: { c: 150 }, latestQuote: { ap: 1, bp: 1, as: 1, bs: 1 }, prevDailyBar: { c: 100 } }, NOW);
  assertEquals(noTrade, { symbol: 'AAA', fresh: false, reason: 'no_trade' });
});

Deno.test('evaluateSnapshot: a stale trade is left out; exactly 15 minutes is still fresh', () => {
  assertEquals(evaluateSnapshot('A', snap(110, 100, ago(FRESH_MAX_AGE_MS + 1)), NOW), { symbol: 'A', fresh: false, reason: 'stale_trade' });
  assertEquals(evaluateSnapshot('A', snap(110, 100, ago(3 * 3600_000)), NOW).fresh, false);
  assertEquals(evaluateSnapshot('A', snap(110, 100, ago(FRESH_MAX_AGE_MS)), NOW).fresh, true);
  // Alpaca's nanosecond RFC 3339 stamps and offsets parse.
  assertEquals(evaluateSnapshot('A', snap(110, 100, '2026-12-14T15:59:59.957797614Z'), NOW).fresh, true);
  assertEquals(evaluateSnapshot('A', snap(110, 100, '2026-12-14T10:55:00-05:00'), NOW).fresh, true);
  assertEquals(evaluateSnapshot('A', snap(110, 100, '2026-12-14T10:44:59-05:00'), NOW).fresh, false);
});

Deno.test('evaluateSnapshot: a missing figure never ranks', () => {
  const cases: Array<[unknown, string]> = [
    [undefined, 'no_snapshot'],
    [null, 'no_snapshot'],
    ['x', 'no_snapshot'],
    [[], 'no_snapshot'],
    [{ prevDailyBar: { c: 100 } }, 'no_trade'],
    [{ latestTrade: null, prevDailyBar: { c: 100 } }, 'no_trade'],
    [{ latestTrade: { p: 0, t: ago(1) }, prevDailyBar: { c: 100 } }, 'no_trade'],
    [{ latestTrade: { p: -3, t: ago(1) }, prevDailyBar: { c: 100 } }, 'no_trade'],
    [{ latestTrade: { p: 'abc', t: ago(1) }, prevDailyBar: { c: 100 } }, 'no_trade'],
    [{ latestTrade: { p: 10 }, prevDailyBar: { c: 100 } }, 'no_trade'],
    [{ latestTrade: { p: 10, t: 'not a time' }, prevDailyBar: { c: 100 } }, 'no_trade'],
    [{ latestTrade: { p: 10, t: new Date(NOW.getTime() + 5 * 60_000).toISOString() }, prevDailyBar: { c: 100 } }, 'no_trade'],
    [{ latestTrade: { p: 10, t: ago(1) } }, 'no_prev_close'],
    [{ latestTrade: { p: 10, t: ago(1) }, prevDailyBar: null }, 'no_prev_close'],
    [{ latestTrade: { p: 10, t: ago(1) }, prevDailyBar: { c: 0 } }, 'no_prev_close'],
    [{ latestTrade: { p: 10, t: ago(1) }, prevDailyBar: { o: 9 } }, 'no_prev_close'],
  ];
  for (const [s, reason] of cases) {
    assertEquals(evaluateSnapshot('A', s, NOW), { symbol: 'A', fresh: false, reason } as Evaluation, JSON.stringify(s));
  }
  // A small forward clock skew is tolerated.
  assertEquals(evaluateSnapshot('A', snap(10, 9, new Date(NOW.getTime() + 30_000).toISOString()), NOW).fresh, true);
});

// ---- decideRanking -------------------------------------------------------------------------

const syms = (n: number) => Array.from({ length: n }, (_, i) => `S${String(i).padStart(3, '0')}`);
function evals(set: string[], freshCount: number, change = (i: number) => i - 250): Evaluation[] {
  return set.map((symbol, i) =>
    i < freshCount
      ? { symbol, fresh: true, price: 1, prevClose: 1, changePct: change(i) }
      : { symbol, fresh: false, reason: 'stale_trade' }
  );
}

Deno.test('passesFreshGate: integers, exactly 90% passes', () => {
  assertEquals(passesFreshGate(450, 500), true);
  assertEquals(passesFreshGate(449, 500), false);
  assertEquals(passesFreshGate(500, 500), true);
  assertEquals(passesFreshGate(9, 10), true);
  assertEquals(passesFreshGate(8, 10), false);
  // 90% of 7 is 6.3: 6 of 7 fails.
  assertEquals(passesFreshGate(6, 7), false);
  assertEquals(passesFreshGate(0, 0), false);
});

Deno.test('decideRanking: exactly 90% fresh writes; one stock fewer keeps the old ranking', () => {
  const set = syms(500);
  const at90 = decideRanking({ set, batchesFailed: 0, evaluations: evals(set, 450) });
  assert(at90.write);
  assertEquals([at90.setSize, at90.freshCount, at90.symbols.length], [500, 450, 100]);
  const under = decideRanking({ set, batchesFailed: 0, evaluations: evals(set, 449) });
  assertEquals(under, { write: false, reason: 'below_fresh_gate', setSize: 500, freshCount: 449 });
});

Deno.test('decideRanking: a failed batch keeps the old ranking whatever came back', () => {
  const set = syms(500);
  // Nine batches all fresh (450 = 90%), the tenth refused: still no write.
  const d = decideRanking({ set, batchesFailed: 1, evaluations: evals(set.slice(0, 450), 450) });
  assertEquals(d, { write: false, reason: 'batch_failed', setSize: 500, freshCount: 450 });
  // Even with every stock judged fresh.
  assertEquals(decideRanking({ set, batchesFailed: 1, evaluations: evals(set, 500) }).write, false);
});

Deno.test('decideRanking: every stock of the set judged exactly once, or no write', () => {
  const set = syms(20);
  const all = evals(set, 20);
  assertEquals(decideRanking({ set, batchesFailed: 0, evaluations: all }).write, true);
  assertEquals(decideRanking({ set, batchesFailed: 0, evaluations: all.slice(1) }).write, false, 'one missing');
  const d = decideRanking({ set, batchesFailed: 0, evaluations: [...all.slice(1), all[1]] });
  assertEquals(d.write ? null : d.reason, 'incomplete', 'one judged twice, one never');
  const foreign = [...all.slice(1), { ...all[0], symbol: 'ZZZ' }];
  assertEquals(decideRanking({ set, batchesFailed: 0, evaluations: foreign }).write, false, 'a stock outside the set');
  assertEquals(decideRanking({ set: [...set, set[0]], batchesFailed: 0, evaluations: all }).write, false, 'a duplicate in the set');
  assertEquals(decideRanking({ set: [], batchesFailed: 0, evaluations: [] }), {
    write: false, reason: 'empty_set', setSize: 0, freshCount: 0,
  });
});

Deno.test('decideRanking: biggest move first, up or down; top 100; ties by ticker; stale never ranks', () => {
  const set = ['UP5', 'DN9', 'UP1', 'TIE_B', 'TIE_A', 'STALE', 'FLAT', 'DN2', 'UP3', 'BIG'];
  const ev: Evaluation[] = [
    { symbol: 'UP5', fresh: true, price: 1, prevClose: 1, changePct: 5 },
    { symbol: 'DN9', fresh: true, price: 1, prevClose: 1, changePct: -9 },
    { symbol: 'UP1', fresh: true, price: 1, prevClose: 1, changePct: 1 },
    { symbol: 'TIE_B', fresh: true, price: 1, prevClose: 1, changePct: -4 },
    { symbol: 'TIE_A', fresh: true, price: 1, prevClose: 1, changePct: 4 },
    { symbol: 'FLAT', fresh: true, price: 1, prevClose: 1, changePct: 0 },
    { symbol: 'DN2', fresh: true, price: 1, prevClose: 1, changePct: -2 },
    { symbol: 'UP3', fresh: true, price: 1, prevClose: 1, changePct: 3 },
    { symbol: 'BIG', fresh: true, price: 1, prevClose: 1, changePct: 50 },
    { symbol: 'STALE', fresh: false, reason: 'stale_trade' },
  ];
  // 9 of 10 fresh = 90%: written.
  const d = decideRanking({ set, batchesFailed: 0, evaluations: ev });
  assert(d.write);
  assertEquals(d.symbols, ['BIG', 'DN9', 'UP5', 'TIE_A', 'TIE_B', 'UP3', 'DN2', 'UP1', 'FLAT']);
  assertEquals(d.changePcts, [50, -9, 5, 4, -4, 3, -2, 1, 0]);
  assert(!d.symbols.includes('STALE'));

  const big = syms(500);
  const r = decideRanking({ set: big, batchesFailed: 0, evaluations: evals(big, 500, (i) => (i % 2 ? i : -i)) });
  assert(r.write);
  assertEquals(r.symbols.length, 100);
  for (let i = 1; i < r.changePcts.length; i++) {
    assert(Math.abs(r.changePcts[i]) <= Math.abs(r.changePcts[i - 1]), `ordered at ${i}`);
  }
  assertEquals(r.changePcts.slice(0, 3), [499, -498, 497]);
});

Deno.test('skipCounts: by reason', () => {
  const ev: Evaluation[] = [
    { symbol: 'A', fresh: false, reason: 'stale_trade' },
    { symbol: 'B', fresh: false, reason: 'stale_trade' },
    { symbol: 'C', fresh: false, reason: 'no_prev_close' },
    { symbol: 'D', fresh: true, price: 1, prevClose: 1, changePct: 1 },
  ];
  assertEquals(skipCounts(ev), { no_snapshot: 0, no_trade: 0, stale_trade: 2, no_prev_close: 1 });
});
