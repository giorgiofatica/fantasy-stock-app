/**
 * Hermetic tests for the week price rule (./week-price.ts): bar, else a trade in
 * the window, else a sane two-sided midpoint, else (step 5, when the caller
 * allows it) the most recent real close inside the look-back range, else no
 * price. Never an ask or a bid alone; a FAILED request never moves a symbol on
 * to a later step. Alpaca is a fake fetch; no network, no env.
 *
 *   deno test supabase/functions/_shared/week-price.test.ts
 */

import { assert, assertEquals } from 'jsr:@std/assert';
import {
  MAX_MID_SPREAD_FRACTION,
  PREV_CLOSE_MAX_SESSIONS,
  alpacaTimeMs,
  barPrice,
  describeWeekPrices,
  fetchWeekPrices,
  liveWindowFor,
  midpointPrice,
  prevCloseAllowed,
  prevClosePrice,
  prevCloseRange,
  resolvePrice,
  scoringPriceBounds,
  scoringPriceRequest,
  tradePrice,
  type FetchFn,
  type UnpricedReason,
} from './week-price.ts';
import { buildPricedRows, type Holding } from '../snapshot-week-start/plan.ts';

// Mon 2026-11-16: the open is 14:30Z, the week-start job ran at 14:35Z.
const OPEN_MS = Date.parse('2026-11-16T14:30:00Z');
const RUN_MS = Date.parse('2026-11-16T14:35:04Z');
const WINDOW = { fromMs: OPEN_MS, toMs: RUN_MS };
const IN = '2026-11-16T14:33:10.123456789Z'; // nanosecond fraction, as Alpaca sends
const BEFORE = '2026-11-13T20:59:58Z';        // Friday: the latest trade of a name that has not traded today

// ── pure steps ──────────────────────────────────────────────────────────────

Deno.test('alpacaTimeMs reads nanosecond RFC 3339 and refuses junk', () => {
  assertEquals(alpacaTimeMs('2026-11-16T14:33:10.123456789Z'), Date.parse('2026-11-16T14:33:10.123Z'));
  assertEquals(alpacaTimeMs(''), null);
  assertEquals(alpacaTimeMs(undefined), null);
  assertEquals(alpacaTimeMs('not a time'), null);
});

Deno.test('barPrice takes the LAST bar, open or close, and only a positive one', () => {
  const bars = [{ o: 1, c: 2 }, { o: 212.44, c: 214.1 }];
  assertEquals(barPrice(bars, 'o'), 212.44);
  assertEquals(barPrice(bars, 'c'), 214.1);
  assertEquals(barPrice([], 'o'), null);
  assertEquals(barPrice([{ o: 0, c: 0 }], 'o'), null);
  assertEquals(barPrice(undefined, 'c'), null);
});

Deno.test('tradePrice: a trade inside the window is a price; outside it is stale', () => {
  assertEquals(tradePrice({ p: 212.5, t: IN }, WINDOW), 212.5);
  assertEquals(tradePrice({ p: 212.5, t: BEFORE }, WINDOW), 'stale');
  assertEquals(tradePrice({ p: 212.5 }, WINDOW), 'stale', 'an undated trade cannot be placed in the window');
  assertEquals(tradePrice({ p: 0, t: IN }, WINDOW), null);
  assertEquals(tradePrice(undefined, WINDOW), null);
  assertEquals(tradePrice({ p: 9, t: BEFORE }, {}), 9, 'an open window accepts any time');
});

Deno.test('midpointPrice: both sides, sane spread -> the midpoint', () => {
  const m = midpointPrice({ bp: 212.3, bs: 1, ap: 212.5, as: 2, t: IN }, WINDOW);
  assert(m && 'price' in m);
  assertEquals(Math.round(m.price * 100) / 100, 212.4);
});

Deno.test('midpointPrice: an ASK alone is refused (the 2026-11-16 TM case)', () => {
  // TM's IEX quote at 14:35Z: an ask of 247.75 and no bid. The old code stored 247.75.
  assertEquals(midpointPrice({ ap: 247.75, as: 1, bp: 0, bs: 0, t: IN }, WINDOW), { reason: 'ask_only' });
  assertEquals(midpointPrice({ ap: 247.75, t: IN }, WINDOW), { reason: 'ask_only' });
});

Deno.test('midpointPrice: a BID alone is refused', () => {
  assertEquals(midpointPrice({ bp: 39.1, bs: 3, ap: 0, as: 0, t: IN }, WINDOW), { reason: 'bid_only' });
});

Deno.test('midpointPrice: a side with zero size is a missing side', () => {
  assertEquals(midpointPrice({ bp: 39.1, bs: 0, ap: 39.2, as: 4, t: IN }, WINDOW), { reason: 'ask_only' });
});

Deno.test('midpointPrice: a wide spread is refused, the band edge is accepted', () => {
  // BCH-like: bid 39.16, ask 44.27 -> spread ~12.3% of mid.
  assertEquals(midpointPrice({ bp: 39.16, bs: 1, ap: 44.27, as: 1, t: IN }, WINDOW), { reason: 'wide_spread' });
  // Exactly at the band: (ap - bp) / mid == 2%.
  const mid = 100;
  const half = (MAX_MID_SPREAD_FRACTION * mid) / 2;
  const edge = midpointPrice({ bp: mid - half, bs: 1, ap: mid + half, as: 1, t: IN }, WINDOW);
  assert(edge && 'price' in edge, 'a spread exactly at the band prices');
  // Just past it.
  const past = midpointPrice({ bp: mid - half - 0.01, bs: 1, ap: mid + half + 0.01, as: 1, t: IN }, WINDOW);
  assertEquals(past, { reason: 'wide_spread' });
});

Deno.test('midpointPrice: crossed and stale quotes are refused', () => {
  assertEquals(midpointPrice({ bp: 10.2, bs: 1, ap: 10.1, as: 1, t: IN }, WINDOW), { reason: 'crossed' });
  assertEquals(midpointPrice({ bp: 10.0, bs: 1, ap: 10.1, as: 1, t: BEFORE }, WINDOW), { reason: 'stale_quote' });
  assertEquals(midpointPrice(undefined, WINDOW), null);
});

Deno.test('resolvePrice: step 1, the bar wins over everything', () => {
  const r = resolvePrice({
    bar: 212.44, barSource: 'bar_open',
    live: { window: WINDOW, trade: { p: 213, t: IN }, quote: { bp: 212, ap: 212.2, t: IN } },
  });
  assertEquals(r, { price: 212.44, source: 'bar_open' });
});

Deno.test('resolvePrice: step 2, no bar -> the last trade inside the window', () => {
  const r = resolvePrice({ bar: null, barSource: 'bar_open', live: { window: WINDOW, trade: { p: 212.6, t: IN }, quote: { ap: 247.75, t: IN } } });
  assertEquals(r, { price: 212.6, source: 'last_trade' });
});

Deno.test('resolvePrice: step 3, no bar, stale trade -> a sane midpoint', () => {
  const r = resolvePrice({
    bar: null, barSource: 'bar_open',
    live: { window: WINDOW, trade: { p: 205, t: BEFORE }, quote: { bp: 212.3, bs: 1, ap: 212.5, as: 1, t: IN } },
  });
  assert(r.price !== null && r.source === 'midpoint');
  assertEquals(Math.round(r.price * 100) / 100, 212.4);
});

Deno.test('resolvePrice: step 4, no bar, no trade, ask only -> NO price', () => {
  const r = resolvePrice({ bar: null, barSource: 'bar_open', live: { window: WINDOW, trade: undefined, quote: { ap: 247.75, as: 1, t: IN } } });
  assertEquals(r, { price: null, reason: 'ask_only' });
});

Deno.test('resolvePrice: a stale trade and no quote -> no price, reason stale_trade', () => {
  const r = resolvePrice({ bar: null, barSource: 'bar_close', live: { window: WINDOW, trade: { p: 205, t: BEFORE }, quote: undefined } });
  assertEquals(r, { price: null, reason: 'stale_trade' });
});

Deno.test('resolvePrice: live null (a past session) is bar or nothing', () => {
  assertEquals(resolvePrice({ bar: null, barSource: 'bar_open', live: null }), { price: null, reason: 'no_bar_no_live' });
  assertEquals(resolvePrice({ bar: 5, barSource: 'bar_close', live: null }), { price: 5, source: 'bar_close' });
});

Deno.test('liveWindowFor: only today gets a live window', () => {
  const now = new Date(RUN_MS);
  assertEquals(liveWindowFor('2026-11-16', now, OPEN_MS, RUN_MS), { fromMs: OPEN_MS, toMs: RUN_MS });
  assertEquals(liveWindowFor('2026-11-13', now, OPEN_MS, RUN_MS), null);
});

// ── IO with a fake Alpaca ───────────────────────────────────────────────────

interface FakeAlpaca {
  bars?: Record<string, unknown[]>;
  trades?: Record<string, unknown>;
  quotes?: Record<string, unknown>;
  failBars?: number;
}

function fakeAlpaca(data: FakeAlpaca): { fetchFn: FetchFn; calls: string[] } {
  const calls: string[] = [];
  const pick = (u: URL, src: Record<string, unknown> | undefined) => {
    const syms = (u.searchParams.get('symbols') ?? '').split(',');
    const out: Record<string, unknown> = {};
    for (const s of syms) if (src && s in src) out[s] = src[s];
    return out;
  };
  const fetchFn: FetchFn = (url) => {
    calls.push(url);
    const u = new URL(url);
    if (u.pathname.endsWith('/stocks/bars')) {
      if (data.failBars) return Promise.resolve(new Response('nope', { status: data.failBars }));
      return Promise.resolve(Response.json({ bars: pick(u, data.bars), next_page_token: null }));
    }
    if (u.pathname.endsWith('/stocks/trades/latest')) return Promise.resolve(Response.json({ trades: pick(u, data.trades) }));
    if (u.pathname.endsWith('/stocks/quotes/latest')) return Promise.resolve(Response.json({ quotes: pick(u, data.quotes) }));
    return Promise.resolve(new Response('unexpected', { status: 404 }));
  };
  return { fetchFn, calls };
}

// The 2026-11-16 shape: AAPL has a bar; TM has only an ask; KB traded since the
// open; BCH has a sane two-sided quote but a Friday trade; AVAL has nothing.
const MONDAY: FakeAlpaca = {
  bars: { AAPL: [{ o: 228.1, c: 229 }] },
  trades: { KB: { p: 104.2, t: IN }, BCH: { p: 38.0, t: BEFORE } },
  quotes: {
    TM: { ap: 247.75, as: 1, bp: 0, bs: 0, t: IN },
    BCH: { bp: 39.1, bs: 2, ap: 39.2, as: 2, t: IN },
  },
};

Deno.test('fetchWeekPrices: each step prices what it can, ask-only and no-data stay unpriced', async () => {
  const { fetchFn, calls } = fakeAlpaca(MONDAY);
  const p = await fetchWeekPrices(
    { symbols: ['aapl', 'TM', 'KB', 'BCH', 'AVAL'], bar: { sessionDate: '2026-11-16', field: 'o' }, live: WINDOW },
    'k', 's', fetchFn,
  );
  assertEquals(p.prices.get('AAPL'), 228.1);
  assertEquals(p.sources.get('AAPL'), 'bar_open');
  assertEquals(p.prices.get('KB'), 104.2);
  assertEquals(p.sources.get('KB'), 'last_trade');
  assertEquals(p.sources.get('BCH'), 'midpoint');
  assertEquals(Math.round(p.prices.get('BCH')! * 100) / 100, 39.15);
  assertEquals(p.prices.has('TM'), false, 'an ask alone is never a price');
  assertEquals(p.unpriced.get('TM'), 'ask_only');
  assertEquals(p.unpriced.get('AVAL'), 'no_data');
  // Every requested symbol is accounted for exactly once.
  assertEquals(p.prices.size + p.unpriced.size, 5);
  // The live endpoints are asked only for what the step before left unpriced.
  const tradesCall = calls.find((c) => c.includes('/trades/latest'))!;
  assertEquals(new URL(tradesCall).searchParams.get('symbols'), 'TM,KB,BCH,AVAL');
  const quotesCall = calls.find((c) => c.includes('/quotes/latest'))!;
  assertEquals(new URL(quotesCall).searchParams.get('symbols'), 'TM,BCH,AVAL');
  assert(describeWeekPrices(p).includes('TM:ask_only'));
});

Deno.test('fetchWeekPrices: live null makes no trade or quote call at all', async () => {
  const { fetchFn, calls } = fakeAlpaca(MONDAY);
  const p = await fetchWeekPrices({ symbols: ['AAPL', 'TM'], bar: { sessionDate: '2026-11-16', field: 'o' }, live: null }, 'k', 's', fetchFn);
  assertEquals(calls.length, 1);
  assertEquals(p.prices.get('AAPL'), 228.1);
  assertEquals(p.unpriced.get('TM'), 'no_bar_no_live');
});

Deno.test('fetchWeekPrices: a FAILED bar request never falls to a live price (the bar may exist): retry', async () => {
  const { fetchFn, calls } = fakeAlpaca({ ...MONDAY, trades: { AAPL: { p: 229.9, t: IN } }, failBars: 500 });
  const p = await fetchWeekPrices({ symbols: ['AAPL', 'TM'], bar: { sessionDate: '2026-11-16', field: 'c' }, live: WINDOW }, 'k', 's', fetchFn);
  assertEquals(p.prices.size, 0, 'AAPL has an in-window trade, but its bar request failed, so no 14:35 trade price');
  assertEquals(p.unpriced.get('AAPL'), 'bar_fetch_failed');
  assertEquals(p.unpriced.get('TM'), 'bar_fetch_failed');
  assert(!calls.some((c) => c.includes('/latest')), 'no live call for a symbol whose bar request failed');
  assert(p.errors.some((e) => e.startsWith('bars 500')));
});

Deno.test('fetchWeekPrices: a failed SECOND bars page fails only symbols left unpriced in that chunk', async () => {
  const fetchFn: FetchFn = (url) => {
    const u = new URL(url);
    if (u.pathname.endsWith('/stocks/bars')) {
      if (!u.searchParams.get('page_token')) return Promise.resolve(Response.json({ bars: { A: [{ o: 1, c: 1 }] }, next_page_token: 'p2' }));
      return Promise.resolve(new Response('busy', { status: 429 }));
    }
    return Promise.resolve(Response.json({ trades: { B: { p: 9, t: IN } } }));
  };
  const p = await fetchWeekPrices({ symbols: ['A', 'B'], bar: { sessionDate: '2026-11-16', field: 'o' }, live: WINDOW }, 'k', 's', fetchFn);
  assertEquals(p.prices.get('A'), 1);
  assertEquals(p.unpriced.get('B'), 'bar_fetch_failed', 'B may have been on the failed page');
});

Deno.test('fetchWeekPrices: a throwing fetch leaves symbols unpriced, never throws', async () => {
  const p = await fetchWeekPrices(
    { symbols: ['AAPL'], bar: { sessionDate: '2026-11-16', field: 'o' }, live: WINDOW }, 'k', 's',
    () => Promise.reject(new Error('network down')),
  );
  assertEquals(p.prices.size, 0);
  assertEquals(p.unpriced.get('AAPL'), 'bar_fetch_failed');
  assertEquals(p.errors.length, 1, 'no live call after a failed bar request');
});

Deno.test('fetchWeekPrices: bar:null (scoring) uses trade then midpoint, any time', async () => {
  const { fetchFn, calls } = fakeAlpaca(MONDAY);
  const p = await fetchWeekPrices({ symbols: ['BCH', 'TM'], bar: null, live: {} }, 'k', 's', fetchFn);
  assert(!calls.some((c) => c.includes('/bars')));
  assertEquals(p.prices.get('BCH'), 38.0, 'with an open window the latest trade prices, whenever it was');
  assertEquals(p.sources.get('BCH'), 'last_trade');
  assertEquals(p.unpriced.get('TM'), 'ask_only');
});

Deno.test('fetchWeekPrices: bars pagination is followed', async () => {
  let page = 0;
  const fetchFn: FetchFn = (url) => {
    const u = new URL(url);
    if (u.pathname.endsWith('/stocks/bars')) {
      page++;
      if (!u.searchParams.get('page_token')) return Promise.resolve(Response.json({ bars: { A: [{ o: 1, c: 1 }] }, next_page_token: 'p2' }));
      return Promise.resolve(Response.json({ bars: { B: [{ o: 2, c: 2 }] }, next_page_token: null }));
    }
    return Promise.resolve(Response.json({}));
  };
  const p = await fetchWeekPrices({ symbols: ['A', 'B'], bar: { sessionDate: '2026-11-16', field: 'o' }, live: null }, 'k', 's', fetchFn);
  assertEquals(page, 2);
  assertEquals(p.prices.get('A'), 1);
  assertEquals(p.prices.get('B'), 2);
});

// ── no price -> nothing written -> a retry heals it ─────────────────────────

Deno.test('no bar and no trade: the league writes nothing, and the retry (or Tuesday heal) prices it from the bar', async () => {
  const holdings = new Map<string, Holding[]>([
    ['u1', [{ symbol: 'AAPL', quantity: 3 }]],
    ['u2', [{ symbol: 'TM', quantity: 5 }]],
  ]);
  const req = { symbols: ['AAPL', 'TM'], bar: { sessionDate: '2026-11-16', field: 'o' as const }, live: WINDOW };

  // Monday 14:35Z: TM has no bar, no trade, only an ask.
  const first = await fetchWeekPrices(req, 'k', 's', fakeAlpaca(MONDAY).fetchFn);
  const run1 = buildPricedRows('L', 1, holdings, first.prices);
  assertEquals(run1.missingSymbols, ['TM'], 'TM is unpriced, so the league aborts and writes nothing');

  // The retry (14:40Z) or Tuesday's heal (live: null): TM has printed, its bar exists.
  const later: FakeAlpaca = { ...MONDAY, bars: { AAPL: [{ o: 228.1, c: 229 }], TM: [{ o: 212.44, c: 211.9 }] } };
  const tuesday = await fetchWeekPrices({ ...req, live: null }, 'k', 's', fakeAlpaca(later).fetchFn);
  const run2 = buildPricedRows('L', 1, holdings, tuesday.prices);
  assertEquals(run2.missingSymbols, []);
  const tm = run2.rows.find((r) => r.symbol === 'TM')!;
  assertEquals(tm.week_start_price, 212.44, 'the healed row carries the official open, not the 247.75 ask');
  assertEquals(tuesday.sources.get('TM'), 'bar_open');
});

// ── step 5: the previous real close ─────────────────────────────────────────

// Sessions around Mon 2026-11-16, with a holiday gap (Thu 2026-11-12 closed, for
// the test) so "N sessions" is visibly not "N calendar days".
const SESSIONS = ['2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-13', '2026-11-16', '2026-11-17']
  .map((sessionDate) => ({ sessionDate }));
const RANGE = { fromDate: '2026-11-06', toDate: '2026-11-13' }; // the 5 sessions before 11-16
const dayBar = (date: string, c: number) => ({ t: `${date}T05:00:00Z`, o: c - 1, c });

Deno.test('prevCloseRange: the N sessions strictly before the session, counted on the calendar', () => {
  assertEquals(PREV_CLOSE_MAX_SESSIONS, 5);
  assertEquals(prevCloseRange(SESSIONS, '2026-11-16'), RANGE, '5 sessions, the holiday skipped, the session itself excluded');
  assertEquals(prevCloseRange(SESSIONS, '2026-11-16', { maxSessions: 1 }), { fromDate: '2026-11-13', toDate: '2026-11-13' });
  // Week end (close session Fri 11-13, week opened Mon 11-09): never before the open.
  assertEquals(prevCloseRange(SESSIONS, '2026-11-13', { notBeforeDate: '2026-11-09' }), { fromDate: '2026-11-09', toDate: '2026-11-11' });
  // A one-session week, or a calendar that does not reach back: step 5 off.
  assertEquals(prevCloseRange(SESSIONS, '2026-11-09', { notBeforeDate: '2026-11-09' }), null);
  assertEquals(prevCloseRange(SESSIONS, '2026-11-05'), null);
  assertEquals(prevCloseRange([], '2026-11-16'), null);
});

Deno.test('prevClosePrice: the LATEST real close inside the range, with its date', () => {
  const bars = [dayBar('2026-11-10', 210), dayBar('2026-11-13', 212.1), dayBar('2026-11-11', 211)];
  assertEquals(prevClosePrice(bars, RANGE), { price: 212.1, date: '2026-11-13' });
  // Outside the range (too old, or the session itself) is not a previous close.
  assertEquals(prevClosePrice([dayBar('2026-11-04', 200)], RANGE), null, 'older than the look-back: no price');
  assertEquals(prevClosePrice([dayBar('2026-11-16', 200)], RANGE), null, "the session's own bar is step 1, not step 5");
  assertEquals(prevClosePrice([{ c: 5 }], RANGE), null, 'an undated bar cannot be placed');
  assertEquals(prevClosePrice([dayBar('2026-11-13', 0)], RANGE), null);
  assertEquals(prevClosePrice(undefined, RANGE), null);
  // EDT bars are stamped 04:00Z: still their own date.
  assertEquals(prevClosePrice([{ t: '2026-11-06T04:00:00Z', c: 7 }], RANGE), { price: 7, date: '2026-11-06' });
});

const CLOSE = { failed: false as const, close: { price: 212.1, date: '2026-11-13' } };

Deno.test('resolvePrice: step 5 prices only after steps 1-4 cleanly found nothing', () => {
  // TM, 2026-11-16: no bar, no trade, ask only -> the previous close.
  const live = { window: WINDOW, trade: undefined, quote: { ap: 247.75, as: 1, t: IN } };
  assertEquals(
    resolvePrice({ bar: null, barSource: 'bar_open', live, prevClose: CLOSE }),
    { price: 212.1, source: 'prev_close', closeDate: '2026-11-13' },
  );
  // Every clean "no price" reason from steps 1-4 reaches it.
  const clean: Array<[string, Parameters<typeof resolvePrice>[0]['live']]> = [
    ['no_bar_no_live', null],
    ['no_data', { window: WINDOW, trade: undefined, quote: undefined }],
    ['stale_trade', { window: WINDOW, trade: { p: 205, t: BEFORE }, quote: undefined }],
    ['stale_quote', { window: WINDOW, trade: undefined, quote: { bp: 10, bs: 1, ap: 10.1, as: 1, t: BEFORE } }],
    ['bid_only', { window: WINDOW, trade: undefined, quote: { bp: 10, bs: 1, t: IN } }],
    ['crossed', { window: WINDOW, trade: undefined, quote: { bp: 10.2, bs: 1, ap: 10.1, as: 1, t: IN } }],
    ['wide_spread', { window: WINDOW, trade: undefined, quote: { bp: 39.16, bs: 1, ap: 44.27, as: 1, t: IN } }],
  ];
  for (const [reason, l] of clean) {
    assertEquals(resolvePrice({ bar: null, barSource: 'bar_open', live: l }), { price: null, reason: reason as UnpricedReason }, `${reason} without step 5`);
    assertEquals(resolvePrice({ bar: null, barSource: 'bar_open', live: l, prevClose: CLOSE }).price, 212.1, `${reason} -> step 5`);
  }
});

Deno.test('resolvePrice: steps 1-3 still win over step 5', () => {
  assertEquals(resolvePrice({ bar: 212.44, barSource: 'bar_open', live: null, prevClose: CLOSE }), { price: 212.44, source: 'bar_open' });
  const t = resolvePrice({ bar: null, barSource: 'bar_open', live: { window: WINDOW, trade: { p: 212.6, t: IN }, quote: undefined }, prevClose: CLOSE });
  assertEquals(t, { price: 212.6, source: 'last_trade' });
  const m = resolvePrice({ bar: null, barSource: 'bar_open', live: { window: WINDOW, trade: undefined, quote: { bp: 212.3, bs: 1, ap: 212.5, as: 1, t: IN } }, prevClose: CLOSE });
  assertEquals(m.price !== null && m.source, 'midpoint');
});

Deno.test('resolvePrice: a FAILED fetch at any step never reaches step 5', () => {
  const live = { window: WINDOW, trade: undefined, quote: undefined };
  assertEquals(resolvePrice({ bar: null, barSource: 'bar_open', barFailed: true, live, prevClose: CLOSE }), { price: null, reason: 'bar_fetch_failed' });
  assertEquals(resolvePrice({ bar: null, barSource: 'bar_open', live: { ...live, tradeFailed: true }, prevClose: CLOSE }), { price: null, reason: 'trade_fetch_failed' });
  assertEquals(resolvePrice({ bar: null, barSource: 'bar_open', live: { ...live, quoteFailed: true }, prevClose: CLOSE }), { price: null, reason: 'quote_fetch_failed' });
  // A failed trade fetch does not drop to the midpoint either: the trade may exist.
  const q = { bp: 212.3, bs: 1, ap: 212.5, as: 1, t: IN };
  assertEquals(resolvePrice({ bar: null, barSource: 'bar_open', live: { ...live, quote: q, tradeFailed: true } }), { price: null, reason: 'trade_fetch_failed' });
});

Deno.test('resolvePrice: step 5 itself failed, empty, or off', () => {
  const live = { window: WINDOW, trade: undefined, quote: { ap: 247.75, as: 1, t: IN } };
  assertEquals(resolvePrice({ bar: null, barSource: 'bar_open', live, prevClose: { failed: true } }), { price: null, reason: 'prev_close_fetch_failed' });
  assertEquals(resolvePrice({ bar: null, barSource: 'bar_open', live, prevClose: { failed: false, close: null } }), { price: null, reason: 'no_recent_close' });
  assertEquals(resolvePrice({ bar: null, barSource: 'bar_open', live, prevClose: null }), { price: null, reason: 'ask_only' }, 'off: the old reason');
});

Deno.test('prevCloseAllowed: the last attempt, or a past session; never before', () => {
  assertEquals(prevCloseAllowed(1, 3, WINDOW), false, '14:35Z: wait for the real open');
  assertEquals(prevCloseAllowed(2, 3, WINDOW), false);
  assertEquals(prevCloseAllowed(3, 3, WINDOW), true, '14:45Z, the last attempt');
  assertEquals(prevCloseAllowed(1, 3, null), true, 'a heal of a past session cannot do better by waiting');
  assertEquals(prevCloseAllowed(Number.NaN, 3, WINDOW), false, 'a garbled attempt header is not the last attempt');
});

Deno.test('scoringPriceBounds: from the week onward, step 5 over the week through today', () => {
  const b = scoringPriceBounds('2026-11-10T14:30:00.000Z', new Date('2026-11-13T21:15:00Z'));
  assertEquals(b, { live: { fromMs: Date.parse('2026-11-10T14:30:00.000Z') }, prevClose: { fromDate: '2026-11-10', toDate: '2026-11-13' } });
  assertEquals(scoringPriceBounds(null, new Date()), { live: {}, prevClose: null }, 'no week start: the old open window, step 5 off');
  assertEquals(scoringPriceBounds('junk', new Date()), { live: {}, prevClose: null });
});

// ── step 5 through the IO ───────────────────────────────────────────────────

interface FakeAlpaca5 extends FakeAlpaca {
  prevBars?: Record<string, unknown[]>;
  failPrev?: number;
  failTrades?: number;
  failQuotes?: number;
  tradesBody?: unknown;
}

/** Bars for a one-day request are the session bar; a range request is step 5. */
function fakeAlpaca5(data: FakeAlpaca5): { fetchFn: FetchFn; calls: string[] } {
  const calls: string[] = [];
  const pick = (u: URL, src: Record<string, unknown> | undefined) => {
    const out: Record<string, unknown> = {};
    for (const s of (u.searchParams.get('symbols') ?? '').split(',')) if (src && s in src) out[s] = src[s];
    return out;
  };
  const fetchFn: FetchFn = (url) => {
    calls.push(url);
    const u = new URL(url);
    if (u.pathname.endsWith('/stocks/bars')) {
      const range = u.searchParams.get('start') !== u.searchParams.get('end');
      if (range) {
        if (data.failPrev) return Promise.resolve(new Response('nope', { status: data.failPrev }));
        return Promise.resolve(Response.json({ bars: pick(u, data.prevBars), next_page_token: null }));
      }
      return Promise.resolve(Response.json({ bars: pick(u, data.bars), next_page_token: null }));
    }
    if (u.pathname.endsWith('/trades/latest')) {
      if (data.failTrades) return Promise.resolve(new Response('nope', { status: data.failTrades }));
      if (data.tradesBody !== undefined) return Promise.resolve(Response.json(data.tradesBody));
      return Promise.resolve(Response.json({ trades: pick(u, data.trades) }));
    }
    if (u.pathname.endsWith('/quotes/latest')) {
      if (data.failQuotes) return Promise.resolve(new Response('nope', { status: data.failQuotes }));
      return Promise.resolve(Response.json({ quotes: pick(u, data.quotes) }));
    }
    return Promise.resolve(new Response('unexpected', { status: 404 }));
  };
  return { fetchFn, calls };
}

const req5 = (symbols: string[], prevClose: typeof RANGE | null = RANGE) =>
  ({ symbols, bar: { sessionDate: '2026-11-16', field: 'o' as const }, live: WINDOW, prevClose });

Deno.test('fetchWeekPrices step 5: asked only for what steps 1-4 left cleanly unpriced, over the range, and logged with its date', async () => {
  const { fetchFn, calls } = fakeAlpaca5({
    ...MONDAY,
    prevBars: { TM: [dayBar('2026-11-12', 210), dayBar('2026-11-13', 212.1)], AVAL: [dayBar('2026-10-30', 4.0)] },
  });
  const p = await fetchWeekPrices(req5(['AAPL', 'TM', 'KB', 'BCH', 'AVAL']), 'k', 's', fetchFn);
  assertEquals(p.sources.get('AAPL'), 'bar_open');
  assertEquals(p.sources.get('KB'), 'last_trade');
  assertEquals(p.sources.get('BCH'), 'midpoint');
  assertEquals(p.prices.get('TM'), 212.1, 'the ask-only name gets its last real close, not the 247.75 ask');
  assertEquals(p.sources.get('TM'), 'prev_close');
  assertEquals(p.closeDates.get('TM'), '2026-11-13');
  assertEquals(p.unpriced.get('AVAL'), 'no_recent_close', 'a close older than the look-back is not a price');
  assertEquals(p.prices.size + p.unpriced.size, 5);

  const prevCall = new URL(calls.find((c) => new URL(c).searchParams.get('start') === RANGE.fromDate)!);
  assertEquals(prevCall.searchParams.get('symbols'), 'TM,AVAL', 'step 5 is asked only about the cleanly unpriced');
  assertEquals(prevCall.searchParams.get('end'), RANGE.toDate);
  assertEquals(prevCall.searchParams.get('timeframe'), '1Day');

  const log = describeWeekPrices(p);
  assert(log.includes('TM=prev_close@212.1(2026-11-13)'), log);
  assert(log.includes('AVAL:no_recent_close'), log);
  assert(log.includes('"prevClose":"2026-11-06..2026-11-13"'), log);
  assert(log.includes('"prev_close":1'), log);
});

Deno.test('fetchWeekPrices step 5 off (prevClose null): no range request, the old reasons', async () => {
  const { fetchFn, calls } = fakeAlpaca5({ ...MONDAY, prevBars: { TM: [dayBar('2026-11-13', 212.1)] } });
  const p = await fetchWeekPrices(req5(['TM'], null), 'k', 's', fetchFn);
  assertEquals(p.unpriced.get('TM'), 'ask_only');
  assert(!calls.some((c) => new URL(c).searchParams.get('start') !== new URL(c).searchParams.get('end')));
  assert(describeWeekPrices(p).includes('"prevClose":"off"'));
});

Deno.test('fetchWeekPrices: a FAILED trades request never reaches the quote or step 5', async () => {
  const { fetchFn, calls } = fakeAlpaca5({ ...MONDAY, failTrades: 401, prevBars: { TM: [dayBar('2026-11-13', 212.1)], KB: [dayBar('2026-11-13', 100)] } });
  const p = await fetchWeekPrices(req5(['AAPL', 'TM', 'KB']), 'k', 's', fetchFn);
  assertEquals(p.prices.get('AAPL'), 228.1, 'the bar still prices');
  assertEquals(p.unpriced.get('TM'), 'trade_fetch_failed', 'a 401 is not "no trade"');
  assertEquals(p.unpriced.get('KB'), 'trade_fetch_failed');
  assert(!calls.some((c) => c.includes('/quotes/latest')));
  assert(!calls.some((c) => new URL(c).searchParams.get('start') === RANGE.fromDate), 'no step 5 request at all');
  assert(p.errors.some((e) => e.startsWith('trades/latest 401')));
});

Deno.test('fetchWeekPrices: a 200 with a malformed trades body is a failure, not "no trade"', async () => {
  const { fetchFn } = fakeAlpaca5({ ...MONDAY, tradesBody: { trades: 'oops' }, prevBars: { TM: [dayBar('2026-11-13', 212.1)] } });
  const p = await fetchWeekPrices(req5(['TM']), 'k', 's', fetchFn);
  assertEquals(p.unpriced.get('TM'), 'trade_fetch_failed');
});

Deno.test('fetchWeekPrices: a FAILED quotes request never reaches step 5', async () => {
  const { fetchFn, calls } = fakeAlpaca5({ ...MONDAY, failQuotes: 503, prevBars: { TM: [dayBar('2026-11-13', 212.1)] } });
  const p = await fetchWeekPrices(req5(['TM', 'KB']), 'k', 's', fetchFn);
  assertEquals(p.sources.get('KB'), 'last_trade', 'the trade step still prices');
  assertEquals(p.unpriced.get('TM'), 'quote_fetch_failed');
  assert(!calls.some((c) => new URL(c).searchParams.get('start') === RANGE.fromDate));
});

Deno.test('fetchWeekPrices: a FAILED bar request never reaches step 5', async () => {
  const { fetchFn, calls } = fakeAlpaca5({ ...MONDAY, prevBars: { TM: [dayBar('2026-11-13', 212.1)] } });
  const failing: FetchFn = (url, init) => {
    const u = new URL(url);
    if (u.pathname.endsWith('/stocks/bars') && u.searchParams.get('start') === u.searchParams.get('end')) {
      calls.push(url);
      return Promise.resolve(new Response('busy', { status: 429 }));
    }
    return fetchFn(url, init);
  };
  const p = await fetchWeekPrices(req5(['TM']), 'k', 's', failing);
  assertEquals(p.unpriced.get('TM'), 'bar_fetch_failed');
  assertEquals(calls.length, 1, 'no live call and no step 5 call');
});

Deno.test('fetchWeekPrices: step 5 request FAILED -> prev_close_fetch_failed, the league retries', async () => {
  const { fetchFn } = fakeAlpaca5({ ...MONDAY, failPrev: 500 });
  const p = await fetchWeekPrices(req5(['AAPL', 'TM']), 'k', 's', fetchFn);
  assertEquals(p.prices.get('AAPL'), 228.1);
  assertEquals(p.unpriced.get('TM'), 'prev_close_fetch_failed');
  assert(p.errors.some((e) => e.startsWith('prev_close bars 500')));
});

Deno.test('week start, end to end: the last attempt baselines the ask-only name from its last close; the league is complete', async () => {
  const holdings = new Map<string, Holding[]>([
    ['u1', [{ symbol: 'AAPL', quantity: 3 }]],
    ['u2', [{ symbol: 'TM', quantity: 5 }]],
  ]);
  const alpaca = fakeAlpaca5({ ...MONDAY, prevBars: { TM: [dayBar('2026-11-13', 212.1)] } });
  // Attempt 1 (14:35Z): step 5 not yet allowed -> the league aborts, as before.
  const a1 = await fetchWeekPrices({ ...req5(['AAPL', 'TM']), prevClose: prevCloseAllowed(1, 3, WINDOW) ? RANGE : null }, 'k', 's', alpaca.fetchFn);
  assertEquals(buildPricedRows('L', 1, holdings, a1.prices).missingSymbols, ['TM']);
  // Attempt 3 (14:45Z): still no IEX print -> Friday's close, and every participant is written.
  const a3 = await fetchWeekPrices({ ...req5(['AAPL', 'TM']), prevClose: prevCloseAllowed(3, 3, WINDOW) ? RANGE : null }, 'k', 's', alpaca.fetchFn);
  const run = buildPricedRows('L', 1, holdings, a3.prices);
  assertEquals(run.missingSymbols, []);
  assertEquals(run.rows.find((r) => r.symbol === 'TM')!.week_start_price, 212.1);
  assertEquals(run.rows.length, 2);
});

// ---------------------------------------------------------------------------
// scoringPriceRequest: the one price request process-week-results sends. Kills
// the Orchestrator's M9 (`...bounds` -> `live: bounds.live`, which takes step 5
// out of scoring entirely).
// ---------------------------------------------------------------------------

Deno.test('scoringPriceRequest: no bar, a live window from the week start, and step 5 over the week (kills M9)', () => {
  assertEquals(scoringPriceRequest(new Set(['AAPL', 'TM']), '2026-11-16T14:30:00Z', new Date('2026-11-20T21:15:00Z')), {
    symbols: ['AAPL', 'TM'],
    bar: null,
    live: { fromMs: Date.parse('2026-11-16T14:30:00Z') },
    prevClose: { fromDate: '2026-11-16', toDate: '2026-11-20' },
  });
});

Deno.test('scoringPriceRequest: an unreadable week start -> the open window, step 5 off', () => {
  assertEquals(scoringPriceRequest(['AAPL'], null, new Date('2026-11-20T21:15:00Z')), {
    symbols: ['AAPL'], bar: null, live: {}, prevClose: null,
  });
});

Deno.test('scoringPriceRequest end to end: a held stock with no trade and no midpoint this week is scored from this week\'s close, never last week\'s', async () => {
  const { fetchFn } = fakeAlpaca5({
    bars: {},
    trades: {},
    quotes: {},
    prevBars: { TM: [dayBar('2026-11-13', 199), dayBar('2026-11-18', 212.1)], OLD: [dayBar('2026-11-13', 50)] },
  });
  const p = await fetchWeekPrices(
    scoringPriceRequest(['TM', 'OLD'], '2026-11-16T14:30:00Z', new Date('2026-11-20T21:15:00Z')), 'k', 's', fetchFn,
  );
  assertEquals(p.prices.get('TM'), 212.1);
  assertEquals(p.sources.get('TM'), 'prev_close');
  assertEquals(p.closeDates.get('TM'), '2026-11-18');
  assertEquals(p.prices.has('OLD'), false, 'a close from before the week is never used');
  assertEquals(p.unpriced.get('OLD'), 'no_recent_close');
});
