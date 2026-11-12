/**
 * The "i" popups' pure logic: the approved lines (pinned to PRODUCT_RULES.md itself), the
 * VoiceOver descriptions (one constant each, NOT approved yet), which options get an "i", the
 * page control, and the pictures' example numbers.
 *
 *   deno test apps/mobile/tests-deno/info-popups.test.ts --allow-read
 */
import { assert, assertEquals, assertFalse, assertNotEquals } from 'jsr:@std/assert';
import {
  CONTROL_INFO,
  INFO_KEYS,
  INFO_POPUPS,
  NO_INFO,
  PAGES,
  VO_CAP,
  VO_DRAFTABLE,
  VO_EQUAL,
  VO_MATCHUP,
  VO_ORDER,
  VO_PLAYOFFS,
  VO_TIERS,
  aboutLabel,
  clampPage,
  exampleCapTotal,
  exampleMoney,
  exampleShares,
  infoForLeagueType,
  infoForStakeMode,
  offsetForPage,
  parseInfoFixture,
  pageAtOffset,
  pageLabel,
  turnPage,
} from '../lib/game/infoPopups.ts';
import { DURATION_TYPE_OPTION } from '../lib/game/createLeagueSteps.ts';

const rules = await Deno.readTextFile(new URL('../../../docs/PRODUCT_RULES.md', import.meta.url));
const flat = (s: string) => s.replace(/\s+/g, ' ');
const approvedBlock = (() => {
  const from = rules.indexOf("The \"i\" popup lines, approved as written");
  assert(from >= 0, 'the approved-lines ruling is in PRODUCT_RULES');
  return flat(rules.slice(from, rules.indexOf('Rounds gets no "i"', from)));
})();

Deno.test('every popup line is Giorgio\'s approved text, word for word (PRODUCT_RULES)', () => {
  for (const key of INFO_KEYS) {
    const { title, line } = INFO_POPUPS[key];
    assert(approvedBlock.includes(`${title}: "${line}"`), `${key}: "${title}: ${line}" is not in the approved block`);
  }
});

Deno.test('there are exactly the seven popups whose options get an "i" (Duration has none while hidden)', () => {
  assertEquals([...INFO_KEYS].sort(), ['cap', 'draftable', 'equal', 'matchup', 'order', 'playoffs', 'tiers']);
  assertFalse(INFO_KEYS.some((k) => (k as string) === 'duration'), 'no Duration popup is built');
  // Its approved line stays on record for when it comes back, unused.
  assertEquals(DURATION_TYPE_OPTION.infoLine, 'One race for the whole league. The biggest gain at the end wins.');
  assertFalse(Object.values(INFO_POPUPS).some((p) => /race for the whole league/.test(p.line)));
});

Deno.test('the League type card: Matchup gets its "i"; Duration gets none (it has no row)', () => {
  assertEquals(infoForLeagueType('matchup'), 'matchup');
  assertEquals(infoForLeagueType('duration'), null);
});

Deno.test('Stakes: every one of the three modes gets an "i", and no other mode does', () => {
  assertEquals(infoForStakeMode('fixed_notional'), 'equal');
  assertEquals(infoForStakeMode('price_tiers'), 'tiers');
  assertEquals(infoForStakeMode('budget_cap'), 'cap');
  assertEquals(infoForStakeMode('anything_else'), null);
});

Deno.test('the controls with one "i" each: Draft order, Playoff teams, Allow non-draftable stocks', () => {
  assertEquals(CONTROL_INFO, { draftOrder: 'order', playoffTeams: 'playoffs', nonDraftable: 'draftable' });
});

Deno.test('Rounds, Pick clock, Managers and the limits get no "i" (1A, and rule 13\'s three-part test)', () => {
  for (const name of ['Rounds', 'Pick clock', 'Managers', 'Regular season', 'Draft time', 'Stake per slot']) {
    assert(NO_INFO.includes(name), `${name} is on the no-i list`);
    assertFalse(INFO_KEYS.some((k) => INFO_POPUPS[k].title === name), `${name} has no popup`);
  }
});

Deno.test('each popup has one VoiceOver description constant, and the table uses it', () => {
  const vo = { matchup: VO_MATCHUP, equal: VO_EQUAL, tiers: VO_TIERS, cap: VO_CAP, order: VO_ORDER, playoffs: VO_PLAYOFFS, draftable: VO_DRAFTABLE };
  for (const key of INFO_KEYS) {
    assertEquals(INFO_POPUPS[key].voice, vo[key]);
    assert(INFO_POPUPS[key].voice.length > 0, `${key} has a description`);
  }
  assertEquals(new Set(Object.values(vo)).size, 7, 'seven different descriptions');
});

Deno.test('the VoiceOver numbers are the numbers the pictures are drawn from', () => {
  assertEquals(exampleShares('F').toFixed(2), '89.29');
  assertEquals(exampleShares('NVDA').toFixed(2), '5.36');
  assertEquals(exampleShares('COST').toFixed(2), '1.09');
  assert(VO_EQUAL.includes('89.29 shares of F') && VO_EQUAL.includes('5.36 of NVDA') && VO_EQUAL.includes('1.09 of COST'));
  const total = exampleCapTotal(['F', 'NVDA', 'MSFT', 'COST']);
  assertEquals(exampleMoney(total), '$1,628.10');
  assert(VO_CAP.includes('$1,628.10') && VO_CAP.includes('$2,500 cap'));
  assertEquals(exampleMoney(24.1), '$24.10');
});

Deno.test('the "i" and the dots speak: "About Matchup", "Page 1 of 2"', () => {
  assertEquals(aboutLabel('Matchup'), 'About Matchup');
  assertEquals(aboutLabel(INFO_POPUPS.draftable.title), 'About Non-draftable stocks');
  assertEquals(pageLabel(1), 'Page 1 of 2');
  assertEquals(pageLabel(2), 'Page 2 of 2');
  assertEquals(PAGES, 2);
});

Deno.test('the page control: a swipe settles on the nearer page, a tap scrolls to one, up/down turns it', () => {
  assertEquals(pageAtOffset(0, 300), 1);
  assertEquals(pageAtOffset(149, 300), 1);
  assertEquals(pageAtOffset(151, 300), 2);
  assertEquals(pageAtOffset(300, 300), 2);
  assertEquals(pageAtOffset(900, 300), 2, 'held at the last page');
  assertEquals(pageAtOffset(-40, 300), 1, 'held at the first');
  assertEquals(pageAtOffset(100, 0), 1, 'an unmeasured width is page 1');
  assertEquals(offsetForPage(1, 300), 0);
  assertEquals(offsetForPage(2, 300), 300);
  assertEquals(offsetForPage(9, 300), 300, 'clamped');
  assertEquals(turnPage(1, 1), 2);
  assertEquals(turnPage(2, 1), 2);
  assertEquals(turnPage(2, -1), 1);
  assertEquals(turnPage(1, -1), 1);
  assertEquals(clampPage(NaN), 1);
  assertNotEquals(turnPage(1, 1), turnPage(1, -1));
});

Deno.test('the DEV capture knob: <key>[:<page>], dev builds only, never guessed', () => {
  assertEquals(parseInfoFixture(true, 'matchup'), { info: 'matchup', page: 1 });
  assertEquals(parseInfoFixture(true, 'draftable:2'), { info: 'draftable', page: 2 });
  assertEquals(parseInfoFixture(true, 'matchup:9'), { info: 'matchup', page: 1 });
  assertEquals(parseInfoFixture(true, 'duration'), null, 'Duration has no popup');
  assertEquals(parseInfoFixture(true, ''), null);
  assertEquals(parseInfoFixture(true, undefined), null);
  assertEquals(parseInfoFixture(false, 'matchup:2'), null, 'a release bundle never reads it');
});
