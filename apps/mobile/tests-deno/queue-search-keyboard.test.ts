/**
 * queue-search-keyboard (2026-11-06, Giorgio's build 10 recording on League › "Your queue"):
 *  1. The keyboard hid the results. The results list was position:absolute, so it added no height to the page, which could
 *     therefore not scroll far enough to lift the list above the keyboard. The list is in the page's flow now, and the scroll
 *     view moves the field up under its top edge (ScrollReveal) when the field takes focus and when its results open.
 *  2. "GRN" stayed in the box after GRNB was picked, and the results for "GRN" reopened: a change event from the native box
 *     arrived AFTER the pick had emptied the controlled value. A pick now closes the field for input until the next focus.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assertEquals, assert } from 'jsr:@std/assert';
import {
  acceptsChange, listJustOpened, nextPhase, revealOffset, type FieldEvent, type FieldPhase,
} from '../components/sp/logic/searchField.ts';
import { SOURCES } from './sourceManifest.generated.ts';

/** Run a field through events, collecting which change events it would have accepted ('change' = a native change event). */
function run(events: (FieldEvent | 'change')[]): { phase: FieldPhase; accepted: boolean[] } {
  let phase: FieldPhase = 'idle';
  const accepted: boolean[] = [];
  for (const e of events) {
    if (e === 'change') accepted.push(acceptsChange(phase));
    else phase = nextPhase(phase, e);
  }
  return { phase, accepted };
}

Deno.test('typing is accepted from the first focus on', () => {
  assertEquals(run(['focus', 'change', 'change', 'change']).accepted, [true, true, true]);
});

Deno.test('a change event after a pick is NOT the person typing: refused, before and after the blur', () => {
  // The recording: type GRN, pick GRNB (the keyboard drops: a blur), then the native box announces "GRN" again.
  assertEquals(run(['focus', 'change', 'change', 'change', 'pick', 'change', 'blur', 'change']).accepted, [true, true, true, false, false]);
});

Deno.test('the next focus reopens the field for typing (a pick never locks it for good)', () => {
  const r = run(['focus', 'change', 'pick', 'blur', 'change', 'focus', 'change', 'change']);
  assertEquals(r.accepted, [true, false, true, true]);
  assertEquals(r.phase, 'typing');
});

Deno.test('a pick with the keyboard already down (no focus) still shuts the field until the next focus', () => {
  const r = run(['pick', 'change', 'focus', 'change']);
  assertEquals(r.accepted, [false, true]);
});

Deno.test('a blur with no pick only ends typing; it never shuts the field', () => {
  assertEquals(nextPhase('typing', 'blur'), 'idle');
  assertEquals(nextPhase('idle', 'blur'), 'idle');
  assertEquals(nextPhase('picked', 'blur'), 'picked');
  assertEquals(acceptsChange('idle'), true);
});

Deno.test('revealOffset: the field sits `margin` below the top; never a negative offset', () => {
  assertEquals(revealOffset(1000, 16), 984);
  assertEquals(revealOffset(10, 16), 0);
  assertEquals(revealOffset(16, 16), 0);
  assertEquals(revealOffset(0, 16), 0);
});

Deno.test('listJustOpened fires on the opening edge only', () => {
  assertEquals(listJustOpened(false, true), true);
  assertEquals(listJustOpened(true, true), false);
  assertEquals(listJustOpened(true, false), false);
  assertEquals(listJustOpened(false, false), false);
});

// ---- wiring (the pure rules are worth nothing if the field does not use them) ----------------------------------------------

const field = SOURCES['components/SymbolSearchField.tsx'];
const editor = SOURCES['components/game/QueueEditor.tsx'];
const room = SOURCES['components/game/DraftRoom.tsx'];
/** The pick handler's body, so an order check cannot be satisfied by a comment elsewhere in the file. */
const handleSelect = field.slice(field.indexOf('const handleSelect = '), field.indexOf('const visible = '));
const bars = SOURCES['components/shell/BarsRefresh.tsx'];

Deno.test('the field refuses typing after a pick: the native onChangeText goes through acceptsChange', () => {
  assert(/const handleChangeText = \(text: string\) => \{\s*if \(!acceptsChange\(phase\.current\)\) return;/.test(field));
  assert(field.includes('onChangeText={handleChangeText}'));
});

Deno.test('the field feeds the phase from focus, blur and pick', () => {
  assert(field.includes("phase.current = nextPhase(phase.current, 'focus');"));
  assert(field.includes("phase.current = nextPhase(phase.current, 'blur');"));
  assert(field.includes("phase.current = nextPhase(phase.current, 'pick');"));
});

Deno.test('a pick shuts the field BEFORE the keyboard drops (the blur it causes must already be refused)', () => {
  const at = handleSelect.indexOf("nextPhase(phase.current, 'pick')");
  const dismiss = handleSelect.indexOf('Keyboard.dismiss()');
  const select = handleSelect.indexOf('onSelect(result);');
  assert(at > 0 && dismiss > at && select > dismiss);
});

Deno.test('clearOnSelect empties the native box too, before the keyboard drops; only the queue asks for it', () => {
  assert(handleSelect.includes('if (clearOnSelect) inputRef.current?.clear();'));
  assert(handleSelect.indexOf('inputRef.current?.clear()') < handleSelect.indexOf('Keyboard.dismiss()'));
  assert(/<SymbolSearchField[^>]*clearOnSelect/.test(editor));
  // The draft room keeps the symbol it picked in the box (selectedSymbol), so it must NOT clear.
  const at = room.indexOf('<SymbolSearchField');
  assertEquals(room.slice(at, room.indexOf('/>', at)).includes('clearOnSelect'), false);
});

Deno.test('the DEV capture script types through the unguarded path (it never focuses the field)', () => {
  assert(field.includes('useCaptureAction(captureAction, (q) => typeInto(q ?? \'\'));'));
});

Deno.test('the results, "no matches" and "didn\'t load" panels are in the page\'s flow, not absolutely positioned', () => {
  const styles = field.slice(field.indexOf('const styles = StyleSheet.create'));
  for (const name of ['resultsContainer', 'noResultsContainer']) {
    const block = styles.slice(styles.indexOf(`${name}: {`), styles.indexOf('},', styles.indexOf(`${name}: {`)));
    assertEquals(/position:\s*'absolute'/.test(block), false, name);
    assertEquals(/zIndex/.test(block), false, name);
  }
  // The spinner is the one absolute child (it sits inside the field).
  assert(/spinner: \{\s*position: 'absolute'/.test(styles));
});

Deno.test('the field scrolls itself up when it takes focus, when the keyboard opens, and when its results open', () => {
  assert(field.includes('const scrollFieldUp = () => reveal?.(containerRef.current);'));
  assert(field.includes("Keyboard.addListener('keyboardDidShow', scrollFieldUp)"));
  assert(field.includes('listJustOpened(wasOpen.current, listOpen)'));
  assert(field.includes('<View ref={containerRef} style={styles.container}>'));
});

Deno.test('BarsRefresh (every tab\'s scroll view) provides the reveal on iOS and on Android', () => {
  assertEquals((bars.match(/ScrollRevealContext\.Provider/g) ?? []).length, 4); // two open + two close tags
  assert(bars.includes('makeScrollReveal(() => scrollRef.current as never)'));
  assert(bars.includes('makeScrollReveal(() => androidScrollRef.current)'));
  // The keyboard behaviours the reveal relies on stay on.
  assert(bars.includes('automaticallyAdjustKeyboardInsets'));
  assertEquals((bars.match(/keyboardShouldPersistTaps="handled"/g) ?? []).length, 2);
});

Deno.test('the draft room and the queue both sit in BarsRefresh, so both inherit the reveal', () => {
  const league = SOURCES['app/(tabs)/league.tsx'];
  assert(league.includes('<BarsRefresh'));
  assert((league.match(/<BarsRefresh/g) ?? []).length >= 2);
});
