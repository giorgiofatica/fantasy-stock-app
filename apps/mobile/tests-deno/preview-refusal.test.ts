/**
 * The buy sheet's preview refusal (docs/plans/2026-11-18-stocks-tab.md, part 3, point 7, corrected 2026-11-23).
 *
 * record-trade's preview now answers as the buy would: a stock the buy refuses as not_draftable gets
 * {ok:false, reason:'not_draftable'} instead of a slot answer. The app words it with the BUY's own mapper
 * (refusals.ts), before the review, where a slot refusal goes. A paced preview (the minute's 429 rate_limited,
 * or the hour/day cap's 200 preview_limited) keeps today's rendering, COPY.cantReach, until Giorgio rules on words.
 */
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert';
import { SOURCES } from './sourceManifest.generated.ts';
import { readPreviewAnswer } from '../lib/money/previewAnswer.ts';
import { refusalCopy } from '../lib/money/refusals.ts';
import { COPY } from '../lib/money/moneyCopy.ts';

const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
/** A non-2xx from supabase.functions.invoke: no data, an error (the 429 and the 500 both arrive this way). */
const httpError = (status: number) => ({ data: null, error: Object.assign(new Error('Edge Function returned a non-2xx status code'), { context: { status } }) });

Deno.test('readPreviewAnswer: the preview\'s not_draftable (a 200 refusal) is kept apart as a refusal', () => {
  assertEquals(readPreviewAnswer({ data: { ok: false, reason: 'not_draftable' }, error: null }), { kind: 'refused', reason: 'not_draftable' });
});

Deno.test('readPreviewAnswer: a paced preview is NOT a refusal the app words yet: the minute\'s 429 and the hour/day cap\'s 200 preview_limited both read as null (cantReach)', () => {
  assertEquals(readPreviewAnswer(httpError(429)), null);
  assertEquals(readPreviewAnswer({ data: { ok: false, reason: 'rate_limited' }, error: null }), null);
  // The hour/day cap (record-trade/preview-gate.ts): a 200 with its own reason. No words until Giorgio rules.
  assertEquals(readPreviewAnswer({ data: { ok: false, reason: 'preview_limited' }, error: null }), null);
});

Deno.test('readPreviewAnswer: every other refusal, a 500 and junk read as null (cantReach), as before', () => {
  for (const reason of ['unhandled', 'not_a_member', 'league_not_found', 'season_completed', 'no_eligible_slot', 'anything']) {
    assertEquals(readPreviewAnswer({ data: { ok: false, reason }, error: null }), null, reason);
  }
  assertEquals(readPreviewAnswer(httpError(500)), null);
  assertEquals(readPreviewAnswer({ data: null, error: null }), null);
  assertEquals(readPreviewAnswer({ data: 'ok', error: null }), null);
  assertEquals(readPreviewAnswer({ data: { ok: false }, error: null }), null);
});

Deno.test('readPreviewAnswer: an answered preview parses exactly as fetchPreview always did', () => {
  const answer = readPreviewAnswer({
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
  const funding = readPreviewAnswer({
    data: { ok: true, stake_mode: 'fixed_notional', stake: 1000, unfilled_slots: 1, sources: [{ trade_id: 't1', symbol: 'NVDA', amount: 1055.56 }], slots: [] },
    error: null,
  });
  assertEquals(funding, {
    kind: 'ok',
    preview: { stakeMode: 'fixed_notional', stake: 1000, unfilledSlots: 1, sources: [{ trade_id: 't1', symbol: 'NVDA', amount: 1055.56 }], slots: [] },
  });
  // A malformed source still voids the whole answer, as before.
  assertEquals(readPreviewAnswer({ data: { ok: true, sources: [{ trade_id: 1 }] }, error: null }), null);
});

Deno.test('the refusal is worded by the BUY\'s mapper: the same sentence the buy shows for not_draftable', () => {
  assertEquals(refusalCopy('not_draftable', { symbol: 'XOM' }).message, COPY.notDraftableSymbol('XOM'));
  assertEquals(COPY.notDraftableSymbol('XOM'), "XOM isn't in this league's list of stocks.");
  // The buy's review words a refusal through the same function (reviewPresentation.ts).
  assertMatch(code(SOURCES['lib/money/reviewPresentation.ts']), /refusalCopy\(state\.reason, \{ symbol: ctx\.symbol/);
});

Deno.test('wiring: the sheet\'s buy check reads the answer, words not_draftable through refusalCopy before the review, and keeps cantReach for the rest', () => {
  const body = code(SOURCES['components/money/StockSheetBody.tsx']);
  assertMatch(body, /const answer = await fetchPreviewAnswer\(previewBody\(league\.id, \{ price, symbol \}\)\);/);
  // null (including a paced preview) -> cantReach, unchanged.
  assertMatch(body, /if \(!answer\) return \{ kind, review: null, body: null, error: COPY\.cantReach, loading: false \};/);
  // refused -> the buy's own sentence, no review, warn, as the slot refusal is shown.
  assertMatch(body, /if \(answer\.kind === 'refused'\) \{\s*return \{ kind, review: null, body: null, error: refusalCopy\(answer\.reason, \{ symbol: symbol\.toUpperCase\(\) \}\)\.message, loading: false, warn: true \};/);
  // The refusal is decided before the review is built.
  assert(body.indexOf("answer.kind === 'refused'") < body.indexOf('buyReviewOneShare('), 'the refusal comes before the review');
  // The app never uses the trades pacing sentence for a preview, and has no words for preview_limited yet.
  assert(!/COPY\.rateLimited/.test(body), 'no rateLimited wording in the sheet');
  assert(!/preview_limited/.test(code(SOURCES['lib/money/refusals.ts'])), 'refusals.ts has no case for preview_limited yet');
});

Deno.test('wiring: fetchPreview (every other caller) is unchanged: a refusal is null for it', () => {
  const rt = code(SOURCES['lib/money/recordTrade.ts']);
  assertMatch(rt, /const answer = await fetchPreviewAnswer\(body\);\s*return answer\?\.kind === 'ok' \? answer\.preview : null;/);
  assertMatch(rt, /return readPreviewAnswer\(await supabase\.functions\.invoke\('record-trade', \{ body \}\)\);/);
});
