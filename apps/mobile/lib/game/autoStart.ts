/**
 * Draft auto-start, the client's rules (3c-2; backend feat/draft-auto-start,
 * board #call-auto-start "The draft starts by itself (decided)", docs/PRODUCT_RULES.md
 * › Draft). Pure, so the rules tests see them.
 *
 * Giorgio's rules: no manual Start. "Draft starts in …" once a date is set; the
 * room opens at T−1h (the order is set); the draft starts by itself at T. The
 * gate is the room-open time: still blocked then, the draft is POSTPONED for
 * everyone and the commissioner picks a new time. Draft times sit on 15-minute
 * steps, at least an hour out, and can't change once the room opens (except
 * when postponed).
 *
 * The phase comes from the SERVER (draft-control status: start_state, judged on
 * the server's clock) plus the server's clock offset, never the phone's clock
 * alone. Copy: the board's strings verbatim (its own mix of ’ and '); anything
 * marked NEW is flagged for the Design Lead.
 */
import { etDateParts } from '../time/etParts';
import { keepName } from '../account/keepName';
import { defaultDraftDate } from './draftDateSave';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
/** The room opens this long before the draft (ROOM_OPEN_LEAD_SECONDS server-side). */
export const ROOM_OPEN_LEAD_MS = HOUR;
/** Draft times sit on this grid (DRAFT_TIME_STEP_MINUTES). */
export const DRAFT_TIME_STEP_MINUTES = 15;

export type StartState = 'no_date' | 'scheduled' | 'at_risk' | 'room_open' | 'due' | 'postponed' | 'started';
const START_STATES: readonly StartState[] = ['no_date', 'scheduled', 'at_risk', 'room_open', 'due', 'postponed', 'started'];

export interface Postponed {
  from: string | null;
  stage: string | null;
  reason: string | null;
}

export interface StartStatus {
  /** Null when the server didn't send one (an older draft-control). */
  startState: StartState | null;
  startsAt: string | null;
  postponed: Postponed | null;
}

/** draft-control status → the auto-start fields. Unknown values are null, never guessed. */
export function parseStartStatus(data: Record<string, unknown> | null | undefined): StartStatus {
  const raw = data?.start_state;
  const startState = typeof raw === 'string' && (START_STATES as readonly string[]).includes(raw) ? (raw as StartState) : null;
  const startsAt = typeof data?.starts_at === 'string' ? data.starts_at : null;
  const p = data?.postponed as Record<string, unknown> | null | undefined;
  const postponed = p && typeof p === 'object'
    ? {
      from: typeof p.from === 'string' ? p.from : null,
      stage: typeof p.stage === 'string' ? p.stage : null,
      reason: typeof p.reason === 'string' ? p.reason : null,
    }
    : null;
  return { startState, startsAt, postponed };
}

// ── The server clock ─────────────────────────────────────────────────────

/** The server's clock minus the phone's, from a read that carried server_now
 * (get_draft_clock, as the draft room does). 0 when there is none. */
export function serverOffsetMs(serverNowIso: string | null | undefined, receivedAtMs: number): number {
  if (!serverNowIso) return 0;
  const t = new Date(serverNowIso).getTime();
  return Number.isNaN(t) ? 0 : t - receivedAtMs;
}

/** Where the server clock comes from: draft-control status's own server_now
 * (the DB clock, the same instant that judged start_state; feat/draft-auto-start
 * 3f0eb8d), or, from an older deploy without it, a get_draft_clock read. */
export function clockFromStatus(data: Record<string, unknown> | null | undefined):
  | { source: 'status'; serverNow: string }
  | { source: 'fallback' } {
  const v = data?.server_now;
  if (typeof v === 'string' && !Number.isNaN(new Date(v).getTime())) return { source: 'status', serverNow: v };
  return { source: 'fallback' };
}

// ── The lobby's phase ────────────────────────────────────────────────────

/** What the lobby shows. `starting` = the start time has come (the countdown
 * reads 00:00, any member's phone asks the server to start, and polls). */
export type LobbyPhase = 'no_date' | 'scheduled' | 'at_risk' | 'room_open' | 'starting' | 'postponed' | 'started';

/** The server's state, carried forward on the server clock between reads: a
 * countdown that crosses T−1h or T moves on by itself (and the caller re-reads
 * at those boundaries). The server's word wins for started / postponed /
 * no_date / at_risk; a missing start_state (an older server) is derived from
 * the time alone. */
export function lobbyPhase(status: Pick<StartStatus, 'startState' | 'startsAt'>, serverNowMs: number): LobbyPhase {
  const s = status.startState;
  if (s === 'started') return 'started';
  if (s === 'postponed') return 'postponed';
  if (s === 'no_date' || !status.startsAt) return 'no_date';
  const t = new Date(status.startsAt).getTime();
  if (Number.isNaN(t)) return 'no_date';
  if (s === 'at_risk' && serverNowMs < t) return 'at_risk'; // the gate decides at T−1h; re-read then
  if (serverNowMs >= t) return 'starting';
  if (serverNowMs >= t - ROOM_OPEN_LEAD_MS) return 'room_open';
  return 'scheduled';
}

/** The next time the phase can change on its own (T−1h, then T), to re-read
 * the status then. Null when nothing is pending. */
export function nextBoundaryMs(startsAt: string | null, serverNowMs: number): number | null {
  if (!startsAt) return null;
  const t = new Date(startsAt).getTime();
  if (Number.isNaN(t)) return null;
  for (const b of [t - ROOM_OPEN_LEAD_MS, t]) if (b > serverNowMs) return b;
  return null;
}

/** The countdown target for a phase: T for everyone; the room-open time for
 * the commissioner's at-risk deadline. */
export function roomOpensAtMs(startsAt: string): number {
  return new Date(startsAt).getTime() - ROOM_OPEN_LEAD_MS;
}

// ── The countdown ────────────────────────────────────────────────────────

/** The board's clock: "2d 06h 40m" / "6h 40m" at an hour or more (to the
 * minute, rounded down); "42:18" under an hour (to the second, rounded up, so
 * it reads 00:00 only at the moment itself); "00:00" at and past it. */
export function startClock(msLeft: number): string {
  if (msLeft <= 0) return '00:00';
  const pad = (n: number) => String(n).padStart(2, '0');
  if (msLeft < HOUR) {
    const secs = Math.ceil(msLeft / 1000);
    if (secs >= 3600) return '1h 00m';
    return `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;
  }
  const totalMinutes = Math.floor(msLeft / MIN);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  return `${hours}h ${pad(minutes)}m`;
}

// ── ET labels (Hermes: hourCycle pinned; .format() only for times) ──────

const ET = 'America/New_York';

/** "6:00 PM ET". */
export function etTimeLabel(ms: number): string {
  const t = new Intl.DateTimeFormat('en-US', { timeZone: ET, hour: 'numeric', minute: '2-digit', hourCycle: 'h12' }).format(new Date(ms));
  return `${t} ET`;
}

/** "Sat, Oct 3 · 7:00 PM ET" (the board's draft time). */
export function etWhenLabel(ms: number): string {
  const d = new Intl.DateTimeFormat('en-US', { timeZone: ET, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(ms));
  return `${d} · ${etTimeLabel(ms)}`;
}

/** "Today" / "Tomorrow" / "Thu, Oct 1", by the ET calendar date. */
export function etDayWord(ms: number, nowMs: number): string {
  const day = etDateParts(new Date(ms));
  const today = etDateParts(new Date(nowMs));
  if (day && today) {
    const key = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);
    const diff = Math.round((key(day.year, day.month, day.day) - key(today.year, today.month, today.day)) / (24 * HOUR));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
  }
  return new Intl.DateTimeFormat('en-US', { timeZone: ET, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(ms));
}

// ── The countdown card (everyone) ────────────────────────────────────────

export interface CountdownCopy {
  tag: string;
  clock: string;
  /** Shown with a spinner (the starting phase). */
  starting: string | null;
  lines: string[];
}

/** Board AutoLobby: before the room, room open, at 0. */
export function countdownCopy(phase: 'scheduled' | 'room_open' | 'starting', startsAt: string, serverNowMs: number): CountdownCopy {
  const t = new Date(startsAt).getTime();
  // UX rule 12 (the sweep, row 7): before the room opens the card shows the time as a value, "Sat, Oct 3 · 7:00 PM ET" (the same line as
  // Home); "The draft room opens at 6:00 PM ET, when the order is set." is cut (the push, and the card itself, change when it opens).
  const when = etWhenLabel(t);
  if (phase === 'starting') return { tag: 'Draft starts in', clock: '00:00', starting: 'Starting the draft', lines: [] };
  // Rule 12 (the DL's ruling on the room-open card): the time as a value, exactly as the scheduled card shows it; "The draft starts automatically at" is cut.
  if (phase === 'room_open') return { tag: 'Draft room open · starts in', clock: startClock(t - serverNowMs), starting: null, lines: [when] };
  return {
    tag: 'Draft starts in',
    clock: startClock(t - serverNowMs),
    starting: null,
    lines: [when],
  };
}

/** No draft time yet. NEW copy (no frame). */
export function noDateCopy(isCommissioner: boolean, commissionerName: string): string {
  return isCommissioner ? 'Set a draft time in League settings.' : `${commissionerName} will set the draft time.`;
}
export const NO_DATE_TITLE = 'No draft time yet'; // NEW copy

/** Shown under "Starting the draft" while the server retries a start (draft_start_retrying). NEW copy. */
export const START_RETRYING = 'Still starting. This can take a minute.';

// ── The commissioner's blockers card ─────────────────────────────────────

/** Codes that never show as a blocker in the card: the date itself is the
 * countdown; postponed is the card's own state; feasibility_unavailable means
 * "couldn't judge", never "blocked" (draft-start-policy isTransientBlocker). */
const NOT_SHOWN = new Set([
  'draft_date_not_reached', 'draft_postponed', 'no_draft_date', 'not_started_state', 'feasibility_unavailable',
  'room_did_not_open', 'start_failed',
]);

export type Blocker = { code: string; [k: string]: unknown };

/** The blockers the commissioner can fix, in the server's order. */
export function fixableBlockers(blockers: readonly Blocker[]): Blocker[] {
  return blockers.filter((b) => !NOT_SHOWN.has(b.code));
}

function departedNames(b: Blocker): string[] {
  const d = Array.isArray(b.departed) ? (b.departed as { name?: unknown }[]) : [];
  return d.map((x) => (typeof x?.name === 'string' ? x.name : '')).filter(Boolean);
}

/**
 * A departed manager's name is one piece on screen (Design Lead gate on #356, AX5: "Invite someone to take Sofia / F.'s place"):
 * every name the blocker lists gets keepName's no-break spaces (and its hyphen joiners; a name over keepName's 20 characters
 * stays breakable, so a long name wraps between its words rather than run off the screen). Display only, applied at the render
 * (as the other keep* helpers are): the strings above stay plain, for the tests and for VoiceOver. The possessive "'s" has no space before it, so
 * it stays with the name.
 */
export function keepDepartedNames(b: Blocker, text: string): string {
  let out = text;
  for (const name of departedNames(b)) out = out.replace(name, () => keepName(name));
  return out;
}

/** When no clause fits (Design Lead ruling). */
export const FALLBACK_CLAUSE = 'something in League settings needs fixing';

/** A blocker as a whole clause (the Design Lead's list, board #call-auto-start
 * strings box): each slots into "The draft room can't open yet: {clause}." and
 * stands alone, capitalised, as a title in the blockers card. */
export function blockerClause(b: Blocker): string {
  switch (b.code) {
    case 'roster_reconfirm_required': {
      const names = departedNames(b);
      if (names.length === 1) return `${names[0]} left the league`;
      if (names.length === 2) return `${names[0]} and ${names[1]} left the league`;
      const n = names.length || Number(b.membersBefore ?? 0) - Number(b.members ?? 0);
      return n > 0 ? `${n} managers left the league` : FALLBACK_CLAUSE;
    }
    case 'playoff_teams_exceeds_members':
      return typeof b.playoffTeams === 'number' && typeof b.members === 'number'
        ? `${b.playoffTeams} playoff teams, but ${b.members} teams are in`
        : 'there are more playoff teams than teams';
    case 'not_enough_members':
      return `fewer than ${typeof b.need === 'number' ? b.need : 4} teams have joined`;
    case 'slots_infeasible':
      return "some slots can't be filled";
    case 'budget_infeasible':
      return "the budget can't fill every roster";
    case 'no_stake_mode':
      return "the league's stakes aren't set";
    case 'invalid_playoff_teams':
      return "the number of playoff teams isn't set";
    case 'renewal_replies_pending':
      return 'not every Season 1 player has answered';
    default:
      return FALLBACK_CLAUSE;
  }
}

/** The clause as a card title: first letter capitalised. */
export function blockerTitle(b: Blocker): string {
  const c = blockerClause(b);
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/** The reconfirm choices (the leave board's buttons). */
export function moveForwardLabel(members: number): string {
  return `Move forward with ${members}`;
}
export const INVITE_SOMEONE_NEW = 'Invite someone new';

/**
 * The reconfirm blocker's sub-card has two states, keyed on the server's `choice` (draft-control rules.ts
 * StartBlocker): 'pending' (the commissioner hasn't chosen: the two buttons) and 'invite' (they chose "Invite
 * someone new": the blocker stays until a human joins, migration 20261107000005, so the card must say so).
 * Board #call-leave ReconfirmCard mode 'inviting' (PR #122), strings verbatim (its straight apostrophe).
 * Anything else, or no `choice` (an older draft-control), is 'choose': never a card that hides the choice.
 */
export function inviteWaitingTitle(name: string): string {
  return `Invite someone to take ${name}'s place`;
}
/** Two or more left, or none named: the same pattern without a single name. NEW copy. */
export const INVITE_WAITING_TITLE_NO_NAME = 'Invite someone to take their place';
/** The way back from the waiting state (board: "Move forward with {teams} instead"). */
export function moveForwardInsteadLabel(members: number): string {
  return `Move forward with ${members} instead`;
}

/**
 * A saved fix keeps the card busy (the tapped button's spinner) until the status re-read that follows it has LANDED,
 * success or failure: `readKey` is the refresh key of the read behind the current status, `target` the key the save
 * asked for. The card used to go idle the moment the save returned and show the old blocker for the length of the
 * re-read, which is exactly Giorgio's "nothing happened" (phone pass 1.3.0 (12)). A failed re-read ends it too, via
 * the "didn't load" path, and SETTLE_CAP_MS ends it if a read never answers: the card is never stuck busy.
 */
export function readSettled(readKey: number, target: number): boolean {
  return readKey >= target;
}
export const SETTLE_CAP_MS = 15_000;

/**
 * The blockers card's text order at every size (Design Lead gate on #356, AX5: the sub-cards' text outgrew the card's own title,
 * "Sofia F. left the league" in 40pt under a 27pt "The draft can't start yet"): outer title >= sub-card title >= lines.
 * The outer title is a `headline` (capped 1.6). The sub-card title is a `callout` `subOf="headline"`, so it takes the LOWER of its own
 * cap (none) and the title's, 1.6, which is the cap on the card's title: it is smaller at every size because it is 13pt under a 17pt
 * title at the same ceiling. The lines under it ("Share the code. When someone joins...", "Up to 7, one per team."), the playoff
 * stepper's label and a fix's refusal cap at this, so none of them can outrank the sub-card's own title.
 */
export const SUB_CARD_LINE_MAX_SCALE = 1.6;

/**
 * Which part of the blockers card a fix's refusal belongs to: the blocker code whose sub-card holds the control that
 * was pressed, or 'draft_time' (the Pick a new draft time button sits at the card's foot). PRODUCT_RULES, auth
 * screens, R5: an error sits where its cause is. Giorgio's phone, build 12: "Move forward with 2" printed its
 * refusal at the very bottom of the card, under "Pick a new draft time", three blocks from the button.
 */
export type FixOwner = 'roster_reconfirm_required' | 'playoff_teams_exceeds_members' | 'draft_time';

/**
 * Where a fix's refusal renders: INSIDE the sub-card of its owner (the index into `blockers`), or at the card's
 * foot. The foot is the fallback only when the owning sub-card is gone, e.g. the blocker cleared on a re-read, so
 * the refusal is never lost; 'draft_time' is the foot by design.
 */
export function errorPlacement(
  error: string | null | undefined,
  owner: string | null | undefined,
  blockers: readonly { code: string; absorbs?: unknown }[],
): { subCard: number; foot: boolean } {
  if (!error) return { subCard: -1, foot: false };
  // A merged card (mergeBelowMin) also owns the codes it absorbed.
  const owns = (b: { code: string; absorbs?: unknown }) => b.code === owner || (Array.isArray(b.absorbs) && b.absorbs.includes(owner));
  const i = owner ? blockers.findIndex(owns) : -1;
  return { subCard: i, foot: i === -1 };
}

/** A draft needs this many managers (draft-control rules.ts MIN_DRAFT_MEMBERS; a test reads the server's value). */
export const MIN_DRAFT_MEMBERS = 4;

/**
 * Whether "Move forward with N" (pending) and "Move forward with N instead" (waiting) are offered. ONE rule for
 * both buttons. Below the minimum they cannot work: confirm_league_roster refuses playoff teams > members, the
 * playoff stepper is only emitted from 4, and a draft cannot start below MIN_DRAFT_MEMBERS (phone pass step 23).
 * Giorgio's rule B (2026-11-10, PRODUCT_RULES "When managers leave before the draft, below four"): from 4 up
 * the commissioner still chooses; below it there is no choice to make (mergeBelowMin draws the one invite card).
 */
export function showMoveForward(members: number): boolean {
  return members >= MIN_DRAFT_MEMBERS;
}

/** The members a roster blocker speaks about: its own count (the server judged it), else the league's. */
function rosterMembers(b: Blocker, memberCount: number): number {
  return typeof b.members === 'number' ? b.members : memberCount;
}

/** "Fewer than 4 teams have joined." The existing clause (blockerClause), capitalised, as the sentence the card draws. */
export function belowMinLine(need: number = MIN_DRAFT_MEMBERS): string {
  const clause = blockerClause({ code: 'not_enough_members', need });
  return `${clause.charAt(0).toUpperCase()}${clause.slice(1)}.`;
}

/**
 * Giorgio's rule B: with fewer than MIN_DRAFT_MEMBERS in, the roster_reconfirm_required and not_enough_members
 * blockers are ONE sub-card: who left, "Fewer than 4 teams have joined.", the code and Share, no choice of any kind
 * (a league needs four to draft, so inviting is the only path and is already chosen: 'pending' or 'invite' alike).
 * The server still sends both codes; only the card combines them. The merged blocker keeps the reconfirm's names and
 * members, absorbs not_enough_members (its refusals land here, errorPlacement) and carries the `need` it spoke of.
 * From 4 up, and for a league with no reconfirm, the list is returned as it came.
 */
export function mergeBelowMin(blockers: Blocker[], memberCount: number): Blocker[] {
  const roster = blockers.find((b) => b.code === 'roster_reconfirm_required');
  if (!roster || rosterMembers(roster, memberCount) >= MIN_DRAFT_MEMBERS) return blockers;
  const short = blockers.find((b) => b.code === 'not_enough_members');
  const need = typeof short?.need === 'number' ? short.need : MIN_DRAFT_MEMBERS;
  return blockers
    .filter((b) => b.code !== 'not_enough_members')
    .map((b) => (b === roster ? { ...b, absorbs: ['not_enough_members'], need } : b));
}

export type ReconfirmView =
  | { mode: 'choose'; members: number }
  | { mode: 'inviting'; members: number; title: string; moveForward: string }
  | { mode: 'below_min'; members: number; line: string };

export function reconfirmView(b: Blocker, memberCount: number): ReconfirmView {
  const members = rosterMembers(b, memberCount);
  // Below the minimum there is no choice to show, whatever the server's `choice` says.
  if (members < MIN_DRAFT_MEMBERS) return { mode: 'below_min', members, line: belowMinLine(typeof b.need === 'number' ? b.need : MIN_DRAFT_MEMBERS) };
  if (b.choice !== 'invite') return { mode: 'choose', members };
  const names = departedNames(b);
  return {
    mode: 'inviting',
    members,
    title: names.length === 1 ? inviteWaitingTitle(names[0]) : INVITE_WAITING_TITLE_NO_NAME,
    moveForward: moveForwardInsteadLabel(members),
  };
}

/** UX rule 12 (the sweep, row 1): a postponed card has NO tag and NO line, only its title. "POSTPONED" said the title twice, and
 * "The league wasn't ready at 6:00 PM ET. Fix these, then pick a new draft time." said what the fix cards and the button already say.
 * The at-risk card keeps its eyebrow and its "Fix these before …" line (row 8, superseded by step 25 (b); another build gives them the day). */
export interface BlockersCardCopy {
  tag: string | null;
  title: string;
  line: string | null;
}

/** Board BlockersCard. `deadlineLabel` is the room-open time ("6:00 PM ET"). */
export function blockersCardCopy(phase: 'risk' | 'postponed', deadlineLabel: string | null): BlockersCardCopy {
  if (phase === 'risk') {
    const at = deadlineLabel ?? 'the draft room opens';
    return {
      tag: `Needs you before ${at}`,
      title: 'The draft can’t start yet',
      line: `Fix these before ${at}, when the draft room opens. If they’re still open then, the draft is postponed.`,
    };
  }
  return { tag: null, title: 'The draft is postponed', line: null };
}

export const PICK_NEW_TIME = 'Pick a new draft time';
/** The reconfirm choice didn't save. NEW copy. */
export const RECONFIRM_NOT_SAVED = "Your choice wasn't saved. Try again.";
/** The lobby's draft status read failed (the house "X didn't load" form, with Try again; Design Lead ruling). */
export const DRAFT_STATUS_LOAD_FAILED = "The draft lobby didn't load.";
/** The new time didn't save, for a reason other than the three draft-time refusals. NEW copy. */
export const NEW_TIME_NOT_SAVED = "The new draft time wasn't saved. Try again.";
/** A first draft time (Home's no-time card) didn't save. "new" stays in the postponed flow only (Design Lead, ruled). */
export const DRAFT_TIME_NOT_SAVED = "The draft time wasn't saved. Try again.";

/** The time the postponed league wasn't ready at: the room-open time (stage
 * room_open, or unknown), the draft time itself for a stage-start postponement. */
export function postponedAtMs(p: Postponed | null): number | null {
  if (!p?.from) return null;
  const from = new Date(p.from).getTime();
  if (Number.isNaN(from)) return null;
  return p.stage === 'start' ? from : from - ROOM_OPEN_LEAD_MS;
}

/** The commissioner's at-risk deadline card (board CommishBlocked, risk). */
export function deadlineCopy(startsAt: string, serverNowMs: number): { tag: string; clock: string; line: string } {
  const t = new Date(startsAt).getTime();
  return {
    tag: 'Draft room opens in',
    clock: startClock(roomOpensAtMs(startsAt) - serverNowMs),
    line: `The draft starts at ${etTimeLabel(t)}.`,
  };
}

// ── Members once postponed ───────────────────────────────────────────────

/** Board MemberPostponed. The line depends on where it shows: the lobby
 * says "here and on your Home"; Home itself drops "and on your Home"
 * (self-referential there; Design Lead, PR #135). */
export function memberPostponedCopy(commissionerName: string): { tag: string; title: string } {
  // UX rule 12 (the sweep, row 6 and the DL's ruling on the lobby's twin): no line under the title, on Home or in the lobby. "You'll see it
  // here (and on your Home), with at least an hour's notice." said how it works; the time shows when it is set.
  return { tag: 'Draft postponed', title: `${commissionerName} will pick a new time.` };
}

/** Who to name when the commissioner's name isn't known (backend's fallback). */
export const COMMISSIONER_FALLBACK = 'The commissioner';

// ── The date picker ──────────────────────────────────────────────────────

/** The earliest time a draft can be set: an hour out, up to the next quarter hour. */
export function earliestDraftMs(nowMs: number): number {
  return defaultDraftDate(new Date(nowMs)).getTime();
}

/** On the 15-minute grid, no seconds. */
export function onDraftGrid(ms: number): boolean {
  return ms % (DRAFT_TIME_STEP_MINUTES * MIN) === 0;
}

/** Board DraftDatePicker's line: "Today · 3:15 PM ET", and whether it is the earliest. */
export function pickerLine(ms: number, nowMs: number): { value: string; earliest: boolean } {
  return { value: `${etDayWord(ms, nowMs)} · ${etTimeLabel(ms)}`, earliest: ms === earliestDraftMs(nowMs) };
}

/** Board DateAfterRoom: the Draft time row once the room is open. */
export const DATE_LOCKED_AFTER_ROOM = 'The draft time can’t change once the draft room opens.';

/** Is the draft time locked? Once the room opens and until the draft starts,
 * except when postponed (it needs a new time). */
export function draftTimeLocked(startState: StartState | null): boolean {
  return startState === 'room_open' || startState === 'due';
}

/** The server's draft-time refusals (22023, trg_leagues_draft_time), calm.
 * Null for anything else. too_soon / invalid are NEW copy. */
export function draftTimeRefusal(err: unknown): string | null {
  const m = (err as { message?: unknown } | null | undefined)?.message;
  if (typeof m !== 'string') return null;
  if (m.startsWith('draft_time_locked')) return DATE_LOCKED_AFTER_ROOM;
  if (m.startsWith('draft_time_too_soon')) return 'Pick a time at least an hour from now.';
  if (m.startsWith('draft_time_invalid')) return 'Pick a time ending in :00, :15, :30 or :45.';
  return null;
}

/** A refused roster reconfirm (draft-control confirm_roster), per reason: the
 * audit's Rule 8 table › draft-control, verbatim (U-24). Retrying fixes none of
 * these, so none says "Try again". `transport` (no answer) and anything else keep
 * RECONFIRM_NOT_SAVED. The playoff line needs both numbers from the refusal body
 * (`playoff_teams`, `members`); with either missing (an invalid_playoff_teams
 * can carry a null count) it falls back too, never "null playoff teams". */
export function confirmRosterRefusal(
  r: { transport: true } | { transport: false; reason: string | null; body: Record<string, unknown> },
): string | null {
  if (r.transport) return RECONFIRM_NOT_SAVED;
  const count = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);
  switch (r.reason) {
    case null: return null;
    case 'draft_started': return 'The draft has started, so the teams are set.';
    case 'playoff_teams_exceeds_members':
    case 'invalid_playoff_teams': {
      const p = count(r.body.playoff_teams);
      const m = count(r.body.members);
      return p !== null && m !== null ? `${p} playoff teams, but ${m} teams are in. Lower the playoff teams first.` : RECONFIRM_NOT_SAVED;
    }
    case 'playoff_teams_not_applicable': return 'This league has no playoffs to change.';
    case 'not_commissioner': return 'Only the commissioner can change this.';
    case 'not_a_member':
    case 'league_not_found': return "That didn't go through.";
    default: return RECONFIRM_NOT_SAVED;
  }
}

/** What a start request's refusal means for the lobby: keep waiting (the
 * server retries), or re-read (postponed, not yet due on its clock, anything else). */
export function startKickOutcome(res: { ok?: unknown; reason?: unknown } | null | undefined): 'started' | 'retrying' | 'reread' {
  if (res?.ok === true) return 'started';
  if (res?.reason === 'draft_start_retrying') return 'retrying';
  return 'reread';
}

// ── What the lobby shows, per phase and viewer ───────────────────────────

export interface LobbyView {
  /** The commissioner's blockers card. */
  blockers: 'risk' | 'postponed' | null;
  /** The commissioner's "Draft room opens in" deadline (at risk). */
  deadline: boolean;
  /** Everyone's countdown card. */
  countdown: 'scheduled' | 'room_open' | 'starting' | null;
  memberPostponed: boolean;
  noDate: boolean;
  /** The order (or the waiting state) under the countdown. */
  order: boolean;
  /** Ask the server to start at 0:00, then poll: the COMMISSIONER's phone only (the
   * server refuses anyone else's start, 403 not_commissioner). Members rely on the
   * auto-start cron and the room's realtime (ruled 2026-10-07, release prep). */
  kick: boolean;
}

/** Board #call-auto-start frames: AutoLobby (everyone), CommishBlocked (the
 * commissioner at risk / postponed), MemberPostponed. At risk is the
 * commissioner's business: members see the plain countdown. A commissioner
 * at risk with nothing fixable (only "couldn't judge") sees the countdown too. */
export function lobbyView(phase: LobbyPhase, isCommissioner: boolean, fixableCount: number): LobbyView {
  const none: LobbyView = { blockers: null, deadline: false, countdown: null, memberPostponed: false, noDate: false, order: true, kick: false };
  switch (phase) {
    case 'no_date':
      return { ...none, noDate: true };
    case 'scheduled':
      return { ...none, countdown: 'scheduled' };
    case 'at_risk':
      return isCommissioner && fixableCount > 0
        ? { ...none, blockers: 'risk', deadline: true }
        : { ...none, countdown: 'scheduled' };
    case 'room_open':
      return { ...none, countdown: 'room_open' };
    case 'starting':
      return { ...none, countdown: 'starting', kick: isCommissioner };
    case 'started':
      return { ...none, countdown: 'starting' }; // the League tab switches to the room on the next read
    case 'postponed':
      return isCommissioner ? { ...none, blockers: 'postponed', order: false } : { ...none, memberPostponed: true, order: false };
  }
}

/**
 * Whether the League tab paints the draft lobby's order card ("Draft order · waiting", or the order itself).
 * It follows the phase (lobbyView.order: false when postponed). While the status read has not answered there
 * is NO phase, and the card must not be guessed: it used to default to shown, so a postponed league painted
 * "Draft order · waiting" for about a second before the Postponed card replaced it (phone pass 1.3.0 (12),
 * 2026-11-10). Unknown paints nothing. A failed read is the exception: the "didn't load" card has its own
 * Try again, and the lobby under it is the last honest thing on the page.
 */
export function lobbyShowsOrder(view: Pick<LobbyView, 'order'> | null, statusFailed: boolean): boolean {
  return view ? view.order : statusFailed;
}

/**
 * Whether the draft status gives a phase to draw from: the read has answered, or a RE-read is loading over an
 * answered one (start_state still held), so a refresh keeps the last known phase and no card blinks out. Before the
 * first answer (a mount, a league switch: Home remounts per league) and after a failed read there is no phase.
 */
export function phaseKnown(ds: { status: 'idle' | 'loading' | 'ready' | 'error'; startState: StartState | null }): boolean {
  return ds.status === 'ready' || (ds.status === 'loading' && ds.startState !== null);
}

// ── Home's pre-draft card, from the same view ────────────────────────────

export interface HomeView {
  blockers: 'risk' | 'postponed' | null;
  countdown: 'scheduled' | 'room_open' | 'starting' | null;
  memberPostponed: boolean;
  noDate: boolean;
}

/** Home shows what the lobby shows (lobbyView), with one difference from the
 * board's commissioner Home (ReconfirmHome): at risk, the needs-you card sits
 * on top AND the draft card keeps its countdown below it (the lobby shows the
 * room-open deadline instead). Home never asks the server to start. */
export function homeView(phase: LobbyPhase, isCommissioner: boolean, fixableCount: number): HomeView {
  const lv = lobbyView(phase, isCommissioner, fixableCount);
  if (lv.blockers === 'risk') return { blockers: 'risk', countdown: 'scheduled', memberPostponed: false, noDate: false };
  return { blockers: lv.blockers, countdown: lv.countdown, memberPostponed: lv.memberPostponed, noDate: lv.noDate };
}

/**
 * Whether Home paints its draft card (the "Draft" / "Draft postponed" card above Members). Home's twin of
 * lobbyShowsOrder: it follows the view (the commissioner's postponed blockers card REPLACES it), and while the status
 * read has not answered there is NO view, so the card is not guessed. It used to default to shown, so switching to a
 * postponed league painted the plain pre-draft card ("Draft · 60-second picks · Build your queue") for about a second
 * before "Draft postponed" replaced it (phone pass step 24d, 1.3.0 (14), 2026-11-10). Unknown paints nothing. A failed
 * read is the exception: the card, on the league row's draft time, is the last honest thing Home has.
 */
export function homeShowsDraftCard(view: Pick<HomeView, 'blockers'> | null, statusFailed: boolean): boolean {
  return view ? view.blockers !== 'postponed' : statusFailed;
}

/** "You pick 4th" (the room-open push's words), from the revealed order. Null
 * when the order isn't set or the viewer isn't in it. */
export function yourPickLine(order: readonly string[] | null, myUserId: string, ordinal: (n: number) => string): string | null {
  if (!order) return null;
  const seat = order.indexOf(myUserId) + 1;
  return seat > 0 ? `You pick ${ordinal(seat)}` : null;
}
