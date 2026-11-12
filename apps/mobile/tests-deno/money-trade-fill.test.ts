/**
 * The Sold / Bought confirmation shows what the server FILLED, not the reviewed
 * estimate (phone-pass step 34, build 14: "You get $987.41" while the slot held
 * $987.43). Every case here has estimate != fill, so a confirmation that shows
 * the estimate again fails. The dollars come from the trade row's stored
 * total_value, the same number the slot line reads.
 */
import { assert, assertEquals, assertFalse, assertNotEquals } from 'jsr:@std/assert';
import { SOURCES } from './sourceManifest.generated.ts';
import { buyReviewOneShare, buyReviewPerSlot, buyReviewTier, sellReview, settledReview } from '../lib/money/reviewModel.ts';
import { readTradeFill } from '../lib/money/tradeFill.ts';
import { readRecordTradeOutcome } from '../lib/money/recordTradeOutcome.ts';
import { initialReview, reviewReducer } from '../lib/money/reviewMachine.ts';
import { COPY } from '../lib/money/moneyCopy.ts';
import { formatMoney } from '../components/sp/logic/money.ts';
import { formatShares } from '../lib/money/formatShares.ts';

// The server's trades row (to_jsonb of record_trade_atomic's row), as record-trade replies it.
const row = (o: Record<string, unknown>) => ({ id: 't1', league_id: 'L', action: 'sell', ...o });
const valueOf = (r: { lines: { label: string; value: string }[] }, label: string) => r.lines.find((l) => l.label === label)?.value;
const labels = (r: { lines: { label: string }[] }) => r.lines.map((l) => l.label);

/** The real path: the reply -> the outcome reader -> the reducer's done state -> the confirmation's review. */
async function confirmation(review: ReturnType<typeof sellReview>, trade: unknown) {
  const outcome = await readRecordTradeOutcome({ data: { ok: true, trade, price_source: 'last' }, error: null });
  const state = reviewReducer(reviewReducer(initialReview, { type: 'SUBMIT' }), { type: 'OUTCOME', outcome });
  if (state.kind !== 'done') throw new Error(`expected done, got ${state.kind}`);
  return settledReview(review, state.trade);
}

Deno.test('readTradeFill: reads the stored row; anything unusable reads as null, never a guess', () => {
  assertEquals(readTradeFill(row({ quantity: 3, price: 329.15, total_value: 987.45 })), { quantity: 3, price: 329.15, total: 987.45 });
  assertEquals(readTradeFill({ id: 'seam-trade-not-written' }), null);
  assertEquals(readTradeFill(undefined), null);
  assertEquals(readTradeFill(row({ quantity: 3, price: 329.15 })), null); // no total_value: not derived
  assertEquals(readTradeFill(row({ quantity: '3', price: '329.15', total_value: '987.45' })), null);
  assertEquals(readTradeFill(row({ quantity: 3, price: 329.15, total_value: 0 })), null);
});

Deno.test('sell, per slot: Sold shows the FILLED proceeds under the same labels, not the estimate', async () => {
  const estimate = sellReview({ symbol: 'TM', quantity: 3, price: 329.14, slotNotional: 1000 });
  assertEquals(valueOf(estimate, COPY.youGet), formatMoney(987.42));

  const done = await confirmation(estimate, row({ quantity: 3, price: 329.15, total_value: 987.45 }));
  assertEquals(valueOf(done, COPY.youGet), formatMoney(987.45));
  assertEquals(valueOf(done, 'Price'), `${formatMoney(329.15)} · ${COPY.marketPrice}`);
  assertEquals(valueOf(done, "Vs. the slot's $1,000.00"), '−$12.55'); // realized moves with the fill
  assertEquals(done.card, `${formatMoney(987.45)} ${COPY.slotCashStays}`);
  assertNotEquals(valueOf(done, COPY.youGet), valueOf(estimate, COPY.youGet));
  // No new words: the same labels, in the same order.
  assertEquals(labels(done), labels(estimate));
  assertEquals(done.title, estimate.title);
  assertEquals(done.caption, estimate.caption);
});

Deno.test('sell: the slot line and the confirmation match to the cent, because both read total_value', async () => {
  // quantity * price is $971.91..., the stored total_value is $971.92 (the sub-cent residual): the
  // slot line reads total_value, so the confirmation must too, not re-derive it.
  const trade = row({ quantity: 2.916472, price: 333.25, total_value: 971.92 });
  const estimate = sellReview({ symbol: 'JPM', quantity: 2.916472, price: 333.2, slotNotional: 2000 });
  const done = await confirmation(estimate, trade);
  assertEquals(valueOf(done, COPY.youGet), formatMoney(971.92));
  // The slot line's text for the same stored value.
  assertEquals(COPY.oneSaleReady(formatMoney(trade.total_value), 'JPM'), `${valueOf(done, COPY.youGet)} from your JPM sale is ready to invest.`);
});

Deno.test('sell, budget league: back-to-budget and budget-left-after use the fill', async () => {
  const estimate = sellReview({ symbol: 'TSLA', quantity: 1, price: 248.36, budget: { before: 2251.64, after: 2500 } });
  const done = await confirmation(estimate, row({ quantity: 1, price: 248.4, total_value: 248.4 }));
  assertEquals(valueOf(done, COPY.backToBudget), formatMoney(248.4));
  assertEquals(valueOf(done, COPY.budgetLeftAfter), formatMoney(2500.04));
  assertEquals(labels(done), labels(estimate));
});

Deno.test('buy, per slot: Bought shows the fill\'s shares and price; Paid from keeps the funding sale\'s amount', async () => {
  const estimate = buyReviewPerSlot({ symbol: 'NVDA', amount: 987.43, price: 141.2, quantity: 6.993, sourceLabel: 'TM slot', leftInSlot: 0 });
  assertEquals(valueOf(estimate, COPY.paidFrom), `TM slot · ${formatMoney(987.43)}`);

  // The buy's own stored total_value ($987.40) differs from the sale that funded it ($987.43).
  const done = await confirmation(estimate, row({ action: 'buy', quantity: 6.9886, price: 141.29, total_value: 987.4 }));
  assertEquals(valueOf(done, COPY.paidFrom), `TM slot · ${formatMoney(987.43)}`); // the source's amount, never total_value
  assertEquals(valueOf(done, COPY.leftInSlot), formatMoney(0)); // adds up against the sale's amount
  assertEquals(valueOf(done, 'Price'), `${formatMoney(141.29)} · ${COPY.marketPrice}`);
  assertEquals(valueOf(done, 'Buy'), `${formatShares(6.9886)} NVDA`);
  assertNotEquals(valueOf(done, 'Buy'), valueOf(estimate, 'Buy'));
  assertEquals(labels(done), labels(estimate));
});

Deno.test('buy, per slot: the settled quantity is a fact (no "≈"); the unsettled review keeps "≈"', async () => {
  const estimate = buyReviewPerSlot({ symbol: 'NVDA', amount: 987.43, price: 141.2, quantity: 4.21, sourceLabel: 'TM slot', leftInSlot: 0 });
  assertEquals(valueOf(estimate, 'Buy'), `≈ ${formatShares(4.21)} NVDA`);
  const done = await confirmation(estimate, row({ action: 'buy', quantity: 4.2105, price: 141.19, total_value: 594.45 }));
  assertEquals(valueOf(done, 'Buy'), `${formatShares(4.2105)} NVDA`);
  assertFalse(valueOf(done, 'Buy')!.includes('≈'));
  // Settling never touches the estimate.
  assertEquals(valueOf(estimate, 'Buy'), `≈ ${formatShares(4.21)} NVDA`);
});

Deno.test('buy, one share (budget league): price and budget rows use the fill', async () => {
  const estimate = buyReviewOneShare({ symbol: 'SHOP', price: 100, budget: { before: 500, after: 400 }, fills: 'Fills your $100–$200 slot' });
  const done = await confirmation(estimate, row({ action: 'buy', quantity: 1, price: 100.04, total_value: 100.04 }));
  assertEquals(valueOf(done, 'Price'), `${formatMoney(100.04)} · ${COPY.marketPrice}`);
  assertEquals(valueOf(done, COPY.budgetLeftAfter), formatMoney(399.96));
  assertEquals(done.card, 'Fills your $100–$200 slot'); // the server's slot line is untouched
  assertEquals(labels(done), labels(estimate));
});

Deno.test('buy, tier league: the price is the fill', async () => {
  const estimate = buyReviewTier({ symbol: 'SHOP', price: 150.126, fills: 'Fills your $100–$200 slot' });
  assertEquals(valueOf(estimate, 'Price'), `${formatMoney(150.13)} · ${COPY.marketPrice}`);
  const done = await confirmation(estimate, row({ action: 'buy', quantity: 1, price: 150.2, total_value: 150.2 }));
  assertEquals(valueOf(done, 'Price'), `${formatMoney(150.2)} · ${COPY.marketPrice}`);
});

Deno.test('no fill in the reply (a stub, a malformed row): the reviewed estimate stays, nothing is invented', async () => {
  const estimate = sellReview({ symbol: 'TM', quantity: 3, price: 329.14, slotNotional: 1000 });
  assertEquals(await confirmation(estimate, { id: 'seam-trade-not-written' }), estimate);
  assertEquals(await confirmation(estimate, undefined), estimate);
  assertEquals(await confirmation(estimate, row({ quantity: 3, price: 329.15 })), estimate);
  // The estimate itself is never mutated by a settle.
  settledReview(estimate, row({ quantity: 3, price: 329.15, total_value: 987.45 }));
  assertEquals(valueOf(estimate, COPY.youGet), formatMoney(987.42));
});

Deno.test('wiring: the sheet hands the done panel the settled review, from the done state\'s own trade', () => {
  const src = SOURCES['components/money/StockSheetBody.tsx'];
  assert(src !== undefined, 'StockSheetBody is in the source manifest (run tests-deno/gen-source-manifest.mjs)');
  assert(
    src.includes("trade.state.kind === 'done' ? settledReview(open.review, trade.state.trade) : open.review"),
    'the confirmation is settledReview(open.review, trade.state.trade), never the estimate alone',
  );
  assert(src.includes('review={shown}'), 'the panel renders the settled review');
});
