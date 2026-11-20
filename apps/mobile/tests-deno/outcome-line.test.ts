/**
 * Why a week was won, on the phone (docs/plans/2026-11-19-matchup-outcome-reason.md, workstream 2).
 * One helper, lib/game/outcomeLine.ts, keyed on the reason the server stored (matchups.outcome_reason,
 * migration 20261208000000). The words are Giorgio's pick A (2026-11-19, #call-tiebreak-words), winner
 * first. The percents are the STORED team1/team2_percent_gain, never computed here. Every reason the
 * helper does not state keeps #566's rule. Run: `deno test .`
 */
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';
import { finalLine, interimFinalLine, outcomeFromRows, recordedOutcome, type OutcomeColumns, type RecordedOutcome } from '../lib/game/outcomeLine.ts';
import { scoreboardModel } from '../components/sp/logic/gameNight.ts';
import { serverVerdict, type ServerVerdict } from '../lib/game/weekResult.ts';
import { buildAllMatchups } from '../lib/game/allMatchups.ts';
import { buildRecap, recapGameDetail, type RecapMatchup } from '../lib/game/seasonRecap.ts';
import { seasonMatchups, SEAM_ME } from '../lib/game/seamTables.ts';
import { SOURCES } from './sourceManifest.generated.ts';

// ── fixtures: the card's left side is Roberto (team1 unless `flip`) ─────────────────────────────
const R = { name: 'Roberto B.' };
const P = { name: 'Paolo M.' };
const base = (extra: Partial<OutcomeColumns>): OutcomeColumns => ({ team1_user_id: 'r', team2_user_id: 'p', ...extra });
const outcome = (extra: Partial<OutcomeColumns>, left = 'r'): RecordedOutcome => recordedOutcome(base(extra), left)!;
const line = (you: number, opp: number, verdict: ServerVerdict | undefined, o?: RecordedOutcome) =>
  finalLine({ ...R, gain: you }, { ...P, gain: opp }, verdict, o).line;

// ── the approved words, one test per reason ─────────────────────────────────────────────────────
Deno.test('dollar_gain: "{winner} won by $X" (as before)', () => {
  const o = outcome({ outcome_reason: 'dollar_gain', team1_percent_gain: 3, team2_percent_gain: 1 });
  assertEquals(line(50, 20, 'me', o), 'Roberto B. won by $30.00');
  assertEquals(line(-5, 12.5, 'opponent', outcome({ outcome_reason: 'dollar_gain' })), 'Paolo M. won by $17.50');
});

Deno.test('regular_season_true_tie: "Dead even" (as before)', () => {
  assertEquals(line(10, 10, 'nobody', outcome({ outcome_reason: 'regular_season_true_tie', team1_percent_gain: 1, team2_percent_gain: 1 })), 'Dead even');
});

Deno.test('both_empty_tie: "Dead even", each total a dash', () => {
  const m = finalLine({ ...R, gain: 0 }, { ...P, gain: 0 }, 'nobody', outcome({ outcome_reason: 'both_empty_tie' }));
  assertEquals(m.line, 'Dead even');
  assertEquals(m.noStocks, { you: true, opp: true });
});

Deno.test('percent_tiebreak: the winner first, the winner\'s percent first, the STORED percents', () => {
  // Roberto is team1 and wins on +1.76% to +0.74%.
  assertEquals(line(10, 10, 'me', outcome({ outcome_reason: 'percent_tiebreak', team1_percent_gain: 1.76, team2_percent_gain: 0.74 })),
    'Roberto B. won the tiebreak, +1.76% to +0.74%');
  // Paolo (team2) wins: his percent first even though it is the second stored column.
  assertEquals(line(10, 10, 'opponent', outcome({ outcome_reason: 'percent_tiebreak', team1_percent_gain: 0.74, team2_percent_gain: 1.76 })),
    'Paolo M. won the tiebreak, +1.76% to +0.74%');
  // The same game read from Paolo's side (left = team2): the line is the same sentence.
  const fromP = recordedOutcome(base({ outcome_reason: 'percent_tiebreak', team1_percent_gain: 0.74, team2_percent_gain: 1.76 }), 'p')!;
  assertEquals(finalLine({ ...P, gain: 10 }, { ...R, gain: 10 }, 'me', fromP).line, 'Paolo M. won the tiebreak, +1.76% to +0.74%');
  // A negative loser keeps its minus: formatted, not recomputed.
  assertEquals(line(10, 10, 'me', outcome({ outcome_reason: 'percent_tiebreak', team1_percent_gain: -0.3, team2_percent_gain: -1.1 })),
    'Roberto B. won the tiebreak, −0.30% to −1.10%');
});

Deno.test('team1_empty_auto_loss / team2_empty_auto_loss: "{winner} won. {loser} had no stocks", the loser\'s total a dash', () => {
  const t2 = finalLine({ ...R, gain: -12 }, { ...P, gain: 0 }, 'me', outcome({ outcome_reason: 'team2_empty_auto_loss', team1_percent_gain: -1.2, team2_percent_gain: null }));
  assertEquals(t2.line, 'Roberto B. won. Paolo M. had no stocks');
  assertEquals(t2.noStocks, { you: false, opp: true });
  const t1 = finalLine({ ...R, gain: 0 }, { ...P, gain: -12 }, 'opponent', outcome({ outcome_reason: 'team1_empty_auto_loss', team1_percent_gain: null, team2_percent_gain: -1.2 }));
  assertEquals(t1.line, 'Paolo M. won. Roberto B. had no stocks');
  assertEquals(t1.noStocks, { you: true, opp: false });
  // Read from team2's side the empty team is still the right NAME (orientation).
  const flipped = recordedOutcome(base({ outcome_reason: 'team2_empty_auto_loss' }), 'p')!;
  assertEquals(finalLine({ ...P, gain: 0 }, { ...R, gain: -12 }, 'opponent', flipped).line, 'Roberto B. won. Paolo M. had no stocks');
});

Deno.test('playoff_seed_tiebreak: "Tied. {winner} advances as the higher seed"', () => {
  const o = outcome({ outcome_reason: 'playoff_seed_tiebreak', team1_percent_gain: 2.4, team2_percent_gain: 2.4 });
  assertEquals(line(25, 25, 'opponent', o), 'Tied. Paolo M. advances as the higher seed');
  assertEquals(line(25, 25, 'me', o), 'Tied. Roberto B. advances as the higher seed');
});

Deno.test('both_empty_playoff_seed_tiebreak: "No stocks on either side. {winner} advances as the higher seed"', () => {
  const m = finalLine({ ...R, gain: 0 }, { ...P, gain: 0 }, 'me', outcome({ outcome_reason: 'both_empty_playoff_seed_tiebreak' }));
  assertEquals(m.line, 'No stocks on either side. Roberto B. advances as the higher seed');
  assertEquals(m.noStocks, { you: true, opp: true });
});

Deno.test('the winner is the card\'s leader (the server\'s, from the left side)', () => {
  const o = outcome({ outcome_reason: 'percent_tiebreak', team1_percent_gain: 1, team2_percent_gain: 2 });
  assertEquals(finalLine({ ...R, gain: 5 }, { ...P, gain: 5 }, 'opponent', o).leader, 'opp');
});

// ── everything else keeps #566's rule ───────────────────────────────────────────────────────────
const verdicts: (ServerVerdict | undefined)[] = ['me', 'opponent', 'nobody', undefined];
const dollars: [number, number][] = [[50, 20], [20, 50], [10, 10], [0, 0], [-12, 0], [0, -12]];
const KEEPS_566: [string, RecordedOutcome | undefined][] = [
  ['not_recorded', outcome({ outcome_reason: 'not_recorded' })],
  ['playoff_seed_unresolved', outcome({ outcome_reason: 'playoff_seed_unresolved' })],
  ['a NULL reason on a scored row', outcome({ outcome_reason: null })],
  ['a row without the column (older cached response)', outcome({})],
  ['a reason this build does not know', outcome({ outcome_reason: 'invented_reason' })],
  ['bye_no_result', outcome({ outcome_reason: 'bye_no_result' })],
  ['playoff_no_opponent', outcome({ outcome_reason: 'playoff_no_opponent' })],
  ['no outcome read at all', undefined],
];
for (const [name, o] of KEEPS_566) {
  Deno.test(`${name}: #566's rule exactly, for every verdict and dollar pair`, () => {
    for (const v of verdicts) {
      for (const [a, b] of dollars) {
        const got = finalLine({ ...R, gain: a }, { ...P, gain: b }, v, o);
        const want = interimFinalLine({ ...R, gain: a }, { ...P, gain: b }, v);
        assertEquals(got, want, `${name} ${v} ${a}/${b}`);
        assertEquals(got.noStocks, { you: false, opp: false });
      }
    }
  });
}

Deno.test('#566\'s own cases, spelled out: won by / Dead even / no line', () => {
  const nr = outcome({ outcome_reason: 'not_recorded' });
  assertEquals(line(50, 20, 'me', nr), 'Roberto B. won by $30.00'); // a dollar-leader win
  assertEquals(line(10, 10, 'nobody', nr), 'Dead even'); // a true tie
  assertEquals(line(10, 10, 'me', nr), null); // a percent tiebreak week, scored before the column
  assertEquals(line(-12, 0, 'me', nr), null); // an empty side's automatic loss
  assertEquals(line(25, 25, 'opponent', nr), null); // a seed tiebreak
  assertEquals(line(50, 20, undefined, nr), null); // a verdict not read
});

Deno.test('a verdict not read states nothing, whatever the stored reason says', () => {
  for (const reason of ['both_empty_tie', 'percent_tiebreak', 'team2_empty_auto_loss', 'playoff_seed_tiebreak', 'both_empty_playoff_seed_tiebreak', 'dollar_gain', 'regular_season_true_tie']) {
    const o = outcome({ outcome_reason: reason, team1_percent_gain: 1.76, team2_percent_gain: 0.74 });
    assertEquals(finalLine({ ...R, gain: 0 }, { ...P, gain: 0 }, undefined, o), { leader: null, line: null, noStocks: { you: false, opp: false } }, reason);
  }
});

Deno.test('a reason the row\'s own winner or totals contradict is NOT stated (falls back to #566)', () => {
  // percent_tiebreak on unequal dollars, with a tie, or with the "loser's" percent higher or a percent missing.
  const pct = (a: number | null, b: number | null) => outcome({ outcome_reason: 'percent_tiebreak', team1_percent_gain: a, team2_percent_gain: b });
  assertEquals(line(50, 20, 'me', pct(1.76, 0.74)), 'Roberto B. won by $30.00');
  assertEquals(line(10, 10, 'nobody', pct(1.76, 0.74)), 'Dead even');
  assertEquals(line(10, 10, 'me', pct(0.74, 1.76)), null);
  assertEquals(line(10, 10, 'me', pct(1.76, null)), null);
  assertEquals(line(10, 10, 'me', pct(null, null)), null);
  // The empty loser cannot be the winner: the reason is dropped, and #566's rule states only what the dollars prove.
  assertEquals(line(0, -12, 'me', outcome({ outcome_reason: 'team1_empty_auto_loss' })), 'Roberto B. won by $12.00');
  assertEquals(line(-12, 0, 'me', outcome({ outcome_reason: 'team1_empty_auto_loss' })), null);
  // A seed reason on unequal dollars, or a server tie.
  assertEquals(line(30, 25, 'me', outcome({ outcome_reason: 'playoff_seed_tiebreak' })), 'Roberto B. won by $5.00');
  assertEquals(line(25, 25, 'nobody', outcome({ outcome_reason: 'both_empty_playoff_seed_tiebreak' })), 'Dead even');
});

Deno.test('recordedOutcome: orientation, string numerics, absent fields, a user not on the row', () => {
  const o = recordedOutcome({ team1_user_id: 'r', team2_user_id: 'p', outcome_reason: 'percent_tiebreak', team1_percent_gain: '1.76', team2_percent_gain: '0.74' }, 'p')!;
  assertEquals([o.leftIs, o.leftPercent, o.rightPercent], ['team2', 0.74, 1.76]);
  const none = recordedOutcome({ team1_user_id: 'r', team2_user_id: 'p' }, 'r')!;
  assertEquals([none.reason, none.leftPercent, none.rightPercent], [null, null, null]);
  assertEquals(recordedOutcome({ team1_user_id: 'r', team2_user_id: 'p' }, 'x'), undefined);
  assertEquals(outcomeFromRows([{ team1_user_id: 'a', team2_user_id: 'b' }, base({ outcome_reason: 'dollar_gain' })], 'p')?.reason, 'dollar_gain');
  assertEquals(outcomeFromRows([], 'p'), undefined);
});

Deno.test('scoreboardModel: FINAL goes through the helper, LIVE is unchanged', () => {
  const o = outcome({ outcome_reason: 'percent_tiebreak', team1_percent_gain: 1.76, team2_percent_gain: 0.74 });
  assertEquals(scoreboardModel({ ...R, gain: 10 }, { ...P, gain: 10 }, true, 'me', o).line, 'Roberto B. won the tiebreak, +1.76% to +0.74%');
  assertEquals(scoreboardModel({ ...R, gain: 10 }, { ...P, gain: 10 }, true, 'me').line, null);
  assertEquals(scoreboardModel({ ...R, gain: 50 }, { ...P, gain: 20 }, false, undefined, o).line, 'Roberto B. leads by $30.00');
  assertEquals(scoreboardModel({ ...R, gain: 5 }, { ...P, gain: 5 }, false).line, 'Dead even');
});

// ── no percent is ever computed on the phone ────────────────────────────────────────────────────
Deno.test('no code path computes a percent: the helper only formats the two stored values', () => {
  const src = SOURCES['lib/game/outcomeLine.ts'];
  const code = src.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
  assertFalse(/[*\/]\s*100\b/.test(code), 'no x100 / /100');
  assertFalse(/\bgain\s*\/|\/\s*[A-Za-z_.]*(gain|cost|value|price)/i.test(code), 'no gain division');
  assert(/formatPercent\(p, \{ sign: 'always' \}\)/.test(code), 'only formatPercent, of a stored value');
  // The percents enter through the columns, nowhere else.
  assert(code.includes('team1_percent_gain') && code.includes('team2_percent_gain'));
  // And no screen or builder derives one: none of the touched files multiplies a gain into a percent.
  for (const f of ['lib/game/useFinalOutcome.ts', 'lib/game/allMatchups.ts', 'lib/game/seasonRecap.ts', 'components/sp/gn/Scoreboard.tsx']) {
    assertFalse(/\*\s*100\b|\/\s*100\b/.test(SOURCES[f]), f);
  }
});

// ── the data: every read selects the columns, every builder carries the oriented outcome ────────
const mu = (t1: string, t2: string, g1: number, g2: number, winner: string | null, extra: Partial<RecapMatchup> = {}): RecapMatchup => ({
  week_number: 14, team1_user_id: t1, team2_user_id: t2, team1_gain: g1, team2_gain: g2, winner_user_id: winner,
  is_tie: winner === null, is_playoff: false, week_start: null, week_end: null, ...extra,
});

Deno.test('recap All matchups + week detail carry the outcome from side a; the recap ROWS carry no reason', () => {
  const pct = mu('p', 'me', 10, 10, 'me', { outcome_reason: 'percent_tiebreak', team1_percent_gain: 0.74, team2_percent_gain: 1.76 });
  const names = [{ user_id: 'me', display_name: 'Roberto B.' }, { user_id: 'p', display_name: 'Paolo M.' }];
  const recap = buildRecap({ matchups: [pct], myUserId: 'me', names, numWeeks: 14, playoffTeams: 6 });
  const g = recap.all[0].games[0];
  assertEquals(g.a.userId, 'me'); // your game puts you first: the stored columns are flipped to match
  assertEquals([g.outcome?.leftPercent, g.outcome?.rightPercent], [1.76, 0.74]);
  assertEquals(scoreboardModel({ name: 'Roberto B.', gain: 10 }, { name: 'Paolo M.', gain: 10 }, true, g.verdict, g.outcome).line, 'Roberto B. won the tiebreak, +1.76% to +0.74%');
  const d = recapGameDetail([pct], 14, 'me', 'p')!;
  assertEquals([d.outcome?.leftPercent, d.outcome?.rightPercent], [1.76, 0.74]);
  assertEquals(recapGameDetail([pct], 14, 'p', 'me')?.outcome?.leftPercent, 0.74);
  // The rows list: no reason on a RecapRow (his pick, #574).
  assertFalse('outcome' in recap.mine[0] || 'outcome_reason' in recap.mine[0]);
});

Deno.test('a row without the columns builds as before (an older cached response)', () => {
  const plain = mu('me', 'p', 50, 20, 'me');
  const recap = buildRecap({ matchups: [plain], myUserId: 'me', names: [], numWeeks: 14, playoffTeams: 6 });
  assertEquals(recap.all[0].games[0].outcome?.reason, null);
  assertEquals(recapGameDetail([plain], 14, 'me', 'p')?.outcome?.reason, null);
  const rows = buildAllMatchups({ myUserId: 'me', week: 14, matchups: [{ ...plain, is_tie: false }], snapshots: [], trades: [], quote: () => null, names: [] });
  assertEquals(rows[0].outcome?.reason, null);
  assertEquals(finalLine({ ...R, gain: 50 }, { ...P, gain: 20 }, rows[0].verdict, rows[0].outcome).line, 'Roberto B. won by $30.00');
});

Deno.test('the live tab\'s All matchups carries the outcome, oriented to side a; a bye carries none', () => {
  const rows = buildAllMatchups({
    myUserId: 'me', week: 14,
    matchups: [
      { team1_user_id: 'p', team2_user_id: 'me', team1_gain: 1, team2_gain: 1, winner_user_id: 'p', is_tie: false, is_playoff: false, outcome_reason: 'percent_tiebreak', team1_percent_gain: 2, team2_percent_gain: 1 },
      { team1_user_id: 'x', team2_user_id: null, team1_gain: 4, team2_gain: null, winner_user_id: null, is_tie: false, is_playoff: false, outcome_reason: 'bye_no_result' },
    ],
    snapshots: [], trades: [], quote: () => null, names: [],
  });
  assertEquals([rows[0].outcome?.leftIs, rows[0].outcome?.leftPercent], ['team1', 2]);
  assertEquals(rows[1].outcome, undefined);
});

Deno.test('the outcomes fixture covers every kind of week, and only it carries the columns', () => {
  const season = seasonMatchups('outcomes') as unknown as (RecapMatchup & { week_number: number })[];
  const reasons = season.map((m) => m.outcome_reason).filter(Boolean).sort();
  assertEquals(reasons, ['both_empty_playoff_seed_tiebreak', 'not_recorded', 'percent_tiebreak', 'playoff_seed_tiebreak', 'team2_empty_auto_loss']);
  assertEquals((seasonMatchups('champion') as unknown as RecapMatchup[]).filter((m) => m.outcome_reason !== undefined).length, 0);
  // The fixture's winners agree with each row's own server verdict (so the card names the stored winner).
  for (const m of season.filter((x) => x.outcome_reason)) assert(m.winner_user_id !== null);
  assertEquals(serverVerdict(season.find((m) => m.outcome_reason === 'percent_tiebreak')!, SEAM_ME), 'opponent');
});

// ── the wiring ──────────────────────────────────────────────────────────────────────────────────
const COLS = 'outcome_reason, team1_percent_gain, team2_percent_gain';
Deno.test('wiring: every read that feeds a finished card selects the new columns, straight from the matchups table', () => {
  assert(SOURCES['lib/game/useAllMatchups.ts'].includes(`week_start, week_end, ${COLS}'`), 'All matchups (live tab)');
  assert(SOURCES['lib/game/useSeasonRecap.ts'].includes(`week_start, week_end, ${COLS}'`), 'the recap + week detail');
  assert(SOURCES['lib/game/useFinalOutcome.ts'].includes("supabase.from('matchups').select(FINAL_OUTCOME_COLUMNS)"), 'the tab\'s finished week');
  assert(SOURCES['lib/game/useFinalOutcome.ts'].includes("export const FINAL_OUTCOME_COLUMNS = 'team1_user_id, team2_user_id, outcome_reason, team1_percent_gain, team2_percent_gain'"));
  // No RPC change: the hook reads the table, never an RPC, and get_home_league's shape is untouched here.
  assertFalse(/\.rpc\(|seamRpc/.test(SOURCES['lib/game/useFinalOutcome.ts']));
});

Deno.test('wiring: the finished-week view and both All matchups pass the outcome into Scoreboard\'s final line', () => {
  assert(SOURCES['components/game/FinishedWeek.tsx'].includes('        verdict={verdict}\n        outcome={outcome}\n'), 'FinishedWeek -> Scoreboard');
  assert(SOURCES['app/matchup-week.tsx'].includes('outcome={detail.outcome}'), 'the recap\'s week detail');
  const tab = SOURCES['app/(tabs)/matchup.tsx'];
  assert(tab.includes('useFinalOutcome(activeLeagueId'), 'the tab reads it');
  // Each call site on its OWN slice (a whole-file includes() is satisfied by either one alone).
  const finalAt = tab.indexOf("if (view.kind === 'final' && final) {");
  const liveAt = tab.lastIndexOf('<Scoreboard');
  const finalBranch = tab.slice(finalAt, liveAt);
  assert(finalBranch.slice(0, finalBranch.indexOf('<FinishedWeek')).includes('final verdict={final.verdict} outcome={outcome}'), 'the opponent-less final card');
  assert(finalBranch.slice(finalBranch.indexOf('<FinishedWeek')).includes('verdict={final.verdict}\n        outcome={outcome}\n'), 'the tab\'s finished week (FinishedWeek)');
  assert(tab.includes('ledgers={ledgers} outcome={outcome} />'), 'the body receives it');
  assert(tab.includes('          verdict={r.verdict}\n          outcome={r.outcome}\n'), 'the live tab\'s All matchups');
  assert(SOURCES['components/game/SeasonRecap.tsx'].includes('                  verdict={g.verdict}\n                  outcome={g.outcome}\n'), 'the recap\'s All matchups');
  assert(SOURCES['components/sp/gn/Scoreboard.tsx'].includes('scoreboardModel(you, opponent, final, verdict, outcome)'));
  assert(SOURCES['components/sp/logic/gameNight.ts'].includes('if (final) return finalLine(you, opp, verdict, outcome);'));
});

Deno.test('wiring: the recap ROWS get no reason (his pick, #574)', () => {
  const recap = SOURCES['components/game/SeasonRecap.tsx'];
  // The only outcome the recap passes is on a Scoreboard card; the "My matchup" rows read none.
  assertEquals(recap.split('outcome=').length - 1, 1);
  assertFalse(SOURCES['components/game/ScheduleList.tsx'].includes('outcome'));
});

Deno.test('VoiceOver reads the same line, and a no-stocks side is read without a $0.00', () => {
  const sb = SOURCES['components/sp/gn/Scoreboard.tsx'];
  // One `line` feeds both the drawn Text and the spoken label.
  assert(sb.includes("${showLine ? ` ${line}.` : ''}"));
  assert(sb.includes('{keepMoney(line ?? \'\')}'));
  assert(sb.includes('const spokenSide = (name: string, gain: number, empty: boolean, isYou: boolean)'));
  assert(sb.includes("${empty ? '' : `, ${formatMoney(gain, { sign: 'always' })}`}"));
  // The half's own button label drops the amount the same way, and the total draws the dash.
  assert(sb.includes("label={noStocks ? `${team.name}${you ? ', you' : ''}` :"));
  assert(sb.includes("const totalText = dashed ? SEASON_TILE_UNSCORED : formatMoney(team.gain, { sign: 'always' });"));
});
