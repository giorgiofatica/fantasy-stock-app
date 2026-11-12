/**
 * League settings' Save (Giorgio, 2026-11-12: "it is greyed out until you make a change and then you click save when it
 * populates"). "Dirty" is derived by comparing the form against what was loaded, never a "touched" flag, so changing a value back
 * to its original makes Save grey again. Save's state follows (components/shell/sheetBarLogic.ts).
 * Run: `cd apps/mobile && deno test --no-check --sloppy-imports --allow-read --allow-env --unstable-raw-imports tests-deno/`
 */
import { assertEquals } from 'jsr:@std/assert';
import { settingsDirty, type SettingsForm } from '../lib/game/settingsDirty.ts';
import { saveInert, saveState } from '../components/shell/sheetBarLogic.ts';

const T0 = Date.UTC(2026, 10, 20, 23, 0);
const loaded = (): SettingsForm => ({
  name: 'Serie A Traders',
  draftDateTBD: false,
  draftDateMs: T0,
  stakeMode: 'fixed_notional',
  notionalPerSlot: '1000',
  budgetCap: '100000',
  allowUndraftable: false,
  numParticipants: 8,
  numRounds: 6,
  pickSeconds: 60,
  slots: [{ slotCount: '2', priceMin: '', priceMax: '', categoryId: '' }],
});
const with_ = (patch: Partial<SettingsForm>): SettingsForm => ({ ...loaded(), ...patch });

Deno.test('dirty: the form as loaded is not a change, and neither is a form that has not loaded yet', () => {
  assertEquals(settingsDirty(loaded(), loaded()), false);
  assertEquals(settingsDirty(null, with_({ name: 'Anything' })), false);
});

Deno.test('dirty: each field the commissioner can change turns Save on, and putting it back turns it off', () => {
  const edits: Record<string, Partial<SettingsForm>> = {
    name: { name: 'Serie A Legends' },
    'draft time set later': { draftDateTBD: true, draftDateMs: null },
    'draft time moved': { draftDateMs: T0 + 3_600_000 },
    'stake mode': { stakeMode: 'budget_cap' },
    'stake per slot': { notionalPerSlot: '2000' },
    'budget cap': { budgetCap: '50000' },
    'non-draftable': { allowUndraftable: true },
    teams: { numParticipants: 10 },
    rounds: { numRounds: 7 },
    'pick clock': { pickSeconds: 90 },
    'slot count': { slots: [{ slotCount: '3', priceMin: '', priceMax: '', categoryId: '' }] },
    'slot added': { slots: [...loaded().slots, { slotCount: '1', priceMin: '100', priceMax: '200', categoryId: '' }] },
    'slot removed': { slots: [] },
  };
  for (const [what, patch] of Object.entries(edits)) {
    assertEquals(settingsDirty(loaded(), with_(patch)), true, `${what}: a change turns Save on`);
    // Reverting is a fresh form equal to the loaded one again, with no memory of the edit.
    assertEquals(settingsDirty(loaded(), loaded()), false, `${what}: back to the original, Save is grey`);
  }
});

Deno.test('dirty: a name typed and then retyped to the original is not a change; surrounding spaces are not either', () => {
  assertEquals(settingsDirty(loaded(), with_({ name: 'Serie A Traders!' })), true);
  assertEquals(settingsDirty(loaded(), with_({ name: 'Serie A Traders' })), false);
  assertEquals(settingsDirty(loaded(), with_({ name: '  Serie A Traders  ' })), false, 'saved trimmed, so not a change');
  assertEquals(settingsDirty(loaded(), with_({ name: '' })), true, 'a blank name is a change (Save then shows the name error)');
});

Deno.test('dirty: a draft time set later has no time to compare; a time chosen again as the same instant is not a change', () => {
  const tbd = { ...loaded(), draftDateTBD: true, draftDateMs: null };
  assertEquals(settingsDirty(tbd, { ...tbd, draftDateMs: T0 }), false, 'a stale time under TBD is ignored');
  assertEquals(settingsDirty(tbd, with_({})), true, 'TBD -> a time');
  assertEquals(settingsDirty(loaded(), with_({ draftDateMs: T0 })), false);
});

Deno.test('Save state: off until a change, on after it, off again after reverting; saving is inert whatever the form says', () => {
  const states = [false, true, false].map((dirty) => saveState({ dirty, saving: false }));
  assertEquals(states, ['off', 'on', 'off']);
  assertEquals(saveState({ dirty: true, saving: true }), 'saving');
  assertEquals(saveState({ dirty: false, saving: true }), 'saving');
});

Deno.test('Save state: only `on` can be tapped (off and saving are inert, read as dimmed)', () => {
  assertEquals(saveInert('off'), true);
  assertEquals(saveInert('saving'), true);
  assertEquals(saveInert('on'), false);
});

Deno.test('Save state follows the form through a rename: loaded -> typed -> retyped back', () => {
  let name = 'Serie A Traders';
  const save = () => saveState({ dirty: settingsDirty(loaded(), with_({ name })), saving: false });
  assertEquals(save(), 'off');
  name = 'Serie A Traders 2';
  assertEquals(save(), 'on');
  name = 'Serie A Traders';
  assertEquals(save(), 'off');
});
