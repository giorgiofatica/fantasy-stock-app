# Independent review and CI for pull requests

**Status (2026-11-17):** Stage 1 is built (this file, `.github/workflows/ci.yml`, the Copilot instruction files). Stage 2 is a design only; nothing in it is switched on.

Why this exists: the code is written by Claude Code, and until now the same agent family was also the only reviewer. Two independent checks now run on every pull request before Giorgio merges it:

- **GitHub Actions** runs the repo's own tests and checks. This is the objective part: it passes or fails.
- **GitHub Copilot** reads the diff and comments. This is a second opinion: it never passes or fails anything.

Neither proves a change is right. They catch what the author missed.

## What runs on every pull request

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). It runs on every pull request into `main` and again on `main` after a merge. Three jobs run side by side, then one gate.

| Job | What it runs | Same command locally |
|---|---|---|
| **Backend** | Edge-function tests and the PGlite suites that run the real migrations | `deno test --frozen --allow-read --allow-env supabase/` |
| | The architecture map matches the code | `node scripts/gen-architecture.mjs --check` |
| | Edge functions type-check, no new errors | `node scripts/ci-ratchet.mjs edge-typecheck` |
| **Mobile** | Lint | `(cd apps/mobile && npm run lint)` |
| | Type-check | `(cd apps/mobile && npx tsc --noEmit)` |
| | Logic, copy and layout tests | `(cd apps/mobile/tests-deno && deno test --frozen --allow-read --allow-env --allow-sys --allow-run .)` |
| **Web** | Lint, no new errors | `node scripts/ci-ratchet.mjs web-lint` |
| | Tests, type-check, build | `npm run test`, `typecheck`, `build` with `--workspace=apps/web` |
| **All checks** | Fails unless every job above succeeded | the one name to require in a branch rule |

The run uses no secrets and never touches production. Every test is hermetic.

### The two "no new errors" checks

Two areas already had errors on `main` when CI was added, so they cannot simply be required to be clean:

- web ESLint: 54 errors;
- `deno check` over every edge function's `index.ts`: 10 errors, all in `process-week-results/index.ts`.

`scripts/ci-ratchet.mjs` counts the errors and compares them with `.github/ci-baselines.json`. It fails when the count goes up. It also fails when the count goes down until the baseline is lowered in the same change, so the number can only shrink. **Never raise a baseline to get a green run.** If the tool itself crashes, that is a failure, never "0 errors".

### What CI does not cover

- The app on a phone: layout, text sizes, navigation, VoiceOver. The phone pass and the Design Lead's gates still do that.
- Anything against the real database or the real market-data supplier: cron behaviour, grants as they are in production, deploys. The checks in `CLAUDE.md` ("verify the effect") still apply after every `db push` and deploy.
- The web app's gated pages. `APP_PAUSED` tree-shakes them out of the build.
- Secrets. GitGuardian and GitHub's own secret scanning already check every push, and the local gitleaks hook checks every commit; CI does not repeat them.
- Vulnerable dependencies. See "Owner settings" below.
- Whether a change follows the product rules. That is review, not CI.

Local trap: Deno writes into the root `node_modules`, and after that the web tests fail with "Invalid Chai property". Delete the root `node_modules` and run `npm ci` before the web tests. CI is not affected; the web job never runs Deno.

## What Copilot reviews, and how to read it

Copilot reads `.github/copilot-instructions.md` for every review, plus `.github/instructions/supabase.instructions.md` for changes under `supabase/` and `.github/instructions/mobile.instructions.md` for changes under `apps/mobile/`. It reads them from the pull request's own branch. Each file is kept under 4,000 characters on purpose: a long instruction file costs more per review and adds noise.

Each comment starts with **Blocking**, **Important** or **Advisory**. Those words are Copilot's opinion of its own finding, not a gate:

| | What it is | What stops a merge |
|---|---|---|
| A red **All checks** | A test, type, lint or build failure | Only a branch rule that requires it (see below). Without the rule it is a red mark and nothing more. |
| A Copilot comment, any label | A second opinion to investigate | Nothing. It is a comment. |
| Giorgio | The merge | Always his. Nothing here merges, approves or pushes. |

A Copilot finding is checked before it is acted on. If it is right, it is fixed and gets a test. If it is wrong, the reply on the thread says why. A finding is never "fixed" by loosening a test.

## Daily use

1. A session opens a pull request, as now.
2. CI and Copilot run by themselves. Both finish in a few minutes.
3. If CI is red or Copilot raised something real, the session that owns the pull request fixes it and pushes. Both run again on the new commit.
4. When **All checks** is green and the open comments are answered, the pull request is ready for Giorgio. He merges.

## Owner settings

These are Giorgio's to change; nothing in the repo can set them.

1. **Require CI before merging (recommended, free on a public repository).** Settings › Rules › Rulesets › New branch ruleset. Target branch `main`. Tick "Require status checks to pass" and add the check named `All checks`. Leave "Require a pull request before merging" approvals at 0, so nothing asks for a second human. Add yourself to the bypass list if you want an emergency way through. Do this only after `All checks` has been seen green on `main`.
2. **Dependency alerts (optional, free, no workflow).** Settings › Advanced Security › turn on Dependency graph and Dependabot alerts. Both are off today, which is why CI has no dependency job: GitHub's dependency review needs the graph.
3. **Copilot review cost.** See the next section before leaving automatic review on for everything.

## Cost

- **GitHub Actions:** standard runners are free for a public repository. This workflow adds no charge.
- **Copilot review:** Copilot Pro includes a monthly credit allowance. The planning brief puts a Balanced review at about $1.50 on average and the allowance at $15; neither figure was verified here. This repo opened 200 pull requests on 14 working days in November, about 14 a day, and two thirds of them changed only docs. With automatic review on for every pull request and every push, the allowance is likely to run out within days. Check Settings › Billing and licensing › Usage after the first day and decide from the real number. The cheapest useful setup is review on code pull requests only: turn automatic review off, and have the session that opens a code pull request ask for it (`gh pr edit <number> --add-reviewer @copilot`).

## Stage 2: the fix loop (design only, not enabled)

Goal: when CI fails or Copilot raises a real finding, the fix is made and pushed to the same pull request without Giorgio carrying the message. It stops after two tries and never merges.

### Option A (recommended first): the desktop app's own pull-request monitor

The Claude desktop app can watch the pull request a session opened and wake that session on a CI failure, a merge conflict or a review comment ("Auto-fix"). The session that wrote the change fixes it and pushes.

- **New accounts, secrets, bills:** none. It runs under the existing Claude plan, on Giorgio's Mac, with the GitHub sign-in already there.
- **Triggers CI and Copilot again:** yes, the push is an ordinary push from his account.
- **Permissions:** unchanged. No workflow gets write access.
- **Limits:** the Mac must be awake with the app open. The switch is per pull request and the app asks him to approve turning it on. The two-try limit is an instruction to the session, not a hard stop built into GitHub.
- **Rules the session follows:** act only on a finding for the current commit; check a Copilot finding against the code before changing anything; never loosen a test or raise a baseline; never edit `.github/`, migrations already applied, or `.claude/`; after two failed tries, or on anything touching security, data or a migration, stop and write a summary for Giorgio.

### Option B: a hosted fixer in GitHub Actions

`anthropics/claude-code-action`, started by a second workflow when CI fails or Copilot submits a review.

- **Sign-in to Claude, his choice:** an Anthropic API key (billed per use) or a Claude subscription token made with `claude setup-token` (uses the plan's allowance). Either is a new repository secret.
- **Pushing:** the default workflow token cannot start another workflow run, so a fix pushed with it would never be re-checked. The action's own GitHub App (or a small app of his own) is needed, with write access to contents and pull requests. That app cannot edit workflow files.
- **Guards:** runs only for pull requests from this repository opened by the owner, never from a fork (the repo is public, so a stranger's pull request and its comments are untrusted text); one run per pull request at a time; two attempts, counted by a label; a time limit per run; a status comment on every stop.
- **Cost:** Actions minutes are free here. Each attempt costs one Claude run plus one more Copilot review of the new push. With a two-try limit that is up to three Copilot reviews per pull request.
- **Risk it adds:** a credential with write access living in GitHub, and an agent acting on text that Copilot or a diff supplies.

### Recommendation

Pilot Option A on one code pull request. It adds nothing new to secure or pay for, and it keeps the fixer in the same place as the context. Move to Option B only if fixes need to happen while the Mac is off.

### Decisions for Giorgio before anything is switched on

1. Option A, Option B, or stay with Stage 1.
2. For B only: API key or subscription token, and the official app or his own.
3. Whether Copilot reviews every push during a fix loop or only the last one (cost).
4. The stop conditions: two tries, and which kinds of change always go to him.

### Pilot (either option)

One code pull request with a known, harmless failing test. Expect: the fixer is woken once, pushes one fix, CI goes green, Copilot reviews the new commit, a summary lands on the pull request, nothing merges. Then a second pull request where the right answer is to stop and ask, to see that it does.
