/**
 * 20261205000100: commissioner direct writes (security brief 2026-11-13, S2 + S3).
 *
 * On the WHOLE migration chain (full_chain.ts), so every other leagues/drafts trigger and
 * the real RLS policies run too. As an `authenticated` commissioner (the claims pattern):
 *   - ATTACKS refused: deleting a pick (pre-draft, live, finished), deleting a live or
 *     finished league (the cascade that would wipe its picks), writing draft_status,
 *     every server-owned leagues column before and after the draft, moving draft_date
 *     after the draft starts, an INSERT that pre-sets the season, any write to
 *     draft_sessions / draft_settings;
 *   - LEGITIMATE writes still pass: the exact create-league INSERT, the League settings
 *     patch, the playoff-teams stepper, the draft-time sheet, a pre-draft league delete,
 *     an UPDATE that echoes a protected column back unchanged, the member reads, the
 *     service role (process-week-results' current_week), the owner (SQL editor), and a
 *     SECURITY DEFINER RPC a user calls (renew_league, start_renewed_season);
 *   - MUTANTS: each guard line is removed from the live function or policy in turn, and
 *     the attack it exists for must then get through (the line is load-bearing), with
 *     the real body restored right after.
 *
 *   deno test --allow-read --allow-env --allow-sys --allow-run supabase/tests/commissioner_direct_writes.pglite.test.ts
 */
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.2';
import { loadChain } from './full_chain.ts';

// deno-lint-ignore no-explicit-any
type Row = any;

const MIG = '20261205000100_commissioner_direct_writes.sql';
const SERVER_ONLY = 'league_column_server_only';
const C = '11111111-1111-4111-8111-111111111111'; // the commissioner
const M = '22222222-2222-4222-8222-222222222222'; // a member
/** A REAL season (another league's): a random uuid would be stopped by the FK, not the guard. */
const SEASON = '33333333-3333-4333-8333-333333333333';

/** A protected column and a value that differs from what a fresh league holds. */
const UPDATE_ATTACKS: Array<[string, string]> = [
  ['id', `gen_random_uuid()`],
  ['created_at', `now() - interval '30 days'`],
  ['invite_code', `'VANITY01'`],
  ['league_start_date', `now() - interval '1 day'`],
  ['league_end_date', `now() + interval '1 day'`],
  ['current_week', `7`],
  ['season_status', `'completed'`],
  ['current_season_id', `'${SEASON}'::uuid`],
];
/** INSERT: the season columns pre-set (created_at, id and invite_code are the client's to send on create... */
const INSERT_ATTACKS: Array<[string, string]> = [
  ['created_at', `now() - interval '30 days'`],
  ['league_start_date', `now() - interval '1 day'`],
  ['league_end_date', `now() + interval '1 day'`],
  ['current_week', `7`],
  ['season_status', `'completed'`],
  ['current_season_id', `'${SEASON}'::uuid`],
];

Deno.test({
  name: `${MIG}: commissioner direct writes are limited to the client flows`,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const db = new PGlite();
    const applied = await loadChain(db);
    assert(applied.includes(MIG), 'this migration is in the chain');
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
    const user = <T>(fn: () => Promise<T>) => as(C, fn);
    let n = 0;
    const code = () => `CDW${String(++n).padStart(5, '0')}`;
    // A valid draft time: on the quarter hour, well over an hour out.
    const [{ d: DRAFT_AT }] = await q(`select (date_trunc('hour', now()) + interval '5 hours')::text d`);
    const [{ d: DRAFT_AT2 }] = await q(`select (date_trunc('hour', now()) + interval '6 hours 15 minutes')::text d`);

    await q(`insert into auth.users (id, email) values ($1, 'c@example.test'), ($2, 'm@example.test')`, [C, M]);

    /** A league in a given draft state, seeded as the owner, with both managers and one pick each. */
    async function league(status: 'not_started' | 'in_progress' | 'completed', picks = status !== 'not_started') {
      const [l] = await q(
        `insert into leagues (name, commissioner_id, invite_code, num_participants, num_rounds, stake_mode,
           league_type, num_weeks, playoff_teams, draft_status, draft_date)
         values ($1, $2, $3, 8, 6, 'fixed_notional', 'matchup', 11, 4, $4,
           case when $4 = 'not_started' then null else now() - interval '1 hour' end) returning id`,
        [`L ${status} ${n}`, C, code(), status],
      );
      await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner'), ($1, $3, 'member')`, [l.id, C, M]);
      if (picks) {
        await q(`insert into drafts (league_id, user_id, symbol, entry_price, quantity, round, pick_number)
                 values ($1, $2, 'AAPL', 100, 10, 1, 1), ($1, $3, 'MSFT', 100, 10, 1, 2)`, [l.id, C, M]);
      }
      return l.id as string;
    }
    const picks = async (id: string) => (await q(`select count(*)::int n from drafts where league_id = $1`, [id]))[0].n as number;
    const leagueExists = async (id: string) => (await q(`select 1 from leagues where id = $1`, [id])).length === 1;
    const fnDef = async (name: string) => (await q(`select pg_get_functiondef('public.${name}'::regproc) d`))[0].d as string;
    /** Run `check` with `name`'s body changed by `mutate`, then put the real body back. */
    async function withMutant(name: string, mutate: (src: string) => string, check: () => Promise<void>) {
      const real = await fnDef(name);
      const mutant = mutate(real);
      assert(mutant !== real, `the mutation of ${name} applied`);
      await db.exec(mutant);
      try {
        await check();
      } finally {
        await db.exec(real);
      }
      assertEquals(await fnDef(name), real, `${name} restored`);
    }

    const pre = await league('not_started');
    const seasonOwner = await league('completed', false);
    await q(`insert into league_seasons (id, league_id, season_number) values ($1, $2, 1)`, [SEASON, seasonOwner]);
    const live = await league('in_progress');
    const done = await league('completed');

    // ---------------------------------------------------------------- shape
    await t.step('shape: policies, trigger, function security and grants', async () => {
      const pol = await q(`select tablename, policyname, cmd, qual from pg_policies
                            where tablename in ('drafts', 'leagues', 'draft_sessions', 'draft_settings') order by 1, 2`);
      const by = (tab: string) => pol.filter((p: Row) => p.tablename === tab).map((p: Row) => p.cmd).sort();
      assertEquals(by('drafts'), ['SELECT'], 'drafts: members read, nobody writes');
      assertEquals(by('draft_sessions'), ['SELECT']);
      assertEquals(by('draft_settings'), ['SELECT']);
      assertEquals(by('leagues'), ['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
      const del = pol.find((p: Row) => p.tablename === 'leagues' && p.cmd === 'DELETE');
      assert(/is_commissioner\(id\) AND \(draft_status = 'not_started'::text\)/.test(del.qual), del.qual);

      const [tg] = await q(`select tgenabled, pg_get_triggerdef(t.oid) def from pg_trigger t
                             where tgname = 'trg_leagues_server_columns' and tgrelid = 'public.leagues'::regclass`);
      assertEquals(tg.tgenabled, 'O');
      assert(/BEFORE INSERT OR UPDATE ON public\.leagues FOR EACH ROW EXECUTE FUNCTION enforce_leagues_server_columns\(\)/.test(tg.def), tg.def);
      const [fn] = await q(`select prosecdef, proconfig, proacl::text acl from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                             where s.nspname = 'public' and proname = 'enforce_leagues_server_columns'`);
      assertEquals(fn.prosecdef, false, 'SECURITY INVOKER: current_user is the caller');
      assertEquals(fn.proconfig, ['search_path=public, pg_temp']);
      assert(fn.acl !== null && !/(anon|authenticated|service_role)=/.test(fn.acl) && !/(^|[{,])=/.test(fn.acl), `owner only: ${fn.acl}`);
    });

    // ---------------------------------------------------------------- S2: picks
    await t.step('S2: a commissioner cannot delete a pick, before, during or after the draft', async () => {
      // A pre-draft pick does not happen in the product; seeded here so the POLICY (not the
      // freeze trigger, which lets not_started through) is what is shown to be gone.
      await q(`insert into drafts (league_id, user_id, symbol, entry_price, quantity, round, pick_number)
               values ($1, $2, 'NVDA', 100, 10, 1, 1)`, [pre, C]);
      for (const id of [pre, live, done]) {
        const before = await picks(id);
        const gone = await user(() => q(`delete from drafts where league_id = $1 returning id`, [id]));
        assertEquals(gone.length, 0, 'no row is deletable');
        assertEquals(await picks(id), before, 'every pick is still there');
      }
      await q(`delete from drafts where league_id = $1`, [pre]);
    });

    await t.step('S2 side door: a commissioner cannot delete a live or finished league (its picks would cascade)', async () => {
      for (const id of [live, done]) {
        const before = await picks(id);
        const gone = await user(() => q(`delete from leagues where id = $1 returning id`, [id]));
        assertEquals(gone.length, 0);
        assert(await leagueExists(id));
        assertEquals(await picks(id), before);
      }
    });

    // ---------------------------------------------------------------- S3: leagues columns
    await t.step('S3: draft_status cannot be written directly (20261111000001, pinned)', async () => {
      for (const [id, to] of [[pre, 'in_progress'], [pre, 'completed'], [live, 'completed'], [done, 'not_started']]) {
        await assertRejects(() => user(() => q(`update leagues set draft_status = $2 where id = $1`, [id, to])), Error, 'draft_status_server_only');
      }
    });

    await t.step('S3: every server-owned column is refused, before the draft', async () => {
      for (const [col, val] of UPDATE_ATTACKS) {
        await assertRejects(() => user(() => q(`update leagues set ${col} = ${val} where id = $1`, [pre])), Error, `${SERVER_ONLY}: only the server writes these league columns (${col})`);
      }
      // Several at once name each one.
      await assertRejects(() => user(() => q(`update leagues set current_week = 3, season_status = 'playoffs' where id = $1`, [pre])), Error, '(current_week, season_status)');
      const [r] = await q(`select current_week, season_status, league_start_date, current_season_id from leagues where id = $1`, [pre]);
      assertEquals(r, { current_week: 1, season_status: 'active', league_start_date: null, current_season_id: null });
    });

    await t.step('S3: the same columns are refused once the draft has started (by this guard or the rules freeze)', async () => {
      for (const id of [live, done]) {
        for (const [col, val] of UPDATE_ATTACKS) {
          const err = await assertRejects(() => user(() => q(`update leagues set ${col} = ${val} where id = $1`, [id])));
          assert(/league_column_server_only|league_rules_locked/.test((err as Error).message), `${col}: ${(err as Error).message}`);
        }
      }
    });

    await t.step('S3: draft_date cannot move once the draft has started (the client shows its draft_time_locked line)', async () => {
      for (const id of [live, done]) {
        await assertRejects(() => user(() => q(`update leagues set draft_date = $2 where id = $1`, [id, DRAFT_AT])), Error, "draft_time_locked: the draft has started, so the draft time can't change");
        await assertRejects(() => user(() => q(`update leagues set draft_date = null where id = $1`, [id])), Error, 'draft_time_locked');
      }
    });

    await t.step('S3: a new league cannot pre-set its season', async () => {
      for (const [col, val] of INSERT_ATTACKS) {
        await assertRejects(
          () => user(() => q(`insert into leagues (name, commissioner_id, invite_code, num_participants, league_type, playoff_teams, ${col})
                              values ('Pre-set', $1, $2, 8, 'matchup', 4, ${val})`, [C, code()])),
          Error, `${SERVER_ONLY}: only the server writes these league columns (${col})`,
        );
      }
    });

    await t.step('S3: draft_sessions / draft_settings take no client write', async () => {
      for (const tab of ['draft_sessions', 'draft_settings']) {
        // Explicit ids: the harness's stand-in tables use a serial the API roles hold no grant on.
        await q(`insert into ${tab} (id, league_id) values (9001, $1)`, [pre]);
        await assertRejects(() => user(() => q(`insert into ${tab} (id, league_id) values (9002, $1)`, [pre])), Error, 'row-level security');
        assertEquals((await user(() => q(`update ${tab} set league_id = $2 where league_id = $1 returning id`, [pre, live]))).length, 0);
        assertEquals((await user(() => q(`delete from ${tab} where league_id = $1 returning id`, [pre]))).length, 0);
        // The member read stays.
        assertEquals((await as(M, () => q(`select league_id from ${tab} where league_id = $1`, [pre]))).length, 1);
      }
    });

    // ---------------------------------------------------------------- legitimate writes
    let created = '';
    await t.step('legit: the exact create-league INSERT (create-league.tsx handleCreate)', async () => {
      const [l] = await user(() => q(`insert into leagues (name, commissioner_id, invite_code, num_participants, num_rounds,
          stake_mode, notional_per_slot, allow_undraftable, budget_amount, league_type, duration_days, num_weeks, playoff_teams,
          draft_status, draft_order_mode, pick_seconds, draft_date)
        values ('Serie A Traders', $1, $2, 8, 6, 'budget_cap', 1000, false, 5000, 'matchup', 30, 11, 4,
          'not_started', 'random', 60, $3) returning id, current_week, season_status`, [C, code(), DRAFT_AT]));
      assertEquals([l.current_week, l.season_status], [1, 'active']);
      created = l.id;
      await user(() => q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner')`, [created, C]));
      // Set later (draft_date null), fixed_notional: the other shape it sends.
      await user(() => q(`insert into leagues (name, commissioner_id, invite_code, num_participants, num_rounds, stake_mode,
          notional_per_slot, allow_undraftable, league_type, duration_days, num_weeks, playoff_teams, draft_status,
          draft_order_mode, pick_seconds, draft_date)
        values ('Set later', $1, $2, 8, 6, 'fixed_notional', 1000, true, 'matchup', 30, 11, 4, 'not_started', 'manual', 45, null)`, [C, code()]));
    });

    await t.step('legit: League settings save (league-settings.tsx handleSave patch), one row back', async () => {
      const rows = await user(() => q(`update leagues set name = 'Renamed', draft_date = $2, num_participants = 10, num_rounds = 7,
          allow_undraftable = true, pick_seconds = 90, stake_mode = 'fixed_notional', notional_per_slot = 2000, budget_amount = 8000
        where id = $1 returning id`, [created, DRAFT_AT2]));
      assertEquals(rows.length, 1);
    });

    await t.step('legit: the playoff-teams stepper and the draft-time sheet (useDraftAutoStart.ts)', async () => {
      assertEquals((await user(() => q(`update leagues set playoff_teams = 6 where id = $1 returning id`, [created]))).length, 1);
      assertEquals((await user(() => q(`update leagues set draft_date = $2 where id = $1 returning id`, [created, DRAFT_AT]))).length, 1);
    });

    await t.step('legit: an UPDATE that echoes protected columns back unchanged passes (per column, not "any column")', async () => {
      const [l] = await q(`select id, invite_code, created_at::text c, current_week, season_status from leagues where id = $1`, [created]);
      const rows = await user(() => q(`update leagues set name = 'Echo', id = $1, invite_code = $2, created_at = $3::timestamptz,
          current_week = $4, season_status = $5, league_start_date = null, current_season_id = null
        where id = $1 returning id`, [l.id, l.invite_code, l.c, l.current_week, l.season_status]));
      assertEquals(rows.length, 1);
      // After the draft: a rename (not a rule, not server-owned) still works.
      assertEquals((await user(() => q(`update leagues set name = 'Live rename' where id = $1 returning id`, [live]))).length, 1);
    });

    await t.step('legit: members still read picks', async () => {
      assertEquals((await as(M, () => q(`select id from drafts where league_id = $1`, [live]))).length, 2);
    });

    await t.step('legit: the server writes what it owns (service role, owner)', async () => {
      // process-week-results advances current_week on the service role.
      await as('service', () => q(`update leagues set current_week = current_week + 1 where id = $1`, [done]));
      // The SQL editor / a migration (owner).
      await q(`update leagues set league_start_date = now(), league_end_date = now() + interval '11 weeks' where id = $1`, [done]);
      const [r] = await q(`select current_week, league_start_date is not null s from leagues where id = $1`, [done]);
      assertEquals([r.current_week, r.s], [2, true]);
    });

    await t.step('legit: a SECURITY DEFINER RPC the user calls passes (renew_league INSERT, start_renewed_season UPDATE)', async () => {
      // A finished Season 1 with only the commissioner (no invitees, so nothing is pending).
      const [s1] = await q(`insert into leagues (name, commissioner_id, invite_code, num_participants, num_rounds, stake_mode,
          league_type, num_weeks, playoff_teams, draft_status, season_status)
        values ('Season 1', $1, $2, 4, 6, 'fixed_notional', 'matchup', 11, 4, 'completed', 'completed') returning id`, [C, code()]);
      await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner')`, [s1.id, C]);
      await q(`insert into league_seasons (league_id, season_number, completed_at) values ($1, 1, now())`, [s1.id]);
      await q(`update leagues set current_season_id = (select id from league_seasons where league_id = $1) where id = $1`, [s1.id]);
      const [{ r }] = await user(() => q(`select public.renew_league($1) r`, [s1.id]));
      assertEquals(r.status, 'renewed', JSON.stringify(r));
      const s2 = r.league_id as string;
      const [{ r: started }] = await user(() => q(`select public.start_renewed_season($1, $2::jsonb) r`, [s2, JSON.stringify({ draft_date: DRAFT_AT, name: 'Season 2' })]));
      assert(started.status !== 'refused', JSON.stringify(started));
    });

    await t.step('legit: a synthetic DEFINER function may write a server column for a user (the current_user exemption)', async () => {
      await q(`create function public.cdw_test_definer(p uuid) returns void language sql security definer set search_path = public as
               $f$ update leagues set league_start_date = now() where id = p $f$`);
      await q(`grant execute on function public.cdw_test_definer(uuid) to authenticated`);
      await user(() => q(`select public.cdw_test_definer($1)`, [created]));
      assertEquals((await q(`select league_start_date is not null s from leagues where id = $1`, [created]))[0].s, true);
      await q(`update leagues set league_start_date = null where id = $1`, [created]);
    });

    await t.step('legit: a commissioner may still delete their league before its draft', async () => {
      const id = await league('not_started', false);
      assertEquals((await user(() => q(`delete from leagues where id = $1 returning id`, [id]))).length, 1);
      // A member may not.
      const other = await league('not_started', false);
      assertEquals((await as(M, () => q(`delete from leagues where id = $1 returning id`, [other]))).length, 0);
    });

    // ---------------------------------------------------------------- mutants
    /** Replace the one array element that names `col` with NULL (array_remove drops it). */
    const dropLine = (col: string, op: 'UPDATE' | 'INSERT') => (src: string) =>
      src.replace(new RegExp(op === 'UPDATE'
        ? `case when new\\.${col}\\s+is distinct from old\\.${col}\\s+then '${col}' end`
        : `case when new\\.${col}\\s+is (distinct from (?!old\\.)|not null)[^\\n]*?then '${col}' end`), 'null');

    await t.step('mutants: each UPDATE column line is load-bearing (removed, its pre-draft attack lands)', async () => {
      for (const [col, val] of UPDATE_ATTACKS) {
        await withMutant('enforce_leagues_server_columns', dropLine(col, 'UPDATE'), async () => {
          const id = await league('not_started', false);
          const attack = () => user(() => q(`update leagues set ${col} = ${val} where id = $1 returning id`, [id]));
          if (col === 'id') {
            // EQUIVALENT mutant: leagues_update_commissioner's WITH CHECK is_commissioner(id) looks the
            // NEW id up and finds no league, so RLS refuses a changed id on its own. The line stays as
            // the readable refusal and the second layer.
            await assertRejects(attack, Error, 'row-level security');
          } else {
            assertEquals((await attack()).length, 1, `${col} got through with its line removed`);
          }
        });
      }
    });

    await t.step('mutants: each INSERT column line is load-bearing', async () => {
      for (const [col, val] of INSERT_ATTACKS) {
        await withMutant('enforce_leagues_server_columns', dropLine(col, 'INSERT'), async () => {
          const rows = await user(() => q(`insert into leagues (name, commissioner_id, invite_code, num_participants, league_type, playoff_teams, ${col})
                                           values ('Mutant', $1, $2, 8, 'matchup', 4, ${val}) returning id`, [C, code()]));
          assertEquals(rows.length, 1, `${col} got through with its line removed`);
        });
      }
    });

    await t.step('mutant: without the post-draft draft_date block, the live league\'s time moves', async () => {
      await withMutant('enforce_leagues_server_columns', (src) => src.replace(/\n\s*if tg_op = 'UPDATE'\s+and new\.draft_date[\s\S]*?end if;/, ''), async () => {
        assertEquals((await user(() => q(`update leagues set draft_date = $2 where id = $1 returning id`, [live, DRAFT_AT]))).length, 1);
      });
    });

    await t.step('mutant: keyed on auth.uid() instead of current_user, the user-called DEFINER path is refused', async () => {
      await withMutant('enforce_leagues_server_columns',
        (src) => src.replace(`if current_user not in ('anon', 'authenticated') then`, 'if auth.uid() is null then'),
        async () => {
          await assertRejects(() => user(() => q(`select public.cdw_test_definer($1)`, [created])), Error, SERVER_ONLY);
        });
    });

    await t.step('mutant: the trigger function reduced to `return new` lets every attack through', async () => {
      await withMutant('enforce_leagues_server_columns', (src) => src.replace(/begin\n/, 'begin\n  return new;\n'), async () => {
        assertEquals((await user(() => q(`update leagues set season_status = 'completed', current_week = 9 where id = $1 returning id`, [pre]))).length, 1);
      });
      await q(`update leagues set season_status = 'active', current_week = 1 where id = $1`, [pre]);
    });

    await t.step('mutants: the old policies back, the attacks land', async () => {
      // drafts DELETE policy (20251205110000's), pre-draft so the freeze trigger lets it through.
      await q(`insert into drafts (league_id, user_id, symbol, entry_price, quantity, round, pick_number) values ($1, $2, 'NVDA', 100, 10, 1, 1)`, [pre, C]);
      await q(`create policy "Commissioners can delete picks" on drafts for delete using (exists (select 1 from leagues
               where leagues.id = drafts.league_id and leagues.commissioner_id = auth.uid()::text))`);
      try {
        assertEquals((await user(() => q(`delete from drafts where league_id = $1 returning id`, [pre]))).length, 1);
      } finally {
        await q(`drop policy "Commissioners can delete picks" on drafts`);
      }
      // leagues DELETE without the status gate: the finished league goes. (Whether its picks
      // cascade depends on prod's dashboard-made drafts FK, which the harness does not model.)
      await q(`alter policy leagues_delete_commissioner on leagues using (public.is_commissioner(id))`);
      try {
        const victim = await league('completed');
        assertEquals((await user(() => q(`delete from leagues where id = $1 returning id`, [victim]))).length, 1);
        assert(!(await leagueExists(victim)), 'the finished league is gone');
      } finally {
        await q(`alter policy leagues_delete_commissioner on leagues using (public.is_commissioner(id) and draft_status = 'not_started')`);
      }
      // draft_sessions FOR ALL policy: the commissioner insert lands.
      await q(`create policy "Commissioners can manage draft sessions" on draft_sessions for all
               using (exists (select 1 from leagues where leagues.id = draft_sessions.league_id and leagues.commissioner_id = auth.uid()::text))
               with check (exists (select 1 from leagues where leagues.id = draft_sessions.league_id and leagues.commissioner_id = auth.uid()::text))`);
      try {
        assertEquals((await user(() => q(`insert into draft_sessions (id, league_id) values (9003, $1) returning id`, [pre]))).length, 1);
      } finally {
        await q(`drop policy "Commissioners can manage draft sessions" on draft_sessions`);
      }
    });

    await db.close();
  },
});
