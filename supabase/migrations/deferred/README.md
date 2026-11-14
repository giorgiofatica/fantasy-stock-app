# Deferred migrations — authored but NOT in the apply path

Files in this directory are **intentionally held out of `supabase db push`.** The
Supabase CLI applies only the timestamped `.sql` files directly in
`supabase/migrations/`; anything in this subdirectory is ignored by `db push`.
Do **not** move a file back to the parent directory until its stated precondition
is met.

**Currently held:** 2 files (see *Held* below): `20261116000002_revoke_anon_default_grants.sql` (a PROPOSAL awaiting Giorgio's go-ahead) and `20261205000400_symbols_column_grant.sql` (S1 CONTRACT, waiting on a mobile build).

## How to use it

1. Put a migration here when it is correct but its precondition is not yet met
   (a client release, a data cleanup, a deploy it depends on).
2. Add a section below naming the file, the precondition, the query that proves the
   precondition, and the effect-verification query to run after applying.
3. When the precondition is met, `git mv` it into `supabase/migrations/`, apply as a
   HUMAN ACTION, effect-verify, and move its section to *History*.

## Held

### `20261116000002_revoke_anon_default_grants.sql` — PROPOSAL (lockdown audit #7)

Revokes every anon privilege on public tables, views and sequences, anon/PUBLIC
EXECUTE on public functions, and the default privileges that hand both to
objects migrations create later (ruling 2026-10-08, nothing scrapable). Today
RLS is the only gate between anon and most tables; this removes the other.
Not yet decided: it is held for Giorgio's go-ahead as well as its preconditions.

**Preconditions (all four):**
1. `security/lockdown-symbols` stage 1 (PR #175) is **deployed** — before it,
   `symbols-search` / `symbol-name` read `symbols` as anon. Prove it by source:
   `supabase functions download symbols-search` contains
   `req.headers.get('Authorization')`.
2. `20261116000000_scrape_hardening.sql` is applied:
   `SELECT version FROM supabase_migrations.schema_migrations WHERE version = '20261116000000';`
3. A fresh `db-snapshot.json` captured with the 2026-10-08 `db-snapshot.sql`, read
   for `storageBuckets` (no public bucket relying on anon table access) and
   `defaultPrivileges` (the postgres/public rules this edits are present).
4. The header's read-only function query (precondition 4) has been read row by
   row: no public function an API role calls relies on the PUBLIC grant.
   Known limits (header): supabase_admin's own default rules are not edited, and
   a later `CREATE EXTENSION` as postgres needs explicit grants.

**Product impact (checked 2026-10-08):** none. No pre-sign-in screen reads a
table or calls an RPC; the one anon write (the `user_profiles` upsert after a
session-less `signUp`) already fails today with 42501 and fails with the same
SQLSTATE after. **Process change:** every new function must `GRANT EXECUTE`
explicitly (already the repo convention) — forgetting now fails loudly instead
of exposing the function. Tested: `supabase/tests/revoke_anon_default_grants.pglite.test.ts`.

**After applying:** run the header's three checks (no anon table/sequence
privilege, no anon-callable function, the default-privilege rules), then the
signed-in app end to end and a signed-out `GET /rest/v1/<table>` → 401/42501.

### `20261205000400_symbols_column_grant.sql` — S1 CONTRACT (signed-in reads symbol, name, is_draftable only)

Revokes every table privilege on `public.symbols` from PUBLIC, anon and
authenticated (MAINTAIN included), then grants authenticated SELECT on
`symbol, name, is_draftable` only. Stage 1 (EXPAND,
`supabase/migrations/20261205000300_symbols_readers_functions.sql`) creates the
three functions the new clients call instead.

**Precondition:** move into `supabase/migrations/` only after a build containing
the categoryData RPC change is on every phone in use. That change is
`apps/mobile/lib/categoryData.ts` calling `count_slot_matches` /
`symbols_enrichment_progress`, and `apps/mobile/lib/game/useSymbolCategories.ts`
calling `get_league_pick_industries`. An older build reads `last_price`,
`gics_industry`, `active` and `enriched_at` directly, and after this file those
reads are refused (42501): SlotBuilder's availability check shows "couldn't
check" and the draft board loses its category lines.

**Proof before promoting:**
1. Stage 1 is applied:
   `SELECT version FROM supabase_migrations.schema_migrations WHERE version = '20261205000300';`
2. Every phone in use runs a build cut from a commit that contains the RPC change
   (`git merge-base --is-ancestor <PR #456 merge commit> <build commit>`). Checked
   by asking, not by a query.

**Promoting:** `git mv` it into `supabase/migrations/` under a NEW timestamp that
sorts after every migration applied by then (otherwise `db push` refuses it as
out of order without `--include-all`), in a small PR. Merge, then push from the
deploy checkout.

**After applying:** `docs/security/2026-11-13-symbols-column-grant-checks.sql`
PART B (table ACL, column grants, the effect test that must say PASS), then the
in-app checks and a db-snapshot re-capture. Tested on both stages:
`supabase/tests/symbols_column_grant.pglite.test.ts`.

## History

- 2026-10-12: promoted after 1.1.0 was retired (Giorgio, the only 1.1.0 user, is on 1.2.0; his go: "go with your recommendation" on the release-now recommendation, with an explicit go at db push): `20261115000008_drop_start_new_league_season.sql` → `20261121000000_drop_start_new_league_season.sql`; `20260929000000_drop_I6_I2b.sql` → `20261121000001_drop_I6_I2b.sql`. Post-apply checks: the function and both policies are gone; drafting is re-verified on a fresh test league (Giorgio's 1.2.0 walkthrough draft).

- 2026-10-10: `20261118000001_user_profiles_self_only.sql` (audit #8 stage 2) promoted to the apply path. Giorgio is the only 1.1.0 user and accepted its degradation ("just me on 1.1.0, go with C").

| File | Held for | Resolution |
|---|---|---|
| `20260808000001_drop_broker_credentials.sql` | `quote` still read `broker_credentials`; dropping it would have broken live prices app-wide | `quote` rewired onto the app key (Workstream A); promoted and applied 2026-08-10 |
| `20260810000007_drafts_league_id_set_not_null.sql` | Orphan `drafts` rows with NULL `league_id` would abort the push | Zero NULL rows verified in prod; promoted in `4b3eba2` and applied |
| `20260926000001_drop_client_schedule_insert_policies.sql` | Server-side finalize (PR #14) not yet deployed and effect-verified; web schedule writers still live | Verified by two prod test drafts (test_0925; test_09_25_v2 fully on mobile, PR #20); promoted 2026-09-25 as `20261002000000_drop_client_schedule_insert_policies.sql` (closes F10, retires [I8]/[I9]) |
| `20261013000001_schedule_draft_order_notify.sql` | `draft-order-notify` not yet deployed/effect-verified | **Promoted 2026-10-06 by draft auto-start** as `20261111000003_schedule_draft_order_notify.sql` (re-stamped; guard widened with `draft_room_notices_due()`; `timeout_milliseconds := 180000` per `20261108000000`). The "draft room is open" push rides it. Its deploy + byte-verify precondition moved into that file's header and `docs/migrations/DRAFT_AUTO_START_PLAN.md`. |
| `20261005000003_schedule_refresh_market_calendar.sql` | `refresh-market-calendar` not yet deployed/effect-verified; scheduling the cron first would have called a function that didn't exist yet | **Promoted 2026-09-29**, timestamp unchanged (no migration newer than it was applied yet, so no rename needed). All three preconditions met: (1) `20261005000000`–`20261005000002` applied, proacl/relacl verified — `market_session_status` authenticated-only, `apply_market_calendar` service_role-only, `market_calendar`/`market_calendar_coverage` grant `authenticated=r` with no `anon`; (2) `refresh-market-calendar` deployed and byte-identical to `main`, a no-credential POST returned the function's own `401 {"error":"Unauthorized"}` (not the gateway's generic 401), and a manual run via `net.http_post` with the vault `cron_apikey` populated `market_calendar_coverage` `2026-09-22..2026-12-28` (68 sessions), `refreshed_at` 2026-09-29 01:53 UTC — `market_session_status` correctly read "closed / next open: Tue 2026-09-29 09:30"; (3) `docs/security/game-data-asks-effect-test.sql` section #7 gates the push (run after merge, before `db push`, per the Orchestrator). Pushed together with `20261005000004_backfill_missing_user_profiles.sql` in one `db push`, no `--include-all` needed. |
| `20261010000001_schedule_draft_autopick_sweep.sql` | Live test of the sweep (precondition 5) | **Promoted as `20261106000000` (applied: PENDING the HUMAN ACTION `db push`; record the date here once it is)** (stall throttle + explicit 180000 ms timeout added), together with `20261106000001_purge_cron_run_details.sql` (new) and the SKIP trigger below, after the live test in `docs/migrations/AUTOPICK_CRON_LIVE.md`. Verification and the post-promotion data check are in that runbook. |
| `20261101000002_drafts_refuse_new_skip.sql` | The sweep cron had to be live first (stall recovery for bots relies on it), and had to be re-stamped later than prod's latest applied migration | **Promoted as `20261106000002` (applied: PENDING `db push`)**, body unchanged, in the same release as the cron. Effect check: `docs/security/refuse-new-skip-effect-test.sql`. |

Note that "held for the mobile release" migrations were not always parked here:
`20260811000009_drop_leagues_salary_cap_limit.sql` sat in the apply path with a
"hold" header and was applied by a later `db push`. **A header comment does not hold
a migration — only this directory does.**
