// Hermetic: record-trade's claims hold (claims-hold.ts). The rule itself is SQL
// (claims_hold_active, 20261211000000) and is tested on real Postgres in
// supabase/tests/claims.pglite.test.ts; here, how record-trade reads it.
//   deno test supabase/functions/record-trade/claims-hold.test.ts
import { assertEquals } from 'jsr:@std/assert';
import { CLAIMS_PROCESSING, claimsHoldRefusal } from './claims-hold.ts';

const admin = (reply: () => Promise<{ data: unknown; error: unknown }>) => {
  const calls: Array<[string, unknown]> = [];
  return {
    calls,
    rpc: (fn: string, args: unknown) => {
      calls.push([fn, args]);
      return reply();
    },
  };
};

Deno.test('held: claims_processing (a 200 game-flow refusal body)', async () => {
  const a = admin(() => Promise.resolve({ data: true, error: null }));
  assertEquals(await claimsHoldRefusal(a, 'L1'), CLAIMS_PROCESSING);
  assertEquals(CLAIMS_PROCESSING, { ok: false, reason: 'claims_processing' });
  assertEquals(a.calls, [['claims_hold_active', { p_league_id: 'L1' }]]);
});

Deno.test('not held: the trade goes on', async () => {
  assertEquals(await claimsHoldRefusal(admin(() => Promise.resolve({ data: false, error: null })), 'L1'), null);
});

Deno.test('FAIL-OPEN: a resolved error, an odd reply or a throw never holds trading (and is logged)', async () => {
  for (const reply of [
    () => Promise.resolve({ data: null, error: { code: '42883' } }), // function missing (deploy before push)
    () => Promise.resolve({ data: 'yes', error: null }),
    () => Promise.reject(new Error('network')),
  ]) {
    const logged: unknown[] = [];
    assertEquals(await claimsHoldRefusal(admin(reply), 'L1', (...a) => logged.push(a)), null);
    assertEquals(logged.length, 1);
  }
});
