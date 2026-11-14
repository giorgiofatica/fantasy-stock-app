-- symbols readers, EXPAND (S1 stage 1 of 2): the three functions the new
-- clients call instead of reading symbols' price and industry columns directly.
--
-- docs/security/2026-11-13-brief-security-check.md S1 and
-- docs/audits/2026-11-13-market-data-dependency-audit.md 5a: 20261114000000
-- granted SELECT on the WHOLE symbols table to authenticated with USING (true),
-- so any signed-in account can page last_price, last_price_at, market_cap and
-- gics_industry for all ~14,750 rows. Giorgio, 2026-10-08: "I don't want people
-- to be able to scrape anything". The lockdown is split in two, because a build
-- that reads those columns directly breaks the moment they are revoked, and a
-- build that calls these functions breaks while they do not exist:
--
--   EXPAND   (this file) creates the functions and changes no existing
--            privilege, so it is safe under EVERY build: build 14 keeps reading
--            symbols directly, build 15 gets its functions. It can go in the
--            next normal db push.
--   CONTRACT supabase/migrations/deferred/20261205000400_symbols_column_grant.sql
--            revokes the table and grants symbol, name, is_draftable only. HELD
--            until a build that calls these functions is on every phone in use
--            (precondition in supabase/migrations/deferred/README.md).
--
-- WHAT IT DOES
--   1. count_slot_matches(min, max, category) and symbols_enrichment_progress():
--      SlotBuilder's availability check filtered on last_price and
--      gics_industry and counted active / enriched_at rows directly. Filtering
--      needs SELECT on the column, and a filter IS a read (bisect
--      last_price=gte.X on one symbol and you have its price), so after
--      CONTRACT those columns cannot be granted "for filtering only". The
--      functions return counts, never rows. count_slot_matches is rate-limited
--      per user (a narrow category plus a price band is still a weak price
--      oracle); symbols_enrichment_progress returns two table-wide totals and
--      is not.
--   2. get_league_pick_industries(league): the draft board's category lines
--      need gics_industry for the stocks already picked in that league. Member
--      of the league only (42501 otherwise), and only for symbols drafted in
--      it, so it cannot be paged across the table.
--   All three are SECURITY DEFINER with search_path pinned, and only
--   authenticated may EXECUTE them (PUBLIC, anon and service_role revoked by
--   name).
--
-- POST-PUSH CHECKS: docs/security/2026-11-13-symbols-column-grant-checks.sql,
-- PART A. Part B runs after CONTRACT.

-- 1 ---------------------------------------------------------------------------
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

-- 2 ---------------------------------------------------------------------------
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
