/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
/**
 * SearchRow: one stock search result, for the Stocks tab's search (moved here from the retired stock-search screen,
 * unchanged). Every result says who owns it (board #buy-a-stock, the Design Lead's ruling): "You own this" in your
 * colour, "Owned by {name}", "No free slot" when every slot of yours is held (W4), or nothing when it's free. Only a
 * stock that isn't in the league's list is dimmed and can't be tapped ("Not in this league's list"): it's disabled
 * WITH its reason, never a silent row.
 *
 * Game Night: rows like Portfolio's (the ticker disc, the ticker, the status line, the company, the price at 800,
 * tabular), no rule lines between them and no sparklines.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';
import { Icon } from '@/components/sp/Icon';
import { PressableScale } from '@/components/sp/PressableScale';
import { Text } from '@/components/sp/Text';
import { formatMoney } from '@/components/sp/logic/money';
import { useTheme } from '@/components/sp/ThemeProvider';
import { ROW_TEXT_MAX_SCALE } from '@/components/money/HoldingRow';
import { TickerBadge } from '@/components/sp/gn/TickerBadge';
import { keepMoney } from '@/lib/game/keepDots';
import type { OwnershipSuffix } from '@/lib/money/stockSearchOwnership';
import type { ShapedSearchResult } from '@/lib/symbolSearch';

/** One result: the disc, the ticker, the status on its own line, the company; the price. A
 * stock not in the league's list is dimmed with its reason and isn't a button at all. */
export function SearchRow({ item, status, onPress }: { item: ShapedSearchResult; status: OwnershipSuffix; onPress: () => void }) {
  const { colors } = useTheme();
  const off = !item.selectable;
  const label = [item.symbol, item.name, status.text, item.price != null ? formatMoney(item.price) : null].filter(Boolean).join(', ');
  const content = (
    <>
      <TickerBadge symbol={item.symbol} style={off ? styles.dim : null} />
      <View style={styles.lead}>
        <Text variant="ticker" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE}>{item.symbol}</Text>
        {status.text ? (
          <Text
            testID="search-row-status"
            variant="caption"
            maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE}
            color={status.mine ? colors.youText : undefined}
            tone={status.mine ? undefined : 'secondary'}
            style={status.mine ? styles.extraBold : styles.bold}
          >
            {status.text}
          </Text>
        ) : null}
        <Text variant="caption" tone="secondary" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} numberOfLines={1}>{item.name}</Text>
      </View>
      {item.price != null ? (
        <Text variant="score.sm" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} style={[styles.price, styles.bold, off ? styles.dim : null]}>{keepMoney(formatMoney(item.price))}</Text>
      ) : null}
      {off ? <View style={styles.chevronSpace} /> : <Icon name="chevronRight" size="callout" tone="text2" />}
    </>
  );
  if (off) {
    return (
      // Not a button. Only the disc and the price dim (W4 DL gate): the reason stays in `text2`
      // at full opacity (dimmed, it fell to 2.44:1 / 2.04:1).
      <View style={styles.row} accessible accessibilityLabel={label} accessibilityState={{ disabled: true }} testID={`search-row-off-${item.symbol}`}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.row} testID={`search-row-${item.symbol}`}>
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[4], paddingVertical: space[3] },
  lead: { flex: 1, minWidth: 0, gap: space[1] },
  price: { flexShrink: 0 },
  chevronSpace: { width: 16 },
  dim: { opacity: 0.45 },
  bold: { fontWeight: '700' },
  extraBold: { fontWeight: '800' },
});
