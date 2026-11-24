/**
 * The watchlist (20261209000000), server side of the Stocks tab's star (docs/plans/2026-11-18-stocks-tab.md
 * part 3, workstream 2, building docs/plans/2026-10-08-trading-window-and-watchlist.md), on the WHOLE
 * migration chain (full_chain.ts), so Supabase's default grants, the S1 symbols column grant and every
 * other live privilege are in place exactly as db push left them.
 *
 * What it proves:
 *   - grants by proacl, never assumed: set_watchlist and get_league_watchlist are postgres + authenticated
 *     only, the trigger function postgres only, all SECURITY DEFINER with search_path pinned; the table
 *     has RLS on, anon holds nothing, authenticated holds exactly SELECT / INSERT / DELETE; the three
 *     policies are exactly as designed; the symbols table and column ACLs are byte-identical;
 *   - RLS: a manager reads and removes only their OWN rows, only in a league they are a member of;
 *     another member's rows are invisible and undeletable; a non-member sees nothing and cannot insert;
 *     nobody can UPDATE; two leagues keep two lists;
 *   - the write: save (case-folded), idempotent re-save, unsave, unsave of an unsaved stock, an unknown
 *     symbol, a null flag; signed out / outsider / hidden seat / deleted seat / null league are refused;
 *     anon and service_role are refused by the grant;
 *   - the 50 cap, per seat: the 51st save is refused by the write and by a direct insert, a multi-row
 *     insert crossing 50 writes nothing, a re-save at 50 is still a no-op success, unsave frees a place
 *     and the next save takes the lowest, a forged cap_index is overwritten, and by data the seat never
 *     holds more than 50;
 *   - a CONCURRENT save (simulated: PGlite has one connection, so a test-only trigger plays the other
 *     writer between the cap count and the insert, the username_write_path technique): refused by the
 *     unique cap index, never 51, through the write and through a direct insert;
 *   - the reader: exactly symbol, name, category_ids, is_draftable, saved_at; NO price anywhere (result
 *     type, OUT arguments, row keys, no numeric value); category_ids equals the server's own resolution
 *     (_shared/category-eligibility.ts); newest first; refusals raise 42501;
 *   - the rows go with the seat: a leave before the draft (the real leave_league) cascades them away;
 *     a leave after the season hides the seat, keeps the rows and refuses new saves; a bot never has rows;
 *   - docs/security/2026-11-22-watchlist-checks.sql (the post-push checks) reads as documented and its
 *     effect block says PASS, rolling back every save it made.
 *
 * NOT covered (one connection): two truly concurrent transactions queueing on the seat's
 * FOR NO KEY UPDATE lock. That lock is pinned in the source here; the guarantee that a 51st row cannot
 * exist rests on the unique cap index, which the simulated race exercises behaviourally.
 *
 * Run: deno test --allow-read --allow-env supabase/tests/watchlist.pglite.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.2';
import { applyFrom, loadChain } from './full_chain.ts';
import { fetchEligibleCategoryIdsBatch } from '../functions/_shared/category-eligibility.ts';

const VERSION = '20261209000000';
const CHECKS_URL = new URL('../../docs/security/2026-11-22-watchlist-checks.sql', import.meta.url);

const C = '00000000-0000-4000-8000-0000000000e1'; // commissioner of L
const M = '00000000-0000-4000-8000-0000000000e2'; // member of L and of L3
const X = '00000000-0000-4000-8000-0000000000e3'; // signed in; commissioner of L2 only
const H = '00000000-0000-4000-8000-0000000000e4'; // member of LDONE, leaves after the season (hidden)
const D = '00000000-0000-4000-8000-0000000000e5'; // a deleted seat in L
const P = '00000000-0000-4000-8000-0000000000e6'; // member of LPRE, leaves before the draft
const L = '00000000-0000-4000-8000-00000000c001';
const L2 = '00000000-0000-4000-8000-00000000c002';
const L3 = '00000000-0000-4000-8000-00000000c003';
const LPRE = '00000000-0000-4000-8000-00000000c004';
const LDONE = '00000000-0000-4000-8000-00000000c005';

// deno-lint-ignore no-explicit-any
type Row = any;

// 60 plain stocks (S01..S60), plus named ones for categories and draftability.
const PLAIN = Array.from({ length: 60 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`);
const NAMED: { symbol: string; industry: string | null; draftable: boolean }[] = [
  { symbol: 'QTEC', industry: 'ZZ Technology', draftable: true }, // industry rule -> tech
  { symbol: 'QBNK', industry: 'ZZ Banking', draftable: true }, // industry rule -> fin
  { symbol: 'QOVR', industry: 'ZZ Technology', draftable: true }, // override -> fin (replaces the rule)
  { symbol: 'QTWO', industry: 'ZZ Energy', draftable: true }, // overrides -> tech AND fin
  { symbol: 'QUNC', industry: null, draftable: true }, // unclassified
  { symbol: 'QOFF', industry: 'ZZ Banking', draftable: false }, // no longer in the list: still saveable
  { symbol: 'BRK.B', industry: 'ZZ Banking', draftable: true },
  { symbol: 'TOOLONGSYMBOL1', industry: null, draftable: false }, // in symbols, longer than the table holds
];

Deno.test({
  name: 'watchlist on the full chain',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const db = new PGlite();
    const q = async (s: string, p: unknown[] = []) => (await db.query<Row>(s, p)).rows;
    const one = async (s: string, p: unknown[] = []) => (await q(s, p))[0];
    async function as<T>(role: 'anon' | 'authenticated' | 'service_role', sub: string | null, fn: () => Promise<T>): Promise<T> {
      await db.exec(`set role ${role}`);
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub ?? '']);
      try {
        return await fn();
      } finally {
        await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`).catch(() => {});
      }
    }
    async function refusal(fn: () => Promise<unknown>): Promise<{ code: string; message: string; constraint?: string }> {
      try {
        await fn();
      } catch (e) {
        return { code: (e as Row).code, message: (e as Error).message, constraint: (e as Row).constraint };
      }
      throw new Error('expected a refusal, got an answer');
    }
    const clearCounters = () => q(`delete from rate_limit_counters where bucket like 'watchlist-save-%'`);
    /** The write, with the pacing counters cleared first (the pacing step drives them itself, through savePaced). */
    const savePaced = (sub: string | null, league: string | null, sym: string | null, saved: boolean | null = true,
      role: 'anon' | 'authenticated' | 'service_role' = 'authenticated') =>
      as(role, sub, async () => (await one(`select public.set_watchlist($1, $2, $3) r`, [league, sym, saved])).r);
    const save = async (sub: string | null, league: string | null, sym: string | null, saved: boolean | null = true,
      role: 'anon' | 'authenticated' | 'service_role' = 'authenticated') => {
      await clearCounters();
      return await savePaced(sub, league, sym, saved, role);
    };
    const read = (sub: string | null, league: string | null, role: 'anon' | 'authenticated' | 'service_role' = 'authenticated') =>
      as(role, sub, () => q(`select * from public.get_league_watchlist($1)`, [league]));
    const owned = async (league: string, user: string) =>
      (await one(`select count(*)::int n from public.watchlist where league_id = $1 and user_id = $2`, [league, user])).n as number;
    const clear = async () => {
      await q(`delete from public.watchlist`);
      await clearCounters();
    };
    // Column ACLs = the columns that carry one: a column a LATER migration adds
    // with no grant (20261212100000 list_drop_held_at) is not a grant change.
    const symAcl = async () =>
      (await q(`select relacl::text as acl,
                       (select string_agg(a.attname || '=' || coalesce(a.attacl::text, ''), ',' order by a.attname)
                          from pg_attribute a where a.attrelid = 'public.symbols'::regclass and a.attnum > 0
                           and not a.attisdropped and a.attacl is not null) as cols
                  from pg_class where oid = 'public.symbols'::regclass`))[0];

    await loadChain(db, { untilBefore: VERSION });
    const aclBefore = await symAcl();
    const applied = await applyFrom(db, VERSION);
    assert(applied.includes(`${VERSION}_watchlist.sql`), 'the migration under test applied');

    // ---- fixture, as the owner ------------------------------------------------------------
    for (const u of [C, M, X, H, D, P]) await q(`insert into auth.users (id, email) values ($1, $2)`, [u, `${u.slice(-2)}@example.test`]);
    for (const s of PLAIN) {
      await q(`insert into public.symbols (symbol, name, is_draftable, last_price, last_price_at, gics_industry, market_cap)
               values ($1, $2, true, 10, now(), 'ZZ Technology', 1e9)`, [s, `${s} Inc.`]);
    }
    for (const s of NAMED) {
      await q(`insert into public.symbols (symbol, name, is_draftable, last_price, last_price_at, gics_industry, market_cap)
               values ($1, $2, $3, 25, now(), $4, 5e9)`, [s.symbol, `${s.symbol} Inc.`, s.draftable, s.industry]);
    }
    const [tech] = await q(`insert into categories (slug, name, display_order) values ('zz-tech', 'ZZ Tech', 901) returning id`);
    const [fin] = await q(`insert into categories (slug, name, display_order) values ('zz-fin', 'ZZ Finance', 902) returning id`);
    const catId = { tech: tech.id as string, fin: fin.id as string };
    // Display order DISAGREES with uuid order, so category_ids ordered by id would fail.
    const [lo, hi] = [tech.id, fin.id].sort();
    await q(`update categories set display_order = 902 where id = $1`, [lo]);
    await q(`update categories set display_order = 901 where id = $1`, [hi]);
    await q(`insert into category_rules (gics_industry, category_id) values ('ZZ Technology', $1), ('ZZ Banking', $2)`, [catId.tech, catId.fin]);
    await q(`insert into symbol_category_overrides (symbol, category_id, justification) values
               ('QOVR', $2, 'test'), ('QTWO', $1, 'test'), ('QTWO', $2, 'test')`, [catId.tech, catId.fin]);

    const league = (id: string, comm: string, code: string) =>
      q(`insert into leagues (id, name, commissioner_id, invite_code, num_participants, league_type, num_weeks, playoff_teams)
         values ($1, 'League', $2, $3, 8, 'matchup', 4, 2)`, [id, comm, code]);
    await league(L, C, 'WATCHL01');
    await league(L2, X, 'WATCHL02');
    await league(L3, M, 'WATCHL03');
    await league(LPRE, C, 'WATCHL04');
    await league(LDONE, C, 'WATCHL05');
    await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner'), ($1, $3, 'member'), ($1, 'bot-1', 'member')`, [L, C, M]);
    await q(`insert into league_members (league_id, user_id, role, deleted_at) values ($1, $2, 'member', now())`, [L, D]);
    await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner')`, [L2, X]);
    await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner')`, [L3, M]);
    await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner'), ($1, $3, 'member')`, [LPRE, C, P]);
    await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner'), ($1, $3, 'member')`, [LDONE, C, H]);

    await t.step('grants: proacl, DEFINER, search_path; table privileges and policies exact', async () => {
      const fns = await q(`select proname, prosecdef, proconfig::text cfg, proacl::text acl
                             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'public'
                              and proname in ('get_league_watchlist', 'set_watchlist', 'watchlist_before_insert')
                            order by proname`);
      assertEquals(fns.map((r: Row) => [r.proname, r.prosecdef, r.cfg, r.acl]), [
        ['get_league_watchlist', true, '{"search_path=public, pg_temp"}', '{postgres=X/postgres,authenticated=X/postgres}'],
        ['set_watchlist', true, '{"search_path=public, pg_temp"}', '{postgres=X/postgres,authenticated=X/postgres}'],
        ['watchlist_before_insert', true, '{"search_path=public, pg_temp"}', '{postgres=X/postgres}'],
      ]);
      const [ov] = await q(`select count(*)::int n from pg_proc where proname in ('get_league_watchlist', 'set_watchlist', 'watchlist_before_insert')`);
      assertEquals(ov.n, 3, 'one overload each');
      const [tbl] = await q(`select relrowsecurity rls, relforcerowsecurity force from pg_class where oid = 'public.watchlist'::regclass`);
      assertEquals([tbl.rls, tbl.force], [true, false]);
      const privs = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
      for (const role of ['anon', 'authenticated']) {
        const held = [];
        for (const p of privs) {
          const [r] = await q(`select has_table_privilege($1, 'public.watchlist', $2) h`, [role, p]);
          if (r.h) held.push(p);
        }
        assertEquals(held, role === 'anon' ? [] : ['SELECT', 'INSERT', 'DELETE'], `${role} table privileges`);
      }
      const [pub] = await q(`select count(*)::int n from aclexplode((select relacl from pg_class where oid = 'public.watchlist'::regclass)) a
                              where a.grantee = 0`);
      assertEquals(pub.n, 0, 'nothing granted to PUBLIC');
      const pols = await q(`select policyname, cmd, roles::text roles, qual, with_check from pg_policies
                              where schemaname = 'public' and tablename = 'watchlist' order by policyname`);
      const gate = '((user_id = (auth.uid())::text) AND is_member(league_id))';
      assertEquals(pols.map((r: Row) => [r.policyname, r.cmd, r.roles, r.qual, r.with_check]), [
        ['watchlist_delete_own', 'DELETE', '{authenticated}', gate, null],
        ['watchlist_insert_own', 'INSERT', '{authenticated}', null, gate],
        ['watchlist_select_own', 'SELECT', '{authenticated}', gate, null],
      ]);
      assertEquals(await symAcl(), aclBefore, 'symbols table and column ACLs byte-identical');
      const [g] = await q(`select has_column_privilege('authenticated','public.symbols','last_price','SELECT') lp,
                                  has_column_privilege('authenticated','public.symbols','gics_industry','SELECT') gi`);
      assertEquals([g.lp, g.gi], [false, false], 'the column grant still hides price and industry');
    });

    await t.step('the reader returns NO price: not in the result type, the OUT arguments, or any row', async () => {
      await clear();
      for (const s of ['S01', 'QTEC', 'QOFF']) assertEquals((await save(M, L, s)).ok, true);
      const [sig] = await q(`select pg_get_function_result('public.get_league_watchlist(uuid)'::regprocedure) r`);
      assertEquals(sig.r, 'TABLE(symbol text, name text, category_ids uuid[], is_draftable boolean, saved_at timestamp with time zone)');
      const PRICEY = /price|px|quote|close|open|bid|ask|last_|cap|numeric|money|change|industry/i;
      assert(!PRICEY.test(sig.r), sig.r);
      const [args] = await q(`select proargnames, proargmodes::text[] as modes,
                                     (select array_agg(format_type(t, null) order by o)
                                        from unnest(proallargtypes) with ordinality as x(t, o)) as types
                                from pg_proc where oid = 'public.get_league_watchlist(uuid)'::regprocedure`);
      const out = (args.proargnames as string[]).filter((_, i) => args.modes[i] === 't');
      const outTypes = (args.types as string[]).filter((_, i) => args.modes[i] === 't');
      assertEquals(out, ['symbol', 'name', 'category_ids', 'is_draftable', 'saved_at']);
      assert(!out.some((n) => PRICEY.test(n)) && !outTypes.some((x) => PRICEY.test(x)), `${out} ${outTypes}`);
      const res = await as('authenticated', M, () => db.query<Row>(`select * from public.get_league_watchlist($1)`, [L]));
      assertEquals(res.fields.map((f) => f.name), ['symbol', 'name', 'category_ids', 'is_draftable', 'saved_at']);
      assertEquals(res.rows.length, 3);
      for (const r of res.rows) {
        assertEquals(Object.keys(r), ['symbol', 'name', 'category_ids', 'is_draftable', 'saved_at']);
        assert(!Object.values(r).some((v) => typeof v === 'number'), `${r.symbol} carries no number`);
        assertEquals(r.name, `${r.symbol} Inc.`);
      }
      assertEquals(res.rows.find((r: Row) => r.symbol === 'QOFF').is_draftable, false, 'a stock out of the list is still saved');
    });

    await t.step('the write: save, re-save, unsave, refusals', async () => {
      await clear();
      assertEquals(await save(M, L, ' s05 '), { ok: true, saved: true, count: 1 }, 'trimmed and upper-cased');
      assertEquals((await q(`select symbol from public.watchlist where user_id = $1`, [M])).map((r: Row) => r.symbol), ['S05']);
      assertEquals(await save(M, L, 'S05'), { ok: true, saved: true, count: 1 }, 'a re-save is a no-op');
      assertEquals(await save(M, L, 'BRK.B'), { ok: true, saved: true, count: 2 });
      assertEquals(await save(M, L, 'S05', false), { ok: true, saved: false, count: 1 });
      assertEquals(await save(M, L, 'S05', false), { ok: true, saved: false, count: 1 }, 'unsave of an unsaved stock is a no-op');
      assertEquals(await save(M, L, 'NOPE'), { ok: false, reason: 'unknown_symbol' });
      // A stored symbol the table's shape check cannot hold is a clean refusal, not a CHECK error.
      assertEquals(await save(M, L, 'TOOLONGSYMBOL1'), { ok: false, reason: 'unknown_symbol' });
      assertEquals(await save(M, L, ''), { ok: false, reason: 'unknown_symbol' });
      assertEquals(await save(M, L, null), { ok: false, reason: 'unknown_symbol' });
      assertEquals(await save(M, L, 'S06', null), { ok: false, reason: 'invalid' });
      assertEquals(await save(null, L, 'S06'), { ok: false, reason: 'not_authenticated' });
      assertEquals(await save(X, L, 'S06'), { ok: false, reason: 'not_a_member' }, 'a signed-in outsider');
      assertEquals(await save(D, L, 'S06'), { ok: false, reason: 'not_a_member' }, 'a deleted seat');
      assertEquals(await save(M, null, 'S06'), { ok: false, reason: 'not_a_member' });
      assertEquals(await save(M, '00000000-0000-4000-8000-00000000beef', 'S06'), { ok: false, reason: 'not_a_member' });
      for (const role of ['anon', 'service_role'] as const) {
        const r = await refusal(() => save(M, L, 'S06', true, role));
        assertEquals(r.code, '42501');
        assert(r.message.includes('permission denied for function'), `${role}: ${r.message}`);
        const r2 = await refusal(() => read(M, L, role));
        assert(r2.message.includes('permission denied for function'), `${role} reader: ${r2.message}`);
      }
      assertEquals(await owned(L, M), 1, 'no refused call wrote anything');
      assertEquals((await one(`select count(*)::int n from public.watchlist where user_id <> $1`, [M])).n, 0);
    });

    await t.step('RLS: own rows only, only in a member league; no UPDATE; two leagues, two lists', async () => {
      await clear();
      assertEquals((await save(M, L, 'S01')).ok, true);
      assertEquals((await save(M, L, 'S02')).ok, true);
      assertEquals((await save(C, L, 'S03')).ok, true);
      assertEquals((await save(M, L3, 'S04')).ok, true);
      assertEquals((await save(X, L2, 'S01')).ok, true);
      const sel = (sub: string, league: string | null = null) => as('authenticated', sub, () =>
        q(`select league_id, user_id, symbol from public.watchlist ${league ? 'where league_id = $1' : ''} order by league_id, symbol`,
          league ? [league] : []));
      // A member reads only their own rows, in both of their leagues.
      assertEquals((await sel(M)).map((r: Row) => `${r.league_id === L ? 'L' : 'L3'}:${r.symbol}`), ['L:S01', 'L:S02', 'L3:S04']);
      // Another member of the same league sees only theirs.
      assertEquals((await sel(C)).map((r: Row) => r.symbol), ['S03']);
      // A non-member of L sees nothing of L.
      assertEquals(await sel(X, L), []);
      // The reader agrees, per league.
      assertEquals((await read(M, L)).map((r: Row) => r.symbol).sort(), ['S01', 'S02']);
      assertEquals((await read(M, L3)).map((r: Row) => r.symbol), ['S04']);
      assertEquals((await read(C, L)).map((r: Row) => r.symbol), ['S03']);
      // The reader refuses outsiders and the signed-out, told apart from an empty list.
      const out = await refusal(() => read(X, L));
      assertEquals(out.code, '42501');
      assert(out.message.includes('not a member of this league'), out.message);
      const nobody = await refusal(() => read(null, L));
      assert(nobody.message.includes('not authenticated'), nobody.message);
      assert((await refusal(() => read(M, null))).message.includes('not a member'));
      assertEquals(await read(M, LPRE).catch((e) => e.code), '42501', 'M is not in LPRE');

      // Direct writes. Own row in a member league: allowed (the trigger still counts it).
      await as('authenticated', M, () => q(`insert into public.watchlist (league_id, user_id, symbol) values ($1, $2, 'S07')`, [L, M]));
      assertEquals(await owned(L, M), 3);
      // Someone else's user_id: refused by RLS.
      const forged = await refusal(() => as('authenticated', M, () =>
        q(`insert into public.watchlist (league_id, user_id, symbol) values ($1, $2, 'S08')`, [L, C])));
      assertEquals(forged.code, '42501');
      // Naming another person's seat is ONE refusal whatever that seat's state (active, deleted, a bot,
      // not a seat at all, in a league the caller is not in): the trigger refuses it before any lookup,
      // with RLS's own text, so a direct insert is no probe of anyone else's seat.
      const RLS_TEXT = 'new row violates row-level security policy for table "watchlist"';
      for (const [lg, victim] of [[L, C], [L, D], [L, 'bot-1'], [L, X], [LDONE, H], [L2, X]]) {
        const r = await refusal(() => as('authenticated', M, () =>
          q(`insert into public.watchlist (league_id, user_id, symbol) values ($1, $2, 'S08')`, [lg, victim])));
        assertEquals([r.code, r.message], ['42501', RLS_TEXT], `victim ${victim} in ${lg}`);
      }
      // Own user_id in a league they are not in: refused (no seat; RLS would refuse too).
      const outsiderInsert = await refusal(() => as('authenticated', X, () =>
        q(`insert into public.watchlist (league_id, user_id, symbol) values ($1, $2, 'S08')`, [L, X])));
      assertEquals(outsiderInsert.code, '42501');
      // Deleting someone else's row: nothing happens.
      await as('authenticated', M, () => q(`delete from public.watchlist where league_id = $1 and user_id = $2`, [L, C]));
      assertEquals(await owned(L, C), 1, "C's row survives M's delete");
      // X deleting in L: nothing.
      await as('authenticated', X, () => q(`delete from public.watchlist where league_id = $1`, [L]));
      assertEquals(await owned(L, M) + await owned(L, C), 4);
      // Own delete works.
      await as('authenticated', M, () => q(`delete from public.watchlist where league_id = $1 and symbol = 'S07'`, [L]));
      assertEquals(await owned(L, M), 2);
      // Many managers may save the same stock; one unsaving it leaves the others' saves alone.
      assertEquals((await save(C, L, 'S01')).ok, true);
      assertEquals(await save(M, L, 'S01', false), { ok: true, saved: false, count: 1 });
      assertEquals((await read(C, L)).map((r: Row) => r.symbol).sort(), ['S01', 'S03'], "C's save of S01 survives M's unsave");
      assertEquals((await save(M, L, 'S01')).ok, true);
      // No UPDATE for anyone signed in, even on their own row.
      const upd = await refusal(() => as('authenticated', M, () =>
        q(`update public.watchlist set symbol = 'S09' where league_id = $1 and user_id = $2`, [L, M])));
      assertEquals(upd.code, '42501');
      assert(upd.message.includes('permission denied for table watchlist'), upd.message);
      // anon: no table access at all.
      const anon = await refusal(() => as('anon', null, () => q(`select * from public.watchlist`)));
      assertEquals(anon.code, '42501');
      // The bot seat can never hold rows.
      const bot = await refusal(() => q(`insert into public.watchlist (league_id, user_id, symbol) values ($1, 'bot-1', 'S01')`, [L]));
      assertEquals(bot.code, '23514');
      assertEquals(bot.constraint, 'watchlist_not_bot');
      // A lowercase symbol written directly is refused by the shape check (the write upper-cases).
      const lower = await refusal(() => as('authenticated', M, () =>
        q(`insert into public.watchlist (league_id, user_id, symbol) values ($1, $2, 's09')`, [L, M])));
      assertEquals(lower.constraint, 'watchlist_symbol_shape');
    });

    await t.step('the 50 cap: write and direct insert refuse the 51st; multi-row; re-save; unsave frees', async () => {
      await clear();
      for (let i = 0; i < 50; i++) {
        const r = await save(M, L, PLAIN[i]);
        assertEquals(r, { ok: true, saved: true, count: i + 1 }, `save ${i + 1}`);
      }
      assertEquals(await save(M, L, PLAIN[50]), { ok: false, reason: 'watchlist_full', max: 50 });
      assertEquals(await save(M, L, PLAIN[0]), { ok: true, saved: true, count: 50 }, 'a re-save at 50 is still a no-op success');
      const direct = await refusal(() => as('authenticated', M, () =>
        q(`insert into public.watchlist (league_id, user_id, symbol) values ($1, $2, $3)`, [L, M, PLAIN[50]])));
      assertEquals(direct.code, '23514');
      assert(direct.message.startsWith('watchlist_full'), direct.message);
      // Even the owner (service paths) cannot pass 50.
      const ownerTry = await refusal(() => q(`insert into public.watchlist (league_id, user_id, symbol) values ($1, $2, $3)`, [L, M, PLAIN[50]]));
      assertEquals(ownerTry.code, '23514');
      assertEquals(await owned(L, M), 50, 'by data: 50');
      // Another member probing M's FULL seat gets the same one refusal, not "watchlist_full".
      const probe = await refusal(() => as('authenticated', C, () =>
        q(`insert into public.watchlist (league_id, user_id, symbol) values ($1, $2, $3)`, [L, M, PLAIN[50]])));
      assertEquals([probe.code, probe.message], ['42501', 'new row violates row-level security policy for table "watchlist"']);
      // The cap is per seat: the same person in another league, and another member here, are free.
      assertEquals((await save(M, L3, PLAIN[50])).ok, true);
      assertEquals((await save(C, L, PLAIN[50])).ok, true);
      // cap_index is 1..50, each once.
      const idx = (await q(`select cap_index from public.watchlist where league_id = $1 and user_id = $2 order by cap_index`, [L, M]))
        .map((r: Row) => r.cap_index);
      assertEquals(idx, Array.from({ length: 50 }, (_, i) => i + 1));
      // Unsave frees a place; the next save takes the LOWEST free one.
      assertEquals(await save(M, L, PLAIN[9], false), { ok: true, saved: false, count: 49 }); // held cap_index 10
      assertEquals(await save(M, L, PLAIN[50]), { ok: true, saved: true, count: 50 });
      assertEquals((await one(`select cap_index from public.watchlist where league_id = $1 and user_id = $2 and symbol = $3`,
        [L, M, PLAIN[50]])).cap_index, 10);
      // A multi-row insert that crosses 50 writes nothing (the statement fails whole).
      for (const s of [PLAIN[1], PLAIN[2]]) assertEquals((await save(M, L, s, false)).ok, true);
      assertEquals(await owned(L, M), 48);
      const multi = await refusal(() => as('authenticated', M, () =>
        q(`insert into public.watchlist (league_id, user_id, symbol) values ($1, $2, 'QTEC'), ($1, $2, 'QBNK'), ($1, $2, 'QUNC')`, [L, M])));
      assertEquals(multi.code, '23514');
      assertEquals(await owned(L, M), 48, 'nothing of the failed statement landed');
      await as('authenticated', M, () =>
        q(`insert into public.watchlist (league_id, user_id, symbol) values ($1, $2, 'QTEC'), ($1, $2, 'QBNK')`, [L, M]));
      assertEquals(await owned(L, M), 50, 'two rows in one statement are counted row by row');
      // A forged cap_index (and created_at) is overwritten.
      await save(M, L, 'QTEC', false);
      await as('authenticated', M, () =>
        q(`insert into public.watchlist (league_id, user_id, symbol, cap_index, created_at) values ($1, $2, 'QTEC', 50, '2000-01-01')`, [L, M]));
      const forged = await one(`select cap_index, created_at > now() - interval '1 minute' fresh from public.watchlist
                                 where league_id = $1 and user_id = $2 and symbol = 'QTEC'`, [L, M]);
      assert(forged.fresh, 'created_at is the server time');
      assertEquals(await owned(L, M), 50);
      // Structural: even with the trigger off (replica mode), a 51st row cannot exist.
      await db.exec(`set session_replication_role = replica`);
      try {
        const noTrigger = await refusal(() => q(`insert into public.watchlist (league_id, user_id, symbol, cap_index) values ($1, $2, 'QUNC', 51)`, [L, M]));
        assertEquals(noTrigger.constraint, 'watchlist_cap_index_range');
        const dup = await refusal(() => q(`insert into public.watchlist (league_id, user_id, symbol, cap_index) values ($1, $2, 'QUNC', 7)`, [L, M]));
        assertEquals(dup.constraint, 'watchlist_cap_index_key');
      } finally {
        await db.exec(`set session_replication_role = origin`);
      }
      assertEquals(await owned(L, M), 50);
    });

    await t.step('a concurrent save at 49 is refused by the unique cap index: never 51', async () => {
      // PGlite has one connection, so the other writer is played by a test-only BEFORE INSERT trigger
      // that fires AFTER the cap trigger (names fire in order: trg_ < zz_): the cap trigger has counted
      // 49 and picked place 50, then the "other connection" saves a stock into the same seat, which also
      // counts 49 and takes place 50. That is the interleaving the cap must survive.
      await db.exec(`
        create function public.zz_test_race() returns trigger language plpgsql as $$
        declare v text := current_setting('test.race_symbol', true);
        begin
          if coalesce(v, '') <> '' then
            perform set_config('test.race_symbol', '', false);
            insert into public.watchlist (league_id, user_id, symbol) values (new.league_id, new.user_id, v);
          end if;
          return new;
        end $$;
        create trigger zz_test_race before insert on public.watchlist
          for each row execute function public.zz_test_race();`);
      try {
        for (const path of ['write', 'direct'] as const) {
          await clear();
          for (let i = 0; i < 49; i++) await q(`insert into public.watchlist (league_id, user_id, symbol) values ($1, $2, $3)`, [L, M, PLAIN[i]]);
          assertEquals(await owned(L, M), 49);
          await q(`select set_config('test.race_symbol', $1, false)`, [PLAIN[55]]);
          const r = await refusal(() => path === 'write'
            ? save(M, L, PLAIN[50])
            : as('authenticated', M, () => q(`insert into public.watchlist (league_id, user_id, symbol) values ($1, $2, $3)`, [L, M, PLAIN[50]])));
          // set_config is transactional: the failed statement rolled back the trigger's "consumed" too.
          await q(`select set_config('test.race_symbol', '', false)`);
          assertEquals(r.code, '23505', `${path}: ${r.message}`);
          assertEquals(r.constraint, 'watchlist_cap_index_key', `${path}: refused by the cap index`);
          assert((await owned(L, M)) <= 50, `${path}: never more than 50`);
          assertEquals(await owned(L, M), 49, `${path}: one statement, so the simulated writer rolled back with it`);
        }
      } finally {
        await q(`select set_config('test.race_symbol', '', false)`);
        await db.exec(`drop trigger zz_test_race on public.watchlist; drop function public.zz_test_race();`);
      }
      // Both writers take the seat's row lock before counting (queue, not collide, on real Postgres).
      for (const fn of ['watchlist_before_insert', 'set_watchlist']) {
        const [d] = await q(`select prosrc from pg_proc where proname = $1`, [fn]);
        const lock = d.prosrc.search(/from public\.league_members m\s+where m\.league_id = \S+ and m\.user_id = \S+\s+for no key update;/);
        const count = d.prosrc.search(fn === 'set_watchlist' ? /select count\(\*\) into v_count/ : /generate_series\(1, 50\)/);
        assert(lock > 0, `${fn} locks the seat row FOR NO KEY UPDATE`);
        assert(count > lock, `${fn} counts AFTER taking the lock`);
      }
    });

    await t.step('category_ids equals the server resolution; newest first', async () => {
      await clear();
      const syms = ['QTEC', 'QBNK', 'QOVR', 'QTWO', 'QUNC', 'QOFF', 'S01'];
      for (const s of syms) assertEquals((await save(M, L, s)).ok, true);
      // Distinct, known save times (inside one statement now() would tie).
      for (const [i, s] of syms.entries()) {
        await q(`update public.watchlist set created_at = now() - make_interval(mins => $1) where league_id = $2 and user_id = $3 and symbol = $4`,
          [i, L, M, s]);
      }
      const rows = await read(M, L);
      assertEquals(rows.map((r: Row) => r.symbol), syms, 'newest first');
      const admin = {
        from: (table: string) => ({
          select: (cols: string) => ({
            in: async (col: string, vals: string[]) => ({
              data: await q(`select ${cols} from public.${table} where ${col} = any($1)`, [vals]), error: null,
            }),
          }),
        }),
      };
      const eligible = await fetchEligibleCategoryIdsBatch(admin, syms);
      const order = new Map((await q(`select id, display_order from categories where id = any($1)`, [[catId.tech, catId.fin]]))
        .map((r: Row) => [r.id, r.display_order]));
      for (const r of rows) {
        const want = [...eligible.get(r.symbol)!].sort((a, b) => order.get(a)! - order.get(b)!);
        assertEquals(r.category_ids, want, `${r.symbol} category_ids`);
      }
      const by = Object.fromEntries(rows.map((r: Row) => [r.symbol, r.category_ids]));
      assertEquals(by.QOVR, [catId.fin], 'an override replaces the industry rule');
      assertEquals(by.QTWO.length, 2);
      assertEquals(by.QUNC, [], 'unclassified');
      assertEquals(rows.find((r: Row) => r.symbol === 'QOFF').is_draftable, false);
      assertEquals(rows.find((r: Row) => r.symbol === 'S01').is_draftable, true);
    });

    await t.step('the rows go with the seat: leave before the draft cascades; after the season, hidden', async () => {
      await clear();
      assertEquals((await save(P, LPRE, 'S01')).ok, true);
      assertEquals((await save(C, LPRE, 'S02')).ok, true);
      assertEquals((await as('service_role', null, async () =>
        (await one(`select public.leave_league($1, $2, null) r`, [LPRE, P])).r)).status, 'left');
      assertEquals(await owned(LPRE, P), 0, "the leaver's rows went with the seat");
      assertEquals(await owned(LPRE, C), 1, 'the others stay');

      assertEquals((await save(H, LDONE, 'S03')).ok, true);
      await q(`update leagues set draft_status = 'completed', league_start_date = now() - interval '60 days',
                 league_end_date = now() - interval '30 days', season_status = 'completed' where id = $1`, [LDONE]);
      assertEquals((await as('service_role', null, async () =>
        (await one(`select public.leave_league($1, $2, null) r`, [LDONE, H])).r)).status, 'hidden');
      assertEquals(await owned(LDONE, H), 1, 'hidden with the league, not deleted');
      assertEquals(await save(H, LDONE, 'S04'), { ok: false, reason: 'not_a_member' }, 'a hidden seat cannot save');
      const direct = await refusal(() => as('authenticated', H, () =>
        q(`insert into public.watchlist (league_id, user_id, symbol) values ($1, $2, 'S04')`, [LDONE, H])));
      assertEquals(direct.code, '42501');
      assert(direct.message.includes('no longer active'), direct.message);
      // A hidden seat still reads and removes its OWN rows (is_member ignores hidden_at; the DELETE
      // policy allows it, and the write's unsave agrees). The app hides the league; nothing leaks.
      assertEquals((await read(H, LDONE)).map((r: Row) => r.symbol), ['S03']);
      assertEquals(await save(H, LDONE, 'S03', false), { ok: true, saved: false, count: 0 }, 'a hidden seat may unsave');
      assertEquals(await owned(LDONE, H), 0);
      // A deleted stock takes its rows with it.
      assertEquals((await save(M, L, 'QUNC')).ok, true);
      await q(`delete from public.symbols where symbol = 'QUNC'`);
      assertEquals((await one(`select count(*)::int n from public.watchlist where symbol = 'QUNC'`)).n, 0);
    });

    await t.step('pacing: NEW saves per person, each window on its own; re-save, unsave, owner unpaced', async () => {
      await clear();
      const counters = async (who = M) => Object.fromEntries((await q(
        `select bucket, hits from rate_limit_counters where bucket like 'watchlist-save-%' and subject = $1`, [`user:${who}`]))
        .map((r: Row) => [r.bucket, r.hits]));
      // Inside one transaction now() is fixed, so no window boundary can fall mid-test.
      const tx = async (fn: () => Promise<void>) => {
        await db.exec('begin');
        try { await fn(); } finally { await db.exec('rollback'); }
      };
      const inSavepoint = async (fn: () => Promise<unknown>) => {
        await db.exec('savepoint s');
        try { return await refusal(fn); } finally { await db.exec('rollback to savepoint s'); }
      };
      await tx(async () => {
        // 30 new saves a minute, across leagues: 20 in L, 10 in L3.
        for (let i = 0; i < 20; i++) assertEquals((await savePaced(M, L, PLAIN[i])).ok, true, `save ${i + 1}`);
        for (let i = 20; i < 30; i++) assertEquals((await savePaced(M, L3, PLAIN[i])).ok, true, `save ${i + 1}`);
        assertEquals(await counters(), { 'watchlist-save-min': 30, 'watchlist-save-hour': 30, 'watchlist-save-day': 30 });
        // Re-saves and unsaves cost nothing.
        assertEquals((await savePaced(M, L, PLAIN[0])).ok, true);
        assertEquals((await savePaced(M, L, PLAIN[19], false)).ok, true);
        assertEquals((await counters())['watchlist-save-min'], 30, 'a re-save and an unsave are not counted');
        // The 31st new save is refused, through the write and a direct insert, and adds nothing.
        assertEquals(await savePaced(M, L, PLAIN[40]), { ok: false, reason: 'rate_limited' });
        const direct = (await inSavepoint(() => as('authenticated', M, () =>
          q(`insert into public.watchlist (league_id, user_id, symbol) values ($1, $2, $3)`, [L, M, PLAIN[40]])))) as Row;
        assertEquals(direct.code, 'PT429');
        assertEquals((await counters())['watchlist-save-min'], 30, 'a refused save adds nothing');
        assertEquals(await owned(L, M), 19, 'nothing refused was written');
        // Another person is not limited by M; the owner (service paths) is never paced.
        assertEquals((await savePaced(C, L, PLAIN[40])).ok, true);
        await q(`insert into public.watchlist (league_id, user_id, symbol) values ($1, $2, $3)`, [L, M, PLAIN[41]]);
        assertEquals(await owned(L, M), 20);
      });
      for (const [bucket, limit, secs] of [['watchlist-save-hour', 200, 3600], ['watchlist-save-day', 500, 86400]] as const) {
        await tx(async () => {
          await clear();
          await q(`insert into rate_limit_counters (bucket, subject, window_start, hits)
                   values ($1, $2, to_timestamp(floor(extract(epoch from now()) / $3) * $3), $4)`,
            [bucket, `user:${M}`, secs, limit - 1]);
          assertEquals((await savePaced(M, L, 'S01')).ok, true, `${bucket}: save ${limit} is served`);
          assertEquals(await savePaced(M, L, 'S02'), { ok: false, reason: 'rate_limited' }, `${bucket}: refused past ${limit}`);
          const c = await counters();
          assertEquals(c[bucket], limit);
          assertEquals(c['watchlist-save-min'], 1, 'the minute window alone would have allowed it');
        });
      }
    });

    await t.step('the post-push checks read as documented and the effect block says PASS', async () => {
      await clear();
      assertEquals((await save(C, L, 'S01')).ok, true); // a row of someone else's, which the member must not see
      const before = (await one(`select count(*)::int n from public.watchlist`)).n;
      const checks = await Deno.readTextFile(CHECKS_URL);
      const stmt = (marker: string) => {
        const at = checks.indexOf(marker);
        assert(at >= 0, marker);
        return checks.slice(at, checks.indexOf(';', at) + 1);
      };
      const [a] = await q(stmt('SELECT c.relrowsecurity'));
      assertEquals(a, { rls: true, anon_any: false, auth_select: true, auth_insert: true, auth_delete: true, auth_update: false, auth_ddl: false });
      const [acl] = await q(stmt('SELECT relacl::text'));
      const entries = (acl.relacl as string).replace(/[{}]/g, '').split(',').sort();
      // PGlite is Postgres 16: no MAINTAIN ("m"), which prod's 17 adds to the owner and service_role.
      assertEquals(entries, ['authenticated=ard/postgres', 'postgres=arwdDxt/postgres', 'service_role=arwdDxt/postgres']);
      assertEquals((await q(stmt('SELECT policyname'))).map((r: Row) => r.policyname),
        ['watchlist_delete_own', 'watchlist_insert_own', 'watchlist_select_own']);
      assertEquals((await q(stmt('SELECT proname'))).map((r: Row) => [r.proname, r.prosecdef, r.proconfig, r.proacl]), [
        ['get_league_watchlist', true, ['search_path=public, pg_temp'], ['postgres=X/postgres', 'authenticated=X/postgres']],
        ['set_watchlist', true, ['search_path=public, pg_temp'], ['postgres=X/postgres', 'authenticated=X/postgres']],
        ['watchlist_before_insert', true, ['search_path=public, pg_temp'], ['postgres=X/postgres']],
      ]);
      const cons = Object.fromEntries((await q(stmt('SELECT conname'))).map((r: Row) => [r.conname, r.def]));
      assertEquals(cons.watchlist_cap_index_key, 'UNIQUE (league_id, user_id, cap_index)');
      assertEquals(cons.watchlist_cap_index_range, 'CHECK (((cap_index >= 1) AND (cap_index <= 50)))');
      assertEquals(cons.watchlist_seat_fkey,
        'FOREIGN KEY (league_id, user_id) REFERENCES league_members(league_id, user_id) ON DELETE CASCADE');
      assertEquals((await q(stmt('SELECT tgname'))).map((r: Row) => [r.tgname, r.tgenabled]), [['trg_watchlist_before_insert', 'O']]);
      const start = checks.indexOf('do $$');
      const block = checks.slice(start, checks.indexOf('end $$;', start) + 'end $$;'.length);
      const r = await refusal(() => db.exec(block));
      assert(r.message.startsWith('WATCHLIST EFFECT TEST: PASS'), r.message);
      assertEquals((await one(`select count(*)::int n from public.watchlist`)).n, before, 'the effect block rolled back every save');
    });

    await db.close();
  },
});
