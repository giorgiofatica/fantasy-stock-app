/**
 * Hermetic tests for the week price rule (./week-price.ts): bar, else a trade in
 * the window, else a sane two-sided midpoint, else no price. Never an ask or a
 * bid alone. Alpaca is a fake fetch; no network, no env.
 *
 *   deno test supabase/functions/_shared/week-price.test.ts
 */

import { assert, assertEquals } from 'jsr:@std/assert';
import {
  MAX_MID_SPREAD_FRACTION,
  alpacaTimeMs,
  barPrice,
  describeWeekPrices,
  fetchWeekPrices,
  liveWindowFor,
  midpointPrice,
  resolvePrice,
  tradePrice,
  type FetchFn,
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
