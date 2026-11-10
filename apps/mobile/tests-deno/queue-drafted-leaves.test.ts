/**
 * Decision 19 (draft room plan, Giorgio 2026-11-10): "A drafted stock leaves every queue at once, server and screen,
 * with no Save step." Build 12 (League B draft): after he drafted DNUT it stayed in "Your queue · 1 of 50", then
 * showed "0 of 50 / Save queue / Not saved yet."
 *
 * The server prunes the pick from every queue (20261129000000). On screen, QueueEditor kept its own list from mount
 * and compared it with `initial`, so the server's removal read as an unsaved edit. Now the editor's saved list is
 * queueBaseline(initial, drafted), and a change in it (or in the drafted set) re-bases the list (rebaseQueue), in
 * the same render. The model below is QueueEditor's own rule, step for step; the source guards at the end pin the
 * component to it.
 * Run: `cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { moveItem, queueBaseline, rebaseQueue, removeItem, addSymbol, QUEUE_MAX } from '../lib/game/draftQueue.ts';
import { SOURCES } from './sourceManifest.generated.ts';

/** QueueEditor, as a model: mount, then each render with new props, then the player's edits. */
class Editor {
  queue: string[];
  private seen: { baseline: string[]; draftedKey: string };
  private baseline: string[];
  constructor(initial: string[], drafted: Set<string> = new Set()) {
    this.baseline = queueBaseline(initial, drafted);
    this.queue = this.baseline.slice();
    this.seen = { baseline: this.baseline, draftedKey: [...drafted].sort().join(',') };
  }
  /** A render with (maybe) new props: the room's re-read landing, a pick, a save. */
  render(initial: string[], drafted: Set<string>) {
    const baseline = queueBaseline(initial, drafted);
    const draftedKey = [...drafted].sort().join(',');
    if (this.seen.baseline.join(',') !== baseline.join(',') || this.seen.draftedKey !== draftedKey) {
      this.queue = rebaseQueue(this.queue, this.seen.baseline, baseline, drafted);
      this.seen = { baseline, draftedKey };
    }
    this.baseline = baseline;
  }
  get dirty() {
    return this.queue.join(',') !== this.baseline.join(',');
  }
  /** The tag line's count and whether "Save queue / Not saved yet." shows. */
  get view() {
    return { count: `${this.queue.length} of ${QUEUE_MAX}`, saveShown: this.dirty };
  }
}
const set = (...s: string[]) => new Set(s);

// ── the build 12 sequence ──

Deno.test('build 12: he drafts DNUT, the only stock in his queue: "0 of 50", no Save, no "Not saved yet"', () => {
  const e = new Editor(['DNUT']);
  assertEquals(e.view, { count: '1 of 50', saveShown: false });
  // The room re-reads on the drafts INSERT: the pick, and the queue the server already pruned.
  e.render([], set('DNUT'));
  assertEquals(e.queue, []);
  assertEquals(e.view, { count: '0 of 50', saveShown: false });
});

Deno.test('the pick lands before the pruned queue does (two renders): never a dirty frame', () => {
  const e = new Editor(['NVDA', 'DNUT', 'AAPL']);
  e.render(['NVDA', 'DNUT', 'AAPL'], set('DNUT')); // picks first, the queue read still the old one
  assertEquals([e.queue, e.dirty], [['NVDA', 'AAPL'], false]);
  e.render(['NVDA', 'AAPL'], set('DNUT')); // then the pruned queue
  assertEquals([e.queue, e.dirty], [['NVDA', 'AAPL'], false]);
});

Deno.test('the queue re-read FAILED (the last list is kept) but the pick is in: still gone, still clean', () => {
  const e = new Editor(['DNUT', 'MSFT']);
  e.render(['DNUT', 'MSFT'], set('DNUT', 'X1'));
  assertEquals([e.queue, e.dirty], [['MSFT'], false]);
});

Deno.test('another manager drafts a stock in MY queue: it leaves mine too, with no Save', () => {
  const e = new Editor(['DNUT', 'MSFT']);
  e.render(['MSFT'], set('DNUT')); // B's queue, pruned by A's pick
  assertEquals(e.view, { count: '1 of 50', saveShown: false });
});

// ── unsaved edits: kept, but never a drafted stock, and never a difference the server made ──

Deno.test('my unsaved edits survive a pick; only the drafted stock goes', () => {
  const e = new Editor(['DNUT', 'AAPL']);
  e.queue = addSymbol(moveItem(e.queue, 1, -1), 'NEW'); // [AAPL, DNUT, NEW], unsaved
  assert(e.dirty);
  e.render(['AAPL'], set('DNUT'));
  assertEquals(e.queue, ['AAPL', 'NEW']);
  assert(e.dirty, 'NEW is a real edit: Save stays');
});

Deno.test('I removed it myself (unsaved) and then it was drafted: clean, nothing left to save', () => {
  const e = new Editor(['DNUT', 'AAPL']);
  e.queue = removeItem(e.queue, 0);
  assert(e.dirty);
  e.render(['AAPL'], set('DNUT'));
  assertEquals([e.queue, e.dirty], [['AAPL'], false]);
});

Deno.test('a stock I added (unsaved) and someone then drafted: it leaves the list, the queue is clean again', () => {
  const e = new Editor(['AAPL']);
  e.queue = addSymbol(e.queue, 'NVDA');
  e.render(['AAPL'], set('NVDA')); // the server queue did not change; only the drafted set did
  assertEquals([e.queue, e.dirty], [['AAPL'], false]);
});

Deno.test('a save landing (the room re-reads the stored list) is clean; a no-op render changes nothing', () => {
  const e = new Editor(['AAPL']);
  e.queue = ['MSFT', 'AAPL'];
  e.render(['MSFT', 'AAPL'], set());
  assertEquals([e.queue, e.dirty], [['MSFT', 'AAPL'], false]);
  e.queue = ['AAPL', 'MSFT'];
  e.render(['MSFT', 'AAPL'], set()); // same props: the edit in progress stays
  assertEquals([e.queue, e.dirty], [['AAPL', 'MSFT'], true]);
});

Deno.test('queueBaseline: the saved list, normalized, minus drafted; rebaseQueue with no edits follows the server', () => {
  assertEquals(queueBaseline([' dnut', 'aapl', 'AAPL'], set('DNUT')), ['AAPL']);
  assertEquals(rebaseQueue(['A', 'B'], ['A', 'B'], ['B', 'C'], set()), ['B', 'C']);
});

// ── the wiring ──

const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const EDITOR = code(SOURCES['components/game/QueueEditor.tsx']);
const ROOM = code(SOURCES['components/game/DraftRoom.tsx']);
const LEAGUE = code(SOURCES['app/(tabs)/league.tsx']);

Deno.test('QueueEditor: dirty is against the baseline (saved minus drafted), seeded from it, re-based in render', () => {
  assert(EDITOR.includes('const baseline = queueBaseline(initial, drafted);'));
  assert(EDITOR.includes('const dirty = queue.join(\',\') !== baselineKey;'));
  assert(!EDITOR.includes('normalizeQueue(initial)'), 'no comparison with the raw initial list');
  assert(EDITOR.includes('useState<string[]>(() => baseline)'));
  assert(EDITOR.includes('if (seen.baseline.join(\',\') !== baselineKey || seen.draftedKey !== draftedKey) {'));
  assert(EDITOR.includes('setQueue((q) => rebaseQueue(q, seen.baseline, baseline, drafted));'));
  assert(EDITOR.includes('drafted = NOTHING_DRAFTED'), 'a stable default: the lobby never re-bases per render');
});

Deno.test('the live room passes the drafted set; the lobby (pre-draft) passes none and keeps its key', () => {
  assert(ROOM.includes('<QueueEditor leagueId={leagueId} initial={room.queue.queue} onSaved={room.refresh} drafted={owned} />'));
  assert(ROOM.includes('const owned = useMemo(() => new Set(Array.from(room.picks.values()).map((p) => p.symbol.toUpperCase())), [room.picks]);'));
  assert(LEAGUE.includes('<QueueEditor key={queue.editorKey} leagueId={leagueId} initial={queue.queue} onSaved={queue.saved} />'));
});
