/**
 * 20261130000000_retire_service_role_key_helpers on the WHOLE migration chain
 * (full_chain.ts), so the "nothing else reads service_role_key" claim is made
 * over every function and cron job the migrations create, not a replica.
 *
 *   - before the file: both helpers exist, and the migration header's PRE-PUSH
 *     query (parsed out of the file, so header and test cannot drift) returns
 *     EXACTLY the two helpers;
 *   - after it: both are gone, the header's POST-PUSH query returns 0 rows,
 *     no function body in any non-system schema names `service_role_key`, and
 *     trigger_week_end_snapshot (already on cron_apikey) is untouched;
 *   - re-applying is a no-op (DROP ... IF EXISTS);
 *   - guard 1 refuses (and drops nothing) when a cron job or another function
 *     still calls a helper; guard 2 refuses, and the drop rolls back with it,
 *     when a public function still reads the secret.
 *
 *   deno test --allow-read --allow-env --allow-sys supabase/tests/retire_service_role_key_helpers.pglite.test.ts
 */
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.2';
import { applyFrom, loadChain, readMigration } from './full_chain.ts';

// deno-lint-ignore no-explicit-any
type Row = any;

const MIG = '20261130000000_retire_service_role_key_helpers.sql';
const VER = '20261130000000';
const HELPERS = ['public.trigger_week_processing()', 'public.trigger_week_snapshot()'];

/** The commented-out query between two header markers, with the `-- ` prefix stripped. */
async function headerQuery(startMarker: string, endMarker: string): Promise<string> {
  const src = await readMigration(MIG);
  const i = src.indexOf(startMarker);
  const j = src.indexOf(endMarker, i);
  assert(i >= 0 && j > i, `markers not found: ${startMarker} .. ${endMarker}`);
  const lines = src.slice(i, j).split('\n')
    .map((l) => l.replace(/^--\s?/, ''))
    .filter((l) => /^\s+(SELECT|UNION|WHERE)\b/.test(l));
  assert(lines.length === 4, `expected the 4-line reader query, got:\n${lines.join('\n')}`);
  return lines.join('\n');
}

async function chainBefore(): Promise<PGlite> {
  const db = new PGlite();
  await loadChain(db, { untilBefore: VER });
  return db;
}
const rows = async (db: PGlite, sql: string) => (await db.query(sql)).rows as Row[];
const exists = async (db: PGlite, sig: string) =>
  (await rows(db, `select to_regprocedure('${sig}') is not null as v`))[0].v as boolean;
const applyMine = async (db: PGlite) => db.exec(await readMigration(MIG));

Deno.test({
  name: `${MIG}: pre-push = exactly the two helpers; post-push = 0 rows; nothing else reads the secret`,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const pre = await headerQuery('PRE-PUSH', 'POST-PUSH');
    const db = await chainBefore();

    for (const sig of HELPERS) assert(await exists(db, sig), `${sig} should exist before ${VER}`);
    const definer = await rows(db, `select p.proname, p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('trigger_week_processing','trigger_week_snapshot') order by 1`);
    assertEquals(definer.map((r) => [r.proname, r.prosecdef]),
      [['trigger_week_processing', true], ['trigger_week_snapshot', true]]);

    assertEquals((await rows(db, pre)).map((r) => [r.kind, r.name]).sort(), [
      ['function', 'public.trigger_week_processing'],
      ['function', 'public.trigger_week_snapshot'],
    ], 'the PRE-PUSH query must find exactly the two helpers and nothing else');

    // The sibling helper is NOT a reader: it moved to cron_apikey in 20260612000000.
    const endSrc = (await rows(db, `select prosrc from pg_proc where oid = to_regprocedure('public.trigger_week_end_snapshot()')`))[0].prosrc as string;
    assert(/'cron_apikey'/.test(endSrc) && !/service_role_key/i.test(endSrc));

    const applied = await applyFrom(db, VER);
    assertEquals(applied[0], MIG);

    for (const sig of HELPERS) assertEquals(await exists(db, sig), false, `${sig} should be gone after ${VER}`);
    assertEquals(await rows(db, pre), [], 'the POST-PUSH query must return 0 rows');

    // Stated independently of the header query: no function body anywhere
    // outside the system catalogs, and no cron command, names the secret.
    assertEquals(await rows(db, `select n.nspname || '.' || p.proname as f from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where p.prosrc ~* 'service_role_key' and n.nspname not in ('pg_catalog','information_schema')`), []);
    assertEquals(await rows(db, `select jobname from cron.job where command ~* 'service_role_key'`), []);

    assert(await exists(db, 'public.trigger_week_end_snapshot()'), 'trigger_week_end_snapshot must survive');
    assertEquals(await rows(db, `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('trigger_week_processing','trigger_week_snapshot')`), [],
      'no overload of either name survives');

    await applyMine(db); // IF EXISTS: re-running is a no-op, not an error
    await db.close();
  },
});

Deno.test({
  name: `${MIG}: guard 1 refuses while a cron job or a function still calls a helper, and drops nothing`,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const db = await chainBefore();

    await db.exec(`select cron.schedule('manual-week', '0 0 * * 0', $$ select public.trigger_week_processing(); $$)`);
    await assertRejects(() => applyMine(db), Error, 'still called by: cron:manual-week');
    for (const sig of HELPERS) assert(await exists(db, sig), `${sig} must survive a refused run`);
    await db.exec(`select cron.unschedule('manual-week')`);

    await db.exec(`create function public.admin_kick() returns bigint language sql as $$ select public.trigger_week_snapshot() $$`);
    await assertRejects(() => applyMine(db), Error, 'still called by: function:public.admin_kick');
    for (const sig of HELPERS) assert(await exists(db, sig), `${sig} must survive a refused run`);
    await db.exec(`drop function public.admin_kick()`);

    // The end-of-week helper's name must not trip the guard (prefix-alike, different function).
    await db.exec(`select cron.schedule('manual-end', '0 0 * * 0', $$ select public.trigger_week_end_snapshot(); $$)`);
    await applyMine(db);
    for (const sig of HELPERS) assertEquals(await exists(db, sig), false);
    await db.close();
  },
});

Deno.test({
  name: `${MIG}: guard 2 refuses while a public function still reads service_role_key, and the drop rolls back`,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const db = await chainBefore();
    await db.exec(`create function public.legacy_reader() returns text language sql as
      $$ select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' $$`);

    await assertRejects(() => applyMine(db), Error, 'still read by: function:public.legacy_reader');
    // One multi-statement file = one implicit transaction on the simple protocol
    // (and db push runs each file in its own transaction): the DROPs before the
    // failing guard did not stick.
    for (const sig of HELPERS) assert(await exists(db, sig), `${sig} must be restored when guard 2 refuses`);
    await db.close();
  },
});
