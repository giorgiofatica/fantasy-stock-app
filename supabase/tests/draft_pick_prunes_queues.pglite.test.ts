/**
 * 20261129000000: a drafted stock leaves every queue at once (draft room plan, decision 19).
 *
 * Build 12 (League B): Giorgio drafted DNUT and it stayed in his queue. This proves, on the real chain up to the
 * migration and then the migration itself:
 *   - the one-off cleanup removes queue rows for symbols already drafted (League B's state), and only those;
 *   - TWO accounts, A and B, both queue DNUT; A drafts it: DNUT leaves BOTH queues in the same statement, the
 *     rest of each queue is untouched, another league's DNUT queue is untouched, and the auto-pick's own queue
 *     read for B (draft-write.ts loadQueue: league + user, ORDER BY position) no longer contains it;
 *   - the race backstop: a losing insert (same pick_number, 23505) prunes nothing;
 *   - a save that still lists the drafted stock (a screen that had not seen the pick) stores and returns the
 *     list without it, in order;
 *   - grants: the trigger function is executable by no API role; set_draft_queue's proacl is unchanged;
 *     both pin search_path (CLAUDE.md "Postgres function grants": verify with proacl, never assume).
 * The TS half (planQueueCandidates never offers a stock owned in the league) is in
 * supabase/functions/_shared/auto-pick.test.ts.
 *
 *   deno test --allow-read --allow-env --allow-sys --allow-run supabase/tests/draft_pick_prunes_queues.pglite.test.ts
 */
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.2';
import { applyFrom, loadChain, asExistingDuration } from './full_chain.ts';

// deno-lint-ignore no-explicit-any
type Row = any;

const MIG = '20261129000000_draft_pick_prunes_queues.sql';
const A = 'a1a1a1a1-0000-4000-8000-0000000000a1';
const B = 'b2b2b2b2-0000-4000-8000-0000000000b2';
const C = 'c3c3c3c3-0000-4000-8000-0000000000c3';
const D = 'd4d4d4d4-0000-4000-8000-0000000000d4';
const PEOPLE = [A, B, C, D];

Deno.test({
  name: `${MIG}: a drafted stock leaves every queue, server side, with no save`,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const db = new PGlite();
    await loadChain(db, { untilBefore: '20261129000000' });
    const q = async (s: string, p: unknown[] = []) => (await db.query<Row>(s, p)).rows;
    async function as<T>(who: string | 'service', fn: () => Promise<T>): Promise<T> {
      if (who === 'service') await db.exec(`set role service_role; reset request.jwt.claim.sub;`);
      else await db.exec(`set role authenticated; set request.jwt.claim.sub = '${who}';`);
      try {
        return await fn();
      } finally {
        await db.exec(`reset role; reset request.jwt.claim.sub;`);
      }
    }
    const save = (who: string, L: string, syms: string[]) =>
      as(who, async () => (await q(`select public.set_draft_queue($1, $2::text[]) r`, [L, syms]))[0].r);
    const queueOf = async (L: string, who: string) =>
      (await q(`select symbol from draft_queue where league_id = $1 and user_id = $2 order by position`, [L, who]))
        .map((r: Row) => r.symbol);
    let pickNo = 0;
    /** A pick as the edge functions write it (service role, explicit pick_number: the race backstop). */
    const pick = (L: string, who: string, symbol: string, pickNumber = ++pickNo) =>
      as('service', () => q(`insert into drafts (league_id, user_id, symbol, entry_price, quantity, round, pick_number, pick_source)
                             values ($1, $2, $3, 10, 1, 1, $4, 'manual')`, [L, who, symbol, pickNumber]));

    for (const u of PEOPLE) await q(`insert into auth.users (id, email) values ($1, $2)`, [u, `${u.slice(0, 4)}@example.test`]);
    await q(`insert into symbols (symbol, name) values ('DNUT','Krispy Kreme'),('AAPL','Apple'),('MSFT','Microsoft'),
             ('NVDA','Nvidia'),('BAC','Bank of America')`);
    async function league(name: string): Promise<string> {
      const [l] = await asExistingDuration(db, () => q(`insert into leagues (name, commissioner_id, invite_code, num_participants, league_type)
                           values ($1, $2, $3, 8, 'duration') returning id`, [name, A, crypto.randomUUID().slice(0, 8).toUpperCase()]));
      for (const u of PEOPLE) {
        await q(`insert into league_members (league_id, user_id, role) values ($1, $2, $3)`, [l.id, u, u === A ? 'commissioner' : 'member']);
      }
      return l.id as string;
    }

    // ---- BEFORE: League B's state (a pick that never left the queues) ---------------------------------
    const STALE = await league('League B (stale)');
    await save(A, STALE, ['DNUT', 'AAPL']);
    await save(B, STALE, ['MSFT', 'DNUT']);
    await pick(STALE, A, 'DNUT');
    assertEquals(await queueOf(STALE, A), ['DNUT', 'AAPL'], 'fixture: before the fix the drafted stock stays queued');
    assertEquals(await queueOf(STALE, B), ['MSFT', 'DNUT']);

    const queueAcl = async () => (await q(`select p.proacl::text a from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                           where n.nspname = 'public' and p.proname = 'set_draft_queue'`))[0].a;
    const aclBefore = await queueAcl();

    await t.step('apply the migration', async () => {
      assertEquals((await applyFrom(db, '20261129000000'))[0], MIG);
    });

    await t.step('the one-off cleanup removes only drafted symbols, keeping order', async () => {
      assertEquals(await queueOf(STALE, A), ['AAPL']);
      assertEquals(await queueOf(STALE, B), ['MSFT']);
      const [{ n }] = await q(`select count(*)::int n from draft_queue qq join drafts d
                               on d.league_id = qq.league_id and upper(d.symbol) = qq.symbol`);
      assertEquals(n, 0, 'the invariant holds everywhere');
    });

    // ---- A and B both queue DNUT; A drafts it ----------------------------------------------------------
    const L = await league('Two accounts');
    const OTHER = await league('Another league');
    await save(A, L, ['NVDA', 'DNUT', 'AAPL']);
    await save(B, L, ['DNUT', 'MSFT']);
    await save(C, L, ['BAC']);
    await save(B, OTHER, ['DNUT']);

    await t.step('A drafts DNUT: it leaves A\'s AND B\'s queue at once; nothing else moves', async () => {
      await pick(L, A, 'DNUT');
      assertEquals(await queueOf(L, A), ['NVDA', 'AAPL'], 'the picker\'s queue');
      assertEquals(await queueOf(L, B), ['MSFT'], 'another manager\'s queue: no save, no client step');
      assertEquals(await queueOf(L, C), ['BAC'], 'a queue without it is untouched');
      assertEquals(await queueOf(OTHER, B), ['DNUT'], 'league-scoped: another league still has it');
    });

    await t.step('B\'s auto-pick reads a queue without DNUT (the loadQueue select, as service role)', async () => {
      const rows = await as('service', () =>
        q(`select symbol, position from draft_queue where league_id = $1 and user_id = $2 order by position asc`, [L, B]));
      assertEquals(rows.map((r: Row) => r.symbol), ['MSFT']);
      assertFalse(rows.some((r: Row) => r.symbol === 'DNUT'));
    });

    await t.step('a lower-case pick still prunes (drafts.symbol is compared through upper())', async () => {
      await pick(L, B, 'msft');
      assertEquals(await queueOf(L, B), []);
    });

    await t.step('the race loser prunes nothing: a 23505 insert leaves every queue as it was', async () => {
      const before = { a: await queueOf(L, A), c: await queueOf(L, C) };
      let err: Row = null;
      try {
        await pick(L, C, 'BAC', pickNo); // the pick_number the last insert already took
      } catch (e) {
        err = e;
      }
      assertEquals(err?.code, '23505', `the unique (league_id, pick_number) backstop: ${err?.message}`);
      assertEquals(await queueOf(L, C), before.c, 'BAC is still queued: the losing insert did not prune it');
      assertEquals(await queueOf(L, A), before.a);
      const [{ n }] = await q(`select count(*)::int n from drafts where league_id = $1 and symbol = 'BAC'`, [L]);
      assertEquals(n, 0);
    });

    await t.step('a save that still lists the drafted stock stores and returns the list without it', async () => {
      const r = await save(B, L, ['AAPL', 'DNUT', 'NVDA']);
      assertEquals(r.ok, true);
      assertEquals(r.symbols, ['AAPL', 'NVDA'], 'the returned list is what was stored (the client adopts it as saved)');
      assertEquals(await queueOf(L, B), ['AAPL', 'NVDA']);
      const empty = await save(A, L, ['dnut']);
      assertEquals([empty.ok, empty.symbols], [true, []], 'only drafted symbols: an empty queue, not a refusal');
      assertEquals(await queueOf(L, A), []);
    });

    await t.step('a legacy SKIP row (a forfeited turn) does not drop a real ticker named SKIP', async () => {
      await q(`insert into symbols (symbol, name) values ('SKIP', 'A real ticker') on conflict do nothing`);
      await q(`alter table drafts disable trigger drafts_refuse_new_skip`);
      await pick(L, D, 'SKIP'); // as the pre-20261106 skips were written
      await q(`alter table drafts enable trigger drafts_refuse_new_skip`);
      const r = await save(D, L, ['SKIP', 'AAPL']);
      assertEquals(r.symbols, ['SKIP', 'AAPL'], 'the save filter ignores SKIP rows');
      assertEquals(await queueOf(L, D), ['SKIP', 'AAPL']);
    });

    await t.step('set_draft_queue keeps its refusals (unknown symbols, non-member)', async () => {
      assertEquals((await save(B, L, ['ZZZZ'])).reason, 'unknown_symbols');
      const outsider = 'e0e0e0e0-0000-4000-8000-0000000000e0';
      assertEquals((await save(outsider, L, ['AAPL'])).reason, 'not_a_member');
    });

    await t.step('grants: the trigger function is no API role\'s; set_draft_queue keeps its ACL', async () => {
      const acl = await q(`
        select p.proname, p.prosecdef, p.proconfig,
               coalesce((select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ',' order by 1)
                           from aclexplode(p.proacl) a where a.privilege_type = 'EXECUTE'), '') g
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('prune_drafted_symbol_from_queues', 'set_draft_queue') order by 1`);
      const by = Object.fromEntries(acl.map((a: Row) => [a.proname, a]));
      const grantees = (fn: string) => by[fn].g.split(',').filter((x: string) => x && x !== 'postgres');
      assertEquals(grantees('prune_drafted_symbol_from_queues'), []);
      assertEquals(await queueAcl(), aclBefore, 'set_draft_queue\'s proacl is byte-identical to before (prod: authenticated + service_role)');
      assertFalse(grantees('set_draft_queue').some((g: string) => g === 'anon' || g === 'PUBLIC'));
      for (const fn of Object.keys(by)) {
        assert(by[fn].prosecdef, `${fn} is SECURITY DEFINER`);
        assertEquals(by[fn].proconfig, ['search_path=public, pg_temp'], fn);
      }
      const [trg] = await q(`select pg_get_triggerdef(t.oid) d, t.tgenabled e from pg_trigger t
                             where t.tgrelid = 'public.drafts'::regclass and t.tgname = 'trg_drafts_prune_queues'`);
      assert(/AFTER INSERT ON public\.drafts FOR EACH ROW/.test(trg.d), trg.d);
      assertEquals(trg.e, 'O');
    });
  },
});
