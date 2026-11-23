-- Top movers, server (docs/plans/2026-11-18-stocks-tab.md, Part 3, "Top movers: how it
-- works"; workstream 4; the plan approved by Giorgio 2026-11-22: "Yeah, that plan looks
-- good. Let's implement it."). Approving the plan is not approval of this push.
--
-- WHAT THIS FILE ADDS
--   1. public.top_movers: the current ranking. Up to the 100 biggest moves today, up OR
--      down, ordered by the size of the move, each row carrying the time of the ranking.
--   2. public.replace_top_movers(...): the ONLY write. service_role only (the
--      rank-top-movers edge function). Replaces the whole ranking in one statement, or
--      changes nothing.
--   3. public.get_league_top_movers(league): the read behind the "Top movers" chip, for
--      signed-in league MEMBERS. Ordered symbols with name and category, never a price,
--      minus every stock anyone in that league holds, at most 25 rows.
--   The schedule is the next file (20261210000001).
--
-- THE RANKING IS WRITTEN WHOLE OR NOT AT ALL (the plan; CLAUDE.md, "all-or-nothing", and
-- "the scope of the verdict must match the scope of the evidence"). A ranking drawn from a
-- subset of the market is never published as the market's. Three layers, each sufficient
-- on its own for its part:
--   - the edge function writes only when every snapshot batch succeeded AND at least 90%
--     of the set came back with a fresh trade (rank-top-movers/rank.ts decideRanking);
--   - replace_top_movers REFUSES (22023) a call whose own numbers fail that gate:
--     fresh_count * 10 >= set_size * 9, and exactly least(100, fresh_count) rows, so a
--     truncated or padded ranking cannot be written by any caller;
--   - the CHECKs on the table hold the same gate on every row, whatever writes it.
--   The DELETE and the INSERT run inside one function call, so a reader sees the old
--   ranking or the new one, never a mix and never an empty table between them.
--
-- A LATE RUN CANNOT REPLACE A NEWER RANKING. The write takes an EXCLUSIVE lock on the
--   table (readers are not blocked: EXCLUSIVE conflicts only with writers and with other
--   EXCLUSIVE holders) and keeps the existing ranking when its ranked_at is the same or
--   newer ({"written":false,"reason":"newer_ranking_exists"}). Runs are 5 minutes apart
--   and take seconds, so this is a guard, not a path anyone expects to take.
--
-- WHAT IS STORED, AND WHAT IS NEVER READ BACK. symbol, change_pct (today's move in
--   percent, for the by-data check), ranked_at, and the run's set_size / fresh_count (so
--   the check can see the gate's evidence). No price is stored. Nothing here is readable
--   by a client: RLS is on with NO policy, and every table privilege is revoked from
--   public, anon and authenticated BY NAME (Supabase's default privileges grant ALL on a
--   new table to anon and authenticated, CLAUDE.md). The reader never returns change_pct:
--   each row in the app takes its price and "+11.2% today" from the live lookup, so the
--   order may be minutes old and the numbers are current (the plan).
--
-- NO FOREIGN KEY TO symbols, on purpose: an ON DELETE action would edit the ranking one
--   row at a time, which is exactly the partial state this table exists to prevent. The
--   reader joins symbols and drops a row whose stock is gone or no longer listable.
--
-- THE READ (get_league_top_movers), on the pattern of get_league_available_stocks
--   (20261207000100), because the "Top movers" chip sits under Available and must agree
--   with it:
--     member-only  auth.uid() and is_member, checked inside; anyone else is REFUSED
--                  (42501), never handed an empty list that reads as "no movers". As for
--                  the Available list, a HIDDEN seat (left after the season) still reads:
--                  is_member counts every league_members row (the PGlite test pins it). A
--                  deleted account has no session, so it never reaches here;
--     same pool    draftable stocks with a stored price (the Available list's pool), and
--                  NOBODY in the league holds it: the net of draft picks and trades, PER
--                  MANAGER and per stock, > 1e-9 (the rule leagueOwnedSymbols and the buy
--                  path's symbol_owned use; a stock bought and fully sold is listed again);
--     capped       at most 25 rows, biggest move first (up or down);
--     minimal      place, symbol, name, category_ids, ranked_at. NO price, NO
--                  change_pct, NO market_cap, and NOT the stock's place in the whole
--                  ranking: place is 1..n within THIS reply (the security review,
--                  2026-11-23), so a reply carries no trace of what was left out or why.
--                  ranked_at lets the app apply the plan's 20-minute rule (an older
--                  ranking while the market is open shows the "didn't load" state).
--                  The order of the 100 is not secret (a member who buys the leaders in a
--                  league of their own sees the next 25), and the limiter bounds the reads;
--     paced        per person, across all their leagues, with the existing limiter and the
--                  stocks list's budget: 20 a minute, 120 an hour, 600 a day (PT429 past
--                  any). The app treats a refusal like any read that did not load.
--   An empty ranking (before the first run) returns no rows, as does a league that holds
--   every ranked stock; both are documented for the app workstream.
--
-- CATEGORY: each row's category_ids by the server's existing rule, the same expression as
--   get_league_available_stocks (curated overrides REPLACE the industry rule; with none,
--   the industry's rule; with neither, an empty array, the client's Misc).
--
-- GRANTS (CLAUDE.md, "Postgres function grants"): both functions SECURITY DEFINER with
--   search_path pinned; EXECUTE revoked BY NAME from public, anon, authenticated and
--   service_role; then the reader granted to authenticated ONLY and the writer to
--   service_role ONLY. Verify with proacl (docs/security/2026-12-10-top-movers-checks.sql),
--   never assume.
--
-- The word that breaks the CLI's statement splitter (CLAUDE.md) appears nowhere in this file.

-- 1. The ranking ---------------------------------------------------------------------------
create table public.top_movers (
  rank        smallint    primary key,
  symbol      text        not null,
  change_pct  numeric     not null,
  ranked_at   timestamptz not null,
  set_size    integer     not null,
  fresh_count integer     not null,
  constraint top_movers_symbol_key unique (symbol),
  constraint top_movers_rank_range check (rank between 1 and 100),
  -- Stored exactly as public.symbols spells it (the reader joins on equality); only a
  -- blank one is refused, so no spelling in symbols can fail a whole ranking.
  constraint top_movers_symbol_shape check (btrim(symbol) <> ''),
  constraint top_movers_gate check (
    set_size > 0
    and fresh_count between 1 and set_size
    and fresh_count::bigint * 10 >= set_size::bigint * 9
  )
);

comment on table public.top_movers is
  'Today''s top movers: up to the 100 biggest moves (up or down) among the 500 largest '
  'draftable priced stocks, replaced WHOLE by replace_top_movers every 5 minutes while the '
  'market is open, or left as it was. Not client-readable; the app reads '
  'get_league_top_movers. See 20261210000000_top_movers.sql.';
comment on column public.top_movers.change_pct is
  'Today''s move in percent (latest trade against the previous session''s close), for the '
  'by-data check only. Never returned to the app.';
comment on column public.top_movers.fresh_count is
  'How many of the set_size stocks came back with a trade no older than 15 minutes in the '
  'run that wrote this ranking. At least 90% by constraint.';

alter table public.top_movers enable row level security;
-- No policy: RLS denies every client row. The ACL says the same on its own.
revoke all on table public.top_movers from public, anon, authenticated;

-- 2. The write -----------------------------------------------------------------------------
create or replace function public.replace_top_movers(
  p_ranked_at timestamptz,
  p_set_size integer,
  p_fresh_count integer,
  p_symbols text[],
  p_change_pcts numeric[]
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer := coalesce(cardinality(p_symbols), 0);
  v_latest timestamptz;
  v_bad integer;
begin
  if p_ranked_at is null or p_set_size is null or p_fresh_count is null
     or p_symbols is null or p_change_pcts is null then
    raise exception 'replace_top_movers: null argument' using errcode = '22023';
  end if;
  if p_ranked_at > now() + interval '1 minute' then
    -- A future time would make every later, honest run look older and be kept out.
    raise exception 'replace_top_movers: ranked_at is in the future' using errcode = '22023';
  end if;
  if p_set_size < 1 or p_fresh_count < 1 or p_fresh_count > p_set_size then
    raise exception 'replace_top_movers: bad counts (set %, fresh %)', p_set_size, p_fresh_count
      using errcode = '22023';
  end if;
  -- The 90% gate, in integers (no float edge at exactly 90%).
  if p_fresh_count::bigint * 10 < p_set_size::bigint * 9 then
    raise exception 'replace_top_movers: below the 90%% fresh gate (set %, fresh %)', p_set_size, p_fresh_count
      using errcode = '22023';
  end if;
  -- The ranking is the top of EVERY fresh stock: exactly min(100, fresh) rows.
  if v_n <> least(100, p_fresh_count) or cardinality(p_change_pcts) is distinct from v_n then
    raise exception 'replace_top_movers: % symbols and % changes for % fresh stocks',
      v_n, cardinality(p_change_pcts), p_fresh_count using errcode = '22023';
  end if;
  select count(*) into v_bad
    from unnest(p_symbols, p_change_pcts) as x(s, c)
   where x.s is null or x.c is null or btrim(x.s) = '';
  if v_bad > 0 then
    raise exception 'replace_top_movers: % null or blank entries', v_bad using errcode = '22023';
  end if;
  if (select count(distinct x.s) from unnest(p_symbols) as x(s)) <> v_n then
    raise exception 'replace_top_movers: duplicate symbols' using errcode = '22023';
  end if;
  -- Biggest move first: each |change| is no larger than the one before it.
  select count(*) into v_bad
    from (select abs(x.c) as a, lag(abs(x.c)) over (order by x.o) as prev
            from unnest(p_change_pcts) with ordinality as x(c, o)) y
   where y.prev is not null and y.a > y.prev;
  if v_bad > 0 then
    raise exception 'replace_top_movers: not ordered by the size of the move' using errcode = '22023';
  end if;

  -- One writer at a time; readers are not blocked.
  lock table public.top_movers in exclusive mode;
  select max(t.ranked_at) into v_latest from public.top_movers t;
  if v_latest is not null and v_latest >= p_ranked_at then
    return jsonb_build_object('written', false, 'reason', 'newer_ranking_exists', 'ranked_at', v_latest);
  end if;

  -- WHERE true: an unqualified DELETE is refused under pg-safeupdate.
  delete from public.top_movers where true;
  insert into public.top_movers (rank, symbol, change_pct, ranked_at, set_size, fresh_count)
  select x.o::smallint, x.s, x.c, p_ranked_at, p_set_size, p_fresh_count
    from unnest(p_symbols, p_change_pcts) with ordinality as x(s, c, o);

  return jsonb_build_object('written', true, 'rows', v_n, 'ranked_at', p_ranked_at);
end;
$$;

-- 3. The read ------------------------------------------------------------------------------
create or replace function public.get_league_top_movers(p_league_id uuid)
returns table (
  place integer,
  symbol text,
  name text,
  category_ids uuid[],
  ranked_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_minute_ok boolean;
  v_hour_ok boolean;
  v_day_ok boolean;
begin
  if v_uid is null then
    raise exception 'get_league_top_movers: not authenticated' using errcode = '42501';
  end if;
  if p_league_id is null or not public.is_member(p_league_id) then
    raise exception 'get_league_top_movers: not a member of this league' using errcode = '42501';
  end if;

  -- Three windows, ALL bumped on every call (separate statements, so none is
  -- short-circuited away); any one over its limit refuses.
  v_minute_ok := public.check_and_bump_rate_limit('top-movers-min', 'user:' || v_uid::text, 20, 60);
  v_hour_ok := public.check_and_bump_rate_limit('top-movers-hour', 'user:' || v_uid::text, 120, 3600);
  v_day_ok := public.check_and_bump_rate_limit('top-movers-day', 'user:' || v_uid::text, 600, 86400);
  if v_minute_ok is not true or v_hour_ok is not true or v_day_ok is not true then
    raise exception 'get_league_top_movers: rate limited' using errcode = 'PT429';
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
      select m.rank as rk, s.symbol as sym, s.name as nm, s.gics_industry as ind, m.ranked_at as at
        from public.top_movers m
        join public.symbols s on s.symbol = m.symbol
       where s.is_draftable = true
         and s.last_price is not null
         and not exists (select 1 from held where held.sym = upper(s.symbol))
       order by m.rank
       limit 25
    )
    select (row_number() over (order by p.rk))::integer, p.sym, p.nm,
           coalesce(
             (select array_agg(o.category_id order by c.display_order, o.category_id)
                from public.symbol_category_overrides o
                left join public.categories c on c.id = o.category_id
               where o.symbol = p.sym),
             (select array[r.category_id] from public.category_rules r where r.gics_industry = p.ind),
             '{}'::uuid[]),
           p.at
      from page p
     order by p.rk;
end;
$$;

-- 4. Grants (CLAUDE.md: REVOKE FROM PUBLIC leaves Supabase's explicit per-role grants) -----
revoke all on function public.replace_top_movers(timestamptz, integer, integer, text[], numeric[])
  from public, anon, authenticated, service_role;
grant execute on function public.replace_top_movers(timestamptz, integer, integer, text[], numeric[])
  to service_role;

revoke all on function public.get_league_top_movers(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_league_top_movers(uuid) to authenticated;
