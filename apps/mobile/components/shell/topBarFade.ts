// The top bar scrolls away with the page (Giorgio, 2026-11-06, "A for both"; PRODUCT_RULES "The top bar"). Once the page has
// scrolled, its colour fades out over a few points behind the status bar / clock, so content never runs into the time. The
// numbers live here, pure, so a test can pin them; BarsRefresh draws the fade and positions the search reveal with them.

/** Scroll points over which the fade comes in: nothing at rest, full once the page has moved this far. */
export const FADE_IN_POINTS = 24;

/** Points BELOW the status bar over which the page colour fades to clear ("a few points"). */
export const FADE_SOFT_POINTS = 10;

/** Points between the fade's lower edge and a field the search reveal scrolls up. */
export const REVEAL_GAP = 12;

/** 0 at rest (and while pulling down past the top), 1 once scrolled FADE_IN_POINTS. */
export function topFadeOpacity(scrollY: number): number {
  'worklet'; // read on the UI thread by TopFade's animated style
  if (!(scrollY > 0)) return 0;
  return Math.min(1, scrollY / FADE_IN_POINTS);
}

/** The fade's height: the status bar's inset (solid page colour) plus the soft edge. */
export function topFadeHeight(topInset: number): number {
  return Math.max(0, topInset) + FADE_SOFT_POINTS;
}

/** Where the gradient stops go: solid through the inset, clear at the bottom edge. */
export function topFadeStops(topInset: number): [number, number] {
  const h = topFadeHeight(topInset);
  return [Math.max(0, topInset) / h, 1];
}

/** The same colour, fully clear (`#RRGGBB` -> `#RRGGBB00`), so the gradient fades in colour, never through grey. */
export function clearOf(hex: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}00` : 'transparent';
}

/** Where the search reveal puts a field, measured from the top of the scroll content, which now starts at the very top of
 * the screen (the bar is inside it): just under the status-bar fade, not under a bar that has scrolled away. */
export function revealMargin(topInset: number): number {
  return topFadeHeight(topInset) + REVEAL_GAP;
}
