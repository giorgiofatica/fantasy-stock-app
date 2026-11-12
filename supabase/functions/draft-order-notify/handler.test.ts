/**
 * Unit tests for ./handler.ts: the cron's HTTP request must end BEFORE the run
 * does (pg_net head-of-line blocking, docs/STATUS.md §4 item 28). Hermetic:
 * `run` and `waitUntil` are injected fakes; the run is a promise the test
 * settles by hand.
 *
 * Run from repo root:
 *   deno test --allow-read --allow-env supabase/functions/draft-order-notify/handler.test.ts
 */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { makeNotifyHandler } from './handler.ts';
import type { NotifyResult } from './run.ts';

const CRON_KEY = 'test-cron-key-not-a-secret';
const FAKE_ENV: Record<string, string> = {
  SB_SECRET_KEY_CRON: CRON_KEY,
  SUPABASE_URL: 'http://stub.supabase.test',
  SB_SECRET_KEY_INTERNAL: 'test-internal-key-not-a-secret',
};

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

function harness() {
  const run = deferred<NotifyResult>();
  const calls: { url: string; key: string }[] = [];
  const handed: Promise<unknown>[] = [];
  const logs: string[] = [];
  const errors: string[] = [];
  let runSettled = false;
  run.promise.then(() => (runSettled = true), () => (runSettled = true));
  const handler = makeNotifyHandler({
    run: (cfg) => {
      calls.push(cfg);
      return run.promise;
    },
    waitUntil: (p) => {
      handed.push(p);
    },
    log: (...a) => logs.push(a.map(String).join(' ')),
    logError: (...a) => errors.push(a.map(String).join(' ')),
  });
  return { handler, run, calls, handed, logs, errors, settled: () => runSettled };
}

const post = (headers: Record<string, string> = { apikey: CRON_KEY }) =>
  new Request('http://localhost/draft-order-notify', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: '{}',
  });

async function responseWithin(p: Promise<Response>, ms: number): Promise<Response | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<'timeout'>((r) => (timer = setTimeout(() => r('timeout'), ms)));
  try {
    return await Promise.race([p, t]);
  } finally {
    clearTimeout(timer);
  }
}

const RESULT: NotifyResult = {
  ok: true, opened: 1, open_error: null, finalized: 0, finalize_error: null, examined: 3, outcomes: { sent: 2, no_device: 1 },
};

Deno.test('answers 202 {accepted:true} while the run is still pending', () =>
  withEnv(async () => {
    const h = harness();
    const res = await responseWithin(h.handler(post()), 1000);
    assert(res !== 'timeout', 'handler did not answer while the run was pending: it waited for the run');
    assertEquals(res.status, 202);
    assertEquals(await res.json(), { accepted: true });
    assertEquals(h.settled(), false, 'the run must still be pending when the 202 is sent');
    assertEquals(h.calls, [{ url: FAKE_ENV.SUPABASE_URL, key: FAKE_ENV.SB_SECRET_KEY_INTERNAL }]);
    assertEquals(h.logs, [], 'no outcome is logged before the run ends');
    h.run.resolve(RESULT);
    await h.handed[0];
  }));

Deno.test('the run goes to waitUntil, and that promise settles only when the run does', () =>
  withEnv(async () => {
    const h = harness();
    await h.handler(post());
    assertEquals(h.handed.length, 1);
    let handedSettled = false;
    h.handed[0].then(() => (handedSettled = true));
    await new Promise((r) => setTimeout(r, 20));
    assertEquals(handedSettled, false, 'waitUntil got a promise that settled before the run did');
    h.run.resolve(RESULT);
    await h.handed[0];
    assertEquals(handedSettled, true);
  }));

Deno.test('the old 200 body is ONE structured log line at the end, with duration_ms', () =>
  withEnv(async () => {
    const h = harness();
    await h.handler(post());
    h.run.resolve(RESULT);
    await h.handed[0];
    assertEquals(h.errors, []);
    assertEquals(h.logs.length, 1);
    assert(h.logs[0].startsWith('draft-order-notify {'), h.logs[0]);
    const parsed = JSON.parse(h.logs[0].slice('draft-order-notify '.length));
    assertEquals({ ...parsed, duration_ms: 0 }, { ...RESULT, duration_ms: 0 });
    assertEquals(typeof parsed.duration_ms, 'number');
  }));

Deno.test('ok:false (the notice select failed) is the same line on the ERROR stream', () =>
  withEnv(async () => {
    const h = harness();
    await h.handler(post());
    h.run.resolve({ ok: false, reason: 'notice_query_failed', opened: 0, finalized: 0 });
    await h.handed[0];
    assertEquals(h.logs, []);
    assertEquals(h.errors.length, 1);
    assert(h.errors[0].startsWith('draft-order-notify {'), h.errors[0]);
    assertStringIncludes(h.errors[0], '"reason":"notice_query_failed"');
  }));

Deno.test('a rejected run is a "failed" line, and the waitUntil promise still resolves (no unhandled rejection)', () =>
  withEnv(async () => {
    const h = harness();
    await h.handler(post());
    h.run.reject(new Error('supabaseUrl is required.'));
    await h.handed[0]; // would throw here if it rejected
    assertEquals(h.logs, []);
    assertEquals(h.errors.length, 1);
    assertStringIncludes(h.errors[0], 'draft-order-notify failed');
    assertStringIncludes(h.errors[0], '"ok":false');
    assertStringIncludes(h.errors[0], 'supabaseUrl is required.');
  }));

Deno.test('a SYNCHRONOUS throw from run is logged too, and the handler still answers 202', () =>
  withEnv(async () => {
    const handed: Promise<unknown>[] = [];
    const errors: string[] = [];
    const handler = makeNotifyHandler({
      run: () => {
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

Deno.test('405 / 401 are answered synchronously and start no run', () =>
  withEnv(async () => {
    const h = harness();
    const get = await h.handler(new Request('http://localhost/draft-order-notify', { method: 'GET' }));
    assertEquals(get.status, 405);
    assertEquals(await get.json(), { ok: false, reason: 'method_not_allowed' });
    const bad = await h.handler(post({ apikey: 'wrong-key-same-len-xxxxxxx' }));
    assertEquals(bad.status, 401);
    assertEquals(await bad.json(), { error: 'Unauthorized' });
    const none = await h.handler(post({}));
    assertEquals(none.status, 401);
    await none.body?.cancel();
    assertEquals(h.calls.length, 0);
    assertEquals(h.handed.length, 0);
  }));

Deno.test('no cron key configured fails closed (401), no run started', () =>
  withEnv(async () => {
    const h = harness();
    const e = console.error;
    console.error = () => {};
    try {
      const res = await h.handler(post());
      assertEquals(res.status, 401);
      await res.body?.cancel();
    } finally {
      console.error = e;
    }
    assertEquals(h.calls.length, 0);
  }, { SB_SECRET_KEY_CRON: undefined }));

Deno.test('a missing service-role config is a synchronous 500, no run started', () =>
  withEnv(async () => {
    for (const missing of ['SUPABASE_URL', 'SB_SECRET_KEY_INTERNAL']) {
      await withEnv(async () => {
        const h = harness();
        const res = await h.handler(post());
        assertEquals(res.status, 500, missing);
        assertEquals(await res.json(), { error: 'server_config_error' });
        assertEquals(h.calls.length, 0);
        assertEquals(h.handed.length, 0);
      }, { [missing]: undefined });
    }
  }));
