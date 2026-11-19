/**
 * useStocksList: the Stocks tab's list. Pages of `get_league_available_stocks` (members only, 25 a page, paced,
 * no price in the answer), driven by the pure reducer in stocksList.ts: ONE request in flight, an answer for a list
 * the manager has already left is dropped by its id. Every read is error-checked: supabase-js `.rpc()` resolves
 * `{ data, error }` and does not throw (CLAUDE.md, success signals #5), so a refusal (42501), a paced PT429 or a
 * dropped connection is a load failure in the existing words, never "no stocks".
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { seamRpc } from '../game/seamCalls';
import { subscribePortfolioLedgerInvalidation } from '../money/usePortfolioLedger';
import { fetchKey, initialListState, invalidationAction, isFailedRead, listReducer, pageArgs, parsePage, pendingRead, type ListState } from './stocksList';

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
  const [state, dispatch] = useReducer(listReducer, leagueId, (l) => initialListState(null, l));
  const stateRef = useRef(state);
  stateRef.current = state;
  const settleRef = useRef<(() => void) | null>(null);

  // Another league is a different list: start over from its first page, for THAT league (the request carries it).
  const lastLeague = useRef(leagueId);
  useEffect(() => {
    if (lastLeague.current === leagueId) return;
    lastLeague.current = leagueId;
    dispatch({ type: 'start', categoryId: null, leagueId });
  }, [leagueId]);

  // A trade (a fill, or a refusal that corrects our picture) invalidates its league's ledger: the same signal Portfolio and the sheet
  // reload on. This list re-reads its first page for ITS league (the pull-to-refresh path: rows stay until the answer lands), so a
  // bought stock leaves the list and a sold one reappears. Another league's trade does nothing.
  useEffect(() => {
    return subscribePortfolioLedgerInvalidation((invalidated) => {
      const action = invalidationAction(stateRef.current, invalidated);
      if (action) dispatch(action);
    });
  }, []);

  // The fetch is keyed on the in-flight request's id ALONE (fetchKey) and reads that request's own league, category and cursor
  // (pendingRead). It does not depend on the league prop: a league switch mid-load changes the prop BEFORE the new 'start' lands,
  // and re-running on it would send the old cursor to the new league (a wasted read that burns the member's paced counter).
  const pendingId = fetchKey(state);

  useEffect(() => {
    const read = pendingRead(stateRef.current);
    if (pendingId == null || !read || read.id !== pendingId) return;
    let cancelled = false;
    void (async () => {
      let result: { data: unknown; error: unknown };
      try {
        result = await seamRpc('get_league_available_stocks', pageArgs(read.leagueId, read.categoryId, read.after));
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
  }, [pendingId]);

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
