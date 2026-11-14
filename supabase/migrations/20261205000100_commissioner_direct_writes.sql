-- ============================================================================
-- Commissioner direct writes (security brief 2026-11-13, S2 + S3).
-- docs/security/2026-11-13-brief-security-check.md
--
-- The brief read the 2026-11-11 db-snapshot, which lists policies and grants but
-- not triggers. Mapped against the triggers too, most of S2/S3 was already
-- closed; this closes what was left.
--
-- WHAT WAS ALREADY CLOSED (not touched here):
--   * drafts DELETE after the draft starts: trg_drafts_freeze_delete
--     (20261104000000) refuses a user session once draft_status leaves not_started.
--   * leagues.draft_status: server-only for user sessions, UPDATE and INSERT
--     (20261111000001).
--   * the league rules (stake_mode, budget_amount, notional_per_slot, num_rounds,
--     allow_undraftable, num_weeks, duration_days, league_type, num_participants,
--     budget_mode) and season_status / current_week / current_season_id /
--     league_start_date / league_end_date: frozen for user sessions once the draft
--     starts (20261104000000, as re-issued by 20261111000001).
--   * commissioner_id: transfer only (20261110000000). pick_seconds: frozen after
--     start, pick_clock_enabled / draft_started_at: never client-written
--     (20261010000000). playoff_teams: frozen after start (20261012000002).
--     draft_order_mode: its own lock (20261013000000). lineage columns: renewal
--     functions only (20261115000004). draft_date: quarter hour, an hour ahead,
--     not once the room opens (20261111000001). league_type: no new Duration
--     (20261203000000).
--
-- WHAT WAS STILL OPEN, and what this does:
--   (1) drafts: "Commissioners can delete picks" had no legitimate user. Picks only
--       exist once the draft runs, nothing in apps/ deletes them, and every server
--       path is the service role or a SECURITY DEFINER function (RLS-exempt as the
--       owner). DROPPED. trg_drafts_freeze_delete stays as the second layer.
--   (2) leagues DELETE: leagues_delete_commissioner let a commissioner delete a
--       live or finished league over PostgREST, and the cascade wiped its picks
--       (trg_drafts_freeze_delete lets a cascade through by design: the league
--       row is already gone). The S2 attack through a side door. Nothing in apps/
--       on a live surface deletes a league (the paused web app's useLeagues
--       deleteLeague is the only caller); cancel_league_renewal and
--       scrub_deleted_manager are DEFINER, the edge functions are service role.
--       NARROWED to draft_status = 'not_started' (a pre-draft league has no
--       picks, trades or results to lose), not dropped, so a future pre-draft
--       "Delete league" stays one client call.
--       PARTIAL STATE (CLAUDE.md): a status flag is not evidence that no picks
--       exist. A not_started league can still hold pick rows (legacy data, a
--       half-reset draft), and a status-only gate would let the cascade take
--       them. So a NEW BEFORE DELETE trigger, trg_leagues_delete_before_draft,
--       checks the rows themselves: any user session (auth.uid() set, a direct
--       write OR a DEFINER RPC acting for a user, e.g. cancel_league_renewal) is
--       refused when the draft has started or ANY pick row exists. It is a
--       DEFINER trigger on purpose: a subquery in the policy would run under the
--       caller's drafts RLS (members only), so a commissioner without a
--       membership row would see zero picks and pass. The service role
--       (scrub_deleted_manager via the account-deletion functions), cron and the
--       SQL editor have no auth.uid() and pass.
--       States pinned in the test, every one: not_started (no time, pre-room,
--       room open with the order finalized, postponed, renewal replies pending),
--       in_progress (running, stalled = "auto-pick paused", price outage) and
--       completed (season active, playoffs, season completed), each with and
--       (for not_started) without picks. draft_status is NOT NULL with a CHECK,
--       so those three values are the whole status domain; "paused" and "room
--       open" are side-table substates, not statuses.
--   (3) leagues, columns no client flow writes and no trigger guarded BEFORE the
--       draft (or at all): id, created_at, invite_code, league_start_date,
--       league_end_date, current_week, season_status, current_season_id. Before
--       the draft a commissioner could pre-set league_start_date / current_season_id
--       and finalize_league_draft would KEEP them (coalesce(existing, computed)),
--       moving the scoring window. NEW trigger trg_leagues_server_columns refuses a
--       change to any of them from a direct client write, in every state, per
--       column (an unchanged value passes, so a client that echoes a column back
--       is not refused). On INSERT it refuses a non-default value for the season
--       columns and created_at.
--   (4) leagues.draft_date after the draft starts: enforce_leagues_draft_time
--       returns early once draft_status leaves not_started, so a commissioner
--       could still move it. No client writes it then (League settings shows no
--       Save once locked; the draft-time sheets are pre-draft only). The same
--       trigger refuses it with the client's existing draft_time_locked prefix.
--   (5) draft_sessions / draft_settings: legacy tables with NO reader or writer
--       anywhere (apps/, supabase/functions/, every SQL function). The commissioner
--       FOR ALL policies are DROPPED; the member SELECT policies stay.
--
-- WHO IS EXEMPT: the trigger keys on current_user, as enforce_league_lineage_columns
-- does: only a DIRECT client write runs as anon/authenticated. The service role
-- (edge functions), cron, the SQL editor and every SECURITY DEFINER function
-- (renew_league's INSERT, start_renewed_season's UPDATE, finalize_league_draft,
-- the playoff/season functions) run as their owner or service_role and pass.
-- auth.uid() would be the wrong key: it is still set inside a DEFINER RPC that a
-- user called.
--
-- CLIENT WRITES MAPPED (all still pass; supabase/tests/commissioner_direct_writes.pglite.test.ts):
--   apps/mobile create-league.tsx  INSERT name, commissioner_id, invite_code,
--     num_participants, num_rounds, stake_mode, notional_per_slot, allow_undraftable,
--     [budget_amount], league_type, duration_days, num_weeks, playoff_teams,
--     draft_status 'not_started', draft_order_mode, pick_seconds, draft_date
--   apps/mobile league-settings.tsx  UPDATE (pre-draft only) name, draft_date,
--     num_participants, num_rounds, allow_undraftable, pick_seconds, stake_mode,
--     notional_per_slot, [budget_amount]
--   apps/mobile useDraftAutoStart.ts  UPDATE playoff_teams; UPDATE draft_date (pre-draft)
--   apps/web (APP_PAUSED): useLeagues insert/update/delete, DraftPage draft_status
--     flip (already refused since 20261111000001). Re-route through the server
--     before any unpause.
-- ============================================================================

-- (1) drafts: no direct delete for anyone.
drop policy if exists "Commissioners can delete picks" on public.drafts;

-- (2) leagues: a commissioner may delete their league only before its draft.
drop policy if exists "leagues_delete_commissioner" on public.leagues;
create policy "leagues_delete_commissioner" on public.leagues
  for delete to authenticated
  using (public.is_commissioner(id) and draft_status = 'not_started');

-- (2b) ...and never a league that holds picks, whatever its status says.
create or replace function public.enforce_leagues_delete_before_draft()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return old;   -- service role, cron, the SQL editor
  end if;
  if old.draft_status is distinct from 'not_started' then
    raise exception 'league_delete_locked: a league cannot be deleted once its draft has started'
      using errcode = '42501';
  end if;
  -- The evidence, not the flag: one pick row is enough to refuse.
  if exists (select 1 from public.drafts d where d.league_id = old.id) then
    raise exception 'league_delete_locked: a league with draft picks cannot be deleted'
      using errcode = '42501';
  end if;
  return old;
end;
$$;

revoke all on function public.enforce_leagues_delete_before_draft() from public, anon, authenticated, service_role;

drop trigger if exists trg_leagues_delete_before_draft on public.leagues;
create trigger trg_leagues_delete_before_draft
  before delete on public.leagues
  for each row execute function public.enforce_leagues_delete_before_draft();

-- (3) + (4) leagues: server-owned columns.
create or replace function public.enforce_leagues_server_columns()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_bad text[];
begin
  -- Only a direct client write (PostgREST as anon/authenticated) is checked. A
  -- SECURITY DEFINER function runs as its owner, edge functions as service_role.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A new league starts its season from nothing: the defaults, nothing pre-set.
    v_bad := array_remove(array[
      case when new.created_at        is distinct from now()    then 'created_at' end,
      case when new.league_start_date is not null               then 'league_start_date' end,
      case when new.league_end_date   is not null               then 'league_end_date' end,
      case when new.current_week      is distinct from 1        then 'current_week' end,
      case when new.season_status     is distinct from 'active' then 'season_status' end,
      case when new.current_season_id is not null               then 'current_season_id' end
    ], null);
  else
    -- Per column, not "any change": a value echoed back unchanged passes.
    v_bad := array_remove(array[
      case when new.id                is distinct from old.id                then 'id' end,
      case when new.created_at        is distinct from old.created_at        then 'created_at' end,
      case when new.invite_code       is distinct from old.invite_code       then 'invite_code' end,
      case when new.league_start_date is distinct from old.league_start_date then 'league_start_date' end,
      case when new.league_end_date   is distinct from old.league_end_date   then 'league_end_date' end,
      case when new.current_week      is distinct from old.current_week      then 'current_week' end,
      case when new.season_status     is distinct from old.season_status     then 'season_status' end,
      case when new.current_season_id is distinct from old.current_season_id then 'current_season_id' end
    ], null);
  end if;

  if cardinality(v_bad) > 0 then
    raise exception 'league_column_server_only: only the server writes these league columns (%)',
      array_to_string(v_bad, ', ')
      using errcode = '42501';
  end if;

  -- (4) the draft time is a pre-draft setting. Same prefix as the room-open
  -- refusal, so the client's draftTimeRefusal shows its existing line.
  if tg_op = 'UPDATE'
     and new.draft_date is distinct from old.draft_date
     and old.draft_status is distinct from 'not_started' then
    raise exception 'draft_time_locked: the draft has started, so the draft time can''t change'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

-- A trigger function needs no EXECUTE to fire. Supabase's default privileges
-- grant it to anon/authenticated/service_role explicitly, and REVOKE FROM PUBLIC
-- leaves those (CLAUDE.md), so all four are named.
revoke all on function public.enforce_leagues_server_columns() from public, anon, authenticated, service_role;

drop trigger if exists trg_leagues_server_columns on public.leagues;
create trigger trg_leagues_server_columns
  before insert or update on public.leagues
  for each row execute function public.enforce_leagues_server_columns();

-- (5) draft_sessions / draft_settings: read-only for members, unwritable by clients.
drop policy if exists "Commissioners can manage draft sessions" on public.draft_sessions;
drop policy if exists "Commissioners can manage draft settings" on public.draft_settings;
