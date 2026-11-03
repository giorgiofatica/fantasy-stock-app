/**
 * Game-screens gate GS-3: at XL text every SegmentedControl truncated ("Stan… / Sche…",
 * "My matc…"), so the League tabs couldn't be told apart. Its labels now take the tab
 * bar's Dynamic Type ceiling (1.3), with fit-to-width only as a narrow-phone safety net.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert } from 'jsr:@std/assert';
import { SOURCES } from './sourceManifest.generated.ts';

Deno.test('the segment label is capped like the tab bar label (source guard)', () => {
  const seg = SOURCES['components/sp/SegmentedControl.tsx'];
  const tab = SOURCES['components/shell/ShellTabBar.tsx'];
  assert(tab.includes('const LABEL_MAX_SCALE = 1.3;'));
  assert(seg.includes('const LABEL_MAX_SCALE = 1.3;'), 'the segment cap matches the tab bar cap');
  assert(seg.includes('maxFontSizeMultiplier={LABEL_MAX_SCALE}'));
  assert(seg.includes('adjustsFontSizeToFit'));
});

Deno.test('every segmented control in the app is the one sp SegmentedControl (so one cap covers them)', () => {
  for (const [path, src] of Object.entries(SOURCES)) {
    if (path === 'components/sp/SegmentedControl.tsx' || path === 'components/shell/ShellTabBar.tsx') continue;
    // Game Night (§9C): RangePills is the range primitive (tabs or pills); same cap, pinned below.
    if (path === 'components/sp/gn/RangePills.tsx') continue;
    // W4 League: the board's section tabs (SegmentTabs), the same look and cap as RangePills.
    if (path === 'components/sp/gn/SegmentTabs.tsx') continue;
    assert(!src.includes('accessibilityRole="tablist"'), `${path} rolls its own segmented control`);
  }
});

Deno.test("Game Night RangePills carry the segmented labels' cap (1.3x)", () => {
  const pills = SOURCES['components/sp/gn/RangePills.tsx'];
  assert(pills.includes('const LABEL_MAX_SCALE = 1.3;'));
  assert(pills.includes('maxFontSizeMultiplier={LABEL_MAX_SCALE}'));
});

Deno.test("Game Night SegmentTabs (League's sections) carry the same 1.3x cap and never truncate", async () => {
  const tabs = SOURCES['components/sp/gn/SegmentTabs.tsx'];
  assert(tabs.includes('maxFontSizeMultiplier={TAB_LABEL_MAX_SCALE}'));
  assert(tabs.includes("const look = rangeLook('tabs', selected, colors);"));
  // Too wide for the screen (four at XL on the 17e): the row scrolls rather than clipping a label.
  assert(tabs.includes('<ScrollView horizontal'));
  const { segmentTabsScroll } = await import('../lib/game/leagueView.ts');
  const four = ['Standings', 'Schedule', 'Playoffs', 'History'];
  assert(!segmentTabsScroll(four, 1, 350), 'four tabs fit the 17e at Large');
  assert(segmentTabsScroll(four, 2.35, 350), 'four tabs scroll at XL on the 17e');
  assert(!segmentTabsScroll(['Standings', 'Schedule', 'History'], 1, 350));
});
