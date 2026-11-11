# Documentation index

Start with **[STATUS.md](STATUS.md)**: what's deployed, what's open, and the critical path.
Repo conventions and hard-won operational rules are in the root [`CLAUDE.md`](../CLAUDE.md).

| Folder / file | What it holds | Kept current? |
|---|---|---|
| [`STATUS.md`](STATUS.md) | Prod ledger, workstream status, open defects, critical path, branches | **Yes — update every session that changes prod** |
| [`PROGRESS.md`](PROGRESS.md) | Dated log of what shipped, what was decided and what is next, newest first. Not the source of truth: every fact also lives in `STATUS.md`, a plan or `PRODUCT_RULES.md` | **Yes: the Recorder, after each landing** |
| [`PRODUCT_RULES.md`](PRODUCT_RULES.md) | **Giorgio's product decisions**, by area, with his words verbatim | **Yes: add each rule the moment it's decided** |
| [`plans/`](plans/) | Plans for new features, written by the Planner with Giorgio before building; the flow, roles and template are in its README | Yes: one file per plan, status kept current |
| [`research/`](research/) | The Researcher's findings, one file per question, sourced and dated; the brief and template are in its README | Point-in-time records; a finding is dated, not kept current |
| [`decisions/`](decisions/) | Accepted decision records (DR-001: in-house simulated trading) | Yes — append new DRs, never rewrite accepted ones |
| [`architecture/`](architecture/) | Generated architecture map (`architecture.json`/`.html` — **never hand-edit**), hand-written `annotations.json`, prod `db-snapshot.json` + its capture SQL, map schema | Regenerate with `node scripts/gen-architecture.mjs`; re-capture the snapshot after grant/RLS/cron changes |
| [`migrations/`](migrations/) | Specs + reports for the Supabase API-key migration (`MIGRATION_PHASE_*`, `MIGRATION_STATUS.md`), RLS hardening (`RLS_HARDENING_SPEC.md`), the simulator migration (`SIMULATOR_MIGRATION_SPEC.md`, `simulator-recon.md`), and staged-not-applied SQL (`STAGED_*.sql`) | Status files yes; phase specs/reports are point-in-time records. Paths are referenced from migration comments — don't rename |
| [`design/`](design/) | UI/UX program charter (`UI-UX-PROGRAM.md` — roles, phases, UI worker contract), mobile UI overhaul spec (`STOCKPILE_UI_OVERHAUL.md`), landing-page spec, brand assets, visual references (`REFERENCES.md`) and their studied DNA (`design.md`; adopt/adapt/skip of Hallmark in `reviews/hallmark-notes.md`) | Yes |
| [`fixes/`](fixes/) | Post-mortems of production incidents | Append-only |
| [`security/`](security/) | Security reviews and runbooks (`REMAINING-SECURITY-WORK.md`, `DEPLOY-RUNBOOK.md`), the SQL effect tests that prove a lockdown, and point-in-time security reads such as the Claude Data connector read (2026-11-10) | Security reads are dated records; effect tests are re-runnable |
| [`testing/`](testing/) | Season simulation harness guide, testing roadmap, and running the mobile app in the iOS Simulator (`MOBILE_SIMULATOR.md`) | Yes |
| [`assets/`](assets/) | Screenshots used by the root README | — |
| [`history/`](history/) | Superseded plans, old session logs, completed handoffs | **No — archive, read for context only** |

## The Recorder

The **Recorder** keeps this folder's record current, so "where are we?" has one written
answer. It is the single writer of [`STATUS.md`](STATUS.md), [`PROGRESS.md`](PROGRESS.md),
this index, the folder READMEs, each plan's Status line, and the repo mirror of the
phone-pass checklist. Roles are in [`plans/README.md`](plans/README.md).

- **What feeds it.** The Orchestrator sends a note for every merge, push, deploy and build;
  the Planner for every ruling and plan hand-off; the Design Lead for every gate verdict. It
  checks each note against `git log` and `gh pr list`, and sweeps `main` for anything nobody
  reported.
- **Evidence, or it says so.** `CLAUDE.md`: verify the effect, not the status. A line that
  says "live" or "deployed" cites its evidence: the Orchestrator's verified-by-query note, or
  the `supabase_migrations.schema_migrations` row. Without that it writes "merged, not
  confirmed live". Merged is not deployed, and a command's own output is not proof.
- **Builds by commit.** A build is recorded as version (build), commit and fingerprint from
  `eas build:list`, never as "the build finished". On 2026-11-10 "build 13" was assumed to
  carry the day's fixes; it was built before they merged, and the right build was 14.
- **Scope of a claim matches its evidence.** "The Friday job ran" is not "scoring works". It
  writes what was checked and what was not.
- **`STATUS.md` is now; `PROGRESS.md` is the diary.** No fact lives only in the diary.
- **What it never does.** Decide anything. Change a ruling in `PRODUCT_RULES.md` (the Planner
  records Giorgio's words the day he says them; the Recorder checks they landed and flags a
  gap). Edit `CLAUDE.md`, `.claude/`, generated files (`architecture.json`, `architecture.html`),
  applied migrations, or `history/`. Write app code. Use the web. Push, open PRs, merge, or
  touch prod: it commits on `docs/record-<date>`, hands the SHA to the Orchestrator, and goes
  back to its home branch.
- **When prod facts need a human.** Some facts only Giorgio can fetch (the `db-snapshot.json`
  refresh after a grant, RLS or cron change). The Recorder prepares the exact ask and records
  the result; it does not run it.

## Tests at a glance

| Suite | Command (repo root) |
|---|---|
| Edge-function pure modules (Deno, hermetic — no DB, no secrets) | `deno test supabase/functions/` |
| Architecture map freshness | `node scripts/gen-architecture.mjs --check` |
| Season simulation against a real project | `npm run test:simulation` — see [`testing/SEASON_SIMULATION_TEST.md`](testing/SEASON_SIMULATION_TEST.md) |
| Mobile app on the iOS Simulator (Expo Go SDK 54) | see [`testing/MOBILE_SIMULATOR.md`](testing/MOBILE_SIMULATOR.md) |
| Mobile lint / types | `cd apps/mobile && npm run lint && npx tsc --noEmit` |
| Web lint | `cd apps/web && npm run lint` |
