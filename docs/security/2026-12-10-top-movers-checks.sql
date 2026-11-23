-- Post-push checks for 20261210000000_top_movers.sql and 20261210000001_schedule_rank_top_movers.sql
-- (top movers, Stocks tab part 3, workstream 4). Run in the Supabase SQL editor AFTER the real
-- `supabase db push`; submit each statement on its own. All are read-only: the effect block (G)
-- ALWAYS ends in RAISE, so the ranking it writes and every read it paces roll back.
-- supabase/tests/top_movers.pglite.test.ts runs A-G on the full migration chain.

-- A. The table: RLS on, and no client privilege of any kind. EXPECT one row:
--    rls t | anon_any f | auth_any f
--  and, as a second statement, the raw ACL (order may differ; MAINTAIN, "m", exists on prod's
--  Postgres 17 only): {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
--  i.e. no anon entry, no authenticated entry, no PUBLIC entry (an entry starting "=").
--  service_role keeps Supabase's default ALL, as on every table here (it bypasses RLS and is
--  server-side only); the edge function writes only through replace_top_movers.
SELECT c.relrowsecurity AS rls,
       (has_table_privilege('anon', 'public.top_movers', 'SELECT')
        OR has_table_privilege('anon', 'public.top_movers', 'INSERT')
        OR has_table_privilege('anon', 'public.top_movers', 'UPDATE')
        OR has_table_privilege('anon', 'public.top_movers', 'DELETE')
        OR has_table_privilege('anon', 'public.top_movers', 'TRUNCATE')
        OR has_table_privilege('anon', 'public.top_movers', 'REFERENCES')
        OR has_table_privilege('anon', 'public.top_movers', 'TRIGGER')) AS anon_any,
       (has_table_privilege('authenticated', 'public.top_movers', 'SELECT')
        OR has_table_privilege('authenticated', 'public.top_movers', 'INSERT')
        OR has_table_privilege('authenticated', 'public.top_movers', 'UPDATE')
        OR has_table_privilege('authenticated', 'public.top_movers', 'DELETE')
        OR has_table_privilege('authenticated', 'public.top_movers', 'TRUNCATE')
        OR has_table_privilege('authenticated', 'public.top_movers', 'REFERENCES')
        OR has_table_privilege('authenticated', 'public.top_movers', 'TRIGGER')) AS auth_any
  FROM pg_class c
 WHERE c.oid = 'public.top_movers'::regclass;
SELECT relacl::text FROM pg_class WHERE oid = 'public.top_movers'::regclass;

-- B. The policies. EXPECT zero rows (RLS on with no policy: no client row, ever).
SELECT policyname, cmd, roles, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'top_movers';

-- C. The functions (CLAUDE.md: proacl, never the migration's word). EXPECT two rows:
--    get_league_top_movers | t | {"search_path=public, pg_temp"} | {postgres=X/postgres,authenticated=X/postgres}
--    replace_top_movers    | t | {"search_path=public, pg_temp"} | {postgres=X/postgres,service_role=X/postgres}
SELECT proname, prosecdef, proconfig, proacl
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND proname IN ('get_league_top_movers', 'replace_top_movers')
 ORDER BY proname;

-- D. The whole-or-nothing rules are structural. EXPECT these rows:
--    top_movers_gate         | CHECK (((set_size > 0) AND ((fresh_count >= 1) AND (fresh_count <= set_size)) AND (((fresh_count)::bigint * 10) >= ((set_size)::bigint * 9))))
--    top_movers_pkey         | PRIMARY KEY (rank)
--    top_movers_rank_range   | CHECK (((rank >= 1) AND (rank <= 100)))
--    top_movers_symbol_key   | UNIQUE (symbol)
--    top_movers_symbol_shape | CHECK ((btrim(symbol) <> ''::text))
--  and NO foreign key (an ON DELETE action would edit the ranking a row at a time).
SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
 WHERE conrelid = 'public.top_movers'::regclass
 ORDER BY conname;

-- E. The schedule. EXPECT one row: rank_top_movers | */5 * * * * | a command that posts to
--    .../functions/v1/rank-top-movers with the apikey read from vault.decrypted_secrets
--    ('cron_apikey'), timeout_milliseconds := 180000, and the filter
--    "where exists (select 1 from public.market_session_status() s where s.status = 'open')".
SELECT jobname, schedule, command, active FROM cron.job WHERE jobname = 'rank_top_movers';

-- F. BY DATA, during market hours, AFTER the deploy (the plan's "Done means" 6). EXPECT
--    ranked_at within the last ~5 minutes (THE liveness signal: the cron_job_status row below
--    keeps the day's last non-trivial result and cannot show a hung run), rows 100, set_size 500, fresh_count >= 450,
--    min/max_abs_change plausible (a few percent to a few tens of percent), and one value
--    each of ranked_at, set_size and fresh_count (one run wrote every row).
SELECT max(ranked_at) AS ranked_at, now() - max(ranked_at) AS age, count(*) AS rows,
       count(DISTINCT ranked_at) AS runs, min(set_size) AS set_size, min(fresh_count) AS fresh_count,
       min(abs(change_pct)) AS min_abs_change, max(abs(change_pct)) AS max_abs_change
  FROM public.top_movers;
--    And the run's own record (a 'failed' whose message starts "partial:" is a run that kept the
--    previous ranking; the proof is ranked_at above, not this row):
SELECT run_date, status, attempt_number, error_message, updated_at
  FROM public.cron_job_status WHERE job_name = 'rank-top-movers' ORDER BY run_date DESC LIMIT 3;

-- G. EFFECT, as real roles. The writer: anon and authenticated are refused by the grant; as
--    service_role, a ranking under the 90% gate, a truncated one, a mis-ordered one and one
--    with a duplicate are each refused (22023); a valid one is written whole; an older one is
--    kept out. The reader: a member of a league that holds a stock gets the ranking in order,
--    at most 25 rows, with no price column and never the held stock (put at rank 1 on
--    purpose), numbered 1..n within the reply; someone outside the league and anon are
--    refused; the member cannot read the table directly. (A hidden seat may read, like the
--    Available list; the PGlite test pins that. The block picks an active member only to
--    have a typical caller.) Best run outside market hours: the write holds the table's
--    EXCLUSIVE lock until the rollback, so a cron write in that second waits for it. The verdict is the error text: 'TOP MOVERS EFFECT TEST: PASS ...'.
--    Everything rolls back, including the real ranking this replaces for the moment.
do $$
declare
  v_member   text;
  v_league   uuid;
  v_held     text;
  v_outsider text;
  v_syms     text[];
  v_chg      numeric[];
  -- clock_timestamp, not now(): a real ranking the cron commits after this block's
  -- transaction began is still older than v_at, so the valid write below is not kept out.
  v_at       timestamptz := clock_timestamp() + interval '1 second';
  v_res      jsonb;
  v_n        int;
  v_expect   int;
  v_prev     int;
  v_msg      text;
  v_code     text;
  v_fail     text := '';
  r          record;
begin
  -- A league holding at least one draftable, priced stock, and an active UUID member of it.
  select m.user_id, m.league_id, x.sym into v_member, v_league, v_held
    from league_members m
    join lateral (
      select h.sym from (
        select upper(d.symbol) as sym, d.user_id::text as uid, coalesce(d.quantity, 0)::numeric as q
          from drafts d where d.league_id = m.league_id and d.symbol is not null and upper(d.symbol) <> 'SKIP'
        union all
        select upper(t.symbol), t.user_id::text,
               case when t.action = 'sell' then -coalesce(t.quantity, 0)::numeric else coalesce(t.quantity, 0)::numeric end
          from trades t where t.league_id = m.league_id and t.symbol is not null
      ) h
      join symbols s on s.symbol = h.sym and s.is_draftable = true and s.last_price is not null
      group by h.sym, h.uid having sum(h.q) > 0.000000001
      order by h.sym limit 1
    ) x on true
   where m.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and m.hidden_at is null and m.deleted_at is null
   order by m.league_id, m.user_id
   limit 1;
  if v_member is null then
    raise exception 'TOP MOVERS EFFECT TEST: SETUP FAIL -- no active UUID member of a league that holds a listable stock';
  end if;
  select m.user_id into v_outsider
    from league_members m
   where m.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and not exists (select 1 from league_members x where x.league_id = v_league and x.user_id = m.user_id)
   order by m.user_id
   limit 1;

  -- 100 listable stocks, the held one first; changes 100, -99, 98, ... (biggest first).
  select array_agg(z.symbol order by z.o), array_agg(z.chg order by z.o) into v_syms, v_chg
    from (select y.symbol, y.o, (case when y.o % 2 = 1 then 1 else -1 end) * (101 - y.o)::numeric as chg
            from (select s.symbol, row_number() over (order by (s.symbol = v_held) desc, s.market_cap desc nulls last, s.symbol) as o
                    from symbols s where s.is_draftable = true and s.last_price is not null) y
           where y.o <= 100) z;
  if coalesce(cardinality(v_syms), 0) < 100 or v_syms[1] <> v_held then
    raise exception 'TOP MOVERS EFFECT TEST: SETUP FAIL -- fewer than 100 listable stocks';
  end if;

  -- a. The reader's columns: no price of any kind.
  if pg_get_function_result('public.get_league_top_movers(uuid)'::regprocedure)
     <> 'TABLE(place integer, symbol text, name text, category_ids uuid[], ranked_at timestamp with time zone)' then
    v_fail := v_fail || ' a:result-columns-changed';
  end if;

  -- b. The writer refuses anon and authenticated by the grant.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
  begin
    perform public.replace_top_movers(v_at, 500, 500, v_syms, v_chg);
    v_fail := v_fail || ' b:anon-write-answered';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_member, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_member, true);
  begin
    perform public.replace_top_movers(v_at, 500, 500, v_syms, v_chg);
    v_fail := v_fail || ' b:member-write-answered';
  exception when insufficient_privilege then null;
  end;

  -- c. As service_role: the gate and the shape are enforced by the function itself.
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  for r in
    select * from (values
      ('under-90', 500, 449, v_syms, v_chg),
      ('truncated', 500, 450, v_syms[1:99], v_chg[1:99]),
      ('misordered', 500, 500, v_syms, v_chg[2:2] || v_chg[1:1] || v_chg[3:100]),
      ('duplicate', 500, 500, v_syms[1:99] || v_syms[1:1], v_chg)
    ) as t(label, set_size, fresh, syms, chg)
  loop
    begin
      perform public.replace_top_movers(v_at, r.set_size, r.fresh, r.syms, r.chg);
      v_fail := v_fail || ' c:' || r.label || '-written';
    exception when others then
      get stacked diagnostics v_code = returned_sqlstate;
      if v_code <> '22023' then v_fail := v_fail || ' c:' || r.label || '-wrong-refusal(' || v_code || ')'; end if;
    end;
  end loop;
  v_res := public.replace_top_movers(v_at, 500, 450, v_syms, v_chg);
  if v_res ->> 'written' is distinct from 'true' then v_fail := v_fail || ' c:valid-not-written(' || v_res::text || ')'; end if;
  v_res := public.replace_top_movers(v_at - interval '1 minute', 500, 500, v_syms, v_chg);
  if v_res ->> 'reason' is distinct from 'newer_ranking_exists' then v_fail := v_fail || ' c:older-replaced(' || v_res::text || ')'; end if;

  -- d. By data: the whole ranking, one run's values on every row.
  perform set_config('role', 'postgres', true);
  select count(*), count(distinct ranked_at) into v_n, v_prev from public.top_movers;
  if v_n <> 100 or v_prev <> 1 then v_fail := v_fail || ' d:ranking-rows(' || v_n || ',' || v_prev || ')'; end if;
  select least(25, count(*))::int into v_expect
    from public.top_movers m join symbols s on s.symbol = m.symbol
   where s.is_draftable = true and s.last_price is not null
     and not exists (
       select 1 from (
         select upper(d.symbol) as sym, d.user_id::text as uid, coalesce(d.quantity, 0)::numeric as q
           from drafts d where d.league_id = v_league and d.symbol is not null and upper(d.symbol) <> 'SKIP'
         union all
         select upper(t.symbol), t.user_id::text,
                case when t.action = 'sell' then -coalesce(t.quantity, 0)::numeric else coalesce(t.quantity, 0)::numeric end
           from trades t where t.league_id = v_league and t.symbol is not null
       ) h where h.sym = upper(m.symbol) group by h.sym, h.uid having sum(h.q) > 0.000000001);

  -- e. The member reads: in rank order, at most 25, never the held stock, the write's time.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_member, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_member, true);
  v_n := 0; v_prev := 0;
  for r in select * from public.get_league_top_movers(v_league) loop
    v_n := v_n + 1;
    if r.place <> v_prev + 1 then v_fail := v_fail || ' e:place-not-1..n'; end if;
    v_prev := r.place;
    if upper(r.symbol) = upper(v_held) then v_fail := v_fail || ' e:held-stock-listed(' || r.symbol || ')'; end if;
    if r.ranked_at is distinct from v_at then v_fail := v_fail || ' e:wrong-ranked-at'; end if;
  end loop;
  if v_n <> v_expect then v_fail := v_fail || ' e:rows-' || v_n || '-expected-' || v_expect; end if;
  begin
    perform 1 from public.top_movers limit 1;
    v_fail := v_fail || ' e:member-reads-table';
  exception when insufficient_privilege then null;
  end;

  -- f. Someone outside the league: refused, never an empty list.
  if v_outsider is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_outsider, true);
    begin
      perform * from public.get_league_top_movers(v_league);
      v_fail := v_fail || ' f:outsider-read-answered';
    exception when insufficient_privilege then
      get stacked diagnostics v_msg = message_text;
      if v_msg not like '%not a member%' then v_fail := v_fail || ' f:wrong-refusal(' || v_msg || ')'; end if;
    end;
  else
    v_fail := v_fail || ' f:no-outsider-account-to-test';
  end if;

  -- g. anon may not read (the grant refuses before the body runs).
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform * from public.get_league_top_movers(v_league);
    v_fail := v_fail || ' g:anon-read-answered';
  exception when insufficient_privilege then null;
  end;

  if v_fail = '' then
    raise exception 'TOP MOVERS EFFECT TEST: PASS (member %, league %, held % never listed, % rows read, outsider % refused) -- rolled back',
      v_member, v_league, v_held, v_expect, v_outsider;
  end if;
  raise exception 'TOP MOVERS EFFECT TEST: FAIL --%', v_fail;
end $$;
