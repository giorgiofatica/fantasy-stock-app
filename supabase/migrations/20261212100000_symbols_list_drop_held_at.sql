-- symbols.list_drop_held_at and symbols.list_dropped_at: the two times
-- enrich-symbols' mass-drop guard keeps (2026-11-24).
--
-- docs/plans/2026-11-23-claims-fix-themselves.md, fix 3, and "Settled during
-- the build" point 1. When one enrich-symbols run would take more than a small
-- share of its stocks off the list (is_draftable true -> false), it applies
-- none of those drops. Each such stock is HELD: its enriched_at cursor moves
-- on and list_drop_held_at is set, and nothing else is written (size, price,
-- industry, is_draftable stay as they were). On a later turn, fresh numbers
-- that pass clear the mark (it was our data); numbers that still fail drop it
-- once the mark is 24 h old. At most 20 stocks leave the list in any 24 hours.
-- Rules: supabase/functions/enrich-symbols/plan.ts.
--
--   list_drop_held_at  when the stock was FIRST held; NULL = not held. Set on
--                      the first hold, NEVER refreshed by a later hold (a
--                      refreshed mark let held groups keep each other held
--                      for ever), cleared when the stock is cleared or dropped.
--   list_dropped_at    when the stock LAST left the list (a drop applied).
--                      NEVER cleared, also not when the stock comes back: the
--                      daily budget counts every departure in the past 24 h,
--                      whatever the stock's state now. Its own column, not the
--                      held mark doing two jobs.
--
-- Why a column and not "no write at all": enrich-symbols picks the stalest
-- enriched_at first, so a stock it never writes would be in every later run
-- and the held set could only grow until the refresh stopped for every stock.
--
-- Both nullable, no default: every existing row starts not held and not dropped.
--
-- WRITER: enrich-symbols only (service role). READERS: enrich-symbols only.
--   * No client reads it. authenticated reads symbols through a column ALLOW
--     list (20261206000000: symbol, name, is_draftable), so a new column is
--     unreadable by clients without a grant, and this migration grants none.
--   * Neither is in symbols_touch_updated_at's WHEN list (20260811000007),
--     like enriched_at and last_price_at: they are bookkeeping, and a hold
--     must not look like a change to the stock.
--
-- Each column gets a partial index over its non-NULL rows. list_dropped_at's
-- serves the one extra read per run (how many stocks left in the past 24 h:
-- .gt('list_dropped_at', cutoff), an exact count); list_drop_held_at's keeps
-- "which stocks are held" cheap for the checks and for workstream 2.
--
-- ORDER: push this BEFORE deploying the enrich-symbols build that reads it
-- (the build selects and writes these columns; on a database without them
-- every run fails at its first read and writes nothing).
-- POST-PUSH CHECKS: docs/security/2026-11-24-symbols-list-drop-held-at-checks.sql

alter table public.symbols
  add column if not exists list_drop_held_at timestamptz;

alter table public.symbols
  add column if not exists list_dropped_at timestamptz;

comment on column public.symbols.list_drop_held_at is
  'When enrich-symbols FIRST held this stock off a drop from the list (NULL = not held); never refreshed. Written and read by enrich-symbols only; see supabase/functions/enrich-symbols/plan.ts.';

comment on column public.symbols.list_dropped_at is
  'When enrich-symbols last took this stock off the list; never cleared. Counts toward the 20-a-day drop budget. Written and read by enrich-symbols only; see supabase/functions/enrich-symbols/plan.ts.';

create index if not exists symbols_list_drop_held_at_idx
  on public.symbols (list_drop_held_at)
  where list_drop_held_at is not null;

create index if not exists symbols_list_dropped_at_idx
  on public.symbols (list_dropped_at)
  where list_dropped_at is not null;
