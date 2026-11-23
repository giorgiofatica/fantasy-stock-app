/**
 * Top movers (20261210000000 + the schedule 20261210000001), the server side of the Stocks tab's
 * "Top movers" chip (docs/plans/2026-11-18-stocks-tab.md, part 3, workstream 4), on the WHOLE
 * migration chain (full_chain.ts), so Supabase's default grants and every live privilege are in
 * place exactly as db push left them.
 *
 * What it proves:
 *   - grants by proacl, never assumed: get_league_top_movers is postgres + authenticated only,
 *     replace_top_movers postgres + service_role only, both SECURITY DEFINER with search_path
 *     pinned, one overload each; the table has RLS on with NO policy, and anon / authenticated /
 *     PUBLIC hold no privilege on it; the symbols table and column ACLs are byte-identical;
 *   - the write is whole or nothing: under the 90% gate, a truncated or padded ranking, a
 *     mis-ordered one, a duplicate, a null or blank entry, null arguments, bad counts and a
 *     future time are each refused (22023) and change nothing; exactly 90% is written; a write
 *     replaces EVERY row (no leftovers from a longer earlier ranking); an older or same-time
 *     ranking is kept out; the table's CHECK holds the gate even for the owner's direct insert;
 *     anon and authenticated may not call the writer;
 *   - the read: in rank order, at most 25 rows, never a stock anyone in the league holds (a
 *     manager's draft pick, a bot's, a net-positive trade; a stock bought and fully sold IS
 *     listed again), never a stock that is not draftable or not priced or not in symbols;
 *     exactly rank, symbol, name, category_ids, ranked_at with NO price or change anywhere;
 *     category_ids by the server's rule; an empty ranking is no rows; refusals raise 42501 for
 *     signed out / outsider / null league, and anon and service_role are refused by the grant;
 *     the member cannot read the table directly; the limiter refuses the 21st read in a minute;
 *   - the schedule: every 5 minutes, the vault key, the 180 s timeout, and the market_calendar
 *     gate EXERCISED: the command posts once while a session is open, and not at all on a
 *     closed day or with no calendar coverage;
 *   - docs/security/2026-12-10-top-movers-checks.sql (the post-push checks) reads as documented
 *     and its effect block says PASS, rolling back everything it wrote.
 *
 * NOT covered (one connection): two writers racing for the EXCLUSIVE lock. The lock is pinned
 * in the source here; a late writer's refusal (newer_ranking_exists) is exercised in sequence.
 *
 * Run: deno test --allow-read --allow-env supabase/tests/top_movers.pglite.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.2';
import { applyFrom, loadChain } from './full_chain.ts';

const VERSION = '20261210000000';
const CHECKS_URL = new URL('../../docs/security/2026-12-10-top-movers-checks.sql', import.meta.url);
const MIGRATION_URL = new URL('../migrations/20261210000000_top_movers.sql', import.meta.url);

const C = '00000000-0000-4000-8000-0000000000f1'; // commissioner of L
const M = '00000000-0000-4000-8000-0000000000f2'; // member of L
const X = '00000000-0000-4000-8000-0000000000f3'; // signed in; commissioner of L2 only
const H = '00000000-0000-4000-8000-0000000000f4'; // a HIDDEN seat in L (left after the season)
const L = '00000000-0000-4000-8000-00000000d001';
const L2 = '00000000-0000-4000-8000-00000000d002';

// deno-lint-ignore no-explicit-any
type Row = any;

// T001..T120: draftable, priced, sizes descending.
const PLAIN = Array.from({ length: 120 }, (_, i) => `T${String(i + 1).padStart(3, '0')}`);
const WRITER = 'public.replace_top_movers($1, $2, $3, $4, $5)';
const SIG = 'TABLE(place integer, symbol text, name text, category_ids uuid[], ranked_at timestamp with time zone)';

Deno.test({
  name: 'top movers on the full chain',
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
    async function refusal(fn: () => Promise<unknown>): Promise<{ code: string; message: string }> {
      try {
        await fn();
      } catch (e) {
        return { code: (e as Row).code, message: (e as Error).message };
      }
      throw new Error('expected a refusal, got an answer');
    }
    const clearCounters = () => q(`delete from rate_limit_counters where bucket like 'top-movers-%'`);
    const write = (at: string | Date | null, setSize: number | null, fresh: number | null, syms: (string | null)[] | null,
      chg: (number | null)[] | null, role: 'anon' | 'authenticated' | 'service_role' = 'service_role') =>
      as(role, role === 'authenticated' ? M : null, async () => (await one(`select ${WRITER} r`, [at, setSize, fresh, syms, chg])).r);
    const read = async (sub: string | null, league: string | null, role: 'anon' | 'authenticated' | 'service_role' = 'authenticated') => {
      await clearCounters();
      return await as(role, sub, () => q(`select * from public.get_league_top_movers($1)`, [league]));
    };
    const ranking = async () => (await q(`select rank, symbol, change_pct::float8 c, ranked_at, set_size, fresh_count
                                             from public.top_movers order by rank`));
    /** n symbols with changes n, -(n-1), n-2, ...: biggest move first, both ways. */
    const ranked = (syms: string[]) => ({ syms, chg: syms.map((_, i) => (i % 2 ? -1 : 1) * (syms.length - i)) });
    const symAcl = async () =>
      (await q(`select relacl::text as acl,
                       (select string_agg(a.attname || '=' || coalesce(a.attacl::text, ''), ',' order by a.attname)
                          from pg_attribute a where a.attrelid = 'public.symbols'::regclass and a.attnum > 0
                           and not a.attisdropped) as cols
                  from pg_class where oid = 'public.symbols'::regclass`))[0];

    await loadChain(db, { untilBefore: VERSION });
    const aclBefore = await symAcl();
    const applied = await applyFrom(db, VERSION);
    assert(applied.includes(`${VERSION}_top_movers.sql`), 'the migration under test applied');
    assert(applied.includes('20261210000001_schedule_rank_top_movers.sql'), 'the schedule applied');

    // ---- fixture, as the owner ------------------------------------------------------------
    for (const u of [C, M, X, H]) await q(`insert into auth.users (id, email) values ($1, $2)`, [u, `${u.slice(-2)}@example.test`]);
    for (const [i, s] of PLAIN.entries()) {
      await q(`insert into public.symbols (symbol, name, is_draftable, last_price, last_price_at, gics_industry, market_cap)
               values ($1, $2, true, 10, now(), 'ZZ Technology', $3)`, [s, `${s} Inc.`, 1e12 - i * 1e9]);
    }
    await q(`insert into public.symbols (symbol, name, is_draftable, last_price, gics_industry, market_cap) values
               ('UNDR', 'Undraftable', false, 10, 'ZZ Technology', 5e12),
               ('NOPX', 'No price', true, null, 'ZZ Technology', 5e12),
               ('QOVR', 'Override', true, 10, 'ZZ Technology', 1e9),
               ('QUNC', 'Unclassified', true, 10, null, 1e9)`);
    const [tech] = await q(`insert into categories (slug, name, display_order) values ('zz-tech', 'ZZ Tech', 901) returning id`);
    const [fin] = await q(`insert into categories (slug, name, display_order) values ('zz-fin', 'ZZ Finance', 902) returning id`);
    await q(`insert into category_rules (gics_industry, category_id) values ('ZZ Technology', $1)`, [tech.id]);
    await q(`insert into symbol_category_overrides (symbol, category_id, justification) values ('QOVR', $1, 'test')`, [fin.id]);

    const league = (id: string, comm: string, code: string) =>
      q(`insert into leagues (id, name, commissioner_id, invite_code, num_participants, league_type, num_weeks, playoff_teams)
         values ($1, 'League', $2, $3, 8, 'matchup', 4, 2)`, [id, comm, code]);
    await league(L, C, 'TOPMOV01');
    await league(L2, X, 'TOPMOV02');
    await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner'), ($1, $3, 'member'), ($1, 'bot-1', 'member')`, [L, C, M]);
    await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner')`, [L2, X]);
    await q(`insert into league_members (league_id, user_id, role, hidden_at) values ($1, $2, 'member', now())`, [L, H]);
    // In L: M drafted T001; the bot drafted T003; C drafted T002 and sold all of it (free again);
    // M bought t005 (lower case) and sold part (still held); C sold T004 it never held (no offset).
    // In L2: X drafted T006 (held in L2, NOT in L).
    await q(`insert into drafts (league_id, user_id, symbol, entry_price, quantity, round, pick_number) values
               ($1, $2, 'T001', 10, 5, 1, 1), ($1, 'bot-1', 'T003', 10, 5, 1, 2), ($1, $3, 'T002', 10, 4, 1, 3),
               ($4, $5, 'T006', 10, 5, 1, 1)`, [L, M, C, L2, X]);
    const trade = (league: string, user: string, sym: string, action: 'buy' | 'sell', qty: number) =>
      q(`insert into trades (league_id, user_id, symbol, action, quantity, price, total_value) values ($1, $2, $3, $4, $5, 10, $6)`,
        [league, user, sym, action, qty, qty * 10]);
    await trade(L, C, 'T002', 'sell', 4);
    await trade(L, M, 't005', 'buy', 3);
    await trade(L, M, 'T005', 'sell', 1);
    await trade(L, C, 'T004', 'sell', 2);

    await t.step('grants: proacl, DEFINER, search_path; the table has RLS, no policy, no client privilege', async () => {
      const fns = await q(`select proname, prosecdef, proconfig::text cfg, proacl::text acl
                             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'public' and proname in ('get_league_top_movers', 'replace_top_movers')
                            order by proname`);
      assertEquals(fns.map((r: Row) => [r.proname, r.prosecdef, r.cfg, r.acl]), [
        ['get_league_top_movers', true, '{"search_path=public, pg_temp"}', '{postgres=X/postgres,authenticated=X/postgres}'],
        ['replace_top_movers', true, '{"search_path=public, pg_temp"}', '{postgres=X/postgres,service_role=X/postgres}'],
      ]);
      const [ov] = await q(`select count(*)::int n from pg_proc where proname in ('get_league_top_movers', 'replace_top_movers')`);
      assertEquals(ov.n, 2, 'one overload each');
      const [tbl] = await q(`select relrowsecurity rls, relforcerowsecurity force from pg_class where oid = 'public.top_movers'::regclass`);
      assertEquals([tbl.rls, tbl.force], [true, false]);
      const privs = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
      for (const role of ['anon', 'authenticated']) {
        const held = [];
        for (const p of privs) {
          const [r] = await q(`select has_table_privilege($1, 'public.top_movers', $2) h`, [role, p]);
          if (r.h) held.push(p);
        }
        assertEquals(held, [], `${role} table privileges`);
      }
      const [pub] = await q(`select count(*)::int n from aclexplode((select relacl from pg_class where oid = 'public.top_movers'::regclass)) a
                              where a.grantee = 0`);
      assertEquals(pub.n, 0, 'nothing granted to PUBLIC');
      assertEquals((await q(`select * from pg_policies where schemaname = 'public' and tablename = 'top_movers'`)).length, 0);
      assertEquals(await symAcl(), aclBefore, 'symbols table and column ACLs byte-identical');
      const [fk] = await q(`select count(*)::int n from pg_constraint where conrelid = 'public.top_movers'::regclass and contype = 'f'`);
      assertEquals(fk.n, 0, 'no foreign key');
      // The CLI splitter's trap word never appears outside a comment (CLAUDE.md).
      const sql = (await Deno.readTextFile(MIGRATION_URL)).replace(/--.*$/gm, '');
      assert(!/\batomic\b/i.test(sql));
    });

    await t.step('the writer: only service_role, and only a whole ranking that passes the gate', async () => {
      const hundred = ranked(PLAIN.slice(0, 100));
      const at = await one(`select now() - interval '10 minutes' as t`);
      // Not callable by the clients.
      for (const role of ['anon', 'authenticated'] as const) {
        const r = await refusal(() => write(at.t, 500, 500, hundred.syms, hundred.chg, role));
        assertEquals(r.code, '42501', role);
        assert(r.message.includes('permission denied for function'), `${role}: ${r.message}`);
      }
      const swap = [...hundred.chg];
      [swap[0], swap[1]] = [swap[1], swap[0]];
      const bad: Array<[string, Parameters<typeof write>]> = [
        ['null time', [null, 500, 500, hundred.syms, hundred.chg]],
        ['null symbols', [at.t, 500, 500, null, hundred.chg]],
        ['future', [new Date(Date.now() + 5 * 60_000), 500, 500, hundred.syms, hundred.chg]],
        ['set 0', [at.t, 0, 0, [], []]],
        ['fresh > set', [at.t, 500, 501, hundred.syms, hundred.chg]],
        ['under 90% (449/500)', [at.t, 500, 449, hundred.syms, hundred.chg]],
        ['under 90% (8/10)', [at.t, 10, 8, hundred.syms.slice(0, 8), hundred.chg.slice(0, 8)]],
        ['truncated (99 of 450 fresh)', [at.t, 500, 450, hundred.syms.slice(0, 99), hundred.chg.slice(0, 99)]],
        ['short (40 of 45 fresh)', [at.t, 50, 45, hundred.syms.slice(0, 40), hundred.chg.slice(0, 40)]],
        ['padded (101)', [at.t, 500, 500, [...hundred.syms, 'T101'], [...hundred.chg, 0]]],
        ['lengths differ', [at.t, 500, 500, hundred.syms, hundred.chg.slice(0, 99)]],
        ['misordered', [at.t, 500, 500, hundred.syms, swap]],
        ['duplicate', [at.t, 500, 500, [...hundred.syms.slice(0, 99), 'T001'], hundred.chg]],
        ['null symbol', [at.t, 500, 500, [null, ...hundred.syms.slice(1)], hundred.chg]],
        ['blank symbol', [at.t, 500, 500, [' ', ...hundred.syms.slice(1)], hundred.chg]],
        ['null change', [at.t, 500, 500, hundred.syms, [null, ...hundred.chg.slice(1)]]],
      ];
      for (const [label, args] of bad) {
        const r = await refusal(() => write(...args));
        assertEquals(r.code, '22023', `${label}: ${r.message}`);
      }
      assertEquals((await ranking()).length, 0, 'no refused call wrote anything');

      // Exactly 90%: written, every row carrying the run's values.
      assertEquals((await write(at.t, 500, 450, hundred.syms, hundred.chg)).written, true);
      let rows = await ranking();
      assertEquals(rows.length, 100);
      assertEquals(rows.map((r: Row) => r.symbol), hundred.syms);
      assertEquals(rows.map((r: Row) => r.rank), Array.from({ length: 100 }, (_, i) => i + 1));
      assertEquals(new Set(rows.map((r: Row) => `${r.ranked_at.toISOString()}|${r.set_size}|${r.fresh_count}`)).size, 1);
      assertEquals([rows[0].set_size, rows[0].fresh_count, rows[0].c, rows[1].c], [500, 450, 100, -99]);

      // A smaller ranking later replaces EVERY row: nothing of the longer one survives.
      const later = await one(`select now() - interval '5 minutes' as t`);
      const ten = ranked(PLAIN.slice(50, 60));
      assertEquals((await write(later.t, 10, 10, ten.syms, ten.chg)).written, true);
      rows = await ranking();
      assertEquals(rows.map((r: Row) => r.symbol), ten.syms);
      // An older ranking, or the same time again, is kept out.
      for (const old of [at.t, later.t]) {
        const r = await write(old, 500, 500, hundred.syms, hundred.chg);
        assertEquals([r.written, r.reason], [false, 'newer_ranking_exists']);
      }
      assertEquals((await ranking()).map((r: Row) => r.symbol), ten.syms);
      // Equal moves either way are in order (ties allowed).
      const tie = await one(`select now() - interval '4 minutes' as t`);
      assertEquals((await write(tie.t, 3, 3, ['T010', 'T011', 'T012'], [5, -5, 5])).written, true);

      // The table's own CHECK holds the gate, even for the owner writing directly.
      const r = await refusal(() => q(`insert into public.top_movers (rank, symbol, change_pct, ranked_at, set_size, fresh_count)
                                         values (50, 'T099', 1, now(), 500, 449)`));
      assertEquals(r.code, '23514');
      const r2 = await refusal(() => q(`insert into public.top_movers (rank, symbol, change_pct, ranked_at, set_size, fresh_count)
                                          values (101, 'T099', 1, now(), 10, 10)`));
      assertEquals(r2.code, '23514');
      // The writer source takes the EXCLUSIVE lock before it compares times.
      const [src] = await q(`select prosrc from pg_proc where proname = 'replace_top_movers'`);
      const body = src.prosrc as string;
      assert(body.indexOf('lock table public.top_movers in exclusive mode') > 0);
      assert(body.indexOf('lock table') < body.indexOf('newer_ranking_exists'));
    });

    // The ranking the reads use: T001..T100 at ranks 1..100, plus the edge cases spliced in.
    const READ_SET = ['T001', 'UNDR', 'T002', 'NOPX', 'T003', 'GONE', 'T004', 'T005', 'T006', 'QOVR', 'QUNC',
      ...PLAIN.slice(6, 95)];
    const readAt = await one(`select now() - interval '1 minute' as t`);

    await t.step('the read: rank order, 25 at most, never held, never unlistable, no price', async () => {
      // An empty ranking is no rows (the table is emptied as the owner for this one check).
      await q(`delete from public.top_movers where true`);
      assertEquals(await read(M, L), []);

      const rk = ranked(READ_SET);
      assertEquals((await write(readAt.t, 500, 480, rk.syms, rk.chg)).written, true);
      const res = await as('authenticated', M, async () => {
        await clearCounters();
        return await db.query<Row>(`select * from public.get_league_top_movers($1)`, [L]);
      });
      assertEquals(res.fields.map((f) => f.name), ['place', 'symbol', 'name', 'category_ids', 'ranked_at']);
      const syms = res.rows.map((r: Row) => r.symbol);
      // Held in L: T001 (M), T003 (bot), T005 (M, net 2). Unlistable: UNDR, NOPX, GONE.
      // Listed: T002 (fully sold), T004 (C's sell does not offset anything), T006 (held in L2 only).
      assertEquals(syms.slice(0, 5), ['T002', 'T004', 'T006', 'QOVR', 'QUNC']);
      assertEquals(res.rows.length, 25);
      for (const bad of ['T001', 'T003', 'T005', 'UNDR', 'NOPX', 'GONE']) assert(!syms.includes(bad), bad);
      // place is 1..n within this reply: no trace of the whole ranking's gaps (what L holds).
      assertEquals(res.rows.map((r: Row) => r.place), Array.from({ length: 25 }, (_, i) => i + 1));
      // and the rows follow the stored ranking's order.
      const order = READ_SET.filter((s) => syms.includes(s));
      assertEquals(syms, order);
      for (const r of res.rows) {
        assertEquals(Object.keys(r), ['place', 'symbol', 'name', 'category_ids', 'ranked_at']);
        assertEquals(r.ranked_at.toISOString(), new Date(readAt.t).toISOString());
        assert(typeof r.name === 'string' && r.name.length > 0);
      }
      const byS = Object.fromEntries(res.rows.map((r: Row) => [r.symbol, r.category_ids]));
      assertEquals(byS.T002, [tech.id], 'the industry rule');
      assertEquals(byS.QOVR, [fin.id], 'an override replaces the rule');
      assertEquals(byS.QUNC, [], 'unclassified');
      // A hidden seat reads like any member (is_member, as the Available list): pinned.
      assertEquals((await read(H, L)).map((r: Row) => r.symbol), syms);
      // In L2, X holds T006 and nothing else: T001 leads.
      const l2 = await read(X, L2);
      assertEquals(l2[0].symbol, 'T001');
      assert(!l2.some((r: Row) => r.symbol === 'T006'));
    });

    await t.step('the read returns no price: not in the result type, the OUT arguments or the rows', async () => {
      const [sig] = await q(`select pg_get_function_result('public.get_league_top_movers(uuid)'::regprocedure) r`);
      assertEquals(sig.r, SIG);
      const PRICEY = /price|px|quote|close|open|bid|ask|last_|cap|numeric|money|change|pct|industry/i;
      assert(!PRICEY.test(sig.r), sig.r);
      const [args] = await q(`select proargnames, proargmodes::text[] as modes,
                                     (select array_agg(format_type(t, null) order by o)
                                        from unnest(proallargtypes) with ordinality as x(t, o)) as types
                                from pg_proc where oid = 'public.get_league_top_movers(uuid)'::regprocedure`);
      const out = (args.proargnames as string[]).filter((_, i) => args.modes[i] === 't');
      const outTypes = (args.types as string[]).filter((_, i) => args.modes[i] === 't');
      assertEquals(out, ['place', 'symbol', 'name', 'category_ids', 'ranked_at']);
      assertEquals(outTypes, ['integer', 'text', 'text', 'uuid[]', 'timestamp with time zone']);
      for (const r of await read(M, L)) {
        // The one number is the place in this reply, an integer 1-25.
        const nums = Object.entries(r).filter(([, v]) => typeof v === 'number');
        assertEquals(nums.map(([k]) => k), ['place']);
        assert(Number.isInteger(r.place) && r.place >= 1 && r.place <= 25);
      }
    });

    await t.step('the read refuses: signed out, outsider, null league; anon and service_role by the grant', async () => {
      for (const [sub, league, label] of [[null, L, 'signed out'], [X, L, 'outsider'], [M, null, 'null league'],
        [M, '00000000-0000-4000-8000-00000000beef', 'no such league']] as const) {
        const r = await refusal(() => read(sub, league));
        assertEquals(r.code, '42501', label);
        assert(/not authenticated|not a member/.test(r.message), `${label}: ${r.message}`);
      }
      for (const role of ['anon', 'service_role'] as const) {
        const r = await refusal(() => read(M, L, role));
        assertEquals(r.code, '42501', role);
        assert(r.message.includes('permission denied for function'), `${role}: ${r.message}`);
      }
      // RLS and the ACL: the member cannot read the table itself.
      const direct = await refusal(() => as('authenticated', M, () => q(`select * from public.top_movers`)));
      assertEquals(direct.code, '42501');
    });

    await t.step('the limiter: the 21st read in a minute is refused; another person is not', async () => {
      await db.exec('begin');
      try {
        await clearCounters();
        for (let i = 0; i < 20; i++) await as('authenticated', M, () => q(`select * from public.get_league_top_movers($1)`, [L]));
        await db.exec('savepoint s');
        const r = await refusal(() => as('authenticated', M, () => q(`select * from public.get_league_top_movers($1)`, [L])));
        await db.exec('rollback to savepoint s');
        assertEquals(r.code, 'PT429');
        assert(r.message.includes('rate limited'));
        assert((await as('authenticated', C, () => q(`select * from public.get_league_top_movers($1)`, [L]))).length > 0);
      } finally {
        await db.exec('rollback');
      }
    });

    await t.step('the schedule: every 5 minutes, vault key, 180 s timeout, posts only while the market is open', async () => {
      const [job] = await q(`select schedule, command from cron.job where jobname = 'rank_top_movers'`);
      assertEquals(job.schedule, '*/5 * * * *');
      const cmd = job.command as string;
      assert(cmd.includes(`url     := 'https://haiaaifjcclsvmkfqgmd.supabase.co/functions/v1/rank-top-movers'`));
      assert(cmd.includes(`(select decrypted_secret from vault.decrypted_secrets where name = 'cron_apikey' limit 1)`));
      assert(cmd.includes('timeout_milliseconds := 180000'));
      assert(cmd.includes(`where exists (select 1 from public.market_session_status() s where s.status = 'open')`));

      // Exercise the gate: a recording pg_net stub, then the real command under three calendars.
      await db.exec(`create table if not exists public.zz_posts (url text, apikey text, timeout int);
        create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
          headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language plpgsql as $f$
        begin insert into public.zz_posts values (url, headers ->> 'apikey', timeout_milliseconds); return 1; end $f$;`);
      await q(`insert into vault.secrets (name, secret) values ('cron_apikey', 'cron-test-key') on conflict (name) do nothing`);
      const posts = async () => {
        await q(`delete from public.zz_posts`);
        await db.exec(cmd);
        return await q(`select * from public.zz_posts`);
      };
      const today = `(now() at time zone 'America/New_York')::date`;
      await db.exec(`delete from public.market_calendar; delete from public.market_calendar_coverage;`);
      assertEquals((await posts()).length, 0, 'no coverage: unknown, no post');
      await q(`insert into public.market_calendar_coverage (covered_from, covered_through) values (${today} - 3, ${today} + 3)`);
      assertEquals((await posts()).length, 0, 'covered, no session today: closed, no post');
      await q(`insert into public.market_calendar (session_date, open_et, close_et) values (${today}, '00:00', '23:59:59.999')`);
      assertEquals(await posts(), [{ url: 'https://haiaaifjcclsvmkfqgmd.supabase.co/functions/v1/rank-top-movers', apikey: 'cron-test-key', timeout: 180000 }]);
      await db.exec(`drop table public.zz_posts`);
    });

    await t.step('the post-push checks read as documented and the effect block says PASS', async () => {
      // The real ranking (from the read step) must survive the block.
      const before = await ranking();
      const countersBefore = (await one(`select count(*)::int n from rate_limit_counters where bucket like 'top-movers-%'`)).n;
      const checks = await Deno.readTextFile(CHECKS_URL);
      const stmt = (marker: string) => {
        const at = checks.indexOf(marker);
        assert(at >= 0, marker);
        return checks.slice(at, checks.indexOf(';', at) + 1);
      };
      assertEquals((await q(stmt('SELECT c.relrowsecurity')))[0], { rls: true, anon_any: false, auth_any: false });
      const [acl] = await q(stmt('SELECT relacl::text'));
      // PGlite is Postgres 16: no MAINTAIN ("m"), which prod's 17 adds.
      assertEquals((acl.relacl as string).replace(/[{}]/g, '').split(',').sort(),
        ['postgres=arwdDxt/postgres', 'service_role=arwdDxt/postgres']);
      assertEquals((await q(stmt('SELECT policyname'))).length, 0);
      assertEquals((await q(stmt('SELECT proname'))).map((r: Row) => [r.proname, r.prosecdef, r.proconfig, r.proacl]), [
        ['get_league_top_movers', true, ['search_path=public, pg_temp'], ['postgres=X/postgres', 'authenticated=X/postgres']],
        ['replace_top_movers', true, ['search_path=public, pg_temp'], ['postgres=X/postgres', 'service_role=X/postgres']],
      ]);
      const cons = Object.fromEntries((await q(stmt('SELECT conname'))).map((r: Row) => [r.conname, r.def]));
      assertEquals(cons, {
        top_movers_gate:
          'CHECK (((set_size > 0) AND ((fresh_count >= 1) AND (fresh_count <= set_size)) AND (((fresh_count)::bigint * 10) >= ((set_size)::bigint * 9))))',
        top_movers_pkey: 'PRIMARY KEY (rank)',
        top_movers_rank_range: 'CHECK (((rank >= 1) AND (rank <= 100)))',
        top_movers_symbol_key: 'UNIQUE (symbol)',
        top_movers_symbol_shape: "CHECK ((btrim(symbol) <> ''::text))",
      });
      const [job] = await q(stmt('SELECT jobname, schedule'));
      assertEquals([job.jobname, job.schedule, job.active], ['rank_top_movers', '*/5 * * * *', true]);
      const [f] = await q(stmt('SELECT max(ranked_at) AS ranked_at'));
      assertEquals([Number(f.rows), Number(f.runs), f.set_size, f.fresh_count], [before.length, 1, 500, 480]);
      await q(stmt('SELECT run_date, status'));

      const start = checks.indexOf('do $$');
      const block = checks.slice(start, checks.indexOf('end $$;', start) + 'end $$;'.length);
      const r = await refusal(() => db.exec(block));
      assert(r.message.startsWith('TOP MOVERS EFFECT TEST: PASS'), r.message);
      assertEquals(await ranking(), before, 'the effect block rolled back its ranking');
      assertEquals((await one(`select count(*)::int n from rate_limit_counters where bucket like 'top-movers-%'`)).n,
        countersBefore, 'and its paced reads');
    });

    await db.close();
  },
});
