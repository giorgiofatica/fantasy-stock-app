/**
 * watchlist: the Stocks tab's watchlist (the star and the Watching view), as pure rules. No React Native, no network:
 * tests-deno pins every rule. Plan: docs/plans/2026-11-18-stocks-tab.md part 3 ("Settled during the build" 1 to 3) on
 * the October plan (docs/plans/2026-10-08-trading-window-and-watchlist.md); board `#call-stocks-tab-lists`.
 *
 * THE SERVER (20261209000000_watchlist.sql). `set_watchlist(p_league_id, p_symbol, p_saved)` answers jsonb
 * `{ok, count, reason}`; `get_league_watchlist(p_league_id)` returns symbol, name, category_ids, is_draftable, saved_at and
 * NO price. A watchlist is per league and personal, 50 at most. supabase-js `.rpc()` does not throw on a Postgres error
 * (CLAUDE.md, success signals #5): every caller destructures `{ data, error }`, and a refusal or a transport error is a
 * save that did not go through, never a success.
 *
 * THE STAR IS OPTIMISTIC, AND EVERY FAILURE PUTS IT BACK. A tap shows the new state at once (saving a stock is not money);
 * if the write comes back `ok:false`, or an error, or something that is not an answer, the star returns to what it was.
 * Only `watchlist_full` has words (the board's, on the stock sheet); `rate_limited` and every other refusal get NONE
 * (the Planner's rule 3): the star simply returns to empty.
 */
import { COPY } from '../money/moneyCopy';

/** The most stocks a manager may save in one league (the server's cap_index range). */
export const WATCHLIST_MAX = 50;

/** One saved stock, as the reader returns it (no price: each row takes it from the live lookup). */
export interface WatchRow {
  symbol: string;
  name: string;
  /** Our categories, in display order; empty = unclassified (the client's Misc). */
  categoryIds: string[];
  /** The server's draftable flag. Read with `noLongerTradable`, never alone. */
  isDraftable: boolean;
  savedAt: string | null;
}

/** The watchlist read's `data` as rows, or null when it is not an array (a failed read, never "nothing saved"). */
export function parseWatchlist(data: unknown): WatchRow[] | null {
  if (!Array.isArray(data)) return null;
  const rows: WatchRow[] = [];
  for (const raw of data) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as { symbol?: unknown; name?: unknown; category_ids?: unknown; is_draftable?: unknown; saved_at?: unknown };
    if (typeof r.symbol !== 'string' || r.symbol.trim() === '') continue;
    rows.push({
      symbol: r.symbol.trim().toUpperCase(),
      name: typeof r.name === 'string' ? r.name.trim() : '',
      categoryIds: Array.isArray(r.category_ids) ? r.category_ids.filter((c): c is string => typeof c === 'string') : [],
      // A missing flag is "draftable": the line says "No longer tradable" only on a flag the server sent as false.
      isDraftable: r.is_draftable !== false,
      savedAt: typeof r.saved_at === 'string' ? r.saved_at : null,
    });
  }
  // Newest save first, as the manager built the list; a row with no time keeps its place after those with one.
  return rows.map((r, i) => ({ r, i })).sort((a, b) => (b.r.savedAt ?? '').localeCompare(a.r.savedAt ?? '') || a.i - b.i).map((x) => x.r);
}

export function watchlistReadArgs(leagueId: string): { p_league_id: string } {
  return { p_league_id: leagueId };
}

export function setWatchlistArgs(leagueId: string, symbol: string, saved: boolean): { p_league_id: string; p_symbol: string; p_saved: boolean } {
  return { p_league_id: leagueId, p_symbol: symbol.trim().toUpperCase(), p_saved: saved };
}

// ── The write's answer ───────────────────────────────────────────────────────────────────────

/** Every reason the server names, plus 'failed' for a transport error or an answer that is not one. */
export type SaveFailure =
  | 'watchlist_full'
  | 'rate_limited'
  | 'unknown_symbol'
  | 'not_a_member'
  | 'invalid'
  | 'not_authenticated'
  | 'failed';

export type SaveResult = { ok: true; count: number | null } | { ok: false; reason: SaveFailure };

const KNOWN_REASONS: readonly SaveFailure[] = ['watchlist_full', 'rate_limited', 'unknown_symbol', 'not_a_member', 'invalid', 'not_authenticated'];

/**
 * A `set_watchlist` result (`{ data, error }`) as one verdict. An `error` is a failure whatever `data` holds; `ok` must be
 * literally true; an unknown or missing reason is 'failed'. A success without a count is still a success (count null).
 */
export function parseSaveResult(result: { data: unknown; error: unknown }): SaveResult {
  if (result.error) return { ok: false, reason: 'failed' };
  const d = result.data;
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok: false, reason: 'failed' };
  const o = d as { ok?: unknown; count?: unknown; reason?: unknown };
  if (o.ok === true) return { ok: true, count: typeof o.count === 'number' && Number.isFinite(o.count) ? o.count : null };
  const reason = KNOWN_REASONS.find((k) => k === o.reason);
  return { ok: false, reason: reason ?? 'failed' };
}

/** The words a failed save shows, if any. Only a full list has any (the board's, on the sheet); every other failure has none. */
export function failureWords(reason: SaveFailure): string | null {
  return reason === 'watchlist_full' ? COPY.watchlistFull : null;
}

// ── One league's saved symbols, optimistic ───────────────────────────────────────────────────

/** What the star knows about one league: the symbols saved (optimistic), the ones with a write in flight, the last read's rows. */
export interface LeagueWatch {
  /** 'idle' before any read; 'loading'; 'ready'; 'failed' (the read did not answer: stars show empty, Watching says so). */
  status: 'idle' | 'loading' | 'ready' | 'failed';
  /** Saved symbols, upper case, in the order they were saved (newest last). */
  symbols: string[];
  /** The rows from the last read (name, categories, draftable), newest save first. A just-saved stock is not here until the re-read lands. */
  rows: WatchRow[];
  /** Symbols whose write is in flight; a second tap on one is ignored until it settles. */
  pending: string[];
  /** Set when the last save was refused because the list is full; cleared by the next save that goes through or by `clearRefusal`. */
  refusal: 'watchlist_full' | null;
}

export const emptyWatch: LeagueWatch = { status: 'idle', symbols: [], rows: [], pending: [], refusal: null };

export function isSaved(w: LeagueWatch, symbol: string): boolean {
  return w.symbols.includes(symbol.toUpperCase());
}

/** The tap: the new state at once. A tap on a symbol already in flight changes nothing (returns the same object). */
export function applyToggle(w: LeagueWatch, symbol: string): { next: LeagueWatch; want: boolean } | null {
  const s = symbol.toUpperCase();
  if (w.pending.includes(s)) return null;
  const want = !w.symbols.includes(s);
  return {
    want,
    next: {
      ...w,
      symbols: want ? [...w.symbols, s] : w.symbols.filter((x) => x !== s),
      pending: [...w.pending, s],
      refusal: want ? null : w.refusal,
    },
  };
}

/** The write's verdict. Success keeps what the tap showed; ANY failure puts the star back to what it was before the tap. */
export function settleToggle(w: LeagueWatch, symbol: string, want: boolean, result: SaveResult): LeagueWatch {
  const s = symbol.toUpperCase();
  const pending = w.pending.filter((x) => x !== s);
  if (result.ok) return { ...w, pending, refusal: null };
  // Back to what it was: a failed save returns to empty, a failed removal returns to filled.
  const symbols = want ? w.symbols.filter((x) => x !== s) : w.symbols.includes(s) ? w.symbols : [...w.symbols, s];
  return { ...w, symbols, pending, refusal: result.reason === 'watchlist_full' ? 'watchlist_full' : null };
}

/** The read's answer replaces what is known, except a symbol whose write is still in flight keeps the tap's state. */
export function applyRead(w: LeagueWatch, rows: WatchRow[]): LeagueWatch {
  const fromServer = rows.map((r) => r.symbol);
  const keep = w.pending.filter((p) => w.symbols.includes(p) && !fromServer.includes(p));
  const drop = new Set(w.pending.filter((p) => !w.symbols.includes(p)));
  return { ...w, status: 'ready', rows, symbols: [...fromServer.filter((s) => !drop.has(s)), ...keep] };
}

/** Rows the Watching view draws: the last read's rows still saved, so an unstarred row leaves at once (the tap's state). */
export function watchingRows(w: LeagueWatch): WatchRow[] {
  return w.rows.filter((r) => w.symbols.includes(r.symbol));
}

// ── The star on a row ────────────────────────────────────────────────────────────────────────

/** "there probably shouldn't be a save option if you already have the stock" (PRODUCT_RULES): a star on unowned stocks and on other managers' stocks, never on yours. */
export function showsStar(ownedByMe: boolean): boolean {
  return !ownedByMe;
}

/** The star's VoiceOver label: the board's Save / Saved words. */
export function starLabel(symbol: string, saved: boolean): string {
  return `${saved ? COPY.saved : COPY.save} ${symbol}`;
}

// ── A Watching row's status line ─────────────────────────────────────────────────────────────

/**
 * "No longer tradable" is the buy path's own test (_shared/draft-validation.ts, reason not_draftable): the server's draftable flag is false AND
 * the league has not turned on "Allow non-draftable stocks (full universe)". In a full-universe league the flag alone never shows the line.
 */
export function noLongerTradable(isDraftable: boolean, allowUndraftable: boolean): boolean {
  return !isDraftable && !allowUndraftable;
}

export interface StatusInput {
  /** Who holds it in this league: me, another manager (name may be unresolved), or nobody. */
  owner: { kind: 'me' } | { kind: 'other'; name: string | null } | null;
  isDraftable: boolean;
  allowUndraftable: boolean;
  /** Budget / tier leagues: every slot of yours is held, so a buy has nowhere to go (useSearchOwnership's roomless). */
  roomless: boolean;
}

/**
 * The one status line, in the Planner's order when two apply (PRODUCT_RULES / the plan, "Settled during the build" 1):
 * who owns it first ("You own this", "Owned by {name}": a holder can always sell), then "No longer tradable", then the slot lines.
 * The slot lines here are the ones the app can already tell without asking the server which tier slot a price fits:
 * "No free slot" when every slot is held, else "Available". The tier band text ("fits your $100–$200 slot") needs the server's verdict.
 */
export function statusLine(input: StatusInput): { text: string; mine: boolean } {
  if (input.owner?.kind === 'me') return { text: COPY.youOwnThis, mine: true };
  if (input.owner?.kind === 'other') return { text: COPY.ownedBy(input.owner.name ?? 'another manager'), mine: false };
  if (noLongerTradable(input.isDraftable, input.allowUndraftable)) return { text: COPY.noLongerTradable, mine: false };
  if (input.roomless) return { text: COPY.noFreeSlot, mine: false };
  return { text: COPY.availableStatus, mine: false };
}

/** The "+" on a Watching row: a stock you can get keeps it; a held, owned, untradable or slotless stock has none. */
export function watchRowHasPlus(status: { text: string }, seasonOver: boolean): boolean {
  return !seasonOver && status.text === COPY.availableStatus;
}

// ── The switch ───────────────────────────────────────────────────────────────────────────────

export type StocksView = 'available' | 'watching';

export interface SwitchSegment {
  view: StocksView;
  label: string;
}

/** The board's switch, in its order. Claims joins it in workstream 7 (one more entry here). */
export const SWITCH_SEGMENTS: readonly SwitchSegment[] = [
  { view: 'available', label: COPY.switchAvailable },
  { view: 'watching', label: COPY.switchWatching },
];
