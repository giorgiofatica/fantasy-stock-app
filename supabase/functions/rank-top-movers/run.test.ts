// Hermetic: the run's every exit, through runJob, with fake reads, batches and write.
//   deno test supabase/functions/rank-top-movers/
import { assert, assertEquals } from 'jsr:@std/assert';
import type { JobStatusValue } from '../_shared/job-status.ts';
import { type RankDeps, runRankJob } from './run.ts';
import type { BatchResult } from './snapshots.ts';

const NOW = new Date('2026-12-14T16:00:00.000Z');
const START = new Date(NOW.getTime() - 90_000); // the run began 90 s before it judged
const FRESH_T = new Date(NOW.getTime() - 60_000).toISOString();
const STALE_T = new Date(NOW.getTime() - 16 * 60_000).toISOString();
const RL = { limit: '200', remaining: '190', reset: '1765728060' };
const SET = Array.from({ length: 500 }, (_, i) => `S${String(i).padStart(3, '0')}`);

type Kind = 'fresh' | 'stale' | 'noprev' | 'notrade' | 'absent';
/** A batch body: each symbol's snapshot per `kind(symbol, index in set)`. */
function body(symbols: string[], kind: (s: string, i: number) => Kind): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of symbols) {
    const i = SET.indexOf(s);
    const k = kind(s, i);
    const move = 100 + (i % 2 ? i : -i) / 10; // distinct moves, both ways
    if (k === 'absent') continue;
    out[s] = {
      ...(k === 'notrade' ? {} : { latestTrade: { p: move, t: k === 'stale' ? STALE_T : FRESH_T } }),
      ...(k === 'noprev' ? {} : { prevDailyBar: { c: 100 } }),
      latestQuote: { ap: 9999, as: 1, bp: 0, bs: 0 }, // a lone ask: never the price
    };
  }
  return out;
}

interface Harness {
  deps: RankDeps;
  statuses: Array<{ status: JobStatusValue; message?: string; work?: number }>;
  fetched: string[][];
  written: Array<Parameters<RankDeps['writeRanking']>[0]>;
}

function harness(opts: {
  set?: string[] | { error: string };
  kind?: (s: string, i: number) => Kind;
  failBatch?: number; // 1-based
  failStatus?: number;
  write?: Awaited<ReturnType<RankDeps['writeRanking']>>;
  throwIn?: 'fetch';
} = {}): Harness {
  const h: Harness = { statuses: [], fetched: [], written: [], deps: null as unknown as RankDeps };
  const set = opts.set ?? SET;
  // The first now() is the run's start; any later one is NOW (the judging instant).
  let calls = 0;
  h.deps = {
    now: () => (calls++ === 0 ? START : NOW),
    readSet: (limit) => {
      assertEquals(limit, 500);
      return Promise.resolve(Array.isArray(set) ? { ok: true, symbols: set } : { ok: false, error: set.error });
    },
    fetchBatch: (symbols): Promise<BatchResult> => {
      h.fetched.push(symbols);
      if (opts.throwIn === 'fetch') throw new TypeError('boom');
      if (opts.failBatch === h.fetched.length) {
        return Promise.resolve({ ok: false, status: opts.failStatus ?? 429, error: 'http_error', rateLimit: { ...RL, remaining: '0' } });
      }
      return Promise.resolve({ ok: true, status: 200, body: body(symbols, opts.kind ?? (() => 'fresh')), rateLimit: RL });
    },
    writeRanking: (args) => {
      h.written.push(args);
      return Promise.resolve(opts.write ?? { ok: true, written: true });
    },
  };
  return h;
}

const run = (h: Harness) =>
  runRankJob(h.deps, (status, _attempt, message, work) => {
    h.statuses.push({ status, message, work });
    return Promise.resolve();
  });

function bracketed(h: Harness, terminal: JobStatusValue) {
  assertEquals(h.statuses.map((s) => s.status), ['running', terminal], 'exactly one running, one terminal');
}

Deno.test('every batch fresh: ranks the top 100 of 500 and records the work', async () => {
  const h = harness();
  const r = await run(h);
  bracketed(h, 'success');
  assertEquals(h.fetched.length, 10);
  assert(h.fetched.every((b) => b.length === 50));
  assertEquals(h.written.length, 1);
  const w = h.written[0];
  assertEquals([w.setSize, w.freshCount, w.symbols.length, w.changePcts.length], [500, 500, 100, 100]);
  assertEquals(w.rankedAt.toISOString(), START.toISOString(), 'stored time = the run\'s start, never later than a snapshot');
  for (let i = 1; i < 100; i++) assert(Math.abs(w.changePcts[i]) <= Math.abs(w.changePcts[i - 1]));
  // The lone 9999 ask never priced anything: every change is a few percent.
  assert(w.changePcts.every((c) => Math.abs(c) < 60), String(w.changePcts[0]));
  assertEquals(h.statuses[1].work, 100);
  assertEquals([r.ok, r.ranking, r.rows, r.fresh, r.set_size, r.batches_ok, r.ranked_at], [true, 'written', 100, 500, 500, 10, START.toISOString()]);
  assertEquals(r.batches[0].rate_limit, RL, 'the rate-limit headers reach the log line');
});

Deno.test('a partial batch (the 4th refused, 429): nothing written, the rest not asked, reported partial', async () => {
  const h = harness({ failBatch: 4 });
  const r = await run(h);
  bracketed(h, 'failed');
  assertEquals(h.fetched.length, 4, 'stops at the first failure');
  assertEquals(h.written.length, 0, 'the previous ranking is kept');
  assertEquals([r.ok, r.ranking, r.reason, r.batches_ok, r.batches_total], [false, 'partial', 'batch_failed', 3, 10]);
  assert(h.statuses[1].message!.startsWith('partial: batch 4/10 failed (status 429)'), h.statuses[1].message);
  assertEquals(r.batches[3], { n: 4, size: 50, status: 429, error: 'http_error', rate_limit: { ...RL, remaining: '0' } });
});

Deno.test('the last batch fails (a 500) after 450 fresh stocks: still nothing written', async () => {
  const h = harness({ failBatch: 10, failStatus: 500 });
  const r = await run(h);
  bracketed(h, 'failed');
  assertEquals(h.written.length, 0);
  assertEquals([r.ranking, r.reason], ['partial', 'batch_failed']);
});

Deno.test('exactly 90% fresh (50 stale trades): written', async () => {
  const h = harness({ kind: (_s, i) => (i < 50 ? 'stale' : 'fresh') });
  const r = await run(h);
  bracketed(h, 'success');
  assertEquals(h.written.length, 1);
  assertEquals([h.written[0].freshCount, h.written[0].setSize], [450, 500]);
  assert(!h.written[0].symbols.some((s) => SET.indexOf(s) < 50), 'no stale stock ranks');
  assertEquals(r.skipped, { no_snapshot: 0, no_trade: 0, stale_trade: 50, no_prev_close: 0 });
});

Deno.test('one under 90% (51 left out across reasons): nothing written, reported partial', async () => {
  const h = harness({
    kind: (_s, i) => (i < 30 ? 'stale' : i < 45 ? 'noprev' : i < 49 ? 'notrade' : i < 51 ? 'absent' : 'fresh'),
  });
  const r = await run(h);
  bracketed(h, 'failed');
  assertEquals(h.written.length, 0);
  assertEquals([r.ranking, r.reason, r.fresh], ['partial', 'below_fresh_gate', 449]);
  assertEquals(r.skipped, { no_snapshot: 2, no_trade: 4, stale_trade: 30, no_prev_close: 15 });
  assert(h.statuses[1].message!.includes('fresh 449/500 is under 90%'), h.statuses[1].message);
});

Deno.test('missing prevDailyBar on most stocks: nothing written', async () => {
  const h = harness({ kind: (_s, i) => (i % 2 ? 'noprev' : 'fresh') });
  const r = await run(h);
  bracketed(h, 'failed');
  assertEquals(h.written.length, 0);
  assertEquals([r.fresh, r.skipped.no_prev_close], [250, 250]);
});

Deno.test('a smaller set ranks all its fresh stocks (fewer than 100 rows)', async () => {
  const set = SET.slice(0, 40);
  const h = harness({ set });
  const r = await run(h);
  bracketed(h, 'success');
  assertEquals(h.fetched.length, 1);
  assertEquals(h.written[0].symbols.length, 40);
  assertEquals(r.rows, 40);
});

Deno.test('the set read fails, or is empty: failed, nothing fetched or written', async () => {
  for (const set of [{ error: '57014' }, [] as string[]]) {
    const h = harness({ set });
    const r = await run(h);
    bracketed(h, 'failed');
    assertEquals([h.fetched.length, h.written.length], [0, 0]);
    assertEquals(r.ok, false);
  }
});

Deno.test('the write is refused (its { error }): failed, never reported as written', async () => {
  const h = harness({ write: { ok: false, error: '22023' } });
  const r = await run(h);
  bracketed(h, 'failed');
  assertEquals([r.ok, r.ranking, r.reason, r.rows], [false, 'failed', 'write_failed', 0]);
  assert(h.statuses[1].message!.includes('write failed: 22023'));
});

Deno.test('a newer ranking is already there: success with no work', async () => {
  const h = harness({ write: { ok: true, written: false, reason: 'newer_ranking_exists' } });
  const r = await run(h);
  bracketed(h, 'success');
  assertEquals(h.statuses[1].work, 0);
  assertEquals([r.ok, r.ranking, r.rows], [true, 'kept_newer', 0]);
});

Deno.test('a throw mid-run still writes a terminal failed row', async () => {
  const h = harness({ throwIn: 'fetch' });
  const r = await run(h);
  bracketed(h, 'failed');
  assertEquals(h.written.length, 0);
  assertEquals([r.ok, r.reason], [false, 'unhandled']);
  assert(h.statuses[1].message!.startsWith('unhandled: TypeError'));
});

Deno.test('freshness is judged after the last batch, not at the run\'s start', async () => {
  // Every trade is 14.5 min before the run's START but 16 min before NOW: all stale.
  const h = harness();
  const t = new Date(NOW.getTime() - 16 * 60_000).toISOString();
  const orig = h.deps.fetchBatch;
  h.deps.fetchBatch = async (symbols) => {
    const r = await orig(symbols);
    if (r.ok) for (const v of Object.values(r.body)) (v as { latestTrade: { t: string } }).latestTrade.t = t;
    return r;
  };
  const r = await run(h);
  bracketed(h, 'failed');
  assertEquals([h.written.length, r.fresh, r.skipped.stale_trade], [0, 0, 500]);
});
