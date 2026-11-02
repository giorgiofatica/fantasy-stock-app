/**
 * P3 (2026-10-30): VoiceOver read Trade history's "1 sh at $1.23" as "1 S H at…". The row
 * still SHOWS "sh"; its spoken label says "share" / "shares".
 * Run: cd apps/mobile/tests-deno && deno test .
 */
import { assertEquals, assertMatch, assertNotMatch } from 'jsr:@std/assert';
import { historyShareDetail } from '../lib/money/tradeHistory.ts';
import { formatShares } from '../lib/money/formatShares.ts';
import { SOURCES } from './sourceManifest.generated.ts';

Deno.test('on screen "sh"; spoken "share" for one, "shares" for anything else', () => {
  assertEquals(historyShareDetail('1', '$1.23'), { text: '1 sh at $1.23', spoken: '1 share at $1.23' });
  assertEquals(historyShareDetail('2', '$1.23'), { text: '2 sh at $1.23', spoken: '2 shares at $1.23' });
  assertEquals(historyShareDetail('0.5', '$1.23'), { text: '0.5 sh at $1.23', spoken: '0.5 shares at $1.23' });
  assertEquals(historyShareDetail('1.5', '$10.00').spoken, '1.5 shares at $10.00');
  assertEquals(historyShareDetail('1,234', '$3.00').spoken, '1,234 shares at $3.00');
});

Deno.test('no price: the count alone, both ways', () => {
  assertEquals(historyShareDetail('3', null), { text: '3 sh', spoken: '3 shares' });
  assertEquals(historyShareDetail('1', null), { text: '1 sh', spoken: '1 share' });
});

Deno.test('singular follows the count as SHOWN: 1.00004 shows "1", so it reads "1 share"', () => {
  assertEquals(historyShareDetail(formatShares(1.00004), null).spoken, '1 share');
  assertEquals(historyShareDetail(formatShares(1.0001), null).spoken, '1.0001 shares');
});

Deno.test('the spoken detail never says "sh"', () => {
  for (const q of ['1', '2', '0.5', '—']) assertNotMatch(historyShareDetail(q, '$1.00').spoken, /\bsh\b/);
});

Deno.test("ItemRow speaks the spoken detail and shows the visible one", () => {
  const src = SOURCES['components/money/TradeHistoryScreen.tsx'];
  assertMatch(src, /const shares = historyShareDetail\(formatShares\(item\.quantity\), price\);/);
  assertMatch(src, /accessibilityLabel=\{`\$\{label\}, \$\{spokenDetail\}/);
  assertNotMatch(src, /accessibilityLabel=\{`\$\{label\}, \$\{detail\}/);
  assertMatch(src, /\{keepMoney\(detail\)\}/);
});
