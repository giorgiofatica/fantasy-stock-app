/**
 * DEV-only capture knob for the slot check's stills (2026-11-17). EXPO_PUBLIC_SLOT_FIXTURE=short|failed seeds the price-tier
 * slots and feeds the check's per-slot COUNT read (the same seam as the other fixtures, at the data source), so the REAL check,
 * blocking and Save/Create gating draw the states: nothing about the UI is faked.
 *  - short:  the $100-and-up slot matches 9 stocks (an 8-team league with 2 per team needs 16); the others have plenty.
 *  - failed: the lookup throws, as it does against a dead server.
 * Pure (never mentions `__DEV__`); lib/shell/captureDev.ts is the one file that reads it, so a release bundle never does.
 */
export type SlotFixture = 'short' | 'failed';

export function parseSlotFixture(dev: boolean, raw: string | undefined): SlotFixture | null {
  if (!dev) return null;
  return raw === 'short' || raw === 'failed' ? raw : null;
}

/** Three slots of two stocks: the six rounds a league drafts by default. Slot 3 is the one the "short" fixture starves (last, so its line sits by the footer). */
export const FIXTURE_SLOTS = [
  { slotCount: '2', priceMin: '', priceMax: '20', categoryId: '' },
  { slotCount: '2', priceMin: '20', priceMax: '100', categoryId: '' },
  { slotCount: '2', priceMin: '100', priceMax: '', categoryId: '' },
];

export const FIXTURE_SHORT_MATCHES = 9;

/** The fixture's answer for one slot's count. */
export function fixtureCountMatches(kind: SlotFixture, q: { priceMin: number | null }): number {
  if (kind === 'failed') throw new Error('slot count: fixture failure');
  return q.priceMin === 100 ? FIXTURE_SHORT_MATCHES : 999;
}
