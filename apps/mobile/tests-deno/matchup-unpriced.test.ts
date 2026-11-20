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
import { missingPriceSymbols, NOTICE_MAX_SCALE, noticeIconMetrics, PRICE_NOTICE_MANY, priceNoticeDisplay, priceNoticeText } from '../lib/game/priceNotice.ts';
import { listSymbols } from '../lib/game/listSymbols.ts';
import { WORD_JOINER } from '../lib/game/keepDots.ts';
import { rosterHalfLabel, rosterHalfParts, rosterHalfShow, scoreboardModel, WEEK_UNKNOWN } from '../components/sp/logic/gameNight.ts';
import { knownWithoutWeeks } from '../lib/game/leagueWeeks.ts';
import { fixtureLedger, matchupWeekExtras, parseMatchupFixture, UNPRICED_FIXTURE_SYMBOLS, UNPRICED_VARIANT_SYMBOLS } from '../lib/game/matchupFixture.ts';
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

Deno.test('a PARTLY unpriced stock (sold some this week, no price for the rest): its row is "–" and its sale is NOT in the total', () => {
  // Sold 2 AAPL at 210 on Tuesday (+20.00 realised), the other 3 have no live price.
  const d = data();
  d.current_week.my_trades = [{ symbol: 'AAPL', action: 'sell', quantity: 2, price: 210, created_at: '2026-09-29T15:00:00Z' }];
  const vm = buildMatchupLive({ data: d, myUserId: 'roberto', quote: without('AAPL'), now: new Date('2026-09-29T17:00:00Z') });
  assertEquals(vm.me.unpriced, ['AAPL']);
  assertEquals(vm.me.gain, 145, 'liveWeekScore\'s gain still counts the sale');
  assertEquals(vm.me.total, 125, 'the Scoreboard total is the stocks with a price: NVDA alone');
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
  // A partly unpriced side: the sale of the unpriced stock stays out, as on Matchup.
  const [partial] = buildAllMatchups({ ...base, trades: [{ symbol: 'AAPL', action: 'sell', quantity: 2, price: 210, created_at: '2026-09-29T15:00:00Z', user_id: 'roberto' }], quote: without('AAPL') });
  assertEquals(partial.a.gain, 125);
  const [posted] = buildAllMatchups({ ...base, matchups: [{ ...base.matchups[0], team1_gain: 5, team2_gain: 3 }], quote: without('AAPL') });
  assertEquals([posted.a.gain, posted.b!.gain], [5, 3]);
});

Deno.test('Scoreboard: totals are numbers again and the leads-by line is back (no dash path at all)', () => {
  assertEquals(scoreboardModel({ name: 'A', gain: 125 }, { name: 'B', gain: 42 }, false).line, 'A leads by $83.00');
  const sb = strip(SOURCES['components/sp/gn/Scoreboard.tsx']);
  // The total is money; the only dash is main's `unscored` (a recap game never posted, SeasonRecap only).
  assert(sb.includes("const totalText = unscored ? SEASON_TILE_UNSCORED : formatMoney(team.gain, { sign: 'always' });"), 'the total is formatted money');
  assert(!sb.includes('WEEK_UNKNOWN') && !sb.includes('scoreTotalText') && !sb.includes('lineShown'), 'no dash total from a missing price, no hidden lead line');
  assert(!strip(SOURCES['app/(tabs)/matchup.tsx']).includes('unscored'), 'Matchup never draws the recap\'s dash');
});

Deno.test('Matchup tab: live and bye totals are SideView.total (numbers); a bye roster shows unpriced stocks too', () => {
  const src = strip(SOURCES['app/(tabs)/matchup.tsx']);
  // Each branch is checked on its OWN slice: a whole-file includes() let the live "you" line be satisfied by the
  // bye's, and FinishedWeek's verdict by the fallback Scoreboard's (mutants M2/M11 on the #566 merge).
  const finalAt = src.indexOf("if (view.kind === 'final' && final) {");
  const liveAt = src.lastIndexOf('<Scoreboard');
  assert(finalAt > 0 && liveAt > finalAt, 'bye, then final, then the live card');
  const bye = src.slice(0, finalAt);
  const final = src.slice(finalAt, liveAt);
  const live = src.slice(liveAt);
  // A LIVE week: the priced totals.
  assert(live.includes("you={{ name: youName, gain: live.me.total }}") && live.includes("opponent={{ name: live.opp?.name ?? '', gain: live.opp?.total ?? 0 }}"), 'the live card shows the priced totals');
  // A FINAL week: the server's gains and verdict, never the priced totals (they feed the live "leads by" only).
  assert(!final.includes('.total'), 'no priced total anywhere on a final week');
  assert(final.includes('<Scoreboard you={{ name: youName, gain: final.me }} opponent={{ name: live.opp?.name ?? \'\', gain: final.opp }} final verdict={final.verdict}'), 'the opponent-less final: the server\'s gains and verdict');
  const finished = final.slice(final.indexOf('<FinishedWeek'));
  assert(final.includes('<FinishedWeek') && finished.includes('verdict={final.verdict}'), 'FinishedWeek keeps the server\'s verdict');
  assert(bye.includes('<Scoreboard you={{ name: youName, gain: live.me.total }} opponent={null}'), 'the bye half too');
  assert(src.includes('{raw && ledgers && (live.me.lineup.length || live.me.unpriced.length) ? ('));
  assert(!src.includes('unpricedNote'), 'the "counted at cost" caption stays gone: the notice replaces it');
});

// ── The price notice ───────────────────────────────────────────────────────────────

Deno.test('notice text: Giorgio\'s approved copy, exactly: one and two stocks named, three or more general', () => {
  assertEquals(priceNoticeText([]), null, 'every price in: no notice');
  assertEquals(priceNoticeText(['AAPL']), "The price for AAPL isn't loading right now. We're working on it, and the totals will update when it's back.");
  assertEquals(priceNoticeText(['AAPL', 'JPM']), "Prices for AAPL and JPM aren't loading right now. We're working on it, and the totals will update when they're back.");
  // Three or more: NOT listed, "plural and general" (Giorgio, 2026-11-19: "that wording is good, approved").
  const many = "Prices for multiple stocks aren't loading right now. We're working on it, and the totals will update when they're back.";
  assertEquals(PRICE_NOTICE_MANY, many);
  assertEquals(priceNoticeText(['AAPL', 'JPM', 'KO']), many);
  assertEquals(priceNoticeText(['AAPL', 'CRM', 'BRK.B', 'JPM', 'KO']), many, 'five: the same sentence, no tickers');
  assert(!/AAPL|JPM|KO/.test(priceNoticeText(['AAPL', 'JPM', 'KO'])!), 'no ticker named at 3+');
});

Deno.test('notice stocks: BOTH teams\', each once, yours first', () => {
  assertEquals(missingPriceSymbols(['AAPL'], ['JPM']), ['AAPL', 'JPM']);
  assertEquals(missingPriceSymbols(['aapl', 'NVDA'], ['AAPL', 'KO']), ['AAPL', 'NVDA', 'KO'], 'deduped, upper-case');
  assertEquals(missingPriceSymbols([], null), [], 'a bye: yours only');
  assertEquals(missingPriceSymbols([], ['JPM']), ['JPM'], 'their missing price is named too');
});

Deno.test('notice joining: the app\'s ONE joiner (listSymbols, shared with the draft queue) names two stocks', () => {
  assertEquals(listSymbols(['AAPL']), 'AAPL');
  assertEquals(listSymbols(['AAPL', 'JPM']), 'AAPL and JPM');
  assertEquals(listSymbols(['AAPL', 'JPM', 'MSFT']), 'AAPL, JPM and MSFT', 'no comma before "and"');
  assertEquals(priceNoticeText(['AAPL', 'JPM'])!.startsWith('Prices for AAPL and JPM '), true, 'two: joined by listSymbols');
  assert(strip(SOURCES['lib/game/draftQueue.ts']).includes("import { listSymbols } from './listSymbols';"), 'the queue uses the same joiner');
  assert(!strip(SOURCES['lib/game/draftQueue.ts']).includes('function listSymbols'), 'no second copy');
  assert(strip(SOURCES['lib/game/priceNotice.ts']).includes('${listSymbols(symbols)}'));
});

Deno.test('notice display: each named ticker kept whole (BRK.B never breaks at the dot); VoiceOver reads the plain sentence', () => {
  const brk = priceNoticeText(['BRK.B'])!;
  assert(priceNoticeDisplay(brk, ['BRK.B']).includes(['B', 'R', 'K', '.', 'B'].join(WORD_JOINER)), 'BRK.B joined glyph to glyph');
  const syms = ['A', 'AAPL'];
  const plain = priceNoticeText(syms)!;
  const shown = priceNoticeDisplay(plain, syms);
  assert(shown.includes(['A', 'A', 'P', 'L'].join(WORD_JOINER)), 'AAPL joined');
  assertEquals(shown.split(WORD_JOINER).join(''), plain, 'display only: the same sentence once the joiners are removed');
  assert(shown.includes(`Prices for A and ${['A', 'A', 'P', 'L'].join(WORD_JOINER)}`), '"A" is matched as a whole word, never inside AAPL');
  // Three or more names no ticker, so there is nothing to keep whole.
  assertEquals(priceNoticeDisplay(PRICE_NOTICE_MANY, ['AAPL', 'JPM', 'KO']), PRICE_NOTICE_MANY);
  const card = strip(SOURCES['components/game/PriceNotice.tsx']);
  assert(card.includes('accessibilityLabel={text}') && card.includes('{priceNoticeDisplay(text, symbols)}'), 'label plain, display joined');
});

Deno.test('notice placement: under the switch, above the totals, in a LIVE week only (never on a scored week)', () => {
  const src = strip(SOURCES['app/(tabs)/matchup.tsx']);
  assert(src.includes("const notice = view.kind === 'scoreboard' || view.kind === 'bye' ? priceNoticeText(missing) : null;"), 'live views only');
  assert(src.includes('const missing = missingPriceSymbols(live.me.unpriced, live.opp?.unpriced);'));
  const tag = '{notice ? <PriceNotice text={notice} symbols={missing} /> : null}';
  assertEquals(src.split(tag).length - 1, 2, 'the bye card and the live card draw it, nothing else');
  // The live card: after the final week's FinishedWeek return (a final never reaches it), above its Scoreboard.
  const live = src.slice(src.indexOf('<FinishedWeek'));
  assert(live.includes(tag) && live.indexOf(tag) < live.lastIndexOf('<Scoreboard'), 'above the live card');
  assert(!src.slice(src.indexOf("if (view.kind === 'final' && final) {"), src.indexOf('<FinishedWeek')).includes('PriceNotice'), 'never on a final week');
  const bye = src.slice(src.indexOf("if (view.kind === 'bye') {"));
  assert(bye.indexOf(tag) < bye.indexOf('<Scoreboard'), 'a bye week too, above its card');
});

Deno.test('notice icon (Design Lead P2): centred on the FIRST line at every size, following the capped scale', () => {
  // callout is 13pt on an 18pt line (constants/tokens/type.ts): centred = (18 - 13) / 2 at the capped scale.
  assert(SOURCES['constants/tokens/type.ts'].includes('callout: { fontFamily: FONT.medium, fontSize: 13, lineHeight: 18 }'), 'the metrics this uses');
  assertEquals(noticeIconMetrics(1), { pt: 13, top: 2.5 }, 'L');
  const ax5 = noticeIconMetrics(3.1);
  assertEquals([Math.round(ax5.pt * 100) / 100, Math.round(ax5.top * 100) / 100], [16.9, 3.25], 'AX5: capped at 1.3');
  assertEquals(noticeIconMetrics(0.85), { pt: 13 * 0.85, top: 2.5 * 0.85 }, 'below 1 it follows the text down');
  // Centred: the icon's middle is the line's middle (top + pt / 2 = line / 2) at any scale.
  for (const f of [0.85, 1, 1.15, 1.3, 2, 3.1]) {
    const { pt, top } = noticeIconMetrics(f);
    const s = Math.min(f, 1.3);
    assert(Math.abs(top + pt / 2 - (18 * s) / 2) < 1e-9, `scale ${f}`);
  }
});

Deno.test('notice look (Design Lead spec): accent tint, no edge, WarnPanel\'s box, accent info icon, regular text capped at 1.3, role text', () => {
  const card = strip(SOURCES['components/game/PriceNotice.tsx']);
  assert(card.includes('backgroundColor: colors.accentTint') && !card.includes('borderWidth'), 'the tint is its own edge');
  assert(!/warn|yellow/i.test(card), 'never yellow or warnTint');
  assert(card.includes('borderRadius: radius.lg') && card.includes('paddingVertical: space[4]') && card.includes('paddingHorizontal: 14'), "WarnPanel's box");
  assert(card.includes('gap: space[2]'));
  assert(card.includes('<View style={{ marginTop: icon.top }}>') && card.includes('<Icon name="info" size="callout" tone="accent" pt={icon.pt} />'), 'the icon from noticeIconMetrics: capped size, centred on line one');
  assert(card.includes('const icon = noticeIconMetrics(fontScale);'));
  assertEquals(NOTICE_MAX_SCALE, 1.3);
  assert(card.includes('maxFontSizeMultiplier={NOTICE_MAX_SCALE}'), "the Matchup rows' cap");
  assert(card.includes('color={colors.text}') && card.includes("fontWeight: '400'"), 'text colour, regular weight');
  assert(card.includes('accessible accessibilityRole="text" accessibilityLabel={text}'), 'one element, role text (not alert)');
  const pairs = SOURCES['constants/tokens/contrastPairs.ts'];
  assert(pairs.includes("['text', 'accentTint', 'bg', 4.5, 'Matchup price notice: the sentence']"));
  assert(pairs.includes("['accent', 'accentTint', 'bg', 3, 'Matchup price notice: the info icon (graphic)']"));
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
  assert(src.includes('{blank ? null : complete && activeLeagueId ? ('), 'no recap, no My matchup (its $0.00 vs $0.00), no All matchups');
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

Deno.test("capture: 'unpriced1' (one stock), 'unpriced' (two) and 'unpriced5' (five, with BRK.B bought this week) drive the notice's three shapes", () => {
  assertEquals(parseMatchupFixture('unpriced1'), 'unpriced1');
  assertEquals(parseMatchupFixture('unpriced5'), 'unpriced5');
  assertEquals(priceNoticeText([...matchupWeekExtras('unpriced1').unpriced]), "The price for AAPL isn't loading right now. We're working on it, and the totals will update when it's back.");
  assertEquals(priceNoticeText([...matchupWeekExtras('unpriced').unpriced]), "Prices for AAPL and JPM aren't loading right now. We're working on it, and the totals will update when they're back.");
  const five = matchupWeekExtras('unpriced5');
  assertEquals(five.unpriced, [...UNPRICED_VARIANT_SYMBOLS.unpriced5]);
  assertEquals(priceNoticeText(five.unpriced), PRICE_NOTICE_MANY, 'five: the general sentence');
  assertEquals(five.trades.map((t) => [t.symbol, t.action]), [['BRK.B', 'buy']], 'BRK.B is HELD: a buy this week');
  const ledger = fixtureLedger('unpriced5', 'me', 'gia');
  assert(ledger.activity.some((r) => r.user_id === 'me' && r.symbol === 'BRK.B' && r.kind === 'trade'));
  assertEquals(ledger.symbol_names['BRK.B'], 'Berkshire Hathaway');
  for (const v of ['unpriced', 'unpriced1', 'unpriced5'] as const) assert(matchupWeekExtras(v).unpriced.every((s) => [...ROBERTO_HOLDINGS, ...GIANLUIGI_HOLDINGS].some((h) => h.symbol === s) || s === 'BRK.B'), v);
});
