/**
 * Two AX5 fixes (Giorgio, 2026-11-22: "yes add both"; no new words):
 *  1. The Matchup tab's playoff status lines (bye / pending / eliminated / missed) were uncapped, so at AX5 they drew about 3x
 *     while everything around them is capped. They take the season recap's status-line cap (ROW_TEXT_CAP, 1.3, #566).
 *  2. A dash must never START a line. The stake note in League settings ("... no stake mode yet — drafting is blocked ...")
 *     wrapped at AX5 with "— drafting is blocked" opening the line. keepDash glues the dash to the word before it, the way
 *     keepDots does for "·".
 * Hermes cannot be run here, so the dash pin simulates the line breaker over the DISPLAYED string (the only break
 * opportunities are U+0020 spaces) at every width, as dot-rule.test.ts does.
 * Run: `cd apps/mobile/tests-deno && deno test --allow-read .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { NBSP, keepDash } from '../lib/game/keepDots.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const STAKE_NOTE = 'This league has no stake mode yet — drafting is blocked until you choose one.';

/** Greedy wrap: break only at a plain space; a run wider than `width` overflows on its own line. */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    if (line === '') line = w;
    else if ((line + ' ' + w).length <= width) line += ' ' + w;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

Deno.test('keepDash: the dash keeps the word before it; the words are unchanged', () => {
  assertEquals(keepDash(STAKE_NOTE), 'This league has no stake mode yet — drafting is blocked until you choose one.');
  assertEquals(keepDash(STAKE_NOTE).replaceAll(NBSP, ' '), STAKE_NOTE, 'display only: the same words');
  assertEquals(keepDash('No dash here.'), 'No dash here.');
  assertEquals(keepDash(keepDash(STAKE_NOTE)), keepDash(STAKE_NOTE), 'idempotent');
});

Deno.test('a wrapped stake note never starts a line with a dash, at any width', () => {
  for (let width = 8; width <= 60; width++) {
    for (const line of wrap(keepDash(STAKE_NOTE), width)) assert(!line.startsWith('—'), `width ${width}: "${line}"`);
  }
  // The control: unprotected, the same note DOES start a line with the dash (the AX5 bug), so the loop above is a real test.
  const starts = Array.from({ length: 53 }, (_, i) => i + 8).filter((w) => wrap(STAKE_NOTE, w).some((l) => l.startsWith('—')));
  assert(starts.length > 0, 'the plain note starts a line with the dash at some width');
});

Deno.test("League settings' stake note goes through keepDash at the WarnNote render, and the words are verbatim", () => {
  const rows = SOURCES['components/game/SetupRows.tsx'];
  assert(rows.includes('{keepDash(title)}'), 'WarnNote draws its title through keepDash');
  assert(rows.includes('{line ? <Text variant="caption" maxFontSizeMultiplier={WARN_TEXT_MAX_SCALE} color={colors.warnText}>{keepDash(line)}</Text> : null}'));
  assert(SOURCES['app/league-settings.tsx'].includes('title="This league has no stake mode yet — drafting is blocked until you choose one."'));
});

Deno.test('the Matchup tab\'s playoff status line (bye, pending, eliminated, missed) is capped at the recap\'s ROW_TEXT_CAP', () => {
  const src = SOURCES['app/(tabs)/matchup.tsx'];
  assert(src.includes("import { ROW_TEXT_CAP } from '@/components/game/ScheduleList';"), 'reuses the constant, no second number');
  assert(src.includes('return <Text variant="callout" tone="secondary" maxFontSizeMultiplier={ROW_TEXT_CAP}>{line}</Text>;'));
  // All four variants share that one Text (one branch, one line), so the cap covers each of them.
  const branch = src.slice(src.indexOf("if (view.kind === 'playoff_bye'"));
  const end = branch.indexOf('return <Text');
  const head = branch.slice(0, end);
  for (const k of ["'playoff_bye'", "'playoff_pending'", "'eliminated'", "'missed_playoffs'"]) assert(head.includes(k), k);
  assert(SOURCES['components/game/ScheduleList.tsx'].includes('export const ROW_TEXT_CAP = 1.3;'));
  assert(!/const ROW_TEXT_CAP/.test(src), 'no second definition in the tab');
});
