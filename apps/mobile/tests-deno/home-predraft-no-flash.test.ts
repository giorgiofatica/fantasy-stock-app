/**
 * Phone pass step 24d, build 1.3.0 (14), 2026-11-10 (Giorgio's recording, 20 s → 21 s): switching to a postponed
 * league on Home first painted the plain pre-draft card ("Draft · 60-second picks · 6 rounds · Build your queue"),
 * then about a second later swapped to "Draft postponed · {commissioner} will pick a new time."
 *
 * Home's body is keyed by the league id, so a switch remounts PreDraftCard with an empty draft status, and the card
 * was drawn on `view?.blockers === 'postponed' ? null : (…)`: no view read as "show the plain card". The Home twin of
 * the League tab's lobbyShowsOrder (PR #356). The rules are pure (autoStart.phaseKnown, homeShowsDraftCard); the
 * card's wiring is read from its source.
 * Run: `cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { homeShowsDraftCard, homeView, lobbyPhase, phaseKnown, type StartState } from '../lib/game/autoStart.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const HOME = SOURCES['components/home/PreDraftCard.tsx'];
const HOOK = SOURCES['lib/game/useDraftAutoStart.ts'];
const STATUS = SOURCES['lib/game/useDraftStatus.ts'];

type Status = 'idle' | 'loading' | 'ready' | 'error';
interface Ds { status: Status; startState: StartState | null; startsAt: string | null }
const NOW = Date.parse('2026-11-10T20:00:00Z');

/** What the card shows for one draft-status state, the way PreDraftCard and useDraftAutoStart compose it. */
function card(ds: Ds, isCommissioner: boolean): { shown: boolean; memberPostponed: boolean } {
  const phase = phaseKnown(ds) ? lobbyPhase(ds, NOW) : null;
  const view = phase ? homeView(phase, isCommissioner, 1) : null;
  return { shown: homeShowsDraftCard(view, ds.status === 'error'), memberPostponed: !!view?.memberPostponed };
}

// ── The rule ──

Deno.test('before the status answers, Home paints no draft card (nothing is guessed)', () => {
  assertEquals(homeShowsDraftCard(null, false), false);
});

Deno.test('a failed status read keeps the draft card (the last honest thing Home has)', () => {
  assertEquals(homeShowsDraftCard(null, true), true);
});

Deno.test("once known, the card follows the view: the commissioner's postponed blockers card replaces it, members keep it", () => {
  assertEquals(homeShowsDraftCard(homeView('postponed', true, 1), false), false, 'commissioner, postponed');
  assertEquals(homeShowsDraftCard(homeView('postponed', false, 1), false), true, 'member, postponed');
  for (const commissioner of [true, false]) {
    for (const phase of ['no_date', 'scheduled', 'at_risk', 'room_open', 'starting', 'started'] as const) {
      assertEquals(homeShowsDraftCard(homeView(phase, commissioner, 1), false), true, `${phase} ${commissioner}`);
    }
  }
});

// ── When the status counts as known ──

Deno.test('phaseKnown: no phase before the first answer or after a failure; an answer, or a re-read over one, has one', () => {
  assertEquals(phaseKnown({ status: 'idle', startState: null }), false, 'idle (mount)');
  assertEquals(phaseKnown({ status: 'loading', startState: null }), false, 'first read loading');
  assertEquals(phaseKnown({ status: 'error', startState: null }), false, 'failed');
  assertEquals(phaseKnown({ status: 'ready', startState: 'postponed' }), true, 'ready');
  assertEquals(phaseKnown({ status: 'loading', startState: 'postponed' }), true, 're-read over an answer');
});

// ── The two sequences from the phone ──

Deno.test("switching to a postponed league (member): no card, then \"Draft postponed\" — never the plain card first", () => {
  const seq: Ds[] = [
    { status: 'idle', startState: null, startsAt: null }, // the remount's first render
    { status: 'loading', startState: null, startsAt: null }, // the read in flight
    { status: 'ready', startState: 'postponed', startsAt: null },
  ];
  const painted = seq.map((ds) => card(ds, false));
  assertEquals(painted.map((p) => p.shown), [false, false, true]);
  assertEquals(painted.find((p) => p.shown)?.memberPostponed, true, 'the first card painted is the postponed one');
});

Deno.test('a re-read (pull, T−1h, a fix) keeps the postponed card on screen while it loads: no blink', () => {
  for (const commissioner of [true, false]) {
    const ready: Ds = { status: 'ready', startState: 'postponed', startsAt: null };
    // useDraftStatus starts a re-read as { ...s, status: 'loading' }: everything else is the last answer's.
    const rereading: Ds = { ...ready, status: 'loading' };
    assertEquals(card(rereading, commissioner), card(ready, commissioner), `commissioner ${commissioner}`);
  }
  const scheduled: Ds = { status: 'ready', startState: 'scheduled', startsAt: new Date(NOW + 3 * 3600_000).toISOString() };
  assertEquals(card({ ...scheduled, status: 'loading' }, false), card(scheduled, false));
  assertEquals(card(scheduled, false).shown, true);
});

// ── The wiring ──

Deno.test('Home draws its draft card through homeShowsDraftCard, never a default-to-shown', () => {
  assert(HOME.includes("{homeShowsDraftCard(view, ds.status === 'error') ? ("));
  assert(!HOME.includes("view?.blockers === 'postponed' ? null"));
});

Deno.test('the shared hook takes its phase from phaseKnown, and a re-read keeps the last answer while it loads', () => {
  assert(HOOK.includes('const phase = phaseKnown(ds) ? lobbyPhase(ds, serverNow) : null;'));
  assert(STATUS.includes("setState((s) => ({ ...s, status: 'loading' }));"));
});
