/**
 * Security brief 2026-11-13, A1 — a plain "Sign out" clears the links the leaving person opened on this phone (pending
 * takeover, pending invite, pending route), the same cleanup an account deletion runs, and ONLY after Supabase confirms
 * the sign-out. It KEEPS the per-user active-league key (sp.activeLeague.v1.<uid>): keyed by their id, so nobody else
 * reads it, and the same person signing back in lands on the league they left. Only account deletion removes that key.
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
  // A storage remover and a user id ride along, as they do in the deletion path's deps, so a cleanup that reached for the
  // active-league key would show up in the log.
  const d = {
    clearPendingTakeover: () => { log.push('takeover'); return Promise.resolve(); },
    clearPendingInvite: () => { log.push('invite'); return Promise.resolve(); },
    clearPendingRoute: () => { log.push('route'); },
    removeItem: (k: string) => { log.push(`remove:${k}`); return Promise.resolve(); },
    userId: 'u-1',
    ...over,
  };
  return { d: d as LeaverStateDeps, log };
}

Deno.test('leaver state: takeover, invite and route go, and nothing else', async () => {
  const { d, log } = deps();
  await clearLeaverState(d);
  assertEquals(log, ['takeover', 'invite', 'route']);
});

Deno.test('leaver state: a plain sign-out keeps the per-user active-league key (only account deletion removes it)', () => {
  const core = src('lib/account/leaverStateCore.ts');
  assertFalse(/activeLeague|removeItem/.test(core), 'the shared cleanup never touches storage keys directly');
  assertFalse(/removeItem|userId/.test(src('lib/account/leaverState.ts')), 'the shared binding carries no remover or id');
  const sp = src('lib/SessionProvider.tsx');
  const body = sp.slice(sp.indexOf('const signOut = useCallback('), sp.indexOf('const profileLoading'));
  assertFalse(/activeLeague|AsyncStorage/.test(body), 'the plain sign-out removes no stored key itself');
  // ...while the deletion core still does, by the user's own key.
  const del = src('lib/account/endSessionCore.ts');
  assert(del.includes('if (deps.userId) await quiet(() => deps.removeItem(activeLeagueStorageKey(deps.userId as string)));'));
  assertEquals(activeLeagueStorageKey('u-1'), 'sp.activeLeague.v1.u-1');
});

Deno.test('leaver state: one failing store never stops the rest', async () => {
  const { d, log } = deps({
    clearPendingTakeover: () => Promise.reject(new Error('storage')),
    clearPendingRoute: () => { throw new Error('sync'); },
  });
  await clearLeaverState(d);
  assertEquals(log, ['invite']);
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
  const clear = body.indexOf('await clearLeaverState(leaverStateDeps());');
  const google = body.indexOf('await signOutOfGoogle();');
  assert(failReturn > 0 && failEnd > failReturn, 'the failure branch returns early');
  assert(clear > failEnd, 'cleanup runs only past the failure return');
  assert(google > clear, 'cleanup runs before the Google sign-out');
  assertEquals(body.split('clearLeaverState(').length - 1, 1, 'exactly once');
});

Deno.test('wiring: deletion and plain sign-out share ONE binding and ONE core', () => {
  const bind = src('lib/account/leaverState.ts');
  for (const want of ['pendingTakeover.clear()', 'pendingInvite.clear()', 'pendingRoute.forget()']) {
    assert(bind.includes(want), want);
  }
  const end = src('lib/account/endSession.ts');
  assert(end.includes('...leaverStateDeps()'));
  assert(end.includes('removeItem: (key) => AsyncStorage.removeItem(key)') && end.includes('userId,'), 'deletion binds its own remover and id');
  const core = src('lib/account/endSessionCore.ts');
  assert(core.includes('await clearLeaverState(deps);'));
  assertFalse(core.includes('clearPendingTakeover()'), 'no second copy of the cleanup in the deletion core');
});
