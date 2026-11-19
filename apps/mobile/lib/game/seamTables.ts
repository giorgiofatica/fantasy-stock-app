/**
 * The capture seam's TABLE fixtures (3c), pure. Each game read from a table has a
 * fixture here, shaped as the query returns it. They return null when the seam is off,
 * so the real query stands. Derived from the board's sample league (Stock Scudetto,
 * week 6) so a capture shows the board's own numbers.
 */
import { draftRoomPicks, type DraftRoomVariant } from './seamRoom';
import { FIXTURE_USER_ID } from '../shell/fixtureIds';
import { FIXTURE_WEEK6_END, FIXTURE_WEEK6_START, GIANLUIGI_HOLDINGS, ROBERTO_HOLDINGS, ROBERTO_WEEKS, fixtureQty, type HoldingRow } from '../home/homeFixtureData';

/** "You" in the game seam's draft and league fixtures: the shell fixture's user, so
 * the room knows your seat (Roberto B., seat 2) and the transfer picker leaves you out. */
export const SEAM_ME = FIXTURE_USER_ID;

/** schedule.ts's nominal week start (Tuesday 14:30Z) of the next week, as finalize writes Week 1. */
export function nextNominalTuesday(nowMs: number): string {
  const d = new Date(nowMs);
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  let untilTue = (2 - d.getUTCDay() + 7) % 7;
  if (untilTue === 0) untilTue = 7;
  return new Date(day + untilTue * 86_400_000 + (14 * 60 + 30) * 60_000).toISOString();
}

export type SeamTableName = 'drafts' | 'draft_queue' | 'matchups_week' | 'matchups_week_one' | 'matchups_playoff' | 'week_snapshots' | 'trades' | 'league_members' | 'league_members_me' | 'matchups_season';

const WEEK = 6;
// Week 6 is the Home fixture's week (homeFixtureData.ts), so Matchup, All matchups and
// the final lineups all read the same game with the same numbers.
const WEEK_START = FIXTURE_WEEK6_START;
const WEEK_END = FIXTURE_WEEK6_END;

/** The league's managers, one roster for every game fixture: the Home fixture's
 * standings (useHomeLeague's fixtureHomeLeague: Paolo 1, you 2, Luca 3, Chiara 4,
 * Marco 5, Gianluigi 6), so every game and bracket name resolves. */
export const SEAM_LEAGUE = { me: SEAM_ME, paolo: 'paolo', luca: 'luca', chiara: 'chiara', marco: 'marco', gianluigi: 'gianluigi' } as const;
const { paolo, luca, chiara, marco, gianluigi } = SEAM_LEAGUE;

interface SeamHolding { symbol: string; quantity: number; start: number; live: number; close: number }

/** Your and Gianluigi's week-6 holdings ARE the Home fixture's (same shares, Monday
 * open, Thursday live, Friday close), so All matchups' score for your game is
 * Matchup's to the cent. The other four managers hold a small sample. */
const fromHome = (rows: HoldingRow[]): SeamHolding[] => rows.map((h) => ({ symbol: h.symbol, quantity: fixtureQty(h), start: h.mon, live: h.thu, close: h.fri }));
const HOLDINGS: Record<string, SeamHolding[]> = {
  [SEAM_ME]: fromHome(ROBERTO_HOLDINGS),
  [gianluigi]: fromHome(GIANLUIGI_HOLDINGS),
  [paolo]: [{ symbol: 'MSFT', quantity: 4.2, start: 410.0, live: 421.0, close: 424.6 }, { symbol: 'META', quantity: 3.1, start: 512.0, live: 508.0, close: 503.2 }],
  [luca]: [{ symbol: 'AVGO', quantity: 5.5, start: 180.0, live: 184.5, close: 186.2 }],
  [chiara]: [{ symbol: 'GOOGL', quantity: 6.0, start: 170.0, live: 166.0, close: 167.4 }],
  [marco]: [{ symbol: 'AMD', quantity: 7.5, start: 158.0, live: 160.0, close: 155.3 }],
};

/** The ranking through LAST week (league_standings_ranked(p_league_id, p_through_week)),
 * for the League tab's movement arrows: the order before week 6 was scored. Against
 * the Home fixture's current standings, Paolo and Luca moved up one, you and Chiara
 * down one, and Marco and Gianluigi held (so up, down and held all show). */
export function seamPreviousRanks(): { user_id: string; rank: number }[] {
  return [SEAM_ME, paolo, chiara, luca, marco, gianluigi].map((user_id, i) => ({ user_id, rank: i + 1 }));
}

/** Each held symbol's live (Thursday) price, for the seam's quote fixture. */
export function seamLivePrices(): Record<string, number> {
  return Object.fromEntries(Object.values(HOLDINGS).flat().map((h) => [h.symbol, h.live]));
}

/** Is week 6 over in this Home fixture? The same states useHomeLeague's fixtureHomeLeague
 * scores week 6 in (`isScored`: 'scored', and every state after the regular season), so
 * Matchup, All matchups and the final lineups agree on whether the week has closed. */
export function seamWeekClosed(homeFixture: string | null | undefined): boolean {
  return ['scored', 'complete', 'complete_runner_up', 'playoff_live', 'playoff_bye', 'playoff_pending', 'eliminated', 'missed_playoffs'].includes(homeFixture ?? '');
}

/** Under SCORED_OUTCOME=lost, your week is mirrored: each Friday close = 2 × Monday open −
 * Friday close, so your total is exactly minus your won total and the rows still add up. */
export function closeFor(user: string, h: SeamHolding, lost: boolean): number {
  return lost && user === SEAM_ME ? Math.round((2 * h.start - h.close) * 100) / 100 : h.close;
}

/** A team's week-6 gain at Friday's close, to the cent: the Home fixture's own formula
 * (week6Gains: shares × (Friday close − Monday open)), so it matches the posted gain. */
function closedGain(user: string, lost = false): number {
  return Math.round((HOLDINGS[user] ?? []).reduce((s, h) => s + h.quantity * (closeFor(user, h, lost) - h.start), 0) * 100) / 100;
}

function snapshotRows(weekClosed: boolean, lost = false) {
  return Object.entries(HOLDINGS).flatMap(([user, rows]) =>
    rows.map((h) => ({ user_id: user, symbol: h.symbol, quantity: h.quantity, week_start_price: h.start, week_end_price: weekClosed ? closeFor(user, h, lost) : null, entered_mid_week: false, created_at: WEEK_START })),
  );
}

function weekMatchups(weekClosed: boolean, bye = false, lost = false) {
  const game = (team1: string, team2: string) => {
    if (!weekClosed) return { team1_user_id: team1, team2_user_id: team2, team1_gain: null, team2_gain: null, winner_user_id: null, is_tie: false, is_playoff: false, week_start: WEEK_START, week_end: WEEK_END, week_number: WEEK };
    const g1 = closedGain(team1, lost);
    const g2 = closedGain(team2, lost);
    return { team1_user_id: team1, team2_user_id: team2, team1_gain: g1, team2_gain: g2, winner_user_id: g1 === g2 ? null : g1 > g2 ? team1 : team2, is_tie: g1 === g2, is_playoff: false, week_start: WEEK_START, week_end: WEEK_END, week_number: WEEK };
  };
  if (bye) {
    // The bye fixture: you sit the week out (Home's 'bye' has no opponent for you), so does
    // Gianluigi, and All matchups lists each bye as its own row (team2 null).
    const sit = (team: string) => ({ ...game(team, team), team2_user_id: null, team2_gain: null, winner_user_id: null });
    return [game(paolo, luca), game(chiara, marco), sit(SEAM_ME), sit(gianluigi)];
  }
  return [game(SEAM_ME, gianluigi), game(paolo, luca), game(chiara, marco)];
}

/** A finished 6-team bracket (playoff_teams 6: seeds 1-2 bye, then Wild card,
 * Semifinals, Final), seeded from the same standings. You win it, as in Home's
 * 'complete' fixture: Luca and Chiara win the wild cards; Paolo (1) beats Chiara
 * (4) and you (2) beat Luca (3); you beat Paolo in the Final. */
function playoffMatchups(live = false) {
  const game = (round: number, position: number, t1: string, t2: string, g1: number, g2: number) =>
    ({ playoff_round_number: round, bracket_position: position, team1_user_id: t1, team2_user_id: t2, team1_gain: g1, team2_gain: g2, winner_user_id: g1 > g2 ? t1 : t2 });
  // In progress (EXPO_PUBLIC_LEAGUE_FIXTURE=playoffs_live): the Semifinals are this week, unscored.
  const pending = (round: number, position: number, t1: string, t2: string) =>
    ({ playoff_round_number: round, bracket_position: position, team1_user_id: t1, team2_user_id: t2, team1_gain: null, team2_gain: null, winner_user_id: null });
  if (live) {
    return [
      game(1, 0, luca, gianluigi, 142.6, 88.15),
      game(1, 1, chiara, marco, 61.4, -12.9),
      pending(2, 0, paolo, chiara),
      pending(2, 1, SEAM_ME, luca),
    ];
  }
  return [
    game(1, 0, luca, gianluigi, 142.6, 88.15),
    game(1, 1, chiara, marco, 61.4, -12.9),
    game(2, 0, paolo, chiara, 203.75, 118.2),
    game(2, 1, SEAM_ME, luca, 288.1, 96.42),
    game(3, 0, SEAM_ME, paolo, 176.3, 120.55),
  ];
}

/** EXPO_PUBLIC_RECAP_FIXTURE (the Matchup recap's captures): how your finished season went.
 * 'champion' (default) = Home's 'complete' bracket; 'semis' = out in the Semifinals; 'missed' =
 * no playoff game; 'tie_bye' = the champion's season with a tied week 3 and a bye in week 2;
 * 'unposted' = the champion's season with week 1's games never posted (gains null). */
export type RecapFixture = 'champion' | 'semis' | 'missed' | 'tie_bye' | 'unposted';
export function parseRecapFixture(v: string | undefined): RecapFixture {
  return v === 'semis' || v === 'missed' || v === 'tie_bye' || v === 'unposted' ? v : 'champion';
}

/** The fixture league's regular season (the shell's finished league, fx-summer: num_weeks 14). */
const SEASON_WEEKS = 14;

/** The whole finished season, league-wide (useSeasonRecap's one read), for Home's 'complete'
 * fixture in the shell's finished league (num_weeks 14, playoff_teams 6): 14 regular weeks,
 * then a 6-team bracket in weeks 15-17 (Wild card, Semifinals, Final; seeds 1-2 bye). Your
 * weeks 1-5 are Home's ROBERTO_WEEKS against Gianluigi and week 6 is weekMatchups' closed
 * week; every game you play in week 6 and in the playoffs is scored from the snapshot
 * fixture's closes (closedGain), so its detail's rows reconcile. Other weeks' details show
 * the withheld look (the snapshot fixture is week 6's). */
export function seasonMatchups(variant: RecapFixture) {
  const day = 24 * 3600 * 1000;
  const weekWindow = (week: number) => {
    const monday = new Date(Date.parse(WEEK_START) + (week - WEEK) * 7 * day);
    return { week_start: monday.toISOString(), week_end: new Date(monday.getTime() + 4 * day + 6.5 * 3600 * 1000).toISOString() };
  };
  const row = (week: number, t1: string, t2: string | null, g1: number | null, g2: number | null, isPlayoff = false) => ({
    week_number: week, team1_user_id: t1, team2_user_id: t2, team1_gain: g1, team2_gain: g2,
    winner_user_id: g1 === null || t2 === null || g2 === null || g1 === g2 ? null : g1 > g2 ? t1 : t2,
    is_tie: g1 !== null && g2 !== null && t2 !== null && g1 === g2, is_playoff: isPlayoff, ...weekWindow(week),
  });
  const c = (n: number) => Math.round(n * 100) / 100;
  // The Final is scored from the snapshot fixture's closes, so its detail's rows reconcile.
  const scored = (week: number, t1: string, t2: string) => row(week, t1, t2, closedGain(t1), closedGain(t2), week > SEASON_WEEKS);
  // Your opponent each week (Gianluigi through week 6, as Home's fixture), the other four paired in turn.
  const others = [paolo, luca, chiara, marco, gianluigi];
  const regular = Array.from({ length: SEASON_WEEKS }, (_, i) => i + 1).flatMap((w) => {
    if (w === WEEK) return weekMatchups(true).map((m) => ({ ...m, week_number: WEEK }));
    const opp = w <= WEEK ? gianluigi : others[(w - 7) % others.length];
    const rest = others.filter((o) => o !== opp);
    const mine = ROBERTO_WEEKS[(w - 1) % ROBERTO_WEEKS.length].gain;
    const theirs = c(-mine * 0.6 + w);
    const you = variant === 'tie_bye' && w === 2
      ? [row(w, SEAM_ME, null, mine, null), row(w, opp, null, theirs, null)]
      : variant === 'tie_bye' && w === 3
        ? [row(w, SEAM_ME, opp, mine, mine)]
        : [row(w, SEAM_ME, opp, mine, theirs)];
    const restGames = [rest.slice(0, 2), rest.slice(2, 4)];
    return [...you, ...restGames.map(([x, y], k) => row(w, x, y, c(40 + w * 3 - k * 17), c(12 - w + k * 9)))];
  });
  const WC = SEASON_WEEKS + 1;
  const SF = SEASON_WEEKS + 2;
  const F = SEASON_WEEKS + 3;
  const wildCard = [row(WC, luca, gianluigi, 142.6, 88.15, true), row(WC, chiara, marco, 61.4, -12.9, true)];
  const playoffs = variant === 'missed'
    ? [...wildCard, row(SF, paolo, chiara, 203.75, 118.2, true), row(SF, luca, marco, 96.42, 12.3, true), row(F, paolo, luca, 120.55, 98.1, true)]
    : variant === 'semis'
      ? [...wildCard, row(SF, paolo, chiara, 203.75, 118.2, true), row(SF, SEAM_ME, luca, closedGain(SEAM_ME), c(closedGain(SEAM_ME) + 50), true), row(F, paolo, luca, 120.55, 98.1, true)]
      : [...wildCard, row(SF, paolo, chiara, 203.75, 118.2, true), row(SF, SEAM_ME, luca, 288.1, 96.42, true), scored(F, SEAM_ME, paolo)];
  const season = [...regular, ...playoffs];
  // A week that never posted: no gains, no winner (the recap's dash, nothing to open).
  return variant === 'unposted'
    ? season.map((m) => (m.week_number === 1 ? { ...m, team1_gain: null, team2_gain: null, winner_user_id: null, is_tie: false } : m))
    : season;
}

/** The fixture rows for a table read, or null when the seam is off (the real query stands). */
export function seamTableRows(on: boolean, table: SeamTableName, roomVariant: DraftRoomVariant = 'on_clock', opts: { weekClosed?: boolean; bye?: boolean; lost?: boolean; playoffsLive?: boolean; queueRow?: boolean; recap?: RecapFixture } = {}): unknown[] | null {
  if (!on) return null;
  switch (table) {
    case 'drafts':
      // The board's draft, as far as EXPO_PUBLIC_DRAFT_ROOM_FIXTURE says (seamRoom.ts).
      return draftRoomPicks(roomVariant);
    case 'draft_queue':
      // EXPO_PUBLIC_QUEUE_FIXTURE=row (the queue row's captures, 2026-11-05): a long company name, a 4- and a 5-letter
      // ticker, BRK.B, and RKLB, whose price does not load. The default stays AAPL, CRM, V.
      if (opts.queueRow) return ['NVDA', 'MSFT', 'COST', 'BRK.B', 'SBUX', 'RKLB'].map((symbol, i) => ({ symbol, position: i + 1 }));
      return [
        { symbol: 'AAPL', position: 1 },
        { symbol: 'CRM', position: 2 },
        { symbol: 'V', position: 3 },
      ];
    case 'matchups_week': return weekMatchups(opts.weekClosed === true, opts.bye === true, opts.lost === true);
    // The transfer picker's current members (the draft fixture's names; Roberto is you).
    // Your own row, for a leave's re-read: still a member (the capture of "You're still in …").
    case 'league_members_me': return [{ hidden_at: null }];
    case 'league_members': return ['paolo', SEAM_ME, 'alessandro', 'francesco', 'gianluigi', 'andrea'].map((user_id) => ({ user_id }));
    // The draft's ending (U-10): Week 1 as finalize writes it (nominal Tuesday 14:30Z;
    // the room resolves it to Monday's open through the market calendar).
    case 'matchups_week_one': return [
      { team1_user_id: SEAM_ME, team2_user_id: 'gianluigi', week_start: nextNominalTuesday(Date.now()) },
    ];
    case 'matchups_playoff': return playoffMatchups(opts.playoffsLive === true);
    case 'matchups_season': return seasonMatchups(opts.recap ?? 'champion');
    case 'week_snapshots': return snapshotRows(opts.weekClosed === true, opts.lost === true);
    case 'trades': return [];
  }
}
