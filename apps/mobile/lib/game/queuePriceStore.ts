/**
 * The queue's price store: one per app session, shared by every mount of the queue card.
 *
 * symbols-search (where the price comes from) has NO rate limit and NO server cache: each call is 4-5 DB queries and one
 * Alpaca latest-trade request on the shared app key (the same key the snapshot jobs and ticker-quotes use). So the client
 * must never ask twice for what it has or is already asking for:
 *   - a price read within PRICE_TTL_MS (60 s, as ticker-quotes) is reused: a re-render, a re-opened card and a switch back
 *     to the league make ZERO calls;
 *   - a symbol already being fetched is shared: a second mount waits for the same request instead of making its own;
 *   - a FAILED read is remembered for FAIL_TTL_MS (15 s), so a down API isn't hit on every mount, and then asked again;
 *   - at most PRICE_LANES requests are in flight at once, across every mount.
 * What is on screen is the latest entry whatever its age (a stale price beats a blank while the next read is made); the TTLs
 * only decide whether to ask again. Pure (an injected fetcher and clock), so tests-deno pins every rule.
 */
import type { QueuePrice } from './queueRow';

export const PRICE_TTL_MS = 60_000;
export const FAIL_TTL_MS = 15_000;
export const PRICE_LANES = 4;

/** Reads one stock's latest trade: a number, null (a clean "no price"), or THROWS on a failed read. */
export type PriceFetcher = (symbol: string) => Promise<number | null>;

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

export function createPriceStore(fetchPrice: PriceFetcher, now: () => number = Date.now, lanes: number = PRICE_LANES): PriceStore {
  const entries = new Map<string, Entry>();
  const waiting = new Map<string, Set<() => void>>(); // a symbol being fetched or queued → who to tell when it settles
  const queue: string[] = [];
  let active = 0;

  const fresh = (s: string) => {
    const e = entries.get(s);
    return !!e && now() - e.at < (e.ok ? PRICE_TTL_MS : FAIL_TTL_MS);
  };

  /** Starts queued reads while a lane is free; each read, when it settles, tells its waiters and frees its lane for the next. */
  function pump(): void {
    while (active < lanes && queue.length > 0) {
      const s = queue.shift() as string;
      active++;
      void (async () => {
        try {
          entries.set(s, { price: await fetchPrice(s), ok: true, at: now() });
        } catch {
          // "–" for now; the last good price (if any) is dropped, not shown beside a failure.
          entries.set(s, { price: null, ok: false, at: now() });
        }
        const who = waiting.get(s);
        waiting.delete(s);
        active--;
        who?.forEach((fn) => fn());
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
