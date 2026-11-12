/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, space, typeFontFamily } from '@/constants/tokens';
import { Avatar } from '@/components/sp/Avatar';
import { Icon } from '@/components/sp/Icon';
import { Text } from '@/components/sp/Text';
import { NBSP, keepDots } from '@/lib/game/keepDots';
import { useLargeText } from '@/components/sp/useLargeText';
import { useTheme } from '@/components/sp/ThemeProvider';
import {
  EXAMPLE_CAP,
  EXAMPLE_PRICES,
  EXAMPLE_STAKE,
  exampleCapTotal,
  exampleMoney,
  exampleShares,
  type ExampleTicker,
  type InfoKey,
} from '@/lib/game/infoPopups';

// Page 2 of an "i" popup: the picture (the Design Lead's board, docs/design/screens/info-i.jsx, VisMatchup …
// VisDraftable). Example numbers only (the board's fixture league): they show how a mode works, never anyone's
// real result. Every number is drawn from lib/game/infoPopups.ts, the same source as the VoiceOver description, so
// what is drawn and what is spoken cannot drift apart. The labels inside a picture stop at 1.4x so the diagram keeps its
// shape at the accessibility sizes (the board's VIS); the line on page 1 is the part that grows the whole way.

/** The picture's labels stop here (the board's VIS). */
const VIS = 1.4;

type VProps = { children: ReactNode; variant?: 'callout' | 'caption' | 'tag' | 'ticker.tile' } & Omit<React.ComponentProps<typeof Text>, 'variant' | 'maxFontSizeMultiplier'>;

/** One label inside a picture. */
function V({ children, variant = 'callout', ...rest }: VProps) {
  return (
    <Text variant={variant} maxFontSizeMultiplier={VIS} {...rest}>
      {children}
    </Text>
  );
}
const Strong = ({ style, ...rest }: VProps) => <V {...rest} style={[styles.bold, style]} />;

/** A small bordered tile: the board's `surface` + 1pt border. */
function Tile({ children, tint, style }: { children: ReactNode; tint?: boolean; style?: React.ComponentProps<typeof View>['style'] }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: tint ? colors.accentTint : colors.surface, borderColor: colors.border }, style]}>{children}</View>
  );
}

/** A name never breaks inside itself ("Elena M.", "4 or 5"): no-break spaces; the tile wraps between names instead. */
const whole = (text: string) => text.replace(/ /g, NBSP);

/** A tile of two lines: a seed and a name, then another (the bracket's pairs). */
function Pair({ a, b }: { a: [string, string]; b: [string, string] | string }) {
  return (
    <Tile>
      <V variant="caption"><Strong variant="caption">{a[0]}</Strong>{` ${whole(a[1])}`}</V>
      {typeof b === 'string' ? (
        <V variant="caption" tone="secondary">{whole(b)}</V>
      ) : (
        <V variant="caption" tone="secondary"><Strong variant="caption" tone="secondary">{b[0]}</Strong>{` ${whole(b[1])}`}</V>
      )}
    </Tile>
  );
}

function MatchupPicture() {
  const { colors } = useTheme();
  const row = (name: string, who: string, gain: string, win: boolean, you: boolean) => (
    <View style={styles.matchRow} key={who}>
      <Avatar name={who} size={24} tone={you ? 'you' : 'opp'} />
      <View style={styles.grow}>
        <V style={win ? styles.bold : undefined}>{name}</V>
      </View>
      <Strong color={gain.startsWith('+') ? colors.gain : colors.loss} style={styles.tabular}>{gain}</Strong>
      <View style={styles.winMark}>{win ? <Strong variant="caption" color={colors.gain}>W</Strong> : null}</View>
    </View>
  );
  return (
    <View style={styles.stack10}>
      <V variant="tag" tone="secondary">Week 3</V>
      <View>
        {row('You', 'Roberto B.', '+$24.10', true, true)}
        {row('Marco R.', 'Marco R.', '−$8.30', false, false)}
      </View>
      <View style={[styles.rule, { backgroundColor: colors.border }]} />
      <V variant="tag" tone="secondary">After the regular season</V>
      <View style={styles.bracketRow}>
        <View style={styles.pairs}>
          <Pair a={['1', 'You']} b={['4', 'Elena M.']} />
          <Pair a={['2', 'Luca C.']} b={['3', 'Marco R.']} />
        </View>
        <Icon name="chevronRight" size="body" tone="text" />
        <View style={[styles.finalChip, { backgroundColor: colors.accentTint }]}>
          <Strong variant="caption">Final</Strong>
        </View>
      </View>
    </View>
  );
}

function EqualPicture() {
  const { colors } = useTheme();
  const tickers: ExampleTicker[] = ['F', 'NVDA', 'COST'];
  return (
    <View style={styles.stack10}>
      {tickers.map((t) => (
        <View key={t} style={styles.stack4}>
          <View style={styles.baseRow}>
            <V variant="ticker.tile">{t}</V>
            <V tone="secondary" style={styles.tabular}>{exampleMoney(EXAMPLE_PRICES[t])}</V>
            <View style={styles.grow} />
            <V tone="secondary" style={styles.tabular}>{`${exampleShares(t).toFixed(2)} shares`}</V>
          </View>
          <View style={[styles.stakeBar, { backgroundColor: colors.accent }]}>
            <V variant="caption" color={colors.onAccent} style={[styles.bold, styles.tabular]}>{`$${EXAMPLE_STAKE.toLocaleString('en-US')}`}</V>
          </View>
        </View>
      ))}
    </View>
  );
}

function TiersPicture() {
  const { colors } = useTheme();
  const rows: [string, string, ExampleTicker][] = [
    ['Slot 1', 'Under $50', 'F'],
    ['Slot 2', '$50 to $300', 'NVDA'],
    ['Slot 3', '$300 and up', 'COST'],
  ];
  return (
    <View style={styles.stack8}>
      {rows.map(([slot, range, t]) => (
        <View key={slot} style={[styles.tierRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.tierLeft}>
            <Strong>{slot}</Strong>
            <V variant="caption" tone="secondary" style={styles.tabular}>{range}</V>
          </View>
          <View style={styles.tierRight}>
            <V variant="ticker.tile">{t}</V>
            <V variant="caption" tone="secondary" style={styles.tabular}>{keepDots(`${exampleMoney(EXAMPLE_PRICES[t])} · 1 share`)}</V>
          </View>
        </View>
      ))}
    </View>
  );
}

function CapPicture() {
  const { colors } = useTheme();
  const tickers: ExampleTicker[] = ['F', 'NVDA', 'MSFT', 'COST'];
  const tone = [colors.text2, colors.accent, colors.youText, colors.gain];
  const total = exampleCapTotal(tickers);
  return (
    <View style={styles.stack8}>
      <View style={styles.spreadBase}>
        <Strong style={styles.tabular}>{exampleMoney(total)}</Strong>
        <V tone="secondary" style={styles.tabular}>{`Cap ${exampleMoney(EXAMPLE_CAP).replace('.00', '')}`}</V>
      </View>
      <View style={[styles.capBar, { backgroundColor: colors.track, borderColor: colors.border }]}>
        {tickers.map((t, i) => (
          <View key={t} style={{ width: `${(EXAMPLE_PRICES[t] / EXAMPLE_CAP) * 100}%`, backgroundColor: tone[i], borderRightWidth: 2, borderRightColor: colors.surface }} />
        ))}
      </View>
      <View style={styles.legend}>
        {tickers.map((t, i) => (
          <View key={t} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: tone[i] }]} />
            <V variant="caption" style={styles.bold}>{t}</V>
            <V variant="caption" tone="secondary" style={styles.tabular}>{exampleMoney(EXAMPLE_PRICES[t])}</V>
          </View>
        ))}
      </View>
      <V variant="caption" tone="secondary" style={styles.tabular}>{`${exampleMoney(EXAMPLE_CAP - total)} left under the cap`}</V>
    </View>
  );
}

function OrderPicture() {
  const people: [string, string][] = [['Marco R.', 'Marco R.'], ['Luca C.', 'Luca C.'], ['Roberto B.', 'You'], ['Elena M.', 'Elena M.']];
  const round = (label: string, dir: 1 | -1) => (
    <View style={styles.stack6} key={label}>
      <V variant="tag" tone="secondary">{label}</V>
      <View style={styles.orderRow}>
        {people.map(([name, shown], k) => (
          <View key={name} style={styles.orderItem}>
            {k ? <Icon name={dir > 0 ? 'chevronRight' : 'chevronLeft'} size="callout" tone="text2" /> : null}
            <View style={styles.orderPick}>
              <Avatar name={name} size={26} tone={shown === 'You' ? 'you' : 'opp'} />
              <Strong variant="caption" style={styles.tabular}>{`Pick ${dir > 0 ? k + 1 : 8 - k}`}</Strong>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
  return (
    <View style={styles.stack12}>
      {round('Round 1', 1)}
      {round('Round 2', -1)}
    </View>
  );
}

function PlayoffsPicture() {
  // At the large text sizes three columns cannot hold their words ("Semifinals" and "4 Elena M." broke inside themselves at
  // AX5): the rounds stack, each a label over its tiles, the way the app's other side-by-side layouts stack (logic/largeText.ts).
  const stacked = useLargeText();
  const col = (label: string, items: ReactNode) => (
    <View style={stacked ? styles.bracketColStacked : styles.bracketCol} key={label}>
      <Strong variant="caption" tone="secondary">{label}</Strong>
      <View style={stacked ? styles.bracketTilesStacked : styles.bracketTiles}>{items}</View>
    </View>
  );
  return (
    <View style={stacked ? styles.bracketStacked : styles.bracket}>
      {col('Wild card', (
        <>
          <Tile><Strong variant="caption">{keepDots('1 · bye')}</Strong></Tile>
          <Pair a={['4', 'Elena M.']} b={['5', 'Sara T.']} />
          <Tile><Strong variant="caption">{keepDots('2 · bye')}</Strong></Tile>
          <Pair a={['3', 'Marco R.']} b={['6', 'Dario N.']} />
        </>
      ))}
      {col('Semifinals', (
        <>
          <Pair a={['1', 'You']} b="4 or 5" />
          <Pair a={['2', 'Luca C.']} b="3 or 6" />
        </>
      ))}
      {col('Final', (
        <Tile tint>
          <Strong variant="caption">The two</Strong>
          <V variant="caption" tone="secondary">winners</V>
        </Tile>
      ))}
    </View>
  );
}

function DraftablePicture() {
  const { colors } = useTheme();
  const chip = (text: string, muted = false) => (
    <View key={text} style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {muted ? <V variant="caption" tone="secondary" style={styles.semi}>{text}</V> : <V variant="ticker.tile">{text}</V>}
    </View>
  );
  return (
    <View style={[styles.dashed, { borderColor: colors.borderStrong }]}>
      <V variant="tag" tone="secondary">{keepDots('On · every US stock')}</V>
      <View style={[styles.draftableInner, { backgroundColor: colors.accentTint }]}>
        <V variant="tag">{keepDots('Off · draftable stocks only')}</V>
        <View style={styles.chips}>{['AAPL', 'NVDA', 'COST', 'F'].map((t) => chip(t))}</View>
      </View>
      <View style={styles.chips}>{[chip('a $0.40 stock', true), chip('a $90 million company', true)]}</View>
    </View>
  );
}

const PICTURES: Record<InfoKey, () => React.JSX.Element> = {
  matchup: MatchupPicture,
  equal: EqualPicture,
  tiers: TiersPicture,
  cap: CapPicture,
  order: OrderPicture,
  playoffs: PlayoffsPicture,
  draftable: DraftablePicture,
};

/** Page 2's picture for an option. The wrapper (the inset panel, the spoken description) is the popup's. */
export function InfoPicture({ info }: { info: InfoKey }) {
  const Picture = PICTURES[info];
  return <Picture />;
}

const styles = StyleSheet.create({
  bold: { fontFamily: typeFontFamily.bold },
  semi: { fontFamily: typeFontFamily.semiBold },
  tabular: { fontVariant: ['tabular-nums'] },
  grow: { flex: 1, minWidth: 0 },
  stack4: { gap: space[2] },
  stack6: { gap: 6 },
  stack8: { gap: space[3] },
  stack10: { gap: 10 },
  stack12: { gap: space[4] },
  rule: { height: 1 },
  baseRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: space[3] },
  spreadBase: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', columnGap: space[3] },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 34 },
  winMark: { width: 22, alignItems: 'center' },
  bracketRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[3] },
  pairs: { flexGrow: 1, flexShrink: 1, gap: 6, minWidth: 120 },
  finalChip: { paddingHorizontal: space[4], paddingVertical: space[3], borderRadius: radius.md },
  tile: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space[3], paddingVertical: space[2], minWidth: 0 },
  stakeBar: { minHeight: 18, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: space[3] },
  tierRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: space[3], borderRadius: radius.md, borderWidth: 1 },
  tierLeft: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  tierRight: { alignItems: 'flex-end' },
  capBar: { height: 22, borderRadius: radius.sm, flexDirection: 'row', overflow: 'hidden', borderWidth: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space[5], rowGap: space[2] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  orderRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', rowGap: space[3] },
  orderItem: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  orderPick: { alignItems: 'center', gap: space[1] },
  bracket: { flexDirection: 'row', gap: space[3], alignItems: 'center' },
  bracketCol: { flex: 1, minWidth: 0, gap: 6, justifyContent: 'center' },
  bracketTiles: { gap: 6 },
  bracketStacked: { gap: space[4] },
  bracketColStacked: { gap: 6 },
  bracketTilesStacked: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dashed: { borderWidth: 2, borderStyle: 'dashed', borderRadius: radius.lg, padding: 10, gap: space[3] },
  draftableInner: { borderRadius: radius.md, padding: 10, gap: space[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 3 },
});
