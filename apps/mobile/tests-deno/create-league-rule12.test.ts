/**
 * Create league under UX rules 12 and 13 (the sweep, Giorgio 2026-11-10/11): the lines that explain a heading are gone, and every
 * option we defined carries an "i" at the end of its row instead. Source-level, because the screen is React Native; the pure
 * rules (which options, the approved words) are pinned in info-popups.test.ts.
 *
 *   deno test --no-config --sloppy-imports apps/mobile/tests-deno/create-league-rule12.test.ts
 */
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';
import { SOURCES } from './sourceManifest.generated.ts';

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const screen = strip(SOURCES['app/create-league.tsx']);
const rows = strip(SOURCES['components/game/SetupRows.tsx']);
const stepper = strip(SOURCES['components/game/Stepper.tsx']);
const popup = strip(SOURCES['components/game/InfoPopup.tsx']);
const everything = Object.values(SOURCES).map(strip).join('\n');

Deno.test('acceptance 1: "Don\'t worry. You will be able to change this later." is cut, and nothing replaces it', () => {
  assertFalse(/Don't worry|change this later/i.test(screen), 'the line is not in the screen');
  const field = screen.match(/<Field\s+label="League name"[\s\S]*?\/>/);
  assert(field, 'the League name field is where it was');
  assertFalse(/helper=/.test(field[0]), 'no helper on the League name field');
  // Cut everywhere in the app's mobile code, not only moved.
  assertFalse(/Don't worry\. You will be able to change this later/.test(everything));
});

Deno.test('acceptance 2: the League type card has ONE option, Matchup, and it still gets its "i"', () => {
  const m = screen.match(/const TYPE_OPTIONS[^=]*=\s*\[([\s\S]*?)\];/);
  assert(m, 'TYPE_OPTIONS is where it was');
  assertEquals([...m[1].matchAll(/value:\s*'([a-z_]+)'/g)].map((x) => x[1]), ['matchup']);
  assertFalse(/help:/.test(m[1]), 'no definition line under the name: it is behind the i');
  assert(/infoForLeagueType\(t\.value\)/.test(screen), 'each type option asks which i it gets');
  assert(/<ChoiceRow[\s\S]*?info=\{info \? <InfoButton info=\{info\} onOpen=\{openInfo\} edge \/> : undefined\}/.test(screen), 'and passes it to its row');
});

Deno.test('acceptance 3: there is no Duration "i" and no Duration row while it is hidden', () => {
  assertFalse(/duration/i.test(screen.replace(/duration_days:\s*30,/, '')), 'nothing about Duration on the screen');
  assertFalse(/'duration'|"duration"/.test(strip(SOURCES['lib/game/infoPopups.ts'])), 'no Duration entry in the popups table');
});

Deno.test('acceptance 5: "Out of time? We pick from the top of this list." is NOT built (not approved)', () => {
  assertFalse(/We pick from the top of this list/.test(everything));
});

Deno.test('every option row on Create league has an "i", and none has a definition line under it', () => {
  const choiceRows = [...screen.matchAll(/<ChoiceRow[\s\S]*?\/>/g)].map((x) => x[0]);
  assertEquals(choiceRows.length, 2, 'League type and Stakes: the only two option cards');
  for (const r of choiceRows) {
    assert(/info=\{/.test(r), 'the row passes an i');
    assertFalse(/help=/.test(r), 'no line under the name');
  }
  assert(/infoForStakeMode\(opt\.value\)/.test(screen), 'all three stake modes ask which i they get');
});

Deno.test('the controls with one "i" each, and the ones with none', () => {
  assert(/label="Playoff teams"\s+labelInfo=\{<InfoButton info=\{CONTROL_INFO\.playoffTeams\}/.test(screen), 'Playoff teams');
  assert(/<LabelWithInfo label="Draft order" info=\{<InfoButton info=\{CONTROL_INFO\.draftOrder\}/.test(screen), 'Draft order (one i for Random and Manual)');
  assert(/label="Allow non-draftable stocks \(full universe\)"\s+info=\{<InfoButton info=\{CONTROL_INFO\.nonDraftable\}/.test(screen), 'the switch');
  assertEquals((screen.match(/<InfoButton /g) ?? []).length, 5, 'exactly five InfoButton sites: two option cards, three controls');
  // Rounds (1A: no i), Pick clock, Managers, Regular season get none.
  for (const label of ['Rounds', 'Pick clock', 'Managers', 'Regular season']) {
    const at = screen.indexOf(`label="${label}"`) >= 0 ? screen.indexOf(`label="${label}"`) : screen.indexOf(`>${label}<`);
    assert(at >= 0, `${label} is on the screen`);
    assertFalse(/InfoButton|labelInfo/.test(screen.slice(at, at + 200)), `${label} has no i`);
  }
});

Deno.test('rule 12: the lines the sweep cuts from Create league are gone from the screen', () => {
  for (const gone of [
    'pickSecondsCaption',
    'draftOrderCaption',
    'IF_TIME_RUNS_OUT_COPY',
    'If time runs out',
    'DRAFT_DATE_LATER',
    'One per roster slot',
    'Each pick simulates this dollar amount',
    'Off (default)',
    'rosterSlotsCaption',
    'help={',
  ]) {
    assertFalse(screen.includes(gone), `${gone} is still on the screen`);
  }
  // The refusal stays (in place), now directly under "Roster slots", so it caps at its title.
  assert(/subOf="headline"[^>]*>\s*\{PRICE_TIERS_NEED_A_SLOT\}/.test(screen) || /subOf="headline" accessibilityLiveRegion="polite">\s*\{PRICE_TIERS_NEED_A_SLOT\}/.test(screen));
});

Deno.test('the "i" is a SIBLING of the row\'s control, never inside it (it must not select, and VoiceOver must reach it)', () => {
  assert(/<View style=\{styles\.choiceWithInfo\}>\s*\{radio\}\s*\{info\}\s*<\/View>/.test(rows), 'ChoiceRow: radio and i side by side');
  assertFalse(/accessibilityRole="radio"[\s\S]{0,400}\{info\}/.test(rows.slice(rows.indexOf('export function ChoiceRow'), rows.indexOf('export function LabelWithInfo')).replace(/<View style=\{styles\.choiceWithInfo\}>[\s\S]*$/, '')), 'the i is not inside the radio');
  // The Stepper: with an i, the adjustable element is the − value + box, and the label text is hidden from VoiceOver.
  assert(/\{\.\.\.\(labelInfo \? adjustable : null\)\}/.test(stepper), 'the box is the adjustable element when there is an i');
  assert(/<View \{\.\.\.\(labelInfo \? null : adjustable\)\}/.test(stepper), 'and the whole row is, when there is not (every other stepper is unchanged)');
  assert(/accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/.test(stepper), 'the label is not read twice');
});

Deno.test('the popup: two pages, no button, the dots are the page control, the x closes, it opens on page 1', () => {
  assertFalse(/See an example|Back/.test(popup), 'no "See an example" and no "Back"');
  assert(/pagingEnabled/.test(popup) && /horizontal/.test(popup), 'a swipe turns the page');
  assert(/accessibilityLabel=\{pageLabel\(page\)\}/.test(popup), '"Page 1 of 2" to VoiceOver');
  assert(/accessibilityActions=\{\[\{ name: 'increment' \}, \{ name: 'decrement' \}\]\}/.test(popup), 'swipe up or down on the dots turns the page');
  assert(/onPress=\{\(\) => onTurn\(n\)\}/.test(popup), 'a tap on a dot turns the page');
  assert(/accessibilityLabel=\{CLOSE_LABEL\}/.test(popup), 'the x says Close');
  assert(/const open = useCallback\(\(info: InfoKey, page = 1\)/.test(popup), 'a person always opens on page 1 (only a DEV capture passes another)');
  assert(/useState\(startPage\)/.test(popup));
  assert(/key=\{`\$\{shown\.id\}-\$\{fontScaleKey\(fontScale\)\}`\}/.test(popup), 'each opening is a fresh mount (page 1), and a text-size change re-measures');
  assert(/accessibilityLabel=\{aboutLabel\(INFO_POPUPS\[info\]\.title\)\}/.test(popup), '"About Matchup"');
  assert(/isLargeText\(fontScale\)/.test(popup) && /<ScrollView contentContainerStyle=\{styles\.pageContent\}/.test(popup), 'at the large sizes each page scrolls inside the card');
  assert(/accessibilityLabel=\{copy\.voice\}/.test(popup), 'the picture has its spoken description');
});
