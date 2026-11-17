import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { NBSP } from '@/lib/game/keepDots';
import { rangeGainText, type ChartRange, type RangeGain } from '@/lib/chart/chartRanges';

// Stockpile — <RangeGainLine>: the gain beside a chart, the SAME component on Portfolio, the
// stock sheet and the player card (Giorgio, 2026-11-17: "A both numbers and A with past 6 months
// word example"). "+$54.60 (+41.42%) past 6 months": the dollars, the percent in brackets, no dot
// between the numbers. It follows the selected range (the chart, this line and the axis change
// together), and its colour is the LINE's colour (RangeGain.tone is lineTone over the drawn
// points), so the text and the stroke can never disagree. It sits directly above the chart.
//
// Wrapping: the figures are one unbreakable run and so is the period phrase; the one space
// between them is the only place the line may break (chartRanges.rangeGainText). Capped at 1.3x
// like Portfolio's hero lines, so it never outgrows the value above it at the large sizes.

const GAIN_LINE_MAX_SCALE = 1.3;

export function RangeGainLine({ range, gain }: { range: ChartRange; gain: RangeGain | null }) {
  const { colors } = useTheme();
  if (!gain) {
    // Nothing drawn yet (the bars are loading): keep the line's height, say nothing.
    return <Text variant="callout" maxFontSizeMultiplier={GAIN_LINE_MAX_SCALE} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{NBSP}</Text>;
  }
  const text = rangeGainText(range, gain);
  const color = colors[gain.tone];
  return (
    <Text
      variant="callout"
      color={color}
      maxFontSizeMultiplier={GAIN_LINE_MAX_SCALE}
      accessible
      accessibilityLabel={text.label}
      testID="range-gain-line"
      style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}
    >
      {`${text.keptFigures} ${text.keptWords}`}
    </Text>
  );
}
