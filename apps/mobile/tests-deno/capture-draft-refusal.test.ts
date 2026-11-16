/**
 * EXPO_PUBLIC_CAPTURE_DRAFT_REFUSAL (DEV-only capture knob): seeds the ONE server refusal that puts the draft room on its stalled card, its
 * "waiting for prices" caption, or the lobby's retrying start. It follows the seam pattern (like CAPTURE_CONFIRM_REFUSAL): read only when SEAM_ON,
 * seeded in the fixture's response, and it adds no user-facing string.
 *
 *   cd apps/mobile/tests-deno && deno test --no-check --sloppy-imports --unstable-raw-imports --allow-read --allow-env capture-draft-refusal.test.ts
 */
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';
import { CAPTURE_DRAFT_REFUSALS, captureDraftRefusal, invokeFixtureFor } from '../lib/game/seamFixtures.ts';
import { nextAskStep } from '../lib/game/autoPickAsk.ts';
import { readFunctionRefusal } from '../lib/functionRefusal.ts';
import { startKickOutcome } from '../lib/game/autoStart.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const AUTO_PICK = { league_id: 'l', action: 'auto_pick', pick_number: 3 };
const START = { league_id: 'l', action: 'start' };

Deno.test('stalled and price_unavailable refuse the room\'s auto_pick ask, and nothing else', () => {
  for (const reason of ['stalled', 'price_unavailable']) {
    assertEquals(captureDraftRefusal('validate-and-record-pick', AUTO_PICK, reason), { data: { ok: false, reason }, error: null });
    assertEquals(captureDraftRefusal('validate-and-record-pick', { ...AUTO_PICK, action: 'manual' }, reason), null, 'a manual pick is not refused');
    assertEquals(captureDraftRefusal('draft-control', START, reason), null);
  }
});

Deno.test('draft_start_retrying refuses draft-control start, and nothing else', () => {
  assertEquals(captureDraftRefusal('draft-control', START, 'draft_start_retrying'), { data: { ok: false, reason: 'draft_start_retrying' }, error: null });
  assertEquals(captureDraftRefusal('draft-control', { action: 'status' }, 'draft_start_retrying'), null);
  assertEquals(captureDraftRefusal('validate-and-record-pick', AUTO_PICK, 'draft_start_retrying'), null);
});

Deno.test('the function matters, not only the action: the right action on the wrong function is not refused', () => {
  assertEquals(captureDraftRefusal('draft-control', AUTO_PICK, 'stalled'), null);
  assertEquals(captureDraftRefusal('draft-control', AUTO_PICK, 'price_unavailable'), null);
  assertEquals(captureDraftRefusal('validate-and-record-pick', START, 'draft_start_retrying'), null);
});

Deno.test('unset, empty or an unknown reason seeds nothing (the fixtures answer as before)', () => {
  for (const r of [undefined, null, '', 'bogus', 'toString', '__proto__']) assertEquals(captureDraftRefusal('validate-and-record-pick', AUTO_PICK, r), null, String(r));
  assertEquals(invokeFixtureFor('validate-and-record-pick', AUTO_PICK, null, null, null, null)?.data, { ok: true, pick: { symbol: 'NVDA', pick_source: 'auto_best' }, pick_source: 'auto_best', draft_complete: false });
  assertEquals(invokeFixtureFor('draft-control', START, null, null, null, null)?.data, { ok: true });
});

Deno.test('the seeded answers drive the REAL app logic: stalled, waiting for prices, retrying', async () => {
  const step = async (reason: string) => {
    const f = invokeFixtureFor('validate-and-record-pick', AUTO_PICK, null, null, null, reason)!;
    return nextAskStep(await readFunctionRefusal(f.data, f.error)).kind;
  };
  assertEquals(await step('stalled'), 'stalled');
  assertEquals(await step('price_unavailable'), 'waiting_for_prices');
  const s = invokeFixtureFor('draft-control', START, null, null, null, 'draft_start_retrying')!;
  const r = await readFunctionRefusal(s.data, s.error);
  assertEquals(startKickOutcome(r.transport ? null : { ok: false, reason: r.reason }), 'retrying');
});

Deno.test('it adds no user-facing string: the seeded body is {ok, reason} and the reasons are the server\'s own codes', () => {
  for (const [reason, rule] of Object.entries(CAPTURE_DRAFT_REFUSALS)) {
    assertEquals(Object.keys(captureDraftRefusal(rule.fn, { action: rule.action }, reason)!.data).sort(), ['ok', 'reason']);
    assert(/^[a-z_]+$/.test(reason), reason);
  }
});

Deno.test('DEV-only and seam-shaped: read behind SEAM_ON, handed through the seam\'s one invoke, never read elsewhere', () => {
  const dev = SOURCES['lib/game/devSeam.ts'];
  assert(dev.includes("export const CAPTURE_DRAFT_REFUSAL: string | null = SEAM_ON ? process.env.EXPO_PUBLIC_CAPTURE_DRAFT_REFUSAL || null : null;"));
  assert(SOURCES['lib/game/seamCalls.ts'].includes('LEAVE_FIXTURE, CAPTURE_CONFIRM_REFUSAL, CAPTURE_DRAFT_REFUSAL);'));
  const readers = Object.entries(SOURCES).filter(([, s]) => s.includes('process.env.EXPO_PUBLIC_CAPTURE_DRAFT_REFUSAL')).map(([p]) => p).sort();
  assertEquals(readers, ['lib/game/devSeam.ts'], 'one reader, the gated one');
  const calls = SOURCES['lib/game/seamCalls.ts'];
  assert(calls.indexOf('invokeFixtureFor(fn, opts.body') > calls.indexOf('export async function seamInvoke') && calls.indexOf('invokeFixtureFor(fn, opts.body') < calls.indexOf('return supabase.functions' + '.invoke(fn, opts)'));
  assertFalse(SOURCES['lib/game/seamFixtures.ts'].includes('process.env'), 'the pure fixture module reads no env');
});
