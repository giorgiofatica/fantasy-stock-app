/**
 * Phone pass step 34 (build 14, AX5): the sale picker's button named the stock being BOUGHT, its option labels broke
 * mid-word ("MF / G / slo / t") beside the amount, and the sheet drew uncapped next to capped sheets. The pure part
 * (the button's label) is pinned in money-sale-picker.test.ts; these pin the wiring in the component source.
 * Run: `cd apps/mobile && deno test --no-check --sloppy-imports --allow-read --allow-env --unstable-raw-imports tests-deno/`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { COPY } from '../lib/money/moneyCopy.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const picker = SOURCES['components/money/SalePicker.tsx'];
const sheet = SOURCES['components/money/StockSheetBody.tsx'];

/** Every `<Text ...>` opening tag in the file, balanced over braces. */
function textTags(src: string): string[] {
  const tags: string[] = [];
  let at = src.indexOf('<Text ');
  while (at >= 0) {
    let depth = 0;
    let i = at;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      else if (src[i] === '>' && depth === 0) break;
    }
    tags.push(src.slice(at, i + 1));
    at = src.indexOf('<Text ', i);
  }
  return tags;
}

Deno.test('the button takes its label from the chosen row, never from a symbol the sheet passes in', () => {
  assert(picker.includes('label={saleButtonLabel(rows)}'));
  assert(!picker.includes('COPY.useSaleButton'), 'the picker no longer builds the label itself');
  assert(!/symbol[:?]/.test(picker.slice(picker.indexOf('export interface SalePickerProps'), picker.indexOf('}', picker.indexOf('export interface SalePickerProps')))), 'SalePicker has no `symbol` prop (the bought stock)');
  const at = sheet.indexOf('<SalePicker');
  assert(!sheet.slice(at, sheet.indexOf('/>', at)).includes('symbol='), 'the sheet does not hand the picker the bought stock');
});

Deno.test('every Text in the picker carries the sheet cap, the same 1.6 as the stock sheet and the review', () => {
  const cap = Number(/const PICKER_TEXT_MAX_SCALE = ([\d.]+);/.exec(picker)?.[1]);
  assertEquals(cap, Number(/const SHEET_TEXT_MAX_SCALE = ([\d.]+);/.exec(sheet)?.[1]));
  assertEquals(cap, Number(/const REVIEW_TEXT_MAX_SCALE = ([\d.]+);/.exec(SOURCES['components/money/TradeReviewPanel.tsx'])?.[1]));
  // The title (headline-scale `title` variant) has its own 1.6 token ceiling; the callouts have none, so they pass it.
  const tags = textTags(picker).filter((t) => t.includes('variant="callout"'));
  assertEquals(tags.length, 2, 'the label and the amount (the caption is cut)');
  for (const t of tags) assert(t.includes('maxFontSizeMultiplier={PICKER_TEXT_MAX_SCALE}'), `uncapped callout: ${t.slice(0, 80)}`);
});

Deno.test('an option row stacks (label, then amount under it) once its label would break inside a word: the shared useLabelBreaks', () => {
  assert(picker.includes("import { useLabelBreaks } from '@/components/game/SetupRows';"), 'reuses SetupRows\' detector, no new mechanism');
  assert(picker.includes('const { broke, onTextLayout, onLayout, remountKey } = useLabelBreaks();'));
  assert(picker.includes('<View style={[styles.rowBody, broke && styles.rowBodyStacked]}>'));
  assert(picker.includes('onTextLayout={onTextLayout}>{r.label}</Text>'), 'the LABEL reports its broken lines');
  assert(picker.includes('onLayout={onLayout}'), 'the label column reports a collapse');
  assert(picker.includes('key={remountKey}'), 'a text-size change re-lays the row');
  // The amount keeps keepMoney (one unbreakable run) and sits after the label in both layouts.
  assert(picker.indexOf('{r.label}') < picker.indexOf('keepMoney(formatMoney(r.amount))'));
  assert(/rowBodyStacked: \{[^}]*flexDirection: 'column'[^}]*alignItems: 'flex-start'/.test(picker));
  assert(/rowLeadStacked: \{[^}]*flexGrow: 0[^}]*flexShrink: 0/.test(picker), 'stacked, the label never shrinks below its own width');
});

Deno.test('the caption under the title is cut (Design Lead ruling, no "i" either): the words appear nowhere in mobile source', () => {
  assert(!('pickerCaption' in COPY) && !('eachSaleStaysInItsSlot' in COPY), 'both COPY entries are gone');
  assert(!picker.includes('pickerCaption'), 'the picker does not render it');
  const hits = Object.entries(SOURCES).filter(([f, text]) => !f.startsWith('tests-deno/') && /stays in its own slot/.test(text)).map(([f]) => f);
  assertEquals(hits, [], 'no mobile source carries the sentence');
  // The title is now followed straight by the rows.
  assert(picker.indexOf('{COPY.whichSalePays}') < picker.indexOf('<View style={[styles.card'));
  assert(!/tone="secondary"/.test(picker), 'no secondary-tone caption line is left in the picker');
});
