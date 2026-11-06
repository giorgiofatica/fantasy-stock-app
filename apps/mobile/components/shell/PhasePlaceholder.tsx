/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';
import { EmptyState, type EmptyStateIconProps } from '@/components/sp/EmptyState';
import { useTheme } from '@/components/sp/ThemeProvider';
import { ShellHeader } from '@/components/shell/ShellHeader';
import { BarsRefresh } from '@/components/shell/BarsRefresh';

// Phase 3b-1 — the honest placeholder for a tab whose real screen belongs to
// a later phase (spec row 16: Matchup → 3c, League → 3c, Portfolio → 3e,
// Home's league state → 3b-2). It says plainly that the screen is coming,
// shows the active league's phase through the shared PhaseChip, and keeps
// the shell (header, pill, tab bar) fully working around it. No old screen
// is restyled piecemeal.

export interface PhasePlaceholderProps {
  title: string;
  icon: (props: EmptyStateIconProps) => ReactNode;
  heading: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  /** S5: pull to refresh with the rising bars. Without it the page still scrolls, with the top bar in it. */
  onRefresh?: () => Promise<void>;
  /** Drawn INSIDE a tab's own scroll content (Home's and Matchup's failed or not-started body): just the message, with no
   * bar and no scroll view of its own, because the tab already has both (a second bar would sit under the first). */
  embedded?: boolean;
}

export function PhasePlaceholder({
  title,
  icon,
  heading,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  onRefresh,
  embedded = false,
}: PhasePlaceholderProps) {
  const { colors } = useTheme();

  const body = (
    <EmptyState
      icon={icon}
      title={heading}
      message={message}
      actionLabel={actionLabel}
      onAction={onAction}
      secondaryActionLabel={secondaryActionLabel}
      onSecondaryAction={onSecondaryAction}
    />
  );

  if (embedded) return <View style={styles.embedded}>{body}</View>;

  return (
    // The same top bar as every tab (the league pill, your avatar; no phase chip), scrolling away with the page
    // (the board's "A for both", 2026-11-06).
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <BarsRefresh onRefresh={onRefresh} header={<ShellHeader title={title} showAvatar />} contentContainerStyle={styles.content}>
        {body}
      </BarsRefresh>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  embedded: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: space[10],
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: space[5],
    paddingBottom: space[10],
  },
});
