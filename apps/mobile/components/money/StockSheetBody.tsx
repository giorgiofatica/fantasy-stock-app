/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
/**
 * StockSheetBody: the stock sheet (3e). Every decision lives in stockSheetModel;
 * the trade review lives in reviewModel, reviewPresentation and useTradeSubmit.
 * This file wires them: the Review call to action opens the review in place,
 * the review submits through record-trade, and a retry re-fetches the fresh
 * numbers before the review can submit again. The market gate is re-checked
 * every second, so a review open at the close swaps to closed at once.
 *
 * W4 (Game Night, §9C): the sheet is a money surface. The header is the player card's (the
 * ticker badge, the ticker in `ticker.card`, the company, the ×); the price in `money`
 * (44/500, the sheet's standout); the range's gain, the line on the Game Night
 * Chart with its labelled axis and the six range pills (no "today" line: it is 1W's last point); "Your position" in an `inset` panel; then
 * Buy | Sell, the one action as a pill, and the Alpaca credit. Every blocked action is
 * DISABLED with its reason beside it (PRODUCT_RULES "Nothing tappable does nothing"), never
 * silently missing. W4 defect (a): a buy that costs more than the budget left is refused here,
 * before the review (stockSheetModel), and again in the review's own build.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LoadFailure } from '@/components/money/LoadFailure';
import { Skeleton } from '@/components/Skeleton';
import { WarnPanel } from '@/components/sp/WarnPanel';
import { TradeReviewPanel, type NextStep } from '@/components/money/TradeReviewPanel';
import { Button } from '@/components/sp/Button';
import { SheetBody } from '@/components/sp/Sheet';
import { Icon } from '@/components/sp/Icon';
import { SegmentedControl } from '@/components/sp/SegmentedControl';
import { Text } from '@/components/sp/Text';
import { TickerBadge } from '@/components/sp/gn/TickerBadge';
import { keepMoney, keepShares, keepTime } from '@/lib/game/keepDots';
import { formatGainPair, formatMoney } from '@/components/sp/logic/money';
import { useLeagueContext } from '@/lib/LeagueContext';
import { MONEY_FIXTURE, MONEY_FIXTURE_CONFIG, MONEY_PRE_DRAFT } from '@/lib/money/devFixture';
import { SEAM_ON } from '@/lib/game/devSeam';
import { FIXTURE_LEAGUE_ID, fixtureLeague, fixtureMarket } from '@/lib/money/fixtureMode';
import { STRESS_CALLER } from '@/lib/money/stressFixture';
import { useSession } from '@/lib/SessionProvider';
import { buyingPower, type PreviewSource } from '@/lib/money/buyingPower';
import { SalePicker } from '@/components/money/SalePicker';
import { StockChart } from '@/components/money/StockChart';
import { seasonStartOf } from '@/lib/money/seasonStart';
import { defaultSourceId } from '@/lib/money/salePicker';
import { budgetAfterBuy, budgetAfterSell, budgetLeftOf, effectiveBudgetCap, userCashSpentFromLedger } from '@/lib/money/budgetFigures';
import { cleanCompanyName } from '@/lib/money/cleanCompanyName';
import { fixedNotionalShares } from '@/lib/money/buyQuantity';
import { formatShares } from '@/lib/money/formatShares';
import { myHoldingsFromLedger, stockPosition } from '@/lib/money/portfolioModel';
import { COPY } from '@/lib/money/moneyCopy';
import { marketOpensLabel } from '@/lib/money/marketOpensLabel';
import { fetchPreview, fetchPreviewAnswer, type TradeBody } from '@/lib/money/recordTrade';
import { pacedPreviewLine } from '@/lib/money/previewAnswer';
import { refusalCopy } from '@/lib/money/refusals';
import { buyReviewOneShare, buyReviewPerSlot, buyReviewTier, sellReview, settledReview, type TradeReview } from '@/lib/money/reviewModel';
import { fillsSlotLine, tierRefusalSentence } from '@/lib/money/tierContract';
import { categoryNameOf, loadCategoryNames } from '@/lib/money/categoryNames';
import { useTheme } from '@/components/sp/ThemeProvider';
import { reviewPresentation } from '@/lib/money/reviewPresentation';
import { canDismiss } from '@/lib/money/reviewMachine';
import { decideTradeGate, type TradeGate } from '@/lib/money/tradeGate';
import { getSeasonPhase, isSeasonOver } from '@/lib/weekStatus';
import { companyLine, noProceedsKnown, proceedsSettled, stockSheetModel } from '@/lib/money/stockSheetModel';
import { shouldStartReview } from '@/lib/money/stockSheetApi';
import { buyBody, previewBody, sellBody } from '@/lib/money/tradeBodies';
import { useStockSheetData } from '@/lib/money/useStockSheetData';
import { usePortfolioLedger } from '@/lib/money/usePortfolioLedger';
import { useTradeSubmit } from '@/lib/money/useTradeSubmit';
import { useRouter } from 'expo-router';
import { radius, space } from '@/constants/tokens';
import { RollingMoney } from '@/components/home/RollingMoney';
import { MATCHUP_FIXTURE_VARIANT, PORTFOLIO_STAKE_VARIANT } from '@/lib/game/devSeam';
import { seamPortfolioLeague } from '@/lib/money/portfolioSeam';
import { etDateOf } from '@/lib/game/matchupRoster';
import { resolveWeekWindow, standardWeekSessions, type MarketCalendarSession } from '@/lib/time/marketWeek';
import { weekSessions } from '@/lib/game/matchupRoster';
import { mondayOf } from '@/lib/money/portfolioChart';
import { HOME_FIXTURE } from '@/lib/home/devFixture';
import { useCaptureAction } from '@/lib/money/captureScript';
import { openingOf } from '@/lib/game/playerCardModel';
import { acquisitionLine } from '@/components/sp/logic/gameNight';

/** The sheet's gutter (§9C: the card's and the sheet's 20pt). */
const SHEET_GUTTER = space[6];
/** The gate of a season that is over: closed, with no open time (never stale, so it never refetches). */
const SEASON_OVER_GATE: TradeGate = { open: false, reason: 'closed', stale: false, nextOpenAt: null };


/** The sheet's small text follows Dynamic Type to 1.6× (the player card's ceiling), so the price
 * stays the sheet's loudest text at XXXL. */
const SHEET_TEXT_MAX_SCALE = 1.6;

/** The capture seam's market: the Home fixture's (open on its live Thursday; after the close on
 * live_closed, reopening Friday 9:30 AM ET, as the player card says). */
function seamMarket(now: Date) {
  if (HOME_FIXTURE === 'live_closed') {
    return { status: 'closed', session_open_at: null, session_close_at: null, next_open_at: '2026-09-25T13:30:00.000Z' };
  }
  return fixtureMarket('ok', now);
}

/** The capture seam's clock for the line (the Home fixture's live Thursday, or after its close). */
function seamChartNow(): Date {
  return new Date(HOME_FIXTURE === 'live_closed' ? '2026-09-25T00:00:00.000Z' : '2026-09-24T17:37:00.000Z');
}

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

type ReviewKind = 'sell' | 'buy';
interface OpenReview {
  kind: ReviewKind;
  /** null while the numbers are being fetched, or when they could not be built (see `error`). */
  review: TradeReview | null;
  body: TradeBody | null;
  error: string | null;
  loading: boolean;
  /** The error is a blocker (a tier refusal): warn-tint, no icon. */
  warn?: boolean;
  /** Per-slot buy with more than one sale to pay from: the picker comes first. */
  needsPicker?: boolean;
  /** A paced buy review (the preview's per-minute 429 or its hour/day cap): the review does not open; this
   * line goes in the sheet's warn panel above an ENABLED Review buy (PRODUCT_RULES, "Too many taps", B). */
  paced?: string;
  sources?: PreviewSource[];
}

export function StockSheetBody({
  symbol,
  knownName = null,
  startReview = null,
  onDone,
  onBusyChange,
}: {
  symbol: string;
  knownName?: string | null;
  /** "buy": open straight into the buy review when a buy is allowed (the Stocks list's "+"); see shouldStartReview. */
  startReview?: 'buy' | null;
  onDone: () => void;
  /** Reports a submit in flight, so the host can lock the sheet's dismiss paths. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const data = useStockSheetData(symbol, knownName);
  const { market: contextMarket, activeLeague, marketCalendar } = useLeagueContext();
  const { user } = useSession();
  const { colors } = useTheme();
  const router = useRouter();
  const userId = MONEY_FIXTURE ? STRESS_CALLER : (user?.id ?? null);
  const ledgerState = usePortfolioLedger(activeLeague?.id ?? (MONEY_FIXTURE ? FIXTURE_LEAGUE_ID : null));
  // C-4 (Design Lead gate, key screen 5): "Your position" -- the same ledger
  // read already shared with Portfolio, no new request. Cost basis (and so
  // avg entry) needs the FULL history of this user's drafts/trades, not just
  // this symbol's rows, since a sell reduces cost basis proportionally.
  const myHolding = useMemo(() => {
    if (!ledgerState.ledger || !userId) return null;
    return myHoldingsFromLedger(ledgerState.ledger, userId).find((h) => h.symbol === symbol.toUpperCase()) ?? null;
  }, [ledgerState.ledger, userId, symbol]);
  const position = myHolding && data.price != null ? stockPosition(myHolding, data.price) : null;
  const now = useNow(1000);
  // DEV fixture: the market the scenario plays (open, or closed for market_closed); live otherwise.
  // DEV fixtures: the money scenario's market; under the game seam an open session (the
  // Matchup fixture's live Thursday — the shell fixture carries no market row).
  const market = MONEY_FIXTURE_CONFIG ? fixtureMarket(MONEY_FIXTURE_CONFIG.scenario, now) : SEAM_ON ? seamMarket(now) : contextMarket;
  // The league the sheet trades in: the stress fixture's, the capture seam's (Portfolio's own),
  // or the real one.
  const sheetLeague = MONEY_FIXTURE_CONFIG
    ? { id: FIXTURE_LEAGUE_ID, ...fixtureLeague(MONEY_FIXTURE_CONFIG.stake) }
    : SEAM_ON && activeLeague
      ? { id: activeLeague.id, ...seamPortfolioLeague(PORTFOLIO_STAKE_VARIANT, MATCHUP_FIXTURE_VARIANT) }
      : activeLeague;
  // W4 defect (a): what a one-share buy must fit, read BEFORE any review. budget_cap: the
  // server's cap (a NULL budget_amount is $0, defect (d)) minus cash spent; budget and tier
  // leagues: whether every slot is held.
  const budgetLeft = useMemo(() => {
    const cap = effectiveBudgetCap(sheetLeague?.stake_mode, sheetLeague?.budget_amount);
    if (cap == null || !ledgerState.ledger || !userId) return null;
    return budgetLeftOf(cap, userCashSpentFromLedger(ledgerState.ledger, userId));
  }, [sheetLeague?.stake_mode, sheetLeague?.budget_amount, ledgerState.ledger, userId]);
  const rosterFull = useMemo(() => {
    if (!sheetLeague || !ledgerState.ledger || !userId) return false;
    if (sheetLeague.stake_mode !== 'budget_cap' && sheetLeague.stake_mode !== 'price_tiers') return false;
    return myHoldingsFromLedger(ledgerState.ledger, userId).length >= sheetLeague.num_rounds;
  }, [sheetLeague, ledgerState.ledger, userId]);
  // How you got it, in the player card's words (one string on the card and the sheet).
  const acquisition = useMemo(() => {
    if (!ledgerState.ledger || !userId) return null;
    const o = openingOf(userId, symbol, ledgerState.ledger.activity);
    return o ? acquisitionLine(o.acquisition) : null;
  }, [ledgerState.ledger, userId, symbol]);
  // This week's sessions: the chart's 1W axis.
  const chartNow = SEAM_ON ? seamChartNow() : now;
  const todayEt = etDateOf(chartNow) ?? '';
  const sessions: MarketCalendarSession[] = useMemo(() => {
    const win = resolveWeekWindow(chartNow.toISOString(), marketCalendar);
    const fromCalendar = win ? weekSessions(win.weekStart, win.weekEnd, marketCalendar) : [];
    return fromCalendar.length ? fromCalendar : standardWeekSessions(`${mondayOf(todayEt || new Date().toISOString().slice(0, 10))}T16:00:00Z`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketCalendar, todayEt]);
  // Season on this stock's chart: since THIS league's draft (null before the draft, or with no league).
  const draftDone = MONEY_PRE_DRAFT ? false : activeLeague ? activeLeague.draft_status === 'completed' : !!(MONEY_FIXTURE_CONFIG || SEAM_ON);
  const seasonStart = useMemo(() => seasonStartOf(draftDone, ledgerState.ledger?.activity), [draftDone, ledgerState.ledger]);
  const [choice, setChoice] = useState<'buy' | 'sell' | null>(null);
  const [open, setOpen] = useState<OpenReview | null>(null);
  // A paced buy review's "Too many tries" line, shown above Review buy until the next tap (the retry).
  const [paced, setPaced] = useState<string | null>(null);
  useEffect(() => { setPaced(null); }, [symbol]);
  // "Which sale pays for this?": the sales a per-slot buy can be paid from, and the one chosen.
  // fixed_notional: the sale proceeds that fund a buy, read ONCE when the sheet's facts are ready (the preview the review makes too),
  // so a buy with nothing to invest is disabled BEFORE the review. null = not read (or unreadable): never guessed.
  const [proceeds, setProceeds] = useState<{ sources: PreviewSource[] | null } | null>(null);
  const [picking, setPicking] = useState<{ sources: PreviewSource[]; chosen: string | null } | null>(null);
  const trade = useTradeSubmit();
  const lastData = useRef<unknown>(null);
  // DEV capture only: the latest openReview / submit / selected choice, for captureScript.
  const openReviewRef = useRef<((kind: ReviewKind) => Promise<void>) | null>(null);
  // The review the "+" asked for: wanted until it has been started (or ruled out) once for this sheet.
  const startReviewRef = useRef<{ wanted: 'buy' | null; ready: boolean; go: () => void } | null>(null);
  const startedReview = useRef(false);
  const buyAllowedRef = useRef<{ enabled: boolean; gateOpen: boolean }>({ enabled: false, gateOpen: false });
  const submitRef = useRef<(() => Promise<void>) | null>(null);
  const choiceRef = useRef<ReviewKind>('buy');

  // A season that is over is closed to buying and selling, whatever the market is doing (the one predicate,
  // isSeasonOver; the server refuses it too): the sheet's gate is closed with no open time, so Buy and Sell
  // are disabled before a review, never at the server.
  const seasonOver = isSeasonOver(activeLeague, now, marketCalendar);
  const gate = seasonOver ? SEASON_OVER_GATE : decideTradeGate(now, market);
  // The draft isn't done (the app's phase check): no trade can start, so Review is disabled before the tap, with the
  // existing "Trading opens after the draft." line. Not while there is no league (the dev fixtures), never guessed.
  const seasonPhase = activeLeague ? getSeasonPhase(activeLeague, now, marketCalendar) : null;
  const preDraft = seasonPhase === 'pre_draft' || seasonPhase === 'drafting';
  const opensLabel = !seasonOver && market?.next_open_at ? marketOpensLabel(market.next_open_at) : null;

  async function buildReview(kind: ReviewKind, pickedId: string | null = null): Promise<OpenReview> {
    const league = sheetLeague;
    if (!league || !userId) return { kind, review: null, body: null, error: COPY.cantReach, loading: false };
    const price = data.price;
    const spent = ledgerState.ledger ? userCashSpentFromLedger(ledgerState.ledger, userId) : 0;
    // The server's cap (defect (d): a NULL budget_amount is $0 there, so here too).
    const budget = effectiveBudgetCap(league.stake_mode, league.budget_amount);

    if (kind === 'sell') {
      const held = data.facts?.held;
      if (!held || price == null) return { kind, review: null, body: null, error: COPY.noPrice, loading: false };
      const body = sellBody(league.id, symbol);
      if (league.stake_mode === 'fixed_notional') {
        const review = sellReview({ symbol, quantity: held.quantity, price, slotNotional: league.notional_per_slot ?? undefined });
        return { kind, review, body, error: null, loading: false };
      }
      if (league.stake_mode === 'budget_cap' && budget != null) {
        const before = budget - spent;
        const after = budgetAfterSell(before, held.quantity, price);
        return { kind, review: sellReview({ symbol, quantity: held.quantity, price, budget: { before, after } }), body, error: null, loading: false };
      }
      return { kind, review: sellReview({ symbol, quantity: held.quantity, price }), body, error: null, loading: false };
    }

    // Buy. A per-slot league funds the buy from a sale's proceeds, which the server's preview names.
    if (price == null) return { kind, review: null, body: null, error: COPY.noPrice, loading: false };
    if (league.stake_mode === 'fixed_notional') {
      const preview = await fetchPreview(previewBody(league.id));
      const power = buyingPower({
        league,
        preview: preview ? { stake_mode: preview.stakeMode, stake: preview.stake, unfilled_slots: preview.unfilledSlots, sources: preview.sources } : null,
        cashSpent: null,
        openTierLabel: null,
      });
      if (power.kind === 'none') return { kind, review: null, body: null, error: COPY.noProceeds, loading: false };
      if (power.kind !== 'proceeds') return { kind, review: null, body: null, error: COPY.cantReach, loading: false };
      if (power.pickerRequired && !pickedId) {
        return { kind, review: null, body: null, error: null, loading: false, needsPicker: true, sources: power.sources };
      }
      const source = power.sources.find((s) => s.trade_id === (pickedId ?? power.defaultTradeId));
      const shares = source ? fixedNotionalShares(source.amount, price) : null;
      if (!source || !shares) return { kind, review: null, body: null, error: COPY.invalidPrice, loading: false };
      const review = buyReviewPerSlot({
        symbol,
        amount: source.amount,
        price: shares.price,
        quantity: shares.quantity,
        sourceLabel: `${source.symbol} slot`,
        leftInSlot: 0,
      });
      return { kind, review, body: buyBody(league.id, symbol, source.trade_id), error: null, loading: false };
    }
    if (league.stake_mode === 'price_tiers' || league.stake_mode === 'budget_cap') {
      // The server decides the slot and the refusal. The client asks (advisory) and words the answer; it never computes fit.
      const answer = await fetchPreviewAnswer(previewBody(league.id, { price, symbol }));
      if (!answer) return { kind, review: null, body: null, error: COPY.cantReach, loading: false };
      if (answer.kind === 'refused') {
        // Paced (too many taps): no review; the approved "Too many tries" line above an enabled Review buy.
        const pacedLine = pacedPreviewLine(answer.reason);
        if (pacedLine) return { kind, review: null, body: null, error: null, loading: false, paced: pacedLine };
        // A stock the buy would refuse as not_draftable: the buy's own sentence, through the buy's own mapper,
        // before the review, where a slot refusal goes (plan part 3, point 7).
        return { kind, review: null, body: null, error: refusalCopy(answer.reason, { symbol: symbol.toUpperCase() }).message, loading: false, warn: true };
      }
      const check = answer.preview;
      await loadCategoryNames();
      if (check.wouldFill === null) {
        // The refusal comes BEFORE the review, per the board.
        return { kind, review: null, body: null, error: tierRefusalSentence(symbol, price, check.openSlots ?? [], categoryNameOf), loading: false, warn: true };
      }
      // Rows follow their own rule: the budget rows iff budget_cap; the fill line iff the server named a slot.
      const before = budget != null && league.stake_mode === 'budget_cap' ? budget - spent : null;
      // W4 defect (a): the preview's would_fill ignores the budget, so a share that costs more
      // than the budget left is refused HERE, before a review that could only end in the
      // server's over_budget (and never "Budget left after −$X").
      if (before != null && price > before + 1e-9) {
        return { kind, review: null, body: null, error: COPY.costsMoreThanBudget(symbol.toUpperCase()), loading: false, warn: true };
      }
      const review = buyReviewOneShare({
        symbol,
        price,
        budget: before != null ? { before, after: budgetAfterBuy(before, price) } : undefined,
        fills: check.wouldFill ? fillsSlotLine(check.wouldFill, categoryNameOf) : undefined,
      });
      return { kind, review, body: buyBody(league.id, symbol), error: null, loading: false };
    }
    return { kind, review: null, body: null, error: COPY.cantReach, loading: false };
  }

  // The sheet locks its dismiss paths only while a submit is in flight (reviewMachine.canDismiss).
  const busy = !canDismiss(trade.state);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (!sheetLeague || sheetLeague.stake_mode !== 'fixed_notional' || data.status !== 'ready') return;
    let live = true;
    void fetchPreview(previewBody(sheetLeague.id)).then((p) => {
      if (live) setProceeds({ sources: p && p.stakeMode === 'fixed_notional' ? p.sources : null });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetLeague?.id, sheetLeague?.stake_mode, data.status, symbol]);

  // The "+" asked to land in the buy review: decided ONCE, at the first render with the facts ready. A buy that is allowed starts
  // its review; one that is not leaves the plain sheet with its reason, and stays so (a market that opens later never pops a
  // review the person did not see coming).
  useEffect(() => {
    startedReview.current = false;
  }, [symbol, startReview]);
  useEffect(() => {
    const s = startReviewRef.current;
    if (!s || startedReview.current || s.wanted !== 'buy' || !s.ready) return;
    startedReview.current = true;
    if (shouldStartReview(s.wanted, s.ready, buyAllowedRef.current.enabled, buyAllowedRef.current.gateOpen)) s.go();
  });

  // A review open when the market closes swaps to closed at once (the server's refusal wins a race).
  useEffect(() => {
    if (open && !gate.open && trade.state.kind !== 'done') trade.gateClosed(opensLabel);
    // `trade` is a fresh object each render; its methods are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gate.open, opensLabel]);

  // Try again: once the sheet's facts have re-loaded, rebuild the review from them.
  useEffect(() => {
    const fresh = data !== lastData.current;
    lastData.current = data;
    if (!open || trade.state.kind !== 'refreshing' || !fresh || data.status !== 'ready') return;
    let cancelled = false;
    (async () => {
      const next = await buildReview(open.kind);
      if (cancelled) return;
      setOpen(next);
      trade.refreshed();
    })();
    return () => {
      cancelled = true;
    };
    // buildReview reads the current data; the identity check above tracks it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, trade.state.kind]);

  // DEV capture only (captureScript): the same handlers a tap runs. Hooks, so above the returns;
  // they read the latest render's functions through captureScript's ref.
  useCaptureAction('choice', (c) => { if (c === 'buy' || c === 'sell') setChoice(c); });
  useCaptureAction('review', () => { void openReviewRef.current?.(choiceRef.current); });
  useCaptureAction('submit', () => { void submitRef.current?.(); });
  useCaptureAction('edit', () => setOpen(null));
  useCaptureAction('done', () => { setOpen(null); onDone(); });

  if (data.status === 'loading') {
    return (
      <View style={styles.body} accessible accessibilityLabel={`${symbol}, loading`} accessibilityState={{ busy: true }}>
        <SheetHeader symbol={symbol} company={knownName ?? ''} onClose={onDone} />
        <Skeleton width={180} height={44} borderRadius={8} />
        <Skeleton height={140} borderRadius={12} />
      </View>
    );
  }
  if (data.status === 'error' || !data.facts) {
    return (
      <View style={styles.body}>
        <SheetHeader symbol={symbol} company={knownName ?? ''} onClose={onDone} />
        <LoadFailure title={COPY.stockLoadTitle} message={COPY.loadRetryMessage} onRetry={data.refresh} />
      </View>
    );
  }

  async function openReview(kind: ReviewKind, pickedId: string | null = null) {
    trade.reset();
    setPaced(null);
    setOpen({ kind, review: null, body: null, error: null, loading: true });
    const next = await buildReview(kind, pickedId);
    if (next.paced) {
      // Back to the sheet: the line sits above Review buy, which stays enabled as the retry.
      setOpen(null);
      setPaced(next.paced);
      return;
    }
    if (next.needsPicker && next.sources) {
      setOpen(null);
      setPicking({ sources: next.sources, chosen: defaultSourceId(next.sources) });
      return;
    }
    setOpen(next);
  }

  // "Pick another sale" (a proceeds refusal): re-read the sales, so the picker never offers a stale one.
  async function pickAnotherSale() {
    const leagueId = sheetLeague?.id ?? null;
    if (!leagueId) return;
    const preview = await fetchPreview(previewBody(leagueId));
    const sources = preview?.sources ?? [];
    if (sources.length === 0) {
      setOpen({ kind: 'buy', review: null, body: null, error: COPY.noProceeds, loading: false });
      return;
    }
    trade.reset();
    setOpen(null);
    setPicking({ sources, chosen: defaultSourceId(sources) });
  }

  async function submitNow() {
    if (!open?.body) return;
    const outcome = await trade.submit(open.body);
    if (outcome?.kind === 'ok') data.refresh();
  }

  // A refusal's next step. Pick another stock closes the sheet: the stock search is where it leads.
  function handleNextStep(step: NextStep) {
    if (step === 'back_to_picker') {
      void pickAnotherSale();
    } else if (step === 'pick_stock') {
      onDone();
    } else if (step === 'sell_first') {
      onDone();
      router.navigate('/portfolio');
    } else {
      onDone();
      router.replace('/login');
    }
  }

  function retryReview() {
    trade.retry();
    data.refresh();
  }
  // DEV capture only: this render's openReview / submit (they close over `open`), set before
  // any early return below so a scripted Submit sees the open review.
  openReviewRef.current = (kind) => openReview(kind);
  // The "+" on the Stocks list asks to land IN the buy review: once, when the facts are ready and a buy is allowed
  // (shouldStartReview). Otherwise the sheet is the plain sheet with its own reason under a disabled Review buy.
  startReviewRef.current = { wanted: startReview, ready: data.status === 'ready' && proceedsSettled(sheetLeague?.stake_mode, proceeds !== null), go: () => void openReview('buy') };
  submitRef.current = submitNow;

  const model = stockSheetModel({
    symbol,
    companyName: data.companyName,
    price: data.price,
    prevClose: data.prevClose,
    held: data.facts.held,
    owner: data.facts.owner,
    draft: data.facts.draft,
    gate: { open: gate.open, opensLabel, seasonOver, preDraft },
    leagueName: data.leagueName ?? '',
    lastCloseLabel: null,
    acquisition,
    budgetLeft,
    rosterFull,
    noProceeds: noProceedsKnown(sheetLeague?.stake_mode, proceeds?.sources ?? null),
  });

  if (picking) {
    return (
      <SalePicker
        sources={picking.sources}
        chosenId={picking.chosen}
        onChoose={(id) => setPicking({ ...picking, chosen: id })}
        onUse={() => {
          const id = picking.chosen;
          setPicking(null);
          void openReview('buy', id);
        }}
        onClose={() => setPicking(null)}
      />
    );
  }

  if (open) {
    if (open.loading) {
      return (
        <View style={styles.body}>
          <Text variant="callout" maxFontSizeMultiplier={SHEET_TEXT_MAX_SCALE} tone="secondary" accessibilityLiveRegion="polite">{COPY.preparingReview}</Text>
        </View>
      );
    }
    if (open.review) {
      const doneTitle = open.kind === 'sell' ? `Sold ${symbol}` : `Bought ${symbol}`;
      const ownerName = data.facts?.owner?.kind === 'other' ? (data.facts.owner.name ?? undefined) : undefined;
      const presentation = reviewPresentation(trade.state, open.review, { title: doneTitle, symbol, resolve: categoryNameOf, ownerName });
      // The confirmation shows what the server filled, not the reviewed estimate (one number per sale).
      const shown = trade.state.kind === 'done' ? settledReview(open.review, trade.state.trade) : open.review;
      return (
        <TradeReviewPanel
          review={shown}
          presentation={presentation}
          onSubmit={submitNow}
          onRetry={retryReview}
          onNextStep={handleNextStep}
          canEdit={!busy}
          onBack={() => setOpen(null)}
          onDone={() => {
            setOpen(null);
            onDone();
          }}
        />
      );
    }
    // The message scrolls; its next steps (Try again, Edit) are the action, pinned under it.
    return (
      <SheetBody
        contentContainerStyle={styles.scrollContent}
        footerStyle={styles.footer}
        footer={(
          <>
            {/* C-5 (Design Lead gate, U-33): no_price/invalid_price get a Try again,
                not just Edit -- the price itself is what failed, so re-reading it
                (data.refresh) before re-opening the review is the actual retry. */}
            {open.error === COPY.noPrice || open.error === COPY.invalidPrice ? (
              <Button label={COPY.tryAgain} variant="primary" fullWidth onPress={() => { data.refresh(); void openReview(open.kind); }} />
            ) : null}
            <Button label="Edit" variant="secondary" fullWidth onPress={() => setOpen(null)} />
          </>
        )}
      >
        {open.warn ? (
          // A blocker before the review (a tier refusal, defect (a)'s budget): the warn panel, its own ink.
          <WarnPanel text={open.error ?? COPY.cantReach} />
        ) : (
          <Text variant="callout" maxFontSizeMultiplier={SHEET_TEXT_MAX_SCALE} tone="secondary" accessibilityRole="alert">{open.error ?? COPY.cantReach}</Text>
        )}
      </SheetBody>
    );
  }

  // Giorgio, 2026-10-09: "i can only sell what i have... cant sell what you
  // dont own." On a stock you don't hold, there is no Sell path at all --
  // not just a disabled one -- so `selected` ignores `choice` entirely here
  // rather than merely defaulting to 'buy': a stale 'sell' picked while
  // this same sheet instance held a different, owned stock must never leak
  // through once the sheet is showing something you don't hold.
  const held = data.facts.held != null;
  buyAllowedRef.current = { enabled: model.buy.enabled, gateOpen: gate.open };
  const selected = held ? (choice ?? model.selected) : 'buy';
  choiceRef.current = selected;
  const action = selected === 'buy' ? model.buy : model.sell;
  const canReview = selected === 'sell' ? model.sell.enabled : model.buy.enabled;
  const reviewLabel = selected === 'sell' ? COPY.reviewSell : COPY.reviewBuy;
  const ownerLine = `${model.ownershipLine}${model.ownerBadge ? ` · ${model.ownerBadge}` : ''}`;
  // The pre-review blocks that get the warn panel (the board: owned by another manager; W4:
  // over the budget, a full roster). Every other reason is the caption beside the button.
  const warnBlock = selected === 'buy' && (model.buy.blockedBy === 'owned' || model.buy.blockedBy === 'budget' || model.buy.blockedBy === 'full')
    ? (model.buy.blockedBy === 'owned' && data.facts.owner?.kind === 'other' ? COPY.ownerBlocksBuy(data.facts.owner.name ?? 'another manager', symbol) : model.buy.reason)
    : null;

  // The one action, WITH the reason a disabled one carries, is pinned under the scroll (§9C order:
  // the content scrolls under it, no rule line). At Large the sheet is content-sized, so this
  // sits exactly where the button sat inline; at XXXL the body scrolls and this stays reachable.
  const footer = (
    <>
      {/* A finished season draws NO control and no line (model.controlsShown is false): only the credit below. */}
      {/* E-3 (3e UX audit): a buy the server would refuse is named BEFORE the review, in the
          warn panel; the button stays visible and disabled under it (board #buy-a-stock). */}
      {model.controlsShown && warnBlock ? <WarnPanel text={keepMoney(warnBlock)} /> : null}
      {/* A paced buy review (too many taps): the same panel, but Review buy below stays ENABLED as the retry. */}
      {model.controlsShown && !warnBlock && selected === 'buy' && paced ? <WarnPanel text={paced} /> : null}

      {/* The one action, always drawn (a live league): enabled, or disabled with its reason beside it. */}
      {model.controlsShown ? (
      <View style={styles.actionWrap}>
        <Button
          label={reviewLabel}
          variant={selected === 'sell' ? 'destructive' : 'primary'}
          fullWidth
          disabled={!(canReview && gate.open)}
          onPress={() => openReview(selected)}
          testID="stock-sheet-review"
        />
        {/* The review refusal's own next step (refusals.ts over_budget → pick_stock), here
            before the review: the sheet closes back to search. */}
        {selected === 'buy' && model.buy.blockedBy === 'budget' ? (
          <Button label={COPY.pickAnotherStock} variant="secondary" fullWidth onPress={() => handleNextStep('pick_stock')} testID="stock-sheet-pick-another" />
        ) : null}
        {!warnBlock && action.reason ? (
          <Text variant="caption" maxFontSizeMultiplier={SHEET_TEXT_MAX_SCALE} tone="secondary" style={styles.center} accessibilityLiveRegion="polite">
            {keepTime(keepMoney(action.reason))}
          </Text>
        ) : null}
        {model.marketNote ? <Text variant="caption" maxFontSizeMultiplier={SHEET_TEXT_MAX_SCALE} tone="secondary" style={styles.center}>{model.marketNote}</Text> : null}
      </View>
      ) : null}

      <Text variant="caption" maxFontSizeMultiplier={SHEET_TEXT_MAX_SCALE} tone="secondary" style={styles.center}>{COPY.alpacaCredit}</Text>
    </>
  );

  return (
    <SheetBody contentContainerStyle={styles.scrollContent} footerStyle={styles.footer} footer={footer}>
      <View accessibilityRole="summary" style={styles.stack}>
        {/* The company line, or none: never the ticker repeated under itself. */}
        <SheetHeader symbol={symbol} company={companyLine(model.name || cleanCompanyName(data.companyName), symbol)} onClose={onDone} />

        {/* The price: the sheet's standout, in `money` (44/500, §9C rule 5). */}
        <View style={styles.priceBlock}>
          {data.price != null ? (
            <View accessible accessibilityLabel={`Price, ${formatMoney(data.price)}`}>
              <RollingMoney text={formatMoney(data.price)} size="money" rollKey={symbol} />
            </View>
          ) : (
            // C-5 (Design Lead gate, U-33): a way to retry, same as calendar_unavailable's.
            <View style={styles.noPrice}>
              <Text variant="callout" maxFontSizeMultiplier={SHEET_TEXT_MAX_SCALE} tone="secondary">{COPY.noPrice} </Text>
              <Pressable accessibilityRole="button" onPress={data.refresh} hitSlop={8} style={styles.textButton}>
                <Text variant="callout" maxFontSizeMultiplier={SHEET_TEXT_MAX_SCALE} color={colors.accent} style={styles.bold}>{COPY.tryAgain}</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* M2: the range's gain, the line edge to edge on its labelled axis, the six range pills under it. (No "today" line under the price: today's move is 1W's last point, Giorgio 2026-11-17.) */}
        <StockChart symbol={symbol} price={data.price} live={gate.open} now={chartNow} sessions={sessions} bleed={SHEET_GUTTER} seasonStart={seasonStart} />

        {position ? (
          // C-4 (Design Lead gate, key screen 5): shares, avg entry, value and gain -- the
          // figure a sell decision rests on (UX-audit rule 4). An `inset` panel (§9C).
          <View style={[styles.panel, { backgroundColor: colors.inset }]}>
            <View style={styles.panelHead}>
              <Text variant="headline" maxFontSizeMultiplier={SHEET_TEXT_MAX_SCALE} style={styles.extraBold}>Your position</Text>
              <Text variant="caption" maxFontSizeMultiplier={SHEET_TEXT_MAX_SCALE} tone="secondary" style={styles.panelCaption}>{ownerLine}</Text>
            </View>
            <View style={styles.figures}>
              <Figure label="Shares" value={formatShares(position.quantity)} />
              <Figure label="Avg entry" value={formatMoney(position.avgEntry)} />
              <Figure label="Value" value={formatMoney(position.value)} />
              <Figure
                label="Gain"
                value={formatGainPair(position.gain, position.gainPct).text}
                spoken={formatGainPair(position.gain, position.gainPct).spoken}
                color={Math.abs(position.gain) < 0.005 ? colors.zero : position.gain > 0 ? colors.gain : colors.loss}
              />
            </View>
          </View>
        ) : (
          <Text variant="callout" maxFontSizeMultiplier={SHEET_TEXT_MAX_SCALE} tone="secondary">{ownerLine}</Text>
        )}

        {held && model.controlsShown ? (
          <SegmentedControl
            shape="pill"
            options={[{ label: 'Buy', value: 'buy' }, { label: 'Sell', value: 'sell' }]}
            value={selected}
            onChange={(v) => setChoice(v as 'buy' | 'sell')}
          />
        ) : null}

        {model.controlsShown && selected === 'sell' && model.sell.summary ? (
          <Text variant="callout" maxFontSizeMultiplier={SHEET_TEXT_MAX_SCALE} style={[styles.bold, styles.tabular]}>{keepMoney(keepShares(model.sell.summary))}</Text>
        ) : null}
      </View>
    </SheetBody>
  );
}

/** The player card's header, shared so the stock looks the same from every entry point
 * (PRODUCT_RULES, sell-from-search A): the ticker badge, the ticker, the company, the ×. */
function SheetHeader({ symbol, company, onClose }: { symbol: string; company: string; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <TickerBadge symbol={symbol} size={52} />
      <View style={styles.headText}>
        <Text variant="ticker.card" accessibilityRole="header">{symbol}</Text>
        {company ? <Text variant="callout" tone="secondary" numberOfLines={1} maxFontSizeMultiplier={1.6}>{company}</Text> : null}
      </View>
      {/* C-9 (Design Lead gate, key screen 5): the × close icon, not "Done" text. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        hitSlop={4}
        style={styles.close}
      >
        <Icon name="close" size="body" tone="text2" />
      </Pressable>
    </View>
  );
}

/** `spoken`: what VoiceOver says for the value when it differs from what is shown (a gain pair says
 * "+$X, +Y%", never the brackets). */
function Figure({ label, value, color, spoken }: { label: string; value: string; color?: string; spoken?: string }) {
  return (
    <View style={styles.figure} accessible accessibilityLabel={`${label}, ${spoken ?? value}`}>
      <Text variant="caption" maxFontSizeMultiplier={SHEET_TEXT_MAX_SCALE} tone="secondary">{label}</Text>
      <Text variant="callout" maxFontSizeMultiplier={SHEET_TEXT_MAX_SCALE} color={color} style={[styles.extraBold, styles.tabular]}>{keepMoney(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[5], paddingHorizontal: SHEET_GUTTER, paddingBottom: space[7] },
  // The main view's scroll body and pinned footer: the same gutter and gaps as `body`, split in two.
  // The scroll's bottom padding stands in for the gap above the footer; the footer carries the
  // body's bottom padding, so at Large the layout is the one the sheet had before the split.
  scrollContent: { paddingHorizontal: SHEET_GUTTER, paddingBottom: space[5] },
  stack: { gap: space[5] },
  footer: { gap: space[5], paddingHorizontal: SHEET_GUTTER, paddingBottom: space[7] },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  headText: { flex: 1, minWidth: 0, gap: space[1] },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  priceBlock: { gap: space[1] },
  noPrice: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  textButton: { minHeight: 44, justifyContent: 'center' },
  panel: { borderRadius: radius.lg, paddingVertical: space[4], paddingHorizontal: 14, gap: space[4] },
  panelHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', columnGap: space[3] },
  panelCaption: { flexShrink: 1 },
  figures: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space[4] },
  figure: { width: '50%', gap: space[1] },
  actionWrap: { gap: space[3] },
  bold: { fontWeight: '700' },
  extraBold: { fontWeight: '800' },
  regular: { fontWeight: '500' },
  tabular: { fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
});
