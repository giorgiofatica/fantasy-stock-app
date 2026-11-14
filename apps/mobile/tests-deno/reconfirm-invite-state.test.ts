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
  INVITE_WAITING_TITLE_NO_NAME,
  RECONFIRM_NOT_SAVED,
  errorPlacement,
  fixableBlockers,
  inviteWaitingTitle,
  keepDepartedNames,
  moveForwardInsteadLabel,
  moveForwardLabel,
  SETTLE_CAP_MS,
  readSettled,
  reconfirmView,
  showMoveForward,
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
  // Rule 12 (the sweep, row 8): "Share the code. When someone joins, the draft is ready to go." is cut; the code and Share say it.
  assertEquals('line' in v, false);
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
  const back = at('<TextAction label={view.moveForward}');
  assert(line < code && code < back, 'line, then the code row, then the way back');
  // The way back is the move_forward choice, and it is a real handler.
  assert(CARD.includes("<TextAction label={view.moveForward} onPress={() => choose('move_forward')}"));
});

Deno.test('the waiting sub-card\'s title is the approved one; the other blockers keep theirs', () => {
  assert(CARD.includes('const subCardTitle = (b: Blocker) =>'));
  assert(CARD.includes('{subCardTitle(b)}'));
  assert(!CARD.includes('{blockerTitle(b)}'), 'the card must not render the raw clause for the reconfirm blocker');
  assert(CARD.includes("if (b.code !== 'roster_reconfirm_required') return blockerTitle(b);"));
  assert(CARD.includes("return keepDepartedNames(b, view.mode === 'inviting' ? view.title : blockerTitle(b));"), 'the waiting state titles itself, and both titles keep the name whole');
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
  assertEquals(buttons.length, 4, 'Share, Move forward, Invite someone new, Pick a new draft time');
  for (const m of buttons) assert(/onPress=\{/.test(m[0]), `a Button with no onPress: ${m[0]}`);
  // The text action is the fifth control: a Pressable with a real handler, and it too reports saving.
  assert(/<TextAction label=\{view\.moveForward\} onPress=\{\(\) => choose\('move_forward'\)\} disabled=\{busy\} status=\{statusOf\('move_forward'\)\} \/>/.test(CARD));
  // The tapped reconfirm button shows the spinner while the choice saves.
  assertEquals(CARD.split("status={statusOf('move_forward')}").length - 1, 2);
  assertEquals(CARD.split("status={statusOf('invite')}").length - 1, 1);
  assert(CARD.includes("const statusOf = (c: 'move_forward' | 'invite') => (busy && tapped === c ? 'loading' : 'idle');"));
});

Deno.test('a refused save still shows from the invite state: inside the reconfirm sub-card, whatever its choice', () => {
  // The line is placed by the blocker's code, not by its choice, so 'pending' and 'invite' both keep it.
  for (const choice of ['pending', 'invite']) {
    assertEquals(errorPlacement(RECONFIRM_NOT_SAVED, 'roster_reconfirm_required', [{ code: 'roster_reconfirm_required', choice } as { code: string }]), { subCard: 0, foot: false }, choice);
  }
  assert(CARD.includes('accessibilityLiveRegion="polite"'));
  assert(!CARD.includes('reconfirmView(b, memberCount);\n  const errorLine'), 'the error line is not gated on the reconfirm view');
  assert(!/const errorLine[\s\S]{0,200}reconfirmView/.test(CARD), 'the error line is not gated on the reconfirm view');
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
  assertEquals(parseDraftStartFixture('at_risk:invite'), { state: 'at_risk', member: false, invite: true, below4: false });
  assertEquals(parseDraftStartFixture('at_risk:member:invite'), { state: 'at_risk', member: true, invite: true, below4: false });
  assertEquals(parseDraftStartFixture('at_risk:invite:member'), { state: 'at_risk', member: true, invite: true, below4: false });
  assertEquals(parseDraftStartFixture('at_risk'), { state: 'at_risk', member: false, invite: false, below4: false });
  const res = invokeFixtureFor('draft-control', { action: 'status' }, 'postponed:invite', null) as { data: { blockers: { code: string; choice?: string }[] } };
  assertEquals(res.data.blockers.find((b) => b.code === 'roster_reconfirm_required')?.choice, 'invite');
});

// ── P3: the League tab painted the wrong card first ──
// A postponed league showed "Draft order · waiting" for about a second before the Postponed card replaced it:
// league.tsx drew the lobby on `view?.order ?? true`, and `view` is null until the draft-control status answers.

import { lobbyView, lobbyShowsOrder } from '../lib/game/autoStart.ts';

const LEAGUE = SOURCES['app/(tabs)/league.tsx'];

Deno.test('before the status answers, the order card is not painted (nothing is guessed)', () => {
  assertEquals(lobbyShowsOrder(null, false), false);
});

Deno.test('a failed status read keeps the lobby under the "didn\'t load" card', () => {
  assertEquals(lobbyShowsOrder(null, true), true);
});

Deno.test('once known, the lobby follows the phase: shown for every phase but postponed', () => {
  for (const commissioner of [true, false]) {
    assertEquals(lobbyShowsOrder(lobbyView('postponed', commissioner, 1), false), false, 'postponed');
    for (const phase of ['no_date', 'scheduled', 'at_risk', 'room_open', 'starting', 'started'] as const) {
      assertEquals(lobbyShowsOrder(lobbyView(phase, commissioner, 1), false), true, phase);
    }
  }
});

Deno.test('the League tab draws the lobby through lobbyShowsOrder, never a default-to-shown', () => {
  assert(LEAGUE.includes("{!data.loading && lobbyShowsOrder(view, ds.status === 'error') ? ("));
  assert(!LEAGUE.includes('view?.order ?? true'));
});

// ── "Move forward" below 4 members: one gate (Giorgio's rule B: from four up, as before; below it, no choice) ──

Deno.test('showMoveForward is the one gate for both Move forward buttons: offered from four managers up, never below', () => {
  for (const members of [0, 1, 2, 3]) assertEquals(showMoveForward(members), false, `${members}`);
  for (const members of [4, 5, 8, 12]) assertEquals(showMoveForward(members), true, `${members}`);
  assertEquals(CARD.split('showMoveForward(view.members)').length - 1, 2, 'one gate per button, none hand-rolled');
  // Each gate wraps its own button: the pending "Move forward with N" and the waiting "... instead".
  assert(/showMoveForward\(view\.members\) \? \(\s*<TextAction label=\{view\.moveForward\}/.test(CARD));
  assert(/showMoveForward\(view\.members\) \? \(\s*<Button label=\{moveForwardLabel\(view\.members\)\}/.test(CARD));
  // No member-count comparison sits in the card: the rule lives in autoStart.ts only.
  assert(!/members\s*[<>]=?\s*\d/.test(CARD));
});

// ── a fix's refusal sits inside the sub-card that caused it (PRODUCT_RULES, auth screens, R5) ──
// Giorgio's phone, build 12 (League A, 2 of 4, playoffs 3): "Move forward with 2" printed its refusal at the very
// bottom of the card, under "Pick a new draft time", three blocks from the button.

const HOOK = SOURCES['lib/game/useDraftAutoStart.ts'];
const BLOCKERS = [{ code: 'roster_reconfirm_required' }, { code: 'playoff_teams_exceeds_members' }];

Deno.test('a refusal goes into its owner\'s sub-card, by the owner\'s position in the card', () => {
  assertEquals(errorPlacement('x', 'roster_reconfirm_required', BLOCKERS), { subCard: 0, foot: false });
  assertEquals(errorPlacement('x', 'playoff_teams_exceeds_members', BLOCKERS), { subCard: 1, foot: false });
});

Deno.test('the foot only when the owning sub-card is gone, or the owner is the foot itself; nothing without an error', () => {
  // The blocker cleared on a re-read: the refusal is not lost.
  assertEquals(errorPlacement('x', 'roster_reconfirm_required', [{ code: 'playoff_teams_exceeds_members' }]), { subCard: -1, foot: true });
  assertEquals(errorPlacement('x', 'roster_reconfirm_required', []), { subCard: -1, foot: true });
  // The new-draft-time refusal belongs to the foot (the button sits there).
  assertEquals(errorPlacement('x', 'draft_time', BLOCKERS), { subCard: -1, foot: true });
  assertEquals(errorPlacement('x', null, BLOCKERS), { subCard: -1, foot: true });
  assertEquals(errorPlacement(null, 'roster_reconfirm_required', BLOCKERS), { subCard: -1, foot: false });
  assertEquals(errorPlacement('', 'roster_reconfirm_required', BLOCKERS), { subCard: -1, foot: false });
});

Deno.test('the card renders the refusal once: inside its sub-card under the controls, or at the foot, never both', () => {
  assert(CARD.includes('const placement = errorPlacement(error, errorOwner, cards);'));
  // Inside the sub-card, after the controls (fixFor), inside the Card.
  assert(/\{fixFor\(b\)\}\s*\{placement\.subCard === i \? errorLine : null\}\s*<\/Card>/.test(CARD));
  // At the foot only on the fallback, after the sub-cards and the Pick-a-new-time block.
  assertEquals(CARD.split('errorLine : null').length - 1, 2, 'sub-card and foot, nothing else');
  assert(CARD.indexOf('{placement.foot ? errorLine : null}') > CARD.indexOf('{cards.map((b, i) => ('));
  assert(CARD.indexOf('{placement.foot ? errorLine : null}') > CARD.indexOf('label={PICK_NEW_TIME}'));
  // The live region stays on the one line element.
  assertEquals(CARD.split('accessibilityLiveRegion="polite"').length - 1, 1);
  assert(!CARD.includes('{error ? ('), 'no second, unconditional error render');
});

Deno.test('AutoStartBlockers passes the owner, so Home\'s card and the lobby\'s agree', () => {
  assert(SOURCES['components/game/AutoStartBlockers.tsx'].includes('errorOwner={f.fixErrorOwner}'));
  assert(HOOK.includes("fixErrorOwner: fixFailure?.owner ?? null"));
});

Deno.test('every refusal the hook records names the sub-card of the control that caused it', () => {
  const calls = [...HOOK.matchAll(/setFixError\(([\s\S]*?), '([a-z_]+)'\);/g)].map((m) => ({ src: m[1], owner: m[2] }));
  assertEquals(calls.length, 4);
  const by = (needle: string) => calls.find((c) => c.src.includes(needle))?.owner;
  assertEquals(by('outcome.line'), 'playoff_teams_exceeds_members'); // the stepper
  assertEquals(by('refusal'), 'roster_reconfirm_required'); // Move forward / Invite someone new
  assertEquals(by('value.error'), 'draft_time'); // the new-time sheet
  assertEquals(by('draftTimeRefusal'), 'draft_time');
  // A setter that takes no owner cannot be called by mistake.
  assert(HOOK.includes('const setFixError = (message: string | null, owner: FixOwner) =>'));
});

// ── a saved fix holds the card busy until the status re-read has landed ──
// Before: setBusy(false) ran the moment the save returned, and reread() + refresh() followed. For the length of the
// re-read the buttons were idle again with the old blocker still on screen: Giorgio's "nothing happened".

const STATUS = SOURCES['lib/game/useDraftStatus.ts'];
/** The body of `async function-const name`, up to the next blank line + 2-space const (the hook's own layout). */
const bodyOf = (src: string, name: string) => {
  const a = src.indexOf(`  const ${name} = async`);
  assert(a !== -1, name);
  const b = src.indexOf('\n  };\n', a);
  return src.slice(a, b);
};

Deno.test('a re-read has landed once its key is reached; an older read has not', () => {
  assertEquals(readSettled(5, 5), true);
  assertEquals(readSettled(6, 5), true); // a later read superseded it
  assertEquals(readSettled(4, 5), false);
  assertEquals(readSettled(-1, 0), false); // nothing has been read yet
  assertEquals(SETTLE_CAP_MS, 15_000);
});

Deno.test('the status records the key of the read behind it, for a failed read too (a failed re-read still ends busy)', () => {
  assert(STATUS.includes('readKey: number;'));
  assert(STATUS.includes('readKey: -1,'));
  assert(STATUS.includes("setState({ ...EMPTY, status: 'error', readKey: refreshKey });"));
  assert(STATUS.includes('        readKey: refreshKey,\n      });'));
});

Deno.test('a saved reconfirm holds busy: the success path has no setBusy(false) of its own, only settleAfterSave', () => {
  const body = bodyOf(HOOK, 'reconfirm');
  assert(body.includes('await settleAfterSave();'));
  // The only release in the function is the refusal branch (nothing changed, nothing to wait for).
  assertEquals(body.split('setBusy(false)').length - 1, 1);
  const refusalBranch = body.slice(body.indexOf('if (refusal !== null) {'), body.indexOf('await settleAfterSave();'));
  assert(refusalBranch.includes('setBusy(false)'));
  // No release between the invoke returning and the branch.
  assert(!body.slice(0, body.indexOf('if (refusal !== null) {')).includes('setBusy(false)'));
});

Deno.test('a saved playoff-teams change holds busy too; a refusal that changed nothing releases it', () => {
  const body = bodyOf(HOOK, 'setPlayoffTeams');
  assertEquals(body.split('await settleAfterSave();').length - 1, 2, 'saved, and locked (the room opened under us)');
  assertEquals(body.split('setBusy(false)').length - 1, 1, 'only the plain refusal releases');
  assert(body.includes("if (outcome.kind === 'locked') await settleAfterSave();\n      else setBusy(false);"));
  assert(!body.slice(0, body.indexOf('const outcome')).includes('setBusy(false)'), 'not released before the outcome is read');
});

Deno.test('busy ends when the re-read lands, or at the cap: the card is never stuck busy', () => {
  assert(HOOK.includes('if (readSettled(ds.readKey, settleAt)) {\n      setSettleAt(null);\n      setBusy(false);'));
  assert(HOOK.includes('}, SETTLE_CAP_MS);'));
  assert(HOOK.includes('return () => clearTimeout(t);'));
  // The refresh is awaited, but its failure cannot skip the wait: the key is handed over in a finally.
  assert(/try \{\s*await refresh\(\);\s*\} finally \{\s*setSettleAt\(target\);/.test(HOOK));
  // The wait is for the key this save asked for, which only rereadKey hands out.
  assert(HOOK.includes('const target = rereadKey();'));
});

// ── the capture seam's confirm_roster refusal: dev only, inert without its flag ──
// EXPO_PUBLIC_CAPTURE_CONFIRM_REFUSAL=<reason> seeds a refusal in the seam's draft-control response so the card's
// refusal line can be captured in its sub-card (the seam's confirm_roster otherwise always saves). It is read in
// devSeam.ts behind SEAM_ON and handed to the fixture layer; no component ever sees it.

import { confirmRosterRefusal } from '../lib/game/autoStart.ts';
import { confirmRosterRefusalFixture } from '../lib/game/autoStartFixture.ts';
import { readFunctionRefusal } from '../lib/functionRefusal.ts';

Deno.test('without the flag the seam\'s confirm_roster still saves (inert), whatever else is set', () => {
  const body = { action: 'confirm_roster', choice: 'move_forward' };
  for (const flag of [undefined, null, '']) {
    const res = invokeFixtureFor('draft-control', body, 'at_risk', null, flag) as { data: { ok: boolean } };
    assertEquals(res.data.ok, true, `${flag}`);
  }
  // The flag is read only for confirm_roster: status and start are untouched by it.
  const status = invokeFixtureFor('draft-control', { action: 'status' }, 'at_risk', null, 'playoff_teams_exceeds_members') as { data: { ok: boolean; blockers: unknown[] } };
  assertEquals(status.data.ok, true);
  assertEquals(status.data.blockers.length > 0, true);
  assertEquals((invokeFixtureFor('draft-control', { action: 'start' }, 'at_risk', null, 'x') as { data: { ok: boolean } }).data.ok, true);
});

Deno.test('with the flag, confirm_roster is refused with that reason and reads as the real refusal line', async () => {
  const res = invokeFixtureFor('draft-control', { action: 'confirm_roster', choice: 'move_forward' }, 'at_risk', null, 'playoff_teams_exceeds_members') as { data: unknown; error: null };
  assertEquals(res.data, confirmRosterRefusalFixture('playoff_teams_exceeds_members'));
  const read = await readFunctionRefusal(res.data, res.error);
  assertEquals(confirmRosterRefusal(read), '8 playoff teams, but 7 teams are in. Lower the playoff teams first.');
  const other = invokeFixtureFor('draft-control', { action: 'confirm_roster', choice: 'invite' }, null, null, 'mystery') as { data: unknown; error: null };
  assertEquals(confirmRosterRefusal(await readFunctionRefusal(other.data, other.error)), RECONFIRM_NOT_SAVED);
});

Deno.test('the flag is dev-seam only: gated by SEAM_ON, handed to the fixture layer, and never read by a component', () => {
  const dev = SOURCES['lib/game/devSeam.ts'];
  assert(dev.includes('export const CAPTURE_CONFIRM_REFUSAL: string | null = SEAM_ON ? process.env.EXPO_PUBLIC_CAPTURE_CONFIRM_REFUSAL || null : null;'));
  assert(SOURCES['lib/game/seamCalls.ts'].includes('DRAFT_START_FIXTURE, LEAVE_FIXTURE, CAPTURE_CONFIRM_REFUSAL)'));
  assert(SOURCES['lib/game/seamCalls.ts'].includes('const LEAVE_FIXTURE = SEAM_ON ? process.env.EXPO_PUBLIC_LEAVE_FIXTURE : undefined;'));
  for (const [file, src] of Object.entries(SOURCES)) {
    if (file.startsWith('lib/game/') && ['devSeam.ts', 'seamCalls.ts', 'seamFixtures.ts', 'autoStartFixture.ts'].some((f) => file.endsWith(f))) continue;
    assert(!src.includes('CAPTURE_CONFIRM_REFUSAL'), `${file} reads the capture flag`);
  }
  // Never in the render path: the card and the hook know nothing of it.
  assert(!CARD.includes('REFUSAL') && !HOOK.includes('CAPTURE_'));
});

// ── "Move forward with N instead" is the board's accent text action, not a ghost Button (DL gate on #356, AX5) ──

const ACTION = CARD.slice(CARD.indexOf('function TextAction'), CARD.indexOf('export function DraftBlockersCard'));
const style = (name: string) => {
  const a = CARD.indexOf(`  ${name}: {`);
  assert(a !== -1, name);
  return CARD.slice(a, CARD.indexOf('\n  },', a));
};

Deno.test('the way back is a text action: accent, semibold, a Pressable button, capped like a button label', () => {
  assert(ACTION.length > 100, 'TextAction exists');
  assert(!CARD.includes('variant="ghost"'), 'no ghost Button left in the card');
  assert(ACTION.includes('<Pressable'));
  assert(ACTION.includes('accessibilityRole="button"'));
  assert(/<Text variant="callout" color=\{colors\.accent\}/.test(ACTION), 'the LABEL is accent (not just the spinner)');
  assert(ACTION.includes('style={styles.semibold}'));
  assert(style('semibold').includes('typeFontFamily.semiBold'));
  assert(ACTION.includes('maxFontSizeMultiplier={BUTTON_LABEL_MAX_SCALE}'));
});

Deno.test('the text action keeps a 44pt target, the label at its top, flush under what precedes it (no overlap with Share)', () => {
  const st = style('textAction');
  assert(st.includes('minHeight: 44'));
  assert(st.includes("alignItems: 'flex-start'"), 'the label sits at the top of the target');
  assert(st.includes('paddingTop: 9'));
  // The card gap above (space[3]) is cancelled exactly, so the target starts at the previous sibling's edge, and the card's
  // bottom padding below is taken by the target instead of adding to it.
  assert(st.includes('marginTop: -space[3]'));
  assert(st.includes('marginBottom: -space[3]'));
  assert(style('blocker').includes('gap: space[3]'), 'the cancelled gap is the sub-card gap');
});

Deno.test('the text action reports a saving choice (spinner, no second press) and dims when another fix is busy', () => {
  assert(ACTION.includes("const loading = status === 'loading';"));
  assert(ACTION.includes('disabled={disabled || loading}'));
  assert(ACTION.includes('{loading ? <ActivityIndicator size="small" color={colors.accent} /> : null}'));
  assert(ACTION.includes("busy: loading"));
  assert(ACTION.includes('disabled && !loading ? styles.dim : null'));
});

// ── a departed manager's name never breaks (DL gate on #356, AX5: "Sofia / F.'s place") ──

const NB = ' ';
const WJ = '⁠';
const plain = (t: string) => t.replaceAll(NB, ' ').replaceAll(WJ, '');
const SOFIA_B = { code: 'roster_reconfirm_required', departed: [{ name: 'Sofia F.' }], membersBefore: 8, members: 7, choice: 'invite' };

Deno.test('both titles keep the name whole: a no-break space inside it, the possessive stays attached', () => {
  assertEquals(keepDepartedNames(SOFIA_B, inviteWaitingTitle('Sofia F.')), "Invite someone to take Sofia" + NB + "F.'s place");
  assertEquals(keepDepartedNames(SOFIA_B, 'Sofia F. left the league'), 'Sofia' + NB + 'F. left the league');
  // The words AROUND the name still wrap: only the name is glued.
  const t = keepDepartedNames(SOFIA_B, inviteWaitingTitle('Sofia F.'));
  assert(t.startsWith('Invite someone to take Sofia'));
  assertEquals(t.split(' ').length, 6, 'six breakable pieces: Invite / someone / to / take / the name (one piece) / place');
  assertEquals(plain(t), "Invite someone to take Sofia F.'s place");
});

Deno.test('display only: removing the glue gives back the plain string; the pure strings are untouched', () => {
  for (const text of ["Invite someone to take Sofia F.'s place", 'Sofia F. left the league']) assertEquals(plain(keepDepartedNames(SOFIA_B, text)), text);
  assertEquals(inviteWaitingTitle('Sofia F.'), "Invite someone to take Sofia F.'s place"); // no NBSP in the source of truth
});

Deno.test('two names, hyphens, a long name, an unrelated text, no names', () => {
  const two = { code: 'roster_reconfirm_required', departed: [{ name: 'Sofia F.' }, { name: 'Ana P.' }] };
  assertEquals(keepDepartedNames(two, 'Sofia F. and Ana P. left the league'), 'Sofia' + NB + 'F. and Ana' + NB + 'P. left the league');
  const hy = { code: 'roster_reconfirm_required', departed: [{ name: 'Anne-Marie L.' }] };
  assertEquals(keepDepartedNames(hy, 'Anne-Marie L. left the league'), 'Anne-' + WJ + 'Marie' + NB + 'L. left the league');
  // Over keepName's 20 characters a name stays breakable: wrapping between its words beats running off the screen.
  const long = { code: 'roster_reconfirm_required', departed: [{ name: 'Maximilian Alexander Q.' }] };
  assertEquals(keepDepartedNames(long, 'Maximilian Alexander Q. left the league'), 'Maximilian Alexander Q. left the league');
  assertEquals(keepDepartedNames(SOFIA_B, 'The draft can’t start yet'), 'The draft can’t start yet');
  assertEquals(keepDepartedNames({ code: 'roster_reconfirm_required' }, 'Sofia F. left'), 'Sofia F. left');
  assertEquals(keepDepartedNames({ code: 'roster_reconfirm_required', departed: [{ name: '' }] }, 'x left'), 'x left');
});

Deno.test("the card applies it to the roster blocker's title in both states, and only there", () => {
  const body = CARD.slice(CARD.indexOf('const subCardTitle = (b: Blocker) =>'), CARD.indexOf('const blocked'));
  assert(body.includes("if (b.code !== 'roster_reconfirm_required') return blockerTitle(b);"), 'other blockers keep their plain title');
  assertEquals(body.split('keepDepartedNames(').length - 1, 1, 'one gate for both states');
  assert(!CARD.includes('{blockerTitle(b)}'));
});

// ── the blockers card's text order at AX5 (DL gate on #356) ──
// "Sofia F. left the league" drew in 40pt under a 27pt "The draft can't start yet": the sub-card's callout title was uncapped, and
// its lines and refusal likewise. Order at every size: outer title >= sub-card title >= lines; the refusal caps at 1.6x.

import { SUB_CARD_LINE_MAX_SCALE } from '../lib/game/autoStart.ts';
import { subLineCap } from '../components/sp/logic/cappedType.ts';
import { type } from '../constants/tokens/type.ts';

const STEPPER = SOURCES['components/game/Stepper.tsx'];
const SIZES = [0.8, 1, 1.1, 1.2, 23 / 17, 1.6, 2, 2.27, 2.5, 3, 53 / 17, 3.5];

/** The effective size of a variant under an explicit cap (or its own), at a system scale: what iOS draws. */
const drawn = (variant: keyof typeof type, cap: number | undefined, scale: number) =>
  type[variant].fontSize * (cap === undefined ? scale : Math.min(scale, cap));

/** The Text element opening tag in CARD that contains `needle`. */
const tagOf = (needle: string) => {
  const at = CARD.indexOf(needle);
  assert(at !== -1, needle);
  const start = CARD.lastIndexOf('<Text', at);
  return CARD.slice(start, CARD.indexOf('>', at) + 1);
};

Deno.test('the cap is 1.6, the title\'s own ceiling', () => {
  assertEquals(SUB_CARD_LINE_MAX_SCALE, 1.6);
  assertEquals(SUB_CARD_LINE_MAX_SCALE, type.headline.maxScale);
});

Deno.test('the sub-card title is a callout under the card title: it takes the LOWER of the two caps (subOf headline)', () => {
  const sub = tagOf('{subCardTitle(b)}');
  assert(sub.includes('variant="callout"') && sub.includes('subOf="headline"'), sub);
  const outer = tagOf('{keepTime(copy.title)}');
  assert(outer.includes('variant="headline"'), outer);
  // The Text primitive's own rule: no cap of its own, so it takes the title's.
  assertEquals(subLineCap(type.callout.maxScale, type.headline.maxScale), 1.6);
});

Deno.test('the lines, the stepper label and the refusal carry the 1.6 cap; no sub-line is left "subOf callout" (uncapped)', () => {
  // The below-four line is the one line left under a sub-card title ("Up to N, one per team." and "Share the code…" are cut, rule 12 row 8).
  for (const needle of ['{view.line}']) {
    const t = tagOf(needle);
    assert(t.includes('variant="caption"') && t.includes('maxFontSizeMultiplier={SUB_CARD_LINE_MAX_SCALE}'), t);
  }
  assert(!CARD.includes('playoffFixLine'));
  const refusal = tagOf('accessibilityLiveRegion="polite"');
  assert(refusal.includes('maxFontSizeMultiplier={SUB_CARD_LINE_MAX_SCALE}') && refusal.includes('color={colors.danger}'), refusal);
  assert(CARD.includes('labelMaxScale={SUB_CARD_LINE_MAX_SCALE}'));
  assert(!CARD.includes('subOf="callout"'));
});

Deno.test('the order holds at every size, AX5 included: outer title >= sub-card title >= lines; the refusal never outranks the title', () => {
  const titleCap = subLineCap(type.callout.maxScale, type.headline.maxScale);
  for (const s of SIZES) {
    const outer = drawn('headline', type.headline.maxScale, s);
    const subTitle = drawn('callout', titleCap, s);
    const line = drawn('caption', SUB_CARD_LINE_MAX_SCALE, s);
    const refusal = drawn('callout', SUB_CARD_LINE_MAX_SCALE, s);
    const label = drawn('callout', SUB_CARD_LINE_MAX_SCALE, s);
    assert(outer >= subTitle - 1e-9, `${s}x: outer ${outer} < sub-card title ${subTitle}`);
    assert(subTitle >= line - 1e-9, `${s}x: sub-card title ${subTitle} < line ${line}`);
    assert(subTitle >= refusal - 1e-9 && subTitle >= label - 1e-9, `${s}x: refusal/label outrank the title`);
  }
  // AX5 (53/17): the numbers the README quotes.
  const ax5 = 53 / 17;
  assertEquals(drawn('headline', 1.6, ax5).toFixed(1), '27.2');
  assertEquals(drawn('callout', 1.6, ax5).toFixed(1), '20.8');
  assertEquals(drawn('caption', 1.6, ax5).toFixed(1), '19.2');
});

Deno.test('the cap is what stops the inversion: uncapped, the sub-card title is bigger than the card title at AX5', () => {
  const ax5 = 53 / 17;
  assert(drawn('callout', undefined, ax5) > drawn('headline', 1.6, ax5), 'the old, uncapped sub-card title outgrew the card title');
});

Deno.test('the stepper label takes the cap only when asked: other callers scale as before', () => {
  assert(STEPPER.includes('labelMaxScale?: number;'));
  assert(STEPPER.includes('<Text variant="callout" maxFontSizeMultiplier={labelMaxScale} style={styles.label}>'));
  for (const f of ['app/create-league.tsx', 'components/game/RenewalChangeSheet.tsx', 'app/league-settings.tsx']) {
    if (SOURCES[f]?.includes('<Stepper')) assert(!SOURCES[f].includes('labelMaxScale'), `${f} is unchanged`);
  }
});

// ── Giorgio's rule B: below four managers, ONE sub-card (PRODUCT_RULES "When managers leave before the draft, below four") ──
// Phone pass step 23 (League A, 2 of 4): "Move forward with 2" could only be refused. Below four there is no Move forward and no
// Invite someone new: the reconfirm and not_enough_members blockers are drawn as one card (who left, "Fewer than 4 teams have
// joined.", the code and Share). The server is untouched: both codes stay. At four or more, nothing changes.

import { MIN_DRAFT_MEMBERS, belowMinLine, blockerClause, blockerTitle, mergeBelowMin } from '../lib/game/autoStart.ts';

type B = { code: string; [k: string]: unknown };
const GONE = (members: number, choice?: string, extra: Record<string, unknown> = {}): B => ({
  code: 'roster_reconfirm_required', departed: [{ name: 'Gianluigi B.' }, { name: 'Paolo M.' }], membersBefore: 4, members, ...(choice ? { choice } : {}), ...extra,
});
const SHORT = (have: number, need = 4): B => ({ code: 'not_enough_members', have, need });
const PLAYOFF: B = { code: 'playoff_teams_exceeds_members', playoffTeams: 8, members: 7 };

Deno.test('the client\'s minimum is the server\'s (draft-control rules.ts MIN_DRAFT_MEMBERS)', async () => {
  assertEquals(MIN_DRAFT_MEMBERS, 4);
  const rules = await Deno.readTextFile(new URL('../../../supabase/functions/draft-control/rules.ts', import.meta.url));
  assert(/MIN_DRAFT_MEMBERS\s*=\s*4\b/.test(rules), 'the server still says four');
});

Deno.test('the line is the existing clause as a sentence: "Fewer than 4 teams have joined."', () => {
  assertEquals(belowMinLine(), 'Fewer than 4 teams have joined.');
  assertEquals(belowMinLine(4), 'Fewer than 4 teams have joined.');
  assertEquals(belowMinLine(5), 'Fewer than 5 teams have joined.');
  assertEquals(blockerClause({ code: 'not_enough_members', need: 4 }), 'fewer than 4 teams have joined', 'the source of the sentence');
});

Deno.test('below four the two blockers are ONE: the leaver card absorbs not_enough_members, the rest of the list is kept in order', () => {
  const list = [GONE(2, 'pending'), SHORT(2), { code: 'draft_date_not_reached' }];
  const merged = mergeBelowMin(list, 2);
  assertEquals(merged.map((b) => b.code), ['roster_reconfirm_required', 'draft_date_not_reached']);
  assertEquals(merged[0].absorbs, ['not_enough_members']);
  assertEquals(merged[0].need, 4);
  assertEquals(merged[0].departed, list[0].departed);
  assertEquals(blockerTitle(merged[0]), 'Gianluigi B. and Paolo M. left the league');
  // The server's list is not mutated: the card combines, the data does not change.
  assertEquals(list.map((b) => b.code), ['roster_reconfirm_required', 'not_enough_members', 'draft_date_not_reached']);
  assertEquals(list[0].absorbs, undefined);
});

Deno.test('from four up, and with no reconfirm, the list is returned as it came (nothing changes)', () => {
  for (const members of [4, 5, 7]) {
    const list = [GONE(members, 'pending'), PLAYOFF];
    assert(mergeBelowMin(list, members) === list, `${members} keeps the same list`);
  }
  const justShort = [SHORT(3)];
  assert(mergeBelowMin(justShort, 3) === justShort, 'a league that never had a reconfirm keeps its not_enough_members card');
  assert(mergeBelowMin([], 2).length === 0);
});

Deno.test('the blocker\'s own member count decides (as reconfirmView does), the league\'s only when it has none', () => {
  // The blocker says 3 although the league row says 9 (a stale list): the server judged it, so merged.
  assertEquals(mergeBelowMin([GONE(3), SHORT(3)], 9).map((b) => b.code), ['roster_reconfirm_required']);
  // The blocker says 4 although the league row says 2: four is enough, nothing merges.
  const four = [GONE(4, 'pending'), SHORT(2)];
  assert(mergeBelowMin(four, 2) === four);
  // No count on the blocker: the league's.
  const noCount: B = { code: 'roster_reconfirm_required', departed: [{ name: 'A' }] };
  assertEquals(mergeBelowMin([noCount, SHORT(2)], 2).length, 1);
  assert(mergeBelowMin([noCount], 6)[0] === noCount);
});

Deno.test('a reconfirm below four without the server\'s not_enough_members is still the one card, with the default need', () => {
  const merged = mergeBelowMin([GONE(3, 'invite')], 3);
  assertEquals(merged.length, 1);
  assertEquals(merged[0].need, 4);
  assertEquals(mergeBelowMin([GONE(2), SHORT(2, 5)], 2)[0].need, 5, 'the need the server spoke of');
});

Deno.test('below four there is no choice to draw, whatever the choice: pending, invite or none', () => {
  for (const choice of ['pending', 'invite', undefined, 'mystery']) {
    const v = reconfirmView(mergeBelowMin([GONE(2, choice), SHORT(2)], 2)[0], 2);
    assertEquals(v, { mode: 'below_min', members: 2, line: 'Fewer than 4 teams have joined.' }, `${choice}`);
  }
  // The inviting state is not drawn at all below four: the merged card wins.
  assertEquals(reconfirmView(GONE(3, 'invite'), 3).mode, 'below_min');
  assertEquals(reconfirmView(GONE(1, 'pending'), 8).mode, 'below_min', 'the blocker\'s count, not the league\'s');
});

Deno.test('at four or more the two modes are as they were', () => {
  assertEquals(reconfirmView(GONE(4, 'pending'), 4).mode, 'choose');
  assertEquals(reconfirmView(GONE(7, 'pending'), 7), { mode: 'choose', members: 7 });
  assertEquals(reconfirmView(GONE(5, 'invite'), 5).mode, 'inviting');
  assertEquals(reconfirmView({ code: 'roster_reconfirm_required' }, 4).mode, 'choose');
});

Deno.test('a refusal owned by either code lands in the merged sub-card', () => {
  const merged = mergeBelowMin([GONE(2), SHORT(2)], 2);
  assertEquals(errorPlacement('x', 'roster_reconfirm_required', merged), { subCard: 0, foot: false });
  assertEquals(errorPlacement('x', 'not_enough_members', merged), { subCard: 0, foot: false });
  // Unmerged (four or more), not_enough_members has no card: the fallback is the foot, as before.
  assertEquals(errorPlacement('x', 'not_enough_members', [GONE(5)]), { subCard: -1, foot: true });
  // Another card's code never matches the merged one.
  assertEquals(errorPlacement('x', 'playoff_teams_exceeds_members', merged), { subCard: -1, foot: true });
});

Deno.test('the merged title keeps both names whole (no-break inside each)', () => {
  const merged = mergeBelowMin([GONE(2), SHORT(2)], 2)[0];
  const t = keepDepartedNames(merged, blockerTitle(merged));
  assertEquals(t, 'Gianluigi' + NB + 'B. and Paolo' + NB + 'M. left the league');
});

Deno.test('the card draws the merged list and, below four, only the line and the invite row: no button of any kind', () => {
  assert(CARD.includes('const cards = mergeBelowMin(blockers, memberCount);'));
  assert(CARD.includes('{cards.map((b, i) => ('));
  const branch = CARD.slice(CARD.indexOf("if (view.mode === 'below_min') {"), CARD.indexOf("if (view.mode === 'inviting') {"));
  assert(branch.length > 60, 'the below_min branch exists, before the inviting one');
  assert(branch.includes('{view.line}') && branch.includes('{inviteRow()}'));
  assert(branch.indexOf('{view.line}') < branch.indexOf('{inviteRow()}'), 'the line, then the code');
  assert(branch.includes('maxFontSizeMultiplier={SUB_CARD_LINE_MAX_SCALE}'), 'the line is capped like every sub-card line');
  for (const control of ['Button', 'TextAction', 'choose(', 'onReconfirm', 'moveForward', 'INVITE_SOMEONE_NEW']) {
    assert(!branch.includes(control), 'no ' + control + ' below four');
  }
  // The gates still guard both buttons for four or more.
  assertEquals(CARD.split('showMoveForward(view.members)').length - 1, 2);
});

Deno.test('the Pick-a-new-time gate still counts the server\'s blockers, not the merged cards (still blocked until four are in)', () => {
  assert(CARD.includes('const blocked = blockers.length > 0;'));
});

// ── the dev seam's 2-of-4 league ──

Deno.test('<state>:below4 is a league of two (two of four left): the server\'s two blockers, no playoff blocker, member_count 2', () => {
  assertEquals(parseDraftStartFixture('postponed:below4'), { state: 'postponed', member: false, invite: false, below4: true });
  assertEquals(parseDraftStartFixture('at_risk:below4:invite'), { state: 'at_risk', member: false, invite: true, below4: true });
  assertEquals(parseDraftStartFixture('at_risk:invite:member:below4'), { state: 'at_risk', member: true, invite: true, below4: true });
  for (const state of ['at_risk', 'postponed'] as const) {
    const s = draftStartStatusFixture(state, false, NOW, false, true) as { member_count: number; blockers: B[] };
    assertEquals(s.member_count, 2, state);
    const fixable = fixableBlockers(s.blockers);
    assertEquals(fixable.map((b) => b.code), ['roster_reconfirm_required', 'not_enough_members'], state);
    assertEquals(fixable[0].members, 2);
    assertEquals(fixable[0].choice, 'pending');
    assertEquals(mergeBelowMin(fixable, 2).length, 1, state);
    // The choice the flag combines with.
    const inv = draftStartStatusFixture(state, false, NOW, true, true) as { blockers: B[] };
    assertEquals(fixableBlockers(inv.blockers)[0].choice, 'invite');
  }
});

Deno.test('without the flag the sample league is unchanged: seven in, the reconfirm and the playoff blocker, nothing merges', () => {
  for (const state of ['at_risk', 'postponed'] as const) {
    const s = draftStartStatusFixture(state, false, NOW) as { member_count: number; blockers: B[] };
    assertEquals(s.member_count, 7);
    const fixable = fixableBlockers(s.blockers);
    assertEquals(fixable.map((b) => b.code), ['roster_reconfirm_required', 'playoff_teams_exceeds_members']);
    assert(mergeBelowMin(fixable, 7) === fixable);
  }
});

Deno.test('the seam serves it through draft-control status when the flag is in EXPO_PUBLIC_DRAFT_START_FIXTURE', () => {
  const res = invokeFixtureFor('draft-control', { action: 'status' }, 'postponed:below4', null, null) as { data: { member_count: number; blockers: B[] } };
  assertEquals(res.data.member_count, 2);
  assertEquals(fixableBlockers(res.data.blockers).length, 2);
  assert(SOURCES['lib/game/seamFixtures.ts'].includes('picked.invite, picked.below4)'));
});

// ── the note under "Pick a new draft time" is capped (DL gate on #358, AX5) ──
// "Fix these first. The new time needs at least an hour's notice." was an uncapped caption: 37pt at AX5, bigger than the card's own
// title (27.2) and the button, and in below4-AX5-dark it ran off the screen. It takes the card-line cap, so at every size:
// card title >= button label >= the note.

const BUTTON_SRC = SOURCES['components/sp/Button.tsx'];

Deno.test('rule 12 (the sweep, row 1): the note under Pick a new draft time is gone, and the button shows only once nothing blocks', () => {
  assert(!CARD.includes('PICK_NEW_TIME_NOTE') && !CARD.includes('PICK_NEW_TIME_READY'));
  assert(CARD.includes("{phase === 'postponed' && !blocked ? ("), 'the button is shown only when nothing is left to fix');
  assert(CARD.includes('<Button label={PICK_NEW_TIME} onPress={onPickNewTime} disabled={busy} />'));
});

Deno.test('the order holds at every size, AX5 included: card title >= button label >= the note', () => {
  // The button label's cap is the headline's (Button.tsx), the same as the card title's.
  assert(BUTTON_SRC.includes('export const BUTTON_LABEL_MAX_SCALE = type.headline.maxScale ?? 1.6;'));
  for (const s of SIZES) {
    const cardTitle = drawn('headline', type.headline.maxScale, s);
    const buttonLabel = drawn('headline', type.headline.maxScale, s); // md button: variant headline, BUTTON_LABEL_MAX_SCALE
    const note = drawn('caption', SUB_CARD_LINE_MAX_SCALE, s);
    assert(cardTitle >= buttonLabel - 1e-9, s + 'x: card title < button label');
    assert(buttonLabel >= note - 1e-9, s + 'x: button label ' + buttonLabel + ' < note ' + note);
  }
  assertEquals(drawn('caption', SUB_CARD_LINE_MAX_SCALE, 53 / 17).toFixed(1), '19.2', 'the AX5 size the README quotes');
});

Deno.test('uncapped, the note outgrows both at AX5 (the bug this fixes)', () => {
  const ax5 = 53 / 17;
  const uncapped = drawn('caption', undefined, ax5);
  assertEquals(uncapped.toFixed(1), '37.4');
  assert(uncapped > drawn('headline', type.headline.maxScale, ax5), 'bigger than the card title');
});
