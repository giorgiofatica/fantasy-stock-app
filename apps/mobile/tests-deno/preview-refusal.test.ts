/**
 * The buy sheet's preview refusals (docs/plans/2026-11-18-stocks-tab.md, part 3, point 7; docs/PRODUCT_RULES.md
 * "Too many taps on 'Review buy' reuse the approved 'Too many tries' lines (B)", 2026-11-23).
 *
 * record-trade's preview answers as the buy would:
 *   - not_draftable (200): the BUY's own sentence, through the buy's mapper (refusals.ts), before the review;
 *   - rate_limited (the per-minute 429): "Too many tries. Wait a moment, then try again.";
 *   - preview_limited (the hour/day cap, a 200): "Too many tries. Try again later.".
 * A paced review does not open: the line sits in the sheet's warn panel above Review buy, which stays ENABLED as
 * the retry, with no separate Try again. The two lines are the approved ones, hoisted to lib/tooManyTries.ts:
 * the old screens (join, takeover, leave, account deletion) must still show the same bytes.
 */
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert';
import { SOURCES } from './sourceManifest.generated.ts';
import { pacedPreviewLine, readPreviewAnswer } from '../lib/money/previewAnswer.ts';
import { refusalCopy } from '../lib/money/refusals.ts';
import { COPY } from '../lib/money/moneyCopy.ts';
import { TOO_MANY_TRIES_LATER, TOO_MANY_TRIES_WAIT } from '../lib/tooManyTries.ts';
import { errorMessage, JOIN_COPY } from '../lib/join/joinPreview.ts';
import { TRY_LATER } from '../lib/account/deleteCopy.ts';
import { waitLine } from '../lib/account/takeoverRefusal.ts';
import { leaveOutcome } from '../lib/game/leaveLeague.ts';

const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
/** The approved bytes, as they were before the hoist (joinPreview.ts / leaveLeague.ts / deleteCopy.ts). */
const WAIT = 'Too many tries. Wait a moment, then try again.';
const LATER = 'Too many tries. Try again later.';

/** A non-2xx from supabase.functions.invoke: no data, an error whose context is the Response. */
const httpError = (status: number, body?: unknown) => ({
  data: null,
  error: Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    context: { status, json: () => (body === undefined ? Promise.reject(new Error('not json')) : Promise.resolve(body)) },
  }),
});
/** A dropped connection: an error with no Response. */
const transport = { data: null, error: new Error('Failed to send a request to the Edge Function') };

// ---------------------------------------------------------------------------
// Reading the answer
// ---------------------------------------------------------------------------

Deno.test('readPreviewAnswer: not_draftable (a 200) is the not_draftable refusal', async () => {
  assertEquals(await readPreviewAnswer({ data: { ok: false, reason: 'not_draftable' }, error: null }), { kind: 'refused', reason: 'not_draftable' });
});

Deno.test('readPreviewAnswer: the per-minute 429 rate_limited is read from the Response body, as the buy reads it', async () => {
  assertEquals(await readPreviewAnswer(httpError(429, { ok: false, reason: 'rate_limited' })), { kind: 'refused', reason: 'rate_limited' });
});

Deno.test('readPreviewAnswer: the hour/day cap (a 200 preview_limited) is its own refusal', async () => {
  assertEquals(await readPreviewAnswer({ data: { ok: false, reason: 'preview_limited' }, error: null }), { kind: 'refused', reason: 'preview_limited' });
});

Deno.test('readPreviewAnswer: each pacing reason counts only in its own shape (a 200 rate_limited, a 429 preview_limited: null)', async () => {
  assertEquals(await readPreviewAnswer({ data: { ok: false, reason: 'rate_limited' }, error: null }), null);
  assertEquals(await readPreviewAnswer(httpError(429, { ok: false, reason: 'preview_limited' })), null);
  assertEquals(await readPreviewAnswer(httpError(403, { ok: false, reason: 'not_draftable' })), null);
});

Deno.test('readPreviewAnswer: every other refusal, a 5xx, a non-JSON 429, a transport failure and junk read as null (cantReach)', async () => {
  for (const reason of ['unhandled', 'not_a_member', 'league_not_found', 'season_completed', 'no_eligible_slot', 'anything']) {
    assertEquals(await readPreviewAnswer({ data: { ok: false, reason }, error: null }), null, reason);
  }
  assertEquals(await readPreviewAnswer(httpError(500, { ok: false, reason: 'unhandled' })), null);
  assertEquals(await readPreviewAnswer(httpError(429)), null, 'a 429 with no readable body is a transport failure');
  assertEquals(await readPreviewAnswer(transport), null);
  assertEquals(await readPreviewAnswer({ data: null, error: null }), null);
  assertEquals(await readPreviewAnswer({ data: 'ok', error: null }), null);
  assertEquals(await readPreviewAnswer({ data: { ok: false }, error: null }), null);
});

Deno.test('readPreviewAnswer: an answered preview parses exactly as fetchPreview always did', async () => {
  const answer = await readPreviewAnswer({
    data: {
      ok: true, stake_mode: 'price_tiers', stake: null, unfilled_slots: 0, sources: [], market: null,
      slots: [], unplaced: [],
      would_fill: null,
      open_slots: [{ slot_id: 's-lo', slot_index: 0, slot_count: 1, price_min: 0, price_max: 200, category_id: null }],
    },
    error: null,
  });
  assertEquals(answer, {
    kind: 'ok',
    preview: {
      stakeMode: 'price_tiers', stake: null, unfilledSlots: 0, sources: [], slots: [],
      wouldFill: null,
      openSlots: [{ slot_id: 's-lo', slot_index: 0, slot_count: 1, price_min: 0, price_max: 200, category_id: null }],
    },
  });
  const funding = await readPreviewAnswer({
    data: { ok: true, stake_mode: 'fixed_notional', stake: 1000, unfilled_slots: 1, sources: [{ trade_id: 't1', symbol: 'NVDA', amount: 1055.56 }], slots: [] },
    error: null,
  });
  assertEquals(funding, {
    kind: 'ok',
    preview: { stakeMode: 'fixed_notional', stake: 1000, unfilledSlots: 1, sources: [{ trade_id: 't1', symbol: 'NVDA', amount: 1055.56 }], slots: [] },
  });
  // A malformed source still voids the whole answer, as before.
  assertEquals(await readPreviewAnswer({ data: { ok: true, sources: [{ trade_id: 1 }] }, error: null }), null);
});

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

Deno.test('each case gets its line: the minute -> the short wait, the hour/day cap -> the long one, not_draftable -> none (refusals.ts)', () => {
  assertEquals(pacedPreviewLine('rate_limited'), WAIT);
  assertEquals(pacedPreviewLine('preview_limited'), LATER);
  assertEquals(pacedPreviewLine('not_draftable'), null);
});

Deno.test('not_draftable is worded by the BUY\'s mapper: the same sentence the buy shows', () => {
  assertEquals(refusalCopy('not_draftable', { symbol: 'XOM' }).message, COPY.notDraftableSymbol('XOM'));
  assertEquals(COPY.notDraftableSymbol('XOM'), "XOM isn't in this league's list of stocks.");
  assertMatch(code(SOURCES['lib/money/reviewPresentation.ts']), /refusalCopy\(state\.reason, \{ symbol: ctx\.symbol/);
});

Deno.test('the hoisted lines are byte-identical to the approved originals, and every old screen still shows the same text', () => {
  assertEquals(TOO_MANY_TRIES_WAIT, WAIT);
  assertEquals(TOO_MANY_TRIES_LATER, LATER);
  // Join (the shipped 429 line) and takeover's short wait.
  assertEquals(JOIN_COPY.rateLimited, WAIT);
  assertEquals(errorMessage('rate_limited'), WAIT);
  assertEquals(waitLine('moment'), WAIT);
  // Account deletion's proof limit and takeover's hour lockout.
  assertEquals(TRY_LATER, LATER);
  assertEquals(waitLine('later'), LATER);
  // Leave a league: a 429 rate_limited.
  assertEquals(leaveOutcome({ transport: false, status: 429, reason: 'rate_limited', body: {} }), { kind: 'refused', reason: 'rate_limited', line: WAIT });
  // The account-deletion screen still renders TRY_LATER in its warn panel.
  assertMatch(SOURCES['components/shell/DeleteAccountView.tsx'], /\{state\.rateLimited \? <WarnPanel text=\{TRY_LATER\} \/> : null\}/);
});

Deno.test('the lines live in ONE place: no other app source spells them out (hoisted, not copied)', () => {
  for (const [path, src] of Object.entries(SOURCES)) {
    if (path === 'lib/tooManyTries.ts') continue;
    if (!/^(app|components|lib)\//.test(path)) continue;
    const live = code(src);
    assert(!live.includes(WAIT), `${path} spells out the short-wait line; import TOO_MANY_TRIES_WAIT`);
    assert(!live.includes(LATER), `${path} spells out the long-wait line; import TOO_MANY_TRIES_LATER`);
  }
  assertMatch(code(SOURCES['lib/join/joinPreview.ts']), /rateLimited: TOO_MANY_TRIES_WAIT,/);
  assertMatch(code(SOURCES['lib/game/leaveLeague.ts']), /rate_limited: TOO_MANY_TRIES_WAIT,/);
  assertMatch(code(SOURCES['lib/account/deleteCopy.ts']), /export const TRY_LATER = TOO_MANY_TRIES_LATER;/);
});

// ---------------------------------------------------------------------------
// The sheet (StockSheetBody)
// ---------------------------------------------------------------------------

Deno.test('wiring: the buy check reads the answer; a paced answer goes back to the sheet, not_draftable gets the buy\'s sentence, null stays cantReach', () => {
  const body = code(SOURCES['components/money/StockSheetBody.tsx']);
  assertMatch(body, /const answer = await fetchPreviewAnswer\(previewBody\(league\.id, \{ price, symbol \}\)\);/);
  assertMatch(body, /if \(!answer\) return \{ kind, review: null, body: null, error: COPY\.cantReach, loading: false \};/);
  assertMatch(body, /const pacedLine = pacedPreviewLine\(answer\.reason\);\s*if \(pacedLine\) return \{ kind, review: null, body: null, error: null, loading: false, paced: pacedLine \};/);
  assertMatch(body, /return \{ kind, review: null, body: null, error: refusalCopy\(answer\.reason, \{ symbol: symbol\.toUpperCase\(\) \}\)\.message, loading: false, warn: true \};/);
  assert(body.indexOf('pacedPreviewLine(answer.reason)') < body.indexOf('refusalCopy(answer.reason'), 'pacing is decided before the not_draftable sentence');
  assert(body.indexOf("answer.kind === 'refused'") < body.indexOf('buyReviewOneShare('), 'every refusal comes before the review');
  assert(!/COPY\.rateLimited/.test(body), 'the trades pacing sentence is never used for a buy review');
});

Deno.test('presentation: a paced review does NOT open; the line sits in the warn panel above Review buy', () => {
  const body = code(SOURCES['components/money/StockSheetBody.tsx']);
  // openReview: a paced answer closes the loading review and keeps the line; the next tap clears it first.
  assertMatch(body, /setPaced\(null\);\s*setOpen\(\{ kind, review: null, body: null, error: null, loading: true \}\);\s*const next = await buildReview\(kind, pickedId\);\s*if \(next\.paced\) \{\s*setOpen\(null\);\s*setPaced\(next\.paced\);\s*return;\s*\}/);
  // The panel: the warn panel, drawn before (above) the Review buy button.
  const panel = body.indexOf("selected === 'buy' && paced ? <WarnPanel text={paced} /> : null}");
  const button = body.indexOf('testID="stock-sheet-review"');
  assert(panel > 0 && button > panel, 'the paced line is drawn above Review buy');
  // A new stock starts with no line.
  assertMatch(body, /useEffect\(\(\) => \{ setPaced\(null\); \}, \[symbol\]\);/);
});

Deno.test('presentation: Review buy stays ENABLED while the paced line shows (it is the retry), and there is no separate Try again', () => {
  const body = code(SOURCES['components/money/StockSheetBody.tsx']);
  // The button's enabled rule is the model's and the market's only: `paced` never disables it.
  assertMatch(body, /disabled=\{!\(canReview && gate\.open\)\}/);
  const disabledExprs = [...body.matchAll(/disabled=\{([^}]*)\}/g)].map((m) => m[1]);
  assert(disabledExprs.every((e) => !/paced/.test(e)), 'no button is disabled by the paced line');
  // The only Try again in the sheet is the no_price/invalid_price one inside an opened refusal, never with `paced`.
  const tryAgains = [...body.matchAll(/label=\{COPY\.tryAgain\}/g)].length;
  assertEquals(tryAgains, 1);
  assert(!/paced[^\n]*COPY\.tryAgain|COPY\.tryAgain[^\n]*paced/.test(body), 'no Try again next to the paced line');
  // Its tap is the retry: Review buy opens the review again (openReview clears the line first).
  assertMatch(body, /onPress=\{\(\) => openReview\(selected\)\}\s*testID="stock-sheet-review"/);
});

Deno.test('wiring: fetchPreview (every other caller) is unchanged: a refusal is null for it', () => {
  const rt = code(SOURCES['lib/money/recordTrade.ts']);
  assertMatch(rt, /const answer = await fetchPreviewAnswer\(body\);\s*return answer\?\.kind === 'ok' \? answer\.preview : null;/);
  assertMatch(rt, /return readPreviewAnswer\(await supabase\.functions\.invoke\('record-trade', \{ body \}\)\);/);
});

Deno.test('a real buy or sell 429 keeps what it shows today (refusals.ts rate_limited: the trades line), untouched by the review\'s lines', () => {
  assertEquals(refusalCopy('rate_limited', { symbol: 'AAPL' }).message, COPY.rateLimited);
  assertEquals(COPY.rateLimited, 'Too many trades in a row. Wait a moment and try again.');
  assert(!/preview_limited/.test(code(SOURCES['lib/money/refusals.ts'])), 'the trade mapper has no preview_limited case');
});
