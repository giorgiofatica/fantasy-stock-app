/**
 * Home's pre-draft card on draft auto-start (3c-2), source guards: it runs on
 * the SAME hook and view as the League tab's lobby (so the two never
 * disagree), never asks the server to start, and has no countdown of its own.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assertEquals } from 'jsr:@std/assert';
import homeSrc from '../components/home/PreDraftCard.tsx' with { type: 'text' };

Deno.test('Home uses the shared auto-start hook, without the start request', () => {
  assertEquals(homeSrc.includes('useDraftAutoStart(leagueId, { kick: false })'), true);
  assertEquals(homeSrc.includes("action: 'start'"), false);
});

Deno.test('Home\'s cards come from homeView (lobbyView), the clock from countdownCopy / startClock', () => {
  assertEquals(homeSrc.includes('homeView(phase, ds.isCommissioner, auto.fixable.length)'), true);
  assertEquals(homeSrc.includes('countdownCopy(view.countdown, startsAt, serverNow)'), true);
});

Deno.test('no second countdown logic on Home: the old minute tick and countdownLabel are gone', () => {
  assertEquals(homeSrc.includes('countdownLabel'), false);
  assertEquals(homeSrc.includes('60_000'), false);
});

Deno.test('the commissioner\'s blockers card on Home is the lobby\'s (AutoStartBlockers)', () => {
  assertEquals(homeSrc.includes('<AutoStartBlockers'), true);
});

// ── Home's draft card (board #call-auto-start › "Home's draft card", PR #135) ──

Deno.test("once the room is open the button is \"Go to the draft room\" (to the League tab), else \"Build your queue\"", () => {
  assertEquals(homeSrc.includes("const roomOpen = view?.countdown === 'room_open' || view?.countdown === 'starting';"), true);
  assertEquals(homeSrc.includes('label={roomOpen ? GO_TO_DRAFT_ROOM : BUILD_YOUR_QUEUE}'), true);
  assertEquals(homeSrc.includes("router.push('/(tabs)/league')"), true);
});

Deno.test('the room-opens line is gone (rule 12, the sweep row 5): the card never shows an order-time line, so two sources cannot disagree on it', () => {
  assertEquals(homeSrc.includes('finalizeAt'), false);
  assertEquals(homeSrc.includes('orderSet'), false);
});

Deno.test("members' postponed copy is Home's (no \"and on your Home\")", () => {
  // One copy now (no surface argument): the lobby's twin of the line is cut too.
  assertEquals(homeSrc.includes('memberPostponedCopy(commissionerName)'), true);
  assertEquals(homeSrc.includes("memberPostponedCopy(commissionerName, 'home')"), false);
});

Deno.test('commissioner: postponed REPLACES the draft card; at risk sits ON TOP of it', () => {
  const blockersAt = homeSrc.indexOf('<AutoStartBlockers');
  const replaceAt = homeSrc.indexOf("{homeShowsDraftCard(view, ds.status === 'error') ? (");
  assertEquals(blockersAt > 0 && replaceAt > blockersAt, true);
});
