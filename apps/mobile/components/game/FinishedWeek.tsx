/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { View, StyleSheet } from 'react-native';

import { space } from '@/constants/tokens';
import { Scoreboard } from '@/components/sp/gn';
import type { ScoreboardOpen } from '@/components/sp/gn/Scoreboard';
import { FinalBanner } from '@/components/game/FinalBanner';
import { RosterRowsSkeleton } from '@/components/game/LoadingSkeletons';
import { LoadFailure } from '@/components/money/LoadFailure';
import { MatchupRoster, WithheldRoster, type RosterEnv, type RosterLedger } from '@/components/game/MatchupRoster';
import { buildFinalBanner } from '@/lib/game/finalBanner';
import type { WeekResult } from '@/lib/game/weekResult';
import type { FinalLineupsState } from '@/lib/game/useFinalLineups';
import type { RosterData } from '@/lib/game/useRosterData';
import type { RevealState } from '@/lib/game/useRevealOnce';
import { COPY as MONEY_COPY } from '@/lib/money/moneyCopy';

// A finished week (W4 FINAL): the FinalBanner over the Scoreboard with the posted gains, then
// the mirrored roster from the posted week's own per-stock rows, shown only when they
// reconcile to the cent; otherwise the withheld look (#call-mx-withheld, B). The Matchup
// tab's live 'final' state and the recap's week detail (app/matchup-week) both render THIS
// component, so a past week reads exactly as it did the Friday it posted.

export interface FinishedWeekSide {
  userId: string;
  name: string;
  /** The server's posted gain. */
  gain: number;
  /** This side's week (snapshots + the window's trades); null while it loads. */
  ledger: RosterLedger | null;
  open?: ScoreboardOpen;
}

export interface FinishedWeekProps {
  week: number;
  isPlayoff: boolean;
  /** The left side's result (lib/game/weekResult, the one decider). */
  result: WeekResult;
  /** True when the left side is you: your half is shaded and the band can be yours. */
  mine: boolean;
  left: FinishedWeekSide;
  right: FinishedWeekSide;
  /** The left side's record with this week counted; null when it isn't known. */
  record: { wins: number; losses: number; ties: number } | null;
  reveal: RevealState;
  finalLines: FinalLineupsState;
  roster: RosterData;
  weekEnd: string | null;
  env: RosterEnv;
  orderAsOf: Date;
  /** A season that is over: its last day (ET), so a card opens as the finished-season card (#545). */
  seasonEnd?: string | null;
}

export function FinishedWeek({ week, isPlayoff, result, mine, left, right, record, reveal, finalLines, roster, weekEnd, env, orderAsOf, seasonEnd = null }: FinishedWeekProps) {
  const model = buildFinalBanner({ week, result, youName: left.name, oppName: right.name, record, isPlayoff });
  return (
    <View style={styles.stack}>
      {/* Mounted only once the reveal is decided: FinalBanner takes its start pose on mount.
          A game you aren't in never takes your colour: its band is the neutral one. */}
      {reveal.decided ? <FinalBanner play={reveal.play} model={mine || model.outcome !== 'won' ? model : { ...model, outcome: 'lost' }} /> : null}
      <Scoreboard
        you={{ name: left.name, gain: left.gain }}
        opponent={{ name: right.name, gain: right.gain }}
        final
        mine={mine}
        openYou={left.open}
        openOpponent={right.open}
      />
      {finalLines.status === 'error' ? (
        <LoadFailure title="Couldn't load this matchup" message={MONEY_COPY.loadRetryMessage} onRetry={finalLines.retry} />
      ) : finalLines.status !== 'ready' || !left.ledger || !right.ledger ? (
        <RosterRowsSkeleton />
      ) : finalLines.mine?.ok && finalLines.theirs?.ok && finalLines.mine.rows && finalLines.theirs.rows ? (
        <MatchupRoster
          left={{ userId: left.userId, name: left.name, isYou: mine, rows: finalLines.mine.rows, ledger: left.ledger, unpriced: [] }}
          right={{ userId: right.userId, name: right.name, isYou: false, rows: finalLines.theirs.rows, ledger: right.ledger, unpriced: [] }}
          final
          weekEnd={weekEnd}
          env={env}
          roster={roster}
          orderAsOf={orderAsOf}
          seamResumesAt={null}
          seamMarketOpen={false}
          seasonEnd={seasonEnd}
        />
      ) : (
        // The posted rows don't add up to the result: who held what, without figures.
        <WithheldRoster roster={roster} left={{ userId: left.userId, ledger: left.ledger }} right={{ userId: right.userId, name: right.name, ledger: right.ledger }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[5] },
});
