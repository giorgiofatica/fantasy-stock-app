/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { StyleSheet, View } from 'react-native';

import { RollingMoney } from '@/components/home/RollingMoney';
import { Text } from '@/components/sp/Text';
import { GAIN_PAIR_CLOSE, GAIN_PAIR_OPEN } from '@/components/sp/logic/money';

// Stockpile — <RollingGainPair>: ONE gain line, "+$X (+Y%) words", drawn the same on Portfolio, a
// manager's portfolio and the range gain above every chart.
//
// Two rulings live here and nowhere else (Giorgio, docs/PRODUCT_RULES.md):
//  - BRACKETS (2026-11-17, pick A): the dollars, then the percent in brackets, no dot between them.
//  - WORD COLOUR (2026-11-18, pick A): only the NUMBERS take the gain colour. The words ("today",
//    "since the draft", "past 6 months") are the app's grey (`secondary`), regular weight. The
//    brackets belong to the percent, so they take the figure's colour and weight.
//
// The money and the percent roll as two units (C-6/M3: one string misaligns mid-roll). The figures are
// one non-wrapping run, so a wrapped line breaks only before the words (§5 "Wrapping at XL"). The
// words' spaces are no-break (callers pass them already joined, or a single word), so the one place the
// line may break is between the figures and the words. Everything caps at `maxScale`; above it the sp
// Text primitive and RollingMoney turn the cap into an explicit size (cappedType.ts).

const NBSP = ' ';

export function RollingGainPair({ money, pct, words, color, rollKey, maxScale }: {
  money: string;
  pct: string;
  /** Said after the figures, in grey: "today", "since the draft". Omit for a bare pair. */
  words?: string;
  /** The gain colour for the numbers (sign-driven by the caller; zero stays the neutral grey). */
  color: string;
  rollKey: string;
  maxScale: number;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.nowrap}>
        <RollingMoney text={money} size="callout" fontWeight="700" color={color} rollKey={rollKey} maxScale={maxScale} />
        <Text variant="callout" color={color} maxFontSizeMultiplier={maxScale} style={styles.bold}>{`${NBSP}${GAIN_PAIR_OPEN}`}</Text>
        <RollingMoney text={pct} size="callout" fontWeight="700" color={color} rollKey={rollKey} maxScale={maxScale} />
        <Text variant="callout" color={color} maxFontSizeMultiplier={maxScale} style={styles.bold}>{GAIN_PAIR_CLOSE}</Text>
      </View>
      {words ? (
        <Text variant="callout" tone="secondary" maxFontSizeMultiplier={maxScale} style={styles.regular}>{`${NBSP}${words}`}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' },
  nowrap: { flexDirection: 'row', alignItems: 'baseline' },
  bold: { fontWeight: '700' },
  regular: { fontWeight: '400' },
});
