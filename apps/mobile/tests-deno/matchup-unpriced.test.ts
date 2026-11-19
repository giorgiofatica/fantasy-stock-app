/**
 * Matchup with an unpriced stock (Giorgio, 2026-11-19, PR #562: "row has the dash but up top accounts for total
 * without that stock"; "i want the running total to not be zero if there is an issue with one stock"):
 *   - the stock keeps its slot with "–" on its row;
 *   - each team's total is a NUMBER, the sum of the stocks that DO have a live price; never a dash;
 *   - the leads-by line is worked out from those totals;
 *   - a notice under the switch names the unpriced stocks (both teams', each once), live weeks only.
 * All matchups' live games total the same way. A league without weeks (Duration) draws nothing under the tab.
 *   cd apps/mobile/tests-deno && deno test .
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { buildMatchupLive, type MatchupInput } from '../lib/game/buildMatchupViewModel.ts';
import { buildAllMatchups, type AllMatchupsInput } from '../lib/game/allMatchups.ts';
import { pricedTotal } from '../lib/game/lineupLedger.ts';
import { missingPriceSymbols, priceNoticeText } from '../lib/game/priceNotice.ts';
import { rosterHalfLabel, rosterHalfParts, rosterHalfShow, scoreboardModel, WEEK_UNKNOWN } from '../components/sp/logic/gameNight.ts';
import { knownWithoutWeeks } from '../lib/game/leagueWeeks.ts';
import { matchupWeekExtras, parseMatchupFixture, UNPRICED_FIXTURE_SYMBOLS } from '../lib/game/matchupFixture.ts';
import { GIANLUIGI_HOLDINGS, ROBERTO_HOLDINGS } from '../lib/home/homeFixtureData.ts';
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

// ── The totals: the priced sum, always a number ─────────────────────────────────────────
// NVDA 10 @100 -> 112.50 (+125.00), AAPL 5 @200 -> 198 (-10.00); AMZN 4 @50 -> 60 (+40.00), KO 2 @70 -> 71 (+2.00).

Deno.test('pricedTotal: the sum of the rows of the stocks that have a price; a missing one is left out', () => {
  const rows = [{ symbol: 'NVDA', cents: 12500 }, { symbol: 'AAPL', cents: -1000 }];
  assertEquals(pricedTotal(rows, []), 115);
  assertEquals(pricedTotal(rows, ['AAPL']), 125, 'AAPL is "–" on its row and not in the total');
  assertEquals(pricedTotal(rows, ['aapl']), 125, 'case-insensitive');
  assertEquals(pricedTotal(rows, ['NVDA', 'AAPL']), 0, 'every stock unpriced: a real 0 sum, still a number');
  assertEquals(pricedTotal([], ['KO']), 0);
});

Deno.test('Matchup live: every holding priced -> the full totals and who leads', () => {
  const vm = buildMatchupLive(live(without()));
  assertEquals([vm.me.total, vm.opp!.total], [115, 42]);
  assertEquals([vm.leader, vm.leadDollars], ['me', 73]);
});

Deno.test('Matchup live: YOUR unpriced holding -> your total is the rest (a number), and the lead is from it', () => {
  const vm = buildMatchupLive(live(without('AAPL')));
  assertEquals(vm.me.unpriced, ['AAPL']);
  assertEquals(vm.me.total, 125, 'NVDA alone: never a dash, never zero');
  assertEquals(vm.opp!.total, 42);
  assertEquals([vm.leader, vm.leadDollars], ['me', 83]);
});

Deno.test('Matchup live: THEIR unpriced holding -> the same on their side', () => {
  const vm = buildMatchupLive(live(without('KO')));
  assertEquals([vm.me.total, vm.opp!.total], [115, 40]);
  assertEquals([vm.leader, vm.leadDollars], ['me', 75]);
});

Deno.test('All matchups: a live side totals the same way as Matchup (the priced sum); posted games keep the server\'s', () => {
  const base: Omit<AllMatchupsInput, 'quote'> = {
    myUserId: 'roberto',
    week: 6,
    matchups: [{ team1_user_id: 'roberto', team2_user_id: 'gianluigi', team1_gain: null, team2_gain: null, winner_user_id: null, is_tie: false, is_playoff: false }],
    snapshots: [{ ...row('NVDA', 10, 100), user_id: 'roberto' }, { ...row('AAPL', 5, 200), user_id: 'roberto' }, { ...row('AMZN', 4, 50), user_id: 'gianluigi' }],
    trades: [],
    names: data().standings.map((s) => ({ user_id: s.user_id, display_name: s.display_name, is_bot: s.is_bot })),
  };
  const [g] = buildAllMatchups({ ...base, quote: without('AAPL') });
  assertEquals([g.a.gain, g.b!.gain], [125, 40]);
  const [whole] = buildAllMatchups({ ...base, quote: without() });
  assertEquals(whole.a.gain, 115);
  const [posted] = buildAllMatchups({ ...base, matchups: [{ ...base.matchups[0], team1_gain: 5, team2_gain: 3 }], quote: without('AAPL') });
  assertEquals([posted.a.gain, posted.b!.gain], [5, 3]);
});

Deno.test('Scoreboard: totals are numbers again and the leads-by line is back (no dash path at all)', () => {
  assertEquals(scoreboardModel({ name: 'A', gain: 125 }, { name: 'B', gain: 42 }, false).line, 'A leads by $83.00');
  const sb = strip(SOURCES['components/sp/gn/Scoreboard.tsx']);
  assert(sb.includes("{formatMoney(team.gain, { sign: 'always' })}"), 'the total is formatted money');
  assert(!sb.includes('WEEK_UNKNOWN') && !sb.includes('scoreTotalText') && !sb.includes('lineShown'), 'no dash total, no hidden lead line');
});

Deno.test('Matchup tab: live and bye totals are SideView.total (numbers); a bye roster shows unpriced stocks too', () => {
  const src = strip(SOURCES['app/(tabs)/matchup.tsx']);
  assert(src.includes('const mine = isFinal && final ? final.me : live.me.total;'));
  assert(src.includes('const theirs = isFinal && final ? final.opp : live.opp?.total ?? 0;'));
  assert(src.includes('<Scoreboard you={{ name: youName, gain: live.me.total }} opponent={null}'), 'the bye half too');
  assert(src.includes('{raw && (live.me.lineup.length || live.me.unpriced.length) ? ('));
  assert(!src.includes('unpricedNote'), 'the "counted at cost" caption stays gone: the notice replaces it');
});

// ── The price notice ───────────────────────────────────────────────────────────────

Deno.test('notice text: Giorgio\'s approved copy, exactly, for one and for two stocks', () => {
  assertEquals(priceNoticeText([]), null, 'every price in: no notice');
  assertEquals(priceNoticeText(['AAPL']), "The price for AAPL isn't loading right now. We're working on it, and the totals will update when it's back.");
  assertEquals(priceNoticeText(['AAPL', 'JPM']), "Prices for AAPL and JPM aren't loading right now. We're working on it, and the totals will update when they're back.");
  // Three or more: the Design Lead's call; provisional "A, B and C".
  assertEquals(priceNoticeText(['AAPL', 'JPM', 'KO']), "Prices for AAPL, JPM and KO aren't loading right now. We're working on it, and the totals will update when they're back.");
});

Deno.test('notice stocks: BOTH teams\', each once, yours first', () => {
  assertEquals(missingPriceSymbols(['AAPL'], ['JPM']), ['AAPL', 'JPM']);
  assertEquals(missingPriceSymbols(['aapl', 'NVDA'], ['AAPL', 'KO']), ['AAPL', 'NVDA', 'KO'], 'deduped, upper-case');
  assertEquals(missingPriceSymbols([], null), [], 'a bye: yours only');
  assertEquals(missingPriceSymbols([], ['JPM']), ['JPM'], 'their missing price is named too');
});

Deno.test('notice placement: under the switch, above the totals, in a LIVE week only (never on a scored week)', () => {
  const src = strip(SOURCES['app/(tabs)/matchup.tsx']);
  assert(src.includes("const notice = view.kind === 'scoreboard' || view.kind === 'bye' ? priceNoticeText(missingPriceSymbols(live.me.unpriced, live.opp?.unpriced)) : null;"), 'live views only');
  const body = src.slice(src.indexOf('const isFinal = view.kind === \'final\';'));
  assert(body.indexOf('{!isFinal && notice ? <PriceNotice text={notice} /> : null}') < body.indexOf('<Scoreboard'), 'above the card, never on a final');
  const bye = src.slice(src.indexOf("if (view.kind === 'bye') {"));
  assert(bye.indexOf('{notice ? <PriceNotice text={notice} /> : null}') < bye.indexOf('<Scoreboard'), 'a bye week too');
  const card = strip(SOURCES['components/game/PriceNotice.tsx']);
  assert(card.includes('backgroundColor: colors.accentTint'), 'the teal accent as a soft tint (pick A), not warnTint');
  assert(card.includes('<Icon name="info" size="callout" tone="accent" />'), 'an info icon');
  assert(!/warn|yellow/i.test(card.replace(/\/\/.*$/gm, '')), 'never yellow or warnTint');
  assert(card.includes('accessible accessibilityLabel={text}'), 'one element for VoiceOver, saying the text');
});

// ── The roster half's number slot ──────────────────────────────────────────────────

Deno.test('roster half: the week; the "–" (number slot kept, no percent) for an unknown week; nothing for a withheld final', () => {
  const h = { ticker: 'AAPL', company: 'Apple' };
  assertEquals(rosterHalfShow({ ...h, weekGain: 62.4, weekPct: 6.05 }), { kind: 'figures', gain: 62.4, pct: 6.05 });
  assertEquals(rosterHalfShow({ ...h, weekGain: null, weekPct: null }), { kind: 'unknown', text: WEEK_UNKNOWN });
  assertEquals(rosterHalfShow({ ...h, weekGain: 1, weekPct: null }), { kind: 'unknown', text: WEEK_UNKNOWN });
  assertEquals(rosterHalfShow({ ...h, weekGain: 62.4, weekPct: 6.05, figures: false }), { kind: 'none' }, 'withheld stays the stock alone');
  assertEquals(rosterHalfShow({ ...h, weekGain: 0, weekPct: 0 }).kind, 'figures', 'a real flat week is $0.00, not the dash');
  // The unknown half keeps its number slot (so the "–" is drawn); the withheld one drops it.
  assert(rosterHalfParts({ figures: true, stacked: false, mirror: false }).includes('num'));
  assertEquals(rosterHalfParts({ figures: false, stacked: false, mirror: false }), ['name']);
  assertEquals(rosterHalfLabel('Yours', { ...h, weekGain: null, weekPct: null }), 'Yours, AAPL, Apple', 'VoiceOver: no dash, no $0.00');
  const row = strip(SOURCES['components/sp/gn/RosterRow.tsx']);
  assert(row.includes("rosterHalfParts({ figures: show.kind !== 'none', stacked, mirror })"), 'an unknown half keeps its slot');
  assert(row.includes("show.kind === 'unknown' ? show.text : ''"), 'the slot draws the dash');
  assert(row.includes('const toneColor = figs ? colors[toneOf(figs.gain)] : colors.text2;'), 'secondary, as everywhere else');
  assert(row.includes('{figs ? (\n        <Text variant="caption" color={toneColor} style={styles.pct}'), 'no percent line for the dash');
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

// ── The capture fixture the gate stills use ───────────────────────────────────────

Deno.test("capture: the 'unpriced' Matchup fixture has one HELD, unpriced stock on EACH side, and no sale", () => {
  assertEquals(parseMatchupFixture('unpriced'), 'unpriced');
  const x = matchupWeekExtras('unpriced');
  assertEquals(x.unpriced, [...UNPRICED_FIXTURE_SYMBOLS]);
  assertEquals(x.trades, [], 'no sale: a FULLY unpriced holding, the case that used to vanish');
  const [mine, theirs] = UNPRICED_FIXTURE_SYMBOLS;
  assert(ROBERTO_HOLDINGS.some((h) => h.symbol === mine) && !GIANLUIGI_HOLDINGS.some((h) => h.symbol === mine));
  assert(GIANLUIGI_HOLDINGS.some((h) => h.symbol === theirs) && !ROBERTO_HOLDINGS.some((h) => h.symbol === theirs));
  for (const v of ['unslotted', 'category', 'tiers', 'bought', 'sold', 'stress'] as const) assertEquals(matchupWeekExtras(v).unpriced, [], v);
  assert(strip(SOURCES['lib/home/useHomeLeague.ts']).includes('if (matchupExtras.unpriced.includes(sym)) return null;'), 'the seam quote honours it');
});
