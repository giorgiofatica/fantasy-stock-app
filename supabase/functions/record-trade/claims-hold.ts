// The hold on live trading while a league's claims are being processed (Stocks tab part 3,
// workstream 6; docs/plans/2026-10-08-trading-window-and-watchlist.md, "The hold on live trading").
//
// A buy or a sell is refused with { ok:false, reason:'claims_processing' } (200, retryable, like
// trade_conflict) while public.claims_hold_active(league) is true: the market is open, it is less
// than 10 minutes since the session opened, the league has claims due today, and the claims run has
// not committed the league yet (20261211000000). This closes the race between a live buyer at
// 9:30:01 and the run. It is per league: a league with no claims is never held.
//
// FAIL-OPEN, BY TIME AND ON ERROR. The rule lifts by itself at open + 10 minutes (in SQL), so a dead
// claims job can never close a league's trading. A failed read of the rule also lets the trade
// through (logged): refusing would let a database blip, or a deploy that reached record-trade before
// the migration, stop every trade in every league, which the plan rules out ("a dead claims job must
// never close a league's trading"). A trade that slips through during the hold is not unsafe: the
// run's commit compares the ledger it planned on (record_trade_atomic's CAS), re-plans, and fails
// only the claims that trade made impossible.
// The preview is never held (it writes nothing).

export const CLAIMS_PROCESSING = { ok: false, reason: 'claims_processing' } as const;

export async function claimsHoldRefusal(
  // deno-lint-ignore no-explicit-any
  admin: any,
  leagueId: string,
  logError: (...args: unknown[]) => void = (...a) => console.error(...a),
): Promise<typeof CLAIMS_PROCESSING | null> {
  try {
    const { data, error } = await admin.rpc('claims_hold_active', { p_league_id: leagueId });
    if (error || typeof data !== 'boolean') {
      logError('record-trade: claims hold read failed; not holding', (error as { code?: string } | null)?.code ?? typeof data);
      return null;
    }
    return data ? CLAIMS_PROCESSING : null;
  } catch (_e) {
    logError('record-trade: claims hold read threw; not holding');
    return null;
  }
}
