/**
 * Giorgio's six board picks of 2026-11-16 (PRODUCT_RULES; boards #call-buy-top, #call-draft-card, #call-queue-card, #call-draft-turn,
 * #call-blockers-card, #call-dead-links). One test group per item, pinning the acceptance: the words, the lines that are gone,
 * VoiceOver order, the 50-of-50 hide and the one-line rule.
 *
 *   cd apps/mobile/tests-deno && deno test --no-check --sloppy-imports --unstable-raw-imports --allow-read --allow-env board-picks-1116.test.ts
 */
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';
import { blockersCardCopy, countdownCopy, etTimeLabel, etWhenLabel, leagueCountdownCopy } from '../lib/game/autoStart.ts';
import { keepDots, keepTime, NBSP } from '../lib/game/keepDots.ts';
import { afterPickLine, picksUntilYouLine, roundPickLine, turnCardLabel, turnCardView } from '../lib/game/draftRoom.ts';
import { QUEUE_MAX } from '../lib/game/draftQueue.ts';
import { blurReturnsToRow, queueSearchMode, QUEUE_SEARCH_ROW_MAX_SCALE } from '../lib/game/queueSearchRow.ts';
import { NOT_FOUND, RESET_DEAD_LINK } from '../lib/shell/deadLinkCopy.ts';
import { COPY } from '../lib/money/moneyCopy.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const src = (p: string) => strip(SOURCES[p]);

// ── 1. Buy a stock, B ───────────────────────────────────────────────────────

Deno.test('1 Buy a stock: ONE top row (back arrow + field); no ShellHeader, no league pill, no "‹ Portfolio" link, no title', () => {
  const s = src('components/money/StockSearchScreen.tsx');
  assertFalse(s.includes('ShellHeader') || s.includes('LeaguePill'), 'the league pill is not on this page');
  assertFalse(s.includes('stockSearchTitle'), 'no "Buy a stock" title');
  assertFalse(/>Portfolio<\/Text>/.test(s), 'no "‹ Portfolio" text link');
  const row = s.slice(s.indexOf('testID="buy-top-row"'), s.indexOf('<ScrollView'));
  assert(row.indexOf('accessibilityLabel="Portfolio"') > 0 && row.indexOf('accessibilityLabel="Portfolio"') < row.indexOf('<TextInput'), 'the back arrow, then the field');
  assert(row.includes('onPress={() => router.back()}'));
  assert(s.includes('back: { width: 44, height: 44'), 'a 44pt target');
  assert(s.includes('field: { flex: 1,'), 'the field fills the rest of the row');
});

Deno.test('1 Buy a stock: the field keeps its inset look, focus ring, autoFocus and remount; its text is capped at 1.6; a divider shows once scrolled', () => {
  const s = src('components/money/StockSearchScreen.tsx');
  assert(s.includes('backgroundColor: colors.inset, borderColor: focused ? colors.accent : colors.rim'));
  assert(s.includes('autoFocus={searchRemount.autoFocus}') && s.includes('key={searchRemount.key}') && s.includes('searchRemount.fontProps(SEARCH_INPUT_FONT_SIZE)'));
  assert(s.includes('maxFontSizeMultiplier={SEARCH_TEXT_MAX_SCALE}') && s.includes('const SEARCH_TEXT_MAX_SCALE = 1.6;'));
  assert(s.includes('numberOfLines={1}'), 'the empty placeholder may end in "…"');
  assert(s.includes('borderBottomColor: edge ? colors.border') && s.includes('onScroll={onScroll}'), 'the divider appears once results scroll');
  assert(s.includes('placeholder={COPY.stockSearchPlaceholder}') && COPY.stockSearchPlaceholder === 'Search by ticker or name');
});

Deno.test('1 Buy a stock: the empty, error and no-match states stay as they were', () => {
  const s = src('components/money/StockSearchScreen.tsx');
  assert(s.includes('<LoadFailure title={COPY.stockSearchLoadTitle}'));
  assert(s.includes('COPY.noStockMatches(query)') && s.includes('COPY.tryTickerOrName'));
  assert(s.includes('query.length === 0 ?'));
});

// ── 2. Draft card, B ────────────────────────────────────────────────────────

const STARTS = '2026-11-14T23:44:00Z'; // Sat, Nov 14 · 6:44 PM ET
const T = Date.parse(STARTS);

Deno.test('2 Draft card: scheduled = "Draft · {Sat, Nov 14 · 6:44 PM ET}", then the clock, NO line under it', () => {
  const c = leagueCountdownCopy('scheduled', STARTS, T - 3 * 3_600_000);
  assertEquals(c.tag, 'Draft · Sat, Nov 14 · 6:44 PM ET');
  assertEquals(c.tag, `Draft · ${etWhenLabel(T)}`);
  assertEquals(c.lines, []);
  assertEquals(c.starting, null);
});

Deno.test('2 Draft card: room open = "Draft room open · {12:48 PM ET}", then the clock, no line', () => {
  const open = '2026-11-14T17:48:00Z'; // 12:48 PM ET
  const c = leagueCountdownCopy('room_open', open, Date.parse(open) - 42 * 60_000);
  assertEquals(c.tag, 'Draft room open · 12:48 PM ET');
  assertEquals(c.tag, `Draft room open · ${etTimeLabel(Date.parse(open))}`);
  assertEquals(c.lines, []);
});

Deno.test('2 Draft card: at 00:00 it is unchanged ("Draft starts in" and the spinner); Home keeps countdownCopy as it was', () => {
  assertEquals(leagueCountdownCopy('starting', STARTS, T), countdownCopy('starting', STARTS, T));
  assertEquals(leagueCountdownCopy('starting', STARTS, T).tag, 'Draft starts in');
  assertEquals(countdownCopy('scheduled', STARTS, T - 3_600_000).tag, 'Draft starts in', "Home's pre-draft card is NOT in scope");
  assertEquals(countdownCopy('scheduled', STARTS, T - 3_600_000).lines, [etWhenLabel(T)]);
  assert(src('app/(tabs)/league.tsx').includes('leagueCountdownCopy(view.countdown, ds.startsAt, serverNow)'));
  assert(src('components/home/PreDraftCard.tsx').includes('countdownCopy(view.countdown, startsAt, serverNow)'));
});

Deno.test('2 Draft card: the tag runs through keepTime and keepDots (the time never splits, a "·" never starts a line); the room-open tag stays live-coloured', () => {
  const card = src('components/game/DraftCountdownCard.tsx');
  assert(card.includes('{keepDots(keepTime(tag))}'));
  assert(card.includes('color={live ? colors.liveText : colors.text2}'));
  assert(src('app/(tabs)/league.tsx').includes("live={view.countdown !== 'scheduled'}"));
  const shown = keepDots(keepTime('Draft · Sat, Nov 14 · 6:44 PM ET'));
  assertFalse(shown.includes(' · '), 'every dot keeps its no-break space before it');
  assert(shown.includes(`6:44${NBSP}PM${NBSP}ET`), 'the time is one run');
  assert(shown.includes(`Draft${NBSP}· `) && shown.includes(`Sat,${NBSP}Nov${NBSP}14${NBSP}· `), 'the line wraps only between its parts');
});

// ── 3. Queue card, B ────────────────────────────────────────────────────────

Deno.test('3 Queue: unfocused and empty = the last ROW; open or typed = the boxed field; 50 of 50 = neither', () => {
  assertEquals(queueSearchMode({ queueLength: 3, open: false, text: '' }), 'row');
  assertEquals(queueSearchMode({ queueLength: 0, open: false, text: '' }), 'row');
  assertEquals(queueSearchMode({ queueLength: 3, open: true, text: '' }), 'field');
  assertEquals(queueSearchMode({ queueLength: 3, open: false, text: 'N' }), 'field');
  assertEquals(queueSearchMode({ queueLength: QUEUE_MAX - 1, open: false, text: '' }), 'row');
  assertEquals(queueSearchMode({ queueLength: QUEUE_MAX, open: false, text: '' }), 'hidden');
  assertEquals(queueSearchMode({ queueLength: QUEUE_MAX, open: true, text: 'N' }), 'hidden', 'at 50 of 50 neither shows, as the field did not before');
  assertEquals(QUEUE_MAX, 50);
});

Deno.test('3 Queue: a blur with nothing typed returns to the row; a pick returns to it too; typed text keeps the field', () => {
  assertEquals(blurReturnsToRow(''), true);
  assertEquals(blurReturnsToRow('N'), false);
  const e = src('components/game/QueueEditor.tsx');
  assert(e.includes('if (blurReturnsToRow(searchText.current)) setSearchOpen(false);'));
  assert(e.includes("setSearch('');\n    setSearchOpen(false);"), 'after a pick');
  assert(e.includes('clearOnSelect') && e.includes('autoFocus={searchOpen}'), 'the tap focuses the same field in place');
  assert(e.includes("{searchMode === 'row' ? <QueueSearchRow onPress={() => setSearchOpen(true)} /> : null}"));
  assert(e.includes("{searchMode === 'field' ? ("));
  assert(e.indexOf('<QueueSearchRow') > e.indexOf('queue.map((sym, i)'), 'the row comes after the list: the LAST row');
});

Deno.test('3 Queue: the row is "+ Search by ticker or name" in the accent, semibold, no box, whole row a "search" target, existing placeholder constant', () => {
  const r = src('components/game/QueueSearchRow.tsx');
  assert(r.includes('accessibilityRole="search"') && r.includes('accessibilityLabel={COPY.stockSearchPlaceholder}'));
  assert(r.includes('{COPY.stockSearchPlaceholder}') && r.includes('color={colors.accent}') && r.includes("fontWeight: '600'"));
  assertFalse(/'Search by ticker or name'/.test(r), 'the words are the constant, not retyped');
  assertFalse(/borderWidth: 1|backgroundColor: colors\.inset|borderRadius/.test(r), 'no inset box, no border');
  assert(r.includes('borderTopWidth') && r.includes('borderTopColor: colors.border'), 'a thin divider above');
  assert(r.includes('minHeight: 52') && r.includes('minWidth: 20'), 'a queue row\'s height and rank column');
  assert(r.includes('<Icon name="add" size="callout" tone="accent" />'));
  assert(r.includes('maxFontSizeMultiplier={QUEUE_SEARCH_ROW_MAX_SCALE}') && QUEUE_SEARCH_ROW_MAX_SCALE === 1.6);
  assert(r.includes('label: { flex: 1, minWidth: 0') && !r.includes('numberOfLines'), 'it wraps in its own column, never clipped');
  assertEquals(COPY.stockSearchPlaceholder, 'Search by ticker or name');
});

Deno.test('3 Queue: the room and the lobby share ONE editor, so one change covers both', () => {
  const users = Object.entries(SOURCES).filter(([, s]) => s.includes('<QueueEditor')).map(([p]) => p).sort();
  assert(users.length >= 2, users.join(','));
  assertFalse(src('components/game/DraftRoom.tsx').includes('QueueSearchRow'));
});

// ── 4. Draft-room turn card, B ──────────────────────────────────────────────

const ROUND = roundPickLine(2, 6, 11);

Deno.test('4 Turn card: someone else\'s turn = the round as the small label, then ONE line about you (before your first pick)', () => {
  const v = turnCardView({ isMyTurn: false, roundLine: ROUND, lastMine: null, lastMineAuto: false, picksAway: 3 });
  assertEquals(v, { tag: 'Round 2 of 6 · Pick 11', roundUnder: null, under: { text: '3 picks until you', mine: false } });
  assertEquals(v.under?.text, picksUntilYouLine(3));
});

Deno.test('4 Turn card: after your first pick the one line is "You took …" in your colour; never both lines', () => {
  const v = turnCardView({ isMyTurn: false, roundLine: ROUND, lastMine: 'NVDA', lastMineAuto: false, picksAway: 3 });
  assertEquals(v.under, { text: "You took NVDA · you're up in 3 picks", mine: true });
  assertEquals(v.under?.text, afterPickLine('NVDA', 3));
  assertEquals(turnCardView({ isMyTurn: false, roundLine: ROUND, lastMine: 'NVDA', lastMineAuto: true, picksAway: 3 }).under?.text, "Auto-picked NVDA for you · you're up in 3 picks");
  // a count with nothing to say draws no line at all (your team is full: the after-pick line says so; no pick and none coming: nothing)
  assertEquals(turnCardView({ isMyTurn: false, roundLine: ROUND, lastMine: null, lastMineAuto: false, picksAway: -1 }).under, null);
  assertEquals(turnCardView({ isMyTurn: false, roundLine: ROUND, lastMine: 'NVDA', lastMineAuto: false, picksAway: -1 }).under?.text, "You took NVDA · that's your team");
});

Deno.test('4 Turn card: your own turn is unchanged (no label, the round line under the headline, no line about you)', () => {
  const v = turnCardView({ isMyTurn: true, roundLine: ROUND, lastMine: 'NVDA', lastMineAuto: false, picksAway: 0 });
  assertEquals(v, { tag: null, roundUnder: ROUND, under: null });
  assertEquals(turnCardLabel(v, "You're on the clock", '0:42'), "You're on the clock, 0:42, Round 2 of 6 · Pick 11", 'the old order');
});

Deno.test('4 Turn card: VoiceOver reads the round, then the headline, then the line', () => {
  const v = turnCardView({ isMyTurn: false, roundLine: ROUND, lastMine: null, lastMineAuto: false, picksAway: 3 });
  assertEquals(turnCardLabel(v, 'Sofia is up', '0:42'), 'Round 2 of 6 · Pick 11, Sofia is up, 0:42');
  const room = src('components/game/DraftRoom.tsx');
  const group = room.slice(room.indexOf('<View style={styles.turnGroup}'), room.indexOf('{turn.under ? ('));
  assert(group.indexOf('turn.tag') < group.indexOf('styles.headline'), 'the label is drawn above the headline');
  const line = room.slice(room.indexOf('{turn.under ? ('), room.indexOf('{waitingForPrices'));
  assert(line.includes('accessibilityLiveRegion="polite"'), 'the line about you is the next element after the group, and still a live region');
  assert(room.indexOf('{turn.under ? (') > room.indexOf('</View>', room.indexOf('<View style={styles.turnGroup}')), 'the line follows the group in reading order');
});

Deno.test('4 Turn card: the callout round line under the headline is gone on someone else\'s turn; the tag goes through keepDots', () => {
  const room = src('components/game/DraftRoom.tsx');
  assertFalse(room.includes('tone={isMyTurn ?'), 'no more round line that turns secondary');
  assert(room.includes('{keepDots(turn.tag)}') && room.includes('variant="tag" tone="secondary"'));
  assert(room.includes('{turn.roundUnder ? <Text variant="callout"'));
  assert(room.includes('clockRowStacked'), 'at AX5 the ring still stacks above');
});

// ── 5. Blockers card, A ─────────────────────────────────────────────────────

Deno.test('5 Blockers card: no line (BOTH sentences cut); the tag and the title stay', () => {
  const c = blockersCardCopy('risk', '6:00 PM ET');
  assertEquals(c, { tag: 'Needs you before 6:00 PM ET', title: 'The draft can’t start yet', line: null });
  const all = JSON.stringify(c);
  assertFalse(all.includes('Fix these before') || all.includes('when the draft room opens') || all.includes('the draft is postponed'));
  assertEquals(blockersCardCopy('risk', null).tag, 'Needs you before the draft room opens');
});

Deno.test('5 Blockers card: no empty Text is left, and the blocker sub-cards keep their own lines', () => {
  const card = src('components/game/DraftBlockersCard.tsx');
  assert(card.includes('{copy.line ? <Text variant="caption" subOf="headline">'), 'rendered only when there is a line');
  assert(card.includes('{view.line}'), 'the sub-card line stays');
});

// ── 6. Dead links, B ────────────────────────────────────────────────────────

Deno.test('6 Dead links: the exact words (one copy module for both screens and this test)', () => {
  assertEquals(RESET_DEAD_LINK, { icon: 'unlink', heading: "This link didn't work.", line: 'It may have been opened on a different device.', primary: 'Request a new link', secondary: 'Back to sign in' });
  assertEquals(NOT_FOUND, { icon: 'search', heading: 'Nothing here.', line: 'This link is old or incomplete.', primary: 'Go to Home' });
  assert(RESET_DEAD_LINK.heading.endsWith('.') && NOT_FOUND.heading.endsWith('.'), 'the heading ends in a full stop');
});

Deno.test('6 Dead links: the old sentences are gone from both screens', () => {
  const rp = SOURCES['app/reset-password.tsx'];
  const nf = SOURCES['app/+not-found.tsx'];
  assertFalse(rp.includes('It may have expired, been used already'));
  assertFalse(rp.includes("This link didn't work\""), 'no heading literal left in the screen');
  assertFalse(nf.includes('Everything in your leagues is still where you left it'));
  assertFalse(nf.includes('Nothing here<'));
});

Deno.test('6 Dead links: both screens are a RefusalScreen reading the module; the actions are bound', () => {
  const rp = src('app/reset-password.tsx');
  const invalid = rp.slice(rp.indexOf("screenState === 'invalid'"), rp.indexOf('<NewPasswordForm'));
  assert(invalid.includes('<RefusalScreen') && !invalid.includes('EmptyState'));
  for (const f of ['icon={RESET_DEAD_LINK.icon}', 'heading={RESET_DEAD_LINK.heading}', 'line={RESET_DEAD_LINK.line}', "onPress: () => router.replace('/forgot-password')", 'onPress: handleCancel']) assert(invalid.includes(f), f);
  assert(rp.includes("from '@/lib/shell/deadLinkCopy'"));
  const nf = src('app/+not-found.tsx');
  for (const f of ['<RefusalScreen', 'icon={NOT_FOUND.icon}', 'heading={NOT_FOUND.heading}', 'line={NOT_FOUND.line}', 'onPress: goHome', 'gestureEnabled: false', 'router.dismissAll()', "router.replace('/')"]) assert(nf.includes(f), f);
  assert(nf.includes("from '@/lib/shell/deadLinkCopy'"));
});

Deno.test('6 Dead links: the secondary on the reset screen is the muted "Back to sign in" link (RefusalScreen\'s secondary), the primary a full-width pill', () => {
  const r = src('components/shell/RefusalScreen.tsx');
  assert(r.includes('<Link label={secondary.label} onPress={secondary.onPress} muted />'));
  assert(r.includes('<Button label={primary.label} onPress={primary.onPress} fullWidth />'));
});
