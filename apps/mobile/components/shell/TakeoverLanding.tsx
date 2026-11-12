/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';
import { Avatar } from '@/components/sp/Avatar';
import { Button } from '@/components/sp/Button';
import { Card } from '@/components/sp/Card';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { WARN_TEXT_MAX_SCALE, WarnPanel } from '@/components/sp/WarnPanel';
import { AuthScaffold } from '@/components/shell/AuthScaffold';
import { Link } from '@/components/shell/Link';
import { RefusalScreen } from '@/components/shell/RefusalScreen';
import { ScreenTitle } from '@/components/shell/ScreenTitle';
import { FIND_LEAGUE, TAKEOVER_TAP_TITLE, NOT_NOW, TAKE_THE_TEAM, takeoverQuestion } from '@/lib/account/deleteCopy';
import type { RateWait } from '@/lib/account/takeoverReply';
import { keepName } from '@/lib/account/keepName';
import { takeoverRefusal, waitLine } from '@/lib/account/takeoverRefusal';
import { recordLine, type TakeoverPreview } from '@/lib/account/takeoverView';
import { JOIN_COPY } from '@/lib/join/joinPreview';

// Account deletion (W4) — the takeover landing (board "Takeover landing"). The default avatar over "Take over the open
// team in {League}?" and the seat's record, centred in the space above the actions; "Take the team" and "Not now" dock at
// the bottom. Every dead end (taken, a dead link, already in, a wait, no connection) is a RefusalScreen of the same form.

const DISC = 64;

/**
 * The heading's own ceiling. At the `display` style's 1.6× (51pt) the old "Former manager's team in …" heading was ~460pt wide on a ~340pt
 * screen, so keeping each name on one line (keepName) was physically impossible and the iOS layout broke both names word
 * by word (F20 XXXL). At 1.15× (~37pt) both names fit on one line each; at Large (1.0) nothing changes. The heading is
 * now "Take over the open team in {League}?" (2026-11-06): shorter, so this cap is conservative; re-shoot F20 before
 * relaxing it. A longer league name
 * still wraps between its words (keepName leaves names over 20 characters breakable).
 */
export const TAKEOVER_TITLE_MAX_SCALE = 1.15;

/** One sentence capped so it stays a panel at XXXL. */
const LINK_MAX_SCALE = WARN_TEXT_MAX_SCALE;

export { waitLine };

export type TakeoverLandingState =
  | { kind: 'loading' }
  /** A scheme-origin link: nothing is looked up until the person taps (a preview counts its misses toward the code lockout, so any web page firing fantasystockapp://take/<random> could lock them out). */
  | { kind: 'tap' }
  | Exclude<TakeoverPreview, { kind: 'member' }>
  | { kind: 'member'; leagueName: string }
  | { kind: 'taking'; found: Extract<TakeoverPreview, { kind: 'found' }> };

export function TakeoverLanding({
  state, label, onTake, onNotNow, onHome, onOpen, onRetry, onFind, takeFailed,
}: {
  state: TakeoverLandingState;
  label: string;
  onTake: () => void;
  onNotNow: () => void;
  onHome: () => void;
  /** "Open the league" for someone already in it. */
  onOpen: () => void;
  onRetry: () => void;
  /** The tap that looks the seat up (a scheme-origin link). */
  onFind: () => void;
  /** The write came back unknown: say so under the buttons (the preview's own "couldn't reach" line). */
  takeFailed: 'unreachable' | RateWait | null;
}) {
  const { colors } = useTheme();

  // Every dead end takes ONE form (PRODUCT_RULES, "Every dead end on a takeover or invite link takes the same form"): the icon, the
  // heading, an optional line, the docked primary and an optional "Not now" (lib/account/takeoverRefusal.ts holds the mapping).
  if (state.kind === 'taken' || state.kind === 'dead' || state.kind === 'member' || state.kind === 'unknown' || state.kind === 'rate_limited') {
    const spec = takeoverRefusal(state);
    const run = { home: onHome, open: onOpen, retry: onRetry, notNow: onNotNow };
    return (
      <RefusalScreen
        icon={spec.icon}
        heading={spec.heading}
        line={spec.line}
        primary={{ label: spec.primary.label, onPress: run[spec.primary.action] }}
        secondary={spec.secondary ? { label: spec.secondary.label, onPress: run[spec.secondary.action] } : undefined}
      />
    );
  }

  // Decision 18's rule for takeovers: the shared https link previews by itself, a scheme link waits for this tap. Only words
  // that already ship: Join's "Find league" and the notifications ask's "Not now".
  if (state.kind === 'tap') {
    return (
      <AuthScaffold
        centerBody
        footer={
          <View style={styles.actions}>
            <Button label={FIND_LEAGUE} onPress={onFind} fullWidth />
            <Link label={NOT_NOW} onPress={onNotNow} muted />
          </View>
        }
      >
        {/* The arrival's layout: the person icon and the heading centred, the actions docked. The heading says what this is
            (UX rule 8) with the approved share text minus the league, which cannot be shown before the tap. */}
        <View style={styles.block}>
          <Avatar name={label} size={DISC} tone="neutral" />
          <ScreenTitle style={styles.title} maxFontSizeMultiplier={TAKEOVER_TITLE_MAX_SCALE}>{TAKEOVER_TAP_TITLE}</ScreenTitle>
        </View>
      </AuthScaffold>
    );
  }

  if (state.kind === 'loading') {
    return (
      <AuthScaffold centerBody>
        <ActivityIndicator color={colors.text2} accessibilityLabel="Loading" />
      </AuthScaffold>
    );
  }

  const found = state.kind === 'found' ? state : state.found;
  const taking = state.kind === 'taking';
  return (
    <AuthScaffold
      centerBody
      footer={
        <View style={styles.actions}>
          {takeFailed ? <WarnPanel text={takeFailed === 'unreachable' ? JOIN_COPY.unreachable : waitLine(takeFailed)} /> : null}
          <Button label={TAKE_THE_TEAM} status={taking ? 'loading' : 'idle'} onPress={onTake} fullWidth />
          <Link label={NOT_NOW} onPress={onNotNow} muted disabled={taking} />
        </View>
      }
    >
      <View style={styles.block}>
        <Avatar name={label} size={DISC} tone="neutral" />
        <ScreenTitle style={styles.title} maxFontSizeMultiplier={TAKEOVER_TITLE_MAX_SCALE}>{takeoverQuestion(keepName(found.leagueName))}</ScreenTitle>
        <Card style={styles.record}>
          <Text variant="headline" maxFontSizeMultiplier={LINK_MAX_SCALE} style={styles.num}>
            {recordLine(found.wins, found.losses, found.rank)}
          </Text>
        </Card>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  block: {
    alignItems: 'center',
    gap: space[4],
  },
  title: {
    textAlign: 'center',
  },
  record: {
    paddingHorizontal: space[6],
    paddingVertical: space[4],
  },
  num: {
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  actions: {
    gap: space[3],
  },
});
