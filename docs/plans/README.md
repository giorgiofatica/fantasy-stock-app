# Plans

Before a new feature or big project is built, Giorgio and the **Planner** settle it here.
The **Orchestrator** then builds it from the plan. This folder holds those plans.

## Who does what

| Role | Session | Does | Doesn't |
|---|---|---|---|
| **Giorgio** | — | Decides every product rule; approves the plan; runs every prod step | — |
| **Planner** | "Planner" (Fable 5.1, Opus for security-heavy plans) | Talks it through with Giorgio; reads the code and docs; asks for mockups; writes the plan here; hands it to the Orchestrator | Write app code, start workers, push, open PRs, touch prod |
| **Orchestrator** | "Orchestrator" | Turns an approved plan into workers; verifies, opens PRs, walks Giorgio through releases | Make product decisions; change an approved plan's rules without Giorgio |
| **Design Lead** | "Design Lead" | Draws the "Your call" mockups and design specs on the board | — |
| **Researcher** | "Researcher" (Sonnet; Opus for legal, policy, App Store review, security or money-rules reading) | Takes research tasks from Giorgio (and from the Planner or Orchestrator when a plan needs facts); writes one findings file per task in [`../research/`](../research/); reports `RESEARCH READY` to the Planner and the Orchestrator | Decide product or write to `PRODUCT_RULES.md`; write app code, migrations or functions; start workers; push, open PRs, merge; touch prod; paste repo code, keys, user data or Giorgio's details into outside services |
| **Recorder** | "Recorder" (Sonnet) | Keeps the written record current: the single writer of [`../STATUS.md`](../STATUS.md), [`../PROGRESS.md`](../PROGRESS.md), the docs index and folder READMEs, plan Status lines, and the phone-pass checklist mirror | Decide anything; record "live" without evidence; change a ruling in `PRODUCT_RULES.md`; edit `CLAUDE.md`, `.claude/`, generated files, applied migrations or `history/`; write app code; push, open PRs, merge; touch prod |

Researcher and Recorder were added on 2026-11-10 at Giorgio's request: "I will give it tasks
to research on certain ideas … and then I want it to kind of organize its findings and then
like report back to you and the orchestrator", and "a documentarian or some sort of recorder
agent that … works to record our progress and update any readmes or any documentation that
kind of shows what we've been doing and where we're at." Their standing briefs are
[`../research/README.md`](../research/README.md) and the Recorder section of
[`../README.md`](../README.md).

### Rules every role chat follows

- **Branch, commit, hand back the SHA.** A role chat works on a topic branch, commits there,
  never pushes, and reports the branch and SHA to the Orchestrator, who pushes and opens the
  PR. Giorgio merges.
- **Go home before reporting.** After committing on a topic branch (`plan/<topic>`,
  `research/<topic>`, `docs/record-<date>`), switch the worktree back to its `claude/<name>`
  home branch. The app's auto-archive closes a chat when the PR whose head is the chat's
  checked-out branch closes; that archived the Planner and the Design Lead on 2026-10-22. A
  chat sitting on its home branch is never bound to a merged PR.
- **The boundaries are rules, not locks.** These are full sessions with a shell and the web,
  so nothing here is enforced by missing tools. `.claude/settings.json` asks before every
  push, merge, `db push`, deploy and secret change; the rest is the role keeping to its lane.
- **Models.** Sonnet for specified work (the Recorder; the Researcher by default). Opus for
  security, auth, RLS, partial-state design, Design Lead gates, and Researcher tasks where a
  misread costs a ruling (legal, policy, App Store review, security, money rules). Fable only
  as the Planner, per `CLAUDE.md`.

## The flow

1. **Explore.** Giorgio brings an idea to the Planner. The Planner reads what exists
   (code, [`../STATUS.md`](../STATUS.md), [`../PRODUCT_RULES.md`](../PRODUCT_RULES.md), the
   board) and asks questions until the goal and rules are clear.
2. **Decide.** Every product/design choice goes to Giorgio as side-by-side mockups. The
   Planner writes the brief, the Orchestrator relays it to the Design Lead, and the board
   section comes back. The Planner records each decision in the plan AND in
   `PRODUCT_RULES.md`, quoting Giorgio verbatim.
3. **Write the plan** as `docs/plans/YYYY-MM-DD-<topic>.md` from the template below.
   Commit it on a branch `plan/<topic>`. No pushing; the Orchestrator pushes docs.
4. **Hand off.** When Giorgio approves, the Planner messages the Orchestrator:
   `PLAN READY: docs/plans/<file> @ <sha> (approved by Giorgio on <date>)`.
5. **Build.** The Orchestrator splits the plan into workers, verifies their work, opens
   PRs and runs the releases with Giorgio. A product question that comes up mid-build
   goes to Giorgio directly; the Planner updates the plan and `PRODUCT_RULES.md`.
6. **Close.** When it ships, the Orchestrator marks the plan's status `Shipped` with the
   PRs, and `STATUS.md` records what's live.

Small fixes and bugs don't need a plan; they go straight to the Orchestrator.

## Plan template

```markdown
# <Title>

Status: Draft | Approved (Giorgio, YYYY-MM-DD) | Building | Shipped (PRs …)
Planner session: … · Orchestrator hand-off: <sha>

## Goal
One paragraph: what changes for players, and why now.

## Giorgio's rules
Verbatim quotes, dated. Each one also goes in docs/PRODUCT_RULES.md.

## Decisions
| # | Question | Decision | Board section / date |
|---|---|---|---|

## Open questions
Anything not yet decided. A plan isn't Approved while this has blocking items.

## Scope
In: …
Out (and why): …

## How it works
The behaviour, step by step, from the player's side, then the system's (server rules,
data, notifications, timing). Name existing code it builds on.

## Risks and edge cases
Security, partial state, concurrency, time zones, migrations of existing data,
interactions with live features.

## Done means
Testable acceptance criteria, including what Giorgio checks by hand.

## Suggested workstreams
How the Orchestrator might split it (backend / mobile / design), with dependencies.
The Orchestrator decides the final split.

## Models
Which model runs each role and workstream, and why (Giorgio, 2026-10-06: no higher-usage
model on work a cheaper one can do). Standing rule: plan on Opus, implement on the cheapest
tier that fits, the Orchestrator reviews as the backstop. Tiers: Haiku for recon and
docs-only or mechanical work; Sonnet for well-specified implementation after an approved
plan and for checklist reviewers; Opus for judgement (design gates, audits), security, RLS,
grants and partial-state logic, and the Orchestrator's own reviews; Fable only for the
Planner's long-horizon product/UX planning.
```
