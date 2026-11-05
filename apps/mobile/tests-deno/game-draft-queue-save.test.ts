/**
 * The lobby queue after a save (P1, Giorgio's phone, 1.3.0 (9), 2026-11-05).
 * Saved [SG, SBUX]; he added TEMPUS and ROBO, moved ROBO up and tapped Save
 * queue. The server stored all four, but the editor showed [SG, SBUX] with
 * "Not saved yet." still up: `refresh` bumped the counter that was also the
 * editor's key, so the editor remounted at once on the PRE-save list, and the
 * re-read then landed with no second remount. A second Save would have written
 * [SG, SBUX] over the real queue.
 *
 * The editor model below is QueueEditor's own mount rule: it seeds its local
 * list from `initial` only when its key changes, and `dirty` is local vs the
 * current `initial`. The same scenario runs against the fix and against
 * origin/main's keying, which must fail it.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assertEquals, assertThrows } from 'jsr:@std/assert';
import {
  QUEUE_STATE_START,
  nextQueueRead,
  queueStateOnRead,
  queueStateOnSaved,
  savedQueueFrom,
  type QueueRead,
  type QueueState,
} from '../lib/game/draftQueueRead.ts';
import { addSymbol, moveItem, normalizeQueue } from '../lib/game/draftQueue.ts';
import hookSrc from '../lib/game/useDraftQueue.ts' with { type: 'text' };
import editorSrc from '../components/game/QueueEditor.tsx' with { type: 'text' };
import leagueSrc from '../app/(tabs)/league.tsx' with { type: 'text' };

type Res = { data: { symbol: string; position: number }[] | null; error: unknown };
const ok = (syms: string[]): Res => ({ data: syms.map((symbol, i) => ({ symbol, position: i + 1 })), error: null });
const failed: Res = { data: null, error: { message: 'timeout' } };

/** How the lobby hook turns events into (read, editor key). */
interface Keying<S> {
  start: S;
  read(s: S): QueueRead;
  key(s: S): number;
  onRead(s: S, res: Res): S;
  /** The editor's onSaved: the stored list, plus the re-read request it makes. */
  onSaved(s: S, stored: string[]): S;
  refresh(s: S): S;
}

/** The fix: the key is the loaded data's generation. A re-read request moves nothing. */
const FIX: Keying<QueueState> = {
  start: QUEUE_STATE_START,
  read: (s) => s.read,
  key: (s) => s.generation,
  onRead: queueStateOnRead,
  onSaved: queueStateOnSaved,
  refresh: (s) => s,
};

/** origin/main before the fix: `refresh` bumped `version`, and `version` was the key. */
type Old = { read: QueueRead; version: number };
const ORIGIN_MAIN: Keying<Old> = {
  start: { read: { status: 'loading' }, version: 0 },
  read: (s) => s.read,
  key: (s) => s.version,
  onRead: (s, res) => ({ ...s, read: nextQueueRead(s.read, res) }),
  onSaved: (s) => ({ ...s, version: s.version + 1 }),
  refresh: (s) => ({ ...s, version: s.version + 1 }),
};

/** QueueEditor's mount rule, rendered against one hook state. */
function makeEditor() {
  let key: number | null = null;
  let local: string[] = [];
  return {
    render(read: QueueRead, k: number) {
      if (read.status !== 'ready') {
        key = null; // not shown (loading / error): unmounted
        return null;
      }
      if (k !== key) {
        key = k;
        local = normalizeQueue(read.queue); // useState(() => normalizeQueue(initial))
      }
      return { shown: local.slice(), notSavedYet: local.join(',') !== normalizeQueue(read.queue).join(',') };
    },
    edit(f: (q: string[]) => string[]) {
      local = f(local);
    },
    get local() {
      return local.slice();
    },
  };
}

const FOUR = ['SG', 'SBUX', 'ROBO', 'TEMPUS'];

/** The phone's sequence: save → re-read requested → old data still current → new data lands. */
function phoneSequence<S>(k: Keying<S>, reread: Res = ok(FOUR)) {
  const ed = makeEditor();
  let s = k.onRead(k.start, ok(['SG', 'SBUX']));
  assertEquals(ed.render(k.read(s), k.key(s)), { shown: ['SG', 'SBUX'], notSavedYet: false });
  ed.edit((q) => addSymbol(q, 'TEMPUS'));
  ed.edit((q) => addSymbol(q, 'ROBO'));
  ed.edit((q) => moveItem(q, 3, -1));
  assertEquals(ed.render(k.read(s), k.key(s)), { shown: FOUR, notSavedYet: true });
  // Save: set_draft_queue returned ok with the stored list.
  s = k.onSaved(s, savedQueueFrom({ symbols: FOUR }, ed.local));
  // The re-read is in flight; the pre-save list may still be the read.
  assertEquals(ed.render(k.read(s), k.key(s)), { shown: FOUR, notSavedYet: false }, 'right after Save');
  s = k.onRead(s, reread);
  assertEquals(ed.render(k.read(s), k.key(s)), { shown: FOUR, notSavedYet: false }, 'after the re-read lands');
  return { ed, s };
}

Deno.test('save → re-read requested → old data current → new data lands: the saved list, clean', () => {
  phoneSequence(FIX);
});

Deno.test("origin/main's keying fails the same sequence (the phone bug: old list + Not saved yet.)", () => {
  assertThrows(() => phoneSequence(ORIGIN_MAIN));
  // And what it showed, exactly as on the phone.
  const ed = makeEditor();
  let s = ORIGIN_MAIN.onRead(ORIGIN_MAIN.start, ok(['SG', 'SBUX']));
  ed.render(s.read, s.version);
  ed.edit(() => FOUR);
  s = ORIGIN_MAIN.onSaved(s, FOUR);
  assertEquals(ed.render(s.read, s.version), { shown: ['SG', 'SBUX'], notSavedYet: false });
  s = ORIGIN_MAIN.onRead(s, ok(FOUR));
  assertEquals(ed.render(s.read, s.version), { shown: ['SG', 'SBUX'], notSavedYet: true });
});

Deno.test('a failed re-read after a save keeps the saved list, clean (never empty, never the old one)', () => {
  phoneSequence(FIX, failed);
});

Deno.test('a re-read that confirms the save does not remount: edits made meanwhile survive', () => {
  const ed = makeEditor();
  let s = FIX.onRead(FIX.start, ok(['SG', 'SBUX']));
  ed.render(s.read, s.generation);
  ed.edit(() => FOUR);
  s = FIX.onSaved(s, FOUR);
  ed.render(s.read, s.generation);
  ed.edit((q) => addSymbol(q, 'AAPL')); // typed before the re-read answered
  s = FIX.onRead(s, ok(FOUR));
  assertEquals(ed.render(s.read, s.generation), { shown: [...FOUR, 'AAPL'], notSavedYet: true });
});

Deno.test('a re-read with different server data is new data: the editor remounts on it', () => {
  let s = FIX.onRead(FIX.start, ok(['SG']));
  const g = s.generation;
  s = FIX.onRead(s, ok(['SG', 'NVDA']));
  assertEquals(s.generation, g + 1);
  assertEquals(s.read, { status: 'ready', queue: ['SG', 'NVDA'] });
});

Deno.test('the generation moves on data, not on requests or failures', () => {
  let s = FIX.onRead(FIX.start, ok(['SG']));
  assertEquals(s.generation, 1);
  assertEquals(FIX.refresh(s), s);
  assertEquals(FIX.onRead(s, failed), s); // a failed re-read keeps the last good list
  assertEquals(FIX.onRead(s, ok(['SG'])), s); // same list: same state
  assertEquals(FIX.onSaved(s, ['SG']), s); // a save of the same list: no remount
  s = FIX.onSaved(s, ['SG', 'SBUX']);
  assertEquals(s, { read: { status: 'ready', queue: ['SG', 'SBUX'] }, generation: 2 });
});

Deno.test('a failed first read is an error, never [] (draftQueueRead\'s rule), and Try again recovers', () => {
  let s = FIX.onRead(FIX.start, failed);
  assertEquals(s.read, { status: 'error' });
  const ed = makeEditor();
  assertEquals(ed.render(s.read, s.generation), null);
  s = FIX.onRead(s, ok(['SG', 'SBUX']));
  assertEquals(ed.render(s.read, s.generation), { shown: ['SG', 'SBUX'], notSavedYet: false });
});

Deno.test('a real empty queue that becomes a saved one remounts the editor', () => {
  let s = FIX.onRead(FIX.start, ok([]));
  const ed = makeEditor();
  ed.render(s.read, s.generation);
  ed.edit(() => ['SG']);
  s = FIX.onSaved(s, ['SG']);
  assertEquals(ed.render(s.read, s.generation), { shown: ['SG'], notSavedYet: false });
});

Deno.test('savedQueueFrom: the server\'s stored list, else what was sent', () => {
  assertEquals(savedQueueFrom({ symbols: ['SG', 'SBUX'] }, ['sg', 'sbux']), ['SG', 'SBUX']);
  assertEquals(savedQueueFrom({}, ['SG']), ['SG']);
  assertEquals(savedQueueFrom(null, ['SG']), ['SG']);
  assertEquals(savedQueueFrom({ symbols: [1, 2] }, ['SG']), ['SG']);
  assertEquals(savedQueueFrom({ symbols: 'SG' }, ['SG']), ['SG']);
  assertEquals(savedQueueFrom({ symbols: [] }, ['SG']), []);
});

// ── Wiring: the lobby keys the editor on the data, and the editor hands over the stored list ──

const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

Deno.test('league.tsx keys QueueEditor on editorKey and passes saved, never the re-read request', () => {
  const src = code(leagueSrc);
  assertEquals(src.includes('<QueueEditor key={queue.editorKey} leagueId={leagueId} initial={queue.queue} onSaved={queue.saved} />'), true);
  assertEquals(src.includes('key={queue.version}'), false);
  assertEquals(src.includes('onSaved={queue.refresh}'), false);
});

Deno.test('useDraftQueue: editorKey is the generation, saved adopts the stored list, version is not exposed', () => {
  const src = code(hookSrc);
  assertEquals(src.includes('return { ...state.read, editorKey: state.generation, refresh, saved };'), true);
  assertEquals(src.includes('setState((s) => queueStateOnSaved(s, symbols));'), true);
  assertEquals(/editorKey:\s*version/.test(src), false);
});

Deno.test('QueueEditor hands onSaved the stored list from set_draft_queue', () => {
  assertEquals(code(editorSrc).includes('onSaved(savedQueueFrom(res, queue));'), true);
});
