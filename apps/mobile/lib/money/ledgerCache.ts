/**
 * ledgerCache: the per-league ledger cache behind usePortfolioLedger, kept free of React and
 * supabase so it is testable. A league's ledger is fetched once and shared until it is
 * INVALIDATED; every trade outcome that means the server's picture changed (a fill) or that ours
 * was wrong (a refusal) invalidates it, and every subscriber reloads.
 *
 * Build 1.3.0 (5) had no invalidation: after a sale, Holdings, Trade history and the roster-full
 * check kept the pre-sale ledger for the rest of the session, while record-trade (which reads the
 * real rows) answered "You don't hold KB anymore" (Giorgio's phone pass, 2026-10-30).
 */
export interface LedgerCache<T> {
  /** The cached ledger, else one shared fetch. Failures (null) are never cached. */
  load(leagueId: string): Promise<T | null>;
  peek(leagueId: string): T | undefined;
  has(leagueId: string): boolean;
  /** Drops the league's ledger; a load already in flight can no longer cache its (older) answer. */
  invalidate(leagueId: string): void;
  /** Called with the league id after each invalidate. Returns the unsubscribe. */
  subscribe(listener: (leagueId: string) => void): () => void;
}

export function createLedgerCache<T>(fetchLedger: (leagueId: string) => Promise<T | null>): LedgerCache<T> {
  const loaded = new Map<string, T>();
  const inFlight = new Map<string, Promise<T | null>>();
  const generation = new Map<string, number>();
  const listeners = new Set<(leagueId: string) => void>();

  return {
    load(leagueId) {
      const hit = loaded.get(leagueId);
      if (hit !== undefined) return Promise.resolve(hit);
      const pending = inFlight.get(leagueId);
      if (pending) return pending;
      const startedAt = generation.get(leagueId) ?? 0;
      const p: Promise<T | null> = fetchLedger(leagueId)
        .then((value) => {
          if (value !== null && (generation.get(leagueId) ?? 0) === startedAt) loaded.set(leagueId, value);
          return value;
        })
        .finally(() => {
          if (inFlight.get(leagueId) === p) inFlight.delete(leagueId);
        });
      inFlight.set(leagueId, p);
      return p;
    },
    peek: (leagueId) => loaded.get(leagueId),
    has: (leagueId) => loaded.has(leagueId),
    invalidate(leagueId) {
      loaded.delete(leagueId);
      inFlight.delete(leagueId);
      generation.set(leagueId, (generation.get(leagueId) ?? 0) + 1);
      for (const listener of [...listeners]) listener(leagueId);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
