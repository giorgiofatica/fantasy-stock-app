/**
 * The Stocks list's "+" lands in the buy review (Planner ruling, 2026-11-19; docs/plans/2026-11-18-stocks-tab.md, part 2):
 * open and allowed => the sheet opens straight into its buy review; after the close or before the draft => the sheet with its
 * reason under a disabled "Review buy" and NO review; a row tap => the sheet to look, in every state. No buy without the review.
 */
import { assert, assertEquals, assertFalse, assertMatch } from 'jsr:@std/assert';
import { SOURCES } from './sourceManifest.generated.ts';
import { normalizeOpenOptions, shouldStartReview } from '../lib/money/stockSheetApi.ts';
import { stockSheetModel } from '../lib/money/stockSheetModel.ts';

const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

const BASE = {
  symbol: 'MSFT', companyName: 'Microsoft', price: 512.3, prevClose: 500, held: null, owner: null, draft: null,
  gate: { open: true }, leagueName: 'Stock Scudetto', lastCloseLabel: null,
} as Parameters<typeof stockSheetModel>[0];

/** What the sheet decides for a "+" in one state: the model's own buy rule, then the start rule. */
function plusStartsReview(over: Partial<Parameters<typeof stockSheetModel>[0]>, gateOpen: boolean, start: 'buy' | null = 'buy'): boolean {
  const model = stockSheetModel({ ...BASE, ...over });
  return shouldStartReview(start, true, model.buy.enabled, gateOpen);
}

Deno.test('open and allowed: the "+" starts the buy review', () => {
  assertEquals(plusStartsReview({ gate: { open: true } }, true), true);
});

Deno.test('after the close: no review; the sheet shows "Market\'s closed. Opens {day} {time} ET." under a disabled Review buy', () => {
  const gate = { open: false, opensLabel: 'Mon 9:30 AM ET' };
  assertEquals(plusStartsReview({ gate }, false), false);
  const m = stockSheetModel({ ...BASE, gate });
  assertEquals(m.buy.enabled, false);
  assertEquals(m.buy.reason, "Market's closed. Opens Mon 9:30 AM ET.");
  assertEquals(m.controlsShown, true);
});

Deno.test('before the draft: no review; the sheet shows "Trading opens after the draft." under a disabled Review buy, market open or not', () => {
  for (const open of [true, false]) {
    const gate = { open, preDraft: true };
    assertEquals(plusStartsReview({ gate }, open), false);
    const m = stockSheetModel({ ...BASE, gate });
    assertEquals(m.buy.reason, 'Trading opens after the draft.');
    assertEquals(m.buy.enabled, false);
  }
});

Deno.test('a finished season: no review (and no "+" is drawn, no control on the sheet)', () => {
  assertEquals(plusStartsReview({ gate: { open: false, seasonOver: true } }, false), false);
});

Deno.test('another rule that blocks a buy (owned, a full roster, over budget, no price) also lands on the plain sheet, never a review', () => {
  assertEquals(plusStartsReview({ owner: { kind: 'other', name: 'Paolo M.', isBot: false } }, true), false);
  assertEquals(plusStartsReview({ rosterFull: true }, true), false);
  assertEquals(plusStartsReview({ budgetLeft: 100 }, true), false);
  assertEquals(plusStartsReview({ price: null }, true), false);
});

Deno.test('a row tap never starts a review, in every state', () => {
  for (const [over, gateOpen] of [
    [{ gate: { open: true } }, true],
    [{ gate: { open: false, opensLabel: 'Mon 9:30 AM ET' } }, false],
    [{ gate: { open: true, preDraft: true } }, true],
    [{ gate: { open: false, seasonOver: true } }, false],
  ] as const) {
    assertEquals(plusStartsReview(over, gateOpen, null), false);
  }
  assertEquals(shouldStartReview(undefined, true, true, true), false);
});

Deno.test('the review waits for the sheet\'s facts: not ready means not started', () => {
  assertEquals(shouldStartReview('buy', false, true, true), false);
});

Deno.test('startReview rides the open options: only an explicit "buy" counts', () => {
  assertEquals(normalizeOpenOptions({ name: 'Microsoft', startReview: 'buy' }).startReview, 'buy');
  assertEquals(normalizeOpenOptions({ name: 'Microsoft' }).startReview, null);
  assertEquals(normalizeOpenOptions({ startReview: null }).startReview, null);
  assertEquals(normalizeOpenOptions('row-id').startReview, null, 'the legacy origin-ref string never starts one');
  assertEquals(normalizeOpenOptions(undefined).startReview, null);
});

Deno.test('wiring: the "+" asks for the review, a row tap does not; the host and the sheet carry it; it starts once, only through shouldStartReview', () => {
  const screen = SOURCES['components/stocks/StocksScreen.tsx'];
  assertMatch(screen, /startReview: buy \? 'buy' : null/);
  assertMatch(screen, /onOpen=\{\(\) => openSheet\(row, 'stocks-row'\)\}/);
  assertMatch(screen, /onPlus=\{\(\) => openSheet\(row, 'stocks-plus', true\)\}/);
  const host = SOURCES['components/money/MoneyHost.tsx'];
  assertMatch(host, /startReview: o\.startReview/);
  assertMatch(host, /startReview=\{current\.startReview\}/);
  const body = SOURCES['components/money/StockSheetBody.tsx'];
  assertMatch(body, /if \(shouldStartReview\(s\.wanted, s\.ready, buyAllowedRef\.current\.enabled, buyAllowedRef\.current\.gateOpen\)\) s\.go\(\);/);
  assertMatch(body, /startedReview\.current = true;\s*if \(shouldStartReview/, 'decided once, before the rule runs: a market that opens later pops nothing');
  assertMatch(body, /go: \(\) => void openReview\('buy'\)/);
  // The review the "+" starts is the ordinary one (openReview): no trade call of its own anywhere in the Stocks code.
  assertFalse(/recordTrade|record-trade|useTradeSubmit|trade\.submit/.test(code(screen)));
  assert(code(body).includes("openReview('buy')"));
});
