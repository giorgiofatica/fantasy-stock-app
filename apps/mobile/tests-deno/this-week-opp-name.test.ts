/**
 * 2026-11-04 (Design Lead P3, found at XXXL): Home's This week opponent label, on its two-line branch (numberOfLines 2),
 * wrapped "vs Gianluigi" / "B.", orphaning the surname initial. keepName glues a name of 20 characters or fewer with no-break
 * spaces, so the label breaks after "vs" ("vs" / "Gianluigi B.") or not at all. Display only: the fit test
 * (nameBesideAvatar), the one-line fitted name on the stacked branch, and the VoiceOver label keep the plain label.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals, assertMatch, assertNotEquals } from 'jsr:@std/assert';
import { NAME_KEEP_WHOLE, keepName } from '../lib/account/keepName.ts';
import { vsOpponentLabel } from '../lib/home/homeCopy.ts';
import { SOURCES } from './sourceManifest.generated.ts';

/** Greedy wrap at `max` characters, breaking only at a plain space (a no-break space never breaks). */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && width(next) > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// keepName also joins a hyphen to its next letter (a zero-width word joiner): no width, no character of its own.
const NBSP_RE = new RegExp(String.fromCharCode(0xa0), 'g');
const WORD_JOINER_RE = new RegExp(String.fromCharCode(0x2060), 'g');
const plainOf = (s: string) => s.replace(NBSP_RE, ' ').replace(WORD_JOINER_RE, '');
const width = (s: string) => plainOf(s).length;
const NAMES = ['Gianluigi B.', 'Sam', 'Mo K.', 'Alexandria M.', 'Anna-Maria Rossi', 'Gianluigi Buffon Jr.'];

/** Is the name ever split across lines, at a width where some line could hold all of it? A break right after "vs" is the wanted one. */
function splitsName(label: string, name: string): boolean {
  for (let max = 4; max <= 60; max++) {
    if (name.length > max) continue; // a name wider than the line cannot be whole, and is not asserted
    if (!wrap(label, max).some((l) => plainOf(l).includes(name))) return true;
  }
  return false;
}

Deno.test('control: the plain label wraps "vs Gianluigi" / "B." (the bug the simulator must see)', () => {
  assertEquals(wrap(vsOpponentLabel('Gianluigi B.'), 12), ['vs Gianluigi', 'B.']);
  assert(splitsName(vsOpponentLabel('Gianluigi B.'), 'Gianluigi B.'));
});

Deno.test('the kept label breaks after "vs" and never inside a name of 20 characters or fewer, at every width', () => {
  for (const name of NAMES) {
    assert(name.length <= NAME_KEEP_WHOLE, name);
    assert(!splitsName(vsOpponentLabel(keepName(name)), name), name);
  }
  assertEquals(wrap(vsOpponentLabel(keepName('Gianluigi B.')), 12).map(plainOf), ['vs', 'Gianluigi B.']);
});

Deno.test('a name over 20 characters stays breakable between its words (a glued run wider than the line breaks mid-word)', () => {
  const long = 'Maximilian Alexander Fitzgerald';
  assert(long.length > NAME_KEEP_WHOLE);
  assertEquals(keepName(long), long);
  assertEquals(vsOpponentLabel(keepName(long)), vsOpponentLabel(long));
});

Deno.test('only the spaces change: the same characters once a no-break space reads as a space', () => {
  for (const name of NAMES) assertEquals(plainOf(vsOpponentLabel(keepName(name))), vsOpponentLabel(name));
  assertNotEquals(vsOpponentLabel(keepName('Gianluigi B.')), vsOpponentLabel('Gianluigi B.'));
});

Deno.test('"vs" keeps its breakable space: the whole label is never glued into one run', () => {
  assert(vsOpponentLabel(keepName('Gianluigi B.')).startsWith('vs '));
});

Deno.test('ThisWeekCard: only the two-line branch takes the kept label; the fit test, the fitted one-line name and VoiceOver stay plain (source guard)', () => {
  const src = SOURCES['components/home/ThisWeekCard.tsx'];
  assertMatch(src, /import \{ keepName \} from '@\/lib\/account\/keepName';/);
  assertMatch(src, /const oppLabel = vsOpponentLabel\(opponentName\);/);
  assertMatch(src, /const oppLabelKept = vsOpponentLabel\(keepName\(opponentName\)\);/);
  assertMatch(src, /numberOfLines=\{2\} style=\{styles\.oppName\}>\s*\{oppLabelKept\}\s*<\/Text>/);
  assertMatch(src, /numberOfLines=\{1\} adjustsFontSizeToFit[^>]*style=\{styles\.oppName\}>\s*\{oppLabel\}\s*<\/Text>/);
  assertMatch(src, /!nameBesideAvatar\(oppLabel, besideRoom, NAME_PT \* fontScale\)/);
  assertEquals(src.match(/oppLabelKept/g)?.length, 2); // its declaration and the one Text
  assertMatch(src, /thisWeekAccessibilityLabel\(week, isLive, youText, opponentName,/); // VoiceOver reads the name as it is
});
