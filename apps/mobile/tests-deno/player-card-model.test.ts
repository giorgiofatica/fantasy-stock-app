/**
 * W4 the player card: its numbers (playerCardModel.ts), its one action (gameNight.cardAction,
 * typed so no button renders without its handler), and the W3 gate's carried details.
 * `deno test` TYPE-CHECKS this file: the `@ts-expect-error` lines below are the required-
 * handler guard — if the ownership union ever lets a Sell or a Save through without its
 * handler, the expected error disappears and this file fails to compile.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { cardAction, type PlayerCardOwnership } from '../components/sp/logic/gameNight.ts';
import { holdingRangeGain, openLots, openingOf, playerCardData, prevCloseOf, stockWeek, type HoldingLot } from '../lib/game/playerCardModel.ts';
import { fixtureLedger } from '../lib/game/matchupFixture.ts';
import { rangeGain } from '../lib/chart/chartRanges.ts';
import { stockLineSeries } from '../lib/money/stockChartSeries.ts';
import { ROBERTO_HOLDINGS, fixtureQty } from '../lib/home/homeFixtureData.ts';
import type { LedgerActivityRow } from '../lib/money/portfolioLedger.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const strip = (src: string) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const noop = () => {};

// ── Required handlers (compile-time) ──────────────────────────────────────────────

Deno.test('ownership: Sell needs onSell, Save needs its toggle — by type', () => {
  // @ts-expect-error yours, held, with no onSell: a Sell button with no action
  const a: PlayerCardOwnership = { owner: 'you' };
  // @ts-expect-error theirs with no `save` key at all: the caller must say "no watchlist" (null)
  const b: PlayerCardOwnership = { owner: { name: 'Gianluigi B.' } };
  // @ts-expect-error theirs with a Save and no toggle
  const c: PlayerCardOwnership = { owner: { name: 'Gianluigi B.' }, save: { saved: false } };
  // @ts-expect-error yours can never carry a Save
  const d: PlayerCardOwnership = { owner: 'you', onSell: noop, save: { saved: false, onToggle: noop } };
  // @ts-expect-error "sold" and a Sell handler together
  const e: PlayerCardOwnership = { owner: 'you', sold: true, onSell: noop };
  const ok: PlayerCardOwnership[] = [
    { owner: 'you', onSell: noop },
    { owner: 'you', sold: true },
    { owner: { name: 'Gianluigi B.' }, save: null },
    { owner: { name: 'Gianluigi B.' }, save: { saved: true, onToggle: noop } },
  ];
  assertEquals([a, b, c, d, e].length + ok.length, 9);
});

// ── The one action ────────────────────────────────────────────────────────────────

Deno.test('cardAction: yours → Sell (its handler) while open; disabled WITH the reason while closed; never Save', () => {
  let sold = 0;
  const open = cardAction({ owner: 'you', onSell: () => sold++, marketOpen: true, opens: 'Mon 9:30 AM ET' })!;
  assertEquals([open.label, open.disabled, open.note, open.star], ['Sell', false, null, null]);
  open.onPress!();
  assertEquals(sold, 1);
  const closed = cardAction({ owner: 'you', onSell: noop, marketOpen: false, opens: 'Mon 9:30 AM ET' })!;
  assertEquals([closed.label, closed.disabled, closed.onPress], ['Sell', true, undefined]);
  assertEquals(closed.note, "Market's closed. Opens Mon 9:30 AM ET.");
  // The next open unknown: the app's own closed line, never "Opens ." with a hole in it.
  assertEquals(cardAction({ owner: 'you', onSell: noop, marketOpen: false, opens: null })!.note, 'Trading is closed right now.');
});

Deno.test('cardAction: a disabled button only ever comes with its reason', () => {
  for (const marketOpen of [true, false]) {
    for (const p of [
      { owner: 'you' as const, onSell: noop },
      { owner: { name: 'G' }, save: { saved: false, onToggle: noop } },
      { owner: { name: 'G' }, save: { saved: true, onToggle: noop } },
    ]) {
      const a = cardAction({ ...p, marketOpen, opens: null });
      if (a?.disabled) assert(a.note, 'disabled without a reason');
      if (a && !a.disabled) assert(a.onPress, 'enabled without a handler');
    }
  }
});

Deno.test('cardAction: theirs → Save (outline star) / Saved (the same star filled, "Saved"); no watchlist → nothing', () => {
  let toggled = 0;
  const save = cardAction({ owner: { name: 'G' }, save: { saved: false, onToggle: () => toggled++ }, marketOpen: false, opens: null })!;
  assertEquals([save.label, save.star, save.disabled, save.saved], ['Save', 'star', false, false]);
  save.onPress!();
  assertEquals(toggled, 1);
  const saved = cardAction({ owner: { name: 'G' }, save: { saved: true, onToggle: noop }, marketOpen: true, opens: null })!;
  assertEquals([saved.label, saved.star], ['Saved', 'starFilled']);
  assertEquals(cardAction({ owner: { name: 'G' }, save: null, marketOpen: true, opens: null }), null);
  assertEquals(cardAction({ owner: 'you', sold: true, marketOpen: true, opens: null }), null, 'a stock sold this week: no action');
});

Deno.test('cardAction: NO Save on your own stock, in any market state', () => {
  for (const marketOpen of [true, false]) {
    const a = cardAction({ owner: 'you', onSell: noop, marketOpen, opens: 'Mon 9:30 AM ET' })!;
    assert(a.label !== 'Save' && a.label !== 'Saved' && a.star === null);
  }
});

// ── How it was got ────────────────────────────────────────────────────────────────

const row = (o: Partial<LedgerActivityRow>): LedgerActivityRow => ({
  kind: 'draft', user_id: 'u', symbol: 'NVDA', action: 'buy', quantity: 3, round: 1, pick_number: 2,
  occurred_at: '2026-09-29T23:00:00.000Z', total_value: null, price: 290.1, ...o,
});

Deno.test('openingOf: a draft pick → "Drafted 2nd overall · Sep 29 · $290.10" (the ET date, the price per share)', () => {
  const o = openingOf('u', 'NVDA', [row({})])!;
  assertEquals(o.acquisition, { kind: 'drafted', pick: 2, date: 'Sep 29', price: 290.1 });
  assertEquals([o.dateIso, o.quantity], ['2026-09-29', 3]);
  // 11 PM UTC on Sep 30 is 7 PM ET the same day; 1 AM UTC Oct 1 is still Sep 30 in ET.
  assertEquals(openingOf('u', 'NVDA', [row({ occurred_at: '2026-10-01T01:00:00.000Z' })])!.acquisition.date, 'Sep 30');
});

Deno.test('openingOf: the LAST buy opens the position (drafted, sold, bought back → "Bought")', () => {
  const o = openingOf('u', 'NVDA', [
    row({}),
    row({ kind: 'trade', action: 'sell', pick_number: null, round: null, occurred_at: '2026-10-01T15:00:00Z', price: 300 }),
    row({ kind: 'trade', action: 'buy', pick_number: null, round: null, occurred_at: '2026-10-02T15:00:00Z', price: 214.8, quantity: 4 }),
  ])!;
  assertEquals(o.acquisition, { kind: 'bought', date: 'Oct 2', price: 214.8 });
  assertEquals(o.quantity, 4);
});

Deno.test('openingOf: nothing in the ledger → null (the card is never shown without "How you got it")', () => {
  assertEquals(openingOf('u', 'AAPL', [row({})]), null);
  assertEquals(openingOf('other', 'NVDA', [row({})]), null);
});

Deno.test('no waiver claims are invented: trades carry no claim marker, so a buy reads "Bought"', () => {
  const src = strip(SOURCES['lib/game/playerCardModel.ts']);
  assert(!/kind: 'claimed'/.test(src));
});

// ── The figures ───────────────────────────────────────────────────────────────────

const nvda = ROBERTO_HOLDINGS[0];
const snap = [{ symbol: 'NVDA', quantity: fixtureQty(nvda), weekStartPrice: nvda.mon, enteredMidWeek: false }];

Deno.test('stockWeek: the row\'s own number (liveWeekScore over this one stock)', () => {
  const w = stockWeek('NVDA', snap, [], nvda.thu);
  assertEquals(Math.round(w.gain! * 100), Math.round(fixtureQty(nvda) * (nvda.thu - nvda.mon) * 100));
  assertEquals(Math.round(w.pct! * 100) / 100, Math.round(((nvda.thu - nvda.mon) / nvda.mon) * 10000) / 100);
});

Deno.test('today: the last close before today (never today\'s own bar)', () => {
  assertEquals(prevCloseOf([{ date: '2026-09-23', close: 1 }, { date: '2026-09-24', close: 2 }], '2026-09-24'), 1);
  assertEquals(prevCloseOf([{ date: '2026-09-24', close: 2 }], '2026-09-24'), null);
});

const weekBars = [{ date: '2026-09-21', close: 301 }, { date: '2026-09-22', close: 303 }, { date: '2026-09-23', close: 306.68 }, { date: '2026-09-24', close: 318 }];

Deno.test('playerCardData: the card agrees with the row and says how it was got', () => {
  const ledger = fixtureLedger('unslotted', 'me', 'g');
  const d = playerCardData({
    symbol: 'NVDA', company: 'NVIDIA', userId: 'me', activity: ledger.activity, snapshots: snap, trades: [],
    weekGain: 62.4, hasWeeks: true, price: nvda.thu, bars: weekBars, now: new Date('2026-09-24T17:37:00Z'),
  })!;
  assertEquals(d.weekGain, 62.4, "the row's own cents, so card and row never disagree");
  assertEquals(d.acquisition.kind, 'drafted');
  assertEquals(d.held, fixtureQty(nvda));
  // TWO figures' worth of numbers (Price with today, Week gain) and no "since" figures: "Since the
  // draft" is Season's gain line now (Giorgio 2026-11-17, "B").
  assertEquals(Object.keys(d).sort(), ['acquisition', 'company', 'hasWeeks', 'held', 'lots', 'price', 'seasonStart', 'ticker', 'todayPct', 'weekGain', 'weekPct']);
  assertEquals(Math.round(d.todayPct * 100) / 100, Math.round(((nvda.thu - 306.68) / 306.68) * 10000) / 100, "today's percent is from the last close before today");
  // Season's first day on the card is the league's draft day (ET), the same for any stock.
  assert(d.seasonStart !== null && /^\d{4}-\d{2}-\d{2}$/.test(d.seasonStart));
});

Deno.test('playerCardData: Week gain is the matchup week and is NOT the 1W range gain (Monday-to-now, not five sessions)', () => {
  const ledger = fixtureLedger('unslotted', 'me', 'g');
  const now = new Date('2026-09-24T17:37:00Z');
  const d = playerCardData({
    symbol: 'NVDA', company: 'NVIDIA', userId: 'me', activity: ledger.activity, snapshots: snap, trades: [],
    weekGain: 62.4, hasWeeks: true, price: nvda.thu, bars: weekBars, now,
  })!;
  // The 1W gain is per share over the past five sessions; the card's Week gain is the row's own number.
  const one = stockLineSeries({ range: '1W', bars: [{ date: '2026-09-17', close: 250 }, ...weekBars], price: nvda.thu, todayEt: '2026-09-24', now, sessions: [], seasonStart: null });
  const oneWeek = rangeGain(one.points, one.base)!;
  assert(Math.abs(d.weekGain! - oneWeek.money) > 0.01, 'the week gain and the 1W gain are different numbers');
  assertEquals(d.weekGain, 62.4);
});

// ── The card's range gain is the HOLDING's P/L, not per share (Design Lead gate P1, 2026-11-17) ──

const near = (a: number, b: number, eps = 1e-6) => assert(Math.abs(a - b) < eps, `${a} vs ${b}`);

Deno.test('P/L: Season on a DRAFTED stock = (price now − draft price) × shares, the figure "How you got it" implies', () => {
  // NVDA drafted Aug 31 at $290.10 (6.8942 sh); the draft-day CLOSE was $293.93 — the basis is the entry, not the close.
  const lots: HoldingLot[] = [{ date: '2026-08-31', quantity: 6.8942, price: 290.1 }];
  const g = holdingRangeGain({ lots, start: '2026-08-31', base: 293.93, price: 318.37 })!;
  near(g.money, 6.8942 * (318.37 - 290.1));
  near(g.pct, ((318.37 - 290.1) / 290.1) * 100);
  assertEquals(g.tone, 'gain');
  // …which is NOT the per-share move from the draft-day close.
  assert(Math.abs(g.money - (318.37 - 293.93)) > 1);
});

Deno.test('P/L: a lot opened inside the range is measured from its OWN entry price, an older lot from the range start', () => {
  // 4 sh drafted at $290.10 (older than 1M's start Oct 16), 2 sh bought Oct 20 at $320. Price now $318.37, price at the range start $300.
  const lots: HoldingLot[] = [{ date: '2026-08-31', quantity: 4, price: 290.1 }, { date: '2026-10-20', quantity: 2, price: 320 }];
  const g = holdingRangeGain({ lots, start: '2026-10-16', base: 300, price: 318.37 })!;
  near(g.money, 4 * (318.37 - 300) + 2 * (318.37 - 320));
  near(g.pct, (g.money / (4 * 300 + 2 * 320)) * 100);
});

Deno.test('P/L: a stock bought mid-season — Season (the range starts BEFORE the buy) is its gain since the buy', () => {
  const lots: HoldingLot[] = [{ date: '2026-09-10', quantity: 3, price: 330 }]; // entry ABOVE the draft-day close
  const season = holdingRangeGain({ lots, start: '2026-08-31', base: 293.93, price: 318.37 })!;
  near(season.money, 3 * (318.37 - 330));
  assertEquals(season.tone, 'loss', 'the stock is up since the draft but this buy is under water');
  near(season.pct, ((318.37 - 330) / 330) * 100);
});

Deno.test('P/L: a range starting AFTER the buy measures from the price at the range start (the lot is older than the window)', () => {
  const lots: HoldingLot[] = [{ date: '2026-09-10', quantity: 3, price: 330 }];
  const g = holdingRangeGain({ lots, start: '2026-09-17', base: 305, price: 318.37 })!;
  near(g.money, 3 * (318.37 - 305));
  assertEquals(g.tone, 'gain');
});

Deno.test('P/L: the tone is the P/L\'s sign, not the drawn line\'s (a stock up on the range, a lot bought above it)', () => {
  const lots: HoldingLot[] = [{ date: '2026-11-10', quantity: 1, price: 120 }];
  const g = holdingRangeGain({ lots, start: '2026-11-01', base: 100, price: 110 })!;
  assertEquals(g.tone, 'loss');
  assertEquals(holdingRangeGain({ lots: [{ date: '2026-11-10', quantity: 1, price: 110 }], start: '2026-11-01', base: 100, price: 110 })!.tone, 'zero');
});

Deno.test('P/L: nothing to measure → null (no lots, no live price, no range)', () => {
  const lot: HoldingLot = { date: '2026-09-10', quantity: 1, price: 10 };
  assertEquals(holdingRangeGain({ lots: [], start: '2026-09-01', base: 1, price: 2 }), null);
  assertEquals(holdingRangeGain({ lots: [lot], start: '2026-09-01', base: 1, price: null }), null);
  assertEquals(holdingRangeGain({ lots: [lot], start: null, base: 1, price: 2 }), null);
});

Deno.test('openLots: every buy is a lot at its own price; a sale shrinks every open lot in proportion; a full sale closes them', () => {
  const act = (o: Partial<LedgerActivityRow>) => row({ user_id: 'u', symbol: 'NVDA', ...o });
  const rows = [
    act({ kind: 'draft', action: 'buy', quantity: 4, price: 100, occurred_at: '2026-09-01T00:30:00Z' }),
    act({ kind: 'trade', action: 'buy', quantity: 2, price: 110, occurred_at: '2026-10-05T15:00:00Z' }),
    act({ kind: 'trade', action: 'sell', quantity: 3, price: 120, occurred_at: '2026-10-07T15:00:00Z' }),
    row({ user_id: 'someone-else', symbol: 'NVDA', kind: 'trade', action: 'buy', quantity: 99, price: 1, occurred_at: '2026-10-01T15:00:00Z' }),
  ];
  const lots = openLots('u', 'nvda', rows);
  assertEquals(lots.length, 2);
  assertEquals(lots[0].date, '2026-08-31', 'the draft instant in ET');
  near(lots[0].quantity, 2); near(lots[1].quantity, 1); // 6 sh, 3 sold: half of each
  assertEquals([lots[0].price, lots[1].price], [100, 110]);
  assertEquals(openLots('u', 'NVDA', [...rows, act({ kind: 'trade', action: 'sell', quantity: 3, price: 130, occurred_at: '2026-10-08T15:00:00Z' })]), []);
  assertEquals(openLots('u', 'AAPL', rows), []);
  // A buy with no price is never a guessed basis.
  assertEquals(openLots('u', 'NVDA', [act({ kind: 'draft', action: 'buy', quantity: 1, price: null, occurred_at: '2026-09-01T00:30:00Z' })]), []);
});

Deno.test('playerCardData carries the lots held now (the card\'s gain line is their P/L)', () => {
  const ledger = fixtureLedger('unslotted', 'me', 'g');
  const d = playerCardData({
    symbol: 'NVDA', company: 'NVIDIA', userId: 'me', activity: ledger.activity, snapshots: snap, trades: [],
    weekGain: 62.4, hasWeeks: true, price: nvda.thu, bars: weekBars, now: new Date('2026-09-24T17:37:00Z'),
  })!;
  assertEquals(d.lots, openLots('me', 'NVDA', ledger.activity));
  near(d.lots.reduce((n, l) => n + l.quantity, 0), d.held, 1e-4);
  const g = holdingRangeGain({ lots: d.lots, start: d.seasonStart, base: 1, price: nvda.thu })!;
  near(g.money, d.held * (nvda.thu - nvda.draft), 1e-3); // Season on the drafted stock: (price − draft price) × shares
});

// ── The card as drawn (the W3 gate's carried items) ───────────────────────────────

Deno.test('PlayerCard: "How you got it" in its inset panel (radius 14, 12 / 14) with the card label as its title', () => {
  const src = strip(SOURCES['components/sp/gn/PlayerCard.tsx']);
  assert(src.includes('<View style={[styles.how, { backgroundColor: colors.inset }]}'));
  assert(/how: \{\s*gap: space\[2\],\s*borderRadius: radius\.lg,\s*paddingVertical: space\[4\],\s*paddingHorizontal: 14,/.test(src));
  assert(src.includes("<CardLabel text={howTitle(owner === 'you' ? 'you' : 'other')} />"));
  assert(/howLine: \{\s*fontWeight: '700',\s*fontVariant: \['tabular-nums'\],/.test(src));
  // The block is the LAST section before the credit.
  assert(src.indexOf('5. How you got it') > src.indexOf('4. The one action'));
  assert(src.indexOf('5. How you got it') < src.indexOf('6. The Alpaca credit'));
});

Deno.test('PlayerCard: Save carries the drawn star; no "{entry} → {now}" caption (the chart is the stock chart now)', () => {
  const src = strip(SOURCES['components/sp/gn/PlayerCard.tsx']);
  assert(src.includes('{action.star ? <Icon name={action.star} size="body" tone="text" /> : null}'));
  assert(!/backgroundColor: colors\.accent/.test(src), 'Saved has no accent fill');
  assert(!src.includes('→'), 'the Season title row and its caption went with the two stacked charts');
});

Deno.test('PlayerCard: the action is drawn only from cardAction (never a handler-less button), and the X closes', () => {
  const src = strip(SOURCES['components/sp/gn/PlayerCard.tsx']);
  assert(src.includes('const action = cardAction(props);'));
  assert(src.includes('{action ? ('));
  assert(src.includes('onPress={action.onPress}'));
  assert(!/onToggleSave|saved = false/.test(src), 'no optional handler props left');
  assert(src.includes('<Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"'));
});

Deno.test('PlayerCard: the 4pt scale (gap 16, pill padding 12, owner-pill gap 8, strip padding 8)', () => {
  const src = strip(SOURCES['components/sp/gn/PlayerCard.tsx']);
  assert(/body: \{\s*paddingHorizontal: SHEET_GUTTER,\s*paddingBottom: space\[7\],\s*gap: space\[5\],/.test(src));
  assert(!/gap: 14|paddingHorizontal: 10|gap: 6,|paddingLeft: 3|paddingHorizontal: 6,/.test(src));
  const sb = strip(SOURCES['components/sp/gn/Scoreboard.tsx']);
  assert(!/paddingHorizontal: 14|gap: 10,/.test(sb));
  const rr = strip(SOURCES['components/sp/gn/RosterRow.tsx']);
  assert(!/paddingVertical: 5|CENTRE_GAP = 10/.test(rr));
  assert(!/gap: 18/.test(strip(SOURCES['components/sp/gn/RangePills.tsx'])));
});

Deno.test('RosterRow: VoiceOver says whose half it is ("Yours, …" / "{name}, …")', () => {
  const src = strip(SOURCES['components/sp/gn/RosterRow.tsx']);
  assert(strip(SOURCES['components/sp/logic/gameNight.ts']).includes('return `${whose}, ${half.ticker}, ${half.company},'));
  assert(src.includes('const a11y = rosterHalfLabel(whose, half);'));
  assert(SOURCES['app/(tabs)/matchup.tsx'].includes('opponentName={opp.name}'));
});

Deno.test('Matchup: Sell hands off to the stock sheet only once the card has left; theirs shows no dead Save', () => {
  const src = SOURCES['app/(tabs)/matchup.tsx'];
  assert(src.includes('if (sell) stockSheet.open(sell.symbol, { name: sell.name });'));
  assert(src.indexOf('stockSheet.open(') > src.indexOf('onClosed={() => {'));
  assert(src.includes("ownership = { owner: { name: opp.name }, save: null };"), 'no watchlist exists yet: Save hidden, never dead');
  assert(SOURCES['components/sp/Sheet.tsx'].includes('onClosedRef.current?.();'));
});

// ── Found in the W4 capture pass (17e, XL) ────────────────────────────────────────

Deno.test('XL: the card keeps its TWO figure columns at every size and caps its small text; the scoreboard names never break mid-word', () => {
  const card = strip(SOURCES['components/sp/gn/PlayerCard.tsx']);
  assert(!/useLargeText|stacked/.test(card), "two columns at AX5 too (Giorgio's phone is the largest accessibility size): no stacking");
  assert(card.includes('const CARD_TEXT_MAX_SCALE = 1.6;'));
  const sb = strip(SOURCES['components/sp/gn/Scoreboard.tsx']);
  assert(sb.includes('maxFontSizeMultiplier={NAME_MAX_SCALE}'));
  assert(sb.includes('stacked ? (mirror ? styles.whoStackedMirror : styles.whoStacked)'), 'the avatar sits over the name when it won\'t fit beside it');
  assert(sb.includes('numberOfLines={1} adjustsFontSizeToFit minimumFontScale={minScale}'), 'one line, never "Gianluigi" / "B."');
  assert(sb.includes('maxFontSizeMultiplier={LINE_MAX_SCALE}') && sb.includes('export const LINE_MAX_SCALE = 1.3;'), 'the leads-by line stays under the totals');
  const row = strip(SOURCES['components/sp/gn/RosterRow.tsx']);
  assert((row.match(/maxFontSizeMultiplier=\{ROW_TEXT_MAX_SCALE\}/g) ?? []).length >= 2, 'ticker and company capped');
  assert(row.includes('maxFontSizeMultiplier={PCT_MAX_SCALE}') && row.includes('const PCT_MAX_SCALE = 1.3;'), 'the percent never outgrows the gain');
  assert(row.includes('stacked ? [styles.numStacked, mirror ? styles.alignEnd : styles.alignStart]'), 'stacked numbers on the outer edge, no 64% cap');
  assert(SOURCES['app/(tabs)/matchup.tsx'].includes('maxFontSizeMultiplier={LINE_MAX_SCALE}>{note}'), 'the unpriced note capped too');
  assert(row.includes('minimumFontScale={0.7}') && 17 * 0.7 >= 11, 'a seven-figure week shrinks, never under 11pt');
});
