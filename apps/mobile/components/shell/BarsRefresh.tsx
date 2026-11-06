/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Platform, RefreshControl, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFixtureScrollEnd } from '@/lib/shell/fixtureRoute';
import { useCaptureAction } from '@/lib/money/captureScript';
import { ScrollFoldContext, useScrollFoldSource } from './scrollFold';
import { ScrollRevealContext, makeScrollReveal } from './scrollReveal';
import { TopFade } from './TopFade';
import { revealMargin } from './topBarFade';
import Animated, {
  cancelAnimation,
  runOnJS,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { space } from '@/constants/tokens';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { useMotion } from '@/components/sp/motion';
import { BrandBars, BRAND_BAR_STAGGER_MS } from '@/components/shell/BrandBars';

// Phase 3b-1 — S5, the custom pull-to-refresh.
//
// iOS: the three brand bars sit just above the content and are revealed by
// the overscroll; each rises with the pull distance (bar i starts a little
// after bar i−1). Past the threshold it arms, with one light haptic;
// releasing there starts the refresh, holds the bars in view, and they
// pulse ONLY while the refresh is actually in flight — a progress
// indicator, never a decorative loop. It follows the theme (accent + text2).
// Android: an accent-tinted RefreshControl (approved fallback — no bounce
// overscroll to reveal the bars).
// Reduce Motion: no rise and no pulse — a static bar icon with a
// "Refreshing…" label while it runs.
//
// The top bar (2026-11-06, "A for both"): a tab passes its ShellHeader as `header`, and it is the FIRST thing inside the
// scroll content, so it scrolls up with the page instead of sitting above it as a fixed frame. Once the page has scrolled,
// TopFade fades the page colour out behind the status bar (topBarFade.ts), and iOS scroll-to-top (a tap on the clock) is on for
// this one main scroll view. The pull's bars sit just under the status bar, above the bar, so they never run into the clock.

const THRESHOLD = 72;
const HEADER = 64;

export interface BarsRefreshProps {
  /** Omitted: the page scrolls and bounces but does not refresh (no bars, no spinner). */
  onRefresh?: () => Promise<void>;
  children: ReactNode;
  /** Applies to the page BELOW the header (its padding and gap), so the header spans the full width. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** The tab's top bar (ShellHeader): rendered first inside the scroll content, so it scrolls away with the page. */
  header?: ReactNode;
  /** The page colour the fade behind the status bar fades from (default: the game screens' `bg`). */
  fadeColor?: string;
}

export function BarsRefresh({ onRefresh, children, contentContainerStyle, header, fadeColor }: BarsRefreshProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  // Where the search reveal puts a field: just under the status-bar fade (the bar is part of the content now).
  const marginRef = useRef(revealMargin(insets.top));
  marginRef.current = revealMargin(insets.top);
  const getRevealMargin = () => marginRef.current;
  const [refreshing, setRefreshing] = useState(false);
  // 3c-2, UX rule 7: children can tell what's below the fold (StandingsTable pins your row).
  const fold = useScrollFoldSource();
  const measureRef = useRef<View>(null);
  // The Android branch's own scroll view (the iOS one keeps its ref in IosBarsRefresh).
  const androidScrollRef = useRef<Animated.ScrollView>(null);
  const androidReveal = useRef(makeScrollReveal(() => androidScrollRef.current as never, getRevealMargin)).current;
  const onAndroidScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
      runOnJS(fold.emit)();
    },
  });
  const onViewLayout = () => {
    measureRef.current?.measureInWindow((_x, y, _w, h) => fold.setViewport({ top: y, bottom: y + h }));
  };

  const run = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  if (Platform.OS !== 'ios') {
    return (
      <View ref={measureRef} style={styles.fill} onLayout={onViewLayout}>
        <ScrollFoldContext.Provider value={fold.value}>
          <ScrollRevealContext.Provider value={androidReveal}>
          <Animated.ScrollView
            ref={androidScrollRef}
            // A search field low on the tab scrolls above the keyboard, and a tap on a result selects it (iOS does the same below).
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.page}
            onScroll={onAndroidScroll}
            scrollEventThrottle={16}
            refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={run} colors={[colors.accent]} tintColor={colors.accent} /> : undefined}
          >
            {header}
            <View style={[contentContainerStyle, styles.pageBody]}>{children}</View>
          </Animated.ScrollView>
          </ScrollRevealContext.Provider>
          <TopFade scrollY={scrollY} color={fadeColor ?? colors.bg} />
        </ScrollFoldContext.Provider>
      </View>
    );
  }
  return (
    <View ref={measureRef} style={styles.fill} onLayout={onViewLayout}>
      <ScrollFoldContext.Provider value={fold.value}>
        <IosBarsRefresh
          refreshing={refreshing}
          run={run}
          canRefresh={!!onRefresh}
          header={header}
          contentContainerStyle={contentContainerStyle}
          onScrolled={fold.emit}
          scrollY={scrollY}
          topInset={insets.top}
          getRevealMargin={getRevealMargin}
        >
          {children}
        </IosBarsRefresh>
        <TopFade scrollY={scrollY} color={fadeColor ?? colors.bg} />
      </ScrollFoldContext.Provider>
    </View>
  );
}

function IosBarsRefresh({
  refreshing,
  run,
  canRefresh,
  header,
  children,
  contentContainerStyle,
  onScrolled,
  scrollY,
  topInset,
  getRevealMargin,
}: {
  refreshing: boolean;
  run: () => void;
  /** False: no onRefresh was given, so a pull stretches the page and nothing more. */
  canRefresh: boolean;
  header?: ReactNode;
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** The fold signal (throttled on the JS side). */
  onScrolled: () => void;
  /** The page's scroll offset, for the fade behind the status bar. */
  scrollY: SharedValue<number>;
  /** The status bar's inset: the pull's bars start below it. */
  topInset: number;
  getRevealMargin: () => number;
}) {
  const { reduced, duration, easing } = useMotion();
  const pull = useSharedValue(0);
  const armed = useSharedValue(false);
  const pulse = [useSharedValue(1), useSharedValue(1), useSharedValue(1)] as const;
  const scrollRef = useRef<Animated.ScrollView>(null);
  // A search field low on the tab asks for itself to be scrolled up above the keyboard (scrollReveal.ts).
  const reveal = useRef(makeScrollReveal(() => scrollRef.current as never, getRevealMargin)).current;
  // DEV captures only (lib/shell/fixtureRoute.ts).
  useFixtureScrollEnd(scrollRef as never);
  // DEV capture script only (a no-op without the seam and a script): scroll to y, as a swipe would.
  useCaptureAction('scrollto', (y) => scrollRef.current?.scrollTo({ y: Number(y) || 0, animated: false }));

  const armHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      runOnJS(onScrolled)();
      scrollY.value = e.contentOffset.y;
      pull.value = canRefresh ? Math.max(0, -e.contentOffset.y) : 0;
      const nowArmed = pull.value >= THRESHOLD;
      if (nowArmed && !armed.value) runOnJS(armHaptic)();
      armed.value = nowArmed;
    },
    onEndDrag: () => {
      if (armed.value) runOnJS(run)();
    },
  });
  // The bars sit under the status bar, above the top bar, and show only while there is a pull (or a refresh) to show:
  // at rest they would otherwise sit behind the clock.
  const barsStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pull.value / 6) }));

  // While in flight: hold the bars in view, and pulse them (full motion only).
  useEffect(() => {
    if (!refreshing) {
      pulse.forEach((p) => {
        cancelAnimation(p);
        p.value = 1;
      });
      return;
    }
    scrollRef.current?.scrollTo({ y: -HEADER, animated: !reduced });
    if (reduced) return;
    pulse.forEach((p, i) => {
      p.value = withDelay(
        i * BRAND_BAR_STAGGER_MS,
        withRepeat(
          withSequence(withTiming(0.45, { duration: duration.base, easing: easing.settle }), withTiming(1, { duration: duration.base, easing: easing.settle })),
          -1
        )
      );
    });
    // pulse values are stable refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshing, reduced, duration.base, easing.settle]);

  // Bar i rises over its own slice of the pull; held full while refreshing.
  const rise0 = useRise(pull, 0, refreshing, reduced, pulse[0]);
  const rise1 = useRise(pull, 1, refreshing, reduced, pulse[1]);
  const rise2 = useRise(pull, 2, refreshing, reduced, pulse[2]);

  return (
    <Animated.ScrollView
      ref={scrollRef}
      onScroll={onScroll}
      scrollEventThrottle={16}
      // A field near the end of a tab (the draft queue's search) scrolls above the
      // keyboard, and a tap on a search result selects it rather than only
      // dismissing the keyboard. Both act only while the keyboard is up.
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      // A tap on the clock scrolls this, the one main scroll view of the tab, to the top (the bar is up there).
      scrollsToTop
      contentInset={{ top: refreshing ? HEADER : 0 }}
      contentContainerStyle={styles.page}
      accessibilityState={{ busy: refreshing }}
    >
      <Animated.View style={[styles.header, { top: topInset - HEADER }, barsStyle]} accessibilityLiveRegion="polite">
        <BrandBars size={28} rise={[rise0, rise1, rise2]} />
        {reduced && refreshing ? (
          <Text variant="caption" tone="secondary">
            Refreshing…
          </Text>
        ) : null}
      </Animated.View>
      {header}
      <View style={[contentContainerStyle, styles.pageBody]}>
        <ScrollRevealContext.Provider value={reveal}>{children}</ScrollRevealContext.Provider>
      </View>
    </Animated.ScrollView>
  );
}

function useRise(pull: SharedValue<number>, i: number, refreshing: boolean, reduced: boolean, pulse: SharedValue<number>) {
  return useDerivedValue(() => {
    if (reduced) return 1; // a static bar icon
    if (refreshing) return pulse.value;
    const start = (i * THRESHOLD) / 4;
    return Math.min(1, Math.max(0, (pull.value - start) / (THRESHOLD / 2)));
    // `refreshing` / `reduced` are JS-side values captured by the worklet.
  }, [refreshing, reduced]);
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  // The scroll content: the header, then the page. The page grows to fill a short tab (the placeholders centre in it).
  page: {
    flexGrow: 1,
  },
  pageBody: {
    flexGrow: 1,
  },
  header: {
    position: 'absolute',
    top: -HEADER,
    left: 0,
    right: 0,
    height: HEADER,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
});
