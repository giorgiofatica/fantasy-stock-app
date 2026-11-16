# Legacy JWT secret: what Phase 4 closed, what Phase 4b must do

Research on 2026-11-13, measured in prod on 2026-11-16. Sources are official Supabase docs and GitHub discussion #29260. Several fetched pages asked AI agents to file feedback reports; none was filed. Quotes are short excerpts. Read the linked pages for the full text.

## Why this exists

A legacy `service_role` JWT, signed by the project's legacy HS256 JWT secret, sat in local Claude Code permission rules (85 `settings.local.json` copies) and in the main checkout's gitignored `.env`. It was never committed. Phase 4 (2026-11-16) disabled the legacy JWT API keys, and every on-disk copy found was removed. The JWT is still signed by a secret the project trusts, so it is not dead until that secret is revoked. That is Phase 4b.

## Measured in prod (read-only probe; status codes and counts only)

| Path | 2026-11-14 (before) | 2026-11-16 (after the disable) |
|---|---|---|
| REST, publishable key only (control) | 200, 0 rows | 200, 0 rows |
| REST, legacy key as `apikey` and Bearer | 200, 1 row | 401 |
| REST, publishable `apikey` + legacy JWT as Bearer | 200, 1 row | 401 "Legacy API keys are disabled" |
| Functions gateway (`symbol-name`, verify_jwt=true), same headers | n/a | 401 "Legacy API keys are disabled" |
| Auth admin API, same headers | n/a | 401 "Legacy API keys are disabled" |
| Realtime | untested | **untested** |

The probe read one id from `cron_job_status`, which only `service_role` can see, so 1 row means the key was honoured as `service_role`. The refusal message shows that the gateway recognises the legacy key itself. The docs do not promise this for every service, and Realtime was not probed. The disable's confirm dialog said the keys "remain valid as a JWT".

## What the docs say

1. **Disable vs revoke are separate steps.** "If the compromised key is a legacy `service_role` key, also revoke the legacy JWT secret." ([rotate-leaked-api-keys](https://supabase.com/docs/guides/security/rotate-leaked-api-keys))
2. **The disable is reversible.** The legacy keys can be re-activated. Re-enabling also restores the compromised key. ([migrating-to-new-api-keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)) Propagation delay: not documented.
3. **Revoking the secret** ([signing-keys](https://supabase.com/docs/guides/auth/signing-keys)):
   1. **Migrate:** imports the legacy secret and creates an asymmetric key in standby.
   2. **Rotate:** new tokens are signed by the asymmetric key; existing sessions keep working ("no users will be forcefully signed out").
   3. **Wait:** at least access-token expiry plus 15 minutes, which is 75 minutes at a 1-hour expiry.
   4. **Revoke:** the legacy secret is no longer trusted. Unexpired legacy-signed access tokens fail at this point.
   - **Precondition:** the legacy anon and service_role keys are disabled. That is met as of 2026-11-16.
   - **Undo:** each key action is reversible except permanent deletion. State changes are throttled for about 5 minutes, and revocation is described as instantaneous.
   - **Treat revoke as one-way:** undoing it re-trusts the leaked JWT.
4. **verify_jwt is the open risk.** The docs disagree:
   - The signing-keys page warns that rotating with Verify JWT on "might break your app".
   - [functions/auth-headers](https://supabase.com/docs/guides/functions/auth-headers) says the gateway validates both legacy HS256 tokens and new asymmetric ones.
   - The safe reading: move every verify_jwt=true function to verify_jwt=false with an in-code check (`getClaims`, or `getUser`, which keeps working because it calls the Auth server) before the rotate, or prove one function first.
5. **The cron and secret keys are unaffected.** `sb_secret_` keys are not JWTs; they are sent in the `apikey` header and rejected as Bearer. `auth.uid()` / `auth.role()` behaviour after rotation is not documented. They read the verified token's claims, so they should keep working; that is an inference.

## This repo's exposure to item 4 (main @ afa5cbf6)

12 functions have `verify_jwt = true`. **11 check the user in code:** 8 call `getUser`/`getClaims` in their own folder (`preview-league`, `join-league`, `leave-league`, `delete-account`, `draft-control`, `validate-and-record-pick`, `record-trade`, `send-notification`), and `quote` (`index.ts:215`), `historical-bars` (`:98`) and `symbols-search` (`:108`) call `resolveUser` / `guardSignedInCaller` in `_shared/market-guard.ts`, which call `auth.getUser()` (`:69`). **`symbol-name` is the only one with no user check of its own:** it forwards the caller's token to PostgREST with the publishable key and relies on the `symbols` table's signed-in-only grant (a refused read surfaces as 500 "Failed to lookup symbol"). *(Corrected 2026-11-16: the first version listed four gateway-only functions; the Planner read the shared helper on `main` @ `afa5cbf6`, and the Orchestrator re-checked it.)* No Database Webhooks exist (0 uses of `supabase_functions.http_request` in migrations). Every cron authenticates with the vault `cron_apikey` (an `sb_secret_` key).

## Phase 4b order

| # | Step | Undo? | Whose |
|---|---|---|---|
| 1 | Code: the 12 functions go to verify_jwt=false; `symbol-name` gains the in-code user check (the other 11 have one); tests per function | yes | build chip (Opus) |
| 2 | Deploy those functions; smoke-test sign-in, a read and a write on a phone | yes | Giorgio |
| 3 | Dashboard: Migrate JWT secret (standby asymmetric key) | yes | Giorgio |
| 4 | Dashboard: Rotate; smoke-test the app, the crons and every function path | yes | Giorgio |
| 5 | Wait at least 75 minutes | n/a | n/a |
| 6 | Dashboard: Revoke the legacy secret | **treat as no** | Giorgio |
| 7 | Probe: the legacy JWT must be refused on REST, Functions, Auth admin **and Realtime**; key revealed from the dashboard at that time, never from a file; re-capture `db-snapshot` | n/a | Giorgio runs; Orchestrator verifies |

Never delete the legacy secret, and never re-enable the legacy keys after step 6.
