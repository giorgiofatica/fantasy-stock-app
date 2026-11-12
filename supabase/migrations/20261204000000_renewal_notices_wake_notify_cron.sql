-- ============================================================================
-- The draft-order-notify post guard counts the Run it back kinds too
-- ============================================================================
-- THE BUG. The draft_order_notify cron (20261111000003) posts ONLY when
-- public.draft_room_notices_due() is true. Its third arm (20261111000000 §10)
-- counted a pending (or stale 'sending') notice of the six draft-room kinds
-- only, commented "= plan.ts DELIVERED_KINDS". But draft-order-notify selects
-- and delivers DELIVERED_KINDS AND RENEWAL_KINDS (run.ts: `.in('kind',
-- [...DELIVERED_KINDS, ...RENEWAL_KINDS])`, since d9266d1b). So a pending
-- renewal_invite / renewal_reply / renewal_nudge / renewal_removed /
-- season_set push sat until some draft-room event happened to wake the cron.
-- The 20261111000000 comment said the renewal kinds were "delivered by another
-- function"; no other function delivers them (grep supabase/functions).
--
-- This is the CLAUDE.md filter-then-conclude family: the guard's scope (six
-- kinds) was narrower than the scope of what it guards (eleven kinds), and it
-- read "nothing to do" from the subset.
--
-- THE FIX. The same function, with its third arm's kind list widened to
-- DELIVERED_KINDS + RENEWAL_KINDS. Every other line is byte-identical to
-- 20261111000000 (supabase/tests/renewal_notices_wake_notify_cron.pglite.test.ts
-- proves it by undoing the marked lines). Same signature, LANGUAGE sql STABLE
-- SECURITY INVOKER, same search_path pin, same stale interval ('10 minutes' =
-- plan.ts STALE_SENDING_MS). No debounce is encoded here: the draft_time_set
-- TIME_SET_QUIET_MS wait lives in run.ts (isDebouncing), as before.
--
-- ONE GATE, NOT TWO. The renewal kinds are delivered by the same function, the
-- same select, the same claim/settle loop, so a second guard would only be a
-- second hand-copied list. The parity test imports both TS lists and fails if
-- the SQL ever differs from their union, in either direction.
--
-- NOT CHANGED: draft_order_notify_due() (#126). No cron and no code calls it
-- any more (20261111000003 replaced it as the guard; db-snapshot confirms the
-- live command). Left as is.
--
-- GRANTS. CREATE OR REPLACE keeps the existing ACL (postgres + service_role
-- only, 20261111000000), so this file grants nothing.
--
-- HUMAN ACTION after `supabase db push` (from the deploy checkout):
--   SELECT position('renewal_invite' in prosrc) > 0 AS widened, prosecdef, proconfig
--     FROM pg_proc WHERE proname = 'draft_room_notices_due';
--   -- widened = t, prosecdef = f, proconfig = {"search_path=public, pg_temp"}
--   SELECT proname, proacl FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND proname = 'draft_room_notices_due';
--   -- {postgres=X/postgres,service_role=X/postgres}: no anon=, no authenticated=, no =X
-- ============================================================================

create or replace function public.draft_room_notices_due()
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select exists (
           select 1
             from public.leagues l
             join public.draft_start_watch w on w.league_id = l.id and w.draft_date = l.draft_date
            where l.draft_status = 'not_started'
              and now() >= l.draft_date - make_interval(secs => (public.draft_start_policy()->>'room_lead_s')::int)
              and w.gate_cleared_at is not null
              and w.room_opened_at is null
              and not exists (select 1 from public.draft_postponements x where x.league_id = l.id))
      or exists (
           select 1
             from public.draft_start_watch w
             join public.leagues l on l.id = w.league_id and l.draft_date = w.draft_date
             join public.league_draft_order o on o.league_id = w.league_id
            where l.draft_status = 'not_started'
              and w.room_opened_at is not null
              and o.user_id not like 'bot-%'
              and not exists (select 1 from public.league_notifications x
                               where x.league_id = o.league_id and x.user_id = o.user_id
                                 and x.kind = 'draft_room_open' and x.created_at >= w.room_opened_at))
      or exists (
           select 1 from public.league_notifications n
            where n.kind in ('draft_room_open', 'draft_started', 'draft_at_risk', 'draft_at_risk_reminder',
                             'draft_postponed', 'draft_time_set',   -- = plan.ts DELIVERED_KINDS
                             'renewal_invite', 'renewal_reply', 'renewal_nudge', 'renewal_removed',
                             'season_set')   -- 20261204000000: + plan.ts RENEWAL_KINDS
              and (n.push_status = 'pending'
                   or (n.push_status = 'sending' and n.push_attempted_at < now() - interval '10 minutes')));
$$;
