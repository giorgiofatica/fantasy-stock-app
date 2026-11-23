/**
 * The Stocks tab's watchlist (docs/plans/2026-11-18-stocks-tab.md part 3, workstream 3): the pure rules in lib/stocks/watchlist.ts,
 * the shared store (watchlistStore.ts) and the Watching rows' live figures (rowQuotes.ts).
 *
 * Pinned: the Planner's rules 1 to 4 (the no-longer-tradable test is the buy path's own; ownership > no longer tradable > slot
 * lines; rate_limited gets no words and the star returns to empty; watchlist_full uses the board's words), supabase-js's
 * `{ data, error }` (an error is a failed save whatever data holds), the optimistic star and its revert on EVERY failure, the
 * read that must not undo a tap in flight, and a change that is never invented.
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { COPY } from '../lib/money/moneyCopy.ts';
import {
  WATCHLIST_MAX,
  applyRead,
  applyToggle,
  emptyWatch,
  failureWords,
  isSaved,
  noLongerTradable,
  parseSaveResult,
  parseWatchlist,
  setWatchlistArgs,
  settleToggle,
  showsSearchStar,
  showsStar,
  starLabel,
  statusLine,
  watchRowHasPlus,
  watchingRows,
  SWITCH_SEGMENTS,
  type LeagueWatch,
  type SaveFailure,
  type StatusInput,
  type WatchRow,
} from '../lib/stocks/watchlist.ts';
import { createWatchlistStore } from '../lib/stocks/watchlistStore.ts';
import {
  QUOTE_FAIL_TTL_MS,
  QUOTE_TTL_MS,
  answerFromTickerQuote,
  changeSpoken,
  changePct,
  changeText,
  changeTone,
  createQuoteStore,
  shortWeekdayEt,
  type QuoteAnswer,
} from '../lib/stocks/rowQuotes.ts';

const row = (symbol: string, over: Partial<WatchRow> = {}): WatchRow => ({ symbol, name: `${symbol} Inc`, categoryIds: [], isDraftable: true, savedAt: null, ...over });
const watch = (over: Partial<LeagueWatch> = {}): LeagueWatch => ({ ...emptyWatch, status: 'ready', ...over });

// ── the read ──
Deno.test('parseWatchlist: rows, a missing flag is draftable, bad rows dropped, a non-array is not a list', () => {
  const rows = parseWatchlist([
    { symbol: ' aapl ', name: ' Apple ', category_ids: ['tech', 3], is_draftable: true, saved_at: '2026-11-23T10:00:00Z' },
    { symbol: 'SQ', name: 'Block', category_ids: null, is_draftable: false, saved_at: '2026-11-23T11:00:00Z' },
    { symbol: '', name: 'x' },
    null,
    { symbol: 'MSFT' },
  ])!;
  // newest save first; a row with no time last
  assertEquals(rows.map((r) => r.symbol), ['SQ', 'AAPL', 'MSFT']);
  assertEquals(rows[1], { symbol: 'AAPL', name: 'Apple', categoryIds: ['tech'], isDraftable: true, savedAt: '2026-11-23T10:00:00Z' });
  assertEquals(rows[0].isDraftable, false);
  assertEquals(rows[2].isDraftable, true); // the flag was not sent: never "no longer tradable" on a guess
  assertEquals(parseWatchlist([]), []);
  assertEquals(parseWatchlist(null), null);
  assertEquals(parseWatchlist({ error: 'x' }), null);
});

Deno.test('setWatchlistArgs: the symbol is trimmed and upper case; the cap is the server\'s 50', () => {
  assertEquals(setWatchlistArgs('L1', ' amgn ', true), { p_league_id: 'L1', p_symbol: 'AMGN', p_saved: true });
  assertEquals(WATCHLIST_MAX, 50);
});

// ── the write's answer: success is read, never assumed ──
Deno.test('parseSaveResult: ok only when ok is literally true and there is no error', () => {
  assertEquals(parseSaveResult({ data: { ok: true, count: 3 }, error: null }), { ok: true, count: 3 });
  assertEquals(parseSaveResult({ data: { ok: true }, error: null }), { ok: true, count: null });
  // supabase-js resolves a Postgres error as { error }: it is a failure whatever data holds
  assertEquals(parseSaveResult({ data: { ok: true, count: 3 }, error: { message: 'boom' } }), { ok: false, reason: 'failed' });
  assertEquals(parseSaveResult({ data: null, error: null }), { ok: false, reason: 'failed' });
  assertEquals(parseSaveResult({ data: 'ok', error: null }), { ok: false, reason: 'failed' });
  assertEquals(parseSaveResult({ data: { ok: 'true' }, error: null }), { ok: false, reason: 'failed' });
  assertEquals(parseSaveResult({ data: [{ ok: true }], error: null }), { ok: false, reason: 'failed' });
});

Deno.test('parseSaveResult: every reason the server names is kept; an unknown one is a plain failure', () => {
  for (const reason of ['watchlist_full', 'rate_limited', 'unknown_symbol', 'not_a_member', 'invalid', 'not_authenticated'] as SaveFailure[]) {
    assertEquals(parseSaveResult({ data: { ok: false, reason }, error: null }), { ok: false, reason });
  }
  assertEquals(parseSaveResult({ data: { ok: false, reason: 'something_new' }, error: null }), { ok: false, reason: 'failed' });
  assertEquals(parseSaveResult({ data: { ok: false }, error: null }), { ok: false, reason: 'failed' });
});

// ── rule 3 and 4: words ──
Deno.test('rule 4: watchlist_full has the board\'s words; rule 3: rate_limited and every other failure have none', () => {
  assertEquals(failureWords('watchlist_full'), 'Your watchlist is full (50). Remove one to add another.');
  assertEquals(failureWords('watchlist_full'), COPY.watchlistFull);
  for (const r of ['rate_limited', 'unknown_symbol', 'not_a_member', 'invalid', 'not_authenticated', 'failed'] as SaveFailure[]) {
    assertEquals(failureWords(r), null, r);
  }
});

// ── the optimistic star, and the revert ──
Deno.test('applyToggle: the tap shows at once; a tap on a symbol in flight changes nothing', () => {
  const t = applyToggle(watch(), 'amgn')!;
  assertEquals(t.want, true);
  assertEquals(t.next.symbols, ['AMGN']);
  assertEquals(t.next.pending, ['AMGN']);
  assertEquals(applyToggle(t.next, 'AMGN'), null);
  const off = applyToggle(watch({ symbols: ['AMGN', 'NVDA'] }), 'AMGN')!;
  assertEquals(off.want, false);
  assertEquals(off.next.symbols, ['NVDA']);
});

Deno.test('a failed save puts the star back to EMPTY, whatever the failure (rate_limited included, with no words)', () => {
  const failures: SaveFailure[] = ['watchlist_full', 'rate_limited', 'unknown_symbol', 'not_a_member', 'invalid', 'not_authenticated', 'failed'];
  for (const reason of failures) {
    const tap = applyToggle(watch(), 'AMGN')!;
    assert(isSaved(tap.next, 'AMGN'));
    const after = settleToggle(tap.next, 'AMGN', tap.want, { ok: false, reason });
    assertEquals(isSaved(after, 'AMGN'), false, `${reason}: star must return to empty`);
    assertEquals(after.pending, []);
    assertEquals(after.refusal, reason === 'watchlist_full' ? 'watchlist_full' : null, reason);
  }
});

Deno.test('a failed removal puts the star back to FILLED', () => {
  const tap = applyToggle(watch({ symbols: ['AMGN'] }), 'AMGN')!;
  assertEquals(isSaved(tap.next, 'AMGN'), false);
  const after = settleToggle(tap.next, 'AMGN', tap.want, { ok: false, reason: 'failed' });
  assertEquals(isSaved(after, 'AMGN'), true);
});

Deno.test('a save that went through keeps the star and clears an earlier full refusal', () => {
  const tap = applyToggle(watch({ refusal: 'watchlist_full' }), 'AMGN')!;
  assertEquals(tap.next.refusal, null);
  const after = settleToggle(tap.next, 'AMGN', tap.want, { ok: true, count: 1 });
  assertEquals(isSaved(after, 'AMGN'), true);
  assertEquals(after.pending, []);
  assertEquals(after.refusal, null);
});

Deno.test('applyRead: the server\'s list replaces what is known, but a tap still in flight keeps its state', () => {
  // an addition in flight that the read does not have yet stays; a removal in flight that the read still has stays removed
  const w = watch({ symbols: ['NVDA', 'AMGN'], pending: ['AMGN', 'AAPL'], rows: [] });
  // AAPL: the tap was a removal (not in symbols); the server read still has it
  const next = applyRead(w, [row('NVDA'), row('AAPL'), row('COST')]);
  assertEquals(next.status, 'ready');
  assertEquals(next.symbols.slice().sort(), ['AMGN', 'COST', 'NVDA']);
  assertEquals(next.rows.map((r) => r.symbol), ['NVDA', 'AAPL', 'COST']);
});

Deno.test('watchingRows: an unstarred row leaves the view at once; a just-saved stock is not a row until the read lands', () => {
  const w = watch({ symbols: ['NVDA', 'AMGN'], rows: [row('NVDA'), row('AAPL')] });
  assertEquals(watchingRows(w).map((r) => r.symbol), ['NVDA']);
});

// ── rule 1: the no-longer-tradable test is the buy path's own ──
Deno.test('rule 1: "No longer tradable" is is_draftable false AND the league has NOT allowed undraftable stocks', () => {
  assertEquals(noLongerTradable(false, false), true);
  assertEquals(noLongerTradable(false, true), false); // a full-universe league: the flag alone never shows the line
  assertEquals(noLongerTradable(true, false), false);
  assertEquals(noLongerTradable(true, true), false);
});

// ── rule 2: the order of the status line ──
const base: StatusInput = { owner: null, isDraftable: true, allowUndraftable: false, slotLine: null, roomless: false };
const FITS = { text: 'Available · fits your $100\u2013$200 slot', full: false };
const FULL = { text: 'No free $400 or more slot', full: true };
Deno.test('rule 2: who else owns it beats "No longer tradable", which beats the slot lines', () => {
  const dead = { isDraftable: false, allowUndraftable: false, roomless: true, slotLine: FITS };
  assertEquals(statusLine({ ...base, ...dead, owner: { name: 'Gianluigi B.' } }), { text: 'Owned by Gianluigi B.', kind: 'owned' });
  assertEquals(statusLine({ ...base, ...dead }), { text: 'No longer tradable', kind: 'untradable' }); // beats the slot lines
  assertEquals(statusLine({ ...base, roomless: true }), { text: 'No free slot', kind: 'full' });
  assertEquals(statusLine(base), { text: 'Available', kind: 'available' });
});

Deno.test('"You own this" is gone from Watching: a stock you hold is left out of the view, never a row', () => {
  assertEquals(COPY.youOwnThis, 'You own this'); // still the search row's word
  const w = watch({ symbols: ['NVDA', 'AAPL', 'AMGN'], rows: [row('NVDA'), row('AAPL'), row('AMGN')] });
  assertEquals(watchingRows(w, (s) => s === 'NVDA').map((r) => r.symbol), ['AAPL', 'AMGN']);
  // while the ledger is not known nothing is hidden on a guess
  assertEquals(watchingRows(w).map((r) => r.symbol), ['NVDA', 'AAPL', 'AMGN']);
  // a watched stock that was bought is only left out of the view; the app never unsaves it (the server does, on a buy and on a sale)
  assertEquals(w.symbols, ['NVDA', 'AAPL', 'AMGN']);
});

Deno.test('rule 2: a full-universe league never says "No longer tradable" for the flag alone', () => {
  assertEquals(statusLine({ ...base, isDraftable: false, allowUndraftable: true }).text, 'Available');
});

Deno.test('an owner whose name is not resolved reads "Owned by another manager"', () => {
  assertEquals(statusLine({ ...base, owner: { name: null } }).text, 'Owned by another manager');
});

Deno.test('the server\'s slot line wins over the interim lines; no answer falls back to "No free slot" (every slot held) or plain "Available"', () => {
  assertEquals(statusLine({ ...base, slotLine: FITS }), { text: FITS.text, kind: 'available' });
  assertEquals(statusLine({ ...base, slotLine: FULL }), { text: FULL.text, kind: 'full' });
  assertEquals(statusLine({ ...base, slotLine: FITS, roomless: true }).text, FITS.text);
  assertEquals(statusLine({ ...base, slotLine: null, roomless: false }).text, 'Available');
});

Deno.test('the "+" on a Watching row: a stock you can get (the server named its slot or not), never a full, owned or untradable one, never in a finished season', () => {
  assertEquals(watchRowHasPlus(statusLine(base), false), true);
  assertEquals(watchRowHasPlus(statusLine({ ...base, slotLine: FITS }), false), true);
  assertEquals(watchRowHasPlus(statusLine(base), true), false);
  assertEquals(watchRowHasPlus(statusLine({ ...base, owner: { name: 'P' } }), false), false);
  assertEquals(watchRowHasPlus(statusLine({ ...base, isDraftable: false }), false), false);
  assertEquals(watchRowHasPlus(statusLine({ ...base, roomless: true }), false), false);
  assertEquals(watchRowHasPlus(statusLine({ ...base, slotLine: FULL }), false), false);
});

Deno.test('no star on a stock you own, anywhere: a free stock and another manager\'s have one', () => {
  assertEquals(showsStar(true), false);
  assertEquals(showsStar(false), true);
  assertEquals(starLabel('AMGN', false), 'Save AMGN');
  assertEquals(starLabel('AMGN', true), 'Saved AMGN');
});

Deno.test('the search star (board #call-search-star): free, "Owned by {name}" and "No free slot" have one; "You own this" and "Not in this league\'s list" have none', () => {
  assertEquals(showsSearchStar(true, false), true); // free / owned by someone else / no free slot (none of them is "mine")
  assertEquals(showsSearchStar(true, true), false); // You own this (his ruling overrides the board)
  assertEquals(showsSearchStar(false, false), false); // Not in this league's list
});

Deno.test('a save of a stock you hold is refused by the server with its own reason: a plain failure, the star reverts, no words (a race-only case)', () => {
  const r = parseSaveResult({ data: { ok: false, reason: 'already_owned' }, error: null });
  assertEquals(r, { ok: false, reason: 'failed' });
  const tap = applyToggle(watch(), 'NVDA')!;
  const after = settleToggle(tap.next, 'NVDA', tap.want, r);
  assertEquals(isSaved(after, 'NVDA'), false);
  assertEquals(after.refusal, null);
  assertEquals(failureWords(r.ok ? 'failed' : r.reason), null);
});

Deno.test('the switch: the board\'s words in the board\'s order (Claims joins in workstream 7)', () => {
  assertEquals(SWITCH_SEGMENTS.map((s) => s.label), ['Available', 'Watching']);
  assertEquals(COPY.watchingEmpty, 'Star a stock to watch it here.');
});

// ── the store: the star through the write, error-checked ──
function fakeIo(over: Partial<{ read: (l: string) => Promise<WatchRow[] | null>; write: (l: string, s: string, b: boolean) => Promise<{ data: unknown; error: unknown }> }> = {}) {
  const calls: string[] = [];
  const io = {
    read: over.read ?? (() => Promise.resolve([] as WatchRow[])),
    write: over.write ?? (() => Promise.resolve({ data: { ok: true, count: 1 }, error: null })),
  };
  return { io: { read: (l: string) => { calls.push(`read ${l}`); return io.read(l); }, write: (l: string, s: string, b: boolean) => { calls.push(`write ${l} ${s} ${b}`); return io.write(l, s, b); } }, calls };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

Deno.test('store: a save that goes through keeps the star and reads the list again for the name', async () => {
  const { io, calls } = fakeIo({ read: () => Promise.resolve([row('AMGN', { savedAt: '2026-11-23T10:00:00Z' })]) });
  const store = createWatchlistStore(io);
  const res = await store.toggle('L1', 'AMGN');
  assertEquals(res, { ok: true, count: 1 });
  await tick();
  assertEquals(isSaved(store.peek('L1'), 'AMGN'), true);
  assertEquals(store.peek('L1').rows.map((r) => r.symbol), ['AMGN']);
  assertEquals(calls, ['write L1 AMGN true', 'read L1']);
});

Deno.test('store: rate_limited puts the star back to empty and says nothing; no re-read', async () => {
  const { io, calls } = fakeIo({ write: () => Promise.resolve({ data: { ok: false, reason: 'rate_limited' }, error: null }) });
  const store = createWatchlistStore(io);
  const seen: boolean[] = [];
  store.subscribe(() => seen.push(isSaved(store.peek('L1'), 'AMGN')));
  const res = await store.toggle('L1', 'AMGN');
  assertEquals(res, { ok: false, reason: 'rate_limited' });
  assertEquals(seen[0], true); // optimistic at once
  assertEquals(isSaved(store.peek('L1'), 'AMGN'), false); // then back
  assertEquals(store.peek('L1').refusal, null);
  assertEquals(calls, ['write L1 AMGN true']);
});

Deno.test('store: watchlist_full reverts the star and remembers the refusal until it is cleared', async () => {
  const { io } = fakeIo({ write: () => Promise.resolve({ data: { ok: false, reason: 'watchlist_full' }, error: null }) });
  const store = createWatchlistStore(io);
  await store.toggle('L1', 'AMGN');
  assertEquals(isSaved(store.peek('L1'), 'AMGN'), false);
  assertEquals(store.peek('L1').refusal, 'watchlist_full');
  store.clearRefusal('L1');
  assertEquals(store.peek('L1').refusal, null);
});

Deno.test('store: a supabase-js { error } and a thrown call are both failed saves (the rpc does not throw on a Postgres error)', async () => {
  for (const write of [
    () => Promise.resolve({ data: { ok: true, count: 1 }, error: { message: 'permission denied' } }),
    () => Promise.reject(new Error('network')),
  ]) {
    const { io } = fakeIo({ write });
    const store = createWatchlistStore(io);
    assertEquals(await store.toggle('L1', 'AMGN'), { ok: false, reason: 'failed' });
    assertEquals(isSaved(store.peek('L1'), 'AMGN'), false);
  }
});

Deno.test('store: a second tap on a star whose write is in flight is ignored', async () => {
  let release: (v: { data: unknown; error: unknown }) => void = () => {};
  const { io, calls } = fakeIo({ write: () => new Promise((r) => { release = r; }) });
  const store = createWatchlistStore(io);
  const first = store.toggle('L1', 'AMGN');
  assertEquals(await store.toggle('L1', 'AMGN'), null);
  release({ data: { ok: true, count: 1 }, error: null });
  await first;
  assertEquals(calls.filter((c) => c.startsWith('write')).length, 1);
});

Deno.test('store: a watchlist is per league', async () => {
  const { io } = fakeIo({ read: (l) => Promise.resolve(l === 'L1' ? [row('AMGN')] : []) });
  const store = createWatchlistStore(io);
  await store.toggle('L1', 'AMGN');
  await tick();
  assertEquals(isSaved(store.peek('L1'), 'AMGN'), true);
  assertEquals(isSaved(store.peek('L2'), 'AMGN'), false);
  assertEquals(store.peek(null).symbols, []);
});

Deno.test('store: a failed first read is "failed" (never "nothing saved"); a failed re-read keeps what was known', async () => {
  let fail = true;
  const { io } = fakeIo({ read: () => Promise.resolve(fail ? null : [row('NVDA')]) });
  const store = createWatchlistStore(io);
  await store.load('L1');
  assertEquals(store.peek('L1').status, 'failed');
  fail = false;
  await store.load('L1'); // a retry after a failure reads again
  assertEquals(store.peek('L1').status, 'ready');
  assertEquals(store.peek('L1').symbols, ['NVDA']);
  fail = true;
  await store.load('L1', true);
  assertEquals(store.peek('L1').status, 'ready');
  assertEquals(store.peek('L1').symbols, ['NVDA']);
});

Deno.test('store: a read that lands late does not undo a tap, and an older read never overwrites a newer one', async () => {
  const resolvers: ((r: WatchRow[] | null) => void)[] = [];
  const { io } = fakeIo({
    read: () => new Promise((r) => { resolvers.push(r); }),
    write: () => new Promise(() => {}), // never settles: the tap stays in flight
  });
  const store = createWatchlistStore(io);
  void store.load('L1');
  void store.toggle('L1', 'AMGN');
  void store.load('L1', true); // a newer read
  resolvers[1]([row('NVDA')]);
  await tick();
  resolvers[0]([row('OLD')]); // the older read answers late: dropped
  await tick();
  const w = store.peek('L1');
  assertEquals(w.rows.map((r) => r.symbol), ['NVDA']);
  assertEquals(w.symbols.slice().sort(), ['AMGN', 'NVDA']); // the tap in flight kept
});

// ── Watching rows' live figures ──
Deno.test('changePct: needs BOTH a usable price and a positive previous close; never invented', () => {
  assertEquals(Math.round((changePct(105, 100) ?? 0) * 100) / 100, 5);
  assertEquals(changePct(null, 100), null);
  assertEquals(changePct(0, 100), null);
  assertEquals(changePct(105, null), null);
  assertEquals(changePct(105, 0), null);
  assertEquals(changePct(105, -3), null);
  assertEquals(changePct(Number.NaN, 100), null);
});

Deno.test('changeText: the board\'s "+11.2% today" / "−9.8% Fri" (U+2212), one decimal, a zero change unsigned', () => {
  assertEquals(changeText(11.2, 'today'), '+11.2% today');
  assertEquals(changeText(-9.8, 'Fri'), '−9.8% Fri');
  assertEquals(changeText(0.04, 'today'), '0.0% today');
  assertEquals(changeText(-0.04, 'today'), '0.0% today');
  assertEquals(changeText(1.4, null), '+1.4%');
  assertEquals(changeText(null, 'today'), null);
  assertEquals(changeTone(0.04), 'flat');
  assertEquals(changeTone(-2), 'loss');
  assertEquals(changeTone(2), 'gain');
  assertEquals(changeTone(null), null);
  assertEquals(changeSpoken(11.2, 'today'), 'plus 11.2 percent today');
  assertEquals(changeSpoken(-9.8, 'Fri'), 'minus 9.8 percent Fri');
});

Deno.test('shortWeekdayEt: the last close\'s day in New York', () => {
  assertEquals(shortWeekdayEt('2026-11-20T21:00:00Z'), 'Fri');
  assertEquals(shortWeekdayEt('2026-11-21T01:30:00Z'), 'Fri'); // 8:30 PM ET Friday, already Saturday in UTC
  assertEquals(shortWeekdayEt('nope'), null);
  assertEquals(shortWeekdayEt(null), null);
});

Deno.test('answerFromTickerQuote: a body with an error or not an object is a failed read; a bad price is "no price"', () => {
  assertEquals(answerFromTickerQuote({ symbol: 'A', price: 187.2, prevClose: 184.6 }), { ok: true, price: 187.2, prevClose: 184.6 });
  assertEquals(answerFromTickerQuote({ price: 0, prevClose: 10 }), { ok: true, price: null, prevClose: 10 });
  assertEquals(answerFromTickerQuote({ price: 10 }), { ok: true, price: 10, prevClose: null });
  assertEquals(answerFromTickerQuote({ error: 'x', price: 10 }), { ok: false });
  assertEquals(answerFromTickerQuote(null), { ok: false });
  assertEquals(answerFromTickerQuote([1]), { ok: false });
});

Deno.test('quote store: one read per symbol while fresh, shared in flight, lanes bounded, failures retried after 15 s', async () => {
  let clock = 0;
  const asked: string[] = [];
  let inFlight = 0;
  let peak = 0;
  const gates: Record<string, (a: QuoteAnswer) => void> = {};
  const store = createQuoteStore(
    (s) => {
      asked.push(s);
      inFlight++;
      peak = Math.max(peak, inFlight);
      return new Promise<QuoteAnswer>((r) => { gates[s] = (a) => { inFlight--; r(a); }; });
    },
    () => clock,
    2,
  );
  let settled = 0;
  store.request(['A', 'B', 'C', 'A'], () => { settled++; });
  assertEquals(asked, ['A', 'B']); // two lanes; A is not asked twice
  assertEquals(store.peek('A'), undefined);
  gates.A({ ok: true, price: 110, prevClose: 100 });
  await tick();
  assertEquals(asked, ['A', 'B', 'C']);
  assertEquals(peak, 2);
  gates.B({ ok: false });
  gates.C({ ok: true, price: null, prevClose: 5 });
  await tick();
  assertEquals(settled >= 3, true);
  const a = store.peek('A');
  assertEquals(a?.status === 'ready' && a.price, 110);
  assertEquals(Math.round(((a?.status === 'ready' ? a.changePct : 0) ?? 0) * 10) / 10, 10);
  assertEquals(store.peek('B'), { status: 'ready', price: null, changePct: null }); // a failed read is "no figures"
  assertEquals(store.peek('C'), { status: 'ready', price: null, changePct: null }); // no price: no change either

  // fresh: no new reads
  store.request(['A', 'B', 'C'], () => {});
  assertEquals(asked.length, 3);
  // a failure is asked again after 15 s, a success after 60 s
  clock = QUOTE_FAIL_TTL_MS;
  store.request(['A', 'B'], () => {});
  assertEquals(asked.slice(3), ['B']);
  gates.B({ ok: true, price: 50, prevClose: 40 });
  await tick();
  clock = QUOTE_TTL_MS + 1;
  store.request(['A'], () => {});
  assertEquals(asked.slice(4), ['A']);
});

Deno.test('quote store: a read that THROWS is a failed read, and its lane is freed for the next', async () => {
  const store = createQuoteStore((s) => (s === 'A' ? Promise.reject(new Error('net')) : Promise.resolve({ ok: true, price: 10, prevClose: 10 } as QuoteAnswer)), () => 0, 1);
  store.request(['A', 'B'], () => {});
  await tick();
  await tick();
  assertEquals(store.peek('A'), { status: 'ready', price: null, changePct: null });
  assertEquals(store.peek('B'), { status: 'ready', price: 10, changePct: 0 });
});

// ── the slot lines: the server's list preview, mapped to the board's words ──
import { askableRows, listPreviewBody, parseListPreview, LIST_PREVIEW_MAX } from '../lib/stocks/watchSlots.ts';

const LOW = { slot_id: 's1', slot_index: 0, slot_count: 3, price_min: 100, price_max: 200, category_id: null };
const MID = { slot_id: 's2', slot_index: 1, slot_count: 3, price_min: 200, price_max: 400, category_id: null };
const HIGH = { slot_id: 's3', slot_index: 2, slot_count: 3, price_min: 400, price_max: null, category_id: null };
const resolve = (id: string) => (id === 'cat-tech' ? 'Tech' : null);
const asked = [{ symbol: 'AMGN', price: 187.2 }, { symbol: 'COST', price: 920.55 }, { symbol: 'AAPL', price: 211.42 }];
const shown = (m: Record<string, number>) => (s: string) => m[s];
const answer = (rows: unknown[], slots: unknown[] = [{ ...LOW, held: [], open: 1 }, { ...MID, held: [], open: 1 }, { ...HIGH, held: ['NVDA'], open: 0 }]) => ({ ok: true, stake_mode: 'price_tiers', slots, rows });

Deno.test('listPreviewBody: one call per screen, rows only (never a top-level symbol or price); askableRows keeps usable prices, deduped, at most 50', () => {
  assertEquals(listPreviewBody('L1', asked), { action: 'preview', league_id: 'L1', rows: asked });
  assertEquals(askableRows([{ symbol: 'a', price: 10 }, { symbol: 'A', price: 11 }, { symbol: 'B', price: 0 }, { symbol: 'C', price: null }, { symbol: 'D', price: Number.NaN }, { symbol: 'E', price: -2 }]), [{ symbol: 'A', price: 10 }]);
  assertEquals(askableRows(Array.from({ length: 60 }, (_, i) => ({ symbol: `S${i}`, price: 10 }))).length, LIST_PREVIEW_MAX);
});

Deno.test('parseListPreview: would_fill = slot -> "Available · fits your {band}"; no room -> "No free {the one full band}"; null -> no answer', () => {
  const data = answer([
    { symbol: 'AMGN', price: 187.2, would_fill: LOW },
    { symbol: 'COST', price: 920.55, would_fill: null, open_slots: [LOW, MID] },
    null,
  ]);
  const m = parseListPreview(data, asked, shown({ AMGN: 187.2, COST: 920.55, AAPL: 211.42 }), resolve);
  assertEquals(m.get('AMGN'), { text: 'Available \u00b7 fits your $100\u2013$200 slot', full: false, price: 187.2 });
  assertEquals(m.get('COST'), { text: 'No free $400 or more slot', full: true, price: 920.55 });
  assertEquals(m.has('AAPL'), false); // null: the row reads what the app can tell (plain "Available")
});

Deno.test('parseListPreview: "No free slot" (no band) when no single full price-band slot holds the price', () => {
  const noRoom = (slots: unknown[]) => parseListPreview(answer([null, { symbol: 'COST', price: 920.55, would_fill: null, open_slots: [] }, null], slots), asked, shown({ COST: 920.55 }), resolve).get('COST')!.text;
  assertEquals(noRoom([{ ...LOW, held: [], open: 1 }, { ...HIGH, held: ['NVDA'], open: 1 }]), 'No free slot'); // the slot holding it has room: nothing to name
  assertEquals(noRoom([{ ...HIGH, held: ['A'], open: 0 }, { ...HIGH, slot_id: 's9', held: ['B'], open: 0 }]), 'No free slot'); // two full slots hold it: not named
  assertEquals(noRoom([{ ...HIGH, category_id: 'cat-tech', held: ['A'], open: 0 }]), 'No free slot'); // a category slot is not a price band alone
  assertEquals(noRoom([]), 'No free slot');
});

Deno.test('parseListPreview: a category slot fits only with a resolved name; an unresolved one is no answer, never "Category"', () => {
  const rows = [{ symbol: 'AMGN', price: 187.2, would_fill: { ...LOW, category_id: 'cat-tech' } }, null, null];
  assertEquals(parseListPreview(answer(rows), asked, shown({ AMGN: 187.2 }), resolve).get('AMGN')!.text, 'Available \u00b7 fits your $100\u2013$200 Tech slot');
  const unresolved = [{ symbol: 'AMGN', price: 187.2, would_fill: { ...LOW, category_id: 'cat-unknown' } }, null, null];
  assertEquals(parseListPreview(answer(unresolved), asked, shown({ AMGN: 187.2 }), resolve).has('AMGN'), false);
});

Deno.test('parseListPreview: an answer for a price the row is no longer showing is dropped (re-asked on the next refresh)', () => {
  const rows = [{ symbol: 'AMGN', price: 187.2, would_fill: LOW }, null, null];
  assertEquals(parseListPreview(answer(rows), asked, shown({ AMGN: 188.0 }), resolve).size, 0);
  assertEquals(parseListPreview(answer(rows), asked, () => null, resolve).size, 0);
});

Deno.test('parseListPreview: anything that is not the list answer is no answer for every row, never a guess', () => {
  const ok = [{ symbol: 'AMGN', price: 187.2, would_fill: LOW }, null, null];
  const one = (data: unknown) => parseListPreview(data, asked, shown({ AMGN: 187.2 }), resolve).size;
  assertEquals(one(answer(ok)), 1);
  assertEquals(one(null), 0);
  assertEquals(one({ ok: true, stake_mode: 'price_tiers', slots: [] }), 0); // the function before it learned the list: an ordinary preview, no `rows`
  assertEquals(one({ ...answer(ok), ok: false }), 0); // a refusal (draft_not_completed, season_completed)
  assertEquals(one(answer(ok.slice(0, 2))), 0); // length differs
  assertEquals(one(answer([{ symbol: 'ZZZ', price: 187.2, would_fill: LOW }, null, null])), 0); // another symbol in that place
  assertEquals(one(answer([{ symbol: 'AMGN', price: 1, would_fill: LOW }, null, null])), 0); // echoed another price
  assertEquals(one(answer([{ symbol: 'AMGN', price: 187.2, would_fill: { nope: 1 } }, null, null])), 0); // a slot that is not a slot
  assertEquals(one(answer([{ symbol: 'AMGN', price: 187.2 }, null, null])), 0); // would_fill missing
});

// ── the capture seam's watchlist (DEV only): behaves as the server would ──
import { parseStocksKnob, resetSeamWatchlist, seamListPreview, seamTickerQuote, seamWatchlistRead, seamWatchlistWrite } from '../lib/stocks/seamStocks.ts';

Deno.test('seam: the saved set starts seeded, a star changes it as the server would, and each knob refuses as named', () => {
  resetSeamWatchlist();
  const knob = parseStocksKnob('');
  const syms = () => (seamWatchlistRead(knob)!.data as { symbol: string }[]).map((r) => r.symbol);
  assertEquals(syms(), ['AVGO', 'AMGN', 'COST', 'LOW', 'SQ']);
  assertEquals(seamWatchlistWrite({ p_symbol: 'msft', p_saved: true }, knob)!.data, { ok: true, saved: true, count: 6 });
  assertEquals(syms()[0], 'MSFT');
  seamWatchlistWrite({ p_symbol: 'AVGO', p_saved: false }, knob);
  assertEquals(syms().includes('AVGO'), false);
  assertEquals(seamWatchlistWrite({ p_symbol: 'X', p_saved: true }, parseStocksKnob('savefull'))!.data, { ok: false, reason: 'watchlist_full', max: 50 });
  assertEquals(seamWatchlistWrite({ p_symbol: 'X', p_saved: true }, parseStocksKnob('saverate'))!.data, { ok: false, reason: 'rate_limited' });
  assertEquals(seamWatchlistWrite({ p_symbol: 'X', p_saved: true }, parseStocksKnob('savehang')), null);
  assert(seamWatchlistWrite({ p_symbol: 'X', p_saved: true }, parseStocksKnob('savefail'))!.error);
  resetSeamWatchlist();
  assertEquals((seamWatchlistRead(parseStocksKnob('watchempty'))!.data as unknown[]).length, 0);
  assert(seamWatchlistRead(parseStocksKnob('watchfail'))!.error);
  assertEquals(seamWatchlistRead(parseStocksKnob('watchloading')), null);
  resetSeamWatchlist();
});

Deno.test('seam: the single-symbol quote answers price and previous close; a delisted or unknown symbol answers an error', () => {
  const ok = seamTickerQuote('amgn', parseStocksKnob('')).data as { price: number; prevClose: number };
  assertEquals(ok.price, 282.4);
  assert(ok.prevClose > 0);
  assert(seamTickerQuote('SQ', parseStocksKnob('')).error);
  assert(seamTickerQuote('ZZZZ', parseStocksKnob('')).error);
  assert(seamTickerQuote('AMGN', parseStocksKnob('noprice')).error);
});

Deno.test('seam: the list preview answers a tier league with its third slot full, in order and length; nolist fails it', () => {
  const body = { rows: [{ symbol: 'AMGN', price: 150 }, { symbol: 'COST', price: 920 }, { symbol: 'X', price: 0 }] };
  const d = seamListPreview(body, parseStocksKnob('')).data as { ok: boolean; rows: ({ would_fill: { price_min: number } | null } | null)[] };
  assertEquals(d.rows.length, 3);
  assertEquals(d.rows[0]!.would_fill!.price_min, 100);
  assertEquals(d.rows[1]!.would_fill, null);
  assertEquals(d.rows[2], null);
  assert(seamListPreview(body, parseStocksKnob('nolist')).error);
  const m = parseListPreview(d, [{ symbol: 'AMGN', price: 150 }, { symbol: 'COST', price: 920 }, { symbol: 'X', price: 0 }], (s) => ({ AMGN: 150, COST: 920, X: 0 } as Record<string, number>)[s], () => null);
  assertEquals(m.get('AMGN')!.text, 'Available \u00b7 fits your $100\u2013$200 slot');
  assertEquals(m.get('COST')!.text, 'No free $400 or more slot');
});

// ── wiring guards (the suite's pattern for RN-only code) ──
import { SOURCES } from './sourceManifest.generated.ts';

Deno.test('wiring: no Save in the sheet on a stock you hold; Watching leaves held stocks out; the app unsaves ONLY on a star tap, never on a buy', () => {
  const sheet = SOURCES['components/money/StockSheetBody.tsx'];
  assert(/save=\{!held && watchLeagueId \?/.test(sheet), 'the sheet header\'s Save is gated on !held');
  const watching = SOURCES['components/stocks/WatchingList.tsx'];
  assert(/watchingRows\(watch, \(sym\) => ownership\.ownerFor\(sym\)\?\.kind === 'me'\)/.test(watching), 'Watching drops a stock the caller holds');
  assert(!/You own this|youOwnThis|youText/.test(watching), 'no "You own this" status on Watching');
  // set_watchlist is called from ONE place (the store's write), and only by a star tap's toggle
  const callers = Object.entries(SOURCES).filter(([, src]) => /'set_watchlist'/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))).map(([p]) => p).sort();
  assertEquals(callers, ['lib/game/seamCalls.ts', 'lib/stocks/useWatchlist.ts']);
  for (const path of ['lib/money/useTradeSubmit.ts', 'lib/money/recordTrade.ts', 'lib/money/usePortfolioLedger.ts']) {
    assert(!/watchlist/i.test(SOURCES[path] ?? ''), `${path} never touches the watchlist`);
  }
  // the search star goes through the one rule
  assert(/showsSearchStar\(item\.selectable, suffix\.mine\)/.test(SOURCES['components/stocks/StocksScreen.tsx']));
});

Deno.test('wiring: the slot lines are ONE list call per screen of rows (never the single preview per row) through the seam, error-checked, paced at a minute', () => {
  const hook = SOURCES['lib/stocks/useWatchSlots.ts'];
  assert(/seamInvoke\('record-trade', \{ body: listPreviewBody\(leagueId, sent\) \}\)/.test(hook));
  assert(/if \(!res\.error\) data = res\.data;/.test(hook), 'a { error } is no answer');
  assert(/SLOT_MIN_GAP_MS = 60_000/.test(hook));
  assert(!/previewBody\(/.test(SOURCES['components/stocks/WatchingList.tsx']), 'no single preview per row');
});
