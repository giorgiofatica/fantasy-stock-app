/**
 * No stand-ins on Matchup (build 18): a side with ANY unpriced holding has an unknown total ("–"),
 * never the priced rest's sum shown as the team (CLAUDE.md, all-or-nothing case 5: a subset stated
 * as the whole), and then nobody leads. All matchups' live games read the same way. A league
 * without weeks (Duration) draws nothing under the tab's header.
 *   cd apps/mobile/tests-deno && deno test .
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { buildMatchupLive, sideTotal, type MatchupInput } from '../lib/game/buildMatchupViewModel.ts';
import { buildAllMatchups, type AllMatchupsInput } from '../lib/game/allMatchups.ts';
import { scoreHalfLabel, scoreTotalText, scoreboardModel, WEEK_UNKNOWN } from '../components/sp/logic/gameNight.ts';
import { knownWithoutWeeks } from '../lib/game/leagueWeeks.ts';
import type { GetHomeLeagueResult, HomeLedgerRow } from '../lib/home/buildHomeViewModel.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const strip = (src: string) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const row = (symbol: string, quantity: number, week_start_price: number): HomeLedgerRow =>
  ({ symbol, quantity, week_start_price, entered_mid_week: false, created_at: '2026-09-28T14:35:00Z' });

function data(): GetHomeLeagueResult {
  return {
    my_ledger: { drafts: [], trades: [] },
    current_week: {
      week_number: 6,
      my_snapshots: [row('NVDA', 10, 100), row('AAPL', 5, 200)],
      my_trades: [],
      opponent_snapshots: [row('AMZN', 4, 50), row('KO', 2, 70)],
      opponent_trades: [],
    },
    matchups: [{ week_number: 6, week_start: '2026-09-28T13:30:00Z', week_end: '2026-10-02T20:00:00Z', is_playoff: false, team1_user_id: 'roberto', team2_user_id: 'gianluigi', team1_gain: null, team2_gain: null }],
    standings: [
      { user_id: 'roberto', rank: 1, wins: 4, losses: 1, ties: 0, points_for: 0, display_name: 'Roberto B.', is_bot: false },
      { user_id: 'gianluigi', rank: 5, wins: 1, losses: 4, ties: 0, points_for: 0, display_name: 'Gianluigi B.', is_bot: false },
    ],
  };
}
const prices: Record<string, number> = { NVDA: 112.5, AAPL: 198, AMZN: 60, KO: 71 };
const without = (...gone: string[]) => (s: string) => (gone.includes(s) ? null : prices[s] ?? null);
const live = (quote: (s: string) => number | null): MatchupInput => ({ data: data(), myUserId: 'roberto', quote, now: new Date('2026-09-29T17:00:00Z') });

// ── The totals ────────────────────────────────────────────────────────────────────

Deno.test('sideTotal: any unpriced holding -> unknown; none -> the gain', () => {
  assertEquals(sideTotal(12.5, []), 12.5);
  assertEquals(sideTotal(12.5, ['AAPL']), null);
  assertEquals(sideTotal(0, []), 0, 'a real flat week is 0, not unknown');
});

Deno.test('Matchup live: every holding priced -> both totals, and who leads', () => {
  const vm = buildMatchupLive(live(without()));
  assertEquals(vm.me.total, vm.me.gain);
  assertEquals(vm.opp!.total, vm.opp!.gain);
  assert(vm.leader !== null && vm.leadDollars !== null);
});

Deno.test('Matchup live: YOUR unpriced holding -> your total unknown, nobody leads, no gap', () => {
  const vm = buildMatchupLive(live(without('AAPL')));
  assertEquals(vm.me.unpriced, ['AAPL']);
  assertEquals(vm.me.total, null, 'NVDA alone is not your team');
  assert(vm.me.gain !== 0, 'the priced rest still exists underneath (never shown as the total)');
  assertEquals(vm.opp!.total, vm.opp!.gain, 'their side is whole');
  assertEquals([vm.leader, vm.leadDollars], [null, null]);
});

Deno.test('Matchup live: THEIR unpriced holding -> the same on their side', () => {
  const vm = buildMatchupLive(live(without('KO')));
  assertEquals(vm.opp!.total, null);
  assertEquals(vm.me.total, vm.me.gain);
  assertEquals([vm.leader, vm.leadDollars], [null, null]);
});

Deno.test('All matchups: a live game side with an unpriced holding has no total (gain and pct null)', () => {
  const base: Omit<AllMatchupsInput, 'quote'> = {
    myUserId: 'roberto',
    week: 6,
    matchups: [{ team1_user_id: 'roberto', team2_user_id: 'gianluigi', team1_gain: null, team2_gain: null, winner_user_id: null, is_tie: false, is_playoff: false }],
    snapshots: [{ ...row('NVDA', 10, 100), user_id: 'roberto' }, { ...row('AAPL', 5, 200), user_id: 'roberto' }, { ...row('AMZN', 4, 50), user_id: 'gianluigi' }],
    trades: [],
    names: data().standings.map((s) => ({ user_id: s.user_id, display_name: s.display_name, is_bot: s.is_bot })),
  };
  const [g] = buildAllMatchups({ ...base, quote: without('AAPL') });
  assertEquals([g.a.gain, g.a.pct], [null, null]);
  assert(g.b!.gain !== null && g.b!.pct !== null, 'the whole side keeps its total');
  const [whole] = buildAllMatchups({ ...base, quote: without() });
  assert(whole.a.gain !== null);
  // Posted (final) games keep the server's numbers whatever the quotes say.
  const [posted] = buildAllMatchups({ ...base, matchups: [{ ...base.matchups[0], team1_gain: 5, team2_gain: 3 }], quote: without('AAPL') });
  assertEquals([posted.a.gain, posted.b!.gain], [5, 3]);
});

// ── The Scoreboard's words ─────────────────────────────────────────────────────────

Deno.test('Scoreboard logic: an unknown total is the "–", no leader and no line; known totals as before', () => {
  assertEquals(scoreTotalText(null), WEEK_UNKNOWN);
  assertEquals(WEEK_UNKNOWN, '–');
  assertEquals(scoreTotalText(12.4), '+$12.40');
  assertEquals(scoreTotalText(0), '$0.00');
  assertEquals(scoreboardModel({ name: 'A', gain: null }, { name: 'B', gain: 3 }, false), { leader: null, line: '' });
  assertEquals(scoreboardModel({ name: 'A', gain: 3 }, { name: 'B', gain: null }, false), { leader: null, line: '' });
  assertEquals(scoreboardModel({ name: 'A', gain: 3 }, { name: 'B', gain: 1 }, false).line, 'A leads by $2.00');
  assertEquals(scoreHalfLabel('A', true, null), 'A, you', 'VoiceOver: the name alone, no dash, no $0.00');
});

Deno.test('Scoreboard (RN): the total and both labels come from the helpers; no line when it is empty', () => {
  const sb = strip(SOURCES['components/sp/gn/Scoreboard.tsx']);
  assert(sb.includes('const totalText = scoreTotalText(team.gain);'));
  assert(sb.includes('{totalText}\n'), 'the drawn total is the helper\'s text');
  assert(sb.includes("color={team.gain === null ? colors.text2 : undefined}"), 'the dash is secondary, as on the card');
  assert(sb.includes("const lineShown = showLine && line !== '';") && sb.includes('{lineShown ? ('));
  assert(!sb.includes('formatMoney('), 'no path formats a raw total');
});

Deno.test('Matchup tab: live totals are SideView.total; the at-cost note is gone; a bye roster shows unpriced stocks too', () => {
  const src = strip(SOURCES['app/(tabs)/matchup.tsx']);
  assert(src.includes('const mine = isFinal && final ? final.me : live.me.total;'));
  assert(src.includes('const theirs = isFinal && final ? final.opp : live.opp?.total ?? null;'));
  assert(src.includes('<Scoreboard you={{ name: youName, gain: live.me.total }} opponent={null}'), 'the bye half too');
  assert(src.includes('{raw && (live.me.lineup.length || live.me.unpriced.length) ? ('));
  assert(!src.includes('unpricedNote'));
});

// ── Duration ─────────────────────────────────────────────────────────────────────

Deno.test('knownWithoutWeeks: only a LOADED league without weeks (loading keeps its skeleton)', () => {
  assertEquals(knownWithoutWeeks({ league_type: 'duration' }), true);
  assertEquals(knownWithoutWeeks({ league_type: 'matchup' }), false);
  assertEquals(knownWithoutWeeks(null), false);
  assertEquals(knownWithoutWeeks(undefined), false);
  assertEquals(knownWithoutWeeks({ league_type: null }), true, 'a loaded league with no type has no weeks');
});

Deno.test('Matchup tab: a Duration league draws no switch and no body (nothing in their place)', () => {
  const src = strip(SOURCES['app/(tabs)/matchup.tsx']);
  assert(src.includes('const blank = knownWithoutWeeks(activeLeague);'));
  assert(src.includes('{m.derived && !blank ? (\n          <SegmentedControl'));
  assert(src.includes("{blank ? null : segment === 'all' ? ("), 'neither My matchup (its $0.00 vs $0.00) nor All matchups');
});
