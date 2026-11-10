/**
 * Phone pass step 22, build 1.3.0 (12), 2026-11-10 (Giorgio): "when I was pressing the invite something new
 * card, nothing was happening … there shouldn't be any button that doesn't do anything."
 *
 * After "Invite someone new" saved, the blocker stayed (the start is blocked until a human joins, migration
 * 20261107000005) with choice 'invite', and the card drew the same two buttons again. The approved state is
 * board #call-leave ReconfirmCard mode 'inviting' (PR #122): the title, the line, the invite code with Share,
 * and "Move forward with N instead". The rules are pure (autoStart.reconfirmView); the card's wiring is read
 * from its source.
 * Run: `cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  INVITE_SOMEONE_NEW,
  INVITE_WAITING_LINE,
  INVITE_WAITING_TITLE_NO_NAME,
  RECONFIRM_NOT_SAVED,
  fixableBlockers,
  inviteWaitingTitle,
  moveForwardInsteadLabel,
  moveForwardLabel,
  reconfirmView,
} from '../lib/game/autoStart.ts';
import { draftStartStatusFixture, parseDraftStartFixture } from '../lib/game/autoStartFixture.ts';
import { invokeFixtureFor } from '../lib/game/seamFixtures.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const CARD = SOURCES['components/game/DraftBlockersCard.tsx'];
const NOW = Date.parse('2026-10-03T12:00:00Z');

const sofia = (choice?: string) => ({
  code: 'roster_reconfirm_required', departed: [{ name: 'Sofia F.' }], membersBefore: 8, members: 7, ...(choice ? { choice } : {}),
});

// ── the rules ──

Deno.test("a 'pending' choice shows the two buttons; an 'invite' choice shows the waiting state", () => {
  assertEquals(reconfirmView(sofia('pending'), 9), { mode: 'choose', members: 7 });
  const v = reconfirmView(sofia('invite'), 9);
  assertEquals(v.mode, 'inviting');
});

Deno.test('no choice (an older draft-control), or one we do not know, is the two buttons: the choice is never hidden', () => {
  assertEquals(reconfirmView(sofia(), 7).mode, 'choose');
  assertEquals(reconfirmView(sofia('mystery'), 7).mode, 'choose');
  assertEquals(reconfirmView({ code: 'roster_reconfirm_required' }, 5), { mode: 'choose', members: 5 });
});

Deno.test("the waiting state's copy is the approved board strings (board #call-leave, PR #122)", () => {
  const v = reconfirmView(sofia('invite'), 7);
  if (v.mode !== 'inviting') throw new Error('expected inviting');
  assertEquals(v.title, "Invite someone to take Sofia F.'s place");
  assertEquals(v.line, 'Share the code. When someone joins, the draft is ready to go.');
  assertEquals(v.moveForward, 'Move forward with 7 instead');
  assertEquals(inviteWaitingTitle('Ana P.'), "Invite someone to take Ana P.'s place");
});

Deno.test('the member count is the blocker\'s own, then the league\'s', () => {
  const v = reconfirmView({ code: 'roster_reconfirm_required', choice: 'invite', departed: [{ name: 'Sofia F.' }] }, 6);
  if (v.mode !== 'inviting') throw new Error('expected inviting');
  assertEquals(v.moveForward, 'Move forward with 6 instead');
  assertEquals(moveForwardInsteadLabel(1), 'Move forward with 1 instead');
});

Deno.test('two or more left, or none named: the title drops the name (NEW copy), the line is unchanged', () => {
  for (const departed of [[], [{ name: 'Sofia F.' }, { name: 'Ana P.' }], [{ name: '' }]]) {
    const v = reconfirmView({ code: 'roster_reconfirm_required', choice: 'invite', departed, membersBefore: 8, members: 6 }, 6);
    if (v.mode !== 'inviting') throw new Error('expected inviting');
    assertEquals(v.title, INVITE_WAITING_TITLE_NO_NAME);
    assertEquals(v.title, 'Invite someone to take their place');
    assertEquals(v.line, INVITE_WAITING_LINE);
  }
});

Deno.test('the pending buttons keep their labels', () => {
  assertEquals(moveForwardLabel(7), 'Move forward with 7');
  assertEquals(INVITE_SOMEONE_NEW, 'Invite someone new');
  assertEquals(RECONFIRM_NOT_SAVED, "Your choice wasn't saved. Try again.");
});

// ── the card: the invite state is a state, not the same two buttons ──

Deno.test('the card branches on the reconfirm view, so the invite state cannot draw the pending buttons', () => {
  assert(CARD.includes('reconfirmView(b, memberCount)'));
  // The two pending buttons sit only in the branch AFTER the inviting early-return.
  const inviting = CARD.indexOf("view.mode === 'inviting'");
  const choose = CARD.indexOf('label={INVITE_SOMEONE_NEW}');
  assert(inviting !== -1 && choose !== -1 && inviting < choose, 'the inviting branch comes before the two-button render');
  assertEquals(CARD.split('INVITE_SOMEONE_NEW').length - 1, 2, 'imported once, rendered once');
});

Deno.test('the waiting state shows the line, the code row and "Move forward with N instead", in the board order', () => {
  const at = (needle: string) => {
    const i = CARD.indexOf(needle);
    assert(i !== -1, `missing: ${needle}`);
    return i;
  };
  const line = at('{view.line}');
  const code = at('{inviteRow()}');
  const back = at('label={view.moveForward}');
  assert(line < code && code < back, 'line, then the code row, then the way back');
  // The way back is the move_forward choice, and it is a real handler.
  assert(CARD.includes("label={view.moveForward} variant=\"ghost\" size=\"sm\" onPress={() => choose('move_forward')}"));
});

Deno.test('the waiting sub-card\'s title is the approved one; the other blockers keep theirs', () => {
  assert(CARD.includes('const subCardTitle = (b: Blocker) =>'));
  assert(CARD.includes('{subCardTitle(b)}'));
  assert(!CARD.includes('{blockerTitle(b)}'), 'the card must not render the raw clause for the reconfirm blocker');
  assert(CARD.includes("if (b.code !== 'roster_reconfirm_required') return blockerTitle(b);"));
  assert(CARD.includes("return view.mode === 'inviting' ? view.title : blockerTitle(b);"), 'the waiting state titles itself');
});

Deno.test('the invite row is shared: one label over one code, Share only when it is shown (null while hidden)', () => {
  assertEquals(CARD.split('<InviteCodeText').length - 1, 1, 'one code row for both sub-cards');
  assert(CARD.includes("if (b.code === 'not_enough_members') return inviteRow();"));
  assert(CARD.includes('{onShareInvite ? <Button label="Share invite code"'));
  // The code stays when Share is hidden: the row does not depend on onShareInvite.
  assert(CARD.includes('inviteCode ? ('));
});

Deno.test('every button in the card does something: each onPress is a real handler and each fix button reports saving', () => {
  const buttons = [...CARD.matchAll(/<Button\b[\s\S]*?\/>/g)];
  assertEquals(buttons.length, 5, 'Share, Move forward instead, Move forward, Invite someone new, Pick a new draft time');
  for (const m of buttons) assert(/onPress=\{/.test(m[0]), `a Button with no onPress: ${m[0]}`);
  // The tapped reconfirm button shows the spinner while the choice saves.
  assertEquals(CARD.split("status={statusOf('move_forward')}").length - 1, 2);
  assertEquals(CARD.split("status={statusOf('invite')}").length - 1, 1);
  assert(CARD.includes("const statusOf = (c: 'move_forward' | 'invite') => (busy && tapped === c ? 'loading' : 'idle');"));
});

Deno.test('a refused save still shows at the card\'s bottom from the invite state', () => {
  // The error line is the card's last child, outside every sub-card, so it does not depend on the choice.
  const err = CARD.indexOf('{error ? (');
  const subCards = CARD.indexOf('{blockers.map((b, i) => (');
  assert(err > subCards);
  assert(CARD.includes('accessibilityLiveRegion="polite"'));
  assert(!CARD.slice(err).includes('reconfirmView'), 'the error line is not gated on the reconfirm view');
});

// ── the fixture and the seam ──

Deno.test("the 'invite' fixture carries choice 'invite' on the reconfirm blocker, and only there", () => {
  for (const state of ['at_risk', 'postponed'] as const) {
    const pending = fixableBlockers(draftStartStatusFixture(state, false, NOW).blockers as { code: string }[]);
    const invite = fixableBlockers(draftStartStatusFixture(state, false, NOW, true).blockers as { code: string }[]);
    assertEquals(pending.map((b) => b.code), invite.map((b) => b.code), state);
    assertEquals(pending.find((b) => b.code === 'roster_reconfirm_required')?.choice, 'pending', state);
    assertEquals(invite.find((b) => b.code === 'roster_reconfirm_required')?.choice, 'invite', state);
    assertEquals(reconfirmView(invite[0], 7).mode, 'inviting', state);
    assertEquals(reconfirmView(pending[0], 7).mode, 'choose', state);
  }
});

Deno.test('EXPO_PUBLIC_DRAFT_START_FIXTURE takes an :invite flag, alone or with :member', () => {
  assertEquals(parseDraftStartFixture('at_risk:invite'), { state: 'at_risk', member: false, invite: true });
  assertEquals(parseDraftStartFixture('at_risk:member:invite'), { state: 'at_risk', member: true, invite: true });
  assertEquals(parseDraftStartFixture('at_risk:invite:member'), { state: 'at_risk', member: true, invite: true });
  assertEquals(parseDraftStartFixture('at_risk'), { state: 'at_risk', member: false, invite: false });
  const res = invokeFixtureFor('draft-control', { action: 'status' }, 'postponed:invite', null) as { data: { blockers: { code: string; choice?: string }[] } };
  assertEquals(res.data.blockers.find((b) => b.code === 'roster_reconfirm_required')?.choice, 'invite');
});
