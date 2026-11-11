// enrich-symbols HTTP handler: answer the cron AT ONCE, do the batch in the
// background.
//
// WHY (found 2026-11-11, docs/STATUS.md §4 item 28): pg_net 0.14.0 does not
// dispatch a request enqueued after a slow one until the slow one finishes.
// This function spends ~1.1 s per symbol on Finnhub pacing, so answering only
// after the batch held its cron request open ~20-55 s, and EVERY cron post
// queued behind it at :x0 waited too. Observed: the enrich response created at
// 18:50:00.38, then nothing until 13 draft_autopick_sweep responses at the
// identical 18:50:43.62; auto-picks whose deadline fell just after :x0 landed
// 28-48 s late against a ruled-instant auto-pick (PRODUCT_RULES.md, #378).
//
// WHAT THE 202 MEANS: only "authorized, configured, and the batch was handed
// to the runtime". It is NOT a success claim (CLAUDE.md "success signals" #4,
// #7): the batch's outcome is the ONE structured log line runInBackground
// writes when it ends (`enrich-symbols {...}` or `enrich-symbols failed
// {...}`), and the real check stays data movement (max(enriched_at) advancing
// ~50 rows/run). `batch_limit` is the requested size, deliberately not named
// `batch`: the old response's `batch` was the number of rows actually selected,
// and a 202 sent before selection cannot know that.
//
// What is still answered synchronously, so it stays visible in
// net._http_response: 405 (method), 401 (apikey), 500 (missing secrets).
import { runInBackground as sharedRunInBackground } from '../_shared/respond-fast.ts';
import { batchSizeFor, type EnrichConfig, type EnrichResult } from './batch.ts';

export interface HandlerDeps {
  /** Starts one batch run. Called WITHOUT awaiting it. */
  runBatch: (cfg: EnrichConfig, batchSize: number) => Promise<EnrichResult>;
  /** Keeps the worker alive until the promise settles (EdgeRuntime.waitUntil). */
  waitUntil: (p: Promise<unknown>) => void;
  log?: (...args: unknown[]) => void;
  logError?: (...args: unknown[]) => void;
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let result = 0;
  for (let i = 0; i < aBytes.length; i++) result |= aBytes[i] ^ bBytes[i];
  return result === 0;
}

function isAuthorized(req: Request): boolean {
  const expected = Deno.env.get('SB_SECRET_KEY_CRON');
  if (!expected || expected.length === 0) {
    console.error('SB_SECRET_KEY_CRON not configured — rejecting all requests');
    return false; // fail closed
  }
  return constantTimeEqual(req.headers.get('apikey') ?? '', expected);
}

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

// Late-bound, so a console replaced after module load (a test capture, a
// runtime log shim) still receives the outcome line.
const defaultLog = (...args: unknown[]) => console.log(...args);
const defaultLogError = (...args: unknown[]) => console.error(...args);

/**
 * Run `work` to completion and write exactly one outcome line. NEVER rejects.
 * The body lives in ../_shared/respond-fast.ts (shared with draft-order-notify,
 * 2026-11-11); this keeps enrich's signature and its 'enrich-symbols' tag.
 */
export function runInBackground(
  work: () => Promise<EnrichResult>,
  log: (...args: unknown[]) => void = defaultLog,
  logError: (...args: unknown[]) => void = defaultLogError,
): Promise<void> {
  return sharedRunInBackground('enrich-symbols', work, log, logError);
}

export function makeEnrichHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const log = deps.log ?? defaultLog;
  const logError = deps.logError ?? defaultLogError;
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    if (!isAuthorized(req)) return json({ error: 'unauthorized' }, 401);

    const cfg: EnrichConfig = {
      finnhubToken: Deno.env.get('FINNHUB_API_KEY') ?? '',
      alpacaKey: Deno.env.get('ALPACA_API_KEY') ?? '',
      alpacaSecret: Deno.env.get('ALPACA_API_SECRET') ?? '',
    };
    if (!cfg.finnhubToken || !cfg.alpacaKey || !cfg.alpacaSecret) {
      return json({ error: 'server_config_error' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const batchSize = batchSizeFor(body?.limit);

    // Hand the batch to the runtime and answer now. Do NOT await this: the
    // whole point is that the cron's HTTP request ends before the batch does.
    deps.waitUntil(runInBackground(() => deps.runBatch(cfg, batchSize), log, logError));
    return json({ accepted: true, batch_limit: batchSize }, 202);
  };
}
