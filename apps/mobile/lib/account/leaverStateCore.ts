// What a person leaves behind on this phone when their session ends, and the one place that clears it. Both ways a session
// ends on purpose run it: a plain "Sign out" (lib/SessionProvider.tsx, after Supabase confirms the sign-out) and the end of
// an account deletion (lib/account/endSessionCore.ts). Security brief 2026-11-13, A1: before this, only the deletion path
// cleared these, so a link one person opened stayed on the phone after a plain sign-out.
//
//   - the pending takeover and the pending invite (AsyncStorage): links that person opened;
//   - the pending route (memory): a link recorded while signed out or at the username gate, not yet opened;
//   - the per-user active-league choice (AsyncStorage, keyed by their id): theirs alone.
//
// Best effort, every step: one failing store never stops the rest. Pure (no React Native imports) so tests-deno can drive
// it; lib/account/leaverState.ts binds the real stores.

import { activeLeagueStorageKey } from '../shell/activeLeague';

export interface LeaverStateDeps {
  clearPendingTakeover(): Promise<void>;
  clearPendingInvite(): Promise<void>;
  /** pendingRoute.forget(): the waiting link and any held one. */
  clearPendingRoute(): void;
  removeItem(key: string): Promise<void>;
  /** The leaving user's id, for the per-user active-league key; null when unknown. */
  userId: string | null;
}

export async function quiet(f: () => unknown): Promise<void> {
  try {
    await f();
  } catch {
    // best effort: nothing here is worth telling the person
  }
}

export async function clearLeaverState(deps: LeaverStateDeps): Promise<void> {
  await quiet(() => deps.clearPendingTakeover());
  await quiet(() => deps.clearPendingInvite());
  await quiet(() => deps.clearPendingRoute());
  if (deps.userId) await quiet(() => deps.removeItem(activeLeagueStorageKey(deps.userId as string)));
}
