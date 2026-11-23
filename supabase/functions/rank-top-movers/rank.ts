/**
 * Top movers: the pure decisions (docs/plans/2026-11-18-stocks-tab.md, Part 3, "Top movers:
 * how it works"). No I/O here; run.ts does the reads and the write, and rank.test.ts pins
 * every rule below.
 *
 * THE SET. The 500 largest companies by symbols.market_cap among stocks that are active,
 * draftable and priced (run.ts reads it). Asked of the source in batches of BATCH_SIZE (the
 * Researcher, 2026-11-22: the source documents no per-call limit, so we keep our own 50).
 *
 * ONE STOCK (evaluateSnapshot). Today's change is the current price against the previous
 * session's close, the formula `quote` uses. The current price comes from the ONE shared
 * chain (_shared/alpaca-price.ts parseSnapshotPrices: the latest trade, then the latest
 * minute bar; never a bid or an ask, alone or otherwise). A stock is left out of this run's
 * ranking when:
 *   - its snapshot is missing                                    'no_snapshot'
 *   - it has no latest trade, or the trade has no usable price or time   'no_trade'
 *   - its latest trade is older than FRESH_MAX_AGE_MS (15 min)   'stale_trade'
 *   - it has no previous daily close                             'no_prev_close'
 * "A missing figure never ranks" (the plan). Because the trade must be fresh and valid to
 * get this far, the chain always answers with that trade's price, never the bar fallback.
 *
 * THE WHOLE RANKING (decideRanking). Written ONLY when every batch succeeded AND at least
 * 90% of the set came back fresh; otherwise the previous ranking stays and the run reports
 * itself partial. A ranking drawn from a subset is never published as the market's
 * (CLAUDE.md: the verdict's scope must match the evidence's). The 90% test is in integers,
 * so exactly 90% passes with no float edge. The same gate is re-checked by
 * replace_top_movers and by the table's CHECK (20261210000000).
 */

import { parseSnapshotPrices } from '../_shared/alpaca-price.ts';

/** How many of the largest companies are ranked. */
export const SET_SIZE = 500;
/** Stocks per snapshot call (the plan, "Open" item 2). */
export const BATCH_SIZE = 50;
/** A latest trade older than this is stale (the Planner's 15 minutes). */
export const FRESH_MAX_AGE_MS = 15 * 60_000;
/** A trade stamped further in the future than this is not a usable time. */
export const FUTURE_SKEW_MS = 60_000;
/** How many moves the stored ranking keeps (the biggest, up or down). */
export const RANKING_ROWS = 100;

export type SkipReason = 'no_snapshot' | 'no_trade' | 'stale_trade' | 'no_prev_close';

export type Evaluation =
  | { symbol: string; fresh: true; price: number; prevClose: number; changePct: number }
  | { symbol: string; fresh: false; reason: SkipReason };

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** One stock's snapshot, judged at `now`. PURE. */
export function evaluateSnapshot(symbol: string, snapshot: unknown, now: Date): Evaluation {
  const snap = obj(snapshot);
  if (!snap) return { symbol, fresh: false, reason: 'no_snapshot' };

  const trade = obj(snap.latestTrade);
  const tradePrice = Number(trade?.p);
  const tradeMs = typeof trade?.t === 'string' ? Date.parse(trade.t) : NaN;
  if (!trade || !Number.isFinite(tradePrice) || tradePrice <= 0 || !Number.isFinite(tradeMs)) {
    return { symbol, fresh: false, reason: 'no_trade' };
  }
  const age = now.getTime() - tradeMs;
  if (age < -FUTURE_SKEW_MS) return { symbol, fresh: false, reason: 'no_trade' };
  if (age > FRESH_MAX_AGE_MS) return { symbol, fresh: false, reason: 'stale_trade' };

  const prevClose = Number(obj(snap.prevDailyBar)?.c);
  if (!Number.isFinite(prevClose) || prevClose <= 0) {
    return { symbol, fresh: false, reason: 'no_prev_close' };
  }

  // The shared chain, on this one snapshot. With a valid trade it answers the trade's price.
  const price = parseSnapshotPrices({ [symbol]: snap }, [symbol]).get(symbol);
  if (price === undefined) return { symbol, fresh: false, reason: 'no_trade' };

  const changePct = ((price - prevClose) / prevClose) * 100;
  if (!Number.isFinite(changePct)) return { symbol, fresh: false, reason: 'no_trade' };
  return { symbol, fresh: true, price, prevClose, changePct };
}

/** Split into consecutive batches of `size`. PURE. */
export function chunk<T>(xs: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

/** At least 90% of the set fresh, in integers. PURE. */
export function passesFreshGate(fresh: number, setSize: number): boolean {
  return setSize > 0 && fresh * 10 >= setSize * 9;
}

export type Decision =
  | { write: true; symbols: string[]; changePcts: number[]; setSize: number; freshCount: number }
  | {
    write: false;
    reason: 'empty_set' | 'batch_failed' | 'incomplete' | 'below_fresh_gate';
    setSize: number;
    freshCount: number;
  };

/**
 * The whole-or-nothing decision. `set` is the set as read; `evaluations` must judge every
 * one of its symbols exactly once (anything else is 'incomplete', never ranked); a failed
 * batch is passed as batchesFailed > 0. PURE.
 */
export function decideRanking(input: {
  set: readonly string[];
  batchesFailed: number;
  evaluations: readonly Evaluation[];
}): Decision {
  const setSize = input.set.length;
  const fresh = input.evaluations.filter((e): e is Extract<Evaluation, { fresh: true }> => e.fresh);
  const freshCount = fresh.length;
  if (setSize === 0) return { write: false, reason: 'empty_set', setSize, freshCount };
  if (input.batchesFailed > 0) return { write: false, reason: 'batch_failed', setSize, freshCount };

  const judged = new Set(input.evaluations.map((e) => e.symbol));
  const wanted = new Set(input.set);
  if (
    wanted.size !== setSize || judged.size !== input.evaluations.length || judged.size !== setSize ||
    input.set.some((s) => !judged.has(s))
  ) {
    return { write: false, reason: 'incomplete', setSize, freshCount };
  }
  if (!passesFreshGate(freshCount, setSize)) {
    return { write: false, reason: 'below_fresh_gate', setSize, freshCount };
  }

  // Biggest move first, up or down; ties by ticker so the order is stable run to run.
  const ranked = [...fresh]
    .sort((a, b) => {
      const d = Math.abs(b.changePct) - Math.abs(a.changePct);
      if (d !== 0) return d;
      return a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0;
    })
    .slice(0, RANKING_ROWS);
  return {
    write: true,
    symbols: ranked.map((r) => r.symbol),
    changePcts: ranked.map((r) => r.changePct),
    setSize,
    freshCount,
  };
}

/** How many stocks were left out, by reason (for the run's one log line). PURE. */
export function skipCounts(evaluations: readonly Evaluation[]): Record<SkipReason, number> {
  const out: Record<SkipReason, number> = { no_snapshot: 0, no_trade: 0, stale_trade: 0, no_prev_close: 0 };
  for (const e of evaluations) if (!e.fresh) out[e.reason]++;
  return out;
}
