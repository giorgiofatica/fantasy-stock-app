# Progress log

A dated, plain-English record of what happened: what shipped, what Giorgio decided, what is
waiting on him, and what is next. Newest first. Written by the **Recorder**
([`README.md`](README.md), "The Recorder").

**This is not the source of truth.** [`STATUS.md`](STATUS.md) says what is true now
(deployed, open, blocked). This file says what happened and when. Every fact here also lives
where it belongs (`STATUS.md`, a plan, `PRODUCT_RULES.md`, a PR); nothing lives only here.

## Entry format

```markdown
## YYYY-MM-DD

**Shipped** — what reached players or prod, each with its evidence (PR, migration version
verified by query, build number with its commit).
**Merged, not confirmed live** — on `main`, no evidence of the effect yet.
**Decided** — Giorgio's rulings that day, one line each, pointing at `PRODUCT_RULES.md`.
**Waiting on Giorgio** — his own steps and open decisions.
**Next** — what the Orchestrator builds next and what the Design Lead is drawing.
```

Entries begin with the Recorder's first pass.

## 2026-11-12

(Times are UTC; 02:00Z is the evening of 2026-11-11 in Giorgio's time zone.)

**Shipped**
- **Migration `20261204000000_renewal_notices_wake_notify_cron` (#411) is APPLIED** (Giorgio's `db push` from the deploy checkout at `7fa39f50`, 2026-11-12 after #412 merged at 03:58:57Z; the dry run listed only that file). Verified by query by the Orchestrator: `draft_room_notices_due()` is widened (`prosrc` contains `renewal_invite`), not SECURITY DEFINER, `search_path` pinned, `{postgres=X/postgres,service_role=X/postgres}` with no anon or authenticated; `schema_migrations` has `20261204000000`. It fixes the cron's post guard, which counted only the six draft-room notice kinds while `draft-order-notify` delivers those and the Run it back kinds, so a pending renewal push waited for a draft event to wake the cron. **Not yet shown:** a pending renewal row leaving pending with no draft event (checked at phone-pass steps 30–32).
- **`draft-order-notify` (#408, merged 01:47Z) is deployed, byte-verified.** Giorgio deployed it ~02:00Z from the deploy checkout at `c1f0a6e4`; the upload list was 9 files; the Orchestrator downloaded it and compared it with `main`, 9/9 identical; a no-credential POST returns its own `401 {"error":"Unauthorized"}`. It now answers the cron `202 {"accepted":true}` at once and delivers under `EdgeRuntime.waitUntil`; every Expo push is capped at 4 s; a row is pushed at most 3 times (`MAX_PUSH_ATTEMPTS`) even if every settle fails; a settle lands only on the run's own claim (`settle_lost` otherwise); runs can overlap and are proven not to double-send, by tests; enrich and draft-order-notify share `_shared/respond-fast.ts`. It is the first of the pg_net audit follow-ups (STATUS §4 item 28).
- **Not shown:** the `202` on a real run, and notices still moving from pending to sent. Both wait for the next draft event. `enrich-symbols` was not redeployed: `main` differs from prod there by a refactor-only change, and a redeploy is optional.

**Merged, not confirmed live**
- **Mobile, in no build (build 15), no server step:** #426 (merged 18:24:05Z; the Leave sheet below four drops the false commissioner-choice line, built from #424's ruling; the Design Lead passed it with no findings, and the Orchestrator verified it independently, Deno 3238/0). The newest EAS iOS build is still 1.3.0 (14), re-read.
- **Docs:** #425 (my record: step 26, mirror v25, the no-AASA launch-prep finding) and #427 (the Researcher's `docs/research/2026-11-12-how-non-broker-apps-license-market-data.md`, docs only; nothing decided).
- **Mobile, 2026-11-12, all in no build (build 15), no server step:** #415 (04:26Z; the rule-12 sweep and "i" popups; 85 files; the Design Lead passed it; the Orchestrator verified it independently: 3175 tests, no new tsc or lint errors, 10 of 10 mutants killed), #417 (17:08Z; your queue saves as you go), #419 (17:14Z; the Season step strip B, both limit lines dropped). #421 (my record) merged 17:18:57Z. The newest EAS iOS build is still 1.3.0 (14). Their effect on a phone is not shown until a build carries them.
- **#422 (17:19Z) builds the waiting-card ruling, in no build (build 15):** no draft order card at 4 or more managers until the order exists (no card, no gap; below 4 unchanged; a failed first read draws nothing). It had failed the Design Lead's gate on a 16 pt gap left where the card was; the fix (`DraftLobby` returns `null` when it has nothing to draw) passed the Design Lead's re-gate, and the Orchestrator verified it independently (Deno 3234/0, no new tsc errors). Its effect on a phone is not shown until a build carries it.
- Docs and design: #416 (stepper-end and Managers limit-line rules, gate checklist), #418 (the waiting-card board), #414 (the VoiceOver and queue rules), #406 (the Design Lead's step-25 board archive), #407 (my record), #409 (the Design Lead's board: the sweep's "Fix these before …" row is KEPT, superseded by step 25 (b)). The two step-25 rulings (the pre-draft card's "A manager left the league", a deadline that names its day) remain build items for 1.3.x, not built.

**Decided** (Giorgio; the words and dates are in `PRODUCT_RULES.md`, now on `main` via #414, #416, #418 and #420; this only points)
- The 7 VoiceOver descriptions are approved as written ("approved").
- Your queue saves as you go, with no Save button ("B saves as you go").
- Steppers at their ends get no line ("option B": the two approved limit lines go), and Managers at 4 and 16 gets no line.
- The Leave sheet when your leave takes the league below four ("B", #424, merged 17:38:56Z): it drops the false "{commissioner} chooses whether…" line and adds nothing; built in #426 (merged 18:24:05Z), in no build.
- No draft order card while it waits, at 4 or more managers ("B"). #420 (merged 17:14:55Z) corrected the rule's text: no progress bar below 4 either; the bar was only in the drawings.

**Found**
- **Phone-pass step 28 passed (page tick 2026-11-12T19:01:53Z)** from Giorgio's recording of 11-12 10:56 on build 14 (relayed by the Planner via the Orchestrator): Share shows "Take over a team in League B" and the shared text carries the `/take/` link with a 10-character code; he did not tap it.
- **Phone-pass step 34 FAILED on build 14 (page tick 2026-11-12T18:34:47Z), his note verbatim:** "The button names the wrong stock; The sale names break apart at the largest text size". The page still shows the fail; it is re-run on build 15. The fixes are merged, in no build: #434 (19:44:13Z; the sale picker names the chosen sale, labels whole at AX5, the 1.6 cap, the caption cut, the × kept on screen; DL PASS) and #432 (19:36:51Z; the Sold/Bought confirmation shows the server's fill, Paid-from keeping the funding sale's amount; DL PASS). #429 (18:52:58Z) was the board cutting the caption.
- **Phone-pass step 29 passed (page tick 2026-11-12T19:11:09Z).** The first unticked step is 28c (id 50).
- **Ruling on `main` (#430, merged 19:34:56Z): a sheet's top must not be a stuck block that cuts text** (Giorgio, dictated during the 11-12 recording; his words are in `PRODUCT_RULES.md`). He picked the floating close ("b"). **Not built, and the layout is not settled:** #433 (board only) drew it, and he said "i dont love the top of it with League Settings and then League name right underneath. seems clunky and not well done."; #436 (19:56:46Z) records his pick C (League settings opens on the league's own name, on the floating-close layout; in `PRODUCT_RULES.md`). **New direction, not yet ruled** (relayed by the Orchestrator): after two ESPN Fantasy screenshots he said "i like the idea of having the top left being a back or close button and the top right being the save button. it is greyed out until you make a change and then you click save when it populates"; so the floating close is not signed off and is being redrawn as a top bar (back or close left, Save right, grey until a change), with the Design Lead drawing A (a centred "League settings", the name as a row) against B (the name as the title). "Discard changes" and "Keep editing" are still not approved. **#437** (19:59:01Z; mobile, in no build, no server step; DL PASS) removes the doubled status-bar inset: the ~62 pt band above Cancel is gone on League settings, Forgot password, a manager's team and Trade history. League B's season is 11 weeks, so the finished-league steps will not come from it soon (the Orchestrator's account).
- **Universal links are not live (the Orchestrator's verified finding, 2026-11-12 ~18:00Z; launch-prep work, not fixed):** the live site serves no `apple-app-site-association` file (a `GET` returned `200 text/html`, the SPA's `index.html`), and in the repo `main` has no AASA file, `webDomain.ts` lists only `/join/*` and `/auth/confirm`, and `vercel.json` rewrites every path to `index.html`. So iOS opens no https link in the app (invite, email-confirm, take-over), the web app is `APP_PAUSED`, and only `fantasystockapp://…` links open the app today. It is the W5 open item (#279, draft); STATUS §4 item 2.
- **Phone-pass step 26 (What the league sees) passed on build 14:** the page shows Giorgio's tick, 2026-11-12T17:41:46Z; his report relayed by the Planner via the Orchestrator, no recording. Parts A and B are now fully ticked on the page (32 of 47 steps; ids 1–26 and 42–47); the first unticked step is 34, the first step of Part C.
- Giorgio's 202 query soon after the draft-order-notify deploy returned 0 rows. Expected: the cron POSTs only when `draft_room_notices_due()` is true (its command is in the db-snapshot), so with no draft event there was no POST. The effect is still not shown.
- `draft_order_notify_due()` is dead code (no cron, no caller). Not to be re-wired; a candidate to drop.
- The `draft-order-notify` row in STATUS §2 said "Not scheduled yet (cron deferred)"; the 2026-11-11T21:55Z db-snapshot shows `draft_order_notify` scheduled `* * * * *` and active. The row is corrected.

**Waiting on Giorgio**
- The phone pass: steps 28 and 29 passed, step 34 failed (open until re-run on build 15), next step 28c (Part C, one phone, any time). The page is v25 (v24 reorganised it so the checks that need no second phone come first; new ids 48, 49 and 50; the second-phone steps are in Part F; step 28 now says not to tap the shared link); steps 30–32 (Part E, once a league has finished its season) check the renewal-notice effect.

**Next**
- The next draft event shows whether the 202 and the pending→sent movement work on a real run.
- The renewal-notice effect at phone-pass steps 30–32 (the fix is applied, above); the build-15 re-check; the other three pg_net audit follow-ups (`refresh-symbols`, the sweep during an outage, the weekly jobs), not started.

## 2026-11-11

(Times are UTC; the evening of 2026-11-10 in Giorgio's time zone runs into this date.)

**Shipped**
- **The server half of the auto-pick fix is LIVE.** Migration `20261201000000_autopick_sweep_fast_cadence` (#384) was applied by Giorgio's `db push` from the deploy checkout at `447e97c9` (~18:3xZ). Verified by query by the Orchestrator: applied 1 and the only version after `20261130000000`; `draft_autopick_sweep` exactly 1 row with schedule `2 seconds` and the expected command; latest runs 0 failed of 14. **Not yet shown by data:** actual pick delays; the next unattended clocked draft measures them. (The 18:25Z record, #388, was written before the push and said "NOT applied"; this entry supersedes it.)
- **The lease migration and the Duration refusal are LIVE (~21:5xZ).** Giorgio chose "push both now" and ran the `db push` from the deploy checkout at `origin/main`; he skipped pasting the dry run, so the Orchestrator verified by query instead. `20261202000000_draft_turn_lease_and_escalation_claim` (#392) and `20261203000000_refuse_new_duration_leagues` (#393's server half) are the only versions after `20261201000000`; `draft_turn_leases` has RLS on and grants for `postgres` and `service_role` only; the lease and claim functions are `{postgres, service_role}`; `trg_leagues_refuse_new_duration` is enabled; existing Duration leagues, 6, are left as they are. Giorgio then deployed `draft-autopick-sweep` (21 assets) and `validate-and-record-pick` (16 assets) from `3c66d100` (= `origin/main`), and the Orchestrator compared both downloads to `origin/main`: 21/21 and 16/16 identical. **Not yet shown by data:** the lease's effect in a live draft (sweeps answering `lease_held` instead of overlapping) and the Duration refusal exercised live. Build 14 still offers Duration and a pick there now gets a generic "create failed"; Giorgio accepted that.
- **`enrich-symbols` fix (#396, merged 21:28Z) is deployed and shown by data (~21:30Z).** Giorgio deployed it from the deploy checkout at `6cd3dbeb` (`grep batch_limit` found it in `handler.ts` first; the upload listed 6 assets). The Orchestrator byte-verified it: `supabase functions download --use-api`, all 6 files identical to `6cd3dbeb`. Effect: the 21:20:00.73 `net._http_response` row is `200` with the full body (old code), the 21:30:00.84 row is `202 {"accepted":true,"batch_limit":50}` (new code); Edge Function logs (version 7) show POST 202 at 21:30:02.288, the outcome line at 21:30:47.157 (`ok:true`, `batch:50`, `priced:25`, `price_status:"complete"`, `duration_ms:44876`), a normal shutdown at 21:31:17 and no failed or terminated line; `max(enriched_at)` went 21:20:27.93 → 21:30:32.13. So the cron request now ends ~2 s after :x0 instead of 20–55 s while the batch still completes. **Not yet shown:** auto-pick sweeps flowing through a :x0 mark in a live draft; the Planner folds that into the build-15 re-check.
- **The Vault entry `service_role_key` is DELETED (Giorgio, dashboard, ~22:05Z); verified by query.** Pre-check (~22:0xZ): Vault `cron_apikey` and `service_role_key`; the only jobs not on `cron_apikey` are the two local-SQL purge jobs; no cron command or trigger holds an inlined key. Post-check (~22:4xZ): Vault `cron_apikey` only; the ~22:40Z enrich run wrote rows more than 30 minutes after the deletion; 0 failed cron runs in 10 minutes (the enrich path and a failure count, not every job). **The key itself is not revoked:** legacy keys are still enabled (Phase 4), now its own open item (STATUS §4 item 29). Giorgio's open server steps are now none.
- **`db-snapshot.json` is re-captured and merged (#398, 21:59Z; capture 2026-11-11T21:55:47Z; 40 tables, 131 functions, 14 cron jobs).** Giorgio ran the current `db-snapshot.sql`. Drift on `main`'s regenerated map: 34 rows, 0 HIGH, 6 medium, 28 low (my read of `architecture.json`); the Orchestrator's account: the five HIGH rows the stale snapshot showed for the new migrations were all lag, and the one new LOW, `draft_turn_leases` (RLS, no policies), is intended. An earlier capture from an outdated `db-snapshot.sql` was not saved (it would have dropped the grant checks).
- Nothing new on phones. Newest EAS iOS build is still 1.3.0 (14) from `6ca0e0c4`.

**Merged, not confirmed live**
- **#393's app change (merged 19:22Z): in no build** (build 15): Duration hidden in Create league, the League type card with Matchup alone. It merged before the Design Lead's visual gate; the gate is pending (the AX5 gate on the League step has not happened; any fix is a follow-up PR).
- **#384's client half (merged 18:19Z): in no build.** The ask at the deadline, with retries, reaches phones in build 15. Its effect on pick delays is not yet shown by data (the 2 s sweep's effect is: see Found).
- **#379 (06:17Z):** Home no longer paints the plain draft card before "Draft postponed". Client only, merged, not in a build.
- Docs: #389 (my correction record), #390 and #391 (the League type board and Giorgio's ruling), #376 App Store requirements (research), #377 UX rule 13, #378 the auto-pick-is-instant rule, #380 Alpaca market-data display rights (research), #381 privacy policy / terms / support (research), #382 free data sources (research), #383 Tiingo licence read (research), #385 five Design Lead board branches, #386 the popup-may-name-the-metric rule, #387 a board follow-up (one view at a time; question 4 shown as decided). #375 (my 2026-11-10 record) merged 06:11Z.

**Decided** (Giorgio's words are in `PRODUCT_RULES.md`; this only points)
- A choice we defined carries optional context, an "i" popup (UX rule 13, #377; the other half of rule 12).
- The auto-pick is instant (#378). His words: up to ~20 s after the clock ran out in his build-14 draft.
- Duration is won by dollars in every stake mode, "dollars, confirmed" (#385). It confirms DR-001; Duration scoring is unbuilt and its plan is the Planner's.
- Duration is hidden in Create league until it is built (his pick "A", in #385). Implemented in #393 (merged; migration not applied, app change in no build).
- A definition popup may name what decides the winner; rules, marketing and onboarding keep "best performance wins" (#386).
- The League type card stays, with Matchup alone (Giorgio "A", #391, on the Design Lead's board #390; the board call is archived).
- Step 25's two copy calls, on the Design Lead's board #403 (merged; words in `PRODUCT_RULES.md`, #405; plan #355 amended by #404): A, "A manager left the league" is what the pre-draft card says when a deleted account leaves before the draft (his words: "A, manager left the league"); B, a draft deadline always names its day, today included (his words: "include today when day of"), as "before 6:30 PM ET today / tomorrow / on Tue, Nov 17". Both are build items for 1.3.x, not built, not live; step 25 was unaffected.
- Board picks recorded in #385: the Season step B, and below four managers B (already built, #358, and live server-side, #359).

**Found**
- #384's description reports a measurement: League B on build 12, 21 of 21 auto picks landed 8.3–47.8 s after the deadline (median 10.3 s), with three named causes. That is the PR's own account, not an independent check.
- **Shown by data, from League A's unattended draft (2026-11-11, 1:45 PM ET, build 14, nobody in the app, all 24 picks auto; Giorgio ran the queries, the Planner relayed them, the Orchestrator marked them verified by data):**
  - `20261129000000` (#363, a drafted stock leaves every queue) works on prod: GE `queued_x` / `drafted_x` went from 2 / 0 before the draft (12:35 PM ET) to 0 / 1 after it, and T2 never touched its queue again, so the server removed the other copy. This is the server half of step 24e. **Not shown:** the on-screen half (GE leaving the queue with no "Save queue" or "Not saved yet"); the Planner will make it its own step at the next draft Giorgio sits in.
  - The 2 s sweep (`20261201000000`) works in practice: 21 of 24 auto-picks landed 2.1–4.7 s after the deadline (mean 3.5 s), against League B's cluster of about 10 s (8.3–47.8 s, median 10.3 s); total wait 162 s against 277 s.
  - **Cause confirmed by query, now fixed for `enrich-symbols` (deployed, see Shipped):** picks 5, 14 and 23 took 28–32 s, and the same three were slow in League B. All fall just after a :x0 mark and were recorded about 40 s past it. Giorgio's `net._http_response` query (via the Planner; pg_net 0.14.0) showed the enrich-symbols response (id 198712) created at 18:50:00.38, then nothing until 13 sweep responses (ids 198713–198725) all created at 18:50:43.62: the ~43 s `enrich_symbols_10min` request holds pg_net's queue, and the Orchestrator concludes every cron post waits behind it every 10 minutes (one window shown directly). Four related follow-ups stay open and not started (the Orchestrator's audit from reading the code, not measured): other cron posts that can also hold pg_net's queue are `draft-order-notify` (Expo pushes with no timeout, the top follow-up), `refresh-symbols` (NASDAQ downloads with no timeout, at :00), `draft-autopick-sweep` (during an outage) and the weekly snapshot and scoring jobs. STATUS §4 item 28.
- Phone-pass step 24e passed (page tick 2026-11-11T19:26:18Z) and step 25 (Delete T1) passed (page tick 2026-11-11T23:15:49Z), both Giorgio's. His 14:55 recording of step 25 on build 14 (relayed by the Planner via the Orchestrator): a wrong password gives "That password isn't right. Try again." and clears the field; the right password, "Are you sure?", Delete, then signed out with "Your account is deleted."; the delete screen listed all three leagues correctly. Findings from it: (a) and (b) are now RULED (see Decided); (c) a nameless member shows as "P4" (P3, no fix now); (d) the Home plain-card flash is #379, merged after build 14, re-checked in build 15. STATUS §1.
- Phone-pass step 24d passed on build 14 (page tick 06:08Z, Giorgio's own recording): one card, no buttons, and it clears with no tap after the rejoin.
- Before the web app is unpaused: it still offers and defaults to Duration (`Leagues.jsx`, `LeagueSetupWizard.jsx`, `useLeagues.js`, read on `main`), and the server will refuse a new Duration league once `20261203000000` is applied, so the web default must change to Matchup first (STATUS §4 item 17).

**Waiting on Giorgio**
- The leave-sheet board call (the Leave sheet in a league of four), open in #385.
- The phone pass: 24e and 25 are ticked; the first unticked step on the page is 26. The on-screen half of the queue check is still owed (the app was closed for the whole draft); the Planner will fold it into one step with the build-15 auto-pick re-check.

**Next**
- In progress, not on `main`: the `draft-order-notify` fix (chip started, branch `fix/draft-order-notify-respond-fast`; the top follow-up from the pg_net audit). The other three audit follow-ups are not started.
- Build 15 is the earliest the Home fix (#379), the client half of the auto-pick fix and the hidden Duration option (#393) reach a phone. Showing the lease and the refusal live needs a draft after that build (the Planner's build-15 re-check).
- The Planner takes Giorgio through the App Store blockers, using the research above; nothing is decided.

## 2026-11-10

**Shipped**
- Migration `20261128000000_reconfirm_clears_at_four` (#359) is live. Verified by query by the Orchestrator: applied 1; grants unchanged; both functions read `below_floor`; League A's reconfirm row `below_floor` true; 0 rejoiners still listed as departed.
- Migration `20261129000000_draft_pick_prunes_queues` (#363) is live. Verified by query: applied 1; trigger AFTER INSERT on `drafts` enabled; the prune function owner-only, SECURITY DEFINER, `search_path` pinned; `set_draft_queue` ACL unchanged; no INSERT policy on `drafts`; stale queue rows 3 → 0.
- Build 1.3.0 (14) from `6ca0e0c4` (fingerprint `8cd5f9f8`, runtime `1.3.0`, production, TestFlight internal) is installed on Giorgio's phone. It carries the client halves of #354, #356, #358, #361, #362 and #363. Build 13 (from `67a937ae`) was skipped: it was built before #362 and #363 merged. Both builds read from `eas build:list`.
- Migration `20261130000000_retire_service_role_key_helpers` (#373) is live (merged 2026-11-11 05:52Z; Giorgio's `db push` from the deploy checkout at `28b06317`). Verified by query by the Orchestrator: applied 1, the only version after `20261129000000`; `trigger_week_processing` and `trigger_week_snapshot` gone; readers of `service_role_key` in cron commands and non-system function bodies 0; `schedule_snapshot_retry` and `trigger_week_end_snapshot` unchanged. **Not done:** the Vault entry `service_role_key` still exists, and deleting it would not revoke the key (legacy keys are still enabled).

**Merged, not confirmed live** (client merges are in build 14; whether each behaves on the phone is the phone pass's job, not yet ticked)
- Client: #354 auth screens; #356 "Invite someone new" waiting state; #358 blockers card at AX5 and the below-four rule; #361 note cap at AX5; #362 draft-room reads (W2); #363's on-screen half. The phone pass has passed 22b (Invite someone new, on build 14) and 24c (install build 14).
- Docs, plans and research: #352 (merged 2026-11-09), #353, #355, #357, #360, #364, #365, #366, and, merged 2026-11-11 03:36Z–05:51Z, #367, #370, #371, #372, #374. Each is described in `STATUS.md` §1.

**Decided** (Giorgio's words are in `PRODUCT_RULES.md`; this only points)
- Auth screens behave like a short form; eye icon; email-limit copy approved (#353).
- Below four managers the invite path is implicit; four back in means ready (#357, the rule behind `20261128000000`).
- Times show in the player's own time zone, always labelled; market logic stays Eastern (plan #355).
- The draft room: a real room from an hour before the draft, draft from the queue, drafted stocks leave every queue, Latest picks names, a recap room (plans #360, #364).
- No explainer under a heading is now a checked rule (#365, UX rule 12).
- The Researcher and Recorder roles exist (#366).
- Claude Data: "yes as a trial, do the security read first" (#369), then, after the security read, "ok then lets keep it away from prod data and skip it" (merged as #374). Supabase's connector is never connected to production, trial or not. Nothing was ever connected. Both are in `PRODUCT_RULES.md`.

**Found**
- Phone-pass step 22 failed on build 12 (Invite someone new gave no feedback); fixed in #356 and re-run as 22b on build 14, which passed at 00:00Z 2026-11-11.
- A dashboard Add user is NOT stopped by the Before User Created hook (observed making T4, step 22a). The app-path refusal was effect-verified 2026-09-25 and is unchanged.
- `db-snapshot.json` (captured 2026-11-07) is now stale: today's three migrations changed functions, added a trigger and dropped two functions.
- The security read for a Claude Data dashboard (#371, with the Orchestrator's Opus pass) and the Researcher's two reports (#367, #370) are on `main`. Step 0 and a second catalog check, which Giorgio ran on prod in the SQL editor (names and true/false only), are recorded in it (#372): observed on prod 2026-11-10 by catalog query, the connector's reader bypasses RLS, cannot call Vault's decrypt function, can read `auth.users` and `net.http_request_queue`, and can insert into the queue. Details are in the file, not restated here.

**Waiting on Giorgio**
- Delete the Vault entry `service_role_key` in the dashboard, after the pre-vault checks and one cron run showing the `cron_apikey` jobs still work. Phase 5 is marked done only when he has.
- Re-capture `db-snapshot.json`: run `docs/architecture/db-snapshot.sql` in the Supabase SQL editor and paste the single output cell. Then it is saved and `node scripts/gen-architecture.mjs` is run.
- The phone pass from step 24d (League A, one card when a manager leaves), then 24e.
- Nothing goes to the App Store until he says so.

**Next**
- Per the draft-room plan, the phone room (W3) follows W2 after Giorgio signs off the board; the recap room is later. No build of either is recorded yet. The local-time-zone plan (#355) is approved; no build of it is recorded yet.
- Launch prep (phone-pass step 35) tests the signup hook on both the app and dashboard paths.
