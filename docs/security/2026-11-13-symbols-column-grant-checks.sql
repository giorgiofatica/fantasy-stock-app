-- ============================================================================
-- S1 symbols lockdown: POST-PUSH CHECKS, SQL editor. Two stages, two parts.
--
--   PART A  after EXPAND   supabase/migrations/20261205000300_symbols_readers_functions.sql
--                          (the three functions; no privilege changed)
--   PART B  after CONTRACT supabase/migrations/deferred/20261205000400_symbols_column_grant.sql,
--                          once promoted (re-stamped) into supabase/migrations/
--                          (the table revoke + the three-column grant)
-- ============================================================================
-- Submit each numbered block ON ITS OWN: an error skips the rest of a submitted
-- script and can leave the session in an aborted transaction.
--
-- Both effect tests (A3, B3) are also run on PGlite by
-- supabase/tests/symbols_column_grant.pglite.test.ts, which keeps them honest.
-- ============================================================================


-- ============================================================================
-- PART A: after EXPAND (20261205000300)
-- ============================================================================

-- A1. The three functions. EXPECT for each: prosecdef t, proconfig
--     {"search_path=public, pg_temp"}, proacl with authenticated=X and the owner
--     only (no anon=, no service_role=, no bare =X).
select proname, prosecdef, proconfig, proacl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and proname in ('count_slot_matches', 'symbols_enrichment_progress', 'get_league_pick_industries')
 order by proname;

-- A2. The table is UNCHANGED by EXPAND (build 14 still reads it directly).
--     EXPECT authenticated=r/postgres in it (whole-table SELECT; 20261205000200,
--     in the same push, took MAINTAIN, so not =rm any more):
--     {postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=arwdDxtm/postgres}
--     (order may differ). PART B removes the authenticated entry.
select relacl from pg_class where oid = 'public.symbols'::regclass;

-- A2b. Every function an API role may run whose body names symbols. The test
--      pins this list on the migration chain; prod can also hold out-of-band
--      functions no migration made, which only this query sees. EXPECT exactly
--      these six (prosecdef in brackets):
--        count_slot_matches [t], create_takeover_invite [t] (matches on a comment,
--        "each of the 10 symbols", and reads no table), get_league_pick_industries [t],
--        get_portfolio_ledger [f], set_draft_queue [t], symbols_enrichment_progress [t].
--      Any other row: read its body BEFORE promoting CONTRACT. A SECURITY INVOKER
--      one breaks under the column grant if it reads a refused column; a SECURITY
--      DEFINER one must not return last_price / last_price_at / market_cap /
--      gics_industry.
select p.proname, p.prosecdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosrc ~* '\msymbols\M'
   and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
 order by 1;

-- A2c. OPTIONAL (the price-band oracle, security review item 3): how many
--      draftable symbols each category's count can see. A category with only a
--      few would let count_slot_matches narrow those few prices by bisection
--      (rate-limited to 120/min, 1200/hr per user). Report the smallest counts.
select c.slug,
       count(*) filter (where o.symbol is not null) as by_override,
       count(*) filter (where o.symbol is null and r.category_id = c.id) as by_rule
  from public.categories c
  join public.symbols s on s.is_draftable
  left join public.symbol_category_overrides o on o.symbol = s.symbol and o.category_id = c.id
  left join public.category_rules r on r.gics_industry = s.gics_industry
   and not exists (select 1 from public.symbol_category_overrides x where x.symbol = s.symbol)
 where o.symbol is not null or r.category_id = c.id
 group by c.slug
 order by count(*);

-- A3. EFFECT after EXPAND, as a real signed-in member (the claims pattern of
--     run-it-back-effect-test.sql): the functions answer a member, AND the direct
--     reads build 14 makes still work. ALWAYS ends in RAISE, so the whole block
--     rolls back, including the rate-limit counter it bumps. The verdict is the
--     error text: 'SYMBOLS READERS EXPAND EFFECT TEST: PASS ...'.
do $$
declare
  v_user    text;
  v_league  uuid;
  v_other   uuid;
  v_n       int;
  v_cnt     int;
  v_prog    record;
  v_fail    text := '';
  v_msg     text;
begin
  select m.user_id, m.league_id into v_user, v_league
    from league_members m
   where m.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and exists (select 1 from drafts d where d.league_id = m.league_id)
   order by m.league_id
   limit 1;
  if v_user is null then
    raise exception 'SYMBOLS READERS EXPAND EFFECT TEST: SETUP FAIL -- no UUID member of a league with picks';
  end if;
  select l.id into v_other from leagues l
   where not exists (select 1 from league_members m where m.league_id = l.id and m.user_id = v_user)
   limit 1;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user, true);

  -- a. The functions answer a member (build 15).
  v_cnt := public.count_slot_matches(null, null, null);
  if v_cnt is null or v_cnt = 0 then v_fail := v_fail || ' a:count_slot_matches=' || coalesce(v_cnt::text, 'null'); end if;
  select * into v_prog from public.symbols_enrichment_progress();
  if v_prog.total is null or v_prog.total = 0 then v_fail := v_fail || ' a:progress-total-0'; end if;
  select count(*) into v_n from public.get_league_pick_industries(v_league);
  if v_n = 0 then v_fail := v_fail || ' a:pick-industries-0-rows'; end if;

  -- b. A league the member is not in is refused by the function itself.
  if v_other is not null then
    begin
      perform * from public.get_league_pick_industries(v_other);
      v_fail := v_fail || ' b:non-member-answered';
    exception when insufficient_privilege then
      get stacked diagnostics v_msg = message_text;
      if v_msg not like '%not a member%' then v_fail := v_fail || ' b:wrong-refusal(' || v_msg || ')'; end if;
    end;
  end if;

  -- c. Build 14's direct reads still work (EXPAND changed no privilege).
  begin
    select count(*) into v_n from public.symbols
     where is_draftable and last_price >= 0 and gics_industry is not null;
    select count(*) filter (where enriched_at is not null) into v_n from public.symbols where active;
  exception when insufficient_privilege then
    v_fail := v_fail || ' c:build-14-direct-read-refused';
  end;

  -- d. anon may not run the functions.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.count_slot_matches(null, null, null);
    v_fail := v_fail || ' d:anon-runs-count_slot_matches';
  exception when insufficient_privilege then null;
  end;

  if v_fail = '' then
    raise exception 'SYMBOLS READERS EXPAND EFFECT TEST: PASS (member %, % draftable, % of % enriched) -- rolled back',
      v_user, v_cnt, v_prog.enriched, v_prog.total;
  end if;
  raise exception 'SYMBOLS READERS EXPAND EFFECT TEST: FAIL --%', v_fail;
end $$;


-- ============================================================================
-- PART B: after CONTRACT (the deferred 20261205000400, promoted and re-stamped)
-- ============================================================================

-- B1. The table ACL. EXPECT exactly: {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
--     No authenticated= entry (before CONTRACT it was authenticated=r, whole-table
--     SELECT; =rm before 20261205000200), no anon=, no bare =r (PUBLIC).
select relacl from pg_class where oid = 'public.symbols'::regclass;

-- B2. The column grants. EXPECT three rows, all authenticated | SELECT:
--     is_draftable, name, symbol. Nothing for anon or PUBLIC. (With no table-level
--     grant left, information_schema.column_privileges lists only real column
--     grants, so this is exact; before CONTRACT it listed every column.)
select grantee, column_name, privilege_type
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'symbols'
   and grantee in ('authenticated', 'anon', 'PUBLIC')
 order by grantee, column_name;

-- B3. EFFECT after CONTRACT, as a real signed-in member. ALWAYS ends in RAISE, so
--     the whole block rolls back, including the rate-limit counter it bumps. The
--     verdict is the error text: 'SYMBOLS COLUMN GRANT EFFECT TEST: PASS ...'.
do $$
declare
  v_user    text;
  v_league  uuid;
  v_other   uuid;
  v_n       int;
  v_cnt     int;
  v_prog    record;
  v_ledger  jsonb;
  v_fail    text := '';
  v_msg     text;
  v_col     text;
begin
  -- A member with a UUID-shaped id (never a bot-*) of a league that has picks,
  -- and a league that member is NOT in (for the refusal).
  select m.user_id, m.league_id into v_user, v_league
    from league_members m
   where m.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and exists (select 1 from drafts d where d.league_id = m.league_id)
   order by m.league_id
   limit 1;
  if v_user is null then
    raise exception 'SYMBOLS COLUMN GRANT EFFECT TEST: SETUP FAIL -- no UUID member of a league with picks';
  end if;
  select l.id into v_other from leagues l
   where not exists (select 1 from league_members m where m.league_id = l.id and m.user_id = v_user)
   limit 1;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user, true);

  -- a. The granted columns read, every row.
  select count(*) into v_n from (select symbol, name, is_draftable from public.symbols) s;
  if v_n = 0 then v_fail := v_fail || ' a:granted-columns-read-0-rows'; end if;

  -- b. Every other column is refused, as a select and as a filter.
  foreach v_col in array array['last_price', 'last_price_at', 'market_cap', 'gics_industry', 'enriched_at', 'active'] loop
    begin
      execute format('select count(%I) from public.symbols', v_col);
      v_fail := v_fail || ' b:' || v_col || '-readable';
    exception when insufficient_privilege then null;
    end;
    begin
      execute format('select count(*) from public.symbols where %I is not null', v_col);
      v_fail := v_fail || ' b:' || v_col || '-filterable';
    exception when insufficient_privilege then null;
    end;
  end loop;

  -- c. The functions answer a member.
  v_cnt := public.count_slot_matches(null, null, null);
  if v_cnt is null or v_cnt = 0 then v_fail := v_fail || ' c:count_slot_matches=' || coalesce(v_cnt::text, 'null'); end if;
  select * into v_prog from public.symbols_enrichment_progress();
  if v_prog.total is null or v_prog.total = 0 then v_fail := v_fail || ' c:progress-total-0'; end if;
  select count(*) into v_n from public.get_league_pick_industries(v_league);
  if v_n = 0 then v_fail := v_fail || ' c:pick-industries-0-rows'; end if;

  -- d. A league the member is not in is refused by the function itself.
  if v_other is not null then
    begin
      perform * from public.get_league_pick_industries(v_other);
      v_fail := v_fail || ' d:non-member-answered';
    exception when insufficient_privilege then
      get stacked diagnostics v_msg = message_text;
      if v_msg not like '%not a member%' then v_fail := v_fail || ' d:wrong-refusal(' || v_msg || ')'; end if;
    end;
  end if;

  -- e. get_portfolio_ledger (SECURITY INVOKER) still names the symbols.
  v_ledger := public.get_portfolio_ledger(v_league);
  if jsonb_typeof(v_ledger -> 'symbol_names') <> 'object' then v_fail := v_fail || ' e:ledger-no-names'; end if;

  -- f. anon reads no column at all.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform symbol from public.symbols limit 1;
    v_fail := v_fail || ' f:anon-reads-symbol';
  exception when insufficient_privilege then null;
  end;

  if v_fail = '' then
    raise exception 'SYMBOLS COLUMN GRANT EFFECT TEST: PASS (member %, % draftable, % of % enriched) -- rolled back',
      v_user, v_cnt, v_prog.enriched, v_prog.total;
  end if;
  raise exception 'SYMBOLS COLUMN GRANT EFFECT TEST: FAIL --%', v_fail;
end $$;

-- B4. END TO END, signed out (any terminal; the publishable key only). EXPECT
--     401 / code 42501, not rows:
--       curl "$SUPABASE_URL/rest/v1/symbols?select=symbol&limit=1" -H "apikey: $SB_PUBLISHABLE_KEY"
--     Signed in, in the app (the NEW build): stock search finds AAPL with its
--     name; Create league › Price tiers › the availability check shows counts,
--     not "couldn't check"; a draft board draws its category lines.
--
-- B5. Re-capture docs/architecture/db-snapshot.json (db-snapshot.sql): symbols'
--     acl loses authenticated=rm and columnAcls gains the three columns.
