// claims-run HTTP handler: answer the cron AT ONCE, run the claims in the background.
//
// WHY (2026-11-11, docs/STATUS.md §4 item 28): pg_net does not dispatch a cron post enqueued after a
// slow one until the slow one finishes; the run reads, prices and commits league by league, so it
// answers 202 now and works under EdgeRuntime.waitUntil (the rank-top-movers pattern).
//
// WHAT THE 202 MEANS: only "authorized, configured, and the run was handed to the runtime". It is NOT
// a success claim. The outcome is the cron_job_status row (runJob) and ONE log line when the run
// ends. Verify by DATA: public.claims_runs and the claims' terminal statuses.
//
// Answered synchronously, so they stay visible in net._http_response: 405, 401, 500 (config). The
// auth check and the config guard run BEFORE runJob, so a caller who fails auth cannot write a
// status row. CRON ONLY: verify_jwt=false, so the constant-time apikey check is the whole boundary.
import { isAuthorized } from '../_shared/cron-auth.ts';
import { runInBackground } from '../_shared/respond-fast.ts';
import type { RunResult } from './run.ts';

export interface ClaimsConfig {
  url: string;
  key: string;
  alpacaKey: string;
  alpacaSecret: string;
}

export interface ClaimsHandlerDeps {
  run: (cfg: ClaimsConfig) => Promise<RunResult>;
  waitUntil: (p: Promise<unknown>) => void;
  log?: (...args: unknown[]) => void;
  logError?: (...args: unknown[]) => void;
}

export const LOG_TAG = 'claims-run';

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

export function makeClaimsHandler(deps: ClaimsHandlerDeps): (req: Request) => Promise<Response> {
  return (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return Promise.resolve(json({ ok: false, reason: 'method_not_allowed' }, 405));
    if (!isAuthorized(req)) return Promise.resolve(json({ error: 'Unauthorized' }, 401));

    const cfg: ClaimsConfig = {
      url: Deno.env.get('SUPABASE_URL') ?? '',
      key: Deno.env.get('SB_SECRET_KEY_INTERNAL') ?? '',
      alpacaKey: Deno.env.get('ALPACA_API_KEY') ?? '',
      alpacaSecret: Deno.env.get('ALPACA_API_SECRET') ?? '',
    };
    if (!cfg.url || !cfg.key || !cfg.alpacaKey || !cfg.alpacaSecret) {
      return Promise.resolve(json({ error: 'server_config_error' }, 500));
    }

    deps.waitUntil(runInBackground(LOG_TAG, () => deps.run(cfg), deps.log, deps.logError));
    return Promise.resolve(json({ accepted: true }, 202));
  };
}
