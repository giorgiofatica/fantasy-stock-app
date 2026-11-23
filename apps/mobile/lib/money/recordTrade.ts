/**
 * recordTrade: the one place the app calls record-trade (3e). Every result goes
 * through readRecordTradeOutcome, so a 200 refusal, a 503, a 5xx and a dropped
 * network each reach the review as the right state. Nothing here decides a
 * trade: the server does.
 */
import { supabase } from '@/lib/supabase';

import { readRecordTradeOutcome, type RecordTradeOutcome } from './recordTradeOutcome';
import { MONEY_FIXTURE_CONFIG } from './devFixture';
import { fixturePreview, fixtureSubmitOutcome } from './fixtureMode';
import { buildStressMarket } from './stressFixture';
import type { PreviewBody, BuyBody, SellBody } from './tradeBodies';
import { CAPTURE_REFUSAL, MATCHUP_FIXTURE_VARIANT, PORTFOLIO_STAKE_VARIANT, SEAM_ON } from '../game/devSeam';
import { SEAM_LEAGUE, SEAM_ME } from '../game/seamTables';
import { HOME_FIXTURE } from '../home/devFixture';
import { seamOpenSales, seamPortfolioLedger } from './portfolioSeam';
import { parseStocksKnob } from '../stocks/seamStocks';
import { readPreviewAnswer, type PreviewAnswer, type PreviewResult } from './previewAnswer';
import type { SlotShape } from './tierContract';

export type TradeBody = SellBody | BuyBody;

export async function callRecordTrade(body: TradeBody): Promise<RecordTradeOutcome> {
  // DEV fixture: answered here, and the function is NEVER invoked, so the fixture can't write a trade.
  if (MONEY_FIXTURE_CONFIG) {
    const price = buildStressMarket().prices[body.symbol] ?? 211.42;
    return fixtureSubmitOutcome(MONEY_FIXTURE_CONFIG, price);
  }
  // The game capture seam: answered here and NEVER invoked (a capture can't write a trade):
  // success, or the refusal EXPO_PUBLIC_CAPTURE_REFUSAL names (the refusal captures).
  if (SEAM_ON) {
    return CAPTURE_REFUSAL ? { kind: 'refused', reason: CAPTURE_REFUSAL } : { kind: 'ok', trade: { id: 'seam-trade-not-written' } };
  }
  const result = await supabase.functions.invoke('record-trade', { body });
  return readRecordTradeOutcome(result);
}

export type { PreviewResult } from './previewAnswer';

/** DEV capture only (EXPO_PUBLIC_STOCKS_FIXTURE=proceeds, seam on): the fixed-notional preview names ONE open sale, so a buy is possible and the
 * sheet / the "+" reach a clean buy review. Without it the seam league has every slot held and no proceeds. */
const STOCKS_FIXTURE_KNOB = SEAM_ON ? process.env.EXPO_PUBLIC_STOCKS_FIXTURE : undefined;
const SEAM_PROCEEDS = parseStocksKnob(STOCKS_FIXTURE_KNOB).proceeds;

/** The preview, with the one refusal the app words kept apart (previewAnswer.ts): a stock the buy would refuse as
 * not_draftable. The buy sheet's check uses this; every other caller wants fetchPreview. */
export async function fetchPreviewAnswer(body: PreviewBody): Promise<PreviewAnswer | null> {
  // DEV fixture: the preview is answered from the fixture, with no network call.
  if (MONEY_FIXTURE_CONFIG) {
    const jpm = Math.round(2.916472 * 333.25 * 100) / 100;
    return { kind: 'ok', preview: fixturePreview(MONEY_FIXTURE_CONFIG, [{ tradeId: 'fixture-sale-jpm', symbol: 'JPM', amount: jpm }]) };
  }
  // The game capture seam: the seam ledger's open sale (fixed_notional) and, for a budget or tier
  // buy, a Flex slot that fits; no network call.
  if (SEAM_ON) {
    const ledger = seamPortfolioLedger(MATCHUP_FIXTURE_VARIANT, HOME_FIXTURE, SEAM_ME, SEAM_LEAGUE.gianluigi);
    const sales = seamOpenSales(ledger, SEAM_ME);
    const stakeMode = PORTFOLIO_STAKE_VARIANT === 'budget_null' ? 'budget_cap' : PORTFOLIO_STAKE_VARIANT;
    const flex: SlotShape = { slot_id: 'seam-flex', slot_index: 0, slot_count: 1, price_min: null, price_max: null, category_id: null };
    const preview: PreviewResult = {
      stakeMode,
      stake: null,
      unfilledSlots: 0,
      sources: stakeMode === 'fixed_notional'
        ? (SEAM_PROCEEDS ? [{ trade_id: 'seam-sale-proceeds', symbol: 'JPM', amount: 2012.4 }] : sales.map((x, i) => ({ trade_id: `seam-sale-${i}`, symbol: x.symbol, amount: x.amount })))
        : [],
      slots: [],
      ...('price' in body && body.price != null ? { wouldFill: flex, openSlots: [] } : {}),
    };
    return { kind: 'ok', preview };
  }
  return readPreviewAnswer(await supabase.functions.invoke('record-trade', { body }));
}

/** The read-only preview: the sale proceeds that can pay for a buy. Null when it can't be read, or refused. */
export async function fetchPreview(body: PreviewBody): Promise<PreviewResult | null> {
  const answer = await fetchPreviewAnswer(body);
  return answer?.kind === 'ok' ? answer.preview : null;
}
