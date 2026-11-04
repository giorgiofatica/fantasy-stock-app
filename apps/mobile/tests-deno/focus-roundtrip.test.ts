/**
 * 2026-11-04 (Design Lead, P3 ruled a task): a field or row that is FOCUSED keeps its key (a remount would drop the keyboard)
 * and takes the current scale's key at blur. That compared the two ends, so L -> AX5 -> L inside one focus session ended where
 * it began and nothing remounted at blur: the row kept the box Fabric measured at AX5. The state now remembers that the scale
 * moved (focusRoundTrip.ts) and one blur remounts it, even at the same scale. Shared by useInputRemountKey (one TextInput
 * host) and useRowRemountKey (a row's container) through useFocusRemountKey.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals, assertMatch, assertNotEquals } from 'jsr:@std/assert';
import {
  FOCUS_REMOUNT_INITIAL, bumpedKey, focusEnd, focusRemountKey, focusRemountReducer, focusStart, needsScaleNote, scaleNoted,
  type FocusRemountState,
} from '../components/sp/logic/focusRoundTrip.ts';
import { fontScaleKey } from '../components/sp/logic/remeasureKey.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const L = fontScaleKey(1);
const XXXL = fontScaleKey(1.353);
const AX5 = fontScaleKey(3.571);

/** The hook's behaviour, one render at a time: render at the current scale (noting a move while focused, as the hook's
 * render-phase dispatch does), then events. A handler closes over the key of the LAST render, as the real onFocus does. */
class Hook {
  state: FocusRemountState = FOCUS_REMOUNT_INITIAL;
  scale = L;
  render(): string {
    if (needsScaleNote(this.state, this.scale)) this.state = focusRemountReducer(this.state, { type: 'scale', scaleKey: this.scale });
    return focusRemountKey(this.state, this.scale);
  }
  setScale(scale: string): string { this.scale = scale; return this.render(); }
  focus(): string {
    const key = this.render();
    this.state = focusRemountReducer(this.state, { type: 'focus', keyAtFocus: key, scaleAtFocus: this.scale });
    return this.render();
  }
  blur(): string {
    this.render();
    this.state = focusRemountReducer(this.state, { type: 'blur' });
    return this.render();
  }
  /** A tap from one field of the row to the next: the blur and the focus reach React in ONE batch, so there is one render. */
  sibling(): string {
    const key = this.render();
    this.state = focusRemountReducer(this.state, { type: 'blur' });
    this.state = focusRemountReducer(this.state, { type: 'focus', keyAtFocus: key, scaleAtFocus: this.scale });
    return this.render();
  }
}

Deno.test('the round trip: focused at L, L -> AX5 -> L, then blur remounts once, at the same scale', () => {
  const h = new Hook();
  const atFocus = h.focus();
  assertEquals([h.setScale(AX5), h.setScale(L)], [atFocus, atFocus]); // frozen while typing: the keyboard stays up
  const afterBlur = h.blur();
  assertNotEquals(afterBlur, atFocus); // the old comparison of the ends read L === L here and remounted nothing
  assertEquals(afterBlur, `${L}:1`);
  assertEquals(h.render(), afterBlur); // and it settles: one remount, not a loop
});

Deno.test('no change during focus: no remount at blur, at any fixed size', () => {
  for (const scale of [L, XXXL, AX5]) {
    const h = new Hook();
    h.setScale(scale);
    const atFocus = h.focus();
    assertEquals(h.blur(), atFocus);
  }
});

Deno.test('a one-way change during focus still remounts once at blur, to the new size (as before)', () => {
  const h = new Hook();
  const atFocus = h.focus();
  h.setScale(AX5);
  const afterBlur = h.blur();
  assertNotEquals(afterBlur, atFocus);
  assertEquals(afterBlur, `${AX5}:1`);
});

Deno.test('a round trip that visits several sizes counts as ONE remount at blur', () => {
  const h = new Hook();
  const atFocus = h.focus();
  for (const s of [XXXL, AX5, XXXL, L, AX5, L]) h.setScale(s);
  assertEquals(h.blur(), `${L}:1`);
  assertNotEquals(h.blur(), atFocus);
});

Deno.test('each round trip changes the key again: no later session lands on a key an earlier one already used', () => {
  const h = new Hook();
  const keys = [h.render()];
  for (let i = 0; i < 4; i++) {
    h.focus();
    h.setScale(AX5);
    h.setScale(L);
    keys.push(h.blur());
  }
  assertEquals(keys, [L, `${L}:1`, `${L}:2`, `${L}:3`, `${L}:4`]);
  assertEquals(new Set(keys).size, keys.length);
});

Deno.test('unfocused, the key still follows the scale and L -> AX5 -> L restarts twice (the #318 behaviour is unchanged)', () => {
  const h = new Hook();
  const keys = [h.render(), h.setScale(AX5), h.setScale(L)];
  assertEquals(keys, [L, AX5, L]);
});

Deno.test('a round trip counted once keeps its suffix, so the next unfocused change is still a new key', () => {
  const h = new Hook();
  h.focus(); h.setScale(AX5); h.setScale(L); h.blur();
  assertEquals([h.setScale(XXXL), h.setScale(L)], [`${XXXL}:1`, `${L}:1`]);
});

Deno.test('a tap to a sibling field after a round trip keeps the keyboard: the key never changes between them', () => {
  const h = new Hook();
  const atFocus = h.focus();            // slot Min
  h.setScale(AX5); h.setScale(L);       // the size goes and comes back with the keyboard up
  assertEquals(h.sibling(), atFocus);   // tap Max: blur(Min) + focus(Max) in one batch, no remount
  assertEquals(h.setScale(L), atFocus);
  assertEquals(h.blur(), `${L}:1`);     // leaving the row: the ONE remount
});

Deno.test('a tap to a sibling with no change never remounts, then a later round trip still does', () => {
  const h = new Hook();
  const atFocus = h.focus();
  assertEquals(h.sibling(), atFocus);
  assertEquals(h.sibling(), atFocus);
  assertEquals(h.blur(), atFocus);
  h.focus(); h.setScale(XXXL); h.setScale(L);
  assertNotEquals(h.blur(), atFocus);
});

Deno.test('a change made after the sibling tap is noted against the sibling session, not lost', () => {
  const h = new Hook();
  const atFocus = h.focus();
  h.sibling();
  h.setScale(AX5); h.setScale(L);
  assertEquals(h.blur(), `${L}:1`);
  assertNotEquals(h.render(), atFocus);
});

Deno.test('the pure steps: only a focused session that has not seen another scale needs a note (no render loop)', () => {
  const idle = FOCUS_REMOUNT_INITIAL;
  assertEquals(needsScaleNote(idle, AX5), false);                       // not focused
  const focused = focusStart(idle, L, L);
  assertEquals(needsScaleNote(focused, L), false);                      // same scale
  assertEquals(needsScaleNote(focused, AX5), true);
  const noted = scaleNoted(focused, AX5);
  assertEquals(noted.session?.changed, true);
  assertEquals(needsScaleNote(noted, L), false);                        // already noted: stays noted when it comes back
  assertEquals(needsScaleNote(noted, AX5), false);
  assert(scaleNoted(focused, L) === focused);                           // nothing to note: the same object, so React bails out
  assert(scaleNoted(idle, AX5) === idle);
});

Deno.test('the pure steps: blur counts a noted session once, an unnoted one not at all, and clears the session', () => {
  const focused = focusStart(FOCUS_REMOUNT_INITIAL, L, L);
  assertEquals(focusEnd(focused), { bumps: 0, session: null });
  assertEquals(focusEnd(scaleNoted(focused, AX5)), { bumps: 1, session: null });
  assertEquals(focusEnd(focusEnd(scaleNoted(focused, AX5))), { bumps: 1, session: null }); // a stray second blur counts nothing
  assertEquals(bumpedKey(L, 0), L);
  assertEquals(bumpedKey(L, 3), `${L}:3`);
});

Deno.test('the shared hook: a render-phase note, one reducer, handlers that carry the key and scale at focus (source guard)', () => {
  const src = SOURCES['components/sp/useFocusRemountKey.ts'];
  assert(src, 'useFocusRemountKey is in the source manifest');
  assertMatch(src, /const scaleKey = fontScaleKey\(fontScale\);/);
  assertMatch(src, /const \[state, dispatch\] = useReducer\(focusRemountReducer, FOCUS_REMOUNT_INITIAL\);/);
  assertMatch(src, /if \(needsScaleNote\(state, scaleKey\)\) dispatch\(\{ type: 'scale', scaleKey \}\);/);
  assertMatch(src, /const key = focusRemountKey\(state, scaleKey\);/);
  assertMatch(src, /focused: state\.session !== null,/);
  assertMatch(src, /onFocus: \(\) => dispatch\(\{ type: 'focus', keyAtFocus: key, scaleAtFocus: scaleKey \}\),/);
  assertMatch(src, /onBlur: \(\) => dispatch\(\{ type: 'blur' \}\),/);
});

Deno.test('both users of the focus-frozen key go through the shared hook: no second at-focus vs at-blur comparison (source guard)', () => {
  for (const path of ['components/sp/useInputRemountKey.ts', 'components/game/useRowRemountKey.ts']) {
    const src = SOURCES[path];
    assertMatch(src, /useFocusRemountKey\(\)/, path);
    assert(!/keyAtFocus/.test(src), `${path} must not keep its own at-focus key`);
    assert(!/useState/.test(src), `${path} must not keep its own focus state`);
  }
  // The only other caller of inputRemountKey is the shared logic itself.
  const callers = Object.entries(SOURCES).filter(([p, s]) => !p.startsWith('tests-deno/') && /\binputRemountKey\(/.test(s) && !p.endsWith('remeasureKey.ts')).map(([p]) => p);
  assertEquals(callers, ['components/sp/logic/focusRoundTrip.ts']);
});
