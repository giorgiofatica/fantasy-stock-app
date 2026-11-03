/**
 * Two P3s, 2026-11-02/03.
 *
 * (1) Design Lead 2026-11-02: at AX5 the caption "Invite code" was drawn LARGER than the code under it. The code
 *     (InviteCodeText) is capped by its variant's maxScale; the label scaled freely. On a code surface the label now
 *     takes the code's cap (lib/game/codeLabel.ts), so it never outranks its value. Read from the source: every label
 *     that sits directly over an InviteCodeText is checked against the code it names, at every text size.
 * (2) Giorgio's phone, 1.3.0 (8), 2026-11-03: the three intro cards showed after he SIGNED OUT. A signed-in session
 *     (restored at launch, or any sign-in) now marks them seen (lib/shell/onboardingSeenBySession.ts).
 * Run: `cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { effectiveFontSize, type, type TypeVariant } from '../constants/tokens/type.ts';
import { codeLabelMaxScale } from '../lib/game/codeLabel.ts';
import { shouldMarkOnboardingSeen } from '../lib/shell/onboardingSeenBySession.ts';
import { SOURCES } from './sourceManifest.generated.ts';

// ── (1) The label over a code ──

// iOS UIFontMetrics multipliers (body 17pt base): L 1.0, XXXL 23/17, AX5 53/17. Plus a sweep in between and past.
const L = 1;
const XXXL = 23 / 17;
const AX5 = 53 / 17;
const SCALES = [0.8, L, 1.1, 1.2, XXXL, 1.6, 2, 2.27, 2.5, 3, AX5, 3.5];

const CODE_SURFACES = [
  'app/league-settings.tsx', // InviteRow
  'components/home/PreDraftCard.tsx', // the code row
  'components/game/DraftBlockersCard.tsx',
  'app/create-league.tsx', // the done screen
];

interface LabelOverCode {
  file: string;
  labelVariant: TypeVariant;
  labelCap: number | undefined;
  codeVariant: TypeVariant;
  capArg: string | null;
}

/** Every Text directly above an InviteCodeText (an optional JSX comment between), with the label's cap. */
function labelsOverCodes(file: string): LabelOverCode[] {
  const src = SOURCES[file];
  const re = /<Text variant="([\w.]+)"([^>]*)>[^<]*<\/Text>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?<InviteCodeText variant="([\w.]+)"/g;
  const out: LabelOverCode[] = [];
  for (const m of src.matchAll(re)) {
    const attrs = m[2];
    const capped = /maxFontSizeMultiplier=\{codeLabelMaxScale\('([\w.]+)'\)\}/.exec(attrs);
    // A label's cap comes from the helper or not at all: a hand-typed number could drift from the code's.
    if (!capped) assert(!attrs.includes('maxFontSizeMultiplier'), `${file}: a code label capped by hand`);
    out.push({
      file,
      labelVariant: m[1] as TypeVariant,
      capArg: capped ? capped[1] : null,
      labelCap: capped ? codeLabelMaxScale(capped[1] as TypeVariant) : type[m[1] as TypeVariant].maxScale,
      codeVariant: m[3] as TypeVariant,
    });
  }
  return out;
}

const labelSize = (l: LabelOverCode, s: number) => type[l.labelVariant].fontSize * (l.labelCap === undefined ? s : Math.min(s, l.labelCap));

Deno.test('codeLabelMaxScale is the code variant\'s own cap', () => {
  assertEquals(codeLabelMaxScale('title'), type.title.maxScale);
  assertEquals(codeLabelMaxScale('headline'), type.headline.maxScale);
  assertEquals(codeLabelMaxScale('title'), 1.6);
  assertEquals(codeLabelMaxScale('headline'), 1.6);
  assertEquals(codeLabelMaxScale('callout'), undefined); // an uncapped code: its label keeps scaling with it
});

Deno.test('each of the four code surfaces has exactly one label over its code', () => {
  for (const f of CODE_SURFACES) assertEquals(labelsOverCodes(f).length, 1, f);
});

Deno.test('a code label never outranks its code, at any text size (AX5 included)', () => {
  for (const f of CODE_SURFACES) {
    for (const l of labelsOverCodes(f)) {
      for (const s of SCALES) {
        const label = labelSize(l, s);
        const code = effectiveFontSize(l.codeVariant, s);
        assert(label <= code + 1e-9, `${f} at ${s.toFixed(2)}x: label ${label.toFixed(1)}pt > code ${code.toFixed(1)}pt`);
      }
    }
  }
});

Deno.test('a capped label takes the cap of the code it sits over, not another variant\'s', () => {
  for (const f of CODE_SURFACES) {
    for (const l of labelsOverCodes(f)) if (l.capArg !== null) assertEquals(l.capArg, l.codeVariant, f);
  }
});

Deno.test('the two capped-code surfaces are the ones whose label takes the cap; the two uncapped ones are unchanged', () => {
  const by = Object.fromEntries(CODE_SURFACES.map((f) => [f, labelsOverCodes(f)[0]]));
  assertEquals(by['app/create-league.tsx'].capArg, 'title');
  assertEquals(by['components/game/DraftBlockersCard.tsx'].capArg, 'headline');
  // Already behaving: an uncapped callout code under an uncapped label that is never larger.
  assertEquals(by['app/league-settings.tsx'].capArg, null);
  assertEquals(by['components/home/PreDraftCard.tsx'].capArg, null);
  assertEquals(by['app/league-settings.tsx'].codeVariant, 'callout');
  assertEquals(by['components/home/PreDraftCard.tsx'].codeVariant, 'callout');
});

Deno.test('L and XXXL are untouched: the label cap engages only above XXXL', () => {
  for (const f of CODE_SURFACES) {
    for (const l of labelsOverCodes(f)) {
      for (const s of [L, XXXL]) assertEquals(labelSize(l, s), type[l.labelVariant].fontSize * s, `${f} at ${s}`);
    }
  }
});

// ── (2) The intro cards after a sign-out ──

Deno.test('shouldMarkOnboardingSeen: a session marks the cards seen; no session never does', () => {
  assertEquals(shouldMarkOnboardingSeen(true, false), true); // upgraded install: signed in, never saw the cards
  assertEquals(shouldMarkOnboardingSeen(true, null), true); // still reading the flag: safe to mark (the read keeps it)
  assertEquals(shouldMarkOnboardingSeen(true, true), false); // already set: no write every launch
  // A brand-new install has no session: it still sees the cards.
  assertEquals(shouldMarkOnboardingSeen(false, false), false);
  assertEquals(shouldMarkOnboardingSeen(false, null), false);
  assertEquals(shouldMarkOnboardingSeen(false, true), false);
});

Deno.test('the root layout marks onboarding seen from the SESSION, restored or new (source guard)', () => {
  const s = SOURCES['app/_layout.tsx'];
  assert(s.includes("import { markOnboardingSeen, useGetStartedOpen, useOnboardingSeen } from '@/lib/shell/firstRun';"));
  assert(s.includes("import { shouldMarkOnboardingSeen } from '@/lib/shell/onboardingSeenBySession';"));
  // The session itself (useSession's user), not the shown phase: the gated username step and a restored session at
  // launch both count, and the shown phase lags a sign-in on purpose.
  assert(s.includes('const hasSession = user !== null;'));
  assert(s.includes('if (shouldMarkOnboardingSeen(hasSession, onboardingSeen)) markOnboardingSeen();'));
  assert(s.includes('}, [hasSession, onboardingSeen]);'));
  // It runs before the navigator's early return, so it is never skipped while the splash is up.
  assert(s.indexOf('markOnboardingSeen();') < s.indexOf('if (!phaseKnown) {'));
});

Deno.test('markOnboardingSeen persists the flag the cards\' guard reads (source guard)', () => {
  const fr = SOURCES['lib/shell/firstRun.ts'];
  assert(fr.includes("const KEY = 'sp.onboarding.seen.v1';"));
  assert(/export function markOnboardingSeen\(\): void \{\n  seen = true;\n  emit\(\);[\s\S]*?AsyncStorage\.setItem\(KEY, '1'\)/.test(fr));
  assert(SOURCES['app/_layout.tsx'].includes('<Stack.Protected guard={!onboardingSeen && !pendingRoute.peek() && !invite.code}>'));
});
