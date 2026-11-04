/**
 * A tied week is a T (Design Lead P1, 2026-11-03): Home's scored card said "Gianluigi B. wins
 * Week 6" on a tied week, because `won` was a boolean decided by `myGain > opponentGain`. The
 * result is now ONE three-way value from lib/game/weekResult.ts: the server's winner
 * (matchups.winner_user_id, as the standings count it), else dollars on an older RPC.
 *
 * Covers: the decider (the server's answer in the three cases dollars get wrong, the dollar
 * fallback, unscored = undecided); the tie on every surface that shows a decided week (Home's
 * card line and VoiceOver, Matchup's band, the Matchup view); and the guards that make a new
 * consumer handle T (type-level, and a scan of every app source file).
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { byResult, serverVerdict, weekResult, type WeekResult } from '../lib/game/weekResult.ts';
import { scoredResultLine, thisWeekAccessibilityLabel } from '../lib/home/homeCopy.ts';
import { buildFinalBanner } from '../lib/game/finalBanner.ts';
import { matchupView } from '../lib/game/matchupPhase.ts';
import { finalGains } from '../lib/game/buildMatchupViewModel.ts';
import type { GetHomeLeagueResult } from '../lib/home/buildHomeViewModel.ts';
import type { PhaseResult } from '../lib/home/homePhase.ts';
import type { ThisWeekViewModel } from '../lib/home/buildHomeViewModel.ts';
import type { ScheduleRow } from '../lib/game/schedule.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const ME = 'roberto';
const OPP = 'gianluigi';
const row = (winner: string | null | undefined, isTie?: boolean) =>
  ({ team1_user_id: ME, team2_user_id: OPP, ...(winner === undefined ? {} : { winner_user_id: winner }), ...(isTie === undefined ? {} : { is_tie: isTie }) });
const decide = (myGain: number | null, oppGain: number | null, winner?: string | null, isTie?: boolean) =>
  weekResult({ myGain, oppGain, verdict: serverVerdict(row(winner, isTie), ME) });

// ── the decider ─────────────────────────────────────────────────────────────

Deno.test('server fields present: the winner decides (W / L), a null winner on a scored row is a T', () => {
  assertEquals(decide(50, -10, ME, false), 'W');
  assertEquals(decide(-10, 50, OPP, false), 'L');
  assertEquals(decide(15, 15, null, true), 'T'); // regular-season true tie
  assertEquals(decide(0, 0, null, true), 'T'); // both portfolios empty
});

Deno.test('the three cases where dollars disagree with the server give the SERVER\'s answer', () => {
  assertEquals(decide(20, 20, OPP, false), 'L'); // a dollar tie the opponent wins on percent
  assertEquals(decide(20, 20, ME, false), 'W'); // ... or I do
  assertEquals(decide(0, -40, OPP, false), 'L'); // my empty portfolio: an automatic loss, though $0 > −$40
  assertEquals(decide(25, 25, ME, false), 'W'); // a playoff tie the higher seed (me) wins: never a T
  assertEquals(decide(25, 25, OPP, false), 'L');
});

Deno.test('is_tie only cross-checks: when it disagrees with the winner, the winner decides (the standings\' rule)', () => {
  assertEquals(decide(20, 20, ME, true), 'W');
  assertEquals(decide(20, 20, null, false), 'T'); // winner null on a scored row: half a win each
});

Deno.test('server fields ABSENT (an RPC before 20261126000000): dollars decide, an exact tie is a T', () => {
  assertEquals(decide(50, -10), 'W');
  assertEquals(decide(-10, 50), 'L');
  assertEquals(decide(58.75, 58.75), 'T');
  // A winner that names neither side is no verdict on this game: dollars, too.
  assertEquals(decide(50, -10, 'someone-else', false), 'W');
});

Deno.test('unscored stays undecided: either gain null is no result, whatever the winner column says', () => {
  assertEquals(decide(null, null), null);
  assertEquals(decide(12, null), null);
  assertEquals(decide(null, 12), null);
  assertEquals(decide(null, null, null, false), null); // an unscored row's null winner is NOT a tie
});

Deno.test('serverVerdict: absent is undefined (fall back); a null winner is "nobody"; my side either way round', () => {
  assertEquals(serverVerdict(row(undefined), ME), undefined);
  assertEquals(serverVerdict(row(null), ME), 'nobody');
  assertEquals(serverVerdict({ team1_user_id: OPP, team2_user_id: ME, winner_user_id: ME }, ME), 'me');
  assertEquals(serverVerdict({ team1_user_id: OPP, team2_user_id: ME, winner_user_id: OPP }, ME), 'opponent');
});

// ── the tie on every surface ──────────────────────────────────────────────────

Deno.test('Home\'s scored card line: a tie names nobody ("Tied in Week 6", Matchup\'s own line); W and L unchanged', () => {
  assertEquals(scoredResultLine('T', 6, 'Gianluigi B.'), 'Tied in Week 6');
  assertEquals(scoredResultLine('W', 6, 'Gianluigi B.'), 'You win Week 6');
  assertEquals(scoredResultLine('L', 6, 'Gianluigi B.'), 'Gianluigi B. wins Week 6');
  assertEquals(scoredResultLine('L', 6), 'Your opponent wins Week 6');
});

Deno.test('Home\'s scored card VoiceOver says the result line, never "You lead by $0.00" on a tie', () => {
  const tie = thisWeekAccessibilityLabel(6, false, '+$58.75', 'Gianluigi B.', '+$58.75', '0', true, 'Week 7 starts Mon 9:30 AM ET', scoredResultLine('T', 6, 'Gianluigi B.'));
  assertEquals(tie, 'Week 6, final. You +$58.75, Gianluigi B. +$58.75. Tied in Week 6. Week 7 starts Mon 9:30 AM ET.');
  assert(!tie.includes('lead by') && !tie.includes('wins'), tie);
  const win = thisWeekAccessibilityLabel(6, false, '+$72.10', 'Gianluigi B.', '−$20.50', '92.6', true, 'Week 7 starts Mon 9:30 AM ET', scoredResultLine('W', 6, 'Gianluigi B.'));
  assertEquals(win, 'Week 6, final. You +$72.10, Gianluigi B. −$20.50. You win Week 6. Week 7 starts Mon 9:30 AM ET.');
  // Live (no result line): the lead sentence, unchanged.
  const live = thisWeekAccessibilityLabel(6, true, '+$1', 'Gianluigi B.', '+$0', '1', true, 'Ends Fri');
  assertEquals(live, 'Week 6, live. You +$1, Gianluigi B. +$0. You lead by 1. Ends Fri.');
});

Deno.test('Matchup\'s final band: a tie is "Tied in Week 6", T, spoken "Tie", the neutral fill; W and L unchanged', () => {
  const base = { week: 6, youName: 'Roberto B.', oppName: 'Gianluigi B.', record: { wins: 4, losses: 1, ties: 1 }, isPlayoff: false };
  const t = buildFinalBanner({ ...base, result: 'T' });
  assertEquals([t.outcome, t.text, t.recordText, t.a11yLabel], ['tied', 'Tied in Week 6', 'T · 4–1–1', 'Tied in Week 6. Tie, record 4–1–1.']);
  assertEquals(buildFinalBanner({ ...base, result: 'W' }).text, 'Roberto B. wins Week 6');
  assertEquals(buildFinalBanner({ ...base, result: 'L' }).text, 'Gianluigi B. wins Week 6');
  // The band is your colour only for a win (FinalBanner.tsx: `won = model.outcome === 'won'`).
  assert(SOURCES['components/game/FinalBanner.tsx'].includes("const won = model.outcome === 'won';"));
});

Deno.test('the Matchup view carries the phase\'s result through, T included', () => {
  const base = { numWeeks: 14 };
  for (const result of ['W', 'L', 'T', null] as const) {
    assertEquals(matchupView({ kind: 'scored', week: 6, result, isPlayoff: false, round: null, nextStart: null, ...base }), { kind: 'final', result });
  }
});

Deno.test('Matchup\'s finalGains: a tie is T; the server\'s winner decides a dollar tie; unscored is null', () => {
  const data = (g1: number | null, g2: number | null, server?: { winner_user_id: string | null; is_tie: boolean }): GetHomeLeagueResult => ({
    my_ledger: { drafts: [], trades: [] },
    current_week: { week_number: 6, my_snapshots: [], my_trades: [], opponent_snapshots: [], opponent_trades: [] },
    matchups: [{ week_number: 6, week_start: 'x', week_end: 'y', is_playoff: false, team1_user_id: ME, team2_user_id: OPP, team1_gain: g1, team2_gain: g2, ...(server ?? {}) }],
    standings: [],
  });
  assertEquals(finalGains(data(58.75, 58.75), ME)?.result, 'T');
  assertEquals(finalGains(data(58.75, 58.75, { winner_user_id: null, is_tie: true }), OPP)?.result, 'T');
  assertEquals(finalGains(data(20, 20, { winner_user_id: OPP, is_tie: false }), ME)?.result, 'L');
  assertEquals(finalGains(data(20, 20, { winner_user_id: OPP, is_tie: false }), OPP)?.result, 'W');
  assertEquals(finalGains(data(72.1, -20.5), ME), { me: 72.1, opp: -20.5, result: 'W' });
  assertEquals(finalGains(data(12, null), ME), null);
});

Deno.test('League › Schedule draws a T in the neutral colour and says "tie" (W gain colour, L loss colour, unchanged)', () => {
  const src = SOURCES['components/game/ScheduleList.tsx'];
  assert(src.includes("byResult(r.result, { W: colors.gain, L: colors.loss, T: colors.text2 })"));
  assert(src.includes("byResult(r.result, { W: 'won', L: 'lost', T: 'tie' })"));
});

Deno.test('Home and Matchup take the band\'s and the card\'s result from the decider, not from the gains', () => {
  assert(SOURCES['app/(tabs)/matchup.tsx'].includes('result: final.result,'));
  assert(SOURCES['app/(tabs)/index.tsx'].includes('scoredResultLine(result, week, opponentName)'));
  assert(SOURCES['components/home/ThisWeekCard.tsx'].includes('ahead, rightLabel, resultLine)'));
});

// ── the guards: a new consumer must handle T ────────────────────────────────

Deno.test('type-level: no boolean `won` survives, and byResult will not compile without a T case', () => {
  // Each @ts-expect-error FAILS the type check (deno test type-checks this file) if the line
  // below it ever compiles: a `won` field coming back, or byResult accepting two cases.
  type Scored = Extract<PhaseResult, { kind: 'scored' }>;
  const p = { kind: 'scored', week: 6, result: 'T', isPlayoff: false, round: null, nextStart: null, numWeeks: 14 } as Scored;
  // @ts-expect-error -- the scored phase has `result`, not `won`
  void p.won;
  const tw = { result: 'T' } as ThisWeekViewModel;
  // @ts-expect-error -- the this-week card has `result`, not `won`
  void tw.won;
  const sr = { result: 'T' } as ScheduleRow;
  // @ts-expect-error -- a schedule row has `result`, not `won` / `tie`
  void sr.tie;
  // @ts-expect-error -- all three cases are required
  byResult('T' as WeekResult, { W: 1, L: 2 });
  assertEquals(byResult('T' as WeekResult, { W: 1, L: 2, T: 3 }), 3);
  // The result type is exactly W | L | T: a fourth letter or a boolean is not one.
  // @ts-expect-error -- not a result
  const bad: WeekResult = true;
  void bad;
});

Deno.test('source guard: no app file decides a week with a boolean `won`, or branches two ways on a result', () => {
  // A two-way test on one letter (`r === 'W' ? a : b`) folds T into the other branch: that is
  // the bug. Branch with byResult / a Record<WeekResult, …> / a switch instead. Counting (a
  // bare `=== 'L'` with no `?`) is fine. `outcome === 'won'` in FinalBanner.tsx is the band's
  // fill, deliberately neutral for both a loss and a tie (GS-2), and reads the 3-way outcome.
  const twoWay = /(===|!==)\s*'[WLT]'\s*\?/;
  const booleanWon = /\bwon\s*:\s*boolean|\.won\b|\bwon\s*\?\?|\bthisWeek\.won|\btie\s*:\s*false/;
  const hits: string[] = [];
  for (const [path, text] of Object.entries(SOURCES)) {
    text.split('\n').forEach((raw, i) => {
      // Code only: a comment may name the old shape (weekResult.ts's own header does).
      const line = /^\s*(\*|\/\*|\/\/)/.test(raw) ? '' : raw.replace(/\/\/.*$/, '');
      if (twoWay.test(line) || booleanWon.test(line)) hits.push(`${path}:${i + 1}: ${raw.trim()}`);
    });
  }
  assertEquals(hits, []);
});

Deno.test('source guard: no app file re-derives a decided result from the two gains with > or <', () => {
  // Where a decided W / L / T used to come from: each site now calls weekResult. Live
  // leading / trailing (leadChange.ts, gameNight.ts) is not a result, so it stays out of this list.
  const sites: Record<string, RegExp[]> = {
    'lib/home/homePhase.ts': [/myGain \?\? 0\) > \(row\.opponentGain/],
    'lib/home/buildHomeViewModel.ts': [/myGain! > relevantRow\.opponentGain/, /g > opp \? 'W'/, /myGain < oppGain/],
    'lib/game/schedule.ts': [/myGain! > oppGain/],
    'lib/game/finalBanner.ts': [/me === opp \? 'tied'/, /me > opp/],
  };
  for (const [path, patterns] of Object.entries(sites)) {
    for (const re of patterns) assert(!re.test(SOURCES[path]), `${path} still matches ${re}`);
    assert(SOURCES[path].includes('weekResult') || SOURCES[path].includes('byResult'), `${path} does not use the decider`);
  }
});
