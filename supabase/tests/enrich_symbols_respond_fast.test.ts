/**
 * Wiring proof for enrich-symbols' respond-fast fix, run against the REAL
 * index.ts (not a copy): the cron's HTTP request is answered 202 while the
 * batch is still waiting on the database, the batch promise reaches
 * EdgeRuntime.waitUntil, and the outcome is one log line when it ends.
 *
 * WHY (docs/STATUS.md §4 item 28): pg_net 0.14.0 holds every later cron post
 * behind a slow request, and enrich-symbols' request used to stay open for the
 * whole ~20-55 s batch, delaying the 2 s auto-pick sweep at every :x0.
 *
 * HOW: Deno.serve is captured on import (cron_status_handlers.test.ts pattern),
 * globalThis.EdgeRuntime is a spy, and globalThis.fetch is a fake PostgREST
 * whose `symbols` reads HANG until the test releases them. No network.
 *
 * Run: deno test --allow-read --allow-env supabase/tests/enrich_symbols_respond_fast.test.ts
 */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';

const CRON_KEY = 'test-cron-key-not-a-secret';
const FAKE_ENV: Record<string, string> = {
  SB_SECRET_KEY_CRON: CRON_KEY,
  SUPABASE_URL: 'http://stub.supabase.test',
  SB_SECRET_KEY_INTERNAL: 'test-internal-key-not-a-secret',
  FINNHUB_API_KEY: 'test-finnhub-not-a-secret',
  ALPACA_API_KEY: 'test-alpaca-id',
  ALPACA_API_SECRET: 'test-alpaca-secret',
};
const SAVED_ENV = new Map(Object.keys(FAKE_ENV).map((k) => [k, Deno.env.get(k)]));
for (const [k, v] of Object.entries(FAKE_ENV)) Deno.env.set(k, v);

type Handler = (req: Request) => Promise<Response>;

// EdgeRuntime spy, installed before the import and read at call time by index.ts.
const handed: Promise<unknown>[] = [];
(globalThis as { EdgeRuntime?: unknown }).EdgeRuntime = {
  waitUntil: (p: Promise<unknown>) => {
    handed.push(p);
    return p;
  },
};

// Fake PostgREST: every `symbols` read waits on `gate`; once released, every
// table reads as empty (so the batch selects 0 rows and ends cleanly).
let release!: () => void;
let gate = new Promise<void>((r) => (release = r));
const seenPaths: string[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: Request | URL | string) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== 'stub.supabase.test') throw new Error(`unexpected network call: ${url.href}`);
  seenPaths.push(url.pathname);
  await gate;
  return new Response('[]', { status: 200, headers: { 'content-type': 'application/json', 'content-range': '*/0' } });
}) as typeof fetch;

let handler: Handler | undefined;
{
  const original = Deno.serve;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (h: Handler) => {
    handler = h;
    return {};
  };
  try {
    await import(new URL('../functions/enrich-symbols/index.ts', import.meta.url).href);
  } finally {
    Deno.serve = original;
  }
}

function captureConsole() {
  const logs: string[] = [];
  const errors: string[] = [];
  const [l, e] = [console.log, console.error];
  console.log = (...a: unknown[]) => logs.push(a.map(String).join(' '));
  console.error = (...a: unknown[]) => errors.push(a.map(String).join(' '));
  return { logs, errors, restore: () => ((console.log = l), (console.error = e)) };
}

const post = () =>
  new Request('http://localhost/enrich-symbols', {
    method: 'POST',
    headers: { apikey: CRON_KEY, 'content-type': 'application/json' },
    body: '{}',
  });

Deno.test('real index.ts: 202 while the batch is blocked on the DB; waitUntil gets the batch; one outcome line', async () => {
  assert(handler, 'index.ts did not call Deno.serve');
  const c = captureConsole();
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const res = await Promise.race([
      handler(post()),
      new Promise<'timeout'>((r) => (timer = setTimeout(() => r('timeout'), 2000))),
    ]);
    clearTimeout(timer);
    assert(res !== 'timeout', 'index.ts did not answer while the batch was blocked: it waited for the batch');
    assertEquals(res.status, 202);
    assertEquals(await res.json(), { accepted: true, batch_limit: 50 });

    assertEquals(handed.length, 1, 'the batch promise was not handed to EdgeRuntime.waitUntil');
    // Let the batch reach its first query, then show it is still parked there.
    await new Promise((r) => setTimeout(r, 20));
    assert(seenPaths.includes('/rest/v1/symbols'), `batch never reached the symbols select (saw ${seenPaths})`);
    assertEquals(c.logs.filter((l) => l.startsWith('enrich-symbols')), [], 'outcome logged before the batch ended');

    // While it is in flight, a runtime shutdown is logged (a wall-clock kill
    // would otherwise leave no outcome line at all).
    dispatchEvent(new CustomEvent('beforeunload', { detail: 'wall_clock' }));
    assertEquals(c.errors.length, 1);
    assertStringIncludes(c.errors[0], 'enrich-symbols terminated with a batch in flight');
    assertStringIncludes(c.errors[0], '"reason":"wall_clock"');

    release();
    await handed[0];
    const outcome = c.logs.filter((l) => l.startsWith('enrich-symbols '));
    assertEquals(outcome.length, 1, `expected one outcome line, got ${JSON.stringify(c.logs)}`);
    const parsed = JSON.parse(outcome[0].slice('enrich-symbols '.length));
    assertEquals(parsed.ok, true);
    assertEquals(parsed.batch, 0);

    // Nothing in flight any more: a shutdown now logs nothing.
    dispatchEvent(new CustomEvent('beforeunload', { detail: 'termination' }));
    assertEquals(c.errors.length, 1);
  } finally {
    c.restore();
  }
});

Deno.test('real index.ts: a failed batch-selection query is a logged failure, not an unhandled rejection', async () => {
  assert(handler);
  const c = captureConsole();
  const before = handed.length;
  const okFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ code: 'XX000', message: 'stub select failure' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
  try {
    const res = await handler(post());
    assertEquals(res.status, 202);
    await res.body?.cancel();
    assertEquals(handed.length, before + 1);
    await handed[before]; // resolves: runInBackground never rejects
    const failed = c.errors.filter((l) => l.startsWith('enrich-symbols failed'));
    assertEquals(failed.length, 1, `got ${JSON.stringify(c.errors)}`);
    assertStringIncludes(failed[0], 'select_failed (priority)');
    assertStringIncludes(failed[0], 'stub select failure');
  } finally {
    globalThis.fetch = okFetch;
    c.restore();
  }
});

Deno.test('restore env, fetch and EdgeRuntime', () => {
  globalThis.fetch = originalFetch;
  delete (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime;
  gate = Promise.resolve();
  for (const [k, v] of SAVED_ENV) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
});
