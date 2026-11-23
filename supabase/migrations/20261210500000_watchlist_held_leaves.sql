-- A stock you own is never on your watchlist (Stocks tab plan, "Settled during the build",
-- point 6: docs/plans/2026-11-18-stocks-tab.md; docs/PRODUCT_RULES.md, 2026-11-23).
-- Giorgio: "no star for something you own. its in your portfolio so shouldnt need to be in the
-- watchlist too", then "A": a watched stock you buy leaves your watchlist FOR GOOD. After the
-- sale it is an ordinary free stock with an empty star (B, back in the list after the sale,
-- was not picked).
--
-- The watchlist (20261209000000, applied 2026-11-23) was built before this rule and accepts a
-- save of a held stock. This migration brings it in line, in six parts:
--
--   1. public.league_held_positions(league, user)  ONE definition of "holds" for everything
--      below (see HOLDS).
--   2. public.watchlist_leaves_on_holding()  an AFTER trigger on drafts AND trades: any pick
--      or trade row for (league, manager, stock) deletes that manager's saved row for that
--      stock in that league. Covers a buy, a SALE, a draft pick of every kind (manual,
--      auto_queue, auto_best, bot) and a claim that fills (see CLAIMS). It can never fail
--      the pick or the trade (see NEVER FAILS A TRADE).
--   3. watchlist_before_insert  re-created from 20261209000000's body plus ONE marked
--      addition: a save of a stock the seat holds is refused (PT409, 'watchlist_held'), on
--      every insert path (the write AND a direct PostgREST insert).
--   4. set_watchlist  re-created from 20261209000000's body plus marked additions: it first
--      deletes the caller's rows for stocks they hold (so a row stranded by a race never
--      takes one of the 50 places), and answers {ok:false, reason:'held'} for a save of a
--      held stock. The app reverts the star on any reason it does not know; the reason gets
--      no words (the app never offers that star).
--   5. get_league_watchlist  re-created from 20261209000000's body plus ONE marked addition:
--      a stock the caller holds is left out, so a stranded row is never shown while held.
--   6. A one-off cleanup: rows already saved AND held, and STALE rows (below), are deleted.
--      Count them first with docs/security/2026-11-23-watchlist-held-preflight.sql (read-only).
--
-- STALE: THE POST-SALE INVARIANT (Copilot on #606, 2026-11-23; the trigger alone is a fast path,
--   not a guarantee). The trigger can leave a row behind: its delete is skipped when another
--   transaction holds the row lock and that transaction then rolls back; its caught-error path
--   keeps the row; and a save that crossed a sale is invisible to the sale's delete. While the
--   stock is held the read hides that row, but after a FULL sale nothing did, so the old star
--   came back: B, the option he did not pick. So a row is also hidden, cleared and deleted
--   when it is STALE: the same manager has ANY drafts or trades row for that league and stock
--   recorded strictly AFTER the row was saved (watchlist_row_stale). Under A that is exactly
--   "the stock was picked, bought or sold since you saved it", and every one of those ends the
--   save for good.
--   - The clocks: drafts.recorded_at (timestamptz NOT NULL DEFAULT now(), the pick clock's
--     column; not drafts.created_at, which was made out of band, 20261010000000) and
--     trades.created_at (timestamptz DEFAULT now(); record_trade never sets it). Both are their
--     transaction's start. A NULL trades.created_at never makes a row stale (unknown is not
--     "after").
--   - The save's own time is now clock_timestamp() at the insert, not now() (the ONE changed
--     line in watchlist_before_insert, marked): the insert runs after set_watchlist's held
--     check saw any sale already committed, so a fresh save after a sale is always later than
--     that sale and is never hidden. With now() (the save transaction's start) a sale committing
--     in the few milliseconds between that start and the check would have hidden a legitimate
--     re-save.
--   - ONE RESIDUAL, accepted (supabase review): a buy that started before a save and committed
--     after it (so its delete missed the save), followed by a FULL sale whose transaction also
--     started before that save's insert and then queued behind the buy on record_trade's
--     league lock (up to 5 s). The sale's created_at is its transaction start, earlier than
--     the save, so the row is neither deleted nor stale and shows after the sale. It needs a
--     buy, a star and a sale of the same stock by one manager inside one lock wait. Closing it
--     would mean record_trade stamping trades.created_at with clock_timestamp(), a change to
--     the trade path that this migration does not make.
--   - Strictly after (>), not at-or-after: a tie is a simultaneous save and trade, and the
--     failure that direction is a shown row (only if the trigger also failed), never a hidden
--     legitimate save.
--
-- HOLDS (CLAUDE.md, the all-or-nothing family: never "does any row exist"): the rule the
--   Stocks list (20261207000100) and top movers (20261210000000) already use, and the buy
--   path's leagueOwnedSymbols (_shared/draft-validation.ts): per manager and per stock, draft
--   quantity + buys - sells, kept where the net is > 1e-9; SKIP picks ignored; symbols
--   upper-cased; drafts.user_id is text and trades.user_id is uuid, quantities differ in
--   type, hence ::text / ::numeric (CLAUDE.md). A stock bought and fully sold is NOT held.
--   It is written once here, as a function, rather than a third inline copy. Filtering by
--   one manager BEFORE grouping is the same rule: the groups are per manager. The two reads
--   above keep their inline copies (re-creating two live, unrelated reads is out of this
--   change's scope); supabase/tests/watchlist_held_leaves.pglite.test.ts pins that this
--   function and get_league_available_stocks agree on the same rows.
--   A PENDING CLAIM does not make a stock held (claims write no drafts/trades row until they
--   fill), so a claimed stock stays in Watching as "Claimed · fills Mon 9:30 AM ET".
--
-- WHY THE REMOVAL IS UNCONDITIONAL (no "holds" test in the trigger): under A, every way a pick
--   or trade row for a stock can appear removes the saved row: a pick or a buy makes you hold
--   it, and a sale removes a row a save and a buy left behind when they crossed (each missed
--   the other's uncommitted row). Without the sale, that row would come back into view after
--   the sale, which is B. A partial sale that still holds keeps it out too (it is gone).
--   Only the trading manager's row for that stock in that league is touched: another
--   manager's saved copy is left alone (saving reserves nothing).
--
-- WHY A TRIGGER ON THE HOLDING TABLES (not a line in each writer): every path that creates a
--   holding writes a drafts or trades row, so a new path cannot forget it, and the delete
--   commits or rolls back WITH the pick or trade (a refused pick or trade leaves no trace).
--   The precedent is trg_drafts_prune_queues (20261129000000). INSERT, and UPDATE of the
--   three columns that say whose holding it is (take_over_team moves drafts/trades to the new
--   manager; a takeover's new manager starts with no saved stocks, so this is belt and braces).
--
-- CLAIMS (workstream 6, not built yet): a claim that fills writes a trades row (the fill is a
--   buy). That INSERT fires trg_trades_watchlist_leaves, so the claims run needs no code for
--   this rule; it only must write its fill as a trades row, as every buy does. If a claims
--   fill ever writes a holding somewhere other than drafts or trades, this trigger must be
--   added to that table.
--
-- NEVER FAILS A TRADE OR A PICK (the plan: "It must never be able to fail a trade or a pick"):
--   * No raise: the delete runs in its own sub-block; any error is caught, logged as a
--     WARNING and dropped. The pick/trade goes ahead; the stranded row is hidden by the read
--     (5), cleared by the next save (4), and removed by the sale (2).
--   * No lock wait on a row: the row is taken FOR UPDATE SKIP LOCKED. The only writers that
--     lock a watchlist row are an unsave (deleting it anyway) and this trigger; if it is
--     locked, the trigger skips it rather than waiting, so it cannot join a lock cycle with
--     record_trade's advisory lock or the seat lock set_watchlist takes.
--   * A table-level lock wait (DDL on watchlist) is capped by lock_timeout = 2s on the
--     function, then caught as above. record_trade's own lock_timeout is 5s; the function's
--     SET restores the caller's value on exit.
--   * The one thing it cannot catch: PL/pgSQL's OTHERS does not trap QUERY_CANCELED, so a
--     statement_timeout or a cancel that lands DURING this delete still aborts the statement
--     that fired it, as it would abort any other part of that pick or trade. It sets no
--     timeout of its own (none is set on these paths today); the delete is one indexed row.
--   SECURITY DEFINER so the delete never depends on the inserting role's watchlist rights
--   (edge functions insert as service_role; a claims run may not). LOAD-BEARING (as for
--   trg_drafts_prune_queues): only service_role / definer functions insert into drafts and
--   trades (20260811000002, 20260811000003); the delete is keyed on the inserted row's OWN
--   (league, manager, stock), so even a client insert could only remove its own row.
--
-- ORDER IN THE INSERT TRIGGER: identity gate -> seat lock -> active seat -> HELD (new) -> cap
--   -> pacing. Before the pacing, so a refused held save adds nothing to the counters (a raise
--   rolls them back anyway). After the identity gate, so the answer only ever describes the
--   caller's own seat. PT409 maps to HTTP 409 through PostgREST.
--
-- GRANTS (CLAUDE.md, "Postgres function grants"): every function SECURITY DEFINER (the two
--   helpers are SECURITY INVOKER: they are only called by the definer functions here, run as their
--   owner, and if one were ever granted it would see only what RLS shows the caller), search_path
--   pinned; EXECUTE revoked BY NAME from public, anon, authenticated and service_role;
--   set_watchlist and get_league_watchlist granted back to authenticated only, exactly as
--   20261209000000 left them. CREATE OR REPLACE keeps an ACL; the grants are restated anyway
--   and the test asserts proacl for all six functions.
--
-- POST-PUSH CHECKS: docs/security/2026-11-23-watchlist-held-checks.sql (read-only; its effect
--   block always ends in RAISE, so it rolls back). The test runs it on the full chain.

-- PUSH-TIME LOCKS (supabase review): DROP / CREATE TRIGGER on drafts and trades take heavy
--   table locks (ACCESS EXCLUSIVE for the drop). Without a timeout, a push that lands behind an
--   in-flight trade, pick or scoring read would queue every later trade and pick behind it. So
--   the file fails fast instead: 3s, reset at the end. If the push fails with "canceling
--   statement due to lock timeout", nothing was applied; push again in a quieter moment (every
--   statement here is re-runnable). Push outside a live draft, the Monday 9:30 ET open and the
--   Friday scoring run.
set lock_timeout = '3s';

-- 1. HOLDS: one definition -----------------------------------------------------------------
create or replace function public.league_held_positions(
  p_league_id uuid,
  p_user_id   text default null
)
returns table (user_id text, symbol text)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  -- Per manager, per stock: draft quantity + buys - sells. Kept only where > 0.
  -- (20261207000100's held CTE, plus the manager column and an optional manager filter.)
  select h.uid, h.sym
    from (
      select upper(d.symbol) as sym, d.user_id::text as uid, coalesce(d.quantity, 0)::numeric as q
        from public.drafts d
       where d.league_id = p_league_id
         and d.symbol is not null
         and upper(d.symbol) <> 'SKIP'
         and (p_user_id is null or d.user_id::text = p_user_id)
      union all
      select upper(t.symbol), t.user_id::text,
             case when t.action = 'sell' then -coalesce(t.quantity, 0)::numeric
                  else coalesce(t.quantity, 0)::numeric end
        from public.trades t
       where t.league_id = p_league_id
         and t.symbol is not null
         and (p_user_id is null or t.user_id::text = p_user_id)
    ) h
   group by h.sym, h.uid
  having sum(h.q) > 0.000000001
$$;

comment on function public.league_held_positions(uuid, text) is
  'Who holds what in a league (20261210500000): per manager and stock, draft quantity + buys - sells > 1e-9 (the Stocks list''s rule, 20261207000100). Optional manager filter. Called only by the watchlist functions; no API role may execute it.';

-- 1b. STALE: picked, bought or sold since it was saved (see the header) ---------------------
create or replace function public.watchlist_row_stale(
  p_league_id uuid,
  p_user_id   text,
  p_symbol    text,
  p_saved_at  timestamptz
)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.drafts d
                  where d.league_id = p_league_id
                    and d.user_id::text = p_user_id
                    and d.symbol is not null
                    and upper(d.symbol) = p_symbol
                    and upper(d.symbol) <> 'SKIP'
                    and d.recorded_at > p_saved_at)
      or exists (select 1 from public.trades t
                  where t.league_id = p_league_id
                    and t.user_id::text = p_user_id
                    and upper(t.symbol) = p_symbol
                    and t.created_at > p_saved_at)
$$;

comment on function public.watchlist_row_stale(uuid, text, text, timestamptz) is
  'A saved watchlist row is stale (20261210500000) when its manager has a drafts or trades row for that league and stock recorded strictly after it was saved: picked, bought or sold since (A: it leaves for good). Called only by the watchlist functions; no API role may execute it.';

-- 2. Coming to own (or selling) a stock removes it from that manager's watchlist -----------
create or replace function public.watchlist_leaves_on_holding()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '2s'
as $$
begin
  begin
    delete from public.watchlist w
     where (w.league_id, w.user_id, w.symbol) in (
             select x.league_id, x.user_id, x.symbol
               from public.watchlist x
              where x.league_id = new.league_id
                and x.user_id = new.user_id::text
                and x.symbol = upper(new.symbol)
                for update skip locked);
  exception when others then
    -- Never fail the pick or the trade (see the header). The row stays; the read hides it
    -- while held, the next save clears it, a sale removes it.
    raise warning 'watchlist_leaves_on_holding: % %', sqlstate, sqlerrm;
  end;
  return null;
end;
$$;

comment on function public.watchlist_leaves_on_holding() is
  'AFTER INSERT / UPDATE OF league_id, user_id, symbol on drafts and trades (20261210500000): the manager''s saved row for that stock in that league is deleted (a pick, a buy, a claim fill or a sale). Never raises; skips a locked row. Trigger-only; no API role may execute it.';

drop trigger if exists trg_drafts_watchlist_leaves on public.drafts;
create trigger trg_drafts_watchlist_leaves
  after insert or update of league_id, user_id, symbol on public.drafts
  for each row execute function public.watchlist_leaves_on_holding();

drop trigger if exists trg_trades_watchlist_leaves on public.trades;
create trigger trg_trades_watchlist_leaves
  after insert or update of league_id, user_id, symbol on public.trades
  for each row execute function public.watchlist_leaves_on_holding();

-- 3. The insert trigger: 20261209000000's body + the HELD refusal ----------------------------
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

  -- 20261210500000: a stock the seat holds is never saved (every insert path).
  if exists (select 1 from public.league_held_positions(new.league_id, new.user_id) h
              where h.symbol = upper(new.symbol)) then
    raise exception 'watchlist_held: a stock you own is not saved to your watchlist' using errcode = 'PT409';
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
  new.created_at := clock_timestamp();  -- 20261210500000: was now(); see the header's STALE
  return new;
end;
$$;

-- 4. The write: 20261209000000's body + clear held rows + the 'held' answer -----------------
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

  -- 20261210500000: clear the caller's rows for stocks they hold (a save and a buy that
  -- crossed can strand one) and their STALE rows (picked, bought or sold since saved; see
  -- the header), so every count below, and the 50 cap, sees only rows the reader can show,
  -- and a re-save after a sale finds no old row in its way. SKIP LOCKED, as in the removal trigger: a row locked by an in-flight
  -- trade is being deleted by that trade's trigger, so this call never waits on it while
  -- holding the seat lock (security review).
  delete from public.watchlist w
   where (w.league_id, w.user_id, w.symbol) in (
           select x.league_id, x.user_id, x.symbol
             from public.watchlist x
            where x.league_id = p_league_id and x.user_id = v_uid
              and (x.symbol in (select h.symbol from public.league_held_positions(p_league_id, v_uid) h)
                   or public.watchlist_row_stale(p_league_id, v_uid, x.symbol, x.created_at))
              for update skip locked);

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
      -- 20261210500000: a stock the caller holds is never saved.
      if exists (select 1 from public.league_held_positions(p_league_id, v_uid) h
                  where h.symbol = v_sym) then
        return jsonb_build_object('ok', false, 'reason', 'held');
      end if;
      select count(*) into v_count from public.watchlist w
       where w.league_id = p_league_id and w.user_id = v_uid;
      if v_count >= 50 then
        return jsonb_build_object('ok', false, 'reason', 'watchlist_full', 'max', 50);
      end if;
      -- The trigger re-checks the seat, the holding and the cap, paces the save and assigns
      -- cap_index.
      begin
        insert into public.watchlist (league_id, user_id, symbol)
        values (p_league_id, v_uid, v_sym);
      exception
        when sqlstate 'PT429' then
          return jsonb_build_object('ok', false, 'reason', 'rate_limited');
        when sqlstate 'PT409' then  -- 20261210500000
          return jsonb_build_object('ok', false, 'reason', 'held');
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

-- 5. The reader: 20261209000000's body + held stocks left out --------------------------------
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
       -- 20261210500000: a stock the caller holds is never shown, nor a STALE row (picked,
       -- bought or sold since it was saved).
       and not exists (select 1 from public.league_held_positions(p_league_id, v_uid::text) h
                        where h.symbol = w.symbol)
       and not public.watchlist_row_stale(p_league_id, v_uid::text, w.symbol, w.created_at)
     order by w.created_at desc, w.symbol collate "C";
end;
$$;

-- 6. One-off cleanup: rows already saved AND held, and STALE rows -------------------------
--    (Counted first by docs/security/2026-11-23-watchlist-held-preflight.sql.) A stale row
--    here is one saved before the rule existed and then picked, bought or sold: under A it
--    left the watchlist when that happened.
delete from public.watchlist w
 where exists (select 1 from public.league_held_positions(w.league_id, w.user_id) h
                where h.symbol = w.symbol)
    or public.watchlist_row_stale(w.league_id, w.user_id, w.symbol, w.created_at);

-- 7. Grants (CLAUDE.md: REVOKE FROM PUBLIC leaves Supabase's explicit per-role grants) -----
revoke all on function public.league_held_positions(uuid, text)
  from public, anon, authenticated, service_role;

revoke all on function public.watchlist_row_stale(uuid, text, text, timestamptz)
  from public, anon, authenticated, service_role;

revoke all on function public.watchlist_leaves_on_holding()
  from public, anon, authenticated, service_role;

revoke all on function public.watchlist_before_insert()
  from public, anon, authenticated, service_role;

revoke all on function public.set_watchlist(uuid, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.set_watchlist(uuid, text, boolean) to authenticated;

revoke all on function public.get_league_watchlist(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_league_watchlist(uuid) to authenticated;

reset lock_timeout;
