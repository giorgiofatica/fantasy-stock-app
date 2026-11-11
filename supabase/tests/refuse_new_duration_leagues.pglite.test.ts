/**
 * 20261203000000: the server refuses a NEW Duration league, whatever the path
 * (PRODUCT_RULES, "Duration is hidden in Create league until it is built", 2026-11-11).
 *
 * On the WHOLE migration chain (full_chain.ts), so every other leagues trigger and the
 * real RLS policies run too:
 *   - the trigger exists, is enabled, is BEFORE INSERT OR UPDATE OF league_type; its
 *     function is SECURITY INVOKER, search_path pinned, EXECUTE held by nobody but the owner;
 *   - an explicit 'duration' insert is refused, for a user session, the service role and the
 *     owner (the SQL editor) alike;
 *   - an insert that OMITS league_type is refused too: the column default stays 'duration'
 *     (deliberately not flipped) and a default is in NEW when a BEFORE trigger runs;
 *   - 'matchup' is allowed, including the exact row apps/mobile create-league sends;
 *   - an EXISTING Duration league can still be updated (any column, and even to matchup);
 *   - a Matchup league cannot be turned into a Duration one;
 *   - renewal: renew_league refuses a Duration league with its own reason and makes nothing,
 *     and with that early refusal removed the trigger still stops the copy; get_season_result
 *     says "unsupported" for one (existing behaviour, pinned).
 *
 *   deno test --allow-read --allow-env --allow-sys --allow-run supabase/tests/refuse_new_duration_leagues.pglite.test.ts
 */
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.2';
import { asExistingDuration, loadChain, readMigration } from './full_chain.ts';

// deno-lint-ignore no-explicit-any
type Row = any;

const MIG = '20261203000000_refuse_new_duration_leagues.sql';
const REFUSED = 'duration_not_available';
const C = '11111111-1111-4111-8111-111111111111';

Deno.test({
  name: `${MIG}: no new Duration league, by any path; existing ones untouched`,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const db = new PGlite();
    const applied = await loadChain(db);
    assert(applied.includes(MIG), 'this migration is in the chain');
    const q = async (s: string, p: unknown[] = []) => (await db.query<Row>(s, p)).rows;
    async function as<T>(who: 'user' | 'service', fn: () => Promise<T>): Promise<T> {
      if (who === 'service') await db.exec(`set role service_role; reset request.jwt.claim.sub;`);
      else await db.exec(`set role authenticated; set request.jwt.claim.sub = '${C}';`);
      try {
        return await fn();
      } finally {
        await db.exec(`reset role; reset request.jwt.claim.sub;`);
      }
    }
    let n = 0;
    const code = () => `DUR${String(++n).padStart(5, '0')}`;
    const count = async () => (await q(`select count(*)::int n from leagues`))[0].n as number;

    await q(`insert into auth.users (id, email) values ($1, 'c@example.test')`, [C]);

    await t.step('the trigger and its function: shape, security mode, grants', async () => {
      const [tg] = await q(`select tgenabled, pg_get_triggerdef(t.oid) def from pg_trigger t
                             where tgname = 'trg_leagues_refuse_new_duration' and tgrelid = 'public.leagues'::regclass`);
      assert(tg, 'trigger exists');
      assertEquals(tg.tgenabled, 'O', 'enabled');
      assert(/BEFORE INSERT OR UPDATE OF league_type ON public\.leagues FOR EACH ROW/.test(tg.def), tg.def);
      const [fn] = await q(`select prosecdef, proconfig, proacl::text acl from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                             where s.nspname = 'public' and proname = 'refuse_new_duration_leagues'`);
      assertEquals(fn.prosecdef, false, 'SECURITY INVOKER');
      assertEquals(fn.proconfig, ['search_path=public, pg_temp']);
      assert(fn.acl !== null, 'explicit ACL (revokes ran)');
      assert(!/(anon|authenticated|service_role)=/.test(fn.acl) && !/(^|[{,])=/.test(fn.acl), `nobody but the owner: ${fn.acl}`);
    });

    await t.step("explicit 'duration' is refused: user session, service role and owner alike", async () => {
      const before = await count();
      const ins = () => q(`insert into leagues (name, commissioner_id, invite_code, num_participants, league_type)
                           values ('D', $1, $2, 8, 'duration')`, [C, code()]);
      await assertRejects(() => as('user', ins), Error, REFUSED);
      await assertRejects(() => as('service', ins), Error, REFUSED);
      await assertRejects(ins, Error, REFUSED);
      assertEquals(await count(), before, 'nothing written');
    });

    await t.step('an insert that omits league_type is refused (the default stays duration)', async () => {
      const [col] = await q(`select column_default d from information_schema.columns
                              where table_schema = 'public' and table_name = 'leagues' and column_name = 'league_type'`);
      assertEquals(col.d, `'duration'::text`, 'the default is not flipped');
      const before = await count();
      const ins = () => q(`insert into leagues (name, commissioner_id, invite_code, num_participants)
                           values ('No type', $1, $2, 8)`, [C, code()]);
      await assertRejects(() => as('user', ins), Error, REFUSED);
      await assertRejects(ins, Error, REFUSED);
      assertEquals(await count(), before);
    });

    let matchupId = '';
    await t.step("'matchup' is allowed: the row apps/mobile create-league sends", async () => {
      // create-league.tsx handleCreate's payload (fixed_notional, Set later), as the commissioner.
      const [l] = await as('user', () => q(`insert into leagues (name, commissioner_id, invite_code, num_participants, num_rounds,
          stake_mode, notional_per_slot, allow_undraftable, league_type, duration_days, num_weeks, playoff_teams,
          draft_status, draft_order_mode, pick_seconds, draft_date)
        values ('Serie A Traders', $1, $2, 8, 6, 'fixed_notional', 1000, false, 'matchup', 30, 11, 4,
          'not_started', 'random', 60, null) returning id, league_type`, [C, code()]));
      assertEquals(l.league_type, 'matchup');
      matchupId = l.id;
      const [s] = await as('service', () => q(`insert into leagues (name, commissioner_id, invite_code, num_participants, league_type)
                                                 values ('Svc', $1, $2, 8, 'matchup') returning league_type`, [C, code()]));
      assertEquals(s.league_type, 'matchup');
    });

    await t.step('a Matchup league cannot be turned into a Duration one', async () => {
      await assertRejects(() => as('user', () => q(`update leagues set league_type = 'duration' where id = $1`, [matchupId])), Error, REFUSED);
      await assertRejects(() => q(`update leagues set league_type = 'duration' where id = $1`, [matchupId]), Error, REFUSED);
      assertEquals((await q(`select league_type from leagues where id = $1`, [matchupId]))[0].league_type, 'matchup');
      // Other writes to it are untouched (the trigger is scoped to league_type).
      await as('user', () => q(`update leagues set name = 'Renamed' where id = $1`, [matchupId]));
      await as('user', () => q(`update leagues set league_type = 'matchup', name = 'Same type' where id = $1`, [matchupId]));
    });

    let durId = '';
    await t.step('an EXISTING Duration league is left as it is: every update still works', async () => {
      const [d] = await asExistingDuration(db, () => q(`insert into leagues (name, commissioner_id, invite_code, num_participants, league_type)
                                                         values ('Old duration', $1, $2, 8, 'duration') returning id`, [C, code()]));
      durId = d.id;
      const [tg] = await q(`select tgenabled from pg_trigger where tgname = 'trg_leagues_refuse_new_duration'`);
      assertEquals(tg.tgenabled, 'O', 'the fixture helper turned the trigger back on');
      await as('user', () => q(`update leagues set name = 'Old duration, renamed', duration_days = 90 where id = $1`, [durId]));
      await as('user', () => q(`update leagues set league_type = 'duration' where id = $1`, [durId]));   // same value
      await q(`update leagues set league_type = 'duration', duration_days = 180 where id = $1`, [durId]);
      const [r] = await q(`select name, league_type, duration_days from leagues where id = $1`, [durId]);
      assertEquals(r, { name: 'Old duration, renamed', league_type: 'duration', duration_days: 180 });
    });

    await t.step('renewal of a Duration league: refused with its reason, nothing made; the trigger backs it up', async () => {
      // Finished, so the TYPE is what refuses it (renew_league checks the type first, then the season).
      await q(`update leagues set season_status = 'completed' where id = $1`, [durId]);
      await q(`insert into league_seasons (league_id, season_number, completed_at) values ($1, 1, now())`, [durId]);
      await q(`update leagues set current_season_id = (select id from league_seasons where league_id = $1) where id = $1`, [durId]);
      // Existing behaviour, pinned (RUN_IT_BACK_DESIGN.md §4.4, "Duration leagues: out of scope"):
      // the season result a Run it back card hangs off is 'unsupported' for a Duration league.
      await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner')`, [durId, C]);
      const [res] = await as('user', () => q(`select status, reason from public.get_season_result($1)`, [durId]));
      assertEquals(res, { status: 'unsupported', reason: 'not_a_matchup_league' });
      const before = await count();
      const [{ r }] = await as('user', () => q(`select public.renew_league($1) r`, [durId]));
      assertEquals(r, { status: 'refused', reason: 'unsupported_league_type' });
      assertEquals(await count(), before, 'no successor');

      // Backstop: renew_league WITHOUT its type check (the latest definition, one line removed)
      // still cannot make the Duration copy. The real body goes back right after (CREATE OR
      // REPLACE keeps the grants), and the call below proves it is back.
      const src = await readMigration('20261125000002_deleted_seat_guards.sql');
      const i = src.indexOf('create or replace function public.renew_league(');
      const body = src.slice(i, src.indexOf('\n$$;', i) + 4);
      const CHECK = `  if v_old.league_type is distinct from 'matchup' then
    return jsonb_build_object('status', 'refused', 'reason', 'unsupported_league_type');
  end if;
`;
      assert(body.includes(CHECK), 'the type check is where it was');
      try {
        await db.exec(body.replace(CHECK, ''));
        await assertRejects(() => as('user', () => q(`select public.renew_league($1)`, [durId])), Error, REFUSED);
      } finally {
        await db.exec(body);
      }
      assertEquals(await count(), before);
      const [{ r: again }] = await as('user', () => q(`select public.renew_league($1) r`, [durId]));
      assertEquals(again.reason, 'unsupported_league_type', 'the real function is back');
    });

    await db.close();
  },
});
