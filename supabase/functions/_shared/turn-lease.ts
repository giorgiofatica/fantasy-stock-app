/**
 * The per-turn in-flight LEASE for every auto-pick attempt: draft-autopick-sweep,
 * and validate-and-record-pick's auto_pick / bot_pick through draft-write.ts
 * autoPickTurnLeased (supabase review P1 + security review P2 on #384,
 * 2026-11-11; SQL: 20261202000000_draft_turn_lease_and_escalation_claim). Both
 * use the same (league_id, pick_number) key, so a sweep and a client ask
 * exclude each other.
 *
 * The cron posts a sweep every 2 s while a turn is overdue, and its outage
 * throttle (draft_turn_outages.last_seen_at) is written only when an attempt
 * ENDS. So without a lease, a slow attempt (a vendor outage that times out, up
 * to WALL_BUDGET_MS) had ~D/2 sweeps working the same turn at once: ~21 Alpaca
 * requests each, extra note_draft_bounded bumps, extra outage pushes.
 *
 * withTurnLease claims (league_id, pick_number) through
 * public.claim_draft_turn_lease (one atomic INSERT ... ON CONFLICT DO UPDATE
 * WHERE expired), runs the work only if it won, and deletes ITS OWN row after
 * (holder = a fresh token). A second sweep meanwhile gets 'held' and does
 * nothing for that turn.
 *
 * TIME-BOUNDED: a holder that dies before its release (CPU limit, deploy,
 * crash) leaves a row that expires after TURN_LEASE_TTL_MS; the next sweep then
 * takes the turn over. Never forever. The release deletes by holder, so a slow
 * holder whose lease expired and was re-claimed cannot delete the new owner's.
 *
 * FAIL OPEN on a claim error: the lease is cost control, not correctness (the
 * drafts (league_id, pick_number) unique index still lets exactly one pick
 * win), and "a draft must never be permanently stuck" outranks the cost. A
 * broken lease table therefore means the pre-lease overlap, never a stopped
 * draft. The caller sees `leased: false` and reports it.
 */
// deno-lint-ignore no-explicit-any
type Admin = any;

/** Longer than one attempt (the 25 s walk, then the insert, finalize and
 * pushes), so a live holder is never overtaken in practice; short enough that
 * a dead holder costs its turn at most one minute. The SQL clamps any TTL to
 * [1 s, 120 s]. turn-lease.test.ts pins TTL >= auto-pick.ts WALL_BUDGET_MS + LEASE_MARGIN_MS. */
export const TURN_LEASE_TTL_MS = 60_000;
/** Room after the walk for the insert, finalize and pushes. */
export const LEASE_MARGIN_MS = 15_000;

export type LeaseClaim = 'claimed' | 'held' | 'error';

export async function claimTurnLease(
  admin: Admin,
  leagueId: string,
  pickNumber: number,
  holder: string,
  ttlMs: number = TURN_LEASE_TTL_MS,
): Promise<LeaseClaim> {
  try {
    // Destructure-and-check: .rpc() resolves to { error } on a Postgres error.
    const { data, error } = await admin.rpc('claim_draft_turn_lease', {
      p_league_id: leagueId,
      p_pick_number: pickNumber,
      p_holder: holder,
      p_ttl_ms: ttlMs,
    });
    if (error) {
      console.error('[lease] claim failed, working the turn unleased', leagueId, pickNumber, JSON.stringify(error));
      return 'error';
    }
    if (data === true) return 'claimed';
    if (data === false) return 'held';
    console.error('[lease] claim returned no boolean, working the turn unleased', leagueId, pickNumber, JSON.stringify(data));
    return 'error';
  } catch (e) {
    console.error('[lease] claim threw, working the turn unleased', leagueId, pickNumber, String(e));
    return 'error';
  }
}

/** Never throws. A failed release only means the turn waits out the TTL. */
export async function releaseTurnLease(admin: Admin, leagueId: string, pickNumber: number, holder: string): Promise<void> {
  try {
    const { error } = await admin
      .from('draft_turn_leases')
      .delete()
      .eq('league_id', leagueId)
      .eq('pick_number', pickNumber)
      .eq('holder', holder);
    if (error) console.error('[lease] release failed (expires on its TTL)', leagueId, pickNumber, JSON.stringify(error));
  } catch (e) {
    console.error('[lease] release threw (expires on its TTL)', leagueId, pickNumber, String(e));
  }
}

export type LeaseOutcome<T> =
  | { kind: 'held' }
  | { kind: 'ran'; value: T; leased: boolean };

/** Run `work` for this turn only if no other live holder has it. */
export async function withTurnLease<T>(
  admin: Admin,
  leagueId: string,
  pickNumber: number,
  work: () => Promise<T>,
  opts: { holder?: string; ttlMs?: number } = {},
): Promise<LeaseOutcome<T>> {
  const holder = opts.holder ?? crypto.randomUUID();
  const claim = await claimTurnLease(admin, leagueId, pickNumber, holder, opts.ttlMs ?? TURN_LEASE_TTL_MS);
  if (claim === 'held') return { kind: 'held' };
  try {
    return { kind: 'ran', value: await work(), leased: claim === 'claimed' };
  } finally {
    if (claim === 'claimed') await releaseTurnLease(admin, leagueId, pickNumber, holder);
  }
}
