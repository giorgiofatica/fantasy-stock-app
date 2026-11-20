/**
 * The season recap's week rows: the W / L / T is bold and neutral, only the money is coloured,
 * and the row carries no reason (Giorgio, 2026-11-19, A; docs/PRODUCT_RULES.md, "The season
 * recap row"). His words: "maybe we make the P&L red and green, but we keep the L's and W's
 * not red and green and just keep them like bolded neutrals". Scope since 2026-11-20 (pick A,
 * #call-result-colour, "A and keep blue"): League › Schedule (the same ScheduleWeekRow) draws
 * it neutral too; result-letters-neutral.test.ts covers Home's tiles and the Matchup popup.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { resultLetterInk, type WeekResult } from '../lib/game/weekResult.ts';
import { color } from '../constants/tokens/color.ts';
import { type } from '../constants/tokens/type.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const RESULTS: WeekResult[] = ['W', 'L', 'T'];
const ROW = 'components/game/ScheduleList.tsx';
const RECAP = 'components/game/SeasonRecap.tsx';

function between(src: string, from: string, to: string): string {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a + 1);
  assert(a >= 0 && b > a, `markers not found: ${from} … ${to}`);
  return src.slice(a, b);
}

Deno.test('recap (neutral): every result letter is the normal text ink, in both themes', () => {
  for (const theme of [color.light, color.dark]) {
    for (const r of RESULTS) assertEquals(resultLetterInk(r, theme, true), theme.text, `${r} on the recap`);
    // Neutral means the dark ink, not the grey the Schedule's T uses, and never a gain or loss colour.
    assert(theme.text !== theme.text2 && theme.text !== theme.gain && theme.text !== theme.loss);
  }
});

Deno.test('not neutral (no caller left): W gain, L loss, T text2', () => {
  for (const theme of [color.light, color.dark]) {
    assertEquals(resultLetterInk('W', theme, false), theme.gain);
    assertEquals(resultLetterInk('L', theme, false), theme.loss);
    assertEquals(resultLetterInk('T', theme, false), theme.text2);
  }
});

Deno.test('the row draws the letter through resultLetterInk, bold (score.sm, extra bold), neutral only when asked', () => {
  const src = SOURCES[ROW];
  assert(src.includes('<Text variant="score.sm" color={resultLetterInk(r.result, colors, neutralResult)}>{r.result}</Text>'));
  // Off by default, so a row that does not pass it is League › Schedule's row exactly.
  assert(src.includes('accessibilityHint, neutralResult = false }: ScheduleWeekRowProps)'));
  // Bold: the letter's variant is the score's extra bold (800), the same weight as the figure beside it.
  assertEquals(type['score.sm'].fontFamily, 'Archivo-ExtraBold');
  // The old per-result colouring is no longer inlined in the row (it lives in the helper only).
  assert(!src.includes('byResult(r.result, { W: colors.gain, L: colors.loss, T: colors.text2 })'));
});

Deno.test('the figure keeps its sign colour, unchanged, on every row', () => {
  const src = SOURCES[ROW];
  assert(src.includes("<Text variant=\"score.sm\" color={colors[toneOf(r.gain)]} style={styles.gain}>{keepMoney(formatMoney(r.gain, { sign: 'always' }))}</Text>"));
});

Deno.test('both callers ask for neutral letters: the recap and League › Schedule', () => {
  const recapRow = between(SOURCES[RECAP], '<ScheduleWeekRow', '/>');
  assert(/\n\s+neutralResult\n/.test(recapRow), 'the recap passes neutralResult');
  const schedule = between(SOURCES[ROW], 'export function ScheduleList(', 'export interface ScheduleWeekRowProps');
  assert(schedule.includes('<ScheduleWeekRow key={r.week} row={r} neutralResult />'), 'League › Schedule passes neutralResult');
  // Every <ScheduleWeekRow in ScheduleList is neutral (no second, coloured draw of the row).
  assertEquals(schedule.split('<ScheduleWeekRow').length - 1, 1);
  // ScheduleList and the recap are the row's only callers, and League › Schedule draws ScheduleList.
  const callers = Object.entries(SOURCES).filter(([p, s]) => p !== ROW && s.includes('<ScheduleWeekRow')).map(([p]) => p);
  assertEquals(callers, [RECAP]);
  const leagueTab = Object.entries(SOURCES).filter(([, s]) => s.includes('<ScheduleList')).map(([p]) => p);
  assertEquals(leagueTab, ['app/(tabs)/league.tsx']);
});

Deno.test('VoiceOver still says the result; no reason word on the row', () => {
  const src = SOURCES[ROW];
  assert(src.includes("byResult(r.result, { W: 'won', L: 'lost', T: 'tie' })"));
  // B ("L · tiebreak", "L · seed", "W · they had no stocks") was not picked: none of it is row copy.
  for (const word of ['tiebreak', 'seed', 'no stocks']) {
    const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert(!code(src).toLowerCase().includes(word), `"${word}" is not row copy (ScheduleList)`);
    assert(!code(SOURCES[RECAP]).toLowerCase().includes(word), `"${word}" is not row copy (SeasonRecap)`);
  }
});
