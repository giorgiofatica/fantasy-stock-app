/**
 * useWatchlist: the app's one watchlist store (watchlistStore.ts), wired to the two server calls, and the hook the stars read
 * it through. Module-level, so the Stocks tab's rows and the stock sheet's Save share ONE state per league.
 *
 * Both calls go through the capture seam (seamRpc) and BOTH are error-checked: supabase-js `.rpc()` resolves `{ data, error }`
 * and does not throw on a Postgres error (CLAUDE.md, success signals #5). The write's result is read by parseSaveResult; the
 * read answers null (a failed read, never "nothing saved") on an error or on anything that is not a list.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { seamRpc } from '../game/seamCalls';
import { parseWatchlist, setWatchlistArgs, watchlistReadArgs, type LeagueWatch, type SaveResult } from './watchlist';
import { createWatchlistStore } from './watchlistStore';

export const watchlistStore = createWatchlistStore({
  async read(leagueId) {
    const { data, error } = await seamRpc('get_league_watchlist', watchlistReadArgs(leagueId));
    if (error) return null;
    return parseWatchlist(data);
  },
  async write(leagueId, symbol, saved) {
    const { data, error } = await seamRpc('set_watchlist', setWatchlistArgs(leagueId, symbol, saved));
    return { data, error };
  },
});

export interface UseWatchlist {
  watch: LeagueWatch;
  /** The star: the new state at once; resolves with the server's verdict (null = a write for this stock is already in flight). */
  toggle: (symbol: string) => Promise<SaveResult | null>;
  /** The list again (pull to refresh, or a retry after a failed read). */
  reload: () => void;
}

/** The league's watchlist. Reads it once per league (a store that already has it makes no call). */
export function useWatchlist(leagueId: string | null): UseWatchlist {
  const watch = useSyncExternalStore(
    watchlistStore.subscribe,
    () => watchlistStore.peek(leagueId),
    () => watchlistStore.peek(leagueId),
  );
  useEffect(() => {
    if (leagueId) void watchlistStore.load(leagueId);
  }, [leagueId]);
  const toggle = useCallback((symbol: string) => (leagueId ? watchlistStore.toggle(leagueId, symbol) : Promise.resolve(null)), [leagueId]);
  const reload = useCallback(() => {
    if (leagueId) void watchlistStore.load(leagueId, true);
  }, [leagueId]);
  return { watch, toggle, reload };
}
