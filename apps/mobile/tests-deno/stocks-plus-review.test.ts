/**
 * The Stocks list's "+" lands in the buy review (Planner ruling, 2026-11-19; docs/plans/2026-11-18-stocks-tab.md, part 2):
 * open and allowed => the sheet opens straight into its buy review; after the close or before the draft => the sheet with its
 * reason under a disabled "Review buy" and NO review; a row tap => the sheet to look, in every state. No buy without the review.
 */
import { assert, assertEquals, assertFalse, assertMatch } from 'jsr:@std/assert';
import { SOURCES } from './sourceManifest.generated.ts';
import { normalizeOpenOptions, shouldStartReview } from '../lib/money/stockSheetApi.ts';
import { noProceedsKnown, proceedsSettled, stockSheetModel } from '../lib/money/stockSheetModel.ts';
import { parseStocksKnob } from '../lib/stocks/seamStocks.ts';

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

Deno.test('the two paths DIFFER: in the same allowed state the "+" starts the review and a row tap does not; both draw the same sheet otherwise', () => {
  const allowed = stockSheetModel({ ...BASE, gate: { open: true } });
  const viaPlus = shouldStartReview(normalizeOpenOptions({ name: 'Microsoft', originRef: 'stocks-plus', startReview: 'buy' }).startReview, true, allowed.buy.enabled, true);
  const viaRow = shouldStartReview(normalizeOpenOptions({ name: 'Microsoft', originRef: 'stocks-row', startReview: null }).startReview, true, allowed.buy.enabled, true);
  assertEquals([viaPlus, viaRow], [true, false]);
  // And in a blocked state both paths agree: neither starts a review, both show the sheet's reason.
  const blocked = stockSheetModel({ ...BASE, gate: { open: false, opensLabel: 'Mon 9:30 AM ET' } });
  assertEquals(shouldStartReview('buy', true, blocked.buy.enabled, false), false);
  assertEquals(shouldStartReview(null, true, blocked.buy.enabled, false), false);
  // The only difference in the screen's wiring is the third argument.
  const screen = SOURCES['components/stocks/StocksScreen.tsx'];
  assertMatch(screen, /onOpen=\{\(\) => openSheet\(row, 'stocks-row'\)\}\s*onPlus=\{\(\) => openSheet\(row, 'stocks-plus', true\)\}/);
});

// ── fixed-notional, every slot held (the NORMAL mid-season state): a pre-review gate, not a dead-end refusal (DL P1, 2026-11-19) ──

Deno.test('fixed-notional with every slot held and no proceeds: Buy is disabled with "Every slot is invested. Sell a holding to free one."; the "+" does NOT open the review', () => {
  assertEquals(noProceedsKnown('fixed_notional', []), true);
  const m = stockSheetModel({ ...BASE, noProceeds: noProceedsKnown('fixed_notional', []) });
  assertEquals(m.buy.enabled, false);
  assertEquals(m.buy.reason, 'Every slot is invested. Sell a holding to free one.');
  assertEquals(m.buy.blockedBy, 'full', 'the same pre-review block (warn panel) as a full roster');
  assertEquals(m.controlsShown, true);
  assertEquals(shouldStartReview('buy', true, m.buy.enabled, true), false);
});

Deno.test('fixed-notional with one slot freed by a sale (proceeds): Buy is enabled and the "+" opens the review', () => {
  const sources = [{ trade_id: 't1', symbol: 'JPM', amount: 2012.4 }];
  assertEquals(noProceedsKnown('fixed_notional', sources), false);
  const m = stockSheetModel({ ...BASE, noProceeds: noProceedsKnown('fixed_notional', sources) });
  assertEquals(m.buy.enabled, true);
  assertEquals(m.buy.reason, null);
  assertEquals(shouldStartReview('buy', true, m.buy.enabled, true), true);
});

Deno.test('noProceedsKnown: only a fixed-notional league whose preview was READ and named nothing; unread, unreadable and other modes are never "no proceeds"', () => {
  assertEquals(noProceedsKnown('fixed_notional', null), false, 'unread: never guessed');
  assertEquals(noProceedsKnown('budget_cap', []), false);
  assertEquals(noProceedsKnown('price_tiers', []), false);
  assertEquals(noProceedsKnown(null, []), false);
  assertEquals(noProceedsKnown(undefined, []), false);
});

Deno.test('proceedsSettled: the "+" waits for a fixed-notional preview to settle; every other mode never waits', () => {
  assertEquals(proceedsSettled('fixed_notional', false), false);
  assertEquals(proceedsSettled('fixed_notional', true), true);
  assertEquals(proceedsSettled('budget_cap', false), true);
  assertEquals(proceedsSettled('price_tiers', false), true);
  assertEquals(proceedsSettled(null, false), true);
});

Deno.test('the proceeds gate does not outrank the other reasons: pre-draft, a finished season and an owned stock keep their own lines', () => {
  assertEquals(stockSheetModel({ ...BASE, gate: { open: true, preDraft: true }, noProceeds: true }).buy.reason, 'Trading opens after the draft.');
  assertEquals(stockSheetModel({ ...BASE, gate: { open: false, seasonOver: true }, noProceeds: true }).buy.reason, null);
  assertEquals(stockSheetModel({ ...BASE, owner: { kind: 'other', name: 'Paolo M.', isBot: false }, noProceeds: true }).buy.reason, 'Owned by Paolo M.');
});

Deno.test('wiring: the sheet reads the preview once the facts are ready (fixed-notional only), tells the model, and the "+" waits for it', () => {
  const body = SOURCES['components/money/StockSheetBody.tsx'];
  assertMatch(body, /sheetLeague\.stake_mode !== 'fixed_notional' \|\| data\.status !== 'ready'\) return;/);
  assertMatch(body, /fetchPreview\(previewBody\(sheetLeague\.id\)\)\.then\(\(p\) => \{\s*if \(live\) setProceeds\(\{ sources: p && p\.stakeMode === 'fixed_notional' \? p\.sources : null \}\);/);
  assertMatch(body, /noProceeds: noProceedsKnown\(sheetLeague\?\.stake_mode, proceeds\?\.sources \?\? null\),/);
  assertMatch(body, /ready: data\.status === 'ready' && proceedsSettled\(sheetLeague\?\.stake_mode, proceeds !== null\)/);
});

Deno.test('the seam knob "proceeds" gives the capture a league where a buy is possible, and is off by default', () => {
  assertEquals(parseStocksKnob('proceeds').proceeds, true);
  assertEquals(parseStocksKnob('small,proceeds').proceeds, true);
  assertEquals(parseStocksKnob(null).proceeds, false);
  const rt = SOURCES['lib/money/recordTrade.ts'];
  assertMatch(rt, /const STOCKS_FIXTURE_KNOB = SEAM_ON \? process\.env\.EXPO_PUBLIC_STOCKS_FIXTURE : undefined;/);
});
