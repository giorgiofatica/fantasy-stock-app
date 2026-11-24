// claims-run: resolves the league's waiver claims at the market open, before live trading
// (docs/plans/2026-10-08-trading-window-and-watchlist.md, "The claims run", as changed by
// docs/plans/2026-11-18-stocks-tab.md part 3). Scheduled every minute while the market is open
// AND a league has claims due (supabase/migrations/20261211000001_schedule_claims_run.sql).
//
// plan.ts decides (pure); run.ts orchestrates and reports (injected I/O); deps.ts holds the real
// reads and the one commit per league (commit_claims_run, 20261211000000); handler.ts answers 202.
//
// CRON ONLY: verify_jwt=false; the constant-time apikey check (_shared/cron-auth.ts, against
// SB_SECRET_KEY_CRON, failing closed) is the whole auth boundary.
//
// Verify by DATA, never by the 202, net._http_response or cron.job_run_details:
//   SELECT * FROM public.claims_runs WHERE run_date = <today ET>;
//   SELECT status, count(*) FROM public.claims WHERE run_date = <today ET> GROUP BY 1;
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { type JobStatusRwClient, writeJobStatus } from '../_shared/job-status-io.ts';
import { backgroundWaitUntil } from '../_shared/respond-fast.ts';
import { type ClaimsConfig, makeClaimsHandler } from './handler.ts';
import { makeRunDeps } from './deps.ts';
import { runClaimsJob } from './run.ts';

const JOB_NAME = 'claims-run';

const waitUntil = backgroundWaitUntil('claims-run', 'a run');

Deno.serve(makeClaimsHandler({
  waitUntil,
  run: (cfg: ClaimsConfig) => {
    // admin is the SB_SECRET_KEY_INTERNAL client (handler.ts has checked both are set).
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? cfg.url;
    const SECRET_KEY = Deno.env.get('SB_SECRET_KEY_INTERNAL') ?? cfg.key;
    const admin = createClient(SUPABASE_URL, SECRET_KEY);
    return runClaimsJob(
      makeRunDeps(admin, cfg.alpacaKey, cfg.alpacaSecret),
      async (status, attempt, message, work) => {
        await writeJobStatus(admin as unknown as JobStatusRwClient, JOB_NAME, status, attempt, { message, work });
      },
    );
  },
}));
