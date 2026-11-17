/**
 * League settings' Save asks the server (draft-control `check_setup`, commissioner only, an existing league) whether the PROPOSED
 * slots can be filled: the exact max-flow check, which also catches overlapping slots and the budget reserve that the
 * client's per-slot count cannot. Create league has no league yet, so it only has the client's per-slot count (slotCheck.ts).
 *
 * It fails OPEN on the client: `feasibility_unavailable`, any other reason, a non-2xx, a throw: Save goes on (the draft's own
 * start check stays the backstop). Only the server's two real verdicts block, in the words the draft blockers card already uses.
 */
import { blockerTitle } from './autoStart';

export interface ProposedSlot {
  slotCount: string;
  priceMin: string;
  priceMax: string;
  categoryId: string;
}

/** The request's `slots`, in the shape check_setup reads (and saveLeagueSlots writes). */
export function proposedSlotsBody(slots: readonly ProposedSlot[]) {
  return slots.map((s) => ({
    slot_count: Math.max(1, Number(s.slotCount) || 1),
    price_min: s.priceMin === '' ? null : Number(s.priceMin),
    price_max: s.priceMax === '' ? null : Number(s.priceMax),
    category_id: s.categoryId || null,
  }));
}

export type SetupVerdict = { blocked: false } | { blocked: true; line: string };

const OPEN: SetupVerdict = { blocked: false };

/** The server's answer as a verdict. Blocks only on `ok:false` with slots_infeasible / budget_infeasible. */
export function setupCheckVerdict(res: { data?: unknown; error?: unknown } | null | undefined): SetupVerdict {
  if (!res || res.error) return OPEN;
  const d = res.data as { ok?: unknown; reason?: unknown } | null | undefined;
  if (d?.ok !== false) return OPEN;
  if (d.reason === 'slots_infeasible' || d.reason === 'budget_infeasible') {
    return { blocked: true, line: blockerTitle({ code: d.reason }) };
  }
  return OPEN;
}

/** The caller makes the call (`seamInvoke('draft-control', { body })`), so its function name stays a literal at the call site. */
type Invoke = (body: Record<string, unknown>) => Promise<{ data?: unknown; error?: unknown }>;

/** One check_setup call. Never throws; a transport error is an open verdict. */
export async function checkSetupOnServer(invoke: Invoke, leagueId: string, slots: readonly ProposedSlot[]): Promise<SetupVerdict> {
  try {
    return setupCheckVerdict(await invoke({ league_id: leagueId, action: 'check_setup', slots: proposedSlotsBody(slots) }));
  } catch {
    return OPEN;
  }
}
