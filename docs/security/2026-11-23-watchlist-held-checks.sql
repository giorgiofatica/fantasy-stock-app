-- Post-push checks for 20261210500000_watchlist_held_leaves.sql (a stock you own is never on
-- your watchlist). Run in the Supabase SQL editor AFTER the real `supabase db push`; submit each
-- statement on its own. All are read-only: the effect block (D) ALWAYS ends in RAISE, so every
-- row and trade it writes rolls back. supabase/tests/watchlist_held_leaves.pglite.test.ts runs
-- A-D on the full migration chain.
--
-- About D, before running it (security review): it picks the first league with two active real
-- members, takes the seat lock on one real league_members row for the moment it runs, and
-- writes a real trade row, all rolled back. Run it outside trading hours. Its PASS / FAIL line
-- prints a league id and two member ids: read it, do not paste it into a ticket or a chat.

-- A. The functions (CLAUDE.md: proacl, never the migration's word). EXPECT five rows:
--    get_league_watchlist        | t | {"search_path=public, pg_temp"}                  | {postgres=X/postgres,authenticated=X/postgres}
--    league_held_positions       | f | {"search_path=public, pg_temp"}                  | {postgres=X/postgres}
--    set_watchlist               | t | {"search_path=public, pg_temp"}                  | {postgres=X/postgres,authenticated=X/postgres}
--    watchlist_before_insert     | t | {"search_path=public, pg_temp"}                  | {postgres=X/postgres}
--    watchlist_leaves_on_holding | t | {"search_path=public, pg_temp",lock_timeout=2s}  | {postgres=X/postgres}
--  (No anon, no service_role, and no entry starting "=", which would be PUBLIC.)
SELECT proname, prosecdef, proconfig, proacl
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND proname IN ('get_league_watchlist', 'league_held_positions', 'set_watchlist',
                   'watchlist_before_insert', 'watchlist_leaves_on_holding')
 ORDER BY proname;

-- B. The removal triggers, on BOTH holding tables. EXPECT two rows, each enabled (O):
--    drafts | trg_drafts_watchlist_leaves | O | CREATE TRIGGER ... AFTER INSERT OR UPDATE OF league_id, user_id, symbol ON public.drafts ...
--    trades | trg_trades_watchlist_leaves | O | CREATE TRIGGER ... AFTER INSERT OR UPDATE OF league_id, user_id, symbol ON public.trades ...
SELECT tgrelid::regclass::text AS tbl, tgname, tgenabled, pg_get_triggerdef(oid) AS def
  FROM pg_trigger
 WHERE tgname IN ('trg_drafts_watchlist_leaves', 'trg_trades_watchlist_leaves')
 ORDER BY tgname;

-- C. The cleanup took. EXPECT saved_and_held = 0 (the preflight's statement 1 answers 0 too).
SELECT count(*) AS saved_and_held
  FROM public.watchlist w
 WHERE EXISTS (SELECT 1 FROM public.league_held_positions(w.league_id, w.user_id) h
                WHERE h.symbol = w.symbol);

-- D. EFFECT, on a real league and real accounts; the verdict is the error text,
--    'WATCHLIST HELD EFFECT TEST: PASS ...'. Everything rolls back.
--    A member M saves two stocks nobody in the league holds (S1, S2) and a second member M2 saves
--    S1 too; then M BUYS S1 (a trades row, as every buy and every claim fill writes one):
--      a. M's S1 row is gone; M's S2 row and M2's S1 row are untouched;
--      b. as M (signed in), a save of S1 answers reason 'held', and a direct insert is refused
--         with PT409 'watchlist_held';
--      c. the reader does not return S1;
--      d. a SELL row for S2 removes M's S2 row.
do $$
declare
  v_league uuid;
  v_m      text;
  v_m2     text;
  v_s1     text;
  v_s2     text;
  v_res    jsonb;
  v_n      int;
  v_msg    text;
  v_state  text;
  v_fail   text := '';
begin
  -- A league with two active UUID members.
  select m.league_id, min(m.user_id), max(m.user_id) into v_league, v_m, v_m2
    from league_members m
   where m.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and m.hidden_at is null and m.deleted_at is null
   group by m.league_id
  having count(*) >= 2
   order by m.league_id
   limit 1;
  if v_league is null then
    raise exception 'WATCHLIST HELD EFFECT TEST: SETUP FAIL -- no league with two active UUID members';
  end if;
  -- Two stocks nobody in that league holds, that neither member has saved there.
  select min(s.symbol), max(s.symbol) into v_s1, v_s2
    from (select y.symbol from symbols y
           where y.symbol = upper(y.symbol) and length(y.symbol) between 1 and 12
             and not exists (select 1 from public.league_held_positions(v_league) h where h.symbol = y.symbol)
             and not exists (select 1 from watchlist w where w.league_id = v_league
                              and w.user_id in (v_m, v_m2) and w.symbol = y.symbol)
           order by y.symbol limit 2) s;
  if v_s1 is null or v_s1 = v_s2 then
    raise exception 'WATCHLIST HELD EFFECT TEST: SETUP FAIL -- fewer than two free symbols';
  end if;
  select count(*) into v_n from watchlist where league_id = v_league and user_id = v_m;
  if v_n > 48 then
    raise exception 'WATCHLIST HELD EFFECT TEST: SETUP FAIL -- member % already has % saved', v_m, v_n;
  end if;

  -- The saves, as the owner (not paced; the trigger still checks the seat, the holding, the cap).
  insert into public.watchlist (league_id, user_id, symbol) values (v_league, v_m, v_s1), (v_league, v_m, v_s2);
  insert into public.watchlist (league_id, user_id, symbol) values (v_league, v_m2, v_s1);

  -- The buy.
  insert into public.trades (league_id, user_id, symbol, action, quantity, price, total_value)
  values (v_league, v_m::uuid, v_s1, 'buy', 1, 1, 1);

  -- a.
  if exists (select 1 from watchlist where league_id = v_league and user_id = v_m and symbol = v_s1) then
    v_fail := v_fail || ' a:bought-stock-still-saved';
  end if;
  if not exists (select 1 from watchlist where league_id = v_league and user_id = v_m and symbol = v_s2) then
    v_fail := v_fail || ' a:other-stock-removed';
  end if;
  if not exists (select 1 from watchlist where league_id = v_league and user_id = v_m2 and symbol = v_s1) then
    v_fail := v_fail || ' a:other-manager-copy-removed';
  end if;

  -- b and c, as M.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_m, true);
  v_res := public.set_watchlist(v_league, lower(v_s1), true);
  if v_res ->> 'reason' is distinct from 'held' then v_fail := v_fail || ' b:held-save-answered(' || v_res::text || ')'; end if;
  begin
    insert into public.watchlist (league_id, user_id, symbol) values (v_league, v_m, v_s1);
    v_fail := v_fail || ' b:held-direct-insert-accepted';
  exception when others then
    get stacked diagnostics v_msg = message_text, v_state = returned_sqlstate;
    if v_state <> 'PT409' or v_msg not like 'watchlist_held%' then
      v_fail := v_fail || ' b:wrong-refusal(' || v_state || ' ' || v_msg || ')';
    end if;
  end;
  if exists (select 1 from public.get_league_watchlist(v_league) r where r.symbol = v_s1) then
    v_fail := v_fail || ' c:reader-shows-held';
  end if;
  if not exists (select 1 from public.get_league_watchlist(v_league) r where r.symbol = v_s2) then
    v_fail := v_fail || ' c:reader-lost-free-stock';
  end if;

  -- d. A sell row removes the row (as the owner again).
  perform set_config('role', 'postgres', true);
  insert into public.trades (league_id, user_id, symbol, action, quantity, price, total_value)
  values (v_league, v_m::uuid, v_s2, 'sell', 1, 1, 1);
  if exists (select 1 from watchlist where league_id = v_league and user_id = v_m and symbol = v_s2) then
    v_fail := v_fail || ' d:sale-left-row';
  end if;

  if v_fail = '' then
    raise exception 'WATCHLIST HELD EFFECT TEST: PASS (league %, member % bought %, sold %; member % kept %) -- rolled back',
      v_league, v_m, v_s1, v_s2, v_m2, v_s1;
  end if;
  raise exception 'WATCHLIST HELD EFFECT TEST: FAIL --%', v_fail;
end $$;
