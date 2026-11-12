/**
 * Wiring proof for draft-order-notify's respond-fast fix, run against the REAL
 * index.ts (not a copy): the cron's request is answered 202 while the run is
 * still waiting on the database, the run reaches EdgeRuntime.waitUntil, a
 * shutdown mid-run is logged, and the outcome is one log line when it ends.
 * Also: the SQL reclaim interval still equals plan.ts STALE_SENDING_MS (the
 * overlap proof in plan.ts rests on it).
 *
 * WHY (docs/STATUS.md §4 item 28): pg_net 0.14.0 holds every later cron post
 * behind a slow request; this function's request used to stay open for its
 * whole sequential send loop (~10-25 s, ~150 s on a hung Expo call).
 *
 * HOW: enrich_symbols_respond_fast.test.ts's pattern. Deno.serve is captured on
 * import, globalThis.EdgeRuntime is a spy, and globalThis.fetch is a fake
 * PostgREST whose calls HANG until the test releases them. No network.
 *
 * Run: deno test --allow-read --allow-env supabase/tests/draft_order_notify_respond_fast.test.ts
 */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { STALE_SENDING_MS } from '../functions/draft-order-notify/plan.ts';

const CRON_KEY = 'test-cron-key-not-a-secret';
const FAKE_ENV: Record<string, string> = {
  SB_SECRET_KEY_CRON: CRON_KEY,
  SUPABASE_URL: 'http://stub.supabase.test',
  SB_SECRET_KEY_INTERNAL: 'test-internal-key-not-a-secret',
};
const SAVED_ENV = new Map(Object.keys(FAKE_ENV).map((k) => [k, Deno.env.get(k)]));
for (const [k, v] of Object.entries(FAKE_ENV)) Deno.env.set(k, v);

type Handler = (req: Request) => Promise<Response>;

const handed: Promise<unknown>[] = [];
(globalThis as { EdgeRuntime?: unknown }).EdgeRuntime = {
  waitUntil: (p: Promise<unknown>) => {
    handed.push(p);
    return p;
  },
};

// Fake PostgREST: every call waits on `gate`; once released, rpcs return 0 and
// every select returns no rows (so the run delivers nothing and ends cleanly).
let release!: () => void;
let gate = new Promise<void>((r) => (release = r));
const seenPaths: string[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: Request | URL | string) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== 'stub.supabase.test') throw new Error(`unexpected network call: ${url.href}`);
  seenPaths.push(url.pathname);
  await gate;
  const body = url.pathname.startsWith('/rest/v1/rpc/') ? '0' : '[]';
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json', 'content-range': '*/0' } });
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
    await import(new URL('../functions/draft-order-notify/index.ts', import.meta.url).href);
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
  new Request('http://localhost/draft-order-notify', {
    method: 'POST',
    headers: { apikey: CRON_KEY, 'content-type': 'application/json' },
    body: '{}',
  });

Deno.test('real index.ts: 202 while the run is blocked on the DB; waitUntil gets the run; one outcome line', async () => {
  assert(handler, 'index.ts did not call Deno.serve');
  const c = captureConsole();
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const res = await Promise.race([
      handler(post()),
      new Promise<'timeout'>((r) => (timer = setTimeout(() => r('timeout'), 2000))),
    ]);
    clearTimeout(timer);
    assert(res !== 'timeout', 'index.ts did not answer while the run was blocked: it waited for the run');
    assertEquals(res.status, 202);
    assertEquals(await res.json(), { accepted: true });

    assertEquals(handed.length, 1, 'the run was not handed to EdgeRuntime.waitUntil');
    await new Promise((r) => setTimeout(r, 20));
    assert(seenPaths.includes('/rest/v1/rpc/open_due_draft_rooms'), `run never reached its first rpc (saw ${seenPaths})`);
    assertEquals(c.logs.filter((l) => l.startsWith('draft-order-notify')), [], 'outcome logged before the run ended');

    dispatchEvent(new CustomEvent('beforeunload', { detail: 'wall_clock' }));
    const term = c.errors.filter((l) => l.startsWith('draft-order-notify terminated'));
    assertEquals(term.length, 1, JSON.stringify(c.errors));
    assertStringIncludes(term[0], 'draft-order-notify terminated with a run in flight');
    assertStringIncludes(term[0], '"reason":"wall_clock"');

    release();
    await handed[0];
    const outcome = c.logs.filter((l) => l.startsWith('draft-order-notify '));
    assertEquals(outcome.length, 1, `expected one outcome line, got ${JSON.stringify(c.logs)}`);
    const parsed = JSON.parse(outcome[0].slice('draft-order-notify '.length));
    assertEquals(parsed.ok, true);
    assertEquals(parsed.examined, 0);
    assertEquals(parsed.outcomes, {});
    assertEquals(typeof parsed.duration_ms, 'number');

    const before = c.errors.length;
    dispatchEvent(new CustomEvent('beforeunload', { detail: 'termination' }));
    assertEquals(c.errors.length, before, 'nothing in flight any more: a shutdown logs nothing');
  } finally {
    c.restore();
  }
});

Deno.test('real index.ts: a failed notice select is an ok:false line on the error stream, not an unhandled rejection', async () => {
  assert(handler);
  const c = captureConsole();
  const before = handed.length;
  const okFetch = globalThis.fetch;
  globalThis.fetch = (async (input: Request | URL | string) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/rest/v1/league_notifications') {
      return new Response(JSON.stringify({ code: 'XX000', message: 'stub select failure' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('0', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const res = await handler(post());
    assertEquals(res.status, 202);
    await res.body?.cancel();
    assertEquals(handed.length, before + 1);
    await handed[before];
    const line = c.errors.filter((l) => l.startsWith('draft-order-notify {'));
    assertEquals(line.length, 1, `got ${JSON.stringify(c.errors)}`);
    assertStringIncludes(line[0], '"ok":false');
    assertStringIncludes(line[0], '"reason":"notice_query_failed"');
  } finally {
    globalThis.fetch = okFetch;
    c.restore();
  }
});

/** The latest migration (deferred/ excluded) that defines `fn`, and its body. */
async function latestDefinition(fn: string): Promise<{ file: string; body: string }> {
  const dir = new URL('../migrations/', import.meta.url);
  const names: string[] = [];
  for await (const e of Deno.readDir(dir)) if (e.isFile && e.name.endsWith('.sql')) names.push(e.name);
  let hit: { file: string; body: string } | null = null;
  for (const name of names.sort()) {
    const src = await Deno.readTextFile(new URL(name, dir));
    const m = new RegExp(`create or replace function public\\.${fn}\\(\\)[\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`, 'i').exec(src);
    if (m) hit = { file: name, body: m[1] };
  }
  if (!hit) throw new Error(`no migration defines ${fn}`);
  return hit;
}

Deno.test('the SQL stale-sending interval equals STALE_SENDING_MS (both due predicates)', async () => {
  assertEquals(STALE_SENDING_MS, 10 * 60 * 1000);
  for (const fn of ['draft_room_notices_due', 'draft_order_notify_due']) {
    const { file, body } = await latestDefinition(fn);
    const m = /push_status\s*=\s*'sending'\s+and\s+n\.push_attempted_at\s*<\s*now\(\)\s*-\s*interval\s*'(\d+) minutes'/.exec(body);
    assert(m, `${file}: ${fn} lost its stale-sending clause`);
    assertEquals(Number(m[1]) * 60 * 1000, STALE_SENDING_MS, `${file}: ${fn} interval != STALE_SENDING_MS`);
  }
});

Deno.test('restore env, fetch and EdgeRuntime', () => {
  globalThis.fetch = originalFetch;
  delete (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime;
  gate = Promise.resolve();
  for (const [k, v] of SAVED_ENV) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
});
