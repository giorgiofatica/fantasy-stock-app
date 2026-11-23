/**
 * useWatchSlots: the Watching rows' slot lines from record-trade's LIST preview (watchSlots.ts). ONE call for the rows that have a price, made when the
 * rows or their prices change, and at most one a minute (record-trade is paced at 30 a minute per user; the quote cache is 60 s). Never one call per
 * row. Every error leaves the rows with no answer, and a row shows only an answer given for the price it is showing now.
 *
 * Through the capture seam (seamInvoke); destructures and checks `{ data, error }` (functions.invoke does not throw on an HTTP error).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';

import { seamInvoke } from '../game/seamCalls';
import { categoryNameOf, loadCategoryNames } from '../money/categoryNames';
import { askableRows, listPreviewBody, parseListPreview, type SlotVerdict } from './watchSlots';

/** The least time between two calls: the quote cache's 60 s, so a screen of rows never asks faster than its prices can change. */
export const SLOT_MIN_GAP_MS = 60_000;

export function useWatchSlots(
  leagueId: string | null,
  rows: readonly { symbol: string; price: number | null | undefined }[],
): (symbol: string, shownPrice: number | null | undefined) => SlotVerdict | undefined {
  const asked = useMemo(() => askableRows(rows), [rows]);
  const key = asked.map((r) => `${r.symbol}:${r.price}`).join(',');
  const [answers, setAnswers] = useState<Map<string, SlotVerdict>>(new Map());
  const lastCallAt = useRef(0);
  const latest = useRef(asked);
  latest.current = asked;
  const focused = useIsFocused();

  useEffect(() => {
    if (!leagueId || !focused || asked.length === 0) return;
    let cancelled = false;
    const wait = Math.max(0, lastCallAt.current + SLOT_MIN_GAP_MS - Date.now());
    const timer = setTimeout(async () => {
      lastCallAt.current = Date.now();
      const sent = latest.current;
      if (sent.length === 0) return;
      let data: unknown = null;
      try {
        await loadCategoryNames();
        const res = await seamInvoke('record-trade', { body: listPreviewBody(leagueId, sent) });
        if (!res.error) data = res.data;
      } catch {
        data = null; // a dropped connection: no answers
      }
      if (cancelled) return;
      const shown = new Map(sent.map((r) => [r.symbol, r.price]));
      const parsed = parseListPreview(data, sent, (s) => shown.get(s), categoryNameOf);
      // Merge: what this call answered replaces those symbols; the rest keep their last answer (each is price-checked when read).
      setAnswers((prev) => {
        const next = new Map(prev);
        for (const r of sent) next.delete(r.symbol);
        for (const [s, v] of parsed) next.set(s, v);
        return next;
      });
    }, wait);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `key` carries the rows' symbols and prices; `asked` itself is a new array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, focused, key]);

  // Another league is another list.
  useEffect(() => {
    setAnswers(new Map());
    lastCallAt.current = 0;
  }, [leagueId]);

  return (symbol, shownPrice) => {
    const v = answers.get(symbol);
    return v && typeof shownPrice === 'number' && v.price === shownPrice ? v : undefined;
  };
}
