/**
 * Create league's × (PRODUCT_RULES, "Create league needs an easier way out", 2026-11-17, ruled "A"): every step has a × at the
 * top right (44x44, "Close") that closes the whole flow at once with no prompt; "‹ Back" stays on steps 2-4; "Step N of 4" is
 * the true centre; the × is dead while the create request is in flight.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { closeCreateLeague, closeDisabled } from '../lib/game/createLeagueClose.ts';
import { SOURCES } from './sourceManifest.generated.ts';

Deno.test('C2: × dismisses at once from any step, with no prompt', () => {
  let dismissed = 0;
  assertEquals(
    closeCreateLeague(false, () => {
      dismissed++;
    }),
    true,
  );
  assertEquals(dismissed, 1);
});

Deno.test('C6: × does nothing while creating, and is live again after', () => {
  let dismissed = 0;
  assertEquals(closeDisabled(true), true);
  assertEquals(
    closeCreateLeague(true, () => {
      dismissed++;
    }),
    false,
  );
  assertEquals(dismissed, 0);
  assertEquals(closeDisabled(false), false);
});

Deno.test('C2/C4/C6 wiring: create-league passes a × on every step that dismisses with no Alert, disabled while creating; step 1 has no Cancel', () => {
  const s = SOURCES['app/create-league.tsx'];
  assert(s.includes('close={{ onPress: () => closeCreateLeague(creating, () => router.dismiss()), disabled: closeDisabled(creating) }}'));
  assert(s.includes("back={step === 'league' ? undefined : { label: 'Back', onPress: goBack }}"));
  assertEquals(s.includes("'Cancel'"), false);
  // The close path is the helper: no Alert / discard prompt anywhere in it.
  const lib = SOURCES['lib/game/createLeagueClose.ts'];
  assertEquals(/Alert/.test(lib.replace(/\/\*[\s\S]*?\*\//g, '')), false);
  // goBack still goes one step back, then dismisses from step 1 (C3).
  assert(s.includes('const prev = prevStep(step);\n    if (prev) setStep(prev);\n    else router.dismiss();'));
});

Deno.test('C1/C4/C5: the scaffold draws a 44x44 "Close" button in the text colour at the top right; the modal Cancel variant is gone; Step N of 4 sits between two flex:1 columns', () => {
  const c = SOURCES['components/game/SetupScaffold.tsx'];
  assert(c.includes('accessibilityRole="button"\n                  accessibilityLabel="Close"'));
  assert(c.includes('<Icon name="close" size="tab" tone="text" />'));
  assert(/close: \{\n    width: 44,\n    height: 44,/.test(c));
  assert(c.includes('onPress={close.disabled ? undefined : close.onPress}') && c.includes('disabled={close.disabled}'));
  assertEquals(c.includes('backModal'), false);
  assertEquals(c.includes('modal?:'), false);
  assert(/topSide: \{\n    flex: 1,/.test(c));
  // Back | Step | × : the step caption is between the two sides, and step 1 keeps the empty back View so the row does not jump.
  const back = c.indexOf('<View style={styles.topSide}>');
  const step = c.indexOf('Step ${step.number} of ${step.total}');
  const closeCol = c.indexOf('styles.topSideRight');
  assert(back > 0 && step > back && closeCol > step);
  assert(c.includes('<View style={styles.back} />'));
  // C3/C8: Back and Step keep the top-row cap (TOP_ROW_MAX_SCALE).
  assertEquals(c.match(/maxFontSizeMultiplier=\{TOP_ROW_MAX_SCALE\}/g)?.length, 2);
});

Deno.test('P2: the top row has no padding of its own, so Step N of 4 is the true centre; the × keeps its inset as a margin inside its column', () => {
  const c = SOURCES['components/game/SetupScaffold.tsx'];
  const row = c.slice(c.indexOf('  topRow: {'), c.indexOf('  topSide: {'));
  assertEquals(/padding/.test(row.replace(/\/\/[^\n]*\n/g, '')), false);
  assert(/close: \{[^}]*marginRight: space\[3\],/.test(c));
});

Deno.test('P3: the × is drawn at 0.5 opacity while it is disabled (creating)', () => {
  const c = SOURCES['components/game/SetupScaffold.tsx'];
  assert(c.includes('style={[styles.close, close.disabled ? styles.closeDisabled : null]}'));
  assert(/closeDisabled: \{\n    opacity: 0\.5,/.test(c));
});

Deno.test('C7: League settings is untouched (sheet bar), and the done screen passes no ×', () => {
  const s = SOURCES['app/league-settings.tsx'];
  assertEquals(s.includes('close={{'), false);
  const c = SOURCES['app/create-league.tsx'];
  const done = c.slice(c.indexOf('if (created) {'), c.indexOf('const last = step'));
  assertEquals(done.includes('close='), false);
  assertEquals(done.includes('back='), false);
});
