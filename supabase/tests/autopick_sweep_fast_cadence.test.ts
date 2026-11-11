/**
 * 20261201000000: draft_autopick_sweep every 2 s ("The auto-pick is instant",
 * Giorgio 2026-11-10). Two halves:
 *   1. TEXT: the file is the LATEST schedule of the job, and its command is
 *      20261111000002's VERBATIM except the cadence and one added NOT EXISTS (the
 *      outage throttle). Nothing else may drift: URL, vault key, timeout, guards.
 *   2. PGLITE: the post guard, sliced from the file (not a copy), executed on real
 *      Postgres against stubbed lists and replicas of draft_stalls and
 *      draft_turn_outages. A recent outage holds the post to the old 10 s pace;
 *      a healthy overdue turn always posts.
 * NOT hermetic (fetches npm:@electric-sql/pglite on first run). Run:
 *   deno test --allow-read --allow-env supabase/tests/autopick_sweep_fast_cadence.test.ts
 */
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.2';

const MIGRATIONS = new URL('../migrations/', import.meta.url);
const MINE = '20261201000000_autopick_sweep_fast_cadence.sql';
const PREV = '20261111000002_draft_autopick_sweep_auto_start.sql';

const sqlOf = (src: string) => src.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
const read = async (f: string) => sqlOf(await Deno.readTextFile(new URL(f, MIGRATIONS)));
/** The cron.schedule call (from `select cron.schedule(` to its closing `);`). */
const scheduleCall = (sql: string) => sql.slice(sql.indexOf('select cron.schedule('), sql.lastIndexOf('$$') + 2);

const OUTAGE_BLOCK = /\n\s*and not exists \(\s*select 1\s+from public\.draft_turn_outages t\s+where t\.league_id = o\.league_id\s+and t\.pick_number = o\.pick_number\s+and t\.last_seen_at > now\(\) - interval '10 seconds'\s*\)/;

Deno.test('it is the LATEST migration that schedules draft_autopick_sweep', async () => {
  const hits: string[] = [];
  for await (const e of Deno.readDir(MIGRATIONS)) {
    if (e.isFile && e.name.endsWith('.sql') && /cron\.schedule\(\s*'draft_autopick_sweep'/.test(sqlOf(await Deno.readTextFile(new URL(e.name, MIGRATIONS))))) hits.push(e.name);
  }
  hits.sort();
  assertEquals(hits[hits.length - 1], MINE);
  assert(hits.includes(PREV) && MINE > PREV);
});

Deno.test('the command is 20261111000002\'s verbatim except the cadence and the outage NOT EXISTS', async () => {
  const mine = scheduleCall(await read(MINE));
  const prev = scheduleCall(await read(PREV));
  assert(/cron\.schedule\(\s*'draft_autopick_sweep'\s*,\s*'2 seconds'/.test(mine), 'cadence must be 2 seconds');
  assert(OUTAGE_BLOCK.test(mine), 'the outage throttle is missing or changed');
  const normalised = mine.replace("'2 seconds'", "'10 seconds'").replace(OUTAGE_BLOCK, '');
  assertEquals(normalised.replace(/[ \t]+$/gm, ''), prev.replace(/[ \t]+$/gm, ''));
});

Deno.test('the job contract: vault key, 180000 ms, no key literal, touches only this job', async () => {
  const sql = await read(MINE);
  assert(sql.includes("vault.decrypted_secrets where name = 'cron_apikey'"));
  assert(/timeout_milliseconds\s*:=\s*180000\b/.test(sql));
  assertFalse(/eyJ[A-Za-z0-9_-]{20,}|sb_secret_|sb_publishable_/.test(sql));
  const jobs = [...sql.matchAll(/cron\.(?:un)?schedule\(\s*'([^']+)'/g)].map((m) => m[1]);
  assertEquals([...new Set(jobs)], ['draft_autopick_sweep']);
  // The CLI splitter reads a bare `atomic` as BEGIN ATOMIC (CLAUDE.md).
  assertFalse(/\batomic\b/i.test(sql));
});

const L1 = '00000000-0000-4000-8000-0000000000a1';
const L2 = '00000000-0000-4000-8000-0000000000a2';

Deno.test({
  name: 'the 2 s guard, executed: a healthy overdue turn posts; a recent outage waits 10 s; auto-start work posts',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const src = await Deno.readTextFile(new URL(MINE, MIGRATIONS));
    const command = src.slice(src.indexOf('$$') + 2, src.lastIndexOf('$$'));
    const m = command.match(/\)\s*\n(\s*where [\s\S]*?);\s*$/);
    if (!m) throw new Error('could not slice the post guard');
    const guard = `select 1 as post ${m[1]}`;

    const db = new PGlite();
    await db.exec(`
      create table fake_overdue (league_id uuid, pick_number int, deadline_at timestamptz);
      create function public.overdue_draft_turns() returns table (league_id uuid, pick_number int, deadline_at timestamptz)
        language sql stable as $$ select league_id, pick_number, deadline_at from fake_overdue $$;
      create table fake_work (due boolean);
      insert into fake_work values (false);
      create function public.draft_auto_start_work_due() returns boolean language sql stable as $$ select due from fake_work $$;
      create table public.draft_stalls (
        league_id uuid not null, pick_number int not null, picker_id text not null, reason text not null,
        attempts int not null default 0, first_seen_at timestamptz not null default now(),
        last_seen_at timestamptz not null default now(), primary key (league_id, pick_number));
    `);
    // The REAL draft_turn_outages DDL (20261101000003), not a replica.
    const outagesDdl = await Deno.readTextFile(new URL('20261101000003_draft_price_outages.sql', MIGRATIONS));
    const table = outagesDdl.match(/create table if not exists public\.draft_turn_outages \([\s\S]*?\);/);
    if (!table) throw new Error('draft_turn_outages DDL moved');
    await db.exec(table[0].replace(/\breferences\s+[\w.]+\s*(\([^)]*\))?(\s+on\s+delete\s+cascade)?/gi, ''));

    const posts = async () => (await db.query(guard)).rows.length === 1;
    const reset = () => db.exec(`delete from fake_overdue; delete from draft_stalls; delete from draft_turn_outages; update fake_work set due = false;`);
    const overdue = (l: string, n: number) => db.query(`insert into fake_overdue values ($1, $2, now() - interval '1 second')`, [l, n]);
    const outage = (l: string, n: number, ago: string) =>
      db.query(`insert into draft_turn_outages (league_id, pick_number, first_seen_at, last_seen_at) values ($1, $2, now() - interval '3 minutes', now() - $3::interval)`, [l, n, ago]);
    const stall = (l: string, n: number, reason: string, ago: string) =>
      db.query(`insert into draft_stalls (league_id, pick_number, picker_id, reason, last_seen_at) values ($1, $2, 'u', $3, now() - $4::interval)`, [l, n, reason, ago]);

    await t.step('idle: no post', async () => {
      await reset();
      assertEquals(await posts(), false);
    });
    await t.step('a healthy overdue turn posts at once', async () => {
      await reset(); await overdue(L1, 5);
      assertEquals(await posts(), true);
    });
    await t.step('an outage seen < 10 s ago holds the post (the old 10 s pace)', async () => {
      await reset(); await overdue(L1, 5); await outage(L1, 5, '3 seconds');
      assertEquals(await posts(), false);
      await reset(); await overdue(L1, 5); await outage(L1, 5, '9 seconds');
      assertEquals(await posts(), false);
    });
    await t.step('an outage seen > 10 s ago posts again (it keeps retrying until prices return)', async () => {
      await reset(); await overdue(L1, 5); await outage(L1, 5, '11 seconds');
      assertEquals(await posts(), true);
    });
    await t.step("another turn's or league's outage never holds this turn", async () => {
      await reset(); await overdue(L1, 6); await outage(L1, 5, '1 second');
      assertEquals(await posts(), true);
      await reset(); await overdue(L1, 5); await outage(L2, 5, '1 second');
      assertEquals(await posts(), true);
      await reset(); await overdue(L1, 5); await outage(L1, 5, '1 second'); await overdue(L2, 9);
      assertEquals(await posts(), true);
    });
    await t.step('the 60 s stall throttle is unchanged (vendor_outage stall rows still exempt)', async () => {
      await reset(); await overdue(L1, 5); await stall(L1, 5, 'nothing_legal', '20 seconds');
      assertEquals(await posts(), false);
      await reset(); await overdue(L1, 5); await stall(L1, 5, 'vendor_outage', '1 second');
      assertEquals(await posts(), true);
    });
    await t.step('auto-start work posts even while every overdue turn is held', async () => {
      await reset(); await overdue(L1, 5); await outage(L1, 5, '1 second');
      await db.exec(`update fake_work set due = true`);
      assertEquals(await posts(), true);
    });
    await db.close();
  },
});
