/**
 * get_league_available_stocks (20261207000100), the read behind the Stocks tab's list
 * (docs/plans/2026-11-18-stocks-tab.md, part 1), on the WHOLE migration chain
 * (full_chain.ts), so the S1 column grant (20261206000000) and every other live
 * privilege are in place exactly as db push left them.
 *
 * What it proves:
 *   - a member gets rows; a signed-in outsider, a session with no user, anon and
 *     service_role are all REFUSED (42501), told apart: anon / service_role by the
 *     GRANT ("permission denied for function"), the others by the function's own raise;
 *   - owned stocks are excluded by NET quantity per manager (drafted; bought; drafted
 *     and partly sold), a stock drafted-then-fully-sold or bought-then-fully-sold is
 *     back, one manager's sell never offsets another's holding, another league's picks
 *     change nothing, lowercase trade symbols count;
 *   - order = market cap desc, no size last, ticker tie-break; the cursor walks the
 *     whole list without gaps or duplicates (page sizes 25 and 7, across ties and the
 *     no-size tail); an unknown cursor is refused;
 *   - at most 25 rows whatever is asked (1000 -> 25), has_more from one extra row, no
 *     total count;
 *   - the category filter equals the server's own resolution
 *     (_shared/category-eligibility.ts fetchEligibleCategoryIdsBatch, run against the
 *     same rows), and each row's category_ids equals it too;
 *   - the result columns are exactly the six; market_cap / gics_industry never appear;
 *   - the limiter refuses past each of its three windows on its own, the daily counter
 *     equals the pages served, and a refusal adds nothing;
 *   - proacl = postgres + authenticated only, SECURITY DEFINER, search_path pinned;
 *   - the symbols table and column ACLs are byte-identical before and after.
 *
 * Run: deno test --allow-read --allow-env supabase/tests/league_available_stocks.pglite.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.2';
import { applyFrom, loadChain } from './full_chain.ts';
import { fetchEligibleCategoryIdsBatch } from '../functions/_shared/category-eligibility.ts';

const VERSION = '20261207000100';
const FN = 'public.get_league_available_stocks';
const SIG = 'uuid, uuid, text, integer';

const C = '00000000-0000-4000-8000-0000000000d1'; // commissioner of L
const M = '00000000-0000-4000-8000-0000000000d2'; // member of L
const X = '00000000-0000-4000-8000-0000000000d3'; // signed in; commissioner of L2 only
const L = '00000000-0000-4000-8000-00000000b001';
const L2 = '00000000-0000-4000-8000-00000000b002';
const LEMPTY = '00000000-0000-4000-8000-00000000b003'; // pre-draft league of M's: nothing owned

// deno-lint-ignore no-explicit-any
type Row = any;

interface Sym { symbol: string; cap: number | null; price: number | null; draftable: boolean; industry: string | null }

// Named stocks for ownership and categories.
const NAMED: Sym[] = [
  { symbol: 'QAPL', cap: 3.0e12, price: 200, draftable: true, industry: 'ZZ Technology' }, // drafted by C: owned
  { symbol: 'QJPM', cap: 6.0e11, price: 150, draftable: true, industry: 'ZZ Banking' }, // bought by M: owned
  { symbol: 'QNVD', cap: 2.5e12, price: 120, draftable: true, industry: 'ZZ Semiconductors' }, // M drafted 5, sold 2: owned
  { symbol: 'QBAC', cap: 3.0e11, price: 40, draftable: true, industry: 'ZZ Banking' }, // C drafted, sold all: back
  { symbol: 'QPYP', cap: 7.0e10, price: 70, draftable: true, industry: 'ZZ Technology' }, // override -> fin; M bought, sold all: back
  { symbol: 'QXOM', cap: 4.0e11, price: 110, draftable: true, industry: 'ZZ Energy' }, // M holds; C has a stray sell: still owned
  { symbol: 'QLOW', cap: 5.0e10, price: 15, draftable: true, industry: 'ZZ Banking' }, // bought via lowercase 'qlow': owned
  { symbol: 'QMSF', cap: 2.8e12, price: 400, draftable: true, industry: 'ZZ Technology' }, // drafted in L2 only: listed in L
  { symbol: 'QMUL', cap: 9.0e10, price: 55, draftable: true, industry: 'ZZ Energy' }, // overrides -> tech AND fin
  { symbol: 'QUNC', cap: 8.0e10, price: 33, draftable: true, industry: null }, // unclassified
  { symbol: 'QNOP', cap: 1.0e12, price: null, draftable: true, industry: 'ZZ Technology' }, // no stored price: never listed
  { symbol: 'QTNY', cap: 1.0e9, price: 2, draftable: false, industry: 'ZZ Technology' }, // not draftable: never listed
];
// Filler: 40 stocks with TIES (pairs share a cap) and a no-size tail of 5, so pages cross both.
const FILLER: Sym[] = Array.from({ length: 45 }, (_, i) => {
  const n = String(i).padStart(2, '0');
  const cap = i >= 40 ? null : 1.0e10 - Math.floor(i / 2) * 1.0e8; // i=0,1 tie; 2,3 tie; ...
  const industry = ['ZZ Technology', 'ZZ Banking', 'ZZ Energy', null][i % 4];
  // Reverse the ticker within each tie pair so the tie-break is the ticker, not insert order.
  return { symbol: `F${i % 2 === 0 ? 'B' : 'A'}${n}`, cap, price: 10 + i, draftable: true, industry };
});
const SYMS = [...NAMED, ...FILLER];
const OWNED_IN_L = new Set(['QAPL', 'QJPM', 'QNVD', 'QXOM', 'QLOW']);
const INDUSTRY_CAT: Record<string, 'tech' | 'fin'> = {
  'ZZ Technology': 'tech', 'ZZ Semiconductors': 'tech', 'ZZ Banking': 'fin',
}; // ZZ Energy has no rule: unclassified unless overridden
const OVERRIDES: [string, 'tech' | 'fin'][] = [['QPYP', 'fin'], ['QMUL', 'fin'], ['QMUL', 'tech']];

/** The expected order: cap desc, no size last, ticker (byte order, = collate "C" for ASCII). */
function expectedOrder(pred: (s: Sym) => boolean): string[] {
  return SYMS.filter((s) => s.draftable && s.price != null && pred(s))
    .sort((a, b) => {
      if (a.cap == null && b.cap != null) return 1;
      if (b.cap == null && a.cap != null) return -1;
      if (a.cap != null && b.cap != null && a.cap !== b.cap) return b.cap - a.cap;
      return a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0;
    })
    .map((s) => s.symbol);
}

Deno.test({
  name: 'get_league_available_stocks on the full chain',
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
    const clearCounters = () => q(`delete from rate_limit_counters where bucket like 'stocks-list-%'`);
    const symAcl = async () =>
      (await q(`select relacl::text as acl,
                       (select string_agg(a.attname || '=' || coalesce(a.attacl::text, ''), ',' order by a.attname)
                          from pg_attribute a where a.attrelid = 'public.symbols'::regclass and a.attnum > 0
                           and not a.attisdropped) as cols
                  from pg_class where oid = 'public.symbols'::regclass`))[0];

    await loadChain(db, { untilBefore: VERSION });
    const aclBefore = await symAcl();
    const applied = await applyFrom(db, VERSION);
    assert(applied.includes(`${VERSION}_league_available_stocks.sql`), 'the migration under test applied');

    // Fixture, as the owner.
    for (const u of [C, M, X]) await q(`insert into auth.users (id, email) values ($1, $2)`, [u, `${u.slice(-2)}@example.test`]);
    for (const s of SYMS) {
      await q(`insert into public.symbols (symbol, name, is_draftable, last_price, last_price_at, gics_industry, market_cap)
               values ($1, $2, $3, $4, ${s.price == null ? 'null' : `now()`}, $5, $6)`,
        [s.symbol, `${s.symbol} Inc.`, s.draftable, s.price, s.industry, s.cap]);
    }
    const [tech] = await q(`insert into categories (slug, name, display_order) values ('zz-tech', 'ZZ Tech', 901) returning id`);
    const [fin] = await q(`insert into categories (slug, name, display_order) values ('zz-fin', 'ZZ Finance', 902) returning id`);
    const catId = { tech: tech.id as string, fin: fin.id as string };
    for (const [g, c] of Object.entries(INDUSTRY_CAT)) {
      await q(`insert into category_rules (gics_industry, category_id) values ($1, $2)`, [g, catId[c]]);
    }
    for (const [sym, c] of OVERRIDES) {
      await q(`insert into symbol_category_overrides (symbol, category_id, justification) values ($1, $2, 'test')`, [sym, catId[c]]);
    }
    for (const [id, code, comm] of [[L, 'AVSTKL01', C], [L2, 'AVSTKL02', X], [LEMPTY, 'AVSTKL03', M]]) {
      await q(`insert into leagues (id, name, commissioner_id, invite_code, num_participants, league_type)
               values ($1, 'League', $2, $3, 4, 'matchup')`, [id, comm, code]);
    }
    await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner'), ($1, $3, 'member')`, [L, C, M]);
    await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner')`, [L2, X]);
    await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner')`, [LEMPTY, M]);
    await q(`insert into drafts (league_id, user_id, symbol, entry_price, quantity, round, pick_number) values
               ($1, $2, 'QAPL', 200, 5, 1, 1), ($1, $3, 'QNVD', 120, 5, 1, 2), ($1, $2, 'QBAC', 40, 10, 2, 3),
               ($1, $3, 'QXOM', 110, 3, 2, 4),
               ($4, $5, 'QMSF', 400, 2, 1, 1)`, [L, C, M, L2, X]);
    // A legacy SKIP pick (new ones are refused since 2026-10-05; old rows may remain): inserted with triggers off.
    await db.exec(`set session_replication_role = replica;
      insert into drafts (league_id, user_id, symbol, entry_price, quantity, round, pick_number) values ('${L}', '${C}', 'SKIP', 0, 0, 3, 5);
      set session_replication_role = origin;`);
    const trade = (user: string, sym: string, action: 'buy' | 'sell', qty: number, price: number) =>
      q(`insert into trades (league_id, user_id, symbol, action, quantity, price, total_value) values ($1, $2, $3, $4, $5, $6, $7)`,
        [L, user, sym, action, qty, price, qty * price]);
    await trade(M, 'QJPM', 'buy', 4, 150);
    await trade(M, 'QNVD', 'sell', 2, 120); // 5 - 2 = 3 still held
    await trade(C, 'QBAC', 'sell', 10, 40); // drafted 10, sold 10: free again
    await trade(M, 'QPYP', 'buy', 3, 70);
    await trade(M, 'QPYP', 'sell', 3, 70); // bought then fully sold: free again
    await trade(C, 'QXOM', 'sell', 3, 110); // C never held it: must NOT offset M's 3
    await trade(M, 'qlow', 'buy', 1, 15); // lowercase symbol still counts

    const call = (sub: string | null, league: string, opts: { cat?: string | null; after?: string | null; limit?: number | null } = {},
      role: 'anon' | 'authenticated' | 'service_role' = 'authenticated') =>
      as(role, sub, () => q(`select * from ${FN}($1, $2, $3, $4)`,
        [league, opts.cat ?? null, opts.after ?? null, opts.limit === undefined ? null : opts.limit]));
    async function refusal(fn: () => Promise<unknown>): Promise<{ code: string; message: string }> {
      try {
        await fn();
      } catch (e) {
        return { code: (e as Row).code, message: (e as Error).message };
      }
      throw new Error('expected a refusal, got rows');
    }
    /** Walk every page with the cursor. */
    async function walk(sub: string, league: string, limit: number, cat: string | null = null): Promise<string[]> {
      const seen: string[] = [];
      let after: string | null = null;
      for (let i = 0; i < 100; i++) {
        await clearCounters();
        const rows = await call(sub, league, { cat, after, limit });
        if (rows.length === 0) break;
        assert(rows.length <= limit, `page ${i} has at most ${limit} rows`);
        seen.push(...rows.map((r: Row) => r.symbol));
        const more = rows.map((r: Row) => r.has_more);
        assert(more.every((m: boolean) => m === more[0]), 'has_more is the same on every row of a page');
        if (!more[0]) break;
        after = rows[rows.length - 1].symbol;
      }
      return seen;
    }

    await t.step('a member gets rows; the result columns are exactly the six', async () => {
      await clearCounters();
      const res = await as('authenticated', M, () => db.query<Row>(`select * from ${FN}($1)`, [L]));
      assert(res.rows.length > 0, 'a member gets rows');
      assertEquals(res.fields.map((f) => f.name), ['symbol', 'name', 'last_price', 'last_price_at', 'category_ids', 'has_more']);
      const [sig] = await q(`select pg_get_function_result('${FN}(${SIG})'::regprocedure) as r`);
      assertEquals(sig.r, 'TABLE(symbol text, name text, last_price numeric, last_price_at timestamp with time zone, category_ids uuid[], has_more boolean)');
      for (const r of res.rows) {
        assert(r.last_price != null && r.last_price_at != null, `${r.symbol} carries a stored price and its time`);
        assert(!('market_cap' in r) && !('gics_industry' in r));
      }
    });

    await t.step('outsiders are refused, told apart from a grant refusal', async () => {
      await clearCounters();
      const outsider = await refusal(() => call(X, L));
      assertEquals(outsider.code, '42501');
      assert(outsider.message.includes('not a member of this league'), outsider.message);
      const nobody = await refusal(() => call(null, L));
      assertEquals(nobody.code, '42501');
      assert(nobody.message.includes('not authenticated'), nobody.message);
      const nullLeague = await refusal(() => as('authenticated', M, () => q(`select * from ${FN}(null)`)));
      assert(nullLeague.message.includes('not a member'), nullLeague.message);
      const unknownLeague = await refusal(() => call(M, '00000000-0000-4000-8000-00000000beef'));
      assert(unknownLeague.message.includes('not a member'), unknownLeague.message);
      for (const role of ['anon', 'service_role'] as const) {
        const r = await refusal(() => call(M, L, {}, role));
        assertEquals(r.code, '42501');
        assert(r.message.includes('permission denied for function'), `${role}: ${r.message}`);
      }
      const [n] = await q(`select count(*)::int n from rate_limit_counters where bucket like 'stocks-list-%'`);
      assertEquals(n.n, 0, 'a refused call leaves no counter behind');
    });

    await t.step('owned stocks are excluded by net quantity per manager', async () => {
      const all = await walk(M, L, 25);
      for (const s of OWNED_IN_L) assert(!all.includes(s), `${s} is held in L and not listed`);
      for (const s of ['QBAC', 'QPYP']) assert(all.includes(s), `${s} was fully sold and is listed again`);
      assert(all.includes('QMSF'), 'a stock drafted only in another league is listed');
      assert(!all.includes('QNOP') && !all.includes('QTNY'), 'no stored price / not draftable: never listed');
      assert(!all.includes('SKIP'));
      assertEquals(all, expectedOrder((s) => !OWNED_IN_L.has(s.symbol)), 'the whole list, in order');
      // The same caller in a pre-draft league sees the whole draftable universe.
      assertEquals(await walk(M, LEMPTY, 25), expectedOrder(() => true));
      // And X, in L2, does not get QMSF.
      assert(!(await walk(X, L2, 25)).includes('QMSF'));
    });

    await t.step('order and tie-break: cap desc, no size last, ticker', async () => {
      await clearCounters();
      const rows = await call(C, L, { limit: 25 });
      const expected = expectedOrder((s) => !OWNED_IN_L.has(s.symbol));
      assertEquals(rows.map((r: Row) => r.symbol), expected.slice(0, 25));
      // QAPL (3.0e12) and QNVD (2.5e12) are owned, QNOP has no price: QMSF leads, then QXOM is owned, QBAC.
      assertEquals(expected.slice(0, 3), ['QMSF', 'QBAC', 'QMUL']);
      // A tie pair sorts by ticker: FA01 before FB00 although FB00 was inserted first.
      assert(expected.indexOf('FA01') < expected.indexOf('FB00'));
      // The no-size tail is last, by ticker.
      assertEquals(expected.slice(-5), ['FA41', 'FA43', 'FB40', 'FB42', 'FB44']);
    });

    await t.step('the cursor pages without gaps or duplicates', async () => {
      const expected = expectedOrder((s) => !OWNED_IN_L.has(s.symbol));
      for (const size of [25, 7, 2]) {
        const got = await walk(M, L, size);
        assertEquals(got, expected, `page size ${size}`);
        assertEquals(new Set(got).size, got.length, `no duplicates at page size ${size}`);
      }
      // A cursor inside the no-size tail continues within it.
      await clearCounters();
      const tail = await call(M, L, { after: 'FA41', limit: 25 });
      assertEquals(tail.map((r: Row) => r.symbol), ['FA43', 'FB40', 'FB42', 'FB44']);
      assertEquals(tail.every((r: Row) => r.has_more === false), true);
      // Lowercase cursor is the same cursor.
      await clearCounters();
      assertEquals((await call(M, L, { after: 'fa41' })).map((r: Row) => r.symbol), ['FA43', 'FB40', 'FB42', 'FB44']);
      // The last page is empty-after: a cursor at the very end returns no rows.
      await clearCounters();
      assertEquals(await call(M, L, { after: 'FB44' }), []);
      // An unknown cursor is refused, not treated as "from the start".
      await clearCounters();
      const r = await refusal(() => call(M, L, { after: 'NOPE' }));
      assertEquals(r.code, '22023');
    });

    await t.step('at most 25 rows whatever is asked; has_more from one extra row', async () => {
      const total = expectedOrder((s) => !OWNED_IN_L.has(s.symbol)).length;
      assert(total > 25, `fixture has more than a page (${total})`);
      for (const ask of [1000, 26, 25, null]) {
        await clearCounters();
        const rows = await call(M, L, { limit: ask });
        assertEquals(rows.length, 25, `asked ${ask}`);
        assert(rows.every((r: Row) => r.has_more === true));
      }
      for (const ask of [0, -5]) {
        await clearCounters();
        assertEquals((await call(M, L, { limit: ask })).length, 1, `asked ${ask}: one row`);
      }
      // Exactly a full last page: has_more false when nothing follows.
      const expected = expectedOrder((s) => !OWNED_IN_L.has(s.symbol));
      await clearCounters();
      const last = await call(M, L, { after: expected[expected.length - 4], limit: 3 });
      assertEquals(last.map((r: Row) => r.symbol), expected.slice(-3));
      assert(last.every((r: Row) => r.has_more === false), 'nothing follows a page that ends the list');
      await clearCounters();
      const notLast = await call(M, L, { after: expected[expected.length - 5], limit: 3 });
      assert(notLast.every((r: Row) => r.has_more === true), 'one more follows');
    });

    await t.step('category filter and category_ids equal the server resolution', async () => {
      // fetchEligibleCategoryIdsBatch over the same rows, through a minimal admin that reads PGlite.
      const admin = {
        from: (table: string) => ({
          select: (cols: string) => ({
            in: async (col: string, vals: string[]) => ({
              data: await q(`select ${cols} from public.${table} where ${col} = any($1)`, [vals]), error: null,
            }),
          }),
        }),
      };
      const eligible = await fetchEligibleCategoryIdsBatch(admin, SYMS.map((s) => s.symbol));
      const order = new Map([[catId.tech, 901], [catId.fin, 902]]);
      for (const cat of [catId.tech, catId.fin]) {
        const got = await walk(M, L, 25, cat);
        const want = expectedOrder((s) => !OWNED_IN_L.has(s.symbol) && eligible.get(s.symbol)!.has(cat));
        assertEquals(got, want, `category ${cat === catId.tech ? 'tech' : 'fin'}`);
        assert(want.length > 0);
      }
      assert((await walk(M, L, 25, catId.fin)).includes('QPYP'), 'an override replaces the industry rule');
      assert(!(await walk(M, L, 25, catId.tech)).includes('QPYP'));
      assert((await walk(M, L, 25, catId.tech)).includes('QMUL') && (await walk(M, L, 25, catId.fin)).includes('QMUL'));
      await clearCounters();
      assertEquals(await call(M, L, { cat: '00000000-0000-4000-8000-0000000cafe0' }), [], 'an unknown category is empty');
      // Every row's category_ids is the resolution's set, in display order.
      let after: string | null = null;
      for (let i = 0; i < 10; i++) {
        await clearCounters();
        const rows = await call(M, LEMPTY, { after });
        for (const r of rows) {
          const want = [...eligible.get(r.symbol)!].sort((a, b) => order.get(a)! - order.get(b)!);
          assertEquals(r.category_ids, want, `${r.symbol} category_ids`);
        }
        if (!rows.length || !rows[0].has_more) break;
        after = rows[rows.length - 1].symbol;
      }
      assertEquals(eligible.get('QUNC')!.size, 0, 'unclassified');
    });

    await t.step('the limiter refuses past each window on its own; the daily counter is the record', async () => {
      const counters = async () => Object.fromEntries((await q(
        `select bucket, hits from rate_limit_counters where bucket like 'stocks-list-%' and subject = $1`, [`user:${M}`]))
        .map((r: Row) => [r.bucket, r.hits]));
      // Inside one transaction now() is fixed, so no window boundary can fall mid-test.
      const tx = async (fn: () => Promise<void>) => {
        await db.exec('begin');
        try { await fn(); } finally { await db.exec('rollback'); }
      };
      const inSavepoint = async (fn: () => Promise<unknown>) => {
        await db.exec('savepoint s');
        try {
          return await refusal(fn);
        } finally {
          await db.exec('rollback to savepoint s');
        }
      };
      await tx(async () => {
        await clearCounters();
        for (let i = 0; i < 20; i++) await call(M, L);
        assertEquals(await counters(), { 'stocks-list-min': 20, 'stocks-list-hour': 20, 'stocks-list-day': 20 });
        const r = (await inSavepoint(() => call(M, L))) as Row;
        assertEquals(r.code, 'PT429');
        assert(r.message.includes('rate limited'));
        assertEquals((await counters())['stocks-list-day'], 20, 'the daily counter equals the pages served');
        // The same person in another league shares the budget.
        assertEquals(((await inSavepoint(() => call(M, LEMPTY))) as Row).code, 'PT429');
        // Another person is not limited by M.
        assert((await call(C, L)).length > 0);
      });
      for (const [bucket, limit, secs] of [['stocks-list-hour', 120, 3600], ['stocks-list-day', 600, 86400]] as const) {
        await tx(async () => {
          await clearCounters();
          await q(`insert into rate_limit_counters (bucket, subject, window_start, hits)
                   values ($1, $2, to_timestamp(floor(extract(epoch from now()) / $3) * $3), $4)`,
            [bucket, `user:${M}`, secs, limit - 1]);
          assert((await call(M, L)).length > 0, `${bucket}: the ${limit}th call is served`);
          const r = (await inSavepoint(() => call(M, L))) as Row;
          assertEquals(r.code, 'PT429', `${bucket}: refused past ${limit}`);
          const c = await counters();
          assertEquals(c[bucket], limit);
          assertEquals(c['stocks-list-min'], 1, 'the minute window alone would have allowed it');
        });
      }
    });

    await t.step('grants: authenticated only, DEFINER, search_path pinned; symbols ACL unchanged', async () => {
      const [p] = await q(`select prosecdef, proconfig::text as cfg, proacl::text as acl, provolatile
                             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'public' and proname = 'get_league_available_stocks'`);
      assertEquals(p.prosecdef, true);
      assertEquals(p.cfg, '{"search_path=public, pg_temp"}');
      assertEquals(p.acl, '{postgres=X/postgres,authenticated=X/postgres}');
      assertEquals(p.provolatile, 'v', 'volatile: it writes the counters');
      const [n] = await q(`select count(*)::int n from pg_proc where proname = 'get_league_available_stocks'`);
      assertEquals(n.n, 1, 'one overload only');
      assertEquals(await symAcl(), aclBefore, 'symbols table and column ACLs byte-identical');
      const [g] = await q(`select has_column_privilege('authenticated','public.symbols','last_price','SELECT') lp,
                                  has_column_privilege('authenticated','public.symbols','market_cap','SELECT') mc,
                                  has_column_privilege('authenticated','public.symbols','name','SELECT') nm`);
      assertEquals([g.lp, g.mc, g.nm], [false, false, true]);
    });

    await db.close();
  },
});
