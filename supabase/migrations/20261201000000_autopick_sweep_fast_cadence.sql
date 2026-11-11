-- Re-schedules draft_autopick_sweep from every 10 s to every 2 s, so an expired
-- turn nobody has open is auto-picked within ~2 s instead of ~10 s (Giorgio,
-- 2026-11-10, PRODUCT_RULES › Draft, "The auto-pick is instant": "the selection
-- needs to be instant so the draft flow continues"; at zero the pick is made "on
-- every turn, whether or not anyone has the room open").
--
-- WHY (build 12, League B): 21 of 21 auto-picks landed 8.3–47.8 s after zero,
-- none from the app. The room's own ask never fired (fixed in the same branch,
-- apps/mobile/lib/game/autoPickAsk.ts), so every pick waited for this job, and a
-- 10 s tick phase-locks to the 30/45/60/75/90 s clocks: every turn waited the
-- same ~10 s. With the room fixed, a turn anyone has open is asked at zero; this
-- job is the backstop for a turn nobody has open.
--
-- SAME JOB, SAME COMMAND as 20261111000002 (name, URL, vault key 'cron_apikey',
-- timeout_milliseconds 180000, body, both guards and the 60 s stall throttle,
-- verbatim), with two changes only:
--   1. the cadence, '10 seconds' -> '2 seconds';
--   2. ONE more NOT EXISTS that only NARROWS the post: an overdue turn whose
--      price outage (public.draft_turn_outages, written by noteOutage on every
--      outage attempt, cleared when the turn is filled) was seen < 10 s ago is
--      not posted for. That keeps a fast-failing outage's retries at the 10 s
--      pace they have today. Without it a 2 s tick would retry an outage 5x as often, and each
--      outage attempt can spend ~21 Alpaca requests (one screen, then up to
--      LIVE_MAX_ATTEMPTS = 20 live fills on symbols not yet cooled): up to ~630
--      a minute against the one market-data key quotes and enrich-symbols share
--      (~200 a minute), and the 429s would themselves read as an outage. A
--      draft_stalls 'vendor_outage' row exists only after 5 minutes of outage
--      (OUTAGE_ESCALATE_MS), so the stall throttle cannot do this job.
--      A healthy turn has no outage row and posts on the first tick past zero.
--      If the outage write ever fails there is no row, and the turn posts every
--      2 s (fail open toward picking).
--      KNOWN GAP (supabase review P1, 2026-11-11): noteOutage writes the row at
--      the END of an attempt, so it cannot hold back ticks while an attempt is
--      still running. A SLOW outage (timeouts, up to the 25 s WALL_BUDGET_MS) has
--      no row on its first attempt, and its later attempts re-open the post 10 s
--      after the last write, so up to ~D/2 sweeps overlap (D = attempt length)
--      where the 10 s tick had ~D/10. Picks stay correct (the unique index); the
--      cost is Alpaca calls, faster note_draft_bounded attempts (an earlier
--      'stalled'), and a likelier double commissioner push in noteOutage. The
--      fix is a per-turn in-flight lease in draft-autopick-sweep, a separate
--      change. The same holds for the paths this guard never sees per turn: an
--      unclocked draft with a deleted seat keeps draft_auto_start_work_due()
--      true for the whole draft, so its sweep now posts every 2 s, and start
--      retries (startDraftIfDue, up to 5 min) and unknown watch verdicts re-run
--      every 2 s too.
--
-- WHY 2 s, NOT 1 s. Three costs scale with the tick, all paid on idle ticks too:
--   * the guard runs every tick: overdue_draft_turns() calls get_draft_clock per
--     in_progress league, and draft_auto_start_work_due() runs due_draft_starts,
--     draft_watch_due (an md5 of _draft_start_inputs per scheduled future
--     league) and unclocked_deleted_seat_turns. Small tables today, but every
--     second is 86,400 evaluations a day;
--   * pg_cron logs every run in cron.job_run_details (insert + update): 43,200
--     rows a day at 2 s, 86,400 at 1 s, kept 7 days by purge_cron_run_details
--     (20261106000001): ~302k vs ~605k rows. Unless cron.use_background_workers
--     is on, each run also opens a database connection;
--   * OVERLAP. The cron run itself ends in milliseconds (net.http_post only
--     enqueues), so pg_cron's one-run-at-a-time rule never spaces the HTTP
--     calls: every tick with an overdue turn posts a new sweep, whatever is
--     still running. An unattended auto-pick takes ~1–3 s (a live price, then
--     the insert), so at 2 s one or two sweeps work the same turn, at 1 s two or
--     three. The extra ones are harmless (insertGatedPick's unique
--     (league_id, pick_number) index: one writer wins, the rest get
--     pick_conflict and write nothing) but each spends its own Alpaca calls.
-- 1 s would save at most ~1 s, on unattended turns only. 2 s is the backstop.
--
-- OVERLAPPING START / WATCH PASSES (also every 2 s now): start_league_draft takes
-- the league row lock and compares the inputs, so exactly one sweep starts a
-- draft and pushes its first picker (20261111000000 §9); record_draft_watch
-- locks the leagues row (FOR NO KEY UPDATE) before it reads or inserts the
-- watch row, so two passes racing the FIRST watch row serialize and the
-- commissioner is warned once (plus the 1 h draft_at_risk dedupe). Overlap
-- there costs duplicated work (evaluateStartBlockers), never a duplicate
-- start or warning.
--
-- ORDERING IS LOAD-BEARING (same hazard as 20261111000002's header): this MUST
-- be the LAST migration that schedules 'draft_autopick_sweep'. If
-- 20261106000000 or 20261111000002 ever applied after it, the job would revert
-- to 10 s (and, for 20261106000000, to overdue-only: no draft would auto-start).
-- Timestamp order gives that on a normal `db push`; never --include-all an older
-- schedule after this one. supabase/tests/draft_auto_start_cron_wiring.test.ts
-- checks the LATEST scheduling migration keeps both guards, and
-- autopick_sweep_fast_cadence.test.ts checks this file's contract.
--
-- '2 seconds' needs pg_cron >= 1.5; prod is 1.6 (see 20261106000000).
--
-- Verify by DATA, never by cron.job_run_details / net._http_response (CLAUDE.md
-- success signals #2/#8): an unattended test draft's auto-picks land within a
-- few seconds of each deadline (drafts.recorded_at vs the turn's deadline).
select cron.unschedule('draft_autopick_sweep')
 where exists (select 1 from cron.job where jobname = 'draft_autopick_sweep');

select cron.schedule(
  'draft_autopick_sweep',
  '2 seconds', -- PG_CRON >= 1.5 ONLY; prod is 1.6 (see 20261106000000)
  $$
  select net.http_post(
    url     := 'https://haiaaifjcclsvmkfqgmd.supabase.co/functions/v1/draft-autopick-sweep',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_apikey' limit 1)
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 180000
  )
  where exists (
    select 1
      from public.overdue_draft_turns() o
     where not exists (
       select 1
         from public.draft_stalls s
        where s.league_id = o.league_id
          and s.pick_number = o.pick_number
          and s.reason <> 'vendor_outage'
          and s.last_seen_at > now() - interval '60 seconds'
     )
       and not exists (
       select 1
         from public.draft_turn_outages t
        where t.league_id = o.league_id
          and t.pick_number = o.pick_number
          and t.last_seen_at > now() - interval '10 seconds'
     )
  )
     or public.draft_auto_start_work_due();
  $$
);

-- Effect-verify AFTER push (HUMAN ACTION):
--   SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'draft_autopick_sweep';
--   -- schedule = '2 seconds'; command contains overdue_draft_turns(),
--   -- draft_turn_outages and draft_auto_start_work_due()
-- Then an unattended clocked test draft: every auto pick's drafts row lands
-- within a few seconds of its turn's deadline.
