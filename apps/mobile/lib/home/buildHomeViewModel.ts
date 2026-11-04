/**
 * buildHomeViewModel: the ONE pure function that turns get_home_summary +
 * get_home_league + quotes + bars into everything Home's components
 * render. All decisions route through the Phase 3b-2 pure modules
 * (homePhase, liveWeekScore, todayChange, teamValue,
 * seasonGain) — this module's only job is wiring their inputs from the
 * RPC shapes, never re-deciding anything itself. Pure and hermetic, so
 * it's the one place an "honesty check" (the strip's results = the matchups,
 * the hero's season gain = the scored weeks) can be asserted as a test, not
 * just eyeballed in production.
 *
 * The `useHomeLeague` hook (React/Supabase — not unit-testable) is a thin
 * shell around this: fetch summary + get_home_league + quote + bars (or
 * the dev fixture), then call this function.
 */

import { homePhase, type HomePhaseInput, type MatchupRow, type PhaseResult, type MarketInfo } from './homePhase';
import { liveWeekScore, type LiveSnapshot, type LiveTrade } from './liveWeekScore';
import { todayChange, type TodayPosition } from './todayChange';
import { teamValue, type StakeMode } from './teamValue';
import { seasonGain } from './seasonGain';
import { resolveWeekWindow, lastSessionCloseBefore, type MarketCalendarSession } from '../time/marketWeek';
import { etDateParts } from '../time/etParts';
import { buildSeasonTiles, type SeasonTile } from './yourSeason';
import { serverVerdict, weekResult, type WeekResult } from '../game/weekResult';

export interface HomeLedgerRow {
  symbol: string;
  entry_price?: number;
  action?: 'buy' | 'sell';
  quantity: number;
  price?: number;
  week_start_price?: number;
  entered_mid_week?: boolean;
  created_at: string;
}

export interface GetHomeLeagueResult {
  my_ledger: { drafts: HomeLedgerRow[]; trades: HomeLedgerRow[] };
  current_week: {
    week_number: number;
    my_snapshots: HomeLedgerRow[];
    my_trades: HomeLedgerRow[];
    opponent_snapshots: HomeLedgerRow[];
    opponent_trades: HomeLedgerRow[];
  };
  matchups: {
    week_number: number; week_start: string; week_end: string; is_playoff: boolean;
    team1_user_id: string | null; team2_user_id: string | null;
    team1_gain: number | null; team2_gain: number | null;
    /** The server's result (process-week-results), from 20261126000000. Absent on an older
     * RPC, when every result falls back to dollars (lib/game/weekResult). */
    winner_user_id?: string | null; is_tie?: boolean | null;
  }[];
  standings: {
    user_id: string; rank: number; wins: number; losses: number; ties: number;
    points_for: number; display_name: string; is_bot: boolean;
  }[];
}

export interface HomeLeagueMeta {
  myUserId: string;
  draftStatus: 'not_started' | 'in_progress' | 'completed';
  leagueStartDate: string | null;
  seasonStatus: 'active' | 'playoffs' | 'completed';
  currentWeek: number;
  numWeeks: number | null;
  playoffTeams: number | null;
  stakeMode: StakeMode;
  notionalPerSlot: number | null;
  numRounds: number | null;
  draftOrderWaiting: boolean;
}

export interface BarsBySymbol {
  [symbol: string]: { date: string; close: number }[];
}

export interface HomeViewModelInput {
  now: Date;
  meta: HomeLeagueMeta;
  market: MarketInfo;
  data: GetHomeLeagueResult;
  quote: (symbol: string) => number | null;
  /** Ascending, per symbol — used for the live week's chart granularity
   * and for `prevClose` (the last close strictly before `now`'s date). */
  bars: BarsBySymbol;
  playoffRoundLabelForWeek: (week: number | null | undefined, numWeeks: number | null | undefined, playoffTeams: number | null | undefined) => string | null;
  /** public.market_calendar rows (any range covering the matchup weeks in
   * `data.matchups`) — B1's real session bounds, see matchupRowFor's doc.
   * An empty array is safe (every row falls back to its nominal
   * timestamp), never a crash. */
  marketCalendar: MarketCalendarSession[];
}

export interface HeroViewModel {
  value: number;
  seasonGainDollars: number;
  seasonGainPct: number;
  today: number | null;
  unpricedValue: string[];
  unpricedToday: string[];
  cashWentNegative: boolean;
}

export interface ThisWeekViewModel {
  you: { gain: number; pct: number; unpriced: string[] };
  opponent: { gain: number; pct: number; unpriced: string[] };
  /** True once BOTH sides' matchups gains are posted — the scores shown
   * are then the authoritative scored values, not a live recompute
   * (which could disagree with the official number by a stale quote). */
  final: boolean;
  /** Null while live (no result yet — never re-derive "who's ahead" as
   * "who won"); W / L / T once `final`, from the one decider (lib/game/weekResult). */
  result: WeekResult | null;
  /** The opponent's user id for THIS card's week — which may be the
   * previous week during the Fri-close -> next-open grace period (see
   * `relevantWeek` below), so the caller must not assume it always
   * matches get_home_summary's CURRENT-week opponent. */
  opponentUserId: string | null;
}

export interface WeeklyResult {
  week: number;
  gain: number;
  /** 'BYE' for a regular-season bye (no opponent: never a win or a loss). */
  result: 'W' | 'L' | 'T' | 'BYE';
}

export interface HomeViewModel {
  phase: PhaseResult;
  hero: HeroViewModel | null;
  thisWeek: ThisWeekViewModel | null;
  standings: GetHomeLeagueResult['standings'];
  /** So a caller (index.tsx) can mark which standings row is "you" without
   * re-deriving the caller's id from elsewhere. */
  myUserId: string;
  /** The ONE list of a week's W / L / T / bye for me, each from lib/game/weekResult (the
   * server's winner, else dollars; never re-derived from two gains elsewhere: a tie is a T). Every week with a row for me whose result is decided:
   * a regular-season row with nobody across is a bye; a row with an opponent counts only
   * once BOTH gains are posted. A half-posted week is absent here, so the strip shows it
   * as "not scored yet", never a Bye, a W or an L. */
  weeklyResults: WeeklyResult[];
  /** Home's "Your season" strip: one tile per week that has a row for me (lib/home/yourSeason). */
  seasonTiles: SeasonTile[];
}

/** A SKIP sentinel draft row (forfeited pick: symbol 'SKIP', 0 qty) is not
 * a holding — same convention as the server's SKIP_SYMBOL
 * (supabase/functions/_shared/draft-validation.ts), mirrored here since
 * that file is Deno-only and unreachable from the RN bundle. */
const SKIP_SYMBOL = 'SKIP';

function toLedger(rows: HomeLedgerRow[]): { symbol: string; entryPrice: number; quantity: number }[] {
  return rows
    .filter((r) => r.symbol?.toUpperCase() !== SKIP_SYMBOL)
    .map((r) => ({ symbol: r.symbol, entryPrice: r.entry_price ?? 0, quantity: r.quantity }));
}
function toTrades(rows: HomeLedgerRow[]): { symbol: string; action: 'buy' | 'sell'; quantity: number; price: number }[] {
  return rows.map((r) => ({ symbol: r.symbol, action: r.action!, quantity: r.quantity, price: r.price ?? 0 }));
}
export function toLiveTrades(rows: HomeLedgerRow[]): LiveTrade[] {
  return rows.map((r) => ({ symbol: r.symbol, action: r.action!, quantity: r.quantity, price: r.price ?? 0, createdAt: new Date(r.created_at) }));
}
export function toLiveSnapshots(rows: HomeLedgerRow[]): LiveSnapshot[] {
  return rows.map((r) => ({ symbol: r.symbol, quantity: r.quantity, weekStartPrice: r.week_start_price ?? 0, enteredMidWeek: !!r.entered_mid_week }));
}

function rawMatchupFor(data: GetHomeLeagueResult, week: number): GetHomeLeagueResult['matchups'][number] | null {
  return data.matchups.find((row) => row.week_number === week) ?? null;
}

/**
 * B1 (Design Lead, 2026-09-30): `m.week_start`/`m.week_end` are schedule.ts's
 * fixed-UTC, nominal-Tuesday-to-Friday timestamps -- never the real
 * Monday-open/Friday-close a person sees (wrong by an hour every summer,
 * wrong by a full trading day every Monday). `m.week_end`'s own ET
 * calendar date still reliably identifies WHICH real week this is (see
 * marketWeek.ts's doc), so `resolveWeekWindow` looks up that week's actual
 * session bounds from the market calendar and this is the one place a raw
 * matchups row becomes a MatchupRow -- homePhase.ts and homeCopy.ts never
 * see the nominal timestamps at all, and neither needs to know this
 * lookup happened. Falls back to the nominal values when the calendar has
 * no coverage for that week (never a fabricated guess), matching
 * market_session_status's own "unknown, not invented" discipline.
 */
function matchupRowFor(data: GetHomeLeagueResult, meta: HomeLeagueMeta, week: number, marketCalendar: MarketCalendarSession[]): MatchupRow | null {
  const m = rawMatchupFor(data, week);
  if (!m) return null;
  const isMe1 = m.team1_user_id === meta.myUserId;
  const myGain = isMe1 ? m.team1_gain : m.team2_gain;
  const oppGain = isMe1 ? m.team2_gain : m.team1_gain;
  const hasOpponent = isMe1 ? !!m.team2_user_id : !!m.team1_user_id;
  const resolved = resolveWeekWindow(m.week_end, marketCalendar);
  return {
    week: m.week_number,
    weekStart: resolved?.weekStart ?? m.week_start,
    weekEnd: resolved?.weekEnd ?? m.week_end,
    isPlayoff: m.is_playoff,
    myGain, opponentGain: oppGain, hasOpponent,
    verdict: serverVerdict(m, meta.myUserId),
  };
}

/** The opponent's raw user id for `week`, or null (no row, or a bye). */
function opponentUserIdFor(data: GetHomeLeagueResult, meta: HomeLeagueMeta, week: number): string | null {
  const m = rawMatchupFor(data, week);
  if (!m) return null;
  const isMe1 = m.team1_user_id === meta.myUserId;
  return isMe1 ? m.team2_user_id : m.team1_user_id;
}

/** Every playoff row that names me, ascending by week. */
function myPlayoffRows(data: GetHomeLeagueResult, meta: HomeLeagueMeta) {
  return data.matchups
    .filter((m) => m.is_playoff && (m.team1_user_id === meta.myUserId || m.team2_user_id === meta.myUserId))
    .sort((a, b) => a.week_number - b.week_number);
}

/** Derives homePhase's playoff-classification facts from the RPC's own
 * `matchups` array — found missing in code review (2026-09-29): these
 * were hardcoded false in useHomeLeague, so every bye/eliminated/missed-
 * playoffs team read as "before the season" instead. Computed here, from
 * data the RPC already returns, rather than a new fetch.
 *
 * Real week numbers, not arithmetic (Design Lead ruling, 2026-09-30):
 * homePhase used to guess the bye/eliminated round's week as
 * `current?.week ?? previous?.week + 1`, which is real week arithmetic
 * this module has no business inventing (playoff weeks can skip numbers,
 * rounds vary in length). `laterPlayoffWeek`/`lastPlayoffWeek` are the
 * REAL week_number of the row that answers the question, read straight
 * from `matchups`, so the round name is looked up correctly. */
function playoffStatusFlags(data: GetHomeLeagueResult, meta: HomeLeagueMeta): {
  laterPlayoffWeek: number | null;
  lastPlayoffLoss: boolean;
  lastPlayoffWeek: number | null;
} {
  const rows = myPlayoffRows(data, meta);
  const laterRow = rows.find((m) => m.week_number > meta.currentWeek);
  if (laterRow) return { laterPlayoffWeek: laterRow.week_number, lastPlayoffLoss: false, lastPlayoffWeek: null };
  const lastScored = [...rows].reverse().find((m) => {
    const isMe1 = m.team1_user_id === meta.myUserId;
    const myGain = isMe1 ? m.team1_gain : m.team2_gain;
    return myGain !== null;
  });
  if (!lastScored) return { laterPlayoffWeek: null, lastPlayoffLoss: false, lastPlayoffWeek: null };
  const isMe1 = lastScored.team1_user_id === meta.myUserId;
  const myGain = isMe1 ? lastScored.team1_gain : lastScored.team2_gain;
  const oppGain = isMe1 ? lastScored.team2_gain : lastScored.team1_gain;
  // A playoff loss is the server's (a seed tiebreak loses on equal gains), never `<` on the gains.
  const lastPlayoffLoss = weekResult({ myGain, oppGain, verdict: serverVerdict(lastScored, meta.myUserId) }) === 'L';
  return { laterPlayoffWeek: null, lastPlayoffLoss, lastPlayoffWeek: lastPlayoffLoss ? lastScored.week_number : null };
}

function dateOnly(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** The calendar date in America/New_York for `date` — "today" for the
 * hero's "+$Z today" segment must be the MARKET's day, not UTC's. Found
 * in code review (2026-09-29): after 20:00 ET (00:00 UTC), the old
 * UTC-based `dateOnly` rolled "today" over a day early, so a real
 * same-day trade or gain read as "yesterday" and today showed $0.
 *
 * Orchestrator ask (2026-09-30): routed through etDateParts (validated,
 * never a silent 0/empty formatToParts fallback). Falls back to the
 * UTC-based `dateOnly` only if the runtime's Intl genuinely can't supply
 * year/month/day -- an honest, if imprecise, degraded answer rather than
 * a crash; this is the same near-midnight-ET risk the function's own
 * history already documents, not a new one. */
function etDateOnly(date: Date): string {
  const p = etDateParts(date);
  if (!p) return dateOnly(date.toISOString());
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Yesterday's close for `symbol`: the latest bar strictly before `now`'s
 * ET calendar date (see etDateOnly's doc — the market's day, not UTC's). */
function prevCloseFor(bars: BarsBySymbol, symbol: string, now: Date): number | null {
  const today = etDateOnly(now);
  const series = bars[symbol];
  if (!series) return null;
  const before = series.filter((b) => b.date < today);
  if (before.length === 0) return null;
  return before[before.length - 1].close;
}

export function buildHomeViewModel(input: HomeViewModelInput): HomeViewModel {
  const { now, meta, market, data, quote, bars, marketCalendar } = input;

  const current = matchupRowFor(data, meta, meta.currentWeek, marketCalendar);
  const previous = matchupRowFor(data, meta, meta.currentWeek - 1, marketCalendar);
  // S2 (Design Lead, 2026-09-30): read straight from the schedule, not
  // from the current/previous grace-period swap -- see homePhase.ts's own
  // doc on this field for why a bye needs it read this way.
  const nextWeekStart = matchupRowFor(data, meta, meta.currentWeek + 1, marketCalendar)?.weekStart ?? null;
  // R2 (Design Lead, 2026-09-30): the actual last-closed session, for
  // live_closed's "…at {weekday}'s close" -- see homePhase.ts's own doc
  // on this field for why `weekEnd` (always Friday) was wrong mid-week.
  const lastCloseAt = lastSessionCloseBefore(now, marketCalendar);
  const { laterPlayoffWeek, lastPlayoffLoss, lastPlayoffWeek } = playoffStatusFlags(data, meta);

  // B3 (Design Lead, 2026-09-30): leagueStartDate is written by the same
  // schedule.ts that gives matchup rows their nominal, fixed-UTC
  // timestamps (B1) — resolved here, at the same seam, so the board's
  // "Season starts Mon 9:30 AM ET" is never B1's bug in a new place.
  // Falls back to the nominal value when the calendar has no coverage.
  const realLeagueStartDate = meta.leagueStartDate
    ? (resolveWeekWindow(meta.leagueStartDate, marketCalendar)?.weekStart ?? meta.leagueStartDate)
    : null;

  const phase = homePhase(
    {
      league: {
        draftStatus: meta.draftStatus, leagueStartDate: realLeagueStartDate,
        seasonStatus: meta.seasonStatus, currentWeek: meta.currentWeek, numWeeks: meta.numWeeks,
        playoffTeams: meta.playoffTeams,
      },
      current, previous,
      laterPlayoffWeek, lastPlayoffLoss, lastPlayoffWeek,
      draftOrderWaiting: meta.draftOrderWaiting, now, market, nextWeekStart, lastCloseAt,
    },
    input.playoffRoundLabelForWeek,
  );

  // Only build the money views once the season has real matchup weeks to
  // reason about (states 6/7/8 have no hero/this-week card at all).
  const inSeason = !['pre_draft', 'drafting', 'complete'].includes(phase.kind);
  if (!inSeason) {
    return { phase, hero: null, thisWeek: null, standings: data.standings, myUserId: meta.myUserId, weeklyResults: [], seasonTiles: [] };
  }

  // The week THIS card is actually about — 'scored' can point at the
  // PREVIOUS week during the Fri-close -> next-open grace period (F5:
  // current_week already advanced). Found in code review (2026-09-29):
  // using `current` unconditionally here fabricated a $0-$0 "Final" and
  // a false loss every single weekend. `get_home_league` only fetches
  // snapshots/trades for `league.current_week`, so a relevantWeek that
  // ISN'T the current week can only ever be shown from its AUTHORITATIVE
  // stored gain — never a live recompute, which is exactly the case the
  // spec wants for a scored week anyway.
  const relevantWeek = 'week' in phase ? phase.week : meta.currentWeek;
  const relevantRow = relevantWeek === meta.currentWeek ? current : matchupRowFor(data, meta, relevantWeek, marketCalendar);
  const relevantIsCurrent = relevantWeek === meta.currentWeek;

  const myCurrentSnapshots = toLiveSnapshots(data.current_week.my_snapshots);
  const myCurrentTrades = toLiveTrades(data.current_week.my_trades);
  const oppCurrentSnapshots = toLiveSnapshots(data.current_week.opponent_snapshots);
  const oppCurrentTrades = toLiveTrades(data.current_week.opponent_trades);

  const currentRowScored = current && current.myGain !== null && (current.opponentGain !== null || !current.hasOpponent);
  const relevantRowScored = relevantRow && relevantRow.myGain !== null && (relevantRow.opponentGain !== null || !relevantRow.hasOpponent);

  const myLive = liveWeekScore(myCurrentSnapshots, myCurrentTrades, quote);
  const oppLive = liveWeekScore(oppCurrentSnapshots, oppCurrentTrades, quote);

  // Once both sides are scored, the this-week card shows the AUTHORITATIVE
  // matchups gain for `relevantRow` (never `current` unconditionally —
  // see the relevantWeek comment above), and never a live recompute from
  // (possibly stale) quotes — "nothing is shown as final before
  // team1_gain/team2_gain are non-null" cuts both ways: once they ARE
  // non-null, that number is the truth. A live recompute is only valid
  // when relevantRow IS the current week (the only week we have
  // snapshots/trades for at all).
  const thisWeek: ThisWeekViewModel | null = relevantRow?.hasOpponent
    ? relevantRowScored
      ? {
          you: { gain: relevantRow.myGain!, pct: 0, unpriced: [] },
          opponent: { gain: relevantRow.opponentGain!, pct: 0, unpriced: [] },
          final: true,
          result: weekResult({ myGain: relevantRow.myGain, oppGain: relevantRow.opponentGain, verdict: relevantRow.verdict }),
          opponentUserId: opponentUserIdFor(data, meta, relevantWeek),
        }
      : relevantIsCurrent
        ? {
            you: { gain: myLive.gain, pct: myLive.pct, unpriced: myLive.unpriced },
            opponent: { gain: oppLive.gain, pct: oppLive.pct, unpriced: oppLive.unpriced },
            final: false,
            result: null,
            opponentUserId: opponentUserIdFor(data, meta, relevantWeek),
          }
        : null // a past, unscored row with no snapshot data to recompute from — shouldn't occur, but never fabricate a live score for it
    : null;

  // Season gain = every already-scored REGULAR-SEASON week's gain for me,
  // plus the current week's live gain ONLY when it isn't scored yet AND
  // isn't a playoff week (R3, Design Lead, 2026-09-30: process-week-
  // results guards points_for accumulation with `if (!isPlayoff)` --
  // playoff performance never counts toward "season gain", which is a
  // regular-season standings stat. Found via playoff_live's hero showing
  // +$695.38 -- the wild-card week's live gain was being added on top of
  // the real +$481.78 regular-season total).
  const scoredWeeklyGains: number[] = [];
  const weeklyResults: WeeklyResult[] = [];
  for (const m of data.matchups) {
    const isMe1 = m.team1_user_id === meta.myUserId;
    const isMe2 = m.team2_user_id === meta.myUserId;
    if (!isMe1 && !isMe2) continue;
    const g = isMe1 ? m.team1_gain : m.team2_gain;
    const opp = isMe1 ? m.team2_gain : m.team1_gain;
    const hasOpp = isMe1 ? !!m.team2_user_id : !!m.team1_user_id;
    // Season gain: every already-scored REGULAR week before this one (unchanged).
    if (m.week_number < meta.currentWeek && !m.is_playoff && g !== null) scoredWeeklyGains.push(g);
    // The result list. Discriminated on the opponent's PRESENCE, never on a gain being null
    // (the overloaded-NULL trap): no opponent in the regular season is a real bye; an
    // opponent with either gain still null is not decided yet, and is left out.
    if (!hasOpp) {
      if (!m.is_playoff) weeklyResults.push({ week: m.week_number, gain: g ?? 0, result: 'BYE' });
    } else if (g !== null && opp !== null) {
      weeklyResults.push({ week: m.week_number, gain: g, result: weekResult({ myGain: g, oppGain: opp, verdict: serverVerdict(m, meta.myUserId) })! });
    }
  }
  weeklyResults.sort((a, b) => a.week - b.week);
  const currentWeekLiveGain = currentRowScored || current?.isPlayoff ? null : myLive.gain;
  if (currentRowScored && current && !current.isPlayoff) {
    scoredWeeklyGains.push(current.myGain!);
  }

  const seasonTiles = buildSeasonTiles({
    myUserId: meta.myUserId, phase, currentWeek: meta.currentWeek, matchups: data.matchups, weeklyResults,
    nameOf: (id) => data.standings.find((x) => x.user_id === id)?.display_name || 'Opponent',
  });

  const stake = teamValue({
    stakeMode: meta.stakeMode, notionalPerSlot: meta.notionalPerSlot, numRounds: meta.numRounds,
    drafts: toLedger(data.my_ledger.drafts), trades: toTrades(data.my_ledger.trades), price: quote,
  });

  const { gain: seasonGainDollars, pct: seasonGainPct } = seasonGain(scoredWeeklyGains, currentWeekLiveGain, stake.stake);

  const isTradingDay = !['weekend', 'holiday', 'no_coverage'].includes(market.reason);
  // ET, not UTC (code review, 2026-09-29): the market's day, not the
  // server's — see etDateOnly's own doc for the after-20:00-ET bug this fixes.
  const todaysDateStr = etDateOnly(now);
  const todaysTrades = toLiveTrades(data.my_ledger.trades).filter((t) => etDateOnly(t.createdAt) === todaysDateStr);
  // Net position before today's trades, from the full ledger minus today's activity.
  const positionsBeforeToday: TodayPosition[] = (() => {
    const qty = new Map<string, number>();
    for (const d of data.my_ledger.drafts) {
      if (d.symbol?.toUpperCase() === SKIP_SYMBOL) continue;
      qty.set(d.symbol, (qty.get(d.symbol) ?? 0) + d.quantity);
    }
    for (const t of data.my_ledger.trades) {
      if (etDateOnly(new Date(t.created_at)) === todaysDateStr) continue; // exclude today's own trades
      qty.set(t.symbol, (qty.get(t.symbol) ?? 0) + (t.action === 'buy' ? t.quantity : -t.quantity));
    }
    return Array.from(qty.entries()).map(([symbol, quantityBeforeToday]) => ({ symbol, quantityBeforeToday }));
  })();
  const today = todayChange(positionsBeforeToday, todaysTrades, quote, (sym) => prevCloseFor(bars, sym, now), isTradingDay);

  const hero: HeroViewModel = {
    value: stake.value,
    seasonGainDollars, seasonGainPct,
    today: today.total,
    unpricedValue: stake.unpriced,
    unpricedToday: today.unpriced,
    cashWentNegative: stake.cashWentNegative,
  };

  return { phase, hero, thisWeek, standings: data.standings, myUserId: meta.myUserId, weeklyResults, seasonTiles };
}
