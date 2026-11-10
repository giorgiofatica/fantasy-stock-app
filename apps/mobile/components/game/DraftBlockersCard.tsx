/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { radius, space, typeFontFamily } from '@/constants/tokens';
import { BUTTON_LABEL_MAX_SCALE, Button, type ButtonStatus } from '@/components/sp/Button';
import { Card } from '@/components/sp/Card';
import { Text } from '@/components/sp/Text';
import { keepTime } from '@/lib/game/keepDots';
import { useTheme } from '@/components/sp/ThemeProvider';
import { Stepper } from '@/components/game/Stepper';
import { InviteCodeText } from '@/components/game/InviteCodeText';
import { codeLabelMaxScale } from '@/lib/game/codeLabel';
import {
  INVITE_SOMEONE_NEW,
  PICK_NEW_TIME,
  PICK_NEW_TIME_NOTE,
  PICK_NEW_TIME_READY,
  blockerTitle,
  blockersCardCopy,
  errorPlacement,
  keepDepartedNames,
  moveForwardLabel,
  playoffFixLine,
  reconfirmView,
  showMoveForward,
  SUB_CARD_LINE_MAX_SCALE,
  type Blocker,
} from '@/lib/game/autoStart';
import { playoffStepperBounds, stepPlayoffTeams } from '@/lib/game/draftLobby';

// 3c-2 — the commissioner's blockers card (board #call-auto-start
// BlockersCard), what was the "Start the draft?" confirm: there is no Start
// button any more (the draft starts by itself). The warn-tint card says what
// stands in the way and by when (the room-open time, the real gate); each
// blocker is its own sub-card with its fix: the reconfirm choices, the
// playoff-teams stepper, or the invite code. Postponed: the same blockers,
// then "Pick a new draft time", disabled until nothing blocks.

export interface DraftBlockersCardProps {
  phase: 'risk' | 'postponed';
  /** "6:00 PM ET": the room-open time (risk) or the time it wasn't ready at (postponed). */
  deadlineLabel: string | null;
  /** The fixable blockers (autoStart.fixableBlockers), in the server's order. */
  blockers: Blocker[];
  memberCount: number;
  playoffTeams: number | null;
  onSetPlayoffTeams: (teams: number) => void;
  onReconfirm: (choice: 'move_forward' | 'invite') => void;
  inviteCode: string | null;
  /** Null while Share is hidden (inviteShareShown: from the hour before the draft); the code still shows. */
  onShareInvite: (() => void) | null;
  onPickNewTime: () => void;
  busy?: boolean;
  /** A fix that didn't save. Shown inside the sub-card of `errorOwner`, else at the foot. */
  error?: string | null;
  /** The blocker code whose sub-card holds the control that caused `error` (FixOwner). */
  errorOwner?: string | null;
}

/**
 * The board's accent text action ("Move forward with N instead", board #call-leave ReconfirmCard 'inviting'):
 * semibold accent text, not a Button. A 44pt target (the craft floor) with the text at its TOP: the card's gap
 * above is cancelled by `marginTop`, so the target starts flush under what precedes it and the label's ink sits
 * ~13pt under the Share button (a centred label in a 44pt target sits 25pt under it, Design Lead gate on #356).
 * The target and the Share button's never overlap. A saving choice shows the same spinner a Button's `loading`
 * shows, and the label keeps its place.
 */
function TextAction({ label, onPress, disabled, status }: { label: string; onPress: () => void; disabled: boolean; status: ButtonStatus }) {
  const { colors } = useTheme();
  const loading = status === 'loading';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled && !loading, busy: loading }}
      style={[styles.textAction, disabled && !loading ? styles.dim : null]}
    >
      {loading ? <ActivityIndicator size="small" color={colors.accent} /> : null}
      <Text variant="callout" color={colors.accent} maxFontSizeMultiplier={BUTTON_LABEL_MAX_SCALE} style={styles.semibold}>{label}</Text>
    </Pressable>
  );
}

export function DraftBlockersCard({
  phase, deadlineLabel, blockers, memberCount, playoffTeams, onSetPlayoffTeams, onReconfirm,
  inviteCode, onShareInvite, onPickNewTime, busy = false, error, errorOwner,
}: DraftBlockersCardProps) {
  const { colors } = useTheme();
  const copy = blockersCardCopy(phase, deadlineLabel);
  const { min, max } = playoffStepperBounds(memberCount);
  const current = playoffTeams ?? 0;

  // Which reconfirm button was tapped, so ITS button shows the spinner while the choice saves (the other
  // just dims). `busy` is one flag for every fix; this is the card's own memory of which one it was.
  const [tapped, setTapped] = useState<'move_forward' | 'invite' | null>(null);
  useEffect(() => {
    if (!busy) setTapped(null);
  }, [busy]);
  const choose = (c: 'move_forward' | 'invite') => {
    setTapped(c);
    onReconfirm(c);
  };
  const statusOf = (c: 'move_forward' | 'invite') => (busy && tapped === c ? 'loading' : 'idle');

  // The code over its Share: the invite sub-card and the not-enough-members one are the same row.
  const inviteRow = () =>
    inviteCode ? (
      <View style={styles.invite}>
        <Text variant="caption" tone="secondary" maxFontSizeMultiplier={codeLabelMaxScale('headline')}>Invite code</Text>
        <InviteCodeText variant="headline" selectable code={inviteCode} />
        {onShareInvite ? <Button label="Share invite code" variant="secondary" size="sm" onPress={onShareInvite} /> : null}
      </View>
    ) : null;

  const fixFor = (b: Blocker) => {
    if (b.code === 'roster_reconfirm_required') {
      const view = reconfirmView(b, memberCount);
      if (view.mode === 'inviting') {
        return (
          <>
            <Text variant="caption" maxFontSizeMultiplier={SUB_CARD_LINE_MAX_SCALE}>{view.line}</Text>
            {inviteRow()}
            {showMoveForward(view.members) ? (
              <TextAction label={view.moveForward} onPress={() => choose('move_forward')} disabled={busy} status={statusOf('move_forward')} />
            ) : null}
          </>
        );
      }
      return (
        <View style={styles.actions}>
          {showMoveForward(view.members) ? (
            <Button label={moveForwardLabel(view.members)} size="sm" onPress={() => choose('move_forward')} disabled={busy} status={statusOf('move_forward')} />
          ) : null}
          <Button label={INVITE_SOMEONE_NEW} variant="secondary" size="sm" onPress={() => choose('invite')} disabled={busy} status={statusOf('invite')} />
        </View>
      );
    }
    if (b.code === 'playoff_teams_exceeds_members') {
      const members = typeof b.members === 'number' ? b.members : memberCount;
      return (
        <>
          <Stepper
            label="Playoff teams"
            value={current}
            onStep={(d) => onSetPlayoffTeams(stepPlayoffTeams(current, d, members))}
            canDecrement={current > min}
            canIncrement={current < Math.min(max, members)}
            disabled={busy}
            emphasis="warn"
            labelMaxScale={SUB_CARD_LINE_MAX_SCALE}
          />
          <Text variant="caption" maxFontSizeMultiplier={SUB_CARD_LINE_MAX_SCALE}>{playoffFixLine(members)}</Text>
        </>
      );
    }
    if (b.code === 'not_enough_members') return inviteRow();
    return null;
  };

  const subCardTitle = (b: Blocker) => {
    if (b.code !== 'roster_reconfirm_required') return blockerTitle(b);
    const view = reconfirmView(b, memberCount);
    return keepDepartedNames(b, view.mode === 'inviting' ? view.title : blockerTitle(b));
  };
  // A refusal sits under the controls of the sub-card that caused it; the foot only when that sub-card is gone.
  const placement = errorPlacement(error, errorOwner, blockers);
  const errorLine = error ? (
    <Text variant="callout" maxFontSizeMultiplier={SUB_CARD_LINE_MAX_SCALE} color={colors.danger} accessibilityLiveRegion="polite">
      {error}
    </Text>
  ) : null;
  const blocked = blockers.length > 0;

  return (
    <View accessibilityRole="alert" style={[styles.card, { backgroundColor: colors.warnTint, borderColor: colors.warnLine }]}>
      <Text variant="tag" color={colors.warnText}>{keepTime(copy.tag)}</Text>
      <View style={styles.head}>
        <Text variant="headline" style={styles.bold}>{keepTime(copy.title)}</Text>
        <Text variant="caption" subOf="headline">{keepTime(copy.line)}</Text>
      </View>
      {blockers.map((b, i) => (
        <Card key={`${b.code}-${i}`} style={styles.blocker}>
          <Text variant="callout" subOf="headline" style={styles.bold}>{subCardTitle(b)}</Text>
          {fixFor(b)}
          {placement.subCard === i ? errorLine : null}
        </Card>
      ))}
      {phase === 'postponed' ? (
        <View style={styles.actions}>
          <Button label={PICK_NEW_TIME} onPress={onPickNewTime} disabled={blocked || busy} />
          <Text variant="caption" style={styles.center}>{blocked ? PICK_NEW_TIME_NOTE : PICK_NEW_TIME_READY}</Text>
        </View>
      ) : null}
      {placement.foot ? errorLine : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space[5],
    paddingVertical: space[4],
    gap: space[4],
  },
  head: {
    gap: space[1],
  },
  blocker: {
    borderRadius: radius.md,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[3],
  },
  actions: {
    gap: space[3],
  },
  invite: {
    gap: space[2],
  },
  bold: {
    fontFamily: typeFontFamily.bold,
  },
  semibold: {
    fontFamily: typeFontFamily.semiBold,
  },
  // 44pt target, label at its top; the negative margins cancel the card's gap above and its padding below.
  textAction: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: space[2],
    minHeight: 44,
    paddingTop: 9,
    marginTop: -space[3],
    marginBottom: -space[3],
  },
  dim: {
    opacity: 0.5,
  },
  center: {
    textAlign: 'center',
  },
});
