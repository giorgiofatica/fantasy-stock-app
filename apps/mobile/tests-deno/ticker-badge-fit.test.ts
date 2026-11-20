/**
 * The round ticker badge (components/sp/gn/TickerBadge: 40pt on Holdings, the Stocks list, search and Trade history;
 * 52pt on the stock sheet and the player card): Giorgio's pick A, PRODUCT_RULES
 * "A long ticker shrinks to fit its round badge (A)" (2026-11-19, board #call-ticker-disc, PR #565). Before it, the
 * disc's 13pt ticker stopped at the 11pt floor (0.85) and iOS cut GOOGL, BRK.B and AMGN to "GO…", "BR…", "AM…".
 * Pinned:
 *   - the badge text shrinks to fit with NO floor (GOOGL ≈ 9.3pt), so every ticker the app can hold fits whole;
 *   - short tickers keep their full 13pt (nothing grows, nothing else moves);
 *   - the exception is LOCAL: one named constant in holdingFit.ts, cited to the ruling, used only by
 *     discTickerScale; no other file reads it;
 *   - ONE badge component, every host uses it, and no hand-made copy is left (the Planner, 2026-11-19: the pick
 *     covers every copy of the badge); it never truncates with "…" (ellipsizeMode="clip"), never asks iOS to fit,
 *     never scales with Dynamic Type, and stays decorative for VoiceOver (the host names the stock);
 *   - the 52pt badge uses the same rule over its 48pt room, and stays well above 9pt for any 5-character ticker.
 * Run: cd apps/mobile/tests-deno && deno test --allow-read --allow-env --allow-sys --allow-run .
 */
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';
import {
  badgeTextRoom, DISC_EXCEPTION_MIN_SCALE, DISC_PT, DISC_TEXT_ROOM, discTickerScale, TICKER_BADGE_SIZES, tickerWidth, TICKER_EM, VALUE_MIN_SCALE,
} from '../components/sp/logic/holdingFit.ts';

const ROOT = new URL('../', import.meta.url);
const read = (rel: string) => Deno.readTextFileSync(new URL(rel, ROOT));
/** Source without its comments (a comment may NAME the exception; only code may USE it). */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
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
  assert(/export function discTickerScale\(symbol: string, size: TickerBadgeSize = DISC_SIZE\): number \{\n\s+return flooredFitScale\(badgeTextRoom\(size\), tickerWidth\(symbol, DISC_PT\), DISC_EXCEPTION_MIN_SCALE\);\n\}/.test(fit));
  // The value keeps its own floor.
  assertEquals(VALUE_MIN_SCALE, 0.75);
  const users: string[] = [];
  const walk = (dir: URL, rel: string) => {
    for (const e of Deno.readDirSync(dir)) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const r = `${rel}${e.name}`;
      if (e.isDirectory) walk(new URL(`${e.name}/`, dir), `${r}/`);
      else if (/\.(ts|tsx)$/.test(e.name) && code(read(r)).includes('DISC_EXCEPTION_MIN_SCALE')) users.push(r);
    }
  };
  for (const d of ['app', 'components', 'lib', 'hooks', 'constants']) {
    try { walk(new URL(`${d}/`, ROOT), `${d}/`); } catch (e) { if (!(e instanceof Deno.errors.NotFound)) throw e; }
  }
  assertEquals(users, ['components/sp/logic/holdingFit.ts']);
});

/** Every round ticker badge in the app, by host: [file, the exact TickerBadge element]. */
const BADGE_HOSTS: Array<[string, string]> = [
  ['components/money/HoldingRow.tsx', '<TickerBadge symbol={row.symbol} />'],
  ['components/stocks/StocksScreen.tsx', '<TickerBadge symbol={row.symbol} />'],
  ['components/money/StockSearchScreen.tsx', '<TickerBadge symbol={item.symbol} style={off ? styles.dim : null} />'],
  ['components/money/TradeHistoryScreen.tsx', '<TickerBadge symbol={item.symbol} />'],
  ['components/money/StockSheetBody.tsx', '<TickerBadge symbol={symbol} size={52} />'],
  ['components/sp/gn/PlayerCard.tsx', '<TickerBadge symbol={ticker} size={52} />'],
];
const BADGE = 'components/sp/gn/TickerBadge.tsx';

Deno.test('TickerBadge: the one badge. A size circle, the shared fit, never "…", never iOS-fitted, never Dynamic Type', () => {
  const src = read(BADGE);
  const line = '<Text variant="ticker.tile" allowFontScaling={false} numberOfLines={1} ellipsizeMode="clip" style={{ fontSize: DISC_PT * discTickerScale(symbol, size) }}>{symbol}</Text>';
  assertEquals(src.split(line).length - 1, 1, 'the badge text, once');
  assert(src.includes('{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.inset }'), 'a circle, `size` wide');
  assert(src.includes('size?: TickerBadgeSize;') && src.includes('size = 40'), 'two sizes only, 40 by default');
  assertFalse(/adjustsFontSizeToFit|minimumFontScale|…|\\u2026|accessib/.test(src.replace(/^\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'no iOS fit, no ellipsis, no a11y props of its own');
  assert(src.includes('A long ticker shrinks to fit') && src.includes('#call-ticker-disc'), 'it cites the ruling');
  assert(read('components/sp/gn/index.ts').includes("export { TickerBadge } from './TickerBadge';"));
});

Deno.test('every round ticker badge is the shared TickerBadge, used once per host', () => {
  for (const [file, el] of BADGE_HOSTS) {
    const src = read(file);
    assertEquals(src.split(el).length - 1, 1, `${file}: ${el}`);
    assert(src.includes("import { TickerBadge } from '@/components/sp/gn/TickerBadge';"), `${file}: imports it`);
    assertFalse(/discTickerScale|tickerTileSize/.test(src), `${file}: no fit of its own`);
    assertFalse(/(disc|badge): \{\s*width: (40|52),/.test(src), `${file}: no hand-made circle of its own`);
  }
});

Deno.test('no hand-made copy is left: `ticker.tile` text appears only in the badge and in known non-badges', () => {
  // The non-badges, each read and ruled out (2026-11-19): DraftTile (a rectangular draft tile), InfoVisuals (the
  // info popups' rectangular chips and rows), design-gallery (the type ramp sample), sp/Text (the type primitive).
  const allowed = new Set([BADGE, 'components/sp/gn/DraftTile.tsx', 'components/game/InfoVisuals.tsx', 'app/design-gallery.tsx', 'components/sp/Text.tsx']);
  const found: string[] = [];
  const walk = (dir: URL, rel: string) => {
    for (const e of Deno.readDirSync(dir)) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const r = `${rel}${e.name}`;
      if (e.isDirectory) walk(new URL(`${e.name}/`, dir), `${r}/`);
      else if (/\.tsx$/.test(e.name) && /ticker\.tile/.test(read(r)) && !allowed.has(r)) found.push(r);
    }
  };
  for (const d of ['app', 'components']) walk(new URL(`${d}/`, ROOT), `${d}/`);
  assertEquals(found, [], 'a new ticker.tile text outside TickerBadge is a fourth copy: use <TickerBadge>');
  // And the fit is called from the badge alone.
  const callers: string[] = [];
  const walk2 = (dir: URL, rel: string) => {
    for (const e of Deno.readDirSync(dir)) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const r = `${rel}${e.name}`;
      if (e.isDirectory) walk2(new URL(`${e.name}/`, dir), `${r}/`);
      else if (/\.tsx?$/.test(e.name) && /discTickerScale\(/.test(read(r)) && r !== 'components/sp/logic/holdingFit.ts') callers.push(r);
    }
  };
  for (const d of ['app', 'components', 'lib']) walk2(new URL(`${d}/`, ROOT), `${d}/`);
  assertEquals(callers, [BADGE]);
});

Deno.test('the 52pt badge: the same rule over 48pt of room; GOOGL ≈ 12.4pt, BRK.B and AMGN keep 13pt, never near 9pt', () => {
  assertEquals([...TICKER_BADGE_SIZES], [40, 52]);
  assertEquals(badgeTextRoom(40), DISC_TEXT_ROOM);
  assertEquals(badgeTextRoom(52), 48);
  const pt52 = (t: string) => DISC_PT * discTickerScale(t, 52);
  assertEquals(Math.round(pt52('GOOGL') * 10) / 10, 12.4);
  assertEquals(pt52('BRK.B'), DISC_PT);
  assertEquals(pt52('AMGN'), DISC_PT);
  // The Planner's stop rule ("well below 9pt for a 5-character ticker"): the widest 5 letters stay above it.
  for (const c of Object.keys(TICKER_EM).filter((k) => /[A-Z]/.test(k))) assert(pt52(c.repeat(5)) > 9.5, `${c.repeat(5)}: ${pt52(c.repeat(5))}`);
  // And the 40pt row badge is unchanged by the size parameter.
  assertEquals(discTickerScale('GOOGL', 40), discTickerScale('GOOGL'));
});

Deno.test('VoiceOver unchanged: the badge has no accessibility props; each host keeps its own label', () => {
  for (const [file, el] of BADGE_HOSTS) {
    const src = read(file);
    assertFalse(/accessib/.test(el), `${file}: the badge element has no accessibility props`);
    assert(/accessibilityLabel=/.test(src), `${file}: the host names the stock itself`);
  }
});
