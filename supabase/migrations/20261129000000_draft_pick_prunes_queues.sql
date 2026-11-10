-- ============================================================================
-- A drafted stock leaves every queue at once (draft room plan, decision 19).
-- ============================================================================
-- Giorgio, 2026-11-10 (plan amendment docs/plan-draft-room-queue-recap):
--   "A drafted stock leaves every queue at once, server and screen, with no
--    Save step."
-- Build 12 (League B draft): after he drafted DNUT it stayed in "Your queue ·
-- 1 of 50", then showed "0 of 50 / Save queue / Not saved yet." Nothing on the
-- server ever removed a drafted symbol from a draft_queue row, so every queue
-- that held it kept it (the auto-pick skipped it only because
-- planQueueCandidates filters stocks already owned in the league).
--
-- THE RULE: no draft_queue row names a stock already drafted in that league.
-- Two writers can break it, and this migration covers both:
--   1. drafts INSERT (a new pick)   -> trg_drafts_prune_queues deletes that
--      symbol from EVERY manager's queue in the league (not only the picker's).
--   2. set_draft_queue (a save)     -> re-created VERBATIM from 20261010000000
--      plus ONE marked change: drafted symbols are dropped from what it stores
--      and from the `symbols` it returns, so a save from a screen that has not
--      seen the pick yet cannot put the stock back. Dropped, not refused: a
--      refusal would show "Not saved" for a removal the player never made.
--   3. a one-off cleanup of the rows that already break it (League B's DNUT
--      among them).
-- ONE KNOWN GAP (supabase review, accepted): a save and a pick on the same
-- symbol committing in the same instant can each miss the other's uncommitted
-- row (the save's filter cannot see the pick; the prune cannot see the save),
-- leaving one stale row. Harmless where it matters: the auto-pick never takes
-- a stock owned in the league (planQueueCandidates), the app drops drafted
-- stocks from the list it shows and saves (queueBaseline, decision 19 client),
-- and the next save of that queue drops it. Closing it would mean locking every
-- member row of the league on each pick; not worth the deadlock surface.
--
-- LEGACY SKIP: drafts still holds pre-20261106 'SKIP' rows (a forfeited turn,
-- not a stock). The cleanup and the save filter ignore them, so a real ticker
-- named SKIP could still be queued. The trigger never sees a SKIP insert:
-- drafts_refuse_new_skip (BEFORE) refuses it first.
--
-- WHY A TRIGGER, NOT A DELETE IN _shared/draft-write.ts commitGatedPick:
--   * Same transaction as the pick. The delete runs inside the INSERT
--     statement, so the pick and the prune commit or roll back together. A
--     delete after the insert would be a second request: if it failed (or the
--     edge function died between them), the pick would stand and the queues
--     would keep the stock, a partial state nothing heals (CLAUDE.md, the
--     all-or-nothing family).
--   * Only the winning insert prunes. The race backstop is the drafts
--     (league_id, pick_number) unique index: a losing insert raises 23505 and
--     its statement, trigger included, leaves no trace. No extra code path.
--   * Every writer, not just the edge functions: validate-and-record-pick, the
--     auto-pick sweep, bots, and any future or SQL-editor insert all go through
--     the table.
--   * No deploy. Nothing in supabase/functions/ changes.
--   SECURITY DEFINER so the prune never depends on the inserting role's
--   draft_queue rights (the edge functions insert as service_role today; an
--   insert under RLS would otherwise delete only the rows that role can see,
--   which is a partial prune). search_path pinned; no API role may execute it
--   (a trigger function fires without an EXECUTE check).
--   LOAD-BEARING (security review): only service_role can INSERT into drafts
--   (20260811000003 dropped both client INSERT policies). If a client INSERT
--   policy is ever added back, this definer delete would let that client's
--   insert prune every manager's queue for the symbol: review this trigger then.
--
-- POSITIONS: the prune leaves a gap (1, 3, 4). Nothing reads position as a
-- count: clients and the auto-pick ORDER BY it, and the next set_draft_queue
-- rewrites the list densely. Closing the gap here would shift rows under the
-- non-deferrable unique (league_id, user_id, position) mid-statement.
--
-- Symbols: draft_queue.symbol is CHECKed upper case; drafts.symbol is compared
-- through upper() so a lower-case pick still prunes.
--
-- HUMAN ACTION (from the deploy checkout only, CLAUDE.md):
--   supabase db push --dry-run   -> lists ONLY 20261129000000
--   supabase db push
--   then the proacl + effect queries at the bottom of this file.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The prune: a new pick removes its symbol from every queue in the league
-- ---------------------------------------------------------------------------
create or replace function public.prune_drafted_symbol_from_queues()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.draft_queue q
   where q.league_id = new.league_id
     and q.symbol = upper(new.symbol);
  return null;
end;
$$;

comment on function public.prune_drafted_symbol_from_queues() is
  'AFTER INSERT on drafts (20261129000000, plan decision 19): the drafted symbol leaves every manager''s draft_queue in that league, in the pick''s own transaction. Trigger-only; no API role may execute it.';

revoke all on function public.prune_drafted_symbol_from_queues() from public;
revoke all on function public.prune_drafted_symbol_from_queues() from anon, authenticated, service_role;

drop trigger if exists trg_drafts_prune_queues on public.drafts;
create trigger trg_drafts_prune_queues
  after insert on public.drafts
  for each row execute function public.prune_drafted_symbol_from_queues();

-- ---------------------------------------------------------------------------
-- 2. set_draft_queue: VERBATIM from 20261010000000 + ONE marked change
-- ---------------------------------------------------------------------------
create or replace function public.set_draft_queue(p_league_id uuid, p_symbols text[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     text := auth.uid()::text;
  v_status  text;
  v_syms    text[];
  v_unknown text[];
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  perform 1 from public.league_members m
   where m.league_id = p_league_id and m.user_id = v_uid
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_a_member');
  end if;

  select l.draft_status into v_status from public.leagues l where l.id = p_league_id;
  if v_status = 'completed' then
    return jsonb_build_object('ok', false, 'reason', 'draft_completed');
  end if;

  -- Bound the raw input before doing any work on it.
  if coalesce(cardinality(p_symbols), 0) > 200 then
    return jsonb_build_object('ok', false, 'reason', 'too_many', 'max', 50);
  end if;

  select coalesce(array_agg(t.s order by t.first_ord), '{}')
    into v_syms
    from (
      select upper(btrim(u.x)) as s, min(u.ord) as first_ord
        from unnest(coalesce(p_symbols, '{}'::text[])) with ordinality as u(x, ord)
       where btrim(coalesce(u.x, '')) <> ''
       group by 1
    ) t;

  if cardinality(v_syms) > 50 then
    return jsonb_build_object('ok', false, 'reason', 'too_many', 'max', 50);
  end if;

  select array_agg(s) into v_unknown
    from unnest(v_syms) as s
   where not exists (select 1 from public.symbols y where y.symbol = s);
  if v_unknown is not null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_symbols', 'symbols', to_jsonb(v_unknown));
  end if;

  -- >>> 20261129000000 CHANGE (decision 19): a symbol already drafted in this
  -- league is not stored, and is not in the returned `symbols`. Order kept.
  select coalesce(array_agg(u.s order by u.ord), '{}')
    into v_syms
    from unnest(v_syms) with ordinality as u(s, ord)
   where not exists (select 1 from public.drafts d
                      where d.league_id = p_league_id and upper(d.symbol) = u.s
                        and upper(d.symbol) <> 'SKIP');
  -- <<< end 20261129000000 CHANGE

  delete from public.draft_queue q where q.league_id = p_league_id and q.user_id = v_uid;
  insert into public.draft_queue (league_id, user_id, symbol, position)
  select p_league_id, v_uid, s, ord::smallint
    from unnest(v_syms) with ordinality as u(s, ord);

  return jsonb_build_object('ok', true, 'symbols', to_jsonb(v_syms));
end;
$$;

-- Re-asserted (CREATE OR REPLACE keeps privileges, but never assume; CLAUDE.md).
revoke all on function public.set_draft_queue(uuid, text[]) from public;
revoke all on function public.set_draft_queue(uuid, text[]) from anon;
grant execute on function public.set_draft_queue(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. One-off: the rows that already break the invariant (idempotent)
-- ---------------------------------------------------------------------------
delete from public.draft_queue q
 using public.drafts d
 where d.league_id = q.league_id
   and upper(d.symbol) = q.symbol
   and upper(d.symbol) <> 'SKIP';

-- ---------------------------------------------------------------------------
-- VERIFY (after push; read-only)
-- ---------------------------------------------------------------------------
--   SELECT proname, proacl, prosecdef, proconfig
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public'
--      AND proname IN ('prune_drafted_symbol_from_queues', 'set_draft_queue');
--   -- prune_drafted_symbol_from_queues {postgres=X/postgres}, t, {"search_path=public, pg_temp"}
--   -- set_draft_queue: UNCHANGED from before the push. Prod (db-snapshot) has
--   --   {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}; no anon, no bare "=X".
--
--   SELECT tgname, tgenabled, pg_get_triggerdef(t.oid)
--     FROM pg_trigger t WHERE tgrelid = 'public.drafts'::regclass AND tgname = 'trg_drafts_prune_queues';
--   -- one row, tgenabled 'O', AFTER INSERT ... FOR EACH ROW
--
--   -- Still no client INSERT policy on drafts (expect no INSERT row):
--   SELECT policyname, cmd, roles FROM pg_policies WHERE schemaname = 'public' AND tablename = 'drafts';
--
--   -- No queued stock is already drafted in its league (expect 0; a nonzero
--   -- count right after a pick+save collision heals on that queue's next save):
--   SELECT count(*) FROM draft_queue q JOIN drafts d
--     ON d.league_id = q.league_id AND upper(d.symbol) = q.symbol AND upper(d.symbol) <> 'SKIP';
