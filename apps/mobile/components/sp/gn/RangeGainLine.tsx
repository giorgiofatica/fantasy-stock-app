import { View } from 'react-native';

import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { RollingGainPair } from '@/components/money/RollingGainPair';
import { NBSP } from '@/lib/game/keepDots';
import { rangeGainText, type ChartRange, type RangeGain } from '@/lib/chart/chartRanges';

// Stockpile — <RangeGainLine>: the gain beside a chart, the SAME component on Portfolio, the
// stock sheet and the player card (Giorgio, 2026-11-17: "A both numbers and A with past 6 months
// word example"). "+$54.60 (+41.42%) past 6 months": the dollars, the percent in brackets, no dot
// between the numbers. It follows the selected range (the chart, this line and the axis change
// together), and its colour is the chart's colour (RangeGain.tone: lineTone over the drawn points, or
// the holding's P/L sign on the player card), so the text and the stroke can never disagree. It sits
// directly above the chart.
//
// Rolling (Design Lead gate, 2026-11-17): the two numbers roll on a quote refresh, like Portfolio's
// "today" line. `rollKey` changes with the range (and the symbol), so a PILL TAP swaps the line at
// once, never rolling one range's figure into another's.
//
// Colour (Giorgio, 2026-11-18, pick A): only the NUMBERS take the chart's colour; the period words are
// the app's grey, regular weight. Brackets, wrapping and that colour split are RollingGainPair's, the
// same component Portfolio's "today" and a manager's portfolio draw. Capped at 1.3x like Portfolio's
// hero lines, so it never outgrows the value above it at the large sizes.

const GAIN_LINE_MAX_SCALE = 1.3;

/** The app's dash for a figure that cannot be worked out (Schedule's, the player card's week gain): never a blank, which reads
 * as a rendering fault (the Planner, 2026-11-19). */
const UNKNOWN_DASH = '\u2013';

export function RangeGainLine({ range, gain, rollKey, unknown = false }: { range: ChartRange; gain: RangeGain | null; rollKey: string; unknown?: boolean }) {
  const { colors } = useTheme();
  if (!gain && unknown) {
    // The chart has nothing to draw (no date has a real close for every holding) and no gain can be worked out: the dash.
    return <Text variant="callout" tone="secondary" maxFontSizeMultiplier={GAIN_LINE_MAX_SCALE} testID="range-gain-unknown">{UNKNOWN_DASH}</Text>;
  }
  if (!gain) {
    // Nothing drawn yet (the bars are loading): keep the line's height, say nothing.
    return <Text variant="callout" maxFontSizeMultiplier={GAIN_LINE_MAX_SCALE} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{NBSP}</Text>;
  }
  const text = rangeGainText(range, gain);
  const color = colors[gain.tone];
  return (
    <View accessible accessibilityLabel={text.label} testID="range-gain-line">
      <RollingGainPair money={text.money} pct={text.pct} words={text.keptWords} color={color} rollKey={rollKey} maxScale={GAIN_LINE_MAX_SCALE} />
    </View>
  );
}
