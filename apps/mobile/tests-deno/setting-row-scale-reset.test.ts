/**
 * P2 (Design Lead ticket, 2026-11-02): League settings' Draft time row, after a LIVE text-size change from the largest
 * accessibility size to Large, stayed wrapped ("Sat, Oct 3 · / 7:00 PM ET", a tall row); a cold launch at Large lays it
 * out on one line. Not a state bug: at Large `stack` was already false, so the value's line count was never read. The
 * Text hosts were remounted (remeasureKey.ts), but the row's wrapper Views kept the flex layout from the old size, so the
 * remounted value was given a 79pt box beside a 206pt label column (cold: 135pt beside 150pt). Keying the row's ROOT by
 * the scale starts the whole row over. The value's line count is also stored with the size it was measured at.
 * Run: cd apps/mobile/tests-deno && deno test .
 */
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert';
import { valueLinesAt } from '../lib/game/labelBreaks.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const IOS_SCALES = [0.823, 0.882, 0.941, 1, 1.118, 1.235, 1.353, 1.786, 2.143, 2.643, 3.143, 3.571];

Deno.test('a value count is read at the size it was measured at, and only there', () => {
  for (const at of IOS_SCALES) {
    for (const lines of [1, 2, 4]) assertEquals(valueLinesAt({ fontScale: at, lines }, at), lines);
  }
});

Deno.test('a value count from ANOTHER size reads as one line (never a stale multi-line flag)', () => {
  for (const at of IOS_SCALES) {
    for (const now of IOS_SCALES) {
      if (at !== now) assertEquals(valueLinesAt({ fontScale: at, lines: 3 }, now), 1, `${at} -> ${now}`);
    }
  }
  // The ticket's pair: the value ran to two lines at the largest accessibility size; back at Large it is one.
  assertEquals(valueLinesAt({ fontScale: 3.571, lines: 2 }, 1), 1);
});

const src = SOURCES['components/game/SetupRows.tsx'];

/** The opening tag that starts at `from`, attributes included (a `>` inside `{…}` is skipped). */
function openingTagAt(text: string, from: number): string {
  let depth = 0;
  let i = from + 1;
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0 && text[i - 1] !== '=') break;
  }
  return text.slice(from, i + 1);
}

Deno.test('useLabelBreaks hands out the scale key, and the row roots use it', () => {
  assertMatch(src, /remountKey: fontScaleKey\(fontScale\)/);
  // SettingRow's body and SwitchRow's root: the row's outer View carries settingRow, and is keyed.
  const roots = [...src.matchAll(/<View key=\{remountKey\} style=\{\[styles\.settingRow,/g)];
  assertEquals(roots.length, 2, 'SettingRow body and SwitchRow root');
  for (const m of roots) assertMatch(openingTagAt(src, m.index!), /key=\{remountKey\}/);
  // No row root is left unkeyed.
  const all = [...src.matchAll(/<View [^>]*styles\.settingRow\b/g)];
  assertEquals(all.length, roots.length, 'every settingRow root is keyed');
});

Deno.test("SettingRow reads its value's line count only through valueLinesAt, stored with the size", () => {
  assertMatch(src, /useState<\{ fontScale: number; lines: number \}>/);
  assertMatch(src, /const valueLines = valueLinesAt\(measuredLines, fontScale\);/);
  assertMatch(src, /setMeasuredLines\(\{ fontScale, lines \}\)/);
  assert(!/setValueLines/.test(src), 'no bare line-count state');
});
