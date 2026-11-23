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
 *   proceeds     the fixed-notional preview names one open sale, so a buy is possible (a CLEAN "+" -> buy review; recordTrade.ts)
 *   small        pages of 6 rows, so a page's foot is on screen (the foot states, E6/E7, without a scroll)
 * The watchlist (plan part 3; the in-memory saved set starts with WATCH_SEED, and a star changes it as the server would):
 *   watchempty   nothing saved ("Star a stock to watch it here.")
 *   watchfail    the watchlist read fails (Watching's load failure; every star reads empty)
 *   watchloading the watchlist read never answers (Watching's skeleton)
 *   savefull     every save answers watchlist_full (the 51st: the star reverts, the sheet's panel says why)
 *   saverate     every save answers rate_limited (the star reverts; no words)
 *   savefail     every save fails with a transport-shaped error (the star reverts; no words)
 *   savehang     a save never answers (the optimistic star, held, for a still)
 *   nolist       the slot lines' list preview fails (the rows keep the interim lines)
 * Top movers (plan part 3, workstream 5; the ranking is the catalogue's own largest-move order, 3 minutes old):
 *   moversfail   the movers read fails (the existing "Stocks didn't load")
 *   moversrate   the movers read answers PT429 (paced: the same state)
 *   moversempty  the movers read answers no rows (the same state)
 *   moversold    the ranking is 45 minutes old (open: the same state; closed: shown)
 *   moversloading the movers read never answers (the skeleton)
 *   marketclosed the market reads closed, the last session's day is "Fri" (the rows say "+11.2% Fri")
 * Combine with a comma ("page2_fail,noprice").
 */
import type { ChipCategory } from './stocksList';

export const SEAM_STOCK_CATEGORIES: readonly ChipCategory[] = [
  { id: 'cat-tech', name: 'Technology', is_misc: false },
  { id: 'cat-finance', name: 'Financials', is_misc: false },
  { id: 'cat-health', name: 'Healthcare', is_misc: false },
  { id: 'cat-energy', name: 'Energy & Utilities', is_misc: false },
  { id: 'cat-retail', name: 'Retail & Consumer Goods', is_misc: false },
  { id: 'cat-realestate', name: 'Real Estate & Construction', is_misc: false },
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
  ['PLD', 'Prologis', 'cat-realestate', 118.4], ['AMT', 'American Tower', 'cat-realestate', 214.9], ['EQIX', 'Equinix', 'cat-realestate', 842.1],
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
  small: boolean;
  proceeds: boolean;
  watchEmpty: boolean;
  watchFail: boolean;
  watchLoading: boolean;
  saveFull: boolean;
  saveRate: boolean;
  saveFail: boolean;
  saveHang: boolean;
  noList: boolean;
  moversFail: boolean;
  moversRate: boolean;
  moversEmpty: boolean;
  moversOld: boolean;
  moversLoading: boolean;
  marketClosed: boolean;
}

/** Pure: the knob's flags (a comma-separated list; unknown words are ignored). */
export function parseStocksKnob(raw: string | null | undefined): StocksKnob {
  const set = new Set((raw ?? '').split(',').map((s) => s.trim().toLowerCase()));
  return { loading: set.has('loading'), fail: set.has('fail'), page2Fail: set.has('page2_fail'), page2Loading: set.has('page2_loading'), empty: set.has('empty'), noPrice: set.has('noprice'), small: set.has('small'), proceeds: set.has('proceeds'),
    watchEmpty: set.has('watchempty'), watchFail: set.has('watchfail'), watchLoading: set.has('watchloading'),
    saveFull: set.has('savefull'), saveRate: set.has('saverate'), saveFail: set.has('savefail'), saveHang: set.has('savehang'), noList: set.has('nolist'),
    moversFail: set.has('moversfail'), moversRate: set.has('moversrate'), moversEmpty: set.has('moversempty'), moversOld: set.has('moversold'), moversLoading: set.has('moversloading'), marketClosed: set.has('marketclosed'),
  };
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
  const size = knob.small ? 6 : 25;
  const slice = all.slice(start, start + size + 1);
  const rows = slice.slice(0, size);
  const hasMore = slice.length > size;
  return {
    data: rows.map(([symbol, name, cat]) => ({ symbol, name, category_ids: [cat], has_more: hasMore })),
    error: null,
  };
}

/** Test hook: forget that page2_fail has fired. */
export function resetSeamStocks(): void {
  page2Failed = false;
}

// ── The watchlist (plan part 3) ─────────────────────────────────────────────────────────────────

/** The saved stocks a capture starts with: [symbol, name, category id, is_draftable]. The catalogue's AVGO is starred on Available; SQ is a delisted name ("Not in this league's list"). */
const WATCH_SEED: readonly [string, string, string, boolean][] = [
  ['AVGO', 'Broadcom', 'cat-tech', true],
  ['AMGN', 'Amgen', 'cat-health', true],
  ['COST', 'Costco', 'cat-retail', true],
  ['LOW', "Lowe's", 'cat-retail', true],
  ['SQ', 'Block', 'cat-finance', false],
];

let watchSaved: string[] | null = null;
const watchNames = new Map<string, [string, string, boolean]>(WATCH_SEED.map(([s, n, c, d]) => [s, [n, c, d]]));

function savedSet(knob: StocksKnob): string[] {
  if (watchSaved === null) watchSaved = knob.watchEmpty ? [] : WATCH_SEED.map(([s]) => s);
  return watchSaved;
}

/** The watchlist read: the saved set, newest save first (the reader's order); `null` = never answers. */
export function seamWatchlistRead(knob: StocksKnob): ReadResult | null {
  if (knob.watchLoading) return null;
  if (knob.watchFail) return { data: null, error: { message: 'fixture: the watchlist read failed', code: 'FIXTURE' } };
  const saved = savedSet(knob);
  const now = Date.parse('2026-11-23T18:00:00Z');
  const rows = saved.map((symbol, i) => {
    const cat = CATALOGUE.find(([s]) => s === symbol);
    const seeded = watchNames.get(symbol);
    return {
      symbol,
      name: cat ? cat[1] : (seeded?.[0] ?? symbol),
      category_ids: [cat ? cat[2] : (seeded?.[1] ?? 'cat-misc')],
      is_draftable: seeded ? seeded[2] : true,
      saved_at: new Date(now - i * 60_000).toISOString(),
    };
  });
  return { data: rows, error: null };
}

/** The write: the knob's refusal, else the saved set changes as the server's would (and answers ok with the count). `null` = never answers. */
export function seamWatchlistWrite(args: Record<string, unknown>, knob: StocksKnob): ReadResult | null {
  if (knob.saveHang) return null;
  if (knob.saveFail) return { data: null, error: { message: 'fixture: the save failed', code: 'FIXTURE' } };
  if (knob.saveFull) return { data: { ok: false, reason: 'watchlist_full', max: 50 }, error: null };
  if (knob.saveRate) return { data: { ok: false, reason: 'rate_limited' }, error: null };
  const symbol = String(args.p_symbol ?? '').toUpperCase();
  const saved = savedSet(knob);
  const next = args.p_saved === true ? (saved.includes(symbol) ? saved : [symbol, ...saved]) : saved.filter((x) => x !== symbol);
  watchSaved = next;
  return { data: { ok: true, saved: args.p_saved === true, count: next.length }, error: null };
}

/** Test hook: forget the in-memory saved set. */
export function resetSeamWatchlist(): void {
  watchSaved = null;
}

/** The movers the capture ranks: the board's six, biggest move first (up or down), then the catalogue's names. */
const MOVERS_ORDER: readonly string[] = ['AMD', 'INTC', 'SNOW', 'PANW', 'NOW', 'ADBE', 'NKE', 'PFE'];
/** Their changes in percent, biggest move first, up or down (the board's figures). */
const MOVER_CHANGES: readonly number[] = [11.2, -9.8, 8.4, -7.1, 6.6, -6.2, 5.4, -4.9];

/**
 * The single-symbol lookup (`ticker-quotes`) the Watching rows read: price and previous close. The change is a deterministic
 * per-symbol figure between -2.4% and +2.4% (so captures are repeatable); SQ answers an error ("–", no change line); `noprice` answers none.
 */
export function seamTickerQuote(symbol: string, knob: StocksKnob): ReadResult {
  const s = symbol.toUpperCase();
  if (knob.noPrice || s === 'SQ') return { data: null, error: { message: 'fixture: no quote', code: 'FIXTURE' } };
  const price = seamStockPrices()[s];
  if (price === undefined) return { data: null, error: { message: 'fixture: unknown symbol', code: 'FIXTURE' } };
  let h = 7;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 997;
  // A ranked mover has a mover's change (the board's: +11.2%, -9.8%, ...); every other stock a small one.
  const moverAt = MOVERS_ORDER.indexOf(s);
  const pct = moverAt >= 0 ? MOVER_CHANGES[moverAt] : ((h % 49) - 24) / 10;
  return { data: { symbol: s, price, prevClose: Math.round((price / (1 + pct / 100)) * 100) / 100 }, error: null };
}

/**
 * record-trade's LIST preview (PR #600) as the capture seam answers it: a tier league with three price slots ($100-$200, $200-$400, $400 or more),
 * the third FULL. A priced row under $400 fits its slot; one at $400 or more gets would_fill null (no room); a symbol that is not asked with a
 * usable price is null. `nolist` makes the call fail (the rows keep the interim lines).
 */
export function seamListPreview(body: Record<string, unknown>, knob: StocksKnob): ReadResult {
  if (knob.noList) return { data: null, error: { message: 'fixture: the list preview failed', code: 'FIXTURE' } };
  const slot = (i: number, min: number | null, max: number | null) => ({ slot_id: `seam-slot-${i}`, slot_index: i, slot_count: 3, price_min: min, price_max: max, category_id: null });
  const low = slot(0, 100, 200);
  const mid = slot(1, 200, 400);
  const high = slot(2, 400, null);
  const rows = Array.isArray(body.rows) ? (body.rows as { symbol?: unknown; price?: unknown }[]) : [];
  return {
    data: {
      ok: true,
      stake_mode: 'price_tiers',
      sources: [],
      slots: [{ ...low, held: [], open: 1 }, { ...mid, held: [], open: 1 }, { ...high, held: ['NVDA'], open: 0 }],
      unplaced: [],
      rows: rows.map((r) => {
        const symbol = typeof r.symbol === 'string' ? r.symbol : '';
        const price = typeof r.price === 'number' ? r.price : NaN;
        if (!symbol || !Number.isFinite(price) || price <= 0) return null;
        if (price >= 400) return { symbol, price, would_fill: null, open_slots: [low, mid] };
        return { symbol, price, would_fill: price < 200 ? low : mid };
      }),
    },
    error: null,
  };
}

// ── Top movers (plan part 3, workstream 5) ──────────────────────────────────────────────────────

/** The last close the `marketclosed` capture reads (a Friday): the closed rows say "Fri". */
export const SEAM_LAST_CLOSE_ISO = '2026-11-20T21:00:00.000Z';

/**
 * `get_league_top_movers` as the capture seam answers it: the ranking in the server's order, each row `place, symbol, name, category_ids,
 * ranked_at`, and NO price or change. `moversold` dates the ranking 45 minutes back, `marketclosed` dates it at the last close.
 * `null` = never answers.
 */
export function seamTopMoversRead(knob: StocksKnob, nowMs: number): ReadResult | null {
  if (knob.moversLoading) return null;
  if (knob.moversFail) return { data: null, error: { message: 'fixture: the movers read failed', code: 'FIXTURE' } };
  if (knob.moversRate) return { data: null, error: { message: 'get_league_top_movers: rate limited', code: 'PT429' } };
  if (knob.moversEmpty) return { data: [], error: null };
  const rankedAt = new Date(knob.marketClosed ? Date.parse(SEAM_LAST_CLOSE_ISO) : nowMs - (knob.moversOld ? 45 : 3) * 60_000).toISOString();
  const rows = MOVERS_ORDER.flatMap((symbol, i) => {
    const c = CATALOGUE.find(([s]) => s === symbol);
    return c ? [{ place: i + 1, symbol, name: c[1], category_ids: [c[2]], ranked_at: rankedAt }] : [];
  });
  return { data: rows, error: null };
}
