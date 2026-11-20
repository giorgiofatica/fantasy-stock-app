/**
 * process-week-results stores WHY a week was won, in the same write as the
 * winner. Driven through the REAL handler (index.ts), not a copy.
 * Plan: docs/plans/2026-11-19-matchup-outcome-reason.md, "Done means" 2.
 *
 * HOW (the cron_status_handlers.test.ts pattern): Deno.serve is replaced while
 * the module loads so the handler is captured, and globalThis.fetch is replaced
 * by a fake PostgREST that serves one pending matchup, that week's
 * week_snapshots, and empty drafts/trades. supabase-js builds the real
 * requests, so the PATCH recorded here is the handler's own result update.
 *
 * Every scenario asserts on the ONE result PATCH of the matchup: it carries the
 * winner, is_tie, the dollars, the reason and both percents together. A reason
 * written in a second call could land without the winner (or the winner
 * without it), which is exactly what the plan rules out.
 *
 * Scores come from real week_snapshots through the real scorer
 * (calculateUserScore): a team "with stocks" holds 10 shares; a team "with no
 * stocks" has no snapshot and an empty ledger, which the handler scores as
 * all-cash with hasPositions false.
 *
 * Not reachable through the handler: 'playoff_no_opponent'. A playoff row with
 * an empty team2 slot is filtered out before scoring (isScoreableNow, DEFECT 4),
 * which the last scenario pins. Its stored form is covered in
 * process-week-results/outcome-record.test.ts.
 *
 * Run:
 *   deno test --allow-read --allow-env supabase/tests/matchup_outcome_reason_handler.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert';

const CRON_KEY = 'test-cron-key-not-a-secret';
const FAKE_ENV: Record<string, string> = {
  SB_SECRET_KEY_CRON: CRON_KEY,
  SUPABASE_URL: 'http://stub.supabase.test',
  SB_SECRET_KEY_INTERNAL: 'test-internal-key-not-a-secret',
  ALPACA_API_KEY: 'test-alpaca-id',
  ALPACA_API_SECRET: 'test-alpaca-secret',
};
const SAVED_ENV = new Map(Object.keys(FAKE_ENV).map((k) => [k, Deno.env.get(k)]));
for (const [k, v] of Object.entries(FAKE_ENV)) Deno.env.set(k, v);

const LEAGUE = '11111111-1111-1111-1111-111111111111';
const MATCHUP = '22222222-2222-2222-2222-222222222222';
const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const HOUR = 3_600_000;

/** A team's week: 10 shares from `start` to `end`, or null for no stocks. */
type Holding = { start: number; end: number } | null;

interface Scenario {
  team2: string | null;
  isPlayoff?: boolean;
  seeds?: [number | null, number | null];
  a: Holding;
  b: Holding;
}

// deno-lint-ignore no-explicit-any
type Json = any;
interface Req { method: string; url: URL; body: Json; accept: string }

function matchupRow(s: Scenario): Json {
  const now = Date.now();
  return {
    id: MATCHUP,
    league_id: LEAGUE,
    week_number: 2,
    team1_user_id: A,
    team2_user_id: s.team2,
    team1_gain: null,
    team1_seed: s.seeds?.[0] ?? null,
    team2_seed: s.seeds?.[1] ?? null,
    week_start: new Date(now - 96 * HOUR).toISOString(),
    week_end: new Date(now - 2 * HOUR).toISOString(),
    is_playoff: s.isPlayoff === true,
    // A playoff row is the final of a 4-team bracket (round 2 of 2), so the
    // handler's advance is a no-op and only the result write touches matchups.
    playoff_round: s.isPlayoff ? 'finals' : null,
    playoff_round_number: s.isPlayoff ? 2 : null,
    bracket_position: s.isPlayoff ? 0 : null,
    leagues: { id: LEAGUE, league_type: 'matchup', current_week: 99, num_weeks: 8, playoff_teams: 4 },
  };
}

function snapshots(s: Scenario): Json[] {
  const rows: Json[] = [];
  const add = (user: string, symbol: string, h: Holding) => {
    if (!h) return;
    rows.push({ user_id: user, symbol, quantity: 10, week_start_price: h.start, week_end_price: h.end, entered_mid_week: false });
  };
  add(A, 'AAA', s.a);
  if (s.team2) add(s.team2, 'BBB', s.b);
  return rows;
}

const JSON_HEADERS = { 'content-type': 'application/json', 'content-range': '*/0' };
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

/** Run the handler once against a fake PostgREST; return every matchups PATCH. */
async function score(s: Scenario): Promise<{ patches: Req[]; status: number; body: Json }> {
  const patches: Req[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
    const req = input instanceof Request ? input : null;
    const url = new URL(req ? req.url : String(input));
    const method = (req?.method ?? init?.method ?? 'GET').toUpperCase();
    const raw = req ? await req.text() : (init?.body as string | undefined);
    const body = raw ? JSON.parse(raw) : undefined;
    const headers = new Headers(req?.headers ?? init?.headers);
    const accept = headers.get('accept') ?? '';

    if (url.hostname !== 'stub.supabase.test') return ok({}); // Alpaca: no prices needed (snapshots carry them)
    const p = url.pathname;
    if (p === '/rest/v1/matchups' && method === 'PATCH') {
      patches.push({ method, url, body, accept });
      return ok([]);
    }
    if (p === '/rest/v1/matchups' && method === 'GET' && (url.searchParams.get('select') ?? '').includes('leagues!inner')) {
      return ok([matchupRow(s)]);
    }
    if (p === '/rest/v1/week_snapshots') return ok(snapshots(s));
    if (p === '/rest/v1/leagues' && accept.includes('vnd.pgrst.object')) {
      return ok({ current_week: 99, season_status: 'active' });
    }
    if (p === '/rest/v1/cron_job_status' && method === 'POST') return new Response(null, { status: 201 });
    if (p.startsWith('/rest/v1/rpc/')) return ok(null);
    if (method === 'POST') return new Response(null, { status: 201 });
    return ok([]);
  }) as typeof fetch;

  const o = { log: console.log, error: console.error, warn: console.warn };
  console.log = console.error = console.warn = () => {};
  try {
    const h = await load();
    const res = await h(new Request('http://localhost/fn', {
      method: 'POST',
      headers: { apikey: CRON_KEY, 'content-type': 'application/json' },
      body: '{}',
    }));
    return { patches, status: res.status, body: await res.json() };
  } finally {
    Object.assign(console, o);
    globalThis.fetch = original;
  }
}

type Handler = (req: Request) => Promise<Response>;
let handler: Handler | undefined;
async function load(): Promise<Handler> {
  if (handler) return handler;
  let captured: Handler | undefined;
  const original = Deno.serve;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (h: Handler) => { captured = h; return {}; };
  try {
    await import(new URL('../functions/process-week-results/index.ts', import.meta.url).href);
  } finally {
    Deno.serve = original;
  }
  assert(captured, 'process-week-results/index.ts did not call Deno.serve');
  handler = captured;
  return captured;
}

interface Expected {
  outcome_reason: string;
  winner_user_id: string | null;
  is_tie: boolean;
  team1_gain: number;
  team2_gain: number | null;
  team1_percent_gain: number | null;
  team2_percent_gain: number | null;
}

/** The handler wrote exactly one result update for the matchup, carrying all of `want`. */
async function expectResult(s: Scenario, want: Expected) {
  const { patches, status, body } = await score(s);
  assertEquals(status, 200, JSON.stringify(body));
  const results = patches.filter((r) => r.url.searchParams.get('id') === `eq.${MATCHUP}`);
  assertEquals(results.length, 1, `one result update for the matchup, got ${results.length}`);
  const got = results[0].body;
  // The reason and the percents are in the SAME call as the winner: one body.
  assertEquals(
    {
      outcome_reason: got.outcome_reason,
      winner_user_id: got.winner_user_id,
      is_tie: got.is_tie,
      team1_gain: got.team1_gain,
      team2_gain: got.team2_gain,
      team1_percent_gain: got.team1_percent_gain,
      team2_percent_gain: got.team2_percent_gain,
    },
    want,
  );
  // A NULL percent is sent as an explicit null, never left out of the update.
  assert('team1_percent_gain' in got && 'team2_percent_gain' in got);
  assertEquals(body.processed, 1);
}

// 10 shares 100 -> 110: $100 on $1,000 = 10%. 10 shares 200 -> 210: $100 on $2,000 = 5%.
const UP_10 = { start: 100, end: 110 };
const UP_5_SAME_DOLLARS = { start: 200, end: 210 };
const UP_HALF = { start: 100, end: 105 }; // $50, 5%

Deno.test('dollar_gain: more dollars wins; both percents stored', () =>
  expectResult({ team2: B, a: UP_10, b: UP_HALF }, {
    outcome_reason: 'dollar_gain', winner_user_id: A, is_tie: false,
    team1_gain: 100, team2_gain: 50, team1_percent_gain: 10, team2_percent_gain: 5,
  }));

Deno.test('percent_tiebreak: equal dollars, the better percent wins; both percents stored', () =>
  expectResult({ team2: B, a: UP_5_SAME_DOLLARS, b: UP_10 }, {
    outcome_reason: 'percent_tiebreak', winner_user_id: B, is_tie: false,
    team1_gain: 100, team2_gain: 100, team1_percent_gain: 5, team2_percent_gain: 10,
  }));

Deno.test('regular_season_true_tie: equal dollars and percent, no winner', () =>
  expectResult({ team2: B, a: UP_10, b: UP_10 }, {
    outcome_reason: 'regular_season_true_tie', winner_user_id: null, is_tie: true,
    team1_gain: 100, team2_gain: 100, team1_percent_gain: 10, team2_percent_gain: 10,
  }));

Deno.test('both_empty_tie: neither team holds stocks; both percents NULL', () =>
  expectResult({ team2: B, a: null, b: null }, {
    outcome_reason: 'both_empty_tie', winner_user_id: null, is_tie: true,
    team1_gain: 0, team2_gain: 0, team1_percent_gain: null, team2_percent_gain: null,
  }));

Deno.test('team1_empty_auto_loss: team 1 holds no stocks; its percent is NULL', () =>
  expectResult({ team2: B, a: null, b: UP_HALF }, {
    outcome_reason: 'team1_empty_auto_loss', winner_user_id: B, is_tie: false,
    team1_gain: 0, team2_gain: 50, team1_percent_gain: null, team2_percent_gain: 5,
  }));

Deno.test('team2_empty_auto_loss: team 2 holds no stocks, even when team 1 lost money', () =>
  expectResult({ team2: B, a: { start: 100, end: 90 }, b: null }, {
    outcome_reason: 'team2_empty_auto_loss', winner_user_id: A, is_tie: false,
    team1_gain: -100, team2_gain: 0, team1_percent_gain: -10, team2_percent_gain: null,
  }));

Deno.test('bye_no_result: a regular-season bye; no team 2, so no team 2 percent', () =>
  expectResult({ team2: null, a: UP_10, b: null }, {
    outcome_reason: 'bye_no_result', winner_user_id: null, is_tie: false,
    team1_gain: 100, team2_gain: null, team1_percent_gain: 10, team2_percent_gain: null,
  }));

Deno.test('playoff_seed_tiebreak: a playoff double tie with two different seeds', () =>
  expectResult({ team2: B, isPlayoff: true, seeds: [1, 4], a: UP_10, b: UP_10 }, {
    outcome_reason: 'playoff_seed_tiebreak', winner_user_id: A, is_tie: false,
    team1_gain: 100, team2_gain: 100, team1_percent_gain: 10, team2_percent_gain: 10,
  }));

Deno.test('playoff_seed_tiebreak, EQUAL seeds: same winner, stored as playoff_seed_unresolved', () =>
  // resolveBySeed gives equal seeds to team 2; who advances is unchanged.
  expectResult({ team2: B, isPlayoff: true, seeds: [2, 2], a: UP_10, b: UP_10 }, {
    outcome_reason: 'playoff_seed_unresolved', winner_user_id: B, is_tie: false,
    team1_gain: 100, team2_gain: 100, team1_percent_gain: 10, team2_percent_gain: 10,
  }));

Deno.test('playoff_seed_tiebreak, a MISSING seed: same winner, stored as playoff_seed_unresolved', () =>
  // A missing seed counts as 999, so the seeded team 2 advances.
  expectResult({ team2: B, isPlayoff: true, seeds: [null, 3], a: UP_10, b: UP_10 }, {
    outcome_reason: 'playoff_seed_unresolved', winner_user_id: B, is_tie: false,
    team1_gain: 100, team2_gain: 100, team1_percent_gain: 10, team2_percent_gain: 10,
  }));

Deno.test('both_empty_playoff_seed_tiebreak: no stocks on either side, two different seeds', () =>
  expectResult({ team2: B, isPlayoff: true, seeds: [3, 1], a: null, b: null }, {
    outcome_reason: 'both_empty_playoff_seed_tiebreak', winner_user_id: B, is_tie: false,
    team1_gain: 0, team2_gain: 0, team1_percent_gain: null, team2_percent_gain: null,
  }));

Deno.test('both_empty_playoff_seed_tiebreak, EQUAL seeds: stored as playoff_seed_unresolved', () =>
  expectResult({ team2: B, isPlayoff: true, seeds: [1, 1], a: null, b: null }, {
    outcome_reason: 'playoff_seed_unresolved', winner_user_id: B, is_tie: false,
    team1_gain: 0, team2_gain: 0, team1_percent_gain: null, team2_percent_gain: null,
  }));

Deno.test('both_empty_playoff_seed_tiebreak, a MISSING seed: stored as playoff_seed_unresolved', () =>
  expectResult({ team2: B, isPlayoff: true, seeds: [2, null], a: null, b: null }, {
    outcome_reason: 'playoff_seed_unresolved', winner_user_id: A, is_tie: false,
    team1_gain: 0, team2_gain: 0, team1_percent_gain: null, team2_percent_gain: null,
  }));

Deno.test('playoff_no_opponent is not reachable here: a half-filled playoff row is never scored', async () => {
  const { patches, body } = await score({ team2: null, isPlayoff: true, seeds: [1, null], a: UP_10, b: null });
  assertEquals(patches.length, 0);
  assertEquals(body.processed, 0);
});

Deno.test('restore env', () => {
  for (const [k, v] of SAVED_ENV) {
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
});
