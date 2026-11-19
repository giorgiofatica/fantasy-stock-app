/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { Fragment, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';

import { space } from '@/constants/tokens';
import { Text } from '@/components/sp/Text';
import { GroupHead, PlayerCard, RosterRow, type PlayerCardOwnership } from '@/components/sp/gn';
import { LINE_MAX_SCALE } from '@/components/sp/gn/Scoreboard';
import { RosterRowsSkeleton } from '@/components/game/LoadingSkeletons';
import { LoadFailure } from '@/components/money/LoadFailure';
import { useStockSheet } from '@/components/money/MoneyHost';
import { useLeagueContext } from '@/lib/LeagueContext';
import { leagueHasWeeks } from '@/lib/game/leagueWeeks';
import { isSeasonOver } from '@/lib/weekStatus';
import { COPY as MONEY_COPY } from '@/lib/money/moneyCopy';
import type { LineupRow } from '@/lib/game/lineupLedger';
import type { LiveSnapshot, LiveTrade } from '@/lib/home/liveWeekScore';
import type { BarsBySymbol } from '@/lib/home/buildHomeViewModel';
import type { MarketCalendarSession } from '@/lib/time/marketWeek';
import { resolveWeekWindow } from '@/lib/time/marketWeek';
import { cardSlotPill, closesBefore, lastWeekClose, orderBarsAt, weekSessions } from '@/lib/game/matchupRoster';
import { buildRosterView, buildWithheldView, orderLabel, WITHHELD_LINE, type RosterSideInput } from '@/lib/game/matchupRosterView';
import type { RosterData } from '@/lib/game/useRosterData';
import { openingOf, playerCardData } from '@/lib/game/playerCardModel';
import { fixtureSeasonBars, fixtureWeekBars } from '@/lib/game/matchupFixture';
import { MATCHUP_FIXTURE_VARIANT, SEAM_ON } from '@/lib/game/devSeam';
import { decideTradeGate } from '@/lib/money/tradeGate';
import { marketOpensLabel } from '@/lib/money/marketOpensLabel';
import { useCaptureAction } from '@/lib/money/captureScript';

// The Matchup roster (W4) and the player card it opens, moved out of app/(tabs)/matchup.tsx
// so the live tab and the recap's week detail (app/matchup-week, via FinishedWeek) draw the
// SAME rows. Everything it needs is passed in: the two sides' week ledgers, the clock, the
// bars and quotes, so a past week reads its own week and never Home's current one.

/** One side's week: the snapshot rows and the window's trades the score is made of. */
export interface RosterLedger {
  snapshots: readonly LiveSnapshot[];
  trades: readonly LiveTrade[];
}

/** The clock and prices a roster reads (Home's raw inputs on the tab). */
export interface RosterEnv {
  now: Date;
  bars: BarsBySymbol;
  quote: (symbol: string) => number | null;
  marketCalendar: MarketCalendarSession[];
}

/** A side of the roster: the left side is `left` (you on the tab), the right side `right`. */
export interface RosterSide {
  userId: string;
  name: string;
  /** True when this side is the signed-in manager (the card offers Sell, never an owner name). */
  isYou: boolean;
  rows: LineupRow[];
  ledger: RosterLedger;
  /** liveWeekScore's unpriced symbols (live rows only; [] for a final week). */
  unpriced: readonly string[];
}

export interface MatchupRosterProps {
  left: RosterSide;
  /** null = a bye week: the left side's stocks in one column (#call-mx-bye, B). */
  right: RosterSide | null;
  final: boolean;
  weekEnd: string | null;
  env: RosterEnv;
  roster: RosterData;
  /** The last focus or pull-to-refresh: no close that settled after it may reorder. */
  orderAsOf: Date;
  /** Capture seam only: the Home fixture's next open (the shell fixture has no market row). */
  seamResumesAt: string | null;
  /** Capture seam only: is the fixture's market open. */
  seamMarketOpen: boolean;
}

/** Capture seam: the fixture's daily path up to Wednesday, then Home's own bars after it
 * (Thursday's close lives there), so a closed Thursday shows its close. */
function seamBars(symbol: string, homeBars: readonly { date: string; close: number }[]): { date: string; close: number }[] {
  const path = fixtureWeekBars(symbol, MATCHUP_FIXTURE_VARIANT).length ? fixtureSeasonBars(symbol, MATCHUP_FIXTURE_VARIANT) : [];
  const last = path.length ? path[path.length - 1].date : '';
  return [...path, ...homeBars.filter((b) => b.date > last)];
}

type Side = 'me' | 'opp';

/** The roster and the player card it opens. */
export function MatchupRoster({ left, right, final, weekEnd, env, roster, orderAsOf, seamResumesAt, seamMarketOpen }: MatchupRosterProps) {
  const { market, activeLeague, marketCalendar } = useLeagueContext();
  const stockSheet = useStockSheet();
  const [selected, setSelected] = useState<{ side: Side; symbol: string } | null>(null);
  // The card stays mounted while it leaves, with the stock it was showing.
  const [shown, setShown] = useState<{ side: Side; symbol: string } | null>(null);
  const pendingSell = useRef<{ symbol: string; name: string } | null>(null);
  // DEV capture only (captureScript, EXPO_PUBLIC_CAPTURE_SCRIPT=card:NVDA@ms): the tap a left-side row runs.
  useCaptureAction('card', (sym) => {
    if (!sym) return;
    setSelected({ side: 'me', symbol: sym.toUpperCase() });
    setShown({ side: 'me', symbol: sym.toUpperCase() });
  });

  const sides = useMemo(() => {
    // Live rows: a partly unpriced stock's row is only its sale (unknown on the roster). Final
    // rows are the posted week's own, which reconcile, so nothing is unknown there.
    const toInput = (s: RosterSide): RosterSideInput => ({ userId: s.userId, lineup: s.rows, snapshots: s.ledger.snapshots, trades: s.ledger.trades, unpriced: final ? [] : s.unpriced });
    return { me: toInput(left), opp: right ? toInput(right) : null };
  }, [left, right, final]);

  const now = env.now;
  const sessions = useMemo(() => {
    const win = weekEnd ? resolveWeekWindow(weekEnd, env.marketCalendar) : null;
    return win ? weekSessions(win.weekStart, win.weekEnd, env.marketCalendar) : [];
  }, [weekEnd, env.marketCalendar]);
  // The order's clock: the week's closes so far, latest first. The roster orders by the
  // latest one SETTLED in the fetched bars (matchupRoster.orderingClose) — never a quote,
  // never a bar fetched before its close. A final week reads Friday's.
  const closes = useMemo(() => closesBefore(now, sessions), [now, sessions]);
  // The final rows' percent is measured at the week's last close.
  const close = useMemo(() => lastWeekClose(now, sessions), [now, sessions]);
  // A row's percent: live, or at the week's close once final.
  const closeOn = close?.date ?? '';
  const rowPrice = (symbol: string) => (final ? env.bars[symbol]?.find((b) => b.date === closeOn)?.close ?? env.quote(symbol) : env.quote(symbol));

  const ready = roster.ledgerStatus === 'ready' && roster.slots.status === 'ready' && roster.ledger;
  const view = useMemo(() => {
    if (!ready || !roster.ledger) return null;
    return buildRosterView({
      me: sides.me,
      opp: sides.opp,
      activity: roster.ledger.activity,
      names: roster.ledger.symbol_names,
      slots: roster.slots.slots,
      slotOf: roster.slots.bySide,
      closes,
      bars: env.bars,
      // env.now is stamped when the fetch (bars included) returns; the order never runs ahead
      // of the last focus or pull-to-refresh, so a poll can't reorder under your eyes.
      barsAt: orderBarsAt(env.now, orderAsOf, SEAM_ON),
    });
  }, [ready, roster.ledger, roster.slots, sides, closes, env, orderAsOf]);

  // The card's data for the stock it's showing (null: no opening event in the ledger).
  const card = useMemo(() => {
    if (!shown || !roster.ledger) return null;
    const side = shown.side === 'me' ? sides.me : sides.opp;
    if (!side) return null;
    const row = side.lineup.find((r) => r.symbol.toUpperCase() === shown.symbol);
    const price = rowPrice(shown.symbol);
    if (!row || price == null) return null;
    const data = playerCardData({
      symbol: shown.symbol,
      company: roster.ledger.symbol_names[shown.symbol] ?? '',
      userId: side.userId,
      activity: roster.ledger.activity,
      snapshots: side.snapshots,
      trades: side.trades,
      weekGain: row.cents / 100,
      // The same gate as Portfolio's card. (Unreachable without weeks today: a league with no
      // matchups reads as pre_season, whose view has no roster; this keeps it structural.)
      hasWeeks: leagueHasWeeks(activeLeague?.league_type),
      price,
      // Under the capture seam the fixture's own daily bars (a real move every day); MSFT, bought
      // this week in the 'bought' fixture, has its bars in Home's raw inputs.
      bars: SEAM_ON ? seamBars(shown.symbol, env.bars[shown.symbol] ?? []) : env.bars[shown.symbol] ?? [],
      now,
    });
    if (!data) return null;
    const slotId = roster.slots.bySide[side.userId]?.[shown.symbol] ?? null;
    const pill = cardSlotPill(roster.slots.slots.find((s) => s.id === slotId) ?? null);
    return { data, pill };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, roster.ledger, roster.slots, sides, now, env, final, activeLeague?.league_type]);

  // Sell is live only while the market is open (the trade gate fails closed); the capture
  // seam plays the Home fixture's own market.
  const gate = decideTradeGate(new Date(), market);
  const marketOpen = SEAM_ON ? seamMarketOpen : gate.open;
  const opens = marketOpensLabel(SEAM_ON ? seamResumesAt : market?.next_open_at ?? null);

  if (roster.ledgerStatus === 'error' || roster.slots.status === 'error') {
    return <LoadFailure title="Couldn't load this matchup" message={MONEY_COPY.loadRetryMessage} onRetry={roster.retry} />;
  }
  if (!view) return <RosterRowsSkeleton />;

  const open = (side: Side, symbol: string) => {
    setSelected({ side, symbol });
    setShown({ side, symbol });
  };
  // A half opens the card only when the card can be whole (the ledger names how the stock
  // was got, and it has a price); otherwise it isn't pressable at all — never a dead tap.
  const activity = roster.ledger?.activity ?? [];
  const openable = (side: Side, symbol: string) =>
    openingOf(side === 'me' ? left.userId : right?.userId ?? '', symbol, activity) !== null && rowPrice(symbol) != null;
  const half = (side: Side, c: { symbol: string; company: string; weekGain: number | null; weekPct: number | null } | null) =>
    c ? { ticker: c.symbol, company: c.company, weekGain: c.weekGain, weekPct: c.weekPct, onPress: openable(side, c.symbol) ? () => open(side, c.symbol) : undefined } : null;

  let ownership: PlayerCardOwnership | null = null;
  if (card && shown) {
    const owner = shown.side === 'me' ? left : right;
    if (owner && !owner.isYou) {
      // No watchlist exists in the app yet, so there's nothing to save to: Save is not drawn.
      ownership = { owner: { name: owner.name }, save: null };
    } else if (card.data.held > 0 && !isSeasonOver(activeLeague, new Date(), marketCalendar)) {
      // A season that is over is closed to trading: the card has no Sell (the server refuses it too).
      ownership = {
        owner: 'you',
        onSell: () => {
          // The stock sheet (Sell selected for a held stock) opens once the card has left.
          pendingSell.current = { symbol: card.data.ticker, name: card.data.company };
          setSelected(null);
        },
      };
    } else {
      ownership = { owner: 'you', sold: true };
    }
  }

  return (
    <View style={styles.roster}>
      {/* The close the order is using (#call-mx-order, B); none while the draft order holds. */}
      {view.orderedBy ? (
        <Text variant="caption" tone="secondary" maxFontSizeMultiplier={LINE_MAX_SCALE} style={styles.center} testID="roster-ordered-by">
          {orderLabel(view.orderedBy)}
        </Text>
      ) : null}
      {view.groups.map((g, gi) => (
        <Fragment key={g.label ?? `group-${gi}`}>
          {g.label ? <GroupHead label={g.label} /> : null}
          {g.rows.map((r, ri) => (
            <RosterRow
              key={`${r.left?.symbol ?? '-'}|${r.right?.symbol ?? '-'}|${ri}`}
              left={half('me', r.left)}
              right={half('opp', r.right)}
              opponentName={right?.name ?? ''}
              single={!sides.opp}
              markEmpty={g.label !== null}
            />
          ))}
        </Fragment>
      ))}
      {card && ownership ? (
        <PlayerCard
          {...card.data}
          {...ownership}
          {...(card.pill ?? {})}
          visible={selected !== null}
          onClose={() => setSelected(null)}
          onClosed={() => {
            setShown(null);
            const sell = pendingSell.current;
            pendingSell.current = null;
            if (sell) stockSheet.open(sell.symbol, { name: sell.name });
          }}
          sessions={sessions}
          now={now}
          marketOpen={marketOpen}
          opens={opens}
        />
      ) : null}
    </View>
  );
}

/** A final week whose per-stock rows don't reconcile (#call-mx-withheld, B): the line, then
 * both lineups as ticker + company with no figures, in draft order, the left side shaded. */
export function WithheldRoster({ roster, left, right }: {
  roster: RosterData;
  left: { userId: string; ledger: RosterLedger };
  right: { userId: string; name: string; ledger: RosterLedger };
}) {
  if (roster.ledgerStatus === 'error') {
    return <LoadFailure title="Couldn't load this matchup" message={MONEY_COPY.loadRetryMessage} onRetry={roster.retry} />;
  }
  if (!roster.ledger) return <RosterRowsSkeleton />;
  const symbolsOf = (l: RosterLedger) => [...l.snapshots.map((x) => x.symbol), ...l.trades.filter((t) => t.action === 'buy').map((t) => t.symbol)];
  const group = buildWithheldView({
    me: { userId: left.userId, symbols: symbolsOf(left.ledger) },
    opp: { userId: right.userId, symbols: symbolsOf(right.ledger) },
    activity: roster.ledger.activity,
    names: roster.ledger.symbol_names,
  });
  const half = (c: { symbol: string; company: string } | null) => (c ? { ticker: c.symbol, company: c.company, weekGain: null, weekPct: null, figures: false } : null);
  return (
    <View style={styles.roster}>
      <Text variant="caption" tone="secondary" maxFontSizeMultiplier={LINE_MAX_SCALE} style={styles.center} testID="roster-withheld">{WITHHELD_LINE}</Text>
      {group.rows.map((r, i) => (
        <RosterRow key={`${r.left?.symbol ?? '-'}|${r.right?.symbol ?? '-'}|${i}`} left={half(r.left)} right={half(r.right)} opponentName={right.name} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // The board: rows 6pt apart (8 on the 4pt scale), separated by space, never a line.
  roster: { gap: space[3] },
  center: { textAlign: 'center' },
});
