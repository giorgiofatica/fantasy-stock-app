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
