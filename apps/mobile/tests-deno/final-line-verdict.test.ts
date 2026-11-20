/**
 * Review 2 on #566 (4634182791 / 4634182888): a FINAL Scoreboard's line names the SERVER's winner
 * (matchups.winner_user_id via weekResult's serverVerdict), never the dollars' (Planner, 2026-11-19,
 * an interim removal, no new words). One rule: components/sp/logic/gameNight.ts scoreboardModel.
 *  - server winner = dollar leader: "{winner} won by $X";
 *  - no server winner, equal dollars: "Dead even";
 *  - anything else, and a verdict not read: NO line.
 * The server reasons are process-week-results' outcome.reason. Run: `deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { scoreboardModel } from '../components/sp/logic/gameNight.ts';
import { serverVerdict, weekResult, type ServerVerdict } from '../lib/game/weekResult.ts';
import { buildAllMatchups } from '../lib/game/allMatchups.ts';
import { buildRecap, recapGameDetail, type RecapMatchup } from '../lib/game/seasonRecap.ts';
import { finalGains } from '../lib/game/buildMatchupViewModel.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const R = { name: 'Roberto B.' };
const P = { name: 'Paolo M.' };
const line = (you: number, opp: number, verdict: ServerVerdict | undefined) =>
  scoreboardModel({ ...R, gain: you }, { ...P, gain: opp }, true, verdict).line;

Deno.test('a dollar-leader win: "{winner} won by $X", the amount |a - b|', () => {
  assertEquals(line(50, 20, 'me'), 'Roberto B. won by $30.00');
  assertEquals(line(-5, 12.5, 'opponent'), 'Paolo M. won by $17.50');
});

Deno.test('a true tie (regular_season_true_tie, both_empty_tie): "Dead even"', () => {
  assertEquals(line(10, 10, 'nobody'), 'Dead even');
  assertEquals(line(0, 0, 'nobody'), 'Dead even');
});

Deno.test('percent_tiebreak (equal dollars, the server names a winner): NO line, never "Dead even" or "won by $0.00"', () => {
  assertEquals(line(10, 10, 'me'), null);
  assertEquals(line(10, 10, 'opponent'), null);
});

Deno.test('an empty portfolio\'s automatic loss (-$12 beats $0): NO line, never "the empty side won by $12"', () => {
  // team2_empty_auto_loss: the opponent held nothing ($0.00), Roberto lost $12 and still WINS.
  assertEquals(line(-12, 0, 'me'), null);
  // team1_empty_auto_loss, from the other side.
  assertEquals(line(0, -12, 'opponent'), null);
});

Deno.test('the playoff seed tiebreaks (playoff_seed_tiebreak, both_empty_playoff_seed_tiebreak): NO line', () => {
  assertEquals(line(25, 25, 'opponent'), null);
  assertEquals(line(0, 0, 'me'), null);
});

Deno.test('a final whose server result is not read: NO line, never the dollars\' winner', () => {
  assertEquals(line(50, 20, undefined), null);
  assertEquals(line(10, 10, undefined), null);
  // A server tie with unequal dollars cannot be stated honestly either.
  assertEquals(line(50, 20, 'nobody'), null);
});

Deno.test('a LIVE week is unchanged: the dollars lead ("leads by" / "Dead even")', () => {
  assertEquals(scoreboardModel({ ...R, gain: 50 }, { ...P, gain: 20 }, false).line, 'Roberto B. leads by $30.00');
  assertEquals(scoreboardModel({ ...R, gain: 5 }, { ...P, gain: 5 }, false).line, 'Dead even');
});

Deno.test('the card never names a different winner than the row (every server reason)', () => {
  const cases: [number, number, ServerVerdict][] = [
    [50, 20, 'me'], [20, 50, 'opponent'], [10, 10, 'nobody'], [10, 10, 'me'], [-12, 0, 'me'], [0, -12, 'opponent'], [25, 25, 'opponent'],
  ];
  for (const [you, opp, v] of cases) {
    const card = scoreboardModel({ ...R, gain: you }, { ...P, gain: opp }, true, v).line;
    const row = weekResult({ myGain: you, oppGain: opp, verdict: v });
    if (card === null) continue;
    if (card === 'Dead even') assertEquals(row, 'T', `${you}/${opp}/${v}`);
    else if (card.startsWith(R.name)) assertEquals(row, 'W', `${you}/${opp}/${v}`);
    else assertEquals(row, 'L', `${you}/${opp}/${v}`);
  }
});

const m = (t1: string, t2: string, g1: number, g2: number, winner: string | null): RecapMatchup => ({
  week_number: 1, team1_user_id: t1, team2_user_id: t2, team1_gain: g1, team2_gain: g2, winner_user_id: winner,
  is_tie: winner === null, is_playoff: false, week_start: null, week_end: null,
});

Deno.test('every finished board gets the SERVER verdict from its data, from side a', () => {
  // The recap's All matchups (side a = you when it's your game) and its week detail.
  const pct = m('paolo', 'me', 10, 10, 'paolo');
  const recap = buildRecap({ matchups: [pct], myUserId: 'me', names: [], numWeeks: 3, playoffTeams: 4 });
  assertEquals(recap.all[0].games[0].a.userId, 'me');
  assertEquals(recap.all[0].games[0].verdict, 'opponent');
  assertEquals(recapGameDetail([pct], 1, 'me', 'paolo')?.verdict, 'opponent');
  assertEquals(recapGameDetail([pct], 1, 'paolo', 'me')?.verdict, 'me');
  // The live tab's All matchups (posted rows).
  const rows = buildAllMatchups({ myUserId: 'me', week: 1, matchups: [{ ...pct, is_tie: false }], snapshots: [], trades: [], quote: () => null, names: [] });
  assertEquals(rows[0].verdict, serverVerdict(pct, 'paolo'));
  // The tab's final week (get_home_league): finalGains carries it.
  const data = { current_week: { week_number: 1 }, matchups: [pct] } as unknown as Parameters<typeof finalGains>[0];
  assertEquals(finalGains(data, 'me')?.verdict, 'opponent');
});

Deno.test('wiring: the four finished boards pass the verdict; VoiceOver follows the shown line', () => {
  assert(SOURCES['components/game/FinishedWeek.tsx'].includes('        final\n        verdict={verdict}\n'));
  assert(SOURCES['app/matchup-week.tsx'].includes('verdict={detail.verdict}'));
  const tab = SOURCES['app/(tabs)/matchup.tsx'];
  assert(tab.includes('verdict={final.verdict}'), 'the tab\'s final week (and its no-opponent fallback)');
  assert(tab.includes('          final={r.final}\n          verdict={r.verdict}\n'), 'the live tab\'s All matchups');
  assert(SOURCES['components/game/SeasonRecap.tsx'].includes('                  final\n                  verdict={g.verdict}\n'));
  const sb = SOURCES['components/sp/gn/Scoreboard.tsx'];
  assert(sb.includes('const model = opponent ? scoreboardModel(you, opponent, final, verdict, outcome) : null;'));
  assert(sb.includes('const showLine = showLineProp && !unscored && line !== null;'));
  // The spoken label carries the line only when it is shown.
  assert(sb.includes("${showLine ? ` ${line}.` : ''}"));
});
