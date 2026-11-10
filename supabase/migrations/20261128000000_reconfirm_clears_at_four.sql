-- ============================================================================
-- Roster reconfirm: below four, "invite" is implicit; four back in = ready
-- ============================================================================
-- Giorgio, 2026-11-10 (docs/PRODUCT_RULES.md, "When managers leave before the
-- draft, below four"; PR #357), from the build 1.3.0 (12) phone pass: League A
-- (size 4, playoffs 3) lost two managers, to 2 of 4, and "Move forward with 2"
-- could only be refused. His ruling: "A, four are in so it's ready".
--
-- THE RULES (server half; the card is PR #356's, client only):
--   1. A rejoiner is never named as having left. When a user listed in
--      league_roster_reconfirm.departed joins again (any size, any choice) their
--      entry comes out of `departed`; the last one out deletes the row.
--   2. Below four (MIN_DRAFT_MEMBERS, draft-control/rules.ts), inviting is the
--      only path, so it is treated as already chosen: a reconfirm whose league
--      IS, or HAS BEEN since the row opened, below four clears on a HUMAN join
--      once four are in and playoff_teams <= members (matchup leagues). So
--      members >= 4 and P <= members leaves NO roster_reconfirm_required
--      blocker: the draft can start with no tap.
--   3. Unchanged at four or more: a leave that keeps the league at >= 4 (six to
--      five) still asks Move forward / Invite ('pending'), and a join does not
--      answer a 'pending' row. An explicit 'invite' on a row that never went
--      below four still clears on the next human join, as in 20261107000005.
--   4. P > members at >= 4 stays its own blocker (the row stays; "Move forward"
--      with the playoff stepper settles it, confirm_league_roster unchanged).
--
-- DESIGN: a durable fact, not a stamped choice. New column below_floor:
--   "the member count fell below four after a leave, at some point since this
--   row opened". Monotonic (false -> true only) for the row's whole life; the
--   row's deletion ends it. Why not stamp choice = 'invite' at the leave:
--     * the stamps CHECK requires chosen_by/chosen_at for 'invite'; nobody chose,
--       so the stamp would have to invent a chooser;
--     * choice is reset to 'pending' by every NEW departure (the question is
--       reopened for a different roster). A stamp would be undone by the next
--       leave at >= 4 (fell to 3, refilled to 5 while P > members, then 5 -> 4),
--       so "has been below four" would be lost. A separate monotonic flag can't
--       be undone by a reset it doesn't share.
--   `choice` keeps exactly its two writers: confirm_league_roster ('invite') and
--   _leave_league_before_draft (reset to 'pending'). Neither changes here.
--   below_floor has two writers: _leave_league_before_draft (OR-ed in at each
--   leave) and this file's one-time backfill. The ONLY reader is
--   join_league_by_code. Rows are deleted by confirm_league_roster
--   (move_forward), join_league_by_code (rejoin-empties, or the clear), this
--   backfill, and the leagues FK cascade.
--   Why "4 after the join" and not "P <= members" alone for a below-four row:
--   at 3 members the league still cannot draft, so clearing there would end the
--   reconfirm early, and the "who left" card with it, at a count the rule says
--   is not ready. An explicit 'invite' on a row that went below four (an old
--   client still shows the button) follows the same "four in" rule: below four
--   it means nothing more than the implicit invite.
--   The count is league_members rows, bots included, exactly the count
--   draft-control's not_enough_members uses. But a BOT join never clears (the
--   join checks the joiner), as before.
--
-- WHAT THIS FILE DOES
--   1. league_roster_reconfirm.below_floor boolean NOT NULL DEFAULT false. The
--      default is the status-quo meaning (ask the question), for any row not
--      written by a leave (tests, fixtures, effect-test SQL inserts).
--   2. _leave_league_before_draft (20261125000004) re-created verbatim plus the
--      lines marked "20261128000000": the upsert writes below_floor. leave_league
--      and scrub_deleted_manager reach it unchanged.
--   3. join_league_by_code (20261125000008) re-created verbatim plus the lines
--      marked "20261128000000": the rejoiner removal, and the clear predicate.
--      The draft-order sync after a clear is the same block, in its own
--      exception scope, now run when EITHER deletion removed the row.
--   4. BACKFILL, for rows already in prod (League A is one), row by row under
--      each league's row lock (league, then reconfirm: the runtime order):
--      a. below_floor from history: true when the league is below four now, or
--         was right after any recorded leave. "In right after time t" = the
--         current members who had joined by t + the recorded leavers who left
--         after t. Exact, except: (i) someone who joined and left again in
--         between is missed as a join, which OVERstates the count (keeps today's
--         question); (ii) a member removed without a departed entry (a Run it back
--         invitee who left) is missed, which UNDERstates it (implicit invite a
--         little early). Both rare, both only for rows written before this file.
--         A left_at that does not parse is skipped, never aborting the push.
--      b. rule 2 as the join would have applied it: a HUMAN joined after the
--         drop and that join made four (the same replay at their joined_at),
--         four or more now, P <= members (matchup). A full league (League A at
--         4 of 4) gets no further join, so without this it would ask forever.
--         No draft order is set here: for these leagues the next read or the
--         minute cron (finalize_due_draft_orders, which skips only leagues WITH
--         a reconfirm row) sets it, the recovery the join's own deferred-finalize
--         path relies on.
--      c. rule 1 for rejoiners already back: their entries leave `departed`; a
--         row with no one left in it is deleted.
--   5. LOOP GUARD for the member_left push (security + supabase review): rule 1
--      takes a rejoiner out of departed, which is what _leave_league_before_draft's
--      v_repeat ("no second notice") read. So the leave also skips the notice when
--      the same leaver was announced to the same commissioner in this league
--      within the hour, keyed on the notice (league_notifications.subject_user_id
--      = the leaver, now written on member_left), which outlives the reconfirm
--      row. The departure itself is always recorded; only the push is skipped.
--      Bound: one push per leaver per hour (the edge functions also rate-limit
--      leave and join at 10/min per user, 30/min per IP).
--   6. Note on rule 1 vs P: when the last leaver comes back the row goes even if
--      P > members. That is the roster from before the leave, and draft-control's
--      playoff_teams_exceeds_members blocker still applies without the row.
--   7. Grants re-asserted exactly as their newest versions: _leave_league_before_draft
--      owner-only; join_league_by_code service_role only. CREATE OR REPLACE keeps
--      the ACL anyway; REVOKE FROM PUBLIC alone would not clear Supabase's
--      per-role grants (CLAUDE.md), so each role is revoked by name.
--
-- PARTIAL STATE (CLAUDE.md): every decision is a per-league COUNT or a per-entry
-- LIST test under the leagues row lock (join) or in one statement (backfill):
-- the clear compares the member count with 4 and P; the rejoiner removal keeps
-- every entry that is not the joiner and deletes the row only when NO entry
-- remains. An entry with a missing user_id counts as someone else (it is kept).
--
-- PROVISIONAL TIMESTAMP: see 20261125000000. Must apply AFTER 20261125000004,
-- 20261125000008 and 20261127000000 (it re-creates two of their functions and
-- keeps the departed[] {user_id, name, left_at} shape 20261127000000 rewrites).
--
-- PRE-PUSH (SQL editor, read-only): what the backfill will see.
--   SELECT rc.league_id, l.name, l.num_participants, l.league_type, l.playoff_teams, rc.choice,
--          rc.members_before, (SELECT count(*) FROM league_members m WHERE m.league_id = rc.league_id) AS members,
--          rc.departed
--     FROM league_roster_reconfirm rc JOIN leagues l ON l.id = rc.league_id ORDER BY l.name;
--
-- POST-PUSH EFFECT CHECK (SQL editor):
--   SELECT proname, proacl FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND proname IN ('join_league_by_code', '_leave_league_before_draft');
--   -- join_league_by_code {postgres=X/postgres,service_role=X/postgres}
--   -- _leave_league_before_draft {postgres=X/postgres}
--   SELECT proname, position('below_floor' in prosrc) > 0 AS reads_floor,
--          position('subject_user_id' in prosrc) > 0 AS loop_guard
--     FROM pg_proc WHERE pronamespace = 'public'::regnamespace
--      AND proname IN ('join_league_by_code', '_leave_league_before_draft');
--   -- reads_floor t, t; loop_guard f (join), t (_leave_league_before_draft)
--   SELECT version FROM supabase_migrations.schema_migrations WHERE version = '20261128000000';   -- 1 row
--   SELECT is_nullable, column_default FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'league_roster_reconfirm' AND column_name = 'below_floor';
--   -- NO, false
--   Behaviour (no row may be left that the rules say is done):
--   SELECT rc.league_id, rc.below_floor, rc.choice, rc.departed,
--          (SELECT count(*) FROM league_members m WHERE m.league_id = rc.league_id) AS members
--     FROM league_roster_reconfirm rc;
--   -- League A: no row if T1 and T2 are back (or a new human made it 4 with P <= 4);
--   -- else below_floor = t, and its departed names only managers who are NOT members.
--   SELECT count(*) FROM league_roster_reconfirm rc, jsonb_array_elements(rc.departed) e
--    WHERE EXISTS (SELECT 1 FROM league_members m WHERE m.league_id = rc.league_id
--                   AND lower(m.user_id) = lower(e ->> 'user_id'));                   -- 0
--   Backfill-cleared leagues are not stuck: for each league in the PRE-PUSH output
--   that has no row now, once its draft_date - 1h has passed (and after a minute
--   of cron), its order is set (state 'finalized' or 'locked', never missing/'open'):
--   SELECT l.id, l.name, l.draft_date, m.state FROM leagues l
--     LEFT JOIN league_draft_order_meta m ON m.league_id = l.id WHERE l.id IN (<those ids>);
--   The leave -> rejoin -> leave loop guard and the rules themselves are proven in
--   supabase/tests/reconfirm_clears_at_four.pglite.test.ts (they need real members).
-- ============================================================================

-- ---- 1. the durable fact ---------------------------------------------------------
alter table public.league_roster_reconfirm
  add column if not exists below_floor boolean not null default false;

comment on column public.league_roster_reconfirm.below_floor is
  '20261128000000: the member count fell below four (MIN_DRAFT_MEMBERS) after a leave, at some point since this row opened. Monotonic for the row''s life. When true, inviting is implicit (Giorgio, 2026-11-10): a human join clears the row once four are in and playoff_teams <= members. Written only by _leave_league_before_draft and the 20261128000000 backfill; read only by join_league_by_code.';

comment on table public.league_roster_reconfirm is
  'Leave league: one row per league whose commissioner owes a roster confirmation after a pre-draft leave. departed = who left since the last confirmation and is not back, as [{user_id, name, left_at}] (name snapshotted at the leave: a departed pre-draft member is no longer resolvable by get_league_display_names); members_before = the member count before the first of those leaves; below_floor = the league went below four since then (20261128000000). Its presence blocks the draft start (draft-control roster_reconfirm_required). Written only by SECURITY DEFINER functions: _leave_league_before_draft (leave_league, scrub_deleted_manager), confirm_league_roster, join_league_by_code.';

-- ---- 2. _leave_league_before_draft (20261125000004) ----------------------------------
create or replace function public._leave_league_before_draft(
  p_league_id   uuid,
  p_user_id     text,
  p_leaver_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_l             public.leagues%rowtype;
  v_invitee       boolean := false;
  v_before        int;
  v_notify        text;
  v_notice        uuid;
  v_reconfirm     boolean;
  v_entry         jsonb;
  v_repeat        boolean := false;
  v_recent        boolean := false;   -- 20261128000000: this leaver was announced to this commissioner within the hour
begin
  -- The CALLER's checks, re-asserted: this is reached only from leave_league and
  -- scrub_deleted_manager, both of which hold the leagues row lock and have
  -- already refused everything else. A breach is a bug, so it raises (and rolls
  -- the caller back) rather than returning a refusal.
  select * into v_l from public.leagues where id = p_league_id for update;
  if not found
     or public._league_membership_window(p_league_id) is distinct from 'before_draft'
     or v_l.commissioner_id = p_user_id
     or not exists (select 1 from public.league_members
                     where league_id = p_league_id and user_id = p_user_id) then
    -- No id in the message (it can reach the deletion ledger's last_error).
    raise exception '_leave_league_before_draft: precondition failed' using errcode = 'P0001';
  end if;

  -- ---- Run it back (dynamic: #94 may not be on this database) ---------------
  if to_regclass('public.league_renewal_responses') is not null then
    execute 'select exists (select 1 from public.league_renewal_responses
                             where league_id = $1 and user_id = $2)'
       into v_invitee using p_league_id, p_user_id;
  end if;

  -- Every refusal is above this line: nothing has been written yet.
  select count(*)::int into v_before from public.league_members where league_id = p_league_id;

  v_notify := v_l.commissioner_id;   -- 20261110000001: the leaver is never the commissioner now

  delete from public.league_members where league_id = p_league_id and user_id = p_user_id;

  v_reconfirm := not v_invitee;
  -- Left, rejoined, left again while the same confirmation is still owed: the
  -- commissioner already knows. No second notice (push spam via a join/leave
  -- loop, security review), and the commissioner's choice stands.
  select coalesce(r.departed @> jsonb_build_array(jsonb_build_object('user_id', p_user_id)), false)
    into v_repeat
    from public.league_roster_reconfirm r where r.league_id = p_league_id;
  v_repeat := coalesce(v_repeat, false) and v_reconfirm;   -- 20261110000001: no hand-over clause left
  if v_reconfirm then
    -- The name is a SNAPSHOT: once the row is gone, a pre-draft leaver has no
    -- standings/matchups/drafts for get_league_display_names to resolve.
    v_entry := jsonb_build_object('user_id', p_user_id,
                                  'name', p_leaver_name,
                                  'left_at', now());
    -- 20261128000000: below_floor = this leave left fewer than four (MIN_DRAFT_MEMBERS,
    -- draft-control/rules.ts) in the league. OR-ed in, never cleared: "is, or has been".
    insert into public.league_roster_reconfirm as r (league_id, departed, members_before, below_floor)
    values (p_league_id, jsonb_build_array(v_entry), v_before, v_before - 1 < 4)
    on conflict (league_id) do update
      set departed  = case when v_repeat then r.departed else r.departed || jsonb_build_array(v_entry) end,
          -- A NEW departure re-opens the question: whatever the commissioner chose
          -- ("Invite someone new") was for a different roster.
          choice    = case when v_repeat then r.choice    else 'pending' end,
          chosen_by = case when v_repeat then r.chosen_by else null end,
          chosen_at = case when v_repeat then r.chosen_at else null end,
          below_floor = r.below_floor or (v_before - 1 < 4),   -- 20261128000000: monotonic, a repeat leave too
          updated_at = now();   -- members_before stays: the count before the FIRST unconfirmed leave
  end if;

  -- 20261128000000: a rejoin now takes the leaver OUT of departed (rule 1), so
  -- v_repeat alone no longer sees a leave -> rejoin -> leave loop (security +
  -- supabase review). The loop guard also keys on the notice itself, which
  -- outlives the reconfirm row: at most one member_left per leaver, per
  -- commissioner, per league, per hour. The departure is still recorded above.
  select exists (select 1 from public.league_notifications n
                  where n.league_id = p_league_id and n.kind = 'member_left'
                    and n.user_id = v_notify
                    and lower(n.subject_user_id) = lower(p_user_id)
                    and n.created_at > now() - interval '1 hour')
    into v_recent;

  if not v_repeat and not v_recent then   -- 20261128000000: was `if not v_repeat`
    insert into public.league_notifications (league_id, user_id, kind, subject_user_id)   -- 20261128000000: + subject_user_id
    values (p_league_id, v_notify, 'member_left', p_user_id)
    returning id into v_notice;
  end if;

  return jsonb_build_object(
    'status', 'left',
    'reconfirm_required', v_reconfirm,
    'made_commissioner', false,   -- 20261110000001: kept for the #126-era edge function; always false
    'members_before', v_before,
    'members_after', v_before - 1,
    -- For the edge function's push only; it never forwards these to the client.
    'notice_id', v_notice,
    'notify_user_id', v_notify,
    'leaver_name', p_leaver_name,
    'league_name', v_l.name);
end;
$$;

revoke all on function public._leave_league_before_draft(uuid, text, text) from public, anon, authenticated, service_role;

-- ---- 3. join_league_by_code (20261125000008) -----------------------------------------
create or replace function join_league_by_code(p_code text, p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_league      leagues%rowtype;
  v_invite      league_invites%rowtype;
  v_from_invite boolean := false;
  v_count       int;
  v_cleared     boolean := false;   -- 20261128000000: either deletion below removed the reconfirm
begin
  -- resolve code: leagues.invite_code FIRST, else league_invites.code (mirrors client)
  select * into v_league from leagues where invite_code = p_code;
  if not found then
    select * into v_invite from league_invites where code = p_code
      and kind = 'invite';   -- 20261125000008: never a takeover code
    if not found then
      return jsonb_build_object('ok', false, 'reason', 'invalid_code');
    end if;
    select * into v_league from leagues where id = v_invite.league_id;
    if not found then
      return jsonb_build_object('ok', false, 'reason', 'invalid_code');
    end if;
    v_from_invite := true;
  end if;

  -- LOCK the league row -> serialize concurrent joins (last-seat capacity race fix)
  -- and concurrent draft-starts (see header comment above).
  select * into v_league from leagues where id = v_league.id for update;

  -- re-validate under the lock (season_status now: 'active'|'playoffs'|'completed')
  if v_league.season_status = 'completed' then
    return jsonb_build_object('ok', false, 'reason', 'season_completed');
  end if;

  if v_from_invite and (v_invite.status <> 'pending'
       or (v_invite.expires_at is not null and v_invite.expires_at < now())) then
    return jsonb_build_object('ok', false, 'reason', 'invite_expired');
  end if;

  if exists (select 1 from league_members
             where league_id = v_league.id and user_id = p_user_id) then
    return jsonb_build_object('ok', false, 'reason', 'already_member',
      'league', jsonb_build_object('id', v_league.id, 'name', v_league.name));
  end if;

  -- draft_status != 'not_started' -> refuse. Distinct reason so clients can
  -- surface "This league's draft has already started" instead of a generic
  -- failure. See header comment for why this sits here (after the lock and
  -- after already_member) and why 'completed' is refused too.
  -- 20261123000000: so is a league whose draft room has opened (T-1h). Same
  -- clock as the room, the order and the leave window: _draft_order_is_due.
  -- A postponed draft has no draft_date, so it stays joinable.
  if v_league.draft_status <> 'not_started'
     or public._draft_order_is_due(v_league.draft_date) then
    return jsonb_build_object('ok', false, 'reason', 'draft_started',
      'league', jsonb_build_object('id', v_league.id, 'name', v_league.name));
  end if;

  select count(*) into v_count from league_members where league_id = v_league.id;
  if v_count >= v_league.num_participants then
    return jsonb_build_object('ok', false, 'reason', 'league_full');
  end if;

  insert into league_members (league_id, user_id, role)
  values (v_league.id, p_user_id, 'member');

  if v_from_invite then
    update league_invites set status = 'accepted' where id = v_invite.id;
  end if;

  -- 20261128000000: a rejoiner is never named as having left (Giorgio, 2026-11-10),
  -- at any size and whatever the choice. Their entry leaves `departed`; when no
  -- one else is in it the row goes (departed may not be empty). A LIST test per
  -- entry: an entry that is not the joiner's (a missing user_id included) is kept.
  -- Never for a bot: leave_league refuses bots, so none is ever in departed.
  if p_user_id not like 'bot-%' then
    delete from league_roster_reconfirm r
     where r.league_id = v_league.id
       and not exists (select 1 from jsonb_array_elements(r.departed) e
                        where lower(e ->> 'user_id') is distinct from lower(p_user_id));
    v_cleared := found;
    update league_roster_reconfirm r
       set departed = (select jsonb_agg(e order by o)
                         from jsonb_array_elements(r.departed) with ordinality as x(e, o)
                        where lower(e ->> 'user_id') is distinct from lower(p_user_id)),
           updated_at = now()
     where r.league_id = v_league.id
       and exists (select 1 from jsonb_array_elements(r.departed) e
                    where lower(e ->> 'user_id') = lower(p_user_id));
  end if;

  -- 20261107000005: "Invite someone new" was waiting for exactly this.
  delete from league_roster_reconfirm r
   where r.league_id = v_league.id
     -- 20261128000000: below four the invite is implicit, and four in is ready
     -- (v_count was read before this member's insert, so v_count + 1 is the count
     -- now, bots included, as draft-control counts it). At four or more, only an
     -- explicit 'invite' is answered by a join; a 'pending' one never is.
     and ((r.below_floor and v_count + 1 >= 4)
          or (not r.below_floor and r.choice = 'invite'))
     and p_user_id not like 'bot-%'
     and (v_league.league_type is distinct from 'matchup'
          or v_league.playoff_teams is null
          or v_league.playoff_teams <= v_count + 1);   -- v_count was read before this member's insert
  v_cleared := v_cleared or found;   -- 20261128000000
  if v_cleared then   -- 20261128000000: was `if found`
    -- Its own exception scope: the function-wide unique_violation handler below
    -- must not report a finalize failure as 'already_member' (security review).
    -- A failed finalize rolls back only itself; the join and the clear stand,
    -- and the order is set lazily by the next read or cron tick (every finalize
    -- path re-runs _draft_order_sync), so the gap is recoverable, not permanent.
    begin
      perform _draft_order_sync(v_league.id, false);   -- we hold the league row lock
    exception when others then
      raise warning 'join_league_by_code: deferred draft-order finalize for % (%: %)', v_league.id, sqlstate, sqlerrm;
    end;
  end if;

  return jsonb_build_object('ok', true,
    'league', jsonb_build_object('id', v_league.id, 'name', v_league.name));

exception
  -- composite PK (league_id, user_id): a concurrent same-user double-submit that
  -- slipped past the pre-check -> resolve to a clean already_member, not a 500.
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'already_member',
      'league', jsonb_build_object('id', v_league.id, 'name', v_league.name));
end;
$$;

revoke all on function join_league_by_code(text, text) from public;
revoke all on function join_league_by_code(text, text) from anon;
revoke all on function join_league_by_code(text, text) from authenticated;
grant execute on function join_league_by_code(text, text) to service_role;

-- ---- 4. backfill: rows already in prod ------------------------------------------------
-- One transaction with the rest of the file (db push wraps each file). Row by row, each
-- under its leagues row lock (the lock every runtime writer takes first, in the same
-- order: league, then reconfirm). Idempotent: a second run finds nothing to change.
do $$
declare
  c_min   constant int := 4;   -- MIN_DRAFT_MEMBERS (draft-control/rules.ts)
  v_id    uuid;
  v_r     public.league_roster_reconfirm%rowtype;
  v_l     public.leagues%rowtype;
  v_e     jsonb;
  v_t     timestamptz;
  v_left  timestamptz[];
  v_n     int;
  v_floor timestamptz;
  v_below boolean;
  v_keep  jsonb;
begin
  for v_id in select league_id from public.league_roster_reconfirm order by league_id loop
    select * into v_l from public.leagues where id = v_id for update;
    select * into v_r from public.league_roster_reconfirm where league_id = v_id for update;
    if not found then
      continue;
    end if;

    -- Every recorded leave time. A value that does not parse is skipped (never
    -- aborts the push); skipping a leave can only make the history look LESS
    -- below four, which keeps today's question.
    v_left := '{}';
    for v_e in select e from jsonb_array_elements(v_r.departed) e loop
      begin
        v_t := (v_e ->> 'left_at')::timestamptz;
      exception when others then
        v_t := null;
      end;
      if v_t is not null then
        v_left := v_left || v_t;
      end if;
    end loop;
    select count(*)::int into v_n from public.league_members where league_id = v_id;

    -- a. The first recorded leave after which fewer than four were in. "In right
    --    after time t" = the current members who had joined by t + the recorded
    --    leavers who left after t (rejoiners' entries included: (c) runs last).
    select min(t) into v_floor
      from unnest(v_left) t
     where (select count(*) from public.league_members m where m.league_id = v_id and m.joined_at <= t)
         + (select count(*) from unnest(v_left) u where u > t) < c_min;
    v_below := v_r.below_floor or v_n < c_min or v_floor is not null;

    -- b. Rule 2, as the join would have applied it: a HUMAN joined after the drop
    --    and that join itself made four (the same replay at their joined_at); four
    --    or more now; P <= members (matchup). A bot alone never clears.
    if v_below and v_n >= c_min
       and (v_l.league_type is distinct from 'matchup'
            or v_l.playoff_teams is null
            or v_l.playoff_teams <= v_n)
       and exists (select 1 from public.league_members m
                    where m.league_id = v_id
                      and m.user_id not like 'bot-%'
                      and m.joined_at > v_floor
                      and (select count(*) from public.league_members x where x.league_id = v_id and x.joined_at <= m.joined_at)
                        + (select count(*) from unnest(v_left) u where u > m.joined_at) >= c_min) then
      delete from public.league_roster_reconfirm where league_id = v_id;
      continue;
    end if;

    -- c. Rule 1: whoever is a member again is not "someone who left". An entry
    --    with no user_id is kept. No one left in it: the row goes.
    select jsonb_agg(e order by o) into v_keep
      from jsonb_array_elements(v_r.departed) with ordinality as x(e, o)
     where not exists (select 1 from public.league_members m
                        where m.league_id = v_id
                          and lower(m.user_id) = lower(e ->> 'user_id'));
    if v_keep is null then
      delete from public.league_roster_reconfirm where league_id = v_id;
    elsif v_keep is distinct from v_r.departed or v_below is distinct from v_r.below_floor then
      update public.league_roster_reconfirm
         set departed = v_keep, below_floor = v_below, updated_at = now()
       where league_id = v_id;
    end if;
  end loop;
end;
$$;
