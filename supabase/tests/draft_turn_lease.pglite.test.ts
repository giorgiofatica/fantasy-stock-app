/**
 * 20261202000000: the sweep's per-turn lease (claim_draft_turn_lease) and the
 * outage-push claim (claim_outage_escalation), against REAL Postgres (PGlite =
 * Postgres 16 in WASM). NOT hermetic: the first run fetches
 * npm:@electric-sql/pglite. Run:
 *   deno test --allow-read --allow-env supabase/tests/draft_turn_lease.pglite.test.ts
 *
 * 20261101000003 (draft_turn_outages) and this migration are loaded VERBATIM onto a
 * minimal leagues table and Supabase's default privileges (EXECUTE and table grants
 * to anon AND authenticated, separately from PUBLIC), so the revokes are proven.
 *
 * PGlite is one connection, so true concurrency is not exercised here: the
 * one-winner property rests on INSERT ... ON CONFLICT DO UPDATE ... WHERE and a
 * filtered UPDATE both re-checking their WHERE on the row's latest version under
 * READ COMMITTED (the hermetic suites drive concurrent callers against a fake with
 * the same semantics). What this proves: the WHERE clauses themselves (a live lease
 * or claim refuses, an expired one is taken over, escalated_at closes the claim),
 * the TTL clamps, the named parameters the edge code sends, and the grants.
 *
 * Mutations these catch: the lease WHERE dropped (a live lease overwritten) or
 * made unsatisfiable (a lease that never expires); the clamp removed (a caller's
 * huge TTL); the claim's escalated_at or TTL condition dropped.
 */
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.2';
import { OUTAGE_RETRY_MS } from '../functions/_shared/auto-pick.ts';
import { OUTAGE_PUSH_CLAIM_TTL_S } from '../functions/_shared/draft-write.ts';
import { TURN_LEASE_TTL_MS } from '../functions/_shared/turn-lease.ts';

const ROOT = new URL('../../', import.meta.url);
const OUTAGES = 'supabase/migrations/20261101000003_draft_price_outages.sql';
const MINE = 'supabase/migrations/20261202000000_draft_turn_lease_and_escalation_claim.sql';
const CADENCE = 'supabase/migrations/20261201000000_autopick_sweep_fast_cadence.sql';
const LEASE_SIG = 'public.claim_draft_turn_lease(uuid, integer, uuid, integer)';
const CLAIM_SIG = 'public.claim_outage_escalation(uuid, integer, uuid, integer)';
const L = '00000000-0000-4000-8000-000000000001';
const H1 = '00000000-0000-4000-8000-0000000000a1';
const H2 = '00000000-0000-4000-8000-0000000000a2';

const SCHEMA = `
create role anon; create role authenticated; create role service_role;
alter role service_role bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create table public.leagues (id uuid primary key);
`;

// deno-lint-ignore no-explicit-any
type Row = any;

Deno.test({
  name: '20261202000000: turn lease + outage-push claim on real Postgres (PGlite)',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const db = new PGlite();
    const q = async (s: string, p: unknown[] = []) => (await db.query(s, p)).rows as Row[];
    const as = async <T>(role: string, fn: () => Promise<T>): Promise<T> => {
      await db.exec(`set role ${role}`);
      try {
        return await fn();
      } finally {
        await db.exec('reset role').catch(() => {});
      }
    };
    // Named parameters, exactly as supabase-js .rpc() sends them through PostgREST.
    const claimLease = (pick: number, holder: string, ttlMs: number) =>
      as('service_role', () =>
        q(`select public.claim_draft_turn_lease(p_league_id => $1::uuid, p_pick_number => $2, p_holder => $3::uuid, p_ttl_ms => $4) as ok`, [L, pick, holder, ttlMs])
      ).then((r) => r[0].ok as boolean);
    const claimPush = (pick: number, claim: string, ttlS: number) =>
      as('service_role', () =>
        q(`select public.claim_outage_escalation(p_league_id => $1::uuid, p_pick_number => $2, p_claim => $3::uuid, p_ttl_seconds => $4) as ok`, [L, pick, claim, ttlS])
      ).then((r) => r[0].ok as boolean);
    const lease = async (pick: number) => (await q(`select holder::text, extract(epoch from (expires_at - now())) as left_s from public.draft_turn_leases where league_id = $1 and pick_number = $2`, [L, pick]))[0];
    const outage = async (pick: number) => (await q(`select * from public.draft_turn_outages where league_id = $1 and pick_number = $2`, [L, pick]))[0];

    await db.exec(SCHEMA);
    await db.exec(`insert into public.leagues values ('${L}')`);
    await db.exec(await Deno.readTextFile(new URL(OUTAGES, ROOT)));
    const migration = await Deno.readTextFile(new URL(MINE, ROOT));
    await db.exec(migration);

    await t.step('grants: both functions and the lease table are service_role only', async () => {
      for (const sig of [LEASE_SIG, CLAIM_SIG]) {
        const p = (await q(`select has_function_privilege('anon', '${sig}', 'EXECUTE') as a,
                                   has_function_privilege('authenticated', '${sig}', 'EXECUTE') as u,
                                   has_function_privilege('service_role', '${sig}', 'EXECUTE') as s`))[0];
        assertEquals([p.a, p.u, p.s], [false, false, true], sig);
      }
      for (const fn of ['claim_draft_turn_lease', 'claim_outage_escalation']) {
        const acl = String((await q(`select proacl::text as acl from pg_proc where proname = $1`, [fn]))[0].acl);
        assert(!/(^|[{,])anon=/.test(acl) && !/(^|[{,])authenticated=/.test(acl) && !/(^|[{,])=X/.test(acl), `${fn}: ${acl}`);
      }
      for (const role of ['anon', 'authenticated']) {
        await assertRejects(() => as(role, () => q(`select public.claim_draft_turn_lease($1::uuid, 1, $2::uuid, 1000)`, [L, H1])), Error, 'permission denied');
        await assertRejects(() => as(role, () => q(`select public.claim_outage_escalation($1::uuid, 1, $2::uuid, 60)`, [L, H1])), Error, 'permission denied');
        await assertRejects(() => as(role, () => q(`select * from public.draft_turn_leases`)), Error, 'permission denied');
      }
      const rls = (await q(`select relrowsecurity from pg_class where relname = 'draft_turn_leases'`))[0];
      assertEquals(rls.relrowsecurity, true);
    });

    await t.step('lease: the first claim wins; a second holder (or the same one) is refused while it is live', async () => {
      assertEquals(await claimLease(1, H1, TURN_LEASE_TTL_MS), true);
      assertEquals(await claimLease(1, H2, TURN_LEASE_TTL_MS), false);
      assertEquals(await claimLease(1, H1, TURN_LEASE_TTL_MS), false, 'one attempt per lease');
      assertEquals((await lease(1)).holder, H1);
      const left = Number((await lease(1)).left_s);
      assert(left > TURN_LEASE_TTL_MS / 1000 - 5 && left <= TURN_LEASE_TTL_MS / 1000, `expires in ~TTL, got ${left}`);
      assertEquals(await claimLease(2, H2, TURN_LEASE_TTL_MS), true, 'another turn is independent');
    });

    await t.step('lease: an EXPIRED lease (a dead holder) is taken over by the next claim', async () => {
      await q(`update public.draft_turn_leases set expires_at = now() - interval '1 millisecond' where pick_number = 1`);
      assertEquals(await claimLease(1, H2, TURN_LEASE_TTL_MS), true);
      assertEquals((await lease(1)).holder, H2);
      assert(Number((await lease(1)).left_s) > 50, 're-armed for the new holder');
    });

    await t.step('lease: the holder-scoped release (what releaseTurnLease sends) only deletes its own row', async () => {
      await as('service_role', () => q(`delete from public.draft_turn_leases where league_id = $1 and pick_number = 1 and holder = $2`, [L, H1]));
      assertEquals((await lease(1))?.holder, H2, 'the old holder cannot release the new owner');
      await as('service_role', () => q(`delete from public.draft_turn_leases where league_id = $1 and pick_number = 1 and holder = $2`, [L, H2]));
      assertEquals(await lease(1), undefined);
      assertEquals(await claimLease(1, H1, TURN_LEASE_TTL_MS), true, 'released: claimable at once');
    });

    await t.step('lease: the TTL is clamped to [1 s, 120 s] (no caller writes a lease that outlives a stuck draft)', async () => {
      assertEquals(await claimLease(10, H1, 2_000_000_000), true);
      assert(Number((await lease(10)).left_s) <= 120, `clamped high: ${(await lease(10)).left_s}`);
      assertEquals(await claimLease(11, H1, 0), true);
      const low = Number((await lease(11)).left_s);
      assert(low > 0.5 && low <= 1, `clamped low: ${low}`);
    });

    await t.step('lease: a league delete cascades its leases', async () => {
      const L2 = '00000000-0000-4000-8000-000000000002';
      await q(`insert into public.leagues values ($1)`, [L2]);
      await as('service_role', () => q(`select public.claim_draft_turn_lease($1::uuid, 1, $2::uuid, 60000)`, [L2, H1]));
      await q(`delete from public.leagues where id = $1`, [L2]);
      assertEquals((await q(`select count(*)::int as n from public.draft_turn_leases where league_id = $1`, [L2]))[0].n, 0);
    });

    await t.step('push claim: one winner while unescalated; escalated_at closes it for good', async () => {
      await q(`insert into public.draft_turn_outages (league_id, pick_number, first_seen_at, last_seen_at) values ($1, 5, now() - interval '6 minutes', now())`, [L]);
      assertEquals(await claimPush(5, H1, OUTAGE_PUSH_CLAIM_TTL_S), true);
      assertEquals(await claimPush(5, H2, OUTAGE_PUSH_CLAIM_TTL_S), false, 'a live claim refuses');
      assertEquals((await outage(5)).escalation_claim, H1);
      await q(`update public.draft_turn_outages set escalated_at = now() where pick_number = 5`);
      await q(`update public.draft_turn_outages set escalation_claimed_at = now() - interval '1 day' where pick_number = 5`);
      assertEquals(await claimPush(5, H2, OUTAGE_PUSH_CLAIM_TTL_S), false, 'sent: never again, even with an old claim');
    });

    await t.step('push claim: a released claim (push not sent) or an expired one (claimer died) is claimable again', async () => {
      await q(`insert into public.draft_turn_outages (league_id, pick_number) values ($1, 6)`, [L]);
      assertEquals(await claimPush(6, H1, OUTAGE_PUSH_CLAIM_TTL_S), true);
      // noteOutage's release, verbatim in shape: scoped to its own claim.
      await as('service_role', () => q(`update public.draft_turn_outages set escalation_claim = null, escalation_claimed_at = null where league_id = $1 and pick_number = 6 and escalation_claim = $2`, [L, H1]));
      assertEquals(await claimPush(6, H2, OUTAGE_PUSH_CLAIM_TTL_S), true);
      await q(`update public.draft_turn_outages set escalation_claimed_at = now() - make_interval(secs => $1) where pick_number = 6`, [OUTAGE_PUSH_CLAIM_TTL_S]);
      assertEquals(await claimPush(6, H1, OUTAGE_PUSH_CLAIM_TTL_S), true, 'expired claim taken over');
      assertEquals((await outage(6)).escalation_claim, H1);
    });

    await t.step('push claim: no outage row, nothing to claim; the TTL is clamped to >= 5 s', async () => {
      assertEquals(await claimPush(99, H1, OUTAGE_PUSH_CLAIM_TTL_S), false);
      await q(`insert into public.draft_turn_outages (league_id, pick_number) values ($1, 7)`, [L]);
      assertEquals(await claimPush(7, H1, 0), true);
      await q(`update public.draft_turn_outages set escalation_claimed_at = now() - interval '4 seconds' where pick_number = 7`);
      assertEquals(await claimPush(7, H2, 0), false, 'a 0 s TTL is read as 5 s');
    });

    await t.step('the migration re-applies cleanly; grants unchanged; rows kept', async () => {
      await db.exec(migration);
      for (const sig of [LEASE_SIG, CLAIM_SIG]) {
        const p = (await q(`select has_function_privilege('anon', '${sig}', 'EXECUTE') as a, has_function_privilege('authenticated', '${sig}', 'EXECUTE') as u`))[0];
        assertEquals([p.a, p.u], [false, false]);
      }
      assertEquals((await outage(6)).escalation_claim, H1);
    });
  },
});

Deno.test('OUTAGE_RETRY_MS (the server-side outage window) equals the cron outage throttle', async () => {
  const sql = (await Deno.readTextFile(new URL(CADENCE, ROOT))).split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
  const m = sql.match(/draft_turn_outages t[\s\S]*?last_seen_at > now\(\) - interval '(\d+) seconds'/);
  assert(m, 'the cron outage throttle is in the latest schedule');
  assertEquals(Number(m[1]) * 1000, OUTAGE_RETRY_MS);
});

Deno.test('the edge code sends the parameter names the SQL declares', async () => {
  const lease = await Deno.readTextFile(new URL('supabase/functions/_shared/turn-lease.ts', ROOT));
  const write = await Deno.readTextFile(new URL('supabase/functions/_shared/draft-write.ts', ROOT));
  assert(/rpc\('claim_draft_turn_lease', \{\s*p_league_id:[^}]*p_pick_number:[^}]*p_holder:[^}]*p_ttl_ms:/.test(lease), 'claim_draft_turn_lease args');
  assert(/rpc\('claim_outage_escalation', \{\s*p_league_id:[^}]*p_pick_number:[^}]*p_claim:[^}]*p_ttl_seconds:/.test(write), 'claim_outage_escalation args');
  assert(/from\('draft_turn_leases'\)\s*\.delete\(\)[\s\S]{0,200}\.eq\('holder', holder\)/.test(lease), 'the release is holder-scoped');
});
