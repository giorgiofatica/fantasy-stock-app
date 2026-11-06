/**
 * Draft room "Latest picks" at the large text sizes (Design Lead P1, 2026-11-06): two lines from the large-text step,
 * no leading dot on the label's own line, no word broken (the hyphen included), every part capped at 1.3.
 * Hermes can't run here, so the wrap pin simulates the line breaker over the DISPLAYED string: a break only at a plain
 * space (no-break spaces and word joiners never break), greedy, at every width.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { PICK_LOG_MAX_SCALE, PICK_LOG_SPLIT_SCALE, pickLogLabelText, pickLogLayout } from '../lib/game/pickLogRow.ts';
import { NBSP, WORD_JOINER } from '../lib/game/keepDots.ts';
import { pickLogLine } from '../lib/game/draftRoom.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const LABELS = [pickLogLine('auto_queue'), pickLogLine('auto_queue', true), pickLogLine('auto_best'), pickLogLine('manual')];

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    if (line === '') line = w;
    else if ((line + ' ' + w).length <= width) line += ' ' + w;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}
const plain = (s: string) => s.replaceAll(NBSP, ' ').replaceAll(WORD_JOINER, '');

Deno.test('layout: one line below the large-text step, two lines from it up', () => {
  for (const s of [0.8, 1, 1.15, 1.29]) assertEquals(pickLogLayout(s), 'one-line');
  for (const s of [PICK_LOG_SPLIT_SCALE, 1.35, 2, 3.1]) assertEquals(pickLogLayout(s), 'two-line');
  for (const s of [NaN, Infinity, -1]) assertEquals(pickLogLayout(s), 'one-line');
  assertEquals(PICK_LOG_MAX_SCALE, 1.3);
});

Deno.test('two lines: the label has no leading dot, and keeps its words', () => {
  for (const label of LABELS) {
    const text = pickLogLabelText(label, 'two-line');
    assert(!text.trimStart().startsWith('·'), text);
    assertEquals(plain(text), label);
  }
});

Deno.test('one line: the dot leads and is glued to the first word, never alone', () => {
  for (const label of LABELS) {
    const text = pickLogLabelText(label, 'one-line');
    assertEquals(plain(text), `· ${label}`);
    assert(text.startsWith(`·${NBSP}`), JSON.stringify(text));
  }
});

Deno.test('no wrapped line after the first starts with a dot, and none is a lone dot, at any width', () => {
  for (const layout of ['one-line', 'two-line'] as const) {
    for (const label of LABELS) {
      const text = pickLogLabelText(label, layout);
      for (let width = 6; width <= 60; width++) {
        wrap(text, width).forEach((line, i) => {
          assert(plain(line).trim() !== '·', `lone dot: ${layout} w${width}`);
          if (i > 0) assert(!plain(line).trim().startsWith('·'), `${layout} w${width} ${JSON.stringify(line)}`);
        });
      }
    }
  }
});

Deno.test('"Auto-picked" never breaks: a word joiner follows the hyphen and no plain space sits inside the word', () => {
  for (const layout of ['one-line', 'two-line'] as const) {
    const text = pickLogLabelText('Auto-picked · best available', layout);
    assert(text.includes(`Auto-${WORD_JOINER}picked`), layout);
    for (let width = 4; width <= 60; width++) {
      // At no width does a wrapped line end inside the word or start with "picked".
      for (const line of wrap(text, width)) {
        assert(!/(^|\s)(Auto-?|picked)$/.test(plain(line)) || /Auto-picked/.test(plain(line)), `${layout} w${width} ${JSON.stringify(line)}`);
        assert(!plain(line).startsWith('picked'), `${layout} w${width} ${JSON.stringify(line)}`);
      }
    }
  }
});

Deno.test('a label with no dot or hyphen is left readable', () => {
  assertEquals(plain(pickLogLabelText('Picked', 'two-line')), 'Picked');
  assertEquals(plain(pickLogLabelText('Picked', 'one-line')), '· Picked');
});

Deno.test('DraftRoom wires it: the layout, the label text and the 1.3 cap on every part', () => {
  const room = SOURCES['components/game/DraftRoom.tsx'];
  assert(room.includes("from '@/lib/game/pickLogRow'"));
  assert(room.includes('pickLogLayout(fontScale)'));
  assert(room.includes('pickLogLabelText(row.label'));
  const row = room.slice(room.indexOf('const twoLine ='), room.indexOf('</Card>', room.indexOf('const twoLine =')));
  assertEquals((row.match(/maxFontSizeMultiplier=\{PICK_LOG_MAX_SCALE\}/g) ?? []).length, 3, 'number, ticker and label are all capped');
});
