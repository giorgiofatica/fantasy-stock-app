/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space } from '@/constants/tokens';
import { useTheme } from '@/components/sp/ThemeProvider';
import type { ScoreboardOpen } from '@/components/sp/gn/Scoreboard';
import { BackControl } from '@/components/game/SetupScaffold';
import { FinishedWeek } from '@/components/game/FinishedWeek';
import { MatchupSkeleton } from '@/components/game/LoadingSkeletons';
import { LoadFailure } from '@/components/money/LoadFailure';
import { useLeagueContext } from '@/lib/LeagueContext';
import { useAuth } from '@/lib/useAuth';
import { useMatchup } from '@/lib/game/useMatchup';
import { useSeasonRecap } from '@/lib/game/useSeasonRecap';
import { useFinalLineups } from '@/lib/game/useFinalLineups';
import { useRosterData } from '@/lib/game/useRosterData';
import { parseMatchupWeekParams } from '@/lib/game/matchupWeekLink';
import { recapGameDetail, recordThrough, withWeekCloses } from '@/lib/game/seasonRecap';
import { lastWeekClose, weekSessions } from '@/lib/game/matchupRoster';
import { resolveWeekWindow } from '@/lib/time/marketWeek';
import { teamHref, teamLinkLabel } from '@/lib/game/teamLink';
import { COPY as MONEY_COPY } from '@/lib/money/moneyCopy';
import { isSeasonOver } from '@/lib/weekStatus';
import { seasonEndEt } from '@/lib/money/seasonEnd';

// One finished game from the Matchup recap (Giorgio, 2026-11-18, look A): "‹ Back", then the
// EXISTING finished-week view (FinishedWeek, the same component the tab draws on the Friday a
// week posts): the FinalBanner, the Scoreboard with the posted gains, and the roster from the
// week's own per-stock rows, or the withheld look when they don't reconcile. The banner never
// replays here (the reveal plays once, on the tab). Cards opened from it are #545's
// finished-season card (MatchupRoster: no Sell once the season is over).

/** The reveal is decided and never plays: a recap is looked back at, not revealed. */
const NO_REVEAL = { decided: true, play: false } as const;

export default function MatchupWeekScreen() {
  const raw = useLocalSearchParams<{ league?: string; week?: string; a?: string; b?: string }>();
  const params = parseMatchupWeekParams(raw);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/matchup'));
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.backRow}>
        <BackControl label="Back" onPress={back} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: space[9] + insets.bottom }]}>
        {params ? <WeekBody league={params.league} week={params.week} a={params.a} b={params.b} /> : <LoadFailure title="Couldn't load this matchup" message={MONEY_COPY.loadRetryMessage} onRetry={back} />}
      </ScrollView>
    </View>
  );
}

function WeekBody({ league, week, a, b }: { league: string; week: number; a: string; b: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const { leagues, sheetLeagues, marketCalendar } = useLeagueContext();
  const lg = leagues.find((l) => l.id === league) ?? null;
  // Names (the standings) and the clock, bars and calendar: Home's one fetch (useMatchup).
  const m = useMatchup(league);
  const recapState = useSeasonRecap(league, { numWeeks: lg?.num_weeks ?? null, playoffTeams: lg?.playoff_teams ?? null }, m.names, true);
  const detail = recapState.status === 'ready' ? recapGameDetail(recapState.matchups, week, a, b) : null;
  const nameOf = (id: string) => m.names.find((n) => n.user_id === id)?.display_name ?? '';
  const sides = detail && detail.weekStart && detail.weekEnd
    ? { mine: a, theirs: b, myGain: detail.aGain, theirGain: detail.bGain, windowStart: detail.weekStart, windowEnd: detail.weekEnd }
    : null;
  const finalLines = useFinalLineups(league, week, sides, sides !== null);
  const roster = useRosterData(league, a, b);
  const [orderAsOf] = useState(() => new Date());
  // A season that is over: cards open as the finished-season card (#545, pick A), frozen at the season's
  // last day, read from THIS league-wide read (the latest week_end, the Final included), never the
  // caller-scoped list; completed_at only as the fallback.
  const completedAt = sheetLeagues.find((l) => l.id === league)?.seasonCompletedAt ?? null;
  const seasonEnd = recapState.status === 'ready' && isSeasonOver(lg, new Date(), marketCalendar) ? seasonEndEt(recapState.matchups, completedAt) : null;
  const rawInputs = m.raw;

  // The week's own Friday closes laid into Home's bars, so the order and the rows' prices are
  // that week's close, never today's quote.
  const env = useMemo(() => {
    if (!rawInputs) return null;
    const win = detail?.weekEnd ? resolveWeekWindow(detail.weekEnd, rawInputs.marketCalendar) : null;
    const sessions = win ? weekSessions(win.weekStart, win.weekEnd, rawInputs.marketCalendar) : [];
    const closeDate = lastWeekClose(rawInputs.now, sessions)?.date ?? null;
    const closes = { ...(finalLines.ledgers?.mine.closes ?? {}), ...(finalLines.ledgers?.theirs.closes ?? {}) };
    return { now: rawInputs.now, quote: rawInputs.quote, marketCalendar: rawInputs.marketCalendar, bars: withWeekCloses(rawInputs.bars, closes, closeDate) };
  }, [rawInputs, detail?.weekEnd, finalLines.ledgers]);

  if (recapState.status === 'error' || m.status === 'error') {
    return <LoadFailure title="Couldn't load this matchup" message={MONEY_COPY.loadRetryMessage} onRetry={() => { recapState.retry(); void m.refresh(); }} />;
  }
  if (recapState.status !== 'ready' || !env || !user) return <MatchupSkeleton />;
  if (!detail) {
    // A stale link (no such scored game): say so, never draw a made-up week.
    return <LoadFailure title="Couldn't load this matchup" message={MONEY_COPY.loadRetryMessage} onRetry={recapState.retry} />;
  }

  // The halves open each manager's team, as on the tab (your own half: the Portfolio tab).
  const openTeam = (userId: string, name: string): ScoreboardOpen | undefined => {
    const isYou = userId === user.id;
    const href = teamHref({ userId, name, isYou });
    return href ? { hint: teamLinkLabel({ name, isYou }), onPress: () => router.push(href) } : undefined;
  };
  const aName = nameOf(a);
  const bName = nameOf(b);
  return (
    <FinishedWeek
      week={week}
      isPlayoff={detail.isPlayoff}
      result={detail.result}
      verdict={detail.verdict}
      outcome={detail.outcome}
      mine={a === user.id}
      left={{ userId: a, name: aName, gain: detail.aGain, ledger: finalLines.ledgers?.mine ?? null, open: openTeam(a, aName) }}
      right={{ userId: b, name: bName, gain: detail.bGain, ledger: finalLines.ledgers?.theirs ?? null, open: openTeam(b, bName) }}
      record={recordThrough(recapState.matchups, a, week)}
      reveal={NO_REVEAL}
      finalLines={finalLines}
      roster={roster}
      weekEnd={detail.weekEnd}
      env={env}
      orderAsOf={orderAsOf}
      seasonEnd={seasonEnd}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The back control sits at the page's left edge, its own 20pt padding inside the 24pt gutter's start.
  backRow: { paddingHorizontal: space[1], paddingVertical: space[2], alignItems: 'flex-start' },
  content: { paddingHorizontal: space[6], gap: space[5] },
});
