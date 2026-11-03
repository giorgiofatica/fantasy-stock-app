/**
 * P1 (2026-10-30, Giorgio's iPhone at the largest accessibility size): after a Dynamic Type
 * change, React Native 0.81's Fabric keeps an unchanged Text's box from the OLD scale and
 * draws it at the new one — Home's meta line clipped to the tops of its glyphs, "season gain",
 * "today" and the "·"s gone (remeasureKey.ts has the cause). Every Text host is now keyed by
 * the scale, so a scale change remounts it and the new node is measured at the new scale.
 * Run: cd apps/mobile/tests-deno && deno test .
 *
 * iOS font scales (RCTFontSizeMultiplier): xS 0.823 … Large 1.0 … xxxLarge 1.353, then the
 * accessibility sizes 1.786, 2.143, 2.643, 3.143, 3.571.
 */
import { assert, assertEquals, assertMatch, assertNotEquals } from 'jsr:@std/assert';
import { fontScaleKey } from '../components/sp/logic/remeasureKey.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const IOS_SCALES = [0.823, 0.882, 0.941, 1, 1.118, 1.235, 1.353, 1.786, 2.143, 2.643, 3.143, 3.571];

Deno.test('every iOS text size gets its own key: a change between ANY two sizes remounts', () => {
  const keys = IOS_SCALES.map(fontScaleKey);
  assertEquals(new Set(keys).size, IOS_SCALES.length);
  // The repro pairs: Large -> largest (the clipped meta line) and largest -> AX XL (spread out).
  assertNotEquals(fontScaleKey(1), fontScaleKey(3.571));
  assertNotEquals(fontScaleKey(3.571), fontScaleKey(2.643));
});

Deno.test('the same size keeps the same key: nothing remounts while the scale holds', () => {
  for (const s of IOS_SCALES) assertEquals(fontScaleKey(s), fontScaleKey(Number(String(s))));
});

Deno.test('a non-finite scale gets one fixed key, never "fs-NaN" / "fs-Infinity"', () => {
  assertEquals(fontScaleKey(Number.NaN), 'fs-unknown');
  assertEquals(fontScaleKey(Number.POSITIVE_INFINITY), 'fs-unknown');
  assertNotEquals(fontScaleKey(Number.NaN), fontScaleKey(1));
});

/** Each opening tag `<Name …>` in `src`, attributes included (a `>` inside `{…}` is skipped). */
function openingTags(src: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${name.replace('.', '\\.')}\\b`, 'g');
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let depth = 0;
    let i = m.index + 1;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0 && src[i - 1] !== '=') break;
    }
    out.push(src.slice(m.index, i + 1));
  }
  return out;
}

const KEYED = /\bkey=\{[^\n]*(?:remountKey|fontScaleKey\(fontScale\))/;

Deno.test('the sp Text primitive keys BOTH its hosts (RNText and Animated.Text) by the scale', () => {
  const src = SOURCES['components/sp/Text.tsx'];
  assertMatch(src, /const remountKey = fontScaleKey\(fontScale\);/);
  for (const name of ['RNText', 'Animated.Text']) {
    const tags = openingTags(src, name);
    assertEquals(tags.length, 1, name);
    assertMatch(tags[0], KEYED, name);
  }
});

Deno.test("RollingMoney: the one-Text path's RNText and every DigitColumn are keyed by the scale", () => {
  const src = SOURCES['components/home/RollingMoney.tsx'];
  assertMatch(src, /const remountKey = fontScaleKey\(fontScale\);/);
  const texts = openingTags(src, 'RNText');
  // DigitColumn's own RNText is the other one: it remounts with its column.
  assertEquals(texts.length, 2);
  assert(texts.some((t) => KEYED.test(t) && t.includes('adjustsFontSizeToFit')), 'the one-Text path');
  const columns = openingTags(src, 'DigitColumn').filter((t) => !t.startsWith('<DigitColumnProps'));
  assertEquals(columns.length, 1);
  assertMatch(columns[0], /key=\{`[^`]*\$\{remountKey\}`\}/);
});

Deno.test('ScoreDigits keys every DigitColumn by the scale', () => {
  const src = SOURCES['components/sp/game/ScoreDigits.tsx'];
  assertMatch(src, /const remountKey = fontScaleKey\(fontScale\);/);
  const columns = openingTags(src, 'DigitColumn').filter((t) => !t.startsWith('<DigitColumnProps'));
  assertEquals(columns.length, 1);
  assertMatch(columns[0], /key=\{`[^`]*\$\{remountKey\}`\}/);
});

Deno.test('PhaseChip and Money key their RNText by the scale', () => {
  for (const file of ['components/sp/PhaseChip.tsx', 'components/sp/Money.tsx']) {
    const tags = openingTags(SOURCES[file], 'RNText');
    assertEquals(tags.length, 1, file);
    assertMatch(tags[0], KEYED, file);
    assertMatch(SOURCES[file], /const \{ fontScale \} = useWindowDimensions\(\);/, file);
  }
});

Deno.test("SymbolSearchField keys each of its three popovers (distinct keys); its TextInput only by the focus-frozen key", () => {
  const src = SOURCES['components/SymbolSearchField.tsx'];
  assertMatch(src, /const remountKey = fontScaleKey\(fontScale\);/);
  for (const k of ['results', 'none', 'error']) assertMatch(src, new RegExp(`<View key=\\{\`${k}-\\$\\{remountKey\\}\`\\}`), k);
  // The TextInput never takes the raw scale key (a remount while focused drops the keyboard):
  // input-remount-key.test.ts checks it uses useInputRemountKey's.
  for (const tag of openingTags(src, 'TextInput')) assert(!/\bkey=\{[^}]*remountKey\}/.test(tag), 'the TextInput keeps focus');
});

Deno.test('no Text host escapes the key: every file drawing a raw RN Text or an Animated.Text is a keyed one', () => {
  const KNOWN = new Set([
    'components/sp/Text.tsx',
    'components/home/RollingMoney.tsx',
    'components/sp/game/ScoreDigits.tsx',
    'components/sp/PhaseChip.tsx',
    'components/sp/Money.tsx',
    'components/SymbolSearchField.tsx',
  ]);
  const rawText = /import\s*\{[^}]*\bText\b[^}]*\}\s*from\s*'react-native'/;
  const offenders = Object.entries(SOURCES)
    .filter(([path, src]) => (rawText.test(src) || /<Animated\.Text\b/.test(src)) && !KNOWN.has(path))
    .map(([path]) => path);
  // A new one must be keyed with fontScaleKey too (and added above), or it brings the bug back.
  assertEquals(offenders, []);
  for (const path of KNOWN) assertMatch(SOURCES[path], /fontScaleKey\(fontScale\)/, path);
});
