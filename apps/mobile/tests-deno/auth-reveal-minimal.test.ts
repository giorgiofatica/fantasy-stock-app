/**
 * Build 13 (Giorgio's recording of 1.3.0 (12): "When I click on the password field, it like shoots the screen up super high. So the password
 * thing is at the very top, and there's a huge gap, and then the create account button."): the focus reveal scrolled the focused field's
 * label to the TOP of the window. His ruling: scroll the MINIMUM needed, so the focused field, with its error and rules, just clears the
 * docked footer (the existing breathing room); never pin it to the top; if it already fits, do not move at all. On Create account at the
 * default size, Email stays visible above Password when Password is focused; at AX5 the focused box is still always fully visible.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { BOTTOM_BREATHING, TOP_BREATHING, revealOffset, type RevealInput } from '../components/shell/authFieldReveal.ts';
import { SOURCES } from './sourceManifest.generated.ts';

// Create account on the iPhone 17e simulator at Large, measured in the app (content coordinates, offset 0, 2026-11-09):
// Email label 213 .. box 228-278; Password label 303, box 318-368, its five rules end at 424. With the keyboard up the window
// (screen top inset 59 to the footer's top) is 386 tall; the content is 740 tall.
const L = {
  emailBlock: [213, 278] as const,
  emailBox: [228, 278] as const,
  passwordBlock: [303, 424] as const,
  passwordBox: [318, 368] as const,
  viewportHeight: 386,
  contentHeight: 740,
};

function input(over: Partial<RevealInput> & Pick<RevealInput, 'current'>): RevealInput {
  return {
    blockTop: L.passwordBlock[0], blockBottom: L.passwordBlock[1], inputTop: L.passwordBox[0], inputBottom: L.passwordBox[1],
    viewportHeight: L.viewportHeight, contentHeight: L.contentHeight, ...over,
  };
}

Deno.test('Create account, Password focused from the top: a few dozen points, NOT the field pinned to the top', () => {
  const y = revealOffset(input({ current: 0 }));
  assertEquals(y, L.passwordBlock[1] + BOTTOM_BREATHING - L.viewportHeight); // the rules just clear the footer: 424 + 6 - 386 = 44
  assertEquals(y, 44);
  // The old rule put the label at the top (303 - 26 - 4 = 273): six times as far.
  assert(y < 273 / 4, `${y} must be far short of pinning the field to the top`);
});

Deno.test('Create account, Password focused: Email stays visible ABOVE Password (box and label both on screen)', () => {
  const y = revealOffset(input({ current: 0 }));
  for (const [top, bottom] of [L.emailBlock, L.emailBox]) {
    assert(top - y >= 0 && bottom - y <= L.viewportHeight, `Email ${top}..${bottom} must sit inside the window at offset ${y}`);
  }
  // And the whole Password field with its rules is in the window with its breathing room under it.
  assert(L.passwordBlock[1] + BOTTOM_BREATHING - y <= L.viewportHeight);
});

Deno.test('Create account, Email focused from the top: the page does not move at all (it already fits)', () => {
  assertEquals(revealOffset(input({ current: 0, blockTop: L.emailBlock[0], blockBottom: L.emailBlock[1], inputTop: L.emailBox[0], inputBottom: L.emailBox[1] })), 0);
});

Deno.test('a field already inside the window never moves the page, wherever the offset is', () => {
  for (const current of [0, 10, 44, 100]) {
    const y = revealOffset(input({ current, blockTop: current + 50, blockBottom: current + 170, inputTop: current + 65, inputBottom: current + 115 }));
    assertEquals(y, current, `current ${current}`);
  }
});

Deno.test('a focus from a deeper offset scrolls UP only as far as the label (with its sliver), not to the top of the page', () => {
  const y = revealOffset(input({ current: 300, blockTop: L.emailBlock[0], blockBottom: L.emailBlock[1], inputTop: L.emailBox[0], inputBottom: L.emailBox[1] }));
  assertEquals(y, L.emailBlock[0] - TOP_BREATHING);
});

Deno.test('the breathing room is literal: 4pt above the label, 6pt under the region', () => {
  assertEquals([TOP_BREATHING, BOTTOM_BREATHING], [4, 6]);
  // Scrolling up lands the label 4pt under the window's edge; scrolling down leaves 6pt under the rules.
  assertEquals(revealOffset(input({ current: 500, contentHeight: 2000 })), L.passwordBlock[0] - 4);
  assertEquals(revealOffset(input({ current: 0, contentHeight: 2000 })) + L.viewportHeight, L.passwordBlock[1] + 6);
});

Deno.test('a window that holds label + box but not the rules scrolls to keep the LABEL in (not just the box)', () => {
  // viewport 200: field block (121 + 10) does not fit; label+box (303-4 .. 368+6 = 75 tall) does. From offset 400 the label is above the window.
  const y = revealOffset(input({ current: 400, viewportHeight: 120, contentHeight: 2000 }));
  assertEquals(y, L.passwordBlock[0] - TOP_BREATHING, 'label and box (75 tall) fit a 120 window, so the label leads');
  // And from above, label+box is brought up from below only as far as the box's bottom plus breathing.
  const down = revealOffset(input({ current: 0, viewportHeight: 120, contentHeight: 2000 }));
  assertEquals(down, L.passwordBox[1] + BOTTOM_BREATHING - 120);
});

Deno.test('never negative, and never past the end of the content', () => {
  assertEquals(revealOffset(input({ current: 0, blockTop: 0, blockBottom: 60, inputTop: 10, inputBottom: 56 })), 0);
  // A short page: the window is bigger than the overflow, so the most it can scroll is the overflow.
  const y = revealOffset(input({ current: 0, contentHeight: 400, viewportHeight: 386, blockBottom: 900, inputBottom: 900 }));
  assertEquals(y, 14);
});

Deno.test('AX5 (a small window, a tall field): the focused BOX is always fully visible, and what gives way is the rules, then the label', () => {
  // Largest accessibility size: label ~54 tall, box ~150, five rules ~210 tall, and a window of ~130 (keyboard up, footer docked).
  const ax5 = { current: 0, viewportHeight: 200, contentHeight: 1600, blockTop: 600, inputTop: 660, inputBottom: 810, blockBottom: 1020 };
  const y = revealOffset(ax5);
  assert(ax5.inputTop - y >= 0 && ax5.inputBottom - y <= ax5.viewportHeight, 'the whole box is in the window');
  // Too short even for label + box: the label gives way, the box keeps its bottom breathing room.
  assertEquals(ax5.inputBottom + BOTTOM_BREATHING - y, ax5.viewportHeight);
});

Deno.test('AX5, a window that holds label + box but not the rules: label and box stay, the rules give way', () => {
  const i = { current: 0, viewportHeight: 300, contentHeight: 1600, blockTop: 600, inputTop: 660, inputBottom: 810, blockBottom: 1020 };
  const y = revealOffset(i);
  assert(i.blockTop - TOP_BREATHING - y >= 0, 'the label is in');
  assertEquals(i.inputBottom + BOTTOM_BREATHING - y, i.viewportHeight, 'the box clears the footer by exactly its breathing room');
});

Deno.test('a window that cannot hold even the box still shows its bottom edge (the typed line)', () => {
  assertEquals(revealOffset({ current: 0, viewportHeight: 120, contentHeight: 2000, blockTop: 480, blockBottom: 700, inputTop: 500, inputBottom: 650 }), 536); // 650 + 6 - 120
});

Deno.test('the move is minimal: the result is never further than the nearest offset that brings the region in', () => {
  // Property over a grid: the target is either the current offset, or sits exactly on an edge of the region, so nothing overshoots.
  for (let current = 0; current <= 360; current += 20) {
    for (const vh of [200, 300, 386, 500]) {
      const i = { current, viewportHeight: vh, contentHeight: 1200, blockTop: 303, blockBottom: 424, inputTop: 318, inputBottom: 368 };
      const y = revealOffset(i);
      const edges = [i.blockTop - TOP_BREATHING, i.blockBottom + BOTTOM_BREATHING - vh, i.inputTop - TOP_BREATHING, i.inputBottom + BOTTOM_BREATHING - vh, i.blockTop - TOP_BREATHING, current];
      assert(edges.includes(y), `current ${current} vh ${vh}: ${y} is not current or an edge`);
      // The box is in the window afterwards, always.
      assert(i.inputTop - y >= 0 && i.inputBottom - y <= vh, `box in window at current ${current} vh ${vh}`);
    }
  }
});

// ---- wiring --------------------------------------------------------------------------------------------------------------------

const scaffold = SOURCES['components/shell/AuthScaffold.tsx'];
const field = SOURCES['components/shell/Field.tsx'];

Deno.test('the scaffold measures the focused Field\'s WHOLE view (error and rules too) and asks revealOffset with where it is now', () => {
  assert(scaffold.includes('<FieldBlockContext.Provider value={announceBlock}>'));
  assert(scaffold.includes('block.measureLayout(inner as never'));
  const call = scaffold.slice(scaffold.indexOf('revealOffset({'), scaffold.indexOf('});', scaffold.indexOf('revealOffset({')));
  for (const k of ['current: offset.current', 'blockTop', 'blockBottom', 'inputTop', 'inputBottom: inputTop + inputHeight', 'viewportHeight: viewportHeight.current', 'contentHeight: contentHeight.value']) {
    assert(call.includes(k), k);
  }
  assert(scaffold.includes('offset.current = e.nativeEvent.contentOffset.y;'), 'the current offset is tracked from onScroll');
});

Deno.test('a field that is already in view makes no scrollTo call at all', () => {
  assert(scaffold.includes('if (Math.abs(y - offset.current) >= 0.5) scroll.scrollTo({ y, animated: true });'));
});

Deno.test('Field names its whole view to the scaffold when its input takes focus, and does nothing without a scaffold', () => {
  assert(field.includes('const announceBlock = useContext(FieldBlockContext);'));
  assert(field.includes('<View ref={block} collapsable={false} style={styles.field}>'));
  assert(field.includes('announceBlock?.(block.current);'));
  assert(SOURCES['components/shell/FieldBlockContext.ts'].includes('createContext<((block: View | null) => void) | null>(null)'));
});
