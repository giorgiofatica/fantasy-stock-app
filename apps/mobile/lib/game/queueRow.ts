/**
 * The pre-draft queue row's rules (Giorgio, 2026-11-05, option A; docs/PRODUCT_RULES.md "The queue row"). Pure, so
 * tests-deno pins every rule; components/game/QueueRow.tsx draws them and lib/game/useQueueQuotes.ts fetches.
 *
 * - The price is the stock's latest trade, the SAME number the draft search shows (symbols-search → Alpaca's latest
 *   trade). A price that is missing, zero, negative or not a number is "–": never "$0.00", never a blank, and never a
 *   fallback to symbols.last_price (it can be days old with nothing saying so).
 * - While the market is closed, one line under the card's intro names the day of the last close.
 */
import { formatMoney } from '../../components/sp/logic/money';
import { marketClosedAt } from '../home/homeCopy';

/** The row's text stops growing here, as Holdings and Schedule rows do, so the buttons stay on the row at the largest sizes. */
export const QUEUE_ROW_TEXT_MAX_SCALE = 1.3;

/** The price cell of a stock whose price is missing. An en dash, never "$0.00" and never a blank. */
export const NO_PRICE = '–';

/** What the row knows about one stock's price: absent while it loads, then a number or null (it didn't load / isn't there). */
export type QueuePrice = { status: 'loading' } | { status: 'ready'; price: number | null };

/** A price worth drawing: a finite number that is at least one cent. Anything else (null, 0, negative, NaN, a string, and a
 * fraction of a cent that would draw as "$0.00") is missing. */
export function usablePrice(price: unknown): price is number {
  return typeof price === 'number' && Number.isFinite(price) && Math.round(price * 100) >= 1;
}

/** The price text: "$186.42", or "–" when there is no usable price. */
export function priceLabel(price: number | null | undefined): string {
  return usablePrice(price) ? formatMoney(price) : NO_PRICE;
}

/** What the price cell draws: a placeholder bar while it loads, else the label. */
export function priceCell(state: QueuePrice | undefined): { kind: 'loading' } | { kind: 'text'; text: string } {
  if (!state || state.status === 'loading') return { kind: 'loading' };
  return { kind: 'text', text: priceLabel(state.price) };
}

/** The line under the card's intro while the market is closed ("Prices at Wednesday's close."), or null. */
export const CLOSED_LINE_PREFIX = 'Prices ';
export function pricesClosedLine(marketStatus: string | null | undefined, lastCloseIso: string | null | undefined): string | null {
  // Only a market KNOWN to be closed says so: 'open', 'unknown' and a failed read (null) say nothing, as the league sheet
  // never claims "Live" without evidence (LeagueContext).
  if (marketStatus !== 'closed' || !lastCloseIso) return null;
  const at = marketClosedAt(lastCloseIso); // "at Wednesday's close", in ET, the same day word Home uses
  return at ? `${CLOSED_LINE_PREFIX}${at}.` : null;
}

/**
 * The price out of a symbols-search response for ONE asked symbol. The search matches by prefix and by name, so a
 * stock that isn't there (delisted, a typo) answers with its neighbours: only the item whose symbol IS the asked one
 * counts, and only with a usable price. Everything else is null.
 */
export function priceFromSearch(data: unknown, symbol: string): number | null {
  const items = (data as { items?: unknown } | null | undefined)?.items;
  if (!Array.isArray(items)) return null;
  const want = symbol.toUpperCase();
  for (const item of items as { symbol?: unknown; price?: unknown }[]) {
    if (typeof item?.symbol === 'string' && item.symbol.toUpperCase() === want) return usablePrice(item.price) ? item.price : null;
  }
  return null;
}

/** The names out of a symbols read ({symbol, name} rows) by uppercase ticker; rows with no usable name are left out. */
export function namesFromRows(rows: readonly { symbol?: unknown; name?: unknown }[] | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows ?? []) {
    if (typeof r?.symbol === 'string' && typeof r?.name === 'string' && r.name.trim() !== '') out[r.symbol.toUpperCase()] = r.name.trim();
  }
  return out;
}

/** The queued symbols not yet known, upper-cased and de-duplicated, in queue order. */
export function symbolsToRead(wanted: readonly string[], known: { has(symbol: string): boolean }): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of wanted) {
    const u = s.toUpperCase();
    if (seen.has(u)) continue;
    seen.add(u);
    if (!known.has(u)) out.push(u);
  }
  return out;
}

/**
 * What VoiceOver reads for the row's text: the ticker, the company when known, then the price in words ("price
 * unavailable", never a spoken dash). The buttons beside it keep their own labels.
 */
export function rowLabel(symbol: string, name: string | null | undefined, price: QueuePrice | undefined): string {
  const parts = [symbol];
  if (name) parts.push(name);
  const cell = priceCell(price);
  if (cell.kind === 'loading') parts.push('price loading');
  else parts.push(cell.text === NO_PRICE ? 'price unavailable' : cell.text);
  return parts.join(', ');
}
