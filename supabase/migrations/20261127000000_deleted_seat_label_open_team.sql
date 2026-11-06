-- ============================================================================
-- A deleted manager's seat reads "Open team" (was "Former manager")
-- ============================================================================
-- Giorgio, 2026-11-06 (PRODUCT_RULES, "Account deletion", board pick
-- #call-del-label): "B: Open Team". The seat label changes from the Planner's
-- recommendation, "Former manager" (2026-10-21), to "Open team", everywhere a
-- deleted manager's name would be. 20261125000001 said it: "edit this constant,
-- nothing else". We never edit an applied migration (db push tracks versions,
-- not content), so this is a NEW file that re-creates the one function.
--
-- WHAT THIS FILE DOES
--   1. deleted_manager_label() now returns 'Open team'. Everything that READS the
--      label (league_participant_display_name, get_visible_profiles,
--      take_over_team's seat_label, the delete-account lines) picks it up on the
--      next call. It still contains a space, so it can never equal a username
--      (user_profiles_username_format is ^[A-Za-z0-9_]{3,20}$); the PGlite suite
--      pins both.
--   2. BACKFILL. The old wording was STORED in two places, written once by
--      scrub_deleted_manager (20261125000005) and, for a pre-draft leave, by
--      _leave_league_before_draft (20261125000004), as name snapshots:
--        a. league_roster_reconfirm.departed[].name
--        b. league_notifications.detail 'subject_name' / 'commissioner_name'
--      Without this step those old rows would keep saying "Former manager"
--      beside seats that now say "Open team". Both updates match the OLD LITERAL
--      by exact equality (no usernames contain a space, so no real name can
--      equal it) and write deleted_manager_label(), so they are idempotent: a
--      second run finds nothing. Nothing else stores the label: league_members
--      keeps frozen_username NULL on a deleted seat (the freeze trigger), and
--      every other surface resolves it live through the functions above.
--      scrub_deleted_manager itself reads deleted_manager_label() at run time,
--      so an account deleted after this push is stored as "Open team" already.
--
-- SECURITY. CREATE OR REPLACE FUNCTION keeps the ACL and the attributes, and the
-- grants are re-asserted below EXACTLY as 20261125000001 set them (authenticated
-- and service_role may execute; public and anon may not). No widening. The
-- label is a constant, no data. The backfill is a one-off write by the migration
-- owner; it adds no policy and no grant.
--
-- POST-PUSH CHECKS (SQL editor):
--   SELECT deleted_manager_label();                       -- Open team
--   SELECT proname, prosecdef, proconfig, proacl FROM pg_proc
--    WHERE proname = 'deleted_manager_label';
--   -- {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}; no anon, no PUBLIC.
--   SELECT count(*) FROM public.league_notifications
--    WHERE detail->>'subject_name' = 'Former manager' OR detail->>'commissioner_name' = 'Former manager';  -- 0
--   SELECT count(*) FROM public.league_roster_reconfirm rc, jsonb_array_elements(rc.departed) e
--    WHERE e->>'name' = 'Former manager';                                                                  -- 0
-- ============================================================================

-- ---- 1. the label ------------------------------------------------------------
create or replace function public.deleted_manager_label()
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select 'Open team'::text
$$;

comment on function public.deleted_manager_label() is
  'Account deletion (2026-10-21; wording changed 2026-11-06 to "Open team", Giorgio): the name a deleted '
  'manager''s seat shows everywhere. The ONE place the wording lives. Must never match the username format '
  '(it contains a space).';

revoke all on function public.deleted_manager_label() from public, anon, authenticated, service_role;
grant execute on function public.deleted_manager_label() to authenticated, service_role;

-- ---- 2. backfill the stored copies of the old wording ---------------------------
do $$
declare
  v_old   constant text := 'Former manager';
  v_label text := public.deleted_manager_label();
begin
  -- a. roster-reconfirm snapshots (the departed list keeps its order).
  update public.league_roster_reconfirm rc
     set departed = (
           select jsonb_agg(case when e ->> 'name' = v_old
                                 then jsonb_set(e, '{name}', to_jsonb(v_label))
                                 else e end
                            order by o)
             from jsonb_array_elements(rc.departed) with ordinality as x(e, o))
   where exists (select 1 from jsonb_array_elements(rc.departed) e where e ->> 'name' = v_old);

  -- b. name snapshots in notifications ABOUT a deleted manager.
  update public.league_notifications n
     set detail = n.detail
                  || case when n.detail ->> 'subject_name' = v_old
                          then jsonb_build_object('subject_name', v_label) else '{}'::jsonb end
                  || case when n.detail ->> 'commissioner_name' = v_old
                          then jsonb_build_object('commissioner_name', v_label) else '{}'::jsonb end
   where n.detail ->> 'subject_name' = v_old
      or n.detail ->> 'commissioner_name' = v_old;
end;
$$;
