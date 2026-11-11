# Security read: a Claude Data dashboard reading counts from production

Status: **Draft for the Orchestrator's Opus pass. Not yet shown to Giorgio.**
Written by the Planner on 2026-11-10, from two read-only halves. Nothing was connected and
nothing was run against prod.

Giorgio's ruling (2026-11-10, `docs/PRODUCT_RULES.md`, "Lock everything down"): asked
whether a Claude Data dashboard may read counts from the production database, never names,
emails or holdings, he said **"yes as a trial, do the security read first"**.

## Verdict

1. **The one-click Supabase connector, as it comes: no.** It signs in to the whole Supabase
   organisation with write scopes and every tool group on, including the tools that apply
   migrations and deploy functions.
2. **"Read-only" limits writes, not what can be seen.** Its SQL runs as Supabase's own
   `supabase_read_only_user`, which reads every table in every schema and, on the best
   evidence, bypasses RLS. That role is reserved; we cannot narrow it. "Counts only" would be
   a habit in how each query is written, not a lock.
3. **A prod trial is acceptable only after a test on a non-prod project**, and only if that
   test shows the role cannot read Vault secrets in plain text and cannot write. If either
   fails, prod is not connected at all, trial or not.
4. **Before real players, this connector is replaced, not tuned.** The lasting answer is a
   login of our own that can see a handful of totals and nothing else, or no live connection
   at all.

## What the evidence is, and is not

| Half | Who | What was read | What was not |
|---|---|---|---|
| The connector | Researcher (Opus), `docs/research/2026-11-10-supabase-connector-read-only-security.md` @ `b4d05153` | Supabase's MCP docs and source, its Management API docs, Postgres docs, Anthropic's docs, published incident write-ups, all read 2026-11-10 | Nothing was tested hands-on. Four facts are undocumented (below) |
| Our database | `security-reviewer` subagent + the Planner | `supabase/migrations/`, `docs/security/`, `docs/STATUS.md`, `docs/migrations/MIGRATION_STATUS.md`, and `docs/architecture/db-snapshot.json` on `main` (captured 2026-11-07) | Prod was not queried. The reviewer's checkout was behind `main`, so the account-deletion, takeover and invite-preview tables were seen only through the snapshot. The snapshot predates `20261128000000` and `20261129000000` |

Every "can" and "cannot" below about our tables is a statement about grants and policies as
written, not about live prod.

## What the connector's reader can reach

From the Researcher's file (finding numbers are its own):

- **Every schema, past RLS.** `supabase_read_only_user` holds `pg_read_all_data` (official
  docs) and `BYPASSRLS` (Supabase's own open docs change and one third-party observation; an
  older Supabase blog says the opposite). So: `auth.users` (emails, password hashes),
  `auth.identities`, sessions and refresh tokens, `cron.job`, `net._http_response`, the full
  migration history, and every `public` table. Findings 3 to 6.
- **Vault: undetermined, and it decides the trial.** `vault.decrypted_secrets` decrypts as
  it is read. Whether this role gets plain text depends on a grant nobody documents.
  Finding 7.
- **Writes are stopped by Postgres only.** The connector forwards a flag; it does not block
  SQL itself. Whether a query can switch its own transaction to read-write is undocumented.
  Findings 9 to 11.
- **Other tools still work in read-only mode**: logs, advisors, and `get_edge_function`,
  which returns deployed function source. No tool returns a secret key. Findings 13, 14.
- **It can be narrowed in three ways, and only as a custom connector**: `project_ref` (one
  project), `read_only=true`, `features=database`, plus blocking each remaining tool in
  Claude's connector settings. There is no way to make it log in as a role of ours.
  Findings 15 to 17.
- **The grant is Giorgio's own access to the whole organisation.** The narrowing is enforced
  by Supabase's hosted server, not by the token. Findings 18, 19.

## What is in our database that such a reader would see

1. **Live keys in Vault** (the deciding risk). Two entries: `cron_apikey`, which every cron
   job reads, and `service_role_key`, the legacy service-role JWT. `MIGRATION_STATUS.md`
   lists the second as orphaned and still to remove, and legacy keys are still enabled
   (Phase 4, gated on one real trade from the app). So an unused copy of a key that opens
   the whole database sits in Vault. If the reader gets Vault plain text, one stray `SELECT`
   puts a live key into a Claude conversation, which is a rotation event under this repo's
   secret-handling rule.
2. **Keys in flight.** `net.http_request_queue` holds each queued cron request with its real
   `apikey` header until it is sent. The draft sweep ticks every 10 seconds. `cron.job`
   itself holds only the reference to Vault, not a value.
3. **Things that work as credentials**: `leagues.invite_code`, `league_invites.code`,
   `push_tokens.token`, and the takeover and renewal invite codes.
4. **Personal data**: emails and password hashes in `auth`; `signup_allowlist.email` and
   `note`; `league_invites.invited_identifier`; usernames; `rate_limit_counters.subject`,
   which stores `ip:<address>` values; the `account_deletions` ledger.
5. **Text players write** (the prompt-injection surface if rows are ever returned):
   `leagues.name` has no length or character limit in the snapshot's constraints;
   `user_profiles.avatar` is free text; error-message columns hold text from upstream
   services.
6. **Nothing today returns totals only.** `league_activity` returns rows. There is no
   aggregate-only view or function to point a dashboard at.

One thing that is in good shape. In the 2026-11-07 snapshot, **no `public` function is
executable by `PUBLIC` or `anon`**: 129 functions, 95 of them `SECURITY DEFINER`, every ACL
names only `postgres`, `service_role`, `authenticated` or `supabase_auth_admin`. So the
Researcher's worry (a reader that turns on read-write and calls a definer function left open
to everyone) has no target in `public` as of that capture. Limits of that claim: it covers
`public` only, it is four days old, and it says nothing about functions in `net`, `vault`,
`extensions` or `auth`. `net.http_get` and `net.http_post` in particular would be a way to
send data out, and their grants are not in the snapshot.

## The path, in order

**Step 1. Test on a non-prod Supabase project. Required whatever happens next.**
The Researcher's ten tests (its file, "Hands-on tests"), plus one from this read:

| # | Test | Must show |
|---|---|---|
| 1 | Which role runs the SQL, and does it bypass RLS | Recorded, either way |
| 2 | A dummy Vault secret, then read `vault.decrypted_secrets` | **No plain text.** Plain text ends the prod trial |
| 3 | `INSERT`, then again after `SET TRANSACTION READ WRITE`, then after turning the read-only default off | All three refused |
| 4 | A `SECURITY DEFINER` function open to everyone that inserts a row, called the same three ways | Refused |
| 5 | Another project's id passed to a tool | Refused |
| 6, 7 | Tool list with `features=database` | Database tools only; no deploy, branching or notebook tools |
| 8 | The URL parameters took effect in a custom connector | Tests 1 and 3 prove it |
| 9 | The consent screen's scopes; revoke the grant | The connector stops working |
| 10 | One dashboard number from a single `SELECT count(*)` | It renders (this is also the first proof Claude Data works with this connector at all) |
| 11 (added) | `SELECT net.http_get(...)` to a harmless address | Refused. If it runs, the reader can send data out |

**Step 2. Decide on the results.**
- Test 2 returns plain text, or tests 3, 4 or 11 succeed: **prod is not connected.** Go to
  step 4.
- All pass: a prod trial is allowed under step 3's conditions. It is still Giorgio's call.

**Step 3. The prod trial, if step 2 allows it.** All of these, not some:
1. A custom connector with `project_ref` (prod), `read_only=true`, `features=database`.
2. Every tool blocked except `execute_sql`.
3. `execute_sql` never set to "always allow": each query is approved by eye.
4. Queries are `count(*)` or grouped totals only. No column from `auth`, `vault`, `cron` or
   `net`. No text a player typed. No breakdown fine enough that a count of 1 names a person.
5. Not shared. Only Giorgio opens it.
6. A fixed end date, then the grant is revoked.
Connecting and revoking are his own steps.

**Step 4. Before real players: replace it.** Two options to plan, both the Planner's and
Orchestrator's to scope, neither started:
- **(a) Our own narrow login.** A `metrics` schema of views or functions that return
  numbers only (no text, no ids, no timestamps finer than a day, small counts bucketed), and
  a login role with access to that schema and nothing else: no `auth`, no Vault, no RLS
  bypass. It needs a connection Claude can use that is not Supabase's connector, a migration
  with explicit revokes from `anon`, `authenticated` and `service_role` (not only `PUBLIC`),
  `proacl` and `relacl` checked after the push, and a security review.
- **(b) No live connection.** A scheduled job writes the totals to a file and the dashboard
  reads the file. Nothing in Claude can reach the database.
(b) is the tightest. (a) is live but is real build work.

## A separate finding, worth fixing whatever happens to the dashboard

**The leftover `service_role_key` in Vault.** Do not delete it by itself. The Orchestrator
checked `main` and the 2026-11-07 snapshot:
- No cron job reads it (all 14 use `cron_apikey` or no key).
- Two manual helper functions still do: `public.trigger_week_processing()` and
  `public.trigger_week_snapshot()`. On a Vault miss, the first falls back to the anon key
  without an error, so deleting the entry would silently downgrade it.
- Deleting the Vault copy does not disable the key. It stays valid until legacy keys are
  switched off (Phase 4).

The right order: a small migration that drops those two helpers, then delete the Vault
entry, then Phase 4 when its last gate is done. Before any of it, Giorgio confirms on prod
that nothing else reads the entry (the Orchestrator has the read-only query; expected result
is no cron rows and those two functions).

## Only prod can confirm

1. Vault's secret names (names only), and whether `service_role_key` is among them.
2. Whether `signup_allowlist` holds any real person's email besides Giorgio's own test
   addresses.
3. Whether `rate_limit_counters.subject` holds `ip:` values today.
4. The two migrations applied after the snapshot left function grants as the Orchestrator's
   post-push queries reported.
The snapshot is due a re-capture after today's function and trigger changes; the Recorder
has that ask.

## Questions for Giorgio

1. Is there a non-prod Supabase project for step 1, or should one be created? It is a free
   project, on his account.
2. Which Claude plan is he on? It decides how long conversation data is kept and whether a
   narrower credential (a project-scoped, read-only token in place of the organisation-wide
   sign-in) is available.

## The Planner's advice

Do step 1 on a non-prod project: it costs nothing, risks nothing, and tells us whether
Claude Data works with Supabase at all. Treat a prod trial as optional even if every test
passes, because the reader still sees `auth.users` and every table, and the only thing
standing between a query and that data is the care taken writing it. If the health page
proves useful on non-prod, build (b) or (a) and point the dashboard at that. That keeps
"Lock everything down" true and still gets him the page.
