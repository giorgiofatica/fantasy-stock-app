/**
 * Claims, the waiver wire (20261211000000 + 20261211000001; Stocks tab part 3, workstream 6), on the
 * WHOLE migration chain (full_chain.ts), with the run's REAL resolver (claims-run/plan.ts over
 * record-trade's decideTrade) feeding the REAL commit_claims_run, which calls the REAL
 * record_trade_atomic.
 *
 * What it proves:
 *   - grants by proacl, never assumed: place_claim / cancel_claim authenticated only; the run's
 *     functions and the hold service_role only; helpers and the trigger function nobody; tables:
 *     anon holds nothing, authenticated SELECT only on claims and waiver_order; policies exact;
 *   - BLIND: manager B sees no row, no count, no trace of A's pending claim on the SAME stock; B can
 *     claim it too (no "already claimed" leak); B cannot read A's claim notices; two leagues are
 *     separate; a non-member reads nothing; the Available read of "my pending claims" is the
 *     caller's only;
 *   - the writes: every refusal (market open / unknown, not a member, hidden and deleted seats, draft
 *     not done, season over by flag and BY DATE, unknown symbol, not_draftable by the buy's own test
 *     and allowed in a full-universe league, owned by anyone, a sale not held, already claimed, one
 *     sale for two claims, the 6th pending claim by the write AND by a direct insert); a cancel; a
 *     re-claim after a cancel;
 *   - the waiver order: finalize_league_draft starts it as the reverse draft order, and its body is
 *     20261115000000's VERBATIM plus only the order block; members read it, outsiders do not;
 *   - the run: a contested stock to the better position, the loser told who won; a FILL removes the
 *     winner's watchlist row through option A's trigger (20261210500000), a loss leaves the loser's; a sale + buy in a
 *     fixed_notional league with funded_by re-mapped to the sale just inserted; winners to the back
 *     in win order; outcomes, notices and the claims_runs row in the same transaction; a second
 *     commit is already_ran;
 *   - PARTIAL STATE: a commit refused at its SECOND step writes NOTHING (the first claim's sale and
 *     buy roll back; no claims_runs row; every claim still pending) and the re-plan on fresh reads
 *     then commits whole; a cancel between plan and commit is claims_changed; a reset between them is
 *     order_changed; a missed day's claim fails missed_run (onMissedDay); bad plans are refused;
 *   - the hold: true only while open < 10 min, claims due, and no row; it lifts by the row, by the
 *     clock (open + 10 min), and is false with no claims or a closed market;
 *   - the weekly reset: reverse standings after a fully scored week; a half-scored week does not
 *     reset; idempotent; the order follows a seat whose user_id changes (takeover);
 *   - the cron: every minute, the vault key, the 180 s timeout, gated on claims_run_day();
 *   - docs/security/2026-12-11-claims-checks.sql reads as documented and its effect block says PASS.
 *
 * NOT covered (one connection): two truly concurrent transactions on the locks.
 *
 * Run: deno test --allow-read --allow-env supabase/tests/claims.pglite.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.2';
import { applyFrom, loadChain, readMigration } from './full_chain.ts';
import type { DraftRow, LeagueRow, SlotRow } from '../functions/record-trade/commit.ts';
import type { TradeRow } from '../functions/_shared/draft-validation.ts';
import { type ClaimRow, type CommitPlan, type OrderRow, planLeague } from '../functions/claims-run/plan.ts';

const VERSION = '20261211000000';
const CHECKS_URL = new URL('../../docs/security/2026-12-11-claims-checks.sql', import.meta.url);

const A = '00000000-0000-4000-8000-0000000000a1';
const B = '00000000-0000-4000-8000-0000000000b2';
const C = '00000000-0000-4000-8000-0000000000c3';
const X = '00000000-0000-4000-8000-0000000000d4'; // outsider
const H = '00000000-0000-4000-8000-0000000000e5'; // hidden seat
const D = '00000000-0000-4000-8000-0000000000f6'; // deleted seat
const L = '00000000-0000-4000-8000-0000000c1a01'; // budget_cap league, regular season
const L2 = '00000000-0000-4000-8000-0000000c1a02'; // fixed_notional league
const LPRE = '00000000-0000-4000-8000-0000000c1a03'; // draft not done
const LEND = '00000000-0000-4000-8000-0000000c1a04'; // season over by date
const LFULL = '00000000-0000-4000-8000-0000000c1a05'; // full universe

// deno-lint-ignore no-explicit-any
type Row = any;

Deno.test({
  name: 'claims on the full chain',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const db = new PGlite();
    const q = async (s: string, p: unknown[] = []) => (await db.query<Row>(s, p)).rows;
    const one = async (s: string, p: unknown[] = []) => (await q(s, p))[0];
    async function as<T>(role: 'anon' | 'authenticated' | 'service_role', sub: string | null, fn: () => Promise<T>): Promise<T> {
      await db.exec(`set role ${role}`);
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub ?? '']);
      try {
        return await fn();
      } finally {
        await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`).catch(() => {});
      }
    }
    async function refusal(fn: () => Promise<unknown>): Promise<{ code: string; message: string }> {
      try {
        await fn();
      } catch (e) {
        return { code: (e as Row).code, message: (e as Error).message };
      }
      throw new Error('expected a refusal, got an answer');
    }
    const clearPacing = () => q(`delete from rate_limit_counters where bucket like 'claims-%'`);
    const place = async (sub: string | null, league: string, sym: string, sell: string | null = null) => {
      await clearPacing();
      return as('authenticated', sub, async () => (await one(`select public.place_claim($1, $2, $3) r`, [league, sym, sell])).r);
    };
    const cancel = (sub: string, league: string, sym: string) =>
      as('authenticated', sub, async () => (await one(`select public.cancel_claim($1, $2) r`, [league, sym])).r);

    // ---- the market calendar, driven relative to the real clock -----------------------------------
    // closed: today is no session; tomorrow is (next_open_at = tomorrow 09:30 ET).
    // open:   today is a session that opened `minutesAgo` minutes ago (clamped inside the ET day).
    const etToday = async () => (await one(`select (now() at time zone 'America/New_York')::date::text d`)).d as string;
    async function marketClosed() {
      await db.exec(`delete from market_calendar; delete from market_calendar_coverage;`);
      await q(`insert into market_calendar_coverage (covered_from, covered_through)
               values ((now() at time zone 'America/New_York')::date - 7, (now() at time zone 'America/New_York')::date + 30)`);
      await q(`insert into market_calendar (session_date, open_et, close_et)
               values ((now() at time zone 'America/New_York')::date + 1, '09:30', '16:00')`);
    }
    async function marketOpen(minutesAgo: number) {
      await db.exec(`delete from market_calendar; delete from market_calendar_coverage;`);
      await q(`insert into market_calendar_coverage (covered_from, covered_through)
               values ((now() at time zone 'America/New_York')::date - 7, (now() at time zone 'America/New_York')::date + 30)`);
      await q(`insert into market_calendar (session_date, open_et, close_et)
               select d, greatest(time '00:00', (n - make_interval(mins => $1))::time), least(time '23:59:59', (n + interval '1 hour')::time)
                 from (select (now() at time zone 'America/New_York') n, (now() at time zone 'America/New_York')::date d) x`, [minutesAgo]);
    }
    const tomorrow = async () => (await one(`select ((now() at time zone 'America/New_York')::date + 1)::text d`)).d as string;

    // ---- the chain --------------------------------------------------------------------------------
    await loadChain(db, { untilBefore: VERSION });
    const applied = await applyFrom(db, VERSION);
    assert(applied.includes(`${VERSION}_claims.sql`) && applied.includes('20261211000001_schedule_claims_run.sql'));

    // ---- fixture, as the owner --------------------------------------------------------------------
    for (const u of [A, B, C, X, H, D]) await q(`insert into auth.users (id, email) values ($1, $2)`, [u, `${u.slice(-2)}@example.test`]);
    const SYMS: Array<[string, boolean]> = [
      ['AAPL', true], ['MSFT', true], ['NVDA', true], ['AAA', true], ['BBB', true], ['CCC', true],
      ['XA', true], ['XB', true], ['XC', true], ['XD', true], ['XE', true], ['XF', true], ['OFFL', false],
    ];
    for (const [s, dr] of SYMS) {
      await q(`insert into public.symbols (symbol, name, is_draftable, last_price, last_price_at, gics_industry, market_cap)
               values ($1, $2, $3, 100, now(), 'ZZ Technology', 1e9)`, [s, `${s} Inc.`, dr]);
    }
    const league = (id: string, code: string, extra: Record<string, unknown>) => {
      const cols = ['id', 'name', 'commissioner_id', 'invite_code', 'num_participants', 'league_type', 'num_weeks', 'playoff_teams', ...Object.keys(extra)];
      const vals = [id, 'League', A, code, 8, 'matchup', 2, 2, ...Object.values(extra)];
      return q(`insert into leagues (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, vals);
    };
    await league(L, 'CLAIMS01', { stake_mode: 'budget_cap', budget_amount: 10000, num_rounds: 3 });
    await league(L2, 'CLAIMS02', { stake_mode: 'fixed_notional', notional_per_slot: 1000, num_rounds: 3 });
    await league(LPRE, 'CLAIMS03', { stake_mode: 'budget_cap', budget_amount: 10000, num_rounds: 3 });
    await league(LEND, 'CLAIMS04', { stake_mode: 'budget_cap', budget_amount: 10000, num_rounds: 3 });
    await league(LFULL, 'CLAIMS05', { stake_mode: 'budget_cap', budget_amount: 10000, num_rounds: 3, allow_undraftable: true });
    for (const lg of [L, L2, LPRE, LEND, LFULL]) {
      await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner'), ($1, $3, 'member'), ($1, $4, 'member'), ($1, 'bot-1', 'member')`, [lg, A, B, C]);
    }
    for (const lg of [L, L2, LPRE, LEND, LFULL]) {
      await q(`insert into league_members (league_id, user_id, role, hidden_at) values ($1, $2, 'member', now())`, [lg, H]);
      await q(`insert into league_members (league_id, user_id, role, deleted_at) values ($1, $2, 'member', now())`, [lg, D]);
    }
    // Draft order (A first) for the leagues that drafted, then the drafts and the finalize.
    const drafted = [L, L2, LEND, LFULL];
    for (const lg of drafted) {
      await q(`insert into league_draft_order_meta (league_id, state, source) values ($1, 'open', 'manual_seed')`, [lg]);
      await q(`insert into league_draft_order (league_id, position, user_id) values ($1, 1, $2), ($1, 2, $3), ($1, 3, $4), ($1, 4, 'bot-1'), ($1, 5, $5), ($1, 6, $6)`, [lg, A, B, C, H, D]);
      await q(`update league_draft_order_meta set state = 'locked', finalized_at = now(), locked_at = now() where league_id = $1`, [lg]);
      await q(`insert into drafts (league_id, user_id, symbol, entry_price, quantity, round, pick_number) values
                ($1, $2, 'AAA', 100, $5, 1, 1), ($1, $3, 'BBB', 100, $5, 1, 2), ($1, $4, 'CCC', 100, $5, 1, 3)`,
        [lg, A, B, C, lg === L2 ? 10 : 1]);
    }
    const members = [A, B, C, 'bot-1', H, D];
    const finalize = async (lg: string, weeks: Array<[number, string, string]>) => {
      await q(`update leagues set draft_status = 'in_progress' where id = $1`, [lg]);
      const matchups = weeks.map(([w, t1, t2]) => ({
        week_number: w, team1_user_id: t1, team2_user_id: t2,
        week_start: new Date(Date.now() + (w - 1) * 7 * 864e5 - 864e5).toISOString(),
        week_end: new Date(Date.now() + (w - 1) * 7 * 864e5 + 5 * 864e5).toISOString(),
      }));
      return (await as('service_role', null, () => one(`select public.finalize_league_draft($1, $2, $3, $4, $5) r`,
        [lg, members, new Date(Date.now() - 864e5).toISOString(), new Date(Date.now() + 30 * 864e5).toISOString(), JSON.stringify(matchups)]))).r;
    };
    // Six members, three games a week, two weeks.
    const weeks: Array<[number, string, string]> = [
      [1, A, B], [1, C, 'bot-1'], [1, H, D],
      [2, A, C], [2, B, H], [2, 'bot-1', D],
    ];
    for (const lg of drafted) assertEquals((await finalize(lg, weeks)).status, 'finalized', `finalize ${lg}`);
    // LEND: a playoff row that ended yesterday makes the season over BY DATE.
    await q(`insert into matchups (league_id, week_number, team1_user_id, team2_user_id, week_start, week_end, is_playoff, playoff_round_number, bracket_position)
             values ($1, 3, $2, $3, now() - interval '6 days', now() - interval '1 day', true, 1, 0)`, [LEND, A, B]);
    await q(`update matchups set week_start = now() - interval '20 days', week_end = now() - interval '15 days' where league_id = $1 and not is_playoff`, [LEND]);

    const order = async (lg: string) =>
      (await q(`select user_id from waiver_order where league_id = $1 order by position`, [lg])).map((r: Row) => r.user_id);

    await t.step('grants: proacl, DEFINER, search_path; tables and policies exact', async () => {
      const fns = await q(`select proname, prosecdef, proconfig::text cfg, proacl::text acl
                             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'public' and proname in (
                              '_claims_season_end', '_waiver_order_fill', 'claims_before_insert',
                              'place_claim', 'cancel_claim', 'claims_run_day', 'claims_run_state', 'claims_hold_active',
                              'commit_claims_run', 'reset_due_waiver_orders', 'finalize_league_draft')
                            order by proname`);
      const SP = '{"search_path=public, pg_temp"}';
      const NOBODY = '{postgres=X/postgres}';
      const SR = '{postgres=X/postgres,service_role=X/postgres}';
      const AUTH = '{postgres=X/postgres,authenticated=X/postgres}';
      assertEquals(fns.map((r: Row) => [r.proname, r.prosecdef, r.cfg, r.acl]), [
        ['_claims_season_end', true, SP, NOBODY],
        ['_waiver_order_fill', true, SP, NOBODY],
        ['cancel_claim', true, SP, AUTH],
        ['claims_before_insert', true, SP, NOBODY],
        ['claims_hold_active', true, SP, SR],
        ['claims_run_day', true, SP, SR],
        ['claims_run_state', true, SP, SR],
        ['commit_claims_run', true, SP, SR],
        ['finalize_league_draft', true, SP, SR],
        ['place_claim', true, SP, AUTH],
        ['reset_due_waiver_orders', true, SP, SR],
      ]);
      const privs = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
      for (const tbl of ['claims', 'waiver_order', 'waiver_order_meta', 'claims_runs']) {
        const [rls] = await q(`select relrowsecurity r from pg_class where oid = $1::regclass`, [`public.${tbl}`]);
        assertEquals(rls.r, true, `${tbl} RLS on`);
        for (const role of ['anon', 'authenticated', 'service_role']) {
          const held = [];
          for (const p of privs) {
            if ((await one(`select has_table_privilege($1, $2, $3) h`, [role, `public.${tbl}`, p])).h) held.push(p);
          }
          const want = role === 'authenticated' && (tbl === 'claims' || tbl === 'waiver_order') ? ['SELECT'] : [];
          assertEquals(held, want, `${role} on ${tbl}`);
        }
      }
      const pols = await q(`select tablename, policyname, cmd, roles::text roles, qual from pg_policies
                              where schemaname = 'public' and tablename in ('claims', 'waiver_order', 'waiver_order_meta', 'claims_runs')
                              order by tablename, policyname`);
      assertEquals(pols.map((r: Row) => [r.tablename, r.policyname, r.cmd, r.roles, r.qual]), [
        ['claims', 'claims_select_own', 'SELECT', '{authenticated}', '((user_id = (auth.uid())::text) AND is_member(league_id))'],
        ['waiver_order', 'waiver_order_select_member', 'SELECT', '{authenticated}', 'is_member(league_id)'],
      ]);
      // The kind CHECK carries the three new kinds.
      const [k] = await q(`select pg_get_constraintdef(oid) d from pg_constraint where conname = 'league_notifications_kind_check'`);
      for (const kind of ['claim_won', 'claim_lost', 'claim_failed', 'seat_taken_over', 'draft_order_set']) assert(k.d.includes(`'${kind}'`), kind);
    });

    await t.step('finalize_league_draft: 20261115000000 VERBATIM plus only the order block; the order is the reverse draft order', async () => {
      const fnText = (sql: string) => {
        const start = sql.indexOf('create or replace function public.finalize_league_draft(');
        const end = sql.indexOf('$$;', sql.indexOf('as $$', start)) + 3;
        return sql.slice(start, end);
      };
      const before = fnText(await readMigration('20261115000000_run_it_back_lineage.sql'));
      const after = fnText(await readMigration(`${VERSION}_claims.sql`));
      const block = after.slice(after.indexOf('  -- 20261211000000: the waiver order'), after.indexOf('  return jsonb_build_object(\n    \'status\''));
      assert(block.includes('_waiver_order_fill') && block.length < 600, 'the added block is small and is the order init');
      assertEquals(after.replace(block, ''), before, 'nothing else changed');
      // Reverse of the draft order: the last pick (D, position 6) is first.
      assertEquals(await order(L), [D, H, 'bot-1', C, B, A]);
      assertEquals((await one(`select reset_through_week w from waiver_order_meta where league_id = $1`, [L])).w, 0);
      // Members read it; an outsider reads nothing; anon has no privilege.
      assertEquals((await as('authenticated', B, () => q(`select user_id from waiver_order where league_id = $1`, [L]))).length, 6);
      assertEquals((await as('authenticated', X, () => q(`select user_id from waiver_order where league_id = $1`, [L]))).length, 0);
      assert((await refusal(() => as('anon', null, () => q(`select * from waiver_order`)))).message.includes('permission denied'));
      // The finalize still answers as before, and a second call is already_finalized with the order unchanged.
      assertEquals((await as('service_role', null, () => one(`select public.finalize_league_draft($1, $2, now() - interval '1 day', now() + interval '30 days', '[]'::jsonb) r`, [L, members]))).r.status, 'refused', 'an empty matchup schedule is still refused, as before');
    });

    await t.step('place_claim: every refusal, then a claim', async () => {
      await marketOpen(5);
      assertEquals(await place(B, L, 'AAPL'), { ok: false, reason: 'claim_market_open' });
      await q(`delete from market_calendar_coverage`);
      assertEquals(await place(B, L, 'AAPL'), { ok: false, reason: 'calendar_unavailable' }, 'unknown is not closed');
      await marketClosed();
      assertEquals(await place(null, L, 'AAPL'), { ok: false, reason: 'not_authenticated' });
      assertEquals(await place(X, L, 'AAPL'), { ok: false, reason: 'not_a_member' });
      assertEquals(await place(H, L, 'AAPL'), { ok: false, reason: 'not_a_member' }, 'hidden seat');
      assertEquals(await place(D, L, 'AAPL'), { ok: false, reason: 'not_a_member' }, 'deleted seat');
      assertEquals(await place(B, LPRE, 'AAPL'), { ok: false, reason: 'draft_not_completed' });
      assertEquals(await place(B, LEND, 'AAPL'), { ok: false, reason: 'season_completed' }, 'over BY DATE');
      assertEquals(await place(B, L, 'NOPE'), { ok: false, reason: 'unknown_symbol' });
      assertEquals(await place(B, L, ''), { ok: false, reason: 'invalid' });
      assertEquals(await place(B, L, 'OFFL'), { ok: false, reason: 'not_draftable' }, 'the buy path\'s own test');
      assertEquals((await place(B, LFULL, 'OFFL')).ok, true, 'a full-universe league allows it, as the buy does');
      assertEquals(await place(B, L, 'AAA'), { ok: false, reason: 'symbol_owned' }, 'A holds it');
      assertEquals(await place(B, L, 'BBB'), { ok: false, reason: 'symbol_owned' }, 'you hold it');
      assertEquals(await place(B, L, 'AAPL', 'AAA'), { ok: false, reason: 'not_owned' }, 'a sale you do not hold');
      assertEquals(await place(B, L, 'AAPL', 'AAPL'), { ok: false, reason: 'invalid' });
      const ok = await place(B, L, ' aapl ', 'bbb');
      assertEquals(ok.ok, true);
      assertEquals([ok.claim.symbol, ok.claim.sell_symbol, ok.claim.funded_by, ok.claim.run_date, ok.pending], ['AAPL', 'BBB', 'sale', await tomorrow(), 1]);
      assertEquals(await place(B, L, 'AAPL'), { ok: false, reason: 'already_claimed' });
      assertEquals(await place(B, L, 'MSFT', 'BBB'), { ok: false, reason: 'sale_in_use' });
      for (const s of ['XA', 'XB', 'XC', 'XD']) assertEquals((await place(B, L, s)).ok, true, s);
      assertEquals(await place(B, L, 'XE'), { ok: false, reason: 'claim_limit', max: 5 });
      // The cap holds on a direct insert too (owner path): the trigger, then the slot index.
      const r = await refusal(() => q(`insert into claims (league_id, user_id, symbol, funded_by, run_date) values ($1, $2, 'XF', 'cash', current_date)`, [L, B]));
      assert(r.message.startsWith('claim_limit'), r.message);
      // Cancel frees a place; a re-claim of the cancelled stock is allowed (a PARTIAL unique index).
      assertEquals(await cancel(B, L, 'XD'), { ok: true, cancelled: true, pending: 4 });
      assertEquals(await cancel(B, L, 'XD'), { ok: true, cancelled: false, pending: 4 }, 'a second cancel is a no-op');
      assertEquals(await cancel(X, L, 'AAPL'), { ok: false, reason: 'not_a_member' });
      // Every call is counted, refusals included: the 61st call in a minute is refused.
      await clearPacing();
      for (let i = 0; i < 60; i++) await as('authenticated', X, () => one(`select public.place_claim($1, 'AAPL', null) r`, [L]));
      assertEquals((await as('authenticated', X, async () => (await one(`select public.place_claim($1, 'AAPL', null) r`, [L])).r)), { ok: false, reason: 'rate_limited' });
      assertEquals((await as('authenticated', X, async () => (await one(`select public.cancel_claim($1, 'AAPL') r`, [L])).r)), { ok: false, reason: 'rate_limited' });
      await clearPacing();
      assertEquals((await place(B, L, 'XD')).ok, true);
      assertEquals((await one(`select count(*)::int n from claims where league_id = $1 and user_id = $2 and status = 'pending'`, [L, B])).n, 5);
      // Clients cannot write the table directly.
      const w = await refusal(() => as('authenticated', B, () => q(`insert into claims (league_id, user_id, symbol, funded_by, run_date) values ($1, $2, 'XF', 'cash', current_date)`, [L, B])));
      assert(w.message.includes('permission denied'), w.message);
      const u = await refusal(() => as('authenticated', B, () => q(`update claims set status = 'won' where user_id = $1`, [B])));
      assert(u.message.includes('permission denied'), u.message);
      for (const role of ['anon', 'service_role'] as const) {
        const e = await refusal(() => as(role, B, () => q(`select public.place_claim($1, 'AAPL', null)`, [L])));
        assert(e.message.includes('permission denied for function'), `${role}: ${e.message}`);
      }
    });

    await t.step('BLIND: B learns nothing of A\'s claim on the same stock', async () => {
      await q(`delete from claims where league_id = $1`, [L]);
      await marketClosed();
      assertEquals((await place(A, L, 'NVDA')).ok, true);
      // The Available read of "my pending claims", as B: nothing (no row, so no count either).
      const mine = (sub: string, lg: string) =>
        as('authenticated', sub, () => q(`select symbol from claims where league_id = $1 and status = 'pending'`, [lg]));
      assertEquals(await mine(B, L), []);
      assertEquals((await as('authenticated', B, () => one(`select count(*)::int n from claims where user_id <> $1`, [B]))).n, 0);
      assertEquals((await as('authenticated', B, () => one(`select count(*)::int n from claims where symbol = 'NVDA'`))).n, 0);
      assertEquals((await mine(A, L)).map((r: Row) => r.symbol), ['NVDA'], 'A sees their own');
      // B may claim the same stock: the answer is the same as for an unclaimed stock.
      const bAns = await place(B, L, 'NVDA');
      assertEquals([bAns.ok, bAns.pending], [true, 1]);
      assertEquals((await mine(B, L)).map((r: Row) => r.symbol), ['NVDA']);
      // A non-member and another league: nothing.
      assertEquals(await mine(X, L), []);
      assertEquals(await mine(A, L2), []);
      // The run_state / hold readers are not callable by members.
      const e = await refusal(() => as('authenticated', B, () => q(`select public.claims_run_state($1, current_date)`, [L])));
      assert(e.message.includes('permission denied for function'));
      await q(`delete from claims where league_id = $1`, [L]);
    });

    // ---- the run: the real resolver over the real ledger, into the real commit ----------------------
    async function ledgerOf(lg: string) {
      const league = (await one(`select num_rounds, draft_status, season_status, stake_mode, budget_amount, notional_per_slot, allow_undraftable from leagues where id = $1`, [lg])) as LeagueRow;
      const picks = (await q(`select id::text, user_id, symbol, entry_price::float8, quantity::float8, pick_number, null as slot_id from drafts where league_id = $1 order by created_at, id`, [lg])) as DraftRow[];
      const trades = (await q(`select id::text, user_id::text, symbol, action, quantity::float8, price::float8, total_value::float8, created_at::text, funded_by_trade_id::text, slot_id::text from trades where league_id = $1 order by created_at, id`, [lg])) as TradeRow[];
      const slots = (await q(`select id::text, slot_index, slot_count, price_min, price_max, category_id::text from league_draft_slots where league_id = $1 order by slot_index`, [lg])) as SlotRow[];
      return { league, picks, trades, slots };
    }
    async function state(lg: string, runDate: string) {
      return (await as('service_role', null, () => one(`select public.claims_run_state($1, $2::date) r`, [lg, runDate]))).r as {
        already_ran: boolean; claims: ClaimRow[]; order: OrderRow[];
      };
    }
    async function makePlan(lg: string, runDate: string, prices: Record<string, number>): Promise<CommitPlan> {
      const st = await state(lg, runDate);
      const ld = await ledgerOf(lg);
      const r = planLeague({
        runDate, sessionOpenMs: Date.now() - 60_000, nowMs: Date.now(), seasonEnd: null,
        ...ld, claims: st.claims, order: st.order,
        prices: new Map(Object.entries(prices)),
        draftable: new Set(SYMS.filter(([, d]) => d).map(([s]) => s)),
        eligibility: new Map(),
      });
      assert(r.kind === 'plan');
      return r.plan;
    }
    const commit = async (lg: string, runDate: string, plan: unknown) =>
      (await as('service_role', null, () => one(`select public.commit_claims_run($1, $2::date, $3) r`, [lg, runDate, JSON.stringify(plan)]))).r;

    await t.step('the run: a contested stock, the loser told who won, winners to the back, notices, the row', async () => {
      await marketClosed();
      const run = await tomorrow();
      // Order is D, H, bot-1, C, B, A: C before B before A.
      const pa = await place(A, L, 'NVDA');
      assertEquals(pa.ok, true, JSON.stringify(pa));
      assertEquals((await place(C, L, 'NVDA')).ok, true);
      assertEquals((await place(B, L, 'MSFT', 'BBB')).ok, true);
      // All three watch the stock they claimed (option A, 20261210500000: a stock you come to own
      // leaves your watchlist, by its trigger on trades; the claims run builds no removal of its own).
      await q(`insert into watchlist (league_id, user_id, symbol) values ($1, $2, 'NVDA'), ($1, $3, 'NVDA'), ($1, $4, 'MSFT')`, [L, A, C, B]);
      const plan = await makePlan(L, run, { NVDA: 120.004, MSFT: 400, BBB: 101.5 });
      const res = await commit(L, run, plan);
      assertEquals(res, { ok: true, won: 2, lost: 1, failed: 0, missed: 0 });
      const rows = await q(`select user_id, symbol, status, reason, outcome, buy_trade_id is not null hb, sell_trade_id is not null hs, pending_slot from claims where league_id = $1 order by user_id`, [L]);
      const byUser = Object.fromEntries(rows.map((r: Row) => [r.user_id, r]));
      assertEquals([byUser[C].status, byUser[C].hb, Number(byUser[C].outcome.price)], ['won', true, 120]);
      assertEquals([byUser[A].status, byUser[A].reason, byUser[A].outcome.winner_user_id], ['lost', 'waiver_order', C]);
      assertEquals([byUser[B].status, byUser[B].hb, byUser[B].hs, Number(byUser[B].outcome.sell_price)], ['won', true, true, 101.5]);
      assert(rows.every((r: Row) => r.pending_slot === null));
      // The trades: B's sale then buy, C's buy, all at the run's prices.
      const tr = await q(`select user_id::text u, symbol, action, price::float8 p from trades where league_id = $1 order by created_at, action desc`, [L]);
      assertEquals(tr.map((r: Row) => [r.u, r.symbol, r.action, r.p]).sort(), [[B, 'BBB', 'sell', 101.5], [B, 'MSFT', 'buy', 400], [C, 'NVDA', 'buy', 120]].sort());
      // Winners to the back, in WIN order (C won before B: C's position is better).
      assertEquals(await order(L), [D, H, 'bot-1', A, C, B]);
      // Notices: one per claim, to the claimant only; the loser's names the winner.
      const ns = await q(`select user_id, kind, subject_user_id, detail->>'symbol' s, push_status from league_notifications where league_id = $1 and kind like 'claim_%' order by user_id`, [L]);
      assertEquals(ns.map((r: Row) => [r.user_id, r.kind, r.subject_user_id, r.s, r.push_status]), [
        [A, 'claim_lost', C, 'NVDA', 'pending'], [B, 'claim_won', null, 'MSFT', 'pending'], [C, 'claim_won', null, 'NVDA', 'pending'],
      ]);
      assertEquals((await as('authenticated', A, () => q(`select kind from league_notifications where kind like 'claim_%'`))).map((r: Row) => r.kind), ['claim_lost'], 'owner-only notices');
      const runRow = await one(`select claims_won, claims_lost, claims_failed, claims_missed from claims_runs where league_id = $1 and run_date = $2::date`, [L, run]);
      assertEquals([runRow.claims_won, runRow.claims_lost, runRow.claims_failed, runRow.claims_missed], [2, 1, 0, 0]);
      // The claim FILL removed the winners' watched rows; the loser still watches the stock.
      const watched = await q(`select user_id, symbol from watchlist where league_id = $1 order by user_id, symbol`, [L]);
      assertEquals(watched.map((r: Row) => [r.user_id, r.symbol]), [[A, 'NVDA']], 'won: gone (B MSFT, C NVDA); lost: kept (A NVDA)');
      // A retry is a no-op.
      assertEquals(await commit(L, run, plan), { ok: false, reason: 'already_ran' });
      assertEquals((await state(L, run)).already_ran, true);
    });

    await t.step('THE ROLLING ORDER end to end (point 9): C (ahead) claims X and Y, B claims Y -> C gets X, B gets Y', async () => {
      await marketClosed();
      const run = await tomorrow();
      await q(`delete from claims where league_id = $1`, [LFULL]);
      assertEquals(await order(LFULL), [D, H, 'bot-1', C, B, A], 'C is ahead of B');
      assertEquals((await place(C, LFULL, 'XA')).ok, true); // X, placed first
      assertEquals((await place(C, LFULL, 'XB')).ok, true); // Y
      assertEquals((await place(B, LFULL, 'XB')).ok, true); // Y
      const plan = await makePlan(LFULL, run, { XA: 10, XB: 20 });
      assertEquals(await commit(LFULL, run, plan), { ok: true, won: 2, lost: 1, failed: 0, missed: 0 });
      const st = await q(`select user_id, symbol, status, outcome->>'winner_user_id' w from claims where league_id = $1 order by placed_at`, [LFULL]);
      assertEquals(st.map((r: Row) => [r.user_id, r.symbol, r.status, r.w]), [
        [C, 'XA', 'won', null], [C, 'XB', 'lost', B], [B, 'XB', 'won', null],
      ]);
      assertEquals(await order(LFULL), [D, H, 'bot-1', A, C, B], 'each winner to the back, in the order they won');
    });

    await t.step('fixed_notional: sale then buy, the buy funded by the sale it just inserted', async () => {
      await marketClosed();
      const run = await tomorrow();
      assertEquals((await place(B, L2, 'AAPL', 'BBB')).ok, true);
      const plan = await makePlan(L2, run, { AAPL: 200, BBB: 110 });
      assertEquals(plan.steps.map((s) => [s.action, s.funded_by]), [['sell', null], ['buy', 'ref:1']]);
      assertEquals((await commit(L2, run, plan)).ok, true);
      const [sell] = await q(`select id::text, total_value::float8 tv from trades where league_id = $1 and action = 'sell'`, [L2]);
      const [buy] = await q(`select funded_by_trade_id::text f, quantity::float8 qty from trades where league_id = $1 and action = 'buy'`, [L2]);
      assertEquals(sell.tv, 1100);
      assertEquals(buy.f, sell.id, 'funded_by re-mapped to the real sale id');
      assertEquals(buy.qty, 5.5);
    });

    await t.step('PARTIAL STATE: a commit refused at its second claim writes NOTHING; the re-plan commits whole', async () => {
      await q(`delete from claims_runs where league_id = $1`, [L]);
      await marketClosed();
      const run = await tomorrow();
      const tradesBefore = (await one(`select count(*)::int n from trades where league_id = $1`, [L])).n;
      const orderBefore = await order(L);
      assertEquals((await place(A, L, 'XA', 'AAA')).ok, true);
      assertEquals((await place(C, L, 'XB')).ok, true);
      const plan = await makePlan(L, run, { XA: 50, XB: 60, AAA: 99 });
      assertEquals(plan.steps.length, 3);
      // A live trade lands between the plan and the commit (the hold lifted): the LAST step's CAS
      // no longer matches. Simulated by making the last step's seen set stale.
      const stale = structuredClone(plan);
      stale.steps[2].seen_trade_ids = stale.steps[2].seen_trade_ids.slice(1);
      const res = await commit(L, run, stale);
      assertEquals([res.ok, res.reason, res.refusal, res.step], [false, 'step_refused', 'ledger_changed', 3]);
      assertEquals((await one(`select count(*)::int n from trades where league_id = $1`, [L])).n, tradesBefore, 'the first claim\'s sale and buy rolled back');
      assertEquals((await one(`select count(*)::int n from claims where league_id = $1 and status = 'pending'`, [L])).n, 2, 'every claim still pending');
      assertEquals((await one(`select count(*)::int n from claims_runs where league_id = $1`, [L])).n, 0, 'no run row');
      assertEquals((await one(`select count(*)::int n from league_notifications where league_id = $1 and detail->>'symbol' in ('XA', 'XB')`, [L])).n, 0, 'no notice');
      assertEquals(await order(L), orderBefore, 'the order did not move');
      // A cancel between plan and commit: claims_changed, nothing written.
      assertEquals((await cancel(C, L, 'XB')).cancelled, true);
      assertEquals((await commit(L, run, plan)).reason, 'claims_changed');
      // The re-plan on fresh reads commits whole.
      const fresh = await makePlan(L, run, { XA: 50, AAA: 99 });
      assertEquals(await commit(L, run, fresh), { ok: true, won: 1, lost: 0, failed: 0, missed: 0 });
      assertEquals((await one(`select count(*)::int n from trades where league_id = $1`, [L])).n, tradesBefore + 2);
    });

    await t.step('the commit refuses a changed order and bad plans; a missed day fails missed_run (plan.ts onMissedDay)', async () => {
      await q(`delete from claims_runs where league_id = $1`, [L]);
      await marketClosed();
      const run = await tomorrow();
      assertEquals((await place(C, L, 'XC')).ok, true);
      const plan = await makePlan(L, run, { XC: 70 });
      await q(`update waiver_order set position = position + 100 where league_id = $1`, [L]);
      await q(`update waiver_order set position = position - 100 where league_id = $1`, [L]);
      const swapped = structuredClone(plan);
      [swapped.order[0].user_id, swapped.order[1].user_id] = [swapped.order[1].user_id, swapped.order[0].user_id];
      assertEquals((await commit(L, run, swapped)).reason, 'order_changed');
      const bad = (mut: (p: CommitPlan) => void) => {
        const p = structuredClone(plan);
        mut(p);
        return commit(L, run, p);
      };
      assertEquals((await bad((p) => { p.outcomes = []; })).detail, 'outcomes');
      assertEquals((await bad((p) => { p.outcomes[0].status = 'lost'; p.outcomes[0].reason = 'waiver_order'; })).detail, 'steps_for_unwon');
      assertEquals((await bad((p) => { p.steps = []; })).detail, 'won_steps');
      assertEquals((await bad((p) => { p.outcomes[0].status = 'failed'; p.outcomes[0].reason = null; p.steps = []; })).detail, 'outcomes');
      assertEquals((await commit(L, run, null)).reason, 'bad_plan');
      // A step for a claim outside the plan (another league's, say) or with a non-positive number.
      const foreign = (await one(`select id::text from claims where league_id <> $1 limit 1`, [L])).id;
      assertEquals((await bad((p) => { p.steps.push({ ...p.steps[0], ref: 'ref:99', claim_id: foreign }); })).detail, 'step_shape');
      assertEquals((await bad((p) => { p.steps[0].quantity = 0; })).detail, 'step_shape');
      assertEquals((await bad((p) => { p.steps[0].price = -1; })).detail, 'step_shape');
      // A missed day: the claim is due BEFORE the run date. What happens to it is decided in ONE place
      // (plan.ts onMissedDay, today: failed missed_run); the commit writes what the plan says.
      await q(`update claims set run_date = run_date - 3 where league_id = $1 and status = 'pending'`, [L]);
      const missed = await makePlan(L, run, {});
      assertEquals(missed.outcomes.map((o) => o.reason), ['missed_run']);
      assertEquals(await commit(L, run, missed), { ok: true, won: 0, lost: 0, failed: 0, missed: 1 });
      assertEquals((await one(`select status, reason from claims where league_id = $1 and symbol = 'XC'`, [L])), { status: 'failed', reason: 'missed_run' });
    });

    await t.step('the hold: only while open < 10 min with claims due and no row; it lifts by itself', async () => {
      await marketClosed();
      assertEquals((await place(B, L2, 'XA')).ok, true);
      const today = await etToday();
      await q(`update claims set run_date = $2::date where league_id = $1 and status = 'pending'`, [L2, today]);
      const hold = (lg: string) => as('service_role', null, async () => (await one(`select public.claims_hold_active($1) h`, [lg])).h);
      assertEquals(await hold(L2), false, 'market closed');
      await marketOpen(3);
      assertEquals(await hold(L2), true, 'open 3 min ago, claim due, no row');
      assertEquals(await hold(L), false, 'a league with no claims due is never held');
      await q(`insert into claims_runs (league_id, run_date) values ($1, $2::date)`, [L2, today]);
      assertEquals(await hold(L2), false, 'the run committed');
      await q(`delete from claims_runs where league_id = $1 and run_date = $2::date`, [L2, today]);
      await marketOpen(11);
      // (When the ET day is under 11 minutes old the open clamps to midnight and the case is still past 10.)
      // The job is DEAD: claims still pending, no claims_runs row at all. The hold still lifts.
      assertEquals((await one(`select count(*)::int n from claims_runs where league_id = $1 and run_date = $2::date`, [L2, today])).n, 0, 'no row');
      assertEquals((await one(`select count(*)::int n from claims where league_id = $1 and status = 'pending'`, [L2])).n, 1, 'still pending');
      assertEquals(await hold(L2), false, 'lifts by itself at open + 10 minutes with NO row: a dead job never closes trading');
      // claims_run_day lists it while due.
      await marketOpen(3);
      const day = (await as('service_role', null, () => one(`select public.claims_run_day() d`))).d;
      assertEquals([day.open, day.session_date, day.due], [true, today, [L2]]);
      await q(`delete from claims where league_id = $1`, [L2]);
      await marketClosed();
      const closedDay = (await as('service_role', null, () => one(`select public.claims_run_day() d`))).d;
      assertEquals([closedDay.open, closedDay.due], [false, []]);
    });

    await t.step('the weekly reset: reverse standings after a fully scored week; idempotent; the seat follows a takeover', async () => {
      const r0 = (await as('service_role', null, () => one(`select public.reset_due_waiver_orders() r`))).r;
      assertEquals(r0, { reset: 0, failed: [] }, 'nothing scored yet');
      // Week 1 half scored: no reset.
      await q(`update matchups set team1_gain = 5, team2_gain = 1, winner_user_id = team1_user_id where league_id = $1 and week_number = 1 and team1_user_id = $2`, [L, A]);
      assertEquals((await as('service_role', null, () => one(`select public.reset_due_waiver_orders() r`))).r.reset, 0, 'a half-scored week is not scored');
      await q(`update matchups set team1_gain = 3, team2_gain = 2, winner_user_id = team1_user_id where league_id = $1 and week_number = 1 and team1_gain is null`, [L]);
      const r1 = (await as('service_role', null, () => one(`select public.reset_due_waiver_orders() r`))).r;
      assert(r1.reset >= 1 && r1.failed.length === 0, JSON.stringify(r1));
      const ranked = (await q(`select user_id from league_standings_ranked($1, 1) order by rank desc`, [L])).map((r: Row) => r.user_id);
      assertEquals(await order(L), ranked, 'last place first');
      assertEquals((await one(`select reset_through_week w from waiver_order_meta where league_id = $1`, [L])).w, 1);
      assertEquals((await as('service_role', null, () => one(`select public.reset_due_waiver_orders() r`))).r.reset, 0, 'idempotent');
      // A seat whose user_id changes (take_over_team re-points league_members first) keeps its place.
      const posC = (await one(`select position from waiver_order where league_id = $1 and user_id = $2`, [L, C])).position;
      const NEWC = '00000000-0000-4000-8000-0000000000c9';
      await q(`insert into auth.users (id, email) values ($1, 'c9@example.test')`, [NEWC]);
      await q(`alter table league_members disable trigger user`);
      await q(`update league_members set user_id = $2 where league_id = $1 and user_id = $3`, [L, NEWC, C]);
      await q(`alter table league_members enable trigger user`);
      assertEquals((await one(`select position from waiver_order where league_id = $1 and user_id = $2`, [L, NEWC])).position, posC);
      assertEquals((await one(`select count(*)::int n from claims where league_id = $1 and user_id = $2`, [L, NEWC])).n > 0, true, 'claims history follows the seat');
    });

    await t.step('the cron: every minute, vault key, 180 s timeout, gated on claims_run_day()', async () => {
      const job = await one(`select schedule, command from cron.job where jobname = 'claims_run'`);
      assertEquals(job.schedule, '* * * * *');
      assert(job.command.includes(`name = 'cron_apikey'`));
      assert(job.command.includes('timeout_milliseconds := 180000'));
      assert(job.command.includes('public.claims_run_day()'));
      assert(job.command.includes('/functions/v1/claims-run'));
      assert(!/sb_secret_|eyJ[A-Za-z0-9_-]{10,}/.test(job.command), 'no key literal');
    });

    await t.step('the post-push checks SQL reads as documented and its effect block says PASS (rolled back)', async () => {
      const sql = await Deno.readTextFile(CHECKS_URL);
      const effect = sql.slice(sql.indexOf('-- EFFECT BLOCK'));
      const before = (await one(`select count(*)::int n from claims`)).n;
      const r = await refusal(() => db.exec(effect));
      assert(r.message.startsWith('PASS'), r.message);
      assertEquals((await one(`select count(*)::int n from claims`)).n, before, 'rolled back');
    });
  },
});
