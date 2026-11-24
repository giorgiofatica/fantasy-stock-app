-- Claims (the waiver wire), server side (Stocks tab, part 3, workstream 6).
-- Plans: docs/plans/2026-10-08-trading-window-and-watchlist.md (approved 2026-10-09; decisions 1-11
-- and 13 stand) as changed by docs/plans/2026-11-18-stocks-tab.md part 3 (approved 2026-11-22).
-- PROVISIONAL TIMESTAMP: the Orchestrator re-stamps this file after the option-A migration and
-- before any push (it must be later than every applied migration, or db push refuses it).
--
-- WHAT IT ADDS
--   public.waiver_order            the league's waiver order (1 = first dibs). Members read it.
--   public.waiver_order_meta       per league: the last scored week the order was reset through.
--   public.claims                  "buy X at the next open, funded by selling Y". Owner-only read.
--   public.claims_runs             one row per (league, session date) the claims run COMMITTED:
--                                  the row that makes a retry safe and that lifts the hold.
--   public.place_claim / cancel_claim          the two writes (authenticated).
--   public.claims_run_day()                    the run's "which leagues today" (service role).
--   public.claims_run_state(league, date)      the run's read: pending claims + the order.
--   public.commit_claims_run(league, date, plan)  the run's ONE transaction per league.
--   public.claims_hold_active(league)          record-trade's hold on live trading.
--   public.reset_due_waiver_orders()           the weekly reset (process-week-results).
--   public.finalize_league_draft               re-created from 20261115000000, plus the order's init.
--   league_notifications kind claim_won: the ONE notice, to a claimant whose claim FILLED. A claim
--     that did not go through (lost, failed, missed) writes no notice and no message anywhere
--     (Giorgio, 2026-11-23, PRODUCT_RULES + Stocks tab plan point 11); its status and reason stay
--     on the claims row. claim_lost / claim_failed are not kinds, so the CHECK refuses them.
--
-- BLIND (the plan: "claims are blind, RLS not UI"). claims has ONE policy, SELECT of your own rows in
--   a league you belong to. No INSERT / UPDATE / DELETE grant to anyone but the owner: every write is
--   a definer function. Nothing else returns a claim: no reader joins it, the one notice (claim_won) is
--   owner-only (league_notifications_select_own), and a won claim is visible to others only as the trade it
--   made (trades are public in the league, as every buy is). The Available screen learns which listed
--   stocks the CALLER claimed from `select symbol from claims where league_id = ? and status =
--   'pending'`: RLS answers only the caller's rows, so nothing about another manager's claim, not
--   even that one exists, can be read (supabase/tests/claims.pglite.test.ts, "blind").
--
-- THE CAP (5 pending per seat) and ONE PENDING CLAIM PER STOCK, safe under concurrency (CLAUDE.md,
--   partial-state family: count per participant, never "is there any row"):
--   * pending_slot 1..5, unique per seat among PENDING rows, assigned by the trigger, cleared when a
--     claim leaves 'pending' (CHECK: pending <=> slot set). A 6th pending row cannot exist.
--   * a partial unique index (league, user, symbol) WHERE pending, so a re-claim after a loss or a
--     cancel is allowed (a plain unique would be the all-or-nothing trap the October plan names).
--   * a partial unique index (league, user, sell_symbol) WHERE pending: one sale funds one claim.
-- PRECONDITION: 20261210500000 (option A: league_held_positions and the watchlist trigger that
--   removes a watched stock when a claim fills) is applied first.
--   * the trigger takes the seat's league_members row FOR NO KEY UPDATE (the watchlist's lock).
--
-- THE RUN (supabase/functions/claims-run). Validation is the buy path's own TypeScript
--   (record-trade/commit.ts decideTrade over _shared/draft-validation.ts): record_trade_atomic is a
--   compare-and-swap, not a validator, so the rules cannot live here without a second copy. The
--   function plans every claim of a league on a simulated ledger, then hands the whole plan to
--   commit_claims_run, which in ONE transaction, under the league's locks:
--     - refuses if the league already has a claims_runs row for the date (a retry is a no-op);
--     - compares the pending claim set and the waiver order with the ones the plan was made on;
--     - runs every trade through public."record_trade_atomic" in order (sale, then buy, per won
--       claim), re-mapping the plan's placeholder ids to the rows just inserted so each step's CAS
--       sees the steps before it;
--     - ANY refusal rolls the whole league back (a subtransaction) and answers which step and why,
--       so a sale is never committed without its buy and a partial run never exists;
--     - writes every claim's outcome, moves the winners to the back in the order they won, queues
--       a claim_won notice for each FILLED claim only, and inserts the claims_runs row.
--   The function re-plans on a refusal (fresh reads), bounded; a crash leaves nothing behind.
--
-- THE HOLD. claims_hold_active(league): the market is open, it is less than 10 minutes since the
--   session opened, the league has pending claims due today, and no claims_runs row for today.
--   record-trade refuses a buy or a sell then with claims_processing. It lifts BY ITSELF at open + 10
--   minutes whether or not the run happened: a dead claims job can never close a league's trading.
--
-- THE WAIVER ORDER. Starts as the reverse of the draft order (the last pick is 1), written when the
--   draft completes (finalize_league_draft) and healed by the run and the reset (a member missing
--   from the order is appended in reverse draft order; a non-member is dropped). After each scored
--   week it resets to the reverse of league_standings_ranked through that week (last place first,
--   the standings' own tiebreaks). Any won claim moves the winner to the back.
--
-- GRANTS (CLAUDE.md, "Postgres function grants"): every function SECURITY DEFINER, search_path
--   pinned, EXECUTE revoked BY NAME from public, anon, authenticated and service_role first, then
--   granted to exactly one role. Verified by proacl in the PGlite test and the checks SQL.
--
-- The CLI splitter: no bare "atomic" outside quotes (record_trade_atomic is always quoted).
--
-- POST-PUSH CHECKS: docs/security/2026-12-11-claims-checks.sql (read-only; its effect block ends in
--   RAISE, so it rolls back).

-- 1. Tables ------------------------------------------------------------------------------

create table public.waiver_order (
  league_id  uuid        not null,
  user_id    text        not null,
  position   integer     not null,
  updated_at timestamptz not null default now(),
  constraint waiver_order_pkey primary key (league_id, user_id),
  -- IMMEDIATE (not deferred): every writer deletes then inserts, so no deferral is needed, and an
  -- immediate check fails inside the writer's own subtransaction (one league's reset), not at COMMIT.
  constraint waiver_order_position_key unique (league_id, position),
  constraint waiver_order_position_check check (position >= 1),
  -- ON UPDATE CASCADE: take_over_team re-points league_members.user_id BEFORE its own update of
  -- this table, so the order row follows the seat ("waiver position", PRODUCT_RULES).
  constraint waiver_order_seat_fkey foreign key (league_id, user_id)
    references public.league_members (league_id, user_id) on delete cascade on update cascade
);
comment on table public.waiver_order is
  'The league''s waiver order (1 = first dibs on a contested claim). Readable by members; written only by the claims functions.';

create table public.waiver_order_meta (
  league_id          uuid        primary key references public.leagues (id) on delete cascade,
  reset_through_week integer     not null default 0,
  updated_at         timestamptz not null default now()
);
comment on table public.waiver_order_meta is
  'The last fully scored week the waiver order was reset through (reset_due_waiver_orders). Service only.';

create table public.claims (
  id            uuid        primary key default gen_random_uuid(),
  league_id     uuid        not null,
  user_id       text        not null,
  symbol        text        not null,
  sell_symbol   text,
  funded_by     text        not null,
  run_date      date        not null,
  status        text        not null default 'pending',
  pending_slot  smallint,
  reason        text,
  outcome       jsonb       not null default '{}'::jsonb,
  placed_at     timestamptz not null default now(),
  resolved_at   timestamptz,
  buy_trade_id  uuid,
  sell_trade_id uuid,
  constraint claims_status_check check (status in ('pending', 'won', 'lost', 'failed', 'cancelled')),
  constraint claims_funded_by_check check (funded_by in ('sale', 'cash')),
  constraint claims_funding_shape check ((funded_by = 'sale') = (sell_symbol is not null)),
  constraint claims_sale_not_buy check (sell_symbol is distinct from symbol),
  constraint claims_symbol_shape check (symbol = upper(symbol) and length(symbol) between 1 and 12),
  constraint claims_sell_symbol_shape check (sell_symbol is null or (sell_symbol = upper(sell_symbol) and length(sell_symbol) between 1 and 12)),
  constraint claims_pending_slot_shape check ((status = 'pending') = (pending_slot is not null) and (pending_slot is null or pending_slot between 1 and 5)),
  constraint claims_resolved_shape check ((status = 'pending') = (resolved_at is null)),
  constraint claims_won_has_buy check (status <> 'won' or buy_trade_id is not null),
  constraint claims_not_bot check (user_id !~ '^bot-'),
  constraint claims_seat_fkey foreign key (league_id, user_id)
    references public.league_members (league_id, user_id) on delete cascade on update cascade
);
comment on table public.claims is
  'Waiver claims: buy symbol at the next open (run_date), funded by selling sell_symbol or by cash. Blind: owner-only SELECT; written only by place_claim, cancel_claim and commit_claims_run.';
comment on column public.claims.pending_slot is
  'Which of the seat''s 5 pending places this claim holds (1..5); NULL once it leaves pending. Makes a 6th pending claim impossible. Never shown.';
comment on column public.claims.outcome is
  'What happened at the run, as data for the app''s ending (price, sale, winner_user_id for a lost claim). {} while pending.';

create unique index claims_one_pending_per_stock on public.claims (league_id, user_id, symbol) where status = 'pending';
create unique index claims_one_pending_per_sale on public.claims (league_id, user_id, sell_symbol)
  where status = 'pending' and sell_symbol is not null;
create unique index claims_pending_slot_key on public.claims (league_id, user_id, pending_slot) where status = 'pending';
create index claims_league_pending_idx on public.claims (league_id, run_date) where status = 'pending';
create index claims_user_idx on public.claims (user_id, league_id, placed_at desc);

create table public.claims_runs (
  league_id      uuid        not null references public.leagues (id) on delete cascade,
  run_date       date        not null,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz not null default clock_timestamp(),
  claims_won     integer     not null default 0,
  claims_lost    integer     not null default 0,
  claims_failed  integer     not null default 0,
  claims_missed  integer     not null default 0,
  constraint claims_runs_pkey primary key (league_id, run_date)
);
comment on table public.claims_runs is
  'One row per (league, session date) whose claims run COMMITTED. Written only inside commit_claims_run, in the same transaction as the trades and outcomes, so a row means the whole league was resolved and a retry is a no-op. Lifts the hold (claims_hold_active). Service only.';

-- 2. RLS and table grants ------------------------------------------------------------------

alter table public.waiver_order      enable row level security;
alter table public.waiver_order_meta enable row level security;
alter table public.claims            enable row level security;
alter table public.claims_runs       enable row level security;

create policy waiver_order_select_member on public.waiver_order
  for select to authenticated using (public.is_member(league_id));
create policy claims_select_own on public.claims
  for select to authenticated using (user_id = auth.uid()::text and public.is_member(league_id));

-- Supabase's default privileges grant ALL on a new table to anon, authenticated and service_role:
-- revoke BY NAME, then grant back only the reads. Writes go through the definer functions (owner).
revoke all on table public.waiver_order      from public, anon, authenticated, service_role;
revoke all on table public.waiver_order_meta from public, anon, authenticated, service_role;
revoke all on table public.claims            from public, anon, authenticated, service_role;
revoke all on table public.claims_runs       from public, anon, authenticated, service_role;
grant select on table public.waiver_order to authenticated;
grant select on table public.claims       to authenticated;

-- 3. Notices: one new kind (a SUPERSET of 20261125000006's list) ------------------------------

alter table public.league_notifications
  drop constraint if exists league_notifications_kind_check;
alter table public.league_notifications
  add constraint league_notifications_kind_check check (kind in (
    'draft_order_set',
    'renewal_invite', 'renewal_reply', 'renewal_nudge', 'renewal_removed', 'season_set',
    'member_left',
    'commissioner_transferred',
    'draft_room_open', 'draft_started', 'draft_at_risk', 'draft_at_risk_reminder',
    'draft_postponed', 'draft_time_set',
    'seat_taken_over',
    'claim_won'                  -- 20261211000000: to the claimant whose claim FILLED, at the run.
                                 -- No kind exists for a claim that did not go through (point 11).
  ));

-- 4. Helpers -------------------------------------------------------------------------------------

-- HOLDINGS: public.league_held_positions(league, user) (20261210500000, option A) is the ONE
-- definition of "holds" (drafts minus SKIP, plus buys, minus sells, > 1e-9, with the casts). The
-- claims functions call it; there is no second copy here. It is security invoker and granted to no
-- API role; the definer functions below call it as their owner.

-- The season's end BY DATE, as record_trade_atomic (20261207000000) reads it: the latest week_end,
-- counted only when the whole schedule is written (a playoff row exists and no week_end is NULL).
-- NULL = no date end known (the flag alone then decides).
create or replace function public._claims_season_end(p_league_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when count(*) filter (where m.is_playoff is true) > 0
               and count(*) filter (where m.week_end is null) = 0
              then max(m.week_end) end
    from public.matchups m
   where m.league_id = p_league_id;
$$;

-- Make the league's waiver order exactly its members, in a stable order: the stored order for
-- members already in it (gaps closed), then any member missing from it in REVERSE draft order (the
-- last pick first; a member with no draft position after them, by id). Ensures the meta row.
-- Idempotent; writes only when something differs. Caller holds no lock: this takes the order lock.
create or replace function public._waiver_order_fill(p_league_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_want text[];
  v_have text[];
begin
  perform pg_advisory_xact_lock(hashtextextended('waiver-order:' || p_league_id::text, 0));

  select coalesce(array_agg(w.user_id order by w.position), '{}') into v_have
    from public.waiver_order w where w.league_id = p_league_id;

  select coalesce(array_agg(x.uid order by x.k1, x.k2, x.k3 collate "C"), '{}') into v_want
    from (
      select m.user_id as uid,
             case when w.position is not null then 0 else 1 end as k1,
             coalesce(w.position, -coalesce(o.position, -2147483647)) as k2,
             m.user_id as k3
        from public.league_members m
        left join public.waiver_order w on w.league_id = m.league_id and w.user_id = m.user_id
        left join public.league_draft_order o on o.league_id = m.league_id and o.user_id = m.user_id
       where m.league_id = p_league_id
    ) x;

  if v_want is distinct from v_have then
    delete from public.waiver_order where league_id = p_league_id;
    insert into public.waiver_order (league_id, user_id, position)
    select p_league_id, u, i::int from unnest(v_want) with ordinality as t(u, i);
  end if;

  insert into public.waiver_order_meta (league_id) values (p_league_id) on conflict (league_id) do nothing;
  return cardinality(v_want);
end;
$$;

-- 5. The trigger: seat, bot, cap on every insert path ---------------------------------------------

create or replace function public.claims_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hidden  timestamptz;
  v_deleted timestamptz;
  v_free    smallint;
begin
  select m.hidden_at, m.deleted_at into v_hidden, v_deleted
    from public.league_members m
   where m.league_id = new.league_id and m.user_id = new.user_id
     for no key update;
  if not found then
    raise exception 'claims: not a member of this league' using errcode = '42501';
  end if;
  if v_hidden is not null or v_deleted is not null then
    raise exception 'claims: this seat is no longer active' using errcode = '42501';
  end if;
  new.status := 'pending';
  new.resolved_at := null;
  new.reason := null;
  new.outcome := '{}'::jsonb;
  new.buy_trade_id := null;
  new.sell_trade_id := null;
  new.placed_at := now();
  select min(g)::smallint into v_free
    from generate_series(1, 5) as g
   where not exists (select 1 from public.claims c
                      where c.league_id = new.league_id and c.user_id = new.user_id
                        and c.status = 'pending' and c.pending_slot = g);
  if v_free is null then
    raise exception 'claim_limit: at most 5 pending claims per league' using errcode = '23514';
  end if;
  new.pending_slot := v_free;
  return new;
end;
$$;

create trigger trg_claims_before_insert
  before insert on public.claims
  for each row execute function public.claims_before_insert();

-- 6. The writes ---------------------------------------------------------------------------------

-- place_claim(league, symbol, sell_symbol) -> jsonb
--   {ok:true, claim:{id, symbol, sell_symbol, funded_by, run_date, placed_at}, pending:n}
--   {ok:false, reason: not_authenticated | not_a_member | claim_market_open | calendar_unavailable |
--     draft_not_completed | season_completed | unknown_symbol | not_draftable | symbol_owned |
--     not_owned | already_claimed | sale_in_use | claim_limit (max 5) | invalid | rate_limited}
-- rate_limited: past 60 calls a minute (place + cancel, every call counted, refusals included), or
-- past 30 new claims a minute / 200 a day.
-- not_draftable is the buy path's own test (refusesAsNotDraftable): is_draftable, unless the league
-- allows the full universe. symbol_owned: anyone in the league holds it (holdings are public).
-- not_owned: the named sale is not a position the caller holds. Slot fit is NOT checked here: the
-- price moves overnight, and the run applies the buy's own slot rule at the open.
create or replace function public.place_claim(
  p_league_id   uuid,
  p_symbol      text,
  p_sell_symbol text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_me       text;
  v_sym      text := upper(btrim(coalesce(p_symbol, '')));
  v_sell     text := nullif(upper(btrim(coalesce(p_sell_symbol, ''))), '');
  v_hidden   timestamptz;
  v_deleted  timestamptz;
  v_league   record;
  v_mkt      record;
  v_run_date date;
  v_end      timestamptz;
  v_draftable boolean;
  v_count    integer;
  v_claim    public.claims%rowtype;
  v_constraint text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  v_me := v_uid::text;
  -- Every call is counted first, refusals included (the security review: a refusal scanned the
  -- league's ledger for free). 60 a minute across place and cancel, per person.
  if public.check_and_bump_rate_limit('claims-write-min', 'user:' || v_me, 60, 60) is not true then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;
  if p_league_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_a_member');
  end if;
  -- The seat lock the trigger takes too: one manager's claim writes in a league queue.
  select m.hidden_at, m.deleted_at into v_hidden, v_deleted
    from public.league_members m
   where m.league_id = p_league_id and m.user_id = v_me
     for no key update;
  if not found or v_hidden is not null or v_deleted is not null then
    return jsonb_build_object('ok', false, 'reason', 'not_a_member');
  end if;
  if v_sym = '' or v_sym = v_sell then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- Only while the market is closed, and only toward a session the calendar vouches for.
  select s.status, s.next_open_at into v_mkt from public.market_session_status(now()) s;
  if v_mkt.status = 'open' then
    return jsonb_build_object('ok', false, 'reason', 'claim_market_open');
  end if;
  if v_mkt.status is distinct from 'closed' or v_mkt.next_open_at is null then
    return jsonb_build_object('ok', false, 'reason', 'calendar_unavailable');
  end if;
  v_run_date := (v_mkt.next_open_at at time zone 'America/New_York')::date;

  select l.draft_status, l.season_status, l.allow_undraftable into v_league
    from public.leagues l where l.id = p_league_id;
  if v_league.draft_status is distinct from 'completed' then
    return jsonb_build_object('ok', false, 'reason', 'draft_not_completed');
  end if;
  -- A finished season is closed to buying and selling (2026-11-18), by flag or by date; a claim
  -- that would fill after the season's end is refused now, not failed at the open.
  v_end := public._claims_season_end(p_league_id);
  if v_league.season_status is not distinct from 'completed'
     or (v_end is not null and (now() > v_end or v_mkt.next_open_at > v_end)) then
    return jsonb_build_object('ok', false, 'reason', 'season_completed');
  end if;

  if length(v_sym) > 12 or (v_sell is not null and length(v_sell) > 12) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_symbol');
  end if;
  select coalesce(s.is_draftable, false) into v_draftable from public.symbols s where s.symbol = v_sym;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_symbol');
  end if;
  if v_draftable is not true and v_league.allow_undraftable is not true then
    return jsonb_build_object('ok', false, 'reason', 'not_draftable');
  end if;
  if exists (select 1 from public.league_held_positions(p_league_id) h where h.symbol = v_sym) then
    return jsonb_build_object('ok', false, 'reason', 'symbol_owned');
  end if;
  if v_sell is not null and not exists (
    select 1 from public.league_held_positions(p_league_id, v_me) h where h.symbol = v_sell
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_owned');
  end if;

  if exists (select 1 from public.claims c where c.league_id = p_league_id and c.user_id = v_me
                and c.status = 'pending' and c.symbol = v_sym) then
    return jsonb_build_object('ok', false, 'reason', 'already_claimed');
  end if;
  if v_sell is not null and exists (
    select 1 from public.claims c where c.league_id = p_league_id and c.user_id = v_me
       and c.status = 'pending' and c.sell_symbol = v_sell
  ) then
    return jsonb_build_object('ok', false, 'reason', 'sale_in_use');
  end if;
  select count(*) into v_count from public.claims c
   where c.league_id = p_league_id and c.user_id = v_me and c.status = 'pending';
  if v_count >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'claim_limit', 'max', 5);
  end if;

  -- Paced per person across leagues (hygiene: a claim discloses nothing a member cannot already
  -- read, but a write loop should not be free). A refusal adds nothing.
  if public.check_and_bump_rate_limit('claims-place-min', 'user:' || v_me, 30, 60) is not true
     or public.check_and_bump_rate_limit('claims-place-day', 'user:' || v_me, 200, 86400) is not true then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  begin
    insert into public.claims (league_id, user_id, symbol, sell_symbol, funded_by, run_date)
    values (p_league_id, v_me, v_sym, v_sell, case when v_sell is null then 'cash' else 'sale' end, v_run_date)
    returning * into v_claim;
  exception
    when unique_violation then
      -- A concurrent twin of this call won (the checks above are re-made by the indexes).
      -- Matched by index NAME, so a future unique index cannot be mislabelled.
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'claims_one_pending_per_sale' then
        return jsonb_build_object('ok', false, 'reason', 'sale_in_use');
      end if;
      if v_constraint = 'claims_one_pending_per_stock' then
        return jsonb_build_object('ok', false, 'reason', 'already_claimed');
      end if;
      if v_constraint = 'claims_pending_slot_key' then
        return jsonb_build_object('ok', false, 'reason', 'claim_limit', 'max', 5);
      end if;
      raise;
    when check_violation then
      if sqlerrm like 'claim_limit%' then
        return jsonb_build_object('ok', false, 'reason', 'claim_limit', 'max', 5);
      end if;
      raise;
  end;

  select count(*) into v_count from public.claims c
   where c.league_id = p_league_id and c.user_id = v_me and c.status = 'pending';
  return jsonb_build_object(
    'ok', true,
    'claim', jsonb_build_object('id', v_claim.id, 'symbol', v_claim.symbol, 'sell_symbol', v_claim.sell_symbol,
                                'funded_by', v_claim.funded_by, 'run_date', v_claim.run_date,
                                'placed_at', v_claim.placed_at),
    'pending', v_count);
end;
$$;

-- cancel_claim(league, symbol) -> jsonb {ok:true, cancelled:true|false, pending:n} | {ok:false, reason}
-- Your own PENDING claim on that stock, UNTIL ITS RUN CAN START: the open of the session it was placed
-- for (its run_date, from market_calendar). At or after that instant the answer is
-- {ok:false, reason:'claim_locked', run_date} and nothing changes (Copilot on #608: a claim waiting
-- at 9:31 for its price must not be cancellable mid-run). The run can only start at or after that
-- same instant (claims_run_day needs the market open), so the gate and the run never overlap:
--   * the cancel takes the claim's row lock FIRST (FOR UPDATE), then checks the gate against now(),
--     its transaction's start. A cancel whose transaction began before the open holds the row; the
--     run's commit (begun at or after the open) waits on it, then finds the claim gone from its
--     pending set and answers claims_changed: the run re-plans. A cancel begun at or after the open
--     is refused. Neither leaves a half state.
-- A claim whose run_date has no calendar row (never expected: run_date came from next_open_at) is
-- locked from the START of that day, Eastern: the gate errs toward the run.
create or replace function public.cancel_claim(p_league_id uuid, p_symbol text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_sym   text := upper(btrim(coalesce(p_symbol, '')));
  v_id    uuid;
  v_run   date;
  v_open  timestamptz;
  v_count integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  if public.check_and_bump_rate_limit('claims-write-min', 'user:' || v_uid::text, 60, 60) is not true then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;
  if p_league_id is null or not exists (
    select 1 from public.league_members m where m.league_id = p_league_id and m.user_id = v_uid::text
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_a_member');
  end if;
  -- The row lock first (the run's commit locks the same rows), then the gate.
  select c.id, c.run_date into v_id, v_run
    from public.claims c
   where c.league_id = p_league_id and c.user_id = v_uid::text and c.symbol = v_sym and c.status = 'pending'
     for update;
  if v_id is not null then
    select (m.session_date + m.open_et) at time zone 'America/New_York' into v_open
      from public.market_calendar m where m.session_date = v_run;
    v_open := coalesce(v_open, v_run::timestamp at time zone 'America/New_York');
    if now() >= v_open then
      return jsonb_build_object('ok', false, 'reason', 'claim_locked', 'run_date', v_run);
    end if;
    update public.claims c
       set status = 'cancelled', pending_slot = null, resolved_at = now(), reason = 'cancelled'
     where c.id = v_id and c.status = 'pending';
  end if;
  select count(*) into v_count from public.claims c
   where c.league_id = p_league_id and c.user_id = v_uid::text and c.status = 'pending';
  return jsonb_build_object('ok', true, 'cancelled', v_id is not null, 'pending', v_count);
end;
$$;

-- 7. The run's reads ------------------------------------------------------------------------------

-- claims_run_day() -> jsonb {open, session_date, session_open_at, due:[league ids]}
-- open=false (and due=[]) unless the market is open now. due = every league with a pending claim
-- due by today's session and no claims_runs row for today.
create or replace function public.claims_run_day()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_mkt  record;
  v_date date;
  v_due  jsonb;
begin
  select s.status, s.session_open_at into v_mkt from public.market_session_status(now()) s;
  if v_mkt.status is distinct from 'open' or v_mkt.session_open_at is null then
    return jsonb_build_object('open', false, 'session_date', null, 'session_open_at', null, 'due', '[]'::jsonb);
  end if;
  v_date := (v_mkt.session_open_at at time zone 'America/New_York')::date;
  select coalesce(jsonb_agg(x.league_id order by x.league_id), '[]'::jsonb) into v_due
    from (select distinct c.league_id from public.claims c
           where c.status = 'pending' and c.run_date <= v_date
             and not exists (select 1 from public.claims_runs r where r.league_id = c.league_id and r.run_date = v_date)) x;
  return jsonb_build_object('open', true, 'session_date', v_date, 'session_open_at', v_mkt.session_open_at, 'due', v_due);
end;
$$;

-- claims_run_state(league, run_date) -> jsonb {already_ran, claims:[...], order:[...]}
-- Heals the order first (_waiver_order_fill), then reads. Not locked: commit_claims_run compares
-- the claim set and the order under its locks, so a change in between is caught there.
create or replace function public.claims_run_state(p_league_id uuid, p_run_date date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if p_league_id is null or p_run_date is null then
    raise exception 'claims_run_state: league and date required' using errcode = '22023';
  end if;
  perform public._waiver_order_fill(p_league_id);
  return jsonb_build_object(
    'already_ran', exists (select 1 from public.claims_runs r where r.league_id = p_league_id and r.run_date = p_run_date),
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'user_id', c.user_id, 'symbol', c.symbol, 'sell_symbol', c.sell_symbol,
               'funded_by', c.funded_by, 'run_date', c.run_date, 'placed_at', c.placed_at)
             order by c.placed_at, c.id)
        from public.claims c
       where c.league_id = p_league_id and c.status = 'pending' and c.run_date <= p_run_date), '[]'::jsonb),
    'order', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', w.user_id, 'position', w.position) order by w.position)
        from public.waiver_order w where w.league_id = p_league_id), '[]'::jsonb));
end;
$$;

-- claims_hold_active(league) -> boolean: record-trade's hold (header). Fail-open BY TIME.
create or replace function public.claims_hold_active(p_league_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_mkt  record;
  v_date date;
begin
  select s.status, s.session_open_at into v_mkt from public.market_session_status(now()) s;
  if v_mkt.status is distinct from 'open' or v_mkt.session_open_at is null then
    return false;
  end if;
  if now() >= v_mkt.session_open_at + interval '10 minutes' then
    return false;
  end if;
  v_date := (v_mkt.session_open_at at time zone 'America/New_York')::date;
  if exists (select 1 from public.claims_runs r where r.league_id = p_league_id and r.run_date = v_date) then
    return false;
  end if;
  return exists (select 1 from public.claims c
                  where c.league_id = p_league_id and c.status = 'pending' and c.run_date <= v_date);
end;
$$;

-- 8. The run's commit: ONE transaction per league -------------------------------------------------
--
-- p_plan = {
--   claim_ids: [uuid]                       the pending claims (run_date <= date) the plan saw
--   order:     [{user_id, position}]        the waiver order the plan saw
--   steps:     [{ref, claim_id, action ('sell'|'buy'), quantity, price, total_value,
--               funded_by (uuid | ref | null), slot_id (uuid | null),
--               seen_trade_ids [uuid | ref], seen_draft_ids [text], rules, slots}]
--   outcomes:  [{claim_id, status ('won'|'lost'|'failed'), reason, detail}]   won ones in WIN order
-- }
-- A ref is 'ref:<anything>' and names an earlier step's inserted trade. user_id and symbol are taken
-- from the CLAIM, never from the plan: a step can only trade the claimant's claimed stock or named
-- sale. Answers:
--   {ok:true, won, lost, failed, missed}
--   {ok:false, reason:'already_ran'} | 'claims_changed' | 'order_changed' | 'bad_plan' (detail)
--   {ok:false, reason:'step_refused', step, claim_id, refusal, changed}   nothing was written
create or replace function public.commit_claims_run(p_league_id uuid, p_run_date date, p_plan jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_claim_ids uuid[];
  v_seen_ids  uuid[];
  v_order     jsonb;
  v_steps     jsonb := coalesce(p_plan -> 'steps', '[]'::jsonb);
  v_outcomes  jsonb := coalesce(p_plan -> 'outcomes', '[]'::jsonb);
  v_refs      jsonb := '{}'::jsonb;
  v_step      jsonb;
  v_out       jsonb;
  v_claim     public.claims%rowtype;
  v_res       jsonb;
  v_i         integer;
  v_sym       text;
  v_funded    uuid;
  v_seen_t    uuid[];
  v_detail    text;
  v_queue     text[];
  v_status    text;
  v_buy       uuid;
  v_sell      uuid;
  v_buy_row   public.trades%rowtype;
  v_sell_row  public.trades%rowtype;
  v_won int := 0; v_lost int := 0; v_failed int := 0; v_missed int := 0;
  v_n int;
begin
  if p_league_id is null or p_run_date is null or p_plan is null or jsonb_typeof(p_plan) <> 'object'
     or jsonb_typeof(v_steps) <> 'array' or jsonb_typeof(v_outcomes) <> 'array'
     or jsonb_typeof(p_plan -> 'claim_ids') is distinct from 'array'
     or jsonb_typeof(p_plan -> 'order') is distinct from 'array' then
    return jsonb_build_object('ok', false, 'reason', 'bad_plan', 'detail', 'shape');
  end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'commit_claims_run requires READ COMMITTED, got %', current_setting('transaction_isolation');
  end if;

  -- Locks, always in this order: the run, the order, then (inside record_trade_atomic) the trades.
  perform pg_advisory_xact_lock(hashtextextended('claims-run:' || p_league_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('waiver-order:' || p_league_id::text, 0));

  if exists (select 1 from public.claims_runs r where r.league_id = p_league_id and r.run_date = p_run_date) then
    return jsonb_build_object('ok', false, 'reason', 'already_ran');
  end if;

  -- CAS: the pending claim set, exactly (and locked, so a cancel waits for this transaction).
  select coalesce(array_agg(x::uuid order by x::uuid), '{}') into v_claim_ids
    from jsonb_array_elements_text(p_plan -> 'claim_ids') x;
  select coalesce(array_agg(c.id order by c.id), '{}') into v_seen_ids
    from (select c.id from public.claims c
           where c.league_id = p_league_id and c.status = 'pending' and c.run_date <= p_run_date
           order by c.id for update) c;
  if v_seen_ids is distinct from v_claim_ids then
    return jsonb_build_object('ok', false, 'reason', 'claims_changed');
  end if;

  -- CAS: the waiver order, exactly.
  select coalesce(jsonb_agg(jsonb_build_object('user_id', w.user_id, 'position', w.position) order by w.position), '[]'::jsonb)
    into v_order from public.waiver_order w where w.league_id = p_league_id;
  if v_order is distinct from (
       select coalesce(jsonb_agg(jsonb_build_object('user_id', e ->> 'user_id', 'position', (e ->> 'position')::int)
                                 order by (e ->> 'position')::int), '[]'::jsonb)
         from jsonb_array_elements(p_plan -> 'order') e) then
    return jsonb_build_object('ok', false, 'reason', 'order_changed');
  end if;

  -- The plan's shape against the claims: one outcome per claim, exactly; steps only for won claims;
  -- a won claim has exactly its buy, preceded by its sale when it is funded by one. (What happens to a
  -- claim whose day passed with no run is decided in ONE place, claims-run/plan.ts onMissedDay; the
  -- commit does not second-guess it.)
  if jsonb_array_length(v_outcomes) <> cardinality(v_claim_ids)
     or (select count(distinct (o ->> 'claim_id')) from jsonb_array_elements(v_outcomes) o) <> cardinality(v_claim_ids)
     or exists (select 1 from jsonb_array_elements(v_outcomes) o
                 where (o ->> 'claim_id') is null or not ((o ->> 'claim_id')::uuid = any (v_claim_ids))
                    or (o ->> 'status') is null or (o ->> 'status') not in ('won', 'lost', 'failed')
                    or nullif(o ->> 'reason', '') is null and (o ->> 'status') <> 'won') then
    return jsonb_build_object('ok', false, 'reason', 'bad_plan', 'detail', 'outcomes');
  end if;
  -- Every step belongs to a claim of THIS plan (so to a pending claim of this league, locked above),
  -- is a sell or a buy, and carries a positive quantity and price (the security review: a step for a
  -- claim outside the plan was otherwise never rejected).
  if exists (select 1 from jsonb_array_elements(v_steps) e
              where jsonb_typeof(e) <> 'object'
                 or (e ->> 'claim_id') is null
                 or (e ->> 'claim_id') !~ '^[0-9a-fA-F-]{36}$'
                 or not ((e ->> 'claim_id')::uuid = any (v_claim_ids))
                 or (e ->> 'action') is distinct from 'buy' and (e ->> 'action') is distinct from 'sell'
                 or jsonb_typeof(e -> 'quantity') is distinct from 'number' or (e ->> 'quantity')::numeric <= 0
                 or jsonb_typeof(e -> 'price') is distinct from 'number' or (e ->> 'price')::numeric <= 0
                 or jsonb_typeof(e -> 'total_value') is distinct from 'number' or (e ->> 'total_value')::numeric <= 0) then
    return jsonb_build_object('ok', false, 'reason', 'bad_plan', 'detail', 'step_shape');
  end if;
  for v_out in select * from jsonb_array_elements(v_outcomes) loop
    select * into v_claim from public.claims c where c.id = (v_out ->> 'claim_id')::uuid;
    select count(*) into v_n from jsonb_array_elements(v_steps) s where s ->> 'claim_id' = v_claim.id::text;
    if (v_out ->> 'status') = 'won' then
      if v_n <> (case when v_claim.funded_by = 'sale' then 2 else 1 end)
         or not exists (select 1 from jsonb_array_elements(v_steps) with ordinality s(e, i)
                         where e ->> 'claim_id' = v_claim.id::text and e ->> 'action' = 'buy'
                           and (v_claim.funded_by = 'cash' or exists (
                                 select 1 from jsonb_array_elements(v_steps) with ordinality s2(e2, i2)
                                  where e2 ->> 'claim_id' = v_claim.id::text and e2 ->> 'action' = 'sell' and i2 < s.i))) then
        return jsonb_build_object('ok', false, 'reason', 'bad_plan', 'detail', 'won_steps', 'claim_id', v_claim.id);
      end if;
    elsif v_n <> 0 then
      return jsonb_build_object('ok', false, 'reason', 'bad_plan', 'detail', 'steps_for_unwon', 'claim_id', v_claim.id);
    end if;
  end loop;

  begin  -- a subtransaction: any refusal below rolls ALL of it back
    v_i := 0;
    for v_step in select * from jsonb_array_elements(v_steps) loop
      v_i := v_i + 1;
      select * into v_claim from public.claims c where c.id = (v_step ->> 'claim_id')::uuid;
      v_sym := case v_step ->> 'action' when 'buy' then v_claim.symbol when 'sell' then v_claim.sell_symbol end;
      if v_sym is null or (v_step ->> 'ref') is null or (v_step ->> 'ref') not like 'ref:%' or v_refs ? (v_step ->> 'ref') then
        raise exception 'bad step' using errcode = 'P0C01',
          detail = jsonb_build_object('reason', 'bad_plan', 'detail', 'step', 'step', v_i)::text;
      end if;
      v_funded := case
        when (v_step ->> 'funded_by') is null then null
        when (v_step ->> 'funded_by') like 'ref:%' then (v_refs ->> (v_step ->> 'funded_by'))::uuid
        else (v_step ->> 'funded_by')::uuid end;
      if (v_step ->> 'funded_by') like 'ref:%' and v_funded is null then
        raise exception 'unknown ref' using errcode = 'P0C01',
          detail = jsonb_build_object('reason', 'bad_plan', 'detail', 'funded_by_ref', 'step', v_i)::text;
      end if;
      -- A named sale is a BUY's own claimant's SELL in this league (security review: a stray uuid
      -- would otherwise burn another manager's proceeds through the unique funded_by index).
      if v_funded is not null and (v_step ->> 'action') = 'buy' and not exists (
        select 1 from public.trades t
         where t.id = v_funded and t.league_id = p_league_id and t.action = 'sell'
           and t.user_id::text = v_claim.user_id) then
        raise exception 'foreign sale' using errcode = 'P0C01',
          detail = jsonb_build_object('reason', 'bad_plan', 'detail', 'funded_by_not_own_sale', 'step', v_i)::text;
      end if;
      select coalesce(array_agg(case when x like 'ref:%' then (v_refs ->> x)::uuid else x::uuid end order by o), '{}')
        into v_seen_t
        from jsonb_array_elements_text(coalesce(v_step -> 'seen_trade_ids', '[]'::jsonb)) with ordinality t(x, o);
      if array_position(v_seen_t, null) is not null then
        raise exception 'unknown ref' using errcode = 'P0C01',
          detail = jsonb_build_object('reason', 'bad_plan', 'detail', 'seen_ref', 'step', v_i)::text;
      end if;

      v_res := public."record_trade_atomic"(
        p_league_id,
        v_claim.user_id::uuid,
        v_sym,
        v_step ->> 'action',
        (v_step ->> 'quantity')::numeric,
        (v_step ->> 'price')::numeric,
        (v_step ->> 'total_value')::numeric,
        v_funded,
        v_seen_t,
        coalesce((select array_agg(x order by o) from jsonb_array_elements_text(coalesce(v_step -> 'seen_draft_ids', '[]'::jsonb)) with ordinality t(x, o)), '{}'),
        v_step -> 'rules',
        v_step -> 'slots',
        nullif(v_step ->> 'slot_id', '')::uuid);
      if coalesce((v_res ->> 'ok')::boolean, false) is not true then
        raise exception 'step refused' using errcode = 'P0C01',
          detail = jsonb_build_object('reason', 'step_refused', 'step', v_i, 'claim_id', v_claim.id,
                                      'refusal', v_res ->> 'reason', 'changed', v_res -> 'changed')::text;
      end if;
      v_refs := v_refs || jsonb_build_object(v_step ->> 'ref', v_res -> 'trade' ->> 'id');
    end loop;

    -- Outcomes, in the plan's order (won ones in win order).
    select coalesce(array_agg(w.user_id order by w.position), '{}') into v_queue
      from public.waiver_order w where w.league_id = p_league_id;
    for v_out in select * from jsonb_array_elements(v_outcomes) loop
      select * into v_claim from public.claims c where c.id = (v_out ->> 'claim_id')::uuid;
      v_status := v_out ->> 'status';
      v_buy := null; v_sell := null;
      if v_status = 'won' then
        select (v_refs ->> (e ->> 'ref'))::uuid into v_buy from jsonb_array_elements(v_steps) e
         where e ->> 'claim_id' = v_claim.id::text and e ->> 'action' = 'buy';
        select (v_refs ->> (e ->> 'ref'))::uuid into v_sell from jsonb_array_elements(v_steps) e
         where e ->> 'claim_id' = v_claim.id::text and e ->> 'action' = 'sell';
        select * into v_buy_row from public.trades t where t.id = v_buy;
        v_sell_row := null;
        if v_sell is not null then
          select * into v_sell_row from public.trades t where t.id = v_sell;
        end if;
        -- The ending's facts come from the rows written, not from the plan.
        v_out := jsonb_set(v_out, '{detail}', coalesce(v_out -> 'detail', '{}'::jsonb) || jsonb_build_object(
          'price', v_buy_row.price, 'quantity', v_buy_row.quantity, 'slot_id', v_buy_row.slot_id,
          'sell_price', v_sell_row.price, 'sell_quantity', v_sell_row.quantity));
        v_won := v_won + 1;
        -- Any won claim moves the winner to the back, in the order they won.
        v_queue := array_remove(v_queue, v_claim.user_id) || v_claim.user_id;
      elsif v_status = 'lost' then
        v_lost := v_lost + 1;
      elsif (v_out ->> 'reason') = 'missed_run' then
        v_missed := v_missed + 1;
      else
        v_failed := v_failed + 1;
      end if;

      update public.claims c
         set status = v_status,
             reason = case when v_status = 'won' then null else v_out ->> 'reason' end,
             outcome = coalesce(v_out -> 'detail', '{}'::jsonb),
             pending_slot = null,
             resolved_at = now(),
             buy_trade_id = v_buy,
             sell_trade_id = v_sell
       where c.id = v_claim.id and c.status = 'pending';
      get diagnostics v_n = row_count;
      if v_n <> 1 then
        raise exception 'claim moved' using errcode = 'P0C01',
          detail = jsonb_build_object('reason', 'claims_changed', 'claim_id', v_claim.id)::text;
      end if;

      -- A notice ONLY for a claim that FILLED (point 11). Lost, failed and missed claims write
      -- nothing here or anywhere else; their status and reason are on the claims row above.
      if v_status = 'won' then
        insert into public.league_notifications (league_id, user_id, kind, detail)
        values (p_league_id, v_claim.user_id, 'claim_won',
                coalesce(v_out -> 'detail', '{}'::jsonb) || jsonb_build_object(
                  'claim_id', v_claim.id, 'symbol', v_claim.symbol, 'sell_symbol', v_claim.sell_symbol,
                  'run_date', p_run_date));
      end if;
    end loop;

    if v_won > 0 then
      delete from public.waiver_order where league_id = p_league_id;
      insert into public.waiver_order (league_id, user_id, position)
      select p_league_id, u, i::int from unnest(v_queue) with ordinality as t(u, i);
    end if;

    insert into public.claims_runs (league_id, run_date, claims_won, claims_lost, claims_failed, claims_missed)
    values (p_league_id, p_run_date, v_won, v_lost, v_failed, v_missed);
  exception when sqlstate 'P0C01' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return jsonb_build_object('ok', false) || v_detail::jsonb;
  end;

  return jsonb_build_object('ok', true, 'won', v_won, 'lost', v_lost, 'failed', v_failed, 'missed', v_missed);
end;
$$;

-- 9. The weekly reset -----------------------------------------------------------------------------
--
-- reset_due_waiver_orders() -> jsonb {reset: n, failed: [{league_id, error}]}
-- For every drafted, unfinished matchup league: W = the highest week through which EVERY matchup is
-- scored (counted, not "any row": a week with one unscored game is not scored). A game is scored
-- only when BOTH halves are written: team1_gain set AND, unless it is a bye (team2_user_id NULL keeps
-- team2_gain NULL by design), team2_gain set. A half-written game (team1_gain set, team2_gain NULL,
-- two teams) leaves its week unscored (Copilot on #608, the partial-state family). When W passed the
-- week the order was last reset through, the order becomes the reverse of league_standings_ranked
-- through min(W, num_weeks) (last place first; the standings' own tiebreaks), then any member the
-- ranking does not list, in reverse draft order. Idempotent: called on every process-week-results
-- run, so a reset that failed is retried by the next run. One league's failure never stops another's.
-- PLAYOFF WEEKS reset too (the rule as written: "after each week is scored the order resets to
-- reverse standings"). Standings stop moving after the regular season, so a playoff week's reset puts
-- the order back on the final standings and undoes that week's claim moves. A Planner question if
-- that is not wanted: cap the stored week at num_weeks.
create or replace function public.reset_due_waiver_orders()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_l      record;
  v_w      integer;
  v_done   integer;
  v_order  text[];
  v_reset  integer := 0;
  v_failed jsonb := '[]'::jsonb;
begin
  for v_l in
    select l.id, l.num_weeks from public.leagues l
     where l.draft_status = 'completed' and l.season_status is distinct from 'completed'
       and l.league_type = 'matchup'
     order by l.id
  loop
    begin
      perform pg_advisory_xact_lock(hashtextextended('waiver-order:' || v_l.id::text, 0));
      -- The first week with ANY game not fully scored; W is the week before it (or the last week).
      select coalesce(min(m.week_number) filter (
                        where m.team1_gain is null
                           or (m.team2_user_id is not null and m.team2_gain is null)) - 1,
                      max(m.week_number))
        into v_w from public.matchups m where m.league_id = v_l.id;
      select coalesce(max(wm.reset_through_week), 0) into v_done from public.waiver_order_meta wm where wm.league_id = v_l.id;
      if v_w is null or v_w <= v_done then
        continue;
      end if;
      select coalesce(array_agg(x.uid order by x.k1, x.k2, x.k3 collate "C"), '{}') into v_order
        from (
          select m.user_id as uid,
                 case when r.rank is not null then 0 else 1 end as k1,
                 coalesce(-r.rank, -coalesce(o.position, -2147483647)) as k2,
                 m.user_id as k3
            from public.league_members m
            left join public.league_standings_ranked(v_l.id, least(v_w, coalesce(v_l.num_weeks, v_w))) r
              on r.user_id = m.user_id
            left join public.league_draft_order o on o.league_id = m.league_id and o.user_id = m.user_id
           where m.league_id = v_l.id
        ) x;
      delete from public.waiver_order where league_id = v_l.id;
      insert into public.waiver_order (league_id, user_id, position)
      select v_l.id, u, i::int from unnest(v_order) with ordinality as t(u, i);
      insert into public.waiver_order_meta (league_id, reset_through_week, updated_at)
      values (v_l.id, v_w, now())
      on conflict (league_id) do update set reset_through_week = excluded.reset_through_week, updated_at = now();
      v_reset := v_reset + 1;
    exception when others then
      v_failed := v_failed || jsonb_build_object('league_id', v_l.id, 'error', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('reset', v_reset, 'failed', v_failed);
end;
$$;

-- 10. finalize_league_draft: 20261115000000's body, VERBATIM, plus the order's init ------------------
-- The ONLY change is the block before the final RETURN: the waiver order starts as the reverse of the
-- draft order. It can never fail the finalize (the draft is the thing that matters): an error is a
-- WARNING and the claims run heals a missing order (_waiver_order_fill) before it reads one.
create or replace function public.finalize_league_draft(
  p_league_id    uuid,
  p_member_ids   text[],        -- canonical order (computeDraftOrder)
  p_league_start timestamptz,
  p_league_end   timestamptz,
  p_matchups     jsonb          -- [{week_number, team1_user_id, team2_user_id, week_start, week_end}]; [] for duration
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_league            leagues%rowtype;
  v_n_members         int;
  v_n_rows            int;
  v_max_week          int;
  v_existing          int;
  v_matchups_inserted int := 0;
  v_standings_added   int := 0;
  v_season_created    boolean := false;
  v_season_id         uuid;
  v_status_flipped    boolean := false;
  v_schedule_fresh    boolean := false;
  v_ok                boolean;
begin
  -- 1. Serialize concurrent finalizers (last pick racing a heal retry).
  select * into v_league from leagues where id = p_league_id for update;
  if not found then
    return jsonb_build_object('status', 'refused', 'reason', 'league_not_found');
  end if;
  if v_league.draft_status not in ('in_progress', 'completed') then
    return jsonb_build_object('status', 'refused', 'reason', 'draft_not_started');
  end if;

  -- 2. Roster: p_member_ids must be exactly the league's member SET (no dups, no
  --    nulls). Explicit ::text on both sides — league_members.user_id is text, but
  --    this codebase mixes text/uuid user ids across tables (drafts vs trades).
  if p_member_ids is null or cardinality(p_member_ids) = 0
     or array_position(p_member_ids, null) is not null
     or (select count(distinct x) from unnest(p_member_ids) x) <> cardinality(p_member_ids) then
    return jsonb_build_object('status', 'refused', 'reason', 'invalid_payload', 'detail', 'member_ids');
  end if;
  v_n_members := cardinality(p_member_ids);

  if exists (
    (select m.user_id::text from league_members m where m.league_id = p_league_id
     except select x::text from unnest(p_member_ids) x)
    union all
    (select x::text from unnest(p_member_ids) x
     except select m.user_id::text from league_members m where m.league_id = p_league_id)
  ) then
    return jsonb_build_object('status', 'refused', 'reason', 'roster_mismatch');
  end if;

  -- 3. Window.
  if p_league_start is null or p_league_end is null or p_league_start >= p_league_end then
    return jsonb_build_object('status', 'refused', 'reason', 'invalid_payload', 'detail', 'league_window');
  end if;

  -- 4. Matchup payload (defense in depth: service_role is trusted, but a second
  --    caller must not be able to write a malformed schedule through this).
  if p_matchups is null or jsonb_typeof(p_matchups) <> 'array' then
    return jsonb_build_object('status', 'refused', 'reason', 'invalid_payload', 'detail', 'matchups_not_array');
  end if;
  v_n_rows := jsonb_array_length(p_matchups);

  if v_league.league_type = 'duration' then
    if v_n_rows <> 0 then
      return jsonb_build_object('status', 'refused', 'reason', 'invalid_payload', 'detail', 'duration_has_matchups');
    end if;
  elsif v_league.league_type = 'matchup' then
    if v_n_rows = 0 or v_n_members < 2 then
      return jsonb_build_object('status', 'refused', 'reason', 'invalid_payload', 'detail', 'empty_schedule');
    end if;

    -- Field types: a non-integer week or unparseable timestamp raises a class-22
    -- data_exception inside jsonb_to_recordset; turn that into a clean refusal.
    begin
      select
        bool_and(r.week_number >= 1
                 and r.team1_user_id is not null
                 and r.team1_user_id = any (p_member_ids)
                 and (r.team2_user_id is null
                      or (r.team2_user_id = any (p_member_ids) and r.team2_user_id <> r.team1_user_id))
                 and r.week_start is not null and r.week_end is not null
                 and r.week_start < r.week_end),
        max(r.week_number)
      into v_ok, v_max_week
      from jsonb_to_recordset(p_matchups) as r(
        week_number int, team1_user_id text, team2_user_id text,
        week_start timestamptz, week_end timestamptz);
    exception when data_exception then
      return jsonb_build_object('status', 'refused', 'reason', 'invalid_payload', 'detail', 'field_types');
    end;
    if not coalesce(v_ok, false) then
      return jsonb_build_object('status', 'refused', 'reason', 'invalid_payload', 'detail', 'row_fields');
    end if;

    -- Weeks contiguous from 1, and every member exactly once in every week
    -- (a completeness check, not just "no duplicates": a truncated payload fails).
    if exists (
      with r as (
        select * from jsonb_to_recordset(p_matchups) as r(
          week_number int, team1_user_id text, team2_user_id text)
      ), appearances as (
        select week_number, team1_user_id as uid from r
        union all
        select week_number, team2_user_id from r where team2_user_id is not null
      ), grid as (
        select w, u from generate_series(1, v_max_week) w, unnest(p_member_ids) u
      )
      select 1 from grid g
      left join appearances a on a.week_number = g.w and a.uid = g.u
      group by g.w, g.u
      having count(a.uid) <> 1
    ) then
      return jsonb_build_object('status', 'refused', 'reason', 'invalid_payload', 'detail', 'week_coverage');
    end if;

    if v_league.num_weeks is not null and v_league.num_weeks <> v_max_week then
      return jsonb_build_object('status', 'refused', 'reason', 'invalid_payload', 'detail', 'num_weeks_mismatch');
    end if;

    -- 5. Existing schedule: compare a COUNT against the expected set.
    select count(*) into v_existing
    from matchups where league_id = p_league_id and coalesce(is_playoff, false) = false;
    if v_existing <> 0 and v_existing <> v_n_rows then
      return jsonb_build_object('status', 'refused', 'reason', 'schedule_mismatch',
                                'existing', v_existing, 'expected', v_n_rows);
    end if;
    v_schedule_fresh := (v_existing = 0);
  else
    return jsonb_build_object('status', 'refused', 'reason', 'unknown_league_type');
  end if;

  -- ---- All validation passed; writes below. -------------------------------

  if v_schedule_fresh then
    insert into matchups (league_id, week_number, team1_user_id, team2_user_id, week_start, week_end, is_playoff)
    select p_league_id, r.week_number, r.team1_user_id, r.team2_user_id, r.week_start, r.week_end, false
    from jsonb_to_recordset(p_matchups) as r(
      week_number int, team1_user_id text, team2_user_id text,
      week_start timestamptz, week_end timestamptz);
    get diagnostics v_matchups_inserted = row_count;
  end if;

  if v_league.league_type = 'matchup' then
    insert into league_standings (league_id, user_id)
    select p_league_id, x::text from unnest(p_member_ids) x
    on conflict (league_id, user_id) do nothing;
    get diagnostics v_standings_added = row_count;
  end if;

  -- Season 1 (only when the league has no current season).
  if v_league.current_season_id is null then
    insert into league_seasons (league_id, season_number, started_at)
    values (p_league_id, v_league.season_number, coalesce(v_league.league_start_date, p_league_start))
    on conflict (league_id, season_number) do nothing;
    v_season_created := found;
    select id into v_season_id from league_seasons
    where league_id = p_league_id and season_number = v_league.season_number;
  end if;

  update leagues set
    league_start_date = case when v_schedule_fresh then p_league_start
                             else coalesce(league_start_date, p_league_start) end,
    league_end_date   = case when v_schedule_fresh then p_league_end
                             else coalesce(league_end_date, p_league_end) end,
    num_weeks         = case when league_type = 'matchup' then coalesce(num_weeks, v_max_week)
                             else num_weeks end,
    current_season_id = coalesce(current_season_id, v_season_id),
    draft_status      = 'completed'
  where id = p_league_id;

  v_status_flipped := (v_league.draft_status = 'in_progress');

  -- 20261211000000: the waiver order starts as the reverse of the draft order. Never fails the
  -- finalize; a subtransaction, so a failure here writes nothing of the order.
  begin
    perform public._waiver_order_fill(p_league_id);
  exception when others then
    raise warning 'finalize_league_draft: waiver order not initialised for %: %', p_league_id, sqlerrm;
  end;

  return jsonb_build_object(
    'status', case when v_status_flipped or v_matchups_inserted > 0 or v_standings_added > 0
                        or v_season_created then 'finalized' else 'already_finalized' end,
    'matchups_inserted', v_matchups_inserted,
    'standings_inserted', v_standings_added,
    'season_created', v_season_created);
end;
$$;

-- 11. Grants (CLAUDE.md: REVOKE FROM PUBLIC leaves Supabase's explicit per-role grants) -------------

revoke all on function public._claims_season_end(uuid)                  from public, anon, authenticated, service_role;
revoke all on function public._waiver_order_fill(uuid)                  from public, anon, authenticated, service_role;
revoke all on function public.claims_before_insert()                    from public, anon, authenticated, service_role;
revoke all on function public.place_claim(uuid, text, text)             from public, anon, authenticated, service_role;
revoke all on function public.cancel_claim(uuid, text)                  from public, anon, authenticated, service_role;
revoke all on function public.claims_run_day()                          from public, anon, authenticated, service_role;
revoke all on function public.claims_run_state(uuid, date)              from public, anon, authenticated, service_role;
revoke all on function public.claims_hold_active(uuid)                  from public, anon, authenticated, service_role;
revoke all on function public.commit_claims_run(uuid, date, jsonb)      from public, anon, authenticated, service_role;
revoke all on function public.reset_due_waiver_orders()                 from public, anon, authenticated, service_role;

grant execute on function public.place_claim(uuid, text, text)          to authenticated;
grant execute on function public.cancel_claim(uuid, text)               to authenticated;
grant execute on function public.claims_run_day()                       to service_role;
grant execute on function public.claims_run_state(uuid, date)           to service_role;
grant execute on function public.claims_hold_active(uuid)               to service_role;
grant execute on function public.commit_claims_run(uuid, date, jsonb)   to service_role;
grant execute on function public.reset_due_waiver_orders()              to service_role;

-- finalize_league_draft: CREATE OR REPLACE keeps the ACL; restated as 20261115000000 states it.
revoke all on function public.finalize_league_draft(uuid, text[], timestamptz, timestamptz, jsonb) from public;
revoke all on function public.finalize_league_draft(uuid, text[], timestamptz, timestamptz, jsonb) from anon;
revoke all on function public.finalize_league_draft(uuid, text[], timestamptz, timestamptz, jsonb) from authenticated;
grant execute on function public.finalize_league_draft(uuid, text[], timestamptz, timestamptz, jsonb) to service_role;

-- 12. Backfill: every drafted, unfinished league gets its order now --------------------------------
-- Reverse draft order first; then the reset puts a league with a scored week on reverse standings.
do $$
declare v_id uuid;
begin
  for v_id in select l.id from public.leagues l
               where l.draft_status = 'completed' and l.season_status is distinct from 'completed'
               order by l.id loop
    perform public._waiver_order_fill(v_id);
  end loop;
end $$;
select public.reset_due_waiver_orders();
