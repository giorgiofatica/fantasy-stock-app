// enrich-symbols batch: the WORK of one run, moved out of index.ts unchanged
// (2026-11-11) so the handler can answer the cron at once and run this in the
// background (see ./handler.ts for why). Batch selection, Finnhub pacing, price
// bisecting and the enriched_at cursor rules are exactly what index.ts did
// inline before; the rules themselves are written up in index.ts's header.
//
// Two differences, both about WHERE an outcome is reported, not what happens:
//   - a failed batch-selection query used to return HTTP 500 {error:'select_failed'};
//     it now THROWS, and ./handler.ts logs the throw as a failed run;
//   - the result object is returned to the caller (which logs it) instead of
//     being sent as the HTTP response body.
//
// 2026-11-24 (claims-fix-themselves plan, fix 3; rules in ./plan.ts, order in
// ./run.ts): a run judges every stock before it writes any. An "ok" profile
// answer missing a size or industry keeps the known one. A run whose NEW drops
// from the list exceed massDropLimit(judged) holds them (cursor + mark, nothing
// else) and ends ok:false / mass_drop_refused; a held stock's second reading
// clears or drops it. Judging stops at a transient supplier answer or at the
// run's own deadline (RUN_FETCH_DEADLINE_MS), and the judged stocks are still
// written. Every supplier call has a timeout (SUPPLIER_CALL_TIMEOUT_MS) and
// the Alpaca phase a budget (PRICE_PHASE_BUDGET_MS).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { MARK_QUIET_MS, planRow, type ProfileOutcome, type SymbolRow } from './plan.ts';
import { outcomeFields, PRICE_PHASE_BUDGET_MS, RUN_FETCH_DEADLINE_MS, runJudged, SUPPLIER_CALL_TIMEOUT_MS } from './run.ts';
import {
  computePriceStatus,
  fetchPricesBisecting,
  mergeBatchSelection,
  partitionForAlpaca,
  priorityCapFor,
  type BatchFetchResult,
} from './price-batch.ts';

export const DEFAULT_BATCH = 50;
export const MAX_BATCH = 80; // 80 * 1100ms = 88s Finnhub time — headroom under the 150s edge wall clock
const FINNHUB_SPACING_MS = 1100; // stay under 60 calls/min
const PRICE_ERROR_SYMBOLS_LOGGED = 20; // cap the rejected-symbols list in the log

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Clamp the request's `limit` to [1, MAX_BATCH], defaulting to DEFAULT_BATCH. */
export function batchSizeFor(limit: unknown): number {
  return Math.min(Math.max(Number(limit) || DEFAULT_BATCH, 1), MAX_BATCH);
}

interface ProfileResult {
  status: 'ok' | 'empty' | 'transient';
  industry?: string | null;
  marketCap?: number | null; // dollars
}

async function fetchProfile(symbol: string, token: string): Promise<ProfileResult> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${token}`,
      // A hung call times out as 'transient' (the run stops judging and writes
      // what it has; ./run.ts). The signal also bounds reading the body.
      { signal: AbortSignal.timeout(SUPPLIER_CALL_TIMEOUT_MS) },
    );
    if (res.status === 429 || res.status >= 500) return { status: 'transient' };
    if (!res.ok) return { status: 'empty' }; // 4xx: no profile for this symbol
    const body = await res.json().catch(() => null);
    if (!body || Object.keys(body).length === 0) return { status: 'empty' };
    const industry = typeof body.finnhubIndustry === 'string' && body.finnhubIndustry.trim()
      ? body.finnhubIndustry.trim()
      : null;
    // profile2 marketCapitalization is in MILLIONS of USD.
    const capM = Number(body.marketCapitalization);
    const marketCap = Number.isFinite(capM) && capM > 0 ? capM * 1_000_000 : null;
    return { status: 'ok', industry, marketCap };
  } catch {
    // Deliberately NOT logged: a fetch rejection's message carries the request
    // URL, and this URL carries the Finnhub token in its query string. A
    // timeout (SUPPLIER_CALL_TIMEOUT_MS) lands here too, as 'transient'.
    return { status: 'transient' };
  }
}

/** One Alpaca snapshots request for one chunk of symbols. Logs a truncated
 * 400 body (Alpaca's own error message names the offending symbol) so a
 * genuine format gap in ALPACA_TICKER_RE is diagnosable from logs alone. */
function makeAlpacaFetcher(
  key: string,
  secret: string,
  phaseDeadlineMs: number,
): (symbols: string[]) => Promise<BatchFetchResult> {
  return async (symbols: string[]): Promise<BatchFetchResult> => {
    // Bisection retries ANY failed request, a timeout included, so a hung
    // Alpaca could cost MAX_ALPACA_REQUESTS x the call timeout. Past the price
    // phase's budget every remaining request fails at once instead (those
    // stocks keep their last price, as any failed price answer does).
    const left = phaseDeadlineMs - Date.now();
    if (left <= 0) return { ok: false, status: 0 };
    const url = `https://data.alpaca.markets/v2/stocks/snapshots?symbols=${
      symbols.map(encodeURIComponent).join(',')
    }&feed=iex`;
    try {
      const res = await fetch(url, {
        headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(Math.min(SUPPLIER_CALL_TIMEOUT_MS, left)),
      });
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        console.error('alpaca snapshots failed', res.status, bodyText.slice(0, 300), 'chunk_size', symbols.length);
        return { ok: false, status: res.status };
      }
      const body = await res.json().catch(() => ({}));
      const prices = new Map<string, number>();
      for (const sym of symbols) {
        const snap = body?.[sym];
        const p = Number(snap?.latestTrade?.p) || Number(snap?.dailyBar?.c) || Number(snap?.prevDailyBar?.c);
        if (Number.isFinite(p) && p > 0) prices.set(sym, p);
      }
      return { ok: true, prices };
    } catch (e) {
      console.error('alpaca snapshots error', e, 'chunk_size', symbols.length);
      return { ok: false, status: 0 };
    }
  };
}

export interface EnrichConfig {
  finnhubToken: string;
  alpacaKey: string;
  alpacaSecret: string;
}

/** What one run did. Logged as ONE structured line by ./handler.ts. `ok` is
 * false when the run held any stock off a drop (error: 'mass_drop_refused') or
 * could not record a hold (error: 'hold_write_failed'); see ./run.ts
 * outcomeFields. `stopped` says whether it judged its whole batch. price_status is the
 * separately-scoped pricing verdict (CLAUDE.md "success signals" #7). */
export type EnrichResult = Record<string, unknown> & { ok: boolean; batch: number };

/**
 * Run one enrichment batch to completion. Throws on a failed batch-selection
 * query (nothing has been written at that point). Per-row update failures are
 * logged and skipped, exactly as before.
 */
export async function runEnrichBatch(cfg: EnrichConfig, batchSize: number): Promise<EnrichResult> {
  const startedMs = Date.now();
  // The service-role client is built HERE, in the file that reads symbols, so
  // supabase/tests/symbols_readers.test.ts can see that each symbols read in
  // this file goes through the secret-key client.
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SB_SECRET_KEY_INTERNAL')!);

  // price_unsupported is filtered on (priority query below) but not selected:
  // the per-row loop recomputes it fresh from partitionForAlpaca every pass
  // rather than reading back a stale value (see the comment at its write).
  // is_draftable is "on the list BEFORE this run" and list_drop_held_at is an
  // earlier refusal's hold, both for the mass-drop guard (./plan.ts decideRun).
  const selectCols = 'symbol, exchange, is_etf, active, gics_industry, last_price, market_cap, is_draftable, list_drop_held_at';

  // Priority tier: unpriced AND not permanently-unsupported, stalest-first,
  // capped at half the batch (starvation guard — see price-batch.ts).
  const priorityCap = priorityCapFor(batchSize);
  const { data: priorityRows, error: prioErr } = await admin
    .from('symbols')
    .select(selectCols)
    .eq('active', true)
    .is('last_price', null)
    .eq('price_unsupported', false)
    .order('enriched_at', { ascending: true, nullsFirst: true })
    .limit(priorityCap);
  if (prioErr) throw new Error(`select_failed (priority): ${prioErr.message}`);

  // Normal stalest-first pool, excluding whatever the priority query already
  // picked so the merge below never has to dedupe past a LIMIT boundary.
  const prioritySymbols = (priorityRows ?? []).map((r) => String(r.symbol));
  let stalestQuery = admin
    .from('symbols')
    .select(selectCols)
    .eq('active', true)
    .order('enriched_at', { ascending: true, nullsFirst: true })
    .limit(batchSize);
  if (prioritySymbols.length > 0) {
    stalestQuery = stalestQuery.not('symbol', 'in', `(${prioritySymbols.join(',')})`);
  }
  const { data: stalestRows, error: staleErr } = await stalestQuery;
  if (staleErr) throw new Error(`select_failed (stalest): ${staleErr.message}`);

  const batch = mergeBatchSelection(priorityRows ?? [], stalestRows ?? [], batchSize);
  if (batch.length === 0) return { ok: true, batch: 0 };

  // Known rule keys, to report unmatched vendor labels for curation.
  const { data: ruleRows } = await admin.from('category_rules').select('gics_industry');
  const knownIndustries = new Set((ruleRows ?? []).map((r) => String(r.gics_industry)));

  // Price fetch for the whole batch, up front (ETFs included — Alpaca still
  // prices them). Format-unsupported symbols never reach Alpaca at all.
  const { eligible: alpacaEligible, unsupported: formatUnsupported } = partitionForAlpaca(
    batch.map((r) => String(r.symbol)),
  );
  const bisectResult = await fetchPricesBisecting(
    alpacaEligible,
    makeAlpacaFetcher(cfg.alpacaKey, cfg.alpacaSecret, startedMs + PRICE_PHASE_BUDGET_MS),
  );
  const priceErrorSet = new Set(bisectResult.failed);
  const formatUnsupportedSet = new Set(formatUnsupported);

  let profiled = 0;
  let priced = 0;
  let skippedEtf = 0;
  const unmatched = new Set<string>();

  // Judge, decide, then write, in the order ./run.ts sets out.
  const outcome = await runJudged({
    rows: batch as SymbolRow[],
    nowMs: Date.now,
    deadlineMs: startedMs + RUN_FETCH_DEADLINE_MS,
    judge: async (row) => {
      const symbol = String(row.symbol);
      let prof: ProfileOutcome = { status: 'skipped' };
      if (row.is_etf === true) {
        skippedEtf++; // funds have no profile2 data; category layer handles them
      } else {
        const answer = await fetchProfile(symbol, cfg.finnhubToken);
        // Transient: stop WITHOUT advancing this symbol's cursor; next run retries.
        if (answer.status === 'transient') return 'transient';
        if (answer.status === 'ok') {
          prof = { status: 'ok', industry: answer.industry ?? null, marketCap: answer.marketCap ?? null };
          profiled++;
          if (answer.industry && !knownIndustries.has(answer.industry)) unmatched.add(answer.industry);
        } else {
          prof = { status: 'empty' }; // still advances the cursor (permanent miss — see header)
        }
        await sleep(FINNHUB_SPACING_MS);
      }
      // Price outcome, in priority order:
      //   1. format-unsupported (never sent to Alpaca) -> permanent, no error
      //   2. priced by Alpaca this run -> new last_price
      //   3. request-level failure (bisected 400 / cap / timeout / price-phase
      //      budget) -> price_error, last_price left as it was
      //   4. request succeeded but Alpaca had no data -> benign miss, keep old price
      // Cases 3 and 4 both leave `newPrice` undefined, so planRow keeps the old
      // price; they differ only in the price_errors reporting at the end.
      const newPrice = bisectResult.prices.get(symbol);
      if (newPrice !== undefined) priced++;
      return planRow(row, prof, newPrice, formatUnsupportedSet.has(symbol));
    },
    recentMarkExists: async () => {
      const cutoff = new Date(Date.now() - MARK_QUIET_MS).toISOString();
      const { data, error } = await admin
        .from('symbols')
        .select('symbol')
        .gt('list_drop_held_at', cutoff)
        .limit(1);
      // A failed read THROWS: run.ts counts it as a recent hold (hold, never
      // drop) and reports list_recent_mark_read_failed.
      if (error) throw new Error(`recent hold read failed: ${error.message}`);
      return (data ?? []).length > 0;
    },
    writeHolds: async (symbols, values) => {
      // values = cursor + mark ONLY (run.ts holdValues): size, price, industry
      // and is_draftable stay as they were. One statement for every held stock.
      const { error } = await admin
        .from('symbols')
        .update(values)
        .in('symbol', symbols);
      if (error) console.error('hold write failed', error.message);
      return error ? error.message : null;
    },
    writeRow: async (symbol, values) => {
      const { error } = await admin
        .from('symbols')
        .update(values)
        .eq('symbol', symbol);
      // continue on error: one bad row must not starve the rest of the batch
      if (error) console.error('update failed', symbol, error.message);
      return error ? error.message : null;
    },
  });

  // REPAIR-LOG HOOK (workstream 2, plan fix 4). When outcome.decision.hold is
  // non-empty, write ONE repair-log row here: "a refresh that refused to
  // apply", with decision.heldNew and decision.heldAgain. A second reading
  // that clears (decision.cleared) or drops (part of decision.dropped) writes
  // no row. Not built in workstream 3.

  const draftable = outcome.decision.rows.filter((r) => r.values.is_draftable).length;

  const priceErrorSymbols = [...priceErrorSet].slice(0, PRICE_ERROR_SYMBOLS_LOGGED);
  const priceStatus = computePriceStatus(alpacaEligible.length, priced, priceErrorSet.size);

  return {
    // ok + stopped + the list_* fields (./run.ts outcomeFields): any hold makes
    // the run ok:false, which _shared/respond-fast.ts writes to the error stream.
    ...outcomeFields(outcome),
    batch: batch.length,
    profiled,
    priced,
    skipped_etf: skippedEtf,
    draftable_in_batch: draftable,
    unmatched_industries: [...unmatched],
    // Honest price-fetch reporting (found 2026-09-25: this used to report
    // ok:true, priced:0 on a whole-batch Alpaca 400 — see index.ts header).
    // `ok` above means "the run completed"; price_status is the separately-
    // scoped verdict for pricing specifically.
    price_status: priceStatus,
    price_errors: priceErrorSet.size,
    price_error_symbols: priceErrorSymbols,
    price_unsupported_in_batch: formatUnsupportedSet.size,
    alpaca_requests: bisectResult.requestCount,
    alpaca_request_cap_hit: bisectResult.capHit,
  };
}
