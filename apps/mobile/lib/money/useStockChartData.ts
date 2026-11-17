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
import { CAPTURE_LOSS, MATCHUP_FIXTURE_VARIANT, SEAM_ON } from '../game/devSeam';
import { seamBars } from './portfolioSeam';

export interface StockChartData {
  status: 'loading' | 'ready' | 'error';
  bars: DailyBar[];
}

const LOOKBACK_DAYS = 400; // covers YTD (<= 366 days) with a buffer for the window's own edge; the server allows 407.

export function useStockChartData(symbol: string, enabled: boolean): StockChartData {
  const [state, setState] = useState<StockChartData>({ status: 'loading', bars: [] });

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'loading', bars: [] });
      return;
    }
    if (MONEY_FIXTURE_CONFIG) {
      const all = stressChartBars(symbol);
      // DEV capture knob: a recent listing has only its last N daily bars (devFixture.MONEY_RECENT_BARS).
      setState({ status: 'ready', bars: MONEY_RECENT_BARS ? all.slice(-MONEY_RECENT_BARS) : all });
      return;
    }
    // The game capture seam: the fixture's own daily path, no network.
    if (SEAM_ON) {
      setState({ status: 'ready', bars: seamBars(symbol, MATCHUP_FIXTURE_VARIANT, { loss: CAPTURE_LOSS }) });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading', bars: [] });
    (async () => {
      const start = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
      const { data, error } = await supabase.functions.invoke('historical-bars', { body: { symbols: [symbol], start } });
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
  }, [symbol, enabled]);

  return state;
}
