/**
 * useStocksList: the Stocks tab's list. Pages of `get_league_available_stocks` (members only, 25 a page, paced,
 * no price in the answer), driven by the pure reducer in stocksList.ts: ONE request in flight, an answer for a list
 * the manager has already left is dropped by its id. Every read is error-checked: supabase-js `.rpc()` resolves
 * `{ data, error }` and does not throw (CLAUDE.md, success signals #5), so a refusal (42501), a paced PT429 or a
 * dropped connection is a load failure in the existing words, never "no stocks".
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { seamRpc } from '../game/seamCalls';
import { initialListState, isFailedRead, listReducer, pageArgs, parsePage, type ListState } from './stocksList';

export interface StocksList {
  state: ListState;
  /** The next page (a no-op while one is in flight, or when the server said no more follow). */
  loadMore: () => void;
  /** Pull to refresh: the first page again; resolves when it has settled. */
  refresh: () => Promise<void>;
  /** A chip: a new list for that category (null: All). */
  selectCategory: (categoryId: string | null) => void;
  /** The failed page again, and only that page. */
  retry: () => void;
}

export function useStocksList(leagueId: string | null): StocksList {
  const [state, dispatch] = useReducer(listReducer, undefined, () => initialListState());
  const leagueRef = useRef(leagueId);
  leagueRef.current = leagueId;
  const settleRef = useRef<(() => void) | null>(null);

  // Another league is a different list: start over from its first page.
  const lastLeague = useRef(leagueId);
  useEffect(() => {
    if (lastLeague.current === leagueId) return;
    lastLeague.current = leagueId;
    dispatch({ type: 'start', categoryId: null });
  }, [leagueId]);

  const pendingId = state.pending?.id ?? null;
  const pendingAfter = state.pending?.after ?? null;
  const categoryId = state.categoryId;

  useEffect(() => {
    if (pendingId == null || !leagueId) return;
    let cancelled = false;
    void (async () => {
      let result: { data: unknown; error: unknown };
      try {
        result = await seamRpc('get_league_available_stocks', pageArgs(leagueId, categoryId, pendingAfter));
      } catch (e) {
        result = { data: null, error: e };
      }
      if (cancelled) return;
      const page = isFailedRead(result) ? null : parsePage(result.data);
      if (page) dispatch({ type: 'loaded', id: pendingId, page });
      else dispatch({ type: 'failed', id: pendingId });
      settleRef.current?.();
      settleRef.current = null;
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingId, pendingAfter, categoryId, leagueId]);

  const loadMore = useCallback(() => dispatch({ type: 'more' }), []);
  const retry = useCallback(() => dispatch({ type: 'retry' }), []);
  const selectCategory = useCallback((id: string | null) => dispatch({ type: 'start', categoryId: id }), []);
  const refresh = useCallback(
    () =>
      new Promise<void>((resolve) => {
        settleRef.current = resolve;
        dispatch({ type: 'refresh' });
      }),
    [],
  );

  return { state, loadMore, refresh, selectCategory, retry };
}
