/**
 * A calm Home (Giorgio, option A, 2026-10-12; PRODUCT_RULES "A calm Home"): the rules
 * the build spec states as rules, pure so they're tested under Deno
 * (tests-deno/home-calm.test.ts). Team value is the ONE standout number; This week and
 * Standings are two quiet cards that open Matchup and League › Standings; sections never
 * touch (24pt between blocks); one primary action per screen.
 */

// ── Tap through ────────────────────────────────────────────────────────────
/** This week opens Matchup, in every state the card shows. */
export const THIS_WEEK_HREF = '/(tabs)/matchup' as const;
export const OPENS_MATCHUP_HINT = 'Opens Matchup';
/** Standings opens League on Standings, even if League was left on another segment. */
export const STANDINGS_HREF = { pathname: '/(tabs)/league', params: { segment: 'standings' } } as const;
/** "Your season"'s title, and every tile but this week's, open League on Schedule (interim for a tile: Matchup shows
 * only the current week, so there is no past-week matchup screen to open). */
export const SCHEDULE_HREF = { pathname: '/(tabs)/league', params: { segment: 'schedule' } } as const;
/** "See the bracket" (an eliminated player's card) opens League on the Playoffs segment, not on whichever segment
 * League was left on (W8 tap-through: it landed on Standings, with no bracket in view). */
export const BRACKET_HREF = { pathname: '/(tabs)/league', params: { segment: 'playoffs' } } as const;

export type LeagueSegment = 'standings' | 'schedule' | 'playoffs' | 'history';
const LEAGUE_SEGMENTS: readonly LeagueSegment[] = ['standings', 'schedule', 'playoffs', 'history'];

/** League's `?segment=` route param (Home's Standings card sends 'standings'), as
 * Matchup reads 'all'. Anything else, or no param, changes nothing. */
export function leagueSegmentFromParam(param: string | string[] | undefined): LeagueSegment | null {
  const v = Array.isArray(param) ? param[0] : param;
  return (LEAGUE_SEGMENTS as readonly string[]).includes(v ?? '') ? (v as LeagueSegment) : null;
}

// ── Season over: one primary ───────────────────────────────────────────────
/**
 * The season-over screen's one primary: Run it back for the commissioner, the ask for a
 * member of a renewed league, or none. "See the final standings" is a row in the result
 * card, never a filled button, so it never competes with either.
 */
export function seasonOverPrimary(args: { runItBackOn: boolean; isCommissioner: boolean; hasSuccessor: boolean }): 'run_it_back' | 'renewal_ask' | null {
  if (!args.runItBackOn) return null;
  if (args.isCommissioner) return 'run_it_back';
  return args.hasSuccessor ? 'renewal_ask' : null;
}

// ── Before the draft: the draft card's order ───────────────────────────────
export type PreDraftBlock =
  | 'postponedTitle'
  | 'noDate'
  | 'roomOpenTag'
  | 'countdown'
  | 'date'
  | 'starting'
  | 'pick'
  | 'waiting'
  | 'buttons';

export interface PreDraftFlags {
  memberPostponed: boolean;
  /** No draft time yet (its block is held back while a renewal's replies are pending). */
  noDate: boolean;
  date: boolean;
  roomOpenTag: boolean;
  countdown: boolean;
  starting: boolean;
  pick: boolean;
  waiting: boolean;
  buttons: boolean;
}

/**
 * The draft card's blocks, top to bottom (the tag sits above them all). With a draft
 * time, the countdown leads (score.xl, the screen's one big number), then the date and
 * the button(s). UX rule 12 (the sweep, rows 5 and 6): the pick-clock line ("60-second
 * picks · 6 rounds"), the order line ("The draft room opens Sat 6:00 PM ET, when the order
 * is set."), the no-buying caption and a postponed card's line are not blocks any more:
 * each said what the card, its button or another screen already says.
 */
export function preDraftBlocks(f: PreDraftFlags): PreDraftBlock[] {
  const out: PreDraftBlock[] = [];
  if (f.memberPostponed) out.push('postponedTitle');
  else if (f.noDate) out.push('noDate');
  else {
    if (f.roomOpenTag) out.push('roomOpenTag');
    if (f.countdown) out.push('countdown');
    if (f.date) out.push('date');
    if (f.starting) out.push('starting');
    if (f.pick) out.push('pick');
  }
  if (f.waiting) out.push('waiting');
  if (f.buttons) out.push('buttons');
  return out;
}

/** "Through Week N" names the last completed week; in Week 1 there is none yet (N = 0), so the
 * label is hidden (no new copy); the chevron and the card still open Standings (W4 gate). */
export function throughWeekShown(throughWeek: number): boolean {
  return throughWeek > 0;
}

// ── The hero's meta line ───────────────────────────────────────────────────
const NBSP = ' ';
/** "2nd of 6 · 4–1 · Week 6 of 14", wrapping only BETWEEN segments at large text: each
 * segment's own spaces are non-breaking ("Week 6 of 14" stays together) and each " · "
 * keeps its dot with the segment before it (Design Lead, W4 gate P3, 2026-10-13). Empty
 * segments drop out with their separator. */
export function heroMetaLine(segments: (string | null | undefined)[]): string {
  return segments
    .filter((s): s is string => !!s)
    .map((s) => s.replace(/ /g, NBSP))
    .join(`${NBSP}· `);
}
