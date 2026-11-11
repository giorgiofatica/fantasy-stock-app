# Security read: a Claude Data dashboard reading counts from production

Status: **Orchestrator's Opus pass done (2026-11-10): Step 0 SQL revised and run on PGlite; test 3 widened; two
scope notes added. Ready for Giorgio.**
Written by the Planner on 2026-11-10, from two read-only halves. Nothing was connected.
The only thing run against prod is the Step 0 catalog query (Giorgio, SQL editor,
2026-11-10); its result is recorded under Step 0.

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
| The connector | Researcher (Opus), `docs/research/2026-11-10-supabase-connector-read-only-security.md` @ `c5c94798` | Supabase's MCP docs and source, its Management API docs, Postgres docs, Anthropic's docs, published incident write-ups, all read 2026-11-10 | Nothing was tested hands-on. Four facts are undocumented (below) |
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
- **Vault: probably not readable in plain text, but not settled, and it decides the trial.**
  `vault.decrypted_secrets` decrypts by calling a function as it is read. Postgres checks a
  view's tables against the view's owner, but its functions against whoever runs the query
  (PostgreSQL 17, CREATE VIEW, Notes: "the user of a view must have permissions to call all
  functions used by the view"). Vault's install script revokes that decrypt function from
  `PUBLIC` and grants it to nobody, and `pg_read_all_data` covers tables, views and
  sequences, not functions. So the reader gets plain text only if some grant outside that
  script gives it `EXECUTE`. Not settled: the script read was version 0.3.0, the installed
  version is unknown, and Supabase's platform may add grants. Finding 7. Step 0 below checks
  it on prod without connecting anything.
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
`public` only (and plain functions, not procedures), it is four days old, and it says nothing
about functions in `net`, `vault`, `extensions` or `auth`. Since the capture, the two functions
re-created by `20261128000000` and the two touched by `20261129000000` had their grants checked
on prod by query after each push (2026-11-10), so the claim still holds for those. Step 0 now
also lists every `SECURITY DEFINER` function in ANY schema the role can execute, which is the
real answer to the worry. One more limit on the worry itself: a `SECURITY DEFINER` function
does not lift a read-only transaction (a write inside it still fails), so this matters only if
test 3 shows the transaction can be switched to read-write. `net.http_get` and `net.http_post` in particular would be a way to
send data out, and their grants are not in the snapshot.

## The path, in order

**Step 0. A catalog check on prod: no connection, no secret values.** One read-only query
in the Supabase SQL editor asks Postgres what `supabase_read_only_user` is allowed to do. It
reads only the permission catalog, so it returns role names and true/false, never a row of
data or a secret. It answers on prod what the documents could not: whether the role bypasses
RLS, which roles it belongs to, and whether it can run Vault's decrypt function or `pg_net`'s
send functions.

```sql
SELECT 'superuser' AS what, r.rolname::text AS name, r.rolsuper::text AS answer
  FROM pg_roles r WHERE r.rolname = 'supabase_read_only_user'
UNION ALL
SELECT 'bypasses RLS', r.rolname::text, r.rolbypassrls::text
  FROM pg_roles r WHERE r.rolname = 'supabase_read_only_user'
UNION ALL
SELECT 'member of (direct or inherited)', g.rolname::text, 'true'
  FROM pg_roles g
 WHERE g.rolname <> 'supabase_read_only_user'
   AND pg_has_role('supabase_read_only_user', g.oid, 'MEMBER')
UNION ALL
SELECT 'can execute', p.oid::regprocedure::text,
       has_function_privilege('supabase_read_only_user', p.oid, 'EXECUTE')::text
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE (n.nspname IN ('vault', 'pgsodium') AND p.proname ILIKE '%decrypt%')
    OR (n.nspname = 'net' AND p.proname LIKE 'http\_%')
UNION ALL
SELECT 'definer it can execute', p.oid::regprocedure::text, 'true'
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE p.prosecdef
   AND n.nspname NOT IN ('pg_catalog', 'information_schema')
   AND has_function_privilege('supabase_read_only_user', p.oid, 'EXECUTE')
UNION ALL
SELECT 'can select', c.oid::regclass::text,
       has_table_privilege('supabase_read_only_user', c.oid, 'SELECT')::text
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE (n.nspname = 'vault' AND c.relname IN ('decrypted_secrets', 'secrets'))
    OR (n.nspname = 'auth' AND c.relname = 'users')
    OR (n.nspname = 'net' AND c.relname IN ('http_request_queue', '_http_response'))
ORDER BY 1, 2;
```

How to read it (it returns role, function and table names and true/false; never a row of data
or a secret value):
- **superuser** must be **false**. True ends it: prod is not connected.
- **bypasses RLS**: recorded either way (the read assumes true).
- **member of**: every role it belongs to, directly or through another role. `pg_read_all_data`
  is expected. `authenticated`, `service_role`, `postgres` or any `supabase_*admin` role ends
  the function-grant comfort above.
- **can execute** a `vault`/`pgsodium` function with "decrypt" in its name: **false** for every
  such row means that role cannot get Vault plain text. **true** on any means it can, and prod
  is not connected. **No decrypt row at all** means the installed Vault decrypts some other way,
  and step 0 cannot settle it: test 2 decides.
- **can execute** `net.http_...`: true means the reader could send data out IF it can write
  (test 3 and test 11 decide).
- **definer it can execute**: every `SECURITY DEFINER` function, in any schema, that the role
  can call. The list should be empty or harmless; anything that writes or decrypts goes to the
  Orchestrator before step 1.
- **can select**: `vault.decrypted_secrets` true is expected from `pg_read_all_data`; plain text
  still needs the decrypt function above.
- **An error that the role does not exist** is itself an answer: the connector would be using
  some other role, and step 1 has to find out which.
Checked by the Orchestrator on PGlite (whole migration chain, a stand-in role with
`pg_read_all_data` + `BYPASSRLS`): it runs, its columns line up, a missing role gives
`role "supabase_read_only_user" does not exist`, and a planted open definer function is listed.
Step 0 narrows the question; it does not replace step 1, because it says nothing about the
connector's own behaviour.

**Step 0 result (prod, run by Giorgio in the SQL editor, 2026-11-10).** 17 rows, names and
true/false only.

| What | Result | Reading |
|---|---|---|
| superuser | false | Passes |
| bypasses RLS | true | As the read assumed |
| member of | `pg_read_all_data`, `pg_monitor`, `pg_read_all_settings`, `pg_read_all_stats`, `pg_stat_scan_tables` | None of `authenticated`, `service_role`, `postgres` or a `supabase_*admin` role, so our function grants do not reach it |
| can execute `vault._crypto_aead_det_decrypt` | false | The one decrypt function found. No `pgsodium` decrypt row came back |
| can execute `net.http_get`, `http_post`, `http_delete`, `http_collect_response` | true (all four) | Sending out is open IF the role can write. Tests 3 and 11 decide |
| definer it can execute | no rows | No `SECURITY DEFINER` function in any non-system schema is callable by it |
| can select `auth.users`, `vault.secrets`, `vault.decrypted_secrets`, `net.http_request_queue`, `net._http_response` | true (all five) | Expected from `pg_read_all_data` |

What this settles, and what it does not:
- **Settled on prod:** the role is not a superuser, is in none of our app roles, cannot call
  Vault's decrypt function, and has no definer function to borrow rights from.
- **Vault plain text: now unlikely on prod, still unproven.** The grant is absent, so reading
  `vault.decrypted_secrets` should fail with a permission error on the function. That is an
  inference from a grant, not an observed read. Test 2 is still the proof.
- **Confirmed, and not covered by the Vault result:** `net.http_request_queue` is readable.
  Item 2 above stands: a queued cron request carries its real `apikey` header there until it
  is sent, so a live key can be read in plain text from that table whatever Vault does. The
  window is short and the key is `cron_apikey`, not the service-role key, but no test in
  step 1 removes it. Only "no column from `net`" (step 3, condition 4) stands in the way,
  and that is a habit, not a lock.
- **Confirmed:** `auth.users` is readable past RLS.
- **New, small:** `pg_monitor` lets the role read other sessions' live query text
  (`pg_stat_activity`) and statement statistics. Our cron commands name the Vault secret, not
  its value, so no key is expected there. Not checked on prod.
- **Not checked by this query:** whether the role holds `INSERT` on `net.http_request_queue`
  (the `net.http_*` functions are not definer, per the empty definer list, so they would
  need it), and anything about the connector's own behaviour. The `INSERT` grant is answered
  by the second check below.

**Second catalog check (prod, run by Giorgio in the SQL editor, 2026-11-10).** Prompted by
the membership list. It reads `pg_db_role_setting` (setting NAMES only, split before the
`=`), one true/false on `app.settings.jwt_secret`, and one grant. 17 rows.

```sql
SELECT 'stored setting' AS what,
       coalesce(d.datname, '(every database)') || ' / ' || coalesce(r.rolname, '(every role)') AS scope,
       split_part(cfg, '=', 1) AS answer
  FROM pg_db_role_setting s
  LEFT JOIN pg_database d ON d.oid = s.setdatabase
  LEFT JOIN pg_roles r ON r.oid = s.setrole
 CROSS JOIN LATERAL unnest(s.setconfig) AS cfg
UNION ALL
SELECT 'jwt secret is a database setting', 'app.settings.jwt_secret',
       (nullif(current_setting('app.settings.jwt_secret', true), '') IS NOT NULL)::text
UNION ALL
SELECT 'can insert', 'net.http_request_queue',
       has_table_privilege('supabase_read_only_user', 'net.http_request_queue', 'INSERT')::text
ORDER BY 1, 2, 3;
```

Why not `pg_settings`: it does not list custom settings (names with a dot). Checked on
PGlite (PG 16.4) with `app.settings.jwt_secret` set by `ALTER DATABASE` and by `SET`: a
`pg_settings` search for it returned nothing, so an empty result there would have been a
false clearance. The query above was run with dummy secrets planted (one containing `=`) and
returned names only.

| What | Result | Reading |
|---|---|---|
| `app.settings.jwt_secret` is a database setting | false | The token-signing secret is not readable through SQL settings |
| stored settings | `statement_timeout`, `lock_timeout`, `search_path`, `log_statement`, `session_preload_libraries`, `idle_in_transaction_session_timeout` on Supabase's own roles; `app.settings.jwt_exp` on the database | Ordinary. No name with "secret" or "key". `jwt_exp` is a token lifetime, not a secret |
| stored setting on `supabase_read_only_user` | `default_transaction_read_only` | **The role's read-only mode is a per-role default** (see below) |
| can insert into `net.http_request_queue` | **true** | **The grant the read hoped was missing is there** |

What the last two rows mean together:
- `default_transaction_read_only` is a setting any session may change for itself. Checked
  on PGlite as a non-superuser with that default on: a plain `INSERT` is refused, but
  `BEGIN; SET TRANSACTION READ WRITE; INSERT ...` succeeds, and so does
  `BEGIN READ ONLY; SET TRANSACTION READ WRITE; INSERT ...` when the `SET` comes before any
  query. It is refused only once a query has already run in the transaction
  ("transaction read-write mode must be set before any query").
- So on prod, nothing in the role's own grants or settings stops it from queueing an outgoing
  request: it may call `net.http_get`/`http_post`, it may insert into the queue they write
  to, and its read-only mode is a default. The only thing left is how the connector sends
  the SQL (whether it runs a statement first, or refuses multi-statement text), which is
  undocumented. **Tests 3 and 11 are now the deciding tests, with a specific reason to expect
  they could fail.**
- If they fail, a reader that can see `auth.users` and every table can also send what it
  reads to any address. With player-written text in rows (item 5 above), that is the full
  prompt-injection path: private data, untrusted text, and a way out.
- Scope of this claim: the setting's NAME was read, not its value (assumed `on`); the
  PGlite run shows Postgres's rule, not the connector's behaviour; nothing was sent.
- This is not a hole in the app today. The role is used only through Supabase's own
  dashboard and connector by someone signed in to the organisation, who already has full
  access. It matters from the moment Claude is connected.
- Limit of the settings check: a secret stored under some other custom name, only in
  Supabase's config file, would not show.

**Step 1. Test on a non-prod Supabase project. Required whatever happens next.**
The Researcher's ten tests (its file, "Hands-on tests"), plus one from this read:

| # | Test | Must show |
|---|---|---|
| 1 | Which role runs the SQL, does it bypass RLS, and which roles is it a member of | Recorded, either way. If it is a member of `authenticated` or `service_role`, the function-grant finding above no longer protects us |
| 2 | A dummy Vault secret, then read `vault.decrypted_secrets` | **No plain text.** Plain text ends the prod trial |
| 3 | `INSERT`; again after `SET TRANSACTION READ WRITE`; after `SET default_transaction_read_only = off` and `SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE`; and one multi-statement query that starts with `COMMIT;` to try to leave a wrapping read-only transaction | All refused |
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

*Updated after the second catalog check:* the advice below was written when the prod trial
looked merely unnecessary. With the insert grant present and read-only being a default, the
Planner now advises **against** connecting Supabase's connector to prod at all, unless tests
3 and 11 on non-prod show the connector itself blocks the switch. Still Giorgio's call.

Do step 1 on a non-prod project: it costs nothing, risks nothing, and tells us whether
Claude Data works with Supabase at all. Treat a prod trial as optional even if every test
passes, because the reader still sees `auth.users` and every table, and the only thing
standing between a query and that data is the care taken writing it. If the health page
proves useful on non-prod, build (b) or (a) and point the dashboard at that. That keeps
"Lock everything down" true and still gets him the page.
