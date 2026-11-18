/**
 * record_trade_atomic's season-end-BY-DATE refusal (20261207000000) against REAL
 * Postgres (PGlite), plus PARITY with its TS twin in record-trade/gate.ts.
 * NOT hermetic: the first run fetches npm:@electric-sql/pglite.
 * Run instructions: supabase/tests/README.md.
 *
 * Rule (Giorgio, 2026-11-18): "A finished season is closed to buying and selling."
 * A season is finished by the season_status FLAG, or once its last scoring window
 * has closed BY DATE: now() > the latest matchups.week_end, counted only when the
 * whole schedule is written (a playoff row exists, no NULL week_end). See the
 * migration header for why each partial case means "no date check".
 *
 * Every scenario is a SELL of one drafted share with an exact CAS, so the only
 * thing that can refuse it is the gate under test. Each scenario also runs the
 * TS gate (seasonEndFromMatchups + tradeRefusalReason) over the same rows at the
 * database's now(), and asserts the two layers agree.
 *
 * Loads VERBATIM the same chain as record_trade_atomic.pglite.test.ts, then the
 * migration under test. leagues / league_members / drafts / league_draft_slots /
 * matchups are replicas of the columns the function reads (matchups: prod's
 * nullable week_end and nullable is_playoff DEFAULT false).
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.2';
import { seasonEndFromMatchups, tradeRefusalReason } from '../functions/record-trade/gate.ts';

const ROOT = new URL('../../', import.meta.url);
const MIGRATION_UNDER_TEST = '20261207000000_record_trade_season_end_by_date.sql';
const MIGRATIONS = [
  '20250118000000_create_trades.sql',
  '20260810000000_widen_draft_trade_quantity_numeric.sql',
  '20261006000000_trades_funded_by_trade_id.sql',
  '20260811000002_trades_drop_direct_client_insert.sql',
  '20261102000000_record_trade_atomic.sql',
  '20261103000000_trades_slot_id.sql',
  '20261115000006_record_trade_season_guard.sql',
  MIGRATION_UNDER_TEST,
].map((f) => new URL(`supabase/migrations/${f}`, ROOT));
const SIG13 = 'uuid,uuid,text,text,numeric,numeric,numeric,uuid,uuid[],text[],jsonb,jsonb,uuid';

const SCHEMA = `
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create table leagues (
  id uuid primary key default gen_random_uuid(), draft_status text default 'completed',
  season_status text default 'active' check (season_status in ('active', 'playoffs', 'completed')),
  stake_mode text, budget_amount numeric(12,2) not null default 100, notional_per_slot numeric not null default 1000,
  num_rounds int not null default 6, allow_undraftable boolean not null default false);
create table league_members (league_id uuid not null references leagues(id) on delete cascade,
  user_id text not null, primary key (league_id, user_id));
create table drafts (id uuid primary key default gen_random_uuid(), league_id uuid not null references leagues(id),
  user_id text not null, symbol text not null, entry_price numeric not null, quantity integer not null,
  pick_number int, slot_id uuid, created_at timestamptz default now());
create table league_draft_slots (id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade, slot_index integer not null,
  slot_count integer not null default 1, price_min numeric, price_max numeric, category_id uuid,
  unique (league_id, slot_index));
create table matchups (id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade, week_number int not null,
  team1_user_id text, team2_user_id text, week_start timestamptz null, week_end timestamptz null,
  is_playoff boolean default false, created_at timestamptz not null default now());
`;

// deno-lint-ignore no-explicit-any
type Row = any;

Deno.test({
  name: 'record_trade_atomic: a season finished BY DATE is closed to trading (PGlite)',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const db = new PGlite();
    const q = async (s: string, p: unknown[] = []) => (await db.query(s, p)).rows as Row[];
    await db.exec(SCHEMA);
    for (const m of MIGRATIONS) await db.exec(await Deno.readTextFile(m));
    await db.exec(`grant all on all tables in schema public to service_role;`);

    let userSeq = 0;
    /** A league with one member holding ONE drafted MSFT share. */
    async function fixture(cols: Record<string, unknown> = {}) {
      const A = `00000000-0000-4000-8000-${String(++userSeq).padStart(12, '0')}`;
      await q(`insert into auth.users values ($1)`, [A]);
      const keys = Object.keys(cols);
      const [l] = await q(
        keys.length
          ? `insert into leagues (${keys.join(',')}) values (${keys.map((_, i) => '$' + (i + 1)).join(',')}) returning id`
          : `insert into leagues default values returning id`,
        Object.values(cols),
      );
      await q(`insert into league_members values ($1,$2)`, [l.id, A]);
      await q(`insert into drafts (league_id, user_id, symbol, entry_price, quantity, pick_number)
        values ($1,$2,'MSFT',100,1,1)`, [l.id, A]);
      return { L: l.id as string, A };
    }
    /** A matchups row whose week_end is `endSql` (an SQL expression; 'null' allowed). */
    async function week(L: string, n: number, endSql: string, isPlayoff: boolean | null = false) {
      await q(`insert into matchups (league_id, week_number, team1_user_id, team2_user_id, week_start, week_end, is_playoff)
        values ($1, $2, 'a', 'b', (${endSql})::timestamptz - interval '3 days', (${endSql})::timestamptz, $3)`, [L, n, isPlayoff]);
    }
    /** The SELL through the real function, with an exact CAS (so only the gate can refuse). */
    async function sell(L: string, A: string): Promise<Row> {
      const seenTrades = (await q(`select id::text id from trades where league_id=$1`, [L])).map((r: Row) => r.id);
      const seenDrafts = (await q(`select id::text id from drafts where league_id=$1`, [L])).map((r: Row) => r.id);
      const [{ r }] = await q(
        `select record_trade_atomic($1,$2,'MSFT','sell',1,100,100,null,$3::uuid[],$4::text[],null,null,null) r`,
        [L, A, seenTrades, seenDrafts],
      );
      return r;
    }
    /** The TS gate over the same rows, at the database's now() (same transaction). */
    async function tsGate(L: string) {
      const [league] = await q(`select draft_status, season_status from leagues where id=$1`, [L]);
      const rows = (await q(`select week_end, is_playoff from matchups where league_id=$1`, [L]))
        .map((r: Row) => ({ week_end: r.week_end == null ? null : new Date(r.week_end).toISOString(), is_playoff: r.is_playoff }));
      const [{ now }] = await q(`select now() as now`);
      return tradeRefusalReason(league, seasonEndFromMatchups(rows), new Date(now));
    }
    const tradeCount = async (L: string) => (await q(`select count(*)::int n from trades where league_id=$1`, [L]))[0].n;
    /** Run the SQL and TS gates, assert they agree, return the SQL reply. */
    async function both(L: string, A: string, want: 'ok' | 'season_completed') {
      const ts = await tsGate(L);
      const sql = await sell(L, A);
      if (want === 'ok') {
        assertEquals(sql.ok, true, JSON.stringify(sql));
        assertEquals(ts, null);
        assertEquals(await tradeCount(L), 1);
      } else {
        assertEquals(sql, { ok: false, reason: 'season_completed' });
        assertEquals(ts, 'season_completed');
        assertEquals(await tradeCount(L), 0);
      }
    }

    // ---- grants / structure (CREATE OR REPLACE keeps the ACL; restated anyway) --
    await t.step('grants after this file: one 13-arg function, INVOKER, VOLATILE, service_role only', async () => {
      const rows = await q(`select pronargs from pg_proc where proname='record_trade_atomic'`);
      assertEquals(rows.map((r: Row) => r.pronargs), [13]);
      const [r] = await q(`select proacl::text a, prosecdef d, provolatile v, proconfig::text c
        from pg_proc where oid = to_regprocedure('record_trade_atomic(${SIG13})')`);
      assertEquals(r.d, false);
      assertEquals(r.v, 'v');
      assert(!/anon=|authenticated=/.test(r.a), r.a);
      assert(!/(^|[{,])=X/.test(r.a), `PUBLIC still has EXECUTE: ${r.a}`);
      assert(/service_role=X/.test(r.a), r.a);
      assert(r.c.includes('search_path=public, pg_temp'), r.c);
      assert(r.c.includes('lock_timeout=5s'), r.c);
    });

    await t.step('structure: the matchups read is under the advisory lock, after the flag check, before membership', async () => {
      const [{ src }] = await q(`select prosrc src from pg_proc where proname='record_trade_atomic'`);
      const body = (src as string).toLowerCase().replace(/--[^\n]*/g, '');
      const lock = body.indexOf('pg_advisory_xact_lock(');
      const flag = body.indexOf(`season_status is not distinct from 'completed'`);
      const read = body.indexOf('from matchups');
      const member = body.indexOf('from league_members');
      assert(lock > 0 && lock < flag && flag < read && read < member, `${lock} ${flag} ${read} ${member}`);
    });

    // ---- the gap this closes ----------------------------------------------------
    await t.step('final week ended, season_status NOT yet completed -> season_completed, nothing written', async () => {
      const { L, A } = await fixture({ season_status: 'playoffs' });
      await week(L, 1, `now() - interval '21 days'`);
      await week(L, 2, `now() - interval '14 days'`);
      await week(L, 3, `now() - interval '7 days'`, true);
      await week(L, 4, `now() - interval '1 hour'`, true); // the final
      await both(L, A, 'season_completed');
    });

    // ---- still open ---------------------------------------------------------------
    await t.step('mid-season (regular weeks ahead, no bracket yet) -> allowed', async () => {
      const { L, A } = await fixture();
      await week(L, 1, `now() - interval '7 days'`);
      await week(L, 2, `now() + interval '2 days'`);
      await week(L, 3, `now() + interval '9 days'`);
      await both(L, A, 'ok');
    });

    await t.step('playoffs in progress (the final ends ahead) -> allowed', async () => {
      const { L, A } = await fixture({ season_status: 'playoffs' });
      await week(L, 1, `now() - interval '14 days'`);
      await week(L, 2, `now() - interval '7 days'`, true);
      await week(L, 3, `now() + interval '2 days'`, true);
      await both(L, A, 'ok');
    });

    await t.step('regular season over, bracket NOT yet written (transition pending/refused) -> allowed, not locked by accident', async () => {
      const { L, A } = await fixture();
      await week(L, 1, `now() - interval '14 days'`);
      await week(L, 2, `now() - interval '3 days'`);
      await both(L, A, 'ok');
    });

    await t.step('is_playoff NULL reads as a regular week (no bracket) -> allowed', async () => {
      const { L, A } = await fixture();
      await week(L, 1, `now() - interval '3 days'`, null);
      await both(L, A, 'ok');
    });

    await t.step('a NULL week_end anywhere: end unknown -> no date check (allowed)', async () => {
      const { L, A } = await fixture({ season_status: 'playoffs' });
      await week(L, 1, `now() - interval '14 days'`);
      await week(L, 2, `now() - interval '7 days'`, true);
      await week(L, 3, 'null', true);
      await both(L, A, 'ok');
    });

    await t.step('the season end is the latest week_end over ALL matchups, not only the playoff rows', async () => {
      const { L, A } = await fixture({ season_status: 'playoffs' });
      await week(L, 1, `now() + interval '1 day'`); // a regular row dated after the final (data anomaly)
      await week(L, 2, `now() - interval '1 hour'`, true);
      await both(L, A, 'ok');
    });

    // ---- unchanged behaviour --------------------------------------------------------
    await t.step('status completed -> season_completed, even with weeks ahead (unchanged)', async () => {
      const { L, A } = await fixture({ season_status: 'completed' });
      await week(L, 1, `now() + interval '2 days'`, true);
      await both(L, A, 'season_completed');
    });

    await t.step('no matchups at all (a leftover Duration league): today\'s behaviour, the flag only', async () => {
      const open = await fixture();
      await both(open.L, open.A, 'ok');
      const done = await fixture({ season_status: 'completed' });
      await both(done.L, done.A, 'season_completed');
    });

    await t.step('the draft check still comes first: an unfinished draft past its season end is draft_not_completed', async () => {
      const { L, A } = await fixture({ draft_status: 'in_progress' });
      await week(L, 1, `now() - interval '1 hour'`, true);
      assertEquals(await sell(L, A), { ok: false, reason: 'draft_not_completed' });
      assertEquals(await tsGate(L), 'draft_not_completed');
    });

    // ---- the boundary: STRICT >, at the transaction's now() --------------------------
    // Inside one transaction now() is constant, so these are exact. JS Dates hold
    // milliseconds, so the TS parity case is 1 ms past; the SQL alone is also
    // checked 1 microsecond past.
    await t.step('boundary: week_end = now() is still inside the final window (allowed); just past it refuses', async () => {
      const inside = await fixture({ season_status: 'playoffs' });
      await db.exec('begin');
      await week(inside.L, 1, `now()`, true);
      await both(inside.L, inside.A, 'ok');
      await db.exec('commit');

      const past = await fixture({ season_status: 'playoffs' });
      await db.exec('begin');
      await week(past.L, 1, `now() - interval '1 millisecond'`, true);
      await both(past.L, past.A, 'season_completed');
      await db.exec('commit');

      const micro = await fixture({ season_status: 'playoffs' });
      await db.exec('begin');
      await week(micro.L, 1, `now() - interval '1 microsecond'`, true);
      assertEquals(await sell(micro.L, micro.A), { ok: false, reason: 'season_completed' });
      await db.exec('commit');
      assertEquals(await tradeCount(micro.L), 0);
    });
  },
});
