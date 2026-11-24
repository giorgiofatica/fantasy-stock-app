// enrich-symbols plan: what one run WOULD write, decided before anything is
// written. Pure (no DB, no network), so every rule here is tested hermetically
// in plan.test.ts. ./batch.ts fetches, calls these, then writes the result.
//
// Two guards, both from docs/plans/2026-11-23-claims-fix-themselves.md, fix 3
// ("A stock taken off the list by our own stale or broken data"):
//
// 1. A KNOWN VALUE IS NEVER WIPED BY AN INCOMPLETE ANSWER (mergeProfile).
//    Finnhub can answer "ok" with no marketCapitalization (or no industry).
//    That used to write market_cap = NULL, and computeIsDraftable reads a NULL
//    size as under the $250M floor, so the stock left every league's list
//    ("The stock isn't in this league's list") because the SUPPLIER said
//    nothing, not because the company changed. Now a missing field keeps what
//    we knew; only a real new value replaces it. The list is ordered by
//    market_cap too (league_available_stocks), so keeping the size also keeps
//    the stock's place.
//
// 2. A RUN THAT WOULD DROP MANY STOCKS AT ONCE DOES NOT APPLY THEM
//    (decideMassDrop). One stock leaving the list is news about the stock;
//    many leaving together is news about our data. When the drops exceed
//    massDropLimit(batch), every dropping stock is HELD: it gets no write at
//    all (not even enriched_at, so it is the stalest again and the next run,
//    10 minutes later, re-reads it). The rest of the run applies normally, and
//    the run's outcome line is ok:false / mass_drop_refused, which
//    _shared/respond-fast.ts writes to the ERROR stream (CLAUDE.md "success
//    signals" — a refusal must not read as a clean run).
//
//    The held set is the WHOLE dropping set, not "the drops over the limit":
//    picking which N drops are real would be guessing, and a partly-applied
//    mass drop is exactly the partial state the CLAUDE.md all-or-nothing
//    lessons warn about.
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
}

/** What Finnhub's profile2 said for one symbol. `skipped` = an ETF, never asked. */
export type ProfileOutcome =
  | { status: 'ok'; industry: string | null; marketCap: number | null }
  | { status: 'empty' }
  | { status: 'skipped' };

/** The columns a run writes for one symbol (enriched_at is stamped at write time). */
export interface SymbolUpdate {
  gics_industry: string | null;
  market_cap: number | null;
  last_price: number | null;
  price_unsupported: boolean;
  is_draftable: boolean;
}

export interface RowPlan {
  symbol: string;
  /** On the list before this run (stored is_draftable === true). */
  wasOnList: boolean;
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

/** Plan one symbol's write. `newPrice` is this run's Alpaca price, if any. */
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
    wasOnList: row.is_draftable === true,
    update: {
      gics_industry: industry,
      market_cap: marketCap,
      last_price: lastPrice,
      price_unsupported: priceUnsupported,
      is_draftable,
    },
  };
}

// "Many stocks at once" — PENDING the Planner's agreement (plan open question 2).
// Proposed 2026-11-24 from the shape of a run: refuse when the drops exceed
// max(MASS_DROP_MIN, floor(MASS_DROP_SHARE * stocks selected)). For the normal
// run of 50 that refuses 3 or more drops; a tenth (5 of 50) is always refused.
export const MASS_DROP_MIN = 2;
export const MASS_DROP_SHARE = 0.05;

/** The most drops one run may apply, for a run that selected `batchSize` stocks. */
export function massDropLimit(batchSize: number): number {
  return Math.max(MASS_DROP_MIN, Math.floor(MASS_DROP_SHARE * batchSize));
}

export interface MassDropDecision {
  /** Rows to write. */
  apply: RowPlan[];
  /** Rows not written at all this run (the dropping ones, on a refusal). */
  held: RowPlan[];
  refused: boolean;
  /** Stocks this run would take off the list (on before, off after). */
  drops: string[];
  limit: number;
}

/**
 * Decide whether this run's drops may apply. `batchSize` is the number of
 * stocks the run SELECTED (not the number it got through before a transient
 * abort), so the limit is the same however far the run got.
 */
export function decideMassDrop(plans: RowPlan[], batchSize: number): MassDropDecision {
  const limit = massDropLimit(batchSize);
  const dropping = plans.filter((p) => p.wasOnList && !p.update.is_draftable);
  const drops = dropping.map((p) => p.symbol);
  if (dropping.length <= limit) return { apply: plans, held: [], refused: false, drops, limit };
  const heldSet = new Set(drops);
  return {
    apply: plans.filter((p) => !heldSet.has(p.symbol)),
    held: dropping,
    refused: true,
    drops,
    limit,
  };
}

const DROP_SYMBOLS_LOGGED = 20;

/**
 * The run outcome's verdict fields. A refusal is `ok:false` with
 * `error:'mass_drop_refused'` — a FAILED run, never a clean one with a count
 * tucked inside it (CLAUDE.md "success signals" #4/#7). list_drop_symbols names
 * the dropping stocks either way (capped), so a person can look at them.
 */
export function verdictFields(v: MassDropDecision): {
  ok: boolean;
  error?: 'mass_drop_refused';
  list_drops: number;
  list_drops_held: number;
  list_drop_limit: number;
  list_drop_symbols: string[];
} {
  return {
    ...(v.refused ? { ok: false, error: 'mass_drop_refused' as const } : { ok: true }),
    list_drops: v.refused ? 0 : v.drops.length,
    list_drops_held: v.held.length,
    list_drop_limit: v.limit,
    list_drop_symbols: v.drops.slice(0, DROP_SYMBOLS_LOGGED),
  };
}
