/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { forwardRef, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space } from '@/constants/tokens';
import { contentFits, footerSecondaryShown, keyboardUpAfter, revealOffset, settleOffset, stepReveal, type RevealEvent } from '@/components/shell/authFieldReveal';
import { FieldBlockContext } from '@/components/shell/FieldBlockContext';
import { FooterFade } from '@/components/shell/FooterFade';
import { Icon } from '@/components/sp/Icon';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';

// Phase 3b-1 — the frame every auth / first-run screen shares: the theme's
// `bg`, safe areas, a scrolling body, and an optional footer that rides
// above the keyboard (spec row 2: "the button stays above the keyboard").
// An optional back row matches the board's "‹ Back to sign in".
//
// Fields above the keyboard (auth-fields-above-keyboard, 2026-11-06): the footer is docked OUTSIDE the ScrollView, so with the
// keyboard up the scroll view's window is only what sits above that footer, and a form taller than the window hid its second
// field (Create account showed Email, then the button: Password was out of sight and the form read as email-only). A field
// that takes focus is now scrolled INTO that window, by the minimum it takes (authFieldReveal.ts: the field with its error and rules just
// clears the footer, and a field already in view does not move the page). The scaffold hears focus because it bubbles up from the TextInput
// to the ScrollView; a Field also names its whole view through FieldBlockContext, so the rules and the error count.

export interface AuthScaffoldProps {
  children: ReactNode;
  /** Docked under the body; lifted above the keyboard when it opens. */
  footer?: ReactNode;
  /** The footer's secondary line (create account's "Already have an account? Sign in"), docked under `footer` and hidden while the
   * keyboard is up, so the primary button is all the footer takes from the window the fields scroll in (authFieldReveal.ts). */
  footerSecondary?: ReactNode;
  back?: { label: string; onPress: () => void };
  /** Centre the body in the space above the footer (the invite arrival); it scrolls when it is taller. */
  centerBody?: boolean;
}

/** The slice of a ScrollView the reveal needs: its typings omit getInnerViewRef (the content view the field is measured against), which exists at runtime. */
interface RevealScroll {
  scrollTo(opts: { y: number; animated: boolean }): void;
  getInnerViewRef?: () => unknown;
}

export const AuthScaffold = forwardRef<ScrollView, AuthScaffoldProps>(function AuthScaffold({ children, footer, footerSecondary, back, centerBody }, ref) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // The scaffold's own handle on the ScrollView, beside the caller's (delete-account scrolls it to the end).
  const scrollRef = useRef<ScrollView | null>(null);
  const setScroll = useCallback(
    (node: ScrollView | null) => {
      scrollRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  const [keyboardUp, setKeyboardUp] = useState(false);
  const inField = useRef(false);
  const viewportHeight = useRef(0);
  const contentHeightRef = useRef(0);
  // Scrolling (and the bounce) only while the content is taller than the window (authFieldReveal.ts contentFits).
  const [scrollable, setScrollable] = useState(false);
  // The footer's fade (FooterFade): where the scroll window is in its content, so the fade shows only while content runs under the footer.
  const scrollY = useSharedValue(0);
  const windowHeight = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  // Where the scroll view is now (the onScroll below), and the focused Field's whole view (FieldBlockContext).
  const offset = useRef(0);
  const focusedBlock = useRef<View | null>(null);
  const announceBlock = useCallback((block: View | null) => {
    focusedBlock.current = block;
  }, []);

  /** Bring the focused field into the window by the minimum it takes: its error and rules too where they fit, the box always. */
  const revealFocused = useCallback(() => {
    const scroll = scrollRef.current as unknown as RevealScroll | null;
    const inner = scroll?.getInnerViewRef?.();
    const input = TextInput.State.currentlyFocusedInput();
    if (!scroll || !inner || !input) return;
    input.measureLayout(
      inner as never,
      (_x, inputTop, _w, inputHeight) => {
        const place = (blockTop: number, blockBottom: number) => {
          const y = revealOffset({
            current: offset.current,
            blockTop,
            blockBottom,
            inputTop,
            inputBottom: inputTop + inputHeight,
            viewportHeight: viewportHeight.current,
            contentHeight: contentHeight.value,
          });
          // Already in the window: the page does not move at all.
          if (Math.abs(y - offset.current) >= 0.5) scroll.scrollTo({ y, animated: true });
        };
        const block = focusedBlock.current;
        // A focused input with no Field around it is its own block (just the box).
        if (!block) return place(inputTop, inputTop + inputHeight);
        block.measureLayout(inner as never, (_bx, blockTop, _bw, blockHeight) => place(blockTop, blockTop + blockHeight), () => place(inputTop, inputTop + inputHeight));
      },
      () => {},
    );
  }, [contentHeight]);

  /** The window or the content changed: scroll only if there is something to scroll, and put the offset back where it can be (a fitting page rests at 0). */
  const settle = useCallback(() => {
    setScrollable(!contentFits(contentHeightRef.current, viewportHeight.current));
    const y = settleOffset(offset.current, contentHeightRef.current, viewportHeight.current);
    if (y !== null) {
      offset.current = y;
      (scrollRef.current as unknown as RevealScroll | null)?.scrollTo({ y, animated: false });
    }
  }, []);

  const step = useCallback(
    (event: RevealEvent) => {
      const s = stepReveal(inField.current, event);
      inField.current = s.focused;
      if (s.reveal) revealFocused();
    },
    [revealFocused],
  );

  // A focus can land BEFORE the keyboard has shrunk the window (the content cannot scroll yet), so scroll again once the keyboard has
  // resized the scroll view (onLayout) and when it has settled (its events). Only while a field is focused.
  useEffect(() => {
    const subs = [Keyboard.addListener('keyboardDidShow', () => step('keyboard')), Keyboard.addListener('keyboardDidChangeFrame', () => step('keyboard'))];
    return () => subs.forEach((x) => x.remove());
  }, [step]);

  // The footer's secondary line goes while the keyboard is up. WILL events (iOS) so it is gone before the keyboard has finished
  // rising; Android has only the DID pair. Its going (and its return) resizes the scroll view, so onLayout re-scrolls to the field.
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const subs = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardUp(keyboardUpAfter('show'))),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardUp(keyboardUpAfter('hide'))),
    ];
    return () => subs.forEach((x) => x.remove());
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.fill, { backgroundColor: colors.bg }]}
    >
      <View style={{ height: insets.top }} />
      {back ? (
        <Pressable onPress={back.onPress} accessibilityRole="button" accessibilityLabel={back.label} style={styles.back} hitSlop={8}>
          <Icon name="chevronLeft" size="callout" tone="text2" />
          {/* Capped (2×, 26pt) so the back row never outgrows a screen's heading (Profile's 35pt name). */}
          <Text variant="callout" tone="secondary" maxFontSizeMultiplier={2}>
            {back.label}
          </Text>
        </Pressable>
      ) : null}
      <View style={styles.fill}>
        <ScrollView
          ref={setScroll}
          onFocus={() => step('focus')}
          onBlur={() => step('blur')}
          onLayout={(e) => {
            viewportHeight.current = e.nativeEvent.layout.height;
            windowHeight.value = e.nativeEvent.layout.height;
            settle();
            step('layout');
          }}
          onScroll={(e) => {
            scrollY.value = e.nativeEvent.contentOffset.y;
            offset.current = e.nativeEvent.contentOffset.y;
          }}
          onContentSizeChange={(_w, h) => {
            contentHeight.value = h;
            contentHeightRef.current = h;
            settle();
          }}
          scrollEnabled={scrollable}
          alwaysBounceVertical={false}
          bounces={scrollable}
          scrollEventThrottle={16}
          style={styles.fill}
          contentContainerStyle={[styles.body, centerBody && styles.bodyCentered, { paddingBottom: footer ? space[5] : insets.bottom + space[8] }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <FieldBlockContext.Provider value={announceBlock}>{children}</FieldBlockContext.Provider>
        </ScrollView>
        {footer ? <FooterFade scrollY={scrollY} viewportHeight={windowHeight} contentHeight={contentHeight} color={colors.bg} /> : null}
      </View>
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space[5]) }]}>
          {footer}
          {footerSecondaryShown(keyboardUp) ? footerSecondary : null}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: space[5],
  },
  body: {
    paddingHorizontal: space[6],
    paddingTop: space[5],
    gap: space[6],
  },
  bodyCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: space[6],
    paddingTop: space[3],
    gap: space[4],
  },
});
