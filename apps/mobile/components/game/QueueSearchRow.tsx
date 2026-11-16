/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { Pressable, StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';
import { Icon } from '@/components/sp/Icon';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { COPY } from '@/lib/money/moneyCopy';
import { QUEUE_SEARCH_ROW_MAX_SCALE } from '@/lib/game/queueSearchRow';

// The queue list's last row (board #call-queue-card, B): a "+" in the rank column, then "Search by ticker or name" in the accent colour,
// semibold; no inset box and no border. The same height and left edge as a queue row (QueueRow: minHeight 52, 8pt gaps, a 20pt rank
// column), a thin divider above it, and the WHOLE row is the target. The words are the existing placeholder (COPY.stockSearchPlaceholder).
// At the largest sizes the text stops at 1.6x and wraps in its own column beside the "+", never clipped.

export function QueueSearchRow({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="search"
      accessibilityLabel={COPY.stockSearchPlaceholder}
      testID="queue-search-row"
      style={[styles.row, { borderTopColor: colors.border }]}
    >
      <View style={styles.rank}>
        <Icon name="add" size="callout" tone="accent" />
      </View>
      <Text variant="body" color={colors.accent} maxFontSizeMultiplier={QUEUE_SEARCH_ROW_MAX_SCALE} style={styles.label}>
        {COPY.stockSearchPlaceholder}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // A queue row's frame (QueueRow.styles.row) plus the divider: the list's rows have none, so the line sits above the last one only.
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 52, paddingVertical: space[2], borderTopWidth: StyleSheet.hairlineWidth },
  // The rank column (QueueRow.styles.pos: minWidth 20); the "+" is its glyph.
  rank: { minWidth: 20, alignItems: 'flex-start', justifyContent: 'center' },
  label: { flex: 1, minWidth: 0, fontWeight: '600' },
});
