import { resolveMoneyFixture } from './fixtureMode';
/**
 * DEV-ONLY money fixtures (3e), for the simulator captures of the P0 stress
 * set. Same safety model as lib/home/devFixture.ts: read only under __DEV__,
 * gated by an env var, and never imported by a deno test (the RN global __DEV__
 * can't resolve under deno). Production never sees a fixture.
 */
export const MONEY_FIXTURE_CONFIG = resolveMoneyFixture(__DEV__, {
  stress: process.env.EXPO_PUBLIC_MONEY_FIXTURE,
  scenario: process.env.EXPO_PUBLIC_MONEY_SCENARIO,
  stake: process.env.EXPO_PUBLIC_MONEY_STAKE,
});

export const MONEY_FIXTURE: 'stress' | null = MONEY_FIXTURE_CONFIG ? 'stress' : null;

if (MONEY_FIXTURE_CONFIG) {
  console.warn(`[dev] MONEY FIXTURE stress (${MONEY_FIXTURE_CONFIG.scenario}, ${MONEY_FIXTURE_CONFIG.stake}): no ledger, price, preview or trade network calls.`);
}

/**
 * DEV-ONLY chart-state knobs for the six-range captures (never in a release bundle: __DEV__ and the env
 * var are both required, and nothing reads them but the two call sites named here). They set a REAL input of
 * the same code path, never the output:
 *   - EXPO_PUBLIC_MONEY_PRE_DRAFT=1: the stock sheet's league has not finished its draft (draftDone is false,
 *     so seasonStart is null and Season is grey), as a league mid-draft or no league at all.
 *   - EXPO_PUBLIC_MONEY_RECENT_BARS=N: the stress fixture's price history is only its last N daily bars (a
 *     recent listing), so every range longer than that history is grey by the one greying helper.
 */
export const MONEY_PRE_DRAFT: boolean = __DEV__ && process.env.EXPO_PUBLIC_MONEY_PRE_DRAFT === '1';
const recentBars = __DEV__ ? Number(process.env.EXPO_PUBLIC_MONEY_RECENT_BARS) : NaN;
export const MONEY_RECENT_BARS: number | null = Number.isInteger(recentBars) && recentBars > 0 ? recentBars : null;
