/**
 * Create league's × (PRODUCT_RULES, "Create league needs an easier way out", 2026-11-17, ruled "A"): every step has one at the
 * top right, and it closes the whole flow at once: no prompt, the half-made league's state is dropped (it lives in the screen,
 * which the dismiss unmounts). The same path step 1's Cancel took. A sheet's close never asks either (2026-11-12, "B and no").
 */

/** The × is dead while the create request is in flight, and live again on success or error. */
export function closeDisabled(creating: boolean): boolean {
  return creating;
}

/** Tapping ×: dismiss straight away from any step. Returns whether it closed (it does not while creating). */
export function closeCreateLeague(creating: boolean, dismiss: () => void): boolean {
  if (closeDisabled(creating)) return false;
  dismiss();
  return true;
}
