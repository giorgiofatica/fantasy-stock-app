/**
 * 20261204000000: the draft_order_notify cron's post guard, draft_room_notices_due(), counts every kind
 * draft-order-notify DELIVERS, and nothing else.
 *
 * The bug it fixes: the guard counted a pending push of plan.ts DELIVERED_KINDS only, while the function
 * selects DELIVERED_KINDS + RENEWAL_KINDS (run.ts). A pending "Run it back" push waited for an unrelated
 * draft-room event to wake the cron. The kind list was hand-copied into SQL, so it drifted.
 *
 * The PARITY is the point of this file, and it is checked by BEHAVIOUR, on the WHOLE migration chain
 * (full_chain.ts), with both TS lists IMPORTED (never restated here):
 *   - for EACH kind in DELIVERED_KINDS + RENEWAL_KINDS: a pending row makes the guard true; a 'sending' row
 *     older than STALE_SENDING_MS makes it true; a fresher 'sending' row and a settled row do not;
 *   - for EACH other kind the live CHECK allows (read from pg_constraint, so a new kind is covered the day it
 *     is added): a pending row does NOT make it true (the function would select nothing: an idle post);
 *   - the guard as the LIVE cron runs it (the `where` sliced from the latest draft_order_notify schedule).
 * So adding a kind to plan.ts without the SQL (or the reverse) fails here.
 *
 * Also: before the migration, a pending renewal row alone left the guard false (the bug, reproduced); the new
 * body differs from 20261111000000's ONLY by the marked lines; ACL, SECURITY and search_path are unchanged
 * (CLAUDE.md "Postgres function grants": verified by proacl, never assumed).
 *
 *   deno test --allow-read --allow-env supabase/tests/renewal_notices_wake_notify_cron.pglite.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.2';
import { applyFrom, asExistingDuration, loadChain, migrationFiles, readMigration } from './full_chain.ts';
import { DELIVERED_KINDS, RENEWAL_KINDS, STALE_SENDING_MS } from '../functions/draft-order-notify/plan.ts';

// deno-lint-ignore no-explicit-any
type Row = any;

const VER = '20261204000000';
const MIG = `${VER}_renewal_notices_wake_notify_cron.sql`;
const PREV = '20261111000000_draft_auto_start.sql';
const HEAD = 'create or replace function public.draft_room_notices_due()';
const COMMISH = 'c0c0c0c0-0000-4000-8000-0000000000c0';
const MEMBER = 'a1a1a1a1-0000-4000-8000-0000000000a1';

/** What draft-order-notify selects (run.ts: `.in('kind', [...DELIVERED_KINDS, ...RENEWAL_KINDS])`). */
const SELECTED: string[] = [...DELIVERED_KINDS, ...RENEWAL_KINDS];

const fnBody = async (file: string) => {
  const s = await readMigration(file);
  const i = s.indexOf(HEAD);
  assert(i >= 0, `${file}: no ${HEAD}`);
  const j = s.indexOf('\n$$;', i);
  assert(j >= 0, `${file}: unterminated body`);
  return s.slice(i, j + 4);
};

/** The post guard of the latest migration that schedules draft_order_notify: `where <expr>;` before the `$$`. */
async function liveGuard(): Promise<{ file: string; guard: string }> {
  let hit: { file: string; guard: string } | null = null;
  for (const f of await migrationFiles()) {
    const s = await readMigration(f);
    const m = /cron\.schedule\(\s*'draft_order_notify'[\s\S]*?\)\s*(where[^;]*);\s*\$\$/i.exec(s);
    if (m) hit = { file: f, guard: m[1] };
  }
  assert(hit, 'no migration schedules draft_order_notify');
  return hit;
}

Deno.test(`${MIG}: the body differs from ${PREV}'s ONLY by the marked lines`, async () => {
  const mine = await fnBody(MIG);
  const added = `                             'draft_postponed', 'draft_time_set',   -- = plan.ts DELIVERED_KINDS
                             'renewal_invite', 'renewal_reply', 'renewal_nudge', 'renewal_removed',
                             'season_set')   -- ${VER}: + plan.ts RENEWAL_KINDS`;
  const original = `                             'draft_postponed', 'draft_time_set')   -- = plan.ts DELIVERED_KINDS`;
  assert(mine.includes(added), 'the marked change is not where it should be');
  assertEquals(mine.split(added).join(original), await fnBody(PREV));
});

Deno.test(`${MIG}: the guard wakes for exactly the kinds draft-order-notify delivers`, {
  sanitizeResources: false,
  sanitizeOps: false,
}, async (t) => {
  const db = new PGlite();
  await loadChain(db, { untilBefore: VER });
  const q = async (s: string, p: unknown[] = []) => (await db.query<Row>(s, p)).rows;
  const due = async () => (await q(`select public.draft_room_notices_due() d`))[0].d as boolean;
  const fnMeta = async () =>
    (await q(`select p.proacl::text acl, p.prosecdef, p.proconfig::text cfg, p.provolatile, pg_get_function_result(p.oid) res,
                     pg_get_function_identity_arguments(p.oid) args
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'draft_room_notices_due'`))[0];

  // A league with no draft time: the room arms (1 and 2) cannot fire, so only the notice arm is under test.
  const [{ id: L }] = await asExistingDuration(db, () => q(
    `insert into leagues (name, commissioner_id, invite_code, num_participants) values ('Gate', $1, $2, 8) returning id`,
    [COMMISH, crypto.randomUUID().slice(0, 8).toUpperCase()],
  ));
  await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner'), ($1, $3, 'member')`,
    [L, COMMISH, MEMBER]);
  const clear = () => q(`delete from league_notifications`);
  /** One notice of `kind`, then forced to the wanted push state (insert triggers may settle some kinds). */
  async function notice(kind: string, status: string, attemptedAgoMs: number | null = null) {
    await clear();
    const [{ id }] = await q(`insert into league_notifications (league_id, user_id, kind) values ($1, $2, $3) returning id`,
      [L, MEMBER, kind]);
    await q(`update league_notifications set push_status = $2,
               push_attempted_at = case when $3::bigint is null then null else now() - make_interval(secs => $3::bigint / 1000.0) end
             where id = $1`, [id, status, attemptedAgoMs]);
    const [r] = await q(`select push_status from league_notifications where id = $1`, [id]);
    assertEquals(r.push_status, status, `${kind}: could not stage push_status ${status}`);
  }

  const before = await fnMeta();

  await t.step('the bug, before the migration: a pending renewal push alone leaves the guard false', async () => {
    await clear();
    assertEquals(await due(), false, 'idle chain');
    for (const k of RENEWAL_KINDS) {
      await notice(k, 'pending');
      assertEquals(await due(), false, `${k}: expected the pre-fix guard to miss it`);
    }
    await notice('draft_room_open', 'pending');
    assertEquals(await due(), true, 'a draft kind did wake it');
  });

  await applyFrom(db, VER);

  await t.step('grants, SECURITY, search_path, signature: unchanged by CREATE OR REPLACE', async () => {
    const after = await fnMeta();
    assertEquals(after, before);
    assertEquals(after.acl, '{postgres=X/postgres,service_role=X/postgres}');
    assertEquals([after.prosecdef, after.cfg, after.provolatile, after.res, after.args],
      [false, '{"search_path=public, pg_temp"}', 's', 'boolean', '']);
  });

  // Every kind the live CHECK allows, so a kind added to the schema is judged here without editing this file.
  const [{ def }] = await q(`select pg_get_constraintdef(oid) def from pg_constraint
                              where conname = 'league_notifications_kind_check'`);
  const allowed = [...String(def).matchAll(/'(\w+)'/g)].map((m) => m[1]);

  await t.step('every delivered kind is a kind the schema allows', () => {
    const missing = SELECTED.filter((k) => !allowed.includes(k));
    assertEquals(missing, [], 'plan.ts lists a kind the CHECK refuses: it can never be pending');
  });

  for (const kind of SELECTED) {
    await t.step(`delivered: ${kind} wakes the guard (pending; stale sending), and only then`, async () => {
      await notice(kind, 'pending');
      assertEquals(await due(), true, `${kind} pending`);
      await notice(kind, 'sending', STALE_SENDING_MS + 60_000);
      assertEquals(await due(), true, `${kind} sending, older than STALE_SENDING_MS: reclaimable`);
      await notice(kind, 'sending', STALE_SENDING_MS - 60_000);
      assertEquals(await due(), false, `${kind} sending, younger than STALE_SENDING_MS: a live run holds it`);
      for (const settled of ['sent', 'no_device', 'skipped', 'failed']) {
        await notice(kind, settled);
        assertEquals(await due(), false, `${kind} ${settled}`);
      }
    });
  }

  const others = allowed.filter((k) => !SELECTED.includes(k));
  await t.step(`not delivered here (${others.join(', ')}): a pending row never wakes the guard`, async () => {
    assert(others.length > 0, 'expected some kinds another path delivers (member_left, seat_taken_over, ...)');
    for (const kind of others) {
      await notice(kind, 'pending');
      assertEquals(await due(), false, `${kind}: draft-order-notify would select nothing (an idle post every minute)`);
      await notice(kind, 'sending', STALE_SENDING_MS + 60_000);
      assertEquals(await due(), false, `${kind}: stale sending`);
    }
  });

  await t.step('the LIVE cron guard (sliced from the latest schedule) posts for a pending renewal push', async () => {
    const { file, guard } = await liveGuard();
    assertEquals(guard.replace(/\s+/g, ' '), 'where public.draft_room_notices_due()', file);
    const posts = async () => (await q(`select 1 as post ${guard}`)).length === 1;
    await clear();
    assertEquals(await posts(), false, 'idle');
    await notice('renewal_invite', 'pending');
    assertEquals(await posts(), true, 'a pending Run it back push');
  });

  await db.close();
});
