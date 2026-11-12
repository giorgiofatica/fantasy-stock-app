/**
 * Respond-fast for cron-posted edge functions: answer the cron's HTTP request
 * AT ONCE and do the work under EdgeRuntime.waitUntil.
 *
 * WHY (found 2026-11-11, docs/STATUS.md §4 item 28): pg_net 0.14.0 does not
 * dispatch a request enqueued after a slow one until the slow one finishes. A
 * cron-posted function that keeps its request open N s delays EVERY later cron
 * post by up to N s, the 2 s draft auto-pick sweep included. Observed: the
 * enrich-symbols response created at 18:50:00.38, then nothing until 13
 * draft_autopick_sweep responses at the identical 18:50:43.62.
 *
 * Extracted from enrich-symbols (#396: handler.ts runInBackground, index.ts
 * waitUntil + beforeunload), whose behaviour is unchanged: the same log tags,
 * the same JSON payloads, the same shutdown line. Used by enrich-symbols and
 * draft-order-notify.
 *
 * WHAT THE 202 MEANS: only "authorized, configured, and the work was handed to
 * the runtime". It is NOT a success claim (CLAUDE.md "success signals" #4,
 * #7). The outcome is the ONE log line runInBackground writes when the work
 * ends; the real check stays the data the job writes.
 */

// Late-bound, so a console replaced after module load (a test capture, a
// runtime log shim) still receives the outcome line.
const defaultLog = (...args: unknown[]) => console.log(...args);
const defaultLogError = (...args: unknown[]) => console.error(...args);

/**
 * Run `work` to completion and write exactly one outcome line:
 *   `<tag> {...result, duration_ms}`            the work returned
 *   `<tag> failed {"ok":false,error,duration_ms}` the work threw
 * A result whose `ok` is exactly `false` (a run that ended early on a failed
 * read, say) is written with the plain tag but to the ERROR stream, so a
 * log filter on errors sees it. NEVER rejects: the promise handed to waitUntil
 * must not become an unhandled rejection, and a synchronous throw from `work`
 * is caught too (this is an async function).
 */
export async function runInBackground(
  tag: string,
  work: () => Promise<Record<string, unknown>>,
  log: (...args: unknown[]) => void = defaultLog,
  logError: (...args: unknown[]) => void = defaultLogError,
): Promise<void> {
  const started = Date.now();
  try {
    const result = await work();
    const line = JSON.stringify({ ...result, duration_ms: Date.now() - started });
    (result?.ok === false ? logError : log)(tag, line);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logError(`${tag} failed`, JSON.stringify({ ok: false, error: message, duration_ms: Date.now() - started }));
  }
}

/**
 * A waitUntil for one function's module scope, plus the shutdown log: a run the
 * wall clock kills writes no outcome line of its own, so while any work is in
 * flight a `beforeunload` writes `<tag> terminated with <unit> in flight
 * {"reason":...,"in_flight":N}`. Call ONCE per function, at module load.
 *
 * EdgeRuntime is the Supabase Edge Runtime global, read off globalThis at call
 * time (deno check does not see the edge-runtime.d.ts namespace, and the
 * wiring tests install a spy here). Absent under plain Deno, where the promise
 * simply runs on (it never rejects, see runInBackground).
 */
export function backgroundWaitUntil(tag: string, unit: string): (p: Promise<unknown>) => void {
  // Work handed to the runtime and not yet settled. Only read by the shutdown log.
  let inFlight = 0;

  addEventListener('beforeunload', (ev) => {
    if (inFlight === 0) return;
    // The runtime's d.ts types detail as the reason string; Supabase's docs read
    // detail.reason. Accept either.
    const detail = (ev as CustomEvent<unknown>).detail as { reason?: unknown } | string | undefined;
    const reason = typeof detail === 'string' ? detail : detail?.reason ?? null;
    console.error(`${tag} terminated with ${unit} in flight`, JSON.stringify({ reason, in_flight: inFlight }));
  });

  return (p: Promise<unknown>): void => {
    inFlight++;
    const tracked = p.finally(() => {
      inFlight--;
    });
    const edge = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): unknown } }).EdgeRuntime;
    edge?.waitUntil(tracked);
  };
}
