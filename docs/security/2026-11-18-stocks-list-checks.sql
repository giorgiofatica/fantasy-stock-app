-- Post-push checks for 20261207000100_league_available_stocks.sql (the Stocks list read,
-- docs/plans/2026-11-18-stocks-tab.md part 1). Run in the Supabase SQL editor AFTER the
-- real `supabase db push`; submit each statement on its own. Both are read-only: the
-- effect block ALWAYS ends in RAISE, so it rolls back, rate-limit counters included.
-- supabase/tests/league_available_stocks.pglite.test.ts runs B against the full chain.

-- A. Grants. EXPECT one row: prosecdef t | {"search_path=public, pg_temp"} |
--    {postgres=X/postgres,authenticated=X/postgres}
SELECT prosecdef, proconfig, proacl
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND proname = 'get_league_available_stocks';

-- B. EFFECT, as real signed-in accounts: a member of a league gets rows (at most 25; only
--    symbol, name, category_ids and has_more, no price; none held in that league), a
--    signed-in account outside the league is refused with "not a member", anon is refused
--    by the grant. The verdict is the error text: 'STOCKS LIST EFFECT TEST: PASS ...'.
do $$
declare
  v_member   text;
  v_league   uuid;
  v_outsider text;
  v_n        int;
  v_held     int;
  v_held_syms text[];
  v_msg      text;
  v_fail     text := '';
begin
  select m.user_id, m.league_id into v_member, v_league
    from league_members m
   where m.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and exists (select 1 from drafts d where d.league_id = m.league_id)
   order by m.league_id
   limit 1;
  if v_member is null then
    raise exception 'STOCKS LIST EFFECT TEST: SETUP FAIL -- no UUID member of a league with picks';
  end if;
  select m.user_id into v_outsider
    from league_members m
   where m.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and not exists (select 1 from league_members x where x.league_id = v_league and x.user_id = m.user_id)
   limit 1;
  -- Held in the league (net per manager > 0), read as the owner BEFORE switching role.
  select coalesce(array_agg(distinct h.sym), '{}') into v_held_syms
    from (select x.sym from (
            select upper(d.symbol) sym, d.user_id::text uid, d.quantity::numeric q from drafts d where d.league_id = v_league
            union all
            select upper(t.symbol), t.user_id::text,
                   case when t.action = 'sell' then -t.quantity::numeric else t.quantity::numeric end
              from trades t where t.league_id = v_league
          ) x group by x.sym, x.uid having sum(x.q) > 0.000000001) h;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_member, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_member, true);

  -- a. A member gets rows, at most 25, none held in the league, and no price column
  --    (#533: the list never shows the stored price).
  if pg_get_function_result('public.get_league_available_stocks(uuid, uuid, text, integer)'::regprocedure)
     <> 'TABLE(symbol text, name text, category_ids uuid[], has_more boolean)' then
    v_fail := v_fail || ' a:result-columns-changed';
  end if;
  select count(*) into v_n from public.get_league_available_stocks(v_league, null, null, 1000);
  if v_n = 0 then v_fail := v_fail || ' a:member-got-0-rows'; end if;
  if v_n > 25 then v_fail := v_fail || ' a:cap-exceeded(' || v_n || ')'; end if;
  select count(*) into v_held
    from public.get_league_available_stocks(v_league) r
   where r.symbol = any(v_held_syms);
  if v_held > 0 then v_fail := v_fail || ' a:listed-a-held-stock'; end if;

  -- b. A signed-in account outside the league is refused by the function itself.
  if v_outsider is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_outsider, true);
    begin
      perform * from public.get_league_available_stocks(v_league);
      v_fail := v_fail || ' b:outsider-answered';
    exception when insufficient_privilege then
      get stacked diagnostics v_msg = message_text;
      if v_msg not like '%not a member%' then v_fail := v_fail || ' b:wrong-refusal(' || v_msg || ')'; end if;
    end;
  else
    v_fail := v_fail || ' b:no-outsider-account-to-test';
  end if;

  -- c. anon may not run it (the grant refuses before the body runs).
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform * from public.get_league_available_stocks(v_league);
    v_fail := v_fail || ' c:anon-answered';
  exception when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%permission denied for function%' then v_fail := v_fail || ' c:wrong-refusal(' || v_msg || ')'; end if;
  end;

  if v_fail = '' then
    raise exception 'STOCKS LIST EFFECT TEST: PASS (member %, league %, % rows, % held excluded, outsider % refused) -- rolled back',
      v_member, v_league, v_n, cardinality(v_held_syms), v_outsider;
  end if;
  raise exception 'STOCKS LIST EFFECT TEST: FAIL --%', v_fail;
end $$;
