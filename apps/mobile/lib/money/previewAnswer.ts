/**
 * previewAnswer: reads record-trade's preview reply (pure; recordTrade.ts does the call).
 *
 * The outcomes, kept apart:
 *   - ok: the preview body (funding, the slot map, and given a price the slot a buy would fill);
 *   - refused, not_draftable: the preview answers as the buy would for a stock the buy refuses
 *     (docs/plans/2026-11-18-stocks-tab.md, part 3, point 7). The sheet words it with the buy's own
 *     mapper (refusals.ts), so the two sentences cannot drift;
 *   - refused, paced: the per-minute limiter's 429 `rate_limited` (an invoke error; its body is read the way
 *     the buy reads it, functionRefusal.ts) and the hour/day cap's 200 `preview_limited`. Each gets an
 *     approved "Too many tries" line (pacedPreviewLine; PRODUCT_RULES "Too many taps on 'Review buy'", B);
 *   - null: anything else (a transport failure, a 5xx, any other reason): "Couldn't reach trading".
 * Only reasons listed here are ever surfaced. A `rate_limited` counts only as the edge limiter's 429.
 */
import { functionOk, readFunctionRefusal } from '../functionRefusal';
import { TOO_MANY_TRIES_LATER, TOO_MANY_TRIES_WAIT } from '../tooManyTries';
import { parsePreviewSlots, parseSlotShape, type PreviewSlot, type SlotShape } from './tierContract';

export interface PreviewResult {
  stakeMode: string | null;
  stake: number | null;
  unfilledSlots: number;
  sources: { trade_id: string; symbol: string; amount: number }[];
  /** The caller's slot map (every slotted league); null when it can't be read. */
  slots: PreviewSlot[] | null;
  /** Only when the check was asked: the slot the buy would fill, or null (refused). */
  wouldFill?: SlotShape | null;
  /** With wouldFill null: the open slots the refusal names. */
  openSlots?: SlotShape[];
}

/** The preview refusals the app words. Every other refusal reads as "couldn't reach" (null). */
export type PreviewRefusal = 'not_draftable' | 'rate_limited' | 'preview_limited';

export type PreviewAnswer =
  | { kind: 'ok'; preview: PreviewResult }
  | { kind: 'refused'; reason: PreviewRefusal };

/** A paced buy review's line: the short wait for the per-minute limit, the long one for the hour/day cap.
 * Null for any other reason. The approved lines are shared (lib/tooManyTries.ts), never copied. */
export function pacedPreviewLine(reason: PreviewRefusal): string | null {
  if (reason === 'rate_limited') return TOO_MANY_TRIES_WAIT;
  if (reason === 'preview_limited') return TOO_MANY_TRIES_LATER;
  return null;
}

/** `supabase.functions.invoke`'s result. A non-2xx (a 429, a 500) arrives as `error`, its body on the Response. */
export async function readPreviewAnswer(result: { data: unknown; error: unknown }): Promise<PreviewAnswer | null> {
  const r = await readFunctionRefusal(result.data, result.error);
  if (r.transport) return null;
  if (!functionOk(r)) {
    if (r.reason === 'not_draftable' && r.status === null) return { kind: 'refused', reason: 'not_draftable' };
    if (r.reason === 'preview_limited' && r.status === null) return { kind: 'refused', reason: 'preview_limited' };
    if (r.reason === 'rate_limited' && r.status === 429) return { kind: 'refused', reason: 'rate_limited' };
    return null;
  }
  const d = r.body;
  if (d.ok !== true || !Array.isArray(d.sources)) return null;
  const sources: PreviewResult['sources'] = [];
  for (const s of d.sources as unknown[]) {
    const o = s as Record<string, unknown>;
    if (typeof o.trade_id !== 'string' || typeof o.symbol !== 'string' || typeof o.amount !== 'number') return null;
    sources.push({ trade_id: o.trade_id, symbol: o.symbol, amount: o.amount });
  }
  const preview: PreviewResult = {
    stakeMode: typeof d.stake_mode === 'string' ? d.stake_mode : null,
    stake: typeof d.stake === 'number' ? d.stake : null,
    unfilledSlots: typeof d.unfilled_slots === 'number' ? d.unfilled_slots : 0,
    sources,
    slots: parsePreviewSlots(d.slots ?? []),
  };
  if ('would_fill' in d) {
    preview.wouldFill = d.would_fill == null ? null : parseSlotShape(d.would_fill);
    const open = Array.isArray(d.open_slots) ? d.open_slots.map(parseSlotShape) : [];
    preview.openSlots = open.every((x) => x !== null) ? (open as SlotShape[]) : [];
  }
  return { kind: 'ok', preview };
}
