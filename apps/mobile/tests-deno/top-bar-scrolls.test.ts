/**
 * The top bar (Giorgio, 2026-11-06, "A for both"; PRODUCT_RULES "The top bar", board #call-top-bar):
 *  1. The SAME bar on every tab: the league pill on the left, your avatar (Profile) on the right. Portfolio shows the avatar,
 *     and no tab shows the phase chip in the bar.
 *  2. The bar scrolls away with the page: it is the first thing INSIDE the scroll content, not a fixed row above it. Once the
 *     page has scrolled, its colour fades out over a few points behind the status bar; a tap on the clock scrolls to the top.
 * Pure parts (the fade's numbers, the reveal's margin) are tested for values; the wiring is source-pinned. The pins are written
 * so the OLD shape fails them (a fixed ShellHeader above a BarsRefresh; a chip; no avatar on Portfolio).
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  FADE_IN_POINTS, FADE_SOFT_POINTS, REVEAL_MARGIN, clearOf, revealMargin, topFadeHeight, topFadeOpacity, topFadeStops,
} from '../components/shell/topBarFade.ts';
import { revealOffset } from '../components/sp/logic/searchField.ts';
import { shouldPinYourRow } from '../lib/game/standings.ts';
import { SOURCES } from './sourceManifest.generated.ts';

/** Source without comments, so a pin cannot be satisfied (or tripped) by prose. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const bars = code(SOURCES['components/shell/BarsRefresh.tsx']);
const iosBlock = bars.slice(bars.indexOf('function IosBarsRefresh'));
const androidBlock = bars.slice(bars.indexOf('if (Platform.OS !== \'ios\')'), bars.indexOf('function IosBarsRefresh'));

// ---------------------------------------------------------------------------------------------- the fade, pure

Deno.test('the fade is invisible at rest and while pulling down, and full once the page has scrolled FADE_IN_POINTS', () => {
  assertEquals(topFadeOpacity(0), 0);
  assertEquals(topFadeOpacity(-80), 0); // the pull-to-refresh overscroll
  assertEquals(topFadeOpacity(Number.NaN), 0);
  assertEquals(topFadeOpacity(FADE_IN_POINTS / 2), 0.5);
  assertEquals(topFadeOpacity(FADE_IN_POINTS), 1);
  assertEquals(topFadeOpacity(5000), 1);
});

Deno.test('the fade covers the status bar solid, then fades out over a few points below it', () => {
  assertEquals(FADE_SOFT_POINTS, 10);
  assertEquals(topFadeHeight(59), 69);
  assertEquals(topFadeHeight(0), FADE_SOFT_POINTS); // a phone with no inset still gets the soft edge
  const [solidUntil, clearAt] = topFadeStops(59);
  assertEquals(solidUntil, 59 / 69);
  assertEquals(clearAt, 1);
});

Deno.test('the fade is the same colour all the way (#RRGGBB -> #RRGGBB00), never a fade through grey', () => {
  assertEquals(clearOf('#F3F5FC'), '#F3F5FC00');
  assertEquals(clearOf('#060A1F'), '#060A1F00');
  assertEquals(clearOf('rgba(1,2,3,0.5)'), 'transparent'); // not a hex colour: fall back, do not corrupt it
});

Deno.test('the search reveal lands a field just under the status-bar fade, never inside it', () => {
  assertEquals(REVEAL_MARGIN, 12);
  assertEquals(revealMargin(59), 59 + FADE_SOFT_POINTS + REVEAL_MARGIN);
  assertEquals(revealMargin(59, 78), 59 + FADE_SOFT_POINTS + 78); // the draft room's own margin, while your clock runs
  for (const inset of [0, 20, 47, 59, 62]) assert(revealMargin(inset) > topFadeHeight(inset), `inset ${inset}`);
  // A field 1000pt down the page (the bar is part of the content now): the scroll offset puts it revealMargin under the top.
  assertEquals(revealOffset(1000, revealMargin(59)), 1000 - 81);
});

Deno.test('Standings\' pinned row watches only the bottom edge: moving the viewport top (the bar is inside it now) changes nothing', () => {
  const g = { rowTop: 900, rowBottom: 950, cardTop: 300, cardBottom: 1000, viewBottom: 800 };
  for (const viewTop of [0, 59, 120]) assertEquals(shouldPinYourRow({ ...g, viewTop }), true);
  const visible = { ...g, rowTop: 700, rowBottom: 750 };
  for (const viewTop of [0, 59, 120]) assertEquals(shouldPinYourRow({ ...visible, viewTop }), false);
});

// ---------------------------------------------------------------------------------------------- one bar on every tab

const TABS_AND_PLACEHOLDER = [
  'app/(tabs)/index.tsx',
  'app/(tabs)/matchup.tsx',
  'app/(tabs)/league.tsx',
  'components/money/PortfolioScreen.tsx',
  'components/shell/PhasePlaceholder.tsx',
];
/** Sub-screens with their own back control ("‹ Portfolio"): they keep their own header rules (pill, no avatar). */
const BACK_BUTTON_SCREENS = ['components/money/StockSearchScreen.tsx', 'components/money/TradeHistoryScreen.tsx'];

Deno.test('every top-level ShellHeader shows the avatar; nothing passes a phase chip', () => {
  for (const p of TABS_AND_PLACEHOLDER) {
    const src = code(SOURCES[p]);
    const uses = src.match(/<ShellHeader\b[^>]*\/>/g) ?? [];
    assert(uses.length >= 1, p);
    for (const u of uses) assert(/\bshowAvatar\b/.test(u), `${p}: ${u}`);
  }
  for (const [p, src] of Object.entries(SOURCES)) assert(!/\bshowPhase\b/.test(code(src)), `${p} still names showPhase`);
});

Deno.test('the back-button sub-screens keep their own rules: the pill, no avatar, no chip', () => {
  for (const p of BACK_BUTTON_SCREENS) {
    const src = code(SOURCES[p]);
    assert(/<ShellHeader title=\{COPY\.\w+\} \/>/.test(src), p);
    assert(src.includes('accessibilityLabel="Portfolio"'), `${p} has its back control`);
  }
});

Deno.test('every ShellHeader caller is accounted for (a new one must be a tab or a back-button screen)', () => {
  const callers = Object.entries(SOURCES).filter(([p, s]) => p !== 'components/shell/ShellHeader.tsx' && code(s).includes('<ShellHeader')).map(([p]) => p).sort();
  assertEquals(callers, [...TABS_AND_PLACEHOLDER, ...BACK_BUTTON_SCREENS].sort());
});

Deno.test('ShellHeader draws the pill and the avatar and no phase chip', () => {
  const src = code(SOURCES['components/shell/ShellHeader.tsx']);
  assert(!src.includes('PhaseChip'));
  assert(!src.includes('chipPhaseFor') && !src.includes('chipLabelFor'));
  assert(src.includes('<LeaguePill'));
  assert(src.includes('accessibilityLabel="Profile"'));
});

Deno.test('Portfolio has the bar with the avatar, inside its page (money colour for the fade)', () => {
  const src = code(SOURCES['components/money/PortfolioScreen.tsx']);
  assert(src.includes('<BarsRefresh header={<ShellHeader title="Portfolio" showAvatar />} fadeColor={colors.moneyBg}'));
  assert(!src.includes('<ScrollView'), 'one scroll view: the one BarsRefresh provides');
});

// ---------------------------------------------------------------------------------------------- the bar scrolls with the page

Deno.test('no tab draws its ShellHeader as a fixed sibling above its BarsRefresh', () => {
  for (const p of TABS_AND_PLACEHOLDER) {
    const src = code(SOURCES[p]);
    assert(!/<ShellHeader\b[^>]*\/>\s*<BarsRefresh/.test(src), `${p}: a fixed bar above the scroll view`);
    assert(!/<ShellHeader\b[^>]*\/>\s*<(Animated\.)?ScrollView/.test(src), `${p}: a fixed bar above a scroll view`);
  }
});

Deno.test('every BarsRefresh on a tab is given the bar as its header (the pending states have no scroll view and draw it plain)', () => {
  const opens = (p: string) => (code(SOURCES[p]).match(/<BarsRefresh\b/g) ?? []).length;
  for (const p of ['app/(tabs)/index.tsx', 'app/(tabs)/matchup.tsx', 'app/(tabs)/league.tsx', 'components/money/PortfolioScreen.tsx', 'components/shell/PhasePlaceholder.tsx']) {
    const src = code(SOURCES[p]);
    const withHeader = src.match(/<BarsRefresh\b[\s\S]*?header=\{<ShellHeader\b/g) ?? [];
    assertEquals(withHeader.length, opens(p), p);
  }
});

Deno.test('BarsRefresh puts the header first inside the scroll content, on iOS and on Android', () => {
  for (const [name, block, close] of [['iOS', iosBlock, '</Animated.ScrollView>'], ['Android', androidBlock, '</Animated.ScrollView>']] as const) {
    const open = block.indexOf('<Animated.ScrollView');
    const end = block.indexOf(close);
    assert(open >= 0 && end > open, name);
    const content = block.slice(open, end);
    assert(content.includes('{header}'), `${name}: the header is inside the scroll view`);
    // The header comes before the page body, and the body is padded by the caller's style, not the header.
    assert(content.indexOf('{header}') < content.indexOf('contentContainerStyle, styles.pageBody'), name);
  }
  assert(bars.includes('<View style={[contentContainerStyle, styles.pageBody]}>'));
  // The scroll view's OWN content style carries no padding: the header spans the full width.
  assertEquals((bars.match(/contentContainerStyle=\{styles\.page\}/g) ?? []).length, 2);
  assert(!/<Animated\.ScrollView[^>]*contentContainerStyle=\{contentContainerStyle\}/.test(bars));
});

Deno.test('the top of the page is behind a fade of the page colour, over BOTH scroll views', () => {
  assertEquals((bars.match(/<TopFade scrollY=\{scrollY\} color=\{fadeColor \?\? colors\.bg\} \/>/g) ?? []).length, 2);
  assert(iosBlock.includes('scrollY.value = e.contentOffset.y;'));
  assert(androidBlock.includes('onScroll={onAndroidScroll}'));
  assert(bars.includes('scrollY.value = e.contentOffset.y;'));
  const fade = code(SOURCES['components/shell/TopFade.tsx']);
  assert(fade.includes('pointerEvents="none"'), 'the fade takes no touches: the pill and the avatar stay tappable');
  assert(fade.includes('topFadeOpacity(scrollY.value)'));
  assert(code(SOURCES['components/shell/topBarFade.ts']).includes("'worklet'"), 'topFadeOpacity runs on the UI thread');
});

Deno.test('a tap on the clock scrolls to the top: the main scroll view says so, and the strips on the tabs do not', () => {
  assert(iosBlock.includes('scrollsToTop'));
  assert(/<Animated\.ScrollView[\s\S]*?\bscrollsToTop\b[\s\S]*?>/.test(iosBlock));
  for (const p of ['components/sp/gn/SegmentTabs.tsx', 'components/home/YourSeason.tsx', 'components/game/DraftBoard.tsx']) {
    assert(/<ScrollView[^>]*horizontal[^>]*scrollsToTop=\{false\}|<ScrollView[\s\S]*?horizontal[\s\S]*?scrollsToTop=\{false\}/.test(code(SOURCES[p])), p);
  }
  assert(code(SOURCES['components/SymbolSearchField.tsx']).includes('nestedScrollEnabled scrollsToTop={false}'));
});

// ---------------------------------------------------------------------------------------------- the DL's flags

Deno.test('pull to refresh still works with the bar inside: iOS bars + onEndDrag, Android RefreshControl', () => {
  assert(iosBlock.includes('onEndDrag: () => {'));
  assert(iosBlock.includes('if (armed.value) runOnJS(run)();'));
  assert(iosBlock.includes('pull.value = canRefresh ? Math.max(0, -e.contentOffset.y) : 0;'));
  assert(iosBlock.includes('contentInset={{ top: refreshing ? HEADER : 0 }}'));
  assert(androidBlock.includes('<RefreshControl refreshing={refreshing} onRefresh={run}'));
  assert(androidBlock.includes('refreshControl={onRefresh ?'));
  // The bars rise just under the status bar (above the bar), and show only while there is a pull: never behind the clock.
  assert(iosBlock.includes('{ top: topInset - HEADER }'));
  assert(iosBlock.includes('opacity: Math.min(1, pull.value / 6)'));
});

Deno.test('the search reveal measures from the top of the content and leaves the status-bar fade clear, on both platforms', () => {
  assert(bars.includes('insetRef.current = insets.top;'));
  assertEquals((bars.match(/getTopInset\)/g) ?? []).length, 2);
  const reveal = code(SOURCES['components/shell/scrollReveal.ts']);
  assert(reveal.includes('getTopInset: () => number = () => 0'));
  assert(reveal.includes('(node, below = REVEAL_MARGIN) =>'));
  assert(reveal.includes('scroll.scrollTo({ y: revealOffset(y, revealMargin(getTopInset(), below)), animated: true })'));
  // A caller that names no margin (the queue) gets REVEAL_MARGIN under the fade; the draft room names its own while your clock runs.
  assert(code(SOURCES['components/SymbolSearchField.tsx']).includes('reveal?.(containerRef.current, revealMarginRef.current)'));
});

Deno.test('the league sheet still opens from the pill, and the pill is in the bar', () => {
  const pill = code(SOURCES['components/shell/LeaguePill.tsx']);
  assert(pill.includes('onPress={openLeagueSheet}'));
  assert(code(SOURCES['components/shell/ShellHeader.tsx']).includes('<LeaguePill name={activeLeague.name} totalLeagues={leagues.length} />'));
});

Deno.test('the draft room sits in BarsRefresh with the bar as its header, so a pinned "Your pick" clock can sit at the top later', () => {
  const league = code(SOURCES['app/(tabs)/league.tsx']);
  const room = league.slice(league.indexOf('function LeagueDraftRoom'), league.indexOf('function LeagueLobby'));
  assert(/<BarsRefresh onRefresh=\{refresh\} header=\{<ShellHeader title="League" showAvatar \/>\}/.test(room));
  // Any pinned element would be a sibling of BarsRefresh (the fade is one too): nothing in the bar assumes it is alone.
  assert(room.includes('<View style={{ flex: 1, backgroundColor: colors.bg }}>'));
});

Deno.test('BarsRefresh without onRefresh scrolls and bounces but never refreshes', () => {
  assert(bars.includes('onRefresh?: () => Promise<void>;'));
  assert(bars.includes('if (!onRefresh) return;'));
  assert(bars.includes('canRefresh={!!onRefresh}'));
});

Deno.test('a placeholder drawn INSIDE a tab\'s own scroll content is embedded: no second bar, no second scroll view', () => {
  const ph = code(SOURCES['components/shell/PhasePlaceholder.tsx']);
  assert(ph.includes('if (embedded) return <View style={styles.embedded}>{body}</View>;'));
  assert(ph.indexOf('if (embedded)') < ph.indexOf('<ShellHeader'), 'the embedded branch returns before the bar is drawn');
  for (const p of ['app/(tabs)/index.tsx', 'app/(tabs)/matchup.tsx']) {
    const src = code(SOURCES[p]);
    // Every placeholder in Home's and Matchup's BODIES (which sit inside the tab's BarsRefresh) is embedded.
    const opens = [...src.matchAll(/<PhasePlaceholder\b/g)].map((m) => m.index!);
    assert(opens.length >= 2, p);
    for (const at of opens) {
      // The element ends at its own "heading=...message=..." props' closing "/>": the first "/>" after `message=`.
      const end = src.indexOf('/>', src.indexOf('message=', at));
      assert(/\bembedded\b/.test(src.slice(at, end)), `${p}: ${src.slice(at, at + 80)}`);
    }
  }
  // The League tab's placeholders ARE the whole tab (nothing wraps them), so they keep their bar.
  const league = code(SOURCES['app/(tabs)/league.tsx']);
  assert(!/<PhasePlaceholder[^>]*\bembedded\b/.test(league));
});

