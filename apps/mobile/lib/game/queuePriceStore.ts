/**
 * The queue's price store: one per app session, shared by every mount of the queue card.
 *
 * symbols-search (where the price comes from) answers `{ symbols: [...] }` with ONE call for up to 50 exact tickers (one
 * Alpaca request behind it, a 60 s server cache first, a per-user limit): the whole queue is one call, not fifty. It has no
 * client-visible cache, so the client must never ask twice for what it has or is already asking for:
 *   - a price read within PRICE_TTL_MS (60 s, as ticker-quotes) is reused: a re-render, a re-opened card and a switch back
 *     to the league make ZERO calls;
 *   - a symbol already being fetched is shared: a second mount waits for the same request instead of making its own;
 *   - every symbol that needs a read goes out in ONE call, chunked at BATCH_SIZE (50, the function's own ceiling);
 *   - a FAILED read (the symbol is in the response's `failed`, or the whole call failed) is remembered for FAIL_TTL_MS (15 s)
 *     as "–" and NOT as an answer, so a down API isn't hit on every mount, and then asked again;
 *   - at most PRICE_LANES calls are in flight at once, across every mount (only more than 50 stocks ever need a second).
 * What is on screen is the latest entry whatever its age (a stale price beats a blank while the next read is made); the TTLs
 * only decide whether to ask again. Pure (an injected fetcher and clock), so tests-deno pins every rule.
 */
import type { BatchAnswer, QueuePrice } from './queueRow';

export type { BatchAnswer };

export const PRICE_TTL_MS = 60_000;
export const FAIL_TTL_MS = 15_000;
export const PRICE_LANES = 4;
/** The most tickers one symbols-search call takes (MAX_BATCH_SYMBOLS in supabase/functions/symbols-search/prices.ts). */
export const BATCH_SIZE = 50;

/** Reads the latest trade of every symbol in ONE call (at most BATCH_SIZE): an answer per symbol asked (a symbol left out
 * counts as failed), or THROWS when the whole call failed (an `{ error }`, a 429/502/503, a dropped connection). */
export type PriceFetcher = (symbols: string[]) => Promise<Record<string, BatchAnswer | undefined>>;

interface Entry {
  price: number | null;
  ok: boolean;
  at: number;
}

export interface PriceStore {
  /** What is known for `symbol`, whatever its age; undefined = never read (still loading). */
  peek(symbol: string): QueuePrice | undefined;
  /** Asks for every symbol without a fresh entry that is not already being fetched; `onSettle` fires once each time one of
   * the asked symbols settles (a read, or a failure). Symbols with a fresh entry make no call. */
  request(symbols: readonly string[], onSettle: () => void): void;
}

export function createPriceStore(fetchPrices: PriceFetcher, now: () => number = Date.now, lanes: number = PRICE_LANES): PriceStore {
  const entries = new Map<string, Entry>();
  const waiting = new Map<string, Set<() => void>>(); // a symbol being fetched or queued → who to tell when it settles
  const queue: string[] = [];
  let active = 0;

  const fresh = (s: string) => {
    const e = entries.get(s);
    return !!e && now() - e.at < (e.ok ? PRICE_TTL_MS : FAIL_TTL_MS);
  };

  /** Starts queued calls while a lane is free: up to BATCH_SIZE symbols each. A call, when it settles, records an entry per
   * symbol, tells its waiters and frees its lane for the next. */
  function pump(): void {
    while (active < lanes && queue.length > 0) {
      const batch = queue.splice(0, BATCH_SIZE);
      active++;
      void (async () => {
        let answers: Record<string, BatchAnswer | undefined> = {};
        try {
          answers = await fetchPrices(batch);
        } catch {
          // The whole call failed: every symbol in it is a failed read (answers stays empty).
        }
        const at = now();
        const settled: Set<() => void>[] = [];
        for (const s of batch) {
          const a = Object.prototype.hasOwnProperty.call(answers, s) ? answers[s] : undefined;
          // "–" for now; the last good price (if any) is dropped, not shown beside a failure. A symbol the answer leaves out is
          // a failed read too (nothing is dropped silently).
          entries.set(s, a && a.ok ? { price: a.price, ok: true, at } : { price: null, ok: false, at });
          const who = waiting.get(s);
          waiting.delete(s);
          if (who) settled.push(who);
        }
        active--;
        for (const who of settled) who.forEach((fn) => fn());
        pump();
      })();
    }
  }

  return {
    peek(symbol) {
      const e = entries.get(symbol.toUpperCase());
      return e ? { status: 'ready', price: e.price } : undefined;
    },
    request(symbols, onSettle) {
      for (const raw of symbols) {
        const s = raw.toUpperCase();
        const inflight = waiting.get(s);
        if (inflight) {
          inflight.add(onSettle); // shared: the same request answers this mount too
          continue;
        }
        if (fresh(s)) continue;
        waiting.set(s, new Set([onSettle]));
        queue.push(s);
      }
      pump();
    },
  };
}
