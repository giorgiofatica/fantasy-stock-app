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
import { fontScaleKey, inputHostKey, inputRemountKey, remountAutoFocus, scaledInputFont } from '../components/sp/logic/remeasureKey.ts';
import { remountOnScaleChange, type RemountProps } from '../lib/inputRemount.ts';
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

Deno.test('the hook: credential hosts keep their mount key (latched), others take the focus-frozen scale key', () => {
  const src = SOURCES['components/sp/useInputRemountKey.ts'];
  assertMatch(src, /const focusKey = useFocusRemountKey\(\);/);
  assertMatch(src, /const keyAtMount = useRef\(focusKey\.scaleKey\);/);
  assertMatch(src, /if \(!remountOnScaleChange\(props\)\) credentialHost\.current = true;/);
  assertMatch(src, /const key = inputHostKey\(!credentialHost\.current, keyAtMount\.current, focusKey\.key\);/);
  assertMatch(src, /onFocus: focusKey\.onFocus,/);
  assertMatch(src, /onBlur: focusKey\.onBlur,/);
  assertMatch(src, /autoFocus: remountAutoFocus\(autoFocus, remounted\.current\)/);
  assertMatch(src, /if \(key !== keyAtMount\.current\) remounted\.current = true;/);
});

Deno.test('inputHostKey: a host that may remount takes the scaled key; one that may not keeps its mount key', () => {
  assertEquals(inputHostKey(true, L, XXXL), XXXL);
  assertEquals(inputHostKey(false, L, XXXL), L);
  assertEquals(inputHostKey(false, XXXL, AX5), XXXL);
});

// The credential hosts' props, as the screens pass them (the source guard below pins each to its
// file): the four password screens' fields, and the account identifiers beside them.
const PASSWORD_HOSTS: Record<string, RemountProps> = {
  'login (Password)': { secureTextEntry: true, autoComplete: 'current-password', textContentType: 'password' },
  'create-account (Password)': { secureTextEntry: true, autoComplete: 'new-password', textContentType: 'newPassword' },
  'NewPasswordForm (New / Confirm)': { secureTextEntry: true, autoComplete: 'new-password', textContentType: 'newPassword' },
  'DeleteAccountView (proof password)': { secureTextEntry: true, autoComplete: 'current-password', textContentType: 'password' },
};
const IDENTIFIER_HOSTS: Record<string, RemountProps> = {
  'login (Email address)': { autoComplete: 'email', textContentType: 'username' },
  'create-account (Email address)': { autoComplete: 'email', textContentType: 'emailAddress' },
  'forgot-password (Email address)': { autoComplete: 'email', textContentType: 'emailAddress' },
};
// Plain fields: the other TextInputs the app has (League name, the join code, the username picker,
// the two search inputs).
const PLAIN_FIELDS: Record<string, RemountProps> = {
  'League name': {},
  'join code': { autoComplete: 'off' },
  'UsernamePicker': { autoComplete: 'username-new', textContentType: 'nickname' },
  'stock search': {},
};

Deno.test('remountOnScaleChange: the password hosts and the account identifiers never remount; plain fields do', () => {
  for (const [name, props] of Object.entries({ ...PASSWORD_HOSTS, ...IDENTIFIER_HOSTS })) {
    assertEquals(remountOnScaleChange(props), false, name);
  }
  for (const [name, props] of Object.entries(PLAIN_FIELDS)) assertEquals(remountOnScaleChange(props), true, name);
  assertEquals(remountOnScaleChange({}), true);
});

Deno.test('remountOnScaleChange: each credential signal is enough on its own', () => {
  assertEquals(remountOnScaleChange({ secureTextEntry: true }), false);
  for (const textContentType of ['password', 'newPassword', 'username', 'emailAddress']) {
    assertEquals(remountOnScaleChange({ textContentType }), false, textContentType);
  }
  for (const autoComplete of ['current-password', 'new-password', 'username', 'email']) {
    assertEquals(remountOnScaleChange({ autoComplete }), false, autoComplete);
  }
});

Deno.test('remountOnScaleChange: a show-password toggle (secureTextEntry off) does not move a password host to the remount path', () => {
  for (const [name, props] of Object.entries(PASSWORD_HOSTS)) {
    assertEquals(remountOnScaleChange({ ...props, secureTextEntry: false }), false, name);
  }
});

Deno.test('remountOnScaleChange: other content types and autocompletes stay remountable', () => {
  for (const textContentType of ['nickname', 'oneTimeCode', 'name', 'none']) {
    assertEquals(remountOnScaleChange({ textContentType }), true, textContentType);
  }
  for (const autoComplete of ['username-new', 'off', 'one-time-code', 'name']) {
    assertEquals(remountOnScaleChange({ autoComplete }), true, autoComplete);
  }
  assertEquals(remountOnScaleChange({ secureTextEntry: false }), true);
});

Deno.test('every credential Field in the app is in the tables above: the screens pass exactly those props', () => {
  const files: Record<string, string[]> = {
    'app/login.tsx': ['current-password', 'password'],
    'app/create-account.tsx': ['new-password', 'newPassword'],
    'components/shell/NewPasswordForm.tsx': ['new-password', 'newPassword'],
    'components/shell/DeleteAccountView.tsx': ['current-password', 'password'],
  };
  for (const [path, [autoComplete, contentType]] of Object.entries(files)) {
    const fields = openingTags(SOURCES[path], 'Field').filter((t) => /\bsecureTextEntry\b/.test(t));
    assert(fields.length >= 1, path);
    for (const tag of fields) {
      assertMatch(tag, new RegExp(`autoComplete="${autoComplete}"`), path);
      assertMatch(tag, new RegExp(`textContentType="${contentType}"`), path);
    }
  }
  // The account identifiers beside them (login's is a 'username', the others 'emailAddress').
  const identifiers: Record<string, string> = {
    'app/login.tsx': 'username',
    'app/create-account.tsx': 'emailAddress',
    'app/forgot-password.tsx': 'emailAddress',
  };
  for (const [path, contentType] of Object.entries(identifiers)) {
    const tag = openingTags(SOURCES[path], 'Field').find((t) => /label="Email address"/.test(t));
    assert(tag, path);
    assertMatch(tag, /autoComplete="email"/, path);
    assertMatch(tag, new RegExp(`textContentType="${contentType}"`), path);
  }
  // No secure field exists outside those four files, so none can escape the helper's table
  // (the helper and the hook only mention the prop).
  const INFRA = new Set(['lib/inputRemount.ts', 'components/sp/useInputRemountKey.ts']);
  const others = Object.entries(SOURCES)
    .filter(([path, src]) => /\bsecureTextEntry\b/.test(src) && !(path in files) && !INFRA.has(path))
    .map(([path]) => path);
  assertEquals(others, []);
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
  assertMatch(src, /const remount = useInputRemountKey\(autoFocus, input\);/);
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

// ── The placeholder (P1, live font-scale sweep 2, 2026-11-03) ────────────────────────────────────
// A remounted field can reuse a recycled native view whose placeholder attributes are rebuilt only
// when `textAttributes` differ from the view's last props; the scale is not in the props, so the
// old size's placeholder stayed (remeasureKey.ts, "The PLACEHOLDER"). scaledInputFont puts it there.

/** iOS's content-size multipliers (React Native's RCTFontSizeMultiplier table), smallest to largest. */
const IOS_MULTIPLIERS = [0.823, 0.882, 0.941, 1.0, 1.118, 1.235, 1.353, 1.786, 2.143, 2.643, 3.143, 3.571];
/** React Native's `floatEquality` epsilon (ReactCommon/react/utils/FloatComparison.h): two text
 * attributes closer than this count as equal, and a recycled view skips its rebuild. */
const RN_FLOAT_EPSILON = 0.005;

Deno.test('scaledInputFont: the explicit size is fontSize x scale with native scaling off', () => {
  assertEquals(scaledInputFont(18, 1, true), { fontSize: 18, allowFontScaling: false });
  assertEquals(scaledInputFont(18, 3.571, true), { fontSize: 18 * 3.571, allowFontScaling: false });
  assertEquals(scaledInputFont(17, 1.353, true), { fontSize: 17 * 1.353, allowFontScaling: false });
});

Deno.test('scaledInputFont: a host that may not remount, or has no usable size or scale, takes none', () => {
  assertEquals(scaledInputFont(18, 3.571, false), null); // a credential host (lib/inputRemount.ts)
  assertEquals(scaledInputFont(0, 1, true), null);
  assertEquals(scaledInputFont(-4, 1, true), null);
  assertEquals(scaledInputFont(Number.NaN, 1, true), null);
  assertEquals(scaledInputFont(18, Number.NaN, true), null);
  assertEquals(scaledInputFont(18, Number.POSITIVE_INFINITY, true), null);
  assertEquals(scaledInputFont(18, 0, true), null);
});

Deno.test('scaledInputFont: any two different sizes differ by more than the float epsilon React Native compares with', () => {
  // The cure only works if a recycled view SEES a different size; the app's smallest text input size is 17pt.
  for (const base of [17, 18]) {
    for (const a of IOS_MULTIPLIERS) {
      for (const b of IOS_MULTIPLIERS) {
        if (a === b) continue;
        const da = scaledInputFont(base, a, true)!.fontSize;
        const db = scaledInputFont(base, b, true)!.fontSize;
        assert(Math.abs(da - db) > RN_FLOAT_EPSILON, `${base}pt at ${a} vs ${b}`);
      }
    }
  }
});

Deno.test('scaledInputFont: the same scale gives the same size, so a fixed size never changes a prop', () => {
  for (const m of IOS_MULTIPLIERS) assertEquals(scaledInputFont(18, m, true), scaledInputFont(18, m, true));
});

Deno.test('the hook hands the host its explicit size, and a latched credential host gets none', () => {
  const src = SOURCES['components/sp/useInputRemountKey.ts'];
  assertMatch(src, /fontProps: \(baseFontSize: number\) => scaledInputFont\(baseFontSize, fontScale, !credentialHost\.current\)/);
});

/** The size constant each host passes, and where its TextInput's style reads the same one. */
const FONT_HOSTS: Record<string, { name: string; call: RegExp }> = {
  'components/SymbolSearchField.tsx': { name: 'inputRemount', call: /const inputFont = inputRemount\.fontProps\(INPUT_FONT_SIZE\);/ },
  'components/money/StockSearchScreen.tsx': { name: 'searchRemount', call: /const searchFont = searchRemount\.fontProps\(SEARCH_INPUT_FONT_SIZE\);/ },
  'components/shell/Field.tsx': { name: 'remount', call: /const font = inputFontSize \? null : remount\.fontProps\(type\.body\.fontSize\);/ },
};

Deno.test('every TextInput host that remounts also puts the scale in its props: fontSize and allowFontScaling', () => {
  assertEquals(Object.keys(FONT_HOSTS).sort(), Object.keys(HOSTS).sort());
  for (const [path, { call }] of Object.entries(FONT_HOSTS)) {
    const src = SOURCES[path];
    assertMatch(src, call, path);
    const tag = openingTags(src, 'TextInput')[0];
    assertMatch(tag, /\ballowFontScaling=\{/, path);
    assertMatch(tag, /fontSize: (inputFont|searchFont|font)\.fontSize/, path);
  }
});

Deno.test('the two search inputs draw the size they pass: one constant in the style and in the props', () => {
  const field = SOURCES['components/SymbolSearchField.tsx'];
  assertMatch(field, /const INPUT_FONT_SIZE = 18;/);
  assertMatch(field, /fontSize: INPUT_FONT_SIZE,/);
  const search = SOURCES['components/money/StockSearchScreen.tsx'];
  assertMatch(search, /const SEARCH_INPUT_FONT_SIZE = 17;/);
  assertMatch(search, /input: \{[^}]*fontSize: SEARCH_INPUT_FONT_SIZE,/);
});

Deno.test("Field: a caller's own inputFontSize wins, and a spread prop cannot turn the scale props back off", () => {
  const src = SOURCES['components/shell/Field.tsx'];
  assertMatch(src, /inputFontSize \? \{ fontSize: inputFontSize \} : font \? \{ fontSize: font\.fontSize \} : null/);
  assertMatch(src, /allowFontScaling=\{inputFontSize \|\| font \? false : undefined\}/);
  // No Field passes allowFontScaling itself (it would come after the spread and win).
  for (const [path, text] of Object.entries(SOURCES)) {
    for (const tag of openingTags(text, 'Field')) assert(!/\ballowFontScaling\b/.test(tag), path);
  }
});
