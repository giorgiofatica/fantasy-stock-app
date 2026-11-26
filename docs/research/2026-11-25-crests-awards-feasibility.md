# Crests: can awards be worked out from the record, and what uses the avatar

Worker report for the Orchestrator, 2026-11-25. Answers worker questions 5 and 6 of
`docs/plans/2026-11-25-crests.md` (approved, "approved both"; read from
`origin/research/earned-cosmetics-onboarding-tools` @ `82a174af`). Read on `main` @ `0687e35f`,
plus `docs/architecture/db-snapshot.json` (captured 2026-11-24T06:54:11Z) for what prod has.
Nothing was built, queried or deployed.

The crest list in the plan is a placeholder. Each row below is read as a *kind* of condition.

## Summary

- **Seven of the eight conditions can be read from what is recorded today.** The exception is
  the starter: it is a random pick, so it has to be stored when it is made. That was always
  the plan.
- **One finding needs a ruling before anything is built: a takeover rewrites history.**
  `take_over_team` (`20261125000006`) moves every row of a deleted seat to the new manager:
  matchups (team1, team2, winner), standings, drafts, trades, week snapshots and
  `league_seasons` champion and runner-up. A function that works awards out of the record
  would give the new manager "First week won", "First draft" and even "League champion" for
  weeks somebody else played. Nothing records when the seat changed hands: the accepted
  `league_invites` row (kind `'takeover'`, `seat_user_id`) has no timestamp, and
  `joined_at` is kept on purpose. Ruling 1 below.
- **A deleted account would get its crests back.** `scrub_deleted_manager` deletes per-user
  tables one by one from an explicit list (`20261125000005` lines 214–229). A deleted seat
  keeps its `user_id` on matchups, drafts and standings. So a re-runnable function would
  award the deleted id again on its next run, unless it skips deleted ids and the new
  holdings table is added to the scrub list.
- **Two conditions have a partial-state trap of the kind CLAUDE.md lists.** "Best week in the
  league" needs every matchup of that league-week scored, and a crest cannot be taken back
  ("nothing to lose"). "Made the playoffs" must read every playoff row, because the seeds
  with a bye are not in round 1.
- **Run it back is free.** A renewed season is a new `leagues` row with its own matchups,
  standings, draft and `league_seasons` row (`20261115000000`). Every condition below works
  per league row and needs no lineage logic. Lineage matters only for a crest that spans
  seasons, and none on the list does.
- **No app on the phone draws `user_profiles.avatar`, and nothing writes it except the paused
  web Profile page.** It can be replaced cleanly. My recommendation is to replace it and
  remove it, not reuse it (section 2).

## 1. Each "earned when" against the record

Conventions for every row:
- **"Scored"** means `matchups.team1_gain IS NOT NULL`. Since `20261208000000`,
  `outcome_reason IS NOT NULL` means the same thing. Old rows carry `'not_recorded'`, never
  NULL. `process-week-results` writes the gains, the winner, `is_tie` and the reason in ONE
  update per row (`index.ts:1046`), so a single row is never half-scored.
- **Wins are read from `matchups`, never from `league_standings`.** The standings increment is
  a separate write after the matchup write. A failure between the two leaves a scored
  matchup with stale standings, so the standings table can lag the record.
- **Who can earn:** a uuid-shaped id that has a `user_profiles` row and no
  `account_deletions` row, and whose `league_members` row in that league has
  `deleted_at IS NULL`. Bots are `bot-…` (`claims_not_bot` uses `^bot-`). Test ids such as
  `test-user-2` are not uuids. Bots and test ids fail the uuid test.
- **Ids are text on `matchups`, `drafts`, `league_members` and `league_standings` but uuid on
  `trades`.** Compare as `lower(x::text)` (CLAUDE.md, cross-table casts).

| Crest (kind) | Readable today? | Source columns | Partial-state traps | New record needed |
|---|---|---|---|---|
| **Starter**: first time in any league | **No, by design** (it is a random choice) | Trigger: a `league_members` row for a human id. Distinctness: other members' starters in that league | (a) Members join through at least five paths: the app inserts `leagues` plus its own row (`league_members_insert_self`; there is no `create_league` RPC), `join_league_by_code`, `respond_to_renewal`, `take_over_team`, and the web join through `join-league`. A grant written in one path misses the others, so put it in an AFTER INSERT trigger on `league_members`. (b) A member who leaves before the draft has their row DELETED, so a periodic function would never see them; the trigger has to grant at insert. (c) Two people joining at once can draw the same "free" starter. Joins already lock the `leagues` row (`leave_league` and `join_league_by_code` both say so); the grant must run under that lock, or under an advisory lock keyed on the league. | A holdings row with `source = 'starter'`, written once and never chosen again |
| **First draft**: a draft you took part in finishes | **Yes** | `leagues.draft_status = 'completed'`, set by `finalize_league_draft` in the same transaction as matchups, standings and the `league_seasons` row. Plus a `league_members` row for the user. `league_seasons.started_at` gives the time | Key on `draft_status = 'completed'`, never on "has `drafts` rows": picks are written one at a time during the draft. **Ruling 2:** does a manager whose every pick was `auto_queue`/`auto_best`/`auto_skip` (`drafts.pick_source`) "take part"? **Takeover:** the drafts move to the new manager (ruling 1) | none |
| **First week won** | **Yes** | `matchups.winner_user_id = me` on a scored row | **Ruling 3:** which wins count? `outcome_reason` tells them apart: `dollar_gain` / `percent_tiebreak` (played and won); `team2_empty_auto_loss` / `team1_empty_auto_loss` (the other side held no stocks); `playoff_no_opponent` / `playoff_seed_tiebreak` / `both_empty_playoff_seed_tiebreak` (advanced on seed). A regular-season bye is `bye_no_result` with a NULL winner, so it is never a win and needs nothing. Rows scored before 2026-12-08 say `'not_recorded'`, so for existing accounts a forfeit win cannot be told from a played one. If the ruling excludes forfeit wins, old rows have to be counted in or counted out wholesale | none |
| **Three wins in a row**, one league | **Yes** | Scored `matchups` for the user in one `league_id`, ordered by `week_number` | **The gap trap:** wins in weeks 1, 2 and 4 with week 3 unscored (refused, or still pending) are NOT three in a row. The function must require that weeks N, N+1 and N+2 are all scored wins. "Skip weeks that have no row yet" is the existence-check bug in another form. **Ruling 4:** does a `bye_no_result` week break a run, get skipped, or count? Do playoff weeks count? A run cannot cross into a renewed season (that is a different league row) unless he says it should | none |
| **Best week in the league** | **Yes, with a completeness guard** | Per (league, week): `team1_gain`, `team2_gain` on every row, or `team1_percent_gain` / `team2_percent_gain` | **The main trap.** Matchups in one week are scored row by row, and some can be refused (`skipped[]`). Take the maximum over the scored rows while one row is still unscored, and a crest can go to someone who is later beaten, and it can never be taken back. Guard: count every row for (league, week) and award only when all of them are scored. For a regular-season week, check per participant that every member has a scored row as team1 or team2 (byes included: a bye row's `team1_gain` is the real weekly gain). **Ruling 5:** "best" measured in dollars or in percent? In a playoff week only the bracket plays: does the crest exist that week? Can a bot's best week block the crest (recommendation: compare only the humans who can earn; ask)? A team with no stocks scores `dollarGain = 0`, so in a week where every gain is negative it would be "best". Ties are given to each manager (plan's reading; matches the record) | none |
| **Made the playoffs** | **Yes** | Every `matchups` row with `is_playoff = true` for the league: `team1_user_id`, `team2_user_id` in any round. `leagues.season_status IN ('playoffs','completed')` | **The partial-view trap.** Seeds with a bye are not round-1 rows; they are placed in their round-2 slots (`index.ts:167`, `_shared/playoff-bracket.ts`). Read only round 1 and the top seeds, the best managers, never get the crest. Read the union across all rounds. The bracket is inserted atomically with the `'active'→'playoffs'` flip (`start_league_playoffs`, `20261012000001`), so `season_status <> 'active'` means the bracket is whole. Later advancement adds no new people | none |
| **Finished a season** | **Yes** | `league_seasons.completed_at IS NOT NULL` (or `leagues.season_status = 'completed'`, set in the same transaction by `complete_league_season`). Who was in it: `league_seasons.final_standings` (jsonb of `{user_id, rank, ...}`) or the `league_members` rows | Completion can lag, because `healUncompletedSeasons` retries it (F-B). That is fine for a re-runnable function, as long as it keys on `completed_at` and not on "the final is scored". No one can leave mid-season (`leave_league`: refused after the draft until `completed`). A leaver after the season keeps the row with `hidden_at` set and still counts. A deleted seat is excluded by the "who can earn" rule. Duration leagues never complete today (`20261203000000`), so nothing to handle | none |
| **League champion** | **Yes** | `league_seasons.champion_user_id` (text) | `complete_league_season` (`20261015000000`, `20261115000007`) refuses a champion that does not match the scored final, so this is the most trustworthy column in the set. **Takeover** writes it to the new manager (ruling 1) | none |
| *(not on the list; for later)* | | `claims.status = 'won'`, `trades`, `week_snapshots` | `claims` is live since 2026-11-24 and records `won`/`lost` with `resolved_at`, so "first claim won" is readable. `week_snapshots` could back a percent-based best week, but `matchups` already stores the percents the scorer used, so read those instead | |

### Run it back, specifically

- Every condition is per league row, and a renewed season is its own row. So season 2 is
  scored, drafted and completed exactly like season 1, and nothing needs `lineage_id`.
- The starter is unaffected: a renewal member already holds one. A newcomer to a renewal
  joins by code and goes through the same `league_members` insert.
- For "friends get different starters", the plan's rule ("nobody in that league holds
  yet") is per league row. Season 2 has the same people, so nothing changes.
- `previous_league_id` / `lineage_id` would matter only for a crest such as "back-to-back
  champion" or a run that crosses seasons. It is not on the list; flag it if one is added.

## 2. What uses `user_profiles.avatar` today

**The column.** `text DEFAULT '📊'` (`20251230230000`). Every row that exists has `'📊'`
unless the web Profile page changed it.

**Writers**

| Where | What | Live? |
|---|---|---|
| `apps/web/src/pages/Profile.jsx:135` | own-row update `{ avatar: newAvatar }` (the emoji picker) | **No.** `APP_PAUSED = true` (`App.jsx:38`), so every page but the landing is tree-shaken out |
| Any client, through PostgREST | `PATCH /user_profiles?id=eq.<self>` with any `avatar` text | **Yes.** Policy "Users can update own profile" (PUBLIC, `auth.uid() = id`), table grant `authenticated=arwd`, `columnAcls: {}`, no CHECK on `avatar`. This is the gap the plan closes |
| `league_members_freeze_leaver` trigger (`20261125000001`) | copies `p.avatar` → `league_members.frozen_avatar` when `hidden_at` is set; NULL for a deleted seat | live |
| `scrub_deleted_manager` (`20261125000005:214`) | deletes the `user_profiles` row, which takes the avatar with it | live |
| Signup (`handle_new_user_profile`) | does not set it; the default applies | live |

The mobile app writes no avatar. `ProfileView.tsx:20` records that the emoji picker was dropped.

**Readers**

| Where | What | Live? |
|---|---|---|
| `get_visible_profiles(text[])` (latest body `20261125000001`) | returns `(id, username, avatar)`: live `p.avatar`; `frozen_avatar` for a leaver shared only through hidden leagues; NULL for a deleted seat | the function is live; its only caller is web `UserProfilesContext.jsx:30`, which is paused |
| `apps/web/src/context/UserProfilesContext.jsx` | caches `avatar` (default `'📊'`), plus a realtime subscription to `user_profiles` (`:126`) | paused |
| `apps/web/src/pages/Profile.jsx:50` | own `select('username, avatar')` | paused |
| `league_members.frozen_avatar` | a leaguemate can read it directly (`league_members_select_members`); only `get_visible_profiles` reads it | live, unused by the phone |
| Mobile | **nothing.** `SessionProvider.tsx:206` selects `username` only. `<Avatar uri>` / `avatarUri` exist in the props of `Avatar`, `ManagerRow`, `Scoreboard` and `PlayerCard`, but no caller fills them, so every mark is initials | n/a |
| Edge functions | nothing (`grep -i avatar supabase/functions` is empty) | n/a |
| Tests | `profile_visibility.pglite`, `frozen_leaver_names.pglite`, `account_deletion.pglite`, `profile_visibility_callsites`, `db_snapshot_sql.pglite`, `docs/security/*-effect-test.sql` all assert the avatar column or its frozen copy | must be updated with any change |

**Grants and exposure, as prod has them** (db-snapshot):
- SELECT: `user_profiles_select_self` (authenticated, `id = auth.uid()`). `anon` has no table
  grant (`20261118000001`).
- INSERT and UPDATE: own row, any column, any value.
- Realtime: in `supabase_realtime` with columns `id, username, created_at, updated_at,
  avatar, notifications_enabled`. RLS is applied per subscriber, so each person receives
  only their own row's changes.
- The phone gets other managers' names from definer RPCs that call
  `league_participant_display_name` (`get_league_display_names`, `get_home_summary`,
  `get_season_result`, `get_season_matchups`, `get_league_history`, `get_renewal_roster`;
  the build worker must confirm the exact list from each function's latest body). None of
  them returns an avatar today.

**What closing it would touch**

*Option A, reuse `avatar` as the worn crest.*
- A BEFORE INSERT/UPDATE trigger on `user_profiles` that refuses any `avatar` that is not
  NULL and is not a crest the caller holds. A column revoke does not work here: the table
  grant covers every column, and the per-column allowlist that would replace it silently
  leaves out every future column (`20261007000000` explains why that was rejected for
  `username`).
- Migrate every `'📊'` (and any emoji) to NULL, and drop the default.
- **The catch:** `frozen_avatar` rows that are already frozen hold `'📊'`, and the freeze
  trigger ignores every write to a hidden row's snapshot by design. So legacy values stay
  forever, and every reader has to map "not a known crest key" to no crest. That is an
  overloaded value that stands in for "no crest", the exact shape CLAUDE.md warns about.
- Web `Profile.jsx` writes would start failing. They are paused, but the code should still go.

*Option B, replace it and remove it (recommended).*
- A new worn-crest pointer that no client can write: either `crest_holdings.worn boolean`
  with a partial unique index `(user_id) WHERE worn`, or `user_profiles.worn_crest_id`
  written only through a `set_worn_crest(p_crest_id)` definer RPC (caller = `auth.uid()`,
  no id parameter, refuses a crest the caller does not hold). With the holdings table, the
  "holds it" check is a foreign key in the database, not a check in a function.
- A new freeze: add `frozen_crest_id` to `league_members`, with the same rules in
  `league_members_freeze_leaver` (copy on hide; NULL for a deleted seat; fixed while
  hidden). Old leavers get NULL, which honestly means "had no crest". Decide whether
  existing hidden leavers are backfilled with the crest they *would* have worn. They had
  none when they left, so NULL is the truthful value.
- `league_participant_display_name`'s twin, `league_participant_crest(league, user)`, with
  the same branches (bot or non-uuid → NULL; hidden → frozen; deleted → NULL; else live
  worn). Each name-returning RPC above returns it beside the name, so the name and the
  crest can never follow different rules.
- `get_visible_profiles`: either return the crest in place of `avatar` or leave it as it is
  for the paused web app. Then drop `user_profiles.avatar` and `league_members.frozen_avatar`
  in a later migration, after the web code that reads them is removed. Removing the column
  also takes it out of the realtime publication's column list.
- The account-deletion scrub list gains `crest_holdings` (and the reveal state). The
  `heal-account-deletions` `not_scrubbed` check should see it too.
- Tests: the five pglite and effect tests above.

Why B: the plan says "reuse it, or replace it and remove it". Reuse saves one column but
inherits a default emoji in every row, an unwritable legacy value in every frozen leaver,
and a self-writable column that needs a trigger to close. B starts from a value no client
can forge, and the old column dies with the paused web code that is its only reader.

## 3. The shape of the award function (prose sketch)

**Tables**
- `crests`: the catalogue, as DATA. `id` (a stable text key such as `first_week_won`),
  `kind` (`'starter'` or `'earned'`), `rule` (a key naming one of a fixed set of
  conditions, such as `draft_completed`, `week_won`, `wins_in_a_row`, `best_week`,
  `made_playoffs`, `season_completed`, `champion`), `params jsonb` (for example `{"n": 3}`
  for `wins_in_a_row`, or `{"metric": "dollars"}`), `active boolean`, and `sort`. Words and
  art keys live here or in the app, as the Design Lead decides. Changing the list means
  inserting, deactivating or re-parameterising rows. Adding a new *kind* of condition (a new
  `rule`) is the only change that touches the function, and that is unavoidable: data can
  choose among conditions, but it cannot define a new query safely. "Three wins in a row"
  becoming "four" is a data change.
- `crest_holdings`: `(user_id uuid, crest_id) PRIMARY KEY`, `earned_at`, `league_id`
  (where it was earned; informational, since a crest is worn everywhere), `source`
  (`'starter'`, `'award'` or `'backfill'`), `revealed_at` (NULL until the reveal has
  shown; the reveal reads `revealed_at IS NULL`, and a single own-row RPC sets it). The
  primary key is what makes the function idempotent.
- RLS: owner-only SELECT. No client INSERT or DELETE. The only client write is through the
  own-row RPCs (wear one; mark one revealed). Revoke from `anon` explicitly, then verify
  with `proacl` and `role_table_grants`, not with the migration's say-so.

**`award_crests(p_league_id uuid)`**, service role only:
1. Lock nothing global. Read the league once: `draft_status`, `season_status`, the
   matchups, `league_seasons`, and the members who can earn (uuid, profile exists, no
   deletion ledger row, `deleted_at IS NULL`; plus the takeover cut-off from ruling 1).
2. For each active `crests` row whose `kind = 'earned'`, evaluate its `rule` with its
   `params` as one set-returning SQL branch: "which of these members meet it in this
   league". Each branch applies its own completeness guard from section 1 (best week:
   every row of the week scored; wins in a row: consecutive scored weeks; playoffs: every
   playoff row).
3. `INSERT … ON CONFLICT (user_id, crest_id) DO NOTHING`. Return, per crest, the count that
   was **examined**, **met** and **inserted**, plus the weeks each guard **held back**
   (for example "week 7 not complete: 3 of 4 scored"). That way a run that writes nothing
   says why, instead of reading as "nothing earned" (CLAUDE.md, success signals; the
   verdict covers only what was examined).
4. A second run writes nothing, because every insert conflicts. A run after a half-scored
   week writes the crests that are certain and holds back the ones that are not; the next
   run, once the week is complete, writes those. No crest is ever removed.

**Where it runs.** After the matchup writes in `process-week-results` (each league it
touched), after `finalize_league_draft`, after `start_league_playoffs`, and after
`complete_league_season`. Plus one sweep on a schedule over every league with
`draft_status = 'completed'`, the heal for a run that was missed. The callers check the
rpc's `{ error }`; an award failure must never fail scoring. Better still, call it from the
edge function after the scoring writes succeed, not from inside the scoring transaction.

**The starter** is not part of `award_crests`. An AFTER INSERT trigger on `league_members`
(human id, no starter held) picks one at random from the active starters held by nobody in
that league, or from all of them when every one is taken, and inserts it with
`source = 'starter'`. It runs under the league lock that every join path already takes, so
two joiners cannot draw the same one. The app's reveal on "You're in" then reads the
unrevealed starter.

**Existing accounts.** One backfill, run once, in two passes:
1. Starters: for every human with at least one `league_members` row, ordered by their
   earliest `joined_at`, so that within each league earlier members pick first. Pick as the
   trigger does. Mark `source = 'backfill'`.
2. `award_crests(l)` for every league with `draft_status = 'completed'`, all seasons
   included (old league rows are kept; `on delete restrict` protects any with a successor).

**Ruling 6:** do backfilled crests get a reveal (`revealed_at` NULL, so the first open
after the build plays one reveal after another; an existing manager with a season behind
them could see seven), or are they marked revealed, or does one combined reveal show them?
Rows scored before 2026-12-08 carry `outcome_reason = 'not_recorded'`, which matters only if
ruling 3 excludes forfeit wins.

**Tests the plan asks for, made concrete:** a week with 3 of 4 matchups scored (best week
held back, then awarded); a playoff with byes (the top seeds get "Made the playoffs"); wins
in weeks 1, 2 and 4 with week 3 unscored (no crest until week 3 is scored and won); the
function run twice (zero inserts); a deleted seat (nothing awarded, and the scrub removes
holdings); a takeover (per ruling 1); two simultaneous joins to one league (different
starters).

## Rulings needed (to the Planner, for Giorgio)

1. **Takeover.** The new manager inherits the seat's record whole ("keep the teams record
   just the owner is gone"). Should they also be awarded crests for what that seat did
   before they took it? Options: (A) no, award only for weeks, drafts and seasons after the
   takeover; (B) yes, the seat's record is theirs now. The champion case makes it
   concrete: a team taken over in the playoffs that goes on to win. **A needs a new
   record.** Nothing stores when a takeover happened: `league_invites` has no
   `accepted_at` (`status` flips to `'accepted'`, `20261125000006:522`), and
   `take_over_team` keeps `league_members.joined_at` on purpose. So A means adding, for
   example, `league_members.seat_taken_at` written by `take_over_team`, plus the week it
   took effect. Takeovers that already happened have no time and would need a cut-off of
   their own (all excluded, or all included). Recommendation: A.
2. **First draft:** does a draft where every one of your picks was made automatically count?
3. **First week won:** do wins where the other team held no stocks, and playoff advances on
   seed or with no opponent, count?
4. **Three in a row:** does a bye week break a run? Do playoff weeks count?
5. **Best week:** measured in dollars or in percent; regular season only or playoffs too;
   compared over humans only or over everyone including bots?
6. **Backfill reveal:** one reveal per crest, marked as already shown, or one combined
   moment?
7. **Avatar:** reuse or replace. Recommendation: replace and remove (section 2, option B).
   This is the Orchestrator's call with the reviewers more than Giorgio's, since nothing he
   can see changes.
