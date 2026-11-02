/**
 * 2026-11-02 (Design Lead ruling): after a live Dynamic Type change, an UNFOCUSED filled field
 * (League settings › "League name") kept its text at the old glyph size inside a grown box, so
 * one screen showed two text sizes; a focused field updated natively, and a cold launch was fine
 * (remeasureKey.ts has the cause). Every TextInput host is now keyed by the scale while it is
 * unfocused, keeps the key it took focus with while it is focused (a remount drops the keyboard),
 * and takes the current key on blur. A remount never re-runs the caller's autoFocus.
 * Run: cd apps/mobile/tests-deno && deno test .
 */
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert';
import { fontScaleKey, inputRemountKey, remountAutoFocus } from '../components/sp/logic/remeasureKey.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const L = fontScaleKey(1);
const XXXL = fontScaleKey(1.353);
const AX5 = fontScaleKey(3.571);

Deno.test('unfocused: the key follows the current scale, so a live change remounts the field', () => {
  assertEquals(inputRemountKey(false, L, XXXL), XXXL);
  assertEquals(inputRemountKey(false, L, AX5), AX5);
  assertEquals(inputRemountKey(false, AX5, L), L);
});

Deno.test('focused: the key stays the one it took focus with, so the keyboard stays up', () => {
  assertEquals(inputRemountKey(true, L, XXXL), L);
  assertEquals(inputRemountKey(true, L, AX5), L);
  assertEquals(inputRemountKey(true, AX5, L), AX5);
});

Deno.test('a change made while typing settles at blur: one key change, at the blur', () => {
  // Focused at L; the size goes L -> XXXL -> AX5 while typing; then blur.
  const steps = [
    inputRemountKey(true, L, L),
    inputRemountKey(true, L, XXXL),
    inputRemountKey(true, L, AX5),
    inputRemountKey(false, L, AX5),
  ];
  assertEquals(steps, [L, L, L, AX5]);
});

Deno.test('the same scale never changes the key, focused or not: nothing remounts at a fixed size', () => {
  for (const focused of [true, false]) assertEquals(inputRemountKey(focused, XXXL, XXXL), XXXL);
});

Deno.test("autoFocus is the caller's on the first mount, and off once the host has been remounted", () => {
  assertEquals(remountAutoFocus(true, false), true);
  assertEquals(remountAutoFocus(undefined, false), undefined);
  assertEquals(remountAutoFocus(false, false), false);
  assertEquals(remountAutoFocus(true, true), false);
  assertEquals(remountAutoFocus(undefined, true), false);
});

/** A JSX `<Name`: not a type argument like `useRef<TextInput>` (an identifier comes right before it). */
const jsxTag = (name: string, flags = '') => new RegExp(`(?<![\\w.])<${name}\\b`, flags);

/** Each JSX opening tag `<Name …>` in `src`, attributes included (a `>` inside `{…}` is skipped). */
function openingTags(src: string, name: string): string[] {
  const out: string[] = [];
  const re = jsxTag(name, 'g');
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

Deno.test('the hook keys by inputRemountKey and freezes the key it rendered at focus', () => {
  const src = SOURCES['components/sp/useInputRemountKey.ts'];
  assertMatch(src, /const currentKey = fontScaleKey\(fontScale\);/);
  assertMatch(src, /const key = inputRemountKey\(focused, keyAtFocus \?\? currentKey, currentKey\);/);
  assertMatch(src, /onFocus: \(\) => setKeyAtFocus\(key\)/);
  assertMatch(src, /onBlur: \(\) => setKeyAtFocus\(null\)/);
  assertMatch(src, /autoFocus: remountAutoFocus\(autoFocus, remounted\.current\)/);
  assertMatch(src, /if \(key !== firstKey\.current\) remounted\.current = true;/);
});

/** The hook's binding name in each TextInput host, and what the host must wire. */
const HOSTS: Record<string, string> = {
  'components/shell/Field.tsx': 'remount',
  'components/SymbolSearchField.tsx': 'inputRemount',
  'components/money/StockSearchScreen.tsx': 'searchRemount',
};

Deno.test('every TextInput host takes the hook: key, autoFocus, and both focus handlers', () => {
  for (const [path, name] of Object.entries(HOSTS)) {
    const src = SOURCES[path];
    assertMatch(src, new RegExp(`const ${name} = useInputRemountKey\\(`), path);
    const tags = openingTags(src, 'TextInput');
    assertEquals(tags.length, 1, path);
    const tag = tags[0];
    assertMatch(tag, new RegExp(`\\bkey=\\{${name}\\.key\\}`), path);
    assertMatch(tag, new RegExp(`\\bautoFocus=\\{${name}\\.autoFocus\\}`), path);
    assertMatch(tag, new RegExp(`\\bonFocus=\\{[\\s\\S]*${name}\\.onFocus`), path);
    assertMatch(tag, new RegExp(`\\bonBlur=\\{[\\s\\S]*${name}\\.onBlur`), path);
  }
});

Deno.test("Field takes autoFocus out of the spread props, so a caller's cannot override the remount's", () => {
  const src = SOURCES['components/shell/Field.tsx'];
  assertMatch(src, /\binputFontSize, autoFocus, onFocus, onBlur, \.\.\.input \}/);
  assertMatch(src, /const remount = useInputRemountKey\(autoFocus\);/);
  // The spread comes after the hook's props would let input.key / input.autoFocus win: it holds neither.
  const tag = openingTags(src, 'TextInput')[0];
  assert(tag.indexOf('{...input}') > tag.indexOf('autoFocus='), 'spread is last, and holds no autoFocus');
  // The border follows the hook's focus state (there is no second one to drift from it).
  assertMatch(src, /const focused = remount\.focused;/);
  assert(!/useState\(/.test(src), 'no separate focus state');
});

Deno.test('no TextInput escapes the hook: every file drawing a raw TextInput is a known host', () => {
  const offenders = Object.entries(SOURCES)
    .filter(([path, src]) => jsxTag('TextInput').test(src) && !(path in HOSTS))
    .map(([path]) => path);
  // A new one must use useInputRemountKey too (and be added above), or it brings the bug back.
  assertEquals(offenders, []);
});
