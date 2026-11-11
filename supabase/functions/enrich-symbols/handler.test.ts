/**
 * Unit tests for ./handler.ts: the cron's HTTP request must end BEFORE the
 * batch does (pg_net head-of-line blocking, docs/STATUS.md §4 item 28).
 * Hermetic: no DB, no Finnhub, no Alpaca, no network. runBatch and waitUntil
 * are injected fakes; the batch is a promise the test resolves by hand.
 *
 * Run from repo root:
 *   deno test --allow-read --allow-env supabase/functions/enrich-symbols/handler.test.ts
 */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import type { EnrichConfig, EnrichResult } from './batch.ts';
import { makeEnrichHandler, runInBackground } from './handler.ts';

const CRON_KEY = 'test-cron-key-not-a-secret';
const FAKE_ENV: Record<string, string> = {
  SB_SECRET_KEY_CRON: CRON_KEY,
  FINNHUB_API_KEY: 'test-finnhub-not-a-secret',
  ALPACA_API_KEY: 'test-alpaca-id',
  ALPACA_API_SECRET: 'test-alpaca-secret',
};

/** Set the fake env for one test and put the shell's values back after. */
async function withEnv(fn: () => Promise<void>, overrides: Record<string, string | undefined> = {}) {
  const env = { ...FAKE_ENV, ...overrides };
  const saved = new Map(Object.keys(env).map((k) => [k, Deno.env.get(k)]));
  for (const [k, v] of Object.entries(env)) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
  try {
    await fn();
  } finally {
    for (const [k, v] of saved) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
  }
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A harness: a batch the test settles by hand, a waitUntil that records, and captured logs. */
function harness() {
  const batch = deferred<EnrichResult>();
  const calls: { cfg: EnrichConfig; batchSize: number }[] = [];
  const handed: Promise<unknown>[] = [];
  const logs: string[] = [];
  const errors: string[] = [];
  let batchSettled = false;
  batch.promise.then(() => (batchSettled = true), () => (batchSettled = true));
  const handler = makeEnrichHandler({
    runBatch: (cfg, batchSize) => {
      calls.push({ cfg, batchSize });
      return batch.promise;
    },
    waitUntil: (p) => {
      handed.push(p);
    },
    log: (...a) => logs.push(a.map(String).join(' ')),
    logError: (...a) => errors.push(a.map(String).join(' ')),
  });
  return { handler, batch, calls, handed, logs, errors, settled: () => batchSettled };
}

const post = (body: unknown = {}, headers: Record<string, string> = { apikey: CRON_KEY }) =>
  new Request('http://localhost/enrich-symbols', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

/** Resolve to the handler's response, or 'timeout' if it is still open after `ms`. */
async function responseWithin(p: Promise<Response>, ms: number): Promise<Response | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<'timeout'>((r) => (timer = setTimeout(() => r('timeout'), ms)));
  try {
    return await Promise.race([p, t]);
  } finally {
    clearTimeout(timer);
  }
}

const RESULT: EnrichResult = { ok: true, batch: 50, profiled: 48, priced: 50, price_status: 'complete' };

Deno.test('answers 202 while the batch is still running (the batch never has to finish first)', () =>
  withEnv(async () => {
    const h = harness();
    const res = await responseWithin(h.handler(post()), 1000);
    assert(res !== 'timeout', 'handler did not answer while the batch was pending: it waited for the batch');
    assertEquals(res.status, 202);
    assertEquals(await res.json(), { accepted: true, batch_limit: 50 });
    assertEquals(h.settled(), false, 'the batch must still be pending when the 202 is sent');
    assertEquals(h.calls.length, 1, 'the batch was started');
    assertEquals(h.logs, [], 'no outcome is logged before the batch ends');

    h.batch.resolve(RESULT);
    await h.handed[0];
  }));

Deno.test('the background promise goes to waitUntil, and it settles only when the batch does', () =>
  withEnv(async () => {
    const h = harness();
    await h.handler(post());
    assertEquals(h.handed.length, 1, 'exactly one promise handed to waitUntil');

    let handedSettled = false;
    h.handed[0].then(() => (handedSettled = true));
    await new Promise((r) => setTimeout(r, 20));
    assertEquals(handedSettled, false, 'waitUntil got a promise that settled before the batch did');

    h.batch.resolve(RESULT);
    await h.handed[0];
    assertEquals(handedSettled, true);
  }));

Deno.test('the outcome is ONE structured log line at the end of the background work', () =>
  withEnv(async () => {
    const h = harness();
    await h.handler(post());
    h.batch.resolve(RESULT);
    await h.handed[0];

    assertEquals(h.errors, []);
    assertEquals(h.logs.length, 1);
    const [tag, payload] = [h.logs[0].slice(0, 'enrich-symbols '.length), h.logs[0].slice('enrich-symbols '.length)];
    assertEquals(tag, 'enrich-symbols ');
    const parsed = JSON.parse(payload);
    assertEquals(parsed.ok, true);
    assertEquals(parsed.batch, 50);
    assertEquals(parsed.price_status, 'complete');
    assertEquals(typeof parsed.duration_ms, 'number');
  }));

Deno.test('a rejected batch is logged as a failure, and the waitUntil promise still resolves', () =>
  withEnv(async () => {
    const h = harness();
    await h.handler(post());
    h.batch.reject(new Error('select_failed (priority): boom'));
    // Resolves, never rejects: if it rejected, this await would throw and the
    // runtime would see an unhandled rejection.
    await h.handed[0];
    assertEquals(h.logs, []);
    assertEquals(h.errors.length, 1);
    assertStringIncludes(h.errors[0], 'enrich-symbols failed');
    assertStringIncludes(h.errors[0], 'select_failed (priority): boom');
    assertStringIncludes(h.errors[0], '"ok":false');
  }));

Deno.test('a SYNCHRONOUS throw from runBatch is logged too, and the handler still answers 202', () =>
  withEnv(async () => {
    const handed: Promise<unknown>[] = [];
    const errors: string[] = [];
    const handler = makeEnrichHandler({
      runBatch: () => {
        throw new Error('sync boom');
      },
      waitUntil: (p) => {
        handed.push(p);
      },
      log: () => {},
      logError: (...a) => errors.push(a.map(String).join(' ')),
    });
    const res = await handler(post());
    assertEquals(res.status, 202);
    await res.body?.cancel();
    await handed[0];
    assertEquals(errors.length, 1);
    assertStringIncludes(errors[0], 'sync boom');
  }));

Deno.test('runInBackground never rejects, whatever work does (non-Error throw included)', async () => {
  const errors: string[] = [];
  await runInBackground(() => Promise.reject('a string'), () => {}, (...a) => errors.push(a.map(String).join(' ')));
  assertEquals(errors.length, 1);
  assertStringIncludes(errors[0], 'a string');
});

Deno.test('405 / 401 / 500 are still answered synchronously and start no batch', () =>
  withEnv(async () => {
    const h = harness();

    const get = await h.handler(new Request('http://localhost/enrich-symbols', { method: 'GET' }));
    assertEquals(get.status, 405);
    await get.body?.cancel();

    const bad = await h.handler(post({}, { apikey: 'wrong-key-same-len-xxxxxxx' }));
    assertEquals(bad.status, 401);
    await bad.body?.cancel();

    const none = await h.handler(post({}, {}));
    assertEquals(none.status, 401);
    await none.body?.cancel();

    assertEquals(h.calls.length, 0);
    assertEquals(h.handed.length, 0);
  }));

Deno.test('a missing secret is a synchronous 500, no batch started', () =>
  withEnv(async () => {
    const h = harness();
    const res = await h.handler(post());
    assertEquals(res.status, 500);
    assertEquals(await res.json(), { error: 'server_config_error' });
    assertEquals(h.calls.length, 0);
    assertEquals(h.handed.length, 0);
  }, { FINNHUB_API_KEY: undefined }));

Deno.test('no cron key configured fails closed (401), no batch started', () =>
  withEnv(async () => {
    const h = harness();
    const res = await h.handler(post());
    assertEquals(res.status, 401);
    await res.body?.cancel();
    assertEquals(h.calls.length, 0);
  }, { SB_SECRET_KEY_CRON: undefined }));

Deno.test('limit is clamped exactly as before and passed to the batch; batch_limit echoes it', () =>
  withEnv(async () => {
    for (const [limit, want] of [[undefined, 50], [10, 10], [500, 80], [0, 50], [-3, 1], ['x', 50]] as const) {
      const h = harness();
      const res = await h.handler(post(limit === undefined ? {} : { limit }));
      assertEquals(res.status, 202);
      assertEquals((await res.json()).batch_limit, want, `limit ${String(limit)}`);
      assertEquals(h.calls[0].batchSize, want, `limit ${String(limit)}`);
      h.batch.resolve(RESULT);
      await h.handed[0];
    }
  }));

Deno.test('the batch gets the configured secrets', () =>
  withEnv(async () => {
    const h = harness();
    const res = await h.handler(post());
    await res.body?.cancel();
    assertEquals(h.calls[0].cfg, {
      finnhubToken: FAKE_ENV.FINNHUB_API_KEY,
      alpacaKey: FAKE_ENV.ALPACA_API_KEY,
      alpacaSecret: FAKE_ENV.ALPACA_API_SECRET,
    });
    h.batch.resolve(RESULT);
    await h.handed[0];
  }));
