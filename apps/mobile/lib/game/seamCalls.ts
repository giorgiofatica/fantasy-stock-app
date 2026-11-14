/**
 * The game screens' calls, through the capture seam (3c). With the seam off these
 * are exactly the real calls (supabase.rpc, functions.invoke, a leagues update).
 * With the seam on (dev build and EXPO_PUBLIC_GAME_SEAM=1), a call with a fixture
 * returns the fixture and makes NO real call. A call with no fixture is real.
 */
import { supabase } from '../supabase';
import { CAPTURE_CONFIRM_REFUSAL, DELETED_SEAT_FIXTURE, SEAM_ON, captureFailsOnce } from './devSeam';
import { fixtureFor, invokeFixtureFor } from './seamFixtures';
import { seamTableRows, seamWeekClosed, type SeamTableName } from './seamTables';
import { markFixtureRenewed } from '../shell/devFixture';
import { markFixtureAnswer } from './renewalFixture';
import { draftRoomClockRead, parseDraftRoomVariant, roomVariantAfterAutoPick } from './seamRoom';
import { FIXTURE_TAKEOVER_CODE, parseTakeoverFixture, seatify, takeoverFixtureFor, takeoverInviteFixture } from './seamAccountDeletion';
import { pendingTakeover } from '../invite/pendingTakeoverStore';

/** DEV captures (account deletion): the seat reads as the label (EXPO_PUBLIC_DELETED_SEAT=1) and the takeover answers (EXPO_PUBLIC_TAKEOVER_FIXTURE). Seam only. */
const DELETED_SEAT = DELETED_SEAT_FIXTURE;
const TAKEOVER_FIXTURE = SEAM_ON ? parseTakeoverFixture(process.env.EXPO_PUBLIC_TAKEOVER_FIXTURE) : null;
// The knob raises the REAL pending-takeover store once per launch; the root layout then opens the real landing.
// The shared https link previews by itself; only 'tap' captures the SCHEME origin (a link that waits for the person's tap).
if (TAKEOVER_FIXTURE) pendingTakeover.capture(FIXTURE_TAKEOVER_CODE, TAKEOVER_FIXTURE === 'tap' ? 'scheme' : 'https');

/** EXPO_PUBLIC_DRAFT_ROOM_FIXTURE: how far the board's draft has gone (seamRoom.ts).
 * 'turn_arrives' moves on once, when the room's auto-pick backstop reaches the seam. */
const DRAFT_ROOM_FIXTURE = SEAM_ON ? process.env.EXPO_PUBLIC_DRAFT_ROOM_FIXTURE : undefined;
let roomVariant = parseDraftRoomVariant(DRAFT_ROOM_FIXTURE);

/** The other capture knobs the seam's fixtures read. Seam only: a release build never consults the env. */
const DRAFT_START_FIXTURE = SEAM_ON ? process.env.EXPO_PUBLIC_DRAFT_START_FIXTURE : undefined;
const LEAVE_FIXTURE = SEAM_ON ? process.env.EXPO_PUBLIC_LEAVE_FIXTURE : undefined;
const HOME_FIXTURE_KNOB = SEAM_ON ? process.env.EXPO_PUBLIC_HOME_FIXTURE : undefined;
const SCORED_OUTCOME_KNOB = SEAM_ON ? process.env.EXPO_PUBLIC_SCORED_OUTCOME : undefined;
const LEAGUE_FIXTURE_KNOB = SEAM_ON ? process.env.EXPO_PUBLIC_LEAGUE_FIXTURE : undefined;
const QUEUE_FIXTURE = SEAM_ON ? process.env.EXPO_PUBLIC_QUEUE_FIXTURE : undefined;
import { saveLeagueSlots, type SlotDraft } from '../categoryData';

/** The error a read answers with when EXPO_PUBLIC_CAPTURE_FAIL_ONCE names it (its first call only). */
const FAIL_ONCE_ERROR = { message: 'fixture: this read fails once (EXPO_PUBLIC_CAPTURE_FAIL_ONCE)', details: '', hint: '', code: 'FIXTURE', name: 'PostgrestError' };

/** The queue the seam's set_draft_queue last "stored", read back by the next draft_queue read (seam only). Without it
 * the fixture read answered the same three stocks after every save, so a queue that saves as you go snapped back to
 * them on the re-read that follows each save (lib/game/queueAutosave.ts). */
let seamStoredQueue: string[] | null = null;

export async function seamRpc(name: string, args: Record<string, unknown>) {
  if (SEAM_ON) {
    if (captureFailsOnce(name)) return { data: null, error: FAIL_ONCE_ERROR, count: null, status: 500, statusText: 'fixture' };
    // DRAFT_ROOM_FIXTURE=loading: the room's clock read never answers, so its skeleton stays up for the capture.
    if (name === 'get_draft_clock' && draftRoomClockRead(roomVariant) === 'pending') return new Promise<never>(() => {});
    if (name === 'create_takeover_invite') return takeoverInviteFixture();
    const f = fixtureFor(name, args, roomVariant, DRAFT_START_FIXTURE);
    // A renewal adds Season 2 to the fixture league list, as the real list would.
    if (f && name === 'renew_league') markFixtureRenewed();
    // An answer moves the fixture roster's caller, as the real roster would.
    if (f && name === 'respond_to_renewal') markFixtureAnswer(args.p_response);
    if (f && name === 'set_draft_queue') seamStoredQueue = Array.isArray(args.p_symbols) ? (args.p_symbols as string[]).slice() : [];
    if (f) return seatify(f, DELETED_SEAT);
  }
  return supabase.rpc(name, args);
}

export async function seamInvoke(fn: string, opts: { body: Record<string, unknown> }) {
  if (SEAM_ON) {
    if (fn === 'validate-and-record-pick' && opts.body.action === 'auto_pick') roomVariant = roomVariantAfterAutoPick(roomVariant);
    if (fn === 'join-league') {
      const t = takeoverFixtureFor(opts.body, TAKEOVER_FIXTURE);
      if (t) return t as { data: unknown; error: null };
    }
    const f = invokeFixtureFor(fn, opts.body, DRAFT_START_FIXTURE, LEAVE_FIXTURE, CAPTURE_CONFIRM_REFUSAL);
    if (f) return seatify(f, DELETED_SEAT);
  }
  return supabase.functions.invoke(fn, opts);
}

/** A league update (League settings, the playoff-teams stepper). It selects the
 * updated row's id, so the caller can tell a real write from a 0-row no-op (an
 * update that matches nothing resolves with no error: check it with
 * updatedOneRow). With the seam on it "updates" the one fixture row and writes nothing. */
export async function seamUpdateLeague(id: string, patch: Record<string, unknown>) {
  if (SEAM_ON) return { data: [{ id }], error: null };
  return supabase.from('leagues').update(patch).eq('id', id).select('id');
}

/** A table read through the seam: the fixture rows when the seam is on, else the real query. */
export async function seamTable<T>(
  name: SeamTableName,
  real: () => PromiseLike<{ data: T[] | null; error: unknown; count?: number | null }>,
): Promise<{ data: T[] | null; error: unknown; count?: number | null }> {
  // Week 6 closes in the Home fixtures that score it (EXPO_PUBLIC_HOME_FIXTURE=scored, …).
  if (SEAM_ON && captureFailsOnce(name)) return { data: null, error: FAIL_ONCE_ERROR, count: null };
  if (SEAM_ON && name === 'draft_queue' && seamStoredQueue) {
    const stored = seamStoredQueue.map((symbol, i) => ({ symbol, position: i + 1 }));
    return { data: stored as T[], error: null, count: stored.length };
  }
  const rows = seamTableRows(SEAM_ON, name, roomVariant, {
    weekClosed: seamWeekClosed(HOME_FIXTURE_KNOB),
    bye: HOME_FIXTURE_KNOB === 'bye',
    lost: HOME_FIXTURE_KNOB === 'scored' && SCORED_OUTCOME_KNOB === 'lost',
    // The League fixture's playoffs in progress: the Wild card scored, the Semifinals not yet.
    playoffsLive: LEAGUE_FIXTURE_KNOB === 'playoffs_live',
    // The queue row's captures: the board's queue instead of AAPL, CRM, V.
    queueRow: QUEUE_FIXTURE === 'row',
  });
  if (rows) return { data: seatify(rows, DELETED_SEAT) as T[], error: null, count: rows.length };
  return real();
}

/** Stand-in id for the league a fixture create returns. The seam never writes it anywhere. */
const SEAM_NEW_LEAGUE_ID = 'fixture-new-league';

/** The create-league insert. With the seam on it returns a fixture league and writes nothing. */
export async function seamInsertLeague(row: Record<string, unknown>) {
  if (SEAM_ON) {
    return { data: { ...row, id: SEAM_NEW_LEAGUE_ID }, error: null } as { data: Record<string, unknown> & { id: string }; error: null };
  }
  return supabase.from('leagues').insert(row).select().single();
}

/** The commissioner's membership row. With the seam on it succeeds and writes nothing. */
export async function seamInsertMember(row: Record<string, unknown>) {
  if (SEAM_ON) return { error: null };
  return supabase.from('league_members').insert(row);
}

/** Replace a league's slots. With the seam on it succeeds and writes nothing. */
export async function seamSaveLeagueSlots(leagueId: string, slots: SlotDraft[]): Promise<void> {
  if (SEAM_ON) return;
  return saveLeagueSlots(leagueId, slots);
}
