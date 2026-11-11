// draft-order-notify — the draft-lifecycle push delivery, CRON ONLY.
//
// Draft auto-start (2026-10-06, 20261111000000) made this the delivery for
// every draft push: the room opening (T-1h, with your position), the start, a
// postponement (everyone), and the commissioner's at-risk warning. A run:
//   1. open_due_draft_rooms() — every league the auto-start gate cleared whose
//      room time has come: finalize the order and write one 'draft_room_open'
//      row per human (late joiners too). Exactly once per draft time.
//   2. finalize_due_draft_orders() — #67's on-time finalize for everything
//      else. Its 'draft_order_set' rows are in-app records now (push marked
//      skipped at insert), so this sends nothing by itself.
//   3. Deliver pending rows of DELIVERED_KINDS ('draft_time_set' only after 2
//      quiet minutes, so a burst of edits is one push): claim (conditional UPDATE on
//      the observed status + attempt count, so an overlapping run cannot
//      double-send), read the CURRENT context (draft_notice_context: position,
//      names, state), decide (plan.ts decideNotice: a notice whose event no
//      longer holds is skipped, never sent), send via Expo, settle the status.
// Scheduled by supabase/migrations/20261111000003_schedule_draft_order_notify.sql,
// whose command posts only WHERE draft_room_notices_due() — an idle system
// makes no edge calls.
//
// SUCCESS-SIGNAL DISCIPLINE (CLAUDE.md): top-level `ok` means ONLY "the run
// completed". Per-row outcomes are counted separately; nothing here claims a
// push was delivered unless Expo returned an 'ok' ticket. The cron's
// net.http_post "succeeds" on enqueue regardless — verify by DATA
// (league_notifications.push_status), never by cron.job_run_details.
//
// RESPONSE vs OUTCOME (2026-11-11, docs/STATUS.md §4 item 28): the handler
// answers 202 {"accepted":true} at once and runs under EdgeRuntime.waitUntil,
// because pg_net holds every later cron post (the 2 s auto-pick sweep
// included) behind a slow request. The old 200 body is now ONE log line at the
// end of the run: `draft-order-notify {ok, opened, open_error, finalized,
// finalize_error, examined, outcomes, duration_ms}` (written to the error
// stream when ok is false: the notice select failed), `draft-order-notify
// failed {...}` on a throw, or `draft-order-notify terminated with a run in
// flight` if the runtime stops the worker first. Every Expo call is capped at
// PUSH_TIMEOUT_MS (4 s). Runs can now overlap; why that cannot double-send is
// at plan.ts STALE_SENDING_MS. Code: ./handler.ts, ./run.ts.
//
// AUTH: verify_jwt=false; the shared constant-time apikey guard
// (../_shared/cron-auth.ts, SB_SECRET_KEY_CRON, fail-closed) is the entire
// boundary. There is no caller identity: content is built server-side only.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { backgroundWaitUntil } from '../_shared/respond-fast.ts';
import { makeNotifyHandler } from './handler.ts';
import { runDraftOrderNotify } from './run.ts';

const waitUntil = backgroundWaitUntil('draft-order-notify', 'a run');

Deno.serve(makeNotifyHandler({
  run: ({ url, key }) => runDraftOrderNotify({ admin: createClient(url, key) }),
  waitUntil,
}));
