/**
 * Email fields (Orchestrator, 2026-11-06): a plus-address sign-up (`name+t1@gmail.com`) was refused, and
 * the keyboard changing what was typed has to be ruled out. Every email field in the app turns off
 * autocorrect and the spell checker, and keeps the props AutoFill and the right keyboard need.
 * Run: cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .
 */
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert';
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

/** Every email field: the auth screens' `Field` and its `textContentType`. */
const EMAIL_FIELDS: Record<string, string> = {
  'app/login.tsx': 'username', // sign in pairs the email with the password as the account's username
  'app/create-account.tsx': 'emailAddress',
  'app/forgot-password.tsx': 'emailAddress',
};

/** Any element in the app's source that asks for the email keyboard or the email AutoFill. */
function emailElements(): { path: string; tag: string }[] {
  const out: { path: string; tag: string }[] = [];
  for (const [path, src] of Object.entries(SOURCES)) {
    if (!path.startsWith('app/') && !path.startsWith('components/')) continue;
    for (const name of ['Field', 'TextInput']) {
      for (const tag of openingTags(src, name)) {
        if (/keyboardType="email-address"|autoComplete="email"|textContentType="emailAddress"/.test(tag)) out.push({ path, tag });
      }
    }
  }
  return out;
}

Deno.test('every email field turns off autocorrect and the spell checker', () => {
  for (const [path] of Object.entries(EMAIL_FIELDS)) {
    const tags = openingTags(SOURCES[path], 'Field').filter((t) => /label="Email address"/.test(t));
    assertEquals(tags.length, 1, path);
    assertMatch(tags[0], /\bautoCorrect=\{false\}/, path);
    assertMatch(tags[0], /\bspellCheck=\{false\}/, path);
  }
});

Deno.test('every email field keeps the keyboard, capitalisation and AutoFill props', () => {
  for (const [path, contentType] of Object.entries(EMAIL_FIELDS)) {
    const tag = openingTags(SOURCES[path], 'Field').find((t) => /label="Email address"/.test(t))!;
    assertMatch(tag, /\bkeyboardType="email-address"/, path);
    assertMatch(tag, /\bautoCapitalize="none"/, path);
    assertMatch(tag, /\bautoComplete="email"/, path);
    assertMatch(tag, new RegExp(`\\btextContentType="${contentType}"`), path);
  }
});

Deno.test('no email field exists outside the three above, so none can skip the props', () => {
  const found = emailElements();
  assertEquals(found.map((f) => f.path).sort(), Object.keys(EMAIL_FIELDS).sort());
  for (const { path, tag } of found) {
    assertMatch(tag, /\bautoCorrect=\{false\}/, path);
    assertMatch(tag, /\bspellCheck=\{false\}/, path);
  }
});

Deno.test('Field passes autoCorrect and spellCheck through to its TextInput, and sets neither itself', () => {
  const src = SOURCES['components/shell/Field.tsx'];
  const tag = openingTags(src, 'TextInput')[0];
  assertMatch(tag, /\{\.\.\.input\}/);
  // Nothing before the spread can pin them on (a caller's false would lose to a literal after it).
  assert(!/\b(autoCorrect|spellCheck)\b/.test(src.replace(/^\s*\/\/.*$/gm, '')), 'Field leaves both to the caller');
});
