/**
 * P3 (Design Lead, 2026-11-05/06; Giorgio's phone runs the largest accessibility size, AX5): a sub-line must never outgrow the
 * title above it, and must wrap or stack rather than run off the edge. Pre-draft Home's Members card drew "1 of 4 joined" BIGGER
 * than "Members"; the League queue's sentence outgrew "YOUR QUEUE · N OF 50"; the draft room's "1 of 6 · $1,000 per slot" ran off
 * the right edge. The cause: `headline`/`title`/`tag` are capped (1.6/1.6/1.4) while `caption`/`callout`/`body` are not.
 * The rule lives in ONE place (`subLineCap`, used by the sp Text's `subOf` prop) and a source scan fails any new title + sub-line pair
 * that skips it. Run: cd apps/mobile/tests-deno && deno test --allow-read .
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { cappedSpText, subLineCap } from '../components/sp/logic/cappedType.ts';
import { type } from '../constants/tokens/type.ts';
import { SOURCES } from './sourceManifest.generated.ts';

/** Source without comments, so a pin never passes on a comment that names the thing. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
}

Deno.test('subLineCap: never above the title, whatever the sub-line would have had alone', () => {
  assertEquals(subLineCap(undefined, 1.6), 1.6, 'an uncapped sub-line takes the title\'s cap');
  assertEquals(subLineCap(2, 1.6), 1.6, 'a higher own cap is brought down to the title\'s');
  assertEquals(subLineCap(1.3, 1.6), 1.3, 'a lower own cap stands (the title\'s is a ceiling, not a floor)');
  assertEquals(subLineCap(1.4, 1.4), 1.4);
  assertEquals(subLineCap(1.3, undefined), 1.3, 'a title with no cap puts no ceiling on it');
  assertEquals(subLineCap(undefined, undefined), undefined);
});

Deno.test('at AX5 (3.571) a capped sub-line draws at most as many times its base size as its title', () => {
  const AX5 = 3.571;
  for (const [title, sub] of [['headline', 'caption'], ['headline', 'callout'], ['title', 'callout'], ['tag', 'caption'], ['tag', 'callout'], ['score.md', 'caption']] as const) {
    const cap = subLineCap(type[sub].maxScale, type[title].maxScale);
    assertEquals(cap, type[title].maxScale, `${sub} under ${title}`);
    const drawn = cappedSpText(type[sub], undefined, undefined, AX5, cap);
    assertEquals(drawn.style?.fontSize, type[sub].fontSize * cap!, `${sub} under ${title} is the explicit capped size`);
    assert(drawn.style!.fontSize / type[sub].fontSize <= type[title].maxScale! * (1 + 1e-9), 'the multiplier is no higher than the title\'s');
  }
});

Deno.test('below the title\'s cap nothing changes: Large and XXXL (the largest standard size, 1.35) are untouched', () => {
  for (const s of [0.82, 1, 1.24, 1.35]) {
    for (const title of ['headline', 'title', 'tag'] as const) {
      assertEquals(cappedSpText(type.caption, undefined, undefined, s, subLineCap(undefined, type[title].maxScale)).style, null, `${title} at ${s}`);
    }
  }
});

Deno.test('the sp Text applies it: a `subOf` prop, resolved against that variant\'s cap, in the cap it passes down', () => {
  const t = code(SOURCES['components/sp/Text.tsx']);
  assert(/subOf\?: TypeVariant;/.test(t), 'the prop');
  assert(t.includes('subLineCap(maxFontSizeMultiplier ?? typeStyle.maxScale, subOf ? type[subOf].maxScale : undefined)'), 'own cap (prop, else variant) against the title\'s');
  assert(/cappedSpText\([^)]*resolvedMaxFontSizeMultiplier\)/.test(t), 'and that is the cap the Text is drawn with');
});

/**
 * The sweep, as a guard: a Text of a CAPPED title variant followed (within 4 lines, same block) by an uncapped sub-line variant must name
 * `subOf` (or its own `maxFontSizeMultiplier`). The pairs below are title + a DIFFERENT kind of text that happens to follow it (a bullet list,
 * the pick lines under a clock, the countdown's own lines) -- each with the reason.
 */
const TITLES = /variant="(headline|title|tag)"/;
const SUBS = /variant="(caption|callout|body)"/;
const NOT_SUB_LINES: Record<string, string> = {
  'app/design-gallery.tsx': 'the type specimen sheet: samples of each variant side by side, not titles with sub-lines',
  'app/league-settings.tsx': 'a section header ("Draft") over a settings ROW label ("Pick clock"), not a sub-line',
  'components/game/LeaveLeagueSheets.tsx': 'the title over a bullet LIST (the bullets are the sheet\'s body copy)',
  'components/game/RenewalRoster.tsx': 'a marker tag beside a row label',
};

Deno.test('every capped-title + sub-line pair names subOf (or is a listed non-sub-line)', () => {
  const offenders: string[] = [];
  for (const [path, raw] of Object.entries(SOURCES)) {
    if (!path.endsWith('.tsx') || NOT_SUB_LINES[path]) continue;
    const lines = code(raw).split('\n');
    lines.forEach((l, i) => {
      if (!TITLES.test(l)) return;
      for (let j = i + 1; j <= Math.min(i + 4, lines.length - 1); j++) {
        // A sub-line is the next Text in the SAME block: stop at a closing/opening of a container.
        if (/<\/View>|<\/Card>|<View|<Card|<SetupCard|<SegmentedControl|<Button|^\s*case '|^\s*return /.test(lines[j]) && j > i + 1) break;
        if (SUBS.test(lines[j])) {
          const block = lines.slice(j, j + 3).join(' ');
          if (!/subOf=|maxFontSizeMultiplier/.test(block)) offenders.push(`${path}:${j + 1} ${lines[j].trim()}`);
          break;
        }
      }
    });
  }
  assertEquals(offenders, [], 'a sub-line under a capped title must pass subOf="<title variant>"');
});

Deno.test('the named screens: Members, the queue, the draft room\'s roster header, the room\'s completion', () => {
  const pre = code(SOURCES['components/home/PreDraftCard.tsx']);
  assert(/<Text variant="caption" tone="secondary" subOf="headline">\s*\{waiting \? membersNeededCaption/.test(pre), 'Members: "1 of 4 joined" under the headline');
  const q = code(SOURCES['components/game/QueueEditor.tsx']);
  assert(q.includes('<Text variant="caption" tone="secondary" subOf="tag">If you step away'), 'the queue intro under the tag');
  assert(q.includes('<Text variant="caption" tone="secondary" subOf="tag">{closedLine}'), 'and its closed line');
  const grid = code(SOURCES['components/home/TeamSoFarGrid.tsx']);
  assert(grid.includes('<Text variant="caption" tone="secondary" subOf="headline">{caption ??'), 'the roster header\'s sub-line under the headline');
  const dc = code(SOURCES['components/game/DraftComplete.tsx']);
  assert(dc.includes('<Text variant="caption" tone="secondary" subOf="headline">{caption}'), 'the completion roster header');
});

Deno.test('the draft room\'s roster header wraps instead of running off the card (the caption drops under the title, to the left)', () => {
  const grid = code(SOURCES['components/home/TeamSoFarGrid.tsx']);
  const at = grid.indexOf('  header: {');
  const header = grid.slice(at, grid.indexOf('\n  },', at));
  assert(/flexDirection: 'row'/.test(header), 'one row while it fits');
  assert(/flexWrap: 'wrap'/.test(header), 'it wraps');
  assert(/justifyContent: 'space-between'/.test(header), 'a wrapped caption on its own line starts at the left');
  assert(/alignItems: 'center'/.test(header), 'centred as before the wrap, so Large is pixel-identical to the unwrapped header');
  assert(/columnGap: space\[3\]/.test(header) && /rowGap: space\[1\]/.test(header), 'gaps');
  const jsx = grid.slice(grid.indexOf('<View style={styles.header}>'), grid.indexOf('<View style={styles.slotGrid}>'));
  assert(!/numberOfLines|ellipsizeMode|adjustsFontSizeToFit/.test(jsx), 'no truncation or shrink-to-fit');
});
