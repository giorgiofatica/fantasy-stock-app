/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
/**
 * PortfolioScreen: the Portfolio tab (3e; W4, Game Night). Renders usePortfolioData's view
 * and nothing else: every figure comes from portfolioView, the line from portfolioChart.
 *
 * Game Night (§9C, the board's Portfolio frame, A): the money page (`moneyBg`); the hero is
 * "Portfolio value" over the value in `money` (44/500, rule 5: money numbers regular) and
 * today; then the range's gain ("+$343.50 (+2.86%) since the draft", RangeGainLine, the same
 * line every chart has), the value line edge to edge on its axis, and the six range pills
 * (1W · 1M · 3M · 6M · Season · YTD, Giorgio 2026-11-17), opening on Season. A range longer than
 * the league has existed is grey. Then the cash, "Buy a stock", the holdings as roster rows (no
 * sparklines, no rules between them), Trade history and the Alpaca credit. 24pt between blocks.
 *
 * Tapping a holding opens its PLAYER CARD (deferred from the Matchup gate), exactly as on
 * Matchup; the card's Sell closes it and opens the stock sheet on Sell. A row whose card
 * can't be whole (no opening event in the ledger, or the week's data didn't load) opens the
 * stock sheet instead, so no row is ever a dead tap.
 *
 * A league whose season is OVER (Giorgio, 2026-11-18, pick A: "just the chart"): "Portfolio value"
 * with the Final chip, the value at the season's last day (static, it never rolls), "+$X (+Y%) since
 * the draft", the line from the draft to that day, then Holdings (ticker, company, value). No range
 * pills, no today line, no facts row, no cash and no Buy a stock. Frozen: nothing on it reads the live
 * quote, so it is the same whenever it is opened (usePortfolioData's finished season).
 */
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { radius, space } from '@/constants/tokens';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import type { ThemeColors } from '@/constants/tokens/color';
import { Card } from '@/components/sp/Card';
import { Icon } from '@/components/sp/Icon';
import { Chart, PlayerCard, RangeGainLine, RangePills, type PlayerCardOwnership } from '@/components/sp/gn';
import { formatMoney } from '@/components/sp/logic/money';
import { ShellHeader } from '@/components/shell/ShellHeader';
import { BarsRefresh } from '@/components/shell/BarsRefresh';
import { useStockSheet } from '@/components/money/MoneyHost';
import { LoadFailure } from '@/components/money/LoadFailure';
import { HoldingRow, ROW_TEXT_MAX_SCALE } from '@/components/money/HoldingRow';
import { PortfolioSkeleton } from '@/components/money/PortfolioSkeleton';
import { RollingMoney } from '@/components/home/RollingMoney';
import { COPY } from '@/lib/money/moneyCopy';
import { usePortfolioData } from '@/lib/money/usePortfolioData';
import { usePortfolioLedger } from '@/lib/money/usePortfolioLedger';
import { dailyValues, DEFAULT_PORTFOLIO_RANGE, finishedPortfolioSeries, mondayOf, PORTFOLIO_RANGES, portfolioGreyedRanges, portfolioRangeChoice, portfolioRangePick, portfolioSeries, type PortfolioRange, type PortfolioRangePick } from '@/lib/money/portfolioChart';
import { seasonEndEt } from '@/lib/money/seasonEnd';
import { isSeasonOver } from '@/lib/weekStatus';
import { PhaseChip } from '@/components/sp/PhaseChip';
import { asChartRange, rangeGain, selectableRange } from '@/lib/chart/chartRanges';
import { MONEY_FIXTURE } from '@/lib/money/devFixture';
import { FIXTURE_LEAGUE_ID } from '@/lib/money/fixtureMode';
import { useLeagueContext } from '@/lib/LeagueContext';
import { useSession } from '@/lib/SessionProvider';
import { useHomeLeague } from '@/lib/home/useHomeLeague';
import { toLiveSnapshots, toLiveTrades } from '@/lib/home/buildHomeViewModel';
import { useRosterData } from '@/lib/game/useRosterData';
import { cardSlotPill, etDateOf, weekSessions } from '@/lib/game/matchupRoster';
import { playerCardData, stockWeek } from '@/lib/game/playerCardModel';
import { leagueHasWeeks } from '@/lib/game/leagueWeeks';
import { SEAM_ON } from '@/lib/game/devSeam';
import { decideTradeGate } from '@/lib/money/tradeGate';
import { marketOpensLabel } from '@/lib/money/marketOpensLabel';
import { resolveWeekWindow, standardWeekSessions } from '@/lib/time/marketWeek';
import { useCaptureAction } from '@/lib/money/captureScript';
import { preDraftPortfolio } from '@/lib/money/preDraftPortfolio';
import { Button } from '@/components/sp/Button';
import { keepMoney, keepTime } from '@/lib/game/keepDots';

/** gain/loss/zero -> its theme colour (C-6: the same mapping Home's hero uses). */
function toneColor(colors: ThemeColors, tone: 'gain' | 'loss' | 'zero' | null): string {
  if (tone === 'gain') return colors.gain;
  if (tone === 'loss') return colors.loss;
  return colors.zero;
}

/** Capture seam only: the fixture path, then Home's bars after its last day. */
function seamCardBars(path: readonly { date: string; close: number }[], home: readonly { date: string; close: number }[]) {
  const last = path.length ? path[path.length - 1].date : '';
  return [...path, ...home.filter((b) => b.date > last)];
}

/** The value line's plot height (the board's amended Portfolio frame: 168). */
const CHART_HEIGHT = 168;
/** The hero's label, caption and sub-lines follow Dynamic Type to 1.3×, so the value stays the
 * standout (at XXXL an uncapped "+$3,518,517.00" rivalled the fitted value). */
const HERO_LINE_MAX_SCALE = 1.3;

export function PortfolioScreen() {
  const { colors } = useTheme();
  const stockSheet = useStockSheet();
  const router = useRouter();
  const { user } = useSession();
  const { activeLeague, activeLeagueId, market, setActiveLeagueId, marketCalendar, sheetLeagues } = useLeagueContext();
  const leagueId = activeLeague?.id ?? (MONEY_FIXTURE ? FIXTURE_LEAGUE_ID : null);
  const ledgerState = usePortfolioLedger(leagueId);
  // The player card's week (Matchup's own read: the week's snapshots, trades and bars) and
  // its slot pill (the league's slots).
  const home = useHomeLeague(MONEY_FIXTURE ? null : activeLeagueId);
  // A season that is over: the league switcher chip's own source (isSeasonOver), then the season's
  // last day from this league's matchups (never another league's, mid-switch), completed_at only
  // when there are none. While Home's read is still in flight the day is unknown (null).
  const finished = isSeasonOver(activeLeague, new Date(), marketCalendar);
  const leagueRaw = home.raw && home.raw.leagueId === activeLeagueId ? home.raw : null;
  const homeSettled = leagueRaw != null || home.status === 'error' || home.status === 'no-league';
  const completedAt = sheetLeagues.find((l) => l.id === activeLeagueId)?.seasonCompletedAt ?? null;
  const endEt = finished && homeSettled ? seasonEndEt(leagueRaw?.data.matchups, completedAt) : null;
  const data = usePortfolioData(finished ? { finished: true, endEt } : { finished: false });
  const roster = useRosterData(MONEY_FIXTURE ? null : activeLeagueId, user?.id ?? null, null);
  // The picked range belongs to the league it was picked in: switching league reopens on Season
  // (the reset happens during render, React's documented pattern, so no frame shows the old pick).
  const [rangePick, setRangePick] = useState<PortfolioRangePick>({ leagueId: activeLeagueId, range: DEFAULT_PORTFOLIO_RANGE });
  const currentPick = portfolioRangePick(rangePick, activeLeagueId);
  if (currentPick !== rangePick) setRangePick(currentPick);
  const range = currentPick.range;
  const setRange = (next: PortfolioRange) => setRangePick(portfolioRangeChoice(activeLeagueId, next));
  const [selected, setSelected] = useState<string | null>(null);
  // The card stays mounted while it leaves, with the stock it was showing.
  const [shown, setShown] = useState<string | null>(null);
  const pendingSell = useRef<{ symbol: string; name: string } | null>(null);

  // The capture seam plays the Home fixture's clock and market; production reads now.
  const raw = home.raw;
  const now = SEAM_ON && raw ? raw.now : new Date();
  const todayEt = etDateOf(now) ?? now.toISOString().slice(0, 10);
  const phase = home.viewModel?.phase ?? null;
  const gate = decideTradeGate(new Date(), market);
  const marketOpen = SEAM_ON ? phase?.kind === 'live_open' : gate.open;
  const opens = marketOpensLabel(SEAM_ON ? (phase?.kind === 'live_closed' ? phase.resumesAt : null) : market?.next_open_at ?? null);

  // This week's sessions (the 1W axis and the card's week line).
  const calendar = raw?.marketCalendar ?? [];
  const sessions = useMemo(() => {
    const win = resolveWeekWindow(now.toISOString(), calendar);
    const fromCalendar = win ? weekSessions(win.weekStart, win.weekEnd, calendar) : [];
    return fromCalendar.length ? fromCalendar : standardWeekSessions(`${mondayOf(todayEt)}T16:00:00Z`);
    // `now` moves every render; the week only changes with the date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendar, todayEt]);

  const chart = data.chart;
  // Finished: the days run to the season's last day (chart.endEt), today plays no part.
  const chartEnd = chart?.endEt ?? null;
  const daily = useMemo(
    () => (chart ? dailyValues({ rows: chart.rows, bars: chart.bars, stake: chart.stake, todayEt, endEt: chartEnd }) : []),
    [chart, todayEt, chartEnd],
  );
  // A range longer than the league has existed is grey (history = the league's age: the line
  // starts at the draft); Season never is, 1W never is. A grey range is never the selected one:
  // a team chart falls back to Season, not the stock sheet's 1W.
  const greyed = useMemo(() => portfolioGreyedRanges(daily, todayEt), [todayEt, daily]);
  const shownRange = selectableRange(range, greyed, DEFAULT_PORTFOLIO_RANGE);
  const series = useMemo(
    () => (!chart ? null
      : chartEnd ? finishedPortfolioSeries({ daily, endEt: chartEnd })
      : portfolioSeries({ range: shownRange, daily, liveValue: chart.liveValue, todayEt, now, sessions })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chart, chartEnd, shownRange, daily, todayEt, sessions],
  );
  // Finished: always Season ("since the draft"), whatever range was picked before.
  const gainRange: PortfolioRange = chartEnd ? 'Season' : shownRange;
  const gain = series ? rangeGain(series.points, series.base) : null;

  // The card's data for the stock it's showing (null: no opening event, or no week read).
  const card = useMemo(() => {
    if (!shown || !ledgerState.ledger || !user || !raw) return null;
    const me = user.id;
    const price = data.prices[shown] ?? raw.quote(shown);
    if (price == null) return null;
    const snapshots = toLiveSnapshots(raw.data.current_week.my_snapshots);
    const trades = toLiveTrades(raw.data.current_week.my_trades);
    const cardData = playerCardData({
      symbol: shown,
      company: ledgerState.ledger.symbol_names[shown] ?? '',
      userId: me,
      activity: ledgerState.ledger.activity,
      snapshots,
      trades,
      // An unknown week is null (the card's "–"), never a stand-in $0.00; a league without weeks
      // (Duration) has no week figure at all.
      weekGain: stockWeek(shown, snapshots, trades, price).gain,
      hasWeeks: leagueHasWeeks(activeLeague?.league_type),
      price,
      // The capture seam: the fixture's own daily path through Wednesday, then Home's bars
      // after it (as Matchup's card reads it), so the week moves every day.
      bars: SEAM_ON ? seamCardBars(chart?.bars[shown] ?? [], raw.bars[shown] ?? []) : raw.bars[shown] ?? chart?.bars[shown] ?? [],
      now,
    });
    if (!cardData) return null;
    const slotId = roster.slots.bySide[me]?.[shown] ?? null;
    const pill = cardSlotPill(roster.slots.slots.find((s) => s.id === slotId) ?? null);
    return { data: cardData, pill };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, ledgerState.ledger, user, raw, data.prices, chart, sessions, roster.slots, activeLeague?.league_type]);

  function pillFor(symbol: string) {
    if (!user) return null;
    const slotId = roster.slots.bySide[user.id]?.[symbol] ?? null;
    return cardSlotPill(roster.slots.slots.find((s) => s.id === slotId) ?? null);
  }

  // A row opens its player card when the card can be whole; otherwise the stock sheet (never
  // a dead tap). The card needs the ledger's opening event and the week's read.
  function openRow(symbol: string, name: string) {
    if (ledgerState.ledger && raw && user) {
      setSelected(symbol);
      setShown(symbol);
      return;
    }
    stockSheet.open(symbol, { name, originRef: symbol });
  }

  // DEV capture only (captureScript): the same handlers a tap runs.
  useCaptureAction('range', (r) => { const next = asChartRange(r ?? undefined); if (next && !greyed.includes(next)) setRange(next); });
  useCaptureAction('card', (sym) => { if (sym) openRow(sym, ledgerState.ledger?.symbol_names[sym] ?? sym); });
  useCaptureAction('sell', () => {
    if (!card || card.data.held <= 0) return;
    pendingSell.current = { symbol: card.data.ticker, name: card.data.company };
    setSelected(null);
  });
  useCaptureAction('close', () => setSelected(null));
  useCaptureAction('sheet', (sym) => { if (sym) stockSheet.open(sym, { name: ledgerState.ledger?.symbol_names[sym] ?? null }); });
  useCaptureAction('search', () => router.push('/stock-search'));
  useCaptureAction('league', (id) => { if (id) setActiveLeagueId(id); });
  // (The 'scrollto' step lives in BarsRefresh, on every tab's scroll view: Portfolio's page is one now.)

  let body: React.ReactNode;
  const preDraft = activeLeague ? preDraftPortfolio(activeLeague.draft_status, activeLeague.draft_date) : null;
  if (preDraft) {
    // Before the draft is done: the app's line, and Home's own hook (W4 DL gate: never a dead
    // end) — the draft room during the draft, the draft's date and time before it.
    body = (
      <View style={styles.empty} accessible={preDraft.hook?.kind !== 'room'} accessibilityLabel={[preDraft.line, preDraft.hook?.label].filter(Boolean).join(' ')}>
        <View style={[styles.emptyDisc, { backgroundColor: colors.inset }]}>
          <Icon name="lock" size="title" tone="text2" />
        </View>
        <Text variant="headline" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} style={[styles.extraBold, styles.center]}>{preDraft.line}</Text>
        {preDraft.hook?.kind === 'date' ? (
          <Text variant="callout" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} style={[styles.bold, styles.center]} testID="portfolio-pre-draft-date">{keepTime(preDraft.hook.label)}</Text>
        ) : null}
        {preDraft.hook?.kind === 'room' ? (
          <View style={styles.emptyAction}>
            <Button label={preDraft.hook.label} variant="primary" fullWidth onPress={() => router.push('/(tabs)/league')} testID="portfolio-go-to-draft-room" />
          </View>
        ) : null}
      </View>
    );
  } else if (finished && homeSettled && !endEt) {
    // Over, but no day it ended on could be read (no matchups, no completed_at): never a guessed day.
    body = <LoadFailure title={COPY.portfolioLoadTitle} message={COPY.loadRetryMessage} onRetry={() => { void home.refresh(); data.refresh(); }} />;
  } else if (data.status === 'loading') {
    body = <PortfolioSkeleton />;
  } else if (data.status === 'error' || !data.view) {
    body = <LoadFailure title={COPY.portfolioLoadTitle} message={COPY.loadRetryMessage} onRetry={data.refresh} />;
  } else {
    const v = data.view;
    const rollKey = activeLeague?.id ?? '';
    // A finished season shows only the value, its gain since the draft, the line and the holdings.
    const over = chartEnd != null;
    body = (
      <View style={styles.blocks}>
        {/* The hero: the value, the gain since the draft, today; then the line and its range. */}
        <View style={styles.hero}>
          <View style={styles.heroText}>
            {over ? (
              <View style={styles.captionRow}>
                <Text variant="caption" tone="secondary" maxFontSizeMultiplier={HERO_LINE_MAX_SCALE}>{v.valueLabel}</Text>
                <PhaseChip phase="season_complete" label="Final" />
              </View>
            ) : (
              <Text variant="caption" tone="secondary" maxFontSizeMultiplier={HERO_LINE_MAX_SCALE}>{v.valueLabel}</Text>
            )}
            {/* M3: every money figure that changes on a quote refresh rolls. One accessible
                element each: RollingMoney renders one Text per character. A finished season's
                value never changes, so it is plain text (it never rolls). */}
            {over ? (
              <Text variant="money" accessibilityRole="header" accessibilityLabel={`${v.valueLabel}, Final, ${v.valueText}`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} testID="portfolio-final-value">{v.valueText}</Text>
            ) : (
              <View accessible accessibilityRole="header" accessibilityLabel={`${v.valueLabel}, ${v.valueText}`}>
                <RollingMoney text={v.valueText} size="money" rollKey={rollKey} />
              </View>
            )}
            {!over && v.todayMoneyText && v.todayPctText ? (
              <HeroLine
                label={`${v.todayMoneyText} (${v.todayPctText}) today`}
                money={v.todayMoneyText}
                pct={v.todayPctText}
                words="today"
                color={toneColor(colors, v.todayTone)}
                rollKey={rollKey}
              />
            ) : null}
            {v.unpricedNote ? <Text variant="caption" tone="secondary" maxFontSizeMultiplier={HERO_LINE_MAX_SCALE}>{v.unpricedNote}</Text> : null}
          </View>
          {series ? (
            <RangeGainLine range={gainRange} gain={gain} rollKey={`${rollKey}-${gainRange}`} />
          ) : null}
          {series ? (
            <Chart
              points={series.points}
              base={series.base}
              axis={series.axis}
              height={CHART_HEIGHT}
              bleed={space[6]}
              live={over ? false : marketOpen}
              drawKey={gainRange}
              formatValue={(n) => formatMoney(n)}
              accessibilityLabel="Portfolio value"
              captureScrubAction="scrub"
            />
          ) : null}
          {/* Measured from pixels (W4 capture): the pills' own 6pt target margins put them 21pt under
              the dates and the next block 34pt below; pulled in so the pills sit ~12pt under the
              dates and the 24pt block gap is measured from the pill, glyph to glyph. Each pill
              keeps its 44pt target (32pt fill + its hit slop). */}
          {over ? null : (
            <View style={styles.pillsRow}>
              <RangePills options={PORTFOLIO_RANGES} value={shownRange} onChange={setRange} variant="pills" disabled={greyed} />
            </View>
          )}
        </View>

        {/* Cash and slots: what the team has to invest (never in a finished season). */}
        {!over && (v.cashValueText || v.slotsText) ? (
          <View style={styles.facts}>
            {v.cashValueText ? (
              <View style={styles.factRow} accessible accessibilityLabel={`${COPY.cashFromSales}, ${v.cashValueText}`}>
                <Text variant="callout" tone="secondary" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE}>{COPY.cashFromSales}</Text>
                <Text variant="score.sm" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} style={styles.bold}>{keepMoney(v.cashValueText)}</Text>
              </View>
            ) : null}
            {v.slotsText ? (
              <View style={styles.factRow}>
                <Text variant="callout" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} style={styles.bold}>{v.slotsText}</Text>
                {v.perSlotText ? <Text variant="caption" tone="secondary" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE}>{keepMoney(v.perSlotText)}</Text> : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Buy a stock: the entry to search (board #buy-a-stock), saying what can be spent. A finished
            season has nothing to buy. */}
        {over ? null : (
        <Card>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={v.buyRowText ? `${COPY.buyAStock}, ${v.buyRowText}` : COPY.buyAStock}
            onPress={() => router.push('/stock-search')}
            style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.7 : 1 }]}
            testID="portfolio-buy-a-stock"
          >
            <View style={[styles.linkTile, { backgroundColor: colors.accentTint }]}>
              <Icon name="search" size="body" tone="accent" />
            </View>
            <View style={styles.linkText}>
              <Text variant="callout" color={colors.accent} maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} style={styles.extraBold}>{COPY.buyAStock}</Text>
              {v.buyRowText ? <Text variant="caption" tone="secondary" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE}>{keepMoney(v.buyRowText)}</Text> : null}
            </View>
            <Icon name="chevronRight" size="callout" tone="text2" />
          </Pressable>
        </Card>
        )}

        {/* Holdings: roster rows, no sparklines; each opens its player card. */}
        <View>
          <View style={styles.listHead}>
            <Text variant="headline" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} style={styles.extraBold}>{COPY.holdingsHeading}</Text>
            {v.rows.length ? <Text variant="caption" tone="secondary" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE}>{over ? 'Value' : 'Value · today'}</Text> : null}
          </View>
          {v.rows.map((r) => (
            <HoldingRow key={r.symbol} row={r} pill={pillFor(r.symbol)} onPress={() => openRow(r.symbol, r.name)} />
          ))}
        </View>

        <Card>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={COPY.tradeHistory}
            onPress={() => router.push('/trade-history')}
            style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.7 : 1 }]}
            testID="portfolio-trade-history"
          >
            <View style={styles.linkText}>
              <Text variant="callout" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} style={styles.bold}>{COPY.tradeHistory}</Text>
            </View>
            <Icon name="chevronRight" size="callout" tone="text2" />
          </Pressable>
        </Card>

        <Text variant="caption" maxFontSizeMultiplier={ROW_TEXT_MAX_SCALE} tone="secondary" style={styles.center}>{v.creditText}</Text>
      </View>
    );
  }

  let ownership: PlayerCardOwnership | null = null;
  if (card) {
    ownership = card.data.held > 0
      ? {
        owner: 'you',
        onSell: () => {
          // The stock sheet (Sell selected for a held stock) opens once the card has left.
          pendingSell.current = { symbol: card.data.ticker, name: card.data.company };
          setSelected(null);
        },
      }
      : { owner: 'you', sold: true };
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.moneyBg }]}>
      {/* The same top bar as every tab (pill + avatar, no chip), first thing in the page so it scrolls away. */}
      <BarsRefresh header={<ShellHeader title="Portfolio" showAvatar />} fadeColor={colors.moneyBg} contentContainerStyle={styles.content}>{body}</BarsRefresh>
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

/** A hero sub-line: "+$X (+Y%) today" (Design Lead gate, 2026-11-17: the bracket format of every gain
 * line, and the WHOLE line in the gain colour, "today" included; zero stays the neutral grey). The
 * money and the percent roll as two units (C-6/M3: one string misaligns mid-roll). The figures are one
 * non-wrapping run, so a wrapped line breaks only before the word (§5 "Wrapping at XL"), and everything
 * caps at 1.3x so the value stays the screen's loudest text at XL (§5 "The standout stays loudest").
 * Above 1.3x the sp Text primitive (and RollingMoney) turn that cap into an explicit size
 * (cappedType.ts): Home draws the same figures uncapped in the same face, and iOS gave the capped copies
 * those uncapped boxes (P2, 2026-10-16/19). */
function HeroLine({ label, money, pct, words, color, rollKey }: { label: string; money: string; pct: string; words: string; color: string; rollKey: string }) {
  return (
    <View accessible accessibilityLabel={label} style={styles.rollRow}>
      <View style={styles.nowrap}>
        <RollingMoney text={money} size="callout" fontWeight="700" color={color} rollKey={rollKey} maxScale={HERO_LINE_MAX_SCALE} />
        <Text variant="callout" color={color} maxFontSizeMultiplier={HERO_LINE_MAX_SCALE} style={styles.bold}>{'\u00a0('}</Text>
        <RollingMoney text={pct} size="callout" fontWeight="700" color={color} rollKey={rollKey} maxScale={HERO_LINE_MAX_SCALE} />
        <Text variant="callout" color={color} maxFontSizeMultiplier={HERO_LINE_MAX_SCALE} style={styles.bold}>)</Text>
      </View>
      <Text variant="callout" color={color} maxFontSizeMultiplier={HERO_LINE_MAX_SCALE}>{`\u00a0${words}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[6], paddingTop: space[2], paddingBottom: space[9] },
  // §9C: the calm screens' 24pt between blocks.
  blocks: { gap: space[7] },
  hero: { gap: space[4] },
  heroText: { gap: space[1] },
  captionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  pillsRow: { marginTop: -space[3], marginBottom: -space[3] },
  rollRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' },
  nowrap: { flexDirection: 'row', alignItems: 'baseline' },
  facts: { gap: space[3] },
  factRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', columnGap: space[3] },
  linkRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[4], paddingHorizontal: space[5], paddingVertical: space[4] },
  linkTile: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  linkText: { flex: 1, minWidth: 0, gap: space[1] },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: space[1] },
  bold: { fontWeight: '700' },
  extraBold: { fontWeight: '800' },
  center: { textAlign: 'center' },
  empty: { alignItems: 'center', gap: space[4], paddingTop: space[10] },
  emptyDisc: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyAction: { alignSelf: 'stretch', paddingTop: space[3] },
});
