-- The top movers schedule (docs/plans/2026-11-18-stocks-tab.md, Part 3, "Top movers: how
-- it works", "The job"): rank-top-movers every 5 minutes WHILE THE MARKET IS OPEN.
--
-- DRIVEN BY market_calendar, NOT A FIXED CLOCK. The cron fires every 5 minutes, every day;
-- the post is filtered by public.market_session_status() (20261005000002), which answers
-- 'open' only inside a session that market_calendar_coverage vouches for. So a holiday, an
-- early close, the DST change and a weekend all post nothing, and a stale calendar
-- ('unknown', no coverage) posts nothing either rather than guessing (CLAUDE.md "success
-- signals" #1). A SELECT with no FROM and a WHERE is a one-time filter: a closed market
-- makes no edge call. It runs as the job owner (postgres).
--
-- Key from vault.decrypted_secrets ('cron_apikey'), never a literal (CLAUDE.md
-- architecture-map rule; gen-architecture refuses key-shaped text).
-- TIMEOUT 180000 ms, the repo rule since 20261108000000 (cron_timeouts guard): above the
-- 150 s gateway idle timeout. The function answers 202 at once and ranks in the background
-- (EdgeRuntime.waitUntil, the 2026-11-11 pg_net head-of-line lesson), so the response
-- table can only ever show "accepted": verify by DATA, never by net._http_response or
-- cron.job_run_details (net.http_post is async; run_details says 'succeeded' on enqueue).
--
-- PRECONDITIONS: 20261210000000 applied with it (replace_top_movers exists), and
-- rank-top-movers deployed from the SAME commit (byte-verified) BEFORE this push. Deploying
-- first is safe: with no cron job yet nothing calls the function. Pushed first instead, every
-- post while the market is open would reach no function (a 404, nothing written) until the
-- deploy.
select cron.unschedule('rank_top_movers')
 where exists (select 1 from cron.job where jobname = 'rank_top_movers');

select cron.schedule(
  'rank_top_movers',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://haiaaifjcclsvmkfqgmd.supabase.co/functions/v1/rank-top-movers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_apikey' limit 1)
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 180000
  )
  where exists (select 1 from public.market_session_status() s where s.status = 'open');
  $$
);

-- Effect-verify AFTER push (HUMAN ACTION; docs/security/2026-12-10-top-movers-checks.sql):
--   SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'rank_top_movers';
-- Then BY DATA, during market hours, after the deploy:
--   SELECT max(ranked_at), count(*), min(set_size), min(fresh_count) FROM public.top_movers;
--   -- ranked_at within the last ~5 minutes; 100 rows; set_size 500; fresh_count >= 450.
