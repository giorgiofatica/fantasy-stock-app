/**
 * The clock while you search (Giorgio, 2026-11-06, option A, "A for clock"; PRODUCT_RULES "The clock while you search", board
 * #call-draft-clock): on your running clock the search scrolls up to clear the keyboard, which takes the clock card off the page. While
 * it is your pick, your clock is running and the card's RING is off the page, a small clock is pinned at the top of the draft room:
 * the ring, the seconds and "Your pick". Pure rules and numbers (lib/game/draftClockChip.ts) are tested for values; the wiring is
 * source-pinned, written so the obvious wrong shapes (measuring the card, a live region, a chip that scrolls) fail.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  CARD_REVEAL_BELOW, CHIP_EDGE, CHIP_GAP, CHIP_MAX_SCALE, CHIP_MIN_HEIGHT, CHIP_PADDING, CHIP_RING_SIZE, CHIP_RING_STROKE, CHIP_RISE, CHIP_TOP,
  CLOCK_CHIP_HINT, CLOCK_CHIP_TEXT, chipRevealBelow, chipRingSize, clockChipLabel, clockIsYoursAndRunning, ringOffscreen, showClockChip,
} from '../lib/game/draftClockChip.ts';
import { clockCardKind, clockRingArc, clockRingTone, draftOffered, type ClockCardKind } from '../lib/game/draftClockCard.ts';
import { pickClockLabel } from '../lib/game/draftRoom.ts';
import { SOURCES } from './sourceManifest.generated.ts';

/** Source without comments, so a pin cannot be satisfied (or tripped) by prose. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const room = code(SOURCES['components/game/DraftRoom.tsx']);
const chip = code(SOURCES['components/game/DraftClockChip.tsx']);
const bars = code(SOURCES['components/shell/BarsRefresh.tsx']);

// ------------------------------------------------------------------------------------------------ when it shows (pure)

const ON = { kind: 'yours' as ClockCardKind, clockLabel: '0:42', ringBottom: -30, viewTop: 0, fadeHeight: 69 };

Deno.test('the chip shows only when your clock is running AND the ring has left the page', () => {
  assertEquals(showClockChip(ON), true);
  // The ring in view: the card says the clock, so the chip stays away.
  assertEquals(showClockChip({ ...ON, ringBottom: 200 }), false);
  // The ring's bottom edge exactly at the visible top (the viewport top plus the fade) is off the page; one point lower is on it.
  assertEquals(showClockChip({ ...ON, ringBottom: 69 }), true);
  assertEquals(showClockChip({ ...ON, ringBottom: 70 }), false);
});

Deno.test('the chip never shows unless the clock is yours and running (their turn, stalled, auto-picking, no clock)', () => {
  for (const kind of ['theirs', 'stalled', 'auto_picking'] as ClockCardKind[]) assertEquals(showClockChip({ ...ON, kind }), false, kind);
  assertEquals(showClockChip({ ...ON, clockLabel: '' }), false);
  // Not measured yet is not "off the page".
  assertEquals(showClockChip({ ...ON, ringBottom: null }), false);
  assertEquals(showClockChip({ ...ON, viewTop: null }), false);
});

Deno.test('the room\'s own rules give the chip its kind and its label: yours, running, and the clock card\'s words', () => {
  assertEquals(clockCardKind({ isMyTurn: true, stalled: false, clockKind: 'on_clock' }), 'yours');
  assertEquals(clockCardKind({ isMyTurn: true, stalled: false, clockKind: 'last10' }), 'yours');
  assertEquals(clockCardKind({ isMyTurn: true, stalled: true, clockKind: 'on_clock' }), 'stalled');
  assertEquals(clockCardKind({ isMyTurn: true, stalled: false, clockKind: 'auto_picking' }), 'auto_picking');
  assertEquals(clockCardKind({ isMyTurn: false, stalled: false, clockKind: 'on_clock' }), 'theirs');
  assertEquals(clockIsYoursAndRunning('yours', '0:42'), true);
  assertEquals(clockIsYoursAndRunning('yours', ''), false);
  assertEquals(clockIsYoursAndRunning('theirs', '0:42'), false);
  // The search is offered on exactly the kinds the chip can show on.
  for (const k of ['yours', 'theirs', 'stalled', 'auto_picking'] as ClockCardKind[]) assertEquals(draftOffered(k), k === 'yours', k);
  assertEquals(pickClockLabel({ kind: 'on_clock', secondsLeft: 42 } as never), '0:42');
});

Deno.test('ringOffscreen is the ring\'s BOTTOM edge against the page top plus the fade', () => {
  assertEquals(ringOffscreen({ ringBottom: 10, viewTop: 0, fadeHeight: 69 }), true);
  assertEquals(ringOffscreen({ ringBottom: 120, viewTop: 0, fadeHeight: 69 }), false);
  // A scroll view that does not start at the top of the window moves the line with it.
  assertEquals(ringOffscreen({ ringBottom: 120, viewTop: 100, fadeHeight: 69 }), true);
});

// ------------------------------------------------------------------------------------------------ what it looks like (numbers)

Deno.test('the pill: the approved padding, gap, edge, ring and height', () => {
  assertEquals(CHIP_PADDING, { top: 6, bottom: 6, left: 8, right: 14 });
  assertEquals(CHIP_GAP, 8);
  assertEquals(CHIP_EDGE, 2);
  assertEquals(CHIP_MIN_HEIGHT, 44);
  assertEquals(CHIP_RING_SIZE, 22);
  assertEquals(CHIP_RING_STROKE, 3);
  assertEquals(CHIP_TOP, 4);
  assertEquals(CHIP_RISE, 8);
  assertEquals(CHIP_MAX_SCALE, 1.3);
});

Deno.test('the words: "Your pick", the hint "Shows the clock", the label names the seconds', () => {
  assertEquals(CLOCK_CHIP_TEXT, 'Your pick');
  assertEquals(CLOCK_CHIP_HINT, 'Shows the clock');
  assertEquals(clockChipLabel('0:42'), 'Your pick, 0:42');
});

Deno.test('the ring grows with the text and stops at 1.3x (about 46pt tall at the largest size)', () => {
  assertEquals(chipRingSize(1), 22);
  assertEquals(chipRingSize(0.8), 22);
  assertEquals(chipRingSize(1.3), 22 * 1.3);
  assertEquals(chipRingSize(3.1), 22 * 1.3);
});

Deno.test('the ring runs down like the card\'s, and the arc turns loss in the last 10 seconds only', () => {
  const half = clockRingArc(30, 60, CHIP_RING_SIZE, CHIP_RING_STROKE);
  assertEquals(half.radius, (22 - 3) / 2);
  assert(Math.abs(half.dashOffset - half.circumference / 2) < 1e-9);
  assertEquals(clockRingTone('on_clock'), 'live');
  assertEquals(clockRingTone('last10'), 'loss');
});

// ------------------------------------------------------------------------------------------------ the search's margin

Deno.test('the reveal margin: top gap + the chip\'s measured height + 12 + 16 (78pt at the largest size, 46 tall)', () => {
  assertEquals(chipRevealBelow(46), 78);
  assertEquals(chipRevealBelow(CHIP_MIN_HEIGHT), 76);
  // The check from the spec: at AX5, 78 + about 85 (the field) + 4 x 56 (four results) fits the 484 left above the keyboard.
  assert(78 + 85 + 4 * 56 <= 484);
});

Deno.test('a tap on the chip puts the card\'s top just under the fade', () => {
  assertEquals(CARD_REVEAL_BELOW, 8);
});

// ------------------------------------------------------------------------------------------------ the room's wiring

Deno.test('DraftRoom measures the RING (not the card) against the scroll view, on every throttled scroll event', () => {
  assert(room.includes('const fold = useScrollFold();'));
  assert(room.includes('ringRef.current.measureInWindow((_x, y, _w, h) => {'));
  assert(room.includes('ringBottom: y + h, viewTop: vp.top, fadeHeight'));
  assert(room.includes('const off = fold.subscribe(check);'));
  assert(!room.includes('cardRef.current.measureInWindow'), 'the card is not what is measured');
  assert(room.includes('<View ref={ringRef} collapsable={false}>'));
  assert(room.includes('<View ref={cardRef} collapsable={false}>'));
  // The visible page top includes the status bar: the fade's real height, from the safe area.
  assert(room.includes('const fadeHeight = topFadeHeight(insets.top);'));
});

Deno.test('the chip exists for exactly your running clock, with the room on screen (it goes when you leave the room)', () => {
  assert(room.includes("const clockRunning = room.status === 'ready' && !draftDone && roomOnScreen && clockIsYoursAndRunning(pinKind, pinLabel);"));
  assert(room.includes('stalled: stalledAt === onClockPick'), 'a stall ends it');
  assert(room.includes('usePinned('));
  assert(/usePinned\(\s*clockRunning \? \(/.test(room));
  // Cleared with the room: the hook empties the slot on unmount.
  const pinned = code(SOURCES['components/shell/scrollPinned.ts']);
  assert(pinned.includes('useEffect(() => () => set?.(null), [set]);'));
});

Deno.test('all the hooks the chip needs run BEFORE the room\'s early returns', () => {
  const firstReturn = room.indexOf("if (room.status === 'error') {");
  for (const s of ['useScrollFold()', 'useScrollReveal()', 'usePinned(', 'setChipShown(', 'useState(CHIP_MIN_HEIGHT)']) {
    const at = room.indexOf(s);
    assert(at > 0 && at < firstReturn, s);
  }
});

Deno.test('a tap shows the clock: the keyboard goes down, the card scrolls back under the fade, the field keeps its text', () => {
  assert(room.includes('Keyboard.dismiss();\n    reveal?.(cardRef.current, CARD_REVEAL_BELOW);'));
  const tap = room.slice(room.indexOf('const showTheClock = () => {'), room.indexOf('usePinned('));
  assert(!tap.includes('setSearch'), 'the field keeps its text');
  assert(room.includes('onPress={showTheClock}'));
});

Deno.test('the search lands under the chip while your clock runs, shown or not; the queue keeps the default', () => {
  assert(room.includes('revealMargin={clockRunning ? chipRevealBelow(chipHeight) : undefined}'));
  assert(room.includes('onHeight={setChipHeight}'));
  const queue = code(SOURCES['components/game/QueueEditor.tsx']);
  const at = queue.indexOf('<SymbolSearchField');
  assert(!queue.slice(at, queue.indexOf('/>', at)).includes('revealMargin'));
  const field = code(SOURCES['components/SymbolSearchField.tsx']);
  assert(field.includes('revealMargin?: number;'));
  assert(field.includes('revealMarginRef.current = revealMargin;'), 'read when the scroll happens: the chip\'s height arrives late');
});

// ------------------------------------------------------------------------------------------------ the chip component

Deno.test('the chip is a button named for its words and clock, with the hint, and no live region', () => {
  assert(chip.includes('accessibilityRole="button"'));
  assert(chip.includes('accessibilityLabel={clockChipLabel(label)}'));
  assert(chip.includes('accessibilityHint={CLOCK_CHIP_HINT}'));
  assert(!/accessibilityLiveRegion/.test(chip));
  // Hidden, it says nothing and takes no touch.
  assert(chip.includes("pointerEvents={visible ? 'auto' : 'none'}"));
  assert(chip.includes('accessibilityElementsHidden={!visible}'));
  assert(chip.includes("importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}"));
});

Deno.test('the chip is one line, every part capped at 1.3x, with the bare ring and the approved colours', () => {
  assertEquals((chip.match(/numberOfLines=\{1\}/g) ?? []).length, 2);
  assertEquals((chip.match(/maxFontSizeMultiplier=\{CHIP_MAX_SCALE\}/g) ?? []).length, 2);
  assert(chip.includes('bare size={chipRingSize(fontScale)} stroke={CHIP_RING_STROKE}'));
  assert(chip.includes('color={colors.text}'), 'the seconds');
  assert(chip.includes('color={colors.liveText}'), 'Your pick');
  assert(chip.includes('backgroundColor: colors.accentTint'));
  assert(chip.includes('borderColor: colors.live'), 'the 2pt live edge, kept in the last 10 seconds');
  assert(chip.includes('elevation.card'));
  assert(chip.includes('radius.pill'));
  assert(chip.includes('tone={tone}'), 'the arc takes its tone from clockRingTone (loss in the last 10 s)');
  assert(room.includes('tone={clockRingTone(shownClock.kind)}\n        onPress={showTheClock}'));
});

Deno.test('the chip fades and rises with the quick settle, opacity only with Reduce Motion; no pulse', () => {
  assert(chip.includes('duration: duration.quick, easing: easing.settle'));
  assert(chip.includes('translateY: reduced ? 0 : (1 - shown.value) * CHIP_RISE'));
  assert(!/withRepeat|withSequence|Haptics/.test(chip), 'no flash, no pulse, no extra haptic (the room\'s nextLastTenBuzz fires)');
});

Deno.test('the chip\'s ring is the clock ring, bare: no text inside, the same track, arc and tone', () => {
  const ring = code(SOURCES['components/sp/gn/ClockRing.tsx']);
  assert(ring.includes('bare = false'));
  assert(ring.includes('{bare ? null : ('));
  assert(ring.includes('clockRingArc(secondsLeft, totalSeconds, size, stroke)'));
  assert(ring.includes('stroke={colors.track}'));
  assert(ring.includes('stroke={colors[tone]}'));
});

// ------------------------------------------------------------------------------------------------ the slot

Deno.test('BarsRefresh\'s pinned slot sits over the page (not in the scroll content), above the fade, at its lower edge', () => {
  assert(bars.includes('pinned?: ReactNode;'));
  assert(bars.includes('const pinned = pinnedProp ?? pinnedByChild;'));
  // Both platforms draw it, after the fade (so it is above it), outside the scroll view.
  assertEquals((bars.match(/<PinnedLayer node=\{pinned\} topInset=\{insets\.top\} \/>/g) ?? []).length, 2);
  for (const block of bars.split('<PinnedLayer node').slice(0, 2)) assert(block.lastIndexOf('<TopFade') > block.lastIndexOf('</Animated.ScrollView>') || block.includes('</IosBarsRefresh>'));
  assertEquals((bars.match(/<PinnedSlotContext\.Provider value=\{setPinned\}>/g) ?? []).length, 2);
  const layer = bars.slice(bars.indexOf('function PinnedLayer'), bars.indexOf('function IosBarsRefresh'));
  assert(layer.includes('pointerEvents="box-none"'), 'a tap anywhere but the chip reaches the page');
  assert(layer.includes('top: topFadeHeight(topInset)'));
  assert(/pinned: \{[^}]*position: 'absolute'[^}]*zIndex: 20/s.test(bars));
  assert(!layer.includes('ScrollView'));
});
