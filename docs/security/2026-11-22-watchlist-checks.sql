-- Post-push checks for 20261209000000_watchlist.sql (the watchlist, Stocks tab part 3,
-- workstream 2). Run in the Supabase SQL editor AFTER the real `supabase db push`; submit each
-- statement on its own. All are read-only: the effect block (E) ALWAYS ends in RAISE, so
-- every save it makes rolls back. supabase/tests/watchlist.pglite.test.ts runs A-E on the
-- full migration chain.

-- A. The table: RLS on, and the privileges by role. EXPECT one row:
--    rls t | anon_any f | auth_select t | auth_insert t | auth_delete t | auth_update f | auth_ddl f
--  and, as a second statement, the raw ACL (order may differ; MAINTAIN, "m", exists on prod's
--  Postgres 17 only): {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=ard/postgres}
--  i.e. no anon entry, no PUBLIC entry (an entry starting "="), and authenticated exactly "ard".
--  service_role keeps Supabase's default ALL, as on every table here (it bypasses RLS and is
--  server-side only); the trigger still enforces the seat and the cap on its inserts.
SELECT c.relrowsecurity AS rls,
       (has_table_privilege('anon', 'public.watchlist', 'SELECT')
        OR has_table_privilege('anon', 'public.watchlist', 'INSERT')
        OR has_table_privilege('anon', 'public.watchlist', 'UPDATE')
        OR has_table_privilege('anon', 'public.watchlist', 'DELETE')
        OR has_table_privilege('anon', 'public.watchlist', 'TRUNCATE')
        OR has_table_privilege('anon', 'public.watchlist', 'REFERENCES')
        OR has_table_privilege('anon', 'public.watchlist', 'TRIGGER')) AS anon_any,
       has_table_privilege('authenticated', 'public.watchlist', 'SELECT')   AS auth_select,
       has_table_privilege('authenticated', 'public.watchlist', 'INSERT')   AS auth_insert,
       has_table_privilege('authenticated', 'public.watchlist', 'DELETE')   AS auth_delete,
       has_table_privilege('authenticated', 'public.watchlist', 'UPDATE')   AS auth_update,
       (has_table_privilege('authenticated', 'public.watchlist', 'TRUNCATE')
        OR has_table_privilege('authenticated', 'public.watchlist', 'REFERENCES')
        OR has_table_privilege('authenticated', 'public.watchlist', 'TRIGGER')) AS auth_ddl
  FROM pg_class c
 WHERE c.oid = 'public.watchlist'::regclass;
SELECT relacl::text FROM pg_class WHERE oid = 'public.watchlist'::regclass;

-- B. The policies. EXPECT three rows, each roles {authenticated}:
--    watchlist_delete_own | DELETE | qual       ((user_id = (auth.uid())::text) AND is_member(league_id))
--    watchlist_insert_own | INSERT | with_check ((user_id = (auth.uid())::text) AND is_member(league_id))
--    watchlist_select_own | SELECT | qual       ((user_id = (auth.uid())::text) AND is_member(league_id))
SELECT policyname, cmd, roles, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'watchlist'
 ORDER BY policyname;

-- C. The functions (CLAUDE.md: proacl, never the migration's word). EXPECT three rows:
--    get_league_watchlist    | t | {"search_path=public, pg_temp"} | {postgres=X/postgres,authenticated=X/postgres}
--    set_watchlist           | t | {"search_path=public, pg_temp"} | {postgres=X/postgres,authenticated=X/postgres}
--    watchlist_before_insert | t | {"search_path=public, pg_temp"} | {postgres=X/postgres}
SELECT proname, prosecdef, proconfig, proacl
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND proname IN ('get_league_watchlist', 'set_watchlist', 'watchlist_before_insert')
 ORDER BY proname;

-- D. The cap is structural. EXPECT these rows among the constraints:
--    watchlist_cap_index_key   | UNIQUE (league_id, user_id, cap_index)
--    watchlist_cap_index_range | CHECK (((cap_index >= 1) AND (cap_index <= 50)))
--    watchlist_seat_fkey       | FOREIGN KEY (league_id, user_id) REFERENCES league_members(league_id, user_id) ON DELETE CASCADE
--  and the trigger: trg_watchlist_before_insert, enabled (O).
SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
 WHERE conrelid = 'public.watchlist'::regclass
 ORDER BY conname;
SELECT tgname, tgenabled FROM pg_trigger
 WHERE tgrelid = 'public.watchlist'::regclass AND NOT tgisinternal;

-- E. EFFECT, as real signed-in accounts, and the cap BY DATA. A member of a league saves a
--    stock, reads it back with no price column, fills the list to 50, is refused the 51st
--    (through the write AND by a direct insert), unsaves one and saves again; another
--    account outside that league is refused by the write and the reader and sees none of
--    the member's rows; anon is refused by the grants. The verdict is the error text:
--    'WATCHLIST EFFECT TEST: PASS ...'. Everything rolls back.
do $$
declare
  v_member   text;
  v_league   uuid;
  v_outsider text;
  v_syms     text[];
  v_res      jsonb;
  v_n        int;
  v_msg      text;
  v_fail     text := '';
begin
  select m.user_id, m.league_id into v_member, v_league
    from league_members m
   where m.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and m.hidden_at is null and m.deleted_at is null
   order by m.league_id, m.user_id
   limit 1;
  if v_member is null then
    raise exception 'WATCHLIST EFFECT TEST: SETUP FAIL -- no active UUID member of any league';
  end if;
  select m.user_id into v_outsider
    from league_members m
   where m.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and not exists (select 1 from league_members x where x.league_id = v_league and x.user_id = m.user_id)
   order by m.user_id
   limit 1;
  -- 51 stocks the member has not saved in this league (read as the owner, before the switch).
  select array_agg(s.symbol order by s.symbol) into v_syms
    from (select y.symbol from symbols y
           where y.symbol = upper(y.symbol) and length(y.symbol) between 1 and 12
             and not exists (select 1 from watchlist w
                              where w.league_id = v_league and w.user_id = v_member and w.symbol = y.symbol)
           order by y.symbol limit 51) s;
  if coalesce(cardinality(v_syms), 0) < 51 then
    raise exception 'WATCHLIST EFFECT TEST: SETUP FAIL -- fewer than 51 symbols to save';
  end if;

  -- 48 of the 50 places filled as the owner (an owner insert is not paced, and still goes
  -- through the trigger's seat and cap checks), so the member's own paced saves below stay
  -- at three, far inside the 30-a-minute window whatever they did earlier today.
  -- The member may already have saves here: top up to 48, whatever they hold.
  select count(*) into v_n from watchlist where league_id = v_league and user_id = v_member;
  if v_n > 48 then
    raise exception 'WATCHLIST EFFECT TEST: SETUP FAIL -- member % already has % saved in league %', v_member, v_n, v_league;
  end if;
  if v_n < 48 then
    insert into public.watchlist (league_id, user_id, symbol)
    select v_league, v_member, x.s from unnest(v_syms[3:(50 - v_n)]) as x(s);
  end if;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_member, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_member, true);

  -- a. The reader's columns: no price of any kind (#533, part 3).
  if pg_get_function_result('public.get_league_watchlist(uuid)'::regprocedure)
     <> 'TABLE(symbol text, name text, category_ids uuid[], is_draftable boolean, saved_at timestamp with time zone)' then
    v_fail := v_fail || ' a:result-columns-changed';
  end if;

  -- b. Save one; it reads back; the member's direct read shows only their own rows.
  v_res := public.set_watchlist(v_league, lower(v_syms[1]), true);
  if not coalesce((v_res ->> 'ok')::boolean, false) then v_fail := v_fail || ' b:save-refused(' || v_res::text || ')'; end if;
  select count(*) into v_n from public.get_league_watchlist(v_league) r where r.symbol = v_syms[1];
  if v_n <> 1 then v_fail := v_fail || ' b:saved-not-read-back'; end if;
  select count(*) into v_n from public.watchlist where user_id <> v_member;
  if v_n <> 0 then v_fail := v_fail || ' b:rls-shows-others-rows(' || v_n || ')'; end if;

  -- c. The 50th place by the write, then the 51st is refused, by the write and by a direct
  --    insert; 50 by data.
  v_res := public.set_watchlist(v_league, v_syms[2], true);
  v_n := (v_res ->> 'count')::int;
  if v_n is distinct from 50 then v_fail := v_fail || ' c:not-50-after-fill(' || v_res::text || ')'; end if;
  v_res := public.set_watchlist(v_league, v_syms[51], true);
  if v_res ->> 'reason' is distinct from 'watchlist_full' then v_fail := v_fail || ' c:51st-save-answered(' || v_res::text || ')'; end if;
  begin
    insert into public.watchlist (league_id, user_id, symbol) values (v_league, v_member, v_syms[51]);
    v_fail := v_fail || ' c:51st-direct-insert-accepted';
  exception when check_violation then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like 'watchlist_full%' then v_fail := v_fail || ' c:wrong-refusal(' || v_msg || ')'; end if;
  end;
  select count(*) into v_n from public.watchlist where league_id = v_league and user_id = v_member;
  if v_n <> 50 then v_fail := v_fail || ' c:count-by-data-is-' || v_n; end if;

  -- d. Unsave frees a place; the next save takes it.
  v_res := public.set_watchlist(v_league, v_syms[1], false);
  if (v_res ->> 'count')::int is distinct from 49 then v_fail := v_fail || ' d:unsave(' || v_res::text || ')'; end if;
  v_res := public.set_watchlist(v_league, v_syms[51], true);
  if (v_res ->> 'count')::int is distinct from 50 then v_fail := v_fail || ' d:resave(' || v_res::text || ')'; end if;

  -- e. Someone outside the league: refused by the write and the reader; sees no rows.
  if v_outsider is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_outsider, true);
    v_res := public.set_watchlist(v_league, v_syms[1], true);
    if v_res ->> 'reason' is distinct from 'not_a_member' then v_fail := v_fail || ' e:outsider-write(' || v_res::text || ')'; end if;
    begin
      perform * from public.get_league_watchlist(v_league);
      v_fail := v_fail || ' e:outsider-read-answered';
    exception when insufficient_privilege then
      get stacked diagnostics v_msg = message_text;
      if v_msg not like '%not a member%' then v_fail := v_fail || ' e:wrong-refusal(' || v_msg || ')'; end if;
    end;
    select count(*) into v_n from public.watchlist where league_id = v_league;
    if v_n <> 0 then v_fail := v_fail || ' e:outsider-sees-rows(' || v_n || ')'; end if;
  else
    v_fail := v_fail || ' e:no-outsider-account-to-test';
  end if;

  -- f. anon may run neither function (the grants refuse before the bodies run).
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.set_watchlist(v_league, v_syms[1], true);
    v_fail := v_fail || ' f:anon-write-answered';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.get_league_watchlist(v_league);
    v_fail := v_fail || ' f:anon-read-answered';
  exception when insufficient_privilege then null;
  end;

  if v_fail = '' then
    raise exception 'WATCHLIST EFFECT TEST: PASS (member %, league %, 50 saved then the 51st refused, outsider % refused) -- rolled back',
      v_member, v_league, v_outsider;
  end if;
  raise exception 'WATCHLIST EFFECT TEST: FAIL --%', v_fail;
end $$;
