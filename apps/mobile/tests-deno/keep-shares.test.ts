/**
 * keepShares (Design Lead P3, 2026-11-22, before build 18): at AX5 Trade history's detail line broke between a share
 * count and its unit ("10.0705" at the end of one line, "sh" at the start of the next). A no-break space between the
 * count and "sh" keeps them together. Display only: VoiceOver's label (historyShareDetail().spoken, "shares") and the
 * copy itself are unchanged.
 *
 * Pins: the helper joins count and "sh" with U+00A0 and nothing else; a worst-case wrap simulation never splits a count
 * from its unit at any width (with a negative control proving the simulator sees the bug); every place the app renders
 * a "sh" display string runs it through keepShares (a source guard over the manifest); accessibility labels still use
 * the plain / spoken forms.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals, assertMatch, assertNotMatch } from 'jsr:@std/assert';
import { NBSP, keepMoney, keepShares, keepTime } from '../lib/game/keepDots.ts';
import { historyShareDetail } from '../lib/money/tradeHistory.ts';
import { formatShares } from '../lib/money/formatShares.ts';
import { COPY } from '../lib/money/moneyCopy.ts';
import { formatMoney } from '../components/sp/logic/money.ts';
import { SOURCES } from './sourceManifest.generated.ts';

/** Greedy wrap at `width` characters, breaking only at a plain space (a no-break space never breaks). */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Does any wrap end a line on a count and start the next with "sh"? */
function splitsShares(text: string): boolean {
  for (let width = 4; width <= 60; width++) {
    const lines = wrap(text, width);
    for (let i = 0; i < lines.length - 1; i++) {
      if (/\d$/.test(lines[i]) && /^sh(?![A-Za-z])/.test(lines[i + 1])) return true;
    }
  }
  return false;
}

Deno.test('keepShares: one no-break space between the count and "sh", nothing else changes', () => {
  assertEquals(keepShares('10.0705 sh'), `10.0705${NBSP}sh`);
  assertEquals(keepShares('1,234 sh'), `1,234${NBSP}sh`);
  assertEquals(keepShares('1 sh at $1.23'), `1${NBSP}sh at $1.23`);
  assertEquals(keepShares('Mon 9:30 AM · 6.8942 sh at $318.37'), `Mon 9:30 AM · 6.8942${NBSP}sh at $318.37`);
  assertEquals(keepShares('Sell all 6.8942 sh ≈ $2,194.91'), `Sell all 6.8942${NBSP}sh ≈ $2,194.91`);
});

Deno.test('keepShares: only a count + whole-word "sh" is touched, and it is idempotent', () => {
  for (const t of ['', 'Shares', '5 shares', '5 shy', 'sh', 'Sell all', 'Bought AAPL', 'the sh', '12:00 PM']) assertEquals(keepShares(t), t);
  const once = keepShares('10.0705 sh at $1.23');
  assertEquals(keepShares(once), once);
  assertEquals(once.replaceAll(NBSP, ' '), '10.0705 sh at $1.23', 'display only: the same words');
});

Deno.test('the simulator sees the original bug: "10.0705 sh" splits at the plain space', () => {
  assert(splitsShares('Mon 9:30 AM ET · 10.0705 sh at $318.37'));
  assert(splitsShares('Sell all 6.8942 sh ≈ $2,194.91'));
});

Deno.test('after keepShares no wrap, at any width, splits a count from its unit', () => {
  const quantities = ['1', '0.5', '10.0705', '6.8942', '1,234', '1,234.5678', '100'];
  for (const q of quantities) {
    const trade = keepTime(keepMoney(keepShares(['Mon 9:30 AM ET', historyShareDetail(q, '$318.37').text].join(' · '))));
    assert(!splitsShares(trade), `trade detail for ${q}`);
    const noPrice = keepTime(keepMoney(keepShares(['Today', historyShareDetail(q, null).text].join(' · '))));
    assert(!splitsShares(noPrice), `no-price detail for ${q}`);
    const sell = keepMoney(keepShares(COPY.sellAll(formatShares(Number(q.replaceAll(',', ''))), formatMoney(2194.91))));
    assert(!splitsShares(sell), `sell summary for ${q}`);
    const holding = `${NBSP}· ${keepShares(`${q} sh`)}`;
    assert(!splitsShares(holding), `holding row for ${q}`);
  }
});

Deno.test('VoiceOver is unchanged: the spoken detail has no "sh" and no no-break space', () => {
  const d = historyShareDetail('10.0705', '$318.37');
  assertEquals(d.spoken, '10.0705 shares at $318.37');
  assertEquals(historyShareDetail('1', null).spoken, '1 share');
  assert(!d.spoken.includes(NBSP) && !d.text.includes(NBSP), 'the helper joins at the render, not in the data');
  assertEquals(d.text, '10.0705 sh at $318.37');
});

Deno.test('Trade history: the visible detail is joined, the accessibility label uses the plain spoken one', () => {
  const src = SOURCES['components/money/TradeHistoryScreen.tsx'];
  assertMatch(src, /\{keepTime\(keepMoney\(keepShares\(detail\)\)\)\}/);
  assertMatch(src, /accessibilityLabel=\{`\$\{label\}, \$\{spokenDetail\}/);
  assertNotMatch(src, /accessibilityLabel=\{[^}]*keepShares/);
});

Deno.test('Stock sheet: the sell summary is joined; no accessibilityLabel carries keepShares', () => {
  const src = SOURCES['components/money/StockSheetBody.tsx'];
  assertMatch(src, /\{keepMoney\(keepShares\(model\.sell\.summary\)\)\}/);
  assertNotMatch(src, /accessibilityLabel=\{[^}]*keepShares/);
});

Deno.test('Holding row: the helper, not a hand-written no-break space; the label still says "shares"', () => {
  const src = SOURCES['components/money/HoldingRow.tsx'];
  assertMatch(src, /keepShares\(`\$\{row\.quantityText\} sh`\)/);
  assertNotMatch(src, /quantityText\}\$\{NBSP\}sh/);
  assertMatch(src, /\$\{row\.quantityText\} shares, /);
});

Deno.test('source guard: every rendering file that builds a "sh" display string imports and calls keepShares', () => {
  const offenders: string[] = [];
  for (const [file, src] of Object.entries(SOURCES)) {
    if (!/^(app|components)\//.test(file)) continue;
    for (const [i, line] of src.split('\n').entries()) {
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*')) continue;
      // a count followed by "sh" in a string/template, or the model's sell summary being rendered
      if (/(\}|\d|NBSP\}) ?sh\b/.test(line) && !line.includes('keepShares')) offenders.push(`${file}:${i + 1}`);
      if (/\.sell\.summary\b/.test(line) && /<Text/.test(line) && !line.includes('keepShares')) offenders.push(`${file}:${i + 1}`);
    }
  }
  assertEquals(offenders, []);
});
