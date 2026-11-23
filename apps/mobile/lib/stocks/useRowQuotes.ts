/**
 * useRowQuotes: the live price and today's change of the Watching rows ON SCREEN (rowQuotes.ts). One session-wide store, the
 * same shape as useRowPrices'; the difference is the call. The Stocks list's batch `quote` returns prices only, so a Watching row
 * asks the single-symbol lookup the stock sheet reads (`ticker-quotes`: price and prevClose) and takes its price AND its change
 * from that one answer. While the tab is on screen the visible symbols are asked again every REFRESH_MS; the store only calls out
 * for a stale or failed entry, so most ticks make no request.
 */
import { useEffect, useMemo, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';

import { seamInvoke } from '../game/seamCalls';
import { answerFromTickerQuote, createQuoteStore, type QuoteAnswer, type RowQuote } from './rowQuotes';

export const QUOTE_REFRESH_MS = 20_000;

async function fetchOne(symbol: string): Promise<QuoteAnswer> {
  const { data, error } = await seamInvoke('ticker-quotes', { body: { symbol } });
  if (error) return { ok: false }; // supabase-js resolves a failure as { error }: a failed read, never a price.
  return answerFromTickerQuote(data);
}

const store = createQuoteStore(fetchOne);

export function useRowQuotes(symbols: readonly string[]): (symbol: string) => RowQuote | undefined {
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
    const timer = setInterval(() => store.request(wanted, bump), QUOTE_REFRESH_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [wanted, focused]);

  return (symbol) => store.peek(symbol);
}
