/**
 * Top movers: one run, with every read and write injected so run.test.ts can drive each
 * exit without a network or a database. index.ts wires the real clients.
 *
 * THE RUN
 *   1. Read the set: the SET_SIZE largest by market_cap among active, draftable, priced.
 *   2. Fetch the snapshots in batches of BATCH_SIZE, one after another. The first batch the
 *      source refuses (any non-2xx, a 429 included) or that does not answer ends the
 *      fetching: the ranking cannot be written anyway, so the rest are not asked for.
 *   3. Judge every stock at ONE instant, taken after the last batch came back, so no trade
 *      is judged fresher than it is. The ranking's STORED time is the run's start, before
 *      the first batch (the Supabase review, 2026-11-23): the app's 20-minute rule reads
 *      ranked_at as the data's age, so it must never be later than the oldest snapshot.
 *   4. decideRanking: write only when every batch succeeded AND >= 90% came back fresh.
 *   5. replace_top_movers: the whole ranking in one call, or nothing. Its { error } is
 *      checked (supabase-js resolves a Postgres error, it does not throw: CLAUDE.md
 *      "success signals" #5), and so is its reply: written, or kept because a newer
 *      ranking is already there.
 *
 * WHAT IT REPORTS (CLAUDE.md "success signals"): runJob writes exactly one 'running' and one
 * terminal cron_job_status row per run. The CHECK has no 'partial' status, so a run that
 * kept the previous ranking is 'failed' with a message that starts "partial:"; a 'success'
 * is written only when the ranking was replaced (work = its rows) or a newer one was
 * already there (work = 0). The run's one log line (runInBackground, respond-fast.ts)
 * carries ok, ranking ('written' | 'kept_newer' | 'partial' | 'failed'), the counts, the
 * skip reasons and every batch's status and rate-limit headers; ok:false goes to the error
 * stream. Neither is the proof: the proof is top_movers.ranked_at moving (the data).
 *
 * THE STATUS ROW IS A "LAST RESULT" ROW, NOT A LIVENESS SIGNAL. cron_job_status holds one
 * row per job per day, and the same-day rule (_shared/job-status.ts) keeps a success with
 * work over every later 'running' and work=0 write. So a run that hangs or is killed after
 * the morning's first ranking leaves that success in place. The only liveness signal is the
 * age of max(top_movers.ranked_at) while the market is open; alert on that, never on the row.
 */

import type { JobRun, JobStatusWriter } from '../_shared/run-job.ts';
import { runJob } from '../_shared/run-job.ts';
import {
  BATCH_SIZE,
  chunk,
  decideRanking,
  type Evaluation,
  evaluateSnapshot,
  SET_SIZE,
  skipCounts,
} from './rank.ts';
import type { BatchResult, RateLimitHeaders } from './snapshots.ts';

export interface RankDeps {
  readSet(limit: number): Promise<{ ok: true; symbols: string[] } | { ok: false; error: string }>;
  fetchBatch(symbols: string[]): Promise<BatchResult>;
  writeRanking(args: {
    rankedAt: Date;
    setSize: number;
    freshCount: number;
    symbols: string[];
    changePcts: number[];
  }): Promise<{ ok: true; written: boolean; reason?: string } | { ok: false; error: string }>;
  now(): Date;
}

export interface BatchLog {
  n: number;
  size: number;
  status: number;
  error?: string;
  rate_limit: RateLimitHeaders;
}

export interface RankResult extends Record<string, unknown> {
  ok: boolean;
  ranking: 'written' | 'kept_newer' | 'partial' | 'failed';
  reason?: string;
  set_size: number;
  fresh: number;
  rows: number;
  ranked_at: string | null;
  batches_total: number;
  batches_ok: number;
  skipped: Record<string, number>;
  batches: BatchLog[];
}

function base(): RankResult {
  return {
    ok: false,
    ranking: 'failed',
    set_size: 0,
    fresh: 0,
    rows: 0,
    ranked_at: null,
    batches_total: 0,
    batches_ok: 0,
    skipped: {},
    batches: [],
  };
}

export async function runRank(deps: RankDeps): Promise<JobRun<RankResult>> {
  const out = base();
  const failed = (message: string): JobRun<RankResult> => ({
    outcome: { status: 'failed', attempt: 1, message },
    response: out,
  });

  // 1. The set.
  const set = await deps.readSet(SET_SIZE);
  if (!set.ok) {
    out.reason = 'set_read_failed';
    return failed(`set read failed: ${set.error}`);
  }
  out.set_size = set.symbols.length;
  if (set.symbols.length === 0) {
    out.reason = 'empty_set';
    return failed('empty set: no active, draftable, priced stock carries a size');
  }

  // The ranking's stored time: before the first snapshot is asked for.
  const rankedAt = deps.now();

  // 2. The snapshots, batch by batch; stop at the first failure.
  const batches = chunk(set.symbols, BATCH_SIZE);
  out.batches_total = batches.length;
  const bodies: Array<{ symbols: string[]; body: Record<string, unknown> }> = [];
  let batchesFailed = 0;
  for (let i = 0; i < batches.length; i++) {
    const r = await deps.fetchBatch(batches[i]);
    out.batches.push({
      n: i + 1,
      size: batches[i].length,
      status: r.status,
      ...(r.ok ? {} : { error: r.error }),
      rate_limit: r.rateLimit,
    });
    if (!r.ok) {
      batchesFailed++;
      break;
    }
    out.batches_ok++;
    bodies.push({ symbols: batches[i], body: r.body });
  }

  // 3. Judge every returned stock at one instant, after the last batch.
  const judgedAt = deps.now();
  const evaluations: Evaluation[] = [];
  for (const b of bodies) {
    for (const sym of b.symbols) {
      evaluations.push(evaluateSnapshot(sym, b.body[sym] ?? b.body[sym.toUpperCase()], judgedAt));
    }
  }
  out.skipped = skipCounts(evaluations);

  // 4. Whole or nothing.
  const d = decideRanking({ set: set.symbols, batchesFailed, evaluations });
  out.fresh = d.freshCount;
  if (!d.write) {
    out.ranking = 'partial';
    out.reason = d.reason;
    const detail = d.reason === 'batch_failed'
      ? `batch ${out.batches_ok + 1}/${out.batches_total} failed (status ${out.batches[out.batches.length - 1]?.status})`
      : d.reason === 'below_fresh_gate'
      ? `fresh ${d.freshCount}/${d.setSize} is under 90%`
      : d.reason;
    return failed(`partial: ${detail}; previous ranking kept`);
  }

  // 5. The write.
  const w = await deps.writeRanking({
    rankedAt,
    setSize: d.setSize,
    freshCount: d.freshCount,
    symbols: d.symbols,
    changePcts: d.changePcts,
  });
  if (!w.ok) {
    out.reason = 'write_failed';
    return failed(`write failed: ${w.error}; previous ranking kept`);
  }
  if (!w.written) {
    out.ok = true;
    out.ranking = 'kept_newer';
    out.reason = w.reason ?? 'newer_ranking_exists';
    return {
      outcome: { status: 'success', attempt: 1, work: 0, message: `kept: ${out.reason}` },
      response: out,
    };
  }
  out.ok = true;
  out.ranking = 'written';
  out.rows = d.symbols.length;
  out.ranked_at = rankedAt.toISOString();
  return {
    outcome: {
      status: 'success',
      attempt: 1,
      work: d.symbols.length,
      message: `ranked ${d.symbols.length} of ${d.freshCount} fresh / ${d.setSize}`,
    },
    response: out,
  };
}

/**
 * The run inside runJob: one 'running' write, then exactly one terminal write, on every
 * path including a throw. Returns the result for the log line.
 */
export function runRankJob(deps: RankDeps, write: JobStatusWriter): Promise<RankResult> {
  return runJob<RankResult>({
    attempt: 1,
    write,
    body: () => runRank(deps),
    onThrow: (e): Promise<JobRun<RankResult>> => {
      const name = e instanceof Error ? e.name : 'error';
      const response = { ...base(), reason: 'unhandled', error: name };
      return Promise.resolve({
        outcome: { status: 'failed', attempt: 1, message: `unhandled: ${name}; previous ranking kept` },
        response,
      });
    },
  });
}
