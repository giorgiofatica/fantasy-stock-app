/**
 * A virtual wall clock for the PGlite suites (not a test).
 *
 * PGlite's now() / clock_timestamp() read the JS clock (Date.now) at the moment each statement or
 * transaction starts, even when Date.now is replaced AFTER PGlite has loaded (checked 2026-11-24 on
 * @electric-sql/pglite 0.2: a replaced Date.now moved now() forward and back; now() stays fixed
 * within a transaction, as in Postgres). So a suite whose SQL reads the clock (the market calendar,
 * the claims hold, place_claim's "is the market closed") can run at a chosen instant instead of
 * whatever time CI happens to start: the ET-midnight wrap and the weekend stop being test flakes.
 *
 * The clock keeps ticking from the chosen instant (an offset, not a freeze), so ordering by
 * created_at and the rate limiter's windows behave as they do in prod.
 *
 * ONLY Date.now is replaced. `new Date()` with no argument does NOT follow it (V8 reads its own
 * clock): write `new Date(Date.now())` in code that must see the virtual time.
 */
export interface VirtualClock {
  /** Move the clock to `iso` (it keeps ticking from there). */
  set(iso: string): void;
  /** Put the real Date.now back. */
  restore(): void;
}

export function installVirtualClock(iso: string): VirtualClock {
  const realNow = Date.now;
  const real = () => realNow.call(Date);
  let offset = 0;
  const set = (at: string) => {
    const target = Date.parse(at);
    if (Number.isNaN(target)) throw new Error(`virtual clock: not a time: ${at}`);
    offset = target - real();
  };
  set(iso);
  Date.now = () => real() + offset;
  return {
    set,
    restore() {
      Date.now = realNow;
    },
  };
}
