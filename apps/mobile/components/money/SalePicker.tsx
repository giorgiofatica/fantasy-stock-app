/**
 * SalePicker: "Which sale pays for this?" (3e, board #money). A per-slot buy is
 * paid from one sale's proceeds; this lists the server's sources, one radio row
 * each, and commits the chosen one. Rows come from salePicker.pickerRows; this
 * file only lays them out.
 *
 * Game Night (gn-sweep, §9C rules 1–2): the rows sit on an `inset` panel on the sheet's
 * `surface` (a lightness step), with no hairline edge and no line between rows.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius } from '@/constants/tokens';
import { Button } from '@/components/sp/Button';
import { useLabelBreaks } from '@/components/game/SetupRows';
import { keepMoney } from '@/lib/game/keepDots';
import { Icon } from '@/components/sp/Icon';
import { SheetBody } from '@/components/sp/Sheet';
import { formatMoney } from '@/components/sp/logic/money';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import type { PreviewSource } from '@/lib/money/buyingPower';
import { COPY } from '@/lib/money/moneyCopy';
import { pickerRows, saleButtonLabel, type PickerRow } from '@/lib/money/salePicker';

export interface SalePickerProps {
  sources: PreviewSource[];
  chosenId: string | null;
  onChoose: (tradeId: string) => void;
  onUse: () => void;
  onClose: () => void;
}

/** The sheet's small text follows Dynamic Type to 1.6x, as the stock sheet's and the review's do (SHEET_TEXT_MAX_SCALE,
 * REVIEW_TEXT_MAX_SCALE): `callout` has no ceiling of its own, so without this the picker drew at the full accessibility
 * scale beside sheets that were capped (phone pass step 34). */
const PICKER_TEXT_MAX_SCALE = 1.6;

const styles = StyleSheet.create({
  // The sources scroll; "Use …" is pinned under them (SheetBody). Same 20pt gutter and 12pt gap as before the split.
  scrollContent: { paddingHorizontal: 20, paddingBottom: 12 },
  stack: { gap: 12 },
  footer: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  close: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  radio: { width: 20, height: 20, borderRadius: 10 },
  // Beside: the label takes the room, the amount keeps its width. Stacked (the label broke inside a word): label, then the
  // amount under it, the way a stacked SettingRow reads.
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBodyStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
  rowLead: { flex: 1 },
  rowLeadStacked: { flexGrow: 0, flexShrink: 0, alignSelf: 'stretch' },
});

/** The radio: a filled ring when chosen, a 2pt control ring (borderStrong, ≥ 3:1) otherwise. */
function Radio({ selected }: { selected: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.radio,
        { borderWidth: selected ? 6 : 2, borderColor: selected ? colors.accent : colors.borderStrong },
      ]}
    />
  );
}

/** One source: radio, then the slot's label and its amount. Beside each other until the label would break inside a word
 * (useLabelBreaks, the label-no-midword rule), then the amount drops under the label. */
function SaleRow({ row: r, onChoose }: { row: PickerRow; onChoose: (tradeId: string) => void }) {
  const { broke, onTextLayout, onLayout, remountKey } = useLabelBreaks();
  return (
    <Pressable
      key={remountKey}
      accessibilityRole="radio"
      accessibilityState={{ checked: r.selected }}
      accessibilityLabel={`${r.label}, ${formatMoney(r.amount)}`}
      onPress={() => onChoose(r.tradeId)}
      style={styles.row}
    >
      <Radio selected={r.selected} />
      <View style={[styles.rowBody, broke && styles.rowBodyStacked]}>
        <View style={broke ? styles.rowLeadStacked : styles.rowLead} onLayout={onLayout}>
          <Text variant="callout" maxFontSizeMultiplier={PICKER_TEXT_MAX_SCALE} onTextLayout={onTextLayout}>{r.label}</Text>
        </View>
        <Text variant="callout" maxFontSizeMultiplier={PICKER_TEXT_MAX_SCALE}>{keepMoney(formatMoney(r.amount))}</Text>
      </View>
    </Pressable>
  );
}

export function SalePicker({ sources, chosenId, onChoose, onUse, onClose }: SalePickerProps) {
  const { colors } = useTheme();
  const rows = pickerRows(sources, chosenId);
  const chosen = rows.some((r) => r.selected);

  return (
    <SheetBody
      contentContainerStyle={styles.scrollContent}
      footerStyle={styles.footer}
      footer={<Button label={saleButtonLabel(rows)} variant="primary" fullWidth disabled={!chosen} onPress={onUse} testID="sale-picker-use" />}
    >
      <View style={styles.stack}>
        <View style={styles.header}>
          <Text variant="title">{COPY.whichSalePays}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8} style={styles.close}>
            <Icon name="close" size="body" tone="text2" />
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.inset }]}>
          {rows.map((r) => (
            <SaleRow key={r.tradeId} row={r} onChoose={onChoose} />
          ))}
        </View>
      </View>
    </SheetBody>
  );
}
