/**
 * tradeFill: what record-trade actually filled, read from its reply.
 *
 * record-trade answers { ok: true, trade }, where `trade` is the inserted
 * `trades` row (to_jsonb of record_trade_atomic's row). The server writes
 * total_value = round(price * quantity, 2) from the fill price it sized the
 * trade at, and every ledger surface (the slot line "$X from your TM sale is
 * ready to invest", Review buy's "Paid from" source) reads that same stored
 * total_value. So the confirmation takes its dollars from `total_value`, not
 * from quantity * price re-derived here: the two can differ by a sub-cent
 * residual, and that is exactly the cent this file exists to close.
 *
 * A reply with no usable fill (a seam stub, a malformed row) reads as null,
 * and the caller keeps the reviewed estimate: it never invents a number.
 */
export interface TradeFill {
  quantity: number;
  /** The fill price, in cents (trades.price is NUMERIC(10,2)). */
  price: number;
  /** The stored dollars: what the slot line and the ledger show for this trade. */
  total: number;
}

const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

export function readTradeFill(trade: unknown): TradeFill | null {
  if (!trade || typeof trade !== 'object') return null;
  const t = trade as Record<string, unknown>;
  if (!positive(t.quantity) || !positive(t.price) || !positive(t.total_value)) return null;
  return { quantity: t.quantity, price: t.price, total: t.total_value };
}
