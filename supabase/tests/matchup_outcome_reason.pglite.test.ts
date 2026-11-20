/**
 * 20261208000000_matchup_outcome_reason against REAL Postgres (PGlite).
 * NOT hermetic: the first run fetches npm:@electric-sql/pglite.
 *   deno test --allow-read --allow-env supabase/tests/matchup_outcome_reason.pglite.test.ts
 *
 * Plan: docs/plans/2026-11-19-matchup-outcome-reason.md, "Done means" 1.
 *   - the migration applies, VERBATIM, onto a replica of matchups;
 *   - a row scored before it gets 'not_recorded' (an explicit marker, not NULL);
 *   - an unscored row keeps a NULL reason;
 *   - the CHECK refuses an unknown reason, and a percent_tiebreak row without
 *     both percents;
 *   - the CHECK list equals RECORDED_OUTCOME_REASONS, the list the function
 *     writes from (so a reason added to one and not the other fails here, not
 *     on Friday's scoring run as a 23514 the handler only logs);
 *   - a league member reads the new columns through the existing SELECT policy,
 *     with no new grant; a non-member reads nothing.
 */
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.2';
import { RECORDED_OUTCOME_REASONS } from '../functions/process-week-results/outcome-record.ts';

const ROOT = new URL('../../', import.meta.url);
const MIGRATION = new URL('supabase/migrations/20261208000000_matchup_outcome_reason.sql', ROOT);

// The matchups replica (columns as start_league_playoffs.pglite.test.ts declares
// them), the matchups_select_members policy as 20260712000004 creates it, and
// Supabase's table grants to authenticated (db-snapshot.json: authenticated=arwd,
// no column ACLs).
const SCHEMA = `
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create table leagues (id uuid primary key default gen_random_uuid());
create table league_members (league_id uuid not null, user_id text not null, primary key (league_id, user_id));
create function is_member(p_league uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from league_members where league_id = p_league and user_id = auth.uid()::text) $$;
grant execute on function is_member(uuid) to authenticated;
create table matchups (id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade, week_number int not null,
  team1_user_id text, team2_user_id text, team1_gain numeric(12,2), team2_gain numeric(12,2),
  winner_user_id text, is_tie boolean default false, week_start timestamptz, week_end timestamptz,
  is_playoff boolean default false, playoff_round text, team1_seed int, team2_seed int);
alter table matchups enable row level security;
create policy "matchups_select_members" on matchups for select to authenticated using (is_member(league_id));
grant select, insert, update, delete on matchups to anon, authenticated, service_role;
`;

const MEMBER = '00000000-0000-0000-0000-00000000000a';
const OUTSIDER = '00000000-0000-0000-0000-00000000000b';

// deno-lint-ignore no-explicit-any
type Row = any;

Deno.test({
  name: 'matchups.outcome_reason migration on real Postgres (PGlite)',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const db = new PGlite();
    const q = async (s: string, p: unknown[] = []) => (await db.query(s, p)).rows as Row[];
    await db.exec(SCHEMA);

    const [{ id: league }] = await q(`insert into leagues default values returning id`);
    await q(`insert into league_members values ($1, $2)`, [league, MEMBER]);
    // Before the migration: two scored weeks (a win and a tie) and one unscored.
    const [{ id: scoredWin }] = await q(
      `insert into matchups (league_id, week_number, team1_user_id, team2_user_id, team1_gain, team2_gain, winner_user_id)
       values ($1, 1, 'u1', 'u2', 12.50, -3.00, 'u1') returning id`, [league]);
    const [{ id: scoredTie }] = await q(
      `insert into matchups (league_id, week_number, team1_user_id, team2_user_id, team1_gain, team2_gain, is_tie)
       values ($1, 2, 'u1', 'u2', 0, 0, true) returning id`, [league]);
    const [{ id: unscored }] = await q(
      `insert into matchups (league_id, week_number, team1_user_id, team2_user_id)
       values ($1, 3, 'u1', 'u2') returning id`, [league]);

    const sql = await Deno.readTextFile(MIGRATION);
    await t.step('the file never contains the bare word the CLI splitter reads as BEGIN ATOMIC', () => {
      assert(!/\batomic\b/i.test(sql));
    });
    await db.exec(sql);
    const reason = async (id: string) => (await q(`select outcome_reason from matchups where id = $1`, [id]))[0].outcome_reason;

    await t.step('a row scored before the migration gets not_recorded, never NULL', async () => {
      assertEquals(await reason(scoredWin), 'not_recorded');
      assertEquals(await reason(scoredTie), 'not_recorded');
    });

    await t.step('an unscored row keeps a NULL reason and NULL percents', async () => {
      const [r] = await q(`select outcome_reason, team1_percent_gain, team2_percent_gain from matchups where id = $1`, [unscored]);
      assertEquals(r, { outcome_reason: null, team1_percent_gain: null, team2_percent_gain: null });
    });

    await t.step('the backfill leaves no scored row without a reason', async () => {
      const [{ n }] = await q(`select count(*)::int as n from matchups where team1_gain is not null and outcome_reason is null`);
      assertEquals(n, 0);
    });

    await t.step('the CHECK list is exactly RECORDED_OUTCOME_REASONS', async () => {
      const [{ def }] = await q(
        `select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'matchups_outcome_reason_valid'`);
      const inCheck = [...def.matchAll(/'([a-z0-9_]+)'::text/g)].map((m: RegExpMatchArray) => m[1]);
      assertEquals([...inCheck].sort(), [...RECORDED_OUTCOME_REASONS].sort());
    });

    await t.step('every recorded reason is accepted', async () => {
      for (const r of RECORDED_OUTCOME_REASONS) {
        await q(`update matchups set outcome_reason = $2, team1_percent_gain = 1.5, team2_percent_gain = 0.5 where id = $1`, [scoredWin, r]);
      }
    });

    await t.step('the CHECK refuses an unknown reason', async () => {
      await assertRejects(
        () => q(`update matchups set outcome_reason = 'won_by_vibes' where id = $1`, [scoredWin]),
        Error, 'matchups_outcome_reason_valid');
    });

    await t.step('the CHECK refuses a percent_tiebreak row without both percents', async () => {
      for (const [p1, p2] of [[null, 0.74], [1.76, null], [null, null]]) {
        await assertRejects(
          () => q(`update matchups set outcome_reason = 'percent_tiebreak', team1_percent_gain = $2, team2_percent_gain = $3 where id = $1`,
            [scoredWin, p1, p2]),
          Error, 'matchups_percent_tiebreak_has_percents');
      }
      // Both present: accepted, including a stored 0 percent (a real number).
      await q(`update matchups set outcome_reason = 'percent_tiebreak', team1_percent_gain = 1.76, team2_percent_gain = 0 where id = $1`, [scoredWin]);
      assertEquals(await reason(scoredWin), 'percent_tiebreak');
    });

    await t.step('a percent may be NULL on any other reason (a side with no stocks)', async () => {
      await q(`update matchups set outcome_reason = 'team2_empty_auto_loss', team1_percent_gain = 2.1, team2_percent_gain = null where id = $1`, [scoredWin]);
      assertEquals(await reason(scoredWin), 'team2_empty_auto_loss');
    });

    await t.step('a member reads the new columns with no new grant; a non-member reads nothing', async () => {
      const asUser = async (sub: string) => {
        await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${sub}', false);`);
        try {
          return await q(`select id, outcome_reason, team1_percent_gain, team2_percent_gain from matchups order by week_number`);
        } finally {
          await db.exec(`reset role;`);
        }
      };
      const mine = await asUser(MEMBER);
      assertEquals(mine.map((r: Row) => r.outcome_reason), ['team2_empty_auto_loss', 'not_recorded', null]);
      assertEquals(Number(mine[0].team1_percent_gain), 2.1);
      assertEquals(await asUser(OUTSIDER), []);
    });

    await db.close();
  },
});
