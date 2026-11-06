/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/sp/Text';
import { Icon } from '@/components/sp/Icon';
import { Skeleton } from '@/components/Skeleton';
import { space } from '@/constants/tokens';
import { priceCell, QUEUE_ROW_TEXT_MAX_SCALE, rowLabel, type QueuePrice } from '@/lib/game/queueRow';

// Stockpile — one row of the pre-draft queue (Giorgio 2026-11-05, option A; docs/PRODUCT_RULES.md "The queue row").
// The position, the ticker over the company name with the price on the ticker's line, then up / down / remove.
//
//  - The TICKER IS NEVER CUT or split: it can't shrink (flexShrink 0) and sits on a line that wraps, so when the ticker and
//    the price don't both fit, the price drops under the ticker (right-aligned) instead of the ticker losing letters.
//    Only the company name ends in "…", and it gets all the width left of the buttons.
//  - The price is a money number (700): "–" when there is none (never "$0.00", never a blank), a placeholder bar while it loads.
//  - Every line of text stops at 1.3× (as Holdings and Schedule rows do), so the three 44pt buttons stay on the row.

export interface QueueRowProps {
  /** 0-based position in the queue. */
  index: number;
  count: number;
  symbol: string;
  /** The company: a string; null = none found (no line); undefined = still loading. */
  name: string | null | undefined;
  /** Undefined = still loading. */
  price: QueuePrice | undefined;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}

export function QueueRow({ index, count, symbol, name, price, onMove, onRemove }: QueueRowProps) {
  const { fontScale } = useWindowDimensions();
  const bar = Math.min(fontScale, QUEUE_ROW_TEXT_MAX_SCALE); // the placeholder bars follow the capped text
  const cell = priceCell(price);
  return (
    <View style={styles.row}>
      <Text variant="caption" tone="secondary" maxFontSizeMultiplier={QUEUE_ROW_TEXT_MAX_SCALE} style={styles.pos}>{index + 1}</Text>
      <View style={styles.body} accessible accessibilityLabel={rowLabel(symbol, name, price)}>
        <View style={styles.tickerLine}>
          <Text variant="ticker" maxFontSizeMultiplier={QUEUE_ROW_TEXT_MAX_SCALE} style={styles.sym} testID="queue-row-ticker">{symbol}</Text>
          {cell.kind === 'loading' ? (
            <Skeleton width={Math.round(56 * bar)} height={Math.round(15 * bar)} style={styles.priceBar} />
          ) : (
            <Text
              variant="score.sm"
              tone={cell.text === '–' ? 'secondary' : 'primary'}
              maxFontSizeMultiplier={QUEUE_ROW_TEXT_MAX_SCALE}
              style={styles.price}
              testID="queue-row-price"
            >
              {cell.text}
            </Text>
          )}
        </View>
        {name === undefined ? (
          <Skeleton width="60%" height={Math.round(12 * bar)} />
        ) : name ? (
          <Text variant="caption" tone="secondary" maxFontSizeMultiplier={QUEUE_ROW_TEXT_MAX_SCALE} numberOfLines={1} ellipsizeMode="tail" testID="queue-row-name">{name}</Text>
        ) : null}
      </View>
      {/* Nothing tappable does nothing (W4): a move that can't happen isn't drawn (the first row has no up, the last no down);
          its 44 pt slot stays, so the columns hold still. */}
      {index > 0 ? (
        <Pressable onPress={() => onMove(-1)} accessibilityRole="button" accessibilityLabel={`Move ${symbol} up`} style={styles.hit}>
          <Icon name="chevronUp" size="callout" tone="text2" />
        </Pressable>
      ) : <View style={styles.hit} />}
      {index < count - 1 ? (
        <Pressable onPress={() => onMove(1)} accessibilityRole="button" accessibilityLabel={`Move ${symbol} down`} style={styles.hit}>
          <Icon name="chevronDown" size="callout" tone="text2" />
        </Pressable>
      ) : <View style={styles.hit} />}
      <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${symbol} from your queue`} style={styles.hit}>
        <Icon name="close" size="callout" tone="text2" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 52, paddingVertical: space[2] },
  pos: { minWidth: 20, fontVariant: ['tabular-nums'] },
  // The text column takes every point left of the buttons; minWidth 0 lets the company name (not the ticker) give way.
  body: { flex: 1, minWidth: 0, gap: space[1] },
  // A line that wraps: the price sits on the ticker's line while both fit, else it drops under the ticker.
  tickerLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: space[3] },
  // The ticker never shrinks, so it is never cut or split.
  sym: { flexShrink: 0 },
  price: { flexShrink: 0, marginLeft: 'auto', fontWeight: '700', fontVariant: ['tabular-nums'] },
  priceBar: { marginLeft: 'auto' },
  // Each icon button reaches 44 pt (the craft floor).
  hit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
