// Hermetic tests for claims-run's orchestration (run.ts): every exit writes exactly one 'running'
// and one terminal status; a refused commit re-plans (bounded); a claim-specific refusal fails only
// that claim; a league-wide refusal fails them all; a deferred league is not a failure; a late commit
// is reported 'failed'; one league's failure never stops another's.
//   deno test supabase/functions/claims-run/run.test.ts
import { assert, assertEquals } from 'jsr:@std/assert';
import type { LeagueRow } from '../record-trade/commit.ts';
import type { ClaimRow, CommitPlan } from './plan.ts';
import { HOLD_MS, MAX_ATTEMPTS, type CommitReply, type Ledger, type RunDeps, runClaimsJob } from './run.ts';

const OPEN = Date.parse('2026-12-14T14:30:00Z');
const DAY = '2026-12-14';
const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';
const league: LeagueRow = {
  draft_status: 'completed', season_status: 'active', stake_mode: 'budget_cap',
  budget_amount: 10000, notional_per_slot: null, num_rounds: 3, allow_undraftable: false,
};
const claimA: ClaimRow = { id: 'c-a', user_id: A, symbol: 'AAPL', sell_symbol: null, funded_by: 'cash', run_date: DAY, placed_at: '2026-12-12T22:00:00Z' };
const claimB: ClaimRow = { id: 'c-b', user_id: B, symbol: 'MSFT', sell_symbol: null, funded_by: 'cash', run_date: DAY, placed_at: '2026-12-12T22:00:01Z' };

interface Script {
  now?: number;
  due?: string[];
  open?: boolean;
  claims?: Record<string, ClaimRow[]>;
  commits?: CommitReply[]; // consumed in order
  prices?: Map<string, number>;
  fetchFailed?: Set<string>;
  ledgerError?: boolean;
}

function harness(s: Script) {
  const writes: Array<[string, string | undefined, number | undefined]> = [];
  const commits: Array<{ league: string; plan: CommitPlan }> = [];
  const replies = [...(s.commits ?? [])];
  const deps: RunDeps = {
    now: () => new Date(s.now ?? OPEN + 60_000),
    runDay: () => Promise.resolve({
      ok: true,
      value: { open: s.open ?? true, sessionDate: DAY, sessionOpenMs: OPEN, due: s.due ?? ['L1'] },
    }),
    leagueState: (id) => Promise.resolve({
      ok: true,
      value: { alreadyRan: false, claims: s.claims?.[id] ?? [claimA, claimB], order: [{ user_id: A, position: 1 }, { user_id: B, position: 2 }] },
    }),
    ledger: () => Promise.resolve(s.ledgerError ? { ok: false as const, error: 'boom' } : {
      ok: true as const,
      value: {
        league, seasonEnd: null, picks: [], trades: [], slots: [],
        draftable: new Set(['AAPL', 'MSFT']), eligibility: new Map(),
      } satisfies Ledger,
    }),
    prices: () => Promise.resolve({
      ok: true,
      value: { prices: s.prices ?? new Map([['AAPL', 187.2], ['MSFT', 400]]), fetchFailed: s.fetchFailed ?? new Set() },
    }),
    commit: (leagueId, _d, plan) => {
      commits.push({ league: leagueId, plan });
      const r = replies.shift() ?? { ok: true, won: 2, lost: 0, failed: 0, missed: 0 };
      return Promise.resolve({ ok: true, value: r });
    },
  };
  const run = () => runClaimsJob(deps, (status, _a, message, work) => {
    writes.push([status, message, work]);
    return Promise.resolve();
  });
  return { run, writes, commits };
}

Deno.test('market not open: running then success "market not open", work 0, nothing read', async () => {
  const h = harness({ open: false });
  const r = await h.run();
  assertEquals(h.writes, [['running', undefined, undefined], ['success', 'market not open', 0]]);
  assertEquals(r.leagues, []);
});

Deno.test('no claims due: success "no claims due"', async () => {
  const h = harness({ due: [] });
  await h.run();
  assertEquals(h.writes[1], ['success', 'no claims due', 0]);
});

Deno.test('a clean run: one commit per league, success with work = leagues committed', async () => {
  const h = harness({ due: ['L1', 'L2'] });
  const r = await h.run();
  assertEquals(h.commits.map((c) => c.league), ['L1', 'L2']);
  assertEquals(h.writes[1], ['success', 'committed 2; deferred 0; failed 0 of 2 due', 2]);
  assert(r.ok);
});

Deno.test('claims_changed / order_changed / ledger_changed: re-read and re-plan, then commit', async () => {
  const h = harness({
    commits: [
      { ok: false, reason: 'claims_changed' },
      { ok: false, reason: 'order_changed' },
      { ok: false, reason: 'step_refused', refusal: 'ledger_changed', claim_id: 'c-a' },
    ],
  });
  await h.run();
  assertEquals(h.commits.length, 4);
  assertEquals(h.writes[1][0], 'success');
});

Deno.test('a claim-specific refusal fails ONLY that claim on the re-plan', async () => {
  const h = harness({ commits: [{ ok: false, reason: 'step_refused', refusal: 'proceeds_unavailable', claim_id: 'c-a' }] });
  await h.run();
  const last = h.commits[1].plan;
  const a = last.outcomes.find((o) => o.claim_id === 'c-a')!;
  const b = last.outcomes.find((o) => o.claim_id === 'c-b')!;
  assertEquals([a.status, a.reason], ['failed', 'proceeds_unavailable']);
  assertEquals(b.status, 'won');
  assertEquals(last.steps.map((s) => s.claim_id), ['c-b']);
});

Deno.test('a league-wide refusal (season_completed) fails every claim, with no trades', async () => {
  const h = harness({ commits: [{ ok: false, reason: 'step_refused', refusal: 'season_completed', claim_id: 'c-a' }] });
  await h.run();
  const last = h.commits[1].plan;
  assertEquals(last.outcomes.map((o) => o.reason), ['season_completed', 'season_completed']);
  assertEquals(last.steps, []);
});

Deno.test(`bounded: ${MAX_ATTEMPTS} refused commits fail the league; the job ends 'failed'`, async () => {
  const h = harness({ commits: Array.from({ length: MAX_ATTEMPTS }, () => ({ ok: false as const, reason: 'claims_changed' })) });
  const r = await h.run();
  assertEquals(h.commits.length, MAX_ATTEMPTS);
  assertEquals(h.writes[1][0], 'failed');
  assertEquals(r.leagues[0].result, 'failed');
});

Deno.test('already_ran (an overlapping run committed it): done, not an error', async () => {
  const h = harness({ commits: [{ ok: false, reason: 'already_ran' }] });
  const r = await h.run();
  assertEquals(r.leagues[0].result, 'already_ran');
  assertEquals(h.writes[1][0], 'success');
});

Deno.test('bad_plan is our bug: the league fails, the job ends failed, the next league still runs', async () => {
  const h = harness({ due: ['L1', 'L2'], commits: [{ ok: false, reason: 'bad_plan', detail: 'outcomes' }] });
  const r = await h.run();
  assertEquals(r.leagues.map((l) => l.result), ['failed', 'committed']);
  assertEquals(h.writes[1], ['failed', 'committed 1; deferred 0; failed 1 of 2 due', 1]);
});

Deno.test('a read error in one league never stops another (per participant)', async () => {
  const h = harness({ due: ['L1'], ledgerError: true });
  const r = await h.run();
  assertEquals(r.leagues[0], { league_id: 'L1', result: 'failed', error: 'ledger: boom' });
  assertEquals(h.writes[1][0], 'failed');
});

Deno.test('a price not printed yet DEFERS the league (no commit), and that is not a failure', async () => {
  const h = harness({ prices: new Map([['MSFT', 400]]) });
  const r = await h.run();
  assertEquals(h.commits, []);
  assertEquals(r.leagues[0], { league_id: 'L1', result: 'deferred', missing: ['AAPL'] });
  assertEquals(h.writes[1], ['success', 'committed 0; deferred 1; failed 0 of 1 due', 0]);
});

Deno.test('a FAILED price request waits for the whole hold, then the claim fails no_price', async () => {
  const fetchFailed = new Set(['AAPL']);
  const prices = new Map([['MSFT', 400]]);
  const early = harness({ prices, fetchFailed, now: OPEN + HOLD_MS - 1 });
  assertEquals((await early.run()).leagues[0].result, 'deferred');
  const after = harness({ prices, fetchFailed, now: OPEN + HOLD_MS + 1 });
  await after.run();
  assertEquals(after.commits[0].plan.outcomes.find((o) => o.claim_id === 'c-a')!.reason, 'no_price');
});

Deno.test('a commit after the hold lifted is reported failed ("late"), with the work counted', async () => {
  const h = harness({ now: OPEN + HOLD_MS + 5_000 });
  const r = await h.run();
  assertEquals(h.commits.length, 1, 'the late run still resolves the claims');
  assertEquals(h.writes[1], ['failed', 'committed 1; deferred 0; failed 0; late 1 (after the hold lifted) of 1 due', 1]);
  assert(!r.ok);
});

Deno.test('a throw anywhere still ends with a terminal status (runJob)', async () => {
  const h = harness({});
  const writes: string[] = [];
  const throwing: RunDeps = {
    now: () => new Date(OPEN),
    runDay: () => Promise.reject(new TypeError('x')),
    leagueState: () => Promise.reject(new Error('x')),
    ledger: () => Promise.reject(new Error('x')),
    prices: () => Promise.reject(new Error('x')),
    commit: () => Promise.reject(new Error('x')),
  };
  await runClaimsJob(throwing, (s) => {
    writes.push(s);
    return Promise.resolve();
  });
  assertEquals(writes, ['running', 'failed']);
  void h;
});
