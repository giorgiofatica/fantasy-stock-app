/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { Pressable, StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';

import { space } from '@/constants/tokens';
import { Avatar } from '@/components/sp/Avatar';
import { LeaguePill } from '@/components/shell/LeaguePill';
import { ScreenTitle } from '@/components/shell/ScreenTitle';
import { useScreenTopInset } from '@/components/shell/ScreenPresentation';
import { useLeagueContext } from '@/lib/LeagueContext';
import { useSession } from '@/lib/SessionProvider';
import { profileFromPathname, profileHref } from '@/lib/shell/profileBack';

// Phase 3b-1 — every tab's header (spec row 10; DESIGN_DIRECTION §3 IA):
// the league pill on the left of every league-scoped header and the avatar
// on the right (Profile left the tab bar; the avatar is its entry). With no
// leagues there is nothing to scope, so the header shows the screen's title
// instead of a pill (board "Home with no leagues").
//
// The top bar (Giorgio, 2026-11-06, "A for both"): the SAME bar on every tab,
// Portfolio included, and no tab shows a phase chip in it (each tab's own
// content says the phase). It is the first thing inside the tab's scroll
// content (BarsRefresh's `header`), so it scrolls away with the page. A
// sub-screen with its own back control (Stock search, Trade history) passes
// no `showAvatar`: Profile is a tab-level entry, and the back control is there.

export interface ShellHeaderProps {
  /** Shown when there is no active league (zero leagues). */
  title: string;
  /** Every tab: the avatar that opens Profile. Omitted only on a sub-screen that has a back control. */
  showAvatar?: boolean;
}

export function ShellHeader({ title, showAvatar = false }: ShellHeaderProps) {
  // None inside an iOS page sheet (Trade history), which already starts below the status bar; a tab keeps it.
  const topInset = useScreenTopInset();
  const { activeLeague, leagues, loading } = useLeagueContext();
  const { username, user } = useSession();
  const displayName = username ?? user?.email ?? '';
  // Profile's back link names the tab it came from (W8 F3): the pathname at the moment of the tap.
  const pathname = usePathname();

  return (
    <View style={[styles.header, { paddingTop: topInset + space[3] }]}>
      {activeLeague ? (
        <LeaguePill name={activeLeague.name} totalLeagues={leagues.length} />
      ) : loading ? (
        // Leagues still loading (e.g. right after sign-in): hold the pill's
        // place rather than flash the no-leagues title and swap it out.
        <View style={styles.pending} />
      ) : (
        <ScreenTitle style={styles.title}>{title}</ScreenTitle>
      )}
      {showAvatar ? (
        <Pressable
          onPress={() => router.push(profileHref(profileFromPathname(pathname)))}
          accessibilityRole="button"
          accessibilityLabel="Profile"
          hitSlop={4}
        >
          <Avatar name={displayName} size={36} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[4],
    paddingHorizontal: space[5],
    paddingBottom: space[4],
  },
  title: {
    flexShrink: 1,
  },
  pending: {
    minHeight: 36,
  },
});
