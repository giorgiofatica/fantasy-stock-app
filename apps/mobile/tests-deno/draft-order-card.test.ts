/**
 * When the lobby draws the draft-order card (Giorgio picked B on call-waiting-card): below 4 managers the
 * waiting card keeps its bar and "N of 4 managers"; at 4 or more with no order yet NO card (the rule-12 sweep
 * left it a bare tag, the countdown above says when); the order card once the order is set.
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { draftOrderCard } from '../lib/game/draftLobby.ts';
import lobbySrc from '../components/game/DraftLobby.tsx' with { type: 'text' };

const base = { waiting: false, hasOrder: false, memberCount: 5, minMembers: 4 };

Deno.test('below the minimum: the waiting card, with or without the server saying it is waiting', () => {
  assertEquals(draftOrderCard({ ...base, memberCount: 3 }), 'waiting');
  assertEquals(draftOrderCard({ ...base, memberCount: 3, waiting: true }), 'waiting');
  assertEquals(draftOrderCard({ ...base, memberCount: 1 }), 'waiting');
});

Deno.test('4 or more managers and no order yet: no card at all', () => {
  assertEquals(draftOrderCard({ ...base, memberCount: 4 }), null);
  assertEquals(draftOrderCard({ ...base, memberCount: 5 }), null);
  assertEquals(draftOrderCard({ ...base, memberCount: 16 }), null);
});

Deno.test('order set: the order card, at the minimum and above', () => {
  assertEquals(draftOrderCard({ ...base, memberCount: 4, hasOrder: true }), 'order');
  assertEquals(draftOrderCard({ ...base, memberCount: 6, hasOrder: true }), 'order');
});

Deno.test('a failed first read (no counts, no order) draws nothing rather than a bare tag', () => {
  assertEquals(draftOrderCard({ waiting: null, hasOrder: false, memberCount: 0, minMembers: 0 }), null);
});

Deno.test('the server saying "waiting" beats a leftover order: below the minimum it stays the waiting card', () => {
  assertEquals(draftOrderCard({ ...base, memberCount: 3, waiting: true, hasOrder: true }), 'waiting');
});

Deno.test('DraftLobby draws each card only through draftOrderCard', () => {
  assert(lobbySrc.includes("card === 'waiting' ? ("));
  assert(lobbySrc.includes("card === 'order' && order ? ("));
  assert(!lobbySrc.includes('data.waiting || !order'));
});
