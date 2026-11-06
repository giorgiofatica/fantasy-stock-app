/**
 * useQueueQuotes (the pre-draft queue row, Giorgio 2026-11-05 option A): the company name and the price of every queued
 * stock, read when the queue card opens and again only for a stock added later.
 *
 * - NAMES: one batched read of public.symbols (the table the draft search reads its names from), kept for the session.
 * - PRICES: symbols-search's BATCH mode (`{ symbols: [...] }`, live since #339): the exact tickers, ONE call for the whole
 *   queue (chunked at 50), Alpaca's latest trade, a 60 s cache on the server, so the queue and the draft search read the same
 *   number. Live when the card opens during market hours, the last close otherwise (a latest trade IS the last close then).
 *   No fallback to symbols.last_price: it can be days old with nothing saying so. Every read goes through ONE session-wide
 *   store (queuePriceStore.ts): a price read in the last 60 s is reused, a symbol already being fetched is shared.
 *   The response is `{ prices: {SYM: number|null}, failed: [...], invalid: [...] }` (queueRow.ts answersFromBatch): a value
 *   in `prices` is a clean answer; `failed`, or a whole-call error (a 429/502/503, a supabase-js `{ error }`), is a failed
 *   read; `invalid` is "–".
 *
 * A failed read is never a guess and never a blank: the price stays "–" (a name with no line), is not cached as an answer,
 * and is asked again after 15 s. With the capture seam on, the fixture's sample stocks (seamFixtures.ts) and no real call.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { SEAM_ON } from './devSeam';
import { seamInvoke } from './seamCalls';
import { seamSearchName } from './seamFixtures';
import { answersFromBatch, namesFromRows, symbolsToRead, type BatchAnswer, type QueuePrice } from './queueRow';
import { createPriceStore } from './queuePriceStore';

/** Capture seam only: the prices never answer, so the placeholder bar stays up for the "loading" still. */
const PRICES_NEVER_ANSWER = SEAM_ON && process.env.EXPO_PUBLIC_QUEUE_PRICES_FIXTURE === 'loading';

/** The latest trade of every symbol, in ONE call. Throws when the call failed as a whole (a symbol in `failed` is not that:
 * it comes back as a failed answer, and its neighbours keep theirs). */
async function fetchQueuePrices(symbols: string[]): Promise<Record<string, BatchAnswer>> {
  if (PRICES_NEVER_ANSWER) return new Promise<never>(() => {});
  const { data, error } = await seamInvoke('symbols-search', { body: { symbols } });
  if (error) throw error; // supabase-js resolves a failure as { error }; it does not throw (CLAUDE.md, success signals #5). A 429/502/503 lands here.
  return answersFromBatch(data, symbols);
}

/** Session-wide: shared by every mount of the card (a re-opened card, a league switched back to). */
const priceStore = createPriceStore(fetchQueuePrices);
/** Session-wide: a company's name rarely changes. */
const nameCache = new Map<string, string>();

export interface QueueQuotes {
  /** Per ticker: the name; null = read, none found (draw no name); absent = still loading. */
  names: Record<string, string | null>;
  /** Per ticker: loading, or ready with a price / null. */
  prices: Record<string, QueuePrice>;
}

export function useQueueQuotes(symbols: readonly string[]): QueueQuotes {
  const key = symbols.map((s) => s.toUpperCase()).join(',');
  const wanted = useMemo(() => Array.from(new Set(key ? key.split(',') : [])), [key]);
  const [, setVersion] = useState(0);
  const mounted = useRef(true);
  const nameSettled = useRef(new Set<string>());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const bump = () => { if (mounted.current) setVersion((v) => v + 1); };

    // ── Names: one batched read for the ones not known yet. ──
    const missingNames = symbolsToRead(wanted, { has: (s) => nameCache.has(s) || nameSettled.current.has(s) });
    if (missingNames.length > 0) {
      if (SEAM_ON) {
        for (const s of missingNames) {
          const n = seamSearchName(s);
          if (n) nameCache.set(s, n);
          else nameSettled.current.add(s);
        }
        bump();
      } else {
        void Promise.resolve(supabase.from('symbols').select('symbol, name').in('symbol', missingNames))
          .then(({ data, error }) => {
            if (!error) for (const [s, n] of Object.entries(namesFromRows(data))) nameCache.set(s, n);
            for (const s of missingNames) if (!nameCache.has(s)) nameSettled.current.add(s); // read (or failed): no name line, not a spinner for ever
            bump();
          })
          .catch(() => {
            for (const s of missingNames) if (!nameCache.has(s)) nameSettled.current.add(s);
            bump();
          });
      }
    }

    // ── Prices: the shared store decides what needs asking. ──
    priceStore.request(wanted, bump);
  }, [wanted]);

  const names: Record<string, string | null> = {};
  const prices: Record<string, QueuePrice> = {};
  for (const s of wanted) {
    const n = nameCache.get(s);
    if (n !== undefined) names[s] = n;
    else if (nameSettled.current.has(s)) names[s] = null;
    prices[s] = priceStore.peek(s) ?? { status: 'loading' };
  }
  return { names, prices };
}
