// record-trade's preview: the buy's own draftable gate, and the pacing of the
// category read.
//
// Plan: docs/plans/2026-11-18-stocks-tab.md, part 3, "Settled during the build"
// point 7 (corrected 2026-11-23). Before this, a preview naming a symbol read
// that symbol's category and answered `would_fill` for ANY stock, at the
// function's 30 calls a minute with no hourly or daily limit. In a league with
// category slots that told any member whether any stock belongs to a category
// (Giorgio, 2026-10-08: "I don't want people to be able to scrape anything").
//
// TWO RULES, deliberately of different widths:
//   1. THE GATE (fetchIsDraftable / fetchDraftableAmong + refusesAsNotDraftable,
//      the one test the buy and the draft run). EVERY preview that names a stock
//      applies it, slot-less leagues included, so a preview always answers as
//      the buy would: a stock the buy would refuse as not_draftable gets that
//      same refusal and its category is never read. The list preview applies it
//      per row (a null row).
//   2. THE COUNTER (paceCategoryPreview). 200 an hour and 500 a day per person
//      (the watchlist's save numbers), on buckets of their OWN, so a buy or a
//      sell is never refused by them. It counts only a preview that actually
//      reads a category: a stock named AND the league has a category slot. It
//      sits beside that read (index.ts readLedger), not at the top of the
//      handler. It exists for the full-universe league, where every stock passes
//      the gate and so every stock must stay answerable.
//      Past either limit the preview answers PREVIEW_LIMITED_REPLY: a 200 with
//      reason `preview_limited`, NOT the 429 `rate_limited` of the per-minute
//      limiter, so the app can tell an hour/day cap from the minute's (the 429
//      reaches the app as an invoke error; this arrives as data). The app has no
//      words for it yet (the Design Lead's go to Giorgio first) and renders it
//      as it renders today's refusals: "Couldn't reach trading".
//      The LIST preview is not counted: it answers only the caller's own saved
//      stocks, and saving is already paced the same way (20261209000000).
//
// FAIL-CLOSED on a limiter error, unlike record-trade's 30-a-minute limiter
// (index.ts rateLimitOk, fail-open). That one sits in front of buys and sells,
// and a limiter blip must not stop a manager trading. This one sits in front of
// an advisory read only: refusing it costs one slot line (the buy re-validates
// at the live price anyway), while failing open would leave the category read
// unpaced exactly when the limiter cannot count. A limiter error is a 500
// (`unhandled`), never `preview_limited`: a failure must not read as a routine
// refusal (CLAUDE.md, "success signals").
import { refusesAsNotDraftable } from '../_shared/draft-validation.ts';
import { type LeagueRow, type Reply, rulesFromLeague, type Step, unhandled } from './commit.ts';

/** The preview's own pacing windows. Bucket names are new and used nowhere
 * else, so these counters never touch the buy/sell limiter ('record-trade'). */
export const PREVIEW_PACING = [
  { bucket: 'record-trade-preview-hour', limit: 200, windowSeconds: 3600 },
  { bucket: 'record-trade-preview-day', limit: 500, windowSeconds: 86400 },
] as const;

/** The buy's own refusal, as decideTrade words it (a 200 game-flow refusal). */
export const NOT_DRAFTABLE_REPLY: Reply = { status: 200, body: { ok: false, reason: 'not_draftable' } };

/** Past the hour or day cap: { ok: false, reason: 'preview_limited' }, HTTP 200. Its own reason,
 * distinct from the per-minute limiter's 429 `rate_limited` (index.ts rateLimitOk). */
export const PREVIEW_LIMITED_REPLY: Reply = { status: 200, body: { ok: false, reason: 'preview_limited' } };

/**
 * Bumps both preview windows for the caller. ok = under both limits. A
 * resolved `{ error }` (supabase-js .rpc() never throws on a Postgres error),
 * a thrown transport error, or an answer that is not a boolean is a 500.
 */
export async function paceCategoryPreview(
  // deno-lint-ignore no-explicit-any
  admin: any,
  userId: string,
): Promise<Step<null>> {
  let results: Array<{ data: unknown; error: unknown }>;
  try {
    results = await Promise.all(PREVIEW_PACING.map((p) =>
      admin.rpc('check_and_bump_rate_limit', {
        p_bucket: p.bucket,
        p_subject: `user:${userId}`,
        p_limit: p.limit,
        p_window_seconds: p.windowSeconds,
      })
    ));
  } catch (_e) {
    console.error('record-trade: preview pacing threw');
    return { ok: false, reply: unhandled() };
  }
  if (results.some((r) => r.error != null || typeof r.data !== 'boolean')) {
    console.error('record-trade: preview pacing error', results.map((r) => (r.error as { code?: string } | null)?.code ?? ''));
    return { ok: false, reply: unhandled() };
  }
  if (results.some((r) => r.data === false)) return { ok: false, reply: PREVIEW_LIMITED_REPLY };
  return { ok: true, value: null };
}

/**
 * symbols.is_draftable for ONE symbol, read as the buy reads it: an `eq`
 * filter (the client's string never reaches an `in.(...)` list) and a missing
 * row is NOT draftable. A read error is ok:false (the caller's 500), never a
 * guess either way.
 */
export async function fetchIsDraftable(
  // deno-lint-ignore no-explicit-any
  admin: any,
  symbol: string,
): Promise<{ ok: true; isDraftable: boolean } | { ok: false }> {
  const { data, error } = await admin.from('symbols').select('is_draftable').eq('symbol', symbol).maybeSingle();
  if (error) {
    console.error('record-trade: is_draftable read error', error.code ?? '');
    return { ok: false };
  }
  return { ok: true, isDraftable: data?.is_draftable === true };
}

/**
 * Of `symbols`, the ones the catalog marks draftable (one read). A symbol with
 * no row is not in the set, so it reads as not draftable, as for the buy.
 * Called only with symbols that came back from the caller's own watchlist read
 * (preview-list.ts), never with a requested string.
 */
export async function fetchDraftableAmong(
  // deno-lint-ignore no-explicit-any
  admin: any,
  symbols: string[],
): Promise<{ ok: true; draftable: Set<string> } | { ok: false }> {
  if (symbols.length === 0) return { ok: true, draftable: new Set() };
  const { data, error } = await admin.from('symbols').select('symbol, is_draftable').in('symbol', symbols);
  if (error) {
    console.error('record-trade: is_draftable read error', error.code ?? '');
    return { ok: false };
  }
  const draftable = new Set<string>();
  for (const r of (data ?? []) as Array<{ symbol: unknown; is_draftable: unknown }>) {
    if (r.is_draftable === true) draftable.add(String(r.symbol));
  }
  return { ok: true, draftable };
}

/** The single preview's gate: the refusal the buy would give, or null to answer.
 * The league's rules go through rulesFromLeague, as the buy's decideTrade does. */
export function previewRefusal(isDraftable: boolean, league: LeagueRow): Reply | null {
  return refusesAsNotDraftable(isDraftable, rulesFromLeague(league)) ? NOT_DRAFTABLE_REPLY : null;
}
