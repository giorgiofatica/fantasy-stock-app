// rank-top-movers: today's top movers among the 500 largest companies, every 5 minutes
// while the market is open (docs/plans/2026-11-18-stocks-tab.md, Part 3, "Top movers: how
// it works"). Scheduled by supabase/migrations/20261210000001_schedule_rank_top_movers.sql;
// writes public.top_movers through replace_top_movers (20261210000000).
//
// The decisions live in rank.ts (pure) and run.ts (injected I/O), both hermetically
// tested; handler.ts answers 202 and runs in the background. This file wires the real
// clients.
//
// CRON ONLY: verify_jwt=false at the gateway, so the constant-time apikey check
// (_shared/cron-auth.ts, against SB_SECRET_KEY_CRON, failing closed) is the ENTIRE auth
// boundary.
//
// Verify by DATA, never by the 202, net._http_response or cron.job_run_details:
//   SELECT max(ranked_at), count(*), min(set_size), min(fresh_count) FROM public.top_movers;
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { writeJobStatus, type JobStatusRwClient } from '../_shared/job-status-io.ts';
import { backgroundWaitUntil } from '../_shared/respond-fast.ts';
import { type RankConfig, makeRankHandler } from './handler.ts';
import { makeRankDeps, type RankDbClient } from './deps.ts';
import { runRankJob } from './run.ts';

const JOB_NAME = 'rank-top-movers';

// waitUntil + the shutdown log ("rank-top-movers terminated with a run in flight").
const waitUntil = backgroundWaitUntil('rank-top-movers', 'a run');

Deno.serve(makeRankHandler({
  waitUntil,
  run: (cfg: RankConfig) => {
    // The same two variables handler.ts has already checked are set (it answers 500
    // otherwise), read here in the form the symbols-readers guard pins: admin is the
    // SB_SECRET_KEY_INTERNAL client.
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? cfg.url;
    const SECRET_KEY = Deno.env.get('SB_SECRET_KEY_INTERNAL') ?? cfg.key;
    const admin = createClient(SUPABASE_URL, SECRET_KEY);
    return runRankJob(
      // Casts: checking the full supabase-js client against the narrow slices trips TS2589
      // (excessively deep); the slices are pinned by deps.test.ts and job-status-io.test.ts.
      makeRankDeps(admin as unknown as RankDbClient, cfg.alpacaKey, cfg.alpacaSecret),
      async (status, attempt, message, work) => {
        await writeJobStatus(admin as unknown as JobStatusRwClient, JOB_NAME, status, attempt, { message, work });
      },
    );
  },
}));
