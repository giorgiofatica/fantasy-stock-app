/**
 * The Stocks tab's "Top movers" chip (docs/plans/2026-11-18-stocks-tab.md part 3, workstream 5; "Settled during the build" point 8):
 * the pure rules in lib/stocks/topMovers.ts, the read's wiring (useTopMovers.ts), the row quote store the rows reuse, and the capture
 * seam's answers.
 *
 * Pinned: the 20-minute rule (open vs closed, and an unreadable market judged as open), an EMPTY reply is "didn't load", a PT429 or
 * any refused read is "didn't load", the server's order is kept, a ranking is never invented from a failed read, and the rows' price
 * and change come from the Watching rows' own quote store (no second store).
 */
import { assert, assertEquals, assertFalse, assertMatch } from 'jsr:@std/assert';
import { SOURCES } from './sourceManifest.generated.ts';
import { chipsFrom } from '../lib/stocks/stocksList.ts';
import {
  MOVERS_MAX_AGE_MS,
  MOVERS_MAX_ROWS,
  TOP_MOVERS_CHIP_ID,
  TOP_MOVERS_LABEL,
  chipsWithMovers,
  isFailedMoversRead,
  lastSessionBefore,
  lastSessionDayWord,
  moverLabel,
  moversArgs,
  moversVerdict,
  parseMovers,
  rankingIsFresh,
  selectedChipId,
} from '../lib/stocks/topMovers.ts';
import { SEAM_LAST_SESSION, parseStocksKnob, seamTickerQuote, seamTopMoversRead } from '../lib/stocks/seamStocks.ts';
import { QUOTE_LANES, QUOTE_TTL_MS, changePct, changeText, createQuoteStore, type QuoteAnswer } from '../lib/stocks/rowQuotes.ts';

const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
const NOW = Date.parse('2026-11-23T18:00:00Z');
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();
const wire = (symbols: string[], rankedAt = at(3)) => symbols.map((symbol, i) => ({ place: i + 1, symbol, name: `${symbol} Inc`, category_ids: ['c1'], ranked_at: rankedAt }));

// ── the read ──
Deno.test('moversArgs: the one argument is the league', () => {
  assertEquals(moversArgs('L1'), { p_league_id: 'L1' });
});

Deno.test('parseMovers: the SERVER\'S order is kept (never re-sorted), a ticker is cleaned and shown once, and a row without one is dropped', () => {
  const read = parseMovers([
    { place: 1, symbol: ' smci ', name: ' Super Micro ', category_ids: ['t', 9], ranked_at: at(2) },
    { place: 2, symbol: 'MRNA', name: 'Moderna', category_ids: [], ranked_at: at(2) },
    { place: 3, symbol: 'smci', name: 'again', category_ids: [], ranked_at: at(2) },
    { place: 4, symbol: '', name: 'x' },
    null,
    { place: 5, symbol: 'AAPL' },
  ])!;
  assertEquals(read.rows.map((r) => r.symbol), ['SMCI', 'MRNA', 'AAPL']);
  assertEquals(read.rows[0], { symbol: 'SMCI', name: 'Super Micro', categoryIds: ['t'] });
  assertEquals(read.rows[2], { symbol: 'AAPL', name: '', categoryIds: [] });
});

Deno.test('parseMovers: order preserved for the whole 25, and nothing past 25 is shown', () => {
  const symbols = Array.from({ length: 30 }, (_, i) => `S${String(30 - i).padStart(2, '0')}`);
  const read = parseMovers(wire(symbols))!;
  assertEquals(MOVERS_MAX_ROWS, 25);
  assertEquals(read.rows.map((r) => r.symbol), symbols.slice(0, 25));
});

Deno.test('parseMovers: the ranking\'s time is the newest ranked_at; an unreadable or missing one is null; a non-list is NOT a ranking', () => {
  assertEquals(parseMovers([{ symbol: 'A', ranked_at: at(9) }, { symbol: 'B', ranked_at: at(4) }])!.rankedAt, NOW - 4 * 60_000);
  assertEquals(parseMovers([{ symbol: 'A', ranked_at: 'not a date' }, { symbol: 'B' }])!.rankedAt, null);
  assertEquals(parseMovers([])!.rows, []);
  for (const bad of [null, undefined, {}, 'rows', 7, { data: [] }]) assertEquals(parseMovers(bad), null);
});

Deno.test('isFailedMoversRead: a resolved { error } (42501, PT429), a transport error and a non-list are all a read that did not load', () => {
  assert(isFailedMoversRead({ data: null, error: { code: 'PT429', message: 'get_league_top_movers: rate limited' } }));
  assert(isFailedMoversRead({ data: null, error: { code: '42501' } }));
  assert(isFailedMoversRead({ data: wire(['A']), error: new Error('dropped') }), 'an error beats any data beside it');
  assert(isFailedMoversRead({ data: { ok: true }, error: null }));
  assertFalse(isFailedMoversRead({ data: wire(['A']), error: null }));
  assertFalse(isFailedMoversRead({ data: [], error: null }), 'an empty LIST is a read that landed; the VERDICT calls it "didn\'t load"');
});

// ── the verdict: the 20-minute rule, empty, closed ──
Deno.test('the 20-minute rule while the market is OPEN: 20 minutes and under shows the rows, over 20 is "didn\'t load"', () => {
  const read = (min: number) => parseMovers(wire(['A', 'B'], at(min)));
  assertEquals(MOVERS_MAX_AGE_MS, 20 * 60_000);
  assertEquals(moversVerdict(read(3), false, NOW).kind, 'rows');
  assertEquals(moversVerdict(read(20), false, NOW).kind, 'rows', 'exactly 20 minutes is still current');
  assertEquals(moversVerdict(read(20.1), false, NOW).kind, 'failed');
  assertEquals(moversVerdict(read(45), false, NOW).kind, 'failed');
});

// The calendar the app reads (market_calendar rows): Mon 2026-11-16 .. Fri 2026-11-20, the week of Thanksgiving's Wednesday after.
const CAL = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'].map((sessionDate) => ({ sessionDate, openEt: '09:30:00', closeEt: '16:00:00' }));
const SAT = new Date('2026-11-21T15:00:00Z'); // Saturday 10:00 ET: closed, the last session is Friday
const MON_PRE = new Date('2026-11-23T13:00:00Z'); // Monday 8:00 ET: closed before the open, the last session is still Friday
const FRI_RANKING = '2026-11-20T20:55:00Z'; // Friday 15:55 ET: made in the most recent session
const THU_RANKING = '2026-11-19T20:55:00Z'; // Thursday 15:55 ET: the session BEFORE last

Deno.test('lastSessionBefore: the most recent session whose close has passed, from the calendar (Saturday and a pre-open Monday both name Friday)', () => {
  assertEquals(lastSessionBefore(SAT, CAL)!.sessionDate, '2026-11-20');
  assertEquals(lastSessionBefore(MON_PRE, CAL)!.sessionDate, '2026-11-20');
  assertEquals(lastSessionBefore(new Date('2026-11-18T22:00:00Z'), CAL)!.sessionDate, '2026-11-18', 'Wednesday after the close');
  assertEquals(lastSessionBefore(new Date('2026-11-18T15:00:00Z'), CAL)!.sessionDate, '2026-11-17', 'Wednesday during the session: the one before it');
  // A holiday gap: no Friday row, so Thursday is the last session on the weekend.
  assertEquals(lastSessionBefore(SAT, CAL.slice(0, 4))!.sessionDate, '2026-11-19');
  const fri = lastSessionBefore(SAT, CAL)!;
  assertEquals(new Date(fri.openMs).toISOString(), '2026-11-20T14:30:00.000Z');
  assertEquals(new Date(fri.closeMs).toISOString(), '2026-11-20T21:00:00.000Z');
});

Deno.test('lastSessionBefore: a calendar that cannot name the last session is null (empty, failed read, or starting later), never a guess', () => {
  assertEquals(lastSessionBefore(SAT, []), null);
  assertEquals(lastSessionBefore(new Date('2026-11-10T15:00:00Z'), CAL), null);
  assertEquals(lastSessionBefore(SAT, [{ sessionDate: 'garbage', openEt: 'x', closeEt: 'y' }]), null);
});

Deno.test('the day on a figure is the most recent SESSION\'s weekday, whatever day the ranking itself carries', () => {
  assertEquals(lastSessionDayWord(lastSessionBefore(SAT, CAL)), 'Fri');
  assertEquals(lastSessionDayWord(lastSessionBefore(MON_PRE, CAL)), 'Fri');
  assertEquals(lastSessionDayWord(lastSessionBefore(SAT, CAL.slice(0, 4))), 'Thu');
  assertEquals(lastSessionDayWord(null), null, 'unknown session: no word, never a guess');
});

Deno.test('CLOSED, a ranking made in the MOST RECENT session shows its rows (with that session\'s day word)', () => {
  const session = lastSessionBefore(SAT, CAL);
  const v = moversVerdict(parseMovers(wire(['A', 'B'], FRI_RANKING)), true, SAT.getTime(), session);
  assertEquals(v.kind, 'rows');
  assertEquals(v.kind === 'rows' ? v.rows.map((r) => r.symbol) : [], ['A', 'B']);
  assertEquals(lastSessionDayWord(session), 'Fri');
  // Monday before the open: Friday's ranking is still the last session's.
  assertEquals(moversVerdict(parseMovers(wire(['A'], FRI_RANKING)), true, MON_PRE.getTime(), lastSessionBefore(MON_PRE, CAL)).kind, 'rows');
});

Deno.test('CLOSED, a ranking from the session BEFORE last is "didn\'t load" (not shown under Friday\'s label)', () => {
  const session = lastSessionBefore(SAT, CAL);
  assertEquals(moversVerdict(parseMovers(wire(['A', 'B'], THU_RANKING)), true, SAT.getTime(), session).kind, 'failed');
  // The morning of the last session, before it opened, is also before it.
  assertEquals(moversVerdict(parseMovers(wire(['A'], '2026-11-20T13:00:00Z')), true, SAT.getTime(), session).kind, 'failed');
  // Exactly at the open counts as made in it.
  assertEquals(moversVerdict(parseMovers(wire(['A'], '2026-11-20T14:30:00Z')), true, SAT.getTime(), session).kind, 'rows');
});

Deno.test('CLOSED with a calendar that cannot name the last session, or a ranking with no readable time: "didn\'t load" (no number of days is substituted)', () => {
  assertEquals(moversVerdict(parseMovers(wire(['A'], FRI_RANKING)), true, SAT.getTime(), null).kind, 'failed');
  assertEquals(moversVerdict(parseMovers(wire(['A'], FRI_RANKING)), true, SAT.getTime()).kind, 'failed', 'no session argument is no session');
  assertEquals(moversVerdict(parseMovers([{ symbol: 'A' }]), true, SAT.getTime(), lastSessionBefore(SAT, CAL)).kind, 'failed');
});

Deno.test('OPEN ignores the calendar: only the 20-minute rule decides', () => {
  const session = lastSessionBefore(SAT, CAL);
  assertEquals(moversVerdict(parseMovers(wire(['A'], at(3))), false, NOW, session).kind, 'rows');
  assertEquals(moversVerdict(parseMovers(wire(['A'], at(45))), false, NOW, session).kind, 'failed');
});

Deno.test('an EMPTY reply is "didn\'t load", open or closed (zero rows carry no time: "never ranked" and "you own them all" read the same)', () => {
  const empty = parseMovers([]);
  assertEquals(moversVerdict(empty, false, NOW).kind, 'failed');
  assertEquals(moversVerdict(empty, true, NOW).kind, 'failed');
  assertEquals(moversVerdict(null, true, NOW).kind, 'failed');
});

Deno.test('a ranking with no readable time is never shown as current while the market is open; a time in the future (a skewed clock) is fresh', () => {
  assertEquals(moversVerdict(parseMovers([{ symbol: 'A' }]), false, NOW).kind, 'failed');
  assertEquals(moversVerdict(parseMovers(wire(['A'], at(-5))), false, NOW).kind, 'rows');
  assertFalse(rankingIsFresh(parseMovers([{ symbol: 'A' }]), NOW));
  assertFalse(rankingIsFresh(null, NOW));
});

Deno.test('the verdict never re-orders and never trims what the server said (the cap is the parser\'s)', () => {
  const v = moversVerdict(parseMovers(wire(['Z', 'A', 'M'])), false, NOW);
  assertEquals(v.kind === 'rows' ? v.rows.map((r) => r.symbol) : [], ['Z', 'A', 'M']);
});

// ── the chip ──
Deno.test('the chip sits right after "All", before the categories, with the approved label; a category id can never be its id', () => {
  const chips = chipsWithMovers(chipsFrom([{ id: 'c1', name: 'Technology', is_misc: false }, { id: 'c2', name: 'Financials', is_misc: false }]));
  assertEquals(chips.map((c) => c.label), ['All', 'Top movers', 'Technology', 'Financials']);
  assertEquals(TOP_MOVERS_LABEL, 'Top movers');
  assertEquals(chips[1].categoryId, TOP_MOVERS_CHIP_ID);
  assertEquals(chips[0].categoryId, null);
  assertEquals(chipsWithMovers([]).map((c) => c.label), ['Top movers'], 'still there before the categories load');
});

Deno.test('the selected chip is Top movers while it is on, else the list\'s category', () => {
  assertEquals(selectedChipId(true, 'c1'), TOP_MOVERS_CHIP_ID);
  assertEquals(selectedChipId(false, 'c1'), 'c1');
  assertEquals(selectedChipId(false, null), null);
});

Deno.test('a mover row\'s VoiceOver label: ticker, company, price, change in words; "price unavailable", never a dash', () => {
  assertEquals(moverLabel('SMCI', 'Super Micro Computer', '$48.12', '–', 'plus 11.2 percent today'), 'SMCI, Super Micro Computer, $48.12, plus 11.2 percent today');
  assertEquals(moverLabel('SMCI', '', '–', '–', null), 'SMCI, price unavailable');
});

// ── the rows reuse the Watching rows' quote store ──
Deno.test('the rows take price AND change from the Watching rows\' quote store: one single-symbol read per row, 60 s cache, 3 in flight, on-screen rows only', async () => {
  const seen: string[] = [];
  let inFlight = 0;
  let peak = 0;
  let clock = 0;
  const store = createQuoteStore(async (symbol): Promise<QuoteAnswer> => {
    seen.push(symbol);
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return { ok: true, price: 112, prevClose: 100 };
  }, () => clock);
  const onScreen = ['SMCI', 'MRNA', 'PLTR', 'ENPH', 'ANET'];
  let settled = 0;
  store.request(onScreen, () => settled++);
  await new Promise((r) => setTimeout(r, 60));
  assertEquals(QUOTE_LANES, 3);
  assert(peak <= 3, `at most 3 in flight (saw ${peak})`);
  assertEquals(seen.length, 5, 'one read per on-screen row, no more');
  assertEquals(store.peek('SMCI'), { status: 'ready', price: 112, changePct: 12 });
  assertEquals(changeText(changePct(112, 100), 'today'), '+12.0% today');
  assertEquals(changeText(changePct(88.2, 100), 'Fri'), '−11.8% Fri');
  assertEquals(store.peek('NOT-ASKED'), undefined, 'a row that was never on screen has no figures');
  store.request(onScreen, () => {});
  assertEquals(seen.length, 5, 'asked again inside the 60 s cache: no new read');
  clock = QUOTE_TTL_MS + 1;
  store.request(['SMCI'], () => {});
  await new Promise((r) => setTimeout(r, 20));
  assertEquals(seen.length, 6, 'past the cache: one new read for that row');
});

Deno.test('MoversList uses the EXISTING store (useRowQuotes): no second store, no other price source, no stored price', () => {
  const list = SOURCES['components/stocks/MoversList.tsx'];
  assertMatch(list, /import \{ useRowQuotes \} from '@\/lib\/stocks\/useRowQuotes';/);
  assertMatch(list, /const quoteOf = useRowQuotes\(onScreen\);/);
  assertMatch(list, /symbolsOnScreen\(asBoxes, y, vp\)/);
  assertFalse(/createQuoteStore|createPriceStore|useRowPrices|seamInvoke|supabase|last_price|lastPrice/.test(code(list)), 'the rows have no other price source');
  // The read has no price, so the rows can only have drawn the live one.
  assertFalse(/last_price|lastPrice|change_pct|changePct\b.*row\./.test(code(SOURCES['lib/stocks/useTopMovers.ts'])));
});

// ── the hook ──
Deno.test('useTopMovers: the member-only RPC through the seam, ERROR-CHECKED, and answered late = dropped', () => {
  const hook = SOURCES['lib/stocks/useTopMovers.ts'];
  assertMatch(hook, /seamRpc\('get_league_top_movers', moversArgs\(league\)\)/);
  assertMatch(hook, /isFailedMoversRead\(result\) \? null : parseMovers\(result\.data\)/, 'a resolved { error } (42501, PT429) is a failed read, never "no movers"');
  assertMatch(hook, /id !== seq\.current \|\| league !== leagueRef\.current/, 'a late answer for another league, or overtaken by a newer read, is dropped');
  assertMatch(hook, /subscribePortfolioLedgerInvalidation\(\(invalidated\) => \{\s*if \(invalidated === leagueRef\.current\) void load\(\);/);
  assertMatch(hook, /if \(!active \|\| !focused \|\| !leagueId\) return;/, 'it reads only while the chip is showing');
  assertMatch(hook, /export const MOVERS_REFRESH_MS = 5 \* 60 \* 1000;/);
  // Copilot on #607: an answer that lands after the screen has gone sets no state.
  assertMatch(hook, /useEffect\(\(\) => \{\s*mounted\.current = true;\s*return \(\) => \{\s*mounted\.current = false;\s*\};\s*\}, \[\]\);/, 'mounted is set on mount and cleared on unmount');
  assertMatch(hook, /if \(!mounted\.current \|\| id !== seq\.current \|\| league !== leagueRef\.current\) return;\s*const read = /, 'the unmount check sits before ANY state is set');
});

Deno.test('the screen: the chip swaps the Available list for MoversList, "All" and the categories swap it back, and pull to refresh re-reads the movers', () => {
  const screen = SOURCES['components/stocks/StocksScreen.tsx'];
  assertMatch(screen, /chipsWithMovers\(chipsFrom\(categories \?\? \[\]\)\)/);
  assertMatch(screen, /selected=\{selectedChipId\(moversOn, list\.state\.categoryId\)\} onSelect=\{onChip\}/);
  assertMatch(screen, /control\.mode === 'chips' && moversOn \? \(\s*<MoversList movers=\{movers\} marketClosed=\{marketClosed\} lastSession=\{lastSession\} dayWord=\{dayWord\} plus=\{showsBuyPlus\(seasonOver\)\} watch=\{wl\.watch\} onStar=\{onStar\} \/>/);
  assertMatch(screen, /moversOn \? movers\.reload : list\.refresh/);
  assertMatch(screen, /useTopMovers\(leagueId, moversOn && view === 'available' && control\.mode === 'chips'\)/);
  assertMatch(screen, /marketClosed=\{marketStatus === 'closed'\}/, 'only a market KNOWN to be closed relaxes the 20-minute rule');
  assertMatch(screen, /lastSessionBefore\(new Date\(\), marketCalendar\)/, 'the last session comes from the market calendar the app already reads');
  assertMatch(screen, /marketStatus === 'closed' \? lastSessionDayWord\(lastSession\)/, 'the day on a figure is the last SESSION\'s, not a ranking\'s own weekday');
  assertMatch(screen, /marketClosed=\{marketClosed\} lastSession=\{lastSession\} dayWord/);
});

Deno.test('a mover row is the board\'s: "+" at the left (the same predicate as Available), company name with no category, price with the change under it, the star at the right', () => {
  const list = SOURCES['components/stocks/MoversList.tsx'];
  assertMatch(list, /\{plus \? \(\s*<Pressable accessibilityRole="button" accessibilityLabel=\{`Buy \$\{row\.symbol\}`\}/);
  assertMatch(list, /<StarButton symbol=\{row\.symbol\} saved=\{saved\} onPress=\{onStar\} \/>/);
  assertMatch(list, /saved=\{isSaved\(watch, row\.symbol\)\}/);
  assertMatch(list, /onPlus=\{\(\) => open\(row\.symbol, \{ name: row\.name, originRef: 'stocks-plus', startReview: 'buy' \}\)\}/, 'the "+" asks for the buy REVIEW; nothing buys in one tap');
  assertFalse(/rowCategoryName|category/.test(code(list)), 'the board draws the company name alone on a mover');
  assertMatch(list, /\{under \? figures : null\}/);
  assertMatch(list, /\{under \? null : <View style=\{styles\.trail\}>\{figures\}<\/View>\}/);
  // Copilot on #607: loading shows a "+" circle only where the rows will have one (none after the season).
  assertMatch(list, /if \(movers\.status === 'loading'\) return <MoversSkeleton plus=\{plus\} \/>;/);
  assertMatch(list, /function MoversSkeleton\(\{ plus \}: \{ plus: boolean \}\) \{[\s\S]*?\{plus \? \(\s*<View style=\{styles\.plusTarget\}>\s*<Skeleton width=\{PLUS_DISC\}/);
});

Deno.test('every empty cause is the EXISTING "Stocks didn\'t load" + Try again; no new words in the chip', () => {
  const list = SOURCES['components/stocks/MoversList.tsx'];
  assertMatch(list, /<LoadFailure title=\{COPY\.stockSearchLoadTitle\} message=\{COPY\.loadRetryMessage\} onRetry=\{\(\) => void movers\.reload\(\)\} \/>/);
  // Every string a person could read in the new files is the chip's approved label or an existing COPY line.
  for (const f of ['components/stocks/MoversList.tsx', 'lib/stocks/topMovers.ts', 'lib/stocks/useTopMovers.ts']) {
    assertFalse(/\[new copy/i.test(SOURCES[f]), f);
  }
  assertMatch(list, /COPY\.alpacaCredit/, 'the price credit stays under every price surface');
});

// ── the capture seam ──
Deno.test('seam: the ranking answers the server\'s shape (place, symbol, name, category_ids, ranked_at; NO price, NO change) and the knobs make each state', () => {
  const k = (s: string) => parseStocksKnob(s);
  const ok = seamTopMoversRead(k(''), NOW)!;
  const rows = ok.data as { place: number; symbol: string; ranked_at: string }[];
  assertEquals(rows.map((r) => r.place), rows.map((_, i) => i + 1));
  assertEquals(Object.keys(rows[0]).sort(), ['category_ids', 'name', 'place', 'ranked_at', 'symbol']);
  assertEquals(moversVerdict(parseMovers(ok.data), false, NOW).kind, 'rows');
  assertEquals(seamTopMoversRead(k('moversloading'), NOW), null);
  assert(isFailedMoversRead(seamTopMoversRead(k('moversfail'), NOW)!));
  const rate = seamTopMoversRead(k('moversrate'), NOW)!;
  assertEquals(rate.error?.code, 'PT429');
  assert(isFailedMoversRead(rate));
  assertEquals(moversVerdict(parseMovers(seamTopMoversRead(k('moversempty'), NOW)!.data), false, NOW).kind, 'failed');
  const old = seamTopMoversRead(k('moversold'), NOW)!;
  assertEquals(moversVerdict(parseMovers(old.data), false, NOW).kind, 'failed', 'open + old = "didn\'t load"');
  const session = lastSessionBefore(SAT, CAL);
  assertEquals(moversVerdict(parseMovers(old.data), false, NOW, session).kind, 'failed');
  // marketclosed: the ranking was made in the last session (Fri 2026-11-20); moversprev: in the one before (Thu), so it does not show.
  const closedKnob = k('marketclosed');
  const closed = seamTopMoversRead(closedKnob, NOW)!;
  assertEquals(moversVerdict(parseMovers(closed.data), true, SAT.getTime(), SEAM_LAST_SESSION).kind, 'rows');
  assertEquals(moversVerdict(parseMovers(closed.data), true, SAT.getTime(), SEAM_LAST_SESSION).kind, 'rows');
  const prev = seamTopMoversRead(k('marketclosed,moversprev'), NOW)!;
  assertEquals(moversVerdict(parseMovers(prev.data), true, SAT.getTime(), SEAM_LAST_SESSION).kind, 'failed', 'a ranking from the session before last, market closed');
  assertEquals(lastSessionDayWord(SEAM_LAST_SESSION), 'Fri');
  assert(k('marketclosed').marketClosed && !k('').marketClosed);
});

Deno.test('seam: the ranked movers have mover-sized changes from the single-symbol lookup (+11.2% first), up and down', () => {
  const quote = (s: string) => {
    const d = seamTickerQuote(s, parseStocksKnob(''))!.data as { price: number; prevClose: number };
    return changePct(d.price, d.prevClose)!;
  };
  assertEquals(Math.round(quote('AMD') * 10) / 10, 11.2);
  assertEquals(Math.round(quote('INTC') * 10) / 10, -9.8);
});

Deno.test('the seam is gated: the closed-market knob is read only under the capture seam', () => {
  const calls = SOURCES['lib/game/seamCalls.ts'];
  assertMatch(calls, /const STOCKS_FIXTURE = SEAM_ON \? process\.env\.EXPO_PUBLIC_STOCKS_FIXTURE : undefined;/);
  assertMatch(calls, /export const SEAM_MARKET_CLOSED = STOCKS_KNOB\.marketClosed;/);
  assertMatch(calls, /name === 'get_league_top_movers'/);
});
