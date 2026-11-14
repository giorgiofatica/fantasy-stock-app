-- symbols: a signed-in player reads symbol, name and is_draftable only (S1).
--
-- docs/security/2026-11-13-brief-security-check.md S1 and
-- docs/audits/2026-11-13-market-data-dependency-audit.md 5a: 20261114000000
-- closed the anonymous read but granted SELECT on the WHOLE table to
-- authenticated with USING (true), so any signed-in account could page all
-- ~14,750 rows of last_price, last_price_at, market_cap and gics_industry
-- through /rest/v1/symbols, around the per-user limits on quote,
-- ticker-quotes, historical-bars and symbols-search. Giorgio, 2026-10-08:
-- "I don't want people to be able to scrape anything". The live ACL was
-- authenticated=rm (db-snapshot 2026-11-11): the old revoke list also missed
-- MAINTAIN (m, Postgres 17).
--
-- PRECONDITION (ORDER MATTERS): the mobile build that calls the two functions
-- below (count_slot_matches / symbols_enrichment_progress in categoryData.ts,
-- get_league_pick_industries in useSymbolCategories.ts) must be on every phone
-- that will be used BEFORE this is pushed. An older build reads last_price,
-- gics_industry, active and enriched_at directly; after this push those reads
-- are refused (42501): SlotBuilder's availability check shows its "couldn't
-- check" line and the draft board draws no category lines. Nothing else
-- breaks: names, search and the ledger read only granted columns.
--
-- WHAT IT DOES
--   1. REVOKE ALL on the table from PUBLIC, anon and authenticated. ALL is
--      every table privilege the server knows, so on prod (17.4) it includes
--      MAINTAIN; TRUNCATE, REFERENCES and TRIGGER go too. Revoking a table
--      privilege also revokes it on every column, so a re-run first clears any
--      column grant made since (the migration is idempotent).
--   2. GRANT SELECT (symbol, name, is_draftable) to authenticated. Those are
--      the only columns a caller-scoped reader uses:
--        symbols-search (caller's JWT)  symbol, name, is_draftable
--        symbol-name    (caller's JWT)  symbol, name
--        get_portfolio_ledger (INVOKER) symbol, name
--        mobile useQueueQuotes          symbol, name, .in() bounded
--      A column grant is an ALLOW list: a column added later is unreadable by
--      clients until a migration grants it. PostgREST select=* is refused
--      (42501) under column grants; no client uses *.
--   3. count_slot_matches(min, max, category) and symbols_enrichment_progress():
--      SlotBuilder's availability check filtered on last_price and
--      gics_industry and counted active / enriched_at rows directly. Filtering
--      needs SELECT on the column, and a filter IS a read (bisect
--      last_price=gte.X on one symbol and you have its price), so those two
--      columns cannot be granted for filtering only. The functions return
--      counts, never rows. count_slot_matches is rate-limited per user (a
--      narrow category plus a price band is still a weak price oracle);
--      symbols_enrichment_progress returns two table-wide totals and is not.
--   4. get_league_pick_industries(league): the draft board's category lines
--      need gics_industry for the stocks already picked in that league. Member
--      of the league only (42501 otherwise), and only for symbols drafted in
--      it, so it cannot be paged across the table.
--
-- Service_role readers (refresh-symbols, enrich-symbols, draft-write,
-- record-trade, validate-and-record-pick, category-eligibility, auto-pick) use
-- the secret key and are unaffected; so are the SECURITY DEFINER readers
-- (set_draft_queue, prune_drafted_symbol_from_queues) and the service_role-only
-- functions (draft_feasibility_pool, auto_pick_search_candidates,
-- record_live_prices).
--
-- POST-PUSH CHECKS: docs/security/2026-11-13-symbols-column-grant-checks.sql.

-- 1 ---------------------------------------------------------------------------
revoke all on table public.symbols from public, anon, authenticated;

-- 2 ---------------------------------------------------------------------------
grant select (symbol, name, is_draftable) on table public.symbols to authenticated;

-- 3 ---------------------------------------------------------------------------
-- The same overrides-replace-rule count categoryData.countSlotMatches made on
-- the client: draftable, inside the price band (a bound left NULL is open; a
-- NULL last_price fails any bound), and for a category either an override to
-- it, or no override at all and an industry whose rule maps to it.
create or replace function public.count_slot_matches(
  p_price_min numeric,
  p_price_max numeric,
  p_category_id uuid
) returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_minute_ok boolean;
  v_hour_ok boolean;
  v_n integer;
begin
  if v_uid is null then
    raise exception 'count_slot_matches: not authenticated' using errcode = '42501';
  end if;

  -- One availability check is 1 + (number of slots) calls; 120 a minute is many
  -- checks. Both windows are bumped on every call (check_usernames' pattern).
  v_minute_ok := public.check_and_bump_rate_limit('count-slot-matches', 'user:' || v_uid::text, 120, 60);
  v_hour_ok := public.check_and_bump_rate_limit('count-slot-matches-hour', 'user:' || v_uid::text, 1200, 3600);
  if v_minute_ok is not true or v_hour_ok is not true then
    raise exception 'count_slot_matches: rate limited' using errcode = 'PT429';
  end if;

  select count(*)::integer
    into v_n
    from public.symbols s
   where s.is_draftable = true
     and (p_price_min is null or s.last_price >= p_price_min)
     and (p_price_max is null or s.last_price <= p_price_max)
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
         );
  return v_n;
end;
$$;

create or replace function public.symbols_enrichment_progress()
returns table (enriched integer, total integer)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'symbols_enrichment_progress: not authenticated' using errcode = '42501';
  end if;
  return query
    select (count(*) filter (where s.enriched_at is not null))::integer,
           count(*)::integer
      from public.symbols s
     where s.active = true;
end;
$$;

-- 4 ---------------------------------------------------------------------------
-- Every symbol drafted in the league, with its industry (NULL when the symbol
-- has no row or no industry: the client falls back to Misc, as it did when it
-- read symbols directly).
create or replace function public.get_league_pick_industries(p_league_id uuid)
returns table (symbol text, gics_industry text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or p_league_id is null or not public.is_member(p_league_id) then
    raise exception 'get_league_pick_industries: not a member of this league' using errcode = '42501';
  end if;
  return query
    select p.symbol, s.gics_industry
      from (select distinct upper(d.symbol) as symbol
              from public.drafts d
             where d.league_id = p_league_id and d.symbol is not null) p
      left join public.symbols s on s.symbol = p.symbol
     order by p.symbol;
end;
$$;

-- CLAUDE.md "Postgres function grants": REVOKE FROM PUBLIC leaves Supabase's
-- explicit anon / authenticated / service_role grants, so each is named.
revoke all on function public.count_slot_matches(numeric, numeric, uuid) from public, anon, authenticated, service_role;
revoke all on function public.symbols_enrichment_progress() from public, anon, authenticated, service_role;
revoke all on function public.get_league_pick_industries(uuid) from public, anon, authenticated, service_role;
grant execute on function public.count_slot_matches(numeric, numeric, uuid) to authenticated;
grant execute on function public.symbols_enrichment_progress() to authenticated;
grant execute on function public.get_league_pick_industries(uuid) to authenticated;
