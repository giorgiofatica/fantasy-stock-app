/**
 * Gain lines (Giorgio, docs/PRODUCT_RULES.md): two rulings, guarded here.
 *  1. BRACKETS (2026-11-17, pick A): a dollar gain beside its own percent reads "+$X (+Y%)", never
 *     "+$X · +Y%". The dot stays only between two different facts ("season gain · +$Z today").
 *     Stacked figures (RosterRow, the player card's Week gain) are not pairs and are not covered.
 *  2. WORD COLOUR (2026-11-18, pick A): on a gain line only the NUMBERS are green or red; the words
 *     ("season gain", "today", "since the draft", a range's "past week") are the app's grey, regular weight.
 *
 * The screens are React Native and not Deno-renderable, so the wiring is guarded as source scans, the
 * established pattern in this suite. Run with: cd apps/mobile/tests-deno && deno test .
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { SOURCES } from './sourceManifest.generated.ts';
import { formatGainPair, GAIN_PAIR_CLOSE, GAIN_PAIR_OPEN } from '../components/sp/logic/money.ts';
import { rangeGainText } from '../lib/chart/chartRanges.ts';

/** Source with its comment lines dropped, so a rule quoted in a comment cannot trip a code scan. */
const code = (src: string) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const src = (path: string) => {
  const s = SOURCES[path];
  assert(s !== undefined, `${path} is in the source manifest`);
  return code(s);
};

const PAIR = 'components/money/RollingGainPair.tsx';
const HERO = 'components/home/HomeHero.tsx';

// ── The formatter ───────────────────────────────────────────────────────────

Deno.test('formatGainPair: "+$X (+Y%)", the percent in brackets, no dot', () => {
  const g = formatGainPair(343.59, 2.86);
  assertEquals([g.money, g.pct, g.text], ['+$343.59', '+2.86%', '+$343.59 (+2.86%)']);
  assertEquals(formatGainPair(-49.5, -24.75).text, '−$49.50 (−24.75%)');
  assertEquals(formatGainPair(0, 0).text, '$0.00 (0.00%)', 'zero is never signed');
  assertEquals([GAIN_PAIR_OPEN, GAIN_PAIR_CLOSE], ['(', ')']);
});

Deno.test('the range gain builds its figures from formatGainPair (one formatter)', () => {
  const t = rangeGainText('6M', { money: 54.6, pct: 41.42, tone: 'gain' });
  assertEquals(t.figures, formatGainPair(54.6, 41.42).text);
  assertEquals([t.money, t.pct], [formatGainPair(54.6, 41.42).money, formatGainPair(54.6, 41.42).pct]);
  assert(src('lib/chart/chartRanges.ts').includes('formatGainPair(gain.money, gain.pct)'));
});

Deno.test('the portfolio view and the stock sheet take their pair from formatGainPair, not a hand-joined string', () => {
  const view = src('lib/money/portfolioView.ts');
  assertEquals((view.match(/formatGainPair\(/g) ?? []).length, 2, 'since the draft and today');
  assert(view.includes('gainText = pair.text;') && view.includes('todayText = pair.text;'));
  assert(src('components/money/StockSheetBody.tsx').includes('value={formatGainPair(position.gain, position.gainPct).text}'));
});

// ── Guard 1: no dot between a dollar gain and its percent ───────────────────

Deno.test('no source joins a formatted dollar and a formatted percent with a dot', () => {
  const offenders: string[] = [];
  for (const [path, source] of Object.entries(SOURCES)) {
    if (!/^(app|components|lib)\//.test(path)) continue;
    const c = code(source);
    // `${formatMoney(…)} · ${formatPercent(…)}` and `${moneyText} · ${pctText}` shapes.
    if (/formatMoney\([^\n]*\)\}\s*[·•]\s*\$\{[^}\n]*formatPercent\(/.test(c)) offenders.push(`${path}: formatMoney(…) · formatPercent(…)`);
    if (/\$\{[^}\n]*(money|Money)[A-Za-z]*\}\s*[·•]\s*\$\{[^}\n]*(pct|Pct|percent|Percent)[A-Za-z]*\}/.test(c)) offenders.push(`${path}: money · pct`);
  }
  assertEquals(offenders, [], 'write a gain pair with formatGainPair: "+$X (+Y%)"');
});

Deno.test('no dot between the money unit and the percent unit in any hero gain line', () => {
  // Home: the dollars, then the percent unit (its brackets), then the grey words; the only dots left
  // are the grey one before "today" and the pre-season "$0.00 · {label}" (not a pair).
  const hero = src(HERO);
  const row = hero.slice(hero.indexOf('<RollingMoney text={gainDollarsText}'), hero.indexOf('<RollingMoney text={todayText}'));
  assert(row.indexOf('{GAIN_PAIR_OPEN}') > row.indexOf('text={gainDollarsText}') && row.indexOf('{GAIN_PAIR_OPEN}') < row.indexOf('text={gainPctText}'));
  assert(row.indexOf('{GAIN_PAIR_CLOSE}') > row.indexOf('text={gainPctText}'));
  const between = row.slice(row.indexOf('text={gainDollarsText}'), row.indexOf('text={gainPctText}'));
  assert(!between.includes('·'), 'no dot between the dollars and the percent');
  // The "(" and ")" travel with the percent as ONE non-wrapping unit.
  assert(/<View style=\{styles\.pctUnit\}>[\s\S]*GAIN_PAIR_OPEN[\s\S]*text=\{gainPctText\}[\s\S]*GAIN_PAIR_CLOSE[\s\S]*<\/View>/.test(row));
  // Portfolio, a manager's portfolio and every chart's range gain: RollingGainPair, no dot anywhere in it.
  assert(!src(PAIR).includes('·'));
  for (const f of ['components/money/PortfolioScreen.tsx', 'components/money/PlayerPortfolioScreen.tsx', 'components/sp/gn/RangeGainLine.tsx']) {
    assert(src(f).includes('<RollingGainPair'), `${f} draws its gain line with RollingGainPair`);
  }
});

// ── Guard 2: the words are grey, the numbers carry the gain colour ──────────

Deno.test('RollingGainPair: the colour reaches the numbers and brackets only; the words are the grey token, regular weight', () => {
  const pair = src(PAIR);
  assertEquals((pair.match(/color=\{color\}/g) ?? []).length, 4, 'two numbers and two brackets');
  const wordsAt = pair.indexOf('{words ? (');
  assert(wordsAt > 0);
  const words = pair.slice(wordsAt, pair.indexOf(') : null}', wordsAt));
  assert(words.includes('tone="secondary"'), 'the words take the secondary (grey) tone');
  assert(!/color=\{/.test(words) && !/\bcolor:/.test(words), 'and never a colour override');
  assert(words.includes('styles.regular') && /regular: \{ fontWeight: '400' \}/.test(pair), 'regular weight');
});

Deno.test('Home hero: "season gain" and "today" (and the dot before today) are grey; the numbers take the sign colour', () => {
  const hero = src(HERO);
  assert(hero.includes('<Text variant="callout" tone="secondary"> {HERO_SEASON_GAIN_LABEL}</Text>'));
  assert(hero.includes('<Text variant="callout" tone="secondary"> {HERO_TODAY_LABEL}</Text>'));
  assert(hero.includes('<Text variant="callout" tone="secondary"> · </Text>'));
  // Every coloured Text on the gain row is a bracket; no word is.
  const row = hero.slice(hero.indexOf('<RollingMoney text={gainDollarsText}'), hero.indexOf('{preSeasonLabel == null && caption'));
  const coloured = row.match(/<Text variant="callout" style=\{\{ color: (?:gainColor|todayColor)[^\n]*<\/Text>/g) ?? [];
  assertEquals(coloured.length, 2, 'only the percent\'s two brackets');
  for (const c of coloured) assert(/\{GAIN_PAIR_(OPEN|CLOSE)\}/.test(c), `a coloured Text is a bracket: ${c}`);
});

Deno.test('no gain line colours its words: the callers hand RollingGainPair words as a plain string, never a coloured Text', () => {
  const portfolio = src('components/money/PortfolioScreen.tsx');
  assert(portfolio.includes('words="today"'));
  const manager = src('components/money/PlayerPortfolioScreen.tsx');
  assert(manager.includes('words={words}') && !/words=\{<|<Text[^>]*>\{?`?\$\{?NBSP/.test(manager), 'a manager\'s lines pass plain words');
  const range = src('components/sp/gn/RangeGainLine.tsx');
  assert(range.includes('words={text.keptWords}'));
  assert(!/<Text[^>]*color=\{color\}/.test(range), 'the range line draws no Text of its own in the gain colour');
});
