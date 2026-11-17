/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { RollingMoney } from '@/components/home/RollingMoney';
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
// Wrapping: the figures are one non-wrapping run, the period phrase another (its spaces are no-break),
// so the one place the line may break is between them. Capped at 1.3x like Portfolio's hero lines, so
// it never outgrows the value above it at the large sizes.

const GAIN_LINE_MAX_SCALE = 1.3;

export function RangeGainLine({ range, gain, rollKey }: { range: ChartRange; gain: RangeGain | null; rollKey: string }) {
  const { colors } = useTheme();
  if (!gain) {
    // Nothing drawn yet (the bars are loading): keep the line's height, say nothing.
    return <Text variant="callout" maxFontSizeMultiplier={GAIN_LINE_MAX_SCALE} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{NBSP}</Text>;
  }
  const text = rangeGainText(range, gain);
  const color = colors[gain.tone];
  return (
    <View accessible accessibilityLabel={text.label} testID="range-gain-line" style={styles.row}>
      <View style={styles.nowrap}>
        <RollingMoney text={text.money} size="callout" fontWeight="700" color={color} rollKey={rollKey} maxScale={GAIN_LINE_MAX_SCALE} />
        <Text variant="callout" color={color} maxFontSizeMultiplier={GAIN_LINE_MAX_SCALE} style={styles.bold}>{`${NBSP}(`}</Text>
        <RollingMoney text={text.pct} size="callout" fontWeight="700" color={color} rollKey={rollKey} maxScale={GAIN_LINE_MAX_SCALE} />
        <Text variant="callout" color={color} maxFontSizeMultiplier={GAIN_LINE_MAX_SCALE} style={styles.bold}>)</Text>
      </View>
      <Text variant="callout" color={color} maxFontSizeMultiplier={GAIN_LINE_MAX_SCALE} style={styles.bold}>{`${NBSP}${text.keptWords}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' },
  nowrap: { flexDirection: 'row', alignItems: 'baseline' },
  bold: { fontWeight: '700' },
});
