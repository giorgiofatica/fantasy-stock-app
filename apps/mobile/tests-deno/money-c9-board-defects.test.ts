/**
 * C-9 (Design Lead gate, confirmed as defect fixes against Giorgio-approved
 * board frames, not new design): the "Buy a stock" row's icon tile + accent
 * title, the search screen's page-title size, and the stock sheet's × close
 * icon. All three components are React Native (JSX, some Reanimated) and
 * aren't Deno-testable directly; these are source guards, the established
 * pattern in this suite (e.g. C-1's quiet-wiring test, C-2's ownership-row
 * wiring tests).
 * Run with: cd apps/mobile/tests-deno && deno test .
 */
import { assertEquals } from 'jsr:@std/assert';
import portfolioScreenSrc from '../components/money/PortfolioScreen.tsx' with { type: 'text' };
import stockSearchScreenSrc from '../components/money/StockSearchScreen.tsx' with { type: 'text' };
import stockSheetBodySrc from '../components/money/StockSheetBody.tsx' with { type: 'text' };

Deno.test('Portfolio has no Buy a stock row: buying lives on the Stocks tab (Giorgio, 2026-11-18); a holding still opens its card with Sell', () => {
  assertEquals(portfolioScreenSrc.includes('COPY.buyAStock'), false);
  assertEquals(portfolioScreenSrc.includes("'/stock-search'"), false);
  assertEquals(portfolioScreenSrc.includes('<HoldingRow'), true);
  assertEquals(portfolioScreenSrc.includes('pendingSell'), true);
});

Deno.test("wiring: the search screen has NO title any more (board #call-buy-top, B, 2026-11-16: the top is the back arrow and the field)", () => {
  assertEquals(stockSearchScreenSrc.includes('COPY.stockSearchTitle'), false);
  assertEquals(/<Text variant="(title|headline)">/.test(stockSearchScreenSrc), false);
});

Deno.test("wiring: the stock sheet closes with the × icon, not \"Done\" text, key screen 5", () => {
  assertEquals(stockSheetBodySrc.includes('<Icon name="close" size="body" tone="text2" />'), true);
  assertEquals(stockSheetBodySrc.includes('>Done</Text>'), false);
  assertEquals(stockSheetBodySrc.includes('accessibilityLabel="Close"'), true);
});
