// rank-top-movers HTTP handler: answer the cron AT ONCE, rank in the background.
//
// WHY (2026-11-11, docs/STATUS.md §4 item 28): pg_net 0.14.0 does not dispatch a cron post
// enqueued after a slow one until the slow one finishes. Ten snapshot calls plus the write
// take seconds; holding the cron's request open for them would delay every later cron post,
// the 2 s draft auto-pick sweep included. So: 202 now, the run under EdgeRuntime.waitUntil.
//
// WHAT THE 202 MEANS: only "authorized, configured, and the run was handed to the runtime".
// It is NOT a success claim (CLAUDE.md "success signals" #4, #7). The run's outcome is its
// cron_job_status row (runJob: one 'running', one terminal) and ONE log line when it ends:
// `rank-top-movers {...}`, `rank-top-movers failed {...}` on a throw, or `rank-top-movers
// terminated with a run in flight` if the runtime stops the worker first (index.ts).
// Verify by data: public.top_movers.ranked_at.
//
// Still answered synchronously, so they stay visible in net._http_response: 405 (method),
// 401 (apikey), 500 (missing config). The auth check and the config guard run BEFORE runJob,
// so a caller who fails auth cannot forge or spam status rows.
import { isAuthorized } from '../_shared/cron-auth.ts';
import { runInBackground } from '../_shared/respond-fast.ts';
import type { RankResult } from './run.ts';

export interface RankConfig {
  url: string;
  key: string;
  alpacaKey: string;
  alpacaSecret: string;
}

export interface RankHandlerDeps {
  /** Starts one run (runJob inside). Called WITHOUT awaiting it. */
  run: (cfg: RankConfig) => Promise<RankResult>;
  /** Keeps the worker alive until the promise settles (EdgeRuntime.waitUntil). */
  waitUntil: (p: Promise<unknown>) => void;
  log?: (...args: unknown[]) => void;
  logError?: (...args: unknown[]) => void;
}

export const LOG_TAG = 'rank-top-movers';

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

export function makeRankHandler(deps: RankHandlerDeps): (req: Request) => Promise<Response> {
  return (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return Promise.resolve(json({ ok: false, reason: 'method_not_allowed' }, 405));
    if (!isAuthorized(req)) return Promise.resolve(json({ error: 'Unauthorized' }, 401)); // generic: no detail

    const cfg: RankConfig = {
      url: Deno.env.get('SUPABASE_URL') ?? '',
      key: Deno.env.get('SB_SECRET_KEY_INTERNAL') ?? '',
      alpacaKey: Deno.env.get('ALPACA_API_KEY') ?? '',
      alpacaSecret: Deno.env.get('ALPACA_API_SECRET') ?? '',
    };
    if (!cfg.url || !cfg.key || !cfg.alpacaKey || !cfg.alpacaSecret) {
      return Promise.resolve(json({ error: 'server_config_error' }, 500));
    }

    // Hand the run to the runtime and answer now. Do NOT await it.
    deps.waitUntil(runInBackground(LOG_TAG, () => deps.run(cfg), deps.log, deps.logError));
    return Promise.resolve(json({ accepted: true }, 202));
  };
}
