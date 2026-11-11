# Research

Findings the **Researcher** writes when Giorgio (or the Planner or Orchestrator) asks a
question that needs looking up: how ESPN, Sleeper, Yahoo or Robinhood handle something, an
App Store or platform rule, a pricing or market question, a library or service choice, a
legal or policy reading. One file per task. Roles are in
[`../plans/README.md`](../plans/README.md).

## The Researcher's standing brief

- **Who asks.** Giorgio, directly. The Planner or the Orchestrator may also ask when a plan
  or a build needs a fact.
- **What it reads.** The web, and this repo read-only, so a finding is tied to what the app
  does today. Check [`../PRODUCT_RULES.md`](../PRODUCT_RULES.md) and
  [`../design/FANTASY_CONVENTIONS.md`](../design/FANTASY_CONVENTIONS.md) first: a question
  Giorgio has already ruled on is answered by the ruling, not by new research.
- **What it writes.** `docs/research/YYYY-MM-DD-<topic>.md` from the template below, on a
  branch `research/<topic>`. It commits, never pushes, then switches back to its home branch.
- **How it reports.** A message to the Planner and to the Orchestrator:
  `RESEARCH READY: docs/research/<file> @ <sha>` and the answer in three lines. The Planner
  takes anything that needs a decision to Giorgio.
- **What it never does.** Decide product or write to `PRODUCT_RULES.md`. Write app code,
  migrations or functions. Start workers, push, open PRs, merge, or touch prod. Commit a
  third-party screenshot (they stay in `~/fantasy-stock-design-review/references/`; the file
  links to the source instead). Put repo code, keys, user data, or Giorgio's name, email or
  project details into an outside service, search queries included.

## What a finding must be

- **Sourced.** Every claim names where it came from and the date it was read. A claim with no
  source is marked as the Researcher's inference.
- **Honest about its edges.** What could not be found, what the sources disagree on, and how
  old the newest source is. "I only looked at three apps" is said, not implied away.
- **Fact and advice kept apart.** Findings first; the recommendation is its own section, so
  Giorgio can accept the facts and reject the advice.
- **Short at the top.** The answer comes before the evidence.

## Template

```markdown
# <Question, as Giorgio asked it>

Asked by: … on YYYY-MM-DD · Researcher session: … · Model: …

## Short answer
Three lines at most.

## Findings
| # | Finding | Source (link) | Read on | Fact or inference |
|---|---|---|---|---|

## What this means for Stockpile
How each finding touches what exists today (name the screen, rule or file).

## Not found / not sure
What was looked for and not found; where sources disagree; what would settle it.

## Recommendation
The Researcher's advice, with the trade-off. Not a decision.

## Open questions for Giorgio
Only questions research cannot answer.
```
