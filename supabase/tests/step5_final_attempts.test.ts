/**
 * Every job that can be the final word for a week reaches step 5 (the previous
 * real close) on its last attempt. Planner condition, 2026-11-17: "every job that
 * can be the final word for a week must have a last attempt that reaches step 5".
 * Hermetic (no database, no network):
 *   deno test --allow-read supabase/tests/step5_final_attempts.test.ts
 *
 * Step 5 is gated by prevCloseAllowed(attempt, maxAttempts, live): the last
 * attempt, or a session that is not today. So the proof needs the ATTEMPT NUMBER
 * each path really runs with, and that number lives in three places outside the
 * pure builders. Each is read from its source here, not restated:
 *   1. the cron commands (supabase/migrations/, replayed by ./cron_jobs.ts): the
 *      Monday/Tuesday week-start and Friday week-end crons send no
 *      X-Retry-Attempt header (attempt 1); the Mon/Tue week-end heal sends '3';
 *   2. schedule_snapshot_retry's latest definition: it re-posts the same job five
 *      minutes later with X-Retry-Attempt = its p_attempt;
 *   3. the two handlers: they read the header with retryAttemptFrom, call
 *      scheduleRetry(attempt + 1) only while attempt < MAX_RETRIES, and pass
 *      exactly (retryAttempt, MAX_RETRIES) into their price-request builder. The
 *      handlers open a database client and cannot be imported here, so this part
 *      is a source-text check of index.ts. It is the check that fails if a call
 *      site passes a constant in place of the run's attempt.
 * The run instants come from the cron schedules themselves (pg_cron runs in GMT).
 *
 * process-week-results has no attempt number: scoringPriceRequest always asks for
 * step 5 over the week's sessions, so every one of its three crons does.
 */
import { assert, assertEquals, assertNotEquals, assertStringIncludes } from 'jsr:@std/assert';
import { migrationFiles, scheduledJobs, type ScheduledJob } from './cron_jobs.ts';
import { retryAttemptFrom } from '../functions/_shared/retry-attempt.ts';
import { scoringPriceRequest, type WeekPriceRequest } from '../functions/_shared/week-price.ts';
import { WEEK_START_MAX_ATTEMPTS, weekStartPriceRequest } from '../functions/snapshot-week-start/plan.ts';
import { WEEK_END_MAX_ATTEMPTS, weekEndPriceRequest } from '../functions/snapshot-week-end/close.ts';
import type { CalendarSession } from '../functions/_shared/week-window.ts';

const ROOT = new URL('../../', import.meta.url);
const read = (path: string) => Deno.readTextFile(new URL(path, ROOT));

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

let jobsCache: Map<string, ScheduledJob> | null = null;
async function job(name: string): Promise<ScheduledJob> {
  jobsCache ??= new Map(scheduledJobs(await migrationFiles()).map((j) => [j.name, j]));
  const j = jobsCache.get(name);
  assert(j, `cron job ${name} is not scheduled by supabase/migrations/`);
  return j;
}

/** The X-Retry-Attempt header value a cron command sends, or null for none. */
function retryHeader(command: string): string | null {
  const m = /'X-Retry-Attempt'\s*,\s*'([^']*)'/i.exec(command);
  return m ? m[1] : null;
}

/** The instant a 'M H * * DOW' schedule fires on `date` (GMT). Throws off-day. */
function firesAt(schedule: string, date: string): Date {
  const [min, hour, dom, mon, dow] = schedule.trim().split(/\s+/);
  assertEquals([dom, mon], ['*', '*'], `unexpected schedule shape ${schedule}`);
  const at = new Date(`${date}T${hour.padStart(2, '0')}:${min.padStart(2, '0')}:00Z`);
  assert(dow.split(',').map(Number).includes(at.getUTCDay()), `${schedule} does not fire on ${date}`);
  return at;
}

const plus5 = (d: Date, n: number) => new Date(d.getTime() + n * 5 * 60_000);

/**
 * The attempts one cron firing produces, per the handler's rule (asserted from its
 * source below): run with the cron's header, then while attempt < max, a retry
 * with attempt + 1 five minutes later (schedule_snapshot_retry, asserted below).
 * This is the chain with every retry SUCCEEDING in being scheduled.
 */
function chain(first: Date, header: string | null, max: number): Array<{ attempt: number; at: Date }> {
  const out = [{ attempt: retryAttemptFrom(header), at: first }];
  while (out[out.length - 1].attempt < max) {
    const last = out[out.length - 1];
    out.push({ attempt: last.attempt + 1, at: plus5(first, out.length) });
  }
  return out;
}

const weekdays = (from: string, to: string, skip: string[] = [], closeEt = '16:00'): CalendarSession[] => {
  const out: CalendarSession[] = [];
  for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`); d = new Date(d.getTime() + 86_400_000)) {
    const date = d.toISOString().slice(0, 10);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6 || skip.includes(date)) continue;
    out.push({ sessionDate: date, openEt: '09:30', closeEt });
  }
  return out;
};

const SYMBOLS = ['AAPL', 'TM'];

// ---------------------------------------------------------------------------
// 1-3. Where the attempt numbers come from
// ---------------------------------------------------------------------------

Deno.test('source: the week-start and week-end crons send no attempt header (attempt 1); the heal sends 3', async () => {
  const start = await job('snapshot-week-start');
  const end = await job('snapshot-week-end');
  const heal = await job('snapshot-week-end-heal');
  assertEquals(start.schedule, '35 14 * * 1,2');
  assertEquals(end.schedule, '5 21 * * 5');
  assertEquals(heal.schedule, '30 15 * * 1,2');
  assertStringIncludes(start.command, '/functions/v1/snapshot-week-start');
  assertStringIncludes(end.command, '/functions/v1/snapshot-week-end');
  assertStringIncludes(heal.command, '/functions/v1/snapshot-week-end');
  assertEquals(retryHeader(start.command), null);
  assertEquals(retryHeader(end.command), null);
  assertEquals(retryHeader(heal.command), '3');
  assertEquals(retryAttemptFrom(null), 1);
  assertEquals(retryAttemptFrom('3'), 3);
});

Deno.test('source: schedule_snapshot_retry (latest definition) re-posts each snapshot job 5 minutes later with X-Retry-Attempt = p_attempt', async () => {
  const files = (await migrationFiles())
    .filter((f) => /create\s+or\s+replace\s+function\s+(public\.)?schedule_snapshot_retry\s*\(/i.test(f.sql))
    .sort((a, b) => a.name.localeCompare(b.name));
  assert(files.length > 0, 'no migration defines schedule_snapshot_retry');
  const sql = files[files.length - 1].sql;
  assertStringIncludes(sql, "NOW() + INTERVAL '5 minutes'");
  for (const fn of ['snapshot-week-start', 'snapshot-week-end']) {
    const at = sql.indexOf(`p_job_name = '${fn}'`);
    assert(at >= 0, `no branch for ${fn}`);
    // The branch runs to the next ELSIF / ELSE (each branch is one cron.schedule).
    const next = sql.slice(at + 1).search(/\n\s*(ELSIF|ELSE)\b/);
    const branch = next < 0 ? sql.slice(at) : sql.slice(at, at + 1 + next);
    assertStringIncludes(branch, `/functions/v1/${fn}'`);
    assertStringIncludes(branch, "'X-Retry-Attempt', '%s'");
    // format()'s first argument after the template fills the header's %s.
    assert(/\$sql\$,\s*p_attempt\s*,/.test(branch), `${fn}: the header is not filled with p_attempt`);
  }
});

for (const [fn, builder, maxName] of [
  ['snapshot-week-start', 'weekStartPriceRequest', 'WEEK_START_MAX_ATTEMPTS'],
  ['snapshot-week-end', 'weekEndPriceRequest', 'WEEK_END_MAX_ATTEMPTS'],
] as const) {
  Deno.test(`source: ${fn}/index.ts reads the header, retries attempt + 1 only below MAX_RETRIES, and prices with THIS run's attempt`, async () => {
    const src = await read(`supabase/functions/${fn}/index.ts`);
    assertStringIncludes(src, `const MAX_RETRIES = ${maxName};`);
    assertStringIncludes(src, "const retryAttempt = retryAttemptFrom(req.headers.get('X-Retry-Attempt'));");
    // Every retry is attempt + 1, and each is guarded by attempt < MAX_RETRIES.
    const calls = [...src.matchAll(/scheduleRetry\(supabase, JOB_NAME, ([^)]*)\)/g)];
    assertEquals(calls.length, 2, 'the throw path and the incomplete path');
    for (const c of calls) {
      assertEquals(c[1], 'retryAttempt + 1');
      const before = src.slice(Math.max(0, c.index! - 400), c.index!);
      assertStringIncludes(before, 'if (retryAttempt < MAX_RETRIES) {');
    }
    // The ONE price request: this run's attempt and the handler's max, nothing else.
    const at = src.indexOf(`fetchWeekPrices(${builder}({`);
    assert(at >= 0, `${fn}: the price request is not built by ${builder}`);
    const args = src.slice(at, src.indexOf('})', at));
    assertStringIncludes(args, 'attempt: retryAttempt,');
    assertStringIncludes(args, 'maxAttempts: MAX_RETRIES,');
    assertStringIncludes(args, 'now: new Date(),');
    assertEquals(src.split(`${builder}(`).length - 1, 1, `${fn}: one call site`);
  });
}

Deno.test('source: process-week-results prices with scoringPriceRequest from the matchup week start', async () => {
  const src = await read('supabase/functions/process-week-results/index.ts');
  assertStringIncludes(src, 'fetchWeekPrices(scoringPriceRequest(symbols, weekStart, new Date()),');
});

// ---------------------------------------------------------------------------
// 4. Each final word reaches step 5 at the instant and attempt it runs with
// ---------------------------------------------------------------------------

function assertStep5Only(
  runs: Array<{ attempt: number; at: Date }>,
  build: (attempt: number, now: Date) => WeekPriceRequest,
  max: number,
) {
  assertEquals(runs[runs.length - 1].attempt, max, 'the chain ends on the last attempt');
  for (const r of runs) {
    const req = build(r.attempt, r.at);
    if (r.attempt === max) assertNotEquals(req.prevClose, null, `attempt ${r.attempt} at ${r.at.toISOString()} must reach step 5`);
    else assertEquals(req.prevClose, null, `attempt ${r.attempt} at ${r.at.toISOString()} is not the last; no step 5 yet`);
  }
}

Deno.test('week start, Monday open (EST): 14:35 / 14:40 / 14:45Z; only the 14:45Z attempt 3 reaches step 5, over last week', async () => {
  const cron = await job('snapshot-week-start');
  const sessions = weekdays('2026-11-09', '2026-11-20');
  const window = { open: new Date('2026-11-16T14:30:00Z'), openSessionDate: '2026-11-16' };
  const runs = chain(firesAt(cron.schedule, '2026-11-16'), retryHeader(cron.command), WEEK_START_MAX_ATTEMPTS);
  assertEquals(runs.map((r) => r.at.toISOString().slice(11, 16)), ['14:35', '14:40', '14:45']);
  const build = (attempt: number, now: Date) =>
    weekStartPriceRequest({ symbols: SYMBOLS, window, sessions, attempt, maxAttempts: WEEK_START_MAX_ATTEMPTS, now });
  assertStep5Only(runs, build, WEEK_START_MAX_ATTEMPTS);
  assertEquals(build(3, runs[2].at).prevClose, { fromDate: '2026-11-09', toDate: '2026-11-13' });
});

Deno.test('week start, Monday open (EDT, the cron an hour after the open): the same chain, step 5 only on attempt 3', async () => {
  const cron = await job('snapshot-week-start');
  const sessions = weekdays('2026-09-21', '2026-10-02');
  const window = { open: new Date('2026-09-28T13:30:00Z'), openSessionDate: '2026-09-28' };
  const runs = chain(firesAt(cron.schedule, '2026-09-28'), retryHeader(cron.command), WEEK_START_MAX_ATTEMPTS);
  assertStep5Only(runs, (attempt, now) =>
    weekStartPriceRequest({ symbols: SYMBOLS, window, sessions, attempt, maxAttempts: WEEK_START_MAX_ATTEMPTS, now }), WEEK_START_MAX_ATTEMPTS);
});

Deno.test('week start, holiday Monday (open Tuesday): the Tuesday chain is the open day; attempt 3 at 14:45Z reaches step 5', async () => {
  const cron = await job('snapshot-week-start');
  const sessions = weekdays('2027-01-11', '2027-01-22', ['2027-01-18']); // MLK day
  const window = { open: new Date('2027-01-19T14:30:00Z'), openSessionDate: '2027-01-19' };
  const runs = chain(firesAt(cron.schedule, '2027-01-19'), retryHeader(cron.command), WEEK_START_MAX_ATTEMPTS);
  const build = (attempt: number, now: Date) =>
    weekStartPriceRequest({ symbols: SYMBOLS, window, sessions, attempt, maxAttempts: WEEK_START_MAX_ATTEMPTS, now });
  assertStep5Only(runs, build, WEEK_START_MAX_ATTEMPTS);
  assertEquals(build(3, runs[2].at).prevClose, { fromDate: '2027-01-11', toDate: '2027-01-15' });
});

Deno.test('week start, the Tuesday cron healing a Monday open: attempt 1 already reaches step 5 (a past session)', async () => {
  const cron = await job('snapshot-week-start');
  const sessions = weekdays('2026-11-09', '2026-11-20');
  const window = { open: new Date('2026-11-16T14:30:00Z'), openSessionDate: '2026-11-16' };
  for (const r of chain(firesAt(cron.schedule, '2026-11-17'), retryHeader(cron.command), WEEK_START_MAX_ATTEMPTS)) {
    const req = weekStartPriceRequest({ symbols: SYMBOLS, window, sessions, attempt: r.attempt, maxAttempts: WEEK_START_MAX_ATTEMPTS, now: r.at });
    assertEquals(req.live, null);
    assertNotEquals(req.prevClose, null, `attempt ${r.attempt}`);
  }
});

Deno.test('week end, Friday close: 21:05 / 21:10 / 21:15Z; only the 21:15Z attempt 3 reaches step 5, over this week', async () => {
  const cron = await job('snapshot-week-end');
  const sessions = weekdays('2026-11-09', '2026-11-20');
  const window = { open: new Date('2026-11-16T14:30:00Z'), close: new Date('2026-11-20T21:00:00Z'), closeSessionDate: '2026-11-20' };
  const runs = chain(firesAt(cron.schedule, '2026-11-20'), retryHeader(cron.command), WEEK_END_MAX_ATTEMPTS);
  assertEquals(runs.map((r) => r.at.toISOString().slice(11, 16)), ['21:05', '21:10', '21:15']);
  const build = (attempt: number, now: Date) =>
    weekEndPriceRequest({ symbols: SYMBOLS, window, sessions, attempt, maxAttempts: WEEK_END_MAX_ATTEMPTS, now });
  assertStep5Only(runs, build, WEEK_END_MAX_ATTEMPTS);
  assertEquals(build(3, runs[2].at).prevClose, { fromDate: '2026-11-16', toDate: '2026-11-19' });
});

Deno.test('week end, Good Friday (close Thursday): the Friday cron is a past session, so attempt 1 already reaches step 5', async () => {
  const cron = await job('snapshot-week-end');
  const sessions = weekdays('2027-03-15', '2027-03-25'); // 2027-03-26 is Good Friday
  const window = { open: new Date('2027-03-22T13:30:00Z'), close: new Date('2027-03-25T20:00:00Z'), closeSessionDate: '2027-03-25' };
  for (const r of chain(firesAt(cron.schedule, '2027-03-26'), retryHeader(cron.command), WEEK_END_MAX_ATTEMPTS)) {
    const req = weekEndPriceRequest({ symbols: SYMBOLS, window, sessions, attempt: r.attempt, maxAttempts: WEEK_END_MAX_ATTEMPTS, now: r.at });
    assertEquals(req.prevClose, { fromDate: '2027-03-22', toDate: '2027-03-24' }, `attempt ${r.attempt}`);
  }
});

Deno.test('week end heal, Monday and Tuesday 15:30Z: its header makes it the LAST attempt, and the session is past; step 5 either way', async () => {
  const heal = await job('snapshot-week-end-heal');
  const sessions = weekdays('2026-11-09', '2026-11-24');
  const window = { open: new Date('2026-11-16T14:30:00Z'), close: new Date('2026-11-20T21:00:00Z'), closeSessionDate: '2026-11-20' };
  const attempt = retryAttemptFrom(retryHeader(heal.command));
  assert(attempt >= WEEK_END_MAX_ATTEMPTS, `the heal runs as attempt ${attempt}, below the last attempt ${WEEK_END_MAX_ATTEMPTS}`);
  for (const day of ['2026-11-23', '2026-11-24']) {
    const runs = chain(firesAt(heal.schedule, day), retryHeader(heal.command), WEEK_END_MAX_ATTEMPTS);
    assertEquals(runs.length, 1, 'the heal schedules no retry of its own');
    const req = weekEndPriceRequest({ symbols: SYMBOLS, window, sessions, attempt, maxAttempts: WEEK_END_MAX_ATTEMPTS, now: runs[0].at });
    assertEquals(req.live, null);
    assertEquals(req.prevClose, { fromDate: '2026-11-16', toDate: '2026-11-19' }, `${day}: this week only`);
  }
});

Deno.test('process-week-results: all three crons (Fri 21:15Z, Fri 22:00Z, Sat 15:00Z) ask for step 5 over the week', async () => {
  const weekStart = '2026-11-16T14:30:00+00:00'; // matchups.week_start as PostgREST returns it
  for (const [name, day, to] of [
    ['process-weekly-matchups', '2026-11-20', '2026-11-20'],
    ['process-weekly-matchups-heal-2200z', '2026-11-20', '2026-11-20'],
    ['process-weekly-matchups-heal-sat', '2026-11-21', '2026-11-21'],
  ] as const) {
    const cron = await job(name);
    assertStringIncludes(cron.command, '/functions/v1/process-week-results');
    const req = scoringPriceRequest(SYMBOLS, weekStart, firesAt(cron.schedule, day));
    assertEquals(req.prevClose, { fromDate: '2026-11-16', toDate: to }, name);
    assertEquals(req.live, { fromMs: Date.parse(weekStart) }, name);
  }
});
