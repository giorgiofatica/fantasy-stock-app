-- ============================================================================
-- Retire the last two readers of the vault `service_role_key` secret.
-- ============================================================================
-- Finding (2026-11-10): the vault entry `service_role_key` holds the LEGACY
-- service_role JWT. Cron stopped using it in Phase 2b-2 (20260618000000/01/02;
-- the 2026-11-07 db-snapshot shows every cron job on `cron_apikey`), but two
-- manual admin helpers still read it and POST it as `Authorization: Bearer`:
--
--   public.trigger_week_processing()  20251230210000  -> process-week-results
--   public.trigger_week_snapshot()    20260105100000  -> snapshot-week-start
--
-- Both are SECURITY DEFINER, owned by postgres, EXECUTE held by postgres and
-- service_role only (20260724000001 revoked anon/authenticated; 20260724000002
-- pinned search_path). Neither was migrated to `cron_apikey`, and both also
-- carry a hardcoded legacy anon JWT that they send instead when the vault read
-- misses. They are the reason the vault copy of the service_role key still
-- has a reader, so the vault entry cannot be deleted while they exist.
--
-- WHY DROP, NOT MIGRATE TO cron_apikey: nothing calls them. A repo-wide grep
-- (apps/, supabase/functions/, scripts/, docs/) found no caller: no client
-- .rpc(), no edge function, no cron command, no runbook step. The supported
-- ways to run those jobs by hand are the edge functions themselves (with the
-- cron apikey) or the cron jobs, which already authenticate with `cron_apikey`.
-- A helper nobody calls, that holds a privileged credential path, is only
-- attack surface.
--
-- NOT TOUCHED HERE:
--   * trigger_week_end_snapshot() reads `cron_apikey` since 20260612000000 and
--     stays. (The name differs: `trigger_week_snapshot` is not a substring of
--     `trigger_week_end_snapshot`, so the guards below do not confuse them.)
--   * The vault secret itself. Deleting it is Giorgio's dashboard step AFTER
--     this is applied and the post-push query returns 0 rows. Deleting the
--     vault copy does NOT revoke the key: the legacy service_role JWT stays
--     valid while legacy API keys are enabled (MIGRATION_STATUS, Phase 4).
--   * Edge functions read SUPABASE_SERVICE_ROLE_KEY from their environment,
--     never from the vault, so they do not depend on this secret.
--
-- GUARDS (each raises, so db push stops and nothing in this file applies):
--   1. before the drop: no cron job command and no other function body names
--      either helper. DROP FUNCTION tracks no dependency on a PL/pgSQL body or
--      a cron command string, so a caller would otherwise break silently on its
--      next run (CLAUDE.md: PL/pgSQL resolves names at execution time).
--   2. after the drop: no cron job command and no function in `public` names
--      `service_role_key`. Scope is stated, not implied: this guard reads
--      public only. The broader pre/post-push query below reads every
--      non-system schema; run it by hand, it is the deploy gate.
--
-- PRE-PUSH (SQL editor, before `supabase db push`). Expect EXACTLY 2 rows:
--   function | public.trigger_week_processing
--   function | public.trigger_week_snapshot
-- Any other row is a reader this migration does not retire: stop and report it.
--
--   SELECT 'cron' AS kind, jobname AS name FROM cron.job WHERE command ILIKE '%service_role_key%'
--   UNION ALL
--   SELECT 'function', n.nspname||'.'||p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE p.prosrc ILIKE '%service_role_key%' AND n.nspname NOT IN ('pg_catalog','information_schema');
--
-- POST-PUSH (same query, after `supabase db push`). Must return 0 rows.
--   Also confirm the version landed:
--   SELECT version FROM supabase_migrations.schema_migrations WHERE version = '20261130000000';
--   And that both helpers are gone (expect 0 rows):
--   SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname IN ('trigger_week_processing','trigger_week_snapshot');
--
-- BEFORE DELETING THE VAULT ENTRY (read-only; none of these decrypts a secret,
-- and each projects names only). The queries above match the literal NAME
-- `service_role_key`; these cover what a name match cannot see:
--   a. Both entries exist (expect 2 rows), so the delete targets the right one
--      and cron's own key is still there:
--      SELECT name, created_at FROM vault.secrets WHERE name IN ('service_role_key','cron_apikey');
--   b. Every cron job that calls a function reads cron_apikey. Expect ONLY
--      purge_cron_run_details and purge_rate_limit_counters (pure SQL, no HTTP):
--      SELECT jobname FROM cron.job WHERE command NOT ILIKE '%cron_apikey%';
--   c. No cron job carries an INLINED JWT. The pre-2b-2 schedule_snapshot_retry
--      formatted the key's VALUE into one-shot `*-retry-N` jobs; one that never
--      unscheduled would hold a live key with no `service_role_key` text in it.
--      Expect 0 rows:
--      SELECT jobname FROM cron.job WHERE command ~ 'eyJ[A-Za-z0-9_-]{20,}';
--   d. No trigger (dashboard database webhooks keep their headers in tgargs)
--      carries a Bearer header or an inlined JWT. Expect 0 rows:
--      SELECT tgrelid::regclass, tgname FROM pg_trigger
--       WHERE encode(tgargs, 'escape') ~ '(Bearer|eyJ[A-Za-z0-9_-]{20,})';
--   e. Effect, not status (CLAUDE.md): after the push, confirm a cron job on
--      cron_apikey still wrote its data (e.g. symbols.enriched_at advanced).
-- ============================================================================

-- 1. No caller may remain.
DO $guard_callers$
DECLARE
  v_callers text;
BEGIN
  SELECT string_agg(src, ', ' ORDER BY src) INTO v_callers
  FROM (
    SELECT 'cron:' || jobname AS src
    FROM cron.job
    WHERE command ~* '\mtrigger_week_(processing|snapshot)\M'
    UNION ALL
    SELECT 'function:' || n.nspname || '.' || p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosrc ~* '\mtrigger_week_(processing|snapshot)\M'
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND NOT (n.nspname = 'public' AND p.proname IN ('trigger_week_processing', 'trigger_week_snapshot'))
  ) s;

  IF v_callers IS NOT NULL THEN
    RAISE EXCEPTION '20261130000000: refusing to drop trigger_week_processing / trigger_week_snapshot, still called by: %', v_callers;
  END IF;
END
$guard_callers$;

-- 2. Drop both helpers (exact zero-argument signatures).
DROP FUNCTION IF EXISTS public.trigger_week_processing();
DROP FUNCTION IF EXISTS public.trigger_week_snapshot();

-- 3. Nothing in cron or public may still name the vault secret.
DO $guard_readers$
DECLARE
  v_readers text;
BEGIN
  SELECT string_agg(src, ', ' ORDER BY src) INTO v_readers
  FROM (
    SELECT 'cron:' || jobname AS src
    FROM cron.job
    WHERE command ILIKE '%service_role_key%'
    UNION ALL
    SELECT 'function:public.' || p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosrc ILIKE '%service_role_key%'
  ) s;

  IF v_readers IS NOT NULL THEN
    RAISE EXCEPTION '20261130000000: helpers dropped but service_role_key still read by: %', v_readers;
  END IF;
END
$guard_readers$;
