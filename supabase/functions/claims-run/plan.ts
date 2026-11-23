// claims-run's resolver: who gets what at the open. PURE (no DB, no network, no clock):
// the hermetic tests in plan.test.ts drive it directly.
//
// Plans: docs/plans/2026-10-08-trading-window-and-watchlist.md ("The run (9:30 ET)", "What can go
// wrong at the open") as changed by docs/plans/2026-11-18-stocks-tab.md part 3.
//
// THE RULES IT APPLIES, and where each comes from:
//   * Order (point 9 of the plan's "Settled during the build", binding): a LIVE queue. Each time,
//     the manager nearest the front who still has a claim waiting has their earliest-placed claim
//     processed (placed_at, then id). A claim that FILLS sends that manager to the back AT ONCE,
//     inside the run, so their next claim is judged from the back; a failed or lost claim moves
//     nobody. commit_claims_run replays the same moves (won outcomes are passed in win order).
//   * A contested stock goes to the first claimant in that walk whose claim can be FILLED. One whose
//     claim cannot be filled (no free slot at the open price, say) fails with its reason and the next
//     one in order may still win it: an invalid claim is skipped, as in fantasy waivers. Everyone
//     after the winner LOSES, told who won (outcome.winner_user_id) and why (reason 'waiver_order'):
//     a manager is told they lost only to someone who actually got the stock.
//   * Every trade is decided by the buy path's own code: decideTrade (record-trade/commit.ts) over
//     _shared/draft-validation.ts, on a SIMULATED ledger that carries every step planned so far, so a
//     manager's second claim sees their first. That includes the not_draftable test the buy applies
//     (refusesAsNotDraftable): a claim fails as not tradable exactly when a buy would be refused.
//   * A claim funded by a sale plans the sale first, then the buy on the ledger with the sale in it,
//     naming that sale as the buy's proceeds (fixed_notional). If either is refused, NEITHER is
//     planned: the sale never happens without its buy.
//   * Prices are the run's opening prices (deps.ts: today's bar open, else an in-session trade or
//     sane midpoint; both the buy and the sale), rounded to cents ONCE, as record-trade rounds a fill
//     (trades.price is NUMERIC(10,2)). A symbol with no price: the league WAITS (defer) until
//     PRICE_WAIT_MS after the open (the wait is shared); then THAT claim fails no_price and the rest
//     proceed (outcomes are per claim). Never a guess.
//   * A claim due on an EARLIER day that is still pending (the run never ran that day): onMissedDay
//     (today: fails missed_run, never carried silently into a later day at a later price).
//   * The league gate (draft done, season not over by flag or by date: record-trade/gate.ts) fails
//     every due claim with that reason.
// Placeholder ids ('ref:<n>') stand for the rows the plan will insert; commit_claims_run maps them
// to the real ids as it inserts, so each step's compare-and-swap sees the steps before it.
import {
  decideTrade,
  type DraftRow,
  type Expectation,
  expectationFor,
  type LeagueRow,
  type LedgerState,
  type SlotRow,
  slotBody,
  slotsFromRows,
} from '../record-trade/commit.ts';
import { type TradeRow } from '../_shared/draft-validation.ts';
import { tradeRefusalReason } from '../record-trade/gate.ts';

/** How long after the open a league waits for a missing price before failing it as no_price. */
export const PRICE_WAIT_MS = 3 * 60_000;
/** The hold on live trading lifts this long after the open (claims_hold_active, SQL). */
export const HOLD_MS = 10 * 60_000;

// ---------------------------------------------------------------------------------------------
// THE THREE FAILURE SEAMS. Giorgio's rule is coming (2026-11-23, via the Orchestrator): these three
// failures "really cannot be happening", each will gain an automatic fix. Each lives in ONE function,
// so the change is one place each:
//   1. onMissingPrice      a claimed or sold stock has no in-session price yet (here)
//   2. onMissedDay         a claim whose day passed with no run (here)
//   3. readClaimDraftability  the is_draftable read the not_draftable test runs on (deps.ts)
// ---------------------------------------------------------------------------------------------

/**
 * SEAM 1: what a claim does while a stock it needs has no price. 'wait' holds the league's run
 * (the wait is shared); 'fail' fails THAT claim no_price and the rest proceed (outcomes are per
 * claim, plan point 9). A failed price REQUEST (not "no price") waits for the whole hold.
 */
export function onMissingPrice(a: { nowMs: number; sessionOpenMs: number; requestFailed: boolean }): 'wait' | 'fail' {
  const waitMs = a.requestFailed ? HOLD_MS : PRICE_WAIT_MS;
  return a.nowMs < a.sessionOpenMs + waitMs ? 'wait' : 'fail';
}

/**
 * SEAM 2: a claim due on an EARLIER day, still pending (its day passed with no run). Today: it fails
 * missed_run and is never carried into a later open at a later price (plan point 9).
 * commit_claims_run does not second-guess this outcome: the rule lives here only.
 */
export function onMissedDay(c: ClaimRow): CommitOutcome {
  return { claim_id: c.id, status: 'failed', reason: 'missed_run', detail: { due_date: c.run_date } };
}

export interface ClaimRow {
  id: string;
  user_id: string;
  symbol: string;
  sell_symbol: string | null;
  funded_by: 'sale' | 'cash';
  run_date: string; // YYYY-MM-DD (the session it was placed for)
  placed_at: string;
}

export interface OrderRow {
  user_id: string;
  position: number;
}

export interface PlanInput {
  runDate: string;
  sessionOpenMs: number;
  nowMs: number;
  league: LeagueRow;
  /** The season's end by date (gate.ts seasonEndFromMatchups), or null. */
  seasonEnd: Date | null;
  picks: DraftRow[];
  trades: TradeRow[];
  slots: SlotRow[];
  claims: ClaimRow[];
  order: OrderRow[];
  /** symbol -> opening price (unrounded). A symbol absent here has no price. */
  prices: Map<string, number>;
  /** Symbols whose price REQUEST failed (not "no price"): they wait longer (onMissingPrice). */
  fetchFailed?: Set<string>;
  /** symbols.is_draftable for every claimed symbol (absent or false = not draftable). */
  draftable: Set<string>;
  /** Category eligibility per claimed symbol (category-slot leagues; else empty). */
  eligibility: Map<string, Set<string>>;
  /** Category eligibility of the claimants' unattributed held symbols (see userSlotOccupancy). */
  heldEligibility?: Map<string, Set<string>>;
  /** Failures the commit forced on specific claims (a claim-specific refusal under the lock). */
  forced?: Map<string, string>;
  /** A league-wide refusal the commit returned (season_completed, ...): every due claim fails with it. */
  forcedLeague?: string | null;
}

export interface CommitStep {
  ref: string;
  claim_id: string;
  action: 'sell' | 'buy';
  quantity: number;
  price: number;
  total_value: number;
  funded_by: string | null;
  slot_id: string | null;
  seen_trade_ids: string[];
  seen_draft_ids: string[];
  rules: Record<string, unknown> | null;
  slots: SlotRow[] | null;
}

export interface CommitOutcome {
  claim_id: string;
  status: 'won' | 'lost' | 'failed';
  reason: string | null;
  detail: Record<string, unknown>;
}

export interface CommitPlan {
  claim_ids: string[];
  order: OrderRow[];
  steps: CommitStep[];
  outcomes: CommitOutcome[];
}

export type PlanResult =
  | { kind: 'plan'; plan: CommitPlan }
  | { kind: 'defer'; missing: string[] };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A refusal's game reason, from decideTrade's 200 reply body. */
function reasonOf(body: Record<string, unknown>): string {
  return typeof body.reason === 'string' ? body.reason : 'unhandled';
}

export function planLeague(input: PlanInput): PlanResult {
  const due = input.claims.filter((c) => c.run_date >= input.runDate);
  const missed = input.claims.filter((c) => c.run_date < input.runDate);
  const forced = input.forced ?? new Map<string, string>();

  // The league gate, once (the same refusal record-trade gives a live trade).
  const leagueRefusal = input.forcedLeague ??
    tradeRefusalReason(input.league, input.seasonEnd, new Date(input.nowMs));

  // A missing price holds the whole league's run while onMissingPrice says 'wait' (seam 1).
  const fetchFailed = input.fetchFailed ?? new Set<string>();
  const priced = (s: string) => Number(input.prices.get(s)) > 0 && Math.round(Number(input.prices.get(s)) * 100) > 0;
  if (!leagueRefusal) {
    const missing = new Set<string>();
    for (const c of due) {
      if (forced.has(c.id)) continue;
      for (const s of [c.symbol, c.sell_symbol]) {
        if (s && !priced(s) && onMissingPrice({ nowMs: input.nowMs, sessionOpenMs: input.sessionOpenMs, requestFailed: fetchFailed.has(s) }) === 'wait') {
          missing.add(s);
        }
      }
    }
    if (missing.size > 0) return { kind: 'defer', missing: [...missing].sort() };
  }

  // THE ROLLING ORDER (plan part 3, "Settled during the build" point 9, binding): a live queue,
  // front first. Each time, the manager nearest the front who still has a claim waiting has their
  // earliest-placed claim processed; a claim that FILLS sends them to the back AT ONCE, so their
  // next claim is judged from the back. A claim that fails or loses moves nobody. A claimant
  // missing from the order (never expected: the run heals the order first) queues behind it, by id.
  const queue: string[] = [...input.order].sort((a, b) => a.position - b.position).map((o) => o.user_id);
  for (const u of [...new Set(due.map((c) => c.user_id))].sort()) if (!queue.includes(u)) queue.push(u);
  const byPlaced = (a: ClaimRow, b: ClaimRow) =>
    (a.placed_at < b.placed_at ? -1 : a.placed_at > b.placed_at ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const waiting = new Map<string, ClaimRow[]>();
  for (const c of [...due].sort(byPlaced)) {
    const list = waiting.get(c.user_id);
    if (list) list.push(c);
    else waiting.set(c.user_id, [c]);
  }
  const nextClaim = (): ClaimRow | undefined => {
    for (const u of queue) {
      const list = waiting.get(u);
      if (list && list.length > 0) return list.shift();
    }
    return undefined;
  };
  /** 1-based place in the order at this moment of the run. */
  const placeOf = (u: string) => queue.indexOf(u) + 1;
  const toBack = (u: string) => {
    queue.splice(queue.indexOf(u), 1);
    queue.push(u);
  };

  const outcomes: CommitOutcome[] = [];
  const steps: CommitStep[] = [];
  const wonBy = new Map<string, string>(); // symbol -> winning user
  let trades: TradeRow[] = [...input.trades];
  const picks = input.picks;
  const slots = input.slots;
  let refN = 0;
  const runIso = new Date(input.nowMs).toISOString();

  for (const c of missed) outcomes.push(onMissedDay(c));

  const stateWith = (t: TradeRow[], buy: boolean, symbol: string): LedgerState => ({
    league: input.league,
    picks,
    trades: t,
    slots: buy ? slots : null,
    eligibleCategories: buy ? (input.eligibility.get(symbol) ?? new Set()) : new Set(),
    heldEligibility: input.heldEligibility,
  });
  const fail = (c: ClaimRow, reason: string, detail: Record<string, unknown> = {}) =>
    outcomes.push({ claim_id: c.id, status: 'failed', reason, detail });

  const wonOutcomes: CommitOutcome[] = [];
  const otherOutcomes: CommitOutcome[] = [];

  for (let c = nextClaim(); c !== undefined; c = nextClaim()) {
    const before = outcomes.length;
    const winner = wonBy.get(c.symbol);
    if (leagueRefusal) {
      fail(c, leagueRefusal);
    } else if (forced.has(c.id)) {
      fail(c, forced.get(c.id)!);
    } else if (winner !== undefined) {
      outcomes.push({
        claim_id: c.id,
        status: 'lost',
        reason: 'waiver_order',
        detail: { winner_user_id: winner, position: placeOf(c.user_id) },
      });
    } else {
      const buyPriceRaw = input.prices.get(c.symbol);
      const sellPriceRaw = c.sell_symbol ? input.prices.get(c.sell_symbol) : undefined;
      // Past the wait (seam 1 said 'fail'): THIS claim fails no_price; the rest proceed.
      if (!priced(c.symbol)) {
        fail(c, 'no_price', { price_symbol: c.symbol });
      } else if (c.sell_symbol && !priced(c.sell_symbol)) {
        fail(c, 'no_price', { price_symbol: c.sell_symbol });
      } else {
        const buyPrice = round2(Number(buyPriceRaw));
        let working = trades;
        const planned: CommitStep[] = [];
        let saleRef: string | undefined;
        let refused: { reason: string; detail: Record<string, unknown> } | null = null;

        if (c.sell_symbol) {
          const sellPrice = round2(Number(sellPriceRaw));
          const state = stateWith(working, false, c.sell_symbol);
          const d = decideTrade({ action: 'sell', userId: c.user_id, symbol: c.sell_symbol, price: sellPrice, isDraftable: true }, state);
          if (!d.ok) {
            refused = { reason: reasonOf(d.reply.body), detail: { sell_symbol: c.sell_symbol } };
          } else {
            saleRef = `ref:${++refN}`;
            const exp: Expectation = expectationFor(state);
            const total = round2(sellPrice * d.value.quantity);
            planned.push({
              ref: saleRef, claim_id: c.id, action: 'sell', quantity: d.value.quantity, price: sellPrice,
              total_value: total, funded_by: null, slot_id: null,
              seen_trade_ids: exp.seenTradeIds, seen_draft_ids: exp.seenDraftIds, rules: null, slots: null,
            });
            working = [...working, {
              id: saleRef, user_id: c.user_id, symbol: c.sell_symbol, action: 'sell', quantity: d.value.quantity,
              price: sellPrice, total_value: total, created_at: runIso, funded_by_trade_id: null, slot_id: null,
            }];
          }
        }

        if (!refused) {
          const state = stateWith(working, true, c.symbol);
          const d = decideTrade({
            action: 'buy', userId: c.user_id, symbol: c.symbol, price: buyPrice,
            isDraftable: input.draftable.has(c.symbol),
            // fixed_notional: the buy reinvests THIS claim's sale. Other stake modes ignore it.
            soldTradeId: saleRef,
          }, state);
          if (!d.ok) {
            const body = d.reply.body;
            const detail: Record<string, unknown> = { price: buyPrice };
            if (Array.isArray(body.open_slots)) detail.open_slots = body.open_slots;
            refused = { reason: reasonOf(body), detail };
          } else {
            const buyRef = `ref:${++refN}`;
            const exp = expectationFor(state);
            const total = round2(buyPrice * d.value.quantity);
            planned.push({
              ref: buyRef, claim_id: c.id, action: 'buy', quantity: d.value.quantity, price: buyPrice,
              total_value: total, funded_by: d.value.fundedByTradeId, slot_id: d.value.slotId,
              seen_trade_ids: exp.seenTradeIds, seen_draft_ids: exp.seenDraftIds, rules: exp.rules, slots: exp.slots,
            });
            const slot = d.value.slotId ? slotsFromRows(slots).find((s) => s.id === d.value.slotId) : undefined;
            working = [...working, {
              id: buyRef, user_id: c.user_id, symbol: c.symbol, action: 'buy', quantity: d.value.quantity,
              price: buyPrice, total_value: total, created_at: runIso,
              funded_by_trade_id: d.value.fundedByTradeId, slot_id: d.value.slotId,
            }];
            steps.push(...planned);
            trades = working;
            wonBy.set(c.symbol, c.user_id);
            outcomes.push({
              claim_id: c.id, status: 'won', reason: null,
              detail: { position: placeOf(c.user_id), ...(slot ? { slot: slotBody(slot) } : {}) },
            });
            toBack(c.user_id); // the moment the claim fills (point 9)
          }
        }
        if (refused) fail(c, refused.reason, refused.detail);
      }
    }
    const o = outcomes[before];
    if (o && o.status === 'won') wonOutcomes.push(o);
    else if (o) otherOutcomes.push(o);
  }

  // Won outcomes first, in WIN order (commit_claims_run moves winners to the back in this order).
  const missedOutcomes = outcomes.slice(0, missed.length);
  return {
    kind: 'plan',
    plan: {
      claim_ids: input.claims.map((c) => c.id).sort(),
      order: [...input.order].sort((a, b) => a.position - b.position),
      steps,
      outcomes: [...wonOutcomes, ...otherOutcomes, ...missedOutcomes],
    },
  };
}
