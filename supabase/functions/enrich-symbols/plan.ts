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
// 3. A HELD STOCK FIXES ITSELF ON ITS SECOND READING (rule CORRECTED
//    2026-11-24; the first version's "no hold anywhere in 24 h" let held
//    groups less than a day apart round the queue keep each other held for
//    ever). The mark is the time the stock was FIRST held and is never
//    refreshed. Fresh numbers that pass clear the mark at once, at any age (it
//    was our data). Numbers that still fail drop it only when the mark is at
//    least MARK_MIN_AGE_MS old (never on the same day's numbers; younger: the
//    cursor moves on, the mark stays, no verdict), and not when this run is
//    itself refusing new drops or the daily budget is spent: then it is held
//    again (cursor only, mark kept). A marked stock never counts as a NEW drop.
//
// 4. AT MOST DAILY_DROP_BUDGET STOCKS LEAVE THE LIST IN ANY 24 HOURS, counting
//    every applied drop (new ones under the per-run limit and second
//    readings). The run reads how many drops were applied in the past 24 h
//    (symbols.list_dropped_at = when the stock LAST left the list, never
//    cleared, so a stock that left and came back still counts); past the budget a drop is held
//    (marked if unmarked) and comes round again. Held-before stocks take the
//    remaining allowance first, oldest mark first. A fault that lasts for days
//    can take at most the budget a day, and a stock dropped on bad numbers is
//    back on its next turn with good ones (rejoining is never guarded).
//
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
  /** When a refusal FIRST held this stock; NULL = not held. Never refreshed. */
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
  /** The mark's time in epoch ms (first held), or null. */
  markedAtMs: number | null;
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
    markedAtMs: row.list_drop_held_at != null ? Date.parse(row.list_drop_held_at) : null,
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

/** A second reading counts only when the stock was first held at least this long ago. */
export const MARK_MIN_AGE_MS = 24 * 60 * 60 * 1000;

/** At most this many stocks leave the list in any rolling 24 hours (every kind of drop). */
export const DAILY_DROP_BUDGET = 20;
/** The window the budget counts over. */
export const DROP_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The most NEW drops a run that judged `judged` stocks may apply. */
export function massDropLimit(judged: number): number {
  return Math.max(MASS_DROP_MIN, Math.floor(MASS_DROP_SHARE * judged));
}

/**
 * A normal write: the judged values and the hold mark cleared. list_dropped_at
 * is set only when a drop is applied and is NEVER cleared (the Planner,
 * 2026-11-24): it means "when this stock last left the list", so a stock that
 * left and came back inside the window still counts toward that day's budget.
 */
export type RowValues = SymbolUpdate & { list_drop_held_at: null; list_dropped_at?: string };

export interface RunContext {
  nowMs: number;
  /** Drops applied in the past DROP_WINDOW_MS, read before deciding. */
  dropsInWindow: number;
}

export interface RunDecision {
  /** Normal writes (applied drops, cleared marks, everything unremarkable). */
  rows: { symbol: string; values: RowValues }[];
  /** Newly held (were unmarked): cursor + list_drop_held_at = now. */
  markNew: string[];
  /** Held again or deferred (already marked): cursor only, the mark kept. */
  cursorOnly: string[];
  /** Held by this run's refusal of new drops (new drops + second readings it would have dropped). */
  heldForRefusal: string[];
  /** Held because the daily budget was spent. */
  heldForBudget: string[];
  /** Second readings deferred: mark younger than MARK_MIN_AGE_MS. */
  deferredYoung: string[];
  /** Stocks this run took off the list. */
  dropped: string[];
  /** Second readings whose fresh numbers passed: mark cleared, still on the list. */
  cleared: string[];
  /** New drops this run found (applied or held). */
  newDrops: string[];
  refused: boolean;
  limit: number;
  judged: number;
  dropsInWindow: number;
  /** Budget left when this run began deciding. */
  budgetLeft: number;
}

/** Every stock's verdict for one run, computed before anything is written. */
export function decideRun(plans: RowPlan[], ctx: RunContext): RunDecision {
  const judged = plans.length;
  const limit = massDropLimit(judged);
  const fails = (p: RowPlan) => p.wasOnList && !p.update.is_draftable;
  const newDrops = plans.filter((p) => !p.marked && fails(p));
  const refused = newDrops.length > limit;
  const budgetLeft = Math.max(0, DAILY_DROP_BUDGET - ctx.dropsInWindow);

  const d: RunDecision = {
    rows: [], markNew: [], cursorOnly: [], heldForRefusal: [], heldForBudget: [], deferredYoung: [],
    dropped: [], cleared: [], newDrops: newDrops.map((p) => p.symbol), refused, limit, judged,
    dropsInWindow: ctx.dropsInWindow, budgetLeft,
  };
  const write = (p: RowPlan, droppedAt?: string) => {
    const values: RowValues = { ...p.update, list_drop_held_at: null };
    if (droppedAt !== undefined) values.list_dropped_at = droppedAt;
    d.rows.push({ symbol: p.symbol, values });
  };
  const hold = (p: RowPlan) => (p.marked ? d.cursorOnly : d.markNew).push(p.symbol);
  const at = new Date(ctx.nowMs).toISOString();

  // Second readings that would drop, and new drops: they compete for the budget below.
  const secondDrops: RowPlan[] = [];
  for (const p of plans) {
    if (!p.marked) {
      if (!fails(p)) write(p);
      continue; // new drops handled below
    }
    if (!fails(p)) {
      // Passes the floors (or was not on the list): mark cleared at once, at
      // any age. Only a DROP needs the minimum age (the Planner, 2026-11-24).
      if (p.wasOnList) d.cleared.push(p.symbol);
      write(p);
      continue;
    }
    const young = p.markedAtMs === null || !(ctx.nowMs - p.markedAtMs >= MARK_MIN_AGE_MS);
    if (young) {
      // Still failing, but the same day's numbers: cursor only, mark kept, no verdict.
      d.deferredYoung.push(p.symbol);
      d.cursorOnly.push(p.symbol);
      continue;
    }
    secondDrops.push(p);
  }

  if (refused) {
    for (const p of [...secondDrops, ...newDrops]) {
      d.heldForRefusal.push(p.symbol);
      hold(p);
    }
    return d;
  }

  // The budget: held-before stocks first, oldest mark first; then new drops in batch order.
  secondDrops.sort((a, b) => (a.markedAtMs! - b.markedAtMs!) || a.symbol.localeCompare(b.symbol));
  let left = budgetLeft;
  for (const p of [...secondDrops, ...newDrops]) {
    if (left > 0) {
      left--;
      d.dropped.push(p.symbol);
      write(p, at);
    } else {
      d.heldForBudget.push(p.symbol);
      hold(p);
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
