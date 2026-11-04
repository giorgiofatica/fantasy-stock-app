-- ============================================================================
-- get_home_league: each matchups row also carries the SERVER'S RESULT
-- ('winner_user_id', 'is_tie'), so the app shows the week's W / L / T the
-- standings count, never one re-derived from the two gains.
--
-- WHY (Design Lead P1, 2026-11-03): Home's scored card said "Gianluigi B.
-- wins Week 6" on a TIED week. Every client result was re-derived from
-- team1_gain / team2_gain, which disagrees with process-week-results
-- (decideMatchupOutcome, process-week-results/playoff-progression.ts) in three
-- cases: a dollar tie broken by percent, an empty portfolio (an automatic loss
-- even against a negative gain), and a playoff tie (the higher seed wins).
-- The app decides from these two keys in lib/game/weekResult.ts, and falls
-- back to dollars on a row without them (an RPC from before this file).
--
-- WHAT CHANGES: the body is 20261029000000_get_home_league_rpc.sql's, byte
-- for byte, except the two keys added to the matchups jsonb object. Same
-- signature, return type, language, STABLE, SECURITY DEFINER and
-- search_path. Both columns are already readable by every member through
-- matchups_select_members (is_member), and the RPC returns only rows that
-- name the caller, so nothing becomes visible that wasn't already.
--
-- GRANTS: CREATE OR REPLACE keeps the existing ACL (it does not reset
-- privileges), so no grant/revoke is re-run here. Verify that, below.
--
-- ---------------------------------------------------------------------------
-- POST-PUSH EFFECT CHECKS (run each separately, from the deploy checkout):
--   -- 1. grants UNCHANGED: expect exactly {postgres=X/postgres,authenticated=X/postgres}
--   --    (docs/architecture/db-snapshot.json "get_home_league" acl), prosecdef = t,
--   --    proconfig = {"search_path=public, pg_temp"}, provolatile = s.
--   SELECT proname, proacl, prosecdef, proconfig, provolatile FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND proname = 'get_home_league';
--   -- 2. both new keys present on every matchups row, as a real member of a
--   --    real league (replace both ids). Expect missing_keys = 0 and rows > 0:
--   BEGIN; SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claim.sub', '<member-uuid>', true);
--   SELECT count(*) AS rows,
--          count(*) FILTER (WHERE NOT (m ? 'winner_user_id' AND m ? 'is_tie')) AS missing_keys
--   FROM jsonb_array_elements(public.get_home_league('<league-uuid>') -> 'matchups') m;
--   ROLLBACK;
--   -- 3. anon still refused: expect ERROR 42501 permission denied for function
--   BEGIN; SET LOCAL ROLE anon;
--   SELECT public.get_home_league('<league-uuid>');
--   ROLLBACK;
-- ============================================================================

create or replace function public.get_home_league(p_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller text := auth.uid()::text;
  v_league record;
  -- Typed row variable, NOT plain `record` (security review, 2026-09-29):
  -- an untyped `record` that a 0-row `SELECT ... INTO` never assigns has
  -- "no substructure", and any later `.field` access on it raises "record
  -- ... is not assigned yet" -- an ERROR, not the "bye -> empty
  -- current_week arrays" behavior this function's header promises. A
  -- typed `matchups%rowtype` variable has a fixed substructure up front,
  -- so a 0-row SELECT INTO leaves every field NULL instead, and
  -- `v_matchup.week_start`/`week_end` below degrade to NULL comparisons
  -- (the intended, tested "no matchup this week -> empty" behavior) for
  -- every caller with no current-week row: a bye, a playoff bye, an
  -- eliminated team, or a league whose schedule hasn't been generated yet.
  v_matchup matchups%rowtype;
  v_opponent text;
  v_result jsonb;
begin
  if v_caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not public.is_member(p_league_id) then
    return null;
  end if;

  select id, current_week into v_league from leagues where id = p_league_id;
  if not found then
    return null;
  end if;

  -- The caller's current-week matchup (if any), to find the opponent.
  select mu.* into v_matchup
  from matchups mu
  where mu.league_id = p_league_id
    and mu.week_number = v_league.current_week
    and (mu.team1_user_id = v_caller or mu.team2_user_id = v_caller)
  order by coalesce(mu.is_playoff, false) desc, mu.id
  limit 1;

  v_opponent := case
    when v_matchup is null then null
    when v_matchup.team1_user_id = v_caller then v_matchup.team2_user_id
    else v_matchup.team1_user_id
  end;

  select jsonb_build_object(
    'my_ledger', jsonb_build_object(
      'drafts', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'symbol', d.symbol, 'entry_price', d.entry_price, 'quantity', d.quantity,
          'created_at', d.created_at
        ) order by d.created_at), '[]'::jsonb)
        from drafts d
        where d.league_id = p_league_id and d.user_id = v_caller
      ),
      'trades', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'symbol', t.symbol, 'action', t.action, 'quantity', t.quantity, 'price', t.price,
          'created_at', t.created_at
        ) order by t.created_at), '[]'::jsonb)
        from trades t
        where t.league_id = p_league_id and t.user_id::text = v_caller
      )
    ),
    'current_week', jsonb_build_object(
      'week_number', v_league.current_week,
      'my_snapshots', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'symbol', s.symbol, 'quantity', s.quantity, 'week_start_price', s.week_start_price,
          'entered_mid_week', s.entered_mid_week
        ) order by s.symbol), '[]'::jsonb)
        from week_snapshots s
        where s.league_id = p_league_id and s.week_number = v_league.current_week and s.user_id::text = v_caller
      ),
      -- Both bounds, mirroring opponent_trades below: a lower bound alone
      -- would let a trade dated after v_matchup.week_end (e.g. once
      -- current_week has rolled over) into a field documented as "this
      -- week only" (security review, 2026-09-29). When v_matchup IS NULL
      -- (no matchup this week: a bye or a playoff gap), both bounds are
      -- NULL and the comparison is NULL for every row, so this correctly
      -- returns empty -- there is no "this week" to scope to without a
      -- matchup row's own week_start/week_end.
      'my_trades', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'symbol', t.symbol, 'action', t.action, 'quantity', t.quantity, 'price', t.price,
          'created_at', t.created_at
        ) order by t.created_at), '[]'::jsonb)
        from trades t
        where t.league_id = p_league_id and t.user_id::text = v_caller
          and t.created_at >= v_matchup.week_start and t.created_at <= v_matchup.week_end
      ),
      -- Opponent's data, THIS WEEK ONLY -- see the header's "one
      -- deliberate NARROWING" note. NULL opponent -> empty arrays, never
      -- another member's row leaking through a NULL comparison.
      'opponent_snapshots', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'symbol', s.symbol, 'quantity', s.quantity, 'week_start_price', s.week_start_price,
          'entered_mid_week', s.entered_mid_week
        ) order by s.symbol), '[]'::jsonb)
        from week_snapshots s
        where s.league_id = p_league_id and s.week_number = v_league.current_week
          and v_opponent is not null and s.user_id::text = v_opponent
      ),
      'opponent_trades', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'symbol', t.symbol, 'action', t.action, 'quantity', t.quantity, 'price', t.price,
          'created_at', t.created_at
        ) order by t.created_at), '[]'::jsonb)
        from trades t
        where t.league_id = p_league_id and v_opponent is not null and t.user_id::text = v_opponent
          and t.created_at >= v_matchup.week_start and t.created_at <= v_matchup.week_end
      )
    ),
    'matchups', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'week_number', mu.week_number, 'week_start', mu.week_start, 'week_end', mu.week_end,
        'is_playoff', mu.is_playoff,
        'team1_user_id', mu.team1_user_id, 'team2_user_id', mu.team2_user_id,
        'team1_gain', mu.team1_gain, 'team2_gain', mu.team2_gain,
        'winner_user_id', mu.winner_user_id, 'is_tie', mu.is_tie
      ) order by mu.week_number), '[]'::jsonb)
      from matchups mu
      where mu.league_id = p_league_id
        and (mu.team1_user_id = v_caller or mu.team2_user_id = v_caller)
    ),
    'standings', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', r.user_id, 'rank', r.rank, 'wins', r.wins, 'losses', r.losses, 'ties', r.ties,
        'points_for', r.points_for,
        'display_name', dn.display_name, 'is_bot', dn.is_bot
      ) order by r.rank), '[]'::jsonb)
      from public.league_standings_ranked(p_league_id) r
      left join public.get_league_display_names(p_league_id) dn on dn.user_id = r.user_id
    )
  ) into v_result;

  return v_result;
end;
$$;
