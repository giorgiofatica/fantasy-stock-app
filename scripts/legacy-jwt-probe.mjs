#!/usr/bin/env node
// Phase 4b probe (docs/plans/2026-11-16-revoke-legacy-jwt-secret.md, step 2b).
//
// Asks whether the exposed LEGACY service_role JWT is still honoured anywhere.
// It prints HTTP statuses, row/user COUNTS and sanitized error messages. It never
// prints a key, a token or any user data. Every request is read-only:
//   - REST: GET one id from cron_job_status. Only service_role can see that table,
//     so "rows 1" means the token was honoured as service_role.
//   - Functions: POST {} to symbol-name. That returns 400 "symbol required" only if
//     the caller got past both the gateway and the in-code check, and it reads nothing.
//   - Auth admin: GET one page of users. Only the COUNT is printed.
//   - Realtime: join a throwaway broadcast channel, then leave. Prints joined/refused.
//
// Usage (run from anywhere):
//   node scripts/legacy-jwt-probe.mjs            control lines only; no legacy key needed
//   node scripts/legacy-jwt-probe.mjs --legacy   also asks for the legacy service_role JWT
//                                                 at a HIDDEN prompt; paste it, press Enter
// Reveal the legacy key on the dashboard's legacy API keys page at the time you run it.
// Never save it to a file, and never paste it into a chat.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REF = 'haiaaifjcclsvmkfqgmd';
const BASE = `https://${REF}.supabase.co`;
const HERE = path.dirname(fileURLToPath(import.meta.url));
// The publishable key is public (it ships in the app). Look for it in, in order: the
// SB_PUBLISHABLE_KEY env var, then the repo's apps/web/.env.local and root .env, relative
// to this script and then to the current directory.
const ENV_FILES = [...new Set([path.resolve(HERE, '..'), process.cwd()])]
  .flatMap((root) => [path.join(root, 'apps/web/.env.local'), path.join(root, '.env')]);

const role = (t) => { try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).role ?? null; } catch { return null; } };
const clean = (s) => String(s ?? '').replace(/eyJ[\w.-]+/g, '[jwt]').replace(/sb_[a-z]+_[\w-]+/g, '[key]').slice(0, 120);
const msgOf = (j) => clean(j && typeof j === 'object' ? (j.message || j.msg || j.error_description || j.error || j.code || '') : '');

function publishableKey() {
  if (process.env.SB_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) return process.env.SB_PUBLISHABLE_KEY;
  for (const f of ENV_FILES) {
    let env = '';
    try { env = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const k = (env.match(/^(?:VITE_SUPABASE_PUBLISHABLE_KEY|SB_PUBLISHABLE_KEY)=\s*"?([^"\s]+)/m) || [])[1];
    if (k?.startsWith('sb_publishable_')) return k;
  }
  console.log('setup: no sb_publishable_ key found (set SB_PUBLISHABLE_KEY, or run from a checkout with apps/web/.env.local or .env)');
  process.exit(1);
}

function hiddenPrompt(label) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) { console.log('setup: --legacy needs an interactive terminal (hidden prompt)'); process.exit(1); }
    stdout.write(label);
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    let v = '';
    const onData = (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') { stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData); stdout.write('\n'); resolve(v.trim()); return; }
        if (c === '\u0003') { stdout.write('\n'); process.exit(130); }
        if (c === '\u007f') { v = v.slice(0, -1); continue; }
        v += c;
      }
    };
    stdin.on('data', onData);
  });
}

async function rest(name, headers, meaning) {
  const r = await fetch(`${BASE}/rest/v1/cron_job_status?select=id&limit=1`, { headers });
  let j = null; try { j = await r.json(); } catch { /* non-JSON body */ }
  const detail = Array.isArray(j) ? `rows ${j.length}` : `msg: ${msgOf(j)}`;
  console.log(`${name}: HTTP ${r.status}, ${detail}   (${meaning})`);
}

async function fn(name, headers, meaning) {
  const r = await fetch(`${BASE}/functions/v1/symbol-name`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' });
  let j = null; try { j = await r.json(); } catch { /* non-JSON body */ }
  console.log(`${name}: HTTP ${r.status}, msg: ${msgOf(j)}   (${meaning})`);
}

async function authAdmin(name, headers, meaning) {
  const r = await fetch(`${BASE}/auth/v1/admin/users?page=1&per_page=1`, { headers });
  let j = null; try { j = await r.json(); } catch { /* non-JSON body */ }
  const detail = r.ok ? `users on page ${Array.isArray(j?.users) ? j.users.length : '?'}` : `msg: ${msgOf(j)}`;
  console.log(`${name}: HTTP ${r.status}, ${detail}   (${meaning})`);
}

function realtime(name, apikey, accessToken, meaning) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`wss://${REF}.supabase.co/realtime/v1/websocket?apikey=${encodeURIComponent(apikey)}&vsn=1.0.0`);
    const topic = `realtime:probe-${Date.now()}`;
    let done = false;
    const finish = (line) => { if (done) return; done = true; console.log(`${name}: ${line}   (${meaning})`); try { ws.close(); } catch { /* closing */ } resolve(); };
    const timer = setTimeout(() => finish('no reply in 10 s'), 10000);
    ws.addEventListener('open', () => {
      const payload = { config: { broadcast: { self: false }, presence: { key: '' }, postgres_changes: [], private: false } };
      if (accessToken) payload.access_token = accessToken;
      ws.send(JSON.stringify({ topic, event: 'phx_join', payload, ref: '1', join_ref: '1' }));
    });
    ws.addEventListener('message', (ev) => {
      let m; try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (m.topic === topic && m.event === 'phx_reply' && m.ref === '1') {
        clearTimeout(timer);
        const ok = m.payload?.status === 'ok';
        finish(ok ? 'JOINED' : `REFUSED, msg: ${clean(m.payload?.response?.reason || m.payload?.response?.message || JSON.stringify(m.payload?.response ?? ''))}`);
      } else if (m.topic === topic && (m.event === 'phx_error' || m.event === 'system')) {
        const st = m.payload?.status;
        if (m.event === 'phx_error' || st === 'error') { clearTimeout(timer); finish(`REFUSED, msg: ${clean(m.payload?.message || m.event)}`); }
      }
    });
    ws.addEventListener('error', () => { clearTimeout(timer); finish('socket error (refused at connect)'); });
    ws.addEventListener('close', (ev) => { clearTimeout(timer); finish(`socket closed before a reply (code ${ev.code})`); });
  });
}

const pub = publishableKey();
const legacyMode = process.argv.includes('--legacy');
let legacy = null;
if (legacyMode) {
  legacy = await hiddenPrompt('Paste the legacy service_role key (hidden), then Enter: ');
  if (role(legacy) !== 'service_role') { console.log(`setup: that token's role is ${role(legacy) ?? 'unreadable'}, not service_role; nothing sent`); process.exit(1); }
}

console.log('captured', new Date().toISOString(), legacyMode ? '(legacy mode)' : '(control mode)');
await rest('C1 REST control    ', { apikey: pub }, 'expect 200, rows 0: publishable works, RLS holds');
await realtime('C2 Realtime control', pub, null, 'expect JOINED: Realtime works on the publishable key');
if (legacy) {
  const H = { apikey: pub, Authorization: `Bearer ${legacy}` };
  await rest('L1 REST apikey     ', { apikey: legacy, Authorization: `Bearer ${legacy}` }, 'refused = legacy key dead as an apikey');
  await rest('L2 REST Bearer     ', H, 'rows 1 = legacy JWT honoured as service_role');
  await fn('L3 Functions       ', H, '400 "symbol required" = got through; 401 = refused');
  await authAdmin('L4 Auth admin      ', H, '200 = admin API honours it (serious)');
  await realtime('L5 Realtime        ', pub, legacy, 'JOINED = Realtime still accepts the legacy JWT');
}
legacy = null;
