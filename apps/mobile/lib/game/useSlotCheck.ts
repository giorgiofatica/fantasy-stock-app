/**
 * useSlotCheck: the automatic slot availability check (rules and pure parts in ./slotCheck.ts). It runs
 *  - on mount when slots exist (at once),
 *  - SLOT_CHECK_DEBOUNCE_MS after any slot edit settles, and when the league size or rounds change,
 *  - and once more, awaited, from `ensureFresh` before Create league / Save when the last result is stale.
 * It never shows a spinner or a success: the screen reads `lines` (a short slot's own line), `failed` (the note +
 * "Try again") and `blockReason` (what disables Create league / Save).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { countSlotMatches, fetchEnrichmentProgress } from '@/lib/categoryData';
import {
  type CheckSlot,
  type SlotCheckDeps,
  type SlotCheckResult,
  SLOT_CHECK_DEBOUNCE_MS,
  createLatestGate,
  runSlotCheck,
  slotCheckBlockReason,
  slotCheckFailedNote,
  slotCheckIsStale,
  slotSig,
  visibleSlotLines,
} from './slotCheck';

const LIVE_DEPS: SlotCheckDeps = {
  isPartial: async () => (await fetchEnrichmentProgress()).partial,
  countMatches: countSlotMatches,
};

export interface SlotCheck {
  /** Per slot: its short line, or null. */
  lines: (string | null)[];
  /** The last lookup failed: show the note and a "Try again". Never blocks. */
  failed: boolean;
  /** The first short slot's line: disables Create league / Save while set. */
  blockReason: string | null;
  /** Runs the check now (the "Try again" button). */
  retry: () => void;
  /** Before Create league / Save: re-checks once, awaited, if the last result is stale; resolves with the block reason. */
  ensureFresh: () => Promise<string | null>;
}

export function useSlotCheck(args: {
  slots: readonly CheckSlot[];
  leagueSize: number;
  numRounds: number;
  /** Off while the slots are not on screen (another stake mode) or not editable yet. */
  enabled: boolean;
  deps?: SlotCheckDeps;
}): SlotCheck {
  const { slots, leagueSize, numRounds, enabled } = args;
  const deps = args.deps ?? LIVE_DEPS;
  const [result, setResult] = useState<SlotCheckResult | null>(null);
  const gate = useRef(createLatestGate()).current;
  // The newest inputs and result, for the async paths below (a timer or an awaited call must not read a stale closure).
  const latest = useRef({ slots, leagueSize, numRounds, enabled, result });
  latest.current = { slots, leagueSize, numRounds, enabled, result };

  const run = useCallback(async (): Promise<SlotCheckResult> => {
    const cur = latest.current;
    const id = gate.begin();
    const r = await runSlotCheck(cur.slots, cur.leagueSize, cur.numRounds, deps);
    if (gate.isCurrent(id)) {
      latest.current.result = r;
      setResult(r);
    }
    return r;
  }, [gate, deps]);

  // Everything the verdict depends on, as one key: an edit, an add or remove, a new league size or rounds.
  const key = useMemo(() => `${numRounds}#${slots.map((s) => slotSig(s, leagueSize)).join(';')}`, [slots, leagueSize, numRounds]);
  const ranOnce = useRef(false);
  useEffect(() => {
    if (!enabled || slots.length === 0) {
      ranOnce.current = false;
      gate.begin(); // drops any answer still in flight
      setResult(null);
      return;
    }
    const wait = ranOnce.current ? SLOT_CHECK_DEBOUNCE_MS : 0;
    ranOnce.current = true;
    const t = setTimeout(() => void run(), wait);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` already carries slots, size and rounds.
  }, [enabled, key]);

  const ensureFresh = useCallback(async (): Promise<string | null> => {
    const cur = latest.current;
    if (!cur.enabled || cur.slots.length === 0) return null;
    let r = cur.result;
    if (slotCheckIsStale(r, cur.slots, cur.leagueSize, cur.numRounds)) r = await run();
    const now = latest.current;
    return slotCheckBlockReason(visibleSlotLines(r, now.slots, now.leagueSize));
  }, [run]);

  const lines = useMemo(() => visibleSlotLines(result, slots, leagueSize), [result, slots, leagueSize]);
  return {
    lines,
    failed: slotCheckFailedNote(result),
    blockReason: slotCheckBlockReason(lines),
    retry: () => void run(),
    ensureFresh,
  };
}
