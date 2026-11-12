/**
 * keepTime (Design Lead ruling 2026-11-03; P3): a clock time is ONE phrase with its AM/PM and its zone. At AX5 Home's
 * This week card broke "Week 7 starts Mon 9:30 AM / ET", leaving "ET" alone on its line. A no-break space between the
 * digits and AM/PM and between AM/PM and the zone keeps the time whole: the line breaks BEFORE it ("Week 7 starts /
 * Mon / 9:30 AM ET"), never inside it. Display only: the copy and every accessibilityLabel keep the plain spaces.
 *
 * The pin simulates a worst-case line breaker over each surface's real string (a break is allowed at every plain
 * space) and asserts no line ends inside a time, at every width. A negative control proves the simulator sees the
 * original bug in the unjoined string. Producer output is normalised the way Hermes writes it (a plain space before
 * AM/PM): Deno's ICU writes a narrow no-break space there, which would hide the very break this pins.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals, assertNotEquals } from 'jsr:@std/assert';
import { NBSP, keepDots, keepDotsIn, keepMoney, keepTime } from '../lib/game/keepDots.ts';
import { endsAtLabel, marketResumesAt, nextWeekStartsLabel, preSeasonStartsLabel } from '../lib/home/homeCopy.ts';
import { draftDateTimeLabel } from '../lib/home/draftCountdown.ts';
import { blockersCardCopy, countdownCopy, deadlineCopy, etTimeLabel, etWhenLabel, pickerLine } from '../lib/game/autoStart.ts';
import { leaveRowView, leaveSheetCopy } from '../lib/game/leaveLeague.ts';
import { weekOneLine } from '../lib/game/draftComplete.ts';
import { marketOpensLabel } from '../lib/money/marketOpensLabel.ts';
import { COPY } from '../lib/money/moneyCopy.ts';
import { joinedView } from '../lib/join/joinPreview.ts';
import { preDraftPortfolio } from '../lib/money/preDraftPortfolio.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const NNBSP = ' ';
/** What Hermes writes: a plain space where Deno's ICU writes a narrow no-break one. */
const hermes = (s: string | null | undefined): string => (s ?? '').replace(/ /g, ' ');

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

/** Does any wrap split a clock time, or leave AM/PM or the zone alone at the start of a line? */
function splitsTime(text: string): boolean {
  for (let width = 4; width <= 70; width++) {
    const lines = wrap(text, width);
    for (let i = 0; i < lines.length - 1; i++) {
      if (/\d{1,2}:\d{2}$/.test(lines[i]) && /^(AM|PM)\b/.test(lines[i + 1])) return true; // "9:30" / "AM"
      if (/\b(AM|PM)$/.test(lines[i]) && /^E[SD]?T\b/.test(lines[i + 1])) return true; // "9:30 AM" / "ET"
    }
  }
  return false;
}

Deno.test('keepTime: a no-break space between the digits and AM/PM and between AM/PM and the zone', () => {
  assertEquals(keepTime('Week 7 starts Mon 9:30 AM ET'), `Week 7 starts Mon 9:30${NBSP}AM${NBSP}ET`);
  assertEquals(keepTime('Ends Fri 4:00 PM ET'), `Ends Fri 4:00${NBSP}PM${NBSP}ET`);
  assertEquals(keepTime('The draft room opens at 6:00 PM ET, when the order is set.'), `The draft room opens at 6:00${NBSP}PM${NBSP}ET, when the order is set.`);
  assertEquals(keepTime('Sat, Oct 3 · 7:00 PM ET'), `Sat, Oct 3 · 7:00${NBSP}PM${NBSP}ET`);
  assertEquals(keepTime('Tue, Sep 29 · 6:43 PM'), `Tue, Sep 29 · 6:43${NBSP}PM`); // no zone: only the meridiem is glued
  assertEquals(keepTime('12:05 AM EST and 1:00 PM EDT'), `12:05${NBSP}AM${NBSP}EST and 1:00${NBSP}PM${NBSP}EDT`);
});

Deno.test('keepTime: the weekday before the time and the words around it stay breakable', () => {
  const out = keepTime('Week 7 starts Mon 9:30 AM ET');
  assert(out.startsWith('Week 7 starts Mon 9:30'), 'plain spaces before the time');
  assertEquals(out.split(' ').length, 5); // "Week" "7" "starts" "Mon" "9:30 AM ET"
});

Deno.test('keepTime: text without a clock time is untouched, and it is idempotent', () => {
  for (const t of ['Standings', 'Week 7 starts soon', 'Season starts soon', '9:30', '9:30 AMBER', 'at 10 AM', '3 PM ET', 'Trading is closed right now.', '', '9:30 AM ETF']) {
    assertEquals(keepTime(t).replace(new RegExp(NBSP, 'g'), ' '), t);
  }
  assertEquals(keepTime('9:30 AM ETF'), `9:30${NBSP}AM ETF`); // a longer word is not a zone
  const once = keepTime('Mon 9:30 AM ET');
  assertEquals(keepTime(once), once);
  assertEquals(once.replace(new RegExp(NBSP, 'g'), ' '), 'Mon 9:30 AM ET');
});

Deno.test('keepTime: a separator ICU already made non-breaking is left as it is', () => {
  assertEquals(keepTime(`9:30${NNBSP}AM ET`), `9:30${NNBSP}AM${NBSP}ET`);
  assertEquals(keepTime(`9:30${NBSP}AM${NBSP}ET`), `9:30${NBSP}AM${NBSP}ET`);
});

Deno.test('keepTime composes with keepMoney and keepDots in either order', () => {
  const s = 'Mon 9:30 AM ET · 10 sh @ $12.34';
  assertEquals(keepTime(keepMoney(s)), keepMoney(keepTime(s)));
  assertEquals(keepTime(keepDots('Sat, Oct 3 · 7:00 PM ET')), keepDots('Sat, Oct 3 · 7:00 PM ET'));
});

Deno.test('the simulator sees the original bug: "Week 7 starts Mon 9:30 AM ET" splits at a plain space', () => {
  assert(splitsTime('Week 7 starts Mon 9:30 AM ET'));
  assert(splitsTime('Ends Fri 4:00 PM ET'));
  assert(!splitsTime(keepTime('Week 7 starts Mon 9:30 AM ET')));
});

const SUNDAY = Date.parse('2026-10-04T22:00:00Z'); // Sat Oct 3, 6:00 PM ET
const T = '2026-10-12T13:30:00Z'; // Mon 9:30 AM ET
const FRIDAY_CLOSE = '2026-10-09T20:00:00Z'; // Fri 4:00 PM ET
const DRAFT = '2026-10-03T23:00:00Z'; // Sat Oct 3, 7:00 PM ET

Deno.test('every clock time the app draws in wrapping text never splits at any width', () => {
  const surfaces: Record<string, string> = {
    'Home This week right label (live)': endsAtLabel(FRIDAY_CLOSE),
    'Home This week right label (closed)': marketResumesAt(T),
    'Home This week right label (scored)': nextWeekStartsLabel(7, T),
    'Home bye card': nextWeekStartsLabel(8, T),
    'Home pre-season line / Matchup pre-season': preSeasonStartsLabel(T),
    'Draft complete (opponent)': weekOneLine(T, 'Roberto B.'),
    'Draft complete (bye)': weekOneLine(T, null, true),
    'Draft complete (no opponent)': weekOneLine(T, null),
    'Pre-draft card date': etWhenLabel(Date.parse(DRAFT)),
    'Portfolio pre-draft date': preDraftPortfolio('not_started', DRAFT)?.hook?.kind === 'date' ? (preDraftPortfolio('not_started', DRAFT)!.hook as { label: string }).label : '',
    'Draft countdown (scheduled) line 1': countdownCopy('scheduled', DRAFT, SUNDAY).lines[0],
    'Draft countdown (room open)': countdownCopy('room_open', DRAFT, SUNDAY).lines[0],
    'Commissioner deadline line': deadlineCopy(DRAFT, SUNDAY).line,
    'Blockers (risk) tag': blockersCardCopy('risk', etTimeLabel(Date.parse(DRAFT))).tag ?? '',
    'Blockers (risk) line': blockersCardCopy('risk', etTimeLabel(Date.parse(DRAFT))).line ?? '',
    'Draft picker line': pickerLine(Date.parse(DRAFT), SUNDAY - 3 * 86400000).value,
    'League settings Leave row': leaveRowView('before_draft', false, DRAFT).sub ?? '',
    'Leave sheet bullet': leaveSheetCopy('before_draft', { leagueName: 'Stock Scudetto', commissionerName: 'Giorgio F.', seasonNumber: 1, draftDate: DRAFT, memberCount: 5 })?.bullets[1] ?? '',
    'Trading opens (review / refusal)': COPY.tradingOpens(marketOpensLabel(T) ?? ''),
    "Market's closed (review / stock sheet / player card)": COPY.marketClosedOpens(marketOpensLabel(T) ?? ''),
    'Trade history detail': `${marketOpensLabel('2026-10-09T14:30:00Z')} · 10 sh @ $12.34`,
  };
  for (const [name, raw] of Object.entries(surfaces)) {
    const s = hermes(raw);
    assert(/\d{1,2}:\d{2} (AM|PM)/.test(s), `${name}: fixture has a clock time: ${JSON.stringify(s)}`);
    assert(!splitsTime(keepTime(s)), `${name} splits: ${keepTime(s)}`);
  }
});

Deno.test('the surfaces that go through keepDots / keepDotsIn already keep the time whole (nothing to add there)', () => {
  const row = hermes(draftDateTimeLabel(DRAFT));
  assert(!splitsTime(keepDots(row)), 'Create league / League settings Draft row, Join preview Draft row');
  const joined = joinedView('Stock Scudetto', DRAFT);
  assert(!splitsTime(keepDotsIn(hermes(joined.body), hermes(joined.when))), 'Joined body');
});

Deno.test('the copy itself is unchanged: the plain strings still carry plain spaces (VoiceOver, web)', () => {
  assertEquals(hermes(endsAtLabel(FRIDAY_CLOSE)), 'Ends Fri 4:00 PM ET');
  assertEquals(hermes(nextWeekStartsLabel(7, T)), 'Week 7 starts Mon 9:30 AM ET');
  assertNotEquals(keepTime(hermes(nextWeekStartsLabel(7, T))), hermes(nextWeekStartsLabel(7, T)));
  assert(!/ /.test(hermes(nextWeekStartsLabel(7, T))), 'the producer emits no no-break space');
});

// Where it is applied: every visible clock time that can wrap. The one-line surfaces (the draft rows through keepDots, the
// hero meta) already hold a time whole or cannot break, and the native Renewal alert is drawn by iOS, so none is listed.
// Unused producers (marketHours' "Pre-market (opens 9:30 AM ET)", gameCopy.endsFriday, formatShortDateTime) have no
// consumer, so there is no render to guard.
const RENDER_SITES: Record<string, RegExp[]> = {
  'components/home/ThisWeekCard.tsx': [/\{keepTime\(keepWeek\(rightLabel\)\)\}/],
  'components/home/HomeHero.tsx': [/ · \{keepTime\(preSeasonLabel\)\}<\/Text>/],
  'components/home/PhaseMessageCard.tsx': [/\{keepTime\(line\)\}/],
  'components/home/PreDraftCard.tsx': [/\{keepTime\(dateLabel!\)\}/],
  'components/game/DraftComplete.tsx': [/finished \? keepTime\(keepWeek\(weekLine\)\)/],
  'components/game/DraftCountdownCard.tsx': [/lines\.map\(\(l\) => \(\s*<Text[^>]*>\s*\{keepTime\(l\)\}/, /notes\.map\(\(l\) => \(\s*<Text[^>]*>\s*\{keepTime\(l\)\}/],
  'components/game/DraftBlockersCard.tsx': [/\{keepTime\(copy\.tag\)\}/, /\{keepTime\(copy\.title\)\}/, /\{keepTime\(copy\.line\)\}/],
  'components/game/DraftDateSheet.tsx': [/\{keepTime\(line\.value\)\}/],
  'components/game/LeaveLeagueSheets.tsx': [/\{keepTime\(view\.sub\)\}/, /\{keepTime\(b\)\}/],
  'components/sp/PhaseChip.tsx': [/\{keepTime\(phaseChipUppercase\(label\) \? meta\.label\.toUpperCase\(\) : meta\.label\)\}/],
  'components/sp/gn/PlayerCard.tsx': [/\{keepTime\(action\.note\)\}/],
  'components/money/TradeReviewPanel.tsx': [/<WarnPanel text=\{keepTime\(p\.message\)\} \/>/, /accessibilityRole="alert">\{keepTime\(p\.message\)\}/],
  'components/money/StockSheetBody.tsx': [/\{keepTime\(keepMoney\(action\.reason\)\)\}/],
  'components/money/PortfolioScreen.tsx': [/\{keepTime\(preDraft\.hook\.label\)\}/],
  'components/money/TradeHistoryScreen.tsx': [/\{keepTime\(keepMoney\(detail\)\)\}/],
  'app/(tabs)/matchup.tsx': [/\{keepTime\(preSeasonStartsLabel\(/],
  'app/league-settings.tsx': [/value=\{keepDots\(draftDateValue\)\}/],
};

for (const [path, patterns] of Object.entries(RENDER_SITES)) {
  Deno.test(`render site: ${path} runs its time text through keepTime`, () => {
    const src = SOURCES[path];
    assert(src, `${path} is in the source manifest`);
    assert(/import \{[^}]*\bkeep(Time|Dots)\b[^}]*\} from '@\/lib\/game\/keepDots'/.test(src), `${path} imports its helper`);
    for (const p of patterns) assert(p.test(src), `${path}: ${p}`);
  });
}

Deno.test('VoiceOver keeps the plain strings: Home reads rightLabel, the countdown card its raw lines, Settings its own label', () => {
  assert(/thisWeekAccessibilityLabel\([^\n]*, ahead, rightLabel(, resultLine)?\)/.test(SOURCES['components/home/ThisWeekCard.tsx']));
  assert(/const label = \[tag, clock, title, starting, \.\.\.lines, \.\.\.notes\]/.test(SOURCES['components/game/DraftCountdownCard.tsx']));
  assert(/accessibilityLabel=\{`Draft time, \$\{draftDateValue\}`\}/.test(SOURCES['app/league-settings.tsx']));
});

Deno.test('the helper stays out of the one-line League head and the producers (lib/ strings are plain)', () => {
  assert(!/keepTime/.test(SOURCES['components/game/StandingsTable.tsx']));
  for (const p of ['lib/home/homeCopy.ts', 'lib/home/draftCountdown.ts', 'lib/game/autoStart.ts', 'lib/money/marketOpensLabel.ts', 'lib/game/leaveLeague.ts']) {
    assert(!/keepTime/.test(SOURCES[p]), `${p} stays plain`);
  }
});
