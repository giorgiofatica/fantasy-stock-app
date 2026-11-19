/**
 * stocksList: the Stocks tab's list, as pure rules (docs/plans/2026-11-18-stocks-tab.md, part 2; board
 * `design/stocks-list-1118`, A + C). No React Native, no network: tests-deno pins every rule.
 *
 * WHAT THE LIST IS. Pages of `get_league_available_stocks` (20261207000100): the league's draftable stocks
 * that nobody in the league holds, largest company first, 25 a page, keyset-paged by the LAST ticker of the
 * previous page, until the server's `has_more` is false. The read returns NO price (Giorgio, 2026-11-18: "we
 * can't be showing a stock price that is a day old"); a row's price comes from the live quote lookup, for
 * the rows on screen only, and reads "–" until it arrives (never a stored price, never $0.00).
 *
 * THE PAGING STATE. One request in flight at a time, named by an id so a late answer for a category the
 * manager has already left is dropped. A failed FIRST page has no rows to keep (the full LoadFailure); a
 * failed LATER page keeps every loaded row and retries only that page (E7). A paced refusal (PT429) is a
 * load failure in the same words (no new copy).
 */
import { priceLabel, type QueuePrice } from '../game/queueRow';

/** The server's own page cap (v_limit in 20261207000100): asking for more returns 25. */
export const PAGE_SIZE = 25;

/** The row's small text never outgrows 1.3× (the Holdings-row rule, ROW_TEXT_MAX_SCALE). */
export const ROW_TEXT_MAX_SCALE = 1.3;
/** At this font scale or larger the price leaves the right edge and sits under the name (E9, the board's AX5 row). */
export const PRICE_UNDER_NAME_SCALE = 1.35;
/** The chips' labels cap at 1.3× and the row scrolls sideways (E9). */
export const CHIP_TEXT_MAX_SCALE = 1.3;
/** How close (pt) the list's foot may come to the viewport's bottom before the next page is asked for. */
export const NEAR_END_PT = 480;

/** One stock in the list: what the server returns, minus `has_more` (a page fact, not a row fact). */
export interface ListRow {
  symbol: string;
  name: string;
  /** Our categories, in display order; empty = unclassified (the client's Misc). */
  categoryIds: string[];
}

export interface ListPage {
  rows: ListRow[];
  hasMore: boolean;
}

/**
 * One page out of the read's `data`. `has_more` rides on every row (the server computes it once per call),
 * so the first row's is the page's; an empty page has no more after it. A row without a usable ticker is
 * left out, never guessed. Anything that is not an array is NOT a page (null): the caller treats it as a
 * failed read, never as "no stocks".
 */
export function parsePage(data: unknown): ListPage | null {
  if (!Array.isArray(data)) return null;
  const rows: ListRow[] = [];
  let hasMore = false;
  for (const raw of data) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as { symbol?: unknown; name?: unknown; category_ids?: unknown; has_more?: unknown };
    if (r.has_more === true) hasMore = true;
    if (typeof r.symbol !== 'string' || r.symbol.trim() === '') continue;
    rows.push({
      symbol: r.symbol.trim().toUpperCase(),
      name: typeof r.name === 'string' ? r.name.trim() : '',
      categoryIds: Array.isArray(r.category_ids) ? r.category_ids.filter((c): c is string => typeof c === 'string') : [],
    });
  }
  return { rows, hasMore: rows.length > 0 && hasMore };
}

/** The read's arguments. `after` is the previous page's last ticker (null: the first page). */
export function pageArgs(leagueId: string, categoryId: string | null, after: string | null): {
  p_league_id: string;
  p_category_id: string | null;
  p_after_symbol: string | null;
  p_limit: number;
} {
  return { p_league_id: leagueId, p_category_id: categoryId, p_after_symbol: after, p_limit: PAGE_SIZE };
}

// ── The paging state ─────────────────────────────────────────────────────────────────────────────

/**
 * A request: which page (`after`), and whether its rows REPLACE the list (the first page, a refresh). It carries the league and the
 * category it was made for, so the work in flight is tied to ITS league: a request is never re-issued against another league (a
 * switch mid-load would otherwise send the old cursor to the new league and burn the member's paced reads).
 */
export interface PageRequest {
  id: number;
  after: string | null;
  replace: boolean;
  leagueId: string | null;
  categoryId: string | null;
}

export interface ListState {
  /** The league this list is for; every request is made for it. */
  leagueId: string | null;
  categoryId: string | null;
  rows: ListRow[];
  /** The last ticker the server sent (the next page's `after`); null before any page. */
  cursor: string | null;
  hasMore: boolean;
  status: 'loading' | 'ready' | 'failed';
  /** The request in flight (status 'loading'), else null. */
  pending: PageRequest | null;
  /** The request that failed (status 'failed'): Try again asks for exactly it again. */
  failed: PageRequest | null;
  /** The last id handed out (ids only grow). */
  seq: number;
}

export type ListAction =
  /** A new list from its first page: a chip (`categoryId`), or another league (`leagueId`, which also resets the category). */
  | { type: 'start'; categoryId: string | null; leagueId?: string | null }
  | { type: 'refresh' }
  | { type: 'more' }
  | { type: 'retry' }
  | { type: 'loaded'; id: number; page: ListPage }
  | { type: 'failed'; id: number };

/** The list before anything is asked: the first page of "All". */
export function initialListState(categoryId: string | null = null, leagueId: string | null = null): ListState {
  return {
    leagueId, categoryId, rows: [], cursor: null, hasMore: true, status: 'loading',
    pending: { id: 1, after: null, replace: true, leagueId, categoryId }, failed: null, seq: 1,
  };
}

function ask(state: ListState, after: string | null, replace: boolean): ListState {
  const id = state.seq + 1;
  return { ...state, status: 'loading', pending: { id, after, replace, leagueId: state.leagueId, categoryId: state.categoryId }, failed: null, seq: id };
}

/** What the fetch effect re-runs on: the in-flight request's id and nothing else (never the league prop, never a cursor). */
export function fetchKey(state: ListState): number | null {
  return state.pending?.id ?? null;
}

/** The read the in-flight request stands for: ITS league, category and cursor. Null when nothing is in flight or it has no league yet. */
export function pendingRead(state: ListState): { id: number; leagueId: string; categoryId: string | null; after: string | null } | null {
  const p = state.pending;
  if (!p || !p.leagueId) return null;
  return { id: p.id, leagueId: p.leagueId, categoryId: p.categoryId, after: p.after };
}

/** Appends `incoming` to `rows`, dropping a ticker already there (the order can shift between pages). */
export function mergeRows(rows: readonly ListRow[], incoming: readonly ListRow[]): ListRow[] {
  const seen = new Set(rows.map((r) => r.symbol));
  const out = rows.slice();
  for (const r of incoming) {
    if (seen.has(r.symbol)) continue;
    seen.add(r.symbol);
    out.push(r);
  }
  return out;
}

export function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case 'start':
      // A chip: a new list from its first page. Any answer still in flight is for the old list and is dropped (its id).
      return ask({ ...state, leagueId: action.leagueId !== undefined ? action.leagueId : state.leagueId, categoryId: action.categoryId, rows: [], cursor: null, hasMore: true }, null, true);
    case 'refresh':
      // Pull to refresh: the first page again; the rows stay on screen until it arrives.
      return ask(state, null, true);
    case 'more':
      if (state.status !== 'ready' || !state.hasMore || state.cursor == null) return state;
      return ask(state, state.cursor, false);
    case 'retry':
      if (state.status !== 'failed' || !state.failed) return state;
      return ask(state, state.failed.after, state.failed.replace);
    case 'loaded': {
      if (!state.pending || action.id !== state.pending.id) return state;
      const { replace } = state.pending;
      const last = action.page.rows.length > 0 ? action.page.rows[action.page.rows.length - 1].symbol : null;
      return {
        ...state,
        rows: replace ? mergeRows([], action.page.rows) : mergeRows(state.rows, action.page.rows),
        cursor: last ?? (replace ? null : state.cursor),
        hasMore: action.page.hasMore,
        status: 'ready',
        pending: null,
      };
    }
    case 'failed':
      if (!state.pending || action.id !== state.pending.id) return state;
      return { ...state, status: 'failed', failed: state.pending, pending: null };
  }
}

/** What the list area draws (E6, E7, E8), from the state alone. */
export type ListView =
  | { kind: 'first_loading' }
  | { kind: 'first_failed' }
  | { kind: 'empty' }
  | { kind: 'rows'; foot: 'none' | 'loading' | 'failed' };

export function listView(state: ListState, shownRows: number): ListView {
  if (state.rows.length === 0) {
    if (state.status === 'loading') return { kind: 'first_loading' };
    if (state.status === 'failed') return { kind: 'first_failed' };
    // Every row filtered out (owned since) with more to come is still loading, not empty.
    return state.hasMore ? { kind: 'first_loading' } : { kind: 'empty' };
  }
  if (shownRows === 0 && !state.hasMore && state.status === 'ready') return { kind: 'empty' };
  if (state.status === 'failed') return { kind: 'rows', foot: 'failed' };
  // A refresh keeps the rows and shows no foot (the pull's bars are the progress).
  if (state.status === 'loading' && state.pending && !state.pending.replace) return { kind: 'rows', foot: 'loading' };
  return { kind: 'rows', foot: 'none' };
}

/** A refusal or a transport error, PT429 included: every one is a load failure in the existing words (E7). */
export function isFailedRead(result: { data: unknown; error: unknown }): boolean {
  return !!result.error || parsePage(result.data) === null;
}

// ── The chips ────────────────────────────────────────────────────────────────────────────────────

export interface ChipCategory {
  id: string;
  name: string;
  is_misc: boolean;
}

export interface ListChip {
  /** null: "All" (no filter). */
  categoryId: string | null;
  label: string;
}

/** The chip "All" (new copy, approved with the A + C pick, 2026-11-18). */
export const ALL_CHIP_LABEL = 'All';

/**
 * "All", then our categories in display order. Misc is left out: the server's filter matches a category's
 * overrides and industry rules, and an unclassified stock (the client's Misc) matches neither, so a Misc
 * chip would list a near-empty, wrong subset.
 */
export function chipsFrom(categories: readonly ChipCategory[]): ListChip[] {
  return [{ categoryId: null, label: ALL_CHIP_LABEL }, ...categories.filter((c) => !c.is_misc).map((c) => ({ categoryId: c.id, label: c.name }))];
}

/** The category a row shows after its company: its first category's name; unclassified is Misc's name. */
export function rowCategoryName(categoryIds: readonly string[], categories: readonly ChipCategory[]): string | null {
  const byId = new Map(categories.map((c) => [c.id, c.name]));
  for (const id of categoryIds) {
    const n = byId.get(id);
    if (n) return n;
  }
  if (categoryIds.length === 0) return categories.find((c) => c.is_misc)?.name ?? null;
  return null;
}

/** The gap kept between a selected chip and the row's edge when it is scrolled into view (pt). */
export const CHIP_EDGE_GAP = 12;

/**
 * Where the chip row should scroll so the SELECTED chip is fully in view (P2: a chip cut off at the edge, "H" for
 * Healthcare, reads as a half-drawn control). `chipX`/`chipW` are the chip's position inside the scrolling content,
 * `scrollX` the row's current offset and `viewW` its visible width. Returns the new offset, or null when the chip is
 * already whole (the row's offset is then left alone: it does not jump). A chip wider than the view lines up at its
 * left edge. Never negative.
 */
export function chipScrollTarget(chipX: number, chipW: number, scrollX: number, viewW: number, gap: number = CHIP_EDGE_GAP): number | null {
  if (!(viewW > 0) || !(chipW > 0)) return null;
  const left = chipX - gap;
  const right = chipX + chipW + gap;
  if (chipW + 2 * gap >= viewW) return Math.max(0, chipX - gap) === scrollX ? null : Math.max(0, chipX - gap);
  if (left < scrollX) return Math.max(0, left);
  if (right > scrollX + viewW) return right - viewW;
  return null;
}

// ── A row ────────────────────────────────────────────────────────────────────────────────────────

/** The price cell: "–" until a live price arrives, and for any price that is not usable (never "$0.00"). */
export function rowPriceText(price: QueuePrice | undefined): string {
  return price && price.status === 'ready' ? priceLabel(price.price) : priceLabel(null);
}

/** True when the price sits under the name rather than at the right (E9). */
export function priceUnderName(fontScale: number): boolean {
  return fontScale >= PRICE_UNDER_NAME_SCALE;
}

/** What VoiceOver reads for a row: ticker, company, category, then the price in words ("price unavailable", never a dash). */
export function rowLabel(row: ListRow, category: string | null, priceText: string): string {
  const price = priceText === priceLabel(null) ? 'price unavailable' : priceText;
  return [row.symbol, row.name || null, category, price].filter(Boolean).join(', ');
}

// ── Starting a buy (E3) ──────────────────────────────────────────────────────────────────────────

/**
 * Whether the tab may START a buy: the "+" on each row. The ONE predicate behind E3 (a finished season: no "+";
 * the sheet itself is closed to buying, StockSheetBody's isSeasonOver). Kept as one function so Giorgio's pending
 * look pick (B: the "+" kept, with the season-over line) is a change here alone.
 */
export function showsBuyPlus(seasonOver: boolean): boolean {
  return !seasonOver;
}

// ── On screen ────────────────────────────────────────────────────────────────────────────────────

export interface RowBox {
  symbol: string;
  /** Top and height, relative to the list's own box. */
  y: number;
  height: number;
}

/**
 * The rows any part of which is inside the viewport (window coordinates), in list order: the ONLY rows whose
 * prices are asked for. Until the list's own position is known, nothing is on screen (no guess).
 */
export function symbolsOnScreen(rows: readonly RowBox[], listTop: number | null, viewport: { top: number; bottom: number } | null): string[] {
  if (listTop == null || !viewport) return [];
  return rows
    .filter((r) => r.height > 0 && listTop + r.y + r.height > viewport.top && listTop + r.y < viewport.bottom)
    .map((r) => r.symbol);
}

/** True when the list's foot (window y) is within NEAR_END_PT of the viewport's bottom: time for the next page. */
export function isNearEnd(footTop: number | null, viewport: { top: number; bottom: number } | null, threshold: number = NEAR_END_PT): boolean {
  if (footTop == null || !viewport) return false;
  return footTop <= viewport.bottom + threshold;
}

// ── The live prices ──────────────────────────────────────────────────────────────────────────────

/**
 * The answers out of a `quote` BATCH response (`{ prices: {SYM: number}, errors?: {SYM: …} }`, the same fill-price
 * chain the stock sheet's quote uses): a usable number is an answer; anything else the response names, or leaves
 * out, is a FAILED read (the store shows "–" and asks again later). A failed call never becomes a price.
 */
export function answersFromQuote(data: unknown, asked: readonly string[]): Record<string, { ok: true; price: number | null } | { ok: false }> {
  const body = (data && typeof data === 'object' && !Array.isArray(data) ? data : {}) as { prices?: unknown };
  const prices = body.prices && typeof body.prices === 'object' && !Array.isArray(body.prices) ? (body.prices as Record<string, unknown>) : {};
  const byUpper = new Map<string, unknown>();
  for (const [k, v] of Object.entries(prices)) byUpper.set(k.toUpperCase(), v);
  const out: Record<string, { ok: true; price: number | null } | { ok: false }> = {};
  for (const raw of asked) {
    const s = raw.toUpperCase();
    const p = byUpper.get(s);
    out[s] = typeof p === 'number' && Number.isFinite(p) && Math.round(p * 100) >= 1 ? { ok: true, price: p } : { ok: false };
  }
  return out;
}

// ── The control row (C: search is the first icon in the chip row) ──────────────────────────────

export interface ControlRow {
  mode: 'chips' | 'search';
  query: string;
}

export type ControlAction = { type: 'open_search' } | { type: 'cancel' } | { type: 'type'; query: string };

/** The search icon swaps the chips for a field and Cancel; Cancel puts the chips back and forgets the query. */
export function controlReducer(state: ControlRow, action: ControlAction): ControlRow {
  switch (action.type) {
    case 'open_search':
      return { mode: 'search', query: '' };
    case 'cancel':
      return { mode: 'chips', query: '' };
    case 'type':
      return state.mode === 'search' ? { ...state, query: action.query } : state;
  }
}
