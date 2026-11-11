-- ============================================================================
-- A per-turn in-flight LEASE for every auto-pick attempt (draft-autopick-sweep
-- and validate-and-record-pick's auto_pick / bot_pick), and an atomic CLAIM on
-- the vendor-outage commissioner push (supabase review P1 and security review P2
-- on #384, 2026-11-11).
-- Internal tables and functions, service role only.
--
-- WHY. draft_autopick_sweep posts every 2 s (20261201000000). noteOutage writes
-- public.draft_turn_outages at the END of an attempt, so while a SLOW outage
-- attempt is still running (up to WALL_BUDGET_MS = 25 s) nothing holds later
-- ticks back: ~D/2 sweeps worked the same turn at once (D = attempt length).
-- Each spent ~21 Alpaca requests, each bumped note_draft_bounded (so 'stalled'
-- came sooner), and each could see escalated_at IS NULL and push the
-- commissioner, so the "once" push could go out several times.
--
-- 1. public.draft_turn_leases + public.claim_draft_turn_lease. Every auto-pick
--    attempt claims (league_id, pick_number) before it works the turn (the
--    sweep before it even reads it) and deletes its own row (holder = its token)
--    when done. Sweeps and client asks share the key, so they exclude each
--    other: a held turn answers 'lease_held' (sweep) / 'pick_in_progress'
--    (client) and spends nothing. That also closes the client half of the
--    outage window: draft_turn_outages.last_seen_at is written only when an
--    attempt ENDS, so parallel client asks during a slow outage all saw no row. A claim succeeds when
--    there is no row or the row has EXPIRED, in one INSERT ... ON CONFLICT DO
--    UPDATE ... WHERE expires_at <= now(): two concurrent claims serialize on
--    the row and exactly one returns true.
--    TIME-BOUNDED (partial state): a holder that dies (CPU limit, deploy,
--    crash) never runs its release; its row expires after p_ttl_ms and the next
--    sweep takes the turn over. A crashed holder delays that turn by at most the
--    TTL, never forever. p_ttl_ms is clamped to [1 s, 120 s] so no caller can
--    write a lease that outlives a stuck draft.
--    Correctness never depended on this: the drafts (league_id, pick_number)
--    unique index still makes exactly one pick win. The lease is COST control,
--    so every caller fails OPEN on a claim error (it works the turn, as before).
--
-- 2. draft_turn_outages.escalation_claim / escalation_claimed_at +
--    public.claim_outage_escalation. noteOutage claims the push before sending
--    it: the claim succeeds only while escalated_at IS NULL and no live claim
--    exists (none, or older than p_ttl_seconds). Exactly one concurrent caller
--    gets true. A SENT push sets escalated_at (done for good); a push that was
--    NOT sent clears its own claim, so the next attempt retries it (the
--    at-least-once rule of review finding 3, kept); a claimer that dies between
--    claim and mark leaves a claim that expires, so the push is retried then.
--
-- DEPLOY ORDER: apply this migration BEFORE deploying draft-autopick-sweep and
-- validate-and-record-pick. Functions first would still be safe, not ideal: a
-- missing claim_draft_turn_lease fails the lease open (the pre-lease overlap),
-- and a missing claim_outage_escalation sends NO outage push until it exists
-- (a duplicate push is the bug being fixed; a skipped one is retried).
--
-- Effect-verify after push (HUMAN ACTION):
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'draft_turn_leases';  -- true
--   SELECT grantee, privilege_type FROM information_schema.role_table_grants
--    WHERE table_name = 'draft_turn_leases';                  -- service_role only
--   SELECT proname, proacl FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND proname IN ('claim_draft_turn_lease', 'claim_outage_escalation');
--   -- proacl: postgres + service_role only; NO anon=, authenticated= or =X entry
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'draft_turn_outages' AND column_name LIKE 'escalation_claim%';  -- 2 rows
--
-- HUMAN ACTION: supabase db push, from the deploy checkout only (CLAUDE.md).
-- ============================================================================

-- ---- 1. the turn lease -------------------------------------------------------
create table if not exists public.draft_turn_leases (
  league_id   uuid not null references public.leagues(id) on delete cascade,
  pick_number integer not null,
  holder      uuid not null,
  expires_at  timestamptz not null,
  primary key (league_id, pick_number)
);

-- RLS on with NO policies: anon and authenticated are denied; service role bypasses.
alter table public.draft_turn_leases enable row level security;
revoke all on public.draft_turn_leases from public;
revoke all on public.draft_turn_leases from anon;
revoke all on public.draft_turn_leases from authenticated;
grant all on public.draft_turn_leases to service_role;

-- true = this holder now owns the turn until expires_at; false = someone else
-- holds a live lease. Re-claiming your own live lease is refused too (one
-- attempt per lease).
create or replace function public.claim_draft_turn_lease(
  p_league_id uuid,
  p_pick_number integer,
  p_holder uuid,
  p_ttl_ms integer
)
returns boolean
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  with claimed as (
    insert into public.draft_turn_leases as l (league_id, pick_number, holder, expires_at)
    values (
      p_league_id,
      p_pick_number,
      p_holder,
      now() + make_interval(secs => least(greatest(coalesce(p_ttl_ms, 0), 1000), 120000) / 1000.0)
    )
    on conflict (league_id, pick_number) do update
       set holder = excluded.holder,
           expires_at = excluded.expires_at
     where l.expires_at <= now()
    returning 1
  )
  select exists (select 1 from claimed);
$$;

revoke all on function public.claim_draft_turn_lease(uuid, integer, uuid, integer) from public;
revoke all on function public.claim_draft_turn_lease(uuid, integer, uuid, integer) from anon;
revoke all on function public.claim_draft_turn_lease(uuid, integer, uuid, integer) from authenticated;
grant execute on function public.claim_draft_turn_lease(uuid, integer, uuid, integer) to service_role;

-- ---- 2. the outage-push claim ------------------------------------------------
alter table public.draft_turn_outages add column if not exists escalation_claim uuid;
alter table public.draft_turn_outages add column if not exists escalation_claimed_at timestamptz;

create or replace function public.claim_outage_escalation(
  p_league_id uuid,
  p_pick_number integer,
  p_claim uuid,
  p_ttl_seconds integer
)
returns boolean
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  with claimed as (
    update public.draft_turn_outages o
       set escalation_claim = p_claim,
           escalation_claimed_at = now()
     where o.league_id = p_league_id
       and o.pick_number = p_pick_number
       and o.escalated_at is null
       and (
         o.escalation_claimed_at is null
         or o.escalation_claimed_at
              <= now() - make_interval(secs => least(greatest(coalesce(p_ttl_seconds, 0), 5), 600))
       )
    returning 1
  )
  select exists (select 1 from claimed);
$$;

revoke all on function public.claim_outage_escalation(uuid, integer, uuid, integer) from public;
revoke all on function public.claim_outage_escalation(uuid, integer, uuid, integer) from anon;
revoke all on function public.claim_outage_escalation(uuid, integer, uuid, integer) from authenticated;
grant execute on function public.claim_outage_escalation(uuid, integer, uuid, integer) to service_role;
