/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { useEffect } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { radius } from '@/constants/tokens';
import { ClockRing } from '@/components/sp/gn';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { useMotion } from '@/components/sp/motion';
import {
  CHIP_EDGE, CHIP_GAP, CHIP_MAX_SCALE, CHIP_MIN_HEIGHT, CHIP_PADDING, CHIP_RISE, CHIP_TOP,
  CLOCK_CHIP_HINT, CLOCK_CHIP_TEXT, CHIP_RING_STROKE, chipRingSize, clockChipLabel,
} from '@/lib/game/draftClockChip';

// The draft room's pinned clock (draftClockChip.ts; Giorgio, 2026-11-06, option A): the ring, the seconds and "Your pick", in a small
// pill at the top of the page while your clock is running and the card's own ring has scrolled away. It sits in BarsRefresh's pinned
// slot, so it does not scroll. It stays mounted for the whole of your running clock (so its height is known to the search's reveal)
// and fades in / out with `visible`; hidden, it takes no touch and says nothing to VoiceOver.

export interface DraftClockChipProps {
  visible: boolean;
  /** "0:42" (pickClockLabel). */
  label: string;
  secondsLeft: number | null;
  totalSeconds: number;
  tone: 'live' | 'loss';
  onPress: () => void;
  /** The pill's measured height (the reveal's margin is built from it). */
  onHeight: (h: number) => void;
}

export function DraftClockChip({ visible, label, secondsLeft, totalSeconds, tone, onPress, onHeight }: DraftClockChipProps) {
  const { colors, elevation } = useTheme();
  const { reduced, duration, easing } = useMotion();
  const { fontScale } = useWindowDimensions();
  const shown = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(visible ? 1 : 0, { duration: duration.quick, easing: easing.settle });
    // shown is a stable shared value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, duration.quick, easing.settle]);
  // Fades in and rises from CHIP_RISE; Reduce Motion: opacity only.
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: reduced ? 0 : (1 - shown.value) * CHIP_RISE }],
  }));

  return (
    <Animated.View
      style={[styles.wrap, style]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={clockChipLabel(label)}
        accessibilityHint={CLOCK_CHIP_HINT}
        onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
        style={[styles.pill, elevation.card, { backgroundColor: colors.surface }]}
      >
        {/* The tint over an opaque underlay (the tint alone is see-through, and content scrolls under the chip). */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint, { backgroundColor: colors.accentTint }]} />
        {/* The 2pt live edge, over the rim, the same as the clock card's. */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.edge, { borderColor: colors.live }]} />
        <ClockRing label={label} secondsLeft={secondsLeft} totalSeconds={totalSeconds} tone={tone} textColor={colors.text} bare size={chipRingSize(fontScale)} stroke={CHIP_RING_STROKE} />
        <Text variant="score.md" color={colors.text} maxFontSizeMultiplier={CHIP_MAX_SCALE} numberOfLines={1}>{label}</Text>
        <Text variant="score.sm" color={colors.liveText} maxFontSizeMultiplier={CHIP_MAX_SCALE} numberOfLines={1}>{CLOCK_CHIP_TEXT}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // CHIP_TOP below the slot's top (the fade's lower edge).
  wrap: { marginTop: CHIP_TOP },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CHIP_GAP,
    minHeight: CHIP_MIN_HEIGHT,
    paddingTop: CHIP_PADDING.top,
    paddingBottom: CHIP_PADDING.bottom,
    paddingLeft: CHIP_PADDING.left,
    paddingRight: CHIP_PADDING.right,
    borderRadius: radius.pill,
  },
  tint: { borderRadius: radius.pill },
  edge: { borderWidth: CHIP_EDGE, borderRadius: radius.pill },
});
