-- ============================================================================
-- Refuse new Duration leagues until Duration is built (2026-11-11).
--
-- RULING: docs/PRODUCT_RULES.md, "Duration is hidden in Create league until it
-- is built" (Giorgio picked "A"). Nothing on the server scores or ends a
-- Duration league (process-week-results scores matchups only; snapshot-week-end
-- reads league_type = 'matchup'), so one created today would never have a
-- winner. The app stops offering Duration; this makes the server refuse it too,
-- so the block does not rest on the app alone.
--
-- WHAT IS REFUSED, for EVERY session (user, service role, cron, SQL editor —
-- there is deliberately no auth.uid() IS NULL exemption here, unlike the other
-- leagues guards: no path has a legitimate reason to make a Duration league):
--   (a) an INSERT whose league_type is 'duration'. That includes an INSERT that
--       omits league_type: the column DEFAULTS to 'duration'
--       (20251230000000:22), and a column default is already in NEW when a
--       BEFORE INSERT trigger runs, so the default is caught here too;
--   (b) an UPDATE that turns a league that is NOT Duration into one. Before the
--       draft starts, leagues_update_commissioner lets the commissioner PATCH
--       league_type (the freeze trigger only locks it after the draft starts),
--       so without (b) a Matchup league could be made and then flipped.
--
-- WHAT IS NOT REFUSED: any UPDATE of a league that is ALREADY Duration (OLD is
-- 'duration'). Existing Duration leagues are left as they are (the ruling);
-- every write to them, including moving one to 'matchup', still works.
--
-- THE DEFAULT IS NOT FLIPPED to 'matchup', on purpose. An insert that omits
-- league_type is a caller that never said what it wanted; turning it into a
-- Matchup league with no num_weeks / playoff_teams would silently change the
-- type and hand the caller a half-configured league. Refusing it says why.
-- (supabase/tests/replica_defaults.ts also pins the replicas to the default.)
--
-- RENEWAL: renew_league (20261125000002) already refuses a non-Matchup league
-- before it inserts ({status:'refused', reason:'unsupported_league_type'}),
-- and it copies league_type explicitly, so this trigger would refuse a Duration
-- renewal as well. A Duration league never reaches season_status = 'completed'
-- today (nothing ends one), so the app never offers Run it back on one.
--
-- WHO CREATES LEAGUES TODAY (grep 2026-11-11): apps/mobile create-league
-- (always sends 'matchup' from this change on); renew_league (copies the type;
-- refuses Duration first); the paused web app's useLeagues.createLeague, which
-- defaults leagueType to 'duration' (refused from here on; web is APP_PAUSED).
-- No edge function inserts into leagues.
--
-- The trigger function is SECURITY INVOKER with a pinned search_path; EXECUTE
-- is revoked from PUBLIC AND from anon/authenticated/service_role by name
-- (Supabase's default per-role grants survive REVOKE ... FROM PUBLIC; CLAUDE.md).
-- A trigger fires regardless of the caller's EXECUTE on its function.
-- ============================================================================

create or replace function public.refuse_new_duration_leagues()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.league_type is distinct from 'duration' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.league_type = 'duration' then
    return new;   -- an existing Duration league: left as it is
  end if;
  raise exception 'duration_not_available: Duration leagues cannot be created yet; create a Matchup league'
    using errcode = '22023';
end;
$$;

revoke all on function public.refuse_new_duration_leagues() from public;
revoke all on function public.refuse_new_duration_leagues() from anon, authenticated, service_role;

drop trigger if exists trg_leagues_refuse_new_duration on public.leagues;
create trigger trg_leagues_refuse_new_duration
  before insert or update of league_type on public.leagues
  for each row execute function public.refuse_new_duration_leagues();
