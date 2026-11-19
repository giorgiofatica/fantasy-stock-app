/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { StyleSheet } from 'react-native';

import { space } from '@/constants/tokens';
import { useTheme } from '@/components/sp/ThemeProvider';
import { Text } from '@/components/sp/Text';
import { Card } from '@/components/sp/Card';
import { Avatar } from '@/components/sp/Avatar';
import { YOUR_NAME_WEIGHT } from '@/lib/game/managerRow';
import { COPY } from '@/lib/game/gameCopy';

/** All matchups' bye: the team (yours shaded, as on its Scoreboard) and COPY.byeNoResult.
 * Moved out of app/(tabs)/matchup.tsx so the Matchup recap's All matchups draws the same row.
 * `line` replaces the bye line for a game with no result to show (the recap's never-posted
 * game: the season tile's dash), still neutral and not tappable. */
export function ByeGame({ name, mine, line = COPY.byeNoResult }: { name: string; mine: boolean; line?: string }) {
  const { colors } = useTheme();
  return (
    <Card style={[styles.bye, mine ? { backgroundColor: colors.youTint } : null]} accessible accessibilityLabel={`${name}, ${line}`}>
      <Avatar name={name} size={32} tone={mine ? 'you' : 'opp'} ring={mine} />
      <Text variant="callout" numberOfLines={1} style={[styles.byeName, mine ? styles.byeNameMine : null]}>{name}</Text>
      <Text variant="caption" tone="secondary" numberOfLines={1}>{line}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  bye: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[5], paddingVertical: space[4] },
  byeName: { flex: 1, minWidth: 0, fontWeight: '600' },
  byeNameMine: { fontWeight: YOUR_NAME_WEIGHT },
});
