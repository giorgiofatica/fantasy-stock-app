/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { StyleSheet } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clearOf, topFadeHeight, topFadeOpacity, topFadeStops } from '@/components/shell/topBarFade';

// The page colour behind the status bar / clock, faded out over a few points once the page has scrolled (topBarFade.ts).
// It sits over the top of a tab's scroll view and takes no touches. At rest it is invisible, so the bar at the top of
// the page looks the same as ever.

export function TopFade({ scrollY, color }: { scrollY: SharedValue<number>; color: string }) {
  const insets = useSafeAreaInsets();
  const style = useAnimatedStyle(() => ({ opacity: topFadeOpacity(scrollY.value) }));
  return (
    <Animated.View pointerEvents="none" style={[styles.fade, { height: topFadeHeight(insets.top) }, style]}>
      <LinearGradient colors={[color, color, clearOf(color)]} locations={[0, topFadeStops(insets.top)[0], 1]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', top: 0, left: 0, right: 0 },
});
