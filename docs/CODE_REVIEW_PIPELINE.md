# Independent review and CI for pull requests

**Status (2026-11-18):** Stage 1 is built and was verified on pull request #516: `.github/workflows/ci.yml`, the Copilot instruction files, `scripts/request-copilot-review.mjs` and this file. For the fix loop, Giorgio chose Option A (the desktop app's Auto-fix) on 2026-11-17 and it was piloted on #516; what worked and what did not is under "Pilot on #516". Option B (a fixer hosted in GitHub) is not to be enabled.

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
| | The generated source manifest is current (a new screen cannot hide from the tests) | `(cd apps/mobile && node tests-deno/gen-source-manifest.mjs --check)` |
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

## When Copilot reviews

Automatic review is **off** in Giorgio's account (2026-11-17), on purpose. GitHub's automatic review is all or nothing: neither the account setting nor a repository ruleset can skip a docs-only pull request, and two thirds of this repo's pull requests are docs-only.

So the session that opens a pull request asks for the review, with one command:

```bash
node scripts/request-copilot-review.mjs <pr-number>
```

- It requests a review only when the pull request changes something other than docs (`docs/**` and `.md` files) and is not a draft.
- It asks through GitHub's own `requestCopilotCodeReview` call, under Giorgio's GitHub sign-in. No token is stored anywhere.
- **It states the effort in every request: Lite.** `--balanced` asks for a deeper, dearer review, for a change that deserves it (auth, RLS, money, a migration that drops something). The script prints a note when a pull request touches migrations, edge functions or workflows. Nobody has to change an account setting.
- Copilot reviews once. A follow-up push is **not** reviewed by itself. After fixes are pushed, `--again` asks for one more review.
- It refuses a third review on the same pull request. `--owner-asked` lifts that, and is only for a review Giorgio asked for in his own words.
- It reports "requested" only when GitHub's answer contains the request. If GitHub refuses, it gives GitHub's reason, for example that no credit is left this month.

`--status` shows where things stand without asking for anything: each review, the commit it read, **the effort GitHub recorded for it**, and every finding with whether it is resolved, outdated or still open.

Why the effort is stated each time: the account is set to Lite and the repository reports Lite as its effective level (its own setting is empty, so it inherits), yet the second review of #516 on 2026-11-18, asked for without an explicit effort, was recorded by GitHub as Balanced. Either a pull request keeps the effort of its first review or the plain request ignores the setting; GitHub's documentation does not say. A request that names its effort does not depend on the answer.

## Daily use

1. A session opens a pull request, as now, and runs the review command above.
2. CI runs by itself on every push. Copilot reviews once, if the pull request has code in it.
3. If CI is red, the app wakes the Orchestrator, and the fix is pushed (see "The fix loop"). CI runs again.
4. The Orchestrator reads Copilot's review itself when it lands, with `--status`. Do not wait to be woken for it: in the pilot the app did relay the review, but about 11 minutes after it was posted.
5. When **All checks** is green, Copilot's review of the requested commit is in and each of its threads has an answer, the pull request is ready for Giorgio. He merges.

## Owner settings

These are Giorgio's to change; nothing in the repo can set them.

1. **Require CI before merging (recommended, free on a public repository).** Do this once this pull request is merged and `All checks` has been seen green on `main`. Settings › Rules › Rulesets › New ruleset › New branch ruleset. Name it, set Enforcement status to Active, and under Target branches add "Include default branch". Tick "Require status checks to pass", choose "Add checks" and add `All checks`. Leave "Require a pull request before merging" unticked or with 0 approvals, so nothing asks for a second human. Under Bypass list, add "Repository admin" if you want an emergency way through.
2. **Dependency alerts (optional, free, no workflow).** Settings › Advanced Security › turn on Dependency graph and Dependabot alerts. Both are off today, which is why CI has no dependency job.
3. **Copilot (done 2026-11-17):** automatic review off, draft review off, effort Lite; an AI-credits budget of $20 a month with "stop usage when budget limit is reached" on. The repository has no effort setting of its own (Settings › Copilot › Code review); leave it empty.

## Cost

- **GitHub Actions:** standard runners are free for a public repository. This workflow adds no charge. A Copilot review also starts a short Actions run of its own; that is free here too.
- **Copilot:** $10 a month for the plan, which includes $15 of AI credits, plus the $20 budget: about $35 of reviews a month, and it stops there. The risk is running out before the month ends, not overspending.
- **How far $35 goes is not known yet.** The cost of a Lite review on this repo has not been measured. In November the repo opened about 5 code pull requests per working day. One review each is roughly 100 to 140 reviews a month, so the budget covers them only if a Lite review costs about 25 to 35 cents. Read the real figure from Settings › Billing and licensing › Usage after the first few Lite reviews. If it is higher, review only pull requests that touch `supabase/` and `apps/mobile/lib/`, or raise the budget.

## The fix loop (Option A, chosen 2026-11-17)

Goal: when CI fails or a reviewer comments, the fix is made and pushed to the same pull request without Giorgio carrying the message. It stops after two tries and never merges.

### How it works here

The Claude desktop app can watch a pull request and wake a session when CI fails, a merge conflict appears or a review comment arrives ("Auto-fix"). The switch is per session and per pull request.

- **Which session is woken:** the **Orchestrator**. It opens every pull request, and the app binds each one to the Orchestrator's session, not to the worker that wrote the code. The Orchestrator fixes a small thing itself or sends it to the worker that owns the branch.
- **What turning it on means:** the app's own wording is that switching Auto-fix on is a standing go-ahead to fix a CI failure and push to that pull request's branch without asking first. The rules below are narrower than that, and they are this repo's rules, kept by the session, not by the app.
- **Turning it on:** the Orchestrator turns Auto-fix on for a code pull request after opening it. The app may or may not ask Giorgio first, depending on the session's permission mode. It stays off for docs-only pull requests.
- **New accounts, secrets, bills:** none. It runs under the existing Claude plan, on Giorgio's Mac, with the GitHub sign-in already there.
- **The Mac must be awake with the app open.** While it sleeps, nothing is woken and nothing is fixed; the loop picks up when it wakes.
- **Before Giorgio merges:** the app's "archive this session when the pull request closes" switch is on by default and would archive the Orchestrator's session. Turn it off in the pull request bar first.

### The two-try limit

The app has no setting for a number of tries, so it cannot enforce the limit itself. What bounds the loop:

1. **A review-driven loop is bounded by code.** A fix that answers a Copilot finding only leads to another round if Copilot is asked again, and the script refuses a third review.
2. **A CI-driven loop is bounded by a rule.** A session makes at most two automated fix attempts on one pull request. Each attempt is one commit whose message ends with the line `Autofix-Attempt: 1` or `Autofix-Attempt: 2`. Before any automated fix, count them: `git log origin/main..HEAD --grep='^Autofix-Attempt:' --oneline | wc -l`. The count lives on the pull request, so a restart or a summarised session cannot lose it.
3. **At two, the trigger is removed.** The session turns Auto-fix off for that pull request, so the app stops waking it, and writes Giorgio a summary: what failed, what was tried, what is left.

Nothing in GitHub or the app stops a session that ignores the rule in 2. That was weighed and left as it is: the only thing a runaway CI loop can do is push more commits to a branch that Giorgio has not merged, it cannot merge, and it cannot spend Copilot credit. A hard stop would need a second workflow that counts commits and a way for Giorgio to clear it, which is more machinery than the risk is worth.

### Rules for every automated fix

- Act only on a finding about the pull request's current commit. Ignore a comment on a commit that has since been replaced.
- **A wake-up from the app is a backstop, and usually late.** Before acting on one, run `--status` and match the comment ids it relays. A finding shown as resolved has been dealt with: do nothing and do not reply again. A finding shown as outdated points at code that has since changed: check whether the change answered it, then resolve it. Only a finding shown as OPEN is work.
- A CI failure reported for a commit that is no longer the head is stale. Check the head's own run before fixing anything.
- Check a Copilot finding against the code before changing anything. If it is right, fix it and add a test. If it is wrong, reply on the thread saying why, and change nothing.
- Never loosen or delete a test, raise a number in `.github/ci-baselines.json`, add `--no-check`, or skip a check to get a green run.
- Never edit `.github/`, `.claude/`, or a migration that is already applied.
- Go straight to Giorgio, without trying, for anything that touches grants, RLS, secrets, a destructive migration, money or scoring results, and for two findings that contradict each other.
- Never merge, approve, or turn on auto-merge.

### Pilot on #516 (2026-11-17 and 18)

The test case was real: the mobile tests failed type-checking on `main` (three errors in two test files).

| Step | What happened |
|---|---|
| CI catches a real failure | Yes. First push: Backend and Web green, Mobile red on the three errors, **All checks** red. |
| Auto-fix wakes a session | Yes, the Orchestrator, within about 10 seconds of the switch going on. One message carried the failing checks and, with them, two older bot comments that needed nothing. |
| The fix is pushed and CI re-runs by itself | Yes. The fix (types only, no assertion changed) was pushed about 30 seconds later; the next run was green on all four checks. |
| Copilot reviews only when asked | Yes. The two follow-up pushes were not reviewed. The script's request produced one review, on the newest commit. |
| Docs-only pull requests are skipped, repeats refused | Yes, on #511 and #512 (skipped), #513 and #514 (already reviewed), and #516 after its second review (refused). |
| Copilot finds something real | Yes, twice. A stale source manifest could let a new screen pass CI without being declared behind the sign-in guards; CI now checks the manifest. And this script could not see a pending Copilot request; it now reads the timeline. |
| A Copilot suggestion is checked, not just applied | Yes. For the second finding Copilot said to read the REST "requested reviewers" list. That list had been seen empty while the review was pending, so the fix uses the timeline instead. |
| A wrong finding is turned down with evidence | Yes. The Lite review said four backend tests could not pass under CI's permissions. All four ran and passed in that same run (1,459 passed, 0 failed, 0 ignored, no permission errors), so nothing was changed and the thread was answered with the run. |
| New review comments wake the session | **Yes, but late.** One message arrived about 11 minutes after Copilot posted, carrying its summary and both comments together. By then the Orchestrator had read the review itself, pushed the fix and answered both threads. Treat the wake-up as a backstop, not the trigger. |
| Reviews run at Lite | **Yes, once the request names the effort.** The first two reviews were recorded as Balanced, the second after the account had been set to Lite. The third, asked for with the effort stated, was recorded as Lite and says so in its footer. |
| The loop runs unattended overnight | **No.** The Mac slept from about 9 PM to 9:30 AM and nothing moved in between. |

What is enforced by code, and what is a rule a session follows:

| Safeguard | Kept by |
|---|---|
| CI fails on a failing test, type error, new lint error or stale map or manifest | Code (the workflow) |
| A red run blocks the merge | Code, once the ruleset in "Owner settings" is on. Until then, nothing. |
| No more than two Copilot reviews per pull request | Code (the script refuses), unless `--owner-asked` is passed |
| Every review is asked for at a stated effort | Code (the script names it in the request) |
| No overspending | Code (GitHub's budget stop) |
| No more than two automated fixes per pull request | Rule. The count is written into commit messages so it survives a restart, but nothing stops a third. |
| Check a finding before acting; never loosen a test; never touch `.github/` in an automated fix; send security and money changes to Giorgio | Rule |
| Only Giorgio merges | Rule today (no session merges). Auto-merge is off and no workflow can merge. |

### Not chosen: a fixer hosted in GitHub (Option B)

`anthropics/claude-code-action`, started by a workflow when CI fails or a review arrives. It would work with the Mac off, but it needs a Claude sign-in and a push-capable app stored in a public repository, and it adds a Claude run per attempt. Giorgio ruled it out on 2026-11-17. Do not add it without his say-so.
