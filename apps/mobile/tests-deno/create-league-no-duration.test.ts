/**
 * Create league offers Matchup only (PRODUCT_RULES, "Duration is hidden in Create league until
 * it is built", 2026-11-11, Giorgio picked "A"). The server refuses a new Duration league too
 * (supabase/migrations/20261203000000_refuse_new_duration_leagues.sql), and an insert that
 * omits league_type is refused as well (the column defaults to 'duration'), so the app must
 * always send 'matchup' explicitly.
 *
 *   deno test apps/mobile/tests-deno/create-league-no-duration.test.ts
 */
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';
import { SOURCES } from './sourceManifest.generated.ts';
import { DURATION_OPTIONS, DURATION_TYPE_OPTION } from '../lib/game/createLeagueSteps.ts';

const src = SOURCES['app/create-league.tsx'];
// Comments say why Duration is gone; only the code is judged.
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

Deno.test('Create league: the type choices are Matchup alone', () => {
  const m = code.match(/const TYPE_OPTIONS[^=]*=\s*\[([\s\S]*?)\];/);
  assert(m, 'TYPE_OPTIONS is where it was');
  assertEquals([...m[1].matchAll(/value:\s*'([a-z_]+)'/g)].map((x) => x[1]), ['matchup']);
});

Deno.test('Create league: no Duration state, sub-step or summary value is left', () => {
  assertFalse(/duration/i.test(code.replace(/duration_days:\s*30,/, '')), 'no other mention of duration in the code');
  assertFalse(code.includes('DURATION_OPTIONS'), 'the lengths sub-step is gone');
  assert(code.includes('<SettingRow label="Type" value="Matchup" />'), 'the summary row says Matchup');
});

Deno.test("Create league: the insert always sends league_type 'matchup', never a state value", () => {
  const ins = code.match(/seamInsertLeague\(\{([\s\S]*?)\}\);/);
  assert(ins, 'the insert is where it was');
  const typeLines = ins[1].split('\n').filter((l) => /league_type/.test(l));
  assertEquals(typeLines.map((l) => l.trim()), ["league_type: 'matchup',"]);
  // duration_days is NOT NULL + CHECK in (7,30,90,180,365): the column default, constant.
  assertEquals(ins[1].split('\n').filter((l) => /duration_days/.test(l)).map((l) => l.trim()), ['duration_days: 30,']);
});

Deno.test('the Duration copy is kept, unused, for when Duration is built', () => {
  assertEquals(DURATION_TYPE_OPTION.infoLine, 'One race for the whole league. The biggest gain at the end wins.');
  assertEquals(DURATION_OPTIONS.map((d) => d.value), [7, 30, 90, 180, 365]);
  for (const [path, text] of Object.entries(SOURCES)) {
    if (path === 'lib/game/createLeagueSteps.ts') continue;
    const live = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assertFalse(/\bDURATION_TYPE_OPTION\b/.test(live), `${path} uses DURATION_TYPE_OPTION`);
  }
});
