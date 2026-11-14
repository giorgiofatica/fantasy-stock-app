-- ============================================================================
-- 20261205000100 commissioner direct writes: EFFECT TEST (run AFTER db push,
-- in the SQL editor). Same pattern as run-it-back-effect-test.sql: runs as the
-- editor's role, switches to a commissioner's JWT, and ALWAYS ends in RAISE, so
-- the whole block rolls back and nothing is left behind. The verdict is the
-- error text: 'COMMISSIONER WRITES EFFECT TEST: PASS ...'.
--
-- It picks a league whose draft has started (in_progress or completed), with
-- picks and a UUID-shaped commissioner (never a bot-* id). It also creates a
-- pre-draft league AS that commissioner (rolled back with everything else).
-- ============================================================================
DO $$
DECLARE
  v_league   uuid;
  v_comm     text;
  v_picks    int;
  v_n        int;
  v_pre      uuid;
  v_pick_del int;  v_league_del int;  v_pre_del int;  v_rename int;
  v_col_msg  text := 'NO ERROR';
  v_live_msg text := 'NO ERROR';
  v_date_msg text := 'NO ERROR';
  v_ins_msg  text := 'NO ERROR';
  v_ds_msg   text := 'NO ERROR';
  v_ok       boolean;
BEGIN
  SELECT l.id, l.commissioner_id INTO v_league, v_comm
  FROM leagues l
  WHERE l.draft_status IN ('in_progress', 'completed')
    AND l.commissioner_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (SELECT 1 FROM drafts d WHERE d.league_id = l.id)
  ORDER BY l.created_at DESC
  LIMIT 1;
  IF v_league IS NULL THEN
    RAISE EXCEPTION 'COMMISSIONER WRITES EFFECT TEST: SETUP FAIL -- no started league with picks and a UUID-shaped commissioner';
  END IF;
  SELECT count(*) INTO v_picks FROM drafts WHERE league_id = v_league;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_comm, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_comm, true);

  -- S2: no pick is deletable, and the league cannot be deleted (cascade side door).
  -- (Before this migration the freeze trigger raised here; now no policy matches: 0 rows.)
  BEGIN
    DELETE FROM drafts WHERE league_id = v_league;   GET DIAGNOSTICS v_pick_del = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN v_pick_del := -1; END;
  DELETE FROM leagues WHERE id = v_league;         GET DIAGNOSTICS v_league_del = ROW_COUNT;

  -- S3 after the draft: a season column and the draft time.
  BEGIN
    UPDATE leagues SET current_week = current_week + 1 WHERE id = v_league;
  EXCEPTION WHEN OTHERS THEN v_live_msg := SQLERRM; END;
  BEGIN
    UPDATE leagues SET draft_date = date_trunc('hour', now()) + interval '5 days' WHERE id = v_league;
  EXCEPTION WHEN OTHERS THEN v_date_msg := SQLERRM; END;

  -- S3 before the draft: a league this commissioner creates (the create-league shape).
  INSERT INTO leagues (name, commissioner_id, invite_code, num_participants, num_rounds, stake_mode,
                       notional_per_slot, allow_undraftable, league_type, duration_days, num_weeks,
                       playoff_teams, draft_status, draft_order_mode, pick_seconds, draft_date)
  VALUES ('Effect test', v_comm, 'EFX' || upper(substr(md5(random()::text), 1, 5)), 8, 6, 'fixed_notional',
          1000, false, 'matchup', 30, 11, 4, 'not_started', 'random', 60, null)
  RETURNING id INTO v_pre;
  BEGIN
    UPDATE leagues SET league_start_date = now() WHERE id = v_pre;
  EXCEPTION WHEN OTHERS THEN v_col_msg := SQLERRM; END;
  BEGIN
    INSERT INTO leagues (name, commissioner_id, invite_code, num_participants, league_type, playoff_teams, season_status)
    VALUES ('Effect test 2', v_comm, 'EFY' || upper(substr(md5(random()::text), 1, 5)), 8, 'matchup', 4, 'completed');
  EXCEPTION WHEN OTHERS THEN v_ins_msg := SQLERRM; END;
  UPDATE leagues SET name = 'Effect test renamed' WHERE id = v_pre;   GET DIAGNOSTICS v_rename = ROW_COUNT;

  -- draft_sessions: no client write.
  BEGIN
    INSERT INTO draft_sessions (league_id) VALUES (v_pre);
  EXCEPTION WHEN OTHERS THEN v_ds_msg := SQLERRM; END;

  DELETE FROM leagues WHERE id = v_pre;            GET DIAGNOSTICS v_pre_del = ROW_COUNT;

  PERFORM set_config('role', 'none', true);   -- back to the session role (the editor's)
  SELECT count(*) INTO v_n FROM drafts WHERE league_id = v_league;

  v_ok := v_pick_del = 0 AND v_league_del = 0 AND v_n = v_picks
      AND (v_live_msg LIKE 'league_rules_locked%' OR v_live_msg LIKE 'league_column_server_only%')
      AND v_date_msg LIKE 'draft_time_locked%'
      AND v_col_msg LIKE 'league_column_server_only%'
      AND v_ins_msg LIKE 'league_column_server_only%'
      AND v_ds_msg <> 'NO ERROR'
      AND v_rename = 1 AND v_pre_del = 1;

  RAISE EXCEPTION 'COMMISSIONER WRITES EFFECT TEST: % -- league %, picks % -> % (deleted %), league deleted %, live col [%], live date [%], pre col [%], insert [%], draft_sessions [%], rename %, pre-draft delete %',
    CASE WHEN v_ok THEN 'PASS' ELSE 'FAIL' END,
    v_league, v_picks, v_n, v_pick_del, v_league_del, v_live_msg, v_date_msg, v_col_msg, v_ins_msg, v_ds_msg, v_rename, v_pre_del;
END $$;
