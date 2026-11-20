/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { matchupSegmentFromParam } from '@/lib/game/draftComplete';
import { View, StyleSheet } from 'react-native';
import { Icon } from '@/components/sp/Icon';

import { space } from '@/constants/tokens';
import { useTheme } from '@/components/sp/ThemeProvider';
import { Text } from '@/components/sp/Text';
import { PhasePlaceholder } from '@/components/shell/PhasePlaceholder';
import { LeagueListGate } from '@/components/shell/NoLeagueState';
import { ShellHeader } from '@/components/shell/ShellHeader';
import { BarsRefresh } from '@/components/shell/BarsRefresh';
import { Scoreboard } from '@/components/sp/gn';
import { type ScoreboardOpen } from '@/components/sp/gn/Scoreboard';
import { MatchupRoster, type RosterLedger } from '@/components/game/MatchupRoster';
import { FinishedWeek } from '@/components/game/FinishedWeek';
import { ByeGame } from '@/components/game/ByeGame';
import { SeasonRecap } from '@/components/game/SeasonRecap';
import { useSeasonRecap } from '@/lib/game/useSeasonRecap';
import { teamHref, teamLinkLabel } from '@/lib/game/teamLink';
import { useCaptureAction } from '@/lib/money/captureScript';
import { useRevealOnce, type RevealState } from '@/lib/game/useRevealOnce';
import { useAllMatchups } from '@/lib/game/useAllMatchups';
import { useFinalLineups, type FinalLineupsState } from '@/lib/game/useFinalLineups';
import type { AllMatchupRow } from '@/lib/game/allMatchups';
import { SegmentedControl } from '@/components/sp/SegmentedControl';
import { FinalBanner } from '@/components/game/FinalBanner';
import { buildFinalBanner } from '@/lib/game/finalBanner';
import { useLeagueContext } from '@/lib/LeagueContext';
import { useMatchup, type MatchupDerived } from '@/lib/game/useMatchup';
import { COPY } from '@/lib/game/gameCopy';
import { COPY as MONEY_COPY } from '@/lib/money/moneyCopy';
import { AllMatchupsSkeleton, MatchupSkeleton } from '@/components/game/LoadingSkeletons';
import { LoadFailure } from '@/components/money/LoadFailure';
import { PriceNotice } from '@/components/game/PriceNotice';
import { missingPriceSymbols, priceNoticeText } from '@/lib/game/priceNotice';
import { knownWithoutWeeks } from '@/lib/game/leagueWeeks';
import { preSeasonStartsLabel, byeToRoundLabel, eliminatedLabel, playoffPendingLine } from '@/lib/home/homeCopy';
import { useAuth } from '@/lib/useAuth';
import type { HomeRawInputs } from '@/lib/home/useHomeLeague';
import { toLiveSnapshots, toLiveTrades } from '@/lib/home/buildHomeViewModel';
import { BYE_HALF } from '@/lib/game/matchupRosterView';
import { useRosterData, type RosterData } from '@/lib/game/useRosterData';
import { keepTime } from '@/lib/game/keepDots';

// Matchup (W4, Game Night). Giorgio, 2026-10-12: "a fantasy-football matchup, nothing
// else" — the Scoreboard (names, avatars, the two totals, "{leader} leads by $X"; YOUR half
// shaded, never the leader's), then the mirrored roster: your stocks left, theirs right,
// best first by week gain (slotted leagues grouped under their slot, best first within),
// the centre column empty, no row lit for its winner, no race chart. The ORDER reads each
// stock's gain at the last market close and holds through the next day (matchupRoster.ts);
// the numbers on the rows are live and sum to the score. Tapping any stock, yours or
// theirs, opens its player card as a sheet. FINAL: the FinalBanner over the same rows, from
// the posted week's own per-stock rows (shown only when they reconcile to the cent).
export default function MatchupTab() {
  // Onboarding W4: no leagues is the one shared state on every tab (it was a blank tab here).
  return (
    <LeagueListGate title="Matchup">
      <MatchupScreen />
    </LeagueListGate>
  );
}

function MatchupScreen() {
  const { activeLeagueId, activeLeague, refresh } = useLeagueContext();
  const { colors } = useTheme();
  const m = useMatchup(activeLeagueId);
  // G3: the Friday reveal plays once per matchup-week, once the result is posted.
  const revealFinal = m.derived?.view.kind === 'final' && m.derived.final !== null;
  const reveal = useRevealOnce(activeLeagueId, m.derived?.week ?? null, revealFinal);
  // "My matchup" / "All matchups" are the board's labels (key screen 2); the switch stays
  // as navigation (Giorgio, 2026-10-12, item 9).
  const [segment, setSegment] = useState<'mine' | 'all'>('mine');
  // The draft's ending on a Week 1 bye opens All matchups (?segment=all). The tab
  // stays mounted, so the route param is applied when it changes, not only at mount.
  const { segment: segmentParam } = useLocalSearchParams<{ segment?: string }>();
  useEffect(() => {
    const s = matchupSegmentFromParam(segmentParam);
    if (s) setSegment(s);
  }, [segmentParam]);
  // After the season the tab is the recap (Giorgio, 2026-11-18, look A): one league-wide read
  // of the season's games, only while the view is 'complete'; the week's All matchups is not read.
  const complete = m.derived?.view.kind === 'complete';
  const recap = useSeasonRecap(activeLeagueId, { numWeeks: activeLeague?.num_weeks ?? null, playoffTeams: activeLeague?.playoff_teams ?? null }, m.names, complete);
  const all = useAllMatchups(activeLeagueId, m.derived?.week ?? null, m.names, segment === 'all' && !complete);
  const { user } = useAuth();
  // The final lineup: the posted week's own per-stock rows, shown only when they reconcile.
  const fv = m.derived;
  const finalSides = fv && fv.view.kind === 'final' && fv.final && fv.live.opp && user && fv.weekStart && fv.weekEnd
    ? { mine: user.id, theirs: fv.live.opp.userId, myGain: fv.final.me, theirGain: fv.final.opp, windowStart: fv.weekStart, windowEnd: fv.weekEnd }
    : null;
  const finalLines = useFinalLineups(activeLeagueId, fv?.week ?? null, finalSides, finalSides !== null);
  const roster = useRosterData(activeLeagueId, user?.id ?? null, fv?.live.opp?.userId ?? null);
  // This week's two ledgers (Home's current week), for the roster and the withheld view.
  const cw = m.raw?.data.current_week ?? null;
  const ledgers = useMemo(() => (cw
    ? {
        me: { snapshots: toLiveSnapshots(cw.my_snapshots), trades: toLiveTrades(cw.my_trades) },
        opp: { snapshots: toLiveSnapshots(cw.opponent_snapshots), trades: toLiveTrades(cw.opponent_trades) },
      }
    : null), [cw]);
  // The order may change only when you arrive or pull to refresh, never under a poll while
  // you're looking (Design Lead, 2026-10-12, on Giorgio's "AFTER TRADING ENDS"): a newly
  // settled close is admitted only if it settled before this moment (orderAsOf).
  const [orderAsOf, setOrderAsOf] = useState(() => new Date());
  useFocusEffect(useCallback(() => {
    setOrderAsOf(new Date());
  }, []));
  // Pull to refresh re-reads the league AND this matchup's own data (useMatchup's fetch), so
  // the rows' numbers and a newly settled order land together.
  const mRefresh = m.refresh;
  const onRefresh = useCallback(async () => {
    setOrderAsOf(new Date());
    await Promise.all([refresh(), mRefresh()]);
  }, [refresh, mRefresh]);

  // A league without weeks (Duration) has no matchups: the tab draws nothing under its header
  // (no switch, no "$0.00" vs "$0.00", no "Starts …", no recap), with nothing in its place.
  const blank = knownWithoutWeeks(activeLeague);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BarsRefresh onRefresh={onRefresh} header={<ShellHeader title="Matchup" showAvatar />} contentContainerStyle={{ paddingHorizontal: space[6], paddingBottom: space[9], gap: space[5] }}>
        {m.derived && !blank ? (
          <SegmentedControl
            options={[{ label: 'My matchup', value: 'mine' }, { label: 'All matchups', value: 'all' }]}
            value={segment}
            onChange={(v) => setSegment(v === 'all' ? 'all' : 'mine')}
          />
        ) : null}
        {blank ? null : complete && activeLeagueId ? (
          <SeasonRecap key={activeLeagueId} segment={segment} state={recap} leagueId={activeLeagueId} />
        ) : segment === 'all' ? (
          <AllMatchupsList key={activeLeagueId ?? 'none'} state={all} myUserId={user?.id ?? ''} />
        ) : (
          // S-4: keyed by league, so a league switch mounts a fresh scoreboard and roster
          // instead of rolling league A's into league B's (Home's H5, HomeLeagueTransition).
          <MatchupBody key={activeLeagueId ?? 'none'} status={m.status} derived={m.derived} phase={m.phase} onRefresh={m.refresh} raw={m.raw} reveal={reveal} finalLines={finalLines} roster={roster} orderAsOf={orderAsOf} ledgers={ledgers} />
        )}
      </BarsRefresh>
    </View>
  );
}

function AllMatchupsList({ state, myUserId }: { state: { status: string; rows: AllMatchupRow[]; retry: () => void }; myUserId: string }) {
  // S-6: loading shows the games' shape (never a blank tab); a failed load says so and offers Try again.
  if (state.status === 'loading' || state.status === 'idle') return <AllMatchupsSkeleton />;
  if (state.status === 'error') {
    return <LoadFailure title={COPY.allMatchupsLoadFailed} message={MONEY_COPY.loadRetryMessage} onRetry={state.retry} />;
  }
  return (
    <View style={styles.stack}>
      {state.rows.map((r, i) => (!r.b ? (
        // A bye has no opponent and no result: the team and the app's bye line, never a
        // nameless opponent or a "leads by" (b: null — allMatchups' bye row).
        <ByeGame key={`${r.a.userId}-${i}`} name={r.a.name} mine={r.a.userId === myUserId} />
      ) : (
        // Your game shades your half (you're side a, allMatchups puts you first); every
        // other game is two plain halves — there's no "you" to shade.
        <Scoreboard
          key={`${r.a.userId}-${i}`}
          size="compact"
          mine={r.a.userId === myUserId}
          final={r.final}
          verdict={r.verdict}
          you={{ name: r.a.name, gain: r.a.gain }}
          opponent={{ name: r.b.name, gain: r.b.gain }}
        />
      )))}
    </View>
  );
}

interface BodyProps {
  status: 'loading' | 'ready' | 'error' | 'no-league';
  derived: MatchupDerived | null;
  phase: import('@/lib/home/homePhase').PhaseResult | null;
  onRefresh: () => Promise<void>;
  raw: HomeRawInputs | null;
  /** The one-time reveal: the banner mounts only once it is decided (useRevealOnce). */
  reveal: RevealState;
  finalLines: FinalLineupsState;
  roster: RosterData;
  orderAsOf: Date;
  /** This week's two ledgers (Home's current week); null while loading. */
  ledgers: { me: RosterLedger; opp: RosterLedger } | null;
}

function MatchupBody({ status, derived, phase, onRefresh, raw, reveal, finalLines, roster, orderAsOf, ledgers }: BodyProps) {
  const { user } = useAuth();
  const router = useRouter();
  // The scoreboard's avatar + name open that manager's team (the opponent's, read-only) or,
  // for your half, your Portfolio tab (the leaguemate team view; Planner ruling 2026-10-16).
  const openTeam = (userId: string | null | undefined, name: string, isYou: boolean): ScoreboardOpen | undefined => {
    const href = teamHref({ userId, name, isYou });
    return href ? { hint: teamLinkLabel({ name, isYou }), onPress: () => router.push(href) } : undefined;
  };
  // DEV capture only (captureScript): the same handlers the header's two halves run.
  useCaptureAction('opp', () => { if (derived?.live.opp) openTeam(derived.live.opp.userId, derived.live.opp.name, false)?.onPress(); });
  useCaptureAction('me', () => { if (user && derived) openTeam(user.id, derived.live.me.name, true)?.onPress(); });
  if (status === 'error') {
    return (
      <PhasePlaceholder title="Matchup" icon={() => <Icon name="alert" size="title" tone="text2" />} heading="Couldn't load this matchup" message="Pull down to try again." embedded />
    );
  }
  if (status === 'no-league') return null;
  // S-6: the scoreboard's and roster's shape while loading, never a made-up number.
  if (status === 'loading' || !derived || !user) return <MatchupSkeleton />;

  const { view, live, final, week } = derived;
  const youName = live.me.name;
  // A LIVE week with a missing price names the stocks (both teams', each once); never on a scored week.
  const missing = missingPriceSymbols(live.me.unpriced, live.opp?.unpriced);
  const notice = view.kind === 'scoreboard' || view.kind === 'bye' ? priceNoticeText(missing) : null;

  if (view.kind === 'not_started') {
    return <PhasePlaceholder title="Matchup" icon={() => <Icon name="trophy" size="title" tone="text2" />} heading="Not started yet" message="Your matchups start when the draft is done." embedded />;
  }

  if (view.kind === 'pre_season') {
    // Before the season: the pairing with both totals at $0.00, and when it starts.
    return (
      <View style={styles.stack}>
        <Scoreboard
          you={{ name: youName, gain: 0 }}
          opponent={{ name: live.opp?.name ?? '', gain: 0 }}
          showLine={false}
          openYou={openTeam(user.id, youName, true)}
          openOpponent={live.opp ? openTeam(live.opp.userId, live.opp.name, false) : undefined}
        />
        <Text variant="callout" tone="secondary" style={styles.center}>{keepTime(preSeasonStartsLabel(phase && phase.kind === 'pre_season' ? phase.seasonStartsAt : null))}</Text>
      </View>
    );
  }

  if (view.kind === 'bye') {
    // A bye (#call-mx-bye, B): your half as usual, "Bye week" in theirs, the app's bye line,
    // then your stocks in one column under the same order rules.
    return (
      <View style={styles.stack}>
        {notice ? <PriceNotice text={notice} symbols={missing} /> : null}
        <Scoreboard you={{ name: youName, gain: live.me.total }} opponent={null} bye={{ label: BYE_HALF, line: COPY.byeNoResult }} openYou={openTeam(user.id, youName, true)} />
        {/* A held-but-unpriced stock is on the roster too (with "–"), even if it is all you hold. */}
        {raw && ledgers && (live.me.lineup.length || live.me.unpriced.length) ? (
          <MatchupRoster
            left={{ userId: user.id, name: youName, isYou: true, rows: live.me.lineup, ledger: ledgers.me, unpriced: live.me.unpriced }}
            right={null}
            final={false}
            weekEnd={derived.weekEnd}
            env={raw}
            roster={roster}
            orderAsOf={orderAsOf}
            seamResumesAt={phase?.kind === 'live_closed' ? phase.resumesAt : null}
            seamMarketOpen={false}
          />
        ) : null}
      </View>
    );
  }

  if (view.kind === 'playoff_bye' || view.kind === 'playoff_pending' || view.kind === 'eliminated' || view.kind === 'missed_playoffs') {
    const line =
      view.kind === 'playoff_bye' ? byeToRoundLabel(view.round)
      : view.kind === 'playoff_pending' ? playoffPendingLine(view.round)
      : view.kind === 'eliminated' ? eliminatedLabel(view.round)
      : "You didn't make the playoffs.";
    return <Text variant="callout" tone="secondary">{line}</Text>;
  }

  // After the season: the recap (Giorgio, 2026-11-18, look A). MatchupScreen draws it in place
  // of this body; nothing of the last week's scoreboard remains (unreachable here).
  if (view.kind === 'complete') return null;

  if (view.kind === 'scoring' || (view.kind === 'final' && final === null)) {
    return <Text variant="callout" tone="secondary">{COPY.scoringLabel}</Text>;
  }

  // FINAL: the finished-week view the recap's week detail draws too (FinishedWeek).
  if (view.kind === 'final' && final) {
    if (!live.opp || !raw || !ledgers?.opp) {
      // No opponent row (never a bye here: a bye is its own view): the band and the score alone.
      return (
        <View style={styles.stack}>
          {reveal.decided ? (
            <FinalBanner play={reveal.play} model={buildFinalBanner({ week, result: final.result, youName, oppName: live.opp?.name ?? '', record: derived.myRecord, isPlayoff: phase?.kind === 'scored' ? phase.isPlayoff : false })} />
          ) : null}
          <Scoreboard you={{ name: youName, gain: final.me }} opponent={{ name: live.opp?.name ?? '', gain: final.opp }} final verdict={final.verdict} openYou={openTeam(user.id, youName, true)} />
        </View>
      );
    }
    return (
      <FinishedWeek
        week={week}
        isPlayoff={phase?.kind === 'scored' ? phase.isPlayoff : false}
        result={final.result}
        verdict={final.verdict}
        mine
        left={{ userId: user.id, name: youName, gain: final.me, ledger: ledgers.me, open: openTeam(user.id, youName, true) }}
        right={{ userId: live.opp.userId, name: live.opp.name, gain: final.opp, ledger: ledgers.opp, open: openTeam(live.opp.userId, live.opp.name, false) }}
        record={derived.myRecord}
        reveal={reveal}
        finalLines={finalLines}
        roster={roster}
        weekEnd={derived.weekEnd}
        env={raw}
        orderAsOf={orderAsOf}
      />
    );
  }

  // LIVE: each total is the sum of the stocks that HAVE a live price (SideView.total; Giorgio, PR #562), and
  // the leads-by line is worked out from those totals. A stock with no price is "–" on its row and named in the
  // notice above the card (which replaced the old "counted at cost" caption). A FINAL week never comes here: it
  // is FinishedWeek's, with the server's own gains and verdict, which these priced totals never override.

  return (
    <View style={styles.stack}>
      {notice ? <PriceNotice text={notice} symbols={missing} /> : null}
      <Scoreboard
        you={{ name: youName, gain: live.me.total }}
        opponent={{ name: live.opp?.name ?? '', gain: live.opp?.total ?? 0 }}
        openYou={openTeam(user.id, youName, true)}
        openOpponent={live.opp ? openTeam(live.opp.userId, live.opp.name, false) : undefined}
      />
      {live.opp && raw && ledgers?.opp ? (
        <MatchupRoster
          left={{ userId: user.id, name: youName, isYou: true, rows: live.me.lineup, ledger: ledgers.me, unpriced: live.me.unpriced }}
          right={{ userId: live.opp.userId, name: live.opp.name, isYou: false, rows: live.opp.lineup, ledger: ledgers.opp, unpriced: live.opp.unpriced }}
          final={false}
          weekEnd={derived.weekEnd}
          env={raw}
          roster={roster}
          orderAsOf={orderAsOf}
          seamResumesAt={phase?.kind === 'live_closed' ? phase.resumesAt : null}
          seamMarketOpen={view.kind === 'scoreboard' && !view.closed}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[5] },
  center: { textAlign: 'center' },
});
