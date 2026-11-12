/**
 * salePicker: the "Which sale pays for this?" choice (3e, board #money). A
 * per-slot buy is funded from one sale's proceeds. The server's preview names
 * the sources; the picker only appears when there is more than one (the
 * default is the first). Pure: the sheet renders these rows.
 */
import type { PreviewSource } from './buyingPower';
import { COPY } from './moneyCopy';

// Aliased: react-hooks/rules-of-hooks reads any `use…` member call outside a component as a hook call.
const { useSaleButton: saleButtonCopy } = COPY;

export interface PickerRow {
  tradeId: string;
  /** The SOLD stock's symbol (the sale this row names), never the stock being bought. */
  symbol: string;
  /** The slot the sale's cash sits in, e.g. "TSLA slot". */
  label: string;
  amount: number;
  selected: boolean;
}

/** The source a picker opens on: the server's first, or none. */
export function defaultSourceId(sources: PreviewSource[]): string | null {
  return sources[0]?.trade_id ?? null;
}

/** One row per source, in the server's order. Exactly the chosen row is selected. */
export function pickerRows(sources: PreviewSource[], chosenId: string | null): PickerRow[] {
  return sources.map((s) => ({
    tradeId: s.trade_id,
    symbol: s.symbol,
    label: `${s.symbol} slot`,
    amount: s.amount,
    selected: s.trade_id === chosenId,
  }));
}

/**
 * The commit button's label: it names the CHOSEN sale ("Use the MFG sale"), so it follows the choice. It once took the
 * sheet's own symbol, the stock being BOUGHT, and read "Use the BOOT sale" with the MFG sale chosen (phone pass step 34).
 * With no sale chosen the button is disabled and reads the existing "Pick another sale" (no new words).
 */
export function saleButtonLabel(rows: readonly PickerRow[]): string {
  const chosen = rows.find((r) => r.selected);
  return chosen ? saleButtonCopy(chosen.symbol) : COPY.pickAnotherSale;
}
