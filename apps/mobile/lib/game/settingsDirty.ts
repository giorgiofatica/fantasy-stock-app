// "Dirty": has the League settings form changed from what was loaded? It drives the top bar's Save (grey until a change, then
// the accent; Giorgio, 2026-11-12, "it is greyed out until you make a change"). Derived by COMPARING the form against the
// loaded values, never a "touched" flag, so changing a value back to its original makes Save grey again. Pure, for tests-deno.

export interface SlotForm {
  slotCount: string;
  priceMin: string;
  priceMax: string;
  categoryId: string;
}

/** Everything League settings lets the commissioner change, in the shape the form holds it. */
export interface SettingsForm {
  name: string;
  draftDateTBD: boolean;
  /** The chosen draft time (epoch ms), null when it is "TBD". */
  draftDateMs: number | null;
  /** '' = no stake mode chosen yet. */
  stakeMode: string;
  notionalPerSlot: string;
  budgetCap: string;
  allowUndraftable: boolean;
  numParticipants: number;
  numRounds: number;
  pickSeconds: number;
  slots: SlotForm[];
}

function sameSlots(a: SlotForm[], b: SlotForm[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((s, i) => s.slotCount === b[i].slotCount && s.priceMin === b[i].priceMin && s.priceMax === b[i].priceMax && s.categoryId === b[i].categoryId);
}

/** Whether `current` differs from `loaded`. Null `loaded` (the league has not arrived yet) is never a change. The name compares
 * trimmed, as it is saved: a stray trailing space does not turn Save on. The draft time counts only while it is set (TBD has none). */
export function settingsDirty(loaded: SettingsForm | null, current: SettingsForm): boolean {
  if (!loaded) return false;
  if (loaded.name.trim() !== current.name.trim()) return true;
  if (loaded.draftDateTBD !== current.draftDateTBD) return true;
  if (!current.draftDateTBD && loaded.draftDateMs !== current.draftDateMs) return true;
  if (loaded.stakeMode !== current.stakeMode) return true;
  if (loaded.notionalPerSlot !== current.notionalPerSlot) return true;
  if (loaded.budgetCap !== current.budgetCap) return true;
  if (loaded.allowUndraftable !== current.allowUndraftable) return true;
  if (loaded.numParticipants !== current.numParticipants) return true;
  if (loaded.numRounds !== current.numRounds) return true;
  if (loaded.pickSeconds !== current.pickSeconds) return true;
  return !sameSlots(loaded.slots, current.slots);
}
