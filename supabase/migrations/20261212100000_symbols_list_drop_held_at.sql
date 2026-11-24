-- symbols.list_drop_held_at: when enrich-symbols last HELD a stock instead of
-- taking it off the list (2026-11-24).
--
-- docs/plans/2026-11-23-claims-fix-themselves.md, fix 3, and "Settled during
-- the build" point 1. When one enrich-symbols run would take more than a small
-- share of its stocks off the list (is_draftable true -> false), it applies
-- none of those drops. Each such stock is HELD: its enriched_at cursor moves
-- on and this column is set to now, and nothing else is written (size, price,
-- industry, is_draftable stay as they were). On the stock's next turn its fresh
-- numbers either clear the mark (it was our data) or, after a quiet 24 hours
-- with no other hold, drop it and clear the mark. Rules:
-- supabase/functions/enrich-symbols/plan.ts.
--
-- Why a column and not "no write at all": enrich-symbols picks the stalest
-- enriched_at first, so a stock it never writes would be in every later run
-- and the held set could only grow until the refresh stopped for every stock.
--
-- NULL = not held. Nullable, no default: every existing row starts not held.
--
-- WRITER: enrich-symbols only (service role). READERS: enrich-symbols only.
--   * No client reads it. authenticated reads symbols through a column ALLOW
--     list (20261206000000: symbol, name, is_draftable), so a new column is
--     unreadable by clients without a grant, and this migration grants none.
--   * Not in symbols_touch_updated_at's WHEN list (20260811000007), like
--     enriched_at and last_price_at: it is bookkeeping, and a hold must not
--     look like a change to the stock.
--
-- The partial index serves the one extra read per run ("is any stock held in
-- the last 24 h?", .gt('list_drop_held_at', cutoff).limit(1)); it holds only
-- held rows, so it is empty almost always.
--
-- ORDER: push this BEFORE deploying the enrich-symbols build that reads it
-- (the build selects and writes this column; on a database without it every
-- run fails at its first read and writes nothing).
-- POST-PUSH CHECKS: docs/security/2026-11-24-symbols-list-drop-held-at-checks.sql

alter table public.symbols
  add column if not exists list_drop_held_at timestamptz;

comment on column public.symbols.list_drop_held_at is
  'When enrich-symbols last held this stock off a mass drop from the list (NULL = not held). Written and read by enrich-symbols only; see supabase/functions/enrich-symbols/plan.ts.';

create index if not exists symbols_list_drop_held_at_idx
  on public.symbols (list_drop_held_at)
  where list_drop_held_at is not null;
