/**
 * C-6 (Design Lead gate, M3, rule 5): every money figure on Portfolio that
 * changes on a quote refresh rolls, matching Home's hero -- not just the
 * header value. PortfolioScreen.tsx is a React Native component and isn't
 * Deno-testable directly; this is a source guard, the established pattern
 * in this suite.
 * Run with: cd apps/mobile/tests-deno && deno test .
 */
import { assertEquals } from 'jsr:@std/assert';
import portfolioScreenSrc from '../components/money/PortfolioScreen.tsx' with { type: 'text' };
import gainPairSrc from '../components/money/RollingGainPair.tsx' with { type: 'text' };

Deno.test('wiring: the today line rolls (money and percent, each their own RollingMoney)', () => {
  // W4: the value, then the gain pair's two units (money, percent), drawn by RollingGainPair. The "since the
  // draft" hero line is now the range's gain (RangeGainLine, 2026-11-17: it follows the range, and rolls on
  // a quote refresh too).
  assertEquals((gainPairSrc.match(/<RollingMoney text=\{(money|pct)\}/g) ?? []).length, 2);
  assertEquals(portfolioScreenSrc.includes('<RollingGainPair'), true);
  assertEquals(portfolioScreenSrc.includes('<RollingMoney text={v.valueText}'), true);
  assertEquals(portfolioScreenSrc.includes('<RangeGainLine range={gainRange} gain={gain} rollKey={`${rollKey}-${gainRange}`} unknown={gain === null} />'), true);
  assertEquals(portfolioScreenSrc.includes('v.todayMoneyText'), true);
  assertEquals(portfolioScreenSrc.includes('v.todayPctText'), true);
});

Deno.test('wiring: the today row is one accessible element, not loose rolling digits; the range gain is one labelled element', () => {
  // W4: the line is one accessible element labelled with the whole sentence.
  assertEquals(portfolioScreenSrc.includes('<View accessible accessibilityLabel={`${v.todayText} today`}>'), true);
});
