/**
 * 20261128000000: below four, "invite" is implicit; four back in = ready; a rejoiner is never named as having left.
 * (Giorgio, 2026-11-10: "A, four are in so it's ready"; docs/PRODUCT_RULES.md, "When managers leave before the
 * draft, below four".)
 *
 * On the WHOLE migration chain (full_chain.ts), driven only through the real RPCs (leave_league,
 * join_league_by_code, confirm_league_roster), so every trigger the live schema has runs too:
 *   - the re-created bodies differ from their sources ONLY by the lines marked "20261128000000";
 *   - both ACLs are byte-identical to the previous migration's (CREATE OR REPLACE keeps them; verified, not assumed);
 *   - criteria 1-5 of the brief, Giorgio's three-throwaway League A sequence, bots, and draft-control's own
 *     computeStartBlockers over the resulting row (no roster_reconfirm_required once four are in);
 *   - the backfill, on rows written by the OLD functions (chain stopped before this file), then re-run (idempotent).
 * _draft_order_sync is wrapped by a spy that records only calls made at trigger depth 0, i.e. the join's own call.
 *
 *   deno test --allow-read --allow-env --allow-sys --allow-run supabase/tests/reconfirm_clears_at_four.pglite.test.ts
 */
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.2';
import { applyFrom, asExistingDuration, loadChain, migrationFiles, readMigration } from './full_chain.ts';
import { computeStartBlockers, toRosterReconfirm } from '../functions/draft-control/rules.ts';

// deno-lint-ignore no-explicit-any
type Row = any;

const MIG = '20261128000000_reconfirm_clears_at_four.sql';
const VER = '20261128000000';

const slice = (s: string, from: string, to: string) => {
  const i = s.indexOf(from);
  assert(i >= 0, `not found: ${from}`);
  const j = s.indexOf(to, i);
  assert(j >= 0, `not found after ${from}: ${to}`);
  return s.slice(i, j + to.length);
};
const fnBody = async (file: string, head: string) => slice(await readMigration(file), head, '\n$$;');
function undo(body: string, pairs: [string, string][]): string {
  for (const [added, original] of pairs) {
    assert(body.includes(added), `expected change not found:\n${added}`);
    body = body.split(added).join(original);
  }
  return body;
}

Deno.test(`${MIG}: re-created bodies differ from their source ONLY by the marked lines`, async () => {
  const LEAVE = 'create or replace function public._leave_league_before_draft(';
  const leaveMine = await fnBody(MIG, LEAVE);
  const LOOP_GUARD = slice(leaveMine, '  -- 20261128000000: a rejoin now takes the leaver OUT', '    into v_recent;\n\n');
  assertFalse(/insert|update|delete/i.test(LOOP_GUARD.replace(/^\s*--.*$/gm, '')), 'the loop guard only reads');
  assertEquals(undo(await fnBody(MIG, LEAVE), [
    [`    -- 20261128000000: below_floor = this leave left fewer than four (MIN_DRAFT_MEMBERS,
    -- draft-control/rules.ts) in the league. OR-ed in, never cleared: "is, or has been".
    insert into public.league_roster_reconfirm as r (league_id, departed, members_before, below_floor)
    values (p_league_id, jsonb_build_array(v_entry), v_before, v_before - 1 < 4)`,
     `    insert into public.league_roster_reconfirm as r (league_id, departed, members_before)
    values (p_league_id, jsonb_build_array(v_entry), v_before)`],
    ['          below_floor = r.below_floor or (v_before - 1 < 4),   -- 20261128000000: monotonic, a repeat leave too\n', ''],
    ['\n  v_recent        boolean := false;   -- 20261128000000: this leaver was announced to this commissioner within the hour', ''],
    [LOOP_GUARD, ''],
    [`  if not v_repeat and not v_recent then   -- 20261128000000: was \`if not v_repeat\`
    insert into public.league_notifications (league_id, user_id, kind, subject_user_id)   -- 20261128000000: + subject_user_id
    values (p_league_id, v_notify, 'member_left', p_user_id)`, `  if not v_repeat then
    insert into public.league_notifications (league_id, user_id, kind)
    values (p_league_id, v_notify, 'member_left')`],
  ]), await fnBody('20261125000004_leave_before_draft_shared.sql', LEAVE));

  const JOIN = 'create or replace function join_league_by_code(';
  const mine = await fnBody(MIG, JOIN);
  const rejoin = slice(mine, '  -- 20261128000000: a rejoiner is never named', '  end if;\n\n');
  assertEquals(undo(mine, [
    ['\n  v_cleared     boolean := false;   -- 20261128000000: either deletion below removed the reconfirm', ''],
    [rejoin, ''],
    [`     -- 20261128000000: below four the invite is implicit, and four in is ready
     -- (v_count was read before this member's insert, so v_count + 1 is the count
     -- now, bots included, as draft-control counts it). At four or more, only an
     -- explicit 'invite' is answered by a join; a 'pending' one never is.
     and ((r.below_floor and v_count + 1 >= 4)
          or (not r.below_floor and r.choice = 'invite'))`, `     and r.choice = 'invite'`],
    [`  v_cleared := v_cleared or found;   -- 20261128000000
  if v_cleared then   -- 20261128000000: was \`if found\``, '  if found then'],
  ]), await fnBody('20261125000008_takeover_codes_not_join_codes.sql', JOIN));
  // The rejoin block is all-new; nothing in it may reach outside league_roster_reconfirm.
  assertFalse(/league_members|leagues\b/.test(rejoin.replace(/^\s*--.*$/gm, '')), 'the rejoin block touches only the reconfirm');
});

Deno.test(`${MIG}: each re-created function supersedes exactly its latest source`, async () => {
  const files = await migrationFiles();
  const definers = async (re: RegExp) => {
    const out: string[] = [];
    for (const f of files) if (re.test(await readMigration(f))) out.push(f);
    return out.slice(-2);
  };
  assertEquals(await definers(/create or replace function public\._leave_league_before_draft\(/),
    ['20261125000004_leave_before_draft_shared.sql', MIG]);
  assertEquals(await definers(/create or replace function (public\.)?join_league_by_code\(/),
    ['20261125000008_takeover_codes_not_join_codes.sql', MIG]);
});

const C = 'c0c0c0c0-0000-4000-8000-0000000000c0';   // commissioner
const T1 = 'a1a1a1a1-0000-4000-8000-0000000000a1';
const T2 = 'a2a2a2a2-0000-4000-8000-0000000000a2';
const T3 = 'a3a3a3a3-0000-4000-8000-0000000000a3';
const U = (n: number) => `e${String(n).padStart(7, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NAMES: [string, string][] = [[C, 'comm_c'], [T1, 'throw_t1'], [T2, 'throw_t2'], [T3, 'throw_t3'],
  ...Array.from({ length: 20 }, (_, i) => [U(i + 1), `user_${i + 1}`] as [string, string])];

// deno-lint-ignore no-explicit-any
async function harness(db: PGlite) {
  const q = async (s: string, p: unknown[] = []) => (await db.query<Row>(s, p)).rows;
  const one = async (s: string, p: unknown[] = []) => (await q(s, p))[0];
  const svc = async <T>(fn: () => Promise<T>): Promise<T> => {
    await db.exec(`set role service_role`);
    try { return await fn(); } finally { await db.exec('reset role').catch(() => {}); }
  };
  const rpc = async (fn: string, args: unknown[]) =>
    (await one(`select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) r`, args)).r;
  const svcRpc = (fn: string, args: unknown[]) => svc(() => rpc(fn, args));
  for (const [id, name] of NAMES) {
    await q(`insert into auth.users (id, raw_user_meta_data) values ($1, $2) on conflict do nothing`, [id, { username: name }]);
  }
  let n = 0;
  /** A pre-draft league: commissioner C plus `others`, all through plain inserts (the creation path). */
  const league = async (size: number, p: number | null, others: string[], type = 'matchup') => {
    n += 1;
    const id = `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const code = `CODE${String(n).padStart(4, '0')}`;
    // A Duration league here is one that predates 20261203000000 (new ones are refused).
    const insert = () => q(`insert into leagues (id, name, commissioner_id, invite_code, num_participants, league_type, num_weeks, playoff_teams)
             values ($1, $2, $3, $4, $5, $6, 4, $7)`, [id, `League ${n}`, C, code, size, type, p]);
    await (type === 'duration' ? asExistingDuration(db, insert) : insert());
    // Founders joined an hour ago, so no leave's left_at can tie their joined_at (PGlite's clock is coarse).
    await q(`insert into league_members (league_id, user_id, role, joined_at) values ($1, $2, 'commissioner', now() - interval '1 hour')`, [id, C]);
    for (const u of others) {
      await q(`insert into league_members (league_id, user_id, role, joined_at) values ($1, $2, 'member', now() - interval '1 hour')`, [id, u]);
    }
    return { id, code };
  };
  const leave = async (L: { id: string }, u: string) => {
    const r = await svcRpc('leave_league', [L.id, u, null]);
    assertEquals(r.status, 'left', `leave ${u}: ${JSON.stringify(r)}`);
    return r;
  };
  const join = async (L: { code: string }, u: string) => {
    await new Promise((res) => setTimeout(res, 3));   // a join never shares a clock tick with the leave before it
    const r = await svcRpc('join_league_by_code', [L.code, u]);
    assertEquals(r.ok, true, `join ${u}: ${JSON.stringify(r)}`);
    return r;
  };
  const row = async (L: { id: string }) => await one(`select * from league_roster_reconfirm where league_id = $1`, [L.id]);
  const departedIds = async (L: { id: string }) => ((await row(L))?.departed ?? []).map((e: Row) => e.user_id);
  const members = async (L: { id: string }) =>
    Number((await one(`select count(*) n from league_members where league_id = $1`, [L.id])).n);
  return { q, one, svcRpc, league, leave, join, row, departedIds, members };
}

Deno.test({
  name: `${MIG}: the rules, on the full chain`,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const db = new PGlite();
    await loadChain(db, { untilBefore: VER });
    const acl = async () => (await db.query<Row>(
      `select p.proname, p.proacl::text acl, p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname in ('join_league_by_code', '_leave_league_before_draft') order by 1`)).rows;
    const aclBefore = await acl();
    const applied = await applyFrom(db, VER);
    assertEquals(applied[0], MIG);
    const h = await harness(db);
    const { q, one, league, leave, join, row, departedIds, members, svcRpc } = h;

    // The spy: the join's OWN _draft_order_sync call is the only one at trigger depth 0 in a join statement.
    await db.exec(`
      create table sync_spy (league_id uuid, depth int);
      alter function public._draft_order_sync(uuid, boolean) rename to _draft_order_sync_real;
      create function public._draft_order_sync(p_league_id uuid, p_lock boolean) returns void
        language plpgsql security definer set search_path = public, pg_temp as $f$
      begin
        insert into sync_spy values (p_league_id, pg_trigger_depth());
        perform public._draft_order_sync_real(p_league_id, p_lock);
      end $f$;`);
    const synced = async (L: { id: string }) =>
      Number((await one(`select count(*) n from sync_spy where league_id = $1 and depth = 0`, [L.id])).n);
    const blockers = async (L: { id: string }) => {
      const l = await one(`select * from leagues where id = $1`, [L.id]);
      const r = await row(L);
      return computeStartBlockers({
        commissionerId: l.commissioner_id, draftStatus: l.draft_status, stakeMode: 'equal',
        memberCount: await members(L), numParticipants: l.num_participants, draftDate: '2026-01-01T00:00:00Z',
        leagueType: l.league_type, playoffTeams: l.playoff_teams,
        rosterReconfirm: toRosterReconfirm(r ? { departed: r.departed, members_before: r.members_before, choice: r.choice } : null),
      }, new Date('2026-06-01T00:00:00Z')).map((b) => b.code);
    };

    await t.step('ACLs are byte-identical to the previous migration (CREATE OR REPLACE keeps them; re-asserted)', async () => {
      assertEquals(await acl(), aclBefore);
      const a = Object.fromEntries((await acl()).map((r: Row) => [r.proname, r.acl]));
      assertEquals(a.join_league_by_code, '{postgres=X/postgres,service_role=X/postgres}');
      assertEquals(a._leave_league_before_draft, '{postgres=X/postgres}');
    });

    await t.step("Giorgio's League A: size 4, P 3, 4 in; T1 and T2 leave (2 of 4); both rejoin -> no row, order synced", async () => {
      const L = await league(4, 3, [T1, T2, T3]);
      await leave(L, T1);
      assertEquals([(await row(L)).choice, (await row(L)).below_floor], ['pending', true], '4 -> 3 is below the floor');
      await leave(L, T2);
      assertEquals(await departedIds(L), [T1, T2]);
      assertEquals(await members(L), 2);
      assert((await blockers(L)).includes('roster_reconfirm_required'));

      await join(L, T1);
      assertEquals(await departedIds(L), [T2], 'T1 is back, so T1 is not listed as having left');
      assertEquals(await synced(L), 0, 'the row stands at 3: no clear, no sync');
      await join(L, T2);
      assertEquals(await row(L), undefined, 'four are in: no reconfirm row');
      assertEquals(await synced(L), 1, "the join's own _draft_order_sync ran once");
      const b = await blockers(L);
      assertFalse(b.includes('roster_reconfirm_required'), `no reconfirm blocker: ${b}`);
      assertFalse(b.includes('not_enough_members'));
      assertFalse(b.includes('playoff_teams_exceeds_members'));
    });

    await t.step('League A variant: T1 rejoins, a NEW human is the fourth -> cleared by rule 2 (T2 still gone)', async () => {
      const L = await league(4, 3, [T1, T2, T3]);
      await leave(L, T1); await leave(L, T2);
      await join(L, T1);
      await join(L, U(1));
      assertEquals(await row(L), undefined);
      assertEquals(await synced(L), 1);
      assertEquals(await blockers(L), []);
    });

    await t.step('criterion 1 at four or more: a rejoiner leaves departed; the last one out deletes the row', async () => {
      const L = await league(8, 4, [T1, T2, T3, U(2), U(3)]);   // 6 in
      await leave(L, T1);                                        // 6 -> 5: pending, never below
      assertEquals([(await row(L)).choice, (await row(L)).below_floor], ['pending', false]);
      await join(L, T1);
      assertEquals(await row(L), undefined, 'the only leaver came back: nothing is owed');
      assertEquals(await synced(L), 1);

      await leave(L, T1); await leave(L, T2); await leave(L, T3);   // 6 -> 3: below
      await svcRpc('confirm_league_roster', [L.id, C, 'invite', null]);
      assertEquals((await row(L)).choice, 'invite');
      await join(L, T2);                                             // 4 in, but... the clear needs P <= 4: yes, P 4
      assertEquals(await row(L), undefined, 'rule 2 (four in, P 4) clears it as well');
    });

    await t.step('criterion 1, entry order kept: removing the middle leaver keeps the others in order', async () => {
      const L = await league(10, 4, [T1, T2, T3, U(4), U(5), U(6), U(7)]);   // 8 in
      await leave(L, T1); await leave(L, T2); await leave(L, T3);           // 8 -> 5
      await join(L, T2);
      assertEquals(await departedIds(L), [T1, T3]);
      const r = await row(L);
      assertEquals([r.choice, r.members_before, r.below_floor], ['pending', 8, false], 'only the list changed');
      assertEquals(await synced(L), 0);
    });

    await t.step('criterion 3: six to five stays pending, and a NEW human join does not answer it', async () => {
      const L = await league(8, 4, [T1, T2, T3, U(8), U(9)]);   // 6 in
      await leave(L, T1);
      await join(L, U(10));
      const r = await row(L);
      assertEquals([r.choice, r.below_floor], ['pending', false], 'still asks Move forward / Invite');
      assertEquals(await departedIds(L), [T1]);
      assertEquals(await synced(L), 0);
      assert((await blockers(L)).includes('roster_reconfirm_required'));
      // ...and the explicit invite path at >= 4 is unchanged: the next human join answers it.
      await svcRpc('confirm_league_roster', [L.id, C, 'invite', null]);
      await join(L, U(11));
      assertEquals(await row(L), undefined);
      assertEquals(await synced(L), 1);
    });

    await t.step('criterion 4: 6 -> 5 (pending, unanswered) -> 3 -> back to 4 clears by rule 2', async () => {
      const L = await league(6, 4, [T1, T2, T3, U(12), U(13)]);   // 6 in
      await leave(L, T1);
      assertEquals((await row(L)).below_floor, false);
      await leave(L, T2); await leave(L, T3);                     // 4 -> 3
      assertEquals([(await row(L)).choice, (await row(L)).below_floor], ['pending', true]);
      await join(L, U(14));
      assertEquals(await row(L), undefined);
      assertEquals(await synced(L), 1);
    });

    await t.step('"has been" below four: 4 -> 3, refilled past four while P > members, a 5 -> 4 leave between, then P <= members', async () => {
      const L = await league(8, 6, [T1, T2, T3]);   // 4 in, P 6
      await leave(L, T1);                           // 3: below
      await join(L, U(15)); await join(L, U(16));   // 5 (P 6 > 5: stays)
      assertEquals((await row(L)).below_floor, true);
      await leave(L, U(16));                        // 5 -> 4: a NEW departure resets the choice, not the fact
      assertEquals([(await row(L)).choice, (await row(L)).below_floor], ['pending', true]);
      await join(L, U(17));                         // 5
      assert(await row(L), 'P 6 > 5 still holds it');
      assertEquals(await synced(L), 0);
      await join(L, U(18));                         // 6: P 6 <= 6
      assertEquals(await row(L), undefined, 'cleared with no tap, though the count was never below four AT a join');
      assertEquals(await synced(L), 1);
    });

    await t.step('criterion 5: P > members at four stays its own blocker; Move forward with the stepper settles it', async () => {
      const L = await league(6, 6, [T1, T2, T3]);   // 4 in, P 6
      await leave(L, T1);
      await join(L, U(19));                         // 4, P 6 > 4
      assert(await row(L), 'the row stays');
      const r = await svcRpc('confirm_league_roster', [L.id, C, 'move_forward', 4]);
      assertEquals([r.status, r.playoff_teams], ['confirmed', 4]);
      assertEquals(await row(L), undefined);
    });

    await t.step('a bot join never clears, and never edits departed; a human then does', async () => {
      const L = await league(6, 3, [T1, T2, T3]);
      await leave(L, T1);                           // 3: below
      await join(L, 'bot-9');                       // 4 by a bot
      assertEquals(await departedIds(L), [T1]);
      assertEquals(await synced(L), 0, 'no clear, no sync');
      assert((await blockers(L)).includes('roster_reconfirm_required'));
      await join(L, U(20));                         // a human: 5, P 3
      assertEquals(await row(L), undefined);
      assertEquals(await synced(L), 1);
    });

    await t.step('an explicit invite on a below-four row follows "four in", not "one join"', async () => {
      const L = await league(4, 2, [T1, T2, T3]);
      await leave(L, T1); await leave(L, T2);       // 2: below
      await svcRpc('confirm_league_roster', [L.id, C, 'invite', null]);   // an old client still has the button
      await join(L, U(1));                          // 3, P 2 <= 3: today's explicit rule alone would clear here
      assert(await row(L), 'still below four: the reconfirm (and its "who left" line) stands');
      assertEquals(await departedIds(L), [T1, T2]);
      await join(L, U(2));                          // 4
      assertEquals(await row(L), undefined);
    });

    await t.step('loop guard: leave -> rejoin -> leave pushes ONCE an hour per leaver; the departure is still recorded', async () => {
      const L = await league(8, 4, [T1, T2, T3, U(3), U(4)]);
      const notices = async () => (await q(`select user_id, subject_user_id from league_notifications
                                             where league_id = $1 and kind = 'member_left' order by created_at`, [L.id]));
      const r1 = await leave(L, T1);
      assert(r1.notice_id, 'the first leave announces');
      await join(L, T1);
      assertEquals(await row(L), undefined, 'the rejoin closed it (rule 1)');
      for (let i = 0; i < 3; i++) {
        const r = await leave(L, T1);
        assertEquals(r.notice_id, null, `cycle ${i}: no second push within the hour`);
        assertEquals(await departedIds(L), [T1], 'the departure is still recorded');
        if (i < 2) await join(L, T1);
      }
      assertEquals(await notices(), [{ user_id: C, subject_user_id: T1 }], 'one notice, about T1, to the commissioner');
      // A different leaver in the same hour is announced: the guard is per leaver.
      assert((await leave(L, T2)).notice_id);
      // An hour later the same leaver is announced again.
      await join(L, T1);
      await q(`update league_notifications set created_at = created_at - interval '61 minutes' where league_id = $1 and subject_user_id = $2`, [L.id, T1]);
      assert((await leave(L, T1)).notice_id, 'past the hour: announced again');
      assertEquals((await notices()).length, 3);
    });

    await t.step('non-matchup leagues: P does not apply; four in clears', async () => {
      const L = await league(4, null, [T1, T2, T3], 'duration');
      await leave(L, T1);
      await join(L, U(5));
      assertEquals(await row(L), undefined);
    });

    // Touch q so the linter keeps the helper (used above via h).
    void q;
  },
});

Deno.test({
  name: `${MIG}: the backfill, on rows written by the OLD functions`,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const db = new PGlite();
    await loadChain(db, { untilBefore: VER });
    const { q, league, leave, join, row, departedIds } = await harness(db);

    // a. League A as it sits in prod: 2 of 4, pending.
    const A = await league(4, 3, [T1, T2, T3]);
    await leave(A, T1); await leave(A, T2);
    // b. A rejoiner already back (the old join never touched a pending row): departed names a member.
    const B = await league(8, 4, [T1, T2, T3, U(1), U(2)]);
    await leave(B, T1); await join(B, T1);
    assertEquals(await departedIds(B), [T1], 'fixture: the old code lists a rejoiner as having left');
    // c. Two leavers, one back.
    const Cc = await league(8, 4, [T1, T2, T3, U(3), U(4), U(5), U(6)]);
    await leave(Cc, T1); await leave(Cc, T2); await join(Cc, T1);
    // d. Has been below, now full at four through a NEW human: should already be ready.
    const D = await league(4, 3, [T1, T2, T3]);
    await leave(D, T1); await join(D, U(7));
    assertEquals((await row(D)).choice, 'pending', 'fixture: the old join left it pending');
    // e. Has been below, now at four through a bot only: never cleared by a bot.
    const E = await league(6, 3, [T1, T2, T3]);
    await leave(E, T1);
    await new Promise((res) => setTimeout(res, 3));   // the bot's joined_at must not tie T1's left_at
    await q(`insert into league_members (league_id, user_id, role) values ($1, 'bot-1', 'member')`, [E.id]);
    // h. Below four, a HUMAN joined at 3, then a BOT made four: the join never cleared it live, nor does the backfill.
    const H = await league(6, 3, [T1, T2, T3]);
    await leave(H, T1); await leave(H, T2);           // 2
    await join(H, U(12));                             // 3, human
    await new Promise((res) => setTimeout(res, 3));
    await q(`insert into league_members (league_id, user_id, role) values ($1, 'bot-2', 'member')`, [H.id]);   // 4, bot
    // i. A left_at that does not parse (never written by the functions): skipped, never aborts the push.
    const I = await league(8, 4, [T1, T2, T3, U(13)]);   // 5 in
    await q(`insert into league_roster_reconfirm (league_id, departed, members_before)
             values ($1, $2::jsonb, 6)`, [I.id, JSON.stringify([{ user_id: U(14), name: 'x', left_at: '2026-13-45T99:00:00Z' }])]);
    // f. 6 -> 5, never below: stays pending, not below.
    const F = await league(8, 4, [T1, T2, T3, U(8), U(9)]);
    await leave(F, T1);
    // g. History only: 4 -> 3, then refilled to 5 while P 6 > 5. Below four now? No. Was it? Yes (the replay).
    const G = await league(8, 6, [T1, T2, T3]);
    await leave(G, T1); await join(G, U(10)); await join(G, U(11));

    await t.step('apply the migration', async () => {
      assertEquals((await applyFrom(db, VER))[0], MIG);
    });

    const state = async () => (await q(`select league_id, departed, members_before, choice, below_floor from league_roster_reconfirm order by league_id`));

    await t.step('League A stays owed, now marked below four (the next human to make four clears it)', async () => {
      const r = await row(A);
      assertEquals([r.choice, r.below_floor], ['pending', true]);
      assertEquals(await departedIds(A), [T1, T2]);
    });
    await t.step('a rejoiner already back is no longer listed; a row with no one left is deleted', async () => {
      assertEquals(await row(B), undefined);
      assertEquals(await departedIds(Cc), [T2]);
      assertEquals((await row(Cc)).below_floor, false, '8 -> 6, never below');
    });
    await t.step('already four with a human join since the leave: cleared; four by a bot alone: kept', async () => {
      assertEquals(await row(D), undefined);
      const e = await row(E);
      assertEquals([e.below_floor, e.choice], [true, 'pending']);
    });
    await t.step('a human join at three then a bot to four: kept, as the live join would', async () => {
      const r = await row(H);
      assertEquals([r.below_floor, r.choice], [true, 'pending']);
      assertEquals(await departedIds(H), [T1, T2]);
    });
    await t.step('an unparseable left_at is skipped: no abort, the row judged on what it has', async () => {
      const r = await row(I);
      assertEquals([r.below_floor, r.choice], [false, 'pending'], '5 in now, no usable history');
    });
    await t.step('never below four: untouched', async () => {
      const f = await row(F);
      assertEquals([f.below_floor, f.choice], [false, 'pending']);
    });
    await t.step('below four in the past, not now: the replay marks it (P 6 > 5 keeps the row)', async () => {
      assertEquals((await row(G)).below_floor, true);
    });
    await t.step('the new rules then apply to backfilled rows: League A refilled by T1 and T2 clears', async () => {
      await join(A, T1); await join(A, T2);
      assertEquals(await row(A), undefined);
    });
    await t.step('idempotent: re-running the whole file changes nothing', async () => {
      const before = await state();
      await db.exec(await readMigration(MIG));
      assertEquals(await state(), before);
    });
  },
});
