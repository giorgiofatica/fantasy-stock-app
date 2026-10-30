/**
 * The feature switches the real builds ship with (eas.json `preview` + `production`).
 * Build 1.3.0 (5) shipped without EXPO_PUBLIC_LEAVE_LEAGUE, so Leave league was off and (worse) League
 * settings was unreachable in season. Giorgio ruled 2026-10-30: Leave league is ON in 1.3.
 * Run: `cd apps/mobile/tests-deno && deno test --allow-read .`
 */
import { assertEquals } from 'jsr:@std/assert';
import { leaveLeagueEnabled } from '../lib/game/leaveLeague.ts';
import { runItBackEnabled } from '../lib/game/renewal.ts';

const eas = JSON.parse(await Deno.readTextFile(new URL('../eas.json', import.meta.url)));

for (const profile of ['preview', 'production']) {
  Deno.test(`the ${profile} build turns Leave league and Run it back on`, () => {
    const env = eas.build[profile].env ?? {};
    assertEquals(leaveLeagueEnabled(env.EXPO_PUBLIC_LEAVE_LEAGUE), true);
    assertEquals(runItBackEnabled(env.EXPO_PUBLIC_RUN_IT_BACK), true);
  });
}
