/**
 * 2026-11-03 (Design Lead P1, live font-scale sweep 2): Create league > Price tiers > Add slot. After a live
 * L -> AX5 -> L the Stocks / Min / Max row kept its AX5 widths and "Max" was pushed off the card; a cold launch at
 * L was fine. The same cause as #318 (SetupRows' remountKey): Fabric re-measures a view only when it gets new
 * props, so the row's wrapper Views kept the old size's flex layout. The row's container is now keyed by the scale
 * (useRowRemountKey), frozen while one of its fields is focused (a remount would drop the keyboard), and the typed
 * values live above the key, in the screen's state.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert';
import { fontScaleKey, inputRemountKey } from '../components/sp/logic/remeasureKey.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const L = fontScaleKey(1);
const AX5 = fontScaleKey(3.571);

Deno.test('row key: follows the scale while no field is focused, so L -> AX5 -> L restarts the row twice', () => {
  const keys = [L, AX5, L].map((current) => inputRemountKey(false, L, current));
  assertEquals(keys, [L, AX5, L]);
  assert(keys[0] !== keys[1] && keys[1] !== keys[2]);
});

Deno.test('row key: frozen while a field in the row is focused, then settles at blur', () => {
  assertEquals([inputRemountKey(true, L, L), inputRemountKey(true, L, AX5), inputRemountKey(false, L, AX5)], [L, L, AX5]);
});

Deno.test('the hook is the focus-frozen scale key, with focus and blur handlers', () => {
  const src = SOURCES['components/game/useRowRemountKey.ts'];
  assert(src, 'useRowRemountKey is in the source manifest');
  // The shared hook (focus-roundtrip.test.ts pins it) holds the focus-frozen key and the round trip; the row hook hands it on.
  assertMatch(src, /import \{ useFocusRemountKey \} from '@\/components\/sp\/useFocusRemountKey';/);
  assertMatch(src, /const \{ key, onFocus, onBlur \} = useFocusRemountKey\(\);/);
  assertMatch(src, /return \{ key, onFocus, onBlur \};/);
});

Deno.test('SlotBuilder: the fields row is keyed; every field in it reports focus and blur; the state stays above', () => {
  const src = SOURCES['components/SlotBuilder.tsx'];
  assertMatch(src, /import \{ useRowRemountKey \} from '@\/components\/game\/useRowRemountKey';/);
  assertEquals(src.match(/useRowRemountKey\(\)/g)?.length, 1);
  assertMatch(src, /<View key=\{rowKey\.key\} style=\{\[styles\.fields, stacked && styles\.fieldsStacked, disabled && styles\.dim\]\}>/);
  // All three fields (Stocks, Min, Max) pass both handlers: a row member that did not would be remounted under a focused sibling.
  const fields = src.match(/<Field\b[\s\S]*?\/>/g) ?? [];
  assertEquals(fields.length, 3);
  for (const f of fields) {
    assertMatch(f, /onFocus=\{rowKey\.onFocus\}/);
    assertMatch(f, /onBlur=\{rowKey\.onBlur\}/);
    assertMatch(f, /value=\{s\.(slotCount|priceMin|priceMax)\}/); // controlled by the slot draft, which lives in the parent
  }
  // The key sits on the row's container, not on the card or the slots map: the card (SetupCard key={i}) must keep identity.
  assertMatch(src, /<SetupCard key=\{i\}>/);
});
