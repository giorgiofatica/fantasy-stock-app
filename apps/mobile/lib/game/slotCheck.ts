/**
 * The automatic slot availability check (PRODUCT_RULES, "The slot availability check runs by itself", 2026-11-17).
 * Pure: the two reads (enrichment coverage, per-slot match count) are injected, so the rules are testable without
 * supabase. lib/game/useSlotCheck.ts is the hook that runs this on a timer.
 *
 *  - A slot that cannot be filled gets its line in its own card and BLOCKS Create league / Save.
 *  - A FAILED lookup never blocks (it shows a note and a "Try again"); partial enrichment shows nothing and never blocks.
 *  - A result is per slot and tagged with that slot's signature, so editing a slot clears its own line while the others
 *    keep theirs until re-checked; a result is also "stale" for a slot whose signature moved (an unchecked slot, a new
 *    league size), which is what the awaited check before Create / Save looks at.
 */
import { slotConfigIssues, slotShort, slotShortfallCopy } from './slotBuilderCopy';

/** The check runs this long after the last slot edit settles. */
export const SLOT_CHECK_DEBOUNCE_MS = 600;

export interface CheckSlot {
  slotCount: string;
  priceMin: string;
  priceMax: string;
  categoryId: string;
}

/** Everything one slot's verdict depends on: its four fields and the league size. */
export function slotSig(slot: CheckSlot, leagueSize: number): string {
  return [leagueSize, slot.slotCount, slot.priceMin, slot.priceMax, slot.categoryId].join('|');
}

/** One run's outcome. `sigs[i]` is the signature slot i was checked at (null = not covered by this run), `lines[i]` its
 * short line. `failed`: the lookup itself failed. */
export interface SlotCheckResult {
  sigs: (string | null)[];
  lines: (string | null)[];
  failed: boolean;
}

export interface SlotCheckDeps {
  /** True while the enrichment cron has not covered the symbols: per-slot counts are noise, so nothing is checked. */
  isPartial: () => Promise<boolean>;
  countMatches: (q: { priceMin: number | null; priceMax: number | null; categoryId: string | null }) => Promise<number>;
}

/** The slots a check looks at: skipped when they have a hard error (count, price range) and all of them while the
 * capacity (total stocks vs rounds) is wrong, since those are already shown and block. */
export function checkableSlots(slots: readonly CheckSlot[], numRounds: number): number[] {
  const issues = slotConfigIssues(slots, numRounds);
  if (issues.capacity) return [];
  const bad = new Set(issues.slots.map((x) => x.slot));
  return slots.map((_, i) => i).filter((i) => !bad.has(i));
}

const EMPTY = (n: number): SlotCheckResult => ({ sigs: Array(n).fill(null), lines: Array(n).fill(null), failed: false });

/** One check of every checkable slot. A throw anywhere is `failed` (never a block); partial enrichment is an empty,
 * uncovered result (shows nothing, never blocks, and is re-run next time rather than trusted). */
export async function runSlotCheck(
  slots: readonly CheckSlot[],
  leagueSize: number,
  numRounds: number,
  deps: SlotCheckDeps,
): Promise<SlotCheckResult> {
  const result = EMPTY(slots.length);
  const todo = checkableSlots(slots, numRounds);
  if (todo.length === 0) return result;
  try {
    if (await deps.isPartial()) return result;
    for (const i of todo) {
      const s = slots[i];
      const matches = await deps.countMatches({
        priceMin: s.priceMin === '' ? null : Number(s.priceMin),
        priceMax: s.priceMax === '' ? null : Number(s.priceMax),
        categoryId: s.categoryId || null,
      });
      result.sigs[i] = slotSig(s, leagueSize);
      if (slotShort(matches, leagueSize, s.slotCount)) result.lines[i] = slotShortfallCopy(matches, leagueSize, s.slotCount);
    }
    return result;
  } catch {
    return { ...EMPTY(slots.length), failed: true };
  }
}

/** The lines to show NOW: a slot's line only while the slot still reads as it did when it was checked, so editing a slot
 * clears its own line and leaves the others. */
export function visibleSlotLines(
  result: SlotCheckResult | null,
  slots: readonly CheckSlot[],
  leagueSize: number,
): (string | null)[] {
  return slots.map((s, i) => (result && result.lines[i] && result.sigs[i] === slotSig(s, leagueSize) ? result.lines[i] : null));
}

/** What blocks Create league / Save: the first short slot's own line, or null. A failed or partial check has no lines, so it
 * never blocks. */
export function slotCheckBlockReason(lines: readonly (string | null)[]): string | null {
  return lines.find((l) => l != null) ?? null;
}

/** The "Couldn't check availability." note shows while the last run failed. */
export function slotCheckFailedNote(result: SlotCheckResult | null): boolean {
  return result?.failed === true;
}

/** True when some checkable slot has no result for what it reads now (never checked, edited since, league size changed, the
 * last run failed or was partial), so the awaited check before Create / Save has to run once more. */
export function slotCheckIsStale(
  result: SlotCheckResult | null,
  slots: readonly CheckSlot[],
  leagueSize: number,
  numRounds: number,
): boolean {
  const todo = checkableSlots(slots, numRounds);
  if (todo.length === 0) return false;
  if (!result) return true;
  return todo.some((i) => result.sigs[i] !== slotSig(slots[i], leagueSize));
}

/** Results are tagged with a sequence id; only the latest run's result is applied, so a slow earlier answer never overwrites a
 * newer one. */
export function createLatestGate() {
  let latest = 0;
  return {
    begin: (): number => ++latest,
    isCurrent: (id: number): boolean => id === latest,
  };
}
