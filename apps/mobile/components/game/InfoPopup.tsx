/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space } from '@/constants/tokens';
import { Card } from '@/components/sp/Card';
import { Icon } from '@/components/sp/Icon';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { isLargeText } from '@/components/sp/logic/largeText';
import { fontScaleKey } from '@/components/sp/logic/remeasureKey';
import { InfoPicture } from '@/components/game/InfoVisuals';
import { INFO_FIXTURE } from '@/lib/shell/captureDev';
import {
  CLOSE_LABEL,
  INFO_POPUPS,
  PAGES,
  aboutLabel,
  offsetForPage,
  pageAtOffset,
  pageLabel,
  turnPage,
  type InfoKey,
} from '@/lib/game/infoPopups';

// The "i" and its popup (UX rule 13; PRODUCT_RULES "The 'i' popup has two pages", "No button in the 'i' popup: just the dots").
// Spec: the Design Lead's board, docs/design/screens/info-i.jsx (InfoI, Popup).
//
//  - InfoButton: a 44 pt target at the end of a row, a grey glyph. It opens the popup and NEVER selects the row (it is a
//    sibling of the row's own control, never inside it).
//  - The popup: a card over a dimmed screen. Page 1 is the option's name and its one line; page 2 is the name and a picture.
//    No button: a swipe turns the page, and the two dots under the card are the page control (a 44 pt row; tap a dot to turn;
//    VoiceOver "Page 1 of 2", swipe up or down to turn). The x in the corner closes it from either page, and so does a tap on
//    the dimmed screen. It always opens on page 1.
//  - At the large text sizes the card fills the screen and each page scrolls inside it; the x stays pinned in its corner and the
//    dots stay under the page. The title stops at 1.6x (the `title` variant's own cap), the picture's labels at 1.4x, and the
//    line on page 1 grows the whole way: it is the part you read.

/** The "i": a 44 pt target. `edge` tucks it 10 pt into the card's padding, so the glyph (not the box) sits at the content edge. */
export function InfoButton({ info, onOpen, edge = false }: { info: InfoKey; onOpen: (info: InfoKey) => void; edge?: boolean }) {
  return (
    <Pressable
      onPress={() => onOpen(info)}
      accessibilityRole="button"
      accessibilityLabel={aboutLabel(INFO_POPUPS[info].title)}
      style={[styles.infoHit, edge && styles.infoEdge]}
      testID={`info-${info}`}
    >
      <Icon name="info" size="headline" tone="text2" />
    </Pressable>
  );
}

/** The popup's owner: `open(key)` from an "i", and `popup` to render once on the screen. Opening always starts on page 1. */
export function useInfoPopup(): { open: (info: InfoKey, page?: number) => void; popup: React.JSX.Element } {
  // `id` is a new mount each time it opens, so the pager and its page state start over (page 1); `shown` outlives `visible` so
  // the card does not empty itself while the Modal fades out.
  const [shown, setShown] = useState<{ info: InfoKey; id: number; page: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const open = useCallback((info: InfoKey, page = 1) => {
    setShown((s) => ({ info, id: (s?.id ?? 0) + 1, page }));
    setVisible(true);
  }, []);
  const close = useCallback(() => setVisible(false), []);
  // DEV captures only: open the fixture's popup once, through the real open() (never a store forced on).
  useEffect(() => {
    if (INFO_FIXTURE) open(INFO_FIXTURE.info, INFO_FIXTURE.page);
  }, [open]);
  const popup = <InfoPopup visible={visible} shown={shown} onClose={close} />;
  return { open, popup };
}

interface InfoPopupProps {
  visible: boolean;
  shown: { info: InfoKey; id: number; page: number } | null;
  onClose: () => void;
}

export function InfoPopup({ visible, shown, onClose }: InfoPopupProps) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root} accessibilityViewIsModal>
        {/* The dimmed screen: a tap closes. Not a VoiceOver stop (the x is the control that closes). */}
        <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onClose} accessible={false} testID="info-scrim" />
        {shown ? <PopupCard key={`${shown.id}-${fontScaleKey(fontScale)}`} info={shown.info} startPage={shown.page} onClose={onClose} /> : null}
      </View>
    </Modal>
  );
}

/** Where the card's top edge sits at the normal sizes, as a share of the screen's height (the board's 150 pt on an 874 pt phone).
 * The edge is fixed, so the name and the x never move when the page turns; the card hugs each page and grows downward. */
const TOP_SHARE = 0.17;
const GUTTER = 16;
const PAGE_PADDING = space[6];

function PopupCard({ info, startPage, onClose }: { info: InfoKey; startPage: number; onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const large = isLargeText(fontScale);
  const copy = INFO_POPUPS[info];
  // Always 1 for a person (the popup opens on page 1); only a DEV capture starts elsewhere.
  const [page, setPage] = useState(startPage);
  // Each page's measured content height (normal sizes only): the pager is as tall as the page it shows, so the card hugs it.
  const [heights, setHeights] = useState<number[]>([]);
  const pager = useRef<ScrollView>(null);
  const pageWidth = width - GUTTER * 2;
  const top = large ? insets.top + space[3] : Math.round(height * TOP_SHARE);
  const maxCard = height - top - Math.max(insets.bottom, space[5]);

  const goTo = (next: number) => {
    setPage(next);
    pager.current?.scrollTo({ x: offsetForPage(next, pageWidth), animated: true });
  };
  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(pageAtOffset(e.nativeEvent.contentOffset.x, pageWidth));

  const head = (
    <Text variant="title" accessibilityRole="header" style={styles.title}>
      {copy.title}
    </Text>
  );
  const pages = [
    <View key="words" style={styles.pageStack}>
      {head}
      {/* The line grows the whole way (no cap): it is the part you read. */}
      <Text variant="body" selectable={false}>{copy.line}</Text>
    </View>,
    <View key="picture" style={styles.pageStack}>
      {head}
      {/* One spoken description for the whole picture (not approved yet: infoPopups.ts, VO_*). */}
      <View style={[styles.picture, { backgroundColor: colors.inset }]} accessible accessibilityLabel={copy.voice}>
        <InfoPicture info={info} />
      </View>
    </View>,
  ];

  return (
    <Card
      style={[
        styles.card,
        { top, left: GUTTER, right: GUTTER, borderRadius: radius.xl },
        large ? { bottom: Math.max(insets.bottom, space[5]) } : { maxHeight: maxCard },
      ]}
      testID="info-popup"
    >
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        directionalLockEnabled
        contentOffset={{ x: offsetForPage(startPage, pageWidth), y: 0 }}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onSettle}
        scrollEventThrottle={16}
        // Normal sizes: as tall as the page showing. Large: the card's own height, and each page scrolls inside it.
        style={[styles.pager, large ? styles.pagerFill : heights[page - 1] ? { height: heights[page - 1] } : null]}
        testID="info-pager"
      >
        {pages.map((content, i) => (
          <View
            key={i}
            // The page not showing is not a VoiceOver stop: a screen reader stays on the page that is open.
            accessibilityElementsHidden={page !== i + 1}
            importantForAccessibility={page === i + 1 ? 'auto' : 'no-hide-descendants'}
            style={{ width: pageWidth }}
          >
            {large ? (
              <ScrollView contentContainerStyle={styles.pageContent} directionalLockEnabled showsVerticalScrollIndicator>
                {content}
              </ScrollView>
            ) : (
              <View
                style={styles.pageContent}
                onLayout={(e) => {
                  const h = Math.ceil(e.nativeEvent.layout.height);
                  setHeights((prev) => {
                    if (prev[i] === h) return prev;
                    const next = [...prev];
                    next[i] = h;
                    return next;
                  });
                }}
              >
                {content}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      <PageDots page={page} onTurn={goTo} dotColor={colors.text} offColor={colors.borderStrong} />
      {/* The x floats in the corner, pinned, above whichever page is showing. */}
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={CLOSE_LABEL} style={styles.close} testID="info-close">
        <View style={[styles.closeDisc, { backgroundColor: colors.inset }]}>
          <Icon name="close" size="callout" tone="text" />
        </View>
      </Pressable>
    </Card>
  );
}

/** The two dots: the page indicator and the page control. A 44 pt row (each dot a 44 pt tap target); VoiceOver reads the row as one
 * adjustable element, "Page 1 of 2", and a swipe up or down turns the page. */
function PageDots({ page, onTurn, dotColor, offColor }: { page: number; onTurn: (page: number) => void; dotColor: string; offColor: string }) {
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={pageLabel(page)}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') onTurn(turnPage(page, 1));
        if (e.nativeEvent.actionName === 'decrement') onTurn(turnPage(page, -1));
      }}
      style={styles.dots}
      testID="info-dots"
    >
      {Array.from({ length: PAGES }, (_, i) => i + 1).map((n) => (
        <Pressable key={n} onPress={() => onTurn(n)} style={styles.dotHit} testID={`info-dot-${n}`}>
          <View style={[styles.dot, { backgroundColor: n === page ? dotColor : offColor }]} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  infoHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // At a card's right edge: the glyph, not the 44 pt box, sits on the content edge.
  infoEdge: {
    marginRight: -10,
  },
  root: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    position: 'absolute',
  },
  pager: {
    flexGrow: 0,
  },
  pagerFill: {
    flexGrow: 1,
  },
  pageContent: {
    padding: PAGE_PADDING,
    paddingBottom: space[3],
  },
  pageStack: {
    gap: space[5],
  },
  // Leaves room for the x, which floats over the card's top-right corner.
  title: {
    paddingRight: 36,
  },
  picture: {
    borderRadius: radius.lg,
    padding: space[5],
  },
  close: {
    position: 'absolute',
    top: space[3],
    right: space[4],
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  closeDisc: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
    marginBottom: space[3],
  },
  dotHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
