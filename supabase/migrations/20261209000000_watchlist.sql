-- The watchlist, server side (Stocks tab, part 3, workstream 2).
-- Plans: docs/plans/2026-10-08-trading-window-and-watchlist.md (approved 2026-10-09, "C and
-- approved"; "The watchlist is per league", "The watchlist is not a queue") as changed by
-- docs/plans/2026-11-18-stocks-tab.md part 3 (approved 2026-11-22, "Yeah, that plan looks
-- good. Let's implement it."): the read returns NO price; prices come from the live lookup.
--
-- WHAT IT ADDS
--   public.watchlist                 a manager's saved stocks, per league. Many managers may
--                                    save the same stock; a save reserves nothing.
--   public.set_watchlist(l, s, b)    the save / unsave write (the star). jsonb answer.
--   public.get_league_watchlist(l)   the reader: the caller's own saved stocks in a league,
--                                    with name, category and is_draftable. NO price.
--   public.watchlist_before_insert() the trigger that enforces the seat and the cap on EVERY
--                                    insert path (the RPC and a direct PostgREST insert).
--
-- THE TABLE
--   (league_id, user_id) references league_members ON DELETE CASCADE, so the rows go with the
--   membership (the plan: "cascade on leave before the draft"; a league's deletion cascades
--   through league_members). After the season a leaver is HIDDEN, not deleted: the rows stay,
--   hidden with the league. ON UPDATE is NO ACTION on purpose: the only writer of
--   league_members.user_id is take_over_team, on a deleted seat, and scrub_deleted_manager
--   (20261125000005) deletes the seat's watchlist rows in the same call that marks the seat
--   deleted, while the trigger below refuses a save into a deleted seat. So a deleted seat
--   has no rows to carry, and if that ever stops being true the takeover fails loudly rather
--   than handing a deleted person's saves to the new manager. take_over_team does not move
--   watchlist rows (it moves waiver_order and claims): a watchlist is personal.
--   symbol references symbols ON DELETE CASCADE ("a saved symbol must exist in symbols").
--   user_id is text, like league_members.user_id: the scrub's and the takeover's dynamic SQL
--   (to_regclass('public.watchlist')) already expects it. Never a bot (the plan's CHECK).
--
-- THE 50 CAP, SAFE UNDER CONCURRENCY (CLAUDE.md, the partial-state family: count against the
--   cap per participant, never "is there any row")
--   1. STRUCTURAL: every row takes a cap_index in 1..50 (CHECK), unique per seat (UNIQUE
--      (league_id, user_id, cap_index)). A 51st row for a seat cannot exist under ANY
--      isolation level or interleaving: two writers that both counted 49 pick the same free
--      index and the second fails the unique index. cap_index is assigned by the trigger
--      (any value a client sends is overwritten) and is never returned by the reader.
--   2. SERIALISED: the trigger (and set_watchlist before it) takes the seat's league_members
--      row FOR NO KEY UPDATE, so two saves by one manager in one league queue rather than
--      collide: the second sees the first's row and gets "full" cleanly. NO KEY UPDATE, not
--      UPDATE, so it does not block the KEY SHARE locks other tables' foreign keys take on
--      the same row (this table's own seat foreign key among them). A leave or a takeover
--      (DELETE, or an UPDATE of the key) waits for the save, then cascades or re-checks.
--   A refused save writes nothing. Unsaving frees an index; the next save reuses the lowest.
--
-- RLS (the plan): authenticated may SELECT / INSERT / DELETE only rows where
--   user_id = auth.uid()::text AND is_member(league_id). No UPDATE (no grant, no policy).
--   No anon: ALL is revoked from public, anon and authenticated BY NAME first (Supabase's
--   default privileges grant ALL on a new table to anon and authenticated, CLAUDE.md), then
--   SELECT, INSERT, DELETE are granted to authenticated. A save also needs an ACTIVE seat
--   (not hidden, not deleted), checked by the trigger on every path; reading and removing
--   your own rows needs only is_member (the write's unsave, likewise, needs only the seat).
--   The trigger refuses a signed-in caller naming another person's seat FIRST, with RLS's own
--   refusal text: a BEFORE ROW trigger runs before the WITH CHECK, so without that gate its
--   seat / cap answers would describe someone else's seat to a prober.
--
-- PACING (the security review, 2026-11-22): the reader returns category_ids, which resolve
--   from symbols.gics_industry, a column the column grant hides. Saving any stock, reading
--   it back and unsaving it would disclose any stock's category, including held and
--   non-draftable ones the paced Stocks list never returns. So NEW saves are paced in the
--   trigger (every insert path), per signed-in person across all their leagues, with the
--   existing limiter: 30 a minute, 200 an hour, 500 a day (PT429; the write answers
--   'rate_limited'). A re-save, an unsave and the reader are not paced: none discloses a
--   stock the caller has not already saved. purge_rate_limit_counters keeps two days.
--   Every new row counts, so one direct insert of more than 30 rows fails whole (PT429);
--   the app saves one star at a time through the write.
--
-- THE READER returns symbol, name, category_ids, is_draftable and saved_at. NO price (Giorgio,
--   2026-11-18: "we can't be showing a stock price that is a day old"; part 3: each row takes
--   its price and today's change from the live lookup), and no market_cap, gics_industry,
--   last_price or anything else from symbols. category_ids is the server's own resolution
--   (DR-001, _shared/category-eligibility.ts), written as get_league_available_stocks
--   (20261207000100) writes it. is_draftable is a column authenticated can already read
--   (20261206000000); the October plan's read joined it for the "No longer tradable" line.
--   Refusals raise 42501 (not signed in; not a member), as the Stocks list read does, so
--   "you may not" is never an empty list that reads as "nothing saved".
--   Not paced itself: it returns only the caller's own rows, at most 50, and what it can
--   disclose is bounded by the paced saves (see PACING).
--
-- THE WRITE, set_watchlist(league, symbol, saved) -> jsonb, in set_draft_queue's style:
--   {ok:true, saved:true|false, count:n}   n = the caller's saved stocks in that league now
--   {ok:false, reason:'not_authenticated'}
--   {ok:false, reason:'not_a_member'}      not a member; or a SAVE from a hidden / deleted seat
--   {ok:false, reason:'invalid'}           saved is null
--   {ok:false, reason:'unknown_symbol'}    a save of a symbol not in symbols (or not 1-12 chars)
--   {ok:false, reason:'watchlist_full', max:50}   (the plan's refusal name)
--   {ok:false, reason:'rate_limited'}      past a pacing window (see PACING)
--   A direct insert past 50 raises 23514 with a message starting 'watchlist_full' (the
--   shape and bot CHECKs share that SQLSTATE: match the message, or use the write).
--   Saving a saved stock and unsaving an unsaved one are no-ops that answer ok.
--
-- GRANTS (CLAUDE.md, "Postgres function grants"): every function SECURITY DEFINER with
--   search_path pinned; EXECUTE revoked BY NAME from public, anon, authenticated and
--   service_role; set_watchlist and get_league_watchlist then granted to authenticated
--   only (both key on auth.uid(), so service_role has no use for them); the trigger
--   function to no one (a trigger runs without its caller holding EXECUTE).
--
-- POST-PUSH CHECKS: docs/security/2026-11-22-watchlist-checks.sql (read-only; its effect
--   block always ends in RAISE, so it rolls back). supabase/tests/watchlist.pglite.test.ts
--   runs it on the full chain.

-- 1. The table -------------------------------------------------------------------------
create table public.watchlist (
  league_id  uuid        not null,
  user_id    text        not null,
  symbol     text        not null,
  cap_index  smallint    not null,
  created_at timestamptz not null default now(),
  constraint watchlist_pkey primary key (league_id, user_id, symbol),
  constraint watchlist_cap_index_key unique (league_id, user_id, cap_index),
  constraint watchlist_cap_index_range check (cap_index between 1 and 50),
  constraint watchlist_symbol_shape check (symbol = upper(symbol) and length(symbol) between 1 and 12),
  constraint watchlist_not_bot check (user_id !~ '^bot-'),
  constraint watchlist_seat_fkey foreign key (league_id, user_id)
    references public.league_members (league_id, user_id) on delete cascade,
  constraint watchlist_symbol_fkey foreign key (symbol)
    references public.symbols (symbol) on delete cascade
);

comment on table public.watchlist is
  'A manager''s saved stocks, per league (the star). At most 50 per seat, enforced by cap_index. Reserves nothing. Read through get_league_watchlist; written through set_watchlist.';
comment on column public.watchlist.cap_index is
  'Which of the seat''s 50 places this row holds (1..50, unique per seat). Assigned by watchlist_before_insert; makes a 51st row impossible. Not an order; never shown.';

-- 2. The trigger: seat + cap on every insert path ----------------------------------------
create or replace function public.watchlist_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_hidden  timestamptz;
  v_deleted timestamptz;
  v_free    smallint;
  v_min_ok  boolean;
  v_hour_ok boolean;
  v_day_ok  boolean;
begin
  -- BEFORE ROW triggers run BEFORE the RLS WITH CHECK, and this one runs as the owner, so a
  -- signed-in caller naming SOMEONE ELSE's seat is refused here first, with the RLS refusal's
  -- own text, before any lookup or lock: otherwise the different refusals below would tell a
  -- prober whether that seat exists, is active or is full, and the caller would take a lock
  -- on another person's league_members row. (Owner / service paths have no auth.uid().)
  if v_uid is not null and new.user_id is distinct from v_uid::text then
    raise exception 'new row violates row-level security policy for table "watchlist"' using errcode = '42501';
  end if;

  -- Serialise this seat's writers (see the header). Re-entrant within one transaction.
  select m.hidden_at, m.deleted_at into v_hidden, v_deleted
    from public.league_members m
   where m.league_id = new.league_id and m.user_id = new.user_id
     for no key update;
  if not found then
    raise exception 'watchlist: not a member of this league' using errcode = '42501';
  end if;
  if v_hidden is not null or v_deleted is not null then
    raise exception 'watchlist: this seat is no longer active' using errcode = '42501';
  end if;

  -- The lowest free place, counted against THIS seat's rows (rows inserted earlier in the
  -- same statement are visible here, so a multi-row insert is counted row by row).
  select min(g)::smallint into v_free
    from generate_series(1, 50) as g
   where not exists (select 1 from public.watchlist w
                      where w.league_id = new.league_id and w.user_id = new.user_id
                        and w.cap_index = g);
  if v_free is null then
    raise exception 'watchlist_full: at most 50 saved stocks per league' using errcode = '23514';
  end if;

  -- Pace NEW saves per signed-in person, across all their leagues (see the header: each save
  -- can disclose one stock's category through the reader). Every window is bumped, as
  -- separate statements; any one over its limit refuses. A refusal raises, so the call that
  -- crossed a limit adds nothing to the counters.
  if v_uid is not null then
    v_min_ok := public.check_and_bump_rate_limit('watchlist-save-min', 'user:' || v_uid::text, 30, 60);
    v_hour_ok := public.check_and_bump_rate_limit('watchlist-save-hour', 'user:' || v_uid::text, 200, 3600);
    v_day_ok := public.check_and_bump_rate_limit('watchlist-save-day', 'user:' || v_uid::text, 500, 86400);
    if v_min_ok is not true or v_hour_ok is not true or v_day_ok is not true then
      raise exception 'watchlist: rate limited' using errcode = 'PT429';
    end if;
  end if;

  new.cap_index := v_free;
  new.created_at := now();
  return new;
end;
$$;

create trigger trg_watchlist_before_insert
  before insert on public.watchlist
  for each row execute function public.watchlist_before_insert();

-- 3. RLS --------------------------------------------------------------------------------
alter table public.watchlist enable row level security;

create policy watchlist_select_own on public.watchlist
  for select to authenticated
  using (user_id = auth.uid()::text and public.is_member(league_id));

create policy watchlist_insert_own on public.watchlist
  for insert to authenticated
  with check (user_id = auth.uid()::text and public.is_member(league_id));

create policy watchlist_delete_own on public.watchlist
  for delete to authenticated
  using (user_id = auth.uid()::text and public.is_member(league_id));

revoke all on table public.watchlist from public, anon, authenticated;
grant select, insert, delete on table public.watchlist to authenticated;

-- 4. The write: save / unsave -------------------------------------------------------------
create or replace function public.set_watchlist(
  p_league_id uuid,
  p_symbol    text,
  p_saved     boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     text := auth.uid()::text;
  v_sym     text := upper(btrim(coalesce(p_symbol, '')));
  v_hidden  timestamptz;
  v_deleted timestamptz;
  v_count   integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  if p_league_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_a_member');
  end if;

  -- The same seat lock the trigger takes: this call and any other write for the seat queue.
  select m.hidden_at, m.deleted_at into v_hidden, v_deleted
    from public.league_members m
   where m.league_id = p_league_id and m.user_id = v_uid
     for no key update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_a_member');
  end if;

  if p_saved is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  if p_saved then
    -- Saving needs an ACTIVE seat; removing your own rows needs only the seat (as the DELETE
    -- policy allows a hidden member).
    if v_hidden is not null or v_deleted is not null then
      return jsonb_build_object('ok', false, 'reason', 'not_a_member');
    end if;
    if not exists (select 1 from public.watchlist w
                    where w.league_id = p_league_id and w.user_id = v_uid and w.symbol = v_sym) then
      -- The table's shape check too, so a stored symbol the table cannot hold is a clean
      -- refusal rather than a CHECK error.
      if length(v_sym) not between 1 and 12
         or not exists (select 1 from public.symbols s where s.symbol = v_sym) then
        return jsonb_build_object('ok', false, 'reason', 'unknown_symbol');
      end if;
      select count(*) into v_count from public.watchlist w
       where w.league_id = p_league_id and w.user_id = v_uid;
      if v_count >= 50 then
        return jsonb_build_object('ok', false, 'reason', 'watchlist_full', 'max', 50);
      end if;
      -- The trigger re-checks the seat and the cap, paces the save and assigns cap_index.
      begin
        insert into public.watchlist (league_id, user_id, symbol)
        values (p_league_id, v_uid, v_sym);
      exception when sqlstate 'PT429' then
        return jsonb_build_object('ok', false, 'reason', 'rate_limited');
      end;
    end if;
  else
    delete from public.watchlist w
     where w.league_id = p_league_id and w.user_id = v_uid and w.symbol = v_sym;
  end if;

  select count(*) into v_count from public.watchlist w
   where w.league_id = p_league_id and w.user_id = v_uid;
  return jsonb_build_object('ok', true, 'saved', p_saved, 'count', v_count);
end;
$$;

-- 5. The reader: no price ------------------------------------------------------------------
create or replace function public.get_league_watchlist(p_league_id uuid)
returns table (
  symbol       text,
  name         text,
  category_ids uuid[],
  is_draftable boolean,
  saved_at     timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'get_league_watchlist: not authenticated' using errcode = '42501';
  end if;
  if p_league_id is null or not public.is_member(p_league_id) then
    raise exception 'get_league_watchlist: not a member of this league' using errcode = '42501';
  end if;

  return query
    select w.symbol,
           s.name,
           coalesce(
             (select array_agg(o.category_id order by c.display_order, o.category_id)
                from public.symbol_category_overrides o
                left join public.categories c on c.id = o.category_id
               where o.symbol = w.symbol),
             (select array[r.category_id] from public.category_rules r where r.gics_industry = s.gics_industry),
             '{}'::uuid[]),
           coalesce(s.is_draftable, false),
           w.created_at
      from public.watchlist w
      join public.symbols s on s.symbol = w.symbol
     where w.league_id = p_league_id
       and w.user_id = v_uid::text
     order by w.created_at desc, w.symbol collate "C";
end;
$$;

-- 6. Grants (CLAUDE.md: REVOKE FROM PUBLIC leaves Supabase's explicit per-role grants) -----
revoke all on function public.watchlist_before_insert()
  from public, anon, authenticated, service_role;

revoke all on function public.set_watchlist(uuid, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.set_watchlist(uuid, text, boolean) to authenticated;

revoke all on function public.get_league_watchlist(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_league_watchlist(uuid) to authenticated;
