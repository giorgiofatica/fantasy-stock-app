/**
 * 20261127000000: a deleted manager's seat reads "Open team" (was "Former manager").
 *
 * The label is a SQL constant (deleted_manager_label()), but the old wording was also STORED, twice, as name
 * snapshots (scrub_deleted_manager and _leave_league_before_draft wrote it): league_roster_reconfirm.departed[].name
 * and league_notifications.detail subject_name / commissioner_name. This proves, on the real chain up to the
 * migration and then the migration itself:
 *   - the function now returns 'Open team', still contains a space (no username can equal it), and keeps its ACL
 *     byte for byte: authenticated + service_role may execute, anon and PUBLIC may not (CLAUDE.md "Postgres function
 *     grants": CREATE OR REPLACE does not reset privileges; we verify with proacl, never assume);
 *   - the backfill turns every stored 'Former manager' into 'Open team', keeps order, touches nothing else
 *     (a real username, other detail keys, an empty detail), and is idempotent (a second run changes nothing).
 *
 *   deno test --allow-read --allow-env --allow-sys --allow-run supabase/tests/deleted_seat_label_open_team.pglite.test.ts
 */
import { assert, assertEquals, assertFalse, assertMatch } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.2';
import { applyFrom, loadChain, readMigration } from './full_chain.ts';

// deno-lint-ignore no-explicit-any
type Row = any;

const MIG = '20261127000000_deleted_seat_label_open_team.sql';
const OLD = 'Former manager';
const NEW = 'Open team';
const A = 'a1a1a1a1-0000-4000-8000-0000000000a1';
const B = 'b2b2b2b2-0000-4000-8000-0000000000b2';
const L1 = '10000000-0000-4000-8000-000000000001';
const L2 = '10000000-0000-4000-8000-000000000002';
const L3 = '10000000-0000-4000-8000-000000000003';

const aclOf = async (db: PGlite) =>
  (await db.query<Row>(
    `select (select string_agg(x.g || ':' || a.privilege_type, ',' order by x.g, a.privilege_type)
               from aclexplode(p.proacl) a,
                    lateral (select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as g) x) as acl,
            p.prosecdef, p.proconfig, p.provolatile
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'deleted_manager_label'`)).rows[0];

Deno.test({
  name: `${MIG}: the label, its ACL, and the stored-copy backfill`,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const db = new PGlite();
    await loadChain(db, { untilBefore: '20261127000000' });
    const one = async (s: string, p: unknown[] = []) => (await db.query<Row>(s, p)).rows[0];

    // ---- BEFORE: the applied state, with stored copies of the old wording ----------------------
    assertEquals((await one(`select public.deleted_manager_label() r`)).r, OLD, 'the applied label is the old wording');
    const aclBefore = await aclOf(db);
    assertMatch(aclBefore.acl, /authenticated:EXECUTE/);
    assertMatch(aclBefore.acl, /service_role:EXECUTE/);
    assertFalse(/anon|PUBLIC/.test(aclBefore.acl), `anon/PUBLIC must not execute (before): ${aclBefore.acl}`);

    for (const [l, code] of [[L1, 'C1'], [L2, 'C2'], [L3, 'C3']] as const) {
      await db.query(`insert into leagues (id, name, commissioner_id, invite_code, num_participants, league_type)
                      values ($1, $2, $3, $4, 4, 'duration')`, [l, `League ${code}`, B, code + 'AAAA']);
    }
    // Reconfirm: three entries in a fixed order: a stored old label, a real username, another old label.
    await db.query(`insert into league_roster_reconfirm (league_id, departed, members_before) values ($1, $2::jsonb, 4)`, [L1, JSON.stringify([
      { user_id: A, name: OLD, left_at: '2026-11-01T00:00:00Z' },
      { user_id: B, name: 'bob_b', left_at: '2026-11-02T00:00:00Z' },
      { user_id: '3c3c3c3c-0000-4000-8000-0000000000c3', name: OLD, left_at: '2026-11-03T00:00:00Z' },
    ])]);
    await db.query(`insert into league_roster_reconfirm (league_id, departed, members_before) values ($1, $2::jsonb, 4)`, [L2, JSON.stringify([
      { user_id: B, name: 'bob_b', left_at: '2026-11-02T00:00:00Z' },
    ])]);
    // Notifications: a renewal invite ABOUT a deleted manager (commissioner_name stored), one with a real name,
    // one whose detail is empty (the column is NOT NULL). (Different recipients: renewal_invite is unique per league + recipient.)
    const n = (league: string, user: string, subject: string | null, detail: unknown) =>
      db.query(`insert into league_notifications (league_id, user_id, kind, subject_user_id, detail)
                values ($1, $2, 'renewal_invite', $3, $4::jsonb)`, [league, user, subject, JSON.stringify(detail)]);
    await n(L1, 'r1', A, { commissioner_name: OLD, league_name: 'Alpha', season_number: 2 });
    await n(L2, 'r2', B, { commissioner_name: 'bob_b', league_name: 'Beta', season_number: 2 });
    await n(L3, 'r3', null, {});
    // scrub step 4 also stores subject_name (alone, and next to commissioner_name): both keys are backfilled.
    await n(L1, 'r4', A, { subject_name: OLD, league_name: 'Gamma', season_number: 3 });
    await n(L2, 'r5', A, { subject_name: OLD, commissioner_name: OLD, league_name: 'Delta' });
    await n(L3, 'r6', B, { subject_name: 'bob_b', commissioner_name: 'bob_b', league_name: 'Eps' });
    const stored = async () => ({
      rc: (await db.query<Row>(`select league_id, departed from league_roster_reconfirm order by league_id`)).rows,
      nt: Object.fromEntries((await db.query<Row>(`select user_id, detail from league_notifications order by user_id`)).rows
        .map((r: Row) => [r.user_id, r.detail])),
    });
    const before = await stored();
    assert(JSON.stringify(before).includes(OLD), 'fixture: the old wording is stored');

    await t.step('apply the migration', async () => {
      const applied = await applyFrom(db, '20261127000000');
      assertEquals(applied[0], MIG);
    });

    await t.step('the label is "Open team", and still can never be a username', async () => {
      assertEquals((await one(`select public.deleted_manager_label() r`)).r, NEW);
      assertFalse(/^[A-Za-z0-9_]{3,20}$/.test(NEW), 'user_profiles_username_format must reject the label');
      assert(NEW.includes(' '));
      assertEquals((await one(`select public.deleted_manager_label() ~ '^[A-Za-z0-9_]{3,20}$' as m`)).m, false);
    });

    await t.step('the ACL is unchanged (no anon, no PUBLIC; same attributes)', async () => {
      const after = await aclOf(db);
      assertEquals(after, aclBefore, 'proacl, security mode, search_path and volatility are identical');
    });

    await t.step('the backfill rewrote every stored copy and nothing else', async () => {
      const after = await stored();
      assertEquals(after.rc[0].departed.map((e: Row) => [e.user_id, e.name]), [
        [A, NEW], [B, 'bob_b'], ['3c3c3c3c-0000-4000-8000-0000000000c3', NEW]], 'order kept, only the label entries changed');
      assertEquals(after.rc[0].departed[0].left_at, '2026-11-01T00:00:00Z', 'other keys are kept');
      assertEquals(after.rc[1].departed, before.rc[1].departed, 'a reconfirm with no label is byte-identical');
      assertEquals(after.nt.r1, { commissioner_name: NEW, league_name: 'Alpha', season_number: 2 });
      assertEquals(after.nt.r2, before.nt.r2, 'a real name is untouched');
      assertEquals(after.nt.r3, before.nt.r3, 'an empty detail stays empty');
      assertEquals(after.nt.r4, { subject_name: NEW, league_name: 'Gamma', season_number: 3 }, 'subject_name alone, other keys kept');
      assertEquals(after.nt.r5, { subject_name: NEW, commissioner_name: NEW, league_name: 'Delta' }, 'both keys in one row');
      assertEquals(after.nt.r6, before.nt.r6, 'a real subject_name and commissioner_name are untouched');
      assertFalse(JSON.stringify(after).includes(OLD), 'no stored copy of the old wording remains');
    });

    await t.step('re-running the migration changes nothing (idempotent)', async () => {
      const first = JSON.stringify(await stored());
      await db.exec(await readMigration(MIG));
      assertEquals(JSON.stringify(await stored()), first);
      assertEquals((await one(`select public.deleted_manager_label() r`)).r, NEW);
    });

    await db.close();
  },
});

Deno.test('20261127000000: the new file hardcodes each wording exactly once, in code', async () => {
  const code = (await readMigration(MIG)).split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  assertEquals((code.match(/'Open team'/g) ?? []).length, 1, 'the new label lives in exactly one place');
  assertEquals((code.match(/'Former manager'/g) ?? []).length, 1, 'the old wording is named once, for the backfill');
});
