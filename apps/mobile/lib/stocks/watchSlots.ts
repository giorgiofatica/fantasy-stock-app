/**
 * watchSlots: the Watching rows' slot lines ("Available · fits your $100–$200 slot", "No free $400+ slot"), from the SERVER's verdict.
 *
 * WHY THE SERVER. A tier slot's fit is the server's to decide (tierContract.ts: the client never computes whether a price or a category fits a
 * slot). record-trade's `preview` takes a LIST (PR #600; plan part 3, "Settled during the build" point 4): ONE call per screen of rows, each
 * row sent with the price it is SHOWING, answered only for symbols on the caller's own watchlist.
 *
 *   request   POST record-trade { action: 'preview', league_id, rows: [{ symbol, price }, ...] }   (0 to 50 rows; never a top-level symbol or price)
 *   response  the ordinary preview body, plus `rows`: the same length and order, each null or
 *             { symbol, price, would_fill: slot | null, open_slots?: slot[] }
 *               would_fill = slot  -> "Available · fits your {band}"
 *               would_fill = null  -> "No free {band}"
 *               null               -> no answer: the row reads what the app can tell without it (statusLine), plain "Available" if nothing else
 *
 * NEVER A GUESS. Any error, a body that is not the list answer (the function before it learned the list reads as an ordinary preview with no
 * `rows`), a length that does not match, a row echoing another symbol, or an answer whose echoed price is not the price the row is showing now:
 * that row has no answer. A band whose words cannot be made (an unresolved category name) has no answer either.
 *
 * The "No free {band}" band is the one FULL slot (open = 0, from the answer's own `slots`) whose price band holds the price; when no single
 * full slot does (or the slot has a category), the line is the plain "No free slot".
 */
import { COPY } from '../money/moneyCopy';
import {
  parsePreviewSlots,
  parseSlotShape,
  slotLabelFor,
  type CategoryResolver,
  type PreviewSlot,
  type SlotShape,
} from '../money/tierContract';

/** The most rows one call may carry (the watchlist's cap). */
export const LIST_PREVIEW_MAX = 50;

export interface AskedRow {
  symbol: string;
  price: number;
}

export interface SlotVerdict {
  /** The line, in the board's words. */
  text: string;
  /** True for "No free …": the stock cannot be bought into a slot right now (no "+"). */
  full: boolean;
  /** The price this answer was given for; the row drops it when it shows another. */
  price: number;
}

/** A usable row to ask about: a symbol, and a price that is finite and above zero. */
export function askableRows(rows: readonly { symbol: string; price: number | null | undefined }[]): AskedRow[] {
  const out: AskedRow[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const symbol = r.symbol.trim().toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    if (typeof r.price !== 'number' || !Number.isFinite(r.price) || r.price <= 0) continue;
    seen.add(symbol);
    out.push({ symbol, price: r.price });
    if (out.length === LIST_PREVIEW_MAX) break;
  }
  return out;
}

export function listPreviewBody(leagueId: string, rows: readonly AskedRow[]): { action: 'preview'; league_id: string; rows: AskedRow[] } {
  return { action: 'preview', league_id: leagueId, rows: rows.map((r) => ({ symbol: r.symbol, price: r.price })) };
}

/** True when `price` lies inside the slot's price band (an open end is unbounded). Only used to NAME the one full slot a no-room answer is about. */
function bandHolds(slot: SlotShape, price: number): boolean {
  return (slot.price_min == null || price >= slot.price_min) && (slot.price_max == null || price <= slot.price_max);
}

/** The words for a no-room answer: "No free $400 or more slot" when exactly one price-band-only slot is full and holds the price, else "No free slot". */
function fullLine(slots: PreviewSlot[] | null, price: number, resolve: CategoryResolver): string {
  const holders = (slots ?? []).filter((s) => s.open === 0 && s.category_id == null && (s.price_min != null || s.price_max != null) && bandHolds(s, price));
  const label = holders.length === 1 ? slotLabelFor(holders[0], resolve) : null;
  return label ? `No free ${label}` : COPY.noFreeSlot;
}

/**
 * The list answer as verdicts by symbol, only for the rows that have one. `asked` is what was sent (the order matters); `shownPrice` is what each
 * row is showing NOW (an answer for another price is dropped).
 */
export function parseListPreview(
  data: unknown,
  asked: readonly AskedRow[],
  shownPrice: (symbol: string) => number | null | undefined,
  resolve: CategoryResolver,
): Map<string, SlotVerdict> {
  const out = new Map<string, SlotVerdict>();
  if (!data || typeof data !== 'object' || Array.isArray(data)) return out;
  const d = data as { ok?: unknown; rows?: unknown; slots?: unknown };
  if (d.ok !== true || !Array.isArray(d.rows) || d.rows.length !== asked.length) return out;
  const slots = parsePreviewSlots(d.slots);
  d.rows.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const r = raw as { symbol?: unknown; price?: unknown; would_fill?: unknown };
    const want = asked[i];
    if (typeof r.symbol !== 'string' || r.symbol.toUpperCase() !== want.symbol) return;
    if (typeof r.price !== 'number' || r.price !== want.price) return;
    const now = shownPrice(want.symbol);
    if (typeof now !== 'number' || now !== want.price) return;
    if (r.would_fill === null) {
      out.set(want.symbol, { text: fullLine(slots, want.price, resolve), full: true, price: want.price });
      return;
    }
    const slot = parseSlotShape(r.would_fill);
    const label = slot ? slotLabelFor(slot, resolve) : null;
    if (!label) return; // a slot whose words cannot be made (an unresolved category) is no answer, never a guess
    out.set(want.symbol, { text: `${COPY.availableStatus} · fits your ${label}`, full: false, price: want.price });
  });
  return out;
}
