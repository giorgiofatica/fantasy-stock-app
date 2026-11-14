# Brief security check, 2026-11-13

Asked for by Giorgio on 2026-11-13, to run unsupervised: "a brief security check to make sure that the platform and the app is secure".

**How it was run.**
- Two read-only reviewers looked at a clean checkout of `origin/main` @ `707f11e6`:
  - `supabase-reviewer`: edge functions, SQL grants, RLS, cron and vault;
  - `security-reviewer`: the client, the repo and secrets.
- Neither has a shell, so nothing was run, changed or queried in prod.
- The live database state comes from `docs/architecture/db-snapshot.json`, captured 2026-11-11T21:55Z. Anything that needs a fresh prod query is listed under "Needs Giorgio".
- The Orchestrator spot-checked the top findings against the code and the snapshot.

**Result:**
- No CRITICAL or HIGH findings.
- No secret values anywhere in the repo; nothing needs rotating.
- Five MEDIUM items. Three are server-side policy gaps, and two are app behaviours that need a product decision.

Findings only. Each fix below would be its own PR: a new migration (drafted by the migration writer, applied by Giorgio) or a mobile change.

---

## MEDIUM

### S1. Any signed-in account can read the whole `symbols` table
- **Confirmed** in both the migration and the live snapshot.
- **Evidence:**
  - `supabase/migrations/20261114000000_symbols_signed_in_only.sql:86-94` grants `SELECT` on the table to `authenticated` with policy `USING (true)`.
  - Snapshot `tables[symbols]`: ACL `authenticated=rm`, `columnAcls` empty. No later migration changes it.
- **Why it matters:** any account can page every row (name, industry, market cap, `last_price`, draftability) through `/rest/v1/symbols`. That bypasses the per-user limits on quote, ticker-quotes, historical-bars and symbols-search. PRODUCT_RULES (the "nothing scrapable" rule, 2026-10-08) says bulk-readable data is audited and locked down. The migration closed the anonymous half only.
- **Smaller point in the same place:** `authenticated` also holds `m` (MAINTAIN, PG17), which the migration's revoke list doesn't cover.
- **Fix direction:** a column-limited grant (symbol and name only), or move the reads behind the rate-limited functions and drop the direct `SELECT`.
- **Found by:** the market-data audit (`docs/audits/2026-11-13-market-data-dependency-audit.md` §5a), confirmed here.

### S2. A commissioner can hard-delete draft picks directly
- **Suspected:** confirmed in the snapshot, but whether anything legitimate still relies on it is not checked.
- **Evidence:** snapshot `tables[drafts].policies` has "Commissioners can delete picks", role PUBLIC, gated only on the caller being the league's commissioner. There's no draft-status or time guard, and the table grant is full.
- **Why it matters:** positions and scoring derive from `drafts`. A commissioner could rewrite a live or finished league through PostgREST, bypassing draft-control's rules.
- **Fix direction:** restrict the policy to `draft_status = 'not_started'`, or drop it and route any legitimate delete through a function.

### S3. A commissioner can update any column of `leagues`, and do anything to `draft_sessions` / `draft_settings`
- **Suspected**, with the same caveat as S2.
- **Evidence:** snapshot `leagues_update_commissioner` (`is_commissioner(id)`) with empty `columnAcls`, and full commissioner policies on `draft_sessions` and `draft_settings`.
- **Why it matters:** a commissioner could set `draft_status`, season or clock fields directly and skip the rules the server functions enforce. Some columns are already guarded by triggers (the rules-freeze trigger, `20261104000000`); the reviewer did not map which ones are left.
- **Fix direction:** column-level grants, or a trigger that refuses protected-column changes from a user session.

### A1. Plain "Sign out" leaves the pending invite, takeover and route behind
- **Confirmed.**
- **Evidence:** `apps/mobile/lib/SessionProvider.tsx:324-343` removes the push token, signs out of Supabase and of Google, but doesn't clear the pending stores. The full cleanup (`lib/account/endSessionCore.ts:56-58`: pending takeover, pending invite, active-league key) only runs after account deletion.
- **Why it matters:** a link one person opened stays on the phone after they sign out. The owner-binding logic (`takeoverOwnerAction`, `inviteOwnerAction`) stops it acting for the next person, so this is hygiene, not a hijack. `pendingRoute` and the active-league key weren't traced.
- **Fix direction:** have the plain sign-out run the same pending-store cleanup.

### A2. An https invite link joins a signed-in person without a tap
- **Confirmed**, and it's a deliberate product decision (decision 18).
- **Evidence:** `apps/mobile/lib/invite/autoJoin.ts:112-114`: `inviteNeedsTap` returns false for any https link, even when the person was already signed in. Only a custom-scheme link waits.
- **Why it matters:** once the https link opens the app (the AASA file and W5, #279), any page, message or QR code carrying `https://…/join/<CODE>` joins a signed-in person to that league with no confirmation. It's reversible with Leave league. Takeover links already always wait for a tap.
- **For Giorgio to decide:** keep the zero-tap join for people who were already signed in, or ask for a tap when signed in and keep zero-tap only for a signed-out arrival. It's dormant today, since no https link opens the app yet.

---

## LOW

- **Session stored in AsyncStorage, not the Keychain.** `apps/mobile/lib/supabase.ts:16-19, :46-47`. It's the common Supabase React Native default, but the refresh token sits unencrypted in the app sandbox. Fix: a SecureStore-backed adapter (chunked), with a one-time migration.
- **A few capture fixtures read env vars without the `__DEV__` gate.**
  - `MATCHUP_FIXTURE_VARIANT` and `PORTFOLIO_STAKE_VARIANT` in `apps/mobile/lib/game/devSeam.ts:14-25` are confirmed.
  - Reads in `useHomeLeague.ts`, `useRosterData.ts`, `seamCalls.ts` and `portfolioSeam.ts` weren't confirmed to sit behind `SEAM_ON`.
  - Release builds set none of these (`eas.json`), so the guarantee today is "nobody sets the env" rather than "the code can't". Fix: wrap each in `__DEV__ ? … : default`, as `captureDev.ts` and the `devFixture.ts` files do.
- **Blanket table grants, including TRUNCATE, for `anon` and `authenticated`.** 18 tables carry `anon=arwdDxtm`, and the default privileges re-grant it to every new table (snapshot `defaultPrivileges`). RLS doesn't cover TRUNCATE, but PostgREST exposes no TRUNCATE verb, so it's a standing footgun, not a live path. Fix: revoke truncate, references, trigger and maintain, and alter the default privileges.
- **`get_real_user_ids` is pinned to `search_path=public` without `pg_temp`.** `supabase/migrations/20261116000000_scrape_hardening.sql:130-152`. It's correctly scoped to the caller. Fix: pin `public, pg_temp`.
- **The gitleaks allowlist is wider than it needs to be.** `.gitleaks.toml:18-26`.
  - `^\.claude/` exempts the agent prompts, a command, a hook and `settings.json`. A grep found nothing key-shaped there today, so it can be narrowed or dropped.
  - `^apps/mobile/eas\.json$` means a real key pasted into `eas.json` wouldn't be caught. It holds only a URL, so drop the entry, or rely on the exact anon-key regex.
- **The universal-link domain has no AASA file live** (the live site serves `index.html` for `/.well-known/apple-app-site-association`). This is the known W5 work (#279). When it ships, A2 becomes live.

## Known, tracked (not re-reported)
- **In CLAUDE.md:** the success-signal and partial-state items, `cron_job_status` stranding, and the `.claude/` allowlist note.
- **Phase 4** (disabling the legacy keys) is open in STATUS §4.

## Checked and fine
- **Secrets:**
  - no service-role, Alpaca, Finnhub, Google, Expo or Apple key values in tracked files;
  - no `.env*` files tracked;
  - the `sb_secret_*` matches are test placeholders;
  - the cron migrations' anon JWTs are the allowlisted publishable key.
- **Mobile bundle:** only public values ship (Supabase URL, the publishable key, Google client ids). Nothing reaches a service-role or third-party secret.
- **Edge functions:**
  - every `verify_jwt=false` cron function goes through the shared constant-time, fail-closed apikey guard (`_shared/cron-auth.ts:17-36`);
  - ticker-quotes checks the user, rate-limits, and allowlists symbols for anonymous callers.
  - Not read in depth: request validation and error text in join-league, record-trade and symbols-search, and invite-preview's code.
- **Postgres functions:** no function is executable by `anon` in the snapshot. The authenticated-callable SECURITY DEFINER functions checked all pin `search_path`, apart from the LOW item above.
  - `nudge_renewal` checks the caller against the commissioner.
  - Not read: `remove_renewal_invitee`, `create_takeover_invite`, `start_renewed_season`.
- **RLS:** enabled on every table. The only `USING (true)` policies are the reference tables (categories, category_rules, market_calendar, market_calendar_coverage, symbol_category_overrides, and `symbols`, S1). `push_tokens` and `user_profiles` writes are gated on `auth.uid()`. `account_deletions` has no client access.
- **Cron and vault:** all 13 HTTP cron jobs read their key from `vault.decrypted_secrets` (`cron_apikey`), with no literal keys in the commands. The drift panel has no HIGH rows.
- **Deep links:**
  - fixed paths, so codes stay out of router params;
  - strict parsers;
  - `/auth/confirm` uses PKCE with a UUID-shaped code, never replaces an existing session, and refuses recovery-type codes;
  - takeover always waits for a tap and binds to its owner;
  - dev-only link origins are off in release builds.
- **Web app (paused):** serves only the landing page. Its public env vars only. No raw HTML injection.
- **Dependencies:** no install scripts, git or tarball URLs, or forced installs.

## Needs Giorgio (read-only, SQL editor or dashboard)
- Hosted max rows (Dashboard › Settings › API › Max rows), the page size on `/rest/v1/symbols`. It's a page size, not a cap: the whole table is still reachable in about 15 requests.
- `select column_name from information_schema.columns where table_schema='public' and table_name='symbols';` and `select count(*) from public.symbols;`
- `select relacl from pg_class where oid='public.symbols'::regclass;` to confirm the MAINTAIN grant.
- `select tablename, policyname, cmd from pg_policies where tablename in ('drafts','leagues','draft_sessions','draft_settings');` because the snapshot is two days old.

## Suggested order
1. **S1:** the symbols scrape, a new migration, before real players join.
2. **S2 and S3:** first map what legitimately writes those tables (draft-control and the season functions), then tighten.
3. **A2:** a product decision for Giorgio, before the AASA file ships.
4. **A1, and the LOW items:** small, any time.
