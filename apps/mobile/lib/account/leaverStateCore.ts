// The links a person leaves behind on this phone when their session ends, and the one place that clears them. Both ways a
// session ends on purpose run it: a plain "Sign out" (lib/SessionProvider.tsx, after Supabase confirms the sign-out) and
// the end of an account deletion (lib/account/endSessionCore.ts). Security brief 2026-11-13, A1: before this, only the
// deletion path cleared these, so a link one person opened stayed on the phone after a plain sign-out.
//
//   - the pending takeover and the pending invite (AsyncStorage): links that person opened;
//   - the pending route (memory): a link recorded while signed out or at the username gate, not yet opened.
//
// NOT here: the per-user active-league choice (sp.activeLeague.v1.<uid>). It is keyed by the user's id, so the next person
// on this phone never reads it, and keeping it lets the same person sign back in to the league they left on. Only an
// account deletion removes it (endSessionCore.ts), because that user is gone for good.
//
// Best effort, every step: one failing store never stops the rest. Pure (no React Native imports) so tests-deno can drive
// it; lib/account/leaverState.ts binds the real stores.

export interface LeaverStateDeps {
  clearPendingTakeover(): Promise<void>;
  clearPendingInvite(): Promise<void>;
  /** pendingRoute.forget(): the waiting link and any held one. */
  clearPendingRoute(): void;
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
}
