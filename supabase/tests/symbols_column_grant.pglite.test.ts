/**
 * S1 symbols lockdown, both stages, on the WHOLE migration chain (full_chain.ts),
 * not a replica (docs/security/2026-11-13-brief-security-check.md):
 *
 *   EXPAND   supabase/migrations/20261205000300_symbols_readers_functions.sql
 *            the three functions; no existing privilege changes.
 *   CONTRACT supabase/migrations/deferred/20261205000400_symbols_column_grant.sql
 *            (HELD until the build that calls the functions is on every phone):
 *            a signed-in player reads symbol, name and is_draftable only.
 *
 * PGlite 0.3 = Postgres 17, deliberately (the rest of supabase/tests/ is on 0.2 =
 * Postgres 16): prod is 17.4 and its live ACL was `authenticated=rm`. MAINTAIN (m)
 * only exists from 17, so a 16 replica cannot model it. 20261205000200 (applied in
 * the same push as EXPAND) revokes MAINTAIN from the API roles on every table, so
 * the chain up to EXPAND reads `authenticated=r` (asserted in BEFORE: the m is gone,
 * the whole-table SELECT that S1 is about is not). CONTRACT's REVOKE ALL would clear
 * MAINTAIN on its own as well; the CONTRACT step asserts every table privilege.
 * The chain's ACL is partly by construction (full_chain.ts grants Supabase's
 * defaults, 20261114000000 trims them) and agrees with the 2026-11-11 db-snapshot;
 * it is not independent evidence about prod, which the post-push checks
 * (docs/security/2026-11-13-symbols-column-grant-checks.sql) are.
 *
 * What it proves (42501 from a GRANT check reads "permission denied for table
 * symbols"; the functions' own refusals read "not authenticated" / "not a member",
 * so the two are told apart, CLAUDE.md's grant-vs-raise trap):
 *   EXPAND alone (the state after the next normal db push):
 *   - the table ACL is byte-identical to before, and every direct read build 14
 *     makes (SlotBuilder's last_price / gics_industry filters, the active /
 *     enriched_at counts, the draft board's gics_industry read) still works;
 *   - count_slot_matches equals the count the old client made itself, and is
 *     rate-limited (each window refuses on its own); symbols_enrichment_progress
 *     returns the two totals; get_league_pick_industries answers a member, for that
 *     league's picks only; all three are DEFINER, search_path-pinned and
 *     authenticated-only; checks PART A reads as documented and its effect says PASS.
 *   EXPAND + CONTRACT:
 *   - authenticated reads symbol, name, is_draftable; every other column is refused,
 *     as a select, as a filter, and as select *; it holds no table-level privilege
 *     (no MAINTAIN, TRUNCATE, REFERENCES, TRIGGER); anon and PUBLIC hold nothing;
 *   - every caller-scoped reader still works (symbols-search, symbol-name,
 *     get_portfolio_ledger) and so do the three functions;
 *   - the source guard: no other SECURITY INVOKER function an API role may run reads
 *     symbols (a new one would run with the column grant and must be checked);
 *   - checks PART B reads as documented and its effect says PASS;
 *   - re-applying both is clean, and clears a column grant made since.
 *
 * Run: deno test --allow-read --allow-env supabase/tests/symbols_column_grant.pglite.test.ts
 */
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.3';
import { applyFrom, loadChain, migrationFiles, readMigration } from './full_chain.ts';

const EXPAND = '20261205000300_symbols_readers_functions.sql';
const EXPAND_VERSION = '20261205000300';
const CONTRACT_NAME = '20261205000400_symbols_column_grant.sql';
const CONTRACT_URL = new URL(`../migrations/deferred/${CONTRACT_NAME}`, import.meta.url);
const CHECKS_URL = new URL('../../docs/security/2026-11-13-symbols-column-grant-checks.sql', import.meta.url);

const C = '00000000-0000-4000-8000-0000000000c1'; // commissioner, member of L
const M = '00000000-0000-4000-8000-0000000000c2'; // member of L
const X = '00000000-0000-4000-8000-0000000000c3'; // signed in, in no league of C's
const L = '00000000-0000-4000-8000-00000000a001';
const L2 = '00000000-0000-4000-8000-00000000a002';

const GRANTED = ['is_draftable', 'name', 'symbol'];
const REFUSED_COLS = ['last_price', 'last_price_at', 'market_cap', 'gics_industry', 'gics_sector', 'enriched_at',
  'active', 'exchange', 'is_etf', 'updated_at', 'price_unsupported'];
const DENIED = 'permission denied for table symbols';
const FUNCTIONS = ['count_slot_matches', 'get_league_pick_industries', 'symbols_enrichment_progress'];

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

/** The old client's count (apps/mobile/lib/categoryData.ts countSlotMatches before the RPC change), over the fixture. */
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

/** The `do $$ ... end $$;` block that follows `marker` in the checks file. */
function effectBlock(checks: string, marker: string): string {
  const at = checks.indexOf(marker);
  assert(at >= 0, `checks file has ${marker}`);
  const start = checks.indexOf('do $$', at);
  const end = checks.indexOf('end $$;', start) + 'end $$;'.length;
  const block = checks.slice(start, end);
  assert(start > at && block.startsWith('do $$') && block.endsWith('end $$;'), `found the ${marker} effect block`);
  return block;
}

Deno.test('S1 staging: EXPAND is in the apply path, CONTRACT is HELD in deferred/, the old single file is gone', async () => {
  const files = await migrationFiles();
  assert(files.includes(EXPAND), `${EXPAND} is in supabase/migrations/`);
  assert(!files.includes('20261205000000_symbols_column_grant.sql'), 'the old single migration is deleted');
  // CONTRACT must not reach db push before its precondition (deferred/README.md). When it is
  // promoted (re-stamped), point CONTRACT_URL at the new file and turn this into a check of that.
  assert(!files.some((f) => f.endsWith('_symbols_column_grant.sql')), 'no symbols column grant in the apply path yet');
  const contract = await Deno.readTextFile(CONTRACT_URL);
  assert(/revoke all on table public\.symbols/.test(contract) && /grant select \(symbol, name, is_draftable\)/.test(contract));
  const expand = await readMigration(EXPAND);
  assert(!/on table public\.symbols/i.test(expand.replace(/--.*$/gm, '')), 'EXPAND changes no privilege on the table');
  const readme = await Deno.readTextFile(new URL('../migrations/deferred/README.md', import.meta.url));
  assert(readme.includes(CONTRACT_NAME) && readme.includes('categoryData RPC change is on every phone in use'), 'the precondition is recorded');
});

Deno.test({
  name: 'S1 EXPAND then CONTRACT on the full chain (PGlite 0.3 = Postgres 17)',
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
    const clearCounters = () => q(`delete from rate_limit_counters where bucket like 'count-slot-matches%'`);

    // full_chain.ts is typed against PGlite 0.2; the 0.3 instance has the same exec/query surface.
    const chainDb = db as unknown as Parameters<typeof loadChain>[0];
    await loadChain(chainDb, { untilBefore: EXPAND_VERSION });

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

    /** Build 14's direct reads (categoryData.ts / useSymbolCategories.ts before the RPC change). */
    const build14Reads = (sub: string) => as('authenticated', sub, async () => {
      const [band] = await q(`select count(*)::int n from public.symbols where is_draftable = true and last_price >= 50 and last_price <= 160`);
      const [cat] = await q(`select count(*)::int n from public.symbols where is_draftable = true and gics_industry in ('ZZ Banking')`);
      const [prog] = await q(`select count(*)::int total, count(enriched_at)::int enriched from public.symbols where active = true`);
      const ind = await q(`select symbol, gics_industry from public.symbols where symbol in ('QAPL', 'QJPM') order by symbol`);
      return { band: band.n, cat: cat.n, prog, ind };
    });

    let aclBefore = '';
    await t.step('BEFORE: whole-table SELECT for authenticated (authenticated=r: 20261205000200 took the m), no column ACLs, the finding', async () => {
      aclBefore = await relacl();
      assert(/(^|[{,])authenticated=r\//.test(aclBefore), `expected authenticated=r after 20261205000200: ${aclBefore}`);
      assertEquals(await colGrants('authenticated'), [], 'no column grants yet');
      const rows = await as('authenticated', C, () => q(`select symbol, last_price, market_cap from public.symbols order by symbol`));
      assertEquals(rows.length, SYMS.length, 'a signed-in account pages every price (S1)');
      assertEquals(Number(rows.find((r: Row) => r.symbol === 'QAPL').last_price), 200);
    });

    // ======================= EXPAND alone =======================
    const expandSql = await readMigration(EXPAND);
    const applied = await applyFrom(chainDb, EXPAND_VERSION);
    assertEquals(applied[0], EXPAND, 'EXPAND is the next migration in the chain');
    assert(!applied.some((f) => f.includes('symbols_column_grant')), `CONTRACT is not in the apply path: ${applied.join(', ')}`);

    await t.step('EXPAND: the table ACL is unchanged and no column grant appears', async () => {
      assertEquals(await relacl(), aclBefore);
      assertEquals(await colGrants('authenticated'), []);
    });

    await t.step("EXPAND: build 14's direct reads all still work (it is unaffected)", async () => {
      const r = await build14Reads(C);
      assertEquals(r.band, oldClientCount(50, 160, null));
      assertEquals(r.cat, 2, 'QJPM and QBAC by industry');
      assertEquals(r.prog, { total: SYMS.filter((s) => s.active).length, enriched: SYMS.filter((s) => s.active && s.enriched).length });
      assertEquals(r.ind, [{ symbol: 'QAPL', gics_industry: 'ZZ Technology' }, { symbol: 'QJPM', gics_industry: 'ZZ Banking' }]);
    });

    await t.step('EXPAND: count_slot_matches equals the old client count for every band and category', async () => {
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

    await t.step('EXPAND: count_slot_matches refuses a session with no user (42501 from the function, not the grant)', async () => {
      await assertRejects(() => as('authenticated', null, () => q(`select public.count_slot_matches(null, null, null)`)), Error, 'count_slot_matches: not authenticated');
    });

    await t.step('EXPAND: count_slot_matches is rate-limited per user (120 a minute), and only for that user', async () => {
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

    await t.step('EXPAND: count_slot_matches: the HOUR window (1200) refuses on its own, with the minute window clear', async () => {
      await q(`delete from rate_limit_counters where bucket like 'count-slot-matches%' and subject = $1`, [`user:${M}`]);
      for (const offset of [0, 3600]) {
        await q(`insert into rate_limit_counters (bucket, subject, window_start, hits)
                 values ('count-slot-matches-hour', $1, to_timestamp(floor((extract(epoch from now()) + $2) / 3600) * 3600), 1200)
                 on conflict (bucket, subject, window_start) do update set hits = 1200`, [`user:${M}`, offset]);
      }
      const err = await assertRejects(() => as('authenticated', M, () => q(`select public.count_slot_matches(null, null, null)`)), Error, 'rate limited');
      assertEquals((err as Error & { code?: string }).code, 'PT429');
      await q(`delete from rate_limit_counters where bucket like 'count-slot-matches%' and subject = $1`, [`user:${M}`]);
    });

    await t.step('EXPAND: symbols_enrichment_progress: active symbols, and how many are enriched', async () => {
      const [r] = await as('authenticated', M, () => q(`select * from public.symbols_enrichment_progress()`));
      assertEquals(r, { enriched: SYMS.filter((s) => s.active && s.enriched).length, total: SYMS.filter((s) => s.active).length });
      await assertRejects(() => as('authenticated', null, () => q(`select * from public.symbols_enrichment_progress()`)), Error, 'not authenticated');
    });

    await t.step("EXPAND: get_league_pick_industries: a member gets that league's picks only; anyone else is refused", async () => {
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

    await t.step('EXPAND: the three functions are SECURITY DEFINER, search_path-pinned, authenticated (and the owner) only', async () => {
      const fns = await q(`select proname, prosecdef, proconfig, proacl::text acl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'public' and proname = any($1) order by proname`, [FUNCTIONS]);
      assertEquals(fns.map((f: Row) => f.proname), FUNCTIONS);
      for (const f of fns) {
        assertEquals([f.proname, f.prosecdef], [f.proname, true]);
        assertEquals(f.proconfig, ['search_path=public, pg_temp']);
        assert(/(^|[{,])authenticated=X\//.test(f.acl), `${f.proname}: ${f.acl}`);
        assert(!/(^|[{,])(anon|service_role)=/.test(f.acl) && !/(^|[{,])=X/.test(f.acl), `${f.proname}: ${f.acl}`);
      }
      for (const sql of [
        `select public.count_slot_matches(null, null, null)`,
        `select * from public.symbols_enrichment_progress()`,
        `select * from public.get_league_pick_industries('${L}')`,
      ]) {
        await assertRejects(() => as('anon', null, () => q(sql)), Error, 'permission denied for function', sql);
      }
    });

    await t.step('EXPAND: checks PART A reads as documented, and its effect block (A3) says PASS', async () => {
      const checks = await Deno.readTextFile(CHECKS_URL);
      // A2: the table is unchanged, authenticated=r still in it.
      assert(/(^|[{,])authenticated=r\//.test(await relacl()), 'A2 EXPECT');
      // A2b: the documented list.
      const rows = await q(`select p.proname, p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                             where n.nspname = 'public' and p.prosrc ~* '\\msymbols\\M'
                               and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
                             order by 1`);
      // create_takeover_invite matches on a comment ("each of the 10 symbols"): it does not read the table.
      assertEquals(rows.map((r: Row) => `${r.proname}:${r.prosecdef}`), [
        'count_slot_matches:true', 'create_takeover_invite:true', 'get_league_pick_industries:true',
        'get_portfolio_ledger:false', 'set_draft_queue:true', 'symbols_enrichment_progress:true',
      ], 'A2b EXPECT');
      for (const r of rows) assert(checks.includes(r.proname), `checks A2b lists ${r.proname}`);
      await clearCounters();
      const err = await assertRejects(() => db.exec(effectBlock(checks, 'PART A: after EXPAND')), Error);
      assert(/SYMBOLS READERS EXPAND EFFECT TEST: PASS/.test((err as Error).message), (err as Error).message);
      await db.exec('reset role');
      const [{ n }] = await q(`select count(*)::int n from rate_limit_counters where bucket like 'count-slot-matches%'`);
      assertEquals(n, 0, 'the block rolled back its own writes');
    });

    // ======================= + CONTRACT =======================
    const contractSql = await Deno.readTextFile(CONTRACT_URL);
    await db.exec(contractSql);

    await t.step('CONTRACT: table ACL holds only the owner and service_role; no API role holds any table-level privilege', async () => {
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

    await t.step('CONTRACT: authenticated may SELECT symbol, name, is_draftable and nothing else; anon nothing', async () => {
      assertEquals(await colGrants('authenticated'), GRANTED.map((c) => `${c}:SELECT`));
      assertEquals(await colGrants('anon'), []);
      assertEquals(await colGrants('PUBLIC'), []);
      for (const c of REFUSED_COLS) {
        const [r] = await q(`select has_column_privilege('authenticated', 'public.symbols', $1, 'SELECT') v`, [c]);
        assertEquals([c, r.v], [c, false]);
      }
    });

    await t.step('CONTRACT: authenticated reads the granted columns, every row (names and search unaffected)', async () => {
      const rows = await as('authenticated', C, () => q(`select symbol, name, is_draftable from public.symbols order by symbol`));
      assertEquals(rows.length, SYMS.length);
      assertEquals(rows.find((r: Row) => r.symbol === 'QAPL'), { symbol: 'QAPL', name: 'Apple Inc.', is_draftable: true });
    });

    await t.step('CONTRACT: authenticated is REFUSED every other column: as a select, as a filter, and select *', async () => {
      for (const c of REFUSED_COLS) {
        await assertRejects(() => as('authenticated', C, () => q(`select symbol, ${c} from public.symbols`)), Error, DENIED, `select ${c}`);
        // A filter IS a read: last_price=gte.X bisects one stock's price.
        await assertRejects(() => as('authenticated', C, () => q(`select symbol from public.symbols where ${c} is not null`)), Error, DENIED, `filter ${c}`);
      }
      await assertRejects(() => as('authenticated', C, () => q(`select * from public.symbols`)), Error, DENIED, 'select *');
      await assertRejects(() => as('authenticated', C, () => q(`select symbol from public.symbols order by last_price`)), Error, DENIED, 'order by');
      // Build 14's reads are the ones that break: this is why CONTRACT is held.
      await assertRejects(() => build14Reads(C), Error, DENIED, "build 14's direct reads");
    });

    await t.step('CONTRACT: authenticated cannot write or TRUNCATE', async () => {
      for (const sql of [
        `insert into public.symbols (symbol, name) values ('EVIL', 'x')`,
        `update public.symbols set name = 'x'`,
        `delete from public.symbols`,
        `truncate public.symbols`,
      ]) {
        await assertRejects(() => as('authenticated', C, () => q(sql)), Error, 'permission denied', sql);
      }
    });

    await t.step('CONTRACT: anon is refused every column of the table', async () => {
      for (const c of [...GRANTED, ...REFUSED_COLS]) {
        await assertRejects(() => as('anon', null, () => q(`select ${c} from public.symbols limit 1`)), Error, DENIED, `anon ${c}`);
      }
    });

    await t.step('CONTRACT: the caller-scoped edge-function queries still work (symbols-search, symbol-name)', async () => {
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

    await t.step('CONTRACT: get_portfolio_ledger (SECURITY INVOKER) still names the symbols for a member', async () => {
      const [r] = await as('authenticated', C, () => q(`select public.get_portfolio_ledger($1) as j`, [L]));
      assertEquals(r.j.symbol_names, { QAPL: 'Apple Inc.', QJPM: 'JPMorgan' });
    });

    await t.step('CONTRACT: the three functions still answer (DEFINER: the column grant does not reach them)', async () => {
      await clearCounters();
      const [r] = await as('authenticated', M, () => q(`select public.count_slot_matches(50, 160, $1) n`, [catId('fin')]));
      assertEquals(r.n, oldClientCount(50, 160, 'fin'));
      const [p] = await as('authenticated', M, () => q(`select * from public.symbols_enrichment_progress()`));
      assertEquals(p.total, SYMS.filter((s) => s.active).length);
      const rows = await as('authenticated', M, () => q(`select symbol from public.get_league_pick_industries($1)`, [L]));
      assertEquals(rows.map((x: Row) => x.symbol), ['QAPL', 'QJPM', 'QNOROW']);
    });

    await t.step('CONTRACT: source guard: the only SECURITY INVOKER function an API role may run that reads symbols is get_portfolio_ledger', async () => {
      // An INVOKER function runs with the caller's column grant: a new one that reads a refused column
      // breaks for players with a 42501. This list is the set someone has checked against the grant.
      const rows = await q(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                             where n.nspname = 'public' and not p.prosecdef and p.prosrc ~* '\\msymbols\\M'
                               and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
                             order by 1`);
      assertEquals(rows.map((r: Row) => r.proname), ['get_portfolio_ledger']);
    });

    await t.step('CONTRACT: service_role (refresh / enrich / draft-write) still reads and writes every column', async () => {
      await as('service_role', null, () => q(`update public.symbols set last_price = 201, market_cap = 2e12 where symbol = 'QAPL'`));
      const [r] = await as('service_role', null, () => q(`select * from public.symbols where symbol = 'QAPL'`));
      assertEquals(Number(r.last_price), 201);
      await as('service_role', null, () => q(`update public.symbols set last_price = 200 where symbol = 'QAPL'`));
    });

    await t.step('CONTRACT: checks PART B reads as documented, and its effect block (B3) says PASS', async () => {
      const checks = await Deno.readTextFile(CHECKS_URL);
      assertEquals(await relacl(), '{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}', 'B1 EXPECT');
      const cols = await q(`select grantee, column_name, privilege_type from information_schema.column_privileges
                             where table_schema = 'public' and table_name = 'symbols' and grantee in ('authenticated', 'anon', 'PUBLIC')
                             order by grantee, column_name`);
      assertEquals(cols.map((r: Row) => `${r.grantee}:${r.column_name}:${r.privilege_type}`), GRANTED.map((c) => `authenticated:${c}:SELECT`), 'B2 EXPECT');
      await clearCounters();
      const err = await assertRejects(() => db.exec(effectBlock(checks, 'PART B: after CONTRACT')), Error);
      assert(/SYMBOLS COLUMN GRANT EFFECT TEST: PASS/.test((err as Error).message), (err as Error).message);
      await db.exec('reset role');
      const [{ n }] = await q(`select count(*)::int n from rate_limit_counters where bucket like 'count-slot-matches%'`);
      assertEquals(n, 0, 'the block rolled back its own writes');
    });

    await t.step('re-applying both is clean, and CONTRACT clears a column grant made since', async () => {
      await q(`grant select (last_price) on public.symbols to authenticated`);
      assert((await colGrants('authenticated')).includes('last_price:SELECT'));
      await db.exec(expandSql);
      await db.exec(contractSql);
      assertEquals(await colGrants('authenticated'), GRANTED.map((c) => `${c}:SELECT`));
      await assertRejects(() => as('authenticated', C, () => q(`select last_price from public.symbols`)), Error, DENIED);
      const fns = await q(`select count(*)::int n from pg_proc where proname = any($1)`, [FUNCTIONS]);
      assertEquals(fns[0].n, 3);
    });
  },
});
