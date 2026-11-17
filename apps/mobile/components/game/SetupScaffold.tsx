/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { ReactNode, useRef } from 'react';
import { useFixtureScrollEnd } from '@/lib/shell/fixtureRoute';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space } from '@/constants/tokens';
import { Icon } from '@/components/sp/Icon';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { ScreenTitle } from '@/components/shell/ScreenTitle';
import { useScreenTopInset } from '@/components/shell/ScreenPresentation';
import { SheetBar, type SheetBarConfig } from '@/components/shell/SheetBar';
import { useSheetScrollEdge } from '@/components/shell/useSheetScrollEdge';

// 3c-2 — the frame Create league and League settings share (board: "Create
// league · Season" / "· Draft step"): a back row with the "Step N of 4"
// caption on the right, the 4-segment progress bar, the step title and its
// subtitle, a scrolling body, and a footer that rides above the keyboard.
// Modeled on 3b-1's AuthScaffold rather than extending it, so the shell's
// shared frame stays untouched.

/** The standout stays loudest (W4 Onboarding gate, Design Lead 2026-10-14): the step title is
 * `display` (32pt, its own 1.6× = 51.2pt). Uncapped, the subtitle (body 15pt) reached the title's
 * cap height at XXXL and ran four lines, pushing the card below the fold; the "Back · Step N of 4"
 * row grew past the subtitle. Capped: subtitle 2× (30pt), the top row 1.6× (20.8pt / 19.2pt). */
export const SUBTITLE_MAX_SCALE = 2;
export const TOP_ROW_MAX_SCALE = 1.6;

export interface SetupScaffoldProps {
  /** Omitted on a screen with nowhere to go back to (Create league's first step and done screen), and in a sheet (`sheet`). */
  back?: { label: string; onPress: () => void };
  /** The × at the top right (Create league, every step): closes the whole flow at once, no prompt (PRODUCT_RULES, 2026-11-17, "A").
   * `disabled` while the create request is in flight. Omitted on the done screen and in a sheet (the sheet bar has its own). */
  close?: { onPress: () => void; disabled?: boolean };
  /** A page sheet (League settings): the shared top bar replaces the back row and the big title; no step, no subtitle. */
  sheet?: SheetBarConfig & {
    /** A problem with what the bar holds (the league's name), right under the bar, in today's words. */
    error?: string | null;
  };
  /** Shows "Step N of M" and the progress bar (Create league only). */
  step?: { number: number; total: number };
  /** The step title; unused in a sheet, whose title lives in the bar. */
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Docked under the body; lifted above the keyboard when it opens. */
  footer?: ReactNode;
}

export function SetupScaffold({ back, close, sheet, step, title, subtitle, children, footer }: SetupScaffoldProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // None inside an iOS page sheet (League settings), which already starts below the status bar.
  const topInset = useScreenTopInset();
  // A sheet's bar shows its divider and fade once the body has scrolled under it.
  const { edge, onScroll } = useSheetScrollEdge();
  const scrollRef = useRef<ScrollView>(null);
  // DEV captures only (lib/shell/fixtureRoute.ts).
  useFixtureScrollEnd(scrollRef);

  // A sheet's title lives in its bar, so the body starts straight at the rows.
  const heading = sheet ? null : (
    <View style={styles.heading}>
      {step ? (
        // Decorative: the caption above already says which step this is.
        <View style={styles.progress} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: step.total }, (_, i) => (
            <View key={i} style={[styles.segment, { backgroundColor: i < step.number ? colors.accent : colors.border }]} />
          ))}
        </View>
      ) : null}
      <ScreenTitle>{title ?? ''}</ScreenTitle>
      {subtitle ? (
        <Text variant="body" tone="secondary" maxFontSizeMultiplier={SUBTITLE_MAX_SCALE}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.fill, { backgroundColor: colors.bg }]}>
      {sheet ? (
        <>
          <SheetBar {...sheet} edge={edge} />
          {sheet.error ? (
            <Text variant="callout" color={colors.danger} accessibilityLiveRegion="polite" style={styles.barError}>
              {sheet.error}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <View style={{ height: topInset }} />
          {/* Three columns, so "Step N of 4" sits at the true centre: Back (or nothing) | Step | × (flex 1 | auto | flex 1). */}
          <View style={styles.topRow}>
            <View style={styles.topSide}>
              {back ? (
                <Pressable onPress={back.onPress} accessibilityRole="button" accessibilityLabel={back.label} style={styles.back} hitSlop={8}>
                  <Icon name="chevronLeft" size="callout" tone="text2" />
                  <Text variant="callout" tone="secondary" maxFontSizeMultiplier={TOP_ROW_MAX_SCALE}>
                    {back.label}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.back} />
              )}
            </View>
            {step ? (
              <Text variant="caption" tone="secondary" maxFontSizeMultiplier={TOP_ROW_MAX_SCALE} style={styles.tabular}>
                {`Step ${step.number} of ${step.total}`}
              </Text>
            ) : null}
            <View style={[styles.topSide, styles.topSideRight]}>
              {close ? (
                <Pressable
                  onPress={close.disabled ? undefined : close.onPress}
                  disabled={close.disabled}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  accessibilityState={{ disabled: !!close.disabled }}
                  style={styles.close}
                  testID="setup-close"
                >
                  {/* Never grows with the text size ('tab' is the icon role that does not scale), in the text colour. */}
                  <Icon name="close" size="tab" tone="text" />
                </Pressable>
              ) : null}
            </View>
          </View>
        </>
      )}
      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={[styles.body, sheet ? styles.bodySheet : null, { paddingBottom: footer ? space[5] : insets.bottom + space[8] }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onScroll={sheet ? onScroll : undefined}
        scrollEventThrottle={sheet ? 16 : undefined}
      >
        {heading}
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space[5]) }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: space[3],
  },
  topSide: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topSideRight: {
    justifyContent: 'flex-end',
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    minHeight: 44,
    paddingHorizontal: space[5],
  },
  barError: {
    paddingHorizontal: space[6],
    paddingTop: space[3],
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  body: {
    paddingHorizontal: space[6],
    paddingTop: space[3],
    gap: space[5],
  },
  // Under a sheet's bar the rows start a full gutter-and-a-half below it (no heading in between).
  bodySheet: {
    paddingTop: space[5],
  },
  heading: {
    gap: space[2],
  },
  progress: {
    flexDirection: 'row',
    gap: space[2],
    marginBottom: space[4],
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  footer: {
    paddingHorizontal: space[6],
    paddingTop: space[3],
  },
});
