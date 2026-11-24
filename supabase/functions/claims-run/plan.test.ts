// Hermetic tests for the claims resolver (plan.ts): the waiver order, ties, a failed top claimant,
// the fail reasons (not_draftable by the buy path's own test, no_eligible_slot, roster_full, a sale
// gone), the league gate (a finished season), a missed day, the price wait, and the steps the commit
// will run (sale before buy, placeholder ids, CAS expectations that see the earlier steps).
//   deno test supabase/functions/claims-run/plan.test.ts
import { assert, assertEquals } from 'jsr:@std/assert';
import type { DraftRow, LeagueRow, SlotRow } from '../record-trade/commit.ts';
import type { TradeRow } from '../_shared/draft-validation.ts';
import { type ClaimRow, HOLD_MS, managerClaimOrder, onMissedDay, onMissingPrice, type PlanInput, PRICE_WAIT_MS, planLeague } from './plan.ts';

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';
const C = 'cccccccc-0000-4000-8000-000000000003';
const OPEN = Date.parse('2026-12-14T14:30:00Z'); // Mon 9:30 ET
const DAY = '2026-12-14';

const budgetLeague: LeagueRow = {
  draft_status: 'completed', season_status: 'active', stake_mode: 'budget_cap',
  budget_amount: 10000, notional_per_slot: null, num_rounds: 3, allow_undraftable: false,
};

function pick(id: string, user: string, symbol: string, price: number, qty = 1): DraftRow {
  return { id, user_id: user, symbol, entry_price: price, quantity: qty, pick_number: 1 };
}

let n = 0;
const claim = (user: string, symbol: string, sell: string | null = null, extra: Partial<ClaimRow> = {}): ClaimRow => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  user_id: user, symbol, sell_symbol: sell, funded_by: sell ? 'sale' : 'cash', run_date: DAY,
  placed_at: `2026-12-12T22:00:${String(n % 60).padStart(2, '0')}Z`, ...extra,
});

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    runDate: DAY,
    sessionOpenMs: OPEN,
    nowMs: OPEN + 30_000,
    league: budgetLeague,
    seasonEnd: null,
    picks: [pick('d1', A, 'AAA', 100), pick('d2', B, 'BBB', 100), pick('d3', C, 'CCC', 100)],
    trades: [],
    slots: [],
    claims: [],
    order: [{ user_id: A, position: 1 }, { user_id: B, position: 2 }, { user_id: C, position: 3 }],
    prices: new Map([['AAPL', 187.204], ['MSFT', 400], ['AAA', 110], ['BBB', 90], ['CCC', 50], ['NVDA', 120]]),
    draftable: new Set(['AAPL', 'MSFT', 'NVDA', 'AAA', 'BBB', 'CCC']),
    eligibility: new Map(),
    ...over,
  };
}

function plan(over: Partial<PlanInput>) {
  const r = planLeague(input(over));
  assert(r.kind === 'plan', `expected a plan, got ${JSON.stringify(r)}`);
  return r.plan;
}
const outcomeOf = (p: ReturnType<typeof plan>, id: string) => p.outcomes.find((o) => o.claim_id === id)!;

Deno.test('an uncontested claim wins at the opening price, rounded to cents once', () => {
  const c = claim(B, 'AAPL');
  const p = plan({ claims: [c] });
  assertEquals(outcomeOf(p, c.id).status, 'won');
  assertEquals(p.steps.length, 1);
  assertEquals(p.steps[0].action, 'buy');
  assertEquals(p.steps[0].price, 187.2);
  assertEquals(p.steps[0].total_value, 187.2);
  assertEquals(p.steps[0].seen_trade_ids, []);
  assertEquals(p.steps[0].seen_draft_ids, ['d1', 'd2', 'd3']);
  assertEquals(p.steps[0].rules?.stake_mode, 'budget_cap');
});

Deno.test('a contested stock goes to the better waiver position; the other LOSES, told who won', () => {
  const cb = claim(B, 'AAPL'); // placed FIRST, but position 2
  const ca = claim(A, 'AAPL'); // position 1
  const p = plan({ claims: [cb, ca] });
  assertEquals(outcomeOf(p, ca.id).status, 'won');
  assertEquals(outcomeOf(p, cb.id), {
    claim_id: cb.id, status: 'lost', reason: 'waiver_order',
    detail: { winner_user_id: A, position: 1 }, // A won and went to the back: B is now 1st
  });
  assertEquals(p.steps.filter((s) => s.claim_id === cb.id), [], 'the loser trades nothing');
});

Deno.test('THE ROLLING ORDER (point 9): A (1st) claims X and Y, B (2nd) claims Y -> A gets X, B gets Y', () => {
  const ax = claim(A, 'MSFT', null, { placed_at: '2026-12-12T21:00:00Z' }); // X, placed first
  const ay = claim(A, 'AAPL', null, { placed_at: '2026-12-12T21:05:00Z' }); // Y
  const by = claim(B, 'AAPL', null, { placed_at: '2026-12-12T21:10:00Z' }); // Y
  const p = plan({ claims: [ay, by, ax] });
  assertEquals(outcomeOf(p, ax.id).status, 'won', 'A\'s earliest claim first');
  assertEquals(outcomeOf(p, by.id).status, 'won', 'A went to the back, so B is ahead for Y');
  assertEquals(outcomeOf(p, ay.id), {
    claim_id: ay.id, status: 'lost', reason: 'waiver_order', detail: { winner_user_id: B, position: 2 },
  });
  // Won outcomes in WIN order: the commit replays the moves to the back in this order.
  assertEquals(p.outcomes.filter((o) => o.status === 'won').map((o) => o.claim_id), [ax.id, by.id]);
});

Deno.test('a failed or lost claim moves nobody: the next claim of the same manager is still judged from the front', () => {
  // A (1st) has a claim that fails (not draftable), then claims Y; B (2nd) claims Y. A keeps first place.
  const af = claim(A, 'OFFL', null, { placed_at: '2026-12-12T21:00:00Z' });
  const ay = claim(A, 'AAPL', null, { placed_at: '2026-12-12T21:05:00Z' });
  const by = claim(B, 'AAPL', null, { placed_at: '2026-12-12T20:00:00Z' });
  const p = plan({ claims: [af, ay, by], prices: new Map([['OFFL', 10], ['AAPL', 187.2]]) });
  assertEquals(outcomeOf(p, af.id).reason, 'not_draftable');
  assertEquals(outcomeOf(p, ay.id).status, 'won');
  assertEquals(outcomeOf(p, by.id).detail.winner_user_id, A);
});

Deno.test('a winner\'s second claim is judged from the back, behind everyone else\'s first', () => {
  // A (1st) claims X then Y; B (2nd) and C (3rd) both claim Y. After A wins X: B, C, A. B gets Y.
  const ax = claim(A, 'MSFT', null, { placed_at: '2026-12-12T21:00:00Z' });
  const ay = claim(A, 'AAPL', null, { placed_at: '2026-12-12T21:01:00Z' });
  const cy = claim(C, 'AAPL', null, { placed_at: '2026-12-12T20:00:00Z' });
  const by = claim(B, 'AAPL', null, { placed_at: '2026-12-12T21:30:00Z' });
  const p = plan({ claims: [ax, ay, by, cy] });
  assertEquals([outcomeOf(p, ax.id).status, outcomeOf(p, by.id).status, outcomeOf(p, cy.id).status, outcomeOf(p, ay.id).status],
    ['won', 'won', 'lost', 'lost']);
});

Deno.test('claimants missing from the order (never expected: the run heals it) queue behind it, by id', () => {
  const c1 = claim(C, 'AAPL', null, { placed_at: '2026-12-12T20:00:00Z' });
  const c2 = claim(B, 'AAPL', null, { placed_at: '2026-12-12T21:00:00Z' });
  const p = plan({ claims: [c1, c2], order: [{ user_id: A, position: 1 }] }); // B and C both unordered
  assertEquals(outcomeOf(p, c2.id).status, 'won', 'B before C by id, whatever was placed first');
  assertEquals(outcomeOf(p, c1.id).status, 'lost');
});

Deno.test('a top claimant whose claim cannot fill FAILS; the next in order still wins the stock', () => {
  // A's roster is full (3 of 3) and A names no sale: roster_full. B gets it.
  const picks = [pick('d1', A, 'AAA', 100), pick('d4', A, 'X1', 100), pick('d5', A, 'X2', 100), pick('d2', B, 'BBB', 100)];
  const ca = claim(A, 'AAPL');
  const cb = claim(B, 'AAPL');
  const p = plan({ claims: [ca, cb], picks, prices: new Map([['AAPL', 187.2]]) });
  assertEquals(outcomeOf(p, ca.id).status, 'failed');
  assertEquals(outcomeOf(p, ca.id).reason, 'roster_full');
  assertEquals(outcomeOf(p, cb.id).status, 'won');
});

Deno.test('a claim funded by a sale: the sale first, then the buy that sees it (placeholder ids)', () => {
  const picks = [pick('d1', A, 'AAA', 100), pick('d4', A, 'X1', 100), pick('d5', A, 'X2', 100)];
  const ca = claim(A, 'AAPL', 'AAA');
  const p = plan({ claims: [ca], picks });
  assertEquals(outcomeOf(p, ca.id).status, 'won');
  assertEquals(p.steps.map((s) => [s.action, s.ref]), [['sell', 'ref:1'], ['buy', 'ref:2']]);
  assertEquals(p.steps[0].price, 110);
  assertEquals(p.steps[0].quantity, 1);
  assertEquals(p.steps[0].rules, null, 'a sell sends no rules (the CAS scope matches the evidence)');
  assertEquals(p.steps[1].seen_trade_ids, ['ref:1'], 'the buy CAS sees the sale');
});

Deno.test('fixed_notional: the buy reinvests THIS claim\'s sale (funded_by = its placeholder)', () => {
  const league: LeagueRow = { ...budgetLeague, stake_mode: 'fixed_notional', budget_amount: null, notional_per_slot: 1000 };
  const picks = [pick('d1', A, 'AAA', 100, 10), pick('d4', A, 'X1', 100, 10), pick('d5', A, 'X2', 100, 10)];
  const ca = claim(A, 'AAPL', 'AAA');
  const p = plan({ claims: [ca], picks, league });
  const [sell, buy] = p.steps;
  assertEquals(sell.total_value, 1100);
  assertEquals(buy.funded_by, 'ref:1');
  assertEquals(buy.quantity, Math.round((1100 / 187.2) * 1e6) / 1e6);
});

Deno.test('a refused buy drops its sale: the sale never happens without its buy', () => {
  const ca = claim(A, 'AAPL', 'AAA');
  const p = plan({ claims: [ca], draftable: new Set(['AAA']) }); // AAPL not draftable
  assertEquals(outcomeOf(p, ca.id).status, 'failed');
  assertEquals(outcomeOf(p, ca.id).reason, 'not_draftable');
  assertEquals(p.steps, []);
});

Deno.test('not_draftable is the BUY PATH\'s test: refused in a normal league, allowed in a full-universe one', () => {
  const c = claim(B, 'AAPL');
  const refused = plan({ claims: [c], draftable: new Set() });
  assertEquals(outcomeOf(refused, c.id).reason, 'not_draftable');
  const full = plan({ claims: [c], draftable: new Set(), league: { ...budgetLeague, allow_undraftable: true } });
  assertEquals(outcomeOf(full, c.id).status, 'won');
});

Deno.test('the sale is gone (sold live after the hold lifted): failed not_owned, nothing traded', () => {
  const ca = claim(A, 'AAPL', 'AAA');
  const trades: TradeRow[] = [{ id: 't1', user_id: A, symbol: 'AAA', action: 'sell', quantity: 1, price: 105, created_at: '2026-12-14T14:41:00Z' }];
  const p = plan({ claims: [ca], trades });
  assertEquals(outcomeOf(p, ca.id).reason, 'not_owned');
  assertEquals(p.steps, []);
});

Deno.test('someone bought the stock live (a late run): failed symbol_owned', () => {
  const c = claim(B, 'AAPL');
  const trades: TradeRow[] = [{ id: 't1', user_id: C, symbol: 'AAPL', action: 'buy', quantity: 1, price: 187, created_at: '2026-12-14T14:41:00Z' }];
  const p = plan({ claims: [c], trades });
  assertEquals(outcomeOf(p, c.id).reason, 'symbol_owned');
});

Deno.test('a slotted league: the open price outside every free slot fails no_eligible_slot with the price and the open slots', () => {
  const slots: SlotRow[] = [
    { id: 's-lo', slot_index: 0, slot_count: 1, price_min: 0, price_max: 100, category_id: null },
    { id: 's-hi', slot_index: 1, slot_count: 1, price_min: 100, price_max: 200, category_id: null },
  ];
  const league: LeagueRow = { ...budgetLeague, stake_mode: 'price_tiers', budget_amount: null, num_rounds: 2 };
  const picks: DraftRow[] = [{ ...pick('d1', A, 'CCC', 50), slot_id: 's-lo' }];
  const c = claim(A, 'MSFT'); // 400: no slot takes it
  const p = plan({ claims: [c], slots, league, picks });
  const o = outcomeOf(p, c.id);
  assertEquals(o.status, 'failed');
  assertEquals(o.reason, 'no_eligible_slot');
  assertEquals(o.detail.price, 400);
  assertEquals((o.detail.open_slots as Array<{ slot_id: string }>).map((s) => s.slot_id), ['s-hi']);
  const ok = plan({ claims: [claim(A, 'AAPL')], slots, league, picks });
  assertEquals(ok.steps[0].slot_id, 's-hi', 'the buy takes its slot, as a live buy would');
});

Deno.test('a manager\'s second claim sees the first (budget spent across claims)', () => {
  const league: LeagueRow = { ...budgetLeague, budget_amount: 600 }; // 100 spent at the draft
  const c1 = claim(A, 'MSFT'); // 400 -> 500 spent
  const c2 = claim(A, 'AAPL'); // 187.2 -> over 600
  const p = plan({ claims: [c1, c2], league });
  assertEquals(outcomeOf(p, c1.id).status, 'won');
  assertEquals(outcomeOf(p, c2.id).reason, 'over_budget');
});

Deno.test('outcomes: won ones first, in WIN order (the order commit moves winners to the back)', () => {
  const cc = claim(C, 'NVDA');
  const ca = claim(A, 'MSFT');
  const cb = claim(B, 'AAPL');
  const p = plan({ claims: [cc, ca, cb] });
  assertEquals(p.outcomes.map((o) => o.claim_id), [ca.id, cb.id, cc.id]);
  assertEquals(p.claim_ids, [cc.id, ca.id, cb.id].sort());
});

Deno.test('a finished season (by date) fails every due claim with season_completed, no trades', () => {
  const c = claim(B, 'AAPL');
  const p = plan({ claims: [c], seasonEnd: new Date(OPEN - 1000) });
  assertEquals(outcomeOf(p, c.id), { claim_id: c.id, status: 'failed', reason: 'season_completed', detail: {} });
  assertEquals(p.steps, []);
  const flagged = plan({ claims: [c], league: { ...budgetLeague, season_status: 'completed' } });
  assertEquals(outcomeOf(flagged, c.id).reason, 'season_completed');
});

Deno.test('a claim due on an earlier day still pending fails missed_run, never carried to today', () => {
  const old = claim(B, 'AAPL', null, { run_date: '2026-12-11' });
  const today = claim(C, 'MSFT');
  const p = plan({ claims: [old, today] });
  assertEquals(outcomeOf(p, old.id), { claim_id: old.id, status: 'failed', reason: 'missed_run', detail: { due_date: '2026-12-11' } });
  assertEquals(outcomeOf(p, today.id).status, 'won');
  assertEquals(p.steps.filter((s) => s.claim_id === old.id), []);
});

Deno.test('a missing price WAITS while the wait lasts, then fails no_price (never a guess)', () => {
  const c = claim(B, 'AAPL', 'BBB');
  const prices = new Map([['BBB', 90]]);
  const early = planLeague(input({ claims: [c], prices, nowMs: OPEN + PRICE_WAIT_MS - 1 }));
  assertEquals(early, { kind: 'defer', missing: ['AAPL'] });
  const late = plan({ claims: [c], prices, nowMs: OPEN + PRICE_WAIT_MS });
  assertEquals(outcomeOf(late, c.id).reason, 'no_price');
  assertEquals(late.steps, [], 'not the sale either');
});

Deno.test('forced failures from the commit: one claim, or the whole league', () => {
  const c1 = claim(A, 'MSFT');
  const c2 = claim(B, 'AAPL');
  const one = plan({ claims: [c1, c2], forced: new Map([[c1.id, 'proceeds_unavailable']]) });
  assertEquals(outcomeOf(one, c1.id).reason, 'proceeds_unavailable');
  assertEquals(outcomeOf(one, c2.id).status, 'won');
  const all = plan({ claims: [c1, c2], forcedLeague: 'draft_not_completed' });
  assertEquals(all.outcomes.map((o) => o.reason), ['draft_not_completed', 'draft_not_completed']);
});

Deno.test('the plan carries the order and claim set it was made on (the commit compares both)', () => {
  const c = claim(B, 'AAPL');
  const order = [{ user_id: C, position: 3 }, { user_id: A, position: 1 }, { user_id: B, position: 2 }];
  const p = plan({ claims: [c], order });
  assertEquals(p.order.map((o) => o.position), [1, 2, 3]);
  assertEquals(p.claim_ids, [c.id]);
});

Deno.test('SEAM 1 onMissingPrice: wait 3 min for "no price", the whole hold for a failed request, then fail', () => {
  const at = (ms: number, requestFailed: boolean) => onMissingPrice({ nowMs: OPEN + ms, sessionOpenMs: OPEN, requestFailed });
  assertEquals([at(PRICE_WAIT_MS - 1, false), at(PRICE_WAIT_MS, false)], ['wait', 'fail']);
  assertEquals([at(HOLD_MS - 1, true), at(HOLD_MS, true)], ['wait', 'fail']);
});

Deno.test('SEAM 1 in the plan: past the wait only THAT claim fails no_price; the rest of the league proceeds', () => {
  const c1 = claim(A, 'AAPL');
  const c2 = claim(B, 'MSFT');
  const p = plan({ claims: [c1, c2], prices: new Map([['MSFT', 400]]), nowMs: OPEN + PRICE_WAIT_MS });
  assertEquals([outcomeOf(p, c1.id).reason, outcomeOf(p, c2.id).status], ['no_price', 'won']);
  const early = planLeague(input({ claims: [c1, c2], prices: new Map([['MSFT', 400]]), fetchFailed: new Set(['AAPL']), nowMs: OPEN + PRICE_WAIT_MS }));
  assertEquals(early.kind, 'defer', 'a failed request keeps waiting past 3 minutes');
});

Deno.test('SEAM 2 onMissedDay: today, failed missed_run with the day it was due', () => {
  const c = claim(B, 'AAPL', null, { run_date: '2026-12-11' });
  assertEquals(onMissedDay(c), { claim_id: c.id, status: 'failed', reason: 'missed_run', detail: { due_date: '2026-12-11' } });
});

Deno.test('managerClaimOrder: one manager\'s claims, earliest placed first, then id (the one place a rank would change)', () => {
  const late = claim(A, 'AAPL', null, { placed_at: '2026-12-12T22:00:00Z' });
  const early = claim(A, 'MSFT', null, { placed_at: '2026-12-12T21:00:00Z' });
  const tieA = { ...claim(A, 'NVDA', null, { placed_at: '2026-12-12T23:00:00Z' }), id: 'a' };
  const tieB = { ...claim(A, 'XA', null, { placed_at: '2026-12-12T23:00:00Z' }), id: 'b' };
  assertEquals([late, tieB, early, tieA].sort(managerClaimOrder).map((c) => c.symbol), ['MSFT', 'AAPL', 'NVDA', 'XA']);
});
