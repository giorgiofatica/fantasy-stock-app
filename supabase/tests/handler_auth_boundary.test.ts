/**
 * Phase 4b, step 1 (docs/plans/2026-11-16-revoke-legacy-jwt-secret.md): the 12
 * user-facing functions run with verify_jwt = false, so each HANDLER is the auth
 * boundary. This file proves that boundary per function, not by sample, against
 * the REAL index.ts files.
 *
 * HOW: Deno.serve is captured on import (the cron_status_handlers /
 * market_data_guards pattern), and globalThis.fetch is replaced by a fake
 * network. The ONE request a refused caller may cause is the identity question
 * to the sign-in server (GET /auth/v1/user). EVERY other request is recorded as
 * a side effect: a PostgREST read or write, an rpc (the rate-limit counters
 * are rpcs), an Alpaca call, a push send to Expo, any other GoTrue call.
 *
 * For each function, each of these callers must get OUR 401 (the function's own
 * not_authenticated body, not the gateway's) with ZERO side effects:
 *   - no Authorization header at all;
 *   - only the public app key (as the apikey header alone; as the Bearer, which
 *     is what supabase-js sends with no session);
 *   - a legacy anon-role JWT (no sub);
 *   - an expired user token;
 *   - a service_role-role JWT (no sub: there is no user behind it);
 *   - a forged token that LOOKS like a live user (sub, role authenticated,
 *     future exp, ES256 + kid like the new signing keys) but was never issued;
 *   - a real user token while the sign-in server is unreachable (fail closed).
 * And a real signed-in user must get past the check (the negative control:
 * without it a handler that refused everyone would pass the above).
 *
 * WHAT THIS CAN AND CANNOT PROVE. Every token here is fabricated (base64url
 * JSON + a junk signature); no real key is used or needed. The fake sign-in
 * server models GoTrue: it knows exactly ONE issued session token and refuses
 * everything else with GoTrue's own error shapes (an expired token, a token with
 * no sub claim, a bad signature). So these tests prove the HANDLER half: every
 * function asks the sign-in server, forwards the caller's header unchanged,
 * never decides from the token's own claims, and treats any refusal or outage as
 * a 401 before doing anything. That GoTrue itself refuses a service_role or
 * expired token is GoTrue's server behaviour, which no hermetic test can run;
 * it is the property the plan's step-2 deploy check and step-7 probe exercise
 * in prod.
 *
 * Run: deno test --allow-read --allow-env supabase/tests/handler_auth_boundary.test.ts
 * (part of `deno test --allow-read --allow-env supabase/tests/`).
 */
import { assert, assertEquals, assertFalse, assertNotEquals } from 'jsr:@std/assert';

const URL_ = 'http://stub.supabase.test';
const PUBLISHABLE = 'sb_publishable_test-not-a-secret';
const USER_ID = '00000000-0000-4000-8000-0000000000aa';
const LEAGUE_ID = '00000000-0000-4000-8000-0000000000bb';
const OTHER_ID = '00000000-0000-4000-8000-0000000000cc';

// ---------------------------------------------------------------------------
// Fabricated tokens (never real keys: a junk signature over test claims)
// ---------------------------------------------------------------------------

const b64url = (o: unknown) =>
  btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const fakeJwt = (header: Record<string, unknown>, payload: Record<string, unknown>, sig = 'not-a-real-signature') =>
  `${b64url(header)}.${b64url(payload)}.${sig}`;
const now = () => Math.floor(Date.now() / 1000);

/** The one session token the fake sign-in server "issued". */
const USER_JWT = fakeJwt(
  { alg: 'ES256', kid: 'test-kid', typ: 'JWT' },
  { sub: USER_ID, role: 'authenticated', aud: 'authenticated', exp: now() + 3600, session_id: 's1' },
  'issued-by-the-fake-gotrue',
);
const ANON_JWT = fakeJwt({ alg: 'HS256', typ: 'JWT' }, { iss: 'supabase', role: 'anon', exp: now() + 3600 });
const SERVICE_ROLE_JWT = fakeJwt({ alg: 'HS256', typ: 'JWT' }, { iss: 'supabase', role: 'service_role', exp: now() + 3600 });
const EXPIRED_JWT = fakeJwt(
  { alg: 'ES256', kid: 'test-kid', typ: 'JWT' },
  { sub: USER_ID, role: 'authenticated', aud: 'authenticated', exp: now() - 60, session_id: 's0' },
);
const FORGED_USER_JWT = fakeJwt(
  { alg: 'ES256', kid: 'test-kid', typ: 'JWT' },
  { sub: USER_ID, role: 'authenticated', aud: 'authenticated', exp: now() + 3600, session_id: 's1' },
  'forged-signature',
);

const FAKE_ENV: Record<string, string> = {
  SUPABASE_URL: URL_,
  SB_PUBLISHABLE_KEY: PUBLISHABLE,
  SB_SECRET_KEY_INTERNAL: 'sb_secret_test-not-a-secret',
  ALPACA_API_KEY: 'test-alpaca-id',
  ALPACA_API_SECRET: 'test-alpaca-secret',
};
const SAVED_ENV = new Map(Object.keys(FAKE_ENV).map((k) => [k, Deno.env.get(k)]));

// ---------------------------------------------------------------------------
// Fake network
// ---------------------------------------------------------------------------

class Net {
  /** every request that is NOT the identity question */
  sideEffects: string[] = [];
  /** the Authorization header each identity question carried */
  identityAsks: Array<string | null> = [];
  gotrueDown = false;
}

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });

/** GoTrue's GET /user, modelled: one issued token is a user; the rest are refused
 * with GoTrue's own shapes. It decodes only to pick the REAL error message. */
function gotrueUser(authorization: string | null): Response {
  const token = (authorization ?? '').replace(/^Bearer\s+/i, '');
  if (token === USER_JWT) {
    return json({
      id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'player@example.test',
      identities: [{ provider: 'email', id: USER_ID, identity_data: { sub: USER_ID } }],
    });
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return json({ code: 401, error_code: 'bad_jwt', msg: 'invalid JWT: unable to parse or verify signature, token is malformed' }, 401);
  }
  let claims: Record<string, unknown> = {};
  try { claims = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { /* malformed */ }
  if (typeof claims.exp === 'number' && claims.exp < now()) {
    return json({ code: 403, error_code: 'bad_jwt', msg: 'invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired' }, 403);
  }
  if (!claims.sub) return json({ code: 403, error_code: 'bad_jwt', msg: 'invalid claim: missing sub claim' }, 403);
  return json({ code: 403, error_code: 'bad_jwt', msg: 'invalid JWT: unable to parse or verify signature, signature is invalid' }, 403);
}

function install(net: Net): () => void {
  const original = globalThis.fetch;
  // async so the "GoTrue unreachable" throw rejects the promise, as a real fetch does.
  // deno-lint-ignore require-await
  globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(req.url);
    if (url.origin === URL_ && url.pathname === '/auth/v1/user' && req.method === 'GET') {
      net.identityAsks.push(req.headers.get('Authorization'));
      if (net.gotrueDown) throw new TypeError('connection refused');
      return gotrueUser(req.headers.get('Authorization'));
    }
    // Everything else is a side effect. Answer plausibly so a handler that got
    // past its check keeps going (the control proves it did).
    net.sideEffects.push(`${req.method} ${url.host}${url.pathname}`);
    if (url.pathname.startsWith('/rest/v1/rpc/')) return json(true);
    if (url.pathname.startsWith('/rest/v1/')) {
      const single = (req.headers.get('accept') ?? '').includes('vnd.pgrst.object');
      return single ? json(null) : new Response('[]', { status: 200, headers: { 'content-type': 'application/json', 'content-range': '*/0' } });
    }
    if (url.hostname === 'data.alpaca.markets') return json({ trade: { p: 200 }, bars: {}, trades: {}, next_page_token: null });
    if (url.pathname.startsWith('/auth/v1/')) return json({ code: 400, msg: 'refused by fake' }, 400);
    return json({});
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

// ---------------------------------------------------------------------------
// Handler loading
// ---------------------------------------------------------------------------

type Handler = (req: Request) => Promise<Response>;
const handlers = new Map<string, Handler>();

async function load(fn: string): Promise<Handler> {
  const cached = handlers.get(fn);
  if (cached) return cached;
  let captured: Handler | undefined;
  const original = Deno.serve;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (h: Handler) => { captured = h; return {}; };
  try {
    await import(new URL(`../functions/${fn}/index.ts`, import.meta.url).href);
  } finally {
    Deno.serve = original;
  }
  assert(captured, `${fn}: index.ts did not call Deno.serve`);
  handlers.set(fn, captured);
  return captured;
}

async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const o = { log: console.log, error: console.error, warn: console.warn };
  console.log = console.error = console.warn = () => {};
  try { return await fn(); } finally { Object.assign(console, o); }
}

async function call(
  fn: string,
  body: unknown,
  headers: Record<string, string>,
  setup?: (n: Net) => void,
): Promise<{ status: number; body: Record<string, unknown>; net: Net }> {
  for (const [k, v] of Object.entries(FAKE_ENV)) Deno.env.set(k, v);
  const h = await load(fn);
  const net = new Net();
  setup?.(net);
  const restore = install(net);
  try {
    const res = await quiet(() => h(new Request('http://localhost/fn', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7', ...headers },
      body: JSON.stringify(body),
    })));
    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(text); } catch { parsed = { _raw: text }; }
    return { status: res.status, body: parsed, net };
  } finally {
    restore();
  }
}

// ---------------------------------------------------------------------------
// The 12, each with a request that WOULD do work if the check were missing
// ---------------------------------------------------------------------------

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

/** body: a well-formed request; our401: the function's own refusal body. */
const FUNCTIONS: Array<{ fn: string; body: unknown; our401: Record<string, unknown> }> = [
  { fn: 'quote', body: { symbol: 'AAPL' }, our401: { error: 'not_authenticated', message: 'Please sign in.' } },
  { fn: 'historical-bars', body: { symbols: ['AAPL'], start: daysAgo(5) }, our401: { error: 'not_authenticated', message: 'Please sign in.' } },
  { fn: 'symbols-search', body: { q: 'AAPL' }, our401: { error: 'not_authenticated', message: 'Please sign in.' } },
  { fn: 'symbol-name', body: { symbol: 'AAPL' }, our401: { error: 'not_authenticated', message: 'Please sign in.' } },
  { fn: 'preview-league', body: { code: 'ABC123' }, our401: { error: 'not_authenticated', message: 'Please sign in to view this league.' } },
  { fn: 'join-league', body: { code: 'ABC123' }, our401: { error: 'not_authenticated', message: 'Please sign in to join a league.' } },
  { fn: 'leave-league', body: { action: 'leave', league_id: LEAGUE_ID }, our401: { ok: false, reason: 'not_authenticated' } },
  { fn: 'delete-account', body: { proof: { kind: 'password', password: 'test-password-not-real' } }, our401: { ok: false, reason: 'not_authenticated' } },
  { fn: 'draft-control', body: { league_id: LEAGUE_ID, action: 'start' }, our401: { ok: false, reason: 'not_authenticated' } },
  { fn: 'validate-and-record-pick', body: { league_id: LEAGUE_ID, symbol: 'AAPL' }, our401: { ok: false, reason: 'not_authenticated' } },
  { fn: 'record-trade', body: { league_id: LEAGUE_ID, symbol: 'AAPL', action: 'buy' }, our401: { ok: false, reason: 'not_authenticated' } },
  { fn: 'send-notification', body: { type: 'draft_turn', league_id: LEAGUE_ID, target_user_id: OTHER_ID }, our401: { error: 'not_authenticated' } },
];

const REFUSED_CALLERS: Array<{ label: string; headers: Record<string, string>; setup?: (n: Net) => void; asks: boolean }> = [
  { label: 'no Authorization header', headers: {}, asks: false },
  { label: 'only the public app key (apikey header, no Authorization)', headers: { apikey: PUBLISHABLE }, asks: false },
  { label: 'the public app key as the Bearer (supabase-js with no session)', headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${PUBLISHABLE}` }, asks: true },
  { label: 'a legacy anon-role JWT (no sub)', headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${ANON_JWT}` }, asks: true },
  { label: 'an expired user token', headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${EXPIRED_JWT}` }, asks: true },
  { label: 'a service_role-role JWT (no user behind it)', headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${SERVICE_ROLE_JWT}` }, asks: true },
  { label: 'a forged live-looking user token (never issued)', headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${FORGED_USER_JWT}` }, asks: true },
  {
    label: 'a real user token while the sign-in server is unreachable (fail closed)',
    headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${USER_JWT}` },
    setup: (n) => { n.gotrueDown = true; },
    asks: true,
  },
];

for (const { fn, body, our401 } of FUNCTIONS) {
  Deno.test({
    name: `auth boundary (verify_jwt=false): ${fn}`,
    sanitizeResources: false,
    sanitizeOps: false,
    async fn(t) {
      await t.step('control: a real signed-in user gets past the check', async () => {
        const r = await call(fn, body, { apikey: PUBLISHABLE, Authorization: `Bearer ${USER_JWT}` });
        assertNotEquals(r.status, 401, `${fn} refused the real user: ${JSON.stringify(r.body)}`);
        assertFalse(r.body.error === 'not_authenticated' || r.body.reason === 'not_authenticated');
        assertEquals(r.net.identityAsks, [`Bearer ${USER_JWT}`], 'asked the sign-in server once, with the caller header unchanged');
        assert(r.net.sideEffects.length > 0, `${fn}: the control did no work past the check, so it proves nothing`);
      });

      for (const c of REFUSED_CALLERS) {
        await t.step(`${c.label} → our 401, zero side effects`, async () => {
          const r = await call(fn, body, c.headers, c.setup);
          assertEquals(r.status, 401, `${fn}: ${JSON.stringify(r.body)}`);
          assertEquals(r.body, our401, `${fn}: not the function's own refusal body`);
          assertEquals(r.net.sideEffects, [], `${fn} did work for a caller it refused`);
          // A caller with a token must have been put to the sign-in server, not
          // judged from its own claims; no token may skip the question entirely.
          if (c.asks) assertEquals(r.net.identityAsks.length, 1, `${fn} did not ask the sign-in server`);
          else assert(r.net.identityAsks.length <= 1);
        });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Config: the 12 are verify_jwt = false, and this file covers exactly them
// ---------------------------------------------------------------------------

/** [functions.<name>] -> verify_jwt, read from supabase/config.toml. */
function verifyJwtByFunction(): Map<string, boolean> {
  const toml = Deno.readTextFileSync(new URL('../config.toml', import.meta.url));
  const out = new Map<string, boolean>();
  let current: string | null = null;
  for (const raw of toml.split('\n')) {
    const line = raw.trim();
    const section = /^\[functions\.([a-z0-9-]+)\]$/.exec(line);
    if (section) { current = section[1]; continue; }
    if (line.startsWith('[')) { current = null; continue; }
    const v = /^verify_jwt\s*=\s*(true|false)\s*$/.exec(line);
    if (current && v) out.set(current, v[1] === 'true');
  }
  return out;
}

Deno.test('config.toml: the 12 user-facing functions are verify_jwt = false (the handler is the boundary)', () => {
  const cfg = verifyJwtByFunction();
  for (const { fn } of FUNCTIONS) {
    assertEquals(cfg.get(fn), false, `${fn}: expected verify_jwt = false in supabase/config.toml`);
  }
  assertEquals(FUNCTIONS.length, 12);
});

Deno.test('config.toml: NO function relies on the gateway check any more', () => {
  // A function added later with verify_jwt = true would depend on a gateway check
  // that may refuse new-signed sessions after the rotation. It must be false with
  // its own in-code check (added to FUNCTIONS above, or a cron apikey guard).
  const on = [...verifyJwtByFunction()].filter(([, v]) => v).map(([k]) => k);
  assertEquals(on, []);
});

Deno.test('every deployed function folder has a config.toml block (the repo, not the dashboard, is the truth)', () => {
  const cfg = verifyJwtByFunction();
  const folders = [...Deno.readDirSync(new URL('../functions/', import.meta.url))]
    .filter((e) => e.isDirectory && !e.name.startsWith('_'))
    .map((e) => e.name).sort();
  for (const f of folders) assert(cfg.has(f), `${f} has no [functions.${f}] verify_jwt line in config.toml`);
});

// Put the developer's env back after every test in this file has run.
globalThis.addEventListener('unload', () => {
  for (const [k, v] of SAVED_ENV) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
});
