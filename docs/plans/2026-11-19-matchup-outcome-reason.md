# Why a week was won: the server records the reason

Status: DRAFT, not approved. The words wait on the board `#call-tiebreak-words`; nothing here is built until Giorgio approves the plan
Planner session: "Planner" (Fable 5.2), 2026-11-19 · Orchestrator hand-off: not yet

## Goal

A finished week names its winner, and under the scoreboard one line says how: "Roberto B.
won by $390.67". That line is true when the winner is the side with more dollars. Three
kinds of week are won another way (a percent tiebreak, a team with no stocks, a playoff
seed tiebreak), and for those the app has nothing true to say, because the server works out
the reason, writes it to its log, and throws it away. After this plan the server keeps the
reason with the result, and the app says it.

## Giorgio's rules

- "Dollars decide." Dollar gain decides every matchup; percent is only the tiebreak
  (`docs/PRODUCT_RULES.md`, "Scoring and standings"). "The UI shows the metric that decides
  the winner, via one shared helper."
- 2026-11-18: "A missing number never shows as zero", and the same day on prices: "we cannot
  be showing incorrect numbers".
- 2026-09-29: a regular-season bye is no result: not a win, not a loss, not a tie.
- The words for the three kinds of week: NOT YET HIS. They come from the board
  `#call-tiebreak-words` (candidates sent to the Design Lead on 2026-11-19).

## What happens today

The server decides a matchup in `decideMatchupOutcome`
(`supabase/functions/process-week-results/playoff-progression.ts`), in this order:

1. A regular-season bye: no result.
2. Both teams hold no stocks: a tie in the regular season; in a playoff the higher seed
   advances.
3. One team holds no stocks: it loses, whatever the dollars.
4. More dollars wins.
5. Equal dollars: the better percent wins.
6. Equal dollars and percent: a tie in the regular season; in a playoff the higher seed
   advances.

It returns a `reason` with ten possible values and each side's percent. The one write of a
result (`process-week-results/index.ts`, the `matchups` update after the log lines) stores
only `team1_gain`, `team2_gain`, `winner_user_id` and `is_tie`. The reason and the percents
are logged and lost.

The phone therefore cannot tell these weeks apart. Equal dollars with a named winner could
be a percent tiebreak, a seed tiebreak, or a team with no stocks facing a team that finished
at exactly $0.00.

**The interim fix (in #566, 2026-11-19).** The scoreboard line compared the two dollar
figures by itself, so a percent-tiebreak week read "Dead even" under a band that named a
winner, and a no-stocks week could name the wrong side as having "won by". Since #566 a
finished week shows the line only when it is provably true (the server's winner is the
dollar leader, or there is no winner and the dollars are equal) and shows no line otherwise.
This plan replaces "no line" with the reason.

## Decisions

| # | Question | Decision | Whose |
|---|---|---|---|
| 1 | Where does the reason come from? | The server stores it with the result. The phone never works it out from the totals, and never recomputes a percent. | Planner, under "we cannot be showing incorrect numbers": a second calculation on the phone can disagree with the scored result |
| 2 | What is stored? | The reason, and each side's percent gain for the week, in the same write as the winner. | Planner |
| 3 | What do weeks scored before this show? | What they show today: the line when it is provably true, otherwise no line. They are marked "not recorded", not guessed. | Planner. The real cases cannot be recovered without re-scoring old weeks |
| 4 | What does the line say for each kind of week? | OPEN: the board `#call-tiebreak-words` | Giorgio |
| 5 | Does the recap row and the All matchups row carry the reason too? | OPEN: the same board (the Design Lead's three facts) | Giorgio |

## Open questions

1. The words (decision 4) and where they appear (decision 5).
2. For the worker to report before building, not for Giorgio unless the answer is yes: can
   two playoff teams have the same seed, or no seed? The server then advances team 2
   (`resolveBySeed`: a missing seed counts as 999, and equal seeds fall to team 2). "Advances
   as the higher seed" would be false for that week. If it can happen, it comes back here.

## Scope

In: three new columns on `matchups`; `process-week-results` writing them; the phone reading
them in one helper and showing the approved words on the finished-week scoreboard, the All
matchups rows and the season recap rows (as the board decides).

Out: any change to who wins. The order above is not touched. No re-scoring of old weeks. The
web app (it is paused and shows no such line). Standings, the bracket and the season result,
which read `winner_user_id` and `is_tie` and keep doing so.

## How it works

### The columns

On `public.matchups`:

- `outcome_reason text`, limited by a CHECK to the server's ten values plus
  `'not_recorded'`.
- `team1_percent_gain numeric`, `team2_percent_gain numeric`.

Three states, each with its own marker, so that an empty value never has to carry a meaning
(CLAUDE.md, "Overloaded NULLs are type tags"):

| The week is | `outcome_reason` | How the phone knows |
|---|---|---|
| Not scored yet | NULL | `team1_gain` is NULL too, as today |
| Scored before this plan | `'not_recorded'` | Written once by the migration, to every row that already has a result |
| Scored after this plan | one of the ten reasons | Written with the winner |

A scored row with a NULL reason should not exist after the release. If the phone meets one
(a week scored by the old function between the migration and the deploy), it treats it as
`'not_recorded'`.

The percents are stored for a side that held stocks and left NULL for a side that held none
(its percent is not a number; storing 0 would be a zero standing in for nothing). The phone
reads them ONLY when the reason is `percent_tiebreak`, and a CHECK guarantees both are
present on such a row. Nothing else may branch on whether a percent is NULL.

`matchups` has no column-level grants (one SELECT policy for league members, no client
writes since `20261002000000`), so league members can read the new columns with no new
grant. The reviewer confirms this against the live table before the push.

### The write

`process-week-results` adds the three values to the one existing update that stores the
winner, so the reason and the winner are written together or not at all. It is the only
writer of a matchup's result (`take_over_team` rewrites user ids on a row and is not
affected). The update's `{ error }` is already checked.

### The phone

- One helper takes a finished matchup row and returns what the line says, keyed on
  `outcome_reason`. The finished-week view, All matchups and the recap rows all call it.
- `dollar_gain` keeps "{winner} won by $X". A true tie keeps "Dead even". `bye_no_result`
  and `playoff_no_opponent` show what they show today.
- `not_recorded` (and a scored row with no reason) keeps #566's rule.
- The other reasons show the approved words. VoiceOver reads the same line.
- Every hook that selects a result adds the columns it needs: `useAllMatchups`, the
  finished-week view's read, the recap's read (`useSeasonEnd` or its successor in #566).

### Order of release

A phone build that asks for a column the database does not have gets an error for the whole
list, not an empty line. So: the migration first, then the function, then the build.

## Risks and edge cases

- **A build ahead of the database.** Covered by the order above; the build that carries
  this is cut only after the migration is confirmed applied (`schema_migrations`, then a
  read of the three columns).
- **A week scored between the migration and the function deploy.** Result written, reason
  NULL. Shown as `not_recorded`. Deploying the function the same day, before Friday's 21:15Z
  run, avoids it.
- **Old rows.** Production has three old test leagues with finished seasons and no league
  that has finished a draft since (CLAUDE.md). Their rows get `'not_recorded'`.
- **The migration's update touches every scored row.** One statement, a few hundred rows.
- **`atomic` in a migration.** The file must not contain the bare word (CLAUDE.md, the CLI
  splitter); `migration_cli_split.test.ts` checks it.
- **Equal or missing seeds.** Open question 2.
- **Run it back.** A new season's matchups are new rows; nothing carries a reason over.

## Done means

1. PGlite: the migration applies; a scored row gets `'not_recorded'`; an unscored row stays
   NULL; the CHECK refuses an unknown reason and a `percent_tiebreak` row without both
   percents.
2. The handler test drives `process-week-results` through each of the ten reasons and
   asserts the update carries that reason and the right percents (NULL for a side with no
   stocks), in the same call as the winner.
3. Phone tests: one per reason for the helper; `not_recorded` keeps #566's behaviour; no
   code path prints a percent it computed itself.
4. The architecture map is regenerated.
5. The Design Lead's gate on the three screens, at Large and at the largest text size.
6. After the release, checked by data and not by the job's status: the first scored week's
   rows carry a reason other than NULL and `'not_recorded'`.

## Giorgio's steps (when it is built)

1. Merge the PR.
2. `supabase db push` from the deploy checkout, then confirm the columns exist.
3. Deploy `process-week-results`, then byte-verify it.
4. Only then, the build that shows the words.

## Suggested workstreams

1. Server: the migration and the write (one worker; the supabase reviewer before the push).
2. Phone: the helper and the three screens, once the words are approved (one worker; the
   Design Lead gates).

## Models

Opus for the server workstream (scoring, a partial-state marker). Sonnet for the phone
workstream once the words and the board are fixed.
