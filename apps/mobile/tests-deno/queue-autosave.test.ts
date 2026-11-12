/**
 * Your queue saves as you go (PRODUCT_RULES 2026-11-11, "B saves as you go"; board #call-queue-save). The pure
 * machine in lib/game/queueAutosave.ts, driven with an injected clock and an injected set_draft_queue, through the
 * acceptance lines: debounce (2), failure in place with the list kept (3), last edit wins under any resolution
 * order (4), decision 19's prune merging with a pending edit (5), flush on leave (6), `error` checked (7). Source
 * guards at the end pin QueueEditor to the machine (1).
 * Run: `cd apps/mobile && deno test --no-check --sloppy-imports --allow-read --allow-env --unstable-raw-imports tests-deno/`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  attachQueueAutosave,
  QUEUE_SAVE_DELAY_MS,
  QUEUE_SAVE_MAX_WAIT_MS,
  QueueAutosave,
  readSaveResult,
  resetQueueAutosaves,
  type Clock,
  type RpcResult,
} from '../lib/game/queueAutosave.ts';
import { addSymbol, moveItem, queueBaseline, removeItem } from '../lib/game/draftQueue.ts';
import { queueEditorKey, queueStateOnRead, queueStateOnSaved, queueStateStart } from '../lib/game/draftQueueRead.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const FAILED = "Your queue couldn't be saved.";

/** A clock the test moves by hand. */
class FakeClock implements Clock {
  t = 0;
  private timers = new Map<number, { at: number; fn: () => void }>();
  private next = 1;
  now() {
    return this.t;
  }
  setTimeout(fn: () => void, ms: number) {
    const id = this.next++;
    this.timers.set(id, { at: this.t + ms, fn });
    return id;
  }
  clearTimeout(h: unknown) {
    this.timers.delete(h as number);
  }
  /** Move time forward, firing every timer due on the way (in order). */
  advance(ms: number) {
    const end = this.t + ms;
    for (;;) {
      let due: [number, { at: number; fn: () => void }] | null = null;
      for (const e of this.timers) if (e[1].at <= end && (!due || e[1].at < due[1].at)) due = e;
      if (!due) break;
      this.timers.delete(due[0]);
      this.t = due[1].at;
      due[1].fn();
    }
    this.t = end;
  }
  get pending() {
    return this.timers.size;
  }
}

/**
 * set_draft_queue as a server: every call is held until the test resolves it, and the server STORES a call's list
 * when it resolves (the order calls are processed in is the order they resolve in). Drafted stocks are dropped from
 * what it stores, as 20261129000000 does.
 */
class FakeServer {
  stored: string[] = [];
  drafted = new Set<string>();
  calls: { symbols: string[]; resolve: (r: RpcResult) => void; done: boolean }[] = [];
  send = (symbols: string[]) =>
    new Promise<RpcResult>((resolve) => {
      this.calls.push({ symbols: symbols.slice(), resolve, done: false });
    });
  get open() {
    return this.calls.filter((c) => !c.done);
  }
  /** Process call `i`: store its list and answer ok. */
  ok(i: number) {
    const c = this.calls[i];
    c.done = true;
    this.stored = c.symbols.filter((s) => !this.drafted.has(s));
    c.resolve({ data: { ok: true, symbols: this.stored.slice() }, error: null });
  }
  /** Answer call `i` with a transport / Postgres error (nothing stored). */
  fail(i: number, error: unknown = { message: 'network' }) {
    const c = this.calls[i];
    c.done = true;
    c.resolve({ data: null, error });
  }
  /** A pick: the trigger prunes it from the stored queue. */
  draft(sym: string) {
    this.drafted.add(sym);
    this.stored = this.stored.filter((s) => s !== sym);
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));
async function settle() {
  for (let i = 0; i < 5; i++) await tick();
}

function setup(initial: string[] = ['AAPL', 'MSFT']) {
  const clock = new FakeClock();
  const server = new FakeServer();
  server.stored = initial.slice();
  const storedSeen: string[][] = [];
  const m = new QueueAutosave(initial, { send: server.send, onStored: (s) => storedSeen.push(s) }, clock);
  return { clock, server, m, storedSeen };
}

// ── 2. debounce: a burst is one save, a moment after you stop ──

Deno.test('2: a burst of edits is ONE save, sent QUEUE_SAVE_DELAY_MS after the last edit, with the final list', async () => {
  const { clock, server, m } = setup(['AAPL', 'MSFT']);
  m.edit(addSymbol(m.snapshot().list, 'NVDA'));
  clock.advance(300);
  m.edit(moveItem(m.snapshot().list, 2, -1));
  clock.advance(300);
  m.edit(moveItem(m.snapshot().list, 1, -1));
  assertEquals(m.snapshot().status, 'pending');
  clock.advance(QUEUE_SAVE_DELAY_MS - 1);
  assertEquals(server.calls.length, 0, 'nothing sent while you are still tapping');
  clock.advance(1);
  assertEquals(server.calls.length, 1);
  assertEquals(server.calls[0].symbols, ['NVDA', 'AAPL', 'MSFT']);
  assertEquals(m.snapshot().status, 'saving');
  server.ok(0);
  await settle();
  assertEquals(m.snapshot(), { list: ['NVDA', 'AAPL', 'MSFT'], status: 'idle', failure: null });
  assertEquals(server.stored, ['NVDA', 'AAPL', 'MSFT']);
});

Deno.test('2: a burst that never pauses still saves by QUEUE_SAVE_MAX_WAIT_MS (and only then)', () => {
  const { clock, server, m } = setup(['A1', 'A2', 'A3']);
  for (let t = 0; t < QUEUE_SAVE_MAX_WAIT_MS; t += 400) {
    m.edit(moveItem(m.snapshot().list, t % 800 === 0 ? 0 : 1, 1));
    clock.advance(400);
  }
  assertEquals(server.calls.length, 1, 'one save for the whole run of taps');
});

Deno.test('2: the delay is "a moment": under a second, longer than a repeat tap', () => {
  assert(QUEUE_SAVE_DELAY_MS >= 500 && QUEUE_SAVE_DELAY_MS <= 1000);
  assert(QUEUE_SAVE_MAX_WAIT_MS > QUEUE_SAVE_DELAY_MS);
});

// ── 3. a failure shows in place, the list stays ──

Deno.test("3: a failed save: \"Your queue couldn't be saved.\", the list exactly as you left it; Try again saves it", async () => {
  const { clock, server, m } = setup(['AAPL', 'MSFT']);
  m.edit(removeItem(m.snapshot().list, 0));
  m.edit(addSymbol(m.snapshot().list, 'TSLA'));
  clock.advance(QUEUE_SAVE_DELAY_MS);
  server.fail(0);
  await settle();
  assertEquals(m.snapshot(), { list: ['MSFT', 'TSLA'], status: 'failed', failure: FAILED });
  assertEquals(server.stored, ['AAPL', 'MSFT'], 'nothing stored');
  m.retry();
  assertEquals(server.calls[1].symbols, ['MSFT', 'TSLA']);
  assertEquals(m.snapshot().failure, FAILED, 'the line stays while Try again is in flight');
  server.ok(1);
  await settle();
  assertEquals(m.snapshot(), { list: ['MSFT', 'TSLA'], status: 'idle', failure: null });
});

Deno.test('3: an edit after a failure keeps the line up and saves again on its own', async () => {
  const { clock, server, m } = setup(['AAPL']);
  m.edit(addSymbol(m.snapshot().list, 'NVDA'));
  clock.advance(QUEUE_SAVE_DELAY_MS);
  server.fail(0);
  await settle();
  m.edit(addSymbol(m.snapshot().list, 'AMD'));
  assertEquals(m.snapshot().failure, FAILED);
  clock.advance(QUEUE_SAVE_DELAY_MS);
  assertEquals(server.calls[1].symbols, ['AAPL', 'NVDA', 'AMD']);
  server.ok(1);
  await settle();
  assertEquals(m.snapshot().failure, null);
});

Deno.test('3: a refusal names its reason with the existing lines (no new words)', async () => {
  const { clock, server, m } = setup(['AAPL']);
  m.edit(addSymbol(m.snapshot().list, 'ZZZZ'));
  clock.advance(QUEUE_SAVE_DELAY_MS);
  server.calls[0].done = true;
  server.calls[0].resolve({ data: { ok: false, reason: 'unknown_symbols', symbols: ['ZZZZ'] }, error: null });
  await settle();
  assertEquals(m.snapshot().failure, "ZZZZ can't be queued. Remove it and try again.");
  assertEquals(m.snapshot().list, ['AAPL', 'ZZZZ']);
});

Deno.test('3: a send that throws is a failure, never an unhandled rejection', async () => {
  const clock = new FakeClock();
  const m = new QueueAutosave(['AAPL'], { send: () => Promise.reject(new Error('boom')) }, clock);
  m.edit(['AAPL', 'NVDA']);
  clock.advance(QUEUE_SAVE_DELAY_MS);
  await settle();
  assertEquals(m.snapshot(), { list: ['AAPL', 'NVDA'], status: 'failed', failure: FAILED });
});

Deno.test('3: an OLDER save failing while a newer edit waits shows nothing (the newer save covers it)', async () => {
  const { clock, server, m } = setup(['AAPL']);
  m.edit(['AAPL', 'NVDA']);
  clock.advance(QUEUE_SAVE_DELAY_MS);
  m.edit(['AAPL', 'NVDA', 'AMD']);
  server.fail(0);
  await settle();
  assertEquals(m.snapshot().failure, null);
  assertEquals(m.snapshot().status, 'pending');
  clock.advance(QUEUE_SAVE_DELAY_MS);
  server.ok(1);
  await settle();
  assertEquals(server.stored, ['AAPL', 'NVDA', 'AMD']);
});

// ── 4. last edit wins, whatever order the server answers in ──

/** Edits at the given gaps; after each timer firing, answer every open call NEWEST FIRST (save N+1 before save N). */
async function rapidEditsNewestFirst(m: QueueAutosave, clock: FakeClock, server: FakeServer) {
  const lists = [['AAPL', 'NVDA'], ['NVDA', 'AAPL'], ['NVDA', 'AAPL', 'AMD'], ['AMD', 'NVDA', 'AAPL'], ['AMD', 'NVDA']];
  for (const l of lists) {
    m.edit(l);
    clock.advance(QUEUE_SAVE_DELAY_MS + 50); // each edit's own save is due before the next edit
  }
  for (let round = 0; round < 10 && server.open.length; round++) {
    const open = server.calls.map((c, i) => [c, i] as const).filter(([c]) => !c.done).reverse();
    for (const [, i] of open) server.ok(i);
    await settle();
    clock.advance(QUEUE_SAVE_DELAY_MS);
  }
  return lists[lists.length - 1];
}

Deno.test('4: save N+1 answered before save N: the server ends on the LAST edit, and so does the screen', async () => {
  const { clock, server, m } = setup(['AAPL']);
  const last = await rapidEditsNewestFirst(m, clock, server);
  assertEquals(server.stored, last);
  assertEquals(m.snapshot(), { list: last, status: 'idle', failure: null });
});

Deno.test('4: never two calls in flight; the call after the in-flight one carries the newest list', async () => {
  const { clock, server, m } = setup(['AAPL']);
  m.edit(['AAPL', 'NVDA']);
  clock.advance(QUEUE_SAVE_DELAY_MS);
  m.edit(['AAPL', 'NVDA', 'AMD']);
  clock.advance(QUEUE_SAVE_DELAY_MS);
  m.edit(['AMD']);
  clock.advance(QUEUE_SAVE_DELAY_MS);
  assertEquals(server.open.length, 1, 'the later saves wait for the one in flight');
  server.ok(0);
  await settle();
  assertEquals(server.open.length, 1);
  assertEquals(server.calls[1].symbols, ['AMD'], 'the middle list is skipped: only the newest goes');
  server.ok(1);
  await settle();
  assertEquals(server.calls.length, 2);
  assertEquals(server.stored, ['AMD']);
});

Deno.test("4: an older save's answer landing after a newer edit never moves the list back", async () => {
  const { clock, server, m } = setup(['AAPL']);
  m.edit(['AAPL', 'NVDA']);
  clock.advance(QUEUE_SAVE_DELAY_MS);
  m.edit(['NVDA']);
  server.ok(0); // stores [AAPL, NVDA]
  await settle();
  assertEquals(m.snapshot().list, ['NVDA']);
  assertEquals(m.snapshot().status, 'pending');
});

// ── 5. decision 19: the prune merges with your pending edit, with no failure flash ──

/** QueueEditor's render rule, as the component runs it: a new baseline or drafted set re-bases the machine. */
function makeScreen(m: QueueAutosave, initial: string[], drafted = new Set<string>()) {
  let seen = { baseline: queueBaseline(initial, drafted), key: [...drafted].sort().join(',') };
  return (serverList: string[], d: Set<string>) => {
    const baseline = queueBaseline(serverList, d);
    const key = [...d].sort().join(',');
    if (seen.baseline.join(',') !== baseline.join(',') || seen.key !== key) {
      m.rebase(baseline, d);
      seen = { baseline, key };
    }
    return m.snapshot();
  };
}

Deno.test('5: the prune lands during a pending debounce: the stock leaves, your edit stays, the save sends the merge', async () => {
  const { clock, server, m } = setup(['AAPL', 'NVDA', 'GE']);
  const render = makeScreen(m, ['AAPL', 'NVDA', 'GE']);
  m.edit(moveItem(m.snapshot().list, 2, -1)); // [AAPL, GE, NVDA]
  clock.advance(300);
  server.draft('GE'); // someone drafts GE; the room re-reads
  const seen = [render(server.stored, server.drafted)];
  assertEquals(seen[0].list, ['AAPL', 'NVDA']);
  clock.advance(QUEUE_SAVE_DELAY_MS);
  seen.push(m.snapshot());
  assertEquals(server.calls[0].symbols, ['AAPL', 'NVDA']);
  server.ok(0);
  await settle();
  seen.push(render(server.stored, server.drafted));
  assertEquals(seen.map((v) => v.failure), [null, null, null], 'never a failure frame');
  assertEquals(m.snapshot(), { list: ['AAPL', 'NVDA'], status: 'idle', failure: null });
  assertEquals(server.stored, ['AAPL', 'NVDA']);
});

Deno.test('5: the prune lands during an in-flight save: it leaves at once, the save lands, no failure frame', async () => {
  const { clock, server, m } = setup(['AAPL', 'NVDA']);
  const render = makeScreen(m, ['AAPL', 'NVDA']);
  m.edit(addSymbol(m.snapshot().list, 'GE')); // [AAPL, NVDA, GE]
  clock.advance(QUEUE_SAVE_DELAY_MS);
  assertEquals(m.snapshot().status, 'saving');
  server.draft('GE'); // the pick lands while our save is in flight
  const frames = [render(server.stored, server.drafted)];
  assertEquals(frames[0].list, ['AAPL', 'NVDA'], 'GE leaves at once');
  server.ok(0); // the server drops drafted GE from what it stores
  await settle();
  frames.push(render(server.stored, server.drafted));
  assertEquals(frames.map((f) => f.failure), [null, null]);
  assertEquals(m.snapshot().list, ['AAPL', 'NVDA']);
  assertEquals(server.stored, ['AAPL', 'NVDA']);
  assertEquals(m.snapshot().status, 'idle', 'a prune is not an edit: no save follows it');
  assertEquals(server.calls.length, 1);
});

Deno.test('5: the prune with nothing unsaved: the list follows the server and nothing is sent', () => {
  const { clock, server, m } = setup(['AAPL', 'GE']);
  const render = makeScreen(m, ['AAPL', 'GE']);
  server.draft('GE');
  assertEquals(render(server.stored, server.drafted), { list: ['AAPL'], status: 'idle', failure: null });
  clock.advance(QUEUE_SAVE_DELAY_MS * 5);
  assertEquals(server.calls.length, 0);
});

Deno.test('5: your own save landing never drops your newer edit: a stock you removed and put back while it flew stays', async () => {
  const { clock, server, m } = setup(['AAPL', 'NVDA']);
  const render = makeScreen(m, ['AAPL', 'NVDA']);
  m.edit(['AAPL']);
  clock.advance(QUEUE_SAVE_DELAY_MS);
  m.edit(['AAPL', 'NVDA']); // put back while [AAPL] is in flight
  server.ok(0);
  await settle();
  assertEquals(render(server.stored, server.drafted).list, ['AAPL', 'NVDA']);
  clock.advance(QUEUE_SAVE_DELAY_MS);
  server.ok(1);
  await settle();
  assertEquals(server.stored, ['AAPL', 'NVDA']);
});

// ── 6. leaving with a pending edit flushes it ──

Deno.test('6: leaving with a pending edit saves it at once', () => {
  const { server, m } = setup(['AAPL']);
  m.edit(['AAPL', 'NVDA']);
  m.flush();
  assertEquals(server.calls.length, 1);
  assertEquals(server.calls[0].symbols, ['AAPL', 'NVDA']);
});

Deno.test('6: leaving during an in-flight save with a newer edit sends the newer one right after', async () => {
  const { clock, server, m } = setup(['AAPL']);
  m.edit(['AAPL', 'NVDA']);
  clock.advance(QUEUE_SAVE_DELAY_MS);
  m.edit(['NVDA']);
  m.flush();
  assertEquals(server.open.length, 1);
  server.ok(0);
  await settle();
  assertEquals(server.calls[1].symbols, ['NVDA']);
  server.ok(1);
  await settle();
  assertEquals(server.stored, ['NVDA']);
});

Deno.test('6: leaving during an in-flight save with nothing newer sends nothing more', async () => {
  const { clock, server, m } = setup(['AAPL']);
  m.edit(['AAPL', 'NVDA']);
  clock.advance(QUEUE_SAVE_DELAY_MS);
  m.flush();
  server.ok(0);
  await settle();
  assertEquals(server.calls.length, 1);
});

Deno.test('6: a flush that fails is still on screen when you come back: your list and the failure line', async () => {
  resetQueueAutosaves();
  const server = new FakeServer();
  server.stored = ['AAPL'];
  const clock = new FakeClock();
  const make = (i: string[], h: { send: (s: string[]) => Promise<RpcResult> }) => new QueueAutosave(i, h, clock);
  const m1 = attachQueueAutosave('league-a', ['AAPL'], new Set(), { send: server.send }, make);
  const off = m1.subscribe(() => {});
  m1.edit(['AAPL', 'NVDA']);
  off(); // leave the screen...
  m1.flush(); // ...which saves at once
  server.fail(0);
  await settle();
  // Back on the screen: the server's list is still the old one.
  const m2 = attachQueueAutosave('league-a', ['AAPL'], new Set(), { send: server.send }, make);
  assert(m2 === m1, 'the same machine: one writer per league');
  assertEquals(m2.snapshot(), { list: ['AAPL', 'NVDA'], status: 'failed', failure: FAILED });
  m2.retry();
  server.ok(1);
  await settle();
  assertEquals(server.stored, ['AAPL', 'NVDA']);
  // Saved and nobody watching: the next screen starts fresh from the server.
  const m3 = attachQueueAutosave('league-a', ['AAPL', 'NVDA'], new Set(), { send: server.send }, make);
  assert(m3 !== m1);
});

Deno.test('6: coming back while the flush is still in flight keeps your list, then the save lands', async () => {
  resetQueueAutosaves();
  const server = new FakeServer();
  const clock = new FakeClock();
  const make = (i: string[], h: { send: (s: string[]) => Promise<RpcResult> }) => new QueueAutosave(i, h, clock);
  const m1 = attachQueueAutosave('league-b', ['AAPL'], new Set(), { send: server.send }, make);
  m1.edit(['NVDA']);
  m1.flush();
  const m2 = attachQueueAutosave('league-b', ['AAPL'], new Set(), { send: server.send }, make);
  assertEquals(m2.snapshot().list, ['NVDA']);
  server.ok(0);
  await settle();
  assertEquals(m2.snapshot(), { list: ['NVDA'], status: 'idle', failure: null });
});

Deno.test('6: another league never shares the machine', () => {
  resetQueueAutosaves();
  const server = new FakeServer();
  const a = attachQueueAutosave('league-a', ['AAPL'], new Set(), { send: server.send });
  a.edit(['NVDA']);
  const b = attachQueueAutosave('league-b', ['MSFT'], new Set(), { send: server.send });
  assert(a !== b);
  assertEquals(b.snapshot().list, ['MSFT']);
  resetQueueAutosaves();
});

// ── 7. `error` is checked on every answer ──

Deno.test("7: an answer carrying `error` is a failure even when data says ok (never 'saved')", async () => {
  const { clock, server, m, storedSeen } = setup(['AAPL']);
  m.edit(['AAPL', 'NVDA']);
  clock.advance(QUEUE_SAVE_DELAY_MS);
  server.calls[0].done = true;
  server.calls[0].resolve({ data: { ok: true, symbols: ['AAPL', 'NVDA'] }, error: { message: 'pg error', code: '42501' } });
  await settle();
  assertEquals(m.snapshot().failure, FAILED);
  assertEquals(m.hasUnsaved, true);
  assertEquals(storedSeen, [], 'the parent is never told it saved');
});

Deno.test('7: readSaveResult: only error-free data.ok === true is a save', () => {
  assertEquals(readSaveResult({ data: { ok: true, symbols: ['A'] }, error: null }, ['A', 'B']), { ok: true, stored: ['A'] });
  assertEquals(readSaveResult({ data: { ok: true }, error: null }, ['A']), { ok: true, stored: ['A'] });
  assertEquals(readSaveResult({ data: { ok: true }, error: { message: 'x' } }, ['A']).ok, false);
  assertEquals(readSaveResult({ data: null, error: null }, ['A']).ok, false);
  assertEquals(readSaveResult({ data: { ok: 'true' }, error: null }, ['A']).ok, false);
  assertEquals(readSaveResult(null, ['A']), { ok: false, line: FAILED });
});

Deno.test('5: a stale-looking read with unsaved edits never drops a stock you just added (only drafted stocks leave)', async () => {
  const { clock, server, m } = setup(['AAPL']);
  const render = makeScreen(m, ['AAPL']);
  m.edit(['AAPL', 'NVDA']);
  clock.advance(QUEUE_SAVE_DELAY_MS);
  server.ok(0);
  await settle();
  render(server.stored, server.drafted); // [AAPL, NVDA]
  m.edit(['AAPL', 'NVDA', 'AMD']);
  // A read sent before that save lands now, with the old list.
  assertEquals(render(['AAPL'], new Set()).list, ['AAPL', 'NVDA', 'AMD']);
});

Deno.test('the parent hears every accepted save, with the stored list', async () => {
  const { clock, server, m, storedSeen } = setup(['AAPL']);
  server.drafted.add('GE');
  m.edit(['AAPL', 'GE']);
  clock.advance(QUEUE_SAVE_DELAY_MS);
  server.ok(0);
  await settle();
  assertEquals(storedSeen, [['AAPL']]);
});

// ── 1. source guards: the editor is the machine, the button and its line are gone ──

const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\s*\}/g, '');
const EDITOR = code(SOURCES['components/game/QueueEditor.tsx']);

Deno.test('1: no "Save queue" and no "Not saved yet." in the lobby or the room', () => {
  for (const p of ['components/game/QueueEditor.tsx', 'components/game/DraftRoom.tsx', 'app/(tabs)/league.tsx']) {
    const src = code(SOURCES[p]);
    assertEquals(src.includes('Save queue'), false, p);
    assertEquals(src.includes('Not saved yet.'), false, p);
  }
});

Deno.test('1/3: the editor runs on the machine, fails in place (WarnPanel + Try again), and has no Alert', () => {
  assert(EDITOR.includes('attachQueueAutosave('));
  assert(EDITOR.includes('<WarnPanel text={view.failure} />'));
  assert(EDITOR.includes('<Button label="Try again"'));
  assertEquals(EDITOR.includes('Alert'), false);
  assert(EDITOR.includes('machine.edit('));
  assertEquals(/setQueue\(/.test(EDITOR), false, 'no list of its own beside the machine');
});

Deno.test('6: the editor flushes on unmount and when the app leaves the foreground', () => {
  assert(/AppState\.addEventListener\('change', \(next\) => \{\s*if \(next !== 'active'\) machine\.flush\(\);/.test(EDITOR));
  assert(/return \(\) => \{\s*off\(\);\s*machine\.flush\(\);/.test(EDITOR));
});

Deno.test('the lobby editor key does not move when a save lands (no remount under your taps)', () => {
  const read = queueStateOnRead(queueStateStart('L'), 'L', { data: [{ symbol: 'AAPL', position: 1 }], error: null });
  const saved = queueStateOnSaved(read, 'L', ['AAPL', 'NVDA']);
  assert(saved.generation > read.generation, 'new data');
  assertEquals(queueEditorKey(saved), queueEditorKey(read));
  assert(queueEditorKey(queueStateStart('M')) !== queueEditorKey(read), 'another league still remounts');
});

Deno.test('the lobby keys the editor on the league alone (a save landing never remounts it mid-edit)', () => {
  const league = SOURCES['app/(tabs)/league.tsx'];
  assert(league.includes('<QueueEditor key={queue.editorKey} leagueId={leagueId} initial={queue.queue} onSaved={queue.saved} />'));
  assert(SOURCES['lib/game/draftQueueRead.ts'].includes('return state.leagueId ?? \'\';'));
});
