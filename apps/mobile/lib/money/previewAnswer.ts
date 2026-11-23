/**
 * previewAnswer: reads record-trade's preview reply (pure; recordTrade.ts does the call).
 *
 * Three outcomes, kept apart:
 *   - ok: the preview body (funding, the slot map, and given a price the slot a buy would fill);
 *   - refused, not_draftable: the server's preview now answers as the buy would for a stock the buy refuses
 *     (docs/plans/2026-11-18-stocks-tab.md, part 3, point 7, corrected 2026-11-23). The sheet words it with
 *     the buy's own mapper (refusals.ts), so the two sentences cannot drift;
 *   - null: anything else. That includes both pacing answers, on purpose: the per-minute 429 `rate_limited`
 *     (an invoke error) and the hour/day cap's 200 `preview_limited` (record-trade/preview-gate.ts) keep
 *     today's wording (COPY.cantReach). The app's one pacing sentence talks about trades and is wrong for an
 *     hourly limit; the Design Lead's words for preview_limited go to Giorgio first. Only reasons listed in
 *     PREVIEW_REFUSALS are ever surfaced.
 */
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
export const PREVIEW_REFUSALS = ['not_draftable'] as const;
export type PreviewRefusal = (typeof PREVIEW_REFUSALS)[number];

export type PreviewAnswer =
  | { kind: 'ok'; preview: PreviewResult }
  | { kind: 'refused'; reason: PreviewRefusal };

/** `supabase.functions.invoke`'s result. A non-2xx (a 429, a 500) arrives as `error`, with no data. */
export function readPreviewAnswer(result: { data: unknown; error: unknown }): PreviewAnswer | null {
  const { data, error } = result;
  if (error || !data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.ok === false) {
    const reason = d.reason;
    return typeof reason === 'string' && (PREVIEW_REFUSALS as readonly string[]).includes(reason)
      ? { kind: 'refused', reason: reason as PreviewRefusal }
      : null;
  }
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
