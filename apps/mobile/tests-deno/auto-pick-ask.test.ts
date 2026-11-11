/**
 * The draft room's auto-pick ask (lib/game/autoPickAsk.ts): it fires AT the live
 * deadline (never on a stale server reading, never with jitter), asks again on
 * not_overdue / a transport failure / a 5xx, and stops on a recorded pick, a turn
 * change, a stall, a price outage or the bound. Giorgio, 2026-11-10: "the
 * selection needs to be instant so the draft flow continues".
 * Run: cd apps/mobile/tests-deno && deno test auto-pick-ask.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  AUTO_PICK_CAP_MS,
  AUTO_PICK_MAX_ASKS,
  AUTO_PICK_RETRY_MS,
  type AskState,
  NO_ASK,
  askAnswered,
  askForTurn,
  askSent,
  askWaitMs,
  autoPickDueAt,
  nextAskStep,
} from '../lib/game/autoPickAsk.ts';
import type { FunctionRefusal } from '../lib/functionRefusal.ts';
import ROOM from '../components/game/DraftRoom.tsx' with { type: 'text' };

const ok: FunctionRefusal = { transport: false, status: null, reason: null, body: { ok: true } };
const refused = (reason: string, body: Record<string, unknown> = {}, status: number | null = null): FunctionRefusal =>
  ({ transport: false, status, reason, body: { ok: false, reason, ...body } });
const notOverdue = (leftMs: number) =>
  refused('not_overdue', { deadline_at: new Date(1_000_000 + leftMs).toISOString(), server_now: new Date(1_000_000).toISOString() });

// ── Trigger ──

Deno.test('the ask is due at the server deadline, moved onto the device clock by the read\'s offset', () => {
  // The device clock runs 5 minutes AHEAD of the server; 45 s were left when the read was sent.
  const sentAtMs = Date.parse('2026-11-11T19:05:00.000Z');
  const dueAt = autoPickDueAt({ running: true, deadlineAt: '2026-11-11T19:00:45.000Z', serverNow: '2026-11-11T19:00:00.000Z', sentAtMs });
  assertEquals(dueAt, sentAtMs + 45_000);
  // No clock, no ask.
  assertEquals(autoPickDueAt({ running: false, deadlineAt: '2026-11-11T19:00:45.000Z', serverNow: '2026-11-11T19:00:00.000Z', sentAtMs }), null);
  assertEquals(autoPickDueAt({ running: true, deadlineAt: null, serverNow: '2026-11-11T19:00:00.000Z', sentAtMs }), null);
  assertEquals(autoPickDueAt({ running: true, deadlineAt: 'nonsense', serverNow: '2026-11-11T19:00:00.000Z', sentAtMs }), null);
});

Deno.test('the trigger fires at the live deadline, with no jitter, however long ago the room was read', () => {
  const dueAt = 100_000;
  const ask = askForTurn(NO_ASK, 7);
  assertEquals(askWaitMs(ask, dueAt, 55_000), 45_000); // read 45 s before zero: the timer is set for zero
  assertEquals(askWaitMs(ask, dueAt, 99_999), 1);
  assertEquals(askWaitMs(ask, dueAt, 100_000), 0); // at zero: now
  assertEquals(askWaitMs(ask, dueAt, 160_000), 0); // a room opened late on an overdue turn asks at once
  // Same inputs, same answer (no randomness anywhere).
  for (let i = 0; i < 20; i++) assertEquals(askWaitMs(ask, dueAt, 99_000), 1_000);
});

Deno.test('no clock running: never asks', () => {
  assertEquals(askWaitMs(askForTurn(NO_ASK, 3), null, 0), null);
  assertEquals(askWaitMs(NO_ASK, 0, 10), null); // the initial state is stopped (no turn yet)
});

// ── Retry ──

Deno.test('not_overdue asks again: at the server\'s own deadline when that is sooner, never later than the retry spacing', () => {
  assertEquals(nextAskStep(notOverdue(120)), { kind: 'retry', delayMs: 170 });
  assertEquals(nextAskStep(notOverdue(4_000)), { kind: 'retry', delayMs: AUTO_PICK_RETRY_MS });
  assertEquals(nextAskStep(notOverdue(-30)), { kind: 'retry', delayMs: 50 }); // never a 0 ms loop
  assertEquals(nextAskStep(refused('not_overdue')), { kind: 'retry', delayMs: AUTO_PICK_RETRY_MS }); // no times in the body
});

Deno.test('a transport failure or a server fault asks again; a 429 does not', () => {
  assertEquals(nextAskStep({ transport: true }), { kind: 'retry', delayMs: AUTO_PICK_RETRY_MS });
  assertEquals(nextAskStep(refused('unhandled', {}, 500)), { kind: 'retry', delayMs: AUTO_PICK_RETRY_MS });
  assertEquals(nextAskStep(refused('rate_limited', {}, 429)), { kind: 'stop' });
});

Deno.test('the answers that end the ask', () => {
  assertEquals(nextAskStep(ok), { kind: 'done' });
  assertEquals(nextAskStep({ transport: false, status: null, reason: null, body: { ok: true, already_recorded: true } }), { kind: 'done' });
  assertEquals(nextAskStep(refused('pick_conflict')), { kind: 'done' });
  assertEquals(nextAskStep(refused('draft_complete')), { kind: 'done' });
  assertEquals(nextAskStep(refused('stalled')), { kind: 'stalled' });
  assertEquals(nextAskStep(refused('price_unavailable')), { kind: 'waiting_for_prices' });
  for (const r of ['clock_not_running', 'draft_not_in_progress', 'stale_pick_number', 'not_a_member']) assertEquals(nextAskStep(refused(r)), { kind: 'stop' }, r);
});

Deno.test('after not_overdue the next ask waits its spacing, then goes', () => {
  let ask = askSent(askForTurn(NO_ASK, 4), 100_000);
  assertEquals(askWaitMs(ask, 100_000, 100_010), null); // in flight: no second ask
  ask = askAnswered(ask, 4, nextAskStep(notOverdue(300)), 100_080);
  assertEquals(askWaitMs(ask, 100_000, 100_080), 350);
  assertEquals(askWaitMs(ask, 100_000, 100_430), 0);
});

// ── Stops ──

Deno.test('a recorded pick, a stall, a price outage or another refusal stops the turn\'s asks', () => {
  for (const r of [ok, refused('pick_conflict'), refused('stalled'), refused('price_unavailable'), refused('rate_limited', {}, 429)]) {
    const ask = askAnswered(askSent(askForTurn(NO_ASK, 9), 0), 9, nextAskStep(r), 300);
    assertEquals(askWaitMs(ask, 0, 1_000), null, JSON.stringify(r));
  }
});

Deno.test('the pick row arriving moves the turn: the old turn\'s asks end and its late answer changes nothing', () => {
  const inFlight = askSent(askForTurn(NO_ASK, 9), 0);
  const next = askForTurn(inFlight, 10); // the realtime insert re-read the room: pick 10 is on the clock
  assertEquals(next, { pick: 10, asks: 0, firstAskAt: null, nextAt: null, inFlight: false, stopped: false });
  // Pick 9's answer lands after the move: pick 10's ask is untouched.
  assertEquals(askAnswered(next, 9, { kind: 'retry', delayMs: 500 }, 400), next);
  assertEquals(askAnswered(next, 9, { kind: 'stalled' }, 400), next);
  // And pick 10 asks at ITS deadline.
  assertEquals(askWaitMs(next, 60_400, 400), 60_000);
});

Deno.test('bounded: no ask past the cap after the first ask, however the server answers', () => {
  let ask = askSent(askForTurn(NO_ASK, 2), 0);
  ask = askAnswered(ask, 2, { kind: 'retry', delayMs: AUTO_PICK_RETRY_MS }, 200);
  assertEquals(askWaitMs(ask, 0, AUTO_PICK_CAP_MS - 1), 0);
  assertEquals(askWaitMs(ask, 0, AUTO_PICK_CAP_MS), null);
});

Deno.test('the retry never runs forever: a server that answers not_overdue / 5xx / nothing for good gets at most MAX asks', () => {
  for (const answer of [notOverdue(0), refused('unhandled', {}, 503), { transport: true } as FunctionRefusal]) {
    let ask: AskState = askForTurn(NO_ASK, 5);
    let now = 0;
    let sent = 0;
    for (let guard = 0; guard < 10_000; guard++) {
      const wait = askWaitMs(ask, 0, now);
      if (wait === null) break;
      now += wait;
      ask = askSent(ask, now);
      sent += 1;
      now += 40; // the round trip
      ask = askAnswered(ask, 5, nextAskStep(answer), now);
    }
    assert(sent <= AUTO_PICK_MAX_ASKS, `${sent} asks`);
    assert(sent >= 10, `kept asking for a while (${sent})`);
    assert(now <= AUTO_PICK_CAP_MS + AUTO_PICK_RETRY_MS + 40, `stopped by ${now} ms`);
    // validate-and-record-pick allows 60 a minute per user, shared with the manager's own picks.
    assert(AUTO_PICK_MAX_ASKS <= 15);
  }
});

// ── A re-render mid-wait (the old effect lost the ask: it marked it asked when the
// jittered timer was SET, and the cleanup then cleared that timer) ──

/** The room's effect, run as the component would: each render recomputes the
 * wait from the same state and sets a timer; a re-render clears it first. */
function room() {
  let ask: AskState = NO_ASK;
  let timer: { at: number } | null = null;
  const sentAt: number[] = [];
  return {
    render(pick: number, dueAt: number | null, now: number) {
      timer = null; // the previous render's cleanup: clearTimeout
      ask = askForTurn(ask, pick);
      const wait = askWaitMs(ask, dueAt, now);
      if (wait !== null) timer = { at: now + wait };
    },
    advance(to: number, pick: number) {
      if (timer && timer.at <= to) {
        ask = askSent(ask, timer.at);
        sentAt.push(timer.at);
        timer = null;
        return pick;
      }
      return null;
    },
    answer(pick: number, r: FunctionRefusal, now: number) {
      ask = askAnswered(ask, pick, nextAskStep(r), now);
    },
    get sentAt() {
      return sentAt;
    },
  };
}

Deno.test('a re-render while the timer waits (a new reading, a tick, a refusal) never loses the ask', () => {
  const r = room();
  r.render(3, 10_000, 0);
  r.render(3, 10_000, 9_990); // a re-render 10 ms before zero cancels and re-sets the timer
  r.render(3, 10_020, 9_995); // a fresh reading moves the deadline estimate by 20 ms
  assertEquals(r.advance(10_020, 3), 3);
  assertEquals(r.sentAt, [10_020]);
});

Deno.test('a re-render while the ask is in flight sends no duplicate; the retry after not_overdue goes', () => {
  const r = room();
  r.render(3, 10_000, 0);
  r.advance(10_000, 3);
  r.render(3, 10_000, 10_010); // in flight
  assertEquals(r.advance(20_000, 3), null);
  r.answer(3, notOverdue(200), 10_040);
  r.render(3, 10_000, 10_040);
  assertEquals(r.advance(10_290, 3), 3);
  assertEquals(r.sentAt, [10_000, 10_290]);
});

// ── The room wires it (source guards) ──

Deno.test('the room asks on the live deadline (autoPickDueAt), never on the server reading\'s clock kind, never with jitter', () => {
  assert(!ROOM.includes("if (clock.kind !== 'auto_picking' || m === 0) return;"), 'the backstop still keys on room.clock');
  assert(!/Math\.random/.test(ROOM), 'jitter is back');
  assert(ROOM.includes('const dueAt = room.autoPickDueAt;') && ROOM.includes('askWaitMs(ask, dueAt, Date.now())'), 'the wait is not computed from the live deadline');
  assert(ROOM.includes('askSent(ask, Date.now())'), 'the ask must be counted only when it is sent');
  assert(ROOM.includes('askAnswered(autoAsk.current, pick, step, Date.now())'), 'every answer goes through askAnswered');
  // The whole ask block: the wait is exactly the live deadline's, and nothing in it reads the server reading's clock.
  const block = ROOM.slice(ROOM.indexOf('// The auto-pick ask (lib/game/autoPickAsk'), ROOM.indexOf("// The draft's ending (U-10)."));
  assert(block.length > 500, 'the ask block moved');
  assert(block.includes('    const wait = askWaitMs(ask, dueAt, Date.now());\n'), 'the wait is gated on something else');
  assert(!/\bclock\b|clock\.kind|shownClock/.test(block.replace(/\/\/.*$/gm, '')), 'the ask reads a clock reading again');
});
