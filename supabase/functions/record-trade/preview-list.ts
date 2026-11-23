// record-trade's LIST preview: "would a buy of this stock, at this price, take
// one of my slots?" for a whole screen of watchlist rows in one call.
//
// Plan: docs/plans/2026-11-18-stocks-tab.md, part 3, "Settled during the
// build" point 4 (the Planner's ruling, 2026-11-23). The Watching list's slot
// lines ("Available · fits your $100–$200 slot", "No free $400+ slot") need
// the server's answer; the single preview is paced at 30 a minute, so one call
// per row is ruled out. So the preview takes a list:
//
//   request  { action: 'preview', league_id, rows: [{ symbol, price }, ...] }
//   response the ordinary preview body (stake_mode, stake, unfilled_slots,
//            sources, market, slots, unplaced) with NO top-level would_fill,
//            plus `rows`: one entry per requested row, SAME ORDER AND LENGTH,
//            each either null (no answer) or
//            { symbol, price, would_fill: slot | null, open_slots?: slot[] }
//            (the single preview's would_fill / open_slots, per row).
//
// THE RULES THIS FILE HOLDS
//   - The buy's own function. Each row runs decideBuySlot (through commit.ts
//     wouldFillBody, the same call the single preview makes) over the caller's
//     slot occupancy. No second copy of the rule here or in the app.
//   - Only the caller's OWN watchlist in THAT league. A symbol the caller has
//     not saved there gets null, exactly like a row with no price: the answer
//     never says WHY a row has no answer. The saved set is read under the
//     caller's identity (the `watchlist` table's RLS: user_id = auth.uid() and
//     is_member), never service-role-wide, and BEFORE any category read, so
//     an unsaved symbol's category is never even looked up. Without this, one
//     call would hand out the category fit of 50 arbitrary stocks, which is the
//     disclosure the watchlist's save pacing (20261209000000, PACING) closes.
//   - The buy's own draftable gate, per row (plan point 7, preview-gate.ts):
//     a saved symbol the buy would refuse as not_draftable gets null, and its
//     category is never read. Watching already words that row "No longer
//     tradable" from the watchlist read's own flag, so null says nothing new.
//   - Bounded: at most MAX_PREVIEW_ROWS rows (the watchlist cap). More is a
//     bad_request, not a silent truncation (a truncated answer would read as
//     "Available" for the rows past the cut).
//   - Advisory, as the single preview: the buy re-validates at the live fill
//     price against the live ledger. No writes.
//   - A row with no answer is null: a league with no slots, a price that did
//     not load (missing, zero, negative, not a number), a symbol not on the
//     caller's watchlist, a symbol the buy would refuse as not_draftable, a symbol of a shape the table cannot hold, or (a
//     category league) a symbol whose eligibility did not come back. The app
//     reads null as plain "Available". A READ ERROR is not a null: it is the
//     preview's 500, so a failure never reads as the routine "no answer".
//
// Pure apart from the injected reads (RowReads): index.ts wires the real
// supabase-js clients in, preview-list.test.ts wires fakes.
import {
  type LedgerState,
  rulesFromLeague,
  type SlotBody,
  slotsFromRows,
  type Step,
  unhandled,
  wouldFillBody,
} from './commit.ts';
import { refusesAsNotDraftable, userSlotOccupancy } from '../_shared/draft-validation.ts';

/** The watchlist cap (watchlist.cap_index is 1..50): a screen of saved rows. */
export const MAX_PREVIEW_ROWS = 50;

/** A symbol the list will consider: exactly the watchlist table's own shape
 * (watchlist_symbol_shape: upper case, 1-12 characters), so every symbol a
 * manager can save can be answered, including real `$`, `^`, `=` and hyphenated
 * forms. No narrower character set is needed: the saved set is read WITHOUT a
 * symbol filter (index.ts) and matched here in memory, so no requested string
 * ever reaches a PostgREST filter; category eligibility is then read only for
 * symbols that came back from the watchlist table itself. */
function symbolShapeOk(sym: string): boolean {
  const n = Array.from(sym).length;
  return n >= 1 && n <= 12 && sym === sym.toUpperCase();
}

/** One requested row after parsing. null = that half is unusable, so the row
 * gets no answer (it is never an error: a price that did not load is normal). */
export interface PreviewRowRequest {
  symbol: string | null;
  price: number | null;
}

export interface PreviewRowAnswer {
  symbol: string;
  price: number;
  would_fill: SlotBody | null;
  open_slots?: SlotBody[];
}

/**
 * Parses `body.rows`. Not an array, or longer than MAX_PREVIEW_ROWS, is a
 * bad_request (ok:false). Each element is parsed leniently: a symbol is
 * trimmed and upper-cased as the single preview does; a price is Number()'d as
 * the single preview's `price` is, and must be finite and > 0.
 */
export function parsePreviewRows(raw: unknown): { ok: true; rows: PreviewRowRequest[] } | { ok: false } {
  if (!Array.isArray(raw) || raw.length > MAX_PREVIEW_ROWS) return { ok: false };
  const rows = raw.map((r): PreviewRowRequest => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return { symbol: null, price: null };
    const o = r as Record<string, unknown>;
    const sym = typeof o.symbol === 'string' ? o.symbol.trim().toUpperCase() : '';
    const p = typeof o.price === 'number' || typeof o.price === 'string' ? Number(o.price) : NaN;
    return {
      symbol: symbolShapeOk(sym) ? sym : null,
      price: Number.isFinite(p) && p > 0 ? p : null,
    };
  });
  return { ok: true, rows };
}

/** The reads the list needs beyond the ledger, injected. */
export interface RowReads {
  /** Of `symbols`, the ones on the CALLER's watchlist in this league, read
   * under the caller's identity (RLS). ok:false on a read error. */
  savedAmong(symbols: string[]): PromiseLike<{ ok: true; saved: Set<string> } | { ok: false }>;
  /** Of `symbols` (saved symbols only), the ones symbols.is_draftable marks
   * true; a symbol with no row is absent (= not draftable, as for the buy).
   * ok:false on a read error. preview-gate.ts fetchDraftableAmong. */
  draftableAmong(symbols: string[]): PromiseLike<{ ok: true; draftable: Set<string> } | { ok: false }>;
  /** Category eligibility per symbol (fetchEligibleCategoryIdsBatch). Called
   * ONLY with saved symbols that pass the draftable gate, and only in a league
   * with category slots. Throws
   * on a read error, as that helper does. */
  eligibilityFor(symbols: string[]): Promise<Map<string, Set<string>>>;
}

/**
 * Answers each row from facts already read. Exported for the tests; index.ts
 * goes through previewRows, which does the reads in the safe order.
 */
export function answerPreviewRows(
  state: LedgerState,
  userId: string,
  rows: PreviewRowRequest[],
  /** The symbols that may be answered: saved by the caller AND not refused by
   * the draftable gate (previewRows computes it). Anything else is null. */
  answerable: Set<string>,
  eligibility: Map<string, Set<string>>,
): Array<PreviewRowAnswer | null> {
  const slots = slotsFromRows(state.slots ?? []);
  if (slots.length === 0) return rows.map(() => null);
  const hasCategorySlots = slots.some((s) => s.categoryId != null);
  const occ = userSlotOccupancy(userId, slots, state.picks, state.trades, state.heldEligibility);
  return rows.map((r) => {
    if (r.symbol == null || r.price == null || !answerable.has(r.symbol)) return null;
    // A category league needs the symbol's eligibility; without it the answer
    // would be a guess (flex-only), so the row gets none.
    const elig = hasCategorySlots ? eligibility.get(r.symbol) : new Set<string>();
    if (!elig) return null;
    return { symbol: r.symbol, price: r.price, ...wouldFillBody(slots, occ, r.price, elig) };
  });
}

/**
 * The list answer, with the reads in the order the disclosure rule needs:
 * nothing at all for a slot-less league; the caller's saved set first (under
 * their identity); then the draftable gate over saved symbols; category
 * eligibility only for saved symbols the gate lets through. A read error
 * is the preview's 500 (never a page of nulls that reads as "Available").
 */
export async function previewRows(
  state: LedgerState,
  userId: string,
  rows: PreviewRowRequest[],
  reads: RowReads,
): Promise<Step<Array<PreviewRowAnswer | null>>> {
  const slots = slotsFromRows(state.slots ?? []);
  if (slots.length === 0) return { ok: true, value: rows.map(() => null) };

  const asked = [...new Set(rows.filter((r) => r.symbol != null && r.price != null).map((r) => r.symbol!))];
  if (asked.length === 0) return { ok: true, value: rows.map(() => null) };

  const savedRes = await reads.savedAmong(asked);
  if (!savedRes.ok) return { ok: false, reply: unhandled() };
  // Only what was asked can count as saved, whatever the read returned.
  const saved = new Set([...savedRes.saved].filter((s) => asked.includes(s)));
  if (saved.size === 0) return { ok: true, value: rows.map(() => null) };

  // The buy's own gate (refusesAsNotDraftable), per saved symbol, BEFORE any
  // category read: a stock the buy would refuse gets no answer and no lookup.
  const draftRes = await reads.draftableAmong([...saved]);
  if (!draftRes.ok) return { ok: false, reply: unhandled() };
  const rules = rulesFromLeague(state.league);
  const answerable = new Set([...saved].filter((s) => !refusesAsNotDraftable(draftRes.draftable.has(s), rules)));

  let eligibility = new Map<string, Set<string>>();
  if (answerable.size > 0 && slots.some((s) => s.categoryId != null)) {
    eligibility = await reads.eligibilityFor([...answerable]);
  }
  return { ok: true, value: answerPreviewRows(state, userId, rows, answerable, eligibility) };
}
