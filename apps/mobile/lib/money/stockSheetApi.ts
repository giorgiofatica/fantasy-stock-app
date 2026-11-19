/**
 * stockSheetApi: the public shape of the stock sheet route (3e). Every ticker
 * anywhere opens the sheet through useStockSheet().open(symbol, options), and
 * that includes 3c's lineups. There is no /stock/[symbol] route on purpose
 * (DESIGN_DIRECTION §3: the sheet is a sheet, not a page).
 *
 * open's second argument is backward-compatible: the original origin-ref
 * string still works, and the new options object is optional. A name the
 * opener already has (symbol search, a lineup row) skips the name read.
 */
const SYMBOL_RE = /^[A-Z][A-Z0-9]{0,4}(\.[A-Z])?$/;

/** Uppercased, trimmed ticker, or null for anything that isn't a plausible
 * US symbol (including BRK.B-style share classes). Never a guessed symbol. */
export function normalizeSymbol(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toUpperCase();
  return SYMBOL_RE.test(s) ? s : null;
}

export interface OpenOptions {
  /** The company name, when the opener already has it. */
  name?: string | null;
  /** Where the sheet was opened from (a row id), so the caller can restore focus. */
  originRef?: string | null;
  /** "buy": the sheet opens STRAIGHT INTO its buy review (the Stocks list's "+", Planner ruling 2026-11-19), when a buy is
   * allowed; otherwise it opens as a plain sheet with its own reason under a disabled "Review buy". Omitted (a row tap, every
   * other opener): the sheet opens to look. Never a trade without the review. */
  startReview?: 'buy' | null;
  /** M1: the tapped row's measured screen rect (measureInWindow), for the
   * row->header flying tile. Omitted, the sheet just rises with no tile. */
  originRect?: { x: number; y: number; width: number; height: number } | null;
}

export interface NormalizedOpenOptions {
  startReview: 'buy' | null;
  name: string | null;
  originRef: string | null;
  originRect: { x: number; y: number; width: number; height: number } | null;
}

/** The second argument of open(): a legacy origin-ref string, an options object, or nothing. */
export function normalizeOpenOptions(arg?: string | null | OpenOptions): NormalizedOpenOptions {
  if (arg == null) return { name: null, originRef: null, originRect: null, startReview: null };
  if (typeof arg === 'string') return { name: null, originRef: arg || null, originRect: null, startReview: null };
  const name = typeof arg.name === 'string' && arg.name.trim() ? arg.name.trim() : null;
  return { name, originRef: arg.originRef ?? null, originRect: arg.originRect ?? null, startReview: arg.startReview === 'buy' ? 'buy' : null };
}

/**
 * Whether the sheet starts its buy review by itself (the "+" on the Stocks list). Only when asked (`start === 'buy'`), once the
 * sheet's facts have loaded, and only when a buy is ALLOWED right now: the market gate is open and no rule blocks it (the
 * pre-draft gate, an owned stock, a full roster, the budget). Otherwise the sheet shows its own reason under a disabled
 * "Review buy", as it does for any opener. A row tap never asks, so it never starts a review.
 */
export function shouldStartReview(start: 'buy' | null | undefined, factsReady: boolean, buyEnabled: boolean, gateOpen: boolean): boolean {
  return start === 'buy' && factsReady && buyEnabled && gateOpen;
}

/** The name the sheet shows, and where it came from. A name the opener passed
 * wins; then the league ledger's; then the session cache. Null means a read is needed. */
export function resolveSheetName(s: {
  openerName: string | null;
  ledgerName: string | null;
  cachedName: string | null;
}): { name: string | null; source: 'opener' | 'ledger' | 'cache' | null } {
  if (s.openerName) return { name: s.openerName, source: 'opener' };
  if (s.ledgerName) return { name: s.ledgerName, source: 'ledger' };
  if (s.cachedName) return { name: s.cachedName, source: 'cache' };
  return { name: null, source: null };
}
