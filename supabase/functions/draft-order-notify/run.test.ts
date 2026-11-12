/**
 * Hermetic tests for ./run.ts: the bounded Expo calls and the OVERLAP claims.
 * No DB, no network: `admin` is an in-memory league_notifications that applies
 * every filter the code sends (eq / in / the stale-reclaim or()) truthfully, so
 * a claim that stops being conditional, or a reclaim cutoff that moves, shows
 * up as a second send. Expo and the token lookup are injected spies.
 *
 * WHY overlap matters now (2026-11-11): the handler answers 202 at once, so the
 * next minute's cron run is dispatched while this one may still be delivering.
 *
 * Run from repo root:
 *   deno test --allow-read --allow-env supabase/functions/draft-order-notify/run.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { PUSH_TIMEOUT_MS } from '../_shared/notice-delivery.ts';
import type { PushMessage, PushSendResult } from '../_shared/push.ts';
import { EDGE_WALL_CLOCK_MAX_MS, MAX_PUSH_ATTEMPTS, MAX_ROW_HOLD_ESTIMATE_MS, nextPushStatus, reclaimExhausted, STALE_SENDING_MS } from './plan.ts';
import { runDraftOrderNotify } from './run.ts';

// ---------------------------------------------------------------------------
// In-memory PostgREST-ish client
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;

/** The one or() shape run.ts sends: pending, or sending with push_attempted_at < T. */
function orMatcher(expr: string): (r: Row) => boolean {
  const m = /^push_status\.eq\.pending,and\(push_status\.eq\.sending,push_attempted_at\.lt\.([^)]+)\)$/.exec(expr);
  if (!m) throw new Error(`fake: unsupported or(): ${expr}`);
  const cutoff = Date.parse(m[1]);
  return (r) =>
    r.push_status === 'pending' ||
    (r.push_status === 'sending' && typeof r.push_attempted_at === 'string' && Date.parse(r.push_attempted_at) < cutoff);
}

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private patch: Row | null = null;
  private lim = Infinity;
  private orderKey: string | null = null;
  constructor(private db: FakeDb, private table: string) {}
  select(_cols?: string) { return this; }
  update(patch: Row) { this.patch = patch; return this; }
  eq(col: string, v: unknown) { this.filters.push((r) => r[col] === v); return this; }
  in(col: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[col])); return this; }
  or(expr: string) { this.filters.push(orMatcher(expr)); return this; }
  order(col: string, _o?: unknown) { this.orderKey = col; return this; }
  limit(n: number) { this.lim = n; return this; }
  private exec(): { data: Row[]; error: null } {
    const rows = this.db.tables[this.table] ?? [];
    let hit = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.patch) {
      // Atomic per statement, like Postgres: match and write in one step.
      for (const r of hit) Object.assign(r, this.patch);
      this.db.writes.push({ table: this.table, patch: this.patch, matched: hit.length });
      return { data: hit.map((r) => ({ ...r })), error: null };
    }
    if (this.orderKey) hit = [...hit].sort((a, b) => String(a[this.orderKey!]).localeCompare(String(b[this.orderKey!])));
    return { data: hit.slice(0, this.lim).map((r) => ({ ...r })), error: null };
  }
  async maybeSingle() {
    await this.db.tick();
    const fault = this.patch ? this.db.updateFault?.(this.patch) : null;
    if (fault) return { data: null, error: fault }; // nothing written
    const { data } = this.exec();
    return { data: data[0] ?? null, error: null };
  }
  then<T>(res: (v: { data: Row[]; error: null }) => T, rej?: (e: unknown) => unknown) {
    return this.db.selectGate().then(() => this.exec()).then(res, rej);
  }
}

class FakeDb {
  tables: Record<string, Row[]> = { league_notifications: [], leagues: [] };
  writes: { table: string; patch: Row; matched: number }[] = [];
  ctx = new Map<string, unknown>();
  /** Awaited before every notice SELECT resolves (lets a test line two runs up). */
  selectGate: () => Promise<void> = () => Promise.resolve();
  tick = () => Promise.resolve();
  /** Return an error object to fail an UPDATE with that patch (nothing is written). */
  updateFault: ((patch: Row) => unknown) | null = null;
  from(t: string) { return new Query(this, t); }
  rpc(name: string, args?: { p_notice_id?: string }) {
    if (name === 'open_due_draft_rooms') return Promise.resolve({ data: 0, error: null });
    if (name === 'finalize_due_draft_orders') return Promise.resolve({ data: 0, error: null });
    if (name === 'draft_notice_context') return Promise.resolve({ data: this.ctx.get(args!.p_notice_id!) ?? null, error: null });
    throw new Error(`fake: unexpected rpc ${name}`);
  }
  row(id: string) { return this.tables.league_notifications.find((r) => r.id === id)!; }
}

const T0 = Date.parse('2026-11-11T19:00:00.000Z');
const LEAGUE = '00000000-0000-0000-0000-00000000000a';
const USER = '00000000-0000-0000-0000-0000000000u1';

/** A draft_started notice for a member at position 3, with its live context. */
function addDraftStarted(db: FakeDb, id: string, over: Row = {}) {
  db.tables.league_notifications.push({
    id, league_id: LEAGUE, user_id: USER, kind: 'draft_started', created_at: new Date(T0 - 60_000).toISOString(),
    subject_user_id: null, detail: null, push_status: 'pending', push_attempts: 0, push_attempted_at: null, ...over,
  });
  db.ctx.set(id, {
    kind: 'draft_started', league_id: LEAGUE, user_id: USER, created_at: new Date(T0).toISOString(), league_name: 'League A',
    draft_status: 'in_progress', draft_date: new Date(T0).toISOString(), draft_order_mode: 'random', is_member: true,
    is_commissioner: false, commissioner_name: 'Gio', position: 3, watch: null, postponement: null,
  });
}

function addRenewal(db: FakeDb, id: string) {
  db.tables.leagues.push({ id: LEAGUE, name: 'League A' });
  db.tables.league_notifications.push({
    id, league_id: LEAGUE, user_id: USER, kind: 'renewal_invite', created_at: new Date(T0 - 60_000).toISOString(),
    subject_user_id: null, detail: { commissioner_name: 'Gio', season_number: 2 }, push_status: 'pending',
    push_attempts: 0, push_attempted_at: null,
  });
}

interface Sent { token: string; msg: PushMessage; opts?: { timeoutMs?: number } }
function expo(result: PushSendResult | (() => Promise<PushSendResult>) = { sent: true }) {
  const sent: Sent[] = [];
  const fn = (token: string, msg: PushMessage, opts?: { timeoutMs?: number }) => {
    sent.push({ token, msg, opts });
    return typeof result === 'function' ? result() : Promise.resolve(result);
  };
  return { fn, sent };
}
const tokenOk = () => Promise.resolve({ token: 'ExponentPushToken[test]', enabled: true, lookupFailed: false });

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** Silence the run's own console.error lines (settle failed etc.) inside one test. */
async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const e = console.error;
  console.error = () => {};
  try { return await fn(); } finally { console.error = e; }
}

// ---------------------------------------------------------------------------
// 1. Every Expo call is bounded
// ---------------------------------------------------------------------------
Deno.test('draft-kind delivery passes { timeoutMs: PUSH_TIMEOUT_MS } to sendExpoPush', async () => {
  const db = new FakeDb();
  addDraftStarted(db, 'n1');
  const x = expo();
  const r = await runDraftOrderNotify({ admin: db, sendExpoPush: x.fn, getTargetToken: tokenOk, now: () => T0 });
  assertEquals(x.sent.length, 1);
  assertEquals(x.sent[0].opts, { timeoutMs: PUSH_TIMEOUT_MS });
  assertEquals(PUSH_TIMEOUT_MS, 4000);
  assertEquals(db.row('n1').push_status, 'sent');
  assertEquals(r.outcomes, { sent: 1 });
});

Deno.test('renewal-kind delivery (the second call site) passes { timeoutMs: PUSH_TIMEOUT_MS } too', async () => {
  const db = new FakeDb();
  addRenewal(db, 'r1');
  const x = expo();
  await runDraftOrderNotify({ admin: db, sendExpoPush: x.fn, getTargetToken: tokenOk, now: () => T0 });
  assertEquals(x.sent.length, 1);
  assertEquals(x.sent[0].opts, { timeoutMs: PUSH_TIMEOUT_MS });
  assertEquals(db.row('r1').push_status, 'sent');
});

Deno.test('a timed-out push (expo_error, as _shared/push.ts reports it) takes the normal failed-send path', async () => {
  const db = new FakeDb();
  addDraftStarted(db, 'n1');
  const x = expo({ sent: false, reason: 'expo_error' });
  const r = await runDraftOrderNotify({ admin: db, sendExpoPush: x.fn, getTargetToken: tokenOk, now: () => T0 });
  // Attempt 1 of MAX_PUSH_ATTEMPTS: back to pending for the next tick, error recorded.
  assertEquals(db.row('n1').push_status, 'pending');
  assertEquals(db.row('n1').push_attempts, 1);
  assertEquals(db.row('n1').push_error, 'expo_error');
  assertEquals(r.outcomes, { retry_expo_error: 1 });

  // ...and the attempt budget still ends it as 'failed', not a forever-retry.
  for (let i = 2; i <= MAX_PUSH_ATTEMPTS; i++) {
    await runDraftOrderNotify({ admin: db, sendExpoPush: x.fn, getTargetToken: tokenOk, now: () => T0 + i * 60_000 });
  }
  assertEquals(db.row('n1').push_status, 'failed');
  assertEquals(x.sent.length, MAX_PUSH_ATTEMPTS);
});

// ---------------------------------------------------------------------------
// 2. Overlap: exactly one run claims a row
// ---------------------------------------------------------------------------
Deno.test('two runs that READ the same pending row at once: exactly one claims it and sends', async () => {
  const db = new FakeDb();
  addDraftStarted(db, 'n1');
  // Hold both runs' SELECTs until both have issued them, so each has the same
  // snapshot (pending, 0) in hand before either claims.
  let waiting = 0;
  const both = deferred<void>();
  db.selectGate = () => {
    if (++waiting === 2) both.resolve();
    return both.promise;
  };
  const x = expo();
  const deps = { admin: db, sendExpoPush: x.fn, getTargetToken: tokenOk, now: () => T0 };
  const [a, b] = await Promise.all([runDraftOrderNotify(deps), runDraftOrderNotify(deps)]);
  assertEquals(x.sent.length, 1, `sent ${x.sent.length} times: the claim is not conditional`);
  const outcomes = [a.outcomes, b.outcomes].map((o) => JSON.stringify(o)).sort();
  assertEquals(outcomes, [JSON.stringify({ claim_lost: 1 }), JSON.stringify({ sent: 1 })]);
  assertEquals(db.row('n1').push_status, 'sent');
  assertEquals(db.row('n1').push_attempts, 1);
});

Deno.test('a second run while the first is mid-send (row in sending) does not see or claim it', async () => {
  const db = new FakeDb();
  addDraftStarted(db, 'n1');
  const hold = deferred<PushSendResult>();
  const x = expo(() => hold.promise);
  const first = runDraftOrderNotify({ admin: db, sendExpoPush: x.fn, getTargetToken: tokenOk, now: () => T0 });
  // Let the first run reach Expo (row claimed, held in 'sending').
  while (x.sent.length === 0) await new Promise((r) => setTimeout(r, 1));
  assertEquals(db.row('n1').push_status, 'sending');

  // The next minute's cron fires while the first still holds the row.
  const y = expo();
  const second = await runDraftOrderNotify({ admin: db, sendExpoPush: y.fn, getTargetToken: tokenOk, now: () => T0 + 60_000 });
  assertEquals(y.sent.length, 0);
  assertEquals(second.examined, 0);

  hold.resolve({ sent: true });
  await first;
  assertEquals(db.row('n1').push_status, 'sent');
});

// ---------------------------------------------------------------------------
// 3. Reclaim only after STALE_SENDING_MS, and that clears any live hold
// ---------------------------------------------------------------------------
/** A row a run claimed at T0 and never settled (the run died, or its settle failed). */
function strandedAt(db: FakeDb, id: string, claimedAt: number, attempts = 1) {
  addDraftStarted(db, id, { push_status: 'sending', push_attempts: attempts, push_attempted_at: new Date(claimedAt).toISOString() });
}

Deno.test('a sending row is NOT reclaimed before STALE_SENDING_MS, and IS reclaimed after it', async () => {
  for (const [age, reclaimed] of [[0, false], [MAX_ROW_HOLD_ESTIMATE_MS, false], [EDGE_WALL_CLOCK_MAX_MS, false], [STALE_SENDING_MS - 1, false], [STALE_SENDING_MS + 1, true]] as const) {
    const db = new FakeDb();
    strandedAt(db, 'n1', T0);
    const x = expo();
    await runDraftOrderNotify({ admin: db, sendExpoPush: x.fn, getTargetToken: tokenOk, now: () => T0 + age });
    assertEquals(x.sent.length, reclaimed ? 1 : 0, `age ${age} ms: reclaimed=${x.sent.length === 1}`);
    if (reclaimed) assertEquals(db.row('n1').push_attempts, 2, 'a reclaim is a new claim: attempts bumped');
  }
});

Deno.test('a live run holding a row for the full bounded time is not double-sent by an overlapping run', async () => {
  // Run A claims at T0 and its Expo call hangs for the whole hold estimate
  // (4 s cap + slow DB legs); run B fires at the end of that window.
  const db = new FakeDb();
  addDraftStarted(db, 'n1');
  const hold = deferred<PushSendResult>();
  const x = expo(() => hold.promise);
  const a = runDraftOrderNotify({ admin: db, sendExpoPush: x.fn, getTargetToken: tokenOk, now: () => T0 });
  while (x.sent.length === 0) await new Promise((r) => setTimeout(r, 1));
  const y = expo();
  await runDraftOrderNotify({ admin: db, sendExpoPush: y.fn, getTargetToken: tokenOk, now: () => T0 + MAX_ROW_HOLD_ESTIMATE_MS + 1 });
  // And one at the wall-clock limit, the longest any live run can exist.
  await runDraftOrderNotify({ admin: db, sendExpoPush: y.fn, getTargetToken: tokenOk, now: () => T0 + EDGE_WALL_CLOCK_MAX_MS });
  assertEquals(y.sent.length, 0, 'an overlapping run reclaimed a row a live run still held');
  hold.resolve({ sent: true });
  await a;
  assertEquals(x.sent.length, 1);
  assertEquals(db.row('n1').push_status, 'sent');
});

Deno.test('STALE_SENDING_MS clears the hold bounds with margin (numbers)', () => {
  // Per row: claim + context + token reads + a 4 s-capped Expo call + settle.
  assert(MAX_ROW_HOLD_ESTIMATE_MS >= PUSH_TIMEOUT_MS + 6 * 1000, `per-row estimate ${MAX_ROW_HOLD_ESTIMATE_MS} ms`);
  assert(STALE_SENDING_MS >= 10 * MAX_ROW_HOLD_ESTIMATE_MS, `${STALE_SENDING_MS} vs per-row ${MAX_ROW_HOLD_ESTIMATE_MS}`);
  // Absolute: no invocation outlives the edge wall clock (400 s paid), however
  // slow its DB calls. Keep at least a minute over it for clock skew.
  assert(STALE_SENDING_MS >= EDGE_WALL_CLOCK_MAX_MS + 60_000, `${STALE_SENDING_MS} vs wall clock ${EDGE_WALL_CLOCK_MAX_MS}`);
});

// ---------------------------------------------------------------------------
// 4. A failed settle is at-least-once, never a storm
// ---------------------------------------------------------------------------
Deno.test('a failed settle leaves the row sending: re-sent once per STALE_SENDING_MS at most, then settles', async () => {
  const db = new FakeDb();
  addDraftStarted(db, 'n1');
  const x = expo();
  // The SETTLE fails (a transient write error); claims still succeed.
  let breakSettle = true;
  db.updateFault = (patch) => (breakSettle && patch.push_status !== 'sending' ? { code: '08006', message: 'stub' } : null);
  const deps = (t: number) => ({ admin: db, sendExpoPush: x.fn, getTargetToken: tokenOk, now: () => t });

  const r1 = await quiet(() => runDraftOrderNotify(deps(T0)));
  assertEquals(r1.outcomes, { settle_failed: 1 });
  assertEquals(db.row('n1').push_status, 'sending', 'a failed settle must leave the row reclaimable');
  assertEquals(x.sent.length, 1);

  // Every minute for the next 10 minutes: nothing re-sent.
  for (let m = 1; m * 60_000 < STALE_SENDING_MS; m++) await runDraftOrderNotify(deps(T0 + m * 60_000));
  assertEquals(x.sent.length, 1, 'a stuck row was re-sent before STALE_SENDING_MS');

  // After it: reclaimed once (at-least-once), and this time the settle lands.
  breakSettle = false;
  await runDraftOrderNotify(deps(T0 + STALE_SENDING_MS + 1));
  assertEquals(x.sent.length, 2);
  assertEquals(db.row('n1').push_status, 'sent');
  assertEquals(db.row('n1').push_attempts, 2);
});

// ---------------------------------------------------------------------------
// 5. The claim's version: BOTH halves of (push_status, push_attempts) matter
// ---------------------------------------------------------------------------
/** Gate the next two notice SELECTs so both runs read the same snapshot. */
function gateTwoReads(db: FakeDb) {
  let waiting = 0;
  const both = deferred<void>();
  db.selectGate = () => {
    if (++waiting === 2) both.resolve();
    return both.promise;
  };
}

Deno.test('two runs that READ the same STALE sending row at once: exactly one reclaims and sends', async () => {
  // The case overlap newly makes reachable. Status alone cannot decide it: both
  // claims would match 'sending' -> 'sending'. The attempt count does.
  const db = new FakeDb();
  strandedAt(db, 'n1', T0 - STALE_SENDING_MS - 1, 1);
  gateTwoReads(db);
  const x = expo();
  const deps = { admin: db, sendExpoPush: x.fn, getTargetToken: tokenOk, now: () => T0 };
  const [a, b] = await Promise.all([runDraftOrderNotify(deps), runDraftOrderNotify(deps)]);
  assertEquals(x.sent.length, 1, `sent ${x.sent.length} times: the claim does not check push_attempts`);
  const outcomes = [a.outcomes, b.outcomes].map((o) => JSON.stringify(o)).sort();
  assertEquals(outcomes, [JSON.stringify({ claim_lost: 1 }), JSON.stringify({ sent: 1 })]);
  assertEquals(db.row('n1').push_attempts, 2);
  assertEquals(db.row('n1').push_status, 'sent');
});

Deno.test('a row SETTLED between a run\'s read and its claim is not claimed again (status half of the version)', async () => {
  // Run B reads the stale 'sending' row; before B claims, the row's owner
  // settles it 'sent' (a settle leaves push_attempts alone). The count alone
  // still matches; only the status eq stops a second push of a sent row.
  const db = new FakeDb();
  strandedAt(db, 'n1', T0 - STALE_SENDING_MS - 1, 1);
  let first = true;
  db.tick = () => {
    if (first) {
      first = false;
      Object.assign(db.row('n1'), { push_status: 'sent', push_error: null });
    }
    return Promise.resolve();
  };
  const x = expo();
  const r = await runDraftOrderNotify({ admin: db, sendExpoPush: x.fn, getTargetToken: tokenOk, now: () => T0 });
  assertEquals(x.sent.length, 0, 'a sent row was claimed and pushed again');
  assertEquals(r.outcomes, { claim_lost: 1 });
  assertEquals(db.row('n1').push_status, 'sent');
});

// ---------------------------------------------------------------------------
// 6. GUARD (a): a reclaim at the attempt cap settles 'failed' unsent
// ---------------------------------------------------------------------------
Deno.test('guard (a): a stale sending row that used its last attempt is settled failed WITHOUT a send', async () => {
  assertEquals(reclaimExhausted({ push_status: 'sending', push_attempts: MAX_PUSH_ATTEMPTS }), true);
  assertEquals(reclaimExhausted({ push_status: 'sending', push_attempts: MAX_PUSH_ATTEMPTS - 1 }), false);
  assertEquals(reclaimExhausted({ push_status: 'pending', push_attempts: MAX_PUSH_ATTEMPTS }), false);
  assertEquals(nextPushStatus('attempts_exhausted', MAX_PUSH_ATTEMPTS + 1), 'failed');

  const db = new FakeDb();
  strandedAt(db, 'n1', T0 - STALE_SENDING_MS - 1, MAX_PUSH_ATTEMPTS);
  strandedAt(db, 'n2', T0 - STALE_SENDING_MS - 1, MAX_PUSH_ATTEMPTS - 1);
  db.ctx.set('n2', db.ctx.get('n1'));
  const x = expo();
  const r = await runDraftOrderNotify({ admin: db, sendExpoPush: x.fn, getTargetToken: tokenOk, now: () => T0 });
  assertEquals(x.sent.length, 1, 'only the row under the cap is sent');
  assertEquals(db.row('n1').push_status, 'failed');
  assertEquals(db.row('n1').push_error, 'attempts_exhausted');
  assertEquals(db.row('n2').push_status, 'sent');
  assertEquals(r.outcomes, { failed: 1, sent: 1 });
});

Deno.test('guard (a): even if EVERY settle fails, a row is pushed at most MAX_PUSH_ATTEMPTS times, then ends failed', async () => {
  const db = new FakeDb();
  addDraftStarted(db, 'n1');
  const x = expo();
  let settlesWork = false;
  db.updateFault = (patch) => (!settlesWork && patch.push_status !== 'sending' ? { code: '08006', message: 'stub' } : null);
  // A run every 10 min + 1 ms for many windows: each reclaims the stuck row.
  for (let w = 0; w < MAX_PUSH_ATTEMPTS + 3; w++) {
    await quiet(() => runDraftOrderNotify({ admin: db, sendExpoPush: x.fn, getTargetToken: tokenOk, now: () => T0 + w * (STALE_SENDING_MS + 1) }));
  }
  assertEquals(x.sent.length, MAX_PUSH_ATTEMPTS, `pushed ${x.sent.length} times`);
  // Once a settle can land again, the exhausted row ends 'failed', still unsent.
  settlesWork = true;
  await runDraftOrderNotify({ admin: db, sendExpoPush: x.fn, getTargetToken: tokenOk, now: () => T0 + 20 * STALE_SENDING_MS });
  assertEquals(x.sent.length, MAX_PUSH_ATTEMPTS);
  assertEquals(db.row('n1').push_status, 'failed');
  assertEquals(db.row('n1').push_error, 'attempts_exhausted');
});

// ---------------------------------------------------------------------------
// 7. GUARD (b): a settle lands only on the run's own claim
// ---------------------------------------------------------------------------
Deno.test('guard (b): a run whose row was re-claimed meanwhile does not overwrite the newer claim (settle_lost)', async () => {
  const db = new FakeDb();
  addDraftStarted(db, 'n1');
  const hold = deferred<PushSendResult>();
  const x = expo(() => hold.promise);
  const a = runDraftOrderNotify({ admin: db, sendExpoPush: x.fn, getTargetToken: tokenOk, now: () => T0 });
  while (x.sent.length === 0) await new Promise((r) => setTimeout(r, 1));
  assertEquals(db.row('n1').push_attempts, 1);
  // Another run's claim lands on the row (attempt 2) while A is still in Expo.
  Object.assign(db.row('n1'), { push_status: 'sending', push_attempts: 2, push_attempted_at: new Date(T0 + 1).toISOString() });
  hold.resolve({ sent: true });
  const r = await a;
  assertEquals(r.outcomes, { settle_lost: 1 }, 'a lost settle is its own outcome, not settle_failed');
  assertEquals(db.row('n1').push_status, 'sending', 'A overwrote a newer claim it does not own');
  assertEquals(db.row('n1').push_attempts, 2);
});
