/**
 * useRowPrices: the live prices of the Stocks rows ON SCREEN, and only those. One session-wide store
 * (lib/game/queuePriceStore.ts, the pre-draft queue's): a price read in the last 60 s is reused, a symbol already being
 * asked for is shared, a failed read is remembered 15 s as "–" and asked again, and every symbol that needs a read goes
 * out in ONE call. The call is the existing `quote` lookup: the same fill-price chain (trade, bar, sane midpoint, last
 * daily close, never a lone bid or ask) the stock sheet and every fill use, under its own per-person limit (120 a minute).
 *
 * A row's price is "–" until one arrives, and for any answer that is not a usable price. The stored `symbols.last_price`
 * is never read: it can be about two trading days old (Giorgio, 2026-11-18, "we can't be showing a stock price that is a
 * day old"). The list read does not even return it.
 *
 * While the tab is on screen the visible symbols are asked again every REFRESH_MS, so a price stays current (the store
 * only calls out for a stale or failed entry, so a quiet minute makes no request).
 */
import { useEffect, useMemo, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';

import { seamInvoke } from '../game/seamCalls';
import { createPriceStore, type BatchAnswer } from '../game/queuePriceStore';
import type { QueuePrice } from '../game/queueRow';
import { answersFromQuote } from './stocksList';

export const REFRESH_MS = 20_000;

async function fetchQuotes(symbols: string[]): Promise<Record<string, BatchAnswer>> {
  const { data, error } = await seamInvoke('quote', { body: { symbols } });
  if (error) throw error; // supabase-js resolves a failure as { error }: it is a failed read, never a price.
  return answersFromQuote(data, symbols);
}

const store = createPriceStore(fetchQuotes);

export function useRowPrices(symbols: readonly string[]): (symbol: string) => QueuePrice | undefined {
  const key = symbols.join(',');
  const wanted = useMemo(() => (key ? key.split(',') : []), [key]);
  const [, setVersion] = useState(0);
  const focused = useIsFocused();

  useEffect(() => {
    if (!focused || wanted.length === 0) return;
    let live = true;
    const bump = () => {
      if (live) setVersion((v) => v + 1);
    };
    store.request(wanted, bump);
    const timer = setInterval(() => store.request(wanted, bump), REFRESH_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [wanted, focused]);

  return (symbol) => store.peek(symbol);
}
