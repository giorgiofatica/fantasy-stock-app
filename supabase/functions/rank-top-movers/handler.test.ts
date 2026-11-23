// Hermetic: the HTTP edge of rank-top-movers. 405 / 401 / 500 answered synchronously; an
// authorized call answers 202 at once and hands the run to waitUntil without awaiting it.
//   deno test --allow-env supabase/functions/rank-top-movers/
import { assert, assertEquals } from 'jsr:@std/assert';
import { makeRankHandler, type RankConfig } from './handler.ts';
import type { RankResult } from './run.ts';

const ENV = {
  SB_SECRET_KEY_CRON: 'cron-test-key',
  SUPABASE_URL: 'http://localhost:54321',
  SB_SECRET_KEY_INTERNAL: 'internal-test-key',
  ALPACA_API_KEY: 'alpaca-test-key',
  ALPACA_API_SECRET: 'alpaca-test-secret',
};

async function withEnv(env: Record<string, string | undefined>, fn: () => Promise<void>) {
  const saved = new Map(Object.keys(env).map((k) => [k, Deno.env.get(k)]));
  for (const [k, v] of Object.entries(env)) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
  try {
    await fn();
  } finally {
    for (const [k, v] of saved) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
  }
}

function setup() {
  const handed: Promise<unknown>[] = [];
  const runs: RankConfig[] = [];
  let release: (r: RankResult) => void = () => {};
  const lines: unknown[][] = [];
  const handler = makeRankHandler({
    waitUntil: (p) => handed.push(p),
    run: (cfg) => {
      runs.push(cfg);
      return new Promise<RankResult>((res) => (release = res));
    },
    log: (...a) => lines.push(a),
    logError: (...a) => lines.push(['ERR', ...a]),
  });
  return { handler, handed, runs, lines, release: (r: RankResult) => release(r) };
}

const post = (headers: Record<string, string> = {}) =>
  new Request('http://x/rank-top-movers', { method: 'POST', headers });

Deno.test('405 for a GET, 401 without or with a wrong key; nothing handed to the runtime', async () => {
  await withEnv(ENV, async () => {
    const s = setup();
    assertEquals((await s.handler(new Request('http://x', { method: 'GET' }))).status, 405);
    assertEquals((await s.handler(post())).status, 401);
    assertEquals((await s.handler(post({ apikey: 'wrong' }))).status, 401);
    assertEquals([s.handed.length, s.runs.length], [0, 0]);
  });
});

Deno.test('fails closed when the cron secret is unset', async () => {
  await withEnv({ ...ENV, SB_SECRET_KEY_CRON: undefined }, async () => {
    const s = setup();
    assertEquals((await s.handler(post({ apikey: '' }))).status, 401);
    assertEquals(s.handed.length, 0);
  });
});

Deno.test('500 when any config is missing; nothing handed to the runtime', async () => {
  for (const missing of ['SUPABASE_URL', 'SB_SECRET_KEY_INTERNAL', 'ALPACA_API_KEY', 'ALPACA_API_SECRET']) {
    await withEnv({ ...ENV, [missing]: undefined }, async () => {
      const s = setup();
      const res = await s.handler(post({ apikey: ENV.SB_SECRET_KEY_CRON }));
      assertEquals(res.status, 500, missing);
      assertEquals(await res.json(), { error: 'server_config_error' });
      assertEquals(s.handed.length, 0);
    });
  }
});

Deno.test('authorized: 202 at once, the run in the background, one outcome line when it ends', async () => {
  await withEnv(ENV, async () => {
    const s = setup();
    const res = await s.handler(post({ apikey: ENV.SB_SECRET_KEY_CRON }));
    // Answered while the run is still pending.
    assertEquals(res.status, 202);
    assertEquals(await res.json(), { accepted: true });
    assertEquals(s.handed.length, 1);
    assertEquals(s.runs, [{ url: ENV.SUPABASE_URL, key: ENV.SB_SECRET_KEY_INTERNAL, alpacaKey: ENV.ALPACA_API_KEY, alpacaSecret: ENV.ALPACA_API_SECRET }]);
    assertEquals(s.lines.length, 0, 'no outcome before the run ends');
    s.release({ ok: false, ranking: 'partial' } as RankResult);
    await s.handed[0];
    assertEquals(s.lines.length, 1);
    assertEquals(s.lines[0][0], 'ERR', 'a partial run goes to the error stream');
    assertEquals(s.lines[0][1], 'rank-top-movers');
    assert(String(s.lines[0][2]).includes('"ranking":"partial"'));
  });
});
