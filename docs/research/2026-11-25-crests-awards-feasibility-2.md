# Crests, second report: the 16 new rows against the record

Worker report for the Orchestrator, 2026-11-25. Answers "A second feasibility report comes
before the server is built" in `docs/plans/2026-11-25-crests.md`, section "Amended 2026-11-25:
the list is his, and it is 21" (read from `origin/docs/crest-list` @ `9cc0b0b9`, PR #631, not
yet merged). Read on `main` @ `a8efa84a`, with `docs/architecture/db-snapshot.json` (captured
2026-11-24T06:54:11Z) for what prod has. Nothing was built, queried or deployed.

It follows the first report (`docs/research/2026-11-25-crests-awards-feasibility.md`) and
keeps its conventions: "scored" is `matchups.team1_gain IS NOT NULL`; wins come from
`matchups`, never from `league_standings`; ids are compared as `lower(x::text)`; "who can
earn" is a uuid id with a `user_profiles` row, no `account_deletions` row, and
`league_members.deleted_at IS NULL` in that league. Rulings 1 to 8 of "Settled during the
build" stand and are applied below, not reopened.

## Summary

- **13 of the 16 can be worked out from what is recorded today**, with guards. Nothing new is
  stored for them beyond `seat_taken_at` (already ruled, ruling 1).
- **"A friend joined" cannot be read at all.** The invite link and the invite code are the
  SAME thing, the league's one `leagues.invite_code`, and any member can share it. No join
  path records who shared it. It needs new work: a personal invite code per member and the
  app's Share sending it (section 3). **This is the one row that could hold the others back.**
  It is not dropped or put off here; it is a question for Giorgio via the Planner.
- **"Started a league" needs a record made at the moment of creation.** `leagues.commissioner_id`
  is the creator only until the first `transfer_commissioner` (or an account deletion's
  succession) rewrites it, and a league deleted before its draft leaves nothing. A trigger on
  the `leagues` insert can give it, cheaply. Existing accounts can be backfilled exactly only
  for leagues that were never handed over.
- **The standard crest is easy and self-healing.** The hook is `handle_new_user_profile`
  (`20261005000001`), the one writer of `user_profiles`. The backfill reaches older accounts
  with one insert over `user_profiles`, and the sweep can top up any account missing it.
- **Three corrections to the first report, found while checking these rows.** They matter to
  rows it marked "yes":
  1. **`league_seasons` holds hand-written, fabricated seasons.** Migrations
     `20260125100000` and `20260125100001` insert three completed seasons (numbers 0, -1 and
     -2) into the "Test" league `c9992e34…`, with invented champions (one is Giorgio's own
     account, `769c3fad…`), runners-up and `final_standings`, and no matchups behind them.
     The retired `start_new_league_season` also deleted a league's matchups when it started a
     new season inside the same league row. So "League champion", "Finished a season" and
     every across-season crest need a **real-season guard** (section 1, conventions). The
     first report called `champion_user_id` "the most trustworthy column in the set"; that
     holds only for rows written by `complete_league_season`.
  2. **`final_standings` is built from the standings TABLE**, not from matchups:
     `complete_league_season` (`20261115000007:133-148`) snapshots the one-argument
     `league_standings_ranked(league)`, which reads `league_standings`. That is the source
     ruling 8 forbids. The Planner's reading "end-of-season crests read `final_standings`"
     should change to: work it out from matchups with the two-argument
     `league_standings_ranked(league, through_week)` (`20261112000000`, live in prod), and
     hold back if it disagrees with `final_standings`.
  3. **A takeover moves claims too.** `take_over_team` (`20261125000006:517-519`) rewrites
     `claims.user_id`, and the claims seat key is `ON UPDATE CASCADE`. So "First claim won"
     has the same takeover trap as the matchups.
- **One helpful find for ruling 1.** Every takeover since `20261125000006` was applied
  (2026-10-21) left a `league_notifications` row (kind `seat_taken_over`, `subject_user_id` =
  the new manager, `created_at`). That is the exact time a seat changed hands, for the past.
  The backfill of `seat_taken_at` can use it, and fall back to "the day the record starts"
  only where it is missing (it goes when the commissioner who received it deletes their
  account). This makes ruling 1 more exact; it does not change it.
- **Found in passing, not about crests:** `process-week-results` advances a league's week when
  the "anything still unscored?" read FAILS, because it discards the read's `{ error }`
  (`index.ts:1210-1217`, CLAUDE.md success signal #5). Section 5.

## 1. Conventions that every row below uses

**The takeover cut-off (ruling 1), made concrete per kind of crest.** Ruling 1 says only what
happens at or after `seat_taken_at` counts, and a season that completes while the manager
holds the seat is theirs to finish and win. Applied:
- **A week** counts for the manager who took the seat only if `matchups.week_start >=
  seat_taken_at`. The week's portfolio was set by the person who held the seat on Monday; a
  takeover on Wednesday does not make that week theirs. *(The first report's "First week won"
  needs the same cut. Recommendation: the Planner states it once for all weekly crests.)*
- **An act** (a pick, a buy, a claim, a join) counts only if its own time is at or after the
  cut-off: `drafts.recorded_at`, `trades.created_at`, `claims.placed_at`.
- **A season-end fact** goes to whoever holds the seat when it is decided. For the four
  regular-season crests (top seed, top scorer, unbeaten, last place) that is the end of the
  last regular week (`week_end` of the last `is_playoff = false` row): a takeover during the
  playoffs does not get them. For runner-up it is the final, like the champion. **This is a
  reading of ruling 1's second sentence, so it is listed as question Q1.** The alternative
  reading (only a seat held for the whole season counts) would need nothing new either.

**The real-season guard** (correction 1). A `league_seasons` row `s` of league row `l` counts
as a season only when all of these hold:
- `s.completed_at IS NOT NULL`;
- `s.season_number = l.season_number` (one season per league row since run it back; this
  drops the fabricated seasons 0, -1 and -2, and the legacy extra seasons);
- `l` has a scored playoff final (`is_playoff`, `playoff_round_number` = the bracket's last
  round, `team1_gain IS NOT NULL`) whose `winner_user_id` = `s.champion_user_id`.

The build worker should run one read-only count in prod first: how many `league_seasons` rows
fail the guard, and in which leagues. Those are the seasons the backfill will skip.

**The regular season is complete** when, for the league, the count of `is_playoff = false`
rows equals the count of those that are scored. A count against the expected set, never
`season_status`: the week can advance with a row unscored (section 5), and the schedule is
written whole by `finalize_league_draft`, so the expected set is fixed. A **league-week is
complete** on the same test for that `week_number`.

**Ties and tie-splitting (ruling 5) have a gap in old rows.** Ruling 5 splits a dollar tie by
percent. The percent columns (`team1_percent_gain`, `team2_percent_gain`) were added on
2026-11-20 (`20261208000000`) and were NOT backfilled, and they are NULL for a side that held
no stocks ("nothing may branch on a percent being NULL", the migration says). So for weeks
scored before 2026-11-20, and for a side with no stocks, a dollar tie cannot be split and each
tied manager earns it. Exact dollar ties are rare; the function must still not read a NULL
percent as 0.

**Compared against everyone, earned only by those who can** (ruling 5). Bots and deleted
seats (an "Open team" keeps playing on the deleted id) are in every comparison and earn
nothing. So a week a bot had the best result gives the best-week crest to nobody; the same
holds for the worst week, the biggest margin, top seed, top scorer and last place.

## 2. The 16 rows

### Standard (everybody): "An account is made"

- **Readable today:** n/a, it is unconditional. Every account should hold it.
- **The hook.** `handle_new_user_profile()` (`20261005000001:46-90`), `SECURITY DEFINER`,
  `AFTER INSERT ON auth.users`. It is the only writer of `user_profiles` rows (no app or edge
  function inserts one; the 2026-10-05 backfill `20261005000004` ran once). Apple, Google and
  email sign-ups all insert `auth.users`, so all go through it. Two ways to hang the grant:
  - inside `handle_new_user_profile`, after the profile insert, in its own
    `begin … exception when others then … end` block, because the function's rule is that
    nothing may fail a signup; or
  - **(recommended)** an `AFTER INSERT` trigger on `user_profiles` that inserts the standard
    holding. It fires for every profile however it was made, keeps the signup function
    untouched, and puts the grant next to the table the holdings key to. It still needs its
    own exception block.
- **Existing accounts.** In the same migration, **create the trigger first, then backfill**:
  `insert into crest_holdings (user_id, crest_id, source) select p.id, 'standard', 'backfill'
  from user_profiles p where not exists (account_deletions for p.id) on conflict do nothing`.
  In that order no account made during the push can be missed: one made before the backfill
  statement is in it, one made after is caught by the trigger, and `on conflict` absorbs the
  overlap. Then the sweep makes it self-healing: "every live profile holds the standard crest"
  is a count the sweep can check and fix.
- **Partial-state traps.** "Confirm email" is on, so `auth.users` and the profile exist before
  the email is confirmed; an unconfirmed account holds the crest. Harmless, but the app must
  not count holders. **The reveal** (an app question, not data): the standard crest is held
  from sign-up but is revealed on "You're in" (or "{name} is ready"). The reveal-on-open logic
  must leave the standard crest for that moment, or a new account sees it revealed on its
  first open before joining anything. For existing accounts, ruling 6 applies: the standard
  crest is their one reveal.
- **Takeover / deleted:** none / the holding goes in the scrub list (first report).
- **New record:** the holding row; nothing else.

### Firsts: "First claim won" (a claim of yours fills)

- **Readable today: yes.** `claims.status = 'won'`; the CHECK `claims_won_has_buy` guarantees
  `buy_trade_id IS NOT NULL`, so "won" means filled. `claims_resolved_shape` guarantees
  `resolved_at` on every non-pending row. `claims_not_bot` keeps bots out. Live since
  2026-11-24, so history is short.
- **Takeover (correction 3).** `take_over_team` moves the seat's claims to the new manager.
  Count only `placed_at >= seat_taken_at`. In practice the deleted manager's pending claims are
  deleted by the scrub (`20261125000005:228-229`), so no claim of theirs can fill after the
  takeover; the test is still required, because their earlier won claims move.
- **Partial state:** none. `commit_claims_run` writes every outcome of a league's run in one
  transaction, and a claim row is never half-resolved.
- **Deleted:** won claims stay on the deleted id; skipped by "who can earn".
- **Where it runs:** after `claims-run` commits a league (a new call site), plus the sweep.
- **New record:** none.

### Firsts: "Started a league" (you create a league)

- **Readable today: only partly.** The create path is two client inserts
  (`apps/mobile/app/create-league.tsx:208-238`): `leagues` with `commissioner_id = user.id`
  (the policy `leagues_insert_self_commissioner` pins it to `auth.uid()`), then the
  commissioner's `league_members` row. Nothing else records the creator.
- **Why the record is not enough:**
  - `transfer_commissioner` (`20261120000000:90`) rewrites `leagues.commissioner_id`, and so
    does the scrub's succession when a commissioner deletes their account. A function reading
    `commissioner_id` later would give the crest to the new commissioner, who did not create
    the league.
  - A commissioner can delete a league before its draft (`leagues_delete_commissioner`, with
    `trg_leagues_delete_before_draft`, `20261205000100`), and the scrub deletes some leagues.
    A league deleted is gone from the record, so a function that reads later never sees it.
    This is the starter's old problem (first report): the grant must be made at the moment.
  - The two inserts are separate requests, so a league can exist with no member row if the
    second fails. The creator still created it.
- **Recommendation:** an `AFTER INSERT` trigger on `leagues` that gives the crest to
  `new.commissioner_id` when it is a human uuid and `new.previous_league_id IS NULL`. The
  insert policy guarantees that at insert time `commissioner_id` is the caller. Optionally
  also add an immutable `leagues.created_by`, set by the same insert, for any later reader.
- **A renewal** (`renew_league`, `20261115000003:143-157`) inserts a new `leagues` row too,
  with `commissioner_id` = the current commissioner, who may not be the person who started the
  league. Whether "Run it back" counts as starting a league is **question Q2**; the trigger
  above excludes it.
- **Existing accounts (backfill):** exact for a league that was never handed over. A handover
  leaves at least one `league_notifications` row of kind `commissioner_transferred` (from
  `transfer_commissioner` and from the scrub's succession). So: give the crest to
  `commissioner_id` of every existing league with **no** such row and no `previous_league_id`.
  A league that was handed over has lost its creator; inferring it (the member whose
  `joined_at` is closest to `leagues.created_at`) is a guess, and a crest is never taken back,
  so I recommend not guessing. Anyone missed earns it the next time they create a league.
  Leagues deleted before this release cannot be backfilled.
- **Takeover:** irrelevant (a takeover never makes anyone commissioner). **Deleted:** skipped.
- **New record:** the grant at insert (and optionally `leagues.created_by`).

### Firsts: "A friend joined" (someone joins a league by your invite)

- **Readable today: no.** Every join path, traced:

| Path | Code used | Inviter recorded? |
|---|---|---|
| App, typed code or `https://…/join/<CODE>` link → `join-league` → `join_league_by_code` (`20261128000000:341`) | `leagues.invite_code` (one per league) | **No.** The league's code has no owner. The link is the same code in a URL (`apps/mobile/lib/invite/inviteLink.ts:46-50`, "Join my league with code X" + the URL). |
| Web join page → same `join-league` function | same | No |
| `join_league_by_code` resolving a `league_invites.code` instead | a per-person code with `inviter_id` | **Half.** The invite row keeps `inviter_id`, but on use only `status` flips to `'accepted'`: there is no `accepted_by` and no `accepted_at`, so who used it is not recorded. Only the paused web app (`apps/web/src/hooks/useLeagues.js:215-228`) ever minted these, commissioner-only by policy. The phone never does. |
| `respond_to_renewal` (`20261115000003:269`) | none; the commissioner's renewal list | n/a (a returning member, not a new friend) |
| `take_over_team` | a takeover code, `league_invites.kind = 'takeover'`, `inviter_id` = the commissioner | Yes, the commissioner, and the `seat_taken_over` notice names the new manager. Whether a takeover counts is **question Q3** |
| `create-league` (the commissioner's own row), bots | none | n/a |

- **Who shares:** not only the commissioner. Share in `PreDraftCard` is shown by the leave
  window (`inviteShareShownFor`, `apps/mobile/lib/game/leagueSettingsEntry.ts:41`), not by
  role, and the code is drawn for every member. So "the commissioner invited everyone" would be
  wrong; it cannot be read off `commissioner_id` either.
- **What it needs (the smallest shape I can see):**
  1. A personal code per member and league: a new `league_invites.kind` (for example
     `'member'`), reusable, `inviter_id` = that member, minted on demand by a definer RPC (the
     table's SELECT is commissioner-only, so a member cannot read their own code without it).
     `join_league_by_code` already resolves `league_invites` codes (`v_from_invite`); for the new
     kind it must not flip the row to `'accepted'` and must write a new
     `league_members.invited_by`. The takeover lesson applies: every reader that filters
     `kind = 'invite'` (`join_league_by_code`, `invite_preview_lookup`, `preview-league`) must
     be checked so a new kind is let in on purpose and a takeover code never is.
  2. The app's Share (four call sites of `inviteShareMessage`) and the code shown on screen use
     the member's personal code. The link format `/join/<CODE>` is unchanged, so the web page
     and the app's link reader need no change. The league's own code keeps working, unattributed.
  3. The crest is then given at join, by a trigger on `league_members` insert (or in
     `join_league_by_code` itself) when `invited_by` is a human other than the joiner. At join,
     not later: a friend who leaves before the draft has their row DELETED, and the crest must
     not vanish with it ("never taken back").
  4. A side benefit, not part of this: `invite_preview_lookup` shows the commissioner's name as
     the "inviter" today (`20261125000008:238-248`); with personal codes it could show the
     person who actually sent the link. That is a product change, for the Planner.
- **Partial state:** none once the grant is at join. **Takeover:** see Q3. **Deleted:** an
  inviter who deleted their account earns nothing; a friend who later deletes theirs takes
  nothing from the inviter.
- **Existing accounts:** nothing to backfill. No past join can be attributed, except the
  web-era `league_invites` rows, whose user is unknown.
- **Size:** server (one kind, one RPC, one column, three readers re-checked, security review
  because codes are bearer capabilities) and app (Share, the code row, onboarding's create-done
  screen). Larger than every other row here, and **the one that could hold the release back.**

### In season: "Biggest margin" (you win by the widest margin in your league that week)

- **Readable today: yes**, from scored regular-season matchups: margin =
  winner's gain − loser's gain, in dollars, over rows with two teams and a winner.
- **Guards:** the league-week is complete (section 1); regular season only (ruling 5's "when
  every manager plays"; in the playoffs only the bracket plays).
- **Traps:**
  - **A forfeit win can have a negative margin.** On `team1_empty_auto_loss` /
    `team2_empty_auto_loss` the empty side scores $0, and the other side wins even with a loss
    of its own. Ruling 3 says such a win counts as a win. **Question Q4:** does it count for
    the margin? Rows scored before 2026-11-20 say `'not_recorded'`, so for them a forfeit cannot
    be told apart, which matters only if Q4 excludes forfeits.
  - **A percent-tiebreak win** has a dollar margin of 0. It can only be the week's biggest if
    every win that week was a percent tiebreak.
  - **Ties on the margin:** each manager with the same margin earns it; splitting by percent
    margin has the old-row gap above.
- **Takeover:** the week cut-off. **Deleted:** skipped; still compared. **New record:** none.

### In season: "Beat first place" (you beat the manager who was first when the week began)

- **Readable today: yes, and the function to do it already exists.**
  `league_standings_ranked(p_league_id, p_through_week)` (`20261112000000`, in prod by the
  snapshot) ranks the league as of the end of a week FROM MATCHUPS (regular season, scored rows
  only), with the same order as the standings and the seeds. "First when week W began" =
  `rank = 1` of `league_standings_ranked(l, W - 1)`. You earn it when your scored, non-bye,
  regular-season week-W matchup has that manager as opponent and you as `winner_user_id`.
- **The Planner's reading is right that it cannot be earned in week 1:** through week 0
  everyone is 0-0-0 at $0 and rank 1 is decided by join order. Require `W >= 2`.
- **The trap: the two-argument function silently skips unscored rows.** If week W-1 has one
  unscored matchup, it ranks from a partial set and its "first place" can be wrong. So require
  every regular-season row with `week_number <= W - 1` scored, plus the week-W row itself.
  Waiting for the earlier weeks is recoverable; trusting a partial ranking is not, since the
  crest is never taken back.
- **A second, smaller trap the migration names itself:** the function's roster comes from the
  `league_standings` table ("KNOWN GAP"), so a manager whose standings row failed to write is
  missing from the ranking. The ranking core `_league_standings_rank_core(jsonb, jsonb)` is
  pure, so the award function can feed it a roster taken from the matchups instead.
- **First place is one manager.** Ranks are strict (H2H, then season gain, then join order),
  so there is never a tie for first. Early in a season first place may be decided by season
  gain; that is the same order the standings screen shows.
- **The beaten manager may be a bot or a deleted seat;** the earner must be someone who can
  earn. **Takeover:** the week cut-off applies to the earner.
- **Question Q5: playoffs.** The Planner's "regular season only" covers the three weekly
  crests; this one is not named. His icon is a dog "bc underdog", and a low seed beating the
  top seed in the playoffs is the classic underdog win. In the playoffs "first place" is
  frozen at the regular season's final standings, so it is just as readable.
- **New record:** none.

### In season: "Worst week" (the worst result in your league that week)

- **Readable today: yes**, the mirror of the best week: the lowest dollar gain over every team
  of a complete regular-season league-week, byes included (a bye row's `team1_gain` is the real
  week).
- **Traps:**
  - **A team with no stocks scores $0.** In a week when everyone else gains, the empty team is
    worst; in a week when everyone loses, it can never be. That follows the record and needs
    no special case, but the Planner should know it.
  - Ties: each tied manager earns it (percent split has the old-row gap).
  - A bot or a deleted seat with the worst week gives it to nobody.
- **Takeover / deleted / new record:** as for the best week; none.

### End of season: "Runner-up" (you lose the final)

- **Readable today: yes.** `league_seasons.runner_up_user_id`, which `complete_league_season`
  (`20261115000007:122-130`) refuses unless it is the scored final's loser. Requires the
  real-season guard (correction 1: the fabricated season 0 has Giorgio as champion and season
  -1 as runner-up).
- **Takeover:** `take_over_team` rewrites `runner_up_user_id` with the champion
  (`:506-510`); the seat at the final earns it, as ruling 1 gives the champion.
- **Deleted:** skipped. **New record:** none.

### End of season: "Top seed" (the best regular-season record)

- **Readable today: yes**, two ways that should agree:
  - `rank = 1` of `league_standings_ranked(l, num_weeks)` (from matchups); or
  - the seed-1 team of the bracket (`matchups.team1_seed` / `team2_seed = 1` on the first
    playoff row it appears in; a bye seed sits in its round-2 slot).
- **Why not just the bracket:** the playoffs were seeded from the one-argument function, which
  reads the standings table; and `20261208000000` warns that playoff rows advanced before
  2026-07-27 could carry the LOSER's seed, so a later row can show a wrong "1". **Why not just
  the matchups:** the league saw the bracket; a crest that contradicts it would look wrong.
  **Recommendation: compute from matchups, compare with the seed-1 team of the lowest playoff
  round, award when they agree, and report a disagreement as held back.**
- **Question Q6:** "best regular-season record" with Giorgio's own rule "standings order ==
  seed order" means one manager (strict ranks). If he means the best win-loss record, two
  managers level on wins would both earn it. The plan's reading, a sprouting seed, reads as
  seed 1.
- **Guards:** regular season complete. **Takeover:** Q1 (holder at the end of the regular
  season). **New record:** none.

### End of season: "Top scorer" (the biggest total gain of the season)

- **Readable today: yes.** The sum of a manager's dollar gains over scored regular-season rows
  (as team1 or team2; byes included), which is exactly `points_for` of the two-argument
  `league_standings_ranked(l, num_weeks)`.
- **Choices the Planner should confirm (Q7):** regular season only (in the playoffs only the
  bracket plays, so including them would favour whoever went deepest); dollars (the matchups'
  measure). A tie gives one to each.
- **Not from `final_standings.points_for`:** that is the standings table's figure (correction 2).
  Cross-check, hold back on disagreement.
- **Guards / takeover / new record:** regular season complete; Q1; none.

### End of season: "Unbeaten" (no loss in the regular season)

- **Readable today: yes**, from matchups: the regular season is complete, and the manager has
  no scored regular-season non-bye row where the other team is `winner_user_id`.
- **Choices (Q8):** a tie (`is_tie`, `regular_season_true_tie`) does not break "unbeaten" in
  the usual sense, and the plan's line is "No loss". A forfeit loss (your own team held no
  stocks) is a loss. Byes are neutral (ruling 4's reasoning). Legacy bye wins in old rows are
  not losses, so they do not matter here.
- **Takeover:** Q1 is sharpest here: a seat unbeaten for nine weeks under one manager and one
  under the next. **New record:** none.

### End of season: "Last place" (you finish last)

- **Readable today: yes.** The highest rank of `league_standings_ranked(l, num_weeks)`
  (strict ranks, so one manager). Final standings rank only the regular season; the playoffs
  do not move anyone, so "finish last" is regular-season last.
- **A bot or a deleted seat in last place gives it to nobody.** In a league with bots this will
  often be a bot.
- **Cross-check** with the last entry of `final_standings`; hold back on disagreement.
- **Guards / takeover / new record:** regular season complete; Q1; none.

### Across seasons: "Back to back" (you win the same league two seasons running)

- **Readable today: yes, and exactly.** A renewed season is a new `leagues` row with
  `previous_league_id` = the season it renews (`20261115000000`; `renew_league` sets it,
  `20261115000003:143-157`), and `leagues_one_successor_uidx` allows one successor. So:
  league rows `l1`, `l2` with `l2.previous_league_id = l1.id`, each with a season passing the
  real-season guard, and the same id as `champion_user_id` of both.
- **No gap is possible:** `renew_league` refuses a league whose season is not completed, so
  "two seasons running" is exactly parent and child.
- **Legacy:** seasons stored inside one league row by the retired `start_new_league_season`
  are dropped by the guard, so they cannot form a pair. Correct, since their matchups are gone.
- **Takeover:** ruling 1 gives a champion who took the seat that season's title, so a pair can
  include one. **Deleted:** skipped.
- **Where it runs:** after `complete_league_season` for `l2`, plus the sweep. **New record:** none.

### Across seasons: "Three seasons" (you finish three seasons)

- **Readable today: yes:** the number of league rows whose season passes the real-season guard
  and in which the manager holds a `league_members` row with `deleted_at IS NULL` (a leaver
  after the season keeps the row, `hidden_at` set, and counts). One season per league row, so a
  count over league rows is a count of seasons.
- **Question Q9, a wording difference:** Giorgio said "three seasons played"; the plan says
  "You finish three seasons". With the count above they are the same, because nobody can leave
  between the draft and the end of the season (`leave_league` refuses). The open part is
  whether three seasons must be of one league, or any three (three leagues finishing the same
  week would then earn it at once). Recommendation: any three; that is what his words say.
- **Takeover:** ruling 1 ("theirs to finish"). **New record:** none.

### Across seasons: "Two leagues" (you win a title in two different leagues)

- **Readable today: yes:** count distinct `coalesce(l.lineage_id, l.id)` over the manager's
  real championships, at least 2. `lineage_id` is NULL on a league never renewed, so the
  `coalesce` is the documented lineage key (`20261115000000`). Two titles in one lineage (back
  to back) are one league here, which is the point of the crest.
- **Takeover / deleted / new record:** as for the champion; none.

### Across seasons: "Every Mag 7 stock" (held all seven, by a pick, a buy or a claim)

- **Readable today: yes.** Across every league the manager is in:
  - picks: `drafts.symbol` where `pick_source not in ('skip', 'auto_skip')` (the discriminator,
    never `symbol = 'SKIP'`; CLAUDE.md, overloaded values);
  - buys: `trades.symbol` where `action = 'buy'`;
  - claims: nothing separate. A won claim's buy IS a `trades` row (`claims.buy_trade_id`,
    written through `record_trade_atomic`), so `trades` covers it.
  The union of symbols, matched against the list.
- **The seven, as data.** Alphabet has two share classes, `GOOGL` and `GOOG`. The list should be
  seven groups, not seven tickers, for example
  `{"groups": [["AAPL"], ["MSFT"], ["GOOGL", "GOOG"], ["AMZN"], ["NVDA"], ["META"], ["TSLA"]]}`
  in the crest's `params`, so a change of ticker or of membership is a data change. Compare
  `upper(symbol)`.
- **A pick later sold still counts.** Giorgio's words are "drafted or picked up every mag7
  stock", the Planner's "held at any time". The seven need not be held at once, and selling
  takes nothing away ("never taken back"). So this is a cumulative set; no position history is
  needed, and the sell rows are ignored.
- **The manager's own actions after a takeover:** `take_over_team` moves the seat's `drafts` and
  `trades` to the new manager (`:502-505`). Count a pick only with `drafts.recorded_at >=
  seat_taken_at` and a buy only with `trades.created_at >= seat_taken_at`, per league. Use
  `recorded_at`, not `drafts.created_at`, whose type was made out of band
  (`20261010000000:24-27`). Picks older than 2026-10-10 all carry that migration's time in
  `recorded_at`, not their real time; harmless, because all of them predate any takeover.
- **Question Q10, auto-picks:** ruling 2 says a draft counts when every pick was made for you.
  For this crest an `auto_best` pick was chosen by the server, not by the manager. Counting
  every non-skip pick matches ruling 2 and "held at any time"; counting only `manual` and
  `auto_queue` (the manager's own list) matches "your own actions". Recommendation: count every
  non-skip pick, as ruling 2 does.
- **Partial state:** none. Picks and trades are append-only: no path deletes a `drafts` row
  after `20261205000100`, and a buy is never removed. A crest given after any single pick or buy
  is final.
- **Where it runs:** this one is earned by a buy or a claim, which happen between scoring runs.
  Not in `record-trade`'s hot path (the watchlist trigger is already there; keep that path
  clean). After the claims run and in the sweep, so a mid-week buy earns it within the sweep's
  interval. The Orchestrator sets that interval.
- **New record:** none.

## 3. What each row needs, at a glance

| Crest | Readable today? | New record | Main trap |
|---|---|---|---|
| Standard | n/a (unconditional) | holding at sign-up + backfill | trigger before backfill; the reveal waits for "You're in" |
| First claim won | yes | none | takeover moves claims (`placed_at >= seat_taken_at`) |
| Started a league | partly | grant at the `leagues` insert (opt. `created_by`) | handover rewrites `commissioner_id`; deleted leagues vanish |
| A friend joined | **no** | personal member codes + `league_members.invited_by` + app Share | the code is the league's, shared by anyone |
| Biggest margin | yes | none | week complete; forfeit-win margins (Q4) |
| Beat first place | yes | none | the two-argument ranking skips unscored rows; W ≥ 2 |
| Worst week | yes | none | week complete; empty team at $0 |
| Runner-up | yes | none | real-season guard |
| Top seed | yes | none | matchups vs bracket seeds must agree |
| Top scorer | yes | none | not from `final_standings` |
| Unbeaten | yes | none | ties and forfeits (Q8) |
| Last place | yes | none | often a bot (nobody earns it) |
| Back to back | yes | none | real-season guard on both seasons |
| Three seasons | yes | none | any three or one league (Q9) |
| Two leagues | yes | none | distinct `coalesce(lineage_id, id)` |
| Every Mag 7 stock | yes | none (tickers as data) | GOOGL/GOOG; takeover cut on picks and buys |

Every row also needs `seat_taken_at` (ruling 1) and the deleted-id skip, as before.

**Where the award logic runs, added to the first report's list:** a `leagues` insert trigger
(started a league); a `league_members` insert trigger or `join_league_by_code` (a friend
joined); the `user_profiles` insert trigger (standard); after `claims-run` commits a league
(first claim won, Mag 7); and the sweep for everything. The first report's call sites (after
scoring, the draft, playoffs and completion) cover the weekly, season and across-season crests.

**Is any row holding the others back?** Only "A friend joined". Every other row is reads of
tables that exist, plus two small triggers. The friend row needs a new invite mechanism on the
server and in the app, with its own security review, because invite codes are bearer
capabilities. It is not dropped or deferred here. **Recommendation to the Planner, for
Giorgio:** build the personal invite code as its own workstream, in parallel with the crests
server, and ship the 21 together when both pass. The plan's risk line ("the locked ones shown
must then be only ones that can be earned") rules out showing it before it can be earned.
Splitting it out is his call, not mine.

## 4. Questions for the Planner

Each is a reading the record allows two ways; none blocks the reads above.

- **Q1. Season-long crests and a takeover.** Do top seed, top scorer, unbeaten and last place go
  to whoever holds the seat when the regular season ends (the reading of ruling 1's "theirs to
  finish" used above), or only to a manager who held it all season?
- **Q2. Run it back.** Does renewing a league count as "Started a league"?
- **Q3. Takeovers and "A friend joined".** Does a manager taking over a deleted seat through
  the commissioner's takeover link count as a friend joining by the commissioner's invite?
- **Q4. Biggest margin and forfeit wins.** Does a win over a team with no stocks count for the
  margin (it can be negative)?
- **Q5. Beat first place in the playoffs.** Regular season only, or also a playoff win over the
  top seed ("underdog")?
- **Q6. Top seed.** Seed 1 (one manager, by Giorgio's standings-equals-seeds rule), or the
  best win-loss record (ties share)?
- **Q7. Top scorer.** Regular season only, in dollars?
- **Q8. Unbeaten.** Does a tie break it? (Recommendation: no.)
- **Q9. Three seasons.** Any three seasons, or three of one league? (Recommendation: any.)
- **Q10. Mag 7 and auto-picks.** Every non-skip pick, or only picks the manager chose?
  (Recommendation: every non-skip pick.)
- **Also, once for all weekly crests:** a week counts for a manager who took the seat only if
  it began at or after the takeover (section 1).

## 5. Found in passing (not crests)

`supabase/functions/process-week-results/index.ts:1210-1217` reads "matchups of this week
still unscored" as `const { data: remainingMatchups } = await supabase…`, discarding `error`,
then tests `!remainingMatchups || remainingMatchups.length === 0`. A failed read returns
`data: null`, which passes the test, so the league's week advances (or the regular season
transitions, seeding from the standings table) while a row of that week may still be unscored.
The later run scores that row as "not the league's current week" and does not advance again.
This is the CLAUDE.md success-signal #5 shape. It is rare (it needs a transient read error), it
is not caused by crests, and the crest guards above count rows themselves so they do not
depend on it. It deserves its own small fix: check `{ error }` and refuse to advance on it.

## Sources read

- `docs/plans/2026-11-25-crests.md` @ `origin/docs/crest-list` `9cc0b0b9`;
  `docs/PRODUCT_RULES.md` (same ref), "The crest list, in five kinds".
- `docs/research/2026-11-25-crests-awards-feasibility.md`.
- Migrations: `20250818225829` (leagues, members, invites), `20260125000000`,
  `20260125100000`, `20260125100001` (seasons and the fabricated rows), `20260712000001`,
  `20260712000003` (policies), `20261005000001` (signup trigger), `20261010000000` (picks),
  `20261011000000`, `20261112000000` (rankings), `20261115000000`, `20261115000003` (run it
  back), `20261115000007` (season completion), `20261120000000` (commissioner transfer),
  `20261125000005` (scrub), `20261125000006` (takeover), `20261125000008`, `20261128000000`
  (joins), `20261205000100` (deletes), `20261208000000` (reasons and percents),
  `20261211000000` (claims).
- Functions: `join-league/index.ts`, `process-week-results/index.ts`.
- App: `apps/mobile/app/create-league.tsx`, `lib/game/seamCalls.ts`, `lib/invite/inviteLink.ts`,
  `components/home/PreDraftCard.tsx`, `lib/game/leagueSettingsEntry.ts`;
  `apps/web/src/hooks/useLeagues.js`.
- `docs/architecture/db-snapshot.json` for which function overloads and grants prod has.
