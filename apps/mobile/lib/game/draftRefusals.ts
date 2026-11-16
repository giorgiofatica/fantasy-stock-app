/**
 * draftRefusals (3c): a stalled draft turn (auto-pick found no legal stock).
 * It is shown as waiting, never as a pick, with the board's ruled copy (#game
 * "Draft paused"). The pick refusals live in
 * draftRoom.pickRefusalLine and the setup blockers in autoStart.blockerClause;
 * the placeholder copy this module used to hold is gone (P0, Design Lead audit).
 */

export interface TurnState {
  kind: 'normal' | 'stalled';
  /** The card's tag ("Draft paused"); null for a normal turn. */
  tag: string | null;
  /** The turn's waiting title; null for a normal turn. */
  label: string | null;
}

/** A stalled turn is waiting, never a fake pick (board #game "Draft paused";
 * the audit's Rule 8 table, ruled). `managerName` is the manager on the clock;
 * with no name the headline is "No stock left fits the next open slot" (ruling:
 * not "the next manager's next slot"). No line under it (UX rule 12; PRODUCT_RULES
 * "Nobody is notified"): the tag, the headline and the round line say it. */
export function turnState(input: { reason: string | null; pickNumber: number; managerName?: string }): TurnState {
  if (input.reason === 'stalled') {
    const who = input.managerName?.trim();
    return {
      kind: 'stalled',
      tag: 'Draft paused',
      label: who ? `No stock left fits ${who}'s next slot` : 'No stock left fits the next open slot',
    };
  }
  return { kind: 'normal', tag: null, label: null };
}
