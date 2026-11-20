/**
 * The design board scores the same palette the app ships (DESIGN_DIRECTION §9C, "contrastPairs.ts and
 * the board's PAIRS are identical, row for row"; the board's themes.css is the app's color.ts key for key).
 *
 *   cd apps/mobile/tests-deno && deno test .
 *
 * Until 2026-11-19 nothing checked that claim: the yellow call (pick A, #call-yellow) changed the three
 * warn tokens in color.ts and contrastPairs.ts, and the board kept the yellow and lacked the two new rows
 * (PR #572, review 1). These read the board's own files as text, so a change to one side fails here.
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import themesCss from '../../../docs/design/screens/themes.css' with { type: 'text' };
import directionsCss from '../../../docs/design/screens/directions.css' with { type: 'text' };
import boardJsx from '../../../docs/design/screens/board.jsx' with { type: 'text' };
import { color } from '../constants/tokens/color.ts';
import { PAIRS } from '../constants/tokens/contrastPairs.ts';

/** color.ts camelCase → the board's --c-kebab-case (accentTint → accent-tint, text2 → text-2). */
const kebab = (k: string) => k.replace(/([A-Z])/g, '-$1').replace(/([a-z])(\d)/g, '$1-$2').toLowerCase();

function themeVars(theme: 'light' | 'dark'): Record<string, string> {
  const open = themesCss.indexOf(`[data-ks-theme='${theme}'] {`);
  assert(open >= 0, `themes.css has a ${theme} block`);
  const block = themesCss.slice(open, themesCss.indexOf('}', open));
  return Object.fromEntries([...block.matchAll(/--c-([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

Deno.test('board themes.css is color.ts key for key, at the same value, in both themes', () => {
  for (const theme of ['light', 'dark'] as const) {
    const css = themeVars(theme);
    const app = Object.entries(color[theme]);
    for (const [key, value] of app) {
      assertEquals(css[kebab(key)], value, `${theme}: --c-${kebab(key)} (color.ts ${key})`);
    }
    // The board's only extra keys are its own mockup colours (keyboard and browser chrome), which the app has no use for.
    const extra = Object.keys(css).filter((k) => !app.some(([key]) => kebab(key) === k));
    assert(extra.every((k) => k.startsWith('kbd') || k.startsWith('chrome')), `${theme}: unexpected board-only keys ${extra.join(', ')}`);
  }
});

// The Game Night frames (`dr dir-a` / `dir-a-light`, used by most boards) carry their own copy of some roles:
// the OKLCH studies, plus a line of the app's color.ts values ("The app's color.ts, key for key"). Every role
// there written as a hex or rgba value must be the app's; the warn trio sat there in yellow too (#572).
Deno.test('board directions.css Game Night frames: every hex/rgba role is the app\'s color.ts value', () => {
  for (const [sel, theme] of [['.dir-a {', 'dark'], ['.dir-a-light {', 'light']] as const) {
    const open = directionsCss.indexOf(sel);
    assert(open >= 0, `directions.css has ${sel}`);
    const block = directionsCss.slice(open, directionsCss.indexOf('\n}', open)).replace(/\/\*[\s\S]*?\*\//g, '');
    const app = Object.fromEntries(Object.entries(color[theme]).map(([k, v]) => [kebab(k), v]));
    const literal = [...block.matchAll(/--c-([\w-]+):\s*([^;]+);/g)].filter((m) => !m[2].trim().startsWith('oklch') && m[1] in app);
    assert(literal.some((m) => m[1] === 'warn-text'), `${sel} carries the warn roles`);
    for (const m of literal) assertEquals(m[2].trim(), app[m[1]], `${sel} --c-${m[1]}`);
  }
});

Deno.test("board.jsx PAIRS are contrastPairs.ts's PAIRS, row for row", () => {
  const start = boardJsx.indexOf('const PAIRS = [');
  assert(start >= 0, 'board.jsx has its PAIRS table');
  const body = boardJsx.slice(start, boardJsx.indexOf('\n  ];', start));
  const rows = [...body.matchAll(/^\s*\['([\w-]+)', '([\w-]+)', (null|'[\w-]+'), ([\d.]+), '((?:[^'\\]|\\.)*)'\],/gm)].map(
    (m) => [m[1], m[2], m[3] === 'null' ? null : m[3].slice(1, -1), Number(m[4]), m[5].replace(/\\'/g, "'")],
  );
  assertEquals(rows.length, PAIRS.length, 'the same number of rows');
  PAIRS.forEach(([fg, bg, over, min, where], i) => {
    assertEquals(rows[i], [kebab(fg), kebab(bg), over ? kebab(over) : null, min, where], `row ${i + 1}`);
  });
});
