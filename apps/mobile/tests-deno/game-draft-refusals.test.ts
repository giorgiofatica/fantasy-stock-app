/**
 * A stalled draft turn (3c; ruled copy 3c-2, board #game "Draft paused"): shown
 * as waiting, never as a pick: the tag and the headline, no line under them
 * (UX rule 12; PRODUCT_RULES "Nobody is notified"). The
 * placeholder copy this module used to hold is gone (P0, Design Lead audit).
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assertEquals } from 'jsr:@std/assert';
import { turnState } from '../lib/game/draftRefusals.ts';

Deno.test('a stalled turn: the tag and the headline only, the same for everyone (rule 12: the line is cut)', () => {
  assertEquals(turnState({ reason: 'stalled', pickNumber: 14, managerName: 'Paolo M.' }), {
    kind: 'stalled',
    tag: 'Draft paused',
    label: "No stock left fits Paolo M.'s next slot",
  });
  // No "line" key at all, so the room cannot draw an empty caption.
  assertEquals('line' in turnState({ reason: 'stalled', pickNumber: 14, managerName: 'Paolo M.' }), false);
});

Deno.test('no manager name: "the next open slot" (ruling), never "the next manager\'s next slot"', () => {
  assertEquals(turnState({ reason: 'stalled', pickNumber: 14, managerName: '  ' }).label, 'No stock left fits the next open slot');
  assertEquals(turnState({ reason: 'stalled', pickNumber: 14 }).label, 'No stock left fits the next open slot');
});

Deno.test('a normal turn is not stalled and carries no copy', () => {
  assertEquals(turnState({ reason: null, pickNumber: 14 }), { kind: 'normal', tag: null, label: null });
});

Deno.test('no stalled line is a placeholder', () => {
  const s = turnState({ reason: 'stalled', pickNumber: 1, managerName: 'A' });
  for (const v of [s.tag, s.label]) assertEquals(String(v).includes('[new copy'), false);
});
