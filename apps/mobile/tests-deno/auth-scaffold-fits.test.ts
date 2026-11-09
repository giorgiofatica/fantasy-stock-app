/**
 * Build 13 (Giorgio's recording of 1.3.0 (12): "There really should not be a reason why it should be able to scroll."): with the keyboard
 * DOWN, Create account's content fits the window, yet the screen scrolled, bounced and rested at different offsets (the brand at y 67 / 113 / 150,
 * the title clipped under the status bar). Cause: a reveal scrolled it while the keyboard was up (the window was short), and UIKit never re-clamps
 * a contentOffset when the window grows back. Now: scrolling and bounce are on only while the content is taller than the window, and every
 * layout clamps the offset (a fitting page rests at 0). #345's reveal sets no content inset, so the stale offset was the whole of it.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { contentFits, settleOffset } from '../components/shell/authFieldReveal.ts';
import { SOURCES } from './sourceManifest.generated.ts';

Deno.test('contentFits: content no taller than the window fits (nothing to scroll), taller does not', () => {
  assertEquals(contentFits(700, 800), true);
  assertEquals(contentFits(800, 800), true);
  assertEquals(contentFits(800.4, 800), true, 'under half a point of rounding is not a reason to scroll');
  assertEquals(contentFits(801, 800), false);
});

Deno.test('contentFits: before anything is measured it counts as fitting, so a blank frame cannot scroll or bounce', () => {
  assertEquals(contentFits(0, 0), true);
  assertEquals(contentFits(700, 0), true);
  assertEquals(contentFits(0, 800), true);
  assertEquals(contentFits(NaN, 800), true);
});

Deno.test('settleOffset: a fitting page rests at 0, whatever stale offset a keyboard-up reveal left (67, 113, 150 in the recording)', () => {
  for (const stale of [67, 113, 150, 44]) assertEquals(settleOffset(stale, 700, 800), 0, `offset ${stale}`);
});

Deno.test('settleOffset: an offset at 0 on a fitting page is left alone (null: no scrollTo)', () => {
  assertEquals(settleOffset(0, 700, 800), null);
});

Deno.test('settleOffset: content taller than the window keeps any offset it can have, and loses one past the end', () => {
  assertEquals(settleOffset(0, 1000, 600), null);
  assertEquals(settleOffset(250, 1000, 600), null);
  assertEquals(settleOffset(400, 1000, 600), null, 'exactly at the end is fine');
  assertEquals(settleOffset(450, 1000, 600), 400, 'past the end comes back to the end');
  assertEquals(settleOffset(-30, 1000, 600), 0, 'a negative offset (a bounce resting) comes back to 0');
});

Deno.test('settleOffset: the keyboard closing grows the window back, and the offset it had is clamped to the new range', () => {
  // Keyboard up: window 386, the reveal scrolled to 44. Keyboard down: the window is 640 and the 740 content now overflows by 100: 44 is still legal.
  assertEquals(settleOffset(44, 740, 640), null);
  // A phone tall enough that the content fits once the keyboard is down: it must return to 0.
  assertEquals(settleOffset(44, 740, 760), 0);
});

Deno.test('settleOffset: unmeasured (no window or no content yet) never moves anything', () => {
  assertEquals(settleOffset(50, 0, 800), null);
  assertEquals(settleOffset(50, 700, 0), null);
});

// ---- wiring ------------------------------------------------------------------------------------------------------------------

const scaffold = SOURCES['components/shell/AuthScaffold.tsx'];
const scroll = scaffold.slice(scaffold.indexOf('<ScrollView'), scaffold.indexOf('</ScrollView>'));

Deno.test('the ScrollView scrolls and bounces only while the content is taller than the window', () => {
  assert(scroll.includes('scrollEnabled={scrollable}'));
  assert(scroll.includes('alwaysBounceVertical={false}'));
  assert(scroll.includes('bounces={scrollable}'));
  assert(scaffold.includes('setScrollable(!contentFits(contentHeightRef.current, viewportHeight.current));'));
  assert(scaffold.includes('const [scrollable, setScrollable] = useState(false);'), 'a first frame, unmeasured, does not scroll');
});

Deno.test('a layout and a content-size change both settle: the offset is clamped into what it can be now', () => {
  const onLayout = scroll.slice(scroll.indexOf('onLayout={'), scroll.indexOf('onScroll={'));
  assert(onLayout.includes('settle();'));
  const onSize = scroll.slice(scroll.indexOf('onContentSizeChange='), scroll.indexOf('scrollEnabled='));
  assert(onSize.includes('contentHeightRef.current = h;') && onSize.includes('settle();'));
  const settle = scaffold.slice(scaffold.indexOf('const settle = useCallback'), scaffold.indexOf('const step = useCallback'));
  assert(settle.includes('settleOffset(offset.current, contentHeightRef.current, viewportHeight.current)'));
  assert(settle.includes('scrollTo({ y, animated: false })'), 'the clamp is instant: no animation back to 0');
  assert(settle.includes('offset.current = y;'));
});

Deno.test('the keyboard closing is covered by the layout path: the window grows, onLayout runs settle (no blur-only special case)', () => {
  // The scroll view is the flex child above the docked footer: the keyboard avoider (and the footer's secondary line returning) resize it.
  assert(scaffold.includes('<KeyboardAvoidingView'));
  assert(scroll.includes('settle();'));
});

Deno.test('#345\'s reveal leaves no content inset behind (the stale offset was the whole of the rest-position bug)', () => {
  const code = (t: string) => t.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
  assert(!/contentInset|automaticallyAdjust|scrollIndicatorInsets|contentContainerStyle=\{[^}]*(top|marginTop)/.test(code(scaffold)));
});
