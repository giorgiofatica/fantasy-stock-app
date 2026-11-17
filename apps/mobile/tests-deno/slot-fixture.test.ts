/**
 * The slot check's DEV capture knob (lib/game/slotFixture.ts): dead outside __DEV__, a known value only, and the "short" answer
 * really is short for an 8-team league (so the REAL check draws the line).
 * Run: cd apps/mobile/tests-deno && deno test .
 */
import { assert, assertEquals, assertThrows } from 'jsr:@std/assert';
import { FIXTURE_SLOTS, fixtureCountMatches, parseSlotFixture } from '../lib/game/slotFixture.ts';
import { runSlotCheck, slotCheckBlockReason, visibleSlotLines } from '../lib/game/slotCheck.ts';
import { SOURCES } from './sourceManifest.generated.ts';

Deno.test('the slot fixture knob is dead in a release bundle and ignores unknown values', () => {
  assertEquals(parseSlotFixture(false, 'short'), null);
  assertEquals(parseSlotFixture(true, 'short'), 'short');
  assertEquals(parseSlotFixture(true, 'failed'), 'failed');
  assertEquals(parseSlotFixture(true, 'nope'), null);
  assertEquals(parseSlotFixture(true, undefined), null);
  assert(SOURCES['lib/shell/captureDev.ts'].includes('parseSlotFixture(__DEV__, process.env.EXPO_PUBLIC_SLOT_FIXTURE)'));
});

Deno.test('the fixture slots fill six rounds, and "short" starves exactly slot 3 through the real check', async () => {
  const deps = { isPartial: async () => false, countMatches: async (q: { priceMin: number | null }) => fixtureCountMatches('short', q) };
  const r = await runSlotCheck(FIXTURE_SLOTS, 8, 6, deps);
  assertEquals(r.lines[2], 'Only 9 draftable stocks match — the league needs at least 16.');
  assertEquals(r.lines[0], null);
  assertEquals(r.lines[1], null);
  assertThrows(() => fixtureCountMatches('failed', { priceMin: 100 }));
  const failed = await runSlotCheck(FIXTURE_SLOTS, 8, 6, { isPartial: async () => false, countMatches: async (q) => fixtureCountMatches('failed', q) });
  assertEquals(failed.failed, true);
});
