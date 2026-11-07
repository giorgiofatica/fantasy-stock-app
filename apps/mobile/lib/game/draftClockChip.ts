/**
 * draftClockChip (Giorgio, 2026-11-06, option A, "A for clock"; PRODUCT_RULES "The clock while you search"): while it is your
 * pick, your clock is running, and the clock card's RING has scrolled off the top of the page, a small clock is pinned at the top
 * of the draft room: the ring, the seconds, and "Your pick". Pure, so tests-deno pins every number and rule; the chip itself is
 * components/game/DraftClockChip.tsx, the slot it hangs in is BarsRefresh's `pinned`.
 *
 * The search scrolls up to clear the keyboard (scrollReveal.ts), which takes the card, and its clock, off the screen while you
 * choose. The chip is the clock for that stretch. It never shows while the ring is in view (the card already says it), and
 * never when the clock is not yours and running (stalled, auto-picking, someone else's turn).
 */
import { space } from '../../constants/tokens/space';
import type { ClockCardKind } from './draftClockCard';

/** The chip's words, as approved ("Your pick": Giorgio, with A, 2026-11-06). */
export const CLOCK_CHIP_TEXT = 'Your pick';
export const CLOCK_CHIP_HINT = 'Shows the clock';

/** VoiceOver: a button named for what it says and its clock. No live region (the seconds would read out every second). */
export function clockChipLabel(clockLabel: string): string {
  return `${CLOCK_CHIP_TEXT}, ${clockLabel}`;
}

/** Where the chip sits: this far below the fade's lower edge (the status bar's inset plus the soft edge), centred. */
export const CHIP_TOP = space[2];

/** The pill: padding 6 top and bottom, 8 left (the ring's side), 14 right; an 8pt gap; at least 44pt tall (a touch target). */
export const CHIP_PADDING = { top: 6, bottom: 6, left: 8, right: 14 } as const;
export const CHIP_GAP = space[3];
export const CHIP_MIN_HEIGHT = 44;
/** The live edge, over the pill's rim. */
export const CHIP_EDGE = 2;

/** The ring: 22pt with a 3pt stroke, no text inside (the seconds sit beside it). */
export const CHIP_RING_SIZE = 22;
export const CHIP_RING_STROKE = 3;
/** Every part of the chip, the ring included, stops growing at 1.3x (ROW_TEXT_MAX_SCALE): about 46pt tall at the largest size. */
export const CHIP_MAX_SCALE = 1.3;

/** The ring's drawn size at this font scale (it grows with the text, to the cap). */
export function chipRingSize(fontScale: number): number {
  return CHIP_RING_SIZE * Math.min(Math.max(fontScale, 1), CHIP_MAX_SCALE);
}

/** Motion: it rises from this far below its place while it fades in (Reduce Motion: opacity only). */
export const CHIP_RISE = 8;

/** Whether the room's clock is yours and running: the chip exists (and the reveal clears it) for exactly this stretch. */
export function clockIsYoursAndRunning(kind: ClockCardKind, clockLabel: string): boolean {
  return kind === 'yours' && clockLabel !== '';
}

/** The ring is off the page: its bottom edge is above the visible top (the scroll view's top plus the fade over it). */
export function ringOffscreen(g: { ringBottom: number; viewTop: number; fadeHeight: number }): boolean {
  return g.ringBottom <= g.viewTop + g.fadeHeight;
}

/** The chip shows only when the clock is yours and running AND the ring has left the page. Unmeasured (null) is not "off". */
export function showClockChip(o: { kind: ClockCardKind; clockLabel: string; ringBottom: number | null; viewTop: number | null; fadeHeight: number }): boolean {
  if (!clockIsYoursAndRunning(o.kind, o.clockLabel)) return false;
  if (o.ringBottom === null || o.viewTop === null) return false;
  return ringOffscreen({ ringBottom: o.ringBottom, viewTop: o.viewTop, fadeHeight: o.fadeHeight });
}

/** The search's reveal margin, in points BELOW the fade, while your clock runs: the field lands under the chip (its top gap, its
 * measured height, then 12 and 16), so the field and its results never sit behind it. Passed even before the chip shows, because
 * the reveal itself is what scrolls the card away. */
export function chipRevealBelow(chipHeight: number): number {
  return CHIP_TOP + chipHeight + space[4] + space[5];
}

/** A tap on the chip scrolls the page until the clock card's top sits this far below the fade. */
export const CARD_REVEAL_BELOW = space[3];
