/**
 * The draft room's reads BEFORE the start (plan docs/plans/2026-11-10-pre-draft-room.md, W2).
 *
 * The room becomes its own route from T-1h (draft_status 'not_started', start_state 'room_open'). Today it
 * only mounts while drafting, so nothing proved its reads answer before the start. lib/game/useDraftRoom.ts
 * reads, in one Promise.all:
 *   get_draft_clock(league)          SECURITY INVOKER (20261010000000), leagues/drafts RLS decide
 *   get_draft_order(league)          SECURITY DEFINER (20261013000000), is_member gate, the lazy reveal
 *   drafts (select)                  RLS "Users can view picks in their leagues" (20251205110000)
 *   get_league_display_names(league) SECURITY DEFINER (20261119000001), raises 42501 for a non-member
 *   draft_queue (select, own rows)   RLS draft_queue_select_own (20261010000000)
 * This proves, on the WHOLE migration chain (full_chain.ts), as a league MEMBER who is not the commissioner:
 *   - each read returns a clean "waiting" answer (no error) before T-1h, in the room window before the gate
 *     has cleared, and in the room window once the order is set;
 *   - the order (and so the caller's position) is not on the server before the room opens: get_draft_order
 *     returns order null and league_draft_order has no rows, for a random-order league, until the gate clears;
 *   - a signed-in non-member is refused by every read (zero rows, {ok:false}, or 42501), and anon cannot
 *     execute the three RPCs at all (proacl: no anon, no PUBLIC — CLAUDE.md "Postgres function grants").
 * It also pins one ruled behaviour (see the step's comment): a MANUAL-order league's members can read the
 * commissioner's open order before T-1h.
 *
 * Time is relative to the DB clock (now()), so the windows are real. Run:
 *   deno test --allow-read --allow-env --allow-sys --allow-run supabase/tests/draft_room_reads.pglite.test.ts
 */
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.2';
import { loadChain, asExistingDuration } from './full_chain.ts';

// deno-lint-ignore no-explicit-any
type Row = any;

const COMMISH = 'c0c0c0c0-0000-4000-8000-0000000000c0';
const MEMBER = 'a1a1a1a1-0000-4000-8000-0000000000a1';
const M3 = 'a3a3a3a3-0000-4000-8000-0000000000a3';
const M4 = 'a4a4a4a4-0000-4000-8000-0000000000a4';
const OUTSIDER = 'e0e0e0e0-0000-4000-8000-0000000000e0';
const MEMBERS = [COMMISH, MEMBER, M3, M4];

Deno.test({
  name: 'draft room reads answer a member cleanly before the start, and refuse a non-member',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const db = new PGlite();
    await loadChain(db);
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
    async function errorOf(fn: () => Promise<unknown>): Promise<Row> {
      try {
        await fn();
      } catch (e) {
        return e;
      }
      return null;
    }

    for (const u of [...MEMBERS, OUTSIDER]) {
      await q(`insert into auth.users (id, email) values ($1, $2)`, [u, `${u.slice(0, 4)}@example.test`]);
    }

    /** A not_started league as the owner (auth.uid() NULL): four members, the draft `minutes` from now. */
    async function league(minutes: number, mode: 'random' | 'manual' = 'random'): Promise<string> {
      const [l] = await asExistingDuration(db, () => q(
        `insert into leagues (name, commissioner_id, invite_code, num_participants, league_type, draft_order_mode, draft_date)
         values ('Room reads', $1, $2, 8, 'duration', $3, now() + make_interval(mins => $4)) returning id`,
        [COMMISH, crypto.randomUUID().slice(0, 8).toUpperCase(), mode, minutes],
      ));
      for (const u of MEMBERS) {
        await q(`insert into league_members (league_id, user_id, role) values ($1, $2, $3)`, [l.id, u, u === COMMISH ? 'commissioner' : 'member']);
      }
      return l.id as string;
    }
    /** The five reads exactly as useDraftRoom makes them (the select lists are copied from the hook). */
    async function roomReads(who: string, L: string) {
      return await as(who, async () => ({
        clock: await q(`select * from public.get_draft_clock($1)`, [L]),
        order: (await q(`select public.get_draft_order($1) r`, [L]))[0].r,
        picks: await q(`select pick_number, symbol, pick_source, entry_price from drafts where league_id = $1`, [L]),
        names: await errorOf(() => q(`select * from public.get_league_display_names($1)`, [L]))
          ?? await q(`select * from public.get_league_display_names($1)`, [L]),
        queue: await q(`select symbol, position from draft_queue where league_id = $1 order by position`, [L]),
        orderTable: await q(`select position, user_id from league_draft_order where league_id = $1`, [L]),
      }));
    }
    /** A member's waiting answer: everything a not-started room needs, nothing an error. */
    function assertWaitingClock(clock: Row[]) {
      assertEquals(clock.length, 1, 'the member gets their league row');
      const c = clock[0];
      assertEquals(c.draft_status, 'not_started');
      assertEquals(c.clock_running, false, 'no clock runs before the start');
      assertEquals(c.deadline_at, null);
      assertEquals(c.turn_started_at, null);
      assertEquals(c.picks_made, 0);
      assert(c.server_now instanceof Date, 'server_now carries the DB clock');
    }

    // ---- before T-1h --------------------------------------------------------------------------------
    const EARLY = await league(180);
    // The member's own queue, built before the draft (the lobby's QueueEditor; set_draft_queue checks symbols).
    await q(`insert into symbols (symbol, name) values ('AAPL', 'Apple'), ('MSFT', 'Microsoft') on conflict do nothing`);
    const saved = await as(MEMBER, async () => (await q(`select public.set_draft_queue($1, array['AAPL','MSFT']) r`, [EARLY]))[0].r);
    assertEquals(saved.ok, true, `a member can queue before the start: ${JSON.stringify(saved)}`);
    await as(M3, () => q(`select public.set_draft_queue($1, array['MSFT'])`, [EARLY]));

    await t.step('before T-1h: every read answers the member, and the order is not on the server', async () => {
      const r = await roomReads(MEMBER, EARLY);
      assertWaitingClock(r.clock);
      assertEquals(r.order.ok, true);
      assertEquals(r.order.order, null, 'no order before the room opens');
      assertEquals(r.order.revealed, false);
      assertEquals(r.order.state, 'open');
      assertEquals(r.order.is_commissioner, false);
      assertEquals(r.order.can_edit_order, false);
      assertEquals(r.order.waiting_for_members, false);
      assertEquals(r.orderTable, [], 'and none in the table either (no leak around the RPC)');
      assertEquals(r.picks, [], 'no picks: an empty list, not an error');
      assert(Array.isArray(r.names), `names answer the member: ${r.names?.message}`);
      assertEquals(r.names.map((n: Row) => n.user_id).sort(), [...MEMBERS].sort());
      assertEquals(r.queue.map((x: Row) => x.symbol), ['AAPL', 'MSFT'], 'my queue, in order');
    });

    await t.step('a member reads only their OWN queue (M3 queued MSFT; the member never sees it)', async () => {
      const mine = await as(MEMBER, () => q(`select user_id from draft_queue where league_id = $1`, [EARLY]));
      assertEquals([...new Set(mine.map((x: Row) => x.user_id))], [MEMBER]);
    });

    // ---- the room window, before the gate has cleared -----------------------------------------------
    const WINDOW = await league(50);
    await t.step('T-1h passed but the gate has not cleared: still waiting, still no order, no error', async () => {
      const r = await roomReads(MEMBER, WINDOW);
      assertWaitingClock(r.clock);
      assertEquals(r.order.ok, true);
      assertEquals(r.order.order, null, 'the lazy reveal does not set an order the gate has not judged');
      assertEquals(r.order.revealed, false);
      assertEquals(r.order.waiting_for_members, false, 'four members: not the below-four wait');
      assertEquals(r.orderTable, []);
      assert(Array.isArray(r.names));
    });

    // ---- the room window, gate cleared (what the sweep does at T-1h-30s) ---------------------------------
    await t.step('room open: the member read sets the order (the lazy reveal) and every read still answers', async () => {
      await q(`insert into draft_start_watch (league_id, draft_date, inputs_sig, blocked, gate_cleared_at)
               select id, draft_date, 'x', false, now() from leagues where id = $1`, [WINDOW]);
      const r = await roomReads(MEMBER, WINDOW);
      assertWaitingClock(r.clock);
      assertEquals(r.order.ok, true);
      assertEquals(r.order.state, 'finalized');
      assertEquals(r.order.locked, false, 'set, not locked: the draft has not started');
      const ids = (r.order.order as Row[]).map((o) => o.user_id);
      assertEquals(ids.length, MEMBERS.length, 'one entry per member (a count, never "any row")');
      assertEquals([...ids].sort(), [...MEMBERS].sort(), 'each member exactly once');
      assertEquals((r.order.order as Row[]).map((o) => o.position), [1, 2, 3, 4]);
      assertEquals(r.orderTable.length, 4);
      assertEquals(r.picks, []);
      // A second read is the same answer (the reveal happens exactly once).
      const again = await roomReads(M3, WINDOW);
      assertEquals(again.order.order, r.order.order);
    });

    // ---- a signed-in non-member, and anon -----------------------------------------------------------
    await t.step('a non-member is refused by every read, before and after the order is set', async () => {
      for (const L of [EARLY, WINDOW]) {
        const r = await roomReads(OUTSIDER, L);
        assertEquals(r.clock, [], 'get_draft_clock: no row (leagues RLS)');
        assertEquals(r.order, { ok: false, reason: 'not_a_member' });
        assertEquals(r.picks, []);
        assertEquals(r.names?.code, '42501', 'get_league_display_names raises for a non-member');
        assertEquals(r.queue, []);
        assertEquals(r.orderTable, [], 'league_draft_order RLS: is_member');
      }
    });

    await t.step('anon cannot execute any of the three RPCs; grants are authenticated (+ service_role for the clock)', async () => {
      for (const sql of [`select * from public.get_draft_clock($1)`, `select public.get_draft_order($1)`,
        `select * from public.get_league_display_names($1)`]) {
        const err = await as('anon', () => errorOf(() => q(sql, [WINDOW])));
        assertEquals(err?.code, '42501', `${sql}: ${err?.message}`);
      }
      const acl = await q(`
        select p.proname, (select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end,
                                             ',' order by 1) from aclexplode(p.proacl) a
                            where a.privilege_type = 'EXECUTE') g
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('get_draft_clock', 'get_draft_order', 'get_league_display_names')
         order by 1`);
      const by = Object.fromEntries(acl.map((a: Row) => [a.proname, a.g.split(',').filter((g: string) => g !== 'postgres')]));
      assertEquals(by.get_draft_clock, ['authenticated', 'service_role']);
      assertEquals(by.get_draft_order, ['authenticated']);
      assertEquals(by.get_league_display_names, ['authenticated']);
      for (const [fn, g] of Object.entries(by)) assertFalse((g as string[]).some((x) => x === 'anon' || x === 'PUBLIC'), fn);
    });

    // ---- ruled, pinned so a change is deliberate ------------------------------------------------------
    // A MANUAL-order league has an order from the first read (the commissioner's seed, editable until T-1h), and
    // get_draft_order returns it to EVERY member, not only the commissioner: the 20261013000000 design ("A member
    // reads the order and its state"). Ruled 2026-11-10 (draft room plan, at plan level; Giorgio may veto): the
    // order STAYS visible before T-1h. The reveal and the surprise (decisions 16 and 17, presentation only) apply
    // only to a randomly drawn order; an order the commissioner set by hand is a published setting, not a draw.
    await t.step('manual mode, before T-1h: a member can read the open (seeded) order', async () => {
      const MANUAL = await league(180, 'manual');
      const r = await roomReads(MEMBER, MANUAL);
      assertEquals(r.order.ok, true);
      assertEquals(r.order.state, 'open');
      assertEquals(r.order.mode, 'manual');
      assertEquals((r.order.order as Row[]).length, 4, 'the seed is visible to a member');
      assertEquals(r.order.can_edit_order, false, 'but only the commissioner can edit it');
      assertWaitingClock(r.clock);
    });
  },
});
