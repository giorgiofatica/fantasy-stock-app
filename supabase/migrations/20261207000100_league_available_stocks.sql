-- The Stocks tab, part 1: the one server read behind its list
-- (docs/plans/2026-11-18-stocks-tab.md, approved by Giorgio 2026-11-18, "part 1 approved").
--
-- WHAT IT IS
--   get_league_available_stocks(league, category, after_symbol, limit) returns one page
--   of the stocks a manager can get in that league: draftable stocks with a stored
--   price that NOBODY in the league currently holds, largest company first.
--
-- WHY A FUNCTION, AND WHY IT IS NARROW
--   The 2026-11-16 lockdown (20261206000000) left authenticated with SELECT on
--   symbols(symbol, name, is_draftable) only, because Giorgio "doesn't want people to be
--   able to scrape anything" (2026-10-08). The plan re-opens the stored price, on purpose
--   and narrowly (decision 6), so this function is the ONLY new path and it is:
--     member-only  auth.uid() and is_member, checked inside; anyone else is REFUSED
--                  (42501), never handed an empty list that reads as "no stocks";
--     capped       at most 25 rows a call whatever is asked, plus a has_more flag from
--                  fetching one extra row; no total count (it would size what has not
--                  been paged);
--     paced        per person, across all their leagues, with the existing limiter:
--                  20 a minute, 120 an hour, 600 a day (PT429 past any). The daily
--                  counter row ('stocks-list-day', 'user:<uid>') is the record of who
--                  read how much; purge_rate_limit_counters keeps it two days;
--     minimal      six columns: symbol, name, last_price, last_price_at, category_ids,
--                  has_more. market_cap ORDERS the list and is never returned, nor is
--                  gics_industry or anything else from the table.
--   No privilege on symbols changes here (the PGlite test pins the column grant).
--
-- WHO "HOLDS" A STOCK (CLAUDE.md, the all-or-nothing family): the net of draft picks and
--   trades, PER MANAGER and per stock, > 0. Never "does any row exist": a stock bought
--   and then fully sold is listed again. It is the same rule as leagueOwnedSymbols
--   (supabase/functions/_shared/draft-validation.ts), which the buy path refuses with
--   symbol_owned: upper-cased symbols, SKIP picks ignored, a sell subtracts and anything
--   else adds, and the same 1e-9 threshold so the list and the buy path agree on a
--   fractional residue. drafts.user_id is text and trades.user_id is uuid, and the
--   quantity types differ, hence the ::text / ::numeric casts (CLAUDE.md).
--
-- CATEGORY (optional filter, and each row's category_ids): the server's existing rule
--   (_shared/category-eligibility.ts, DR-001): a symbol's curated overrides REPLACE its
--   industry rule; with none, its industry's rule; with neither, unclassified (an empty
--   array, the client's Misc). The filter is the same predicate count_slot_matches
--   (20261205000300) already uses in SQL, so no rule is duplicated outside SQL. A
--   symbol may carry up to three overrides (enforce_symbol_category_cap), so a row
--   carries an ARRAY, ordered by categories.display_order.
--
-- ORDER AND PAGING: market_cap desc, no size last, then the ticker (collate "C", so the
--   order is the same everywhere). Keyset, by position: p_after_symbol is the LAST
--   ticker of the previous page and the server looks its size up itself, so the size
--   never travels to the client. No page numbers. A cursor that is not a listable stock
--   (unknown, not draftable, or unpriced) is refused (22023), so it cannot rank a stock the
--   list never shows; an owned one is accepted (it may have been bought between pages). Sizes refresh in the background, so a stock can move between pages; the
--   app drops repeats by ticker (the plan's "order shifting between pages").
--
-- ORDER OF CHECKS: signed in -> member -> limiter -> cursor. A refusal raises, and a
--   raise rolls back the statement, including that call's counter bumps: the counters
--   record the pages actually served (and the call that crossed a limit is not added).
--
-- GRANTS (CLAUDE.md, "Postgres function grants"): SECURITY DEFINER, search_path pinned;
--   EXECUTE revoked BY NAME from public, anon, authenticated and service_role, then
--   granted to authenticated only. Verify with proacl, never assume.
--
-- POST-PUSH CHECK (SQL editor, read-only; the HUMAN ACTION in the hand-off has it with
-- real ids):
--   SELECT proname, prosecdef, proconfig, proacl FROM pg_proc p
--     JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND proname = 'get_league_available_stocks';
--   -- EXPECT prosecdef t, proconfig {"search_path=public, pg_temp"},
--   --        proacl {postgres=X/postgres,authenticated=X/postgres}

create or replace function public.get_league_available_stocks(
  p_league_id uuid,
  p_category_id uuid default null,
  p_after_symbol text default null,
  p_limit integer default 25
) returns table (
  symbol text,
  name text,
  last_price numeric,
  last_price_at timestamptz,
  category_ids uuid[],
  has_more boolean
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 25);
  v_minute_ok boolean;
  v_hour_ok boolean;
  v_day_ok boolean;
  v_after text := nullif(upper(btrim(p_after_symbol)), '');
  v_after_cap numeric;
begin
  if v_uid is null then
    raise exception 'get_league_available_stocks: not authenticated' using errcode = '42501';
  end if;
  if p_league_id is null or not public.is_member(p_league_id) then
    raise exception 'get_league_available_stocks: not a member of this league' using errcode = '42501';
  end if;

  -- Three windows, ALL bumped on every call (separate statements, so none is
  -- short-circuited away); any one over its limit refuses.
  v_minute_ok := public.check_and_bump_rate_limit('stocks-list-min', 'user:' || v_uid::text, 20, 60);
  v_hour_ok := public.check_and_bump_rate_limit('stocks-list-hour', 'user:' || v_uid::text, 120, 3600);
  v_day_ok := public.check_and_bump_rate_limit('stocks-list-day', 'user:' || v_uid::text, 600, 86400);
  if v_minute_ok is not true or v_hour_ok is not true or v_day_ok is not true then
    raise exception 'get_league_available_stocks: rate limited' using errcode = 'PT429';
  end if;

  if v_after is not null then
    -- Only a stock that CAN be listed (draftable, priced) is a cursor, so the cursor
    -- cannot rank a stock the list never shows. Owned is allowed: the cursor stock may
    -- have been bought between pages.
    select s.market_cap into v_after_cap
      from public.symbols s
     where s.symbol = v_after and s.is_draftable = true and s.last_price is not null;
    if not found then
      raise exception 'get_league_available_stocks: unknown cursor' using errcode = '22023';
    end if;
  end if;

  return query
    with held as (
      -- Per manager, per stock: draft quantity + buys - sells. Kept only where > 0.
      select h.sym
        from (
          select upper(d.symbol) as sym, d.user_id::text as uid, coalesce(d.quantity, 0)::numeric as q
            from public.drafts d
           where d.league_id = p_league_id
             and d.symbol is not null
             and upper(d.symbol) <> 'SKIP'
          union all
          select upper(t.symbol), t.user_id::text,
                 case when t.action = 'sell' then -coalesce(t.quantity, 0)::numeric
                      else coalesce(t.quantity, 0)::numeric end
            from public.trades t
           where t.league_id = p_league_id
             and t.symbol is not null
        ) h
       group by h.sym, h.uid
      having sum(h.q) > 0.000000001
    ),
    page as (
      -- ind and mc stay inside the function: they order and classify, never returned.
      select s.symbol as sym, s.name as nm, s.last_price as px, s.last_price_at as px_at,
             s.gics_industry as ind, s.market_cap as mc
        from public.symbols s
       where s.is_draftable = true
         and s.last_price is not null
         and not exists (select 1 from held where held.sym = upper(s.symbol))
         and (
               p_category_id is null
            or exists (
                 select 1 from public.symbol_category_overrides o
                  where o.symbol = s.symbol and o.category_id = p_category_id)
            or (
                 not exists (
                   select 1 from public.symbol_category_overrides o where o.symbol = s.symbol)
                 and s.gics_industry in (
                   select r.gics_industry from public.category_rules r where r.category_id = p_category_id)
               )
             )
         and (
               v_after is null
            or (v_after_cap is not null and (
                     s.market_cap < v_after_cap
                  or (s.market_cap = v_after_cap and s.symbol collate "C" > v_after collate "C")
                  or s.market_cap is null))
            or (v_after_cap is null and s.market_cap is null and s.symbol collate "C" > v_after collate "C")
             )
       order by s.market_cap desc nulls last, s.symbol collate "C"
       limit v_limit + 1
    )
    select p.sym, p.nm, p.px, p.px_at,
           coalesce(
             (select array_agg(o.category_id order by c.display_order, o.category_id)
                from public.symbol_category_overrides o
                left join public.categories c on c.id = o.category_id
               where o.symbol = p.sym),
             (select array[r.category_id] from public.category_rules r where r.gics_industry = p.ind),
             '{}'::uuid[]),
           (select count(*) from page) > v_limit
      from page p
     order by p.mc desc nulls last, p.sym collate "C"
     limit v_limit;
end;
$$;

-- CLAUDE.md "Postgres function grants": REVOKE FROM PUBLIC leaves Supabase's explicit
-- anon / authenticated / service_role grants, so each is named.
revoke all on function public.get_league_available_stocks(uuid, uuid, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_league_available_stocks(uuid, uuid, text, integer) to authenticated;
