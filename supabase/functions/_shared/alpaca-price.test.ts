/**
 * Hermetic tests for fetchFillPrice: the ONE price chain a fill pays and a quote
 * shows (2026-11-17). fetch is faked; nothing leaves the process.
 *
 * Run: deno test --allow-read supabase/functions/_shared/alpaca-price.test.ts
 */
import { assertEquals } from 'jsr:@std/assert';
import { FILL_CLOSE_LOOKBACK_DAYS, fetchFillPrice, fillCloseStart, latestDailyClose } from './alpaca-price.ts';

const NOW = new Date('2026-11-17T15:00:00Z');
const START = '2026-11-07'; // NOW - 10 days
const T = '2026-11-17T14:59:00Z';

type Route = 'trade' | 'bar' | 'quote' | 'close';
type Answer = unknown | { status: number; body?: string } | Error;

function routeOf(url: string): Route {
  if (url.includes('/trades/latest')) return 'trade';
  if (url.includes('/bars/latest')) return 'bar';
  if (url.includes('/quotes/latest')) return 'quote';
  if (url.includes('/bars?')) return 'close';
  throw new Error(`unexpected url ${url}`);
}

/** Fake Alpaca: each route answers a JSON body, an HTTP failure, or throws. Records the route order and URLs. */
async function run(answers: Partial<Record<Route, Answer>>, symbol = 'TM') {
  const calls: Route[] = [];
  const urls: string[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    const r = routeOf(url);
    calls.push(r);
    urls.push(url);
    const a = answers[r] ?? {};
    if (a instanceof Error) return Promise.reject(a);
    if (a && typeof a === 'object' && 'status' in a && typeof (a as { status: unknown }).status === 'number') {
      const f = a as { status: number; body?: string };
      return Promise.resolve(new Response(f.body ?? 'vendor error', { status: f.status }));
    }
    return Promise.resolve(new Response(JSON.stringify(a), { status: 200 }));
  }) as typeof fetch;
  try {
    const out = await fetchFillPrice(symbol, 'k', 's', NOW);
    return { out, calls, urls };
  } finally {
    globalThis.fetch = real;
  }
}

const quote = (q: Record<string, unknown>) => ({ quote: { t: T, ...q } });
const daily = (...bars: Array<[string, number]>) => ({ bars: bars.map(([d, c]) => ({ t: `${d}T05:00:00Z`, o: c, h: c, l: c, c, v: 1 })) });

// ── stage order (stages 1 and 2 unchanged: HELD) ───────────────────────────────

Deno.test('order: a trade wins and nothing else is asked', async () => {
  const { out, calls } = await run({ trade: { trade: { p: 212.1 } }, bar: { bar: { c: 1 } } });
  assertEquals(out, { price: 212.1, source: 'trade.p' });
  assertEquals(calls, ['trade']);
});

Deno.test('order: no trade -> the latest bar close, before any quote', async () => {
  const { out, calls } = await run({ bar: { bar: { c: 211.9 } }, quote: quote({ bp: 1, bs: 1, ap: 1.01, as: 1 }) });
  assertEquals(out, { price: 211.9, source: 'bar.c' });
  assertEquals(calls, ['trade', 'bar']);
});

Deno.test('order: trade, bar, quote, then the daily close, each once', async () => {
  const { out, calls } = await run({ close: daily(['2026-11-14', 212]) });
  assertEquals(out, { price: 212, source: 'bar1d.c' });
  assertEquals(calls, ['trade', 'bar', 'quote', 'close']);
});

Deno.test('order: an old trade (no window) still wins: stages 1-2 have no time window (HELD)', async () => {
  const { out } = await run({ trade: { trade: { p: 50, t: '2025-01-02T15:00:00Z' } }, close: daily(['2026-11-14', 212]) });
  assertEquals(out, { price: 50, source: 'trade.p' });
});

// ── a lone side is NEVER a price ───────────────────────────────────────────────

Deno.test('lone side: the 2026-11-16 TM case (ask 247.75 alone) is not a price; the last close is', async () => {
  const { out } = await run({ quote: quote({ ap: 247.75, as: 100 }), close: daily(['2026-11-14', 212]) });
  assertEquals(out, { price: 212, source: 'bar1d.c' });
});

Deno.test('lone side: a bid alone is not a price either', async () => {
  const { out } = await run({ quote: quote({ bp: 199, bs: 100 }), close: daily(['2026-11-14', 212]) });
  assertEquals(out, { price: 212, source: 'bar1d.c' });
});

Deno.test('lone side: with no daily close, a lone ask or bid gives NO price (the no_price refusal)', async () => {
  for (const q of [{ ap: 247.75, as: 100 }, { bp: 199, bs: 100 }, { ap: 247.75, as: 100, bp: 0, bs: 0 }]) {
    const { out } = await run({ quote: quote(q) });
    assertEquals(out, { price: null, source: '', error: null }, JSON.stringify(q));
  }
});

Deno.test('lone side: a side with zero size does not count as a side', async () => {
  const { out } = await run({ quote: quote({ bp: 99.9, bs: 0, ap: 100.1, as: 100 }) });
  assertEquals(out.price, null);
});

// ── the midpoint band ──────────────────────────────────────────────────────────

Deno.test('midpoint: a tight two-sided quote prices at the midpoint', async () => {
  const { out, calls } = await run({ quote: quote({ bp: 211.9, bs: 3, ap: 212.1, as: 2 }) });
  assertEquals(out, { price: 212, source: 'quote.mid' });
  assertEquals(calls, ['trade', 'bar', 'quote']);
});

Deno.test('midpoint: a spread of exactly 2% is accepted, just over it is not', async () => {
  const at = await run({ quote: quote({ bp: 99, bs: 1, ap: 101, as: 1 }) });
  assertEquals(at.out, { price: 100, source: 'quote.mid' });
  const over = await run({ quote: quote({ bp: 98.99, bs: 1, ap: 101.01, as: 1 }), close: daily(['2026-11-14', 100.5]) });
  assertEquals(over.out, { price: 100.5, source: 'bar1d.c' });
});

Deno.test('midpoint: a wide (13%) or crossed quote is refused and falls to the last close', async () => {
  for (const q of [{ bp: 200, bs: 1, ap: 227, as: 1 }, { bp: 213, bs: 1, ap: 212, as: 1 }]) {
    const { out } = await run({ quote: quote(q), close: daily(['2026-11-14', 212]) });
    assertEquals(out, { price: 212, source: 'bar1d.c' }, JSON.stringify(q));
  }
});

Deno.test('midpoint: an undated quote cannot be placed in time and does not price', async () => {
  const { out } = await run({ quote: { quote: { bp: 211.9, bs: 3, ap: 212.1, as: 2 } } });
  assertEquals(out.price, null);
});

// ── the last daily close ───────────────────────────────────────────────────────

Deno.test('close: the request is a 1Day bar look-back from now - FILL_CLOSE_LOOKBACK_DAYS on the IEX feed', async () => {
  assertEquals(FILL_CLOSE_LOOKBACK_DAYS, 10);
  assertEquals(fillCloseStart(NOW), START);
  const { urls } = await run({}, 'brk.b');
  const u = new URL(urls[3]);
  assertEquals(u.pathname, '/v2/stocks/BRK.B/bars');
  assertEquals([u.searchParams.get('timeframe'), u.searchParams.get('start'), u.searchParams.get('feed')], ['1Day', START, 'iex']);
});

Deno.test('close: the LATEST-dated bar wins whatever order Alpaca returns them in', async () => {
  // The latest bar is neither first nor last, so "take the first" and "take the last" both fail.
  const { out } = await run({ close: daily(['2026-11-10', 205], ['2026-11-14', 212], ['2026-11-13', 209]) });
  assertEquals(out, { price: 212, source: 'bar1d.c' });
});

Deno.test('latestDailyClose: skips undated, zero, non-numeric and pre-look-back bars; empty -> null', () => {
  assertEquals(latestDailyClose(undefined, START), null);
  assertEquals(latestDailyClose([], START), null);
  assertEquals(latestDailyClose([{ c: 5 }], START), null);
  assertEquals(latestDailyClose([{ t: '2026-11-14T05:00:00Z', c: 0 }], START), null);
  assertEquals(latestDailyClose([{ t: '2026-11-14T05:00:00Z', c: 'x' }], START), null);
  assertEquals(latestDailyClose([{ t: '2026-11-06T05:00:00Z', c: 9 }], START), null);
  assertEquals(latestDailyClose([{ t: '2026-11-07T05:00:00Z', c: 9 }], START), 9);
  assertEquals(latestDailyClose([{ t: '2026-11-14T05:00:00Z', c: 0 }, { t: '2026-11-13T05:00:00Z', c: 8 }], START), 8);
});

// ── a failed stage is never a price ────────────────────────────────────────────

Deno.test('failure: a failed quote stage moves on to the close (status recorded, no throw)', async () => {
  const { out } = await run({ quote: { status: 500, body: JSON.stringify({ quote: { ap: 247.75 } }) }, close: daily(['2026-11-14', 212]) });
  assertEquals(out, { price: 212, source: 'bar1d.c' });
});

Deno.test('failure: a failed or timed-out close stage is no price, with its step and status', async () => {
  const http = await run({ quote: quote({ ap: 247.75, as: 1 }), close: { status: 503 } });
  assertEquals(http.out, { price: null, source: '', error: { step: 'close', status: 503 } });
  const timeout = await run({ close: new DOMException('timed out', 'TimeoutError') as unknown as Error });
  assertEquals(timeout.out, { price: null, source: '', error: { step: 'close', status: 0 } });
});

Deno.test('failure: every stage failing is price null, never a throw', async () => {
  const boom = new TypeError('network down');
  const { out, calls } = await run({ trade: boom, bar: boom, quote: boom, close: boom });
  assertEquals(out, { price: null, source: '', error: { step: 'close', status: 0 } });
  assertEquals(calls, ['trade', 'bar', 'quote', 'close']);
});
