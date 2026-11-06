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
  priceFromSearch,
  priceLabel,
  pricesClosedLine,
  rowLabel,
  symbolsToRead,
  usablePrice,
} from '../lib/game/queueRow.ts';
import { FAIL_TTL_MS, PRICE_LANES, PRICE_TTL_MS, createPriceStore } from '../lib/game/queuePriceStore.ts';
import { symbolsSearchFixture } from '../lib/game/seamFixtures.ts';
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

// ── The price is the draft search's number, for the asked symbol only ───────────

Deno.test('priceFromSearch: the exact ticker\'s latest trade', () => {
  const data = { items: [{ symbol: 'NVDA', name: 'NVIDIA Corp.', price: 186.42 }] };
  assertEquals(priceFromSearch(data, 'NVDA'), 186.42);
  assertEquals(priceFromSearch(data, 'nvda'), 186.42);
  // A response in another case still matches (the comparison is not case-sensitive on either side).
  assertEquals(priceFromSearch({ items: [{ symbol: 'nvda', price: 186.42 }] }, 'NVDA'), 186.42);
  assertEquals(priceFromSearch({ items: [{ symbol: 'BRK.B', price: 498.75 }] }, 'BRK.B'), 498.75);
});

Deno.test('priceFromSearch: a neighbour\'s price is never the asked stock\'s (the search matches by prefix and name)', () => {
  const neighbours = { items: [{ symbol: 'FA', name: 'F-something', price: 12.5 }, { symbol: 'FAST', price: 44 }] };
  assertEquals(priceFromSearch(neighbours, 'F'), null);
  // The Orchestrator's case: asking for SG when only SGA exists must not show SGA's price.
  assertEquals(priceFromSearch({ items: [{ symbol: 'SGA', name: 'Saga', price: 5.5 }] }, 'SG'), null);
  assertEquals(priceLabel(priceFromSearch({ items: [{ symbol: 'SGA', price: 5.5 }] }, 'SG')), '–');
  // The exact match wins wherever it sits.
  assertEquals(priceFromSearch({ items: [{ symbol: 'FA', price: 12.5 }, { symbol: 'F', price: 11.1 }] }, 'F'), 11.1);
});

Deno.test('priceFromSearch: no price, a zero price, a failed or odd response are all null', () => {
  assertEquals(priceFromSearch({ items: [{ symbol: 'RKLB', price: null }] }, 'RKLB'), null);
  assertEquals(priceFromSearch({ items: [{ symbol: 'RKLB' }] }, 'RKLB'), null);
  assertEquals(priceFromSearch({ items: [{ symbol: 'RKLB', price: 0 }] }, 'RKLB'), null);
  assertEquals(priceFromSearch({ items: [] }, 'RKLB'), null);
  assertEquals(priceFromSearch({ items: [], error: 'lookup_failed' }, 'RKLB'), null);
  for (const odd of [null, undefined, 'x', 7, {}, { items: 'nope' }, { items: [null, 3, { symbol: 7, price: 4 }] }]) {
    assertEquals(priceFromSearch(odd, 'RKLB'), null);
  }
});

Deno.test('the capture seam answers the way the real search does: exact first, a missing price stays missing', () => {
  const one = (q: string) => symbolsSearchFixture({ q, limit: 1, includePrices: true });
  assertEquals(priceFromSearch(one('SBUX'), 'SBUX'), 94.6);
  assertEquals(priceFromSearch(one('BRK.B'), 'BRK.B'), 498.75);
  assertEquals(priceFromSearch(one('TEM'), 'TEM'), 71.3); // TEMX also starts with TEM; limit 1 answers TEM
  assertEquals(priceFromSearch(one('RKLB'), 'RKLB'), null);
  assertEquals(priceLabel(priceFromSearch(one('RKLB'), 'RKLB')), '–');
  assertEquals(priceFromSearch(one('NOPE'), 'NOPE'), null);
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
  assert(HOOK.includes("seamInvoke('symbols-search'") && HOOK.includes('includePrices: true') && /limit: 1[,\s}]/.test(HOOK), 'the exact ticker only (limit 1), with prices');
  assert(HOOK.includes('priceFromSearch(data, symbol)'));
  // A resolved { error } is a failure, not a price (CLAUDE.md, success signals #5).
  assert(/if \(error\) throw error;/.test(HOOK));
  // The names are one batched read.
  assert(HOOK.includes(".in('symbol', missingNames)"));
});

Deno.test('the closed-market line sits under the intro, above the rows', () => {
  const intro = EDITOR.indexOf("If you step away, we'll auto-pick");
  const line = EDITOR.indexOf('{closedLine ?');
  const rows = EDITOR.indexOf('<QueueRow');
  assert(intro > 0 && intro < line && line < rows);
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

// ── The shared price store: symbols-search has no rate limit and no cache, so the client never asks twice ─────


/** A fetcher that records its calls and answers from `prices` (a missing symbol rejects, like a failed read). */
function fakeFetcher(prices: Record<string, number | null | 'fail'>) {
  const calls: string[] = [];
  const fetcher = (s: string) => {
    calls.push(s);
    const p = prices[s];
    return p === 'fail' ? Promise.reject(new Error('down')) : Promise.resolve(p ?? null);
  };
  return { calls, fetcher };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

Deno.test('store: the TTLs are pinned (ticker-quotes uses 60 s; a failure is asked again after 15 s; four lanes)', () => {
  assertEquals([PRICE_TTL_MS, FAIL_TTL_MS, PRICE_LANES], [60_000, 15_000, 4]);
});

Deno.test('store: a price is read once; a second mount within the TTL makes zero calls and still shows it', async () => {
  const { calls, fetcher } = fakeFetcher({ NVDA: 186.42, MSFT: 512.18 });
  let t = 1_000;
  const store = createPriceStore(fetcher, () => t);
  let settled = 0;
  store.request(['NVDA', 'MSFT'], () => settled++);
  assertEquals(store.peek('NVDA'), undefined); // loading until the read lands
  await tick();
  assertEquals(calls, ['NVDA', 'MSFT']);
  assertEquals(settled, 2);
  t += PRICE_TTL_MS - 1;
  store.request(['NVDA', 'MSFT'], () => settled++); // the card is re-opened, the league switched back to
  await tick();
  assertEquals(calls, ['NVDA', 'MSFT']); // zero new calls
  assertEquals(store.peek('nvda'), { status: 'ready', price: 186.42 });
  assertEquals(store.peek('MSFT'), { status: 'ready', price: 512.18 });
});

Deno.test('store: past the TTL it asks again, and keeps showing the old price meanwhile', async () => {
  const { calls, fetcher } = fakeFetcher({ NVDA: 186.42 });
  let t = 0;
  const store = createPriceStore(fetcher, () => t);
  store.request(['NVDA'], () => {});
  await tick();
  t += PRICE_TTL_MS;
  store.request(['NVDA'], () => {});
  assertEquals(store.peek('NVDA'), { status: 'ready', price: 186.42 }); // stale beats blank
  await tick();
  assertEquals(calls, ['NVDA', 'NVDA']);
});

Deno.test('store: a symbol already being fetched is shared, not asked again', async () => {
  const calls: string[] = [];
  let release: (p: number) => void = () => {};
  const store = createPriceStore((s) => { calls.push(s); return new Promise<number>((r) => { release = r; }); });
  let a = 0;
  let b = 0;
  store.request(['NVDA'], () => a++); // the first mount
  store.request(['NVDA', 'nvda'], () => b++); // a second mount, in flight, the same symbol twice
  assertEquals(calls, ['NVDA']);
  release(186.42);
  await tick();
  assertEquals(calls, ['NVDA']);
  assertEquals([a, b], [1, 1]); // both mounts are told
  assertEquals(store.peek('NVDA'), { status: 'ready', price: 186.42 });
});

Deno.test('store: symbols are de-duplicated across cases, one call each', async () => {
  const { calls, fetcher } = fakeFetcher({ BRK: 1, 'BRK.B': 498.75 });
  const store = createPriceStore(fetcher);
  store.request(['brk.b', 'BRK.B', 'Brk.b'], () => {});
  await tick();
  assertEquals(calls, ['BRK.B']);
});

Deno.test('store: at most PRICE_LANES requests in flight at once, across every mount', async () => {
  let running = 0;
  let peak = 0;
  const calls: string[] = [];
  const store = createPriceStore(async (s) => {
    calls.push(s);
    running++;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 2));
    running--;
    return 1;
  });
  const syms = Array.from({ length: 23 }, (_, i) => `S${i}`);
  store.request(syms.slice(0, 12), () => {}); // one mount…
  store.request(syms.slice(8), () => {}); // …and another, overlapping by 4
  await new Promise((r) => setTimeout(r, 60));
  assertEquals(PRICE_LANES, 4);
  assertEquals(peak, 4);
  assertEquals(calls.slice().sort(), syms.slice().sort()); // every symbol once, overlap included
});

Deno.test('store: a failed read is "–" (not cached as a price), not retried at once, retried after the failure TTL', async () => {
  const { calls, fetcher } = fakeFetcher({ RKLB: 'fail' });
  let t = 0;
  const store = createPriceStore(fetcher, () => t);
  let settled = 0;
  store.request(['RKLB'], () => settled++);
  await tick();
  assertEquals(settled, 1); // a failure settles too, so the row stops showing its placeholder
  assertEquals(store.peek('RKLB'), { status: 'ready', price: null });
  t += FAIL_TTL_MS - 1;
  store.request(['RKLB'], () => {});
  await tick();
  assertEquals(calls, ['RKLB']); // not hammered
  t += 1;
  store.request(['RKLB'], () => {});
  await tick();
  assertEquals(calls, ['RKLB', 'RKLB']); // then asked again
});

Deno.test('store: a failure after a good read drops the old price rather than showing it beside a failure', async () => {
  let fail = false;
  let t = 0;
  const store = createPriceStore(() => (fail ? Promise.reject(new Error('x')) : Promise.resolve(10)), () => t);
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
  assert(HOOK.includes('createPriceStore(fetchQueuePrice)') && HOOK.includes('priceStore.request(wanted, bump)') && HOOK.includes('priceStore.peek(s)'));
  assert(!/new Map<string, \{ price/.test(HOOK), 'no price cache of its own');
  assert(!HOOK.includes('runPool'));
  // The store is module-level, so it outlives a mount.
  assert(/^const priceStore = createPriceStore\(fetchQueuePrice\);$/m.test(HOOK), 'exactly one store, built once at module level');
  assertEquals((HOOK.match(/createPriceStore\(/g) ?? []).length, 1, 'never a store per mount');
});
