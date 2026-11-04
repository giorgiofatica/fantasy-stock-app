/**
 * keepWeek (Design Lead P2, 2026-11-03; gate checklist §5): at AX5 Home's Standings header broke "Through Week" /
 * "10", splitting "Week 10". A no-break space between the word and its number keeps the phrase on one line wherever
 * the rest of the label wraps. Display only: the copy and every accessibilityLabel keep the plain space.
 *
 * The pin simulates a worst-case line breaker over each surface's real string (a break is allowed at every plain
 * space) and asserts no line ends on "Week" with its number on the next line, at every width. A negative control
 * proves the simulator sees the original bug in the unjoined string.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals, assertNotEquals } from 'jsr:@std/assert';
import { NBSP, keepWeek } from '../lib/game/keepDots.ts';
import { nextWeekStartsLabel, scoredResultLine, standingsThroughWeekCaption } from '../lib/home/homeCopy.ts';
import { SEE_WEEK_ONE_MATCHUP, SEE_WEEK_ONE_MATCHUPS, weekOneLine } from '../lib/game/draftComplete.ts';
import { SOURCES } from './sourceManifest.generated.ts';

/** Greedy wrap at `width` characters, breaking only at a plain space (a no-break space never breaks). */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Does any wrap split a "Week" (or "week") from the number after it? */
function splitsWeek(text: string): boolean {
  for (let width = 4; width <= 60; width++) {
    const lines = wrap(text, width);
    for (let i = 0; i < lines.length - 1; i++) {
      if (/\b[Ww]eek$/.test(lines[i]) && /^\d/.test(lines[i + 1])) return true;
    }
  }
  return false;
}

Deno.test('keepWeek: one no-break space between "Week" and its number, nothing else changes', () => {
  assertEquals(keepWeek('Through Week 10'), `Through Week${NBSP}10`);
  assertEquals(keepWeek('You win Week 6'), `You win Week${NBSP}6`);
  assertEquals(keepWeek('Round of 8 · playoff week 2'), `Round of 8 · playoff week${NBSP}2`);
  assertEquals(keepWeek("See Week 1's matchups"), `See Week${NBSP}1's matchups`);
  assertEquals(keepWeek('Week 7 starts Mon 9:30 AM ET'), `Week${NBSP}7 starts Mon 9:30 AM ET`);
});

Deno.test('keepWeek: text without "Week <digit>" is untouched, and it is idempotent', () => {
  for (const t of ['Standings', 'Weekly 5', 'Week of Oct 5', 'Best week', 'Next week 3 picks'.replace('week 3', 'wk 3'), '', 'Week']) {
    assertEquals(keepWeek(t), t);
  }
  const once = keepWeek('Through Week 10');
  assertEquals(keepWeek(once), once);
  assertEquals(once.replace(NBSP, ' '), 'Through Week 10');
});

Deno.test('the simulator sees the original bug: "Through Week 10" splits at a plain space', () => {
  assert(splitsWeek('Through Week 10'));
  assert(splitsWeek('You win Week 6'));
});

Deno.test('every Week N string the app draws in wrapping text never splits "Week" from its number', () => {
  const surfaces = [
    standingsThroughWeekCaption(10),
    standingsThroughWeekCaption(14),
    scoredResultLine('W', 6),
    scoredResultLine('L', 6, 'Roberto B.'),
    scoredResultLine('T', 6),
    nextWeekStartsLabel(7, '2026-10-12T13:30:00Z'),
    nextWeekStartsLabel(7, null),
    weekOneLine('2026-10-05T13:30:00Z', 'Roberto B.'),
    weekOneLine('2026-10-05T13:30:00Z', null, true),
    SEE_WEEK_ONE_MATCHUP,
    SEE_WEEK_ONE_MATCHUPS,
    'Semifinals · playoff week 14',
  ];
  for (const s of surfaces) {
    assert(/[Ww]eek \d/.test(s), `fixture has a Week N: ${s}`);
    assert(!splitsWeek(keepWeek(s)), `splits: ${s}`);
  }
});

Deno.test('the copy itself is unchanged: the plain strings still carry a plain space (VoiceOver, web)', () => {
  assertEquals(standingsThroughWeekCaption(10), 'Through Week 10');
  assertNotEquals(keepWeek(standingsThroughWeekCaption(10)), standingsThroughWeekCaption(10));
});

// Where it is applied: every visible Week N that can wrap. The one-line labels (PhaseChip, the league switcher's pill,
// League's "Through Week N" column head) have numberOfLines={1} and cannot break, so they are not listed (a no-break
// space there only moved the last digit by a fraction of a pixel: 329 px at AX5).
const RENDER_SITES: Record<string, RegExp[]> = {
  'components/home/StandingsCard.tsx': [/\{keepWeek\(standingsThroughWeekCaption\(throughWeek\)\)\}/],
  'components/home/ThisWeekCard.tsx': [/resultLine != null \? keepWeek\(resultLine\)/, /\{keepWeek\(rightLabel\)\}/],
  'components/game/DraftComplete.tsx': [/finished \? keepWeek\(weekLine\)/, /label=\{keepWeek\(bye \? SEE_WEEK_ONE_MATCHUPS : SEE_WEEK_ONE_MATCHUP\)\}/],
  'components/home/SeasonCompleteCard.tsx': [/\{keepWeek\(bestWeekLine\(result\.best_week_number\)\)\} · /],
  'components/game/BracketView.tsx': [/keepWeek\(`\$\{round\.label\} · playoff week \$\{round\.round\}`\)/],
};

for (const [path, patterns] of Object.entries(RENDER_SITES)) {
  Deno.test(`render site: ${path} runs its Week N text through keepWeek`, () => {
    const src = SOURCES[path];
    assert(src, `${path} is in the source manifest`);
    assert(/import \{[^}]*\bkeepWeek\b[^}]*\} from '@\/lib\/game\/keepDots'/.test(src), `${path} imports keepWeek`);
    for (const p of patterns) assert(p.test(src), `${path}: ${p}`);
  });
}

Deno.test('Home Standings header: VoiceOver still reads the plain caption', () => {
  const src = SOURCES['components/home/StandingsCard.tsx'];
  assert(/accessibilityLabel=\{throughWeekShown\(throughWeek\) \? `\$\{STANDINGS_CARD_TITLE\}, \$\{standingsThroughWeekCaption\(throughWeek\)\}`/.test(src));
});

Deno.test('League\'s column head is one line (numberOfLines={1}), so it is left alone: no keepWeek, no pixel change', () => {
  const src = SOURCES['components/game/StandingsTable.tsx'];
  assert(/numberOfLines=\{1\}[^>]*style=\{styles\.headLabel\}>\{throughLabel \?\? ''\}<\/Text>/.test(src));
  assert(!/keepWeek/.test(src));
});
