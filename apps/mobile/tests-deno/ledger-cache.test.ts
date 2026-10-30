/**
 * Hermetic tests for lib/money/ledgerCache.ts, and source guards that the app wires it: a trade's
 * outcome invalidates the league's ledger, and every usePortfolioLedger reloads on that signal.
 * The bug they pin (build 1.3.0 (5), 2026-10-30): after "Sold KB", Holdings and Trade history
 * still showed KB and the roster stayed "full" for the rest of the session.
 * Run: `cd apps/mobile/tests-deno && deno test --allow-read .`
 */
import { assertEquals } from 'jsr:@std/assert';
import { createLedgerCache } from '../lib/money/ledgerCache.ts';

function fakeServer() {
  const calls: string[] = [];
  let version = 1;
  const resolvers: Array<() => void> = [];
  let manual = false;
  const fetchLedger = (leagueId: string): Promise<string | null> => {
    calls.push(leagueId);
    const answer = `${leagueId}@v${version}`;
    if (!manual) return Promise.resolve(answer);
    return new Promise((resolve) => resolvers.push(() => resolve(answer)));
  };
  return {
    calls,
    fetchLedger,
    trade: () => { version += 1; },
    holdAnswers: () => { manual = true; },
    releaseAll: () => { manual = false; resolvers.splice(0).forEach((r) => r()); },
    /** Answers the held fetches newest-first: the worst case, where the older answer lands LAST. */
    releaseNewestFirst: () => { manual = false; resolvers.splice(0).reverse().forEach((r) => r()); },
  };
}

Deno.test('a league is fetched once and then shared', async () => {
  const s = fakeServer();
  const cache = createLedgerCache(s.fetchLedger);
  assertEquals(await cache.load('L'), 'L@v1');
  assertEquals(await cache.load('L'), 'L@v1');
  assertEquals(s.calls, ['L']);
});

Deno.test('THE BUG: after a trade, invalidate makes the next load read the server again', async () => {
  const s = fakeServer();
  const cache = createLedgerCache(s.fetchLedger);
  await cache.load('L');
  s.trade();
  assertEquals(await cache.load('L'), 'L@v1', 'without invalidation the pre-trade ledger is served (the 1.3.0 (5) bug)');
  cache.invalidate('L');
  assertEquals(await cache.load('L'), 'L@v2');
  assertEquals(s.calls, ['L', 'L']);
});

Deno.test('a load that started before the trade never caches its older answer, even when it lands last', async () => {
  const s = fakeServer();
  const cache = createLedgerCache(s.fetchLedger);
  s.holdAnswers();
  const early = cache.load('L'); // in flight, will answer v1
  s.trade();
  cache.invalidate('L');
  const fresh = cache.load('L'); // a NEW fetch, not the in-flight one
  s.releaseNewestFirst(); // v2 lands, THEN the stale v1
  assertEquals(await fresh, 'L@v2');
  assertEquals(await early, 'L@v1');
  assertEquals(cache.peek('L'), 'L@v2', 'the stale v1 must not overwrite the fresh ledger');
  assertEquals(s.calls.length, 2);
});

Deno.test('subscribers hear the invalidated league, and stop after unsubscribing', () => {
  const cache = createLedgerCache(fakeServer().fetchLedger);
  const heard: string[] = [];
  const stop = cache.subscribe((id) => heard.push(id));
  cache.invalidate('L');
  cache.invalidate('M');
  stop();
  cache.invalidate('L');
  assertEquals(heard, ['L', 'M']);
});

Deno.test('a failed load is never cached, so a retry really retries', async () => {
  let fail = true;
  const calls: string[] = [];
  const cache = createLedgerCache((id: string) => {
    calls.push(id);
    return Promise.resolve(fail ? null : `${id}@ok`);
  });
  assertEquals(await cache.load('L'), null);
  assertEquals(cache.has('L'), false);
  fail = false;
  assertEquals(await cache.load('L'), 'L@ok');
  assertEquals(calls, ['L', 'L']);
});

Deno.test('invalidating one league leaves the others cached', async () => {
  const s = fakeServer();
  const cache = createLedgerCache(s.fetchLedger);
  await cache.load('L');
  await cache.load('M');
  cache.invalidate('L');
  assertEquals(cache.has('L'), false);
  assertEquals(cache.has('M'), true);
});

// ── Wiring (source guards): the cache is useless if nothing calls invalidate or listens. ──
const read = (p: string) => Deno.readTextFileSync(new URL(p, import.meta.url));

Deno.test('a trade outcome that changes or contradicts our picture invalidates the league ledger', () => {
  const submit = read('../lib/money/useTradeSubmit.ts');
  assertEquals(submit.includes("if (outcome.kind === 'ok' || outcome.kind === 'refused') invalidatePortfolioLedger(body.league_id);"), true);
});

Deno.test('every usePortfolioLedger reloads when its league is invalidated, keeping the last ledger on screen meanwhile', () => {
  const hook = read('../lib/money/usePortfolioLedger.ts');
  assertEquals(hook.includes('ledgerCache.subscribe((id) => {'), true);
  assertEquals(hook.includes('if (id === leagueId) setTick((t) => t + 1);'), true);
  // Refresh in place: a reload of the same league keeps showing what it had (no skeleton flash after a trade).
  assertEquals(hook.includes("const keep = prev.forLeague === leagueId && prev.ledger !== null && prev.status === 'ready';"), true);
});
