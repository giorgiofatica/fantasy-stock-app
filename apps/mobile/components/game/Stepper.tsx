/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { radius, space, typeFontFamily } from '@/constants/tokens';
import { FULL_WIDTH_FONT_SCALE } from '@/components/sp/Button';
import { Icon } from '@/components/sp/Icon';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { uniformValueWidth } from '@/lib/game/seasonStep';
import { infoSlotMargin } from '@/lib/game/stepperInfoSlot';

// 3c-2 — the board's stepper (inventory.jsx `Stepper`: label + optional sub on
// the left, a bordered − value + box on the right). The buttons are 44 pt
// (the craft floor; the board draws 36) and use sp/Icon remove/add, never a
// text glyph (§9B). For VoiceOver the whole control is ONE adjustable element
// (swipe up/down), the native iOS stepper pattern, announcing its value. At
// accessibility sizes the box wraps under the label instead of squeezing it.

export interface StepperProps {
  label: string;
  sub?: string;
  value: number;
  unit?: string;
  /** What VoiceOver says for `unit` when the screen abbreviates it ("11 wks" on screen, "11 weeks" spoken). Unset: `unit`. */
  unitSpoken?: string;
  /** A fixed-width value cell (seasonStep.ts, uniformValueWidth), so steppers side by side are identical boxes whatever their
   * value (Create league's Season step, B: "6", "11 wks", "4"). Unset: the cell grows with its value, as before. */
  uniformBox?: boolean;
  onStep: (direction: 1 | -1) => void;
  canDecrement: boolean;
  canIncrement: boolean;
  disabled?: boolean;
  /** The board's blocked state (the blockers card, "8 playoff teams, but 7 teams are in"):
   * a 2 pt warn-line border on the box. Warn, never red (§9B: blockers keep
   * the warn tint; red is for field errors, losses and destructive actions). */
  emphasis?: 'warn';
  /** A ceiling for the label's Dynamic Type scale (the blockers card caps it under its sub-card title). Unset: the label scales freely, as before. */
  labelMaxScale?: number;
  /** An "i" after the label (an <InfoButton>; UX rule 13). It must be reachable on its own, so the row is no longer ONE adjustable
   * element: the adjustable element is the − value + box (it carries the label and the value), the label text is hidden from
   * VoiceOver (the box already says it), and the "i" is a button beside it. Unset: the whole row is one adjustable element, as before. */
  labelInfo?: ReactNode;
}

export function Stepper({ label, sub, value, unit, unitSpoken, uniformBox = false, onStep, canDecrement, canIncrement, disabled = false, emphasis, labelMaxScale, labelInfo }: StepperProps) {
  const { colors } = useTheme();
  // At accessibility sizes the box goes UNDER the label (W4 Onboarding, XL): beside it, the label's
  // column was too narrow and "Managers" broke mid-word ("Manager / s").
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= FULL_WIDTH_FONT_SCALE;
  const down = !disabled && canDecrement;
  const up = !disabled && canIncrement;
  const valueText = unit ? `${value} ${unit}` : String(value);
  const spokenUnit = unitSpoken ?? unit;
  const valueSpoken = spokenUnit ? `${value} ${spokenUnit}` : String(value);

  const adjustable = {
    accessible: true as const,
    accessibilityRole: 'adjustable' as const,
    accessibilityLabel: sub ? `${label}, ${sub}` : label,
    accessibilityValue: { text: valueSpoken },
    accessibilityState: { disabled },
    accessibilityActions: [{ name: 'increment' }, { name: 'decrement' }],
    onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) => {
      if (e.nativeEvent.actionName === 'increment' && up) onStep(1);
      if (e.nativeEvent.actionName === 'decrement' && down) onStep(-1);
    },
  };
  const labelText = (
    <Text variant="callout" maxFontSizeMultiplier={labelMaxScale} style={styles.label}>
      {label}
    </Text>
  );
  const subText = sub ? (
    <Text variant="caption" tone="secondary">
      {sub}
    </Text>
  ) : null;
  const box = (
    <View
      {...(labelInfo ? adjustable : null)}
      style={[styles.box, emphasis === 'warn' ? { borderColor: colors.warnLine, borderWidth: 2 } : { borderColor: colors.border }]}
    >
      <Pressable onPress={() => down && onStep(-1)} disabled={!down} style={styles.button} hitSlop={2}>
        <Icon name="remove" size="headline" tone={down ? 'text' : 'text3'} />
      </Pressable>
      <View style={[styles.value, uniformBox && { minWidth: 0, width: uniformValueWidth(fontScale), paddingHorizontal: space[2] }, { borderColor: colors.border }]}>
        <Text variant="headline" style={styles.tabular}>
          {valueText}
        </Text>
      </View>
      <Pressable onPress={() => up && onStep(1)} disabled={!up} style={styles.button} hitSlop={2}>
        <Icon name="add" size="headline" tone={up ? 'text' : 'text3'} />
      </Pressable>
    </View>
  );

  return (
    <View {...(labelInfo ? null : adjustable)} style={[styles.row, stacked && styles.rowStacked, disabled && styles.dim]}>
      <View style={stacked ? styles.textsStacked : styles.texts}>
        {labelInfo ? (
          <>
            <View style={styles.labelWithInfo}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.labelShrink}>
                {labelText}
              </View>
              {/* The "i" keeps its 44 pt target but counts as one label line in the row (stepperInfoSlot.ts), so the row is as tall as the label. */}
              <View style={styles.infoSlot}>{labelInfo}</View>
            </View>
            {subText ? <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{subText}</View> : null}
          </>
        ) : (
          <>
            {labelText}
            {subText}
          </>
        )}
      </View>
      {box}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  rowStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  dim: {
    opacity: 0.5,
  },
  // `width: '100%'` is load-bearing. rowStacked is a COLUMN that still carries `row`'s flexWrap, so `alignSelf: 'stretch'` stretched
  // only to the widest content, not to the container (measured on the iPhone 17 simulator: Managers' text box 224 pt, Playoff teams' 337 pt, in a 330 pt card). A label row wider than the card then never
  // shrank its label: at AX5, "Playoff teams" (289 pt) + the "i" (44 + 4) in a 330 pt card made a 337 pt row that reserved TWO label
  // lines (128.7 pt) while the label drew on ONE (64.3 pt), so that row stood one label line taller than the others (the DL's P2-1,
  // 2026-11-11). At 100% the label shrinks to the width beside the "i" and wraps honestly, like "Regular season" does.
  textsStacked: {
    alignSelf: 'stretch',
    width: '100%',
    gap: space[1],
  },
  texts: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 140,
    gap: space[1],
  },
  label: {
    fontFamily: typeFontFamily.semiBold,
  },
  // The label and its "i": the label keeps its words (it wraps between them), the "i" stays at its end.
  labelWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space[2],
  },
  labelShrink: {
    flexShrink: 1,
  },
  infoSlot: {
    marginVertical: infoSlotMargin(),
  },
  box: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    minWidth: 64,
    paddingHorizontal: space[3],
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
