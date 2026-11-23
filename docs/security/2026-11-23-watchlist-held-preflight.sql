-- PREFLIGHT for 20261210500000_watchlist_held_leaves.sql (a stock you own is never on your
-- watchlist). Run in the Supabase SQL editor BEFORE `supabase db push`. READ-ONLY: two
-- SELECTs, nothing written.
--
-- The migration's step 6 deletes every watchlist row whose manager currently HOLDS that stock
-- in that league. This counts those rows first, so the push deletes exactly what was counted.
--
-- "Holds" is the Stocks list's rule (20261207000100), written inline here because the
-- migration's league_held_positions() does not exist yet: per manager and per stock, draft
-- quantity + buys - sells > 1e-9; SKIP picks ignored; symbols upper-cased; drafts.user_id is
-- text and trades.user_id is uuid, hence the casts (CLAUDE.md). A stock bought and fully sold
-- is NOT held, so its saved row is kept.
-- supabase/tests/watchlist_held_leaves.pglite.test.ts runs this file before and after the
-- migration and checks both statements against the rows the migration actually deletes.

-- 1. The count. EXPECT a small number (the table is one day old); it is the number of rows the
--    push will delete. After the push, the same statement must answer 0.
WITH held AS (
  SELECT h.league_id, h.uid, h.sym
    FROM (
      SELECT d.league_id, upper(d.symbol) AS sym, d.user_id::text AS uid, coalesce(d.quantity, 0)::numeric AS q
        FROM public.drafts d
       WHERE d.symbol IS NOT NULL AND upper(d.symbol) <> 'SKIP'
      UNION ALL
      SELECT t.league_id, upper(t.symbol), t.user_id::text,
             CASE WHEN t.action = 'sell' THEN -coalesce(t.quantity, 0)::numeric
                  ELSE coalesce(t.quantity, 0)::numeric END
        FROM public.trades t
       WHERE t.symbol IS NOT NULL
    ) h
   GROUP BY h.league_id, h.sym, h.uid
  HAVING sum(h.q) > 0.000000001
)
SELECT count(*) AS saved_and_held
  FROM public.watchlist w
  JOIN held ON held.league_id = w.league_id AND held.uid = w.user_id AND held.sym = w.symbol;

-- 2. The rows themselves (league, manager, stock, when saved), for the record. EXPECT as many
--    rows as statement 1 counted.
WITH held AS (
  SELECT h.league_id, h.uid, h.sym
    FROM (
      SELECT d.league_id, upper(d.symbol) AS sym, d.user_id::text AS uid, coalesce(d.quantity, 0)::numeric AS q
        FROM public.drafts d
       WHERE d.symbol IS NOT NULL AND upper(d.symbol) <> 'SKIP'
      UNION ALL
      SELECT t.league_id, upper(t.symbol), t.user_id::text,
             CASE WHEN t.action = 'sell' THEN -coalesce(t.quantity, 0)::numeric
                  ELSE coalesce(t.quantity, 0)::numeric END
        FROM public.trades t
       WHERE t.symbol IS NOT NULL
    ) h
   GROUP BY h.league_id, h.sym, h.uid
  HAVING sum(h.q) > 0.000000001
)
SELECT w.league_id, w.user_id, w.symbol, w.created_at
  FROM public.watchlist w
  JOIN held ON held.league_id = w.league_id AND held.uid = w.user_id AND held.sym = w.symbol
 ORDER BY w.league_id, w.user_id, w.symbol;
