// claims-run's real reads and the commit, over the service-role client.
//
// Every supabase-js call resolves to { data, error } and does NOT throw on a Postgres error
// (CLAUDE.md "success signals" #5): each one is destructured and its error checked. Every
// drafts / trades / matchups read is PAGINATED (record-trade/commit.ts readAllPages) in a stable
// order, with the SAME columns record-trade's readLedger selects: a truncated ledger would be a
// decision drawn from a subset, and could never match record_trade_atomic's compare-and-swap.
//
// PRICES (the plan: "processed at the next open 9:30 ET at the opening price"; "never a lone bid or
// ask"): the shared week-price rule (_shared/week-price.ts fetchWeekPrices) with the SESSION's
// 1Day bar OPEN first, then a trade or a sane two-sided midpoint inside THIS session (open .. now),
// and no previous close. So a claim fills at today's opening print, never at yesterday's last trade
// labelled as the open, and a stock that has not traded yet has no price (the league waits; plan.ts).
import { fetchEligibleCategoryIdsBatch } from '../_shared/category-eligibility.ts';
import { unattributedHeldSymbols, type TradeRow } from '../_shared/draft-validation.ts';
import { CLOCK_SKEW_MS, fetchWeekPrices, isFetchFailure } from '../_shared/week-price.ts';
import { type DraftRow, type LeagueRow, readAllPages, type SlotRow, slotsFromRows } from '../record-trade/commit.ts';
import { seasonEndFromMatchups, type SeasonMatchupRow } from '../record-trade/gate.ts';
import { fetchDraftableAmong } from '../record-trade/preview-gate.ts';
import type { ClaimRow, CommitPlan, OrderRow } from './plan.ts';
import type { CommitReply, Ledger, LeagueState, Prices, R, RunDay, RunDeps } from './run.ts';

/** The leagues columns record-trade reads (index.ts LEAGUE_COLUMNS). */
export const LEAGUE_COLUMNS = 'id, num_rounds, draft_status, season_status, stake_mode, budget_amount, notional_per_slot, allow_undraftable';

/**
 * SEAM 3 (plan.ts lists all three): the is_draftable facts the run's not_draftable test reads, for
 * every claimed stock, in ONE place. Today: symbols.is_draftable as it stands (record-trade's own
 * read, fetchDraftableAmong: a missing row is not draftable). The not_draftable TEST itself stays
 * the buy path's (refusesAsNotDraftable inside decideTrade); only where its input comes from may
 * change (e.g. a fresh re-check of the stock's data just before the run).
 */
export function readClaimDraftability(
  // deno-lint-ignore no-explicit-any
  admin: any,
  symbols: string[],
): Promise<{ ok: true; draftable: Set<string> } | { ok: false }> {
  return fetchDraftableAmong(admin, symbols);
}

const errText = (e: unknown) => {
  const x = e as { code?: string; message?: string } | null;
  return x?.code ?? x?.message ?? String(e);
};

export function makeRunDeps(
  // deno-lint-ignore no-explicit-any
  admin: any,
  alpacaKey: string,
  alpacaSecret: string,
  now: () => Date = () => new Date(),
): RunDeps {
  return {
    now,

    async runDay(): Promise<R<RunDay>> {
      const { data, error } = await admin.rpc('claims_run_day');
      if (error) return { ok: false, error: errText(error) };
      const d = data as { open?: unknown; session_date?: unknown; session_open_at?: unknown; due?: unknown } | null;
      if (!d || typeof d.open !== 'boolean' || !Array.isArray(d.due)) return { ok: false, error: 'unexpected reply' };
      const openMs = typeof d.session_open_at === 'string' ? Date.parse(d.session_open_at) : NaN;
      return {
        ok: true,
        value: {
          open: d.open,
          sessionDate: typeof d.session_date === 'string' ? d.session_date : null,
          sessionOpenMs: Number.isFinite(openMs) ? openMs : null,
          due: d.due.map(String),
        },
      };
    },

    async leagueState(leagueId, runDate): Promise<R<LeagueState>> {
      const { data, error } = await admin.rpc('claims_run_state', { p_league_id: leagueId, p_run_date: runDate });
      if (error) return { ok: false, error: errText(error) };
      const d = data as { already_ran?: unknown; claims?: unknown; order?: unknown } | null;
      if (!d || typeof d.already_ran !== 'boolean' || !Array.isArray(d.claims) || !Array.isArray(d.order)) {
        return { ok: false, error: 'unexpected reply' };
      }
      return { ok: true, value: { alreadyRan: d.already_ran, claims: d.claims as ClaimRow[], order: d.order as OrderRow[] } };
    },

    async ledger(leagueId, claims): Promise<R<Ledger>> {
      const { data: league, error: lErr } = await admin.from('leagues').select(LEAGUE_COLUMNS).eq('id', leagueId).maybeSingle();
      if (lErr) return { ok: false, error: `league: ${errText(lErr)}` };
      if (!league) return { ok: false, error: 'league_not_found' };

      const mRes = await readAllPages<SeasonMatchupRow>((from, to) =>
        admin.from('matchups').select('week_end, is_playoff', { count: 'exact' })
          .eq('league_id', leagueId).order('id', { ascending: true }).range(from, to)
      );
      if (!mRes.ok) return { ok: false, error: `matchups: ${errText(mRes.error)}` };

      const picksRes = await readAllPages<DraftRow>((from, to) =>
        admin.from('drafts')
          .select('id, user_id, symbol, entry_price, quantity, pick_number, slot_id', { count: 'exact' })
          .eq('league_id', leagueId)
          .order('created_at', { ascending: true }).order('id', { ascending: true })
          .range(from, to)
      );
      if (!picksRes.ok) return { ok: false, error: `drafts: ${errText(picksRes.error)}` };

      const tradesRes = await readAllPages<TradeRow>((from, to) =>
        admin.from('trades')
          .select('id, user_id, symbol, action, quantity, price, total_value, created_at, funded_by_trade_id, slot_id', { count: 'exact' })
          .eq('league_id', leagueId)
          .order('created_at', { ascending: true }).order('id', { ascending: true })
          .range(from, to)
      );
      if (!tradesRes.ok) return { ok: false, error: `trades: ${errText(tradesRes.error)}` };
      // trades.user_id is UUID: normalise to string (the drafts-TEXT / trades-UUID footgun).
      const trades = tradesRes.rows.map((t) => ({ ...t, user_id: String(t.user_id) }));

      const { data: slotData, error: sErr } = await admin
        .from('league_draft_slots')
        .select('id, slot_index, slot_count, price_min, price_max, category_id')
        .eq('league_id', leagueId)
        .order('slot_index', { ascending: true });
      if (sErr) return { ok: false, error: `slots: ${errText(sErr)}` };
      const slots = (slotData ?? []) as SlotRow[];

      const claimed = [...new Set(claims.map((c) => c.symbol))].sort();
      const dr = await readClaimDraftability(admin, claimed);
      if (!dr.ok) return { ok: false, error: 'is_draftable read failed' };

      let eligibility = new Map<string, Set<string>>();
      let heldEligibility: Map<string, Set<string>> | undefined;
      if (slots.some((s) => s.category_id != null)) {
        try {
          eligibility = await fetchEligibleCategoryIdsBatch(admin, claimed);
          const legacy = new Set<string>();
          for (const u of new Set(claims.map((c) => c.user_id))) {
            for (const s of unattributedHeldSymbols(u, slotsFromRows(slots), picksRes.rows, trades)) legacy.add(s);
          }
          if (legacy.size > 0) heldEligibility = await fetchEligibleCategoryIdsBatch(admin, [...legacy]);
        } catch (e) {
          return { ok: false, error: `eligibility: ${errText(e)}` };
        }
      }

      return {
        ok: true,
        value: {
          league: league as LeagueRow,
          seasonEnd: seasonEndFromMatchups(mRes.rows),
          picks: picksRes.rows,
          trades,
          slots,
          draftable: dr.draftable,
          eligibility,
          heldEligibility,
        },
      };
    },

    async prices(symbols, sessionDate, sessionOpenMs): Promise<R<Prices>> {
      const p = await fetchWeekPrices({
        symbols,
        bar: { sessionDate, field: 'o' },
        live: { fromMs: sessionOpenMs, toMs: now().getTime() + CLOCK_SKEW_MS },
        prevClose: null,
      }, alpacaKey, alpacaSecret);
      const fetchFailed = new Set<string>();
      for (const [s, reason] of p.unpriced) if (isFetchFailure(reason)) fetchFailed.add(s);
      if (p.errors.length > 0) console.warn('claims-run: price errors', JSON.stringify(p.errors.slice(0, 5)));
      return { ok: true, value: { prices: p.prices, fetchFailed } };
    },

    async commit(leagueId, runDate, plan: CommitPlan): Promise<R<CommitReply>> {
      const { data, error } = await admin.rpc('commit_claims_run', { p_league_id: leagueId, p_run_date: runDate, p_plan: plan });
      if (error) return { ok: false, error: errText(error) };
      const d = data as CommitReply | null;
      if (!d || typeof d.ok !== 'boolean') return { ok: false, error: 'unexpected reply' };
      return { ok: true, value: d };
    },

    log: (msg, detail) => console.warn('claims-run:', msg, detail === undefined ? '' : JSON.stringify(detail)),
  };
}
