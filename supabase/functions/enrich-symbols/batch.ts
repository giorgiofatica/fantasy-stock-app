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
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { computeIsDraftable } from '../_shared/symbol-eligibility.ts';
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
    return { status: 'transient' };
  }
}

/** One Alpaca snapshots request for one chunk of symbols. Logs a truncated
 * 400 body (Alpaca's own error message names the offending symbol) so a
 * genuine format gap in ALPACA_TICKER_RE is diagnosable from logs alone. */
function makeAlpacaFetcher(key: string, secret: string): (symbols: string[]) => Promise<BatchFetchResult> {
  return async (symbols: string[]): Promise<BatchFetchResult> => {
    const url = `https://data.alpaca.markets/v2/stocks/snapshots?symbols=${
      symbols.map(encodeURIComponent).join(',')
    }&feed=iex`;
    try {
      const res = await fetch(url, {
        headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret, 'Accept': 'application/json' },
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

/** What one run did. Logged as ONE structured line by ./handler.ts. `ok` means
 * "the run completed"; price_status is the separately-scoped pricing verdict
 * (CLAUDE.md "success signals" #7). */
export type EnrichResult = Record<string, unknown> & { ok: true; batch: number };

/**
 * Run one enrichment batch to completion. Throws on a failed batch-selection
 * query (nothing has been written at that point). Per-row update failures are
 * logged and skipped, exactly as before.
 */
export async function runEnrichBatch(cfg: EnrichConfig, batchSize: number): Promise<EnrichResult> {
  // The service-role client is built HERE, in the file that reads symbols, so
  // supabase/tests/symbols_readers.test.ts can see that each symbols read in
  // this file goes through the secret-key client.
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SB_SECRET_KEY_INTERNAL')!);

  // price_unsupported is filtered on (priority query below) but not selected:
  // the per-row loop recomputes it fresh from partitionForAlpaca every pass
  // rather than reading back a stale value (see the comment at its write).
  const selectCols = 'symbol, exchange, is_etf, active, gics_industry, last_price, market_cap';

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
  const bisectResult = await fetchPricesBisecting(alpacaEligible, makeAlpacaFetcher(cfg.alpacaKey, cfg.alpacaSecret));
  const priceErrorSet = new Set(bisectResult.failed);
  const formatUnsupportedSet = new Set(formatUnsupported);

  let profiled = 0;
  let priced = 0;
  let skippedEtf = 0;
  let draftable = 0;
  let transientAbort = false;
  const unmatched = new Set<string>();

  for (const row of batch) {
    const symbol = String(row.symbol);
    let industry: string | null = row.gics_industry ?? null;
    let marketCap: number | null = row.market_cap == null ? null : Number(row.market_cap);

    if (row.is_etf === true) {
      skippedEtf++; // funds have no profile2 data; category layer handles them
    } else {
      const prof = await fetchProfile(symbol, cfg.finnhubToken);
      if (prof.status === 'transient') {
        // Abort WITHOUT advancing this symbol's cursor — next run retries.
        transientAbort = true;
        break;
      }
      if (prof.status === 'ok') {
        industry = prof.industry ?? null;
        marketCap = prof.marketCap ?? null;
        profiled++;
        if (industry && !knownIndustries.has(industry)) unmatched.add(industry);
      }
      // 'empty' still advances the cursor (permanent miss — see header).
      await sleep(FINNHUB_SPACING_MS);
    }

    // Price outcome for this symbol, in priority order:
    //   1. format-unsupported (never sent to Alpaca) -> permanent, no error
    //   2. priced by Alpaca this run -> new last_price
    //   3. request-level failure (bisected 400 / cap-truncated) -> price_error,
    //      last_price left untouched so the row stays in the priority tier
    //   4. request succeeded but Alpaca had no data -> benign miss, keep old price
    // Case 3 (price_error) and case 4 (benign no-data) both leave `newPrice`
    // undefined and so fall through to the same "keep old price" branch
    // below — they differ only in the AGGREGATE price_errors/price_error_symbols
    // reporting at the end of this function, built directly from priceErrorSet.
    const isFormatUnsupported = formatUnsupportedSet.has(symbol);
    const newPrice = bisectResult.prices.get(symbol);

    const lastPrice = newPrice ?? (row.last_price == null ? null : Number(row.last_price));
    if (newPrice !== undefined) priced++;
    // partitionForAlpaca classifies every symbol in the batch on every pass,
    // so this is simply that verdict — no reason to preserve a stale prior
    // value (format never changes; a price_error is a fetch failure, not a
    // format verdict, and does not affect this flag).
    const priceUnsupported = isFormatUnsupported;

    const is_draftable = computeIsDraftable({
      active: row.active,
      exchange: row.exchange ?? null,
      is_etf: row.is_etf ?? null,
      last_price: lastPrice,
      market_cap: marketCap,
    });
    if (is_draftable) draftable++;

    const { error: upErr } = await admin
      .from('symbols')
      .update({
        gics_industry: industry,
        market_cap: marketCap,
        last_price: lastPrice,
        price_unsupported: priceUnsupported,
        is_draftable,
        enriched_at: new Date().toISOString(),
      })
      .eq('symbol', symbol);
    if (upErr) {
      console.error('update failed', symbol, upErr.message);
      // continue: one bad row must not starve the rest of the batch
    }
  }

  const priceErrorSymbols = [...priceErrorSet].slice(0, PRICE_ERROR_SYMBOLS_LOGGED);
  const priceStatus = computePriceStatus(alpacaEligible.length, priced, priceErrorSet.size);

  return {
    ok: true,
    batch: batch.length,
    profiled,
    priced,
    skipped_etf: skippedEtf,
    draftable_in_batch: draftable,
    transient_abort: transientAbort,
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
