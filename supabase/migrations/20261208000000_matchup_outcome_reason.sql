-- ============================================================================
-- matchups: the server records WHY a week was won, with the result
-- ============================================================================
-- Plan: docs/plans/2026-11-19-matchup-outcome-reason.md (approved by Giorgio,
-- 2026-11-20). Workstream 1, server.
--
-- process-week-results decides every matchup in decideMatchupOutcome
-- (supabase/functions/process-week-results/playoff-progression.ts) and gets back
-- a reason and each side's percent. Until now it logged both and stored only the
-- dollars, the winner and is_tie, so the phone could not tell a percent
-- tiebreak, a seed tiebreak and a no-stocks loss apart. Three new columns keep
-- them, written by the SAME update that writes the winner.
--
-- THREE STATES, EACH WITH ITS OWN MARKER (CLAUDE.md, "Overloaded NULLs are type
-- tags"):
--   not scored yet            outcome_reason NULL   (team1_gain is NULL too)
--   scored before this file   'not_recorded'        (the backfill below)
--   scored after the deploy   one of the eleven reasons, written with the winner
-- 'not_recorded' is an explicit marker, never a NULL: a NULL reason on a scored
-- row would mean two different things.
--
-- THE REASONS: the ten decideMatchupOutcome returns (OutcomeReason), plus
--   'playoff_seed_unresolved': the function stores a seed reason only when both
--      seeds were present and different. Otherwise who advances is unchanged
--      and this is stored instead, so "advances as the higher seed" is never
--      said about a comparison that did not happen (the plan, "The seed line
--      cannot lie");
--   'not_recorded': scored before the reason was kept.
-- The list is mirrored by RECORDED_OUTCOME_REASONS in
-- supabase/functions/process-week-results/outcome-record.ts, and
-- supabase/tests/matchup_outcome_reason.pglite.test.ts checks the two agree.
--
-- THE PERCENTS: each side's percent gain for the week, as the scorer computed
-- it. NULL for a side that held no stocks (its percent is not a number; storing
-- 0 would be a zero standing in for nothing) and for the missing side of a bye.
-- The phone reads them ONLY on a 'percent_tiebreak' row, and the CHECK below
-- guarantees both are there on such a row. Nothing may branch on a percent
-- being NULL.
--
-- NO SEED CHECK. The plan leaves "both seeds present and different on a
-- playoff row with both teams" to the reviewer, NOT VALID. It is not added: a
-- NOT VALID check still applies to every later UPDATE of an old row, and the
-- scoring write is an UPDATE. A playoff row carrying a bad seed (rows advanced
-- before 2026-07-27 could carry the loser's) would then refuse its own result
-- forever, and an unscored final never completes the season. The function's
-- 'playoff_seed_unresolved' covers the words instead, without blocking a write.
--
-- GRANTS: none needed, none changed. matchups has no column-level grants; the
-- one SELECT policy (matchups_select_members, is_member(league_id), for
-- authenticated) covers every column, the new ones included. No client writes
-- matchups since 20261002000000; the only writer of a result is
-- process-week-results, as service role.
--
-- The backfill is one UPDATE over every scored row (a few hundred in prod).
-- ============================================================================

alter table public.matchups
  add column if not exists outcome_reason text,
  add column if not exists team1_percent_gain numeric,
  add column if not exists team2_percent_gain numeric;

-- Re-runnable: a push that died after the columns landed re-adds cleanly.
alter table public.matchups drop constraint if exists matchups_outcome_reason_valid;
alter table public.matchups
  add constraint matchups_outcome_reason_valid check (
    outcome_reason is null or outcome_reason in (
      'bye_no_result',
      'both_empty_tie',
      'both_empty_playoff_seed_tiebreak',
      'playoff_no_opponent',
      'team1_empty_auto_loss',
      'team2_empty_auto_loss',
      'dollar_gain',
      'percent_tiebreak',
      'playoff_seed_tiebreak',
      'regular_season_true_tie',
      'playoff_seed_unresolved',
      'not_recorded'
    )
  );

alter table public.matchups drop constraint if exists matchups_percent_tiebreak_has_percents;
alter table public.matchups
  add constraint matchups_percent_tiebreak_has_percents check (
    outcome_reason is distinct from 'percent_tiebreak'
    or (team1_percent_gain is not null and team2_percent_gain is not null)
  );

-- Every row that already has a result: scored before the reason was kept.
update public.matchups
   set outcome_reason = 'not_recorded'
 where team1_gain is not null
   and outcome_reason is null;

comment on column public.matchups.outcome_reason is
  'Why the result came out as it did, written with winner_user_id by process-week-results. '
  'NULL = not scored yet. not_recorded = scored before 20261208000000. '
  'playoff_seed_unresolved = a playoff seed tiebreak with a missing or equal seed.';
comment on column public.matchups.team1_percent_gain is
  'Team 1 percent gain for the week. NULL when team 1 held no stocks. Read only when outcome_reason = percent_tiebreak.';
comment on column public.matchups.team2_percent_gain is
  'Team 2 percent gain for the week. NULL when team 2 held no stocks, or on a bye. Read only when outcome_reason = percent_tiebreak.';
