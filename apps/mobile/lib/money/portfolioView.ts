/**
 * portfolioView: every number and line on the Portfolio screen (3e), as pure
 * data. The component renders this and nothing else.
 *
 *  - value is the team value (teamValue, the same formula Home uses): holdings
 *    at live prices, unpriced ones at cost, plus cash.
 *  - "since the draft" is value minus the stake: deliberately NOT Home's "season
 *    gain" (D1, Concept A). The two labels never swap.
 *  - "today" needs EVERY held position to have both a price and a previous
 *    close. One missing quote hides the line; it never shows as $0. Its percent is of the
 *    whole account at the last close (holdings + cash), the value the header shows.
 *  - rows are sorted by value, largest first. A row with no live price shows its
 *    cost and is counted in the caption, never shown as $0.
 */
import { formatGainPair, formatMoney, formatPercent } from '../../components/sp/logic/money';
import { cleanCompanyName } from './cleanCompanyName';
import { formatShares } from './formatShares';
import { COPY } from './moneyCopy';
import { unpricedNote } from '../plCoverage';
import { buyRowLine, type BuyRowInput } from './buyRowLine';

export interface ViewHolding {
  symbol: string;
  quantity: number;
  costBasis: number;
  price: number | null;
  prevClose: number | null;
  name: string | null;
}

export interface PortfolioViewInput {
  /** The preview's slot labels by symbol ('$100–$200 slot'); a stock in no slot has none. */
  slotLabels?: Record<string, string>;
  value: number;
  cash: number;
  stake: number;
  holdings: ViewHolding[];
  numRounds: number;
  /** fixed_notional leagues show the slot language; others don't. */
  perSlotNotional: number | null;
  stakeMode: 'fixed_notional' | 'budget_cap' | 'price_tiers' | null;
  /** The "Buy a stock" row's second line (E-4): per sale/slot, already composed
   * from the preview + ledger reads the hook makes anyway. Omitted entirely by
   * playerPortfolio (another manager's view carries no trade action, so there
   * is no row to caption). */
  buyRow?: BuyRowInput;
  /**
   * A season that is over (Giorgio, 2026-11-18, pick A). `value` is then the value line's last point
   * (the season's last day), each holding's `price` its close on or before that day, and the gain is
   * `value − draftValue` ("since the draft", the line's own Season gain). Today, the slots facts, the
   * cash and the buy row are all gone: nothing about a finished season moves or can be acted on.
   */
  finished?: { draftValue: number };
}

export interface HoldingRow {
  symbol: string;
  name: string;
  /** "$100–$200 slot" for a tier league's stock; null when it isn't in a slot. */
  slotText: string | null;
  quantityText: string;
  valueText: string;
  value: number;
  valueIsCost: boolean;
  todayText: string | null;
  todayTone: 'gain' | 'loss' | 'zero' | null;
}

export interface PortfolioView {
  valueLabel: string;
  valueText: string;
  gainText: string | null;
  /** gainText split into its two rollable parts (C-6, M3): a single combined
   * string rolls badly (RollingMoney's digitDiff right-aligns for a single
   * value; a composite sentence can misalign mid-string when one part's
   * width changes). Null together with gainText. */
  gainMoneyText: string | null;
  gainPctText: string | null;
  /** The gain pair as VoiceOver says it ("+$481.78, +4.01%"; formatGainPair.spoken). Null with gainText. */
  gainSpoken: string | null;
  gainTone: 'gain' | 'loss' | 'zero' | null;
  sinceDraftLabel: string;
  todayText: string | null;
  todayMoneyText: string | null;
  todayPctText: string | null;
  /** Today's pair as VoiceOver says it ("+$121.27, +0.99%"). Null with todayText. */
  todaySpoken: string | null;
  todayTone: 'gain' | 'loss' | 'zero' | null;
  slotsText: string | null;
  perSlotText: string | null;
  cashText: string | null;
  /** cashText's two halves, for the row layout: "Cash from sales" · "$1,234.56". */
  cashValueText: string | null;
  buyRowText: string | null;
  unpricedNote: string | null;
  rows: HoldingRow[];
  creditText: string;
}

const cents = (v: number) => Math.round(v * 100) / 100;
const toneOf = (v: number): 'gain' | 'loss' | 'zero' => (Math.abs(v) < 0.005 ? 'zero' : v > 0 ? 'gain' : 'loss');

export function buildPortfolioView(i: PortfolioViewInput): PortfolioView {
  const finished = i.finished ?? null;
  const valueText = formatMoney(i.value);
  // "· includes cash" whenever the value holds cash, finished or not (Design Lead, 2026-11-18): a finished
  // team has no cash row, so the label is the one thing saying why the hero is more than its rows.
  const valueLabel = Math.abs(i.cash) >= 0.005 ? COPY.portfolioValueIncludesCash : 'Portfolio value';

  let gainText: string | null = null;
  let gainMoneyText: string | null = null;
  let gainPctText: string | null = null;
  let gainSpoken: string | null = null;
  let gainTone: PortfolioView['gainTone'] = null;
  // Since the draft: value − stake live; finished, value − the draft-day value (the line's Season gain).
  const basis = finished ? finished.draftValue : i.stake;
  if (basis > 0) {
    const gain = cents(i.value - basis);
    const pct = (gain / basis) * 100;
    const pair = formatGainPair(gain, pct);
    gainMoneyText = pair.money;
    gainPctText = pair.pct;
    gainText = pair.text;
    gainSpoken = pair.spoken;
    gainTone = toneOf(gain);
  }

  // Today: only when every held position has a price AND a previous close.
  let todayText: string | null = null;
  let todayMoneyText: string | null = null;
  let todayPctText: string | null = null;
  let todaySpoken: string | null = null;
  let todayTone: PortfolioView['todayTone'] = null;
  const held = i.holdings;
  if (!finished && held.length > 0 && held.every((h) => h.price != null && h.prevClose != null && h.prevClose > 0)) {
    const change = held.reduce((a, h) => a + h.quantity * (h.price! - h.prevClose!), 0);
    // The whole account's previous close (W4 DL gate): the holdings at their last close PLUS the
    // cash, so "+$X (+Y%) today" is a percent of the value the header shows (cash earns nothing
    // today but is part of what the percent is of).
    const base = held.reduce((a, h) => a + h.quantity * h.prevClose!, 0) + Math.max(0, i.cash);
    const pct = base > 0 ? (change / base) * 100 : 0;
    const pair = formatGainPair(cents(change), pct);
    todayMoneyText = pair.money;
    todayPctText = pair.pct;
    todayText = pair.text;
    todaySpoken = pair.spoken;
    todayTone = toneOf(change);
  }

  // The slots facts ("6 of 6 slots invested"), the cash and the buy row are live-season only.
  const fixed = !finished && i.stakeMode === 'fixed_notional';
  const showCash = !finished && i.stakeMode !== 'fixed_notional' && Math.abs(i.cash) >= 0.005;
  const rows: HoldingRow[] = held
    .map((h) => {
      const priced = h.price != null;
      const value = priced ? cents(h.quantity * h.price!) : cents(h.costBasis);
      const rowPct = !finished && priced && h.prevClose != null && h.prevClose > 0 ? ((h.price! - h.prevClose) / h.prevClose) * 100 : null;
      return {
        symbol: h.symbol,
        name: cleanCompanyName(h.name) || h.symbol,
        slotText: i.slotLabels?.[h.symbol] ?? null,
        quantityText: formatShares(h.quantity),
        valueText: formatMoney(value),
        value,
        valueIsCost: !priced,
        todayText: rowPct == null ? null : formatPercent(rowPct, { sign: 'always' }),
        todayTone: rowPct == null ? null : toneOf(rowPct),
      };
    })
    .sort((a, b) => b.value - a.value || a.symbol.localeCompare(b.symbol));

  return {
    valueLabel,
    valueText,
    gainText,
    gainMoneyText,
    gainPctText,
    gainSpoken,
    gainTone,
    sinceDraftLabel: COPY.sinceTheDraft,
    todayText,
    todayMoneyText,
    todayPctText,
    todaySpoken,
    todayTone,
    slotsText: fixed ? COPY.slotsInvested(held.length, i.numRounds) : null,
    perSlotText: fixed && i.perSlotNotional != null ? COPY.perSlotAtDraft(formatMoney(i.perSlotNotional)) : null,
    cashText: showCash ? `${COPY.cashFromSales} ${formatMoney(i.cash)}` : null,
    cashValueText: showCash ? formatMoney(i.cash) : null,
    buyRowText: !finished && i.buyRow ? buyRowLine(i.buyRow)?.text ?? null : null,
    unpricedNote: unpricedNote(held.filter((h) => h.price == null).length),
    rows,
    creditText: COPY.alpacaCredit,
  };
}
