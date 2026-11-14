/**
 * Security brief 2026-11-13, A1 — a plain "Sign out" clears what the leaving person owns on this phone (pending takeover,
 * pending invite, pending route, per-user active league), the same cleanup an account deletion runs, and ONLY after
 * Supabase confirms the sign-out.
 *
 *   cd apps/mobile && deno test --no-check --sloppy-imports --allow-read --allow-env --unstable-raw-imports tests-deno/sign-out-leaver-state.test.ts
 */
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';
import { clearLeaverState, type LeaverStateDeps } from '../lib/account/leaverStateCore.ts';
import { activeLeagueStorageKey } from '../lib/shell/activeLeague.ts';
import { createPendingRoute } from '../lib/shell/pendingRoute.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const src = (p: string) => strip(SOURCES[p]);

function deps(over: Partial<LeaverStateDeps> = {}) {
  const log: string[] = [];
  const d: LeaverStateDeps = {
    clearPendingTakeover: () => { log.push('takeover'); return Promise.resolve(); },
    clearPendingInvite: () => { log.push('invite'); return Promise.resolve(); },
    clearPendingRoute: () => { log.push('route'); },
    removeItem: (k) => { log.push(`remove:${k}`); return Promise.resolve(); },
    userId: 'u-1',
    ...over,
  };
  return { d, log };
}

Deno.test('leaver state: takeover, invite, route and the per-user active league all go', async () => {
  const { d, log } = deps();
  await clearLeaverState(d);
  assertEquals(log, ['takeover', 'invite', 'route', `remove:${activeLeagueStorageKey('u-1')}`]);
});

Deno.test('leaver state: no active-league key is touched without a user id', async () => {
  const { d, log } = deps({ userId: null });
  await clearLeaverState(d);
  assertEquals(log, ['takeover', 'invite', 'route']);
});

Deno.test('leaver state: one failing store never stops the rest', async () => {
  const { d, log } = deps({
    clearPendingTakeover: () => Promise.reject(new Error('storage')),
    clearPendingRoute: () => { throw new Error('sync'); },
  });
  await clearLeaverState(d);
  assert(log.includes('invite') && log.includes(`remove:${activeLeagueStorageKey('u-1')}`));
});

Deno.test('pending route: forget() drops a link waiting at the username gate, which a gated sign-out alone keeps', () => {
  // authChanged('signedOut') only starts clean when leaving 'ready'; from 'gated' it keeps the link (a link opened
  // before picking a username still resumes after the gate). So a deliberate sign-out has to forget it explicitly.
  const kept = createPendingRoute();
  kept.authChanged('signedOut');
  kept.record('/create-league');
  kept.authChanged('gated');
  kept.authChanged('signedOut');
  assertEquals(kept.peek(), '/create-league', 'the phase change alone keeps it');

  const p = createPendingRoute();
  p.authChanged('signedOut');
  p.record('/create-league');
  p.authChanged('gated');
  p.forget();
  p.authChanged('signedOut');
  assertEquals(p.peek(), null);
  assertEquals(p.authChanged('ready'), null, 'the next person does not get it');
});

Deno.test('pending route: forget() also drops a link kept by a recovery hold', () => {
  const p = createPendingRoute();
  p.authChanged('signedOut');
  p.record('/trade-history');
  assertEquals(p.authChanged('ready', true), null); // held
  p.forget();
  assertEquals(p.releaseHold(), null);
});

Deno.test('wiring: plain sign-out clears leaver state only AFTER a successful Supabase sign-out, before Google', () => {
  const sp = src('lib/SessionProvider.tsx');
  const body = sp.slice(sp.indexOf('const signOut = useCallback('), sp.indexOf('const profileLoading'));
  const failReturn = body.indexOf('if (signOutError) {');
  const failEnd = body.indexOf('return;', failReturn);
  const clear = body.indexOf('await clearLeaverState(leaverStateDeps(userId));');
  const google = body.indexOf('await signOutOfGoogle();');
  assert(failReturn > 0 && failEnd > failReturn, 'the failure branch returns early');
  assert(clear > failEnd, 'cleanup runs only past the failure return');
  assert(google > clear, 'cleanup runs before the Google sign-out');
  assertEquals(body.split('clearLeaverState(').length - 1, 1, 'exactly once');
});

Deno.test('wiring: deletion and plain sign-out share ONE binding and ONE core', () => {
  const bind = src('lib/account/leaverState.ts');
  for (const want of ['pendingTakeover.clear()', 'pendingInvite.clear()', 'pendingRoute.forget()', 'AsyncStorage.removeItem(key)']) {
    assert(bind.includes(want), want);
  }
  assert(src('lib/account/endSession.ts').includes('...leaverStateDeps(userId)'));
  const core = src('lib/account/endSessionCore.ts');
  assert(core.includes('await clearLeaverState(deps);'));
  assertFalse(core.includes('clearPendingTakeover()'), 'no second copy of the cleanup in the deletion core');
});
