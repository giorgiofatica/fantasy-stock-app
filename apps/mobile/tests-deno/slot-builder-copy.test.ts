/**
 * The roster-slot editor's rules (3c-2): the copy carried over from the old
 * SlotBuilder verbatim, the input sanitising, and the shortfall arithmetic.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assertEquals } from 'jsr:@std/assert';
import {
  EMPTY_SLOT,
  PRICE_TIERS_NEED_A_SLOT,
  SLOT_FIELD_LABELS,
  capacityLine,
  slotConfigIssues,
  slotFieldA11y,
  slotIssueAway,
  slotIssueOnSlot,
  SLOT_CHECK_FAILED,
  SLOT_CHECK_RETRY,
  categoryLabel,
  countInput,
  priceInput,
  removeSlotLabel,
  slotShort,
  slotShortfallCopy,
  slotTitle,
} from '../lib/game/slotBuilderCopy.ts';
// categoryData pulls in supabase, so it is read as text (raw-imports) for the guards below.
import slotBuilderCopySrc from '../lib/game/slotBuilderCopy.ts' with { type: 'text' };
import categoryDataSrc from '../lib/categoryData.ts' with { type: 'text' };

const CATS = [{ id: 'c1', name: 'Tech' }, { id: 'c2', name: 'Energy' }];

Deno.test('a new slot is one stock with no filters (flex), as before', () => {
  assertEquals({ ...EMPTY_SLOT }, { slotCount: '1', priceMin: '', priceMax: '', categoryId: '' });
});

Deno.test('slot heading and remove label are 1-based', () => {
  assertEquals(slotTitle(0), 'Slot 1');
  assertEquals(removeSlotLabel(2), 'Remove slot 3');
});

Deno.test('category label: flex, a name, or Unknown for a vanished id', () => {
  assertEquals(categoryLabel('', CATS), 'Any (flex)');
  assertEquals(categoryLabel('c2', CATS), 'Energy');
  assertEquals(categoryLabel('gone', CATS), 'Unknown');
});

Deno.test('count keeps digits only; prices keep digits and the point', () => {
  assertEquals(countInput('2a.5'), '25');
  assertEquals(countInput(''), '');
  assertEquals(priceInput('$12.50x'), '12.50');
});

Deno.test('shortfall copy is the old wording minus "Slot N: " and the "(T teams × C)" bracket (the line sits in the slot\'s card), plural and singular', () => {
  assertEquals(slotShortfallCopy(9, 8, '2'), 'Only 9 draftable stocks match\u00A0— the league needs at least 16.');
  assertEquals(slotShortfallCopy(1, 4, '1'), 'Only 1 draftable stock match\u00A0— the league needs at least 4.');
  // A no-break space before the em dash (never a plain one), no slot prefix, no bracket.
  const line = slotShortfallCopy(9, 8, '2');
  assertEquals(line.includes('match\u00A0—'), true);
  assertEquals(line.includes('match —'), false);
  assertEquals(line.startsWith('Slot'), false);
  assertEquals(line.includes('teams'), false);
});

Deno.test('an empty or zero count needs one per team, as the old check did', () => {
  assertEquals(slotShortfallCopy(3, 6, ''), 'Only 3 draftable stocks match\u00A0— the league needs at least 6.');
  assertEquals(slotShort(5, 6, ''), true);
  assertEquals(slotShort(6, 6, '0'), false);
});

Deno.test('short only when matches fall below teams × count', () => {
  assertEquals(slotShort(15, 8, '2'), true);
  assertEquals(slotShort(16, 8, '2'), false);
});

Deno.test('the failure line is today\'s words split into the note and its button; the partial-data note is gone', () => {
  assertEquals(SLOT_CHECK_FAILED, "Couldn't check availability.");
  assertEquals(SLOT_CHECK_RETRY, 'Try again');
  assertEquals(`${SLOT_CHECK_FAILED} ${SLOT_CHECK_RETRY}.`, "Couldn't check availability. Try again.");
  assertEquals(slotBuilderCopySrc.includes('SLOT_PARTIAL_NOTE'), false);
});

// ── Design Lead copy rulings (3c-2 round 3) ─────────────────────────────

Deno.test('field labels: Stocks, Min $, Max $', () => {
  assertEquals(SLOT_FIELD_LABELS, { count: 'Stocks', min: 'Min $', max: 'Max $' });
});

Deno.test('VoiceOver reads the fields in words', () => {
  assertEquals(slotFieldA11y(1, 'count'), 'Slot 2, stocks');
  assertEquals(slotFieldA11y(1, 'min'), 'Slot 2, lowest price in dollars');
  assertEquals(slotFieldA11y(1, 'max'), 'Slot 2, highest price in dollars');
});

Deno.test('rule 12 (the sweep, rows 3 and 10): the Roster slots caption is gone, and the ruled refusal never says "bracket"', () => {
  assertEquals(/bracket/i.test(PRICE_TIERS_NEED_A_SLOT), false, PRICE_TIERS_NEED_A_SLOT);
});

Deno.test('price tiers with no slot: the ruled line', () => {
  assertEquals(PRICE_TIERS_NEED_A_SLOT, 'Price tiers need at least one slot with a price range.');
});

// ── The slot checks, structured (the logic is validateSlotConfig's, unchanged) ──

const slot = (slotCount: string, priceMin = '', priceMax = '') => ({ slotCount, priceMin, priceMax });

Deno.test('no slots: no issues (slots are optional outside price tiers)', () => {
  assertEquals(slotConfigIssues([], 6), { slots: [], capacity: null });
});

Deno.test('per slot, in order: a count below 1, then a min above the max', () => {
  const out = slotConfigIssues([slot('', '50', '10'), slot('2'), slot('0'), slot('4', '5', '5')], 6);
  assertEquals(out.slots, [
    { slot: 0, kind: 'count' },
    { slot: 0, kind: 'range' },
    { slot: 2, kind: 'count' },
  ]);
  // A bad count adds nothing to the total (2 + 4 = 6): capacity is fine.
  assertEquals(out.capacity, null);
});

Deno.test('capacity: the total must equal the rounds exactly', () => {
  assertEquals(slotConfigIssues([slot('3'), slot('5')], 6).capacity, { total: 8, rounds: 6 });
  assertEquals(slotConfigIssues([slot('4')], 6).capacity, { total: 4, rounds: 6 });
  assertEquals(slotConfigIssues([slot('6')], 6).capacity, null);
});

// ── Copy (Design Lead rulings) ───────────────────────────────────────────

Deno.test('on the slot: no slot number', () => {
  assertEquals(slotIssueOnSlot('count'), 'This slot needs at least 1 stock.');
  assertEquals(slotIssueOnSlot('range'), "Min price can't be higher than max price.");
});

Deno.test('away from the slot: names it, 1-based', () => {
  assertEquals(slotIssueAway({ slot: 1, kind: 'count' }), 'Slot 2 needs at least 1 stock.');
  assertEquals(slotIssueAway({ slot: 1, kind: 'range' }), "In slot 2, min price can't be higher than max price.");
});

Deno.test('capacity, too many: the ruled line', () => {
  assertEquals(capacityLine(8, 6), 'Your slots hold 8 stocks, but each team drafts 6, one per round. Remove 2.');
});

Deno.test('capacity, too few: the ruled line', () => {
  assertEquals(capacityLine(4, 6), 'Your slots hold 4 stocks, but each team drafts 6, one per round. Add 2 so every pick has a slot.');
});

Deno.test('capacity, singular and plural: 1 stock / Remove 1 / Add 1', () => {
  assertEquals(capacityLine(1, 6), 'Your slots hold 1 stock, but each team drafts 6, one per round. Add 5 so every pick has a slot.');
  assertEquals(capacityLine(7, 6), 'Your slots hold 7 stocks, but each team drafts 6, one per round. Remove 1.');
  assertEquals(capacityLine(5, 6), 'Your slots hold 5 stocks, but each team drafts 6, one per round. Add 1 so every pick has a slot.');
  assertEquals(capacityLine(0, 6), 'Your slots hold 0 stocks, but each team drafts 6, one per round. Add 6 so every pick has a slot.');
});

Deno.test('no user-facing line says "stocks per team" or "bracket"', () => {
  const lines = [
    slotIssueOnSlot('count'), slotIssueOnSlot('range'),
    slotIssueAway({ slot: 0, kind: 'count' }), slotIssueAway({ slot: 0, kind: 'range' }),
    capacityLine(8, 6), capacityLine(4, 6),
  ];
  for (const l of lines) {
    assertEquals(/stocks per team/i.test(l), false, l);
    assertEquals(/bracket/i.test(l), false, l);
  }
});

// ── categoryData (read as text) ──────────────────────────────────────────

Deno.test('validateSlotConfig builds its lines from slotConfigIssues (away form + capacity)', () => {
  const fn = categoryDataSrc.slice(categoryDataSrc.indexOf('export function validateSlotConfig('));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assertEquals(body.includes('slotConfigIssues(slots, numRounds)'), true);
  assertEquals(body.includes('issues.map(slotIssueAway)'), true);
  assertEquals(body.includes('capacityLine(capacity.total, capacity.rounds)'), true);
});

Deno.test('the stake modes carry no help paragraph (rule 12, the sweep rows 4 and 10; their definitions are behind the "i")', () => {
  assertEquals([...categoryDataSrc.matchAll(/help: /g)].length, 0);
});
