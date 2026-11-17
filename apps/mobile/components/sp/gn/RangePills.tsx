/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { radius, space } from '@/constants/tokens';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { rangeLook, rangeTabWidth, type RangeVariant } from '@/components/sp/logic/gameNight';

// Stockpile — <RangePills>, Game Night (§9C "RangePills"): the chart's range picker.
//   - `tabs` (Home): text tabs, the selected one in `text` with a 2pt `accent` underline;
//   - `pills` (money screens): the selected one a filled `accent` pill with `onAccent` ink.
// The ranges are the caller's (Home: Season / 1M / 1W; every money chart: the six of
// lib/chart/chartRanges, 1W · 1M · 3M · 6M · Season · YTD, on ONE row at every text size: the
// pills keep their 44pt target but the fill hugs the label, the row caps at 1.3x and a label
// that still would not fit shrinks, never wraps). Every option is a 44pt target; the selected
// one doesn't re-fire. A GREY option (`disabled`: a range longer than the history behind the
// chart) keeps its place, drawn dimmed: a tap does nothing, VoiceOver reads it as dimmed
// (accessibilityState.disabled), and it is never selected, even if `value` names it.

export interface RangePillsProps<R extends string> {
  options: readonly R[];
  value: R;
  onChange: (next: R) => void;
  variant: RangeVariant;
  /** Where the row sits: Home's tabs sit at the end of the line; money pills at the start. */
  align?: 'start' | 'end';
  /** Options drawn grey and inert: they keep their place in the row, never selected. */
  disabled?: readonly R[];
}

const UNDERLINE = 2;
// The tab bar's and SegmentedControl's Dynamic Type ceiling (GS-3), so range labels never truncate.
const LABEL_MAX_SCALE = 1.3;

export function RangePills<R extends string>({ options, value, onChange, variant, align = variant === 'tabs' ? 'end' : 'start', disabled = [] }: RangePillsProps<R>) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  // `tabs`: every box the same width (the widest label + 16, at least 44), the label centred,
  // so the labels sit evenly apart; the boxes touch, so no shared hit areas (no hitSlop).
  const tabWidth = variant === 'tabs' ? rangeTabWidth(options, fontScale) : undefined;
  return (
    <View accessibilityRole="tablist" style={[styles.row, variant === 'tabs' ? styles.rowTabs : styles.rowPills, { justifyContent: align === 'end' ? 'flex-end' : 'flex-start' }]}>
      {options.map((option) => {
        const dead = disabled.includes(option);
        const selected = option === value && !dead;
        const look = rangeLook(variant, selected, colors);
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled: dead }}
            disabled={dead}
            hitSlop={variant === 'tabs' ? undefined : 8}
            onPress={() => {
              if (selected || dead) return;
              Haptics.selectionAsync().catch(() => {});
              onChange(option);
            }}
            style={[styles.option, variant === 'pills' ? styles.pill : [styles.tab, { width: tabWidth }], look.fill ? { backgroundColor: look.fill } : null, dead ? styles.dead : null]}
          >
            {variant === 'tabs' ? (
              // The underline spans the LABEL, not the box: this view hugs the text.
              <View testID="range-tab-label">
                <Text variant="callout" color={look.ink} maxFontSizeMultiplier={LABEL_MAX_SCALE} style={selected ? styles.selected : styles.idle}>{option}</Text>
                <View style={[styles.underline, { backgroundColor: look.underline ?? 'transparent' }]} />
              </View>
            ) : (
              <Text variant="callout" color={look.ink} maxFontSizeMultiplier={LABEL_MAX_SCALE} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={selected ? styles.selected : styles.idle}>{option}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Equal boxes that touch: the space between labels is each box's own 16 (W4 gate).
  rowTabs: {
    gap: 0,
  },
  rowPills: {
    gap: space[2],
  },
  option: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // §9B: every option is a 44pt target, the text tabs too.
  tab: {
    minWidth: 44,
    paddingTop: space[2],
    alignItems: 'center',
  },
  // Six pills on one row at every text size: 8pt of fill each side (the 44pt target is the
  // minWidth and the hit slop), and a pill may shrink before the row would wrap.
  pill: {
    minWidth: 44,
    flexShrink: 1,
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    minHeight: 32,
    marginVertical: 6,
  },
  // A grey range is the app's one disabled look: 50% (Stepper.tsx, SetupRows.tsx), Design Lead gate 2026-11-17.
  dead: {
    opacity: 0.5,
  },
  underline: {
    marginTop: space[1],
    alignSelf: 'stretch',
    height: UNDERLINE,
    borderRadius: 1,
  },
  selected: {
    fontWeight: '800',
  },
  idle: {
    fontWeight: '600',
  },
});
