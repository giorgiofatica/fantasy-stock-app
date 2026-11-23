-- PREFLIGHT for 20261210500000_watchlist_held_leaves.sql (a stock you own is never on your
-- watchlist). Run in the Supabase SQL editor BEFORE `supabase db push`. READ-ONLY: three
-- SELECTs, nothing written.
--
-- The migration's step 6 deletes every watchlist row that is
--   HELD:  its manager currently holds that stock in that league, or
--   STALE: its manager has a pick or a trade of that stock in that league recorded strictly
--          after the row was saved (picked, bought or sold since; under A it left then).
-- This counts those rows first, so the push deletes exactly what was counted.
--
-- Both rules are written inline here because the migration's functions do not exist yet.
-- "Holds" is the Stocks list's rule (20261207000100): per manager and per stock, draft
-- quantity + buys - sells > 1e-9; SKIP picks ignored; symbols upper-cased; drafts.user_id is
-- text and trades.user_id is uuid, hence the casts (CLAUDE.md). "Stale" uses
-- drafts.recorded_at and trades.created_at against watchlist.created_at.
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
SELECT count(*) AS saved_and_held_or_stale
  FROM public.watchlist w
 WHERE EXISTS (SELECT 1 FROM held
                WHERE held.league_id = w.league_id AND held.uid = w.user_id AND held.sym = w.symbol)
    OR EXISTS (SELECT 1 FROM public.drafts d
                WHERE d.league_id = w.league_id AND d.user_id::text = w.user_id
                  AND d.symbol IS NOT NULL AND upper(d.symbol) = w.symbol AND upper(d.symbol) <> 'SKIP'
                  AND d.recorded_at > w.created_at)
    OR EXISTS (SELECT 1 FROM public.trades t
                WHERE t.league_id = w.league_id AND t.user_id::text = w.user_id
                  AND upper(t.symbol) = w.symbol AND t.created_at > w.created_at);

-- 2. The rows themselves (league, manager, stock, when saved, and why), for the record.
--    EXPECT as many rows as statement 1 counted.
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
),
flagged AS (
  SELECT w.league_id, w.user_id, w.symbol, w.created_at,
         EXISTS (SELECT 1 FROM held
                  WHERE held.league_id = w.league_id AND held.uid = w.user_id AND held.sym = w.symbol) AS held,
         (EXISTS (SELECT 1 FROM public.drafts d
                   WHERE d.league_id = w.league_id AND d.user_id::text = w.user_id
                     AND d.symbol IS NOT NULL AND upper(d.symbol) = w.symbol AND upper(d.symbol) <> 'SKIP'
                     AND d.recorded_at > w.created_at)
          OR EXISTS (SELECT 1 FROM public.trades t
                      WHERE t.league_id = w.league_id AND t.user_id::text = w.user_id
                        AND upper(t.symbol) = w.symbol AND t.created_at > w.created_at)) AS stale
    FROM public.watchlist w
)
SELECT league_id, user_id, symbol, created_at, held, stale
  FROM flagged
 WHERE held OR stale
 ORDER BY league_id, user_id, symbol;

-- 3. The clocks the STALE rule trusts (security review). A pick or trade dated in the future
--    would mark every save of that stock by that manager as stale, and step 6 would delete it.
--    EXPECT future_trades 0 and future_picks 0. If either is not 0, stop and report before the
--    push.
SELECT (SELECT count(*) FROM public.trades WHERE created_at > now()) AS future_trades,
       (SELECT count(*) FROM public.drafts WHERE recorded_at > now()) AS future_picks,
       (SELECT max(created_at) FROM public.trades) AS latest_trade,
       (SELECT max(recorded_at) FROM public.drafts) AS latest_pick;
