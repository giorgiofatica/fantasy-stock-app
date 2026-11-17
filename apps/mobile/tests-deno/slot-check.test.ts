/**
 * The automatic slot availability check (PRODUCT_RULES, "The slot availability check runs by itself", 2026-11-17):
 * a short slot blocks Create league / Save; a FAILED lookup and partial enrichment never do; a stale answer is dropped
 * (sequence id); editing a slot clears its own line only; League settings' Save is also gated on draft-control's
 * check_setup, failing open.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  type CheckSlot,
  checkableSlots,
  createLatestGate,
  runSlotCheck,
  slotCheckBlockReason,
  slotCheckFailedNote,
  slotCheckIsStale,
  slotSig,
  visibleSlotLines,
} from '../lib/game/slotCheck.ts';
import { createNextDisabled, stakesStepError } from '../lib/game/createLeagueSteps.ts';
import { saveState } from '../components/shell/sheetBarLogic.ts';
import { type CheckedRules, checkSetupForSave, checkSetupOnServer, proposedSlotsBody, rulesChangedSinceSaved, setupCheckVerdict } from '../lib/game/slotSetupCheck.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const slot = (o: Partial<CheckSlot> = {}): CheckSlot => ({ slotCount: '2', priceMin: '', priceMax: '', categoryId: '', ...o });
const SIZE = 8;
/** 2 slots x 2 = 4 rounds. */
const TWO = [slot(), slot({ priceMax: '50' })];
const deps = (matches: (i: number) => number, partial = false) => {
  const asked: unknown[] = [];
  return {
    asked,
    d: {
      isPartial: async () => partial,
      countMatches: async (q: unknown) => {
        asked.push(q);
        return matches(asked.length - 1);
      },
    },
  };
};

Deno.test('a short slot gets its own line and blocks; a slot that is fine gets nothing', async () => {
  const { d } = deps((i) => (i === 0 ? 9 : 16));
  const r = await runSlotCheck(TWO, SIZE, 4, d);
  assertEquals(r.lines[0], 'Only 9 draftable stocks match — the league needs at least 16.');
  assertEquals(r.lines[1], null);
  assertEquals(r.failed, false);
  const lines = visibleSlotLines(r, TWO, SIZE);
  assertEquals(slotCheckBlockReason(lines), r.lines[0]);
});

Deno.test('short slot => Create league disabled; failed check => not disabled; partial enrichment => not disabled', async () => {
  const blocked = (reason: string | null) => createNextDisabled('stakes', stakesStepError('price_tiers', 2, [], reason));
  const short = await runSlotCheck(TWO, SIZE, 4, deps(() => 3).d);
  assertEquals(blocked(slotCheckBlockReason(visibleSlotLines(short, TWO, SIZE))), true);
  const failed = await runSlotCheck(TWO, SIZE, 4, {
    isPartial: async () => false,
    countMatches: async () => {
      throw new Error('rpc down');
    },
  });
  assertEquals(failed.failed, true);
  assertEquals(blocked(slotCheckBlockReason(visibleSlotLines(failed, TWO, SIZE))), false);
  const partial = await runSlotCheck(TWO, SIZE, 4, deps(() => 0, true).d);
  assertEquals(partial.failed, false);
  assertEquals(blocked(slotCheckBlockReason(visibleSlotLines(partial, TWO, SIZE))), false);
  // The same three for League settings' Save: only a short slot greys it.
  const save = (reason: string | null) => saveState({ dirty: true, saving: false, blocked: reason != null });
  assertEquals(save(slotCheckBlockReason(visibleSlotLines(short, TWO, SIZE))), 'off');
  assertEquals(save(slotCheckBlockReason(visibleSlotLines(failed, TWO, SIZE))), 'on');
  assertEquals(save(slotCheckBlockReason(visibleSlotLines(partial, TWO, SIZE))), 'on');
  // Other stake modes never read the slots (they are not on screen).
  assertEquals(stakesStepError('fixed_notional', 2, [], 'Only 3 draftable stocks match — the league needs at least 16.'), null);
  // Hard errors still come first.
  assertEquals(stakesStepError('price_tiers', 2, ['hard'], 'short'), 'hard');
});

Deno.test('the failed note shows for a failed run only (partial shows nothing)', async () => {
  const failed = await runSlotCheck(TWO, SIZE, 4, {
    isPartial: async () => {
      throw new Error('x');
    },
    countMatches: async () => 0,
  });
  assertEquals(slotCheckFailedNote(failed), true);
  assertEquals(slotCheckFailedNote(await runSlotCheck(TWO, SIZE, 4, deps(() => 0, true).d)), false);
  assertEquals(slotCheckFailedNote(null), false);
});

Deno.test('slots with a hard error are skipped (count, price range); a wrong capacity skips them all', async () => {
  // counts 0 + 2 + 2: the bad-count slot adds nothing, so the capacity is 4.
  const bad = [slot({ slotCount: '0' }), slot({ priceMin: '90', priceMax: '10' }), slot({ slotCount: '2' })];
  assertEquals(checkableSlots(bad, 4), [2]);
  assertEquals(checkableSlots(bad, 5), [], 'capacity 4 vs 5 rounds: nothing is checked');
  const a = deps(() => 0);
  await runSlotCheck(bad, SIZE, 4, a.d);
  assertEquals(a.asked.length, 1, 'only the clean slot is counted');
  const b = deps(() => 0);
  const r = await runSlotCheck(TWO, SIZE, 7, b.d);
  assertEquals(b.asked.length, 0);
  assertEquals(r.lines, [null, null]);
});

Deno.test('editing a slot clears its own line; the others keep theirs until re-checked; a new league size clears all', async () => {
  const r = await runSlotCheck(TWO, SIZE, 4, deps(() => 1).d);
  assertEquals(visibleSlotLines(r, TWO, SIZE).filter(Boolean).length, 2);
  const edited = [slot({ slotCount: '2', priceMin: '5' }), TWO[1]];
  const v = visibleSlotLines(r, edited, SIZE);
  assertEquals(v[0], null);
  assertEquals(v[1], r.lines[1]);
  assertEquals(visibleSlotLines(r, TWO, 10), [null, null]);
});

Deno.test('stale: never checked, edited, new size, failed or partial last time; fresh only when every checkable slot matches', async () => {
  assertEquals(slotCheckIsStale(null, TWO, SIZE, 4), true);
  const ok = await runSlotCheck(TWO, SIZE, 4, deps(() => 99).d);
  assertEquals(slotCheckIsStale(ok, TWO, SIZE, 4), false);
  assertEquals(slotCheckIsStale(ok, [slot({ priceMin: '1' }), TWO[1]], SIZE, 4), true);
  assertEquals(slotCheckIsStale(ok, TWO, 10, 4), true);
  assertEquals(slotCheckIsStale(await runSlotCheck(TWO, SIZE, 4, deps(() => 1, true).d), TWO, SIZE, 4), true);
  assertEquals(slotCheckIsStale(null, [], SIZE, 4), false, 'no slots, nothing to check');
  assertEquals(slotCheckIsStale(null, TWO, SIZE, 7), false, 'wrong capacity: already blocked, nothing to check');
  assertEquals(slotSig(TWO[0], 8), '8|2|||');
});

Deno.test('sequence id: an older answer that lands after a newer one is dropped', async () => {
  const gate = createLatestGate();
  let applied: string | null = null;
  const resolvers: Record<string, (v: string) => void> = {};
  const start = (name: string) => {
    const id = gate.begin();
    const p = new Promise<string>((res) => {
      resolvers[name] = res;
    });
    return p.then((v) => {
      if (gate.isCurrent(id)) applied = v;
    });
  };
  const first = start('first');
  const second = start('second');
  resolvers.second('second');
  await second;
  resolvers.first('first'); // the slow older run lands last
  await first;
  assertEquals(applied, 'second');
  const g2 = createLatestGate();
  const a = g2.begin();
  assertEquals(g2.isCurrent(a), true);
  g2.begin();
  assertEquals(g2.isCurrent(a), false);
});

Deno.test('the hook applies a result only through the gate, re-checks on mount / edits (600 ms) / size, and awaits once more when stale (source guard)', () => {
  const h = SOURCES['lib/game/useSlotCheck.ts'];
  assert(h.includes('if (gate.isCurrent(id)) {') && h.includes('setResult(r);'));
  assert(h.includes('const wait = ranOnce.current ? SLOT_CHECK_DEBOUNCE_MS : 0;'));
  assert(h.includes('if (slotCheckIsStale(r, cur.slots, cur.leagueSize, cur.numRounds)) r = await run();'));
  assertEquals(SOURCES['lib/game/slotCheck.ts'].includes('SLOT_CHECK_DEBOUNCE_MS = 600'), true);
  // The key carries slots, league size and rounds, so any of them re-runs it.
  assert(h.includes('slotSig(s, leagueSize)') && h.includes('[slots, leagueSize, numRounds]'));
});

Deno.test('SlotBuilder: no "Check availability" button, no spinner or success text; the short line is a danger callout in a polite live region inside the slot card', () => {
  const c = SOURCES['components/SlotBuilder.tsx'];
  assertEquals(c.includes('Check availability'), false);
  assertEquals(c.includes('checkFeasibility'), false);
  assertEquals(c.includes('SLOT_PARTIAL_NOTE'), false);
  assert(c.includes('...(check.lines[i] ? [check.lines[i] as string] : [])'));
  assert(c.includes('<View accessibilityLiveRegion="polite" style={styles.slotErrors}>'));
  assert(c.includes('<Text key={k} variant="callout" color={colors.danger}>'));
  // The retry button re-runs the check; it is small and never shown without a failed run.
  assert(c.includes('onPress={check.retry}') && c.includes('size="sm"'));
});

Deno.test('Create league: Create is disabled by the slot reason, and an awaited re-check runs before handleCreate (never skipped)', () => {
  const s = SOURCES['app/create-league.tsx'];
  assert(s.includes('stakesStepError(state.stakeMode, state.slots.length, slotErrors, slotCheck.blockReason)'));
  const at = s.indexOf('const short = await slotCheck.ensureFresh();');
  assert(at > 0 && s.indexOf('handleCreate();', at) > at, 'ensureFresh is awaited before handleCreate');
  assert(s.includes("status={creating || verifying ? 'loading' : 'idle'}"));
  assert(s.includes('if (short || !open.current) return;'), 'a closed screen never goes on to create');
  assert(s.includes("enabled: step === 'stakes' && state.stakeMode === 'price_tiers'"));
});

Deno.test('League settings: Save is grey while a slot is short, and handleSave awaits the client re-check and check_setup BEFORE any write', () => {
  const s = SOURCES['app/league-settings.tsx'];
  assert(s.includes('blocked: slotCheck.blockReason != null'));
  const fresh = s.indexOf('if (await slotCheck.ensureFresh()) return;');
  const server = s.indexOf("checkSetupForSave((body) => seamInvoke('draft-control', { body }), league.id, slots, loaded, rules)");
  const write = s.indexOf('await seamUpdateLeague(league.id, patch)');
  assert(fresh > 0 && server > fresh && write > server, 'client re-check, then check_setup, then the first write');
  assert(s.includes('enabled: !!league && isCommissioner && !isLocked'));
  // The server check runs whenever slots exist, and a blocked verdict stops the save (the red line under Roster slots).
  // The rules passed are the form's own five (plus non-draftable); the baseline is `loaded`, the saved league.
  assert(s.includes('const rules = { numParticipants, numRounds, stakeMode, notionalPerSlot, budgetCap, allowUndraftable };'));
  assert(s.includes('if (verdict.blocked) {\n          setSlotsError(verdict.line);\n          return;'));
});

Deno.test("check_setup: only the two real verdicts block, in the draft blockers card's words; everything else fails OPEN", () => {
  assertEquals(setupCheckVerdict({ data: { ok: false, reason: 'slots_infeasible' } }), { blocked: true, line: "Some slots can't be filled" });
  assertEquals(setupCheckVerdict({ data: { ok: false, reason: 'budget_infeasible' } }), { blocked: true, line: "The budget can't fill every roster" });
  assertEquals(setupCheckVerdict({ data: { ok: true } }), { blocked: false });
  assertEquals(setupCheckVerdict({ data: { ok: false, reason: 'feasibility_unavailable' } }), { blocked: false });
  assertEquals(setupCheckVerdict({ data: { ok: false, reason: 'rate_limited' } }), { blocked: false });
  assertEquals(setupCheckVerdict({ data: null, error: new Error('FunctionsHttpError') }), { blocked: false });
  assertEquals(setupCheckVerdict(undefined), { blocked: false });
});

Deno.test('check_setup request: league_id, action, and the proposed slots in the shape the function reads; a thrown transport error is open', async () => {
  let sent: { fn: string; body: Record<string, unknown> } | null = null;
  const v = await checkSetupOnServer(
    async (body) => {
      sent = { fn: 'draft-control', body };
      return { data: { ok: false, reason: 'slots_infeasible' } };
    },
    'L1',
    [slot({ slotCount: '3', priceMin: '5', categoryId: 'c9' })],
  );
  assertEquals(v.blocked, true);
  assertEquals(sent, {
    fn: 'draft-control',
    body: { league_id: 'L1', action: 'check_setup', slots: [{ slot_count: 3, price_min: 5, price_max: null, category_id: 'c9' }] },
  });
  assertEquals(
    await checkSetupOnServer(
      async () => {
        throw new Error('network');
      },
      'L1',
      [slot()],
    ),
    { blocked: false },
  );
  assertEquals(proposedSlotsBody([slot({ slotCount: '' })])[0].slot_count, 1);
});

const SAVED: CheckedRules = { numParticipants: 12, numRounds: 6, stakeMode: 'budget_cap', notionalPerSlot: '1000', budgetCap: '2500', allowUndraftable: false };
const refusing = async () => ({ data: { ok: false, reason: 'budget_infeasible' } });

Deno.test('P1: a changed budget, Teams, rounds, stakes, per-slot stake or non-draftable switch makes NO server call and fails OPEN', async () => {
  const changes: Partial<CheckedRules>[] = [
    { budgetCap: '5000' },
    { numParticipants: 8 },
    { numRounds: 5 },
    { stakeMode: 'price_tiers' },
    { notionalPerSlot: '2000' },
    { allowUndraftable: true },
  ];
  for (const change of changes) {
    let calls = 0;
    const v = await checkSetupForSave(async (b) => { calls++; return refusing(b); }, 'L1', [slot()], SAVED, { ...SAVED, ...change });
    assertEquals(calls, 0, JSON.stringify(change));
    assertEquals(v, { blocked: false }, JSON.stringify(change));
    assertEquals(rulesChangedSinceSaved(SAVED, { ...SAVED, ...change }), true);
  }
});

Deno.test('P1: with the rules unchanged the server is asked, and a real refusal blocks; no slots or no loaded league: no call, open', async () => {
  let calls = 0;
  const invoke = async (b: Record<string, unknown>) => { calls++; return refusing(b); };
  assertEquals((await checkSetupForSave(invoke, 'L1', [slot()], SAVED, { ...SAVED })).blocked, true);
  assertEquals(calls, 1);
  // The same numbers typed differently (a leading zero, a trailing space) are not a change.
  assertEquals(rulesChangedSinceSaved(SAVED, { ...SAVED, budgetCap: '02500' }), false);
  assertEquals(await checkSetupForSave(invoke, 'L1', [], SAVED, { ...SAVED }), { blocked: false });
  assertEquals(await checkSetupForSave(invoke, 'L1', [slot()], null, { ...SAVED }), { blocked: false });
  assertEquals(calls, 1);
});
