// Hermetic: the real deps over a fake client and a fake fetch. Pins the set query, the
// { error } checks, the reply check, and what a refused snapshot call returns.
//   deno test supabase/functions/rank-top-movers/
import { assert, assertEquals } from 'jsr:@std/assert';
import { makeRankDeps, type RankDbClient } from './deps.ts';
import { fetchSnapshotBatch, snapshotsUrl } from './snapshots.ts';

function fakeDb(opts: {
  rows?: unknown;
  readError?: { code: string } | null;
  rpcData?: unknown;
  rpcError?: { code: string } | null;
}) {
  const calls: unknown[][] = [];
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  // deno-lint-ignore no-explicit-any
  const q: any = {
    eq: (...a: unknown[]) => (calls.push(['eq', ...a]), q),
    not: (...a: unknown[]) => (calls.push(['not', ...a]), q),
    order: (...a: unknown[]) => (calls.push(['order', ...a]), q),
    limit: (n: number) => {
      calls.push(['limit', n]);
      return Promise.resolve({ data: opts.rows ?? null, error: opts.readError ?? null });
    },
  };
  const db: RankDbClient = {
    from: (t) => {
      calls.push(['from', t]);
      return { select: (c) => (calls.push(['select', c]), q) };
    },
    rpc: (fn, args) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: opts.rpcData ?? null, error: opts.rpcError ?? null });
    },
  };
  return { db, calls, rpcCalls };
}

const noFetch = (() => {
  throw new Error('no fetch expected');
}) as unknown as typeof fetch;

Deno.test('readSet: the 500 largest active, draftable, priced, sized stocks, ties by ticker', async () => {
  const f = fakeDb({ rows: [{ symbol: 'AAPL' }, { symbol: 'BRK.B' }] });
  const r = await makeRankDeps(f.db, 'k', 's', noFetch).readSet(500);
  assertEquals(r, { ok: true, symbols: ['AAPL', 'BRK.B'] });
  assertEquals(f.calls, [
    ['from', 'symbols'],
    ['select', 'symbol'],
    ['eq', 'active', true],
    ['eq', 'is_draftable', true],
    ['not', 'last_price', 'is', null],
    ['not', 'market_cap', 'is', null],
    ['order', 'market_cap', { ascending: false }],
    ['order', 'symbol', { ascending: true }],
    ['limit', 500],
  ]);
});

Deno.test('readSet: an error, no data or a malformed row is a failed read, never a short set', async () => {
  assertEquals(await makeRankDeps(fakeDb({ readError: { code: '57014' } }).db, 'k', 's', noFetch).readSet(500), { ok: false, error: '57014' });
  assertEquals((await makeRankDeps(fakeDb({ rows: null }).db, 'k', 's', noFetch).readSet(500)).ok, false);
  assertEquals((await makeRankDeps(fakeDb({ rows: [{ symbol: 'A' }, { symbol: null }] }).db, 'k', 's', noFetch).readSet(500)).ok, false);
});

Deno.test('writeRanking: sends the whole ranking; reads written / kept / error / unknown honestly', async () => {
  const args = { rankedAt: new Date('2026-12-14T16:00:00Z'), setSize: 500, freshCount: 480, symbols: ['A', 'B'], changePcts: [5, -4] };
  const ok = fakeDb({ rpcData: { written: true, rows: 2 } });
  assertEquals(await makeRankDeps(ok.db, 'k', 's', noFetch).writeRanking(args), { ok: true, written: true });
  assertEquals(ok.rpcCalls, [{
    fn: 'replace_top_movers',
    args: { p_ranked_at: '2026-12-14T16:00:00.000Z', p_set_size: 500, p_fresh_count: 480, p_symbols: ['A', 'B'], p_change_pcts: [5, -4] },
  }]);
  assertEquals(
    await makeRankDeps(fakeDb({ rpcData: { written: false, reason: 'newer_ranking_exists' } }).db, 'k', 's', noFetch).writeRanking(args),
    { ok: true, written: false, reason: 'newer_ranking_exists' },
  );
  // supabase-js resolves a Postgres error; it is checked, not assumed away.
  assertEquals(await makeRankDeps(fakeDb({ rpcError: { code: '22023' } }).db, 'k', 's', noFetch).writeRanking(args), { ok: false, error: '22023' });
  for (const data of [null, {}, { written: 'yes' }, [1]]) {
    assertEquals((await makeRankDeps(fakeDb({ rpcData: data }).db, 'k', 's', noFetch).writeRanking(args)).ok, false, JSON.stringify(data));
  }
});

// ---- the snapshots call -------------------------------------------------------------------

function fakeFetch(res: Response | Error, seen: Array<{ url: string; init?: RequestInit }> = []): typeof fetch {
  return ((url: string, init?: RequestInit) => {
    seen.push({ url, init });
    return res instanceof Error ? Promise.reject(res) : Promise.resolve(res);
  }) as unknown as typeof fetch;
}
const RL_HEADERS = { 'x-ratelimit-limit': '200', 'x-ratelimit-remaining': '187', 'x-ratelimit-reset': '1765728060' };

Deno.test('fetchSnapshotBatch: one IEX call with the app key; the body and the rate-limit headers', async () => {
  const seen: Array<{ url: string; init?: RequestInit }> = [];
  const r = await fetchSnapshotBatch(['AAPL', 'BRK.B'], 'KEY', 'SECRET', fakeFetch(
    new Response(JSON.stringify({ AAPL: { latestTrade: { p: 1 } } }), { status: 200, headers: RL_HEADERS }),
    seen,
  ));
  assert(r.ok);
  assertEquals(r.body, { AAPL: { latestTrade: { p: 1 } } });
  assertEquals(r.rateLimit, { limit: '200', remaining: '187', reset: '1765728060' });
  assertEquals(seen[0].url, 'https://data.alpaca.markets/v2/stocks/snapshots?symbols=AAPL,BRK.B&feed=iex');
  assertEquals(seen[0].url, snapshotsUrl(['AAPL', 'BRK.B']));
  const h = new Headers(seen[0].init?.headers);
  assertEquals([h.get('APCA-API-KEY-ID'), h.get('APCA-API-SECRET-KEY')], ['KEY', 'SECRET']);
  assert(seen[0].init?.signal, 'a timeout signal is set');
});

Deno.test('fetchSnapshotBatch: a refusal, a network error or a bad body is a failed batch', async () => {
  const r429 = await fetchSnapshotBatch(['A'], 'k', 's', fakeFetch(new Response('slow down', { status: 429, headers: { ...RL_HEADERS, 'x-ratelimit-remaining': '0' } })));
  assertEquals(r429, { ok: false, status: 429, error: 'http_error', rateLimit: { limit: '200', remaining: '0', reset: '1765728060' } });
  const r400 = await fetchSnapshotBatch(['A'], 'k', 's', fakeFetch(new Response('{"message":"invalid symbol"}', { status: 400 })));
  assertEquals([r400.ok, r400.status], [false, 400]);
  const net = await fetchSnapshotBatch(['A'], 'k', 's', fakeFetch(new DOMException('timed out', 'TimeoutError')));
  assertEquals(net, { ok: false, status: 0, error: 'TimeoutError', rateLimit: { limit: null, remaining: null, reset: null } });
  for (const text of ['not json', '[1,2]', 'null', '"x"']) {
    const r = await fetchSnapshotBatch(['A'], 'k', 's', fakeFetch(new Response(text, { status: 200 })));
    assertEquals(r.ok, false, text);
  }
});
