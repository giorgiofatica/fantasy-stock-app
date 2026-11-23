/**
 * One multi-symbol snapshots call for the top movers run (IEX feed, the app key).
 *
 * Kept here rather than in _shared/alpaca-price.ts so no other function's deployed bytes
 * change. The price itself is still the shared chain's (rank.ts calls parseSnapshotPrices);
 * this file only fetches the bodies and reports what the source said about its limits.
 *
 * A REFUSAL IS A FAILED BATCH (the plan, "Open" item 2): any non-2xx (a 429 included), a
 * network error, the timeout, or a body that is not a JSON object returns ok:false, and the
 * run then keeps the previous ranking. The endpoint is all-or-nothing (one unlisted symbol
 * 400s the whole call, CLAUDE.md "success signals" #7); the set is draftable PRICED stocks,
 * which enrich-symbols has already priced through this same endpoint, so a 400 here is a
 * real fault to report, not a symbol to bisect away.
 *
 * RATE LIMITS: the one documented rate is 200 calls a minute on the Basic plan, and whether
 * snapshot calls count under it is not stated (the Researcher, 2026-11-22). Ten calls every
 * five minutes is far below it. Every call returns the X-RateLimit-* headers it got, and the
 * run writes them into its one log line, so a tightening limit is visible before it refuses.
 */

const SNAPSHOTS_URL = 'https://data.alpaca.markets/v2/stocks/snapshots';

/** One call's own timeout. Ten sequential calls stay well inside the edge wall clock. */
export const SNAPSHOT_BATCH_TIMEOUT_MS = 10_000;

export interface RateLimitHeaders {
  limit: string | null;
  remaining: string | null;
  reset: string | null;
}

export type BatchResult =
  | { ok: true; status: number; body: Record<string, unknown>; rateLimit: RateLimitHeaders }
  | { ok: false; status: number; error: string; rateLimit: RateLimitHeaders };

const NO_HEADERS: RateLimitHeaders = { limit: null, remaining: null, reset: null };

export function rateLimitHeaders(h: Headers): RateLimitHeaders {
  return {
    limit: h.get('x-ratelimit-limit'),
    remaining: h.get('x-ratelimit-remaining'),
    reset: h.get('x-ratelimit-reset'),
  };
}

export function snapshotsUrl(symbols: readonly string[]): string {
  return `${SNAPSHOTS_URL}?symbols=${symbols.map(encodeURIComponent).join(',')}&feed=iex`;
}

export async function fetchSnapshotBatch(
  symbols: readonly string[],
  key: string,
  secret: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BatchResult> {
  let res: Response;
  try {
    res = await fetchImpl(snapshotsUrl(symbols), {
      signal: AbortSignal.timeout(SNAPSHOT_BATCH_TIMEOUT_MS),
      headers: {
        'APCA-API-KEY-ID': key,
        'APCA-API-SECRET-KEY': secret,
        'Accept': 'application/json',
      },
    });
  } catch (e) {
    // Network error or the timeout: no status, no headers.
    return { ok: false, status: 0, error: e instanceof Error ? e.name : 'fetch_error', rateLimit: NO_HEADERS };
  }
  const rateLimit = rateLimitHeaders(res.headers);
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    // The status alone: a body preview could echo request details into the logs.
    return { ok: false, status: res.status, error: 'http_error', rateLimit };
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, status: res.status, error: 'bad_json', rateLimit };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: res.status, error: 'bad_body', rateLimit };
  }
  return { ok: true, status: res.status, body: body as Record<string, unknown>, rateLimit };
}
