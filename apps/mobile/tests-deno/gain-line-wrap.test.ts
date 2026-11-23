/**
 * Gain-line wrap (the Design Lead's P3, 2026-11-22; Giorgio's phone is at the largest accessibility size, AX5):
 * on a gain line that WRAPS, the wrapped words ("season gain", "today") began their new line with a leading
 * space, so the line looked indented. The gap between a figure and its words was a literal space inside the
 * words' own string, and a space that begins a Text survives a wrap.
 *
 * The fix gives the gap to the layout: no displayed text segment starts with a space, and the rows that hold
 * the units carry `columnGap` (one space's width, scaled like the text: logic/gainGap.ts). Guarded here:
 *   1. gainGap: the width of one space, scaled by Dynamic Type under the line's own cap.
 *   2. No gain-line text segment (Home's hero, RollingGainPair, every words string handed to it) begins with
 *      a space or no-break space, or ends a Text in one.
 *   3. The rows have the gap, and it comes from gainGap at the callout size under the line's cap.
 *   4. The dot on Home's line stays glued to the unit before it (a dot may end a line, never start one).
 *   5. VoiceOver labels are byte-identical (built separately, via `.spoken`).
 *   6. The stock sheet's Gain is ONE Text run, so a wrap cannot indent it.
 *
 * The screens are React Native and not Deno-renderable, so the wiring is guarded as source scans, the
 * established pattern in this suite. Run with: cd apps/mobile/tests-deno && deno test .
 */
import { assert, assertAlmostEquals, assertEquals } from 'jsr:@std/assert';
import { SOURCES } from './sourceManifest.generated.ts';
import { gainGap, SPACE_EM } from '../components/sp/logic/gainGap.ts';
import { formatGainPair } from '../components/sp/logic/money.ts';
import { CHART_RANGES, RANGE_WORDS, rangeGainText } from '../lib/chart/chartRanges.ts';
import { HERO_SEASON_GAIN_LABEL, HERO_TODAY_LABEL, heroAccessibilityLabel } from '../lib/home/homeCopy.ts';

/** Source with its comment lines dropped, so a rule quoted in a comment cannot trip a code scan. */
const code = (src: string) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n');
const src = (path: string) => {
  const s = SOURCES[path];
  assert(s !== undefined, `${path} is in the source manifest`);
  return code(s);
};

const PAIR = 'components/money/RollingGainPair.tsx';
const HERO = 'components/home/HomeHero.tsx';
const SPACES = /^[\s  ]|[\s  ]$/;

/** Every `<Text …>child</Text>` child of `source`, the raw JSX expression. */
const textChildren = (source: string) => [...source.matchAll(/<Text\b[^>]*>([^<]*)<\/Text>/g)].map((m) => m[1]);

/** The gain row's JSX on Home: from its first row to the unpriced caption that follows it. */
const heroGainJsx = () => {
  const hero = src(HERO);
  const from = hero.indexOf('testID="hero-gain-row"');
  const to = hero.indexOf('{preSeasonLabel == null && caption');
  assert(from > 0 && to > from, 'the hero gain rows are found');
  return hero.slice(from, to);
};

// ── 1. The gap ───────────────────────────────────────────────────────────────

Deno.test('gainGap: one space, 0.205 em of the line\'s size, scaled by Dynamic Type', () => {
  assertEquals(SPACE_EM, 0.205);
  assertAlmostEquals(gainGap(13, 1), 2.665, 1e-9, 'the callout at Large: 13 pt × 0.205');
  assertAlmostEquals(gainGap(13, 2), 5.33, 1e-9, 'it grows with the text size, as the glyph did');
  assertAlmostEquals(gainGap(13, 3.1), 13 * 3.1 * 0.205, 1e-9, 'uncapped at AX5');
});

Deno.test('gainGap: under a cap it stops growing with the text, as the capped line does', () => {
  assertAlmostEquals(gainGap(13, 3.1, 1.3), 13 * 1.3 * 0.205, 1e-9, 'AX5 under the 1.3 cap');
  assertAlmostEquals(gainGap(13, 1.1, 1.3), 13 * 1.1 * 0.205, 1e-9, 'under the cap it still scales');
  assertEquals(gainGap(13, 1.3, 1.3), gainGap(13, 3.1, 1.3), 'at and past the cap: the same');
});

Deno.test('gainGap: a bad scale falls back to 1, never NaN', () => {
  for (const bad of [Number.NaN, 0, -2, Number.POSITIVE_INFINITY]) {
    const g = gainGap(13, bad, 1.3);
    assert(Number.isFinite(g) && g > 0, `scale ${bad}`);
  }
  assertEquals(gainGap(13, Number.NaN), gainGap(13, 1));
});

// ── 2. No segment begins with a space ────────────────────────────────────────

Deno.test('RollingGainPair: no Text begins or ends with a space, and no string holds a space character as the gap', () => {
  const pair = src(PAIR);
  const kids = textChildren(pair);
  assert(kids.length >= 3, 'the bracket, the closing bracket and the words');
  for (const k of kids) {
    const inner = k.trim().replace(/^\{|\}$/g, '');
    assert(!/^`/.test(inner) && !SPACES.test(k), `a gain-line Text child must be a bare expression: ${k}`);
  }
  assert(pair.includes('>{GAIN_PAIR_OPEN}</Text>') && pair.includes('>{GAIN_PAIR_CLOSE}</Text>') && pair.includes('>{words}</Text>'));
  assert(!/NBSP|\\u00a0| /.test(pair), 'no no-break-space stands in for the gap');
  assert(!/\{' '\}|\{" "\}/.test(pair));
});

Deno.test('Home hero gain rows: no Text begins or ends with a space', () => {
  const jsx = heroGainJsx();
  const kids = textChildren(jsx);
  assert(kids.length >= 7, 'the brackets, the three words, the dot (twice), the pre-season label');
  for (const k of kids) assert(!SPACES.test(k) && !/^\{`/.test(k.trim()), `a hero gain Text child starts and ends flush: ${JSON.stringify(k)}`);
  assert(!/\{' '\}|\{" "\}/.test(jsx), 'no {" "} between the units');
  assert(!/[·] *\{/.test(jsx.replace(/\{HERO_DOT\}/g, '')), 'no literal dot sits inside a string with a space');
});

Deno.test('every words string handed to a gain line is flush: the ranges, "today", "since the draft"', () => {
  for (const range of CHART_RANGES) {
    const t = rangeGainText(range, { money: 12.5, pct: 3.21, tone: 'gain' });
    assert(!SPACES.test(t.keptWords), `${range}: ${JSON.stringify(t.keptWords)}`);
    assert(!SPACES.test(RANGE_WORDS[range]));
  }
  for (const w of [HERO_SEASON_GAIN_LABEL, HERO_TODAY_LABEL, 'today']) assert(!SPACES.test(w), w);
  const portfolio = src('components/money/PortfolioScreen.tsx');
  assert(portfolio.includes('words="today"'));
  const manager = src('components/money/PlayerPortfolioScreen.tsx');
  assert(manager.includes('words={v.sinceDraftLabel}') && manager.includes('words="today"'));
  assert(!SPACES.test(src('lib/money/portfolioView.ts').match(/sinceDraftLabel[^\n]*?'([^']*)'/)?.[1] ?? 'x'));
});

// ── 3. The row has the gap ───────────────────────────────────────────────────

Deno.test('RollingGainPair: both rows carry columnGap, computed by gainGap at the callout size under the line\'s cap', () => {
  const pair = src(PAIR);
  assert(pair.includes('const gap = gainGap(type.callout.fontSize, fontScale, maxScale);'), 'the cap is the line\'s own');
  assert(pair.includes('style={[styles.row, { columnGap: gap }]}'), 'the wrapping row: figures | words');
  assert(pair.includes('style={[styles.nowrap, { columnGap: gap }]}'), 'the figures group: dollars | (percent)');
  assert(/row: \{ flexDirection: 'row', flexWrap: 'wrap'/.test(pair));
  // The figures stay one non-wrapping run, "(" ")" with the percent.
  const figures = pair.slice(pair.indexOf('testID="gain-pair-figures"'), pair.indexOf('{words ? ('));
  assert(figures.indexOf('text={money}') < figures.indexOf('{GAIN_PAIR_OPEN}') && figures.indexOf('{GAIN_PAIR_OPEN}') < figures.indexOf('text={pct}') && figures.indexOf('text={pct}') < figures.indexOf('{GAIN_PAIR_CLOSE}'));
});

Deno.test('Home hero: the gain rows carry columnGap from gainGap at the callout size', () => {
  const hero = src(HERO);
  assert(hero.includes('const gap = gainGap(type.callout.fontSize, fontScale);'), 'Home\'s gain line is uncapped');
  assertEquals((hero.match(/<View style=\{\[styles\.gainRow, \{ columnGap: gap \}\]\} testID="hero-gain-row">/g) ?? []).length, 2, 'the season row and the pre-season row');
  assert(/gainRow: \{[^}]*flexWrap: 'wrap'/.test(hero.replace(/\n/g, ' ')));
});

// ── 4. The dot never starts a line ───────────────────────────────────────────

Deno.test('Home hero: the dot is glued to the unit before it in a non-wrapping row, so it can end a line but never start one', () => {
  const jsx = heroGainJsx();
  const units = [...jsx.matchAll(/<View style=\{\[styles\.unit, \{ columnGap: gap \}\]\}>([\s\S]*?)<\/View>/g)].map((m) => m[1]);
  assertEquals(units.length, 2, 'season gain + dot; $0.00 + dot');
  for (const u of units) assert(u.indexOf('{HERO_DOT}') > u.indexOf('<') && !u.trimStart().startsWith('<Text variant="callout" tone="secondary">{HERO_DOT}'), 'the dot is the second thing in its unit');
  // …and nothing else stands between the dot and the next figure but the row's gap.
  assert(/\{HERO_DOT\}<\/Text>\s*<\/View>\s*<RollingMoney text=\{todayText\}/.test(jsx));
  assert(/unit: \{[^}]*flexDirection: 'row'/.test(src(HERO).replace(/\n/g, ' ')) && !/unit: \{[^}]*flexWrap/.test(src(HERO).replace(/\n/g, ' ')));
});

// ── 5. VoiceOver is unchanged ────────────────────────────────────────────────

Deno.test('VoiceOver labels are byte-identical: the pair is spoken from `.spoken`, the hero label from its own builder', () => {
  const g = formatGainPair(481.78, 4.01);
  assertEquals(g.spoken, '+$481.78, +4.01%');
  assertEquals(g.text, '+$481.78 (+4.01%)');
  assertEquals(
    heroAccessibilityLabel('$12,481.78', g.spoken, '+$12.30', null),
    'Your team, $12,481.78. +$481.78, +4.01% season gain. +$12.30 today.',
  );
  assertEquals(
    heroAccessibilityLabel('$12,481.78', g.spoken, null, 'One price missing.'),
    'Your team, $12,481.78. +$481.78, +4.01% season gain. One price missing.',
  );
  assertEquals(rangeGainText('6M', { money: 54.6, pct: 41.42, tone: 'gain' }).label, '+$54.60, +41.42% past 6 months');
  assertEquals(rangeGainText('Season', { money: -194.9, pct: -9.74, tone: 'loss' }).label, '−$194.90, −9.74% since the draft');
  // The labels sit on the wrapping Views, not on the pieces: the layout change cannot reach them.
  assert(src('components/sp/gn/RangeGainLine.tsx').includes('accessibilityLabel={text.label}'));
  assert(src(HERO).includes('<View accessible accessibilityLabel={a11yLabel} style={styles.heroBody}>'));
  assert(src('components/money/PortfolioScreen.tsx').includes('accessibilityLabel={`${v.todaySpoken} today`}'));
  const manager = src('components/money/PlayerPortfolioScreen.tsx');
  assert(manager.includes('label={`${v.gainSpoken} ${v.sinceDraftLabel}`}') && manager.includes('label={`${v.todaySpoken} today`}'));
  assert(src('components/money/RollingGainPair.tsx').indexOf('accessibilityLabel') === -1, 'RollingGainPair itself says nothing; its caller labels it');
});

// ── 6. The stock sheet's Gain is one run ─────────────────────────────────────

Deno.test('the stock sheet\'s "Your position" Gain is ONE Text run (a wrap there cannot indent), labelled from `.spoken`', () => {
  const sheet = src('components/money/StockSheetBody.tsx');
  const figure = sheet.slice(sheet.indexOf('function Figure('), sheet.indexOf('const styles = StyleSheet.create'));
  assertEquals((figure.match(/<Text\b/g) ?? []).length, 2, 'the label and the value: the value is not split into units');
  assert(figure.includes('{keepMoney(value)}</Text>'));
  assert(sheet.includes('value={formatGainPair(position.gain, position.gainPct).text}') && sheet.includes('spoken={formatGainPair(position.gain, position.gainPct).spoken}'));
});
