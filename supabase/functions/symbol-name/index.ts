// supabase/functions/symbol-name/index.ts
// One stock's display name (the stock sheet, useStockNames).
//
// AUTH (Phase 4b, docs/plans/2026-11-16-revoke-legacy-jwt-secret.md): the
// gateway's verify_jwt is OFF, so THIS handler is the boundary. A real
// signed-in user (auth.getUser via _shared/market-guard.ts resolveUser) is
// required before the body is read or the symbols table is touched; anyone
// else (no header, the public key, an expired token, a service_role token,
// which has no user) gets our 401, not a 500. Before 2026-11-16 there was no
// check here: a caller with no user reached the read and got 500 "Failed to
// lookup symbol" from the table grant.
//
// NO RATE LIMIT, deliberately (unlike symbols-search): this function spends
// no supplier quota, and every signed-in user can already read the same
// symbols row directly through PostgREST, so a limit here would protect
// nothing while adding a fail-closed dependency (a limiter outage would blank
// stock names). It also keeps this caller-scoped reader free of the secret key
// (supabase/tests/symbols_readers.test.ts).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { REFUSAL, resolveUser } from '../_shared/market-guard.ts';

let requestOrigin = '';

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  // Allow any vercel.app subdomain (production and previews)
  if (origin.endsWith('.vercel.app') && origin.startsWith('https://')) return true;
  if (origin.startsWith('http://localhost:')) return true;
  return false;
}

function getCorsHeaders() {
  const allowedOrigin = isAllowedOrigin(requestOrigin) ? requestOrigin : 'https://fantasy-stock-app.vercel.app';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...getCorsHeaders() } });

Deno.serve(async (req) => {
  requestOrigin = req.headers.get('Origin') || '';

  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders() });

  // The boundary, before the body is read or any DB call.
  const user = await resolveUser(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SB_PUBLISHABLE_KEY') ?? '',
    req.headers.get('Authorization'),
  );
  if (!user) return json(REFUSAL.not_authenticated.body, REFUSAL.not_authenticated.status);

  const { symbol } = await req.json().catch(() => ({}));
  const sym = String(symbol || '').toUpperCase();
  if (!sym) return json({ error: 'symbol required' }, 400);

  // Query AS THE CALLER (publishable key + the caller's JWT), never as bare
  // anon and never with the secret key: symbols is signed-in only
  // (20261114000000), so an anon-JWT caller is refused by the table grant.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SB_PUBLISHABLE_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data, error } = await supabase.from('symbols').select('name').eq('symbol', sym).maybeSingle();

  if (error) return json({ error: 'Failed to lookup symbol' }, 500);
  return json({ ok: !!data, symbol: sym, name: data?.name ?? null });
});
