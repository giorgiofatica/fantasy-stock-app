/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
/**
 * StockChart: ONE chart for a stock, on the stock sheet AND the player card (Giorgio,
 * 2026-11-17: "every chart like that ... should be 1 week, 1 month, 3 months, 6 months, Season,
 * and YTD"). The gain line ("+$54.60 (+41.42%) past 6 months") directly above the Game Night
 * Chart, a labelled X axis under it, and the six range pills under that.
 *
 *   - The ranges, their windows, the greying and the gain are lib/chart/chartRanges.ts, the one
 *     definition every chart shares. Season is since THIS league's draft (`seasonStart`): the
 *     same window for every stock, owned or not; before the draft, or with no league, it is grey.
 *   - A range longer than the stock's own trading history (its first bar) is grey; 1W never is.
 *   - The sheet opens on 1W, the player card on Season (`defaultRange`); nothing is remembered.
 *   - No dotted base line (Giorgio, 2026-11-16): the range's first value only decides the line's
 *     colour and the gain. 1W is the past five trading sessions on a weekday-named axis (Giorgio,
 *     2026-11-16); the others sit on dated axes (stockChartSeries.stockLineSeries).
 *   - Tapping a pill changes the line, the gain and the axis together. The line draws in once
 *     per range (the Chart's drawKey); Reduce Motion shows it drawn.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';
// Direct imports, not the gn index: the player card (in gn) renders this chart, so the index would loop.
import { Chart } from '@/components/sp/gn/Chart';
import { RangeGainLine } from '@/components/sp/gn/RangeGainLine';
import { RangePills } from '@/components/sp/gn/RangePills';
import type { AxisSpec } from '@/components/sp/logic/chartAxis';
import { formatMoney } from '@/components/sp/logic/money';
import {
  asChartRange, CHART_RANGES, rangeFirstDay, rangeGain, selectableRange, SHEET_DEFAULT_RANGE, type ChartRange,
} from '@/lib/chart/chartRanges';
import { stockGreyedRanges, stockLineSeries } from '@/lib/money/stockChartSeries';
import { useStockChartData } from '@/lib/money/useStockChartData';
import { useCaptureAction } from '@/lib/money/captureScript';
import { etDateOf } from '@/lib/game/matchupRoster';
import { holdingRangeGain, type HoldingLot } from '@/lib/game/playerCardModel';
import type { MarketCalendarSession } from '@/lib/time/marketWeek';

export interface StockChartProps {
  symbol: string;
  /** The live/current price (the sheet's own quote read) — the chart never reads its own. */
  price: number | null;
  /** True while the market is open: the end dot breathes. */
  live: boolean;
  /** The sheet's clock (the capture seam plays the fixture's); defaults to now. */
  now?: Date;
  /** This week's sessions: tells 1W whether today is a trading day (and whether it has opened). */
  sessions: readonly MarketCalendarSession[];
  /** The sheet's gutter: the line runs past it to the sheet's edges. */
  bleed: number;
  /** The league's draft day (ET), once it has finished its draft; null before, or with no league. */
  seasonStart: string | null;
  /** The range it opens on: the sheet 1W (default), the player card Season. */
  defaultRange?: ChartRange;
  /** The plot's height. */
  height?: number;
  /**
   * The player card's lots held now. With them the gain line is the HOLDING's P/L over the range
   * (not the stock's per-share move) and the line's colour follows that P/L's sign; the line itself
   * stays the stock's price. Without them (the stock sheet) everything is per share.
   */
  lots?: readonly HoldingLot[];
}

const HEIGHT = 140;
/** No sessions yet: no labels (chartAxis 'sessions' with no days). */
const LOADING_AXIS: AxisSpec = { kind: 'sessions', days: [] };

export function StockChart({ symbol, price, live, now = new Date(), sessions, bleed, seasonStart, defaultRange = SHEET_DEFAULT_RANGE, height = HEIGHT, lots }: StockChartProps) {
  const [picked, setPicked] = useState<ChartRange>(defaultRange);
  const data = useStockChartData(symbol, true);
  const todayEt = etDateOf(now) ?? now.toISOString().slice(0, 10);
  // Until the bars are in, the chart is empty AND its axis has no labels (the live price alone
  // would otherwise make a lone "Mon" under nothing). The axis row keeps its height either way.
  const ready = data.status === 'ready';
  // A range longer than the stock's own history is grey (and never the selected one).
  const greyed = useMemo(
    () => stockGreyedRanges({ bars: data.bars, ready, todayEt, seasonStart }),
    [data.bars, ready, todayEt, seasonStart],
  );
  const range = selectableRange(picked, greyed);
  const series = useMemo(
    () => stockLineSeries({ range, bars: data.bars, price, todayEt, now, sessions, seasonStart }),
    // `now` ticks; the line only changes with the date, the bars, the price and the range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range, data.bars, price, todayEt, sessions, seasonStart],
  );
  const holding = ready && lots?.length
    ? holdingRangeGain({ lots, start: rangeFirstDay(range, series.axis, todayEt, seasonStart), base: series.base, price })
    : null;
  // The holding's P/L when the card has lots; otherwise (the sheet, or a sold stock) the per-share move.
  const gain = ready ? holding ?? rangeGain(series.points, series.base) : null;
  // DEV capture only: the same handler a pill tap runs.
  useCaptureAction('stockrange', (r) => {
    const next = asChartRange(r ?? undefined);
    if (next && !greyed.includes(next)) setPicked(next);
  });
  return (
    <View style={styles.wrap}>
      <RangeGainLine range={range} gain={gain} rollKey={`${symbol}-${range}`} />
      <Chart
        points={ready ? series.points : []}
        base={series.base}
        tone={holding ? holding.tone : undefined}
        axis={ready ? series.axis : LOADING_AXIS}
        height={height}
        bleed={bleed}
        live={live}
        drawKey={`${symbol}-${range}`}
        formatValue={(v) => formatMoney(v)}
        accessibilityLabel={`${symbol} price`}
        captureScrubAction="stockscrub"
      />
      <RangePills options={CHART_RANGES} value={range} onChange={setPicked} variant="pills" disabled={greyed} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space[3],
  },
});
