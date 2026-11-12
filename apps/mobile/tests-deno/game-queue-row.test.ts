/**
 * The pre-draft queue row (Giorgio, 2026-11-05, option A; docs/PRODUCT_RULES.md "The queue row"):
 * the ticker over the company name, the price on the ticker's line; the ticker never cut; the price the draft
 * search's latest trade, "–" when missing, never "$0.00", never a stored price; one closed-market line.
 *
 * The pure rules (lib/game/queueRow.ts) are tested by value; the layout rules that React Native's layout engine
 * enforces (a ticker that can't shrink on a line that wraps) are pinned in the source, and shown in the
 * simulator captures (build/queue-row-a in the shared design-review folder).
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  NO_PRICE,
  QUEUE_ROW_TEXT_MAX_SCALE,
  namesFromRows,
  priceCell,
  answersFromBatch,
  priceLabel,
  pricesClosedLine,
  rowLabel,
  symbolsToRead,
  usablePrice,
} from '../lib/game/queueRow.ts';
import { BATCH_SIZE, FAIL_TTL_MS, PRICE_LANES, PRICE_TTL_MS, createPriceStore } from '../lib/game/queuePriceStore.ts';
import { invokeFixtureFor, symbolsBatchFixture, symbolsSearchFixture } from '../lib/game/seamFixtures.ts';
import { SOURCES } from './sourceManifest.generated.ts';

/** Source without comments, so a guard never passes on a comment that names the thing. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
}

// ── The price: "–" when missing, never "$0.00", never a blank ───────────────────

Deno.test('priceLabel: a real price is dollars and cents', () => {
  assertEquals(priceLabel(186.42), '$186.42');
  assertEquals(priceLabel(918.3), '$918.30');
  assertEquals(priceLabel(1234.5), '$1,234.50');
  assertEquals(priceLabel(0.01), '$0.01');
});

Deno.test('priceLabel: missing is a dash, never $0.00 and never a blank', () => {
  for (const missing of [null, undefined, 0, -0, -3.2, Number.NaN, Infinity, -Infinity, 0.004, 0.0049]) {
    const label = priceLabel(missing as number | null | undefined);
    assertEquals(label, '–', String(missing));
    assert(label !== '' && !label.includes('0.00'), String(missing));
  }
  assertEquals(NO_PRICE, '–');
});

Deno.test('usablePrice: only a number worth at least a cent', () => {
  assert(usablePrice(0.01));
  assert(usablePrice(512.18));
  for (const bad of [null, undefined, 0, -1, Number.NaN, Infinity, '186.42', {}, [], 0.004]) assert(!usablePrice(bad), String(bad));
});

Deno.test('priceCell: a placeholder while it loads, then the label', () => {
  assertEquals(priceCell(undefined), { kind: 'loading' });
  assertEquals(priceCell({ status: 'loading' }), { kind: 'loading' });
  assertEquals(priceCell({ status: 'ready', price: 186.42 }), { kind: 'text', text: '$186.42' });
  assertEquals(priceCell({ status: 'ready', price: null }), { kind: 'text', text: '–' });
  assertEquals(priceCell({ status: 'ready', price: 0 }), { kind: 'text', text: '–' });
});

// ── The price is the batch's number, for the asked symbol only (symbols-search { symbols }) ──────────────────────

Deno.test('answersFromBatch: a batch maps to one clean answer per asked ticker', () => {
  const data = { prices: { NVDA: 186.42, 'BRK.B': 498.75, RKLB: null }, failed: [], invalid: [] };
  assertEquals(answersFromBatch(data, ['NVDA', 'BRK.B', 'RKLB']), {
    NVDA: { ok: true, price: 186.42 },
    'BRK.B': { ok: true, price: 498.75 },
    RKLB: { ok: true, price: null }, // a clean "no trade": an answer, not a failure
  });
  // Case never matters, on either side.
  assertEquals(answersFromBatch({ prices: { nvda: 186.42 }, failed: [], invalid: [] }, ['NVDA']), { NVDA: { ok: true, price: 186.42 } });
  assertEquals(answersFromBatch(data, ['nvda']), { NVDA: { ok: true, price: 186.42 } });
});

Deno.test('answersFromBatch: `failed` is a FAILED read, never an answer, even if `prices` also names it', () => {
  const data = { prices: { NVDA: 186.42, AAPL: 190 }, failed: ['aapl', 'RKLB'], invalid: [] };
  assertEquals(answersFromBatch(data, ['NVDA', 'AAPL', 'RKLB']), {
    NVDA: { ok: true, price: 186.42 },
    AAPL: { ok: false },
    RKLB: { ok: false },
  });
});

Deno.test('answersFromBatch: `invalid` is a clean "–" (asking again would answer the same)', () => {
  assertEquals(answersFromBatch({ prices: {}, failed: [], invalid: ['ABC123'] }, ['ABC123']), { ABC123: { ok: true, price: null } });
  assertEquals(priceLabel(null), '–');
});

Deno.test('answersFromBatch: a zero, negative or non-number price is "–" (an answer), never "$0.00"', () => {
  const r = answersFromBatch({ prices: { A: 0, B: -3, C: '5', D: 0.004 }, failed: [], invalid: [] }, ['A', 'B', 'C', 'D']);
  for (const s of ['A', 'B', 'C', 'D']) assertEquals(r[s], { ok: true, price: null }, s);
});

Deno.test('answersFromBatch: a symbol the response is silent about, or a response we cannot read, is a failed read', () => {
  assertEquals(answersFromBatch({ prices: { NVDA: 1 }, failed: [], invalid: [] }, ['NVDA', 'MSFT']), { NVDA: { ok: true, price: 1 }, MSFT: { ok: false } });
  for (const odd of [null, undefined, 'x', 7, [], {}, { prices: 'nope' }, { prices: [1] }]) {
    assertEquals(answersFromBatch(odd, ['RKLB']), { RKLB: { ok: false } });
  }
  // Odd entries in failed / invalid never throw and never clear anything.
  assertEquals(answersFromBatch({ prices: { A: 1 }, failed: [3, null], invalid: 'x' }, ['A']), { A: { ok: true, price: 1 } });
});

Deno.test('a neighbour\'s price is never the asked stock\'s: only an exact key counts (no prefix, no name)', () => {
  const data = { prices: { SGA: 5.5, FAST: 44 }, failed: [], invalid: [] };
  assertEquals(answersFromBatch(data, ['SG', 'F']), { SG: { ok: false }, F: { ok: false } });
});

Deno.test('the capture seam answers the way the real batch does: the sample prices, null for a stock with no price or sample, invalid for a non-ticker', () => {
  const r = symbolsBatchFixture({ symbols: ['sbux', 'BRK.B', 'TEM', 'RKLB', 'NOPE', 'sbux', 'ABC123', ' '] });
  assertEquals(r, { prices: { SBUX: 94.6, 'BRK.B': 498.75, TEM: 71.3, RKLB: null, NOPE: null }, failed: [], invalid: ['ABC123'] });
  assertEquals(answersFromBatch(r, ['SBUX', 'RKLB', 'ABC123']), { SBUX: { ok: true, price: 94.6 }, RKLB: { ok: true, price: null }, ABC123: { ok: true, price: null } });
  assertEquals(symbolsBatchFixture({ symbols: [] }), { prices: {}, failed: [], invalid: [] });
  assertEquals(symbolsBatchFixture({}), { prices: {}, failed: [], invalid: [] });
  // The one-search shape is untouched.
  assertEquals(symbolsSearchFixture({ q: 'rklb', limit: 1 }).items.map((i) => i.symbol), ['RKLB']);
});

Deno.test('the seam routes symbols-search by body: `symbols` to the batch fixture, `q` to the one search', () => {
  const batch = invokeFixtureFor('symbols-search', { symbols: ['SBUX', 'RKLB'] });
  assertEquals(batch, { data: { prices: { SBUX: 94.6, RKLB: null }, failed: [], invalid: [] }, error: null });
  const search = invokeFixtureFor('symbols-search', { q: 'rklb', limit: 1 }) as { data: { items: { symbol: string }[] } };
  assertEquals(search.data.items.map((i) => i.symbol), ['RKLB']);
});

// ── Names: one batch ────────────────────────────────────────────────────────────

Deno.test('namesFromRows: by upper-case ticker; a row without a name is left out', () => {
  assertEquals(
    namesFromRows([{ symbol: 'nvda', name: ' NVIDIA Corporation ' }, { symbol: 'RKLB', name: '' }, { symbol: 'X', name: null }, { symbol: 7, name: 'x' }]),
    { NVDA: 'NVIDIA Corporation' },
  );
  assertEquals(namesFromRows(null), {});
  assertEquals(namesFromRows(undefined), {});
});

Deno.test('symbolsToRead: upper-cased, de-duplicated, in queue order, without the ones already known', () => {
  const known = new Set(['MSFT']);
  assertEquals(symbolsToRead(['nvda', 'MSFT', 'NVDA', 'cost', 'brk.b'], known), ['NVDA', 'COST', 'BRK.B']);
  assertEquals(symbolsToRead([], known), []);
  assertEquals(symbolsToRead(['MSFT'], known), []);
});

// ── The closed-market line ──────────────────────────────────────────────────────

Deno.test('pricesClosedLine: the approved copy, the day of the last close', () => {
  // 2026-09-23 16:00 ET (EDT) = 20:00Z, a Wednesday.
  assertEquals(pricesClosedLine('closed', '2026-09-23T20:00:00.000Z'), "Prices at Wednesday's close.");
  assertEquals(pricesClosedLine('closed', '2026-09-21T20:00:00.000Z'), "Prices at Monday's close.");
  assertEquals(pricesClosedLine('closed', '2026-09-25T20:00:00.000Z'), "Prices at Friday's close.");
  // A winter close (EST, 21:00Z) still names its own ET day.
  assertEquals(pricesClosedLine('closed', '2026-12-16T21:00:00.000Z'), "Prices at Wednesday's close.");
});

Deno.test('pricesClosedLine: only a market known to be closed says anything', () => {
  const close = '2026-09-23T20:00:00.000Z';
  for (const status of ['open', 'unknown', null, undefined, '']) assertEquals(pricesClosedLine(status, close), null, String(status));
  assertEquals(pricesClosedLine('closed', null), null);
  assertEquals(pricesClosedLine('closed', undefined), null);
  assertEquals(pricesClosedLine('closed', 'not a date'), null);
});

// ── What VoiceOver reads ────────────────────────────────────────────────────────

Deno.test('rowLabel: ticker, company, price in words; never a spoken dash', () => {
  assertEquals(rowLabel('NVDA', 'NVIDIA Corporation', { status: 'ready', price: 186.42 }), 'NVDA, NVIDIA Corporation, $186.42');
  assertEquals(rowLabel('RKLB', 'Rocket Lab Corporation', { status: 'ready', price: null }), 'RKLB, Rocket Lab Corporation, price unavailable');
  assertEquals(rowLabel('MSFT', undefined, undefined), 'MSFT, price loading');
  assertEquals(rowLabel('MSFT', null, { status: 'ready', price: 512.18 }), 'MSFT, $512.18');
  assert(!rowLabel('RKLB', 'x', { status: 'ready', price: null }).includes('–'));
});

// ── Layout rules the engine enforces: pinned in the source ──────────────────────

const ROW = code(SOURCES['components/game/QueueRow.tsx']);
const EDITOR = code(SOURCES['components/game/QueueEditor.tsx']);
const SEARCH = code(SOURCES['components/SymbolSearchField.tsx']);
const HOOK = code(SOURCES['lib/game/useQueueQuotes.ts']);

/** The body of one entry in a StyleSheet.create({...}) block. */
function style(src: string, name: string): string {
  const m = new RegExp(`\\n\\s*${name}:\\s*\\{([^}]*)\\}`).exec(src);
  assert(m, `style ${name} exists`);
  return m![1];
}

Deno.test('the row\'s text stops growing at 1.3×', () => {
  assertEquals(QUEUE_ROW_TEXT_MAX_SCALE, 1.3);
  // position, ticker, price and company all carry it.
  assertEquals((ROW.match(/maxFontSizeMultiplier=\{QUEUE_ROW_TEXT_MAX_SCALE\}/g) ?? []).length, 4);
});

Deno.test('the ticker is never cut: it cannot shrink, sits on a wrapping line, and has no ellipsis', () => {
  assert(/flexShrink:\s*0/.test(style(ROW, 'sym')), 'the ticker does not shrink');
  assert(/flexWrap:\s*'wrap'/.test(style(ROW, 'tickerLine')), 'the ticker line wraps, so the price drops under the ticker');
  assert(/flexShrink:\s*0/.test(style(ROW, 'price')), 'the price does not shrink either');
  assert(/marginLeft:\s*'auto'/.test(style(ROW, 'price')), 'the price rides the right of the ticker line');
  // Only the company gets "…".
  const ticker = /<Text[^>]*variant="ticker"[^>]*>/.exec(ROW)![0];
  assert(!ticker.includes('ellipsizeMode') && !ticker.includes('adjustsFontSizeToFit'), 'no ellipsis or shrink-to-fit on the ticker');
  const name = /<Text[^>]*testID="queue-row-name"[^>]*>/.exec(ROW)![0];
  assert(name.includes('numberOfLines={1}') && name.includes('ellipsizeMode="tail"'), 'the company ends in …');
  assert(/minWidth:\s*0/.test(style(ROW, 'body')) && /flex:\s*1/.test(style(ROW, 'body')), 'the text column takes the width left of the buttons');
});

Deno.test('the ticker is above the company, the price on the ticker\'s line', () => {
  const tickerLine = ROW.indexOf('style={styles.tickerLine}');
  const ticker = ROW.indexOf('testID="queue-row-ticker"');
  const price = ROW.indexOf('testID="queue-row-price"');
  const name = ROW.indexOf('testID="queue-row-name"');
  assert(tickerLine > 0 && tickerLine < ticker && ticker < price && price < name, 'ticker, then price, then the company');
});

Deno.test('buttons: 44 pt each, up / down / remove as before, a move that cannot happen is not drawn', () => {
  assert(/minWidth:\s*44/.test(style(ROW, 'hit')) && /minHeight:\s*44/.test(style(ROW, 'hit')));
  for (const label of ['Move ${symbol} up', 'Move ${symbol} down', 'Remove ${symbol} from your queue']) assert(ROW.includes(label), label);
  assert(ROW.includes('{index > 0 ? (') && ROW.includes('{index < count - 1 ? ('));
});

Deno.test('no fallback to a stored price: the queue never reads symbols.last_price', () => {
  for (const [name, src] of [['QueueRow', ROW], ['QueueEditor', EDITOR], ['useQueueQuotes', HOOK], ['queueRow', code(SOURCES['lib/game/queueRow.ts'])]] as const) {
    assert(!/last_price/.test(src), `${name} must not read last_price`);
  }
  // The price call is the draft search's own.
  assert(HOOK.includes("seamInvoke('symbols-search', { body: { symbols } })"), 'the batch mode: the exact tickers, one call');
  assert(!/limit: 1|includePrices|\bq:/.test(HOOK), 'no per-symbol search any more');
  assert(HOOK.includes('answersFromBatch(data, symbols)'));
  // A resolved { error } is a failure, not a price (CLAUDE.md, success signals #5).
  assert(/if \(error\) throw error;/.test(HOOK));
  // The names are one batched read.
  assert(HOOK.includes(".in('symbol', missingNames)"));
});

Deno.test('the closed-market line sits under the heading, above the rows (the intro is cut, rule 12 row 2)', () => {
  assert(!EDITOR.includes("If you step away, we'll auto-pick"));
  const heading = EDITOR.indexOf('Your queue ·');
  const line = EDITOR.indexOf('{closedLine ?');
  const rows = EDITOR.indexOf('<QueueRow');
  assert(heading > 0 && heading < line && line < rows);
  assert(EDITOR.includes('useQueueMarketLine()') && EDITOR.includes('useQueueQuotes(queue)'));
});

// ── The draft search's result list: the same rule, same family ─────────────────

Deno.test('the draft search never splits a ticker: it cannot shrink, sits on a wrapping line, stops at 1.3×', () => {
  assert(/flexShrink:\s*0/.test(style(SEARCH, 'resultSymbol')), 'the result ticker does not shrink');
  assert(/flexWrap:\s*'wrap'/.test(style(SEARCH, 'resultSymbolRow')), 'a badge wraps under the ticker, not the ticker mid-word');
  assert(/minWidth:\s*0/.test(style(SEARCH, 'resultLeft')), 'the company name gives way, not the ticker');
  assert(/flexShrink:\s*0/.test(style(SEARCH, 'resultPrice')));
  const ticker = /<Text\s[^>]*?>\s*\{item\.symbol\}/.exec(SEARCH)![0];
  assert(ticker.includes('numberOfLines={1}'), 'one line, never wrapped inside the word');
  assert(SEARCH.includes('QUEUE_ROW_TEXT_MAX_SCALE') && SEARCH.includes('cappedTextProps'));
  for (const t of ['tickerText', 'badgeText', 'nameText', 'priceText']) assert(SEARCH.includes(`{...${t}.props}`) && SEARCH.includes(`${t}.size`), t);
});

// ── The shared price store: ONE batch call for the queue, never asked twice for what it has ───────────────────

/** A batch fetcher that records each call's symbols and answers from `prices` ('fail' = a `failed` entry; a missing symbol is left out
 * of the answer; `'throw'` makes the whole call reject, like a 502 or an `{ error }`). */
function fakeBatch(prices: Record<string, number | null | 'fail'>, opts: { throwAll?: boolean } = {}) {
  const calls: string[][] = [];
  const fetcher = (symbols: string[]) => {
    calls.push(symbols.slice());
    if (opts.throwAll) return Promise.reject(new Error('502'));
    const out: Record<string, { ok: true; price: number | null } | { ok: false }> = {};
    for (const s of symbols) {
      if (!(s in prices)) continue;
      const p = prices[s];
      out[s] = p === 'fail' ? { ok: false } : { ok: true, price: p };
    }
    return Promise.resolve(out);
  };
  return { calls, fetcher };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

Deno.test('store: the numbers are pinned (ticker-quotes uses 60 s; a failure is asked again after 15 s; four lanes; the function takes 50)', () => {
  assertEquals([PRICE_TTL_MS, FAIL_TTL_MS, PRICE_LANES, BATCH_SIZE], [60_000, 15_000, 4, 50]);
});

Deno.test('store: ONE call for N symbols, and the batch maps to each symbol\'s price', async () => {
  const { calls, fetcher } = fakeBatch({ NVDA: 186.42, MSFT: 512.18, RKLB: null });
  const store = createPriceStore(fetcher);
  let settled = 0;
  store.request(['NVDA', 'MSFT', 'RKLB', 'nvda'], () => settled++);
  assertEquals(store.peek('NVDA'), undefined); // loading until the read lands
  await tick();
  assertEquals(calls, [['NVDA', 'MSFT', 'RKLB']]); // one call, de-duplicated, in queue order
  assertEquals(settled, 3);
  assertEquals(store.peek('nvda'), { status: 'ready', price: 186.42 });
  assertEquals(store.peek('MSFT'), { status: 'ready', price: 512.18 });
  assertEquals(store.peek('RKLB'), { status: 'ready', price: null });
});

Deno.test('store: more than 50 symbols go out in chunks of 50, each symbol once', async () => {
  const syms = Array.from({ length: 120 }, (_, i) => `S${i}`);
  const { calls, fetcher } = fakeBatch(Object.fromEntries(syms.map((s) => [s, 1])));
  const store = createPriceStore(fetcher);
  store.request(syms, () => {});
  await tick();
  await tick();
  assertEquals(calls.map((c) => c.length), [50, 50, 20]);
  assertEquals(calls.flat(), syms); // in order, none twice, none dropped
  assertEquals(store.peek('S119'), { status: 'ready', price: 1 });
  // Exactly 50 is still one call.
  const exact = fakeBatch(Object.fromEntries(syms.slice(0, 50).map((s) => [s, 1])));
  createPriceStore(exact.fetcher).request(syms.slice(0, 50), () => {});
  await tick();
  assertEquals(exact.calls.length, 1);
});

Deno.test('store: a price is read once; a second mount within the TTL makes zero calls and still shows it', async () => {
  const { calls, fetcher } = fakeBatch({ NVDA: 186.42, MSFT: 512.18 });
  let t = 1_000;
  const store = createPriceStore(fetcher, () => t);
  store.request(['NVDA', 'MSFT'], () => {});
  await tick();
  assertEquals(calls, [['NVDA', 'MSFT']]);
  t += PRICE_TTL_MS - 1;
  store.request(['NVDA', 'MSFT'], () => {}); // the card is re-opened, the league switched back to
  await tick();
  assertEquals(calls.length, 1); // zero new calls
  assertEquals(store.peek('NVDA'), { status: 'ready', price: 186.42 });
});

Deno.test('store: a stock added later is the only one asked for', async () => {
  const { calls, fetcher } = fakeBatch({ NVDA: 1, MSFT: 2, TEM: 3 });
  const store = createPriceStore(fetcher);
  store.request(['NVDA', 'MSFT'], () => {});
  await tick();
  store.request(['NVDA', 'MSFT', 'TEM'], () => {});
  await tick();
  assertEquals(calls, [['NVDA', 'MSFT'], ['TEM']]);
});

Deno.test('store: past the TTL it asks again, and keeps showing the old price meanwhile', async () => {
  const { calls, fetcher } = fakeBatch({ NVDA: 186.42 });
  let t = 0;
  const store = createPriceStore(fetcher, () => t);
  store.request(['NVDA'], () => {});
  await tick();
  t += PRICE_TTL_MS;
  store.request(['NVDA'], () => {});
  assertEquals(store.peek('NVDA'), { status: 'ready', price: 186.42 }); // stale beats blank
  await tick();
  assertEquals(calls, [['NVDA'], ['NVDA']]);
});

Deno.test('store: a symbol already being fetched is shared, not asked again', async () => {
  const calls: string[][] = [];
  let release: (a: Record<string, { ok: true; price: number }>) => void = () => {};
  const store = createPriceStore((syms) => { calls.push(syms); return new Promise((r) => { release = r as typeof release; }); });
  let a = 0;
  let b = 0;
  store.request(['NVDA'], () => a++); // the first mount
  store.request(['NVDA', 'nvda'], () => b++); // a second mount, in flight, the same symbol twice
  assertEquals(calls, [['NVDA']]);
  release({ NVDA: { ok: true, price: 186.42 } });
  await tick();
  assertEquals(calls, [['NVDA']]);
  assertEquals([a, b], [1, 1]); // both mounts are told, once
  assertEquals(store.peek('NVDA'), { status: 'ready', price: 186.42 });
});

Deno.test('store: symbols are de-duplicated across cases, one entry each', async () => {
  const { calls, fetcher } = fakeBatch({ 'BRK.B': 498.75 });
  const store = createPriceStore(fetcher);
  store.request(['brk.b', 'BRK.B', 'Brk.b'], () => {});
  await tick();
  assertEquals(calls, [['BRK.B']]);
});

Deno.test('store: at most PRICE_LANES calls in flight at once, across every mount', async () => {
  let running = 0;
  let peak = 0;
  const calls: string[][] = [];
  const store = createPriceStore(async (syms) => {
    calls.push(syms);
    running++;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 2));
    running--;
    return Object.fromEntries(syms.map((s) => [s, { ok: true as const, price: 1 }]));
  });
  const syms = Array.from({ length: 50 * 6 + 5 }, (_, i) => `S${i}`); // 7 chunks
  store.request(syms, () => {});
  await new Promise((r) => setTimeout(r, 60));
  assertEquals(calls.length, 7);
  assertEquals(peak, PRICE_LANES);
  assertEquals(calls.flat().slice().sort(), syms.slice().sort());
});

Deno.test('store: a symbol in `failed` is "–", NOT cached as an answer, not retried at once, retried after the failure TTL; its neighbours keep their prices', async () => {
  const { calls, fetcher } = fakeBatch({ RKLB: 'fail', NVDA: 186.42 });
  let t = 0;
  const store = createPriceStore(fetcher, () => t);
  let settled = 0;
  store.request(['RKLB', 'NVDA'], () => settled++);
  await tick();
  assertEquals(settled, 2); // a failure settles too, so the row stops showing its placeholder
  assertEquals(store.peek('RKLB'), { status: 'ready', price: null });
  assertEquals(store.peek('NVDA'), { status: 'ready', price: 186.42 });
  t += FAIL_TTL_MS - 1;
  store.request(['RKLB', 'NVDA'], () => {});
  await tick();
  assertEquals(calls.length, 1); // not hammered; NVDA is fresh (60 s), RKLB is inside its 15 s
  t += 1;
  store.request(['RKLB', 'NVDA'], () => {});
  await tick();
  assertEquals(calls, [['RKLB', 'NVDA'], ['RKLB']]); // only the failed one is asked again, after 15 s
});

Deno.test('store: a clean null is an ANSWER (kept for the 60 s), unlike a failure (15 s)', async () => {
  const { calls, fetcher } = fakeBatch({ RKLB: null });
  let t = 0;
  const store = createPriceStore(fetcher, () => t);
  store.request(['RKLB'], () => {});
  await tick();
  t += FAIL_TTL_MS; // past a failure's TTL, inside an answer's
  store.request(['RKLB'], () => {});
  await tick();
  assertEquals(calls.length, 1);
});

Deno.test('store: a whole call that fails (a 429/502/503, an { error }, a dropped connection) fails every symbol in it, and a symbol the answer leaves out', async () => {
  const down = fakeBatch({ A: 1, B: 2 }, { throwAll: true });
  let t = 0;
  const store = createPriceStore(down.fetcher, () => t);
  let settled = 0;
  store.request(['A', 'B'], () => settled++);
  await tick();
  assertEquals(settled, 2);
  assertEquals(store.peek('A'), { status: 'ready', price: null });
  assertEquals(store.peek('B'), { status: 'ready', price: null });
  t += FAIL_TTL_MS;
  store.request(['A', 'B'], () => {});
  await tick();
  assertEquals(down.calls, [['A', 'B'], ['A', 'B']]); // asked again after 15 s
  // A symbol the answer is silent about is a failed read, not an invented price.
  const quiet = fakeBatch({ A: 1 });
  const s2 = createPriceStore(quiet.fetcher, () => t);
  s2.request(['A', 'B'], () => {});
  await tick();
  assertEquals(s2.peek('B'), { status: 'ready', price: null });
  t += FAIL_TTL_MS;
  s2.request(['A', 'B'], () => {});
  await tick();
  assertEquals(quiet.calls, [['A', 'B'], ['B']]);
});

Deno.test('store: a failure after a good read drops the old price rather than showing it beside a failure', async () => {
  let fail = false;
  let t = 0;
  const store = createPriceStore(
    (syms) => (fail ? Promise.reject(new Error('x')) : Promise.resolve(Object.fromEntries(syms.map((s) => [s, { ok: true as const, price: 10 }])))),
    () => t,
  );
  store.request(['AAA'], () => {});
  await tick();
  assertEquals(store.peek('AAA'), { status: 'ready', price: 10 });
  t += PRICE_TTL_MS;
  fail = true;
  store.request(['AAA'], () => {});
  await tick();
  assertEquals(store.peek('AAA'), { status: 'ready', price: null });
});

Deno.test('the hook reads prices only through the shared store (no per-mount cache, no direct search call)', () => {
  assert(HOOK.includes('createPriceStore(fetchQueuePrices)') && HOOK.includes('priceStore.request(wanted, bump)') && HOOK.includes('priceStore.peek(s)'));
  assert(!/new Map<string, \{ price/.test(HOOK), 'no price cache of its own');
  assert(!HOOK.includes('runPool'));
  // The store is module-level, so it outlives a mount.
  assert(/^const priceStore = createPriceStore\(fetchQueuePrices\);$/m.test(HOOK), 'exactly one store, built once at module level');
  assertEquals((HOOK.match(/createPriceStore\(/g) ?? []).length, 1, 'never a store per mount');
});
