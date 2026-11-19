/**
 * The Stocks tab's React Native wiring, as source guards (the suite's pattern for RN-only code; the pure rules are
 * in stocks-list.test.ts). docs/plans/2026-11-18-stocks-tab.md, part 2.
 */
import { assert, assertEquals, assertFalse, assertMatch } from 'jsr:@std/assert';
import { SOURCES } from './sourceManifest.generated.ts';
import { ICON_GLYPHS, STOCKS_TAB_ICON } from '../components/sp/logic/icon.ts';
import { ROW_TEXT_MAX_SCALE as HOLDING_ROW_CAP } from '../lib/stocks/stocksList.ts';

/** Code only: a comment may name what the code must not do. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
const screen = SOURCES['components/stocks/StocksScreen.tsx'];
const listHook = SOURCES['lib/stocks/useStocksList.ts'];
const priceHook = SOURCES['lib/stocks/useRowPrices.ts'];
const tabBar = SOURCES['components/shell/ShellTabBar.tsx'];
const layout = SOURCES['app/(tabs)/_layout.tsx'];

Deno.test('the Stocks tab is the fifth and LAST tab, named "Stocks", in the bar and in the layout', () => {
  const names = [...tabBar.matchAll(/\{ name: '([a-z]+)', label: '([A-Za-z]+)'/g)].map((m) => [m[1], m[2]]);
  assertEquals(names, [['index', 'Home'], ['matchup', 'Matchup'], ['league', 'League'], ['portfolio', 'Portfolio'], ['stocks', 'Stocks']]);
  const screens = [...layout.matchAll(/<Tabs\.Screen name="([a-z]+)"/g)].map((m) => m[1]);
  assertEquals(screens, ['index', 'matchup', 'league', 'portfolio', 'stocks', 'draft']);
  assert(SOURCES['app/(tabs)/stocks.tsx'].includes('<LeagueListGate title="Stocks">'), 'no leagues is the shared state');
});

Deno.test('the tab icon is the storefront, in ONE constant', () => {
  assertEquals(STOCKS_TAB_ICON, { outline: 'storefront-outline', filled: 'storefront' });
  assertEquals(ICON_GLYPHS.tabStocks, 'storefront-outline');
  assertEquals(ICON_GLYPHS.tabStocksSelected, 'storefront');
  // The only place the Stocks tab's glyph is spelled out.
  for (const [path, src] of Object.entries(SOURCES)) {
    if (path === 'components/sp/logic/icon.ts') continue;
    assertFalse(/tabStocks'\s*:\s*'/.test(src), path);
  }
});

Deno.test('a row NEVER shows a stored price: nothing in the Stocks code reads last_price, and the list rows carry no price', () => {
  for (const [path, src] of Object.entries(SOURCES)) {
    if (!path.startsWith('lib/stocks/') && !path.startsWith('components/stocks/')) continue;
    assertFalse(/last_price|lastPrice|\.price\b.*stored/i.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), `${path} reads a stored price`);
  }
  assertMatch(screen, /rowPriceText\(priceOf\(row\.symbol\)\)/, 'the price text is the live lookup\'s, "–" until it arrives');
});

Deno.test('prices are asked for the rows ON SCREEN only, through the existing quote lookup, and no other price source', () => {
  assertMatch(screen, /const priceOf = useRowPrices\(onScreen\);/);
  assertMatch(screen, /symbolsOnScreen\(asBoxes, y, vp\)/);
  assertMatch(priceHook, /seamInvoke\('quote', \{ body: \{ symbols \} \}\)/);
  assertMatch(priceHook, /if \(error\) throw error;/, 'a failed call is a failed read, never a price');
  assertFalse(/symbols-search|ticker-quotes/.test(priceHook.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
});

Deno.test('paging: the read is the member-only RPC through the seam, error-checked, 25 at a time, one extra page when near the foot', () => {
  assertMatch(listHook, /seamRpc\('get_league_available_stocks', pageArgs\(leagueId, categoryId, pendingAfter\)\)/);
  assertMatch(listHook, /isFailedRead\(result\)/, 'a resolved { error } (42501, PT429) is a load failure, not "no stocks"');
  assertMatch(screen, /isNearEnd\(y, vp\)\) latest\.current\.loadMore\(\)/);
  assertMatch(screen, /onRefresh=\{onRefresh\}/, 'pull to refresh is the existing pattern (BarsRefresh)');
});

Deno.test('a row and its "+" open the EXISTING stock sheet; nothing here buys, and nothing is a one-tap trade', () => {
  assertMatch(screen, /const openSheet = \(row: ListRow, ref: string\) => open\(row\.symbol, \{ name: row\.name, originRef: ref \}\)/);
  assertMatch(screen, /onOpen=\{\(\) => openSheet\(row, 'stocks-row'\)\}/);
  assertMatch(screen, /onPlus=\{\(\) => openSheet\(row, 'stocks-plus'\)\}/);
  assertFalse(/useTradeSubmit|recordTrade|record-trade|functions\.invoke|seamInvoke\('record/.test(screen));
});

Deno.test('ONE accent "+" in every state: no amber, warn or Claim look; the colour is accent on onAccent', () => {
  assertFalse(/warn|amber|Claim|claim/.test(screen.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
  assertMatch(screen, /styles\.plusDisc, \{ backgroundColor: colors\.accent \}/);
  assertMatch(screen, /<Icon name="add" size="caption" tone="onAccent" \/>/);
  assertMatch(screen, /plusTarget: \{ width: 44, height: 44/, 'a 44pt target');
});

Deno.test('E3: the "+" is behind the ONE predicate (showsBuyPlus(seasonOver)), seasonOver is isSeasonOver, and a plus-less row keeps a chevron', () => {
  assertMatch(screen, /seasonOver=\{isSeasonOver\(activeLeague, new Date\(\), marketCalendar\)\}/);
  assertMatch(screen, /const plus = showsBuyPlus\(seasonOver\);/);
  assertMatch(screen, /\{plus \? \(\s*<Pressable accessibilityRole="button" accessibilityLabel=\{`Buy \$\{row\.symbol\}`\}/);
  assertMatch(screen, /\{plus \? null : <Icon name="chevronRight"/);
});

Deno.test('E6: first page = 8 skeleton rows with a 26pt circle for the "+"; next page = ONE row; VoiceOver "Loading results", busy', () => {
  assertMatch(screen, /const SKELETON_ROWS = 8;/);
  assertMatch(screen, /const PLUS_DISC = 26;/);
  assertMatch(screen, /<ListSkeleton rows=\{SKELETON_ROWS\} plus \/>/);
  assertMatch(screen, /view\.foot === 'loading' \? <ListSkeleton rows=\{1\} plus \/>/);
  assertMatch(screen, /accessibilityLabel="Loading results" accessibilityState=\{\{ busy: true \}\}/);
});

Deno.test('E7: a first-page failure is the existing LoadFailure; a later page keeps its rows with the retry message and a "Try again" that retries only it', () => {
  assertMatch(screen, /view\.kind === 'first_failed'\) return <LoadFailure title=\{COPY\.stockSearchLoadTitle\} message=\{COPY\.loadRetryMessage\} onRetry=\{retry\} \/>/);
  assertMatch(screen, /testID="stocks-foot-failed"[\s\S]{0,400}COPY\.loadRetryMessage[\s\S]{0,300}label=\{COPY\.tryAgain\} variant="ghost" size="sm" onPress=\{retry\}/);
});

Deno.test('E8: an empty category reuses search\'s empty state, with the category as the query', () => {
  assertMatch(screen, /COPY\.noStockMatches\(name\)/);
  assertMatch(screen, /COPY\.tryTickerOrName/);
});

Deno.test('E9: row words cap at the Holdings rule (1.3x), chips at 1.3x, the search field at 1.6x; the price moves under the name', () => {
  assertEquals(HOLDING_ROW_CAP, 1.3);
  assertMatch(SOURCES['components/money/HoldingRow.tsx'], /export const ROW_TEXT_MAX_SCALE = 1\.3;/);
  assertMatch(screen, /maxFontSizeMultiplier=\{CHIP_TEXT_MAX_SCALE\} numberOfLines=\{1\}/);
  assertMatch(screen, /maxFontSizeMultiplier=\{SEARCH_TEXT_MAX_SCALE\}\n\s+value=\{query\}/);
  assertMatch(screen, /const under = priceUnderName\(fontScale\);/);
  assertMatch(screen, /\{under \? price : null\}/);
  assertMatch(screen, /\{under \? null : <View style=\{styles\.trail\}>\{price\}<\/View>\}/);
  assertMatch(screen, /chipScroll: \{ flex: 1 \}/);
  assertMatch(screen, /<ScrollView horizontal showsHorizontalScrollIndicator=\{false\}/);
});

Deno.test('E9: row text is MEASURED, never fitted by iOS (adjustsFontSizeToFit on an unlaid row shrinks it to nothing)', () => {
  assertFalse(/adjustsFontSizeToFit|minimumFontScale/.test(code(screen)));
  assertMatch(screen, /fontSize: DISC_PT \* discTickerScale\(row\.symbol\)/);
  assertMatch(screen, /fontSize: VALUE_PT \* valueScale\(rowWidth, priceText, fontScale\)/);
  assertMatch(screen, /const \[rowWidth, setRowWidth\] = useState<number \| null>\(null\);/, 'null until laid out: full size');
  // The shared search row (reused for search results) is measured too.
  const search = SOURCES['components/money/StockSearchScreen.tsx'];
  assertFalse(/adjustsFontSizeToFit/.test(code(search)));
  assertMatch(search, /fontSize: DISC_PT \* discTickerScale\(item\.symbol\)/);
});

Deno.test('C: the search icon is first in the chip row; searching swaps the row for a field + Cancel and shows the existing search\'s rows', () => {
  const chipRow = screen.slice(screen.indexOf('function ChipRow'), screen.indexOf('function StockChip'));
  assert(chipRow.indexOf('stocks-search-icon') < chipRow.indexOf('<ScrollView horizontal'), 'the icon is first, outside the scrolling chips');
  assertMatch(screen, /control\.mode === 'chips' \? \(\s*<ChipRow/);
  assertMatch(screen, /<SearchField query=\{control\.query\}/);
  assertMatch(screen, /useMoneyStockSearch\(query, ''\)/);
  assertMatch(screen, /<SearchRow key=\{item\.symbol\} item=\{item\} status=\{suffix\}/);
  assertMatch(screen, /useSearchOwnership\(\)/, 'an owned stock is marked by the existing ownership rule ("Owned by {name}")');
  assertMatch(screen, /Cancel<\/Text>/);
});

Deno.test('"All" is the default chip, and a chip passes its category id to the list', () => {
  assertMatch(screen, /selected=\{list\.state\.categoryId\} onSelect=\{list\.selectCategory\}/);
  assertMatch(screen, /on=\{selected === c\.categoryId\}/);
});

Deno.test('Portfolio: "Buy a stock" is gone; the holding row still opens its card (Sell)', () => {
  const p = SOURCES['components/money/PortfolioScreen.tsx'];
  assertFalse(/buyAStock|portfolio-buy-a-stock|stock-search/.test(p));
  assertMatch(p, /<HoldingRow key=\{r\.symbol\} row=\{r\} pill=\{pillFor\(r\.symbol\)\} onPress=\{\(\) => openRow\(r\.symbol, r\.name\)\} \/>/);
  assertMatch(p, /pendingSell\.current = \{ symbol: card\.data\.ticker/);
});
