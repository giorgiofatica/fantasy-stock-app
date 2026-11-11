// enrich-symbols — Phase 4 symbols enrichment cron (DR-001 /
// SIMULATOR_MIGRATION_SPEC). Populates gics_industry, market_cap (Finnhub
// profile2), last_price (batched Alpaca snapshots calls), and computes
// is_draftable (../_shared/symbol-eligibility.ts) for a batch of the stalest
// symbols per run.
//
// WHY A 10-MINUTE BATCH CRON, NOT A DAILY FULL PASS: sector/industry comes
// from Finnhub (neither the NASDAQ Trader universe feed nor Alpaca's market
// data API exposes it), and Finnhub's free tier is 60 calls/min — a full
// ~14.4k-symbol pass cannot fit any single edge-function invocation. A batch
// of ~50 stalest-first every 10 minutes covers the universe in ~2 days and
// then sustains a ~2-day refresh cadence per symbol. gics_sector stays NULL:
// profile2 has no sector field; the column is reserved for a future
// GICS-grade source.
//
// CURSOR RULES, PROFILE (Finnhub, so the cron cannot wedge): a PERMANENT-
// looking miss (404 / empty profile — delisted, funds, foreign) still
// advances enriched_at, or the cursor would spin on the same dead symbols
// forever. A TRANSIENT failure (429 / 5xx / network) aborts the batch
// WITHOUT advancing the failed symbol's cursor, so the next run retries it.
//
// CURSOR RULES, PRICE (Alpaca — see ./price-batch.ts for the full writeup;
// found 2026-09-25, docs/STATUS.md §4 / CLAUDE.md "success signals are
// unreliable" #7): Alpaca's multi-symbol snapshots endpoint is all-or-
// nothing, so one malformed symbol used to 400 an ENTIRE 50-symbol batch and
// silently drop up to 49 good prices while still reporting ok:true. Fixed
// with two independent defenses — partitionForAlpaca filters out symbol
// FORMATS Alpaca's us_equity universe structurally does not list (preferred/
// warrant/unit/rights/when-issued forms) before ever sending them, and
// fetchPricesBisecting bisects on any 400 that slips through anyway so one
// bad symbol costs only itself. `symbols.price_unsupported` is the explicit
// discriminator (never overload `last_price IS NULL`, per CLAUDE.md
// "Overloaded NULLs are type tags") that keeps permanently-unpriceable
// formats out of the price-priority batch-selection tier below. enriched_at
// is NOT reused for price cursor purposes — it already means "profile pass
// completed" and is read that way by apps/web + apps/mobile categoryData
// (`.not('enriched_at','is',null)` as an enrichment-coverage signal); price
// state lives entirely in last_price / price_unsupported instead.
//
// BATCH SELECTION (backfill for the ~4,749 already-unpriced symbols found
// 2026-09-25): up to half of every batch is drawn from the unpriced-and-
// supported priority tier (mergeBatchSelection / priorityCapFor in
// ./price-batch.ts), the rest from the normal stalest-first pool. The half
// cap is a STARVATION guard: without it, once symbols that chronically fail
// Alpaca's price lookup accumulate, they could fill an entire batch forever
// and stop the stalest-first profile refresh of the other ~14k symbols.
//
// Auth: cron-only — verify_jwt=false at the gateway; constant-time apikey
// check against SB_SECRET_KEY_CRON in-code (snapshot-week-start pattern,
// fail-closed).
//
// RESPONSE vs OUTCOME (2026-11-11, docs/STATUS.md §4 item 28): the handler
// answers 202 {accepted:true, batch_limit} at once and runs the batch in the
// background (EdgeRuntime.waitUntil), because pg_net holds every later cron
// post behind a slow request. The 202 is not a success claim. The run's
// counts (batch/profiled/priced/draftable/price_errors/price_status,
// unmatched_industries, duration_ms) are ONE log line at the end of the
// background work: `enrich-symbols {...}`, or `enrich-symbols failed {...}` on
// a throw, or `enrich-symbols terminated with a batch in flight` if the
// runtime shuts the worker down first. See ./handler.ts and ./batch.ts.
//
// Effect-verify (per CLAUDE.md, counts not statuses): the scheduled job's real
// check is data movement —
//   SELECT max(enriched_at), count(*) FILTER (WHERE enriched_at IS NOT NULL) FROM symbols;
//   SELECT count(*) FILTER (WHERE active AND last_price IS NULL),
//          count(*) FILTER (WHERE is_draftable)
//   FROM symbols;
// max(enriched_at) advancing ~50 rows per run; the unpriced count trending down.
//
// OVERLAP: none in practice, and harmless if it happened. pg_cron fires every
// 10 minutes whether or not the previous run finished (it did before this
// change too: net.http_post never waited), and the edge wall clock (150 s
// free / 400 s paid) ends any run well inside 10 minutes. Two overlapping
// runs would select the same stalest rows and write the same values to them;
// the only cost is doubled Finnhub calls, and a 429 is a transient abort that
// leaves the cursor where it was.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { runEnrichBatch } from './batch.ts';
import { makeEnrichHandler } from './handler.ts';

// Batches handed to the runtime and not yet settled. Only read by the
// shutdown log below: a run the wall clock kills writes no outcome line of its
// own, so this is how that case stays visible in the logs.
let inFlight = 0;

function waitUntil(p: Promise<unknown>): void {
  inFlight++;
  const tracked = p.finally(() => {
    inFlight--;
  });
  // EdgeRuntime is the Supabase Edge Runtime global, read off globalThis at
  // call time (deno check does not see the edge-runtime.d.ts namespace, and the
  // wiring test installs a spy here). Absent under plain Deno, where the
  // promise simply runs on (it never rejects — see runInBackground).
  const edge = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): unknown } }).EdgeRuntime;
  edge?.waitUntil(tracked);
}

addEventListener('beforeunload', (ev) => {
  if (inFlight === 0) return;
  // The runtime's d.ts types detail as the reason string; Supabase's docs read
  // detail.reason. Accept either.
  const detail = (ev as CustomEvent<unknown>).detail as { reason?: unknown } | string | undefined;
  const reason = typeof detail === 'string' ? detail : detail?.reason ?? null;
  console.error('enrich-symbols terminated with a batch in flight', JSON.stringify({ reason, in_flight: inFlight }));
});

Deno.serve(makeEnrichHandler({ runBatch: runEnrichBatch, waitUntil }));
