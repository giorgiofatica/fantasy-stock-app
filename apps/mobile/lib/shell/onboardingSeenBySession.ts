// A signed-in session marks the intro cards seen (P3, Giorgio's phone, 1.3.0 (8), 2026-11-03). The cards are for a
// cold install only (PRODUCT_RULES: "The three cards show only on a cold install"), but the seen flag
// (lib/shell/firstRun.ts) was set only by the cards, Get started and link arrivals. An install signed in since before
// the cards existed (upgraded from 1.2.0) never set it, so its first sign-out showed the cards. Someone who has had a
// session on this phone is not a cold install: a restored session at launch and every sign-in count. Pure, for
// tests-deno; app/_layout.tsx applies it.

/** Whether to mark onboarding seen now: a session exists and the flag is not already known to be set. `seen` is
 * null while the stored flag is still being read; marking then is safe (firstRun's read keeps a newer in-memory
 * mark). */
export function shouldMarkOnboardingSeen(signedIn: boolean, seen: boolean | null): boolean {
  return signedIn && seen !== true;
}
