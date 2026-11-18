---
applyTo: "supabase/**"
---

# Reviewing `supabase/` (migrations, RLS, edge functions, cron)

These are the mistakes this repo has actually made. Check each one that applies.

## Migrations

- **Applied files are never edited.** `supabase db push` tracks versions, not content, so a change to an already-merged migration is silently skipped. A fix is a new file with a later timestamp. Flag any diff that edits an existing migration's SQL.
- **Every pending file is applied.** A "hold" comment holds nothing. A migration that must wait belongs in `supabase/migrations/deferred/`.
- **`REVOKE ... FROM PUBLIC` does not lock a function.** Supabase grants `EXECUTE` to `anon` and `authenticated` by default, separately. A lockdown must revoke from `anon` (and `authenticated` when it is service-role only) by name. `CREATE OR REPLACE FUNCTION` keeps the old grants.
- **`SECURITY DEFINER` functions** need a pinned `search_path`, and must not trust a user id passed as an argument when `auth.uid()` is available.
- **The bare word `atomic`** outside quotes breaks the CLI's statement splitter. Identifiers containing it must be quoted.
- **New or changed RLS policies:** name the role (`authenticated`, not the default `PUBLIC`), and check that `USING (true)` is not exposing a column other users should not read.
- **Cron jobs** must read their key from Vault, never hold a key literal, and must set `timeout_milliseconds` on `net.http_post`.
- A grant, RLS or cron change should come with a PGlite test in `supabase/tests/` and a regenerated architecture map (`node scripts/gen-architecture.mjs`).

## Edge functions

- **`supabase-js` does not throw on a database error.** `.rpc()`, `.from()` and `functions.invoke()` resolve to `{ data, error }`. A `try/catch` around them is not a check. Flag any call whose `error` is ignored, and any success log that runs regardless.
- **The caller is checked in code.** A user-facing function must resolve the user itself and use that id, never one from the request body. A cron-only function must check the cron key.
- **Prices.** A price that is scored or paid must be a real trade, a sane two-sided midpoint, or the last close. Never a lone bid or ask, never a made-up stand-in such as cost basis or zero. A failed fetch is a failure, not "no price".
- **NULL and `0` are not "missing".** Before code fills in a NULL or treats `0` as absent, check whether other code tests that column for NULL.
- **Cron handlers that write `cron_job_status`** return through `runJob` so every exit writes a terminal status. A new early return that skips it is a bug.
- **Money and quantities** cross tables with different types (`drafts.user_id` is text, `trades.user_id` is uuid; quantities differ in numeric type). A join or `UNION` over them needs explicit casts.
- Scoring, snapshot and draft logic belongs in a pure module beside `index.ts` with its own test, not inline in the handler.
