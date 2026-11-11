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

## 2026-11-11

(Times are UTC; the evening of 2026-11-10 in Giorgio's time zone runs into this date.)

**Shipped**
- **The server half of the auto-pick fix is LIVE.** Migration `20261201000000_autopick_sweep_fast_cadence` (#384) was applied by Giorgio's `db push` from the deploy checkout at `447e97c9` (~18:3xZ). Verified by query by the Orchestrator: applied 1 and the only version after `20261130000000`; `draft_autopick_sweep` exactly 1 row with schedule `2 seconds` and the expected command; latest runs 0 failed of 14. **Not yet shown by data:** actual pick delays; the next unattended clocked draft measures them. (The 18:25Z record, #388, was written before the push and said "NOT applied"; this entry supersedes it.)
- Nothing new on phones. Newest EAS iOS build is still 1.3.0 (14) from `6ca0e0c4`.

**Merged, not confirmed live**
- **#392 (merged 18:40Z): NOT applied, NOT deployed.** Migration `20261202000000_draft_turn_lease_and_escalation_claim.sql` is on `main` (the next `supabase db push` would apply it), and it changes the `draft-autopick-sweep` and `validate-and-record-pick` edge functions, which are not deployed. Title: one auto-pick attempt per turn (lease), one outage push (claim). The Orchestrator verified it (1075 and 276 tests; 19 of 19 mutants); that is not an effect on prod. Planned after today's League A draft.
- **#384's client half (merged 18:19Z): in no build.** The ask at the deadline, with retries, reaches phones in build 15. Its effect, and the effect of the 2 s sweep, on actual pick delays is not yet shown by data.
- **#379 (06:17Z):** Home no longer paints the plain draft card before "Draft postponed". Client only, merged, not in a build.
- Docs: #389 (my correction record), #390 and #391 (the League type board and Giorgio's ruling), #376 App Store requirements (research), #377 UX rule 13, #378 the auto-pick-is-instant rule, #380 Alpaca market-data display rights (research), #381 privacy policy / terms / support (research), #382 free data sources (research), #383 Tiingo licence read (research), #385 five Design Lead board branches, #386 the popup-may-name-the-metric rule, #387 a board follow-up (one view at a time; question 4 shown as decided). #375 (my 2026-11-10 record) merged 06:11Z.

**Decided** (Giorgio's words are in `PRODUCT_RULES.md`; this only points)
- A choice we defined carries optional context, an "i" popup (UX rule 13, #377; the other half of rule 12).
- The auto-pick is instant (#378). His words: up to ~20 s after the clock ran out in his build-14 draft.
- Duration is won by dollars in every stake mode, "dollars, confirmed" (#385). It confirms DR-001; Duration scoring is unbuilt and its plan is the Planner's.
- Duration is hidden in Create league until it is built (his pick "A", in #385). The app and server change is a chip, not merged.
- A definition popup may name what decides the winner; rules, marketing and onboarding keep "best performance wins" (#386).
- The League type card stays, with Matchup alone (Giorgio "A", #391, on the Design Lead's board #390; the board call is archived).
- Board picks recorded in #385: the Season step B, and below four managers B (already built, #358, and live server-side, #359).

**Found**
- #384's description reports a measurement: League B on build 12, 21 of 21 auto picks landed 8.3–47.8 s after the deadline (median 10.3 s), with three named causes. That is the PR's own account, not an independent check.
- Phone-pass step 24d passed on build 14 (page tick 06:08Z, Giorgio's own recording): one card, no buttons, and it clears with no tap after the rejoin.

- Before the web app is unpaused: it still offers and defaults to Duration (`Leagues.jsx`, `useLeagues.js`, read on `main`), and the server will refuse a new Duration league once `20261203000000` (open PR #393) is live, so the web default must change to Matchup first (STATUS §4 item 17).

**Waiting on Giorgio**
- The leave-sheet board call (the Leave sheet in a league of four), open in #385.
- Re-capture `db-snapshot.json` (stale; same ask as 2026-11-10).
- Delete the Vault entry `service_role_key` (STATUS §4 item 27).
- The phone pass from step 24e: he paused it until today. Step 24e is now an unattended League A draft with a proof query and a timing query.

**Next**
- Planned by the Orchestrator after today's League A draft: the `db push` of `20261202000000` and the deploys of `draft-autopick-sweep` and `validate-and-record-pick` (#392), then a verified-by-query note.
- In open PR #393, not merged: hiding Duration in Create league (app) plus migration `20261203000000`, which refuses a new Duration league on the server.
- Build 15 is the earliest the Home fix (#379) and the client half of the auto-pick fix reach a phone.
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
