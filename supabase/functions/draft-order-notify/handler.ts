// draft-order-notify HTTP handler: answer the cron AT ONCE, deliver in the
// background (docs/STATUS.md §4 item 28; the enrich-symbols fix, #396).
//
// WHY: pg_net 0.14.0 holds every cron post enqueued after a slow one until the
// slow one finishes. A full run here sends up to 50 pushes one after another
// (~10-25 s), and its bursts (draft_room_open, draft_started) land exactly as a
// draft starts, when the 2 s auto-pick sweep matters most.
//
// WHAT THE 202 MEANS: only "authorized, configured, and the run was handed to
// the runtime". It is NOT a success claim. The run's outcome (opened,
// finalized, examined, per-outcome counts) is ONE log line when it ends:
// `draft-order-notify {...}`, `draft-order-notify failed {...}` on a throw, or
// `draft-order-notify terminated with a run in flight` if the runtime stops
// the worker first (index.ts). Verify by data: league_notifications.push_status.
//
// Still answered synchronously, so they stay visible in net._http_response:
// 405 (method), 401 (apikey), 500 (missing SUPABASE_URL / SB_SECRET_KEY_INTERNAL;
// before, a missing one crashed createClient and the runtime answered 500).
import { isAuthorized } from '../_shared/cron-auth.ts';
import { runInBackground } from '../_shared/respond-fast.ts';
import type { NotifyResult } from './run.ts';

export interface NotifyHandlerDeps {
  /** Starts one run against the given service-role config. Called WITHOUT awaiting it. */
  run: (cfg: { url: string; key: string }) => Promise<NotifyResult>;
  /** Keeps the worker alive until the promise settles (EdgeRuntime.waitUntil). */
  waitUntil: (p: Promise<unknown>) => void;
  log?: (...args: unknown[]) => void;
  logError?: (...args: unknown[]) => void;
}

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

export const LOG_TAG = 'draft-order-notify';

export function makeNotifyHandler(deps: NotifyHandlerDeps): (req: Request) => Promise<Response> {
  return (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return Promise.resolve(json({ ok: false, reason: 'method_not_allowed' }, 405));
    if (!isAuthorized(req)) return Promise.resolve(json({ error: 'Unauthorized' }, 401)); // generic: no detail

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const key = Deno.env.get('SB_SECRET_KEY_INTERNAL') ?? '';
    if (!url || !key) return Promise.resolve(json({ error: 'server_config_error' }, 500));

    // Hand the run to the runtime and answer now. Do NOT await it: the point is
    // that the cron's HTTP request ends before the run does.
    deps.waitUntil(runInBackground(LOG_TAG, () => deps.run({ url, key }), deps.log, deps.logError));
    return Promise.resolve(json({ accepted: true }, 202));
  };
}
