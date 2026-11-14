/**
 * 20261205000000: a signed-in player reads symbols' symbol, name and is_draftable
 * only (S1, docs/security/2026-11-13-brief-security-check.md), on the WHOLE
 * migration chain (full_chain.ts), not a replica.
 *
 * PGlite 0.3 = Postgres 17, deliberately (the rest of supabase/tests/ is on 0.2 =
 * Postgres 16): prod is 17.4 and its live ACL was `authenticated=rm`. MAINTAIN (m)
 * only exists from 17, so a 16 replica cannot show the leftover privilege this
 * migration removes. The chain up to 20261204000000 reproduces prod's ACL exactly
 * (asserted in BEFORE), which is the evidence the replica is the right one.
 *
 * What it proves, as each role (42501 from a GRANT check reads "permission denied
 * for table symbols"; the functions' own refusals read "not authenticated" / "not a
 * member", so the two are told apart, CLAUDE.md's grant-vs-raise trap):
 *   - authenticated reads symbol, name, is_draftable; every other column is
 *     refused, as a select, as a filter, and as select *; it holds no table-level
 *     privilege at all (no MAINTAIN, TRUNCATE, REFERENCES, TRIGGER);
 *   - anon and PUBLIC hold nothing: every column refused, every new function refused;
 *   - every caller-scoped reader still works: the symbols-search / symbol-name
 *     queries, and get_portfolio_ledger (SECURITY INVOKER);
 *   - count_slot_matches equals the count the old client made itself
 *     (categoryData.countSlotMatches before this change), and is rate-limited;
 *   - symbols_enrichment_progress returns the two totals;
 *   - get_league_pick_industries answers a member, for that league's picks only;
 *   - the source guard: no other SECURITY INVOKER function an API role may run
 *     reads symbols (a new one would run with the column grant and must be checked);
 *   - re-applying is clean, and clears a column grant made since.
 *
 * Run: deno test --allow-read --allow-env supabase/tests/symbols_column_grant.pglite.test.ts
 */
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.3';
import { applyFrom, loadChain, readMigration } from './full_chain.ts';

const MIG = '20261205000000_symbols_column_grant.sql';
const VERSION = '20261205000000';

const C = '00000000-0000-4000-8000-0000000000c1'; // commissioner, member of L
const M = '00000000-0000-4000-8000-0000000000c2'; // member of L
const X = '00000000-0000-4000-8000-0000000000c3'; // signed in, in no league
const L = '00000000-0000-4000-8000-00000000a001';
const L2 = '00000000-0000-4000-8000-00000000a002';

const GRANTED = ['is_draftable', 'name', 'symbol'];
const REFUSED_COLS = ['last_price', 'last_price_at', 'market_cap', 'gics_industry', 'gics_sector', 'enriched_at',
  'active', 'exchange', 'is_etf', 'updated_at', 'price_unsupported'];
const DENIED = 'permission denied for table symbols';

// deno-lint-ignore no-explicit-any
type Row = any;

interface Sym { symbol: string; name: string; is_draftable: boolean; last_price: number | null; gics_industry: string | null; active: boolean; enriched: boolean }
const SYMS: Sym[] = [
  { symbol: 'QAPL', name: 'Apple Inc.', is_draftable: true, last_price: 200, gics_industry: 'ZZ Technology', active: true, enriched: true },
  { symbol: 'QMSF', name: 'Microsoft', is_draftable: true, last_price: 400, gics_industry: 'ZZ Technology', active: true, enriched: true },
  { symbol: 'QNVD', name: 'NVIDIA', is_draftable: true, last_price: 120, gics_industry: 'ZZ Semiconductors', active: true, enriched: true },
  { symbol: 'QJPM', name: 'JPMorgan', is_draftable: true, last_price: 150, gics_industry: 'ZZ Banking', active: true, enriched: true },
  { symbol: 'QBAC', name: 'Bank of America', is_draftable: true, last_price: 40, gics_industry: 'ZZ Banking', active: true, enriched: true },
  // Overridden into Finance although its industry rules it Tech: overrides REPLACE the rule.
  { symbol: 'QPYP', name: 'PayPal', is_draftable: true, last_price: 70, gics_industry: 'ZZ Technology', active: true, enriched: true },
  { symbol: 'QNOP', name: 'No price yet', is_draftable: true, last_price: null, gics_industry: 'ZZ Technology', active: true, enriched: false },
  { symbol: 'QTNY', name: 'Tiny Co', is_draftable: false, last_price: 2, gics_industry: 'ZZ Technology', active: true, enriched: true },
  { symbol: 'QGON', name: 'Delisted', is_draftable: false, last_price: null, gics_industry: null, active: false, enriched: false },
];
const TECH_INDUSTRIES = ['ZZ Technology', 'ZZ Semiconductors'];
const FIN_INDUSTRIES = ['ZZ Banking'];
const OVERRIDES: Record<string, 'tech' | 'fin'> = { QPYP: 'fin' };

/** The old client's count (apps/mobile/lib/categoryData.ts countSlotMatches before 20261205000000), over the fixture. */
function oldClientCount(min: number | null, max: number | null, cat: 'tech' | 'fin' | null): number {
  const base = SYMS.filter((s) => s.is_draftable &&
    (min == null || (s.last_price != null && s.last_price >= min)) &&
    (max == null || (s.last_price != null && s.last_price <= max)));
  if (!cat) return base.length;
  const industries = cat === 'tech' ? TECH_INDUSTRIES : FIN_INDUSTRIES;
  const overridden = new Set(Object.keys(OVERRIDES));
  const rule = base.filter((s) => s.gics_industry != null && industries.includes(s.gics_industry) && !overridden.has(s.symbol)).length;
  const ovr = base.filter((s) => OVERRIDES[s.symbol] === cat).length;
  return rule + ovr;
}

Deno.test({
  name: '20261205000000: symbols column grant on the full chain (PGlite 0.3 = Postgres 17)',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const db = new PGlite();
    const q = async (s: string, p: unknown[] = []) => (await db.query<Row>(s, p)).rows;
    async function as<T>(role: 'anon' | 'authenticated' | 'service_role', sub: string | null, fn: () => Promise<T>): Promise<T> {
      await db.exec(`set role ${role}`);
      await db.exec(`select set_config('request.jwt.claim.sub', '${sub ?? ''}', false)`);
      try {
        return await fn();
      } finally {
        await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`).catch(() => {});
      }
    }
    const relacl = async () => (await q(`select relacl::text as acl from pg_class where oid = 'public.symbols'::regclass`))[0].acl as string;
    // TRUE column ACLs (pg_attribute.attacl, what db-snapshot calls columnAcls). information_schema.column_privileges
    // would also list a table-level grant once per column, so it cannot tell the two apart.
    const colGrants = async (grantee: string) =>
      (await q(`select a.attname, x.privilege_type
                  from pg_attribute a, aclexplode(a.attacl) x
                 where a.attrelid = 'public.symbols'::regclass and a.attnum > 0 and not a.attisdropped
                   and x.grantee = case when $1 = 'PUBLIC' then 0::oid else (select oid from pg_roles where rolname = $1) end
                 order by 1, 2`, [grantee])).map((r) => `${r.attname}:${r.privilege_type}`);

    // full_chain.ts is typed against PGlite 0.2; the 0.3 instance has the same exec/query surface.
    const chainDb = db as unknown as Parameters<typeof loadChain>[0];
    await loadChain(chainDb, { untilBefore: VERSION });

    // Fixture, as the owner.
    for (const u of [C, M, X]) await q(`insert into auth.users (id, email) values ($1, $2)`, [u, `${u.slice(-2)}@example.test`]);
    for (const s of SYMS) {
      await q(`insert into public.symbols (symbol, name, is_draftable, last_price, gics_industry, market_cap, active, enriched_at, last_price_at)
               values ($1, $2, $3, $4, $5, 1e10, $6, ${s.enriched ? 'now()' : 'null'}, now())`,
        [s.symbol, s.name, s.is_draftable, s.last_price, s.gics_industry, s.active]);
    }
    const [tech] = await q(`insert into categories (slug, name, display_order) values ('zz-tech', 'ZZ Tech', 901) returning id`);
    const [fin] = await q(`insert into categories (slug, name, display_order) values ('zz-fin', 'ZZ Finance', 902) returning id`);
    for (const g of TECH_INDUSTRIES) await q(`insert into category_rules (gics_industry, category_id) values ($1, $2)`, [g, tech.id]);
    for (const g of FIN_INDUSTRIES) await q(`insert into category_rules (gics_industry, category_id) values ($1, $2)`, [g, fin.id]);
    for (const [sym, c] of Object.entries(OVERRIDES)) {
      await q(`insert into symbol_category_overrides (symbol, category_id, justification) values ($1, $2, 'test')`, [sym, c === 'tech' ? tech.id : fin.id]);
    }
    const catId = (c: 'tech' | 'fin' | null) => (c === 'tech' ? tech.id : c === 'fin' ? fin.id : null);
    for (const [id, code] of [[L, 'SYMCOLA1'], [L2, 'SYMCOLB2']]) {
      await q(`insert into leagues (id, name, commissioner_id, invite_code, num_participants, league_type)
               values ($1, 'League', $2, $3, 4, 'matchup')`, [id, C, code]);
    }
    await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner'), ($1, $3, 'member')`, [L, C, M]);
    await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner')`, [L2, X]);
    // L: QAPL, QJPM, and a ticker with no symbols row. L2: QMSF (a member of L must not learn it).
    await q(`insert into drafts (league_id, user_id, symbol, entry_price, quantity, round, pick_number) values
               ($1, $2, 'QAPL', 200, 5, 1, 1), ($1, $3, 'QJPM', 150, 6, 1, 2), ($1, $2, 'QNOROW', 10, 1, 2, 3),
               ($4, $5, 'QMSF', 400, 2, 1, 1)`, [L, C, M, L2, X]);

    await t.step('BEFORE: the chain reproduces prod (authenticated=rm, no column ACLs) and the finding', async () => {
      const acl = await relacl();
      assert(/(^|[{,])authenticated=rm\//.test(acl), `expected prod's authenticated=rm: ${acl}`);
      assertEquals(await colGrants('authenticated'), [], 'no column grants yet');
      const rows = await as('authenticated', C, () => q(`select symbol, last_price, market_cap from public.symbols order by symbol`));
      assertEquals(rows.length, SYMS.length, 'a signed-in account pages every price (S1)');
      assertEquals(Number(rows.find((r: Row) => r.symbol === 'QAPL').last_price), 200);
    });

    const migration = await readMigration(MIG);
    const applied = await applyFrom(chainDb, VERSION);
    assertEquals(applied[0], MIG, 'this migration is the next in the chain');

    await t.step('table ACL: only the owner and service_role; no API role holds any table-level privilege', async () => {
      const acl = await relacl();
      assert(/postgres=arwdDxtm\//.test(acl) && /service_role=arwdDxtm\//.test(acl), acl);
      assert(!/(^|[{,])(authenticated|anon)=/.test(acl), `API role still on the table ACL: ${acl}`);
      assert(!/(^|[{,])=/.test(acl), `PUBLIC still on the table ACL: ${acl}`);
      for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) {
        const [r] = await q(`select has_table_privilege('authenticated', 'public.symbols', $1) a,
                                    has_table_privilege('anon', 'public.symbols', $1) n`, [priv]);
        assertEquals([priv, r.a, r.n], [priv, false, false], `${priv} on the table`);
      }
    });

    await t.step('column grants: authenticated may SELECT symbol, name, is_draftable and nothing else; anon nothing', async () => {
      assertEquals(await colGrants('authenticated'), GRANTED.map((c) => `${c}:SELECT`));
      assertEquals(await colGrants('anon'), []);
      assertEquals(await colGrants('PUBLIC'), []);
      for (const c of REFUSED_COLS) {
        const [r] = await q(`select has_column_privilege('authenticated', 'public.symbols', $1, 'SELECT') v`, [c]);
        assertEquals([c, r.v], [c, false]);
      }
    });

    await t.step('authenticated reads the granted columns, every row (names and search unaffected)', async () => {
      const rows = await as('authenticated', C, () => q(`select symbol, name, is_draftable from public.symbols order by symbol`));
      assertEquals(rows.length, SYMS.length);
      assertEquals(rows.find((r: Row) => r.symbol === 'QAPL'), { symbol: 'QAPL', name: 'Apple Inc.', is_draftable: true });
    });

    await t.step('authenticated is REFUSED every other column: as a select, as a filter, and select *', async () => {
      for (const c of REFUSED_COLS) {
        await assertRejects(() => as('authenticated', C, () => q(`select symbol, ${c} from public.symbols`)), Error, DENIED, `select ${c}`);
        // A filter IS a read: last_price=gte.X bisects one stock's price.
        await assertRejects(() => as('authenticated', C, () => q(`select symbol from public.symbols where ${c} is not null`)), Error, DENIED, `filter ${c}`);
      }
      await assertRejects(() => as('authenticated', C, () => q(`select * from public.symbols`)), Error, DENIED, 'select *');
      await assertRejects(() => as('authenticated', C, () => q(`select symbol from public.symbols order by last_price`)), Error, DENIED, 'order by');
    });

    await t.step('authenticated cannot write or TRUNCATE', async () => {
      for (const sql of [
        `insert into public.symbols (symbol, name) values ('EVIL', 'x')`,
        `update public.symbols set name = 'x'`,
        `delete from public.symbols`,
        `truncate public.symbols`,
      ]) {
        await assertRejects(() => as('authenticated', C, () => q(sql)), Error, 'permission denied', sql);
      }
    });

    await t.step('anon is refused everything: every column of the table, and all three new functions', async () => {
      for (const c of [...GRANTED, ...REFUSED_COLS]) {
        await assertRejects(() => as('anon', null, () => q(`select ${c} from public.symbols limit 1`)), Error, DENIED, `anon ${c}`);
      }
      for (const sql of [
        `select public.count_slot_matches(null, null, null)`,
        `select * from public.symbols_enrichment_progress()`,
        `select * from public.get_league_pick_industries('${L}')`,
      ]) {
        await assertRejects(() => as('anon', null, () => q(sql)), Error, 'permission denied for function', sql);
      }
    });

    await t.step('the caller-scoped edge-function queries still work (symbols-search, symbol-name)', async () => {
      // symbols-search: select symbol,name,is_draftable; eq / like / ilike on symbol and name; order by symbol.
      const exact = await as('authenticated', C, () => q(`select symbol, name, is_draftable from public.symbols where symbol = 'QAPL' limit 1`));
      assertEquals(exact.length, 1);
      const like = await as('authenticated', C, () => q(`select symbol, name, is_draftable from public.symbols
                                                          where symbol like 'QB%' or name ilike '%bank of%' order by symbol limit 20`));
      assertEquals(like.map((r: Row) => r.symbol), ['QBAC']);
      // symbol-name: select name where symbol = .
      const [n] = await as('authenticated', C, () => q(`select name from public.symbols where symbol = 'QMSF'`));
      assertEquals(n.name, 'Microsoft');
    });

    await t.step('get_portfolio_ledger (SECURITY INVOKER) still names the symbols for a member', async () => {
      const [r] = await as('authenticated', C, () => q(`select public.get_portfolio_ledger($1) as j`, [L]));
      assertEquals(r.j.symbol_names, { QAPL: 'Apple Inc.', QJPM: 'JPMorgan' });
    });

    await t.step('count_slot_matches equals the old client count for every band and category', async () => {
      const bands: Array<[number | null, number | null]> = [[null, null], [100, null], [null, 100], [50, 160], [500, 600], [70, 70]];
      for (const [min, max] of bands) {
        for (const cat of [null, 'tech', 'fin'] as const) {
          const [r] = await as('authenticated', C, () => q(`select public.count_slot_matches($1, $2, $3) n`, [min, max, catId(cat)]));
          assertEquals([min, max, cat, r.n], [min, max, cat, oldClientCount(min, max, cat)]);
        }
      }
      // Sanity on the fixture: the override is honoured both ways.
      assertEquals(oldClientCount(null, null, 'fin'), 3, 'QJPM, QBAC, and QPYP by override');
      assertEquals(oldClientCount(null, null, 'tech'), 4, 'QAPL, QMSF, QNVD, and QNOP (no price: counted only with no bound); QPYP overridden out');
      assertEquals(oldClientCount(100, null, 'tech'), 3, 'a bound drops the unpriced QNOP');
    });

    await t.step('count_slot_matches refuses a session with no user (42501 from the function, not the grant)', async () => {
      await assertRejects(() => as('authenticated', null, () => q(`select public.count_slot_matches(null, null, null)`)), Error, 'count_slot_matches: not authenticated');
    });

    await t.step('count_slot_matches is rate-limited per user (120 a minute), and only for that user', async () => {
      // Fill C's current AND next one-minute windows (fixed windows: a boundary can fall between the seed and the call).
      for (const offset of [0, 60]) {
        await q(`insert into rate_limit_counters (bucket, subject, window_start, hits)
                 values ('count-slot-matches', $1, to_timestamp(floor((extract(epoch from now()) + $2) / 60) * 60), 120)
                 on conflict (bucket, subject, window_start) do update set hits = 120`, [`user:${C}`, offset]);
      }
      const err = await assertRejects(() => as('authenticated', C, () => q(`select public.count_slot_matches(null, null, null)`)), Error, 'rate limited');
      assertEquals((err as Error & { code?: string }).code, 'PT429');
      const [r] = await as('authenticated', M, () => q(`select public.count_slot_matches(null, null, null) n`));
      assertEquals(r.n, oldClientCount(null, null, null), 'another user is not limited by C');
    });

    await t.step('symbols_enrichment_progress: active symbols, and how many are enriched', async () => {
      const [r] = await as('authenticated', M, () => q(`select * from public.symbols_enrichment_progress()`));
      assertEquals(r, { enriched: SYMS.filter((s) => s.active && s.enriched).length, total: SYMS.filter((s) => s.active).length });
      await assertRejects(() => as('authenticated', null, () => q(`select * from public.symbols_enrichment_progress()`)), Error, 'not authenticated');
    });

    await t.step("get_league_pick_industries: a member gets that league's picks only; anyone else is refused", async () => {
      const rows = await as('authenticated', M, () => q(`select symbol, gics_industry from public.get_league_pick_industries($1)`, [L]));
      assertEquals(rows, [
        { symbol: 'QAPL', gics_industry: 'ZZ Technology' },
        { symbol: 'QJPM', gics_industry: 'ZZ Banking' },
        { symbol: 'QNOROW', gics_industry: null },
      ]);
      await assertRejects(() => as('authenticated', M, () => q(`select * from public.get_league_pick_industries($1)`, [L2])), Error, 'not a member');
      await assertRejects(() => as('authenticated', null, () => q(`select * from public.get_league_pick_industries($1)`, [L])), Error, 'not a member');
      await assertRejects(() => as('authenticated', X, () => q(`select * from public.get_league_pick_industries(null)`)), Error, 'not a member');
    });

    await t.step('the three functions: SECURITY DEFINER, pinned search_path, authenticated (and the owner) only', async () => {
      const fns = await q(`select proname, prosecdef, proconfig, proacl::text acl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'public' and proname in ('count_slot_matches', 'symbols_enrichment_progress', 'get_league_pick_industries')
                            order by proname`);
      assertEquals(fns.length, 3);
      for (const f of fns) {
        assertEquals([f.proname, f.prosecdef], [f.proname, true]);
        assertEquals(f.proconfig, ['search_path=public, pg_temp']);
        assert(/(^|[{,])authenticated=X\//.test(f.acl), `${f.proname}: ${f.acl}`);
        assert(!/(^|[{,])(anon|service_role)=/.test(f.acl) && !/(^|[{,])=X/.test(f.acl), `${f.proname}: ${f.acl}`);
      }
    });

    await t.step('source guard: the only SECURITY INVOKER function an API role may run that reads symbols is get_portfolio_ledger', async () => {
      // An INVOKER function runs with the caller's column grant: a new one that reads a refused column
      // breaks for players with a 42501. This list is the set someone has checked against the grant.
      const rows = await q(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                             where n.nspname = 'public' and not p.prosecdef and p.prosrc ~* '\\msymbols\\M'
                               and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
                             order by 1`);
      assertEquals(rows.map((r: Row) => r.proname), ['get_portfolio_ledger']);
    });

    await t.step('service_role (refresh / enrich / draft-write) still reads and writes every column', async () => {
      await as('service_role', null, () => q(`update public.symbols set last_price = 201, market_cap = 2e12 where symbol = 'QAPL'`));
      const [r] = await as('service_role', null, () => q(`select * from public.symbols where symbol = 'QAPL'`));
      assertEquals(Number(r.last_price), 201);
    });

    await t.step('the post-push checks file: blocks 1-3 read as documented, and the effect block (4) says PASS', async () => {
      const checks = await Deno.readTextFile(new URL('../../docs/security/2026-11-13-symbols-column-grant-checks.sql', import.meta.url));
      assertEquals(await relacl(), '{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}', 'block 1 EXPECT');
      const cols = await q(`select grantee, column_name, privilege_type from information_schema.column_privileges
                             where table_schema = 'public' and table_name = 'symbols' and grantee in ('authenticated', 'anon', 'PUBLIC')
                             order by grantee, column_name`);
      assertEquals(cols.map((r: Row) => `${r.grantee}:${r.column_name}:${r.privilege_type}`), GRANTED.map((c) => `authenticated:${c}:SELECT`), 'block 2 EXPECT');
      // The effect block bumps count_slot_matches' counter (rolled back by its RAISE); C's was filled above.
      await q(`delete from rate_limit_counters where bucket like 'count-slot-matches%'`);
      const block = checks.slice(checks.indexOf('do $$'), checks.indexOf('end $$;') + 'end $$;'.length);
      assert(block.startsWith('do $$') && block.endsWith('end $$;'), 'found the effect block');
      const err = await assertRejects(() => db.exec(block), Error);
      assert(/SYMBOLS COLUMN GRANT EFFECT TEST: PASS/.test((err as Error).message), (err as Error).message);
      await db.exec('reset role');
      const [{ n }] = await q(`select count(*)::int n from rate_limit_counters where bucket like 'count-slot-matches%'`);
      assertEquals(n, 0, 'the block rolled back its own writes');
    });

    await t.step('re-applying is clean, and clears a column grant made since', async () => {
      await q(`grant select (last_price) on public.symbols to authenticated`);
      assert((await colGrants('authenticated')).includes('last_price:SELECT'));
      await db.exec(migration);
      assertEquals(await colGrants('authenticated'), GRANTED.map((c) => `${c}:SELECT`));
      await assertRejects(() => as('authenticated', C, () => q(`select last_price from public.symbols`)), Error, DENIED);
      const fns = await q(`select count(*)::int n from pg_proc where proname in ('count_slot_matches', 'symbols_enrichment_progress', 'get_league_pick_industries')`);
      assertEquals(fns[0].n, 3);
    });

    assert(migration.length > 0);
  },
});
