/**
 * The round ticker badge (the 40pt disc on Holdings, the Stocks list and search): Giorgio's pick A, PRODUCT_RULES
 * "A long ticker shrinks to fit its round badge (A)" (2026-11-19, board #call-ticker-disc, PR #565). Before it, the
 * disc's 13pt ticker stopped at the 11pt floor (0.85) and iOS cut GOOGL, BRK.B and AMGN to "GO…", "BR…", "AM…".
 * Pinned:
 *   - the badge text shrinks to fit with NO floor (GOOGL ≈ 9.3pt), so every ticker the app can hold fits whole;
 *   - short tickers keep their full 13pt (nothing grows, nothing else moves);
 *   - the exception is LOCAL: one named constant in holdingFit.ts, cited to the ruling, used only by
 *     discTickerScale; no other file reads it;
 *   - the three badges never truncate with "…" (ellipsizeMode="clip"), never ask iOS to fit, never scale with
 *     Dynamic Type, and stay decorative for VoiceOver (the row's own label names the stock).
 * Run: cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .
 */
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';
import {
  DISC_EXCEPTION_MIN_SCALE, DISC_PT, DISC_TEXT_ROOM, discTickerScale, tickerWidth, TICKER_EM, VALUE_MIN_SCALE,
} from '../components/sp/logic/holdingFit.ts';

const ROOT = new URL('../', import.meta.url);
const read = (rel: string) => Deno.readTextFileSync(new URL(rel, ROOT));
/** The point size the badge draws `t` at. */
const shownPt = (t: string) => DISC_PT * discTickerScale(t);
/** The width the badge draws `t` at. */
const shownWidth = (t: string) => tickerWidth(t, shownPt(t));

Deno.test('A: GOOGL, BRK.B and AMGN shrink to fit the round badge (about 9pt for GOOGL), whole', () => {
  assertEquals(Math.round(shownPt('GOOGL') * 10) / 10, 9.3);
  assertEquals(Math.round(shownPt('BRK.B') * 10) / 10, 10.8);
  assertEquals(Math.round(shownPt('AMGN') * 10) / 10, 11.0);
  // AMGN is 0.849: a hair under the old 0.85 floor, which is why it was cut too.
  assert(discTickerScale('AMGN') < 0.85, String(discTickerScale('AMGN')));
  for (const t of ['GOOGL', 'BRK.B', 'AMGN']) {
    assert(shownWidth(t) <= DISC_TEXT_ROOM + 1e-9, `${t} draws ${shownWidth(t)}pt in a ${DISC_TEXT_ROOM}pt room`);
    assert(shownWidth(t) > DISC_TEXT_ROOM - 0.01, `${t} fills the room: shrunk no more than it must`);
  }
});

Deno.test('A: short tickers keep their full 13pt; nothing is ever enlarged', () => {
  for (const t of ['V', 'KO', 'JPM', 'XOM', 'TSLA', 'PLTR', 'MMM']) assertEquals(shownPt(t), DISC_PT, t);
  for (const t of ['GOOGL', 'BRK.B', 'AMGN', 'NVDA', 'AAPL']) assert(shownPt(t) < DISC_PT, t);
});

Deno.test('A: every ticker shape the app can hold fits its badge (no floor to stop at)', () => {
  assertEquals(DISC_EXCEPTION_MIN_SCALE, 0);
  // The symbols the app holds are ALPACA_TICKER_RE (enrich-symbols/price-batch.ts): 1-6 letters, then an
  // optional "." and 1-2 letters. Sweep every letter at every length, with and without a class suffix,
  // including the widest (WWWWWW.WW).
  const re = /^[A-Z]{1,6}(\.[A-Z]{1,2})?$/;
  const priceBatch = Deno.readTextFileSync(new URL('../../../supabase/functions/enrich-symbols/price-batch.ts', import.meta.url));
  assert(priceBatch.includes(`export const ALPACA_TICKER_RE = /${re.source}/;`), 'the sweep follows the real symbol shape');
  const letters = Object.keys(TICKER_EM).filter((c) => /[A-Z]/.test(c));
  assertEquals(letters.length, 26);
  let checked = 0;
  for (const c of letters) {
    for (let n = 1; n <= 6; n++) {
      for (const suffix of ['', `.${c}`, `.${c}${c}`]) {
        const t = c.repeat(n) + suffix;
        assert(re.test(t), t);
        assert(shownWidth(t) <= DISC_TEXT_ROOM + 1e-9, `${t}: ${shownWidth(t)}pt`);
        assert(discTickerScale(t) > 0 && discTickerScale(t) <= 1, t);
        checked++;
      }
    }
  }
  assertEquals(checked, 26 * 6 * 3);
});

Deno.test('the exception is local: one named constant, cited to the ruling, used only by discTickerScale', () => {
  const fit = read('components/sp/logic/holdingFit.ts');
  assert(fit.includes('export const DISC_EXCEPTION_MIN_SCALE = 0;'));
  const doc = fit.slice(fit.lastIndexOf('/**', fit.indexOf('export const DISC_EXCEPTION_MIN_SCALE')), fit.indexOf('export const DISC_EXCEPTION_MIN_SCALE'));
  for (const s of ['THE ONE EXCEPTION', '11pt floor', 'A long ticker shrinks to fit its round badge (A)', '2026-11-19', '#call-ticker-disc', 'PR #565', 'beside the badge']) {
    assert(doc.includes(s), `the constant's comment cites: ${s}`);
  }
  // The ruling it cites exists, in the words cited.
  assert(Deno.readTextFileSync(new URL('../../../docs/PRODUCT_RULES.md', import.meta.url)).includes('**A long ticker shrinks to fit its round badge (A)** (2026-11-19'));
  // Used once in the file (by discTickerScale), and by no other source.
  assertEquals(fit.match(/, DISC_EXCEPTION_MIN_SCALE\)/g)?.length, 1);
  assert(/export function discTickerScale\(symbol: string\): number \{\n\s+return flooredFitScale\(DISC_TEXT_ROOM, tickerWidth\(symbol, DISC_PT\), DISC_EXCEPTION_MIN_SCALE\);\n\}/.test(fit));
  // The value keeps its own floor.
  assertEquals(VALUE_MIN_SCALE, 0.75);
  const users: string[] = [];
  const walk = (dir: URL, rel: string) => {
    for (const e of Deno.readDirSync(dir)) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const r = `${rel}${e.name}`;
      if (e.isDirectory) walk(new URL(`${e.name}/`, dir), `${r}/`);
      else if (/\.(ts|tsx)$/.test(e.name) && read(r).includes('DISC_EXCEPTION_MIN_SCALE')) users.push(r);
    }
  };
  for (const d of ['app', 'components', 'lib', 'hooks', 'constants']) {
    try { walk(new URL(`${d}/`, ROOT), `${d}/`); } catch (e) { if (!(e instanceof Deno.errors.NotFound)) throw e; }
  }
  assertEquals(users, ['components/sp/logic/holdingFit.ts']);
});

const BADGE_HOSTS: Array<[string, string]> = [
  ['components/money/HoldingRow.tsx', 'row.symbol'],
  ['components/stocks/StocksScreen.tsx', 'row.symbol'],
  ['components/money/StockSearchScreen.tsx', 'item.symbol'],
];

Deno.test('the three badges: never "…", never iOS-fitted, never Dynamic Type, the shared fit', () => {
  for (const [file, sym] of BADGE_HOSTS) {
    const src = read(file);
    const line = `<Text variant="ticker.tile" allowFontScaling={false} numberOfLines={1} ellipsizeMode="clip" style={{ fontSize: DISC_PT * discTickerScale(${sym}) }}>{${sym}}</Text>`;
    assertEquals(src.split(line).length - 1, 1, `${file}: the badge text, once`);
    const disc = src.slice(src.lastIndexOf('<View', src.indexOf(line)), src.indexOf('</View>', src.indexOf(line)));
    assert(disc.includes('styles.disc'), `${file}: the line sits in the disc`);
    assertFalse(/adjustsFontSizeToFit|minimumFontScale|…|\\u2026/.test(disc), `${file}: no iOS fit, no ellipsis`);
    assert(/disc: \{\s*width: 40,\s*height: 40,\s*borderRadius: 20,/.test(src), `${file}: the badge stays a 40pt circle`);
  }
});

Deno.test('VoiceOver unchanged: the badge text is decorative inside a row that carries its own label', () => {
  for (const [file, sym] of BADGE_HOSTS) {
    const src = read(file);
    const at = src.indexOf(`discTickerScale(${sym})`);
    const lineStart = src.lastIndexOf('\n', at);
    const textLine = src.slice(lineStart, src.indexOf('\n', at));
    assertFalse(/accessib/.test(textLine), `${file}: the badge text has no accessibility props of its own`);
    // Its host is one accessible element (a button or `accessible` view) with an explicit label.
    assert(/accessibilityLabel=\{(label|rowLabel\(row, category, priceText\))\}/.test(src), file);
  }
});
