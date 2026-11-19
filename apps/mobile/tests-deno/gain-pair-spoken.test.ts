/**
 * A gain pair is SHOWN as "+$X (+Y%)" and SPOKEN as "+$X, +Y%" (Design Lead ruling on #546's VoiceOver finding:
 * brackets are not read well). formatGainPair's `spoken` is the ONE source of that speech; every accessibilityLabel
 * built from a pair uses it, never `.text`. No new words, no visual change.
 *   cd apps/mobile/tests-deno && deno test .
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { formatGainPair } from '../components/sp/logic/money.ts';
import { rangeGainText } from '../lib/chart/chartRanges.ts';
import { buildPortfolioView } from '../lib/money/portfolioView.ts';
import { heroAccessibilityLabel } from '../lib/home/homeCopy.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const strip = (src: string) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

Deno.test('formatGainPair: shown with brackets, spoken comma-joined, for a gain, a loss and zero', () => {
  const g = formatGainPair(481.78, 4.01);
  assertEquals(g.text, '+$481.78 (+4.01%)', 'the visible text is unchanged');
  assertEquals(g.spoken, '+$481.78, +4.01%');
  assertEquals(formatGainPair(-194.9, -9.74).spoken, '−$194.90, −9.74%');
  assertEquals(formatGainPair(-194.9, -9.74).text, '−$194.90 (−9.74%)');
  const z = formatGainPair(0, 0);
  assertEquals(z.spoken, `${z.money}, ${z.pct}`);
  assert(!z.spoken.includes('(') && !z.spoken.includes(')'));
});

Deno.test('every chart\'s range line: "+$54.60, +41.42% past 6 months" (shown text unchanged)', () => {
  const t = rangeGainText('6M', { money: 54.6, pct: 41.42, tone: 'gain' });
  assertEquals(t.label, '+$54.60, +41.42% past 6 months');
  assertEquals(t.figures, '+$54.60 (+41.42%)');
  assertEquals(rangeGainText('Season', { money: -194.9, pct: -9.74, tone: 'loss' }).label, '−$194.90, −9.74% since the draft');
  assert(strip(SOURCES['components/sp/gn/RangeGainLine.tsx']).includes('accessibilityLabel={text.label}'));
});

Deno.test('Portfolio view: the gain and today pairs carry their spoken forms beside the shown ones', () => {
  const v = buildPortfolioView({
    value: 12481.78, cash: 0, stake: 12000, numRounds: 1, perSlotNotional: 12000, stakeMode: 'fixed_notional',
    holdings: [{ symbol: 'NVDA', quantity: 100, costBasis: 12000, price: 124.8178, prevClose: 123.6051, name: 'NVIDIA' }],
  });
  assertEquals(v.gainText, '+$481.78 (+4.01%)');
  assertEquals(v.gainSpoken, '+$481.78, +4.01%');
  assertEquals(v.todayText, '+$121.27 (+0.98%)');
  assertEquals(v.todaySpoken, '+$121.27, +0.98%');
});

Deno.test('Home hero: the season-gain pair goes through .spoken ("+$481.78, +4.01% season gain")', () => {
  assertEquals(heroAccessibilityLabel('$12,481.78', formatGainPair(481.78, 4.01).spoken, '+$121.27', null), 'Your team, $12,481.78. +$481.78, +4.01% season gain. +$121.27 today.');
  assert(strip(SOURCES['components/home/HomeHero.tsx']).includes('formatGainPair(seasonGainDollars, seasonGainPct).spoken,'));
});

Deno.test('each surface\'s label is built from the spoken form', () => {
  const ps = strip(SOURCES['components/money/PortfolioScreen.tsx']);
  assert(ps.includes('accessibilityLabel={`${v.todaySpoken} today`}'), 'Portfolio: today');
  const pp = strip(SOURCES['components/money/PlayerPortfolioScreen.tsx']);
  assert(pp.includes('label={`${v.gainSpoken} ${v.sinceDraftLabel}`}'), 'manager portfolio: since the draft');
  assert(pp.includes('label={`${v.todaySpoken} today`}'), 'manager portfolio: today');
  const sheet = strip(SOURCES['components/money/StockSheetBody.tsx']);
  assert(sheet.includes('spoken={formatGainPair(position.gain, position.gainPct).spoken}'), 'stock sheet: Your position, Gain');
  assert(sheet.includes('accessibilityLabel={`${label}, ${spoken ?? value}`}'), 'the Figure speaks `spoken` when given');
});

Deno.test('guard: NO accessibility label anywhere is built from a gain pair\'s shown text', () => {
  const offenders: string[] = [];
  for (const [file, src] of Object.entries(SOURCES)) {
    if (!/^(app|components|lib)\//.test(file)) continue;
    for (const [i, line] of strip(src).split('\n').entries()) {
      if (!/accessibilityLabel|\blabel[=:]|Label\(|a11y/.test(line)) continue;
      // The pair's shown forms: PortfolioView's gainText/todayText, a formatGainPair(...).text, a range line's figures.
      if (/\bv\.(gain|today)Text\b|formatGainPair\([^)]*\)\.text|\.figures\b|\$\{figures\}/.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
    }
  }
  assertEquals(offenders, [], offenders.join('\n'));
});
