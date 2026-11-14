/**
 * Security brief 2026-11-13 (LOW): every DEV fixture / capture-seam env read in the app sits behind `__DEV__` or `SEAM_ON`,
 * so a release build cannot reach a fixture even if someone sets the variable. Before, a few knobs (MATCHUP_FIXTURE,
 * PORTFOLIO_STAKE, DELETED_SEAT, the seam's DRAFT_START / DRAFT_ROOM / HOME / LEAGUE / QUEUE knobs) read the env with no
 * gate, and the guarantee was "nobody sets it", not "the code can't".
 *
 * The rule, checked over app/, components/ and lib/: each `process.env.EXPO_PUBLIC_*` read that is not real product config
 * (PRODUCT below) must sit in a `const`/`let` declaration whose initializer is gated, in one of these shapes:
 *   X = __DEV__ ? … : …   X = __DEV__ && …   X = SEAM_ON ? … : …   X = SEAM_ON && …
 *   X = parse(__DEV__, …)  X = parse(SEAM_ON, …)  X = parse(…, __DEV__)
 * where `parse` is one of GATED_PARSERS: a parser that takes the gate as an argument and is checked below to return its
 * "off" value when the gate is false. A call that merely passes SEAM_ON along (seamTableRows(SEAM_ON, …)) does not count.
 * A read anywhere else (a function body's expression, an object literal, an argument) fails, naming the file and line.
 *
 *   cd apps/mobile && deno test --no-check --sloppy-imports --allow-read --allow-env --unstable-raw-imports tests-deno/dev-env-gate.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { SOURCES } from './sourceManifest.generated.ts';
import { NO_KNOBS, parseCaptureKnobs } from '../lib/shell/captureKnobs.ts';
import { DELETE_FIXTURES, parseDeleteFixture } from '../lib/account/deleteCapture.ts';
import { NO_SIGNUP_CAPTURE, parseSignupCapture } from '../lib/auth/signupCapture.ts';
import { INFO_KEYS, parseInfoFixture } from '../lib/game/infoPopups.ts';
import { resolveMoneyFixture } from '../lib/money/fixtureMode.ts';
import { JOIN_FIXTURES, resolveJoinFixture } from '../lib/join/joinFixtureGate.ts';
import { parseResetCaptureView } from '../lib/shell/resetCaptureView.ts';
import { createFailOnce, seamActive } from '../lib/game/devSeamGate.ts';

/** Shipped configuration, set in eas.json for release builds: not a fixture, read ungated on purpose. */
const PRODUCT = new Set([
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_LEAVE_LEAGUE',
  'EXPO_PUBLIC_RUN_IT_BACK',
]);

/** Parsers that take the gate and return their "off" value without it (each is checked in the last test). */
const GATED_PARSERS = [
  'parseCaptureKnobs', 'parseDeleteFixture', 'parseSignupCapture', 'parseInfoFixture', 'resolveMoneyFixture',
  'resolveJoinFixture', 'parseResetCaptureView', 'seamActive', 'createFailOnce',
];
const GATE = String.raw`(?:__DEV__|SEAM_ON|typeof __DEV__ !== 'undefined' \? __DEV__ : false)`;
const PARSER = `(?:${GATED_PARSERS.join('|')})`;
const GATED_INIT = [
  new RegExp(String.raw`^(?:__DEV__|SEAM_ON)\s*(?:\?|&&)`),
  new RegExp(String.raw`^${PARSER}\(\s*${GATE}\s*,`),
  new RegExp(String.raw`^${PARSER}\([^;]*,\s*${GATE}\s*\)\s*;?\s*$`),
];
const DECL = /^(?:export\s+)?(?:const|let)\s+\w+\s*(?::.*?)?\s*=(?![>=])\s*([\s\S]*)$/; // a type may hold `=>`

/** Comments out, strings and code kept as they are (so a `//` inside a URL string is not a comment). */
export function stripComments(s: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < s.length) {
    const c = s[i];
    if (quote) {
      out += c;
      if (c === '\\') { out += s[i + 1] ?? ''; i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; out += c; i++; continue; }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2);
      const chunk = s.slice(i, end === -1 ? s.length : end + 2);
      out += chunk.replace(/[^\n]/g, ''); // keep line numbers
      i = end === -1 ? s.length : end + 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

export interface EnvRead { file: string; line: number; name: string; gated: boolean }

/** Every EXPO_PUBLIC_* read in one source, with whether its declaration is gated. */
export function envReads(file: string, source: string): EnvRead[] {
  const lines = stripComments(source).split('\n');
  const reads: EnvRead[] = [];
  lines.forEach((text, idx) => {
    for (const m of text.matchAll(/process\.env\.(EXPO_PUBLIC_\w+)/g)) {
      reads.push({ file, line: idx + 1, name: m[1], gated: PRODUCT.has(m[1]) || declarationGated(lines, idx) });
    }
  });
  return reads;
}

/** Walk back from the read's line to the declaration it belongs to; no statement may end in between. */
function declarationGated(lines: string[], readIdx: number): boolean {
  for (let k = readIdx; k >= 0; k--) {
    const t = lines[k].trim();
    if (k < readIdx && (/[;}]$/.test(t) || (/\{$/.test(t) && !DECL.test(t)))) return false; // a statement or block ended first
    const d = t.match(DECL);
    if (!d) continue;
    // The declaration's whole initializer: from here to the line that ends it.
    let init = d[1];
    for (let j = k + 1; j < lines.length && !/;\s*$/.test(init); j++) init += '\n' + lines[j].trim();
    return GATED_INIT.some((re) => re.test(init.trim()));
  }
  return false;
}

const APP_FILES = Object.entries(SOURCES).filter(([f]) => /^(app|components|lib)\//.test(f));

Deno.test('dev env gate: every fixture / seam env read in the app is behind __DEV__ or SEAM_ON', () => {
  const reads = APP_FILES.flatMap(([f, s]) => envReads(f, s));
  // Scope of the verdict: say what was examined, and refuse a vacuous pass (an empty manifest, a scanner that saw nothing).
  const files = new Set(reads.map((r) => r.file));
  assert(reads.length >= 60, `only ${reads.length} env reads found; the scanner is not seeing the app`);
  assert(files.size >= 15, `only ${files.size} files read the env`);
  const bad = reads.filter((r) => !r.gated).map((r) => `${r.file}:${r.line} ${r.name}`);
  assertEquals(bad, [], `ungated env reads (wrap in __DEV__ ? … : default, or SEAM_ON):\n${bad.join('\n')}`);
});

Deno.test('dev env gate: no read the scanner cannot see (bracket access, destructuring process.env)', () => {
  const hidden = APP_FILES.filter(([, s]) => /process\.env\s*\[|\}\s*=\s*process\.env\b|=\s*process\.env\s*;/.test(stripComments(s))).map(([f]) => f);
  assertEquals(hidden, []);
});

Deno.test('dev env gate: the scanner itself — gated shapes pass, ungated ones fail', () => {
  const ok = [
    "const A = __DEV__ ? process.env.EXPO_PUBLIC_X_FIXTURE : undefined;",
    "export const B: boolean = SEAM_ON && process.env.EXPO_PUBLIC_X === '1';",
    "const C = parseDeleteFixture(__DEV__, process.env.EXPO_PUBLIC_X);",
    "const D = parseResetCaptureView(process.env.EXPO_PUBLIC_X, __DEV__);",
    "export const E = parseCaptureKnobs(__DEV__, {\n  a: process.env.EXPO_PUBLIC_A,\n  b: process.env.EXPO_PUBLIC_B,\n});",
    "function f() {\n  const g = SEAM_ON && process.env.EXPO_PUBLIC_G === 'x';\n}",
    "export const f1: (key: string) => boolean = createFailOnce(SEAM_ON, process.env.EXPO_PUBLIC_CAPTURE_FAIL_ONCE);",
    "const S = seamActive(typeof __DEV__ !== 'undefined' ? __DEV__ : false, process.env.EXPO_PUBLIC_GAME_SEAM);",
    "const U = 'https://x.test'; const P = process.env.EXPO_PUBLIC_SUPABASE_URL!;",
  ];
  for (const s of ok) assert(envReads('x.ts', s).every((r) => r.gated), s);
  const bad = [
    "const A = parseMatchupFixture(process.env.EXPO_PUBLIC_MATCHUP_FIXTURE);",
    "const C = parseSomethingNew(__DEV__, process.env.EXPO_PUBLIC_X);",
    "export function f() {\n  return process.env.EXPO_PUBLIC_DELETED_SEAT === '1';\n}",
    "const rows = seamTableRows(SEAM_ON, name, {\n  bye: process.env.EXPO_PUBLIC_HOME_FIXTURE === 'bye',\n});",
    "const A = __DEV__;\nfoo(process.env.EXPO_PUBLIC_X);",
    "const A = 1;\nconst B = x(process.env.EXPO_PUBLIC_X) || __DEV__;",
    "const U = 'https://x.test'; const P = process.env.EXPO_PUBLIC_X_FIXTURE;",
  ];
  for (const s of bad) assert(envReads('x.ts', s).some((r) => !r.gated), s);
});

Deno.test('dev env gate: every GATED_PARSERS entry returns its off value when the gate is false', () => {
  assertEquals(parseCaptureKnobs(false, { card: '2', create: 'tiers', joinAuto: 'yes', signupPaused: '1', pushAsk: '1', confirmed: 'ok' }), NO_KNOBS);
  for (const f of DELETE_FIXTURES) assertEquals(parseDeleteFixture(false, f), null);
  assertEquals(parseSignupCapture(false, { error: 'network', prefill: '1' }), NO_SIGNUP_CAPTURE);
  for (const k of INFO_KEYS) assertEquals(parseInfoFixture(false, `${k}:1`), null);
  assertEquals(resolveMoneyFixture(false, { stress: 'stress', scenario: 'ok', stake: 'price_tiers' }), null);
  for (const j of JOIN_FIXTURES) assertEquals(resolveJoinFixture(false, j), null);
  assertEquals([parseResetCaptureView('form', false), parseResetCaptureView('success', false)], [null, null]);
  assertEquals(seamActive(false, '1'), false);
  assertEquals(createFailOnce(false, 'get_league_history')('get_league_history'), false);
  // and each one is ON with the gate, so the checks above are not vacuous
  assert(parseDeleteFixture(true, DELETE_FIXTURES[0]) !== null && resolveJoinFixture(true, JOIN_FIXTURES[0]) !== null);
  assert(seamActive(true, '1') && parseResetCaptureView('form', true) === 'form');
  assert(resolveMoneyFixture(true, { stress: 'stress' }) !== null && parseInfoFixture(true, `${INFO_KEYS[0]}:1`) !== null);
  assert(createFailOnce(true, 'get_league_history')('get_league_history'));
});
