-- The claims run's schedule (docs/plans/2026-10-08-trading-window-and-watchlist.md, "The claims
-- run": "every minute from 9:30 ET on trading days until the day's run is recorded").
-- PROVISIONAL TIMESTAMP: re-stamped with 20261211000000 before any push.
--
-- DRIVEN BY market_calendar, NOT A FIXED CLOCK. The cron fires every minute; the post is filtered by
-- public.claims_run_day() (20261211000000), which answers open=true only inside a session that
-- market_calendar_coverage vouches for, and lists only the leagues with claims due today and no
-- claims_runs row yet. So a closed market, a holiday, a stale calendar ('unknown') and a day with
-- no claims post nothing, and once every due league has its row the posts stop by themselves. A
-- league that keeps failing is retried every minute for the rest of the session (the hold on live
-- trading still lifts at open + 10 minutes; claims_hold_active). Runs as the job owner (postgres).
--
-- Key from vault.decrypted_secrets ('cron_apikey'), never a literal. TIMEOUT 180000 ms (the repo rule
-- since 20261108000000; cron_timeouts guard). The function answers 202 at once and works in the
-- background, so the response table can only ever show "accepted": verify by DATA (claims_runs).
--
-- PRECONDITIONS: 20261211000000 applied with it, and claims-run deployed from the SAME commit
-- (byte-verified) BEFORE this push: with no claims placed yet nothing is due, so deploying first is
-- safe; pushed first instead, a due league's posts would reach no function until the deploy.
select cron.unschedule('claims_run')
 where exists (select 1 from cron.job where jobname = 'claims_run');

select cron.schedule(
  'claims_run',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://haiaaifjcclsvmkfqgmd.supabase.co/functions/v1/claims-run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_apikey' limit 1)
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 180000
  )
  where exists (select 1 from public.claims_run_day() d
                 where (d ->> 'open')::boolean and jsonb_array_length(d -> 'due') > 0);
  $$
);

-- Effect-verify AFTER push (HUMAN ACTION; docs/security/2026-12-11-claims-checks.sql):
--   SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'claims_run';
-- Then BY DATA, on the first session after a claim is placed:
--   SELECT * FROM public.claims_runs WHERE run_date = (now() AT TIME ZONE 'America/New_York')::date;
