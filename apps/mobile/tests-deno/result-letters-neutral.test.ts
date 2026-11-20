/**
 * The W / L / T result letters are bold in the normal `text` ink everywhere they were coloured
 * by the result; only the money keeps its sign colour (Giorgio, 2026-11-20, board
 * #call-result-colour, PR #578: "A and keep blue"; docs/PRODUCT_RULES.md, the 2026-11-20 entry).
 * Pick A covers three places: Home's "Your season" tiles, League › Schedule's rows (covered in
 * recap-neutral-letters.test.ts with the recap, the same row), and the Matchup "i" popup's W.
 * Pick 1 leaves the finished week's banner as it was: blue (your colour) on a week you won,
 * grey on a week you lost or tied. The blue is your colour, not a result colour.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { resultLetterInk, type WeekResult } from '../lib/game/weekResult.ts';
import { color } from '../constants/tokens/color.ts';
import { type } from '../constants/tokens/type.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const SEASON = 'components/home/YourSeason.tsx';
const INFO = 'components/game/InfoVisuals.tsx';
const BANNER = 'components/game/FinalBanner.tsx';

const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

function between(src: string, from: string, to: string): string {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a + 1);
  assert(a >= 0 && b > a, `markers not found: ${from} … ${to}`);
  return src.slice(a, b);
}

Deno.test('Home "Your season": every tile letter goes through the neutral ink, the normal text in both themes', () => {
  const src = code(SOURCES[SEASON]);
  assert(src.includes('const letterInk = (r: SeasonResult) => resultLetterInk(r, colors, true);'));
  // Both tiles that draw a letter (a played week, this week once scored) use it, and no other colour.
  const glyphs = src.match(/<Glyph letter=\{tile\.result\} color=\{[^}]+\}\s*\/>/g) ?? [];
  assertEquals(glyphs.length, 2);
  for (const g of glyphs) assert(g.includes('color={letterInk(tile.result)}'), g);
  // The old per-result colouring is gone from the tiles.
  assert(!src.includes('W: colors.gain'));
  for (const theme of [color.light, color.dark]) {
    for (const r of ['W', 'L', 'T'] as WeekResult[]) assertEquals(resultLetterInk(r, theme, true), theme.text);
  }
});

Deno.test('Home "Your season": the letter stays bold (score.lg, extra bold)', () => {
  const glyph = between(SOURCES[SEASON], 'function Glyph(', '\n}\n');
  assert(glyph.includes('<Text variant="score.lg" color={color}'));
  assertEquals(type['score.lg'].fontFamily, 'Archivo-ExtraBold');
});

Deno.test('Home "Your season": the score keeps its sign colour', () => {
  const played = between(SOURCES[SEASON], "case 'played':", "case 'unscored':");
  assert(played.includes('color={colors[toneOf(tile.gain)]}'));
});

Deno.test('Matchup "i" popup: the W beside the winner is bold in the normal text ink; the figures keep their sign', () => {
  const picture = between(SOURCES[INFO], 'function MatchupPicture(', 'function EqualPicture(');
  assert(picture.includes('{win ? <Strong variant="caption" color={colors.text}>W</Strong> : null}'));
  // Strong is the bold weight.
  assert(SOURCES[INFO].includes('const Strong = ({ style, ...rest }: VProps) => <V {...rest} style={[styles.bold, style]} />;'));
  assert(SOURCES[INFO].includes('bold: { fontFamily: typeFontFamily.bold },'));
  // The figures: green for a gain, red for a loss, as before.
  assert(picture.includes("<Strong color={gain.startsWith('+') ? colors.gain : colors.loss} style={styles.tabular}>{gain}</Strong>"));
  // No result colour left on the letter.
  assert(!picture.includes('color={colors.gain}>W<'));
});

Deno.test('the finished week banner is unchanged (pick 1): your blue when you won, sunken grey when you lost or tied', () => {
  const src = code(SOURCES[BANNER]);
  assert(src.includes("const won = model.outcome === 'won';"));
  assert(src.includes('const fill = won ? colors.you : colors.sunken;'));
  assert(src.includes('const ink = won ? colors.onYou : colors.text;'));
  // The banner's colour is yours, not a result colour: it never goes through the letter ink,
  // and never draws in the gain or loss colour.
  assert(!src.includes('resultLetterInk'));
  assert(!src.includes('colors.gain') && !src.includes('colors.loss'));
});

Deno.test('one neutral helper: no second copy of the neutral letter rule', () => {
  const defs = Object.entries(SOURCES).filter(([, s]) => /export function \w*[Ll]etter\w*Ink\b/.test(s)).map(([p]) => p);
  assertEquals(defs, ['lib/game/weekResult.ts']);
});
