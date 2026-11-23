/**
 * watchlistStore: one per app session, shared by the Stocks tab's stars and the stock sheet's Save, so a star tapped in one
 * place shows in the other. Keyed by league (a watchlist is per league). Pure: the read and the write are injected, so
 * tests-deno drives every path without a network (the queue price store's pattern).
 *
 * The write is `set_watchlist`; its result is ALWAYS read through `parseSaveResult` (`{ data, error }`: supabase-js does not
 * throw on a Postgres error). A thrown call is a failed save too. Every failure puts the star back (settleToggle).
 * After a save that went through, the league's list is read again, so a just-saved stock gets its name and categories.
 */
import {
  applyRead,
  applyToggle,
  emptyWatch,
  parseSaveResult,
  parseWatchlist,
  settleToggle,
  type LeagueWatch,
  type SaveResult,
  type WatchRow,
} from './watchlist';

export interface WatchlistIo {
  /** The league's rows, or null when the read failed (an `{ error }`, a thrown call, an answer that is not a list). */
  read(leagueId: string): Promise<WatchRow[] | null>;
  /** The raw `{ data, error }` of `set_watchlist`; may throw (a dropped connection). */
  write(leagueId: string, symbol: string, saved: boolean): Promise<{ data: unknown; error: unknown }>;
}

export interface WatchlistStore {
  peek(leagueId: string | null): LeagueWatch;
  subscribe(fn: () => void): () => void;
  /** Reads the league's list unless one is already in flight or answered; `force` reads again (pull to refresh, a retry). */
  load(leagueId: string, force?: boolean): Promise<void>;
  /** The star. Resolves with the verdict, so the caller can open the sheet on a full list; null = the tap changed nothing (in flight). */
  toggle(leagueId: string, symbol: string): Promise<SaveResult | null>;
  /** Forget the "list is full" refusal (the sheet closed, or the manager moved on). */
  clearRefusal(leagueId: string): void;
}

export function createWatchlistStore(io: WatchlistIo): WatchlistStore {
  const state = new Map<string, LeagueWatch>();
  const listeners = new Set<() => void>();
  // A newer read for a league wins: an older answer that lands late is dropped.
  const readSeq = new Map<string, number>();

  const get = (id: string): LeagueWatch => state.get(id) ?? emptyWatch;
  const set = (id: string, w: LeagueWatch) => {
    state.set(id, w);
    for (const fn of [...listeners]) fn();
  };

  async function read(leagueId: string): Promise<void> {
    const seq = (readSeq.get(leagueId) ?? 0) + 1;
    readSeq.set(leagueId, seq);
    let rows: WatchRow[] | null;
    try {
      rows = await io.read(leagueId);
    } catch {
      rows = null;
    }
    if (readSeq.get(leagueId) !== seq) return;
    const w = get(leagueId);
    // A failed read keeps what is known; with nothing known yet the league reads as failed (never as "nothing saved").
    if (rows === null) set(leagueId, w.status === 'ready' ? w : { ...w, status: 'failed' });
    else set(leagueId, applyRead(w, rows));
  }

  return {
    peek: (leagueId) => (leagueId ? get(leagueId) : emptyWatch),
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    async load(leagueId, force = false) {
      const w = get(leagueId);
      if (!force && (w.status === 'loading' || w.status === 'ready')) return;
      // A forced read of a ready list keeps showing it; a first read (or a retry after a failure) shows "loading".
      if (w.status !== 'ready') set(leagueId, { ...w, status: 'loading' });
      await read(leagueId);
    },
    async toggle(leagueId, symbol) {
      const tap = applyToggle(get(leagueId), symbol);
      if (!tap) return null;
      set(leagueId, tap.next);
      let result: SaveResult;
      try {
        result = parseSaveResult(await io.write(leagueId, symbol, tap.want));
      } catch {
        result = { ok: false, reason: 'failed' };
      }
      set(leagueId, settleToggle(get(leagueId), symbol, tap.want, result));
      // A save that went through: read the list again for the name and categories (the read is not paced).
      if (result.ok) void read(leagueId);
      return result;
    },
    clearRefusal(leagueId) {
      const w = get(leagueId);
      if (w.refusal) set(leagueId, { ...w, refusal: null });
    },
  };
}
