# Stockpile: review instructions

Stockpile is a fantasy stock league: managers draft real stocks, hold them through weekly head-to-head matchups, and the larger dollar gain wins the week. The code is written by an AI coding agent; you are the independent second reader. One owner merges every pull request by hand.

## Layout

- `apps/mobile`: the product. Expo / React Native, TypeScript. Pure logic lives in `lib/` and `components/sp/logic/`.
- `apps/web`: a Vite/React landing page and invite-link pages. Merging to `main` deploys it to production.
- `supabase/functions`: Deno edge functions (draft, trades, weekly snapshots, scoring, market data). Shared code in `_shared/`.
- `supabase/migrations`: Postgres schema, RLS policies, RPC functions, cron jobs. Applied by hand, never by CI.
- Tests: `supabase/tests` and `supabase/functions/**/*.test.ts` (Deno, PGlite runs the real migrations), `apps/mobile/tests-deno`, `apps/web/src/**/*.test.*`.

`CLAUDE.md` holds the repo's hard-won conventions and `docs/PRODUCT_RULES.md` the product rulings. Treat both as the source of truth: a change that follows a written rule is not a finding.

## What to look for, in this order

1. **Wrong results.** Scoring, prices, draft order, budgets and slot limits, week boundaries (US market time), rounding of money. A wrong number is the worst bug this app can have.
2. **Who can read or change what.** Every table is behind RLS, and every edge function checks its caller in code (a signed-in user through `auth.getUser()`, or the cron key for scheduled jobs); the gateway checks nothing. Flag any path where one user can read or write another user's or another league's data, and any secret or service-role key that could reach a client.
3. **False success.** Code that reports success without proving the effect: a swallowed error, an unchecked `{ error }` from a Supabase call, a fallback value standing in for missing data, a job that returns 200 after doing nothing.
4. **Partial state.** A check that asks "does any row exist?" over a set that can be half written (`.some()`, `EXISTS`, a filter before a conclusion). The right check counts against the expected set, per participant.
5. **Waste that matters.** A query or network call inside a loop, the same data fetched twice, an unbounded list, a React effect that re-runs on every render.
6. **Needless code.** A new helper that duplicates an existing one, an abstraction with one caller, dead branches, a new dependency for something small.
7. **Tests that prove nothing.** A test that cannot fail, asserts only what it mocked, or was loosened to make a run pass. New behaviour in scoring, pricing, drafting or permissions without a test is worth saying.

## How to report

- Give the file and line, what goes wrong, and a concrete input or sequence that triggers it. If you cannot name one, say it is a suspicion.
- Start each comment with one of: **Blocking** (wrong result, data exposure, data loss), **Important** (a real bug or real waste not yet shown to bite), **Advisory** (take it or leave it).
- Prefer a few findings you would stand behind over many maybes. No comments is a fine review.
- Suggest the smallest fix. Do not propose rewrites or new libraries.

## What not to raise

- Formatting, naming taste, import order, comment wording. Linters own style.
- React Native `StyleSheet.create` at the bottom of a file, with a file-top `eslint-disable @typescript-eslint/no-use-before-define`. It is the house idiom.
- Long explanatory comments. They are deliberate here.
- The Supabase publishable (anon) key appearing in client code. It is public by design; RLS is the boundary.
- Generated files: `docs/architecture/architecture.json`, `docs/architecture/architecture.html`, `apps/mobile/tests-deno/sourceManifest.generated.ts`, lockfiles.
- In docs-only pull requests, review only for statements that contradict the code or another doc. Do not copy-edit.
