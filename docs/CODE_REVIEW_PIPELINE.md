# Independent review and CI for pull requests

**Status (2026-11-18):** live. The workflow, the Copilot instruction files and `scripts/request-copilot-review.mjs` are on `main` (#516), and the ruleset `main: require CI` has been active since 2026-11-18: nothing merges into `main` except through a pull request whose **All checks** is green. The fix loop is Option A (the desktop app's Auto-fix), piloted on #516; what worked and what did not is under "Pilot on #516". Option B (a fixer hosted in GitHub) is not to be enabled.

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
| A red **All checks** | A test, type, lint or build failure | The ruleset `main: require CI`. GitHub refuses the merge until the check is green. |
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

1. **Require CI before merging: done 2026-11-18.** Ruleset `main: require CI` (Settings › Rules › Rulesets): active, targets the default branch, empty bypass list, deletions and force pushes blocked, a pull request required with 0 approvals, and the status check `All checks` required. "Require branches to be up to date before merging" is ON (Giorgio, 2026-11-19, after #554 and #555 were each green and broke `main` together: "taking more time to ensure the prs dont have conflicts is worth it"). It was first left off to keep merging fast; it costs time, not money: updating a branch re-runs the free checks and never starts a Copilot review. "Require conversation resolution before merging" is ON too (Giorgio, 2026-11-19, after #545 and #546 merged with an open Copilot thread). The rule applies to Giorgio too; if CI is ever broken for reasons outside the code, he sets the ruleset to Disabled, merges, and sets it back to Active.
   - A pull request opened before the workflow existed has no `All checks` result and reads "blocked". Merge `main` into its branch (no rebase) and push; CI runs and it unblocks.
2. **Dependency alerts (optional, free, no workflow).** Settings › Advanced Security › turn on Dependency graph and Dependabot alerts. Both are off today, which is why CI has no dependency job.
3. **Copilot (done 2026-11-17):** automatic review off, draft review off, effort Lite; an AI-credits budget of $20 a month with "stop usage when budget limit is reached" on. The repository has no effort setting of its own (Settings › Copilot › Code review); leave it empty.

## Cost

- **GitHub Actions:** standard runners are free for a public repository. This workflow adds no charge. A Copilot review also starts a short Actions run of its own; that is free here too.
- **Copilot:** $10 a month for the plan, which includes $15 of AI credits, plus the $20 budget: about $35 of reviews a month, and it stops there. The risk is running out before the month ends, not overspending.
- **Measured so far (Giorgio's billing page, 2026-11-18):** 851 credits for six Balanced reviews, about 142 credits ($1.42) each, if nothing else used credits. One credit is one cent; the monthly ceiling is 3,500 credits. At that price the ceiling buys about 24 reviews, which is why every request now names Lite.
- **Not measured yet: what a Lite review costs.** One Lite review has run (#516, 18:42Z); its cost needs a second billing reading. November's pace is about 112 code pull requests a month (about 38 touching `supabase/`, about 63 touching mobile logic). One review each fits the ceiling only at about 31 credits a review or less. Giorgio's ruling, 2026-11-18: "Don't change our review-selection rules until we have enough real usage data to make an informed decision."

## The fix loop (Option A, chosen 2026-11-17)

Goal: when CI fails or a reviewer comments, the fix is made and pushed to the same pull request without Giorgio carrying the message. It stops after two tries and never merges.

### How it works here

The Claude desktop app can watch a pull request and wake a session when CI fails, a merge conflict appears or a review comment arrives ("Auto-fix"). The switch is per session and per pull request.

- **Which session is woken:** whichever session the app has bound to the pull request, and that is decided by the BRANCH, not by who opened it. The app binds a pull request to the session whose local branch matches its head branch. So a pull request made from a worker's branch is bound to that WORKER, and one made from a branch that lives only in the Orchestrator's checkout (most docs pull requests, and #516) is bound to the Orchestrator. Corrected 2026-11-18: this file first said every pull request binds to the Orchestrator; that was true of the pilot pull request and not in general. On #546 a merge conflict woke nobody the Orchestrator could see, and Giorgio noticed it himself.
- **What turning it on means:** the app's own wording is that switching Auto-fix on is a standing go-ahead to fix a CI failure and push to that pull request's branch without asking first. The rules below are narrower than that, and they are this repo's rules, kept by the session, not by the app.
- **Turning it on:** Auto-fix can only be switched on by the session the pull request is bound to, so the Orchestrator can switch it on only for the pull requests bound to itself. For a worker's pull request it is not available at all: the Orchestrator's attempt is refused, and so is the worker's own attempt to bind the pull request (seen on #557 and #558, 2026-11-19; the app's permission check refuses it). **So worker pull requests get no Auto-fix wake-ups, and the scheduled `pr-watch` below is what covers them.** It stays off for docs-only pull requests and for drafts.
- **The watch that does not depend on any of that: `node scripts/pr-watch.mjs`.** It asks GitHub about EVERY open pull request, whoever opened it and whichever session it is bound to, and lists the ones that need attention: a conflict with `main`, a failed check, or an open Copilot finding. It also says when `main` itself is red: two pull requests can each be green and still break `main` together (#554 and #555, 2026-11-19), because the merge rule does not require a branch to be up to date. A red `main` is fixed before anything else is reported ready. It lists a pull request that is BEHIND `main` too; the Orchestrator merges `main` into it (no rebase) so that Giorgio only ever waits for green, keeping the pull requests he is about to merge up to date first. It only reads. The Orchestrator runs it on a schedule while pull requests are open (and again before telling Giorgio anything is ready), and acts on what it lists: it fixes what is its own, sends the rest to the worker that owns the branch, and counts fix attempts as below. Auto-fix is then a faster wake-up for the pull requests it happens to cover, not the thing the process rests on. Added 2026-11-18 after #546 and #547 sat in conflict until Giorgio noticed: "the whole point is git finds a issue, and tells claude so claude can fix it." A conflict is fixed by merging `main` into the branch by hand, never with GitHub's "Fix with Copilot" (Copilot is the reviewer, not an author, and it spends review credit). `--ignore 279` leaves out #279, the web join draft parked until the App Store link exists.
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
| A red run, or no run, blocks the merge | Code (the ruleset, verified 2026-11-18: six pull requests without a run read "blocked") |
| Nothing reaches `main` without a pull request; no force push, no deleting `main` | Code (the ruleset) |
| No more than two Copilot reviews per pull request | Code (the script refuses), unless `--owner-asked` is passed |
| Every review is asked for at a stated effort | Code (the script names it in the request) |
| No overspending | Code (GitHub's budget stop) |
| No more than two automated fixes per pull request | Rule. The count is written into commit messages so it survives a restart, but nothing stops a third. |
| Check a finding before acting; never loosen a test; never touch `.github/` in an automated fix; send security and money changes to Giorgio | Rule |
| Only Giorgio merges | Rule. No session merges, auto-merge is off on the repository and no workflow can merge, but nothing in GitHub stops a session using his sign-in from merging a green pull request. |

### Not chosen: a fixer hosted in GitHub (Option B)

`anthropics/claude-code-action`, started by a workflow when CI fails or a review arrives. It would work with the Mac off, but it needs a Claude sign-in and a push-capable app stored in a public repository, and it adds a Claude run per attempt. Giorgio ruled it out on 2026-11-17. Do not add it without his say-so.
