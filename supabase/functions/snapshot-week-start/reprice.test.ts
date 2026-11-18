/**
 * Hermetic tests for the re-price mode's decisions (./reprice.ts). Each safety
 * property in that file's doc has a test here.
 *
 *   deno test supabase/functions/snapshot-week-start/reprice.test.ts
 */

import { assert, assertEquals } from 'jsr:@std/assert';
import {
  REPRICE_MODE,
  applyReprice,
  barOpensOnly,
  gateLeagueWeek,
  parseRepriceBody,
  planRepriceRows,
  round4,
  type RepriceItem,
  type SnapshotPriceRow,
} from './reprice.ts';

const row = (over: Partial<SnapshotPriceRow>): SnapshotPriceRow => ({
  id: 'r1', league_id: 'L', user_id: 'u1', symbol: 'TM', week_number: 1,
  week_start_price: '247.7500', entered_mid_week: false, week_end_price: null,
  ...over,
});

// ── the request body ────────────────────────────────────────────────────────

const body = (o: unknown) => parseRepriceBody(JSON.stringify(o));

Deno.test('the cron body {} (and no body) is the normal run, never the re-price', () => {
  assertEquals(parseRepriceBody('{}'), { kind: 'none' });
  assertEquals(parseRepriceBody(''), { kind: 'none' });
  assertEquals(parseRepriceBody('  '), { kind: 'none' });
});

Deno.test('a malformed or mode-less body is REFUSED, never run as the normal job', () => {
  // Each of these would otherwise fall through to the real, writing snapshot run.
  assertEquals(parseRepriceBody('{"mode":"reprice_week_start",').kind, 'invalid', 'not JSON');
  assertEquals(parseRepriceBody('[]').kind, 'invalid');
  assertEquals(parseRepriceBody('null').kind, 'invalid');
  assertEquals(parseRepriceBody('"reprice"').kind, 'invalid');
  assertEquals(body({ dry_run: true }).kind, 'invalid', 'no mode');
  assertEquals(body({ Mode: REPRICE_MODE, session_date: '2026-11-16' }).kind, 'invalid', 'mistyped key');
  assertEquals(body({ session_date: '2026-11-16', dry_run: false }).kind, 'invalid');
});

Deno.test('an unknown mode or an unknown key is refused', () => {
  assertEquals(body({ mode: 'reprice' }).kind, 'invalid');
  assertEquals(body({ mode: 'REPRICE_WEEK_START', session_date: '2026-11-16' }).kind, 'invalid');
  assertEquals(body({ mode: REPRICE_MODE, session_date: '2026-11-16', dryrun: false }).kind, 'invalid', 'a misspelt dry_run');
});

Deno.test('session_date is required and must be a date', () => {
  assertEquals(body({ mode: REPRICE_MODE }).kind, 'invalid');
  assertEquals(body({ mode: REPRICE_MODE, session_date: '16/11/2026' }).kind, 'invalid');
  assertEquals(body({ mode: REPRICE_MODE, session_date: '2026-13-45' }).kind, 'invalid');
});

Deno.test('dry run is the default; ONLY the boolean false writes', () => {
  const dry = (extra: Record<string, unknown>) => {
    const p = body({ mode: REPRICE_MODE, session_date: '2026-11-16', ...extra });
    assert(p.kind === 'reprice');
    return p.request.dryRun;
  };
  assertEquals(dry({}), true);
  assertEquals(dry({ dry_run: true }), true);
  assertEquals(dry({ dry_run: 'false' }), true, 'the string "false" is not a go-ahead');
  assertEquals(dry({ dry_run: 0 }), true);
  assertEquals(dry({ dry_run: null }), true);
  assertEquals(dry({ dry_run: false }), false);
});

Deno.test('league_ids narrows the run; a malformed list is refused', () => {
  const p = body({ mode: REPRICE_MODE, session_date: '2026-11-16', league_ids: ['a', 'b'] });
  assert(p.kind === 'reprice');
  assertEquals(p.request.leagueIds, ['a', 'b']);
  assertEquals(body({ mode: REPRICE_MODE, session_date: '2026-11-16', league_ids: [] }).kind, 'invalid');
  assertEquals(body({ mode: REPRICE_MODE, session_date: '2026-11-16', league_ids: 'a' }).kind, 'invalid');
});

// ── the league-week gate ────────────────────────────────────────────────────

Deno.test('a league-week with ANY end price is skipped whole', () => {
  const rows = [row({ id: 'a' }), row({ id: 'b', symbol: 'AAPL', week_end_price: '230.0000' })];
  assertEquals(gateLeagueWeek(rows), { ok: false, reason: 'end_priced' });
  assertEquals(gateLeagueWeek([]), { ok: false, reason: 'no_rows' });
  assertEquals(gateLeagueWeek([row({ entered_mid_week: true })]), { ok: false, reason: 'mid_week_only' });
  assertEquals(gateLeagueWeek([row({})]), { ok: true });
});

// ── the per-row plan ────────────────────────────────────────────────────────

const OPENS = new Map([['TM', 212.44], ['AAPL', 228.1], ['KB', 104.205049]]);

Deno.test('a quoted price is re-priced to the bar open', () => {
  const [it] = planRepriceRows([row({})], OPENS);
  assertEquals(it.action, 'reprice');
  assertEquals(it.old_price, 247.75);
  assertEquals(it.new_price, 212.44);
  assertEquals(it.source, 'bar_open');
});

Deno.test('a row already at the open is unchanged (so a second run writes nothing)', () => {
  const [it] = planRepriceRows([row({ symbol: 'AAPL', week_start_price: '228.1000' })], OPENS);
  assertEquals(it.action, 'unchanged');
  // The new price is rounded to the column's 4 dp before comparing.
  const [kb] = planRepriceRows([row({ symbol: 'KB', week_start_price: '104.2050' })], OPENS);
  assertEquals(kb.action, 'unchanged');
  assertEquals(kb.new_price, 104.205);
});

Deno.test('a mid-week row is never planned, whatever its price', () => {
  const items = planRepriceRows([row({ entered_mid_week: true, week_start_price: '999.0000' })], OPENS);
  assertEquals(items, []);
});

Deno.test('no bar -> no_bar, new price null, the row is left as it is', () => {
  const [it] = planRepriceRows([row({ symbol: 'AVAL', week_start_price: '4.6600' })], OPENS);
  assertEquals(it.action, 'no_bar');
  assertEquals(it.new_price, null);
});

Deno.test('a zero or non-finite open is no_bar, never a zero write', () => {
  const bad = new Map([['TM', 0], ['AAPL', Number.NaN], ['KB', 0.00001]]);
  const items = planRepriceRows([row({}), row({ id: 'b', symbol: 'AAPL' }), row({ id: 'c', symbol: 'KB' })], bad);
  assertEquals(items.map((i) => i.action), ['no_bar', 'no_bar', 'no_bar']);
});

Deno.test('symbols are matched case-insensitively', () => {
  const [it] = planRepriceRows([row({ symbol: 'tm' })], OPENS);
  assertEquals(it.action, 'reprice');
  assertEquals(it.symbol, 'TM');
});

Deno.test('round4 matches numeric(12,4)', () => {
  assertEquals(round4(212.444449), 212.4444);
  assertEquals(round4(212.44445), 212.4445);
});

Deno.test('barOpensOnly keeps only bar_open sources (never a prev_close: the repair writes the session open only)', () => {
  const opens = barOpensOnly({
    prices: new Map([['A', 1], ['B', 2], ['C', 3], ['D', 4]]),
    sources: new Map([['A', 'bar_open'], ['B', 'last_trade'], ['C', 'midpoint'], ['D', 'prev_close']]),
    unpriced: new Map(),
    closeDates: new Map([['D', '2026-11-13']]),
    prevCloseRange: { fromDate: '2026-11-06', toDate: '2026-11-13' },
    errors: [],
  });
  assertEquals([...opens.keys()], ['A']);
});

// ── the write ───────────────────────────────────────────────────────────────

Deno.test('applyReprice writes only reprice items, and a re-plan after it is all unchanged (idempotent)', async () => {
  // A tiny in-memory table with the same guard the supabase write uses.
  const table = new Map<string, SnapshotPriceRow>([
    ['a', row({ id: 'a' })],
    ['b', row({ id: 'b', symbol: 'AAPL', week_start_price: '228.1000' })],
    ['c', row({ id: 'c', symbol: 'AVAL', week_start_price: '4.6600' })],
    ['d', row({ id: 'd', symbol: 'TM', entered_mid_week: true, week_start_price: '250.0000' })],
  ]);
  const writes: string[] = [];
  const guardedWrite = (it: RepriceItem) => {
    writes.push(it.id);
    const r = table.get(it.id)!;
    if (r.entered_mid_week !== false || r.week_end_price !== null || Number(r.week_start_price) !== it.old_price) {
      return Promise.resolve('conflict' as const);
    }
    table.set(it.id, { ...r, week_start_price: String(it.new_price) });
    return Promise.resolve('repriced' as const);
  };

  const first = planRepriceRows([...table.values()], OPENS);
  const results = await applyReprice(first, guardedWrite);
  assertEquals(writes, ['a'], 'only the reprice row is written; unchanged, no_bar and mid-week are not');
  assertEquals(results.get('a'), 'repriced');
  assertEquals(table.get('a')!.week_start_price, '212.44');
  assertEquals(table.get('c')!.week_start_price, '4.6600', 'a no_bar row keeps its price, never nulled');
  assertEquals(table.get('d')!.week_start_price, '250.0000', 'a mid-week row is untouched');

  const second = planRepriceRows([...table.values()], OPENS);
  assertEquals(second.filter((i) => i.action === 'reprice'), []);
  await applyReprice(second, guardedWrite);
  assertEquals(writes, ['a'], 'the second run writes nothing');
});

Deno.test('a row that changed between plan and write is a conflict, not an overwrite', async () => {
  const [it] = planRepriceRows([row({})], OPENS);
  const results = await applyReprice([it], () => Promise.resolve('conflict'));
  assertEquals(results.get('r1'), 'conflict');
});

Deno.test('applyReprice refuses a null or non-positive price even if mislabelled reprice', async () => {
  const writes: string[] = [];
  const bogus: RepriceItem[] = [
    { id: 'x', league_id: 'L', week_number: 1, user_id: 'u', symbol: 'TM', old_price: 1, new_price: null, source: null, action: 'reprice' },
    { id: 'y', league_id: 'L', week_number: 1, user_id: 'u', symbol: 'TM', old_price: 1, new_price: 0, source: 'bar_open', action: 'reprice' },
  ];
  await applyReprice(bogus, (it) => { writes.push(it.id); return Promise.resolve('repriced'); });
  assertEquals(writes, []);
});
