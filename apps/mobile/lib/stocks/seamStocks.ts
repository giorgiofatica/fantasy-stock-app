/**
 * seamStocks: the capture seam's answers for the Stocks tab (DEV captures only; SEAM_ON, a dev build with
 * EXPO_PUBLIC_GAME_SEAM=1). Pure: the knob is passed in, nothing reads the environment here, so tests-deno
 * can drive it. A release build never reaches this (seamCalls gates on SEAM_ON).
 *
 * EXPO_PUBLIC_STOCKS_FIXTURE:
 *   (unset)      the list answers, 25 a page over a 60-stock catalogue
 *   loading      the read never answers (the first-page skeleton, E6)
 *   fail         every read fails (the first-page failure, E7)
 *   page2_fail   the SECOND page of a list fails once, then answers (the foot's "Try again", E7)
 *   page2_loading the SECOND page never answers (the foot's one skeleton row, E6)
 *   empty        every category answers no stocks (E8)
 *   noprice      the live quote answers no prices (a row's "–")
 * Combine with a comma ("page2_fail,noprice").
 */
import type { ChipCategory } from './stocksList';

export const SEAM_STOCK_CATEGORIES: readonly ChipCategory[] = [
  { id: 'cat-tech', name: 'Technology', is_misc: false },
  { id: 'cat-finance', name: 'Financials', is_misc: false },
  { id: 'cat-health', name: 'Healthcare', is_misc: false },
  { id: 'cat-energy', name: 'Energy & Utilities', is_misc: false },
  { id: 'cat-retail', name: 'Retail & Consumer Goods', is_misc: false },
  { id: 'cat-misc', name: 'Misc', is_misc: true },
];

// [symbol, name, category id, example price]: largest company first, the order the server answers in.
const CATALOGUE: readonly [string, string, string, number][] = [
  ['MSFT', 'Microsoft', 'cat-tech', 512.3], ['GOOGL', 'Alphabet', 'cat-tech', 268.41], ['AVGO', 'Broadcom', 'cat-tech', 341.07],
  ['BRK.B', 'Berkshire Hathaway', 'cat-finance', 487.92], ['JPM', 'JPMorgan Chase', 'cat-finance', 301.55], ['LLY', 'Eli Lilly', 'cat-health', 812.6],
  ['WMT', 'Walmart', 'cat-retail', 102.18], ['XOM', 'Exxon Mobil', 'cat-energy', 114.73], ['V', 'Visa', 'cat-finance', 291.4],
  ['ORCL', 'Oracle', 'cat-tech', 234.12], ['COST', 'Costco', 'cat-retail', 948.5], ['JNJ', 'Johnson & Johnson', 'cat-health', 176.2],
  ['HD', 'Home Depot', 'cat-retail', 389.9], ['BAC', 'Bank of America', 'cat-finance', 46.35], ['CVX', 'Chevron', 'cat-energy', 158.04],
  ['ABBV', 'AbbVie', 'cat-health', 192.8], ['KO', 'Coca-Cola', 'cat-retail', 71.15], ['CRM', 'Salesforce', 'cat-tech', 274.1],
  ['MRK', 'Merck', 'cat-health', 98.6], ['PEP', 'PepsiCo', 'cat-retail', 148.3], ['AMD', 'Advanced Micro Devices', 'cat-tech', 160.0],
  ['WFC', 'Wells Fargo', 'cat-finance', 78.9], ['NEE', 'NextEra Energy', 'cat-energy', 82.4], ['TMO', 'Thermo Fisher Scientific', 'cat-health', 540.2],
  ['ADBE', 'Adobe', 'cat-tech', 385.5], ['MCD', "McDonald's", 'cat-retail', 305.6], ['GS', 'Goldman Sachs', 'cat-finance', 612.7],
  ['COP', 'ConocoPhillips', 'cat-energy', 98.1], ['ABT', 'Abbott Laboratories', 'cat-health', 131.45], ['NKE', 'Nike', 'cat-retail', 74.2],
  ['QCOM', 'Qualcomm', 'cat-tech', 171.3], ['MS', 'Morgan Stanley', 'cat-finance', 142.8], ['DUK', 'Duke Energy', 'cat-energy', 118.9],
  ['PFE', 'Pfizer', 'cat-health', 26.8], ['SBUX', 'Starbucks', 'cat-retail', 94.6], ['TXN', 'Texas Instruments', 'cat-tech', 188.0],
  ['SCHW', 'Charles Schwab', 'cat-finance', 91.2], ['SO', 'Southern Company', 'cat-energy', 90.5], ['AMGN', 'Amgen', 'cat-health', 282.4],
  ['TGT', 'Target', 'cat-retail', 129.3], ['INTC', 'Intel', 'cat-tech', 24.9], ['BLK', 'BlackRock', 'cat-finance', 1020.4],
  ['EOG', 'EOG Resources', 'cat-energy', 121.6], ['GILD', 'Gilead Sciences', 'cat-health', 104.7], ['LOW', "Lowe's", 'cat-retail', 245.1],
  ['SNOW', 'Snowflake', 'cat-tech', 187.2], ['AXP', 'American Express', 'cat-finance', 318.6], ['WMB', 'Williams Companies', 'cat-energy', 61.5],
  ['VRTX', 'Vertex Pharmaceuticals', 'cat-health', 463.0], ['TJX', 'TJX Companies', 'cat-retail', 128.4], ['NOW', 'ServiceNow', 'cat-tech', 902.3],
  ['C', 'Citigroup', 'cat-finance', 82.1], ['KMI', 'Kinder Morgan', 'cat-energy', 27.6], ['REGN', 'Regeneron', 'cat-health', 590.8],
  ['EL', 'Estée Lauder', 'cat-retail', 61.9], ['PANW', 'Palo Alto Networks', 'cat-tech', 196.5], ['USB', 'U.S. Bancorp', 'cat-finance', 49.7],
  ['OXY', 'Occidental Petroleum', 'cat-energy', 44.2], ['ZTS', 'Zoetis', 'cat-health', 168.3], ['ROST', 'Ross Stores', 'cat-retail', 148.5],
];

export const SEAM_STOCK_COUNT = CATALOGUE.length;

/** The example prices by ticker: the capture's `quote` answers these (a stock off this list answers none). */
export function seamStockPrices(): Record<string, number> {
  return Object.fromEntries(CATALOGUE.map(([s, , , p]) => [s, p]));
}

export interface StocksKnob {
  loading: boolean;
  fail: boolean;
  page2Fail: boolean;
  page2Loading: boolean;
  empty: boolean;
  noPrice: boolean;
}

/** Pure: the knob's flags (a comma-separated list; unknown words are ignored). */
export function parseStocksKnob(raw: string | null | undefined): StocksKnob {
  const set = new Set((raw ?? '').split(',').map((s) => s.trim().toLowerCase()));
  return { loading: set.has('loading'), fail: set.has('fail'), page2Fail: set.has('page2_fail'), page2Loading: set.has('page2_loading'), empty: set.has('empty'), noPrice: set.has('noprice') };
}

type ReadResult = { data: unknown; error: { message: string; code?: string } | null };

/** How many second-page reads have failed once already (page2_fail fails the first one only). */
let page2Failed = false;

/**
 * The server's answer to one page: the catalogue, filtered by category, after the cursor, 25 a page with has_more on
 * every row (the real function's shape). `null` = never answers (the caller returns a promise that never settles).
 */
export function seamStocksRead(args: Record<string, unknown>, knob: StocksKnob): ReadResult | null {
  if (knob.loading) return null;
  if (knob.fail) return { data: null, error: { message: 'fixture: the stocks read failed', code: 'FIXTURE' } };
  const after = typeof args.p_after_symbol === 'string' && args.p_after_symbol ? args.p_after_symbol.toUpperCase() : null;
  if (knob.page2Loading && after) return null;
  if (knob.page2Fail && after && !page2Failed) {
    page2Failed = true;
    return { data: null, error: { message: 'fixture: this page failed once', code: 'FIXTURE' } };
  }
  if (knob.empty) return { data: [], error: null };
  const category = typeof args.p_category_id === 'string' ? args.p_category_id : null;
  const all = CATALOGUE.filter(([, , c]) => category == null || c === category);
  const start = after ? all.findIndex(([s]) => s === after) + 1 : 0;
  const slice = all.slice(start, start + 26);
  const rows = slice.slice(0, 25);
  const hasMore = slice.length > 25;
  return {
    data: rows.map(([symbol, name, cat]) => ({ symbol, name, category_ids: [cat], has_more: hasMore })),
    error: null,
  };
}

/** Test hook: forget that page2_fail has fired. */
export function resetSeamStocks(): void {
  page2Failed = false;
}
