/**
 * Create league › Season, B (PRODUCT_RULES, "The Season step in Create league", Giorgio 2026-11-10; board
 * #call-season-step): three identical steppers ("11 wks", VoiceOver "11 weeks"), no line under any label, the
 * season strip (one tile per week, the playoff weeks named with the season chart's chips, "Wk 1" to the last
 * week), one bye line, and NO reason line at a limit (the stepper just greys out). Plus the cuts.
 * Run: `cd apps/mobile && deno test --no-check --sloppy-imports --allow-read --allow-env --unstable-raw-imports tests-deno/season-step.test.ts`
 */
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';
import * as seasonStepModule from '../lib/game/seasonStep.ts';
import {
  UNIFORM_VALUE_WIDTH,
  WEEKS_UNIT_SHOWN,
  WEEKS_UNIT_SPOKEN,
  seasonByeLine,
  seasonStrip,
  stripGap,
  uniformValueWidth,
} from '../lib/game/seasonStep.ts';
import { NBSP, keepWeek } from '../lib/game/keepDots.ts';
import { playoffLine } from '../lib/playoffs.ts';
import { parseCaptureKnobs, parseCreateSeason } from '../lib/shell/captureKnobs.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const chips = (weeks: number, p: number) => seasonStrip(weeks, p).tiles.flatMap((t) => (t.kind === 'playoff' ? [t.chip] : []));
const weekTiles = (weeks: number, p: number) => seasonStrip(weeks, p).tiles.filter((t) => t.kind === 'week').length;

// ── The strip ───────────────────────────────────────────────────────────

Deno.test('strip: Giorgio\'s screen (11 weeks, 5 playoff teams) is 11 week tiles, then WC / SF / F, "Wk 1" to "Wk 14"', () => {
  const s = seasonStrip(11, 5);
  assertEquals(weekTiles(11, 5), 11);
  assertEquals(chips(11, 5), ['WC', 'SF', 'F']);
  assertEquals(s.tiles.map((t) => t.week), Array.from({ length: 14 }, (_, i) => i + 1));
  assertEquals(s.first, 'Wk 1');
  assertEquals(s.last, 'Wk 14');
  assertEquals(s.spoken, 'Season: 11 weeks + 3 playoff weeks');
});

Deno.test('strip: the default league (8 managers, 11 weeks, 4 playoff teams) ends SF / F at "Wk 13"', () => {
  assertEquals(chips(11, 4), ['SF', 'F']);
  assertEquals(seasonStrip(11, 4).last, 'Wk 13');
});

Deno.test('strip: big brackets use QF and R16 (16 managers, 15 weeks)', () => {
  assertEquals(chips(15, 16), ['R16', 'QF', 'SF', 'F']);
  assertEquals(chips(15, 9), ['WC', 'QF', 'SF', 'F']);
  assertEquals(chips(15, 8), ['QF', 'SF', 'F']);
  assertEquals(seasonStrip(15, 16).last, 'Wk 19');
});

Deno.test('strip: two playoff teams is one final week', () => {
  assertEquals(chips(7, 2), ['F']);
  assertEquals(seasonStrip(7, 2).last, 'Wk 8');
});

Deno.test('strip: it follows every step (weeks and playoff teams)', () => {
  assertEquals(weekTiles(12, 5), 12);
  assertEquals(seasonStrip(12, 5).last, 'Wk 15');
  assertEquals(seasonStrip(11, 6).last, 'Wk 14');
  assertEquals(seasonStrip(11, 8).last, 'Wk 14');
  assertEquals(seasonStrip(11, 9).last, 'Wk 15');
});

Deno.test('strip: the gap thins past 24 tiles so a long season keeps its week tiles', () => {
  assertEquals(stripGap(24), 3);
  assertEquals(stripGap(25), 1);
});

Deno.test('strip: "Wk N" is one phrase at any width (keepWeek)', () => {
  assertEquals(keepWeek('Wk 14'), `Wk${NBSP}14`);
  assertEquals(keepWeek(keepWeek('Wk 1')), `Wk${NBSP}1`);
  assertEquals(keepWeek('Wks 4'), 'Wks 4');
});

// ── The bye line ────────────────────────────────────────────────────────

Deno.test('bye line: the playoff line\'s bye clause, as a sentence', () => {
  assertEquals(seasonByeLine(5), 'The top 3 seeds get first-round byes.');
  assertEquals(seasonByeLine(6), 'The top 2 seeds get first-round byes.');
  assertEquals(seasonByeLine(3), 'The top seed gets a first-round bye.');
  assertEquals(seasonByeLine(4), 'No byes.');
  assertEquals(seasonByeLine(16), 'No byes.');
  assertEquals(seasonByeLine(1), null);
});

Deno.test('bye line: the playoff line itself is unchanged (the mirrors hold)', () => {
  assertEquals(playoffLine(5), '5 teams · 3 weeks of playoffs · the top 3 seeds get first-round byes');
  assertEquals(playoffLine(4), '4 teams · 2 weeks of playoffs · no byes');
  assertEquals(playoffLine(3), '3 teams · 2 weeks of playoffs · the top seed gets a first-round bye');
});

// ── The limits: a stepper at its end greys out, and says nothing ────────
// Giorgio picked B on #call-limit-lines (2026-11-11): the weeks floor ("At least N weeks, so every team plays every
// other team once.") and Playoff teams' range ("2 to N, up to your expected managers") are both dropped; Managers never
// had one. No new words, nothing added to the Playoff teams "i".

Deno.test('limits: seasonStep exports no reason helper, and createLeagueSteps keeps neither old line', () => {
  assertEquals(Object.keys(seasonStepModule).filter((k) => /reason|limit|caption/i.test(k)), []);
  const steps = SOURCES['lib/game/createLeagueSteps.ts'];
  for (const gone of ['roundRobinCaption', 'playoffTeamsSub', 'every other team once', 'up to your expected managers']) {
    assertFalse(steps.includes(gone), gone);
  }
});

// ── The steppers ────────────────────────────────────────────────────────

Deno.test('steppers: "wks" on screen, "weeks" for VoiceOver', () => {
  assertEquals(WEEKS_UNIT_SHOWN, 'wks');
  assertEquals(WEEKS_UNIT_SPOKEN, 'weeks');
  const stepper = SOURCES['components/game/Stepper.tsx'];
  assert(stepper.includes('accessibilityValue: { text: valueSpoken },'));
  assert(stepper.includes('const spokenUnit = unitSpoken ?? unit;'));
});

Deno.test('steppers: the value cell is one fixed width per text size, up to the headline cap', () => {
  assertEquals(uniformValueWidth(1), UNIFORM_VALUE_WIDTH);
  assertEquals(uniformValueWidth(1.3), 109);
  assertEquals(uniformValueWidth(1.6), 134);
  assertEquals(uniformValueWidth(3.12), 134);
  assertEquals(uniformValueWidth(Number.NaN), UNIFORM_VALUE_WIDTH);
});

const screen = SOURCES['app/create-league.tsx'];
const season = screen.slice(screen.indexOf('const renderSeason = () => {'), screen.indexOf('// ── Step 3 · Draft'));

Deno.test('screen: three identical steppers with no line under any label', () => {
  assertEquals(season.match(/<Stepper\b/g)?.length, 3);
  assertEquals(season.match(/\buniformBox\b/g)?.length, 3);
  assertFalse(/\bsub=/.test(season), 'no stepper carries a sub-line');
  assert(season.includes('unit={WEEKS_UNIT_SHOWN}') && season.includes('unitSpoken={WEEKS_UNIT_SPOKEN}'));
});

Deno.test('screen: the strip and the bye line follow the stepped values', () => {
  assert(season.includes('<SeasonStrip regularWeeks={shownWeeks} playoffTeams={playoffTeams} />'));
  assert(season.includes('const byeLine = seasonByeLine(playoffTeams);'));
});

Deno.test('screen: the only text the step draws itself is the bye line (no reason under a stepper at its end)', () => {
  assertEquals(season.match(/<Text\b/g)?.length, 1);
  assert(season.includes('<Text variant="callout" tone="secondary" style={styles.byeLine}>'));
  assertFalse(season.includes('variant="caption"'));
  assertFalse(/reasons?\b/i.test(season.replace(/^\s*\/\/.*$/gm, '')), 'no reasons wiring left in the step');
});

Deno.test('screen: each stepper still greys out at its end (− and +)', () => {
  assert(season.includes('canDecrement={state.size > MANAGER_SIZES[0]}'));
  assert(season.includes('canIncrement={state.size < MANAGER_SIZES[MANAGER_SIZES.length - 1]}'));
  assert(season.includes('canDecrement={shownWeeks > minWeeks}'));
  assert(season.includes('canDecrement={playoffTeams > 2}'));
  assert(season.includes('canIncrement={playoffTeams < state.size}'));
});

Deno.test('screen: the Playoff teams "i" stays, and it is the only "i" on the step', () => {
  assertEquals(season.match(/<InfoButton\b/g)?.length, 1);
  assert(season.includes('labelInfo={<InfoButton info={CONTROL_INFO.playoffTeams} onOpen={openInfo} />}'));
});

// ── The cuts ────────────────────────────────────────────────────────────

Deno.test('cut: the old Season lines appear nowhere in the app', () => {
  const cut = [
    'How many you expect, you included',
    'We check this again when the draft starts.',
    'How big the league is and how long it runs.',
    'This updates as people join.',
    'weeks, so every team plays every other team once.',
    'up to your expected managers',
    'seasonCheckCaption',
    'byeExpectedCopy',
  ];
  for (const [path, text] of Object.entries(SOURCES)) {
    for (const c of cut) assertFalse(text.includes(c), `${path} still has "${c}"`);
  }
  for (const gone of ['roundRobinCaption', 'playoffTeamsSub', 'seasonLimitReasons', 'playoffLine(', 'byeNoticeCopy(', '<WarnNote']) {
    assertFalse(screen.includes(gone), `create-league.tsx still calls ${gone}`);
  }
});

// ── The capture knob (DEV only) ─────────────────────────────────────────

Deno.test('capture knob: EXPO_PUBLIC_CREATE_SEASON seeds a valid Season once, and ignores anything else', () => {
  assertEquals(parseCreateSeason('16,15,16'), { size: 16, weeks: 15, playoffTeams: 16 });
  assertEquals(parseCreateSeason(' 6 , 5 , 6 '), { size: 6, weeks: 5, playoffTeams: 6 });
  for (const bad of [undefined, '', '7,11,4', '8,6,4', '8,11,1', '8,11,9', '8,11', '8,11,4,2', '8,x,4']) {
    assertEquals(parseCreateSeason(bad), null, String(bad));
  }
  assertEquals(parseCaptureKnobs(false, { createSeason: '16,15,16' }).createSeason, null);
  assertEquals(parseCaptureKnobs(true, { createSeason: '16,15,16' }).createSeason, { size: 16, weeks: 15, playoffTeams: 16 });
  assert(screen.includes('size: CAPTURE.createSeason?.size ?? 8,'));
});
