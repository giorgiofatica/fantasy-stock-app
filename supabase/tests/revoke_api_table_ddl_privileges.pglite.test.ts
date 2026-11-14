/**
 * supabase/migrations/20261205000200_revoke_api_table_ddl_privileges.sql (security brief 2026-11-13, LOW) against the
 * WHOLE migration chain on PGlite 0.3 = Postgres 17 (prod is 17.4), so MAINTAIN exists and the version-guarded branch
 * runs. The rest of the suite runs the chain on PGlite 0.2 (Postgres 16), where the same file must still apply.
 *
 * Proves:
 *   - anon and authenticated lose TRUNCATE / REFERENCES / TRIGGER / MAINTAIN on EVERY public relation, and a table
 *     created afterwards is born without them, while SELECT / INSERT / UPDATE / DELETE are exactly as before
 *     (per role, per table), and service_role keeps everything;
 *   - get_real_user_ids is pinned to `public, pg_temp`, with its body, SECURITY DEFINER and grants unchanged;
 *   - RLS-governed reads and writes still work for a member (and still refuse a stranger), TRUNCATE is refused.
 *
 *   deno test --allow-read --allow-env supabase/tests/revoke_api_table_ddl_privileges.pglite.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.3';
import { applyFrom, loadChain } from './full_chain.ts';

const VERSION = '20261205000200';
const API = ['anon', 'authenticated'] as const;
const DDL = ['TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] as const;
const DML = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;

const COMMISH = '00000000-0000-4000-8000-0000000000c1';
const MEMBER = '00000000-0000-4000-8000-0000000000c2';
const STRANGER = '00000000-0000-4000-8000-0000000000c3';

// deno-lint-ignore no-explicit-any
type Row = any;
type ChainDb = Parameters<typeof loadChain>[0];

/** Every public relation the revoke covers ('r','p','v','m','f'), with each API role's DML privileges. */
const DML_SQL = `
  select c.relname as rel, r.rolname as role, p.priv, has_table_privilege(r.rolname, c.oid, p.priv) as has
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated'), ('service_role')) r(rolname)
    cross join (values ${DML.map((p) => `('${p}')`).join(', ')}) p(priv)
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
   order by 1, 2, 3`;
const DDL_HELD_SQL = (roles: readonly string[]) => `
  select c.relname as rel, r.rolname as role, p.priv
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join (values ${roles.map((r) => `('${r}')`).join(', ')}) r(rolname)
    cross join (values ${DDL.map((p) => `('${p}')`).join(', ')}) p(priv)
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
     and has_table_privilege(r.rolname, c.oid, p.priv)
   order by 1, 2, 3`;
const FN_SQL = `select proconfig, prosrc, prosecdef, proacl::text as acl from pg_proc
  where oid = 'public.get_real_user_ids(text[])'::regprocedure`;

Deno.test({
  name: '20261205000200: API roles lose TRUNCATE/REFERENCES/TRIGGER/MAINTAIN, keep DML; get_real_user_ids pinned',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const db = new PGlite();
    const q = async (s: string, p: unknown[] = []) => (await db.query<Row>(s, p)).rows;
    async function as<T>(who: string | 'anon', fn: () => Promise<T>): Promise<T> {
      if (who === 'anon') await db.exec(`set role anon; reset request.jwt.claim.sub;`);
      else await db.exec(`set role authenticated; set request.jwt.claim.sub = '${who}';`);
      try {
        return await fn();
      } finally {
        await db.exec(`reset role; reset request.jwt.claim.sub;`);
      }
    }
    async function codeOf(fn: () => Promise<unknown>): Promise<string> {
      try {
        await fn();
        return 'ok';
      } catch (e) {
        return (e as { code?: string }).code ?? String(e);
      }
    }

    assert(Number((await q(`show server_version_num`))[0].server_version_num) >= 170000, 'this test needs Postgres 17');
    await loadChain(db as unknown as ChainDb, { untilBefore: VERSION });

    let dmlBefore: Row[] = [];
    let fnBefore: Row = null;
    await t.step('BEFORE: the Supabase defaults left anon/authenticated with TRUNCATE..MAINTAIN on most tables', async () => {
      const held = await q(DDL_HELD_SQL(API));
      const rels = new Set(held.map((r) => r.rel));
      assert(rels.has('leagues') && rels.has('trades') && rels.has('league_members'), [...rels].join(','));
      for (const p of DDL) assert(held.some((r) => r.rel === 'leagues' && r.role === 'anon' && r.priv === p), `anon ${p} on leagues`);
      dmlBefore = await q(DML_SQL);
      assert(new Set(dmlBefore.map((r) => r.rel)).size >= 30, 'the check must see the whole schema');
      fnBefore = (await q(FN_SQL))[0];
      assertEquals(fnBefore.proconfig, ['search_path=public']);
    });

    const applied = await applyFrom(db as unknown as ChainDb, VERSION);
    assertEquals(applied[0], `${VERSION}_revoke_api_table_ddl_privileges.sql`);

    await t.step('AFTER: no API role holds TRUNCATE / REFERENCES / TRIGGER / MAINTAIN on any public relation', async () => {
      assertEquals(await q(DDL_HELD_SQL(API)), []);
    });

    await t.step('AFTER: SELECT / INSERT / UPDATE / DELETE exactly as before, per role and table; service_role keeps DDL', async () => {
      assertEquals(await q(DML_SQL), dmlBefore);
      const sr = await q(DDL_HELD_SQL(['service_role']));
      for (const p of DDL) assert(sr.some((r) => r.rel === 'leagues' && r.priv === p), `service_role ${p} on leagues`);
    });

    await t.step('AFTER: a table postgres creates later keeps the DML defaults but is born without the DDL privileges', async () => {
      await db.exec(`create table public.later_table (id int primary key)`);
      for (const role of API) {
        for (const p of DML) assertEquals((await q(`select has_table_privilege('${role}', 'public.later_table', '${p}') v`))[0].v, true, `${role} ${p}`);
        for (const p of DDL) assertEquals((await q(`select has_table_privilege('${role}', 'public.later_table', '${p}') v`))[0].v, false, `${role} ${p}`);
      }
      assertEquals((await q(`select has_table_privilege('service_role', 'public.later_table', 'TRUNCATE') v`))[0].v, true);
      await db.exec(`drop table public.later_table`);
    });

    await t.step('AFTER: get_real_user_ids pinned to public, pg_temp; body, definer and grants unchanged', async () => {
      const after = (await q(FN_SQL))[0];
      assertEquals(after.proconfig, ['search_path=public, pg_temp']);
      assertEquals([after.prosrc, after.prosecdef, after.acl], [fnBefore.prosrc, fnBefore.prosecdef, fnBefore.acl]);
      assert(!/anon=|(^|[{,])=X/.test(after.acl), `no anon / PUBLIC execute: ${after.acl}`);
    });

    // ---- RLS-governed reads and writes, as the app makes them ------------------------------------------------
    for (const u of [COMMISH, MEMBER, STRANGER]) {
      await q(`insert into auth.users (id, email) values ($1, $2)`, [u, `${u.slice(-2)}@example.test`]);
    }
    const [{ id: L }] = await as(COMMISH, () => q(
      `insert into leagues (name, commissioner_id, invite_code, num_participants, league_type, draft_order_mode, draft_date)
       values ('Grants', $1, 'GRANTS01', 8, 'matchup', 'random', date_trunc('hour', now()) + interval '3 days') returning id`,
      [COMMISH],
    ));
    await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner'), ($1, $3, 'member')`, [L, COMMISH, MEMBER]);

    await t.step('a member still reads their league and its members; a stranger reads nothing', async () => {
      assertEquals((await as(MEMBER, () => q(`select name from leagues where id = $1`, [L]))).map((r) => r.name), ['Grants']);
      assertEquals((await as(MEMBER, () => q(`select user_id from league_members where league_id = $1 order by user_id`, [L]))).length, 2);
      assertEquals(await as(STRANGER, () => q(`select id from leagues where id = $1`, [L])), []);
      // anon is refused before RLS answers (it holds no EXECUTE on the policy's is_member(), 20261116000000).
      assertEquals(await codeOf(() => as('anon', () => q(`select id from leagues where id = $1`, [L]))), '42501');
    });

    await t.step('a member still writes their own rows; the commissioner still updates the league; RLS still refuses others', async () => {
      assertEquals(await codeOf(() => as(MEMBER, () => q(`insert into push_tokens (user_id, token) values ($1, 'ExponentPushToken[a]')`, [MEMBER]))), 'ok');
      assertEquals(await codeOf(() => as(MEMBER, () => q(`update push_tokens set token = 'ExponentPushToken[b]' where user_id = $1`, [MEMBER]))), 'ok');
      assertEquals((await as(MEMBER, () => q(`select token from push_tokens`)))[0].token, 'ExponentPushToken[b]');
      assertEquals(await codeOf(() => as(MEMBER, () => q(`delete from push_tokens where user_id = $1`, [MEMBER]))), 'ok');
      assertEquals(await codeOf(() => as(STRANGER, () => q(`insert into push_tokens (user_id, token) values ($1, 'x')`, [MEMBER]))), '42501');
      const renamed = await as(COMMISH, () => q(`update leagues set name = 'Grants 2' where id = $1 returning name`, [L]));
      assertEquals(renamed.map((r) => r.name), ['Grants 2']);
      assertEquals(await as(MEMBER, () => q(`update leagues set name = 'Hijack' where id = $1 returning name`, [L])), [], 'a member is not the commissioner');
    });

    await t.step('get_real_user_ids still answers the caller and their leaguemates only', async () => {
      const ids = await as(MEMBER, () => q(`select public.get_real_user_ids($1) r`, [[COMMISH, MEMBER, STRANGER]]));
      assertEquals([...(ids[0].r as string[])].sort(), [COMMISH, MEMBER].sort());
    });

    await t.step('TRUNCATE is refused to both API roles, even on a table RLS lets them write', async () => {
      for (const who of [MEMBER, 'anon']) {
        for (const tbl of ['push_tokens', 'leagues', 'trades', 'cron_job_status']) {
          assertEquals(await codeOf(() => as(who, () => q(`truncate public.${tbl}`))), '42501', `${who} truncate ${tbl}`);
        }
      }
      assertEquals((await q(`select count(*)::int n from leagues where id = $1`, [L]))[0].n, 1);
    });
  },
});
