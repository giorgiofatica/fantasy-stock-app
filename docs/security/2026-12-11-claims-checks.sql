-- Post-push checks for 20261211000000_claims.sql and 20261211000001_schedule_claims_run.sql
-- (claims, the waiver wire: Stocks tab part 3, workstream 6). PROVISIONAL file names: the
-- Orchestrator re-stamps the migrations before the push; nothing below names a version.
-- Run in the Supabase SQL editor AFTER the real `supabase db push`; submit each statement on its
-- own. All are read-only: the effect block (H) ALWAYS ends in RAISE, so everything it writes rolls
-- back. supabase/tests/claims.pglite.test.ts runs the effect block on the full migration chain.

-- A. The tables: RLS on, and the privileges by role. EXPECT four rows:
--    claims            | t | anon f | auth_select t | auth_write f
--    claims_runs       | t | anon f | auth_select f | auth_write f
--    waiver_order      | t | anon f | auth_select t | auth_write f
--    waiver_order_meta | t | anon f | auth_select f | auth_write f
SELECT c.relname, c.relrowsecurity AS rls,
       (has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('anon', c.oid, 'INSERT')
        OR has_table_privilege('anon', c.oid, 'UPDATE') OR has_table_privilege('anon', c.oid, 'DELETE')
        OR has_table_privilege('anon', c.oid, 'TRUNCATE') OR has_table_privilege('anon', c.oid, 'REFERENCES')
        OR has_table_privilege('anon', c.oid, 'TRIGGER')) AS anon_any,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS auth_select,
       (has_table_privilege('authenticated', c.oid, 'INSERT') OR has_table_privilege('authenticated', c.oid, 'UPDATE')
        OR has_table_privilege('authenticated', c.oid, 'DELETE') OR has_table_privilege('authenticated', c.oid, 'TRUNCATE')
        OR has_table_privilege('authenticated', c.oid, 'REFERENCES') OR has_table_privilege('authenticated', c.oid, 'TRIGGER')) AS auth_write
  FROM pg_class c
 WHERE c.oid IN ('public.claims'::regclass, 'public.claims_runs'::regclass,
                 'public.waiver_order'::regclass, 'public.waiver_order_meta'::regclass)
 ORDER BY c.relname;

-- B. The policies. EXPECT exactly two rows, each roles {authenticated}, cmd SELECT:
--    claims       | claims_select_own          | ((user_id = (auth.uid())::text) AND is_member(league_id))
--    waiver_order | waiver_order_select_member | is_member(league_id)
SELECT tablename, policyname, cmd, roles, qual
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename IN ('claims', 'claims_runs', 'waiver_order', 'waiver_order_meta')
 ORDER BY tablename, policyname;

-- C. The functions (CLAUDE.md: proacl, never the migration's word). EXPECT eleven rows, every
--    prosecdef t and proconfig {"search_path=public, pg_temp"}, and proacl:
--    _claims_season_end, _waiver_order_fill, claims_before_insert
--                                    {postgres=X/postgres}
--    cancel_claim, place_claim       {postgres=X/postgres,authenticated=X/postgres}
--    claims_hold_active, claims_run_day, claims_run_state, commit_claims_run,
--    reset_due_waiver_orders, finalize_league_draft
--                                    {postgres=X/postgres,service_role=X/postgres}
--    No anon entry anywhere; no PUBLIC entry (one starting "=").
SELECT proname, prosecdef, proconfig, proacl
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND proname IN ('_claims_season_end', '_waiver_order_fill', 'claims_before_insert',
                   'place_claim', 'cancel_claim', 'claims_run_day', 'claims_run_state', 'claims_hold_active',
                   'commit_claims_run', 'reset_due_waiver_orders', 'finalize_league_draft')
 ORDER BY proname;

-- D. The caps are structural. EXPECT among the indexes:
--    claims_one_pending_per_stock | ... (league_id, user_id, symbol) WHERE (status = 'pending'::text)
--    claims_one_pending_per_sale  | ... (league_id, user_id, sell_symbol) WHERE ((status = 'pending'::text) AND (sell_symbol IS NOT NULL))
--    claims_pending_slot_key      | ... (league_id, user_id, pending_slot) WHERE (status = 'pending'::text)
--  among the constraints claims_pending_slot_shape (1..5 while pending, NULL otherwise), and the
--  trigger trg_claims_before_insert enabled (O).
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'claims' ORDER BY indexname;
SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'public.claims'::regclass ORDER BY conname;
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.claims'::regclass AND NOT tgisinternal;

-- E. The notice kinds. EXPECT the definition to list claim_won AND every earlier kind
--    (draft_order_set ... seat_taken_over): sixteen in all. claim_lost and claim_failed must NOT
--    appear: a claim that does not fill writes no notice (Giorgio, 2026-11-23, plan point 11).
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'league_notifications_kind_check';

-- F. The cron. EXPECT one row: claims_run | * * * * * | a command posting to
--    /functions/v1/claims-run with the vault 'cron_apikey', timeout_milliseconds := 180000, and the
--    WHERE on public.claims_run_day(). No key literal.
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'claims_run';

-- G. The backfill, BY DATA, per league (CLAUDE.md partial-state: a count against the expected set,
--    never "any row"). EXPECT zero rows: every drafted, unfinished league has a waiver order holding
--    exactly its members, positions 1..n with no gap.
SELECT l.id,
       (SELECT count(*) FROM league_members m WHERE m.league_id = l.id) AS members,
       (SELECT count(*) FROM waiver_order w WHERE w.league_id = l.id) AS ordered,
       (SELECT max(position) FROM waiver_order w WHERE w.league_id = l.id) AS max_position
  FROM leagues l
 WHERE l.draft_status = 'completed' AND l.season_status IS DISTINCT FROM 'completed'
   AND ((SELECT count(*) FROM league_members m WHERE m.league_id = l.id)
          IS DISTINCT FROM (SELECT count(*) FROM waiver_order w WHERE w.league_id = l.id)
     OR (SELECT count(*) FROM waiver_order w WHERE w.league_id = l.id)
          IS DISTINCT FROM (SELECT coalesce(max(position), 0) FROM waiver_order w WHERE w.league_id = l.id)
     OR EXISTS (SELECT 1 FROM waiver_order w WHERE w.league_id = l.id
                 AND NOT EXISTS (SELECT 1 FROM league_members m WHERE m.league_id = l.id AND m.user_id = w.user_id)));

-- EFFECT BLOCK
-- H. EFFECT, as real accounts, everything rolled back. In one drafted, unfinished league with no
--    pending claims and two active signed-in members (P and Q):
--      a. a claim for P (written as the owner, through the trigger: the clock decides whether
--         place_claim may run, so the write itself is tested in c);
--      b. BLIND: Q reads none of P's rows (not by symbol, not by count); P reads their own;
--      c. place_claim as P: claim_market_open while the market is open, ok while it is closed;
--      d. the cap: a 6th pending claim for P is refused by the trigger (claim_limit);
--      e. cancel_claim as P cancels; a second cancel is a no-op;
--      f. grants: Q (authenticated) cannot call commit_claims_run or claims_hold_active; anon cannot
--         call place_claim;
--      g. commit_claims_run as service_role with a plan that fails P's claims: the claims become
--         terminal with their reason on the row, NO notice is written for them (only a fill gets
--         one), a claims_runs row exists, and a second commit is already_ran; the order did not move.
--    ANY HOUR, ANY DAY. Only c reads the clock, and it checks the branch the clock calls for (open:
--    refused; closed: placed toward the next session); the league is chosen so its season is still
--    running at that next session. If the calendar cannot say open or closed (refresh-market-calendar
--    has not covered today, or no next session is listed) the block stops with SETUP FAIL naming
--    that, never a FAIL or a PASS. supabase/tests/claims.pglite.test.ts runs it at ET midnight, the
--    open, the close and a Saturday.
--    The verdict is the error text: 'CLAIMS EFFECT TEST: PASS ...' or '... FAIL ...'.
do $$
declare
  v_league uuid;
  v_p      text;
  v_q      text;
  v_syms   text[];
  v_run    date := current_date + 3650;  -- a date no real run uses
  v_res    jsonb;
  v_n      int;
  v_msg    text;
  v_mkt    text;
  v_next   timestamptz;
  v_ids    jsonb;
  v_order  jsonb;
  v_before jsonb;
  v_plan   jsonb;
  v_fail   text := '';
begin
  -- The clock, first: it decides c's branch and which league can take a claim now.
  select s.status, s.next_open_at into v_mkt, v_next from public.market_session_status(now()) s;
  if v_mkt is distinct from 'open' and (v_mkt is distinct from 'closed' or v_next is null) then
    raise exception 'CLAIMS EFFECT TEST: SETUP FAIL -- the market calendar does not say open or closed with a next session now (status %, next open %): check market_calendar_coverage / refresh-market-calendar, then re-run',
      coalesce(v_mkt, 'null'), coalesce(v_next::text, 'null');
  end if;
  select l.id into v_league
    from leagues l
   where l.draft_status = 'completed' and l.season_status is distinct from 'completed'
     -- Still running at the session a claim placed now would fill at (place_claim's own date test).
     and (public._claims_season_end(l.id) is null
          or public._claims_season_end(l.id) >= greatest(now(), coalesce(v_next, now())))
     and not exists (select 1 from claims c where c.league_id = l.id and c.status = 'pending')
     and (select count(*) from league_members m
           where m.league_id = l.id and m.hidden_at is null and m.deleted_at is null
             and m.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') >= 2
   order by l.id limit 1;
  if v_league is null then
    raise exception 'CLAIMS EFFECT TEST: SETUP FAIL -- no drafted league still running at the next session with two active signed-in members and no pending claims';
  end if;
  select array_agg(m.user_id order by m.user_id) into v_syms
    from league_members m
   where m.league_id = v_league and m.hidden_at is null and m.deleted_at is null
     and m.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_p := v_syms[1];
  v_q := v_syms[2];
  -- Seven draftable stocks nobody in the league holds.
  select array_agg(s.symbol order by s.symbol) into v_syms
    from (select y.symbol from symbols y
           where y.is_draftable is true and y.symbol = upper(y.symbol) and length(y.symbol) between 1 and 12
             and not exists (select 1 from public.league_held_positions(v_league) h where h.symbol = y.symbol)
           order by y.symbol limit 7) s;
  if coalesce(cardinality(v_syms), 0) < 7 then
    raise exception 'CLAIMS EFFECT TEST: SETUP FAIL -- fewer than 7 free draftable symbols';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', w.user_id, 'position', w.position) order by w.position), '[]'::jsonb)
    into v_before from waiver_order w where w.league_id = v_league;

  -- a. One pending claim for P, through the trigger.
  insert into public.claims (league_id, user_id, symbol, funded_by, run_date)
  values (v_league, v_p, v_syms[1], 'cash', v_run);

  -- b. BLIND.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_q, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_q, true);
  select count(*) into v_n from public.claims where user_id <> v_q;
  if v_n <> 0 then v_fail := v_fail || ' b:q-sees-others(' || v_n || ')'; end if;
  select count(*) into v_n from public.claims where symbol = v_syms[1] and user_id <> v_q;
  if v_n <> 0 then v_fail := v_fail || ' b:q-sees-p-by-symbol'; end if;
  begin
    perform public.claims_hold_active(v_league);
    v_fail := v_fail || ' f:hold-callable-by-member';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.commit_claims_run(v_league, v_run, '{}'::jsonb);
    v_fail := v_fail || ' f:commit-callable-by-member';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_p, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_p, true);
  select count(*) into v_n from public.claims where league_id = v_league and status = 'pending';
  if v_n <> 1 then v_fail := v_fail || ' b:p-reads-own(' || v_n || ')'; end if;

  -- c. place_claim as P, by the clock.
  v_res := public.place_claim(v_league, v_syms[2], null);
  if v_mkt = 'open' then
    if v_res ->> 'reason' is distinct from 'claim_market_open' then v_fail := v_fail || ' c:open-not-refused(' || v_res::text || ')'; end if;
  else  -- closed, with a next session (checked at the top)
    if not coalesce((v_res ->> 'ok')::boolean, false) then
      v_fail := v_fail || ' c:closed-refused(' || v_res::text || ')';
    elsif v_res -> 'claim' ->> 'run_date' is distinct from (v_next at time zone 'America/New_York')::date::text then
      v_fail := v_fail || ' c:wrong-run-date(' || v_res::text || ')';
    end if;
  end if;

  -- d. The cap (as the owner: the trigger, whatever the clock).
  perform set_config('role', 'postgres', true);
  insert into public.claims (league_id, user_id, symbol, funded_by, run_date)
  select v_league, v_p, x.s, 'cash', v_run
    from unnest(v_syms[3:7]) as x(s)
   where (select count(*) from public.claims c where c.league_id = v_league and c.user_id = v_p and c.status = 'pending') < 5
   limit 5 - (select count(*)::int from public.claims c where c.league_id = v_league and c.user_id = v_p and c.status = 'pending');
  select count(*) into v_n from public.claims where league_id = v_league and user_id = v_p and status = 'pending';
  if v_n <> 5 then v_fail := v_fail || ' d:not-five(' || v_n || ')'; end if;
  begin
    insert into public.claims (league_id, user_id, symbol, funded_by, run_date) values (v_league, v_p, v_syms[7], 'cash', v_run);
    v_fail := v_fail || ' d:sixth-accepted';
  exception when check_violation or unique_violation then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like 'claim_limit%' and v_msg not like '%claims_one_pending_per_stock%' then
      v_fail := v_fail || ' d:wrong-refusal(' || v_msg || ')';
    end if;
  end;

  -- e. cancel as P.
  perform set_config('role', 'authenticated', true);
  v_res := public.cancel_claim(v_league, lower(v_syms[1]));
  if not coalesce((v_res ->> 'cancelled')::boolean, false) then v_fail := v_fail || ' e:cancel(' || v_res::text || ')'; end if;
  v_res := public.cancel_claim(v_league, v_syms[1]);
  if coalesce((v_res ->> 'cancelled')::boolean, true) then v_fail := v_fail || ' e:second-cancel(' || v_res::text || ')'; end if;

  -- f. anon.
  perform set_config('role', 'anon', true);
  begin
    perform public.place_claim(v_league, v_syms[1], null);
    v_fail := v_fail || ' f:anon-place';
  exception when insufficient_privilege then null;
  end;

  -- g. The run's commit, as service_role: fail every pending claim of the league due by v_run.
  --    (The plan's inputs are read as the owner: service_role holds no table grant on claims, by design.)
  perform set_config('role', 'postgres', true);
  select coalesce(jsonb_agg(c.id order by c.id), '[]'::jsonb) into v_ids
    from public.claims c where c.league_id = v_league and c.status = 'pending' and c.run_date <= v_run;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', w.user_id, 'position', w.position) order by w.position), '[]'::jsonb)
    into v_order from public.waiver_order w where w.league_id = v_league;
  v_plan := jsonb_build_object(
    'claim_ids', v_ids, 'order', v_order, 'steps', '[]'::jsonb,
    -- A claim due before v_run (c's, placed for the next session) can only fail as missed_run.
    'outcomes', (select jsonb_agg(jsonb_build_object('claim_id', c.id, 'status', 'failed',
                                    'reason', case when c.run_date < v_run then 'missed_run' else 'effect_test' end,
                                    'detail', '{}'::jsonb))
                   from public.claims c where c.id in (select x::uuid from jsonb_array_elements_text(v_ids) x)));
  perform set_config('role', 'service_role', true);
  v_res := public.commit_claims_run(v_league, v_run, v_plan);
  if not coalesce((v_res ->> 'ok')::boolean, false) then v_fail := v_fail || ' g:commit(' || v_res::text || ')'; end if;
  perform set_config('role', 'postgres', true);
  select count(*) into v_n from public.claims where league_id = v_league and status = 'pending' and run_date <= v_run;
  if v_n <> 0 then v_fail := v_fail || ' g:still-pending(' || v_n || ')'; end if;
  select count(*) into v_n from public.claims_runs where league_id = v_league and run_date = v_run;
  if v_n <> 1 then v_fail := v_fail || ' g:no-run-row'; end if;
  -- EVERY claim in the plan is failed with the reason the plan gave it, on its own row (counted
  -- against the plan, never "at least one").
  select count(*) into v_n from public.claims c
   where c.id in (select x::uuid from jsonb_array_elements_text(v_ids) x)
     and c.status = 'failed' and c.resolved_at is not null
     and c.reason = case when c.run_date < v_run then 'missed_run' else 'effect_test' end;
  if v_n <> jsonb_array_length(v_ids) then
    v_fail := v_fail || ' g:reason-on-row(' || v_n || '/' || jsonb_array_length(v_ids) || ')';
  end if;
  -- Point 11: a claim that did not fill writes NO notice. Counted over every claim_ notice this
  -- transaction wrote in the league (created_at defaults to now(), the transaction's start), so a
  -- stray row is caught whatever its detail holds.
  select count(*) into v_n from public.league_notifications
   where league_id = v_league and kind like 'claim%' and created_at >= now();
  if v_n <> 0 then v_fail := v_fail || ' g:notice-for-unfilled(' || v_n || ')'; end if;
  if (select coalesce(jsonb_agg(jsonb_build_object('user_id', w.user_id, 'position', w.position) order by w.position), '[]'::jsonb)
        from waiver_order w where w.league_id = v_league) is distinct from v_before then
    v_fail := v_fail || ' g:order-moved';
  end if;
  perform set_config('role', 'service_role', true);
  v_res := public.commit_claims_run(v_league, v_run, '{"claim_ids":[],"order":[],"steps":[],"outcomes":[]}'::jsonb);
  if v_res ->> 'reason' is distinct from 'already_ran' then v_fail := v_fail || ' g:second-commit(' || v_res::text || ')'; end if;

  if v_fail = '' then
    raise exception 'PASS: CLAIMS EFFECT TEST (league %, market %) -- rolled back', v_league, v_mkt;
  end if;
  raise exception 'FAIL: CLAIMS EFFECT TEST:%', v_fail;
end $$;
