/**
 * A stock you own is never on your watchlist (20261210500000; docs/plans/2026-11-18-stocks-tab.md,
 * "Settled during the build", point 6; Giorgio's "A", 2026-11-23), on the WHOLE migration chain
 * (full_chain.ts), so every live trigger on drafts and trades (the queue prune, the SKIP refusal,
 * the freeze guards) and the real record_trade function run alongside the change.
 *
 * What it proves, each path EXERCISED (a migration applying says nothing about its bodies):
 *   - grants by proacl for all six touched functions; DEFINER/INVOKER and search_path as designed;
 *     the removal trigger's lock_timeout; both triggers AFTER INSERT OR UPDATE OF the owner columns;
 *   - "holds" is ONE rule: league_held_positions agrees with the Stocks list
 *     (get_league_available_stocks, 20261207000100) and with the buy path's leagueOwnedSymbols
 *     (_shared/draft-validation.ts) on the same rows, including a bought-then-fully-sold stock;
 *   - the migration's cleanup deletes exactly the saved-AND-held rows, and the preflight SQL
 *     (docs/security/2026-11-23-watchlist-held-preflight.sql) counted exactly those beforehand and
 *     counts 0 after; a fully sold stock's saved row and another manager's copy are kept;
 *   - a save of a held stock is refused by set_watchlist ('held') AND by a direct insert (PT409),
 *     as the member and on the owner path; it bumps no pacing counter;
 *   - a buy (record_trade) removes the row; a draft pick (manual, auto_queue, auto_best) removes it;
 *     a bot pick of the same stock leaves a human's saved copy alone; another manager's copy of a
 *     bought stock is untouched; an UPDATE that moves a holding (takeover) removes the new holder's;
 *   - a SALE removes a crossed (stranded) row; a partial sale that still holds keeps it out; after a
 *     full sale the stock can be saved again (A, not B);
 *   - the reader omits a held stock; the 50 cap does not count a held (stranded) row;
 *   - STALE, the post-sale invariant (Copilot on #606): a row saved before a FULL sale whose delete was
 *     skipped is never shown, is cleared by the next set_watchlist and by the migration's cleanup;
 *     a fresh save after a sale IS shown; another manager's trade or pick never makes my row stale;
 *     a pick alone makes a row stale; a NULL clock and an exact tie never do (strict >);
 *   - a trade and a pick still succeed with nothing to remove, and when the removal itself FAILS
 *     (a test-only trigger makes the delete raise): the row stays, the reader hides it;
 *   - a pending claim (a stand-in claims table: claims are not built yet) does not make a stock held;
 *   - docs/security/2026-11-23-watchlist-held-checks.sql reads as documented and its effect block
 *     says PASS, rolling back.
 *
 * NOT covered (PGlite has one connection): a real second transaction holding the watchlist row's
 * lock. The trigger's FOR UPDATE SKIP LOCKED and lock_timeout are pinned in the source here; the
 * catch-all that makes any failure harmless is exercised behaviourally (the failing-delete steps).
 *
 * Run: deno test --allow-read --allow-env supabase/tests/watchlist_held_leaves.pglite.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { PGlite } from 'npm:@electric-sql/pglite@0.2';
import { applyFrom, loadChain } from './full_chain.ts';
import { leagueOwnedSymbols } from '../functions/_shared/draft-validation.ts';

const VERSION = '20261210500000';
const PREFLIGHT_URL = new URL('../../docs/security/2026-11-23-watchlist-held-preflight.sql', import.meta.url);
const CHECKS_URL = new URL('../../docs/security/2026-11-23-watchlist-held-checks.sql', import.meta.url);

const A = '00000000-0000-4000-8000-0000000000a1'; // commissioner of L
const B = '00000000-0000-4000-8000-0000000000a2'; // member of L
const BOT = 'bot-1';
const L = '00000000-0000-4000-8000-00000000d001';

// deno-lint-ignore no-explicit-any
type Row = any;

const NAMED = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG', 'HHH', 'III', 'JJJ', 'KKK', 'LLL', 'MMM', 'NNN',
  'OOO', 'PPP', 'QQQ', 'RRR', 'SSS', 'TTT', 'UUU', 'VVV', 'WWW', 'XXX', 'YYY', 'ZZZ', 'ZZA'];
const PLAIN = Array.from({ length: 55 }, (_, i) => `P${String(i + 1).padStart(2, '0')}`);

/** Split a checks/preflight file into its statements (top-level ';' at a line end; a DO block is one). */
function statements(sql: string): string[] {
  const noComments = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  const out: string[] = [];
  let buf = '';
  let inDo = false;
  for (const line of noComments.split('\n')) {
    buf += line + '\n';
    if (/^\s*do \$\$/i.test(line)) inDo = true;
    if (inDo ? /^end \$\$;\s*$/i.test(line) : /;\s*$/.test(line)) {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      inDo = false;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

Deno.test({
  name: 'watchlist: a stock you own leaves your watchlist (full chain)',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const db = new PGlite();
    const q = async (s: string, p: unknown[] = []) => (await db.query<Row>(s, p)).rows;
    const one = async (s: string, p: unknown[] = []) => (await q(s, p))[0];
    async function as<T>(role: 'authenticated' | 'service_role', sub: string | null, fn: () => Promise<T>): Promise<T> {
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
    const clearCounters = () => q(`delete from rate_limit_counters where bucket like 'watchlist-save-%' or bucket like 'stocks-list-%'`);
    const save = async (sub: string, sym: string, saved = true) => {
      await clearCounters();
      return await as('authenticated', sub, async () => (await one(`select public.set_watchlist($1, $2, $3) r`, [L, sym, saved])).r);
    };
    const read = async (sub: string) =>
      (await as('authenticated', sub, () => q(`select symbol from public.get_league_watchlist($1)`, [L]))).map((r: Row) => r.symbol).sort();
    const rows = async (user: string) =>
      (await q(`select symbol from public.watchlist where league_id = $1 and user_id = $2 order by symbol`, [L, user]))
        .map((r: Row) => r.symbol);
    /** A row that a save and a buy left behind when they crossed: written with triggers off. */
    const strand = async (user: string, sym: string) => {
      const [{ n }] = await q(`select min(g)::int n from generate_series(1, 50) g
                                where not exists (select 1 from public.watchlist w
                                                   where w.league_id = $1 and w.user_id = $2 and w.cap_index = g)`, [L, user]);
      assert(n !== null, 'a free place to strand into');
      await db.exec(`set session_replication_role = replica`);
      try {
        await q(`insert into public.watchlist (league_id, user_id, symbol, cap_index) values ($1, $2, $3, $4)`, [L, user, sym, n]);
      } finally {
        await db.exec(`set session_replication_role = origin`);
      }
    };
    const ledger = async () => ({
      trades: (await q(`select id::text id from trades where league_id = $1`, [L])).map((r: Row) => r.id),
      drafts: (await q(`select id::text id from drafts where league_id = $1`, [L])).map((r: Row) => r.id),
    });
    /** A trade through the REAL function, as the edge function calls it (service role, exact CAS). */
    const trade = async (user: string, sym: string, action: 'buy' | 'sell', qty: number) => {
      const s = await ledger();
      return await as('service_role', null, async () =>
        (await one(`select public."record_trade_atomic"($1,$2,$3,$4,$5,10,$6,null,$7::uuid[],$8::text[],null,null,null) r`,
          [L, user, sym, action, qty, qty * 10, s.trades, s.drafts])).r);
    };
    let pickNo = 0;
    /** A pick as the edge functions write it (service role). */
    const pick = (user: string, sym: string, source: string, qty = 1) =>
      as('service_role', null, () => q(`insert into drafts (league_id, user_id, symbol, entry_price, quantity, round, pick_number, pick_source)
                                         values ($1, $2, $3, 10, $4, 1, $5, $6)`, [L, user, sym, qty, ++pickNo, source]));

    await loadChain(db, { untilBefore: VERSION });

    // ---- fixture, as the owner --------------------------------------------------------------
    for (const u of [A, B]) await q(`insert into auth.users (id, email) values ($1, $2)`, [u, `${u.slice(-2)}@example.test`]);
    for (const [i, s] of [...NAMED, ...PLAIN].entries()) {
      await q(`insert into public.symbols (symbol, name, is_draftable, last_price, last_price_at, gics_industry, market_cap)
               values ($1, $2, true, 10, now(), 'ZZ Technology', $3)`, [s, `${s} Inc.`, 1e12 - i * 1e9]);
    }
    await q(`insert into leagues (id, name, commissioner_id, invite_code, num_participants, league_type, num_weeks, playoff_teams)
             values ($1, 'League', $2, 'HELDL001', 8, 'matchup', 4, 2)`, [L, A]);
    await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner'), ($1, $3, 'member'), ($1, $4, 'member')`,
      [L, A, B, BOT]);

    // The state before the migration (the watchlist as live today accepts a save of a held stock):
    //   A drafted AAA and saved it                  -> saved AND held: the cleanup deletes it
    //   A drafted BBB, sold it all, and saved it    -> not held: kept
    //   B saved AAA (B holds none)                  -> another manager's copy: kept
    //   B drafted CCC and saved it                  -> saved AND held: deleted
    await pick(A, 'AAA', 'manual', 2);
    await pick(A, 'BBB', 'manual', 1);
    await pick(B, 'CCC', 'manual', 3);
    await q(`update leagues set draft_status = 'completed' where id = $1`, [L]);
    assertEquals((await trade(A, 'BBB', 'sell', 1)).ok, true, 'the pre-migration sale');
    for (const [u, s] of [[A, 'AAA'], [A, 'BBB'], [B, 'AAA'], [B, 'CCC']]) assertEquals((await save(u, s)).ok, true, `${u} ${s}`);
    //   B saved P54, then bought it and sold it all -> not held, but STALE: the cleanup deletes it
    //   (dated a minute back so the order never rests on a millisecond clock).
    assertEquals((await save(B, 'P54')).ok, true);
    await q(`update public.watchlist set created_at = created_at - interval '1 minute' where user_id = $1 and symbol = 'P54'`, [B]);
    assertEquals((await trade(B, 'P54', 'buy', 1)).ok, true);
    assertEquals((await trade(B, 'P54', 'sell', 1)).ok, true);

    const preflight = statements(await Deno.readTextFile(PREFLIGHT_URL));
    assertEquals(preflight.length, 3, 'the preflight is three statements');
    const [clocks] = await q(preflight[2]);
    assertEquals([Number(clocks.future_trades), Number(clocks.future_picks)], [0, 0], 'no future-dated pick or trade');
    const [{ saved_and_held_or_stale: before }] = await q(preflight[0]);
    assertEquals(Number(before), 3, 'the preflight counts the two saved-and-held rows and the stale one');
    const listed = (await q(preflight[1])).map((r: Row) => `${r.user_id}:${r.symbol}:${r.held}:${r.stale}`);
    assertEquals(listed, [`${A}:AAA:true:false`, `${B}:CCC:true:false`, `${B}:P54:false:true`]);

    const applied = await applyFrom(db, VERSION);
    assert(applied.includes(`${VERSION}_watchlist_held_leaves.sql`), 'the migration under test applied');

    await t.step('the cleanup deleted exactly what the preflight counted', async () => {
      assertEquals(await rows(A), ['BBB'], 'A: held AAA gone, fully sold BBB kept');
      assertEquals(await rows(B), ['AAA'], 'B: held CCC and stale P54 gone, its copy of AAA (held by A) kept');
      const [{ saved_and_held_or_stale: after }] = await q(preflight[0]);
      assertEquals(Number(after), 0, 'the preflight counts 0 after the push');
    });

    await t.step('grants: proacl, DEFINER/INVOKER, search_path, lock_timeout; triggers', async () => {
      const fns = await q(`select proname, prosecdef, proconfig::text cfg, proacl::text acl
                             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'public'
                              and proname in ('get_league_watchlist', 'set_watchlist', 'watchlist_before_insert',
                                              'league_held_positions', 'watchlist_leaves_on_holding', 'watchlist_row_stale')
                            order by proname`);
      assertEquals(fns.map((r: Row) => [r.proname, r.prosecdef, r.cfg, r.acl]), [
        ['get_league_watchlist', true, '{"search_path=public, pg_temp"}', '{postgres=X/postgres,authenticated=X/postgres}'],
        ['league_held_positions', false, '{"search_path=public, pg_temp"}', '{postgres=X/postgres}'],
        ['set_watchlist', true, '{"search_path=public, pg_temp"}', '{postgres=X/postgres,authenticated=X/postgres}'],
        ['watchlist_before_insert', true, '{"search_path=public, pg_temp"}', '{postgres=X/postgres}'],
        ['watchlist_leaves_on_holding', true, '{"search_path=public, pg_temp",lock_timeout=2s}', '{postgres=X/postgres}'],
        ['watchlist_row_stale', false, '{"search_path=public, pg_temp"}', '{postgres=X/postgres}'],
      ]);
      const [ov] = await q(`select count(*)::int n from pg_proc where proname in ('get_league_watchlist', 'set_watchlist',
                              'watchlist_before_insert', 'league_held_positions', 'watchlist_leaves_on_holding', 'watchlist_row_stale')`);
      assertEquals(ov.n, 6, 'one overload each');
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const [r] = await q(`select has_function_privilege($1, 'public.league_held_positions(uuid, text)', 'EXECUTE') h,
                                    has_function_privilege($1, 'public.watchlist_leaves_on_holding()', 'EXECUTE') t,
                                    has_function_privilege($1, 'public.watchlist_row_stale(uuid, text, text, timestamptz)', 'EXECUTE') s`, [role]);
        assertEquals([r.h, r.t, r.s], [false, false, false], `${role} executes no helper`);
      }
      const trg = await q(`select tgrelid::regclass::text rel, tgname, tgenabled, pg_get_triggerdef(oid) def from pg_trigger
                            where tgname in ('trg_drafts_watchlist_leaves', 'trg_trades_watchlist_leaves') order by tgname`);
      assertEquals(trg.map((r: Row) => [r.rel, r.tgname, r.tgenabled]), [
        ['drafts', 'trg_drafts_watchlist_leaves', 'O'],
        ['trades', 'trg_trades_watchlist_leaves', 'O'],
      ]);
      for (const r of trg) {
        assert(/AFTER INSERT OR UPDATE OF league_id, user_id, symbol ON public\.\w+ FOR EACH ROW EXECUTE FUNCTION watchlist_leaves_on_holding\(\)/
          .test(r.def), r.def);
      }
      const [src] = await q(`select prosrc from pg_proc where proname = 'watchlist_leaves_on_holding'`);
      assert(/for update skip locked/i.test(src.prosrc), 'the removal never waits on a row lock');
      assert(/exception when others then/i.test(src.prosrc) && !/\braise exception\b/i.test(src.prosrc), 'the removal never raises');
      const [sw] = await q(`select prosrc from pg_proc where proname = 'set_watchlist'`);
      assert(/for update skip locked/i.test(sw.prosrc), 'the write\'s held-row cleanup never waits on a row lock under the seat lock');
      const [held] = await q(`select prosrc from pg_proc where proname = 'league_held_positions'`);
      const tables = [...held.prosrc.matchAll(/from public\.(\w+)/g)].map((m: RegExpMatchArray) => m[1]).sort();
      assertEquals(tables, ['drafts', 'trades'], 'holdings are drafts and trades only: a pending claim is not one');
    });

    await t.step('"holds" is one rule: the Stocks list and leagueOwnedSymbols agree with the helper', async () => {
      // A buys DDD then sells it all (not held); B buys EEE twice and sells part (held).
      assertEquals((await trade(A, 'DDD', 'buy', 2)).ok, true);
      assertEquals((await trade(A, 'DDD', 'sell', 2)).ok, true);
      assertEquals((await trade(B, 'EEE', 'buy', 2)).ok, true);
      assertEquals((await trade(B, 'EEE', 'sell', 1)).ok, true);
      const helper = (await q(`select distinct symbol from public.league_held_positions($1) order by symbol`, [L]))
        .map((r: Row) => r.symbol);
      assertEquals(helper, ['AAA', 'CCC', 'EEE']);
      const picks = await q(`select symbol, user_id, quantity, pick_source from drafts where league_id = $1`, [L]);
      const trades = await q(`select symbol, user_id::text user_id, action, quantity from trades where league_id = $1`, [L]);
      assertEquals([...leagueOwnedSymbols(picks, trades)].sort(), helper, 'the buy path agrees');
      const listed: string[] = [];
      let after: string | null = null;
      for (;;) {
        await clearCounters();
        const page: Row[] = await as('authenticated', A, () =>
          q(`select * from public.get_league_available_stocks($1, null, $2, 25)`, [L, after]));
        listed.push(...page.map((r: Row) => r.symbol));
        if (!page.length || !page[0].has_more) break;
        after = page[page.length - 1].symbol;
      }
      const all = [...NAMED, ...PLAIN];
      assertEquals(all.filter((s) => !listed.includes(s)).sort(), helper, 'the Stocks list leaves out exactly the held stocks');
      assertEquals(await q(`select symbol from public.league_held_positions($1, $2) order by symbol`, [L, A]).then((r) => r.map((x: Row) => x.symbol)),
        ['AAA'], 'the manager filter is the same rule for one manager');
    });

    await t.step('a save of a held stock is refused: by the write, by a direct insert, on the owner path', async () => {
      assertEquals(await save(A, 'AAA'), { ok: false, reason: 'held' });
      assertEquals(await save(A, ' aaa '), { ok: false, reason: 'held' }, 'case-folded');
      assertEquals(await save(B, 'EEE'), { ok: false, reason: 'held' }, 'a partial sale still holds');
      const [{ n: bumps }] = await q(`select count(*)::int n from rate_limit_counters where bucket like 'watchlist-save-%'`);
      assertEquals(bumps, 0, 'a held refusal bumps no pacing counter');
      await clearCounters();
      const direct = await refusal(() => as('authenticated', A, () =>
        q(`insert into public.watchlist (league_id, user_id, symbol) values ($1, $2, 'AAA')`, [L, A])));
      assertEquals(direct.code, 'PT409');
      assert(direct.message.startsWith('watchlist_held'), direct.message);
      const owner = await refusal(() => q(`insert into public.watchlist (league_id, user_id, symbol) values ($1, $2, 'CCC')`, [L, B]));
      assertEquals(owner.code, 'PT409', 'the service / owner path too');
      assertEquals(await rows(A), ['BBB']);
      // A stock someone ELSE holds can still be watched ("Owned by {name}").
      assertEquals((await save(A, 'CCC')).ok, true);
      assertEquals((await save(A, 'CCC', false)).ok, true);
      // Bought and fully sold: an ordinary free stock again.
      assertEquals((await save(A, 'DDD')).ok, true);
      assertEquals((await save(A, 'DDD', false)).ok, true);
    });

    await t.step('a buy removes the row; another manager\'s copy is untouched', async () => {
      assertEquals((await save(A, 'FFF')).ok, true);
      assertEquals((await save(B, 'FFF')).ok, true);
      const r = await trade(A, 'FFF', 'buy', 1);
      assertEquals(r.ok, true, JSON.stringify(r));
      assertEquals(await rows(A), ['BBB']);
      assertEquals(await rows(B), ['AAA', 'FFF']);
      assertEquals(await read(B), ['AAA', 'FFF']);
      assertEquals((await save(B, 'FFF', false)).ok, true);
    });

    await t.step('a draft pick removes the row: manual, auto_queue, auto_best; a bot pick leaves a human\'s copy', async () => {
      await q(`update leagues set draft_status = 'in_progress' where id = $1`, [L]);
      for (const s of ['GGG', 'HHH', 'III', 'JJJ']) assertEquals((await save(A, s)).ok, true);
      await pick(A, 'GGG', 'manual');
      await pick(A, 'HHH', 'auto_queue');
      await pick(A, 'III', 'auto_best');
      await pick(BOT, 'JJJ', 'bot');
      assertEquals(await rows(A), ['BBB', 'JJJ'], 'each of A\'s own picks left; the bot\'s pick did not touch A');
      assertEquals(await read(A), ['BBB', 'JJJ']);
      await q(`update leagues set draft_status = 'completed' where id = $1`, [L]);
      assertEquals((await save(A, 'JJJ', false)).ok, true);
    });

    await t.step('a SALE removes a crossed row; a partial sale keeps it out; after a full sale it is saveable again', async () => {
      // A holds KKK x2 and a save crossed the buy: the row is stranded.
      assertEquals((await trade(A, 'KKK', 'buy', 2)).ok, true);
      await strand(A, 'KKK');
      assertEquals(await rows(A), ['BBB', 'KKK'], 'stranded');
      assertEquals(await read(A), ['BBB'], 'the reader never shows a held stock');
      assertEquals((await trade(A, 'KKK', 'sell', 1)).ok, true, 'a partial sale');
      assertEquals(await rows(A), ['BBB'], 'the sale removed it');
      assertEquals(await save(A, 'KKK'), { ok: false, reason: 'held' }, 'still held after the partial sale: still out');
      assertEquals((await trade(A, 'KKK', 'sell', 1)).ok, true, 'the rest');
      assertEquals(await rows(A), ['BBB'], 'A: it does not come back after the sale (not B)');
      assertEquals((await save(A, 'KKK')).ok, true, 'an ordinary free stock: star it again to watch it again');
      assertEquals((await save(A, 'KKK', false)).ok, true);
    });

    await t.step('the 50 cap does not count a held (stranded) row', async () => {
      assertEquals((await trade(A, 'LLL', 'buy', 1)).ok, true);
      for (const s of PLAIN.slice(0, 48)) assertEquals((await save(A, s)).ok, true, s);
      await strand(A, 'LLL');
      assertEquals((await one(`select count(*)::int n from public.watchlist where league_id = $1 and user_id = $2`, [L, A])).n, 50,
        '50 rows, one of them held');
      const r = await save(A, PLAIN[48]);
      assertEquals(r, { ok: true, saved: true, count: 50 }, 'the held row was cleared before counting');
      assertEquals((await rows(A)).includes('LLL'), false);
      assertEquals(await save(A, PLAIN[49]), { ok: false, reason: 'watchlist_full', max: 50 }, 'the cap still holds at 50 visible');
      // An unsave answers the visible count too.
      assertEquals(await save(A, PLAIN[48], false), { ok: true, saved: false, count: 49 });
      await strand(A, 'LLL');
      assertEquals(await save(A, PLAIN[47], false), { ok: true, saved: false, count: 48 }, 'the held row is not counted');
      assertEquals((await rows(A)).includes('LLL'), false);
      for (const s of PLAIN.slice(0, 48)) await save(A, s, false);
      assertEquals(await rows(A), ['BBB']);
    });

    await t.step('a trade and a pick succeed with nothing to remove', async () => {
      const before = await q(`select * from public.watchlist order by league_id, user_id, symbol`);
      const r = await trade(B, 'MMM', 'buy', 1);
      assertEquals(r.ok, true, JSON.stringify(r));
      await q(`update leagues set draft_status = 'in_progress' where id = $1`, [L]);
      await pick(B, 'NNN', 'manual');
      await q(`update leagues set draft_status = 'completed' where id = $1`, [L]);
      assertEquals((await one(`select count(*)::int n from drafts where league_id = $1 and symbol = 'NNN'`, [L])).n, 1);
      assertEquals(await q(`select * from public.watchlist order by league_id, user_id, symbol`), before, 'nothing else touched');
    });

    await t.step('a trade and a pick succeed when the removal itself FAILS; the row stays and is hidden', async () => {
      for (const s of ['OOO', 'PPP']) assertEquals((await save(A, s)).ok, true);
      await db.exec(`create function public.test_watchlist_delete_fails() returns trigger language plpgsql as
                       $$ begin raise exception 'test: the watchlist delete fails'; end $$;
                     create trigger test_watchlist_delete_fails before delete on public.watchlist
                       for each row execute function public.test_watchlist_delete_fails();`);
      try {
        const r = await trade(A, 'OOO', 'buy', 1);
        assertEquals(r.ok, true, `the trade went through: ${JSON.stringify(r)}`);
        assertEquals((await one(`select count(*)::int n from trades where league_id = $1 and symbol = 'OOO'`, [L])).n, 1);
        await q(`update leagues set draft_status = 'in_progress' where id = $1`, [L]);
        await pick(A, 'PPP', 'auto_best');
        await q(`update leagues set draft_status = 'completed' where id = $1`, [L]);
        assertEquals((await one(`select count(*)::int n from drafts where league_id = $1 and symbol = 'PPP'`, [L])).n, 1,
          'the pick went through');
        assertEquals(await rows(A), ['BBB', 'OOO', 'PPP'], 'the rows stayed');
        assertEquals(await read(A), ['BBB'], 'and the reader hides them while held');
      } finally {
        await db.exec(`drop trigger test_watchlist_delete_fails on public.watchlist; drop function public.test_watchlist_delete_fails();`);
      }
      // The next save clears them.
      assertEquals((await save(A, 'QQQ')).count, 2, 'BBB + QQQ: the stranded held rows were cleared');
      assertEquals(await rows(A), ['BBB', 'QQQ']);
      assertEquals((await save(A, 'QQQ', false)).ok, true);
    });

    await t.step('a pending claim does not make a stock held', async () => {
      // The REAL claims table since 20261211000000 (claims, workstream 6): a pending claim, written
      // through its trigger as the owner.
      try {
        await q(`insert into public.claims (league_id, user_id, symbol, funded_by, run_date) values ($1, $2, 'RRR', 'cash', current_date + 1)`, [L, A]);
        assertEquals((await save(A, 'RRR')).ok, true, 'a claimed stock can be watched');
        assertEquals(await read(A), ['BBB', 'RRR'], 'and stays in Watching until the claim fills');
        // The claim fills: the claims run writes the fill as a trade, which removes it.
        assertEquals((await trade(A, 'RRR', 'buy', 1)).ok, true);
        assertEquals(await read(A), ['BBB']);
      } finally {
        await q(`delete from public.claims where league_id = $1 and symbol = 'RRR'`, [L]);
      }
    });

    await t.step('an UPDATE that moves a holding (a takeover) removes the new holder\'s row', async () => {
      assertEquals((await save(B, 'SSS')).ok, true);
      await q(`update leagues set draft_status = 'in_progress' where id = $1`, [L]);
      await pick(A, 'SSS', 'manual');
      await q(`update leagues set draft_status = 'completed' where id = $1`, [L]);
      assertEquals(await rows(B), ['AAA', 'SSS']);
      await q(`update drafts set user_id = $2 where league_id = $1 and symbol = 'SSS'`, [L, B]);
      assertEquals(await rows(B), ['AAA']);
    });

    await t.step('STALE: a full sale whose delete was skipped leaves a row that is never shown, then cleared', async () => {
      // A crossing: A's save of UUU was dated before A's buy (the buy's delete never saw it).
      assertEquals((await trade(A, 'UUU', 'buy', 1)).ok, true);
      await strand(A, 'UUU');
      await q(`update public.watchlist set created_at = created_at - interval '1 hour' where user_id = $1 and symbol = 'UUU'`, [A]);
      // The FULL sale, with its delete skipped (as when another transaction held the row's lock
      // and rolled back, or the caught-error path kept it).
      await db.exec(`alter table public.trades disable trigger trg_trades_watchlist_leaves`);
      try {
        assertEquals((await trade(A, 'UUU', 'sell', 1)).ok, true);
      } finally {
        await db.exec(`alter table public.trades enable trigger trg_trades_watchlist_leaves`);
      }
      assertEquals((await rows(A)).includes('UUU'), true, 'the row survived the sale');
      assertEquals((await q(`select symbol from public.league_held_positions($1, $2)`, [L, A])).map((r: Row) => r.symbol)
        .includes('UUU'), false, 'and UUU is no longer held');
      assertEquals((await read(A)).includes('UUU'), false, 'the reader still never shows it (not B)');
      // Any write of A's clears it, and its count never included it.
      const r = await save(A, 'VVV', false);
      assertEquals(r, { ok: true, saved: false, count: (await rows(A)).filter((s) => s !== 'UUU').length });
      assertEquals((await rows(A)).includes('UUU'), false, 'cleared by the next set_watchlist');
      // After the sale it is an ordinary free stock: a fresh save is shown.
      assertEquals((await save(A, 'UUU')).ok, true);
      assertEquals((await read(A)).includes('UUU'), true, 'a fresh save after the sale is shown');
      assertEquals((await save(A, 'UUU', false)).ok, true);
      // Stale is per manager: B buying a stock A saved never hides A's row.
      assertEquals((await save(A, 'WWW')).ok, true);
      assertEquals((await trade(B, 'WWW', 'buy', 1)).ok, true);
      assertEquals((await read(A)).includes('WWW'), true, 'A watches a stock B owns');
      assertEquals((await save(A, 'WWW', false)).ok, true);
    });

    await t.step('STALE edges: a pick alone, a NULL clock, an exact tie, another manager\'s pick', async () => {
      /** Rows written with every trigger off, so only the stale rule is in play. */
      const raw = async (sql: string, p: unknown[]) => {
        await db.exec(`set session_replication_role = replica`);
        try {
          await q(sql, p);
        } finally {
          await db.exec(`set session_replication_role = origin`);
        }
      };
      const savedAt = async (sym: string) =>
        (await one(`select created_at::text t from public.watchlist where league_id = $1 and user_id = $2 and symbol = $3`, [L, A, sym])).t;
      for (const s of ['XXX', 'YYY', 'ZZZ', 'ZZA']) assertEquals((await save(A, s)).ok, true);
      await q(`update public.watchlist set created_at = created_at - interval '1 hour' where user_id = $1 and symbol in ('XXX', 'YYY', 'ZZZ', 'ZZA')`, [A]);
      // XXX: a sale dated BEFORE the save and a pick AFTER it (net 0, not held): stale by the pick alone.
      await raw(`insert into trades (league_id, user_id, symbol, action, quantity, price, total_value, created_at)
                 values ($1, $2, 'XXX', 'sell', 1, 10, 10, now() - interval '2 hours')`, [L, A]);
      await raw(`insert into drafts (league_id, user_id, symbol, entry_price, quantity, round, pick_number, pick_source)
                 values ($1, $2, 'XXX', 10, 1, 1, 900, 'manual')`, [L, A]);
      // YYY: a buy and a sale with NULL clocks: unknown is not "after", so the row stays shown.
      await raw(`insert into trades (league_id, user_id, symbol, action, quantity, price, total_value, created_at)
                 values ($1, $2, 'YYY', 'buy', 1, 10, 10, null), ($1, $2, 'YYY', 'sell', 1, 10, 10, null)`, [L, A]);
      // ZZZ: a buy and a sale stamped EXACTLY at the save: a tie is not "after" (strict >).
      const t0 = await savedAt('ZZZ');
      await raw(`insert into trades (league_id, user_id, symbol, action, quantity, price, total_value, created_at)
                 values ($1, $2, 'ZZZ', 'buy', 1, 10, 10, $3::timestamptz), ($1, $2, 'ZZZ', 'sell', 1, 10, 10, $3::timestamptz)`, [L, A, t0]);
      // ZZA: another manager picks it after A saved it: A's row is untouched by the stale rule.
      await raw(`insert into drafts (league_id, user_id, symbol, entry_price, quantity, round, pick_number, pick_source)
                 values ($1, $2, 'ZZA', 10, 1, 1, 901, 'manual')`, [L, B]);
      const shown = await read(A);
      assertEquals(['XXX', 'YYY', 'ZZZ', 'ZZA'].filter((s) => shown.includes(s)), ['YYY', 'ZZZ', 'ZZA']);
      // One microsecond later than the save IS after.
      await raw(`update trades set created_at = $3::timestamptz + interval '1 microsecond'
                  where league_id = $1 and user_id = $2 and symbol = 'ZZZ'`, [L, A, t0]);
      assertEquals((await read(A)).includes('ZZZ'), false);
      // A stale row never counts toward the cap: the write clears both and answers the rest.
      const before = (await rows(A)).length;
      const r = await save(A, 'VVV', false);
      assertEquals(r, { ok: true, saved: false, count: before - 2 }, 'XXX and ZZZ cleared before counting');
      for (const s of ['YYY', 'ZZA']) assertEquals((await save(A, s, false)).ok, true);
    });

    await t.step('edges: another league, a trades UPDATE, a lower-case pick, a legacy SKIP row, a re-run', async () => {
      // A trade in ANOTHER league never touches this league's row.
      const L2 = '00000000-0000-4000-8000-00000000d002';
      await q(`insert into leagues (id, name, commissioner_id, invite_code, num_participants, league_type, num_weeks, playoff_teams)
               values ($1, 'League 2', $2, 'HELDL002', 8, 'matchup', 4, 2)`, [L2, A]);
      await q(`insert into league_members (league_id, user_id, role) values ($1, $2, 'commissioner')`, [L2, A]);
      assertEquals((await save(A, 'TTT')).ok, true);
      await q(`insert into trades (league_id, user_id, symbol, action, quantity, price, total_value)
               values ($1, $2, 'TTT', 'buy', 1, 10, 10)`, [L2, A]);
      assertEquals((await rows(A)).includes('TTT'), true, 'a buy in L2 leaves the L row');
      // A trades UPDATE that moves a holding (take_over_team moves trades.user_id too).
      await q(`update trades set user_id = $2 where league_id = $1 and symbol = 'TTT'`, [L2, B]);
      await q(`update trades set league_id = $1 where league_id = $2 and symbol = 'TTT'`, [L, L2]);
      assertEquals((await rows(A)).includes('TTT'), true, 'moved to B in L: A\'s row stays');
      await q(`update trades set user_id = $2 where league_id = $1 and symbol = 'TTT'`, [L, A]);
      assertEquals((await rows(A)).includes('TTT'), false, 'moved to A in L: A\'s row leaves');
      // A lower-case pick still removes the (upper-case) saved row.
      assertEquals((await save(B, 'P55')).ok, true);
      await q(`update leagues set draft_status = 'in_progress' where id = $1`, [L]);
      await pick(B, 'p55', 'manual');
      await q(`update leagues set draft_status = 'completed' where id = $1`, [L]);
      assertEquals((await rows(B)).includes('P55'), false);
      assertEquals(await save(B, 'P55'), { ok: false, reason: 'held' }, 'and it counts as held');
      // A legacy SKIP row (pre-20261106; new ones are refused) is not a holding.
      await db.exec(`set session_replication_role = replica`);
      try {
        await q(`insert into drafts (league_id, user_id, symbol, entry_price, quantity, round, pick_number, pick_source)
                 values ($1, $2, 'SKIP', 0, 0, 1, 999, 'skip')`, [L, A]);
      } finally {
        await db.exec(`set session_replication_role = origin`);
      }
      const heldA = (await q(`select symbol from public.league_held_positions($1, $2)`, [L, A])).map((r: Row) => r.symbol);
      assert(!heldA.includes('SKIP'), heldA.join(','));
      // The migration re-runs cleanly and changes nothing.
      const snap = async () => ({
        wl: await q(`select * from public.watchlist order by league_id, user_id, symbol`),
        acl: await q(`select proname, proacl::text from pg_proc where proname in ('get_league_watchlist', 'set_watchlist',
                       'watchlist_before_insert', 'league_held_positions', 'watchlist_leaves_on_holding', 'watchlist_row_stale') order by proname`),
        trg: await q(`select tgname from pg_trigger where tgname like 'trg_%watchlist%' order by tgname`),
      });
      const before = await snap();
      await db.exec(await Deno.readTextFile(new URL(`../migrations/${VERSION}_watchlist_held_leaves.sql`, import.meta.url)));
      assertEquals(await snap(), before, 'a second run is a no-op');
      const [{ lt }] = await q(`select current_setting('lock_timeout') lt`);
      assertEquals(lt, '0', 'the file resets its lock_timeout');
    });

    await t.step('the post-push checks read as documented and the effect block says PASS', async () => {
      const stmts = statements(await Deno.readTextFile(CHECKS_URL));
      const effect = stmts.pop()!;
      assert(/^do \$\$/i.test(effect), 'the effect block is last');
      const [fns, trg, leftover] = [await q(stmts[0]), await q(stmts[1]), await q(stmts[2])];
      assertEquals(fns.length, 6);
      assertEquals(trg.length, 2);
      assertEquals(Number(leftover[0].saved_and_held_or_stale), 0);
      const before = await q(`select * from public.watchlist order by league_id, user_id, symbol`);
      const tradesBefore = (await one(`select count(*)::int n from trades`)).n;
      const r = await refusal(() => db.exec(effect));
      assert(r.message.startsWith('WATCHLIST HELD EFFECT TEST: PASS'), r.message);
      assertEquals(await q(`select * from public.watchlist order by league_id, user_id, symbol`), before, 'rolled back');
      assertEquals((await one(`select count(*)::int n from trades`)).n, tradesBefore, 'its trade rolled back');
      await q(`reset role`);
    });

    await db.close();
  },
});
