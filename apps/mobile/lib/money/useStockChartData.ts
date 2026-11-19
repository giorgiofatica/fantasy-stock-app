/**
 * useStockChartData: a stock's chart history (the sheet and the player card). One
 * historical-bars read per symbol per open, wide enough for the longest range (YTD,
 * at most ~365 days; 400 here is ~275 daily bars, well inside historical-bars' 407-day
 * ceiling) -- every range is a client-side window of it, never a separate request per tab.
 * DEV fixture: stressFixture.stressChartBars, no network.
 */
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

import type { DailyBar } from './stockChartSeries';
import { MONEY_FIXTURE_CONFIG, MONEY_RECENT_BARS } from './devFixture';
import { stressChartBars } from './stressFixture';
import { CAPTURE_LOSS, CAPTURE_SEASON_LATER, MATCHUP_FIXTURE_VARIANT, SEAM_ON } from '../game/devSeam';
import { seamChartBars } from './portfolioSeam';

export interface StockChartData {
  status: 'loading' | 'ready' | 'error';
  bars: DailyBar[];
}

// Covers YTD (<= 366 days) with a buffer for the window's own edge; the server allows 407. A season cannot
// reach this cap (a league's season is far shorter than 400 days), so Season never greys a stock for want of
// fetched history, only for a stock listed after the draft.
const LOOKBACK_DAYS = 400;

/** A season that is over reads only up to its last day, from its draft day (the server clamps `start` to
 * its own 407-day ceiling, so a season older than that loses its earliest bars, never gets later ones). */
export interface StockChartWindow {
  start: string;
  end: string;
}

export function useStockChartData(symbol: string, enabled: boolean, window: StockChartWindow | null = null): StockChartData {
  const windowStart = window?.start ?? null;
  const windowEnd = window?.end ?? null;
  const [state, setState] = useState<StockChartData>({ status: 'loading', bars: [] });

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'loading', bars: [] });
      return;
    }
    if (MONEY_FIXTURE_CONFIG) {
      // Under the capture seam the app's clock is the fixture's Thursday (the sheet's chartNow), so the
      // stress history ends there too; otherwise bars dated after "today" would all fall out of every range.
      const all = stressChartBars(symbol, SEAM_ON ? new Date('2026-09-24T17:37:00.000Z') : new Date());
      // DEV capture knob: a recent listing has only its last N daily bars (devFixture.MONEY_RECENT_BARS).
      setState({ status: 'ready', bars: MONEY_RECENT_BARS ? all.slice(-MONEY_RECENT_BARS) : all });
      return;
    }
    // The game capture seam: the fixture's own daily path, no network.
    if (SEAM_ON) {
      setState({ status: 'ready', bars: seamChartBars(symbol, MATCHUP_FIXTURE_VARIANT, { loss: CAPTURE_LOSS, later: CAPTURE_SEASON_LATER }) });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading', bars: [] });
    (async () => {
      const start = windowStart ?? new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
      const { data, error } = await supabase.functions.invoke('historical-bars', { body: { symbols: [symbol], start, ...(windowEnd ? { end: windowEnd } : {}) } });
      if (cancelled) return;
      if (error) {
        console.warn('[stock-chart] historical-bars failed', error.message);
        setState({ status: 'error', bars: [] });
        return;
      }
      const raw = (data?.bars?.[symbol] ?? data?.bars?.[symbol.toUpperCase()] ?? []) as { t: string; c: number }[];
      const bars: DailyBar[] = raw
        .map((b) => ({ date: b.t.slice(0, 10), close: b.c }))
        .filter((b) => typeof b.close === 'number' && Number.isFinite(b.close) && b.close > 0);
      setState({ status: 'ready', bars });
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, enabled, windowStart, windowEnd]);

  return state;
}
