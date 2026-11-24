// enrich-symbols plan: what one run WOULD write, decided before anything is
// written. Pure (no DB, no network), so every rule here is tested hermetically
// in plan.test.ts; ./run.ts drives a run through these and ./batch.ts supplies
// the real I/O.
//
// docs/plans/2026-11-23-claims-fix-themselves.md, fix 3 ("A stock taken off the
// list by our own stale or broken data") and "Settled during the build" point 1
// (the Planner, 2026-11-24):
//
// 1. A KNOWN VALUE IS NEVER WIPED BY AN INCOMPLETE ANSWER (mergeProfile).
//    Finnhub can answer "ok" with no marketCapitalization (or no industry).
//    That used to write market_cap = NULL, and computeIsDraftable reads a NULL
//    size as under the $250M floor, so the stock left every league's list
//    because the SUPPLIER said nothing. Now a missing field keeps what we knew;
//    only a real new value replaces it. The list is ordered by market_cap
//    (league_available_stocks), so keeping the size keeps the stock's place.
//    The industry is kept the same way (it decides the stock's categories).
//
// 2. A RUN THAT WOULD DROP MANY STOCKS AT ONCE DOES NOT APPLY THEM
//    (decideRun). A drop = a stock on the list before the run that the run
//    would take off. When a run's NEW drops exceed massDropLimit(judged), each
//    of them is HELD: its cursor (enriched_at) moves on and list_drop_held_at
//    is set to now, and NOTHING else is written (size, price, industry,
//    is_draftable stay as they were). The run ends ok:false /
//    mass_drop_refused on the error stream.
//
//    The cursor MUST move on. Batch selection is stalest-first, so a held
//    stock left unwritten would be in every later run, keep every later run
//    over the limit, and grow until it filled the batch and the refresh
//    stopped for every stock (the Planner's catch on the first build).
//
// 3. A HELD STOCK FIXES ITSELF ON ITS SECOND READING. Its turn comes round
//    again by itself (2-4 days). Fresh numbers that pass the floors clear the
//    mark (it was our data). Fresh numbers that still fail drop it and clear
//    the mark, but ONLY IF no stock anywhere was held in the last 24 h AND this
//    run is not itself refusing; otherwise it is held again with a fresh mark.
//    So a fault that lasts for days empties nothing, and marks clear by
//    themselves once it is mended. A marked stock never counts as a NEW drop,
//    so a group coming round together for its second reading is not refused
//    for being a group.
import { computeIsDraftable } from '../_shared/symbol-eligibility.ts';

/** The symbols columns a run reads. `is_draftable` is "on the list" BEFORE the run. */
export interface SymbolRow {
  symbol: string;
  exchange: string | null;
  is_etf: boolean | null;
  active: boolean | null;
  gics_industry: string | null;
  last_price: number | string | null;
  market_cap: number | string | null;
  is_draftable: boolean | null;
  /** When a mass-drop refusal last held this stock; NULL = not held. */
  list_drop_held_at: string | null;
}

/** What Finnhub's profile2 said for one symbol. `skipped` = an ETF, never asked. */
export type ProfileOutcome =
  | { status: 'ok'; industry: string | null; marketCap: number | null }
  | { status: 'empty' }
  | { status: 'skipped' };

/** The columns a normal write sets (enriched_at is stamped at write time). */
export interface SymbolUpdate {
  gics_industry: string | null;
  market_cap: number | null;
  last_price: number | null;
  price_unsupported: boolean;
  is_draftable: boolean;
}

/** What the supplier said, for the run's report only (never a decision input). */
export type ProfileAnswer = 'ok_size' | 'ok_no_size' | 'empty' | 'skipped_etf';

export interface RowPlan {
  symbol: string;
  answer: ProfileAnswer;
  /** On the list before this run (stored is_draftable === true). */
  wasOnList: boolean;
  /** Held by an earlier refusal (list_drop_held_at set): this is its second reading. */
  marked: boolean;
  update: SymbolUpdate;
}

const num = (v: number | string | null): number | null => (v == null ? null : Number(v));

/**
 * Merge a profile answer into what we already know. A field the answer does
 * not carry (null) keeps the known value; only a real value replaces it.
 * 'empty' and 'skipped' change nothing.
 */
export function mergeProfile(
  known: { industry: string | null; marketCap: number | null },
  prof: ProfileOutcome,
): { industry: string | null; marketCap: number | null } {
  if (prof.status !== 'ok') return known;
  return {
    industry: prof.industry ?? known.industry,
    marketCap: prof.marketCap ?? known.marketCap,
  };
}

/** Judge one symbol on fresh numbers. `newPrice` is this run's Alpaca price, if any. */
export function planRow(
  row: SymbolRow,
  prof: ProfileOutcome,
  newPrice: number | undefined,
  priceUnsupported: boolean,
): RowPlan {
  const { industry, marketCap } = mergeProfile(
    { industry: row.gics_industry ?? null, marketCap: num(row.market_cap) },
    prof,
  );
  // A failed or empty price answer keeps the last price (unchanged rule).
  const lastPrice = newPrice ?? num(row.last_price);
  const is_draftable = computeIsDraftable({
    active: row.active,
    exchange: row.exchange ?? null,
    is_etf: row.is_etf ?? null,
    last_price: lastPrice,
    market_cap: marketCap,
  });
  return {
    symbol: String(row.symbol),
    answer: prof.status === 'ok'
      ? (prof.marketCap != null ? 'ok_size' : 'ok_no_size')
      : prof.status === 'empty'
      ? 'empty'
      : 'skipped_etf',
    wasOnList: row.is_draftable === true,
    marked: row.list_drop_held_at != null,
    update: {
      gics_industry: industry,
      market_cap: marketCap,
      last_price: lastPrice,
      price_unsupported: priceUnsupported,
      is_draftable,
    },
  };
}

// "Many stocks at once" (the Planner, 2026-11-24, "Settled during the build"
// point 1): a run refuses when its NEW drops number more than MASS_DROP_MIN, or
// more than MASS_DROP_SHARE of the stocks it JUDGED if that is larger. For a
// full run of 50 that is 3 or more; of 80, 5 or more. MASS_DROP_MIN may never
// go above 4 (5 of 50 is the tenth that must be refused; asserted in tests).
// Prod count of 2026-11-24 (144 runs): on-list stocks within a tenth of a
// floor per run, median 0, p95 1, max 2.
export const MASS_DROP_MIN = 2;
export const MASS_DROP_SHARE = 0.05;

/** How recent another stock's hold must be to stop a second reading from dropping. */
export const MARK_QUIET_MS = 24 * 60 * 60 * 1000;

/** The most NEW drops a run that judged `judged` stocks may apply. */
export function massDropLimit(judged: number): number {
  return Math.max(MASS_DROP_MIN, Math.floor(MASS_DROP_SHARE * judged));
}

/** A normal write: the judged values, and any hold mark cleared. */
export type RowValues = SymbolUpdate & { list_drop_held_at: null };

export interface RunDecision {
  /** Normal writes (applied drops, cleared marks, everything unremarkable). */
  rows: { symbol: string; values: RowValues }[];
  /** Held stocks: cursor moved on + list_drop_held_at = now, nothing else. */
  hold: string[];
  /** Held this run by a refusal of new drops. */
  heldNew: string[];
  /** Second readings held again (a hold in the last 24 h, or this run refusing). */
  heldAgain: string[];
  /** Stocks this run took off the list (new drops within the limit + second readings dropped). */
  dropped: string[];
  /** Second readings whose fresh numbers passed: mark cleared, still on the list. */
  cleared: string[];
  /** New drops this run found (applied or held). */
  newDrops: string[];
  /** New drops were over the limit. */
  refused: boolean;
  limit: number;
  judged: number;
  /** Some stock was held within MARK_QUIET_MS before this run (read before deciding). */
  recentMark: boolean;
}

/**
 * Every stock's verdict for one run, computed before anything is written.
 * `recentMark`: does any stock carry a mark newer than MARK_QUIET_MS? A caller
 * that could not find out must pass true (fail closed: hold, never drop).
 */
export function decideRun(plans: RowPlan[], recentMark: boolean): RunDecision {
  const judged = plans.length;
  const limit = massDropLimit(judged);
  const isNewDrop = (p: RowPlan) => !p.marked && p.wasOnList && !p.update.is_draftable;
  const newDrops = plans.filter(isNewDrop).map((p) => p.symbol);
  const refused = newDrops.length > limit;

  const d: RunDecision = {
    rows: [], hold: [], heldNew: [], heldAgain: [], dropped: [], cleared: [],
    newDrops, refused, limit, judged, recentMark,
  };
  const write = (p: RowPlan) => d.rows.push({ symbol: p.symbol, values: { ...p.update, list_drop_held_at: null } });

  for (const p of plans) {
    if (!p.marked) {
      if (isNewDrop(p)) {
        if (refused) {
          d.hold.push(p.symbol);
          d.heldNew.push(p.symbol);
        } else {
          d.dropped.push(p.symbol);
          write(p);
        }
      } else {
        write(p);
      }
      continue;
    }
    // Second reading.
    if (p.update.is_draftable || !p.wasOnList) {
      if (p.wasOnList) d.cleared.push(p.symbol);
      write(p); // passes the floors (or was not on the list): mark cleared
    } else if (!recentMark && !refused) {
      d.dropped.push(p.symbol);
      write(p); // still fails after a quiet day: news about the stock
    } else {
      d.hold.push(p.symbol);
      d.heldAgain.push(p.symbol);
    }
  }
  return d;
}

const ANSWER_SYMBOLS_LOGGED = 20;

/**
 * What the supplier answered over the stocks a run JUDGED (report only; the
 * Planner, 2026-11-24: to learn which of the stocks missing a size Finnhub
 * ever sizes). Built from the plans, so the four counts always add up to the
 * stocks judged. Symbols and counts only: no supplier payload reaches it.
 */
export function tallyProfiles(plans: RowPlan[]) {
  const of = (a: ProfileAnswer) => plans.filter((p) => p.answer === a).map((p) => p.symbol);
  const okNoSize = of('ok_no_size');
  const empty = of('empty');
  return {
    profile_ok_size: of('ok_size').length,
    profile_ok_no_size: okNoSize.length,
    profile_empty: empty.length,
    profile_skipped_etf: of('skipped_etf').length,
    profile_ok_no_size_symbols: okNoSize.slice(0, ANSWER_SYMBOLS_LOGGED),
    profile_empty_symbols: empty.slice(0, ANSWER_SYMBOLS_LOGGED),
  };
}
