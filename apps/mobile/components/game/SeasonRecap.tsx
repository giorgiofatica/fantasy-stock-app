/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { space } from '@/constants/tokens';
import { Text } from '@/components/sp/Text';
import { Scoreboard } from '@/components/sp/gn';
import { MANAGER_ROW_GAP } from '@/components/sp/gn';
import { ROW_TEXT_CAP, ScheduleWeekRow } from '@/components/game/ScheduleList';
import { ByeGame } from '@/components/game/ByeGame';
import { AllMatchupsSkeleton } from '@/components/game/LoadingSkeletons';
import { TilesSkeleton } from '@/components/league/LeagueStates';
import { LoadFailure } from '@/components/money/LoadFailure';
import { COPY as MONEY_COPY } from '@/lib/money/moneyCopy';
import { eliminatedLabel } from '@/lib/home/homeCopy';
import { OPENS_MATCHUP_HINT } from '@/lib/home/calmHome';
import { matchupWeekHref } from '@/lib/game/matchupWeekLink';
import type { RecapOpen, RecapRow, RecapStatus } from '@/lib/game/seasonRecap';
import type { SeasonRecapState } from '@/lib/game/useSeasonRecap';
import type { ScheduleRow } from '@/lib/game/schedule';

// The Matchup tab after a season (Giorgio, 2026-11-18, the recap, look A): the season's weeks,
// newest first (the final on top), each row opening that week's matchup (app/matchup-week).
// NO new words: the rows are League › Schedule's (ScheduleWeekRow) with "vs {name}", the
// round chip on a playoff week and a chevron; All matchups is the live list's own rows in
// their final look, a section per week; the one line on top is the tab's existing one.
// Confirmed by the Planner (not boarded): a tie shows "T"; a bye is neutral, no chevron, no tap.

/** The recap's failure title: a CUT of COPY.allMatchupsLoadFailed ("This week's matchups didn't
 * load"), which is false on a whole-season list (DL gate, 2026-11-18, P2: a removal, no new words). */
export const RECAP_LOAD_FAILED = "Matchups didn't load";

export interface SeasonRecapProps {
  segment: 'mine' | 'all';
  state: SeasonRecapState;
  leagueId: string;
}

/** The line over My matchup: out in a round, or missed the playoffs; none for the champion
 * or the runner-up (nor when the rows can't say). */
export function recapStatusLine(status: RecapStatus): string | null {
  if (!status) return null;
  if (status.kind === 'eliminated') return eliminatedLabel(status.round);
  if (status.kind === 'missed_playoffs') return "You didn't make the playoffs.";
  return null;
}

/** A recap row as League › Schedule's row reads it: always a past week. */
function scheduleRowOf(r: RecapRow): ScheduleRow {
  return { week: r.week, opponent: r.opponentName, bye: r.bye, state: 'past', result: r.result, gain: r.myGain, oppGain: r.oppGain };
}

export function SeasonRecap({ segment, state, leagueId }: SeasonRecapProps) {
  const router = useRouter();
  // S-6: loading shows the list's shape (Schedule's tiles / All matchups' games), never a blank tab.
  if (state.status === 'loading' || state.status === 'idle') {
    return segment === 'all' ? <AllMatchupsSkeleton /> : <TilesSkeleton />;
  }
  if (state.status === 'error' || !state.recap) {
    // A short read lands here too: a FAILURE, never a shorter season.
    return <LoadFailure title={RECAP_LOAD_FAILED} message={MONEY_COPY.loadRetryMessage} onRetry={state.retry} />;
  }
  const recap = state.recap;
  const open = (o: RecapOpen) => router.push(matchupWeekHref(leagueId, o));

  if (segment === 'all') {
    return (
      <View style={styles.sections}>
        {recap.all.map((w) => (
          <View key={w.week} style={styles.section}>
            <Text variant="tag" tone="secondary" accessibilityRole="header">{w.label}</Text>
            <View style={styles.games}>
              {w.games.map((g, i) => (!g.b ? (
                <ByeGame key={`${g.a.userId}-${i}`} name={g.a.name} mine={g.mine} />
              ) : !g.final || g.a.gain === null || g.b.gain === null ? (
                // Never posted (review 4633132087): BOTH sides, as every other game, with the season
                // tile's dash for each total, no line and no tap. ByeGame stays for a bye alone (b null).
                // The 0s are never drawn: `unscored` draws the dash and reads no gain. The chevron's
                // column stays, empty, so its halves line up with the posted games around it.
                <Scoreboard
                  key={`${g.a.userId}-${i}`}
                  size="compact"
                  mine={g.mine}
                  unscored
                  chevronGutter
                  you={{ name: g.a.name, gain: g.a.gain ?? 0 }}
                  opponent={{ name: g.b.name, gain: g.b.gain ?? 0 }}
                />
              ) : (
                <Scoreboard
                  key={`${g.a.userId}-${i}`}
                  size="compact"
                  mine={g.mine}
                  final
                  verdict={g.verdict}
                  you={{ name: g.a.name, gain: g.a.gain }}
                  opponent={{ name: g.b.name, gain: g.b.gain }}
                  openGame={g.opens ? { hint: OPENS_MATCHUP_HINT, onPress: () => open(g.opens!) } : undefined}
                />
              )))}
            </View>
          </View>
        ))}
      </View>
    );
  }

  const line = recapStatusLine(recap.status);
  return (
    <View style={styles.stack}>
      {/* Context, not content: capped at the rows' own 1.3x so at AX5 the season's rows stay the loudest
          thing (DL re-gate, 2026-11-18; the gate checklist's "the standout stays loudest"). */}
      {line ? <Text variant="callout" tone="secondary" maxFontSizeMultiplier={ROW_TEXT_CAP}>{line}</Text> : null}
      <View style={styles.rows}>
        {recap.mine.map((r) => (
          <ScheduleWeekRow
            key={r.week}
            row={scheduleRowOf(r)}
            weekLabel={r.chip ?? r.label}
            roundChip={r.chip !== null}
            spokenWeek={r.label}
            onPress={r.opens ? () => open(r.opens!) : undefined}
            accessibilityHint={r.opens ? OPENS_MATCHUP_HINT : undefined}
            neutralResult
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[5] },
  // Schedule's tiles, 6pt apart (§9C rule 2).
  rows: { gap: MANAGER_ROW_GAP },
  sections: { gap: space[6] },
  section: { gap: space[3] },
  games: { gap: space[5] },
});
