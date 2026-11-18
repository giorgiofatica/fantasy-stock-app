/**
 * components/sp/logic/holdingFit.ts + HoldingRow: the row's ticker disc and value are fitted by a MEASURED
 * scale, never by iOS's adjustsFontSizeToFit (Design Lead gate, 2026-11-18: on the finished manager portfolio at
 * AX5 the FIRST row's disc and value drew at ~40%, under their own floors, 4 of 4; RosterRow documents the same
 * failure). Pinned:
 *   - an unmeasured row is full size (never shrinks on a guess), a measured one never goes under its own floor
 *     (0.85 for the disc, 0.75 for the value) and never over 1;
 *   - the disc's room is a constant (40pt circle, 2pt padding), so its scale needs no layout pass at all;
 *   - the value's room is the trail's 45% of the measured row, at the capped scale (1.3×);
 *   - HoldingRow carries no adjustsFontSizeToFit, measures its own row, and uses these two scales.
 * Run: cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  DISC_MIN_SCALE, DISC_PADDING, DISC_SIZE, DISC_TEXT_ROOM, discTickerScale, flooredFitScale, TRAIL_SHARE, VALUE_MIN_SCALE, valueScale,
} from '../components/sp/logic/holdingFit.ts';
import { space } from '../constants/tokens/space.ts';

Deno.test('an unmeasured row is full size: no shrink on a guess', () => {
  assertEquals(flooredFitScale(null, 100, 0.75), 1);
  assertEquals(flooredFitScale(50, null, 0.75), 1);
  assertEquals(flooredFitScale(50, 0, 0.75), 1);
  assertEquals(valueScale(null, '$4,109.14', 3.1), 1);
});

Deno.test('a fit is clamped to [floor, 1]: never under its own floor, never enlarged', () => {
  assertEquals(flooredFitScale(200, 100, 0.75), 1);
  assertEquals(flooredFitScale(90, 100, 0.75), 0.9);
  assertEquals(flooredFitScale(1, 100, 0.75), 0.75, 'the floor, not ~0.01 (the AX5 first-row bug)');
  assertEquals(flooredFitScale(1, 100, DISC_MIN_SCALE), DISC_MIN_SCALE);
});

Deno.test('the disc: a constant room, so a long ticker floors at 11pt and a short one is full size', () => {
  assertEquals(DISC_TEXT_ROOM, 36);
  assertEquals(discTickerScale('V'), 1);
  assertEquals(discTickerScale('KO'), 1);
  for (const t of ['NVDA', 'AMZN', 'GOOGL', 'BRK.B', 'XOMX']) {
    const s = discTickerScale(t);
    assert(s >= DISC_MIN_SCALE && s <= 1, `${t}: ${s}`);
  }
  assertEquals(discTickerScale('GOOGL'), DISC_MIN_SCALE, 'five capitals do not fit at full size');
  assertEquals(Math.round(13 * DISC_MIN_SCALE * 100) / 100, 11.05, 'the floor is the §9B 11pt');
});

Deno.test('the disc room matches HoldingRow\'s styles (40pt circle, space[1] padding)', () => {
  assertEquals(DISC_PADDING, space[1]);
  const row = Deno.readTextFileSync(new URL('../components/money/HoldingRow.tsx', import.meta.url));
  assert(/disc: \{\s*width: 40,\s*height: 40,[\s\S]*?paddingHorizontal: space\[1\],/.test(row));
  assertEquals(DISC_SIZE, 40);
});

Deno.test('the value: a roomy row is full size, a tight one shrinks, a very tight one floors at 0.75', () => {
  assertEquals(valueScale(402, '$2,122.91', 1), 1);
  // 45% of 160 = 72pt of room for "$12,481.77" (≈ 88pt at 15pt).
  const tight = valueScale(160, '$12,481.77', 1);
  assert(tight < 1 && tight >= VALUE_MIN_SCALE, String(tight));
  assertEquals(valueScale(40, '$12,481.77', 1), VALUE_MIN_SCALE);
  // The cap: a system scale of 3.1 measures the value at 1.3×, never wider.
  assertEquals(valueScale(300, '$4,109.14', 3.1), valueScale(300, '$4,109.14', 1.3));
  assertEquals(TRAIL_SHARE, 0.45);
});

Deno.test('HoldingRow: no adjustsFontSizeToFit; it measures its row and uses both scales', () => {
  const row = Deno.readTextFileSync(new URL('../components/money/HoldingRow.tsx', import.meta.url));
  assert(!/adjustsFontSizeToFit\s*[=\s>]/.test(row.replace(/\/\/.*$/gm, '')), 'iOS is never asked to fit a row text');
  assert(row.includes('onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}'));
  assert(row.includes('fontSize: DISC_PT * discTickerScale(row.symbol)'));
  assert(row.includes('fontSize: VALUE_PT * valueScale(rowWidth, row.valueText, fontScale)'));
  assert(/trail: \{[\s\S]*?maxWidth: '45%',/.test(row), 'TRAIL_SHARE is the trail\'s own maxWidth');
});
