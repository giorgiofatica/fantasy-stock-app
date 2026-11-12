/**
 * The rest of the UX rule 12 sweep (Phase 2; the Design Lead's board, docs/design/screens/rule12-sweep.jsx, rows 1-13 and "Swept the
 * same way"): every line the board CUTs is gone from the mobile source, and every line it KEEPs is still there, word for word.
 * Source-level (the screens are React Native); the rules that are pure functions are pinned in their own test files.
 *
 *   deno test --no-config --sloppy-imports apps/mobile/tests-deno/rule12-sweep-phase2.test.ts
 */
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';
import { SOURCES } from './sourceManifest.generated.ts';

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
// Everything the app ships (not tests, not the dev gallery), comments removed: a comment may say why a line went.
const app = Object.entries(SOURCES)
  .filter(([p]) => (p.startsWith('app/') || p.startsWith('components/') || p.startsWith('lib/')) && !p.includes('design-gallery'))
  .map(([, s]) => strip(s))
  .join('\n');

Deno.test('every line the sweep CUTs is gone from the mobile source (rows 1-13, Appearance, "No leader yet.")', () => {
  const cut: [string, string][] = [
    ['1', 'The league wasn’t ready'], // curly, as it was written
    ['1', "The league wasn't ready"],
    ['1', 'Fix these first'],
    ['2', "If you step away, we'll auto-pick"],
    ['5', '-second picks'],
    ['5', 'when the order is set'],
    ['5', 'No buying before the draft'],
    ['6', 'Pick a time, and the countdown starts here'],
    ["6", "You'll see it here, with at least an hour's notice"],
    ['6', 'Set 1 hour before the draft, once'],
    ['7', 'Draft order set'],
    ['8', 'Share the code. When someone joins'],
    ['8', ', one per team.'],
    ['9', 'the earliest you can pick'],
    ['9', 'The draft room opens 1 hour before'],
    ['10', 'Time each manager has to make a pick'],
    ['10', 'seconds per pick. The draft has started, so this is set'],
    ['10', 'Optional: a slot can require'],
    ['10', 'Required: each slot sets'],
    ['10', 'when the draft order is set'],
    ['10', 'Who takes over as commissioner?'],
    ['11', 'Same league, new season'],
    ['11', 'You can change your answer until the draft is set'],
    ['11', 'Everyone from Season 1 gets asked'],
    ['11', 'Start Season 2 with the same group'],
    ['11', "You'll set up the draft once everyone has replied"],
    ['11', 'Everything carries over from Season 1'],
    ['11', "Follows who's in, up to 16"],
    ['11', "Everyone who's in gets a notification"],
    ['12', 'Enter the invite code your commissioner sent you'],
    ['12', 'You can leave any time before the draft'],
    ['12', 'The draft order is set an hour before'],
    ['12', "You'll see it on your Home once they do"],
    ['13', 'Start a league for your friends'],
    ['13', 'Pick the rules, invite friends'],
    ['13', 'Got a code from a friend'],
    ['13', 'Sign in to your league'],
    ['13', 'Join the competition'],
    ['13', 'send you a link to reset your password'],
    ['13', 'Shown to your league on standings'],
    ['13', 'You can change it later in Profile'],
    ['Appearance', "System follows your phone"],
    ['Home this week', 'No leader yet'],
  ];
  for (const [row, text] of cut) assertFalse(app.includes(text), `row ${row}: "${text}" is still in the source`);
});

Deno.test('acceptance 4: the at-risk card keeps "Fix these before …" and its eyebrow, wording unchanged (a separate build, plan #355, adds the day)', () => {
  const auto = strip(SOURCES['lib/game/autoStart.ts']);
  assert(auto.includes('tag: `Needs you before ${at}`,'));
  assert(auto.includes("title: 'The draft can’t start yet',"));
  assert(auto.includes('line: `Fix these before ${at}, when the draft room opens. If they’re still open then, the draft is postponed.`,'));
  const card = strip(SOURCES['components/game/DraftBlockersCard.tsx']);
  assert(card.includes('{copy.line ? <Text variant="caption" subOf="headline">{keepTime(copy.line)}</Text> : null}'), 'the line still renders');
  assert(card.includes('{copy.tag ? <Text variant="tag" color={colors.warnText}>{keepTime(copy.tag)}</Text> : null}'), 'and so does the eyebrow');
});

Deno.test('row 1: the postponed card is the title and, once nothing blocks, the button; row 8: the other two cuts apply', () => {
  const card = strip(SOURCES['components/game/DraftBlockersCard.tsx']);
  assert(card.includes("{phase === 'postponed' && !blocked ? ("));
  assertFalse(card.includes('disabled={blocked || busy}'), 'no button that cannot act');
  assertFalse(card.includes('playoffFixLine') || card.includes('{view.line}</Text>\n            {inviteRow()}\n            {showMoveForward'), 'the inviting state has no line');
});

Deno.test('the KEEPs stay: names, counts, blockers, times, the future-time reason', () => {
  const auto = strip(SOURCES['lib/game/autoStart.ts']);
  assert(auto.includes("export const PICK_NEW_TIME = 'Pick a new draft time';"));
  assert(auto.includes('`Invite someone to take ${name}\'s place`'), 'Invite someone to take {name}\'s place (approved 2026-11-10)');
  assert(auto.includes("export const DATE_LOCKED_AFTER_ROOM = 'The draft time can’t change once the draft room opens.';"), 'the reason beside a row that cannot act');
  assert(strip(SOURCES['lib/game/leaveLeague.ts']).includes("'You can hand over the commissioner role before the draft or after the season.'"));
  assert(strip(SOURCES['lib/game/renewalReview.ts']).includes("export const SCHEDULE_NEEDS_TIME = 'Pick a future draft time.';"));
  assert(strip(SOURCES['lib/game/createLeagueDone.ts']).includes("export const CREATED_NO_DATE = 'Set a draft time before the draft can start.';"));
  assert(strip(SOURCES['lib/home/homeCopy.ts']).includes('export const PRE_SEASON_CAPTION = PRE_SEASON_SCORING_STARTS;'), "the time stays: \"Scoring starts at Monday's open.\"");
  assert(strip(SOURCES['lib/home/homeCopy.ts']).includes('"Scoring starts at Monday\'s open."'));
});

Deno.test('acceptance 5: "Out of time? We pick from the top of this list." is not built; the first-time tip already says the auto-pick', () => {
  assertFalse(app.includes('We pick from the top of this list'));
  assert(SOURCES['lib/shell/firstTimeTipPolicy.ts'].includes("Out of time? We pick for you: your queue first, then the best stock that fits your league's rules."));
});

Deno.test('the queue keeps "Save queue" until a decision is made about autosave (the board says it autosaves; the code does not)', () => {
  const q = strip(SOURCES['components/game/QueueEditor.tsx']);
  assert(q.includes('label="Save queue"'), 'not removed: there is no autosave, so the button is the only write');
  assert(q.includes("seamRpc('set_draft_queue'"));
});

Deno.test('row 6: the home draft card is the tag, the countdown and the date, with no chip', () => {
  const card = strip(SOURCES['components/home/PreDraftCard.tsx']);
  assertFalse(/Postponed\s*<\/Text>/.test(card));
  assertFalse(card.includes('pickClock') || card.includes('orderSet') || card.includes('noBuying') || card.includes('postponedLine'));
});

Deno.test('rows 9-11: the pickers and sheets lose only their explanations', () => {
  assertFalse(strip(SOURCES['components/game/DraftDateSheet.tsx']).includes('PICKER_HELPER'));
  const review = strip(SOURCES['components/game/RenewalReview.tsx']);
  assert(review.includes('<Row label="Teams" value={teams.value} />'), 'Teams: the count, no line');
  assert(review.includes('{scheduleReason({ draftDate, now }) ?'), 'the future-time reason stays');
});

Deno.test('row 10: League settings gives the Stakes options and the non-draftable switch their "i", and cuts the lines under them', () => {
  const s = strip(SOURCES['app/league-settings.tsx']);
  assert(s.includes('infoForStakeMode(opt.value)'), 'every stake mode asks which i it gets');
  assert(s.includes('<InfoButton info={CONTROL_INFO.nonDraftable} onOpen={openInfo} />'), 'the switch');
  assertEquals((s.match(/<InfoButton /g) ?? []).length, 2, 'two sites: the three stake rows (one site) and the switch');
  assertFalse(/help=\{/.test(s), 'no definition line under an option');
  assertFalse(/sub="Off \(default\)/.test(s));
  assert(s.includes('{infoPopup}'), 'the popup is rendered once');
  // Declared before any early return (a hook).
  assert(s.indexOf('useInfoPopup()') > 0 && s.indexOf('useInfoPopup()') < s.indexOf('const clockLocked'), 'the hook comes before the early returns (clockLocked is the first line after them)');
  // Read-only summaries (League info) get none: they are not a choice.
  assert(s.includes('<SettingRow label="Playoff teams" value={String(league.playoff_teams)} />'));
});

Deno.test('row 7: the order lines have no producer left anywhere (Home\'s "The draft room opens …", the lobby\'s "Draft order set …")', () => {
  for (const f of ['lib/game/draftLobby.ts', 'lib/home/draftCountdown.ts', 'components/game/DraftLobby.tsx', 'components/home/PreDraftCard.tsx']) {
    const s = strip(SOURCES[f]);
    assertFalse(s.includes('orderSetLine') || s.includes('orderWasSetLine'), `${f} still produces an order line`);
  }
});

// ── rows 14-15 and the DL's rulings on the unlisted lines ────────────────────────────────────────────────

Deno.test('rows 14-15 and the unlisted (a)(b)(c): every line the DL ruled CUT is gone from the mobile source', () => {
  const cut: [string, string][] = [
    ['14', 'Includes your draft picks'],
    ['14', 'A stock has one owner per league'],
    ['15', 'Ranked by win percentage, then head-to-head'],
    ['15', 'in the standings make the playoffs. A tied game goes to the higher seed'],
    ['15', 'The playoffs decide the top three'],
    ['a', "You'll see it here and on your Home"],
    ['b', 'You can set the draft once everyone has replied'],
    ['c', 'The draft starts automatically at'],
  ];
  for (const [row, text] of cut) assertFalse(app.includes(text), `${row}: "${text}" is still in the source`);
});

Deno.test('rows 14-15 and the unlisted lines: what the DL ruled KEEP stays, word for word', () => {
  const money = strip(SOURCES['lib/money/moneyCopy.ts']);
  assert(money.includes('budgetLeftToSpend: (amount: string) => `${amount} of your budget is left to spend.`,'), '$… of your budget is left to spend.');
  assert(money.includes('alreadyOwned: (owner: string, symbol: string) => `${owner} already owns ${symbol}.`,'), 'the first sentence of the refusal');
  assert(money.includes('ownerBlocksBuy: (name: string, symbol: string) => `${name} owns ${symbol}.`,'));
  assert(strip(SOURCES['components/game/ScheduleList.tsx']).includes('Then the playoffs: {playoffLine}.'), 'the Schedule\'s "Then the playoffs: …"');
  assert(strip(SOURCES['lib/game/autoStart.ts']).includes("isCommissioner ? 'Set a draft time in League settings.'"), '(d) "Set a draft time in League settings."');
  assert(strip(SOURCES['lib/game/autoStart.ts']).includes('line: `The draft starts at ${etTimeLabel(t)}.`,'), '(e) the at-risk "Draft room opens in" card\'s line');
  // History keeps its own "After the playoffs" line (GS-8b, a different place); Standings' header does not show it.
  assert(strip(SOURCES['components/game/HistoryList.tsx']).includes('GAME_COPY.finalStandingsSubtitle'));
  assert(strip(SOURCES['app/(tabs)/league.tsx']).includes('header={{ title: GAME_COPY.finalStandingsTitle }}'));
});

Deno.test('(b) the member list\'s MEMBER_DRAFT_LINE is LEFT: it can show while the Change control does not (the commissioner\'s name unknown)', () => {
  const rn = strip(SOURCES['lib/game/renewal.ts']);
  assert(rn.includes('change: memberIn && !set && rosterCommissionerName(r.people) !== null,'), 'Change needs the commissioner\'s name');
  assert(rn.includes('memberLine: memberIn && !set,'), 'the line does not');
  assert(strip(SOURCES['components/game/RenewalRoster.tsx']).includes('{view.memberLine ? <Text variant="caption" tone="secondary">{MEMBER_DRAFT_LINE}</Text> : null}'));
  // The commissioner's caption is the names alone.
  assert(strip(SOURCES['components/game/RenewalRoster.tsx']).includes('<Text variant="caption" tone="secondary">{waitingOnSentence(waiting)}</Text>'));
});

Deno.test('(a)(c) lobby and room-open cards: the postponed copy is one function with no line, and the room-open card shows the time as a value', () => {
  const auto = strip(SOURCES['lib/game/autoStart.ts']);
  assert(auto.includes('export function memberPostponedCopy(commissionerName: string): { tag: string; title: string } {'));
  assert(auto.includes("lines: [when] };"));
  assertFalse(strip(SOURCES['app/(tabs)/league.tsx']).includes("memberPostponedCopy(commissionerName, 'lobby')"));
});

Deno.test('DL P2 (lobby order row at AX5): the name stops at 1.3x and is kept whole by keepName, never a bare no-break space', () => {
  const row = strip(SOURCES['components/sp/gn/ManagerRow.tsx']);
  assert(row.includes('export const ORDER_NAME_CAP = 1.3;'));
  assert(row.includes('maxFontSizeMultiplier={ORDER_NAME_CAP}'));
  assert(row.includes('{keepName(name)}</Text>'), 'the name goes through keepName');
  assertFalse(/replace\(\/ \/g, ['"`]\\u00a0/.test(row), 'no hand-rolled NBSP replace in the row');
  // The lobby draws its order through this row (not a hand copy), so the fix lives in one place.
  assert(strip(SOURCES['components/game/DraftLobby.tsx']).includes('<ManagerRow key={id} kind="order"'));
});
