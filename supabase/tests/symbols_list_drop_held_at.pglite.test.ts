/**
 * symbols.list_drop_held_at + list_dropped_at (supabase/migrations/20261212100000_symbols_list_drop_held_at.sql)
 * on the WHOLE migration chain (full_chain.ts), PGlite 0.3 = Postgres 17 like prod.
 *
 * What it proves:
 *   - both columns are timestamptz, nullable, no default, and every existing row starts NULL;
 *   - the table ACL and the column allow list (symbol, name, is_draftable) are
 *     byte-identical before and after: no API role can read or write either column;
 *     a signed-in read of each is refused by the GRANT check (42501 "permission denied");
 *   - enrich-symbols' two writes work as service_role: a hold (enriched_at +
 *     list_drop_held_at only) does NOT bump updated_at; a normal write that
 *     clears the mark does when a real value changes;
 *   - setting list_dropped_at alone does not bump updated_at either;
 *   - the one read per run (stocks that left the list in the past 24 h) counts a
 *     recent departure, including one back on the list, and not an older one;
 *   - re-applying the migration is clean;
 *   - the post-push effect test (docs/security/2026-11-24-symbols-list-drop-held-at-checks.sql,
 *     block 4) passes here, and FAILS once a column is missing or granted to authenticated.
 *
 * Run: deno test --allow-read --allow-env supabase/tests/symbols_list_drop_held_at.pglite.test.ts
 */
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.3';
import { loadChain, readMigration } from './full_chain.ts';

const NAME = '20261212100000_symbols_list_drop_held_at.sql';
const VERSION = '20261212100000';
const CHECKS_URL = new URL('../../docs/security/2026-11-24-symbols-list-drop-held-at-checks.sql', import.meta.url);

// deno-lint-ignore no-explicit-any
type Row = any;

/** Block 4 of the checks file: the `do $$ ... end $$;` after "4. Effect test". */
function effectBlock(checks: string): string {
  const at = checks.indexOf('4. Effect test');
  assert(at >= 0, 'checks file has block 4');
  const start = checks.indexOf('do $$', at);
  const end = checks.indexOf('end $$;', start) + 'end $$;'.length;
  const block = checks.slice(start, end);
  assert(start > at && block.startsWith('do $$') && block.endsWith('end $$;'), 'found the effect block');
  return block;
}

Deno.test({
  name: 'symbols.list_drop_held_at on the full chain (PGlite 0.3 = Postgres 17)',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const db = new PGlite();
    const q = async (s: string, p: unknown[] = []) => (await db.query<Row>(s, p)).rows;
    const relacl = async () => (await q(`select relacl::text as acl from pg_class where oid = 'public.symbols'::regclass`))[0].acl as string;
    const colAcls = async () =>
      (await q(`select attname, attacl::text as acl from pg_attribute
                 where attrelid = 'public.symbols'::regclass and attacl is not null and not attisdropped
                 order by attname`)).map((r) => `${r.attname}:${r.acl}`);
    const chainDb = db as unknown as Parameters<typeof loadChain>[0];

    await loadChain(chainDb, { untilBefore: VERSION });
    await q(`insert into public.symbols (symbol, name, exchange, is_etf, active, is_draftable, last_price, market_cap, enriched_at)
             values ('QHLD', 'Held Co', 'NYSE', false, true, true, 40, 5e9, now() - interval '3 days'),
                    ('QOTH', 'Other Co', 'NYSE', false, true, true, 40, 5e9, now() - interval '3 days')`);
    const aclBefore = await relacl();
    const colsBefore = await colAcls();

    await db.exec(await readMigration(NAME));

    await t.step('both columns: timestamptz, nullable, no default; existing rows start not held, not dropped', async () => {
      for (const col of ['list_drop_held_at', 'list_dropped_at']) {
        const [c] = await q(`select data_type, is_nullable, column_default from information_schema.columns
                              where table_schema = 'public' and table_name = 'symbols' and column_name = $1`, [col]);
        assertEquals(c, { data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null }, col);
        const [{ n }] = await q(`select count(*)::int n from public.symbols where ${col} is not null`);
        assertEquals(n, 0, col);
      }
    });

    await t.step('grants unchanged: table ACL and the three-column allow list are byte-identical', async () => {
      assertEquals(await relacl(), aclBefore);
      assertEquals(await colAcls(), colsBefore);
      assertEquals(colsBefore.map((c) => c.split(':')[0]), ['is_draftable', 'name', 'symbol']);
    });

    await t.step('a signed-in read of the column is refused by the GRANT check; the allowed columns still read', async () => {
      await db.exec('set role authenticated');
      try {
        await assertRejects(() => q(`select list_drop_held_at from public.symbols limit 1`), Error, 'permission denied for table symbols');
        await assertRejects(() => q(`select list_dropped_at from public.symbols limit 1`), Error, 'permission denied for table symbols');
        const rows = await q(`select symbol, name, is_draftable from public.symbols order by symbol`);
        assertEquals(rows.length, 2);
      } finally {
        await db.exec('reset role');
      }
      await db.exec('set role anon');
      try {
        await assertRejects(() => q(`select list_drop_held_at from public.symbols limit 1`), Error, 'permission denied');
        await assertRejects(() => q(`select list_dropped_at from public.symbols limit 1`), Error, 'permission denied');
      } finally {
        await db.exec('reset role');
      }
    });

    await t.step('a hold (cursor + mark only) as service_role does not bump updated_at', async () => {
      const [before] = await q(`select updated_at::text u from public.symbols where symbol = 'QHLD'`);
      await db.exec('set role service_role');
      try {
        await q(`update public.symbols set enriched_at = now(), list_drop_held_at = now() where symbol in ('QHLD')`);
      } finally {
        await db.exec('reset role');
      }
      const [after] = await q(`select updated_at::text u, list_drop_held_at is not null held, is_draftable, market_cap::float8 mc
                                 from public.symbols where symbol = 'QHLD'`);
      assertEquals(after.u, before.u);
      assertEquals([after.held, after.is_draftable, after.mc], [true, true, 5e9]);
    });

    await t.step('setting list_dropped_at alone does not bump updated_at', async () => {
      const [before] = await q(`select updated_at::text u from public.symbols where symbol = 'QOTH'`);
      await db.exec('set role service_role');
      try {
        await q(`update public.symbols set list_dropped_at = now() where symbol = 'QOTH'`);
      } finally {
        await db.exec('reset role');
      }
      const [after] = await q(`select updated_at::text u from public.symbols where symbol = 'QOTH'`);
      assertEquals(after.u, before.u);
    });

    await t.step('the one read per run counts departures in the past 24 h (one back on the list too), not older ones', async () => {
      const dropsInWindow = async () =>
        (await q(`select count(*)::int n from public.symbols where list_dropped_at > now() - interval '24 hours'`))[0].n;
      // QOTH left an instant ago and is (still, in this fixture) on the list: it counts.
      assertEquals(await dropsInWindow(), 1);
      await q(`update public.symbols set list_dropped_at = now() - interval '25 hours' where symbol = 'QOTH'`);
      assertEquals(await dropsInWindow(), 0);
      const idx = await q(`select indexname from pg_indexes where indexname like 'symbols_list_drop%' order by 1`);
      assertEquals(idx.map((r) => r.indexname), ['symbols_list_drop_held_at_idx', 'symbols_list_dropped_at_idx']);
    });

    await t.step('a normal write that clears the mark works as service_role, and a real change bumps updated_at', async () => {
      const [before] = await q(`select updated_at::text u from public.symbols where symbol = 'QHLD'`);
      await db.exec('set role service_role');
      try {
        await q(`update public.symbols set last_price = 41, list_drop_held_at = null, enriched_at = now() where symbol = 'QHLD'`);
      } finally {
        await db.exec('reset role');
      }
      const [r] = await q(`select list_drop_held_at, last_price::float8 p, updated_at::text u from public.symbols where symbol = 'QHLD'`);
      assertEquals([r.list_drop_held_at, r.p], [null, 41]);
      assert(r.u !== before.u, 'a real price change bumps updated_at');
    });

    await t.step('re-applying the migration is clean', async () => {
      await db.exec(await readMigration(NAME));
      assertEquals(await relacl(), aclBefore);
    });

    await t.step('the post-push effect test passes, and fails once the column is granted to authenticated', async () => {
      const block = effectBlock(await Deno.readTextFile(CHECKS_URL));
      await db.exec(block); // raises on any FAIL
      for (const col of ['list_drop_held_at', 'list_dropped_at']) {
        await db.exec(`alter table public.symbols rename column ${col} to x_gone`);
        await assertRejects(() => db.exec(block), Error, 'FAIL', `${col} gone`);
        await db.exec(`alter table public.symbols rename column x_gone to ${col}`);
      }
      await db.exec(`grant select (list_dropped_at) on public.symbols to authenticated`);
      await assertRejects(() => db.exec(block), Error, 'FAIL');
      await db.exec(`revoke select (list_dropped_at) on public.symbols from authenticated`);
      await db.exec(`grant select (list_drop_held_at) on public.symbols to authenticated`);
      await assertRejects(() => db.exec(block), Error, 'FAIL');
      await db.exec(`revoke select (list_drop_held_at) on public.symbols from authenticated`);
      await db.exec(block);
    });
  },
});
