/**
 * The real reads and the write behind run.ts, over a narrow slice of the supabase-js client
 * (so deps.test.ts can fake it and pin the exact query).
 *
 * Every supabase-js call resolves to { data, error } and does NOT throw on a Postgres error
 * (CLAUDE.md "success signals" #5): each one is destructured and its error checked.
 */

import type { RankDeps } from './run.ts';
import { fetchSnapshotBatch } from './snapshots.ts';

type Resp<T> = PromiseLike<{ data: T | null; error: { message?: string; code?: string } | null }>;

/** The query chain readSet builds, in this order. */
export interface SymbolsQuery {
  eq(col: string, val: unknown): SymbolsQuery;
  not(col: string, op: string, val: unknown): SymbolsQuery;
  order(col: string, opts: { ascending: boolean }): SymbolsQuery;
  limit(n: number): Resp<Array<{ symbol: string }>>;
}

export interface RankDbClient {
  from(table: 'symbols'): { select(cols: string): SymbolsQuery };
  rpc(fn: 'replace_top_movers', args: Record<string, unknown>): Resp<unknown>;
}

export function makeRankDeps(
  db: RankDbClient,
  alpacaKey: string,
  alpacaSecret: string,
  fetchImpl: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): RankDeps {
  return {
    now,

    // The set: the `limit` largest by market_cap among active, draftable, priced stocks.
    // Ties broken by ticker so the set is the same run to run.
    async readSet(limit) {
      const { data, error } = await db
        .from('symbols')
        .select('symbol')
        .eq('active', true)
        .eq('is_draftable', true)
        // price_unsupported (NOT NULL, default false) marks a symbol the price source
        // cannot quote; the backfill sets it without clearing an old last_price. One
        // such symbol makes the all-or-nothing snapshots call refuse its whole batch of
        // 50, so it must never enter the set (Copilot on #602).
        .eq('price_unsupported', false)
        .not('last_price', 'is', null)
        .not('market_cap', 'is', null)
        .order('market_cap', { ascending: false })
        .order('symbol', { ascending: true })
        .limit(limit);
      if (error) return { ok: false, error: error.code ?? error.message ?? 'error' };
      if (!Array.isArray(data)) return { ok: false, error: 'no data' };
      const symbols = data.map((r) => r?.symbol).filter((s): s is string => typeof s === 'string' && s.length > 0);
      if (symbols.length !== data.length) return { ok: false, error: 'malformed rows' };
      return { ok: true, symbols };
    },

    fetchBatch: (symbols) => fetchSnapshotBatch(symbols, alpacaKey, alpacaSecret, fetchImpl),

    async writeRanking({ rankedAt, setSize, freshCount, symbols, changePcts }) {
      const { data, error } = await db.rpc('replace_top_movers', {
        p_ranked_at: rankedAt.toISOString(),
        p_set_size: setSize,
        p_fresh_count: freshCount,
        p_symbols: symbols,
        p_change_pcts: changePcts,
      });
      if (error) return { ok: false, error: error.code ?? error.message ?? 'error' };
      const reply = data as { written?: unknown; reason?: unknown } | null;
      if (reply?.written === true) return { ok: true, written: true };
      // Kept only for the ONE reason the SQL gives for keeping (a newer ranking
      // exists). Any other or missing reason is not proof the ranking is current,
      // so it is a failed write, never a success (Copilot on #602).
      if (reply?.written === false && reply.reason === 'newer_ranking_exists') {
        return { ok: true, written: false, reason: 'newer_ranking_exists' };
      }
      // Neither: never read an unknown reply as a write.
      return { ok: false, error: 'unexpected reply' };
    },
  };
}
