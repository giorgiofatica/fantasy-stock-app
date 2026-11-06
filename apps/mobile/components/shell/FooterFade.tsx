/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { StyleSheet } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { FOOTER_FADE_POINTS, clearOf, footerFadeOpacity } from '@/components/shell/topBarFade';

// The top bar's fade (TopFade), turned over: the page colour fades up over a few points ABOVE a docked footer, shown only while there
// is content below the scroll window to run under it. It takes no touches. It sits over the bottom edge of the scroll view, so the
// footer's top edge is never a hard cut through a line of text (topBarFade.ts has the numbers).

export function FooterFade({ scrollY, viewportHeight, contentHeight, color }: { scrollY: SharedValue<number>; viewportHeight: SharedValue<number>; contentHeight: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => ({
    opacity: footerFadeOpacity({ scrollY: scrollY.value, viewportHeight: viewportHeight.value, contentHeight: contentHeight.value }),
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.fade, style]}>
      <LinearGradient colors={[clearOf(color), color]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: FOOTER_FADE_POINTS },
});
