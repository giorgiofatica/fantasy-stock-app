/**
 * Pure symbol-search shaping, shared by TradeModal and the draft screen (no
 * React Native imports — plain TS so it is checkable with both `tsc` and
 * `deno check`/`deno test`; see apps/mobile/tests-deno/symbolSearch.test.ts).
 *
 * Extracted for the mobile launch fixes (docs/STATUS.md §4): the draft screen
 * required an exact ticker and showed no company name or dropdown, while
 * TradeModal already had typeahead + a NOT DRAFTABLE badge. Rather than
 * copy-paste TradeModal's dropdown logic into draft.tsx, both screens now
 * share this module (+ useSymbolSearch.ts + components/SymbolSearchField.tsx).
 */

/** Shape of a `quote` edge-function response — only the fields the fallback
 * chain reads. `quote` (the bid/ask) is listed only so a response carrying one
 * still type-checks: it is never read as a price. */
export interface RawQuoteResponse {
  price?: unknown;
  quote?: { ap?: unknown; bp?: unknown } | null;
  trade?: { p?: unknown } | null;
  bar?: { c?: unknown } | null;
  error?: unknown;
}

/**
 * The fallback chain (price -> trade.p -> bar.c), previously duplicated twice
 * in TradeModal. A lone ask (`quote.ap`) or bid (`quote.bp`) is NEVER a price
 * (2026-11-17): the server never fills at one, so Review buy must not show one.
 * Returns null when nothing in the response is a usable positive price, matching
 * the call sites' "quote is unusable" behaviour (they cleared quote/companyName
 * rather than showing 0 or NaN).
 */
export function parseQuotePrice(data: RawQuoteResponse | null | undefined): number | null {
  const price = Number(
    data?.price ??
      data?.trade?.p ??
      data?.bar?.c,
  );
  return Number.isFinite(price) && price > 0 ? price : null;
}

export interface RawSearchItem {
  symbol: string;
  name: string;
  price?: number | null;
  is_draftable?: boolean;
}

export type SearchResultStatus = 'available' | 'already_owned' | 'not_draftable';

export interface ShapedSearchResult extends RawSearchItem {
  status: SearchResultStatus;
  /** false = shown but disabled/dimmed in the dropdown, not omitted — the
   * user should SEE why a stock isn't pickable, not wonder why it's missing. */
  selectable: boolean;
  badgeLabel: string | null;
}

export interface ShapeSearchResultsOptions {
  /** Symbols already owned/drafted in this league. Compared uppercased. */
  ownedSymbols?: Set<string>;
  /** leagues.allow_undraftable — when true, is_draftable never blocks selection. */
  allowUndraftable?: boolean;
  /** Badge text for an owned/drafted symbol — differs by screen ("ALREADY
   * DRAFTED" on the draft screen vs "ALREADY OWNED" on the trade screen). */
  ownedBadgeLabel?: string;
}

/**
 * Attach a selectability + badge to raw symbols-search results. Pure — no
 * network, no React. `not_draftable` takes priority display-wise only when
 * the symbol isn't already owned (an owned symbol is unpickable for the
 * "duplicate" reason, which is the more useful thing to tell the user).
 */
export function shapeSearchResults(
  items: RawSearchItem[],
  opts: ShapeSearchResultsOptions = {},
): ShapedSearchResult[] {
  const owned = opts.ownedSymbols ?? new Set<string>();
  const allowUndraftable = opts.allowUndraftable ?? false;
  const ownedLabel = opts.ownedBadgeLabel ?? 'ALREADY OWNED';

  return items.map((item) => {
    const sym = item.symbol.toUpperCase();
    if (owned.has(sym)) {
      return { ...item, status: 'already_owned', selectable: false, badgeLabel: ownedLabel };
    }
    if (item.is_draftable === false && !allowUndraftable) {
      return { ...item, status: 'not_draftable', selectable: false, badgeLabel: 'NOT DRAFTABLE' };
    }
    return { ...item, status: 'available', selectable: true, badgeLabel: null };
  });
}

/**
 * The outcome of one search attempt (E-1, 3e UX audit): a thrown error and a
 * clean "no matches" response both end with an empty list on screen, but
 * must be told apart, since a failure read as "no matches" tells the user
 * the stock doesn't exist. `items === null` is useSymbolSearch's signal for
 * "the request itself failed" (its catch block never has an items array to
 * pass) — everything else, including `[]`, is a real answer from the server.
 * Pure so this discriminator is Deno-testable without useSymbolSearch's
 * supabase import.
 */
export type SearchAttemptOutcome =
  | { kind: 'error' }
  | { kind: 'results'; results: ShapedSearchResult[] };

export function shapeSearchOutcome(
  items: RawSearchItem[] | null,
  opts: ShapeSearchResultsOptions = {},
): SearchAttemptOutcome {
  if (items === null) return { kind: 'error' };
  return { kind: 'results', results: shapeSearchResults(items, opts) };
}
