/**
 * A 12pt fade above AuthScaffold's DOCKED FOOTER (a Design Lead P3; Giorgio dislikes hard edges): with the keyboard up at the largest
 * text size, the docked "Create account" button sliced a password rule in half. The page colour now fades up over 12 points above the
 * footer, only while there is content below the scroll window to run under it. Pure numbers in components/shell/topBarFade.ts (the
 * top bar's fade module), the overlay is components/shell/FooterFade.tsx.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { FOOTER_FADE_POINTS, clearOf, footerFadeOpacity } from '../components/shell/topBarFade.ts';
import { SOURCES } from './sourceManifest.generated.ts';

/** Source without comments, so a pin cannot be satisfied (or tripped) by prose. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const W = { viewportHeight: 400, contentHeight: 900 };

Deno.test('the footer fade is 12 points', () => {
  assertEquals(FOOTER_FADE_POINTS, 12);
});

Deno.test('it shows in full while content is still below the window, and goes as the last of it comes up', () => {
  assertEquals(footerFadeOpacity({ ...W, scrollY: 0 }), 1);
  assertEquals(footerFadeOpacity({ ...W, scrollY: 400 }), 1); // 100 points still below
  assertEquals(footerFadeOpacity({ ...W, scrollY: 488 }), 1); // exactly 12 below
  assertEquals(footerFadeOpacity({ ...W, scrollY: 494 }), 0.5); // 6 below
  assertEquals(footerFadeOpacity({ ...W, scrollY: 500 }), 0); // at the end: nothing runs under the footer
  assertEquals(footerFadeOpacity({ ...W, scrollY: 560 }), 0); // overscroll past the end
});

Deno.test('it never shows when the content fits, or before the window is measured', () => {
  assertEquals(footerFadeOpacity({ viewportHeight: 400, contentHeight: 400, scrollY: 0 }), 0);
  assertEquals(footerFadeOpacity({ viewportHeight: 400, contentHeight: 250, scrollY: 0 }), 0);
  assertEquals(footerFadeOpacity({ viewportHeight: 0, contentHeight: 900, scrollY: 0 }), 0);
  assertEquals(footerFadeOpacity({ viewportHeight: 400, contentHeight: 0, scrollY: 0 }), 0);
  // A pull down past the top (negative offset) counts as the top.
  assertEquals(footerFadeOpacity({ ...W, scrollY: -40 }), 1);
});

Deno.test('it fades in the page colour (never through grey): clear above, solid at the footer', () => {
  assertEquals(clearOf('#F3F5FC'), '#F3F5FC00');
  const src = code(SOURCES['components/shell/FooterFade.tsx']);
  assert(src.includes('colors={[clearOf(color), color]}'));
  assert(src.includes('pointerEvents="none"'), 'the fade takes no touches: a field under it stays tappable');
  assert(src.includes('footerFadeOpacity('));
  assert(src.includes('bottom: 0'));
  assert(src.includes('height: FOOTER_FADE_POINTS'));
  assert(code(SOURCES['components/shell/topBarFade.ts']).includes("'worklet'"));
});

Deno.test('AuthScaffold draws it over the scroll view\'s bottom edge, only when there is a footer, in the scaffold\'s own colour', () => {
  const src = code(SOURCES['components/shell/AuthScaffold.tsx']);
  assert(src.includes('{footer ? <FooterFade scrollY={scrollY} viewportHeight={windowHeight} contentHeight={contentHeight} color={colors.bg} /> : null}'));
  // The overlay and the scroll view share one wrapper, ABOVE the docked footer (a sibling of it, not inside it).
  const wrapper = src.indexOf('<View style={styles.fill}>\n        <ScrollView');
  const fade = src.indexOf('<FooterFade');
  const wrapperEnd = src.indexOf('</View>', fade);
  const footerAt = src.indexOf('{footer ? (\n        <View style={[styles.footer');
  assert(wrapper > 0 && wrapper < fade && fade < wrapperEnd && wrapperEnd < footerAt);
  // It follows the window: scroll offset, window height and content height all feed it.
  assert(src.includes('scrollY.value = e.nativeEvent.contentOffset.y;'));
  assert(src.includes('windowHeight.value = e.nativeEvent.layout.height;'));
  assert(src.includes('contentHeight.value = h;'));
  assert(src.includes('scrollEventThrottle={16}'));
  // The reveal this scaffold already has still hears the window's height.
  assert(src.includes('viewportHeight.current = e.nativeEvent.layout.height;'));
});
