/**
 * The UX rule 12 sweep, phase 3 (the Design Lead's sweep of main @ fd636045): pure removals.
 * Every line it cuts is gone from the mobile source; what stays beside it is still there, word
 * for word. Source-level (the screens are React Native); turnState is pinned in
 * game-draft-refusals.test.ts and the auto-pick constant in game-draft-room.test.ts.
 *
 *   deno test --no-config --sloppy-imports apps/mobile/tests-deno/rule12-sweep-phase3.test.ts
 */
import { assert, assertFalse } from 'jsr:@std/assert';
import { SOURCES } from './sourceManifest.generated.ts';

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
// Everything the app ships (not tests, not the dev gallery), comments removed: a comment may say why a line went.
const app = Object.entries(SOURCES)
  .filter(([p]) => (p.startsWith('app/') || p.startsWith('components/') || p.startsWith('lib/') || p.startsWith('constants/')) && !p.includes('design-gallery'))
  .map(([, s]) => strip(s))
  .join('\n');

Deno.test('every line the phase-3 sweep cuts is gone from the mobile source', () => {
  const cut: [string, string][] = [
    ['1', 'The clock is stopped and nobody is skipped'],
    ['1', 'The commissioner has been told'], // also PRODUCT_RULES "Nobody is notified"
    ['1', 'The draft continues once the slot can be filled'],
    ['2', 'Nobody is skipped'],
    ['3', 'Still starting. This can take a minute.'],
    ['3', 'START_RETRYING'],
    ['4', 'Create or join a league to get started'],
    ['6', 'It opens the app to set a new password'],
    ['7', 'The draft is set once everyone has replied'],
    ['7', 'MEMBER_DRAFT_LINE'],
  ];
  for (const [row, text] of cut) assertFalse(app.includes(text), `${row}: "${text}" is still in the source`);
});

Deno.test('1: the stalled card keeps its tag, its headline and the round line; no caption is left behind', () => {
  const room = strip(SOURCES['components/game/DraftRoom.tsx']);
  const card = room.slice(room.indexOf('<Card style={[styles.card, onTheClock ?'), room.indexOf('<DraftBoard'));
  assert(card.includes('{stalled?.tag ? <Text variant="tag" color={colors.liveText}>{stalled.tag}</Text> : null}'));
  assert(room.includes("const headline = stalled ? (stalled.label ?? '')"));
  assert(card.includes('{keepDots(turn.tag)}'), 'the round line is the small label above the headline now (board #call-draft-turn, B)');
  assertFalse(card.includes('stalled?.line'));
  assertFalse(card.includes('stalled.line'));
  // The commissioner check existed only for that line: neither the room nor the League tab carries it now.
  assertFalse(room.includes('isCommissioner'));
  const refusals = strip(SOURCES['lib/game/draftRefusals.ts']);
  assertFalse(refusals.includes('line'), 'TurnState has no line field');
  assert(refusals.includes("tag: 'Draft paused',"));
  assert(refusals.includes("label: who ? `No stock left fits ${who}'s next slot` : 'No stock left fits the next open slot',"));
});

Deno.test('2: waiting for prices is one sentence, in the same place', () => {
  assert(strip(SOURCES['lib/game/draftRoom.ts']).includes("export const AUTO_PICK_WAITING_FOR_PRICES = 'Auto-pick is waiting for prices.';"));
  assert(strip(SOURCES['components/game/DraftRoom.tsx']).includes('{AUTO_PICK_WAITING_FOR_PRICES}</Text> : null}'));
});

Deno.test('3: at 0:00 the countdown card keeps "Starting the draft" and its notes are the copy\'s own lines only', () => {
  const league = strip(SOURCES['app/(tabs)/league.tsx']);
  assert(league.includes('notes={c.lines.slice(1)}'));
  assert(league.includes('starting={c.starting}'));
  assert(strip(SOURCES['lib/game/autoStart.ts']).includes("'Starting the draft'"));
});

Deno.test('4: the no-league state is the heading and the two buttons; EmptyState draws no Text without a message', () => {
  const shared = strip(SOURCES['components/shell/NoLeagueState.tsx']);
  const noLeague = shared.slice(shared.indexOf('export function NoLeagueState'), shared.indexOf('export function LeaguesFailedState'));
  assert(shared.includes("heading: 'No leagues yet',"));
  assert(shared.includes("create: 'Create a league',"));
  assert(shared.includes("join: 'Join with a code',"));
  assertFalse(noLeague.includes('message'));
  const empty = strip(SOURCES['components/sp/EmptyState.tsx']);
  assert(empty.includes('message?: string;'));
  assert(empty.includes('{message ? ('));
  // The failed read keeps its message (it says what to do: Try again).
  assert(shared.includes('message={MONEY_COPY.loadRetryMessage}'));
});

Deno.test('5: "Set a new password" has no sentence under it; the field\'s live checklist and the error copy keep the rule', () => {
  const form = strip(SOURCES['components/shell/NewPasswordForm.tsx']);
  assertFalse(form.includes('PASSWORD_RULE_SENTENCE'));
  assert(form.includes('<ScreenTitle>Set a new password</ScreenTitle>'));
  assert(form.includes('PASSWORD_REQUIREMENTS'), 'the live rules checklist stays');
  // The sentence is still the weak-password error's words on every auth screen.
  for (const f of ['app/change-password.tsx', 'app/login.tsx', 'app/reset-password.tsx', 'app/create-account.tsx']) {
    assert(strip(SOURCES[f]).includes('PASSWORD_RULE_SENTENCE'), f);
  }
  assert(strip(SOURCES['constants/passwordRules.ts']).includes('export const PASSWORD_RULE_SENTENCE'));
});

Deno.test('6: the reset-link screen says where the link went, and nothing else', () => {
  const forgot = strip(SOURCES['app/forgot-password.tsx']);
  assert(forgot.includes('message={`We sent a reset link to ${email}.`}'));
  assert(forgot.includes('title="Check your email"'));
});
