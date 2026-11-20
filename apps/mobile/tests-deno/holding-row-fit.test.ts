/**
 * components/sp/logic/holdingFit.ts + HoldingRow: the row's ticker disc and value are fitted by a MEASURED
 * scale, never by iOS's adjustsFontSizeToFit (Design Lead gate, 2026-11-18: on the finished manager portfolio at
 * AX5 the FIRST row's disc and value drew at ~40%, under their own floors, 4 of 4; RosterRow documents the same
 * failure). Pinned:
 *   - an unmeasured row is full size (never shrinks on a guess), a measured value never goes under its own
 *     floor (0.75) and never over 1; the disc's ticker has NO floor (pick A, 2026-11-19: ticker-badge-fit.test.ts);
 *   - the disc's room is a constant (40pt circle, 2pt padding), so its scale needs no layout pass at all;
 *   - the value's room is the trail's 45% of the measured row, at the capped scale (1.3×);
 *   - HoldingRow carries no adjustsFontSizeToFit, measures its own row, and uses these two scales.
 * Run: cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  DISC_EXCEPTION_MIN_SCALE, DISC_PADDING, DISC_PT, DISC_SIZE, DISC_TEXT_ROOM, discTickerScale, flooredFitScale, tickerWidth, TRAIL_SHARE, VALUE_MIN_SCALE, valueScale,
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
  assertEquals(flooredFitScale(1, 100, DISC_EXCEPTION_MIN_SCALE), 0.01, 'the disc has no floor: it fits');
});

Deno.test('the disc: real glyph widths (Archivo ExtraBold at 13pt), a constant room, no floor (pick A)', () => {
  assertEquals(DISC_TEXT_ROOM, 36);
  // Widths measured from assets/fonts/archivo/Archivo-ExtraBold.ttf (fontTools hmtx): pin them to a tenth of a point.
  const measured: Record<string, number> = { V: 9.5, KO: 20.5, XOM: 32.0, WMT: 33.4, MMM: 35.6, AAPL: 36.6, TSLA: 35.6, NFLX: 36.2, PLTR: 35.7, NVDA: 39.2, AMZN: 40.7, MSFT: 38.1, GOOGL: 50.3, 'BRK.B': 43.3 };
  for (const [t, w] of Object.entries(measured)) assert(Math.abs(tickerWidth(t, DISC_PT) - w) < 0.1, `${t}: ${tickerWidth(t, DISC_PT)} vs ${w}`);
  // A ticker that fits the room keeps its full 13pt: short ones and the narrow-letter 4-letter ones (L, T, F, S).
  for (const t of ['V', 'KO', 'AMD', 'XOM', 'JPM', 'TSLA', 'PLTR', 'WMT', 'MMM']) assertEquals(discTickerScale(t), 1, t);
  // AAPL and NFLX are 0.6pt and 0.2pt over the room: within 2% of full size, not the ~8% a generic capital-width
  // estimate gave (the DL's P3).
  assert(discTickerScale('AAPL') > 0.97 && discTickerScale('AAPL') < 1, String(discTickerScale('AAPL')));
  assert(discTickerScale('NFLX') > 0.99 && discTickerScale('NFLX') < 1, String(discTickerScale('NFLX')));
  // NVDA, AMZN, MSFT are WIDER than the room at 13pt (iOS's own fit shrank them before this change too).
  assertEquals(Math.round(discTickerScale('NVDA') * 1000) / 1000, 0.918);
  assertEquals(Math.round(discTickerScale('AMZN') * 1000) / 1000, 0.885);
  assertEquals(Math.round(discTickerScale('MSFT') * 1000) / 1000, 0.946);
  // Five letters used to stop at the 0.85 floor and get cut to "GO…"; with pick A they shrink to fit.
  assertEquals(Math.round(discTickerScale('GOOGL') * 1000) / 1000, 0.715);
  assertEquals(Math.round(discTickerScale('BRK.B') * 1000) / 1000, 0.832);
  assertEquals(DISC_EXCEPTION_MIN_SCALE, 0);
});

Deno.test('the disc room matches TickerBadge\'s styles (a `size` circle, space[1] padding)', () => {
  assertEquals(DISC_PADDING, space[1]);
  const badge = Deno.readTextFileSync(new URL('../components/sp/gn/TickerBadge.tsx', import.meta.url));
  assert(/badge: \{[\s\S]*?paddingHorizontal: space\[1\],/.test(badge));
  assert(badge.includes('{ width: size, height: size, borderRadius: size / 2,'));
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
  assert(row.includes('<TickerBadge symbol={row.symbol} />'), 'the shared badge (pick A fit)');
  assert(row.includes('fontSize: VALUE_PT * valueScale(rowWidth, row.valueText, fontScale)'));
  assert(/trail: \{[\s\S]*?maxWidth: '45%',/.test(row), 'TRAIL_SHARE is the trail\'s own maxWidth');
});
