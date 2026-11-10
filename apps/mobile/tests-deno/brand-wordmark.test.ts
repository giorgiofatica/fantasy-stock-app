/**
 * The wordmark's last letter (build 13, Giorgio's recording of 1.3.0 (12) at normal text size, Create account: "Stockpil", the final "e"
 * cut, in every frame; build 11 showed "Stockpile" whole). The wordmark is the one Text on the auth screens whose box HUGS its glyphs, and in
 * the frames that box is ~87-89pt for glyphs drawn at full size: Archivo Bold 22 "Stockpile" is 99.07pt (CoreText), and 87.4pt is what
 * Archivo Bold measures at 0.882 (iOS's "Small"). A box measured at another font scale than it is drawn at: the stale-measure family of
 * components/sp/logic/remeasureKey.ts. The wordmark now carries its scale in its props, so measure and draw use the same number.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { WORDMARK_FONT_SIZE, WORDMARK_LINE_HEIGHT, wordmarkSize } from '../components/shell/brandWordmark.ts';
import { type } from '../constants/tokens/type.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const CAP = type.title.maxScale ?? 1;

Deno.test('the wordmark base is the `title` token\'s size with the lockup\'s own 26pt line', () => {
  assertEquals(WORDMARK_FONT_SIZE, type.title.fontSize);
  assertEquals(WORDMARK_LINE_HEIGHT, 26);
  assertEquals(CAP, 1.6);
});

Deno.test('at the default size the wordmark is exactly what it was: 22 / 26', () => {
  assertEquals(wordmarkSize(1, CAP), { fontSize: 22, lineHeight: 26 });
});

Deno.test('it scales with the system text size, the same x fontScale native scaling applied, so nothing looks different', () => {
  assertEquals(wordmarkSize(1.25, CAP), { fontSize: 27.5, lineHeight: 32.5 });
  const small = wordmarkSize(0.882, CAP);
  assertEquals(Math.round(small.fontSize * 1000) / 1000, 19.404);
  assert(small.lineHeight < 26);
});

Deno.test('it never outgrows the title variant\'s own cap (1.6), at AX5 or beyond', () => {
  assertEquals(wordmarkSize(1.6, CAP), { fontSize: 35.2, lineHeight: 41.6 });
  assertEquals(wordmarkSize(3.1, CAP), wordmarkSize(1.6, CAP));
});

Deno.test('a nonsense scale (0, negative, NaN, Infinity) reads as 1, never a collapsed or enormous wordmark', () => {
  for (const bad of [0, -2, NaN, Infinity, -Infinity]) assertEquals(wordmarkSize(bad, CAP), { fontSize: 22, lineHeight: 26 }, String(bad));
});

// ---- wiring --------------------------------------------------------------------------------------------------------------------

const brandBars = SOURCES['components/shell/BrandBars.tsx'];
const lockup = brandBars.slice(brandBars.indexOf('export function BrandLockup'), brandBars.indexOf('const styles = StyleSheet.create'));

Deno.test('BrandLockup\'s wordmark Text carries its size in its props and does not scale natively', () => {
  assert(lockup.includes('const { fontScale } = useWindowDimensions();'));
  assert(lockup.includes('wordmarkSize(fontScale, type.title.maxScale ?? 1)'));
  const text = lockup.slice(lockup.indexOf('<Text'), lockup.indexOf('</Text>'));
  assert(text.includes('allowFontScaling={false}'), 'native scaling off: nothing for the box and the glyphs to disagree about');
  assert(text.includes('style={[styles.wordmark, size]}'), 'the explicit fontSize / lineHeight come last, over the variant\'s');
  assert(text.includes('numberOfLines={1}'));
  assert(text.includes('{brand.wordmark}'), 'the name still comes from the brand token');
});

Deno.test('the wordmark is the only hugging Text in the lockup, and it is the only one that changed: the bars stay fixed', () => {
  assert(lockup.includes('<BrandBars size={30} rise={rise} />'));
  assertEquals((lockup.match(/<Text /g) ?? []).length, 1);
});

Deno.test('the lockup still reads as one header named by the brand token', () => {
  assert(lockup.includes('accessible accessibilityRole="header" accessibilityLabel={brand.name}'));
});
