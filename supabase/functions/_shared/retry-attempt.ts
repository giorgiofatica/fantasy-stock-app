/**
 * The retry attempt a snapshot job run is, from its X-Retry-Attempt header. PURE.
 *
 * Where the number comes from (supabase/tests/step5_final_attempts.test.ts reads
 * each source from supabase/migrations/ and fails if one changes):
 *   - the Monday/Tuesday snapshot-week-start and Friday snapshot-week-end crons send
 *     NO header, so they run as attempt 1;
 *   - schedule_snapshot_retry (called by the handler with attempt + 1 while
 *     attempt < its MAX_RETRIES) sends its p_attempt, 5 minutes later;
 *   - the Mon/Tue snapshot-week-end-heal cron sends '3'.
 * The expression is the handlers' own, moved here unchanged so it can be tested.
 */
export function retryAttemptFrom(header: string | null): number {
  return parseInt(header || '1');
}
