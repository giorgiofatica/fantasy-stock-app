/**
 * The password show / hide eye (Giorgio, 2026-11-06: "we should add a hide/view eye icon for the password
 * so you can see what you are typing"). Every secure Field draws it (components/shell/Field.tsx); the rules
 * are lib/passwordReveal.ts and the control components/shell/PasswordReveal.tsx.
 *
 * What is pinned here: the VoiceOver labels and the glyphs, hidden on every mount, the 44 pt target, and the
 * iOS traps: the toggle changes ONLY `secureTextEntry` on one TextInput whose key never follows it (a remount
 * of a filled password raises "Save Password?"), the hook still sees the caller's secure field (so it stays a
 * credential host), the tap never blurs, and the AutoFill props stay the screens' own.
 * Run: cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .
 */
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert';
import {
  HIDE_PASSWORD, INITIAL_REVEALED, REVEAL_HIT_PT, SHOW_PASSWORD, revealState, revealTrailingMargin,
} from '../lib/passwordReveal.ts';
import { remountOnScaleChange } from '../lib/inputRemount.ts';
import { fontScaleKey, inputHostKey } from '../components/sp/logic/remeasureKey.ts';
import { ICON_GLYPHS, iconPointSize } from '../components/sp/logic/icon.ts';
import { SOURCES } from './sourceManifest.generated.ts';

/** Each JSX opening tag `<Name …>` in `src`, attributes included (a `>` inside `{…}` is skipped). */
function openingTags(src: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`(?<![\\w.])<${name}\\b`, 'g');
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

// ── The pure rules ────────────────────────────────────────────────────────────────────────────────

Deno.test('the VoiceOver labels are exactly "Show password" and "Hide password"', () => {
  assertEquals(SHOW_PASSWORD, 'Show password');
  assertEquals(HIDE_PASSWORD, 'Hide password');
});

Deno.test('every mount starts hidden: the field is secure, the toggle offers "Show password" with the open eye', () => {
  assertEquals(INITIAL_REVEALED, false);
  assertEquals(revealState(true, INITIAL_REVEALED), { hasToggle: true, secureTextEntry: true, label: SHOW_PASSWORD, icon: 'eye' });
});

Deno.test('shown: the field is not secure, the toggle offers "Hide password" with the struck-through eye', () => {
  assertEquals(revealState(true, true), { hasToggle: true, secureTextEntry: false, label: HIDE_PASSWORD, icon: 'eyeOff' });
});

Deno.test('hidden, shown, hidden: each tap flips only the prop, the label and the glyph', () => {
  const seq = [false, true, false].map((r) => revealState(true, r));
  assertEquals(seq.map((s) => s.secureTextEntry), [true, false, true]);
  assertEquals(seq.map((s) => s.label), [SHOW_PASSWORD, HIDE_PASSWORD, SHOW_PASSWORD]);
  assertEquals(seq.map((s) => s.icon), ['eye', 'eyeOff', 'eye']);
});

Deno.test('a field its caller did not mark secure never takes the toggle, and is never made secure', () => {
  for (const caller of [undefined, false]) {
    for (const revealed of [false, true]) {
      const s = revealState(caller, revealed);
      assertEquals(s.hasToggle, false);
      assertEquals(s.secureTextEntry, false);
    }
  }
});

Deno.test('the glyphs are the sp set\'s outline eyes', () => {
  assertEquals(ICON_GLYPHS[revealState(true, false).icon], 'eye-outline');
  assertEquals(ICON_GLYPHS[revealState(true, true).icon], 'eye-off-outline');
});

Deno.test('the tap target is 44 pt', () => {
  assertEquals(REVEAL_HIT_PT, 44);
});

Deno.test('revealTrailingMargin: the glyph, not the target, sits on the text inset, never past the box padding', () => {
  // L: an 18 pt glyph in a 44 pt target is inset 13; the box pads 14 (13 focused).
  assertEquals(revealTrailingMargin(iconPointSize('body', 1), 14), -13);
  assertEquals(revealTrailingMargin(iconPointSize('body', 1), 13), -13);
  // AX5: the body glyph caps at 1.6x (28.8 pt), inset 7.6.
  assert(Math.abs(revealTrailingMargin(iconPointSize('body', 3.571), 14) - -7.6) < 1e-9);
  // A tight box: the margin never exceeds its padding.
  assertEquals(revealTrailingMargin(18, 10), -10);
  // Nonsense sizes take no margin.
  for (const g of [0, -2, Number.NaN, 44, 60]) assertEquals(revealTrailingMargin(g, 14), 0, String(g));
  assertEquals(revealTrailingMargin(18, -3), -0);
});

Deno.test('the toggle never moves a password field off the credential path: its key stays the mount key', () => {
  // The hook is handed the CALLER's props (see the Field guard below), so whatever the toggle shows the host
  // stays a credential host; even if it were handed the toggled prop, the content type alone keeps it there.
  const L = fontScaleKey(1);
  const AX5 = fontScaleKey(3.571);
  for (const [textContentType, autoComplete] of [['password', 'current-password'], ['newPassword', 'new-password']]) {
    for (const revealed of [false, true]) {
      assertEquals(remountOnScaleChange({ secureTextEntry: true, textContentType, autoComplete }), false);
      const toggled = { secureTextEntry: revealState(true, revealed).secureTextEntry, textContentType, autoComplete };
      assertEquals(remountOnScaleChange(toggled), false);
      assertEquals(inputHostKey(remountOnScaleChange(toggled), L, AX5), L);
    }
  }
});

// ── The wiring ────────────────────────────────────────────────────────────────────────────────────

const FIELD = 'components/shell/Field.tsx';
const REVEAL = 'components/shell/PasswordReveal.tsx';

Deno.test('Field: one TextInput, keyed by the remount hook alone, whose secureTextEntry is the toggle\'s', () => {
  const src = SOURCES[FIELD];
  const tags = openingTags(src, 'TextInput');
  assertEquals(tags.length, 1, 'one element in both states, never a second TextInput for the shown state');
  const tag = tags[0];
  assertMatch(tag, /\bkey=\{remount\.key\}/);
  assert(!/\bkey=\{[^}]*reveal/.test(tag), 'the key never follows the toggle');
  assertMatch(tag, /\bsecureTextEntry=\{reveal\.secureTextEntry\}/);
  // The caller's secureTextEntry is out of the spread, so `{...input}` cannot turn the toggle back off.
  assertMatch(src, /\binputFontSize, autoFocus, onFocus, onBlur, secureTextEntry, \.\.\.input \}/);
  // And nothing else in Field keys on the toggle (no wrapper View keyed on it either).
  assert(!/\bkey=\{[^}]*(reveal|secure)/i.test(src), 'no key in Field follows the toggle');
});

Deno.test('Field: the remount hook sees the caller\'s secureTextEntry, not the toggled one', () => {
  const src = SOURCES[FIELD];
  assertMatch(src, /const remount = useInputRemountKey\(autoFocus, \{ secureTextEntry, textContentType: input\.textContentType, autoComplete: input\.autoComplete \}\);/);
  assert(!/useInputRemountKey\([^)]*reveal/.test(src));
});

Deno.test('Field: every secure field draws the eye, after the trailing slot, with the box\'s padding', () => {
  const src = SOURCES[FIELD];
  assertMatch(src, /const reveal = usePasswordReveal\(secureTextEntry\);/);
  assertMatch(src, /\{reveal\.hasToggle \? <PasswordRevealButton reveal=\{reveal\} boxPadding=\{boxPadding\} \/> : null\}/);
  assertMatch(src, /paddingHorizontal: boxPadding,/);
});

Deno.test('the hook: hidden on every mount, from component state alone (nothing remembers it across screens)', () => {
  const src = SOURCES[REVEAL];
  assertMatch(src, /const \[revealed, setRevealed\] = useState\(INITIAL_REVEALED\);/);
  assertMatch(src, /return \{ \.\.\.revealState\(callerSecure, revealed\), toggle: \(\) => setRevealed\(\(r\) => !r\) \};/);
  assert(!/AsyncStorage|SecureStore|zustand|useContext|createContext|lib\/store/.test(src), 'no persisted or shared store');
  assert(!/^let /m.test(src), 'no module-level state');
});

Deno.test('the button: role button, the state\'s label, 44 pt both ways, and a tap that never blurs', () => {
  const src = SOURCES[REVEAL];
  const tags = openingTags(src, 'Pressable');
  assertEquals(tags.length, 1);
  const tag = tags[0];
  assertMatch(tag, /\bonPress=\{reveal\.toggle\}/);
  assertMatch(tag, /\baccessibilityRole="button"/);
  assertMatch(tag, /\baccessibilityLabel=\{reveal\.label\}/);
  assertMatch(src, /width: REVEAL_HIT_PT,\s*height: REVEAL_HIT_PT,/);
  assertMatch(src, /<Icon name=\{reveal\.icon\} size="body" tone="text2" \/>/);
  // The Icon has no label of its own: the button carries it, so VoiceOver reads one element.
  assert(!/<Icon[^>]*\blabel=/.test(src));
  // Nothing in the control dismisses the keyboard or moves focus.
  assert(!/Keyboard|\.blur\(|\.focus\(|onPressIn|focusable=\{false\}/.test(src), 'the tap keeps the field focused');
});

/** Every screen with a secure field, and the component that draws it. */
const PASSWORD_SCREENS: Record<string, string> = {
  'app/login.tsx': 'app/login.tsx',
  'app/create-account.tsx': 'app/create-account.tsx',
  'app/reset-password.tsx': 'components/shell/NewPasswordForm.tsx',
  'app/change-password.tsx': 'components/shell/NewPasswordForm.tsx',
  'app/delete-account.tsx': 'components/shell/DeleteAccountView.tsx',
};

Deno.test('every password screen sits in AuthScaffold, whose ScrollView keeps a handled tap from dismissing the keyboard', () => {
  assertMatch(SOURCES['components/shell/AuthScaffold.tsx'], /keyboardShouldPersistTaps="handled"/);
  for (const screen of Object.keys(PASSWORD_SCREENS)) assertMatch(SOURCES[screen], /<AuthScaffold\b/, screen);
});

Deno.test('every secure Field passes the bare prop, so no screen rolls its own toggle, and keeps its AutoFill props', () => {
  const drawn = new Set(Object.values(PASSWORD_SCREENS));
  let count = 0;
  for (const path of drawn) {
    for (const tag of openingTags(SOURCES[path], 'Field').filter((t) => /\bsecureTextEntry\b/.test(t))) {
      count++;
      assertMatch(tag, /\bsecureTextEntry\s/, path);
      assert(!/\bsecureTextEntry=/.test(tag), `${path}: a bare secureTextEntry, never an expression`);
      assertMatch(tag, /textContentType="(password|newPassword)"/, path);
      assertMatch(tag, /autoComplete="(current-password|new-password)"/, path);
    }
  }
  // Sign in, Create account, New + Confirm (reset and change password share them), the delete proof.
  assertEquals(count, 5);
  // Create account keeps newPassword, so iOS can still offer a strong password there.
  const create = openingTags(SOURCES['app/create-account.tsx'], 'Field').find((t) => /\bsecureTextEntry\b/.test(t))!;
  assertMatch(create, /textContentType="newPassword"/);
  assertMatch(create, /autoComplete="new-password"/);
});
