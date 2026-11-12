/**
 * The shared sheet bar (Giorgio, 2026-11-12: "i like the idea of having the top left being a back or close button and the top right
 * being the save button...", then "B and no, hitting back or x just closes it"; PRODUCT_RULES, the top-bar amendment under "A
 * sheet's top must not be a stuck block that cuts text"). Pinned here:
 *  - every page-sheet route in app/_layout.tsx draws SheetBar (the list is READ from the layout, like sheet-top-inset.test.ts);
 *  - closing never asks: no confirmation, no prevent-remove, the × / swipe / VoiceOver escape all just close;
 *  - the bar's words stop growing at 1.3x and the × never grows;
 *  - the scroll edge (divider + fade) shows only once scrolled, and the fade never goes through `transparent`.
 * Run: `cd apps/mobile && deno test --no-check --sloppy-imports --allow-read --allow-env --unstable-raw-imports tests-deno/`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import layout from '../app/_layout.tsx' with { type: 'text' };
import { isPageSheet } from '../lib/shell/screenTopInset.ts';
import {
  SHEET_BAR_HEIGHT,
  SHEET_BAR_MAX_SCALE,
  SHEET_BAR_SIDE,
  SHEET_BAR_TARGET,
  SHEET_BAR_TITLE_SIZE,
  SHEET_EDGE_DIVIDER,
  SHEET_EDGE_FADE_HEIGHT,
  SHEET_EDGE_FADE_SOLID,
  sheetBarFieldSize,
  sheetEdgeShown,
  sheetFadeLocations,
} from '../components/shell/sheetBarLogic.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const bar = SOURCES['components/shell/SheetBar.tsx'];
/** The source without its comment lines, for "this word never appears in the code" checks. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

// ── The four routes, read from _layout ───────────────────────────────────────────────────────────

function optionConsts(): Map<string, string | undefined> {
  const out = new Map<string, string | undefined>();
  for (const m of layout.matchAll(/const (\w+) = (\{[^}]*\}) as const;/g)) out.set(m[1], /presentation: '(\w+)'/.exec(m[2])?.[1]);
  return out;
}
function sheetRoutes(): string[] {
  const consts = optionConsts();
  return [...layout.matchAll(/<Stack\.Screen name="([^"]+)"(?: options=\{(\{[^}]*\}|\w+)\})?/g)]
    .map((m) => {
      const options = m[2] ?? '';
      const p = options.startsWith('{') ? /presentation: '(\w+)'/.exec(options)?.[1] : consts.get(options);
      return { name: m[1], p };
    })
    .filter((s) => isPageSheet(s.p, 'ios'))
    .map((s) => s.name);
}
/** The route file plus every app/ or components/ file it imports, transitively. */
function closure(route: string): string[] {
  const seen = new Set<string>();
  const resolve = (from: string, spec: string): string | null => {
    let base: string;
    if (spec.startsWith('@/')) base = spec.slice(2);
    else if (spec.startsWith('.')) base = new URL(spec, `file:///${from}`).pathname.slice(1);
    else return null;
    for (const c of [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) if (c in SOURCES) return c;
    return null;
  };
  const visit = (file: string) => {
    if (seen.has(file) || !(file.startsWith('app/') || file.startsWith('components/'))) return;
    seen.add(file);
    for (const m of SOURCES[file].matchAll(/from '([^']+)'/g)) {
      const next = resolve(file, m[1]);
      if (next) visit(next);
    }
  };
  visit(`app/${route}.tsx`);
  return [...seen].sort();
}
const tags = (src: string, name: string) => [...src.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map((m) => m[0]);

Deno.test('the sheet routes read from app/_layout.tsx are the four the bar was built for, plus any added later', () => {
  const routes = sheetRoutes();
  for (const r of ['forgot-password', 'league-settings', 'player-portfolio', 'trade-history']) assert(routes.includes(r), `${r} enumerated`);
});

for (const route of sheetRoutes()) {
  Deno.test(`sheet ${route}: it renders SheetBar (directly, or through a scaffold it hands \`sheet\`)`, () => {
    const files = closure(route);
    assert(files.includes('components/shell/SheetBar.tsx'), `${route}: SheetBar is not in the files this route renders`);
    const routeSrc = SOURCES[`app/${route}.tsx`];
    // A scaffold is a sheet only when handed `sheet`: every one this route draws is, so no view of the route keeps the old top.
    for (const scaffold of ['SetupScaffold', 'AuthScaffold']) {
      for (const t of tags(routeSrc, scaffold)) assert(/\bsheet=/.test(routeSrc.slice(routeSrc.indexOf(t), routeSrc.indexOf(t) + 400)) || /\bsheet=/.test(t), `${route}: <${scaffold}> without \`sheet\``);
    }
    // And the scaffolds do draw the bar when they get it; the screens that draw it themselves name it.
    if (/<(SetupScaffold|AuthScaffold)\b/.test(routeSrc)) {
      assert(/<SheetBar\b/.test(SOURCES['components/game/SetupScaffold.tsx']) || /<SheetBar\b/.test(SOURCES['components/shell/AuthScaffold.tsx']));
    } else {
      assert(files.some((f) => f !== 'components/shell/SheetBar.tsx' && /<SheetBar\b/.test(SOURCES[f])), `${route}: no file draws <SheetBar`);
    }
  });
}

Deno.test('the scaffolds draw SheetBar in place of the old top, and only when handed `sheet`', () => {
  for (const f of ['components/game/SetupScaffold.tsx', 'components/shell/AuthScaffold.tsx']) {
    assert(/<SheetBar \{\.\.\.sheet\}/.test(SOURCES[f]), f);
    assert(/sheet \?/.test(SOURCES[f]) || /sheet\s*\?\s*</.test(SOURCES[f]), `${f}: the bar is conditional on \`sheet\``);
  }
  // No sheet view keeps the big in-body title (League settings, Forgot password).
  assert(!/<ScreenTitle/.test(SOURCES['app/forgot-password.tsx']));
  assert(!/<ScreenTitle/.test(SOURCES['app/league-settings.tsx']));
  assert(/const heading = sheet \? null/.test(SOURCES['components/game/SetupScaffold.tsx']));
});

Deno.test('League settings: no "League settings" heading, no "League name" field, no pinned Save changes, no Success alert', () => {
  const s = SOURCES['app/league-settings.tsx'];
  assert(!/label="League name"/.test(s), 'the League name Field is gone');
  assert(!/Save changes/.test(s), 'the pinned Save changes button is gone');
  assert(!/Alert\.alert\('Success'/.test(s), 'a good save just closes');
  assert(!/title="League settings"/.test(s), 'no "League settings" title prop');
  // A good save closes the sheet right after the refresh.
  assert(/await refresh\(\);\s*\n\s*\/\/[^\n]*\n\s*router\.dismiss\(\);/.test(s));
  // Save is driven by the derived dirty state, never a touched flag.
  assert(/saveState\(\{ dirty, saving \}\)/.test(s));
  assert(!/\btouched\b/i.test(s));
});

Deno.test('Trade history and a manager\'s team: the bar replaces the pill, "‹ Portfolio" and the pinned name-and-× header', () => {
  const th = SOURCES['components/money/TradeHistoryScreen.tsx'];
  assert(/<SheetBar title=\{COPY\.tradeHistory\}/.test(th));
  assert(!/ShellHeader|LeaguePill/.test(th) && !/accessibilityLabel="Portfolio"/.test(th));
  const team = SOURCES['components/money/PlayerPortfolioScreen.tsx'];
  assert(/<SheetBar\b/.test(team));
  assert(!/styles\.closeBtn|styles\.header/.test(team));
  const forgot = SOURCES['app/forgot-password.tsx'];
  assert(/title: 'Forgot password\?'/.test(forgot));
  assert(/closeLabel: 'Back to sign in'/.test(forgot), 'Forgot password keeps its VoiceOver label');
});

// ── Closing never asks ────────────────────────────────────────────────────────────────────────────

Deno.test('closing never asks: SheetBar has no confirmation of any kind, and × / the VoiceOver escape call onClose directly', () => {
  assert(!/\bAlert\b|ActionSheetIOS|usePreventRemove|beforeRemove|confirm/i.test(bar), 'no confirmation in the bar');
  assert(/<Pressable onPress=\{onClose\}/.test(bar), 'the × closes at once');
  assert(/onAccessibilityEscape=\{onClose\}/.test(bar), 'the VoiceOver escape closes at once');
});

Deno.test('closing never asks: nothing the four sheets render can hold a swipe-down or stop a close', () => {
  for (const route of sheetRoutes()) {
    for (const f of closure(route)) {
      assert(!/usePreventRemove|beforeRemove|ActionSheetIOS/.test(SOURCES[f]), `${f} (rendered by ${route}) can intercept a close`);
    }
  }
  // The routes' own options keep the swipe (no gestureEnabled: false on a sheet).
  for (const m of layout.matchAll(/const (HIDDEN_HEADER_MODAL) = (\{[^}]*\}) as const;/g)) assert(!/gestureEnabled/.test(m[2]), `${m[1]} keeps the swipe-down`);
  for (const m of layout.matchAll(/<Stack\.Screen name="(league-settings|player-portfolio|trade-history|forgot-password)"[^>]*>/g)) assert(!/gestureEnabled/.test(m[0]), m[1]);
});

Deno.test('closing never asks: League settings\' close is router.dismiss() and nothing else, even with unsaved changes', () => {
  const s = SOURCES['app/league-settings.tsx'];
  assert(/const handleClose = \(\) => \{\s*router\.dismiss\(\);\s*\}/.test(s), 'handleClose only dismisses');
  assert((s.match(/onClose: handleClose/g) ?? []).length === 3, 'all three views close through handleClose');
  // The other sheets' closes are a plain back / replace.
  assert(/const close = \(\) => \(router\.canGoBack\(\) \? router\.back\(\) : router\.replace\('\/\(tabs\)\/portfolio'\)\)/.test(SOURCES['components/money/PlayerPortfolioScreen.tsx']));
  assert(/onClose=\{\(\) => router\.back\(\)\}/.test(SOURCES['components/money/TradeHistoryScreen.tsx']));
  assert(/const closeSheet = \(\) => \(router\.canGoBack\(\) \? router\.back\(\) : backToSignIn\(\)\)/.test(SOURCES['app/forgot-password.tsx']));
});

// ── The bar's text: 1.3x and a fixed ×, one line ──────────────────────────────────────────────────

Deno.test('the bar\'s words stop at 1.3x: the title and Save are capped, and the × is the one icon role that never scales', () => {
  assertEquals(SHEET_BAR_MAX_SCALE, 1.3);
  const texts = tags(bar, 'Text');
  assert(texts.length >= 3, 'the plain title, the renamable title and Save');
  for (const t of texts) assert(/maxFontSizeMultiplier=\{SHEET_BAR_MAX_SCALE\}/.test(t), `uncapped bar text: ${t}`);
  assert(/<Icon name="close" size="tab"/.test(bar), 'the × is a fixed size');
  // The title is one line, cut with "…".
  for (const t of texts.filter((x) => /styles\.title\b/.test(x))) assert(/numberOfLines=\{1\}/.test(t), t);
});

Deno.test('the title field draws at the title size and never past 1.3x of it', () => {
  assertEquals(sheetBarFieldSize(undefined), SHEET_BAR_TITLE_SIZE);
  assertEquals(sheetBarFieldSize(17), 17);
  assertEquals(sheetBarFieldSize(17 * 1.3), 17 * 1.3);
  assertEquals(sheetBarFieldSize(17 * 3.571), 17 * 1.3, 'AX5 stops at the cap');
  assertEquals(sheetBarFieldSize(0), SHEET_BAR_TITLE_SIZE);
});

Deno.test('the bar\'s geometry: ~56 tall, a 44 target, side slots that keep the title centred', () => {
  assertEquals(SHEET_BAR_HEIGHT, 56);
  assertEquals(SHEET_BAR_TARGET, 44);
  assert(SHEET_BAR_SIDE >= SHEET_BAR_TARGET + 8);
  assert(/minHeight: SHEET_BAR_HEIGHT/.test(bar));
});

// ── The scroll edge ───────────────────────────────────────────────────────────────────────────────

Deno.test('the scroll edge shows only once scrolled: at the top (and pulled past it) neither the divider nor the fade shows', () => {
  assertEquals(sheetEdgeShown(0), false);
  assertEquals(sheetEdgeShown(-40), false, 'rubber-banding past the top');
  assertEquals(sheetEdgeShown(0.5), true);
  assertEquals(sheetEdgeShown(300), true);
  assert(/\{edge \? \(/.test(bar), 'both are drawn only when `edge`');
});

Deno.test('the scroll edge: a 1pt border-token divider, and a 24pt fade solid for 6pt then clear, in the bar\'s own colour', () => {
  assertEquals(SHEET_EDGE_DIVIDER, 1);
  assertEquals(SHEET_EDGE_FADE_HEIGHT, 24);
  assertEquals(SHEET_EDGE_FADE_SOLID, 6);
  assertEquals(sheetFadeLocations(), [0, 0.25, 1]);
  assert(/backgroundColor: colors\.border/.test(bar), 'the divider is the border token');
  assert(/colors=\{\[colors\.surface, colors\.surface, clear\]\}/.test(bar), 'surface, surface, then the surface at alpha 0');
  assert(/const clear = clearOf\(colors\.surface\)/.test(bar));
  assert(!/transparent/.test(code(bar)), 'never the `transparent` keyword (black at alpha 0: a grey fade)');
  assert(/bottom: -SHEET_EDGE_FADE_HEIGHT/.test(bar), 'the fade hangs below the bar, over the content');
  assert(/zIndex: 2/.test(bar), 'the bar sits above the scroll view it fades over');
});

Deno.test('every sheet hands its scroll view the edge hook (the bar learns it scrolled)', () => {
  for (const f of ['components/game/SetupScaffold.tsx', 'components/shell/AuthScaffold.tsx', 'components/money/PlayerPortfolioScreen.tsx', 'components/money/TradeHistoryScreen.tsx']) {
    assert(/useSheetScrollEdge\(\)/.test(SOURCES[f]), `${f} reads the edge`);
    assert(/\bonScroll\b/.test(SOURCES[f]), `${f} hands the edge to its scroll view`);
  }
});

// ── Save and the title in the bar ─────────────────────────────────────────────────────────────────

Deno.test('Save is inert unless on, VoiceOver reads it dimmed, and progress takes the word\'s place without moving the bar', () => {
  assert(/onPress=\{inert \? undefined : save\.onPress\}/.test(bar));
  assert(/accessibilityState=\{\{ disabled: inert, busy: saving \}\}/.test(bar));
  assert(/color=\{inert \? colors\.text3 : colors\.accent\}/.test(bar), 'grey, then the accent');
  assert(/saving \? styles\.hidden : null/.test(bar) && /<ActivityIndicator/.test(bar), 'the word stays laid out while saving');
});

Deno.test('the title: a header for a read-only sheet; one button "League name" (value: the name) with a decorative pencil for a renamer', () => {
  assert(/accessibilityRole="header"/.test(bar));
  assert(/accessibilityLabel="League name"\s*\n\s*accessibilityValue=\{\{ text: title \}\}/.test(bar));
  assert(/<Icon name="edit" size="callout" tone="text2" \/>/.test(bar), 'the pencil carries no label (decorative)');
  // The pencil is outside the shrinking Text, so it stays visible after a "…".
  assert(/styles\.pencil/.test(bar) && /flexShrink: 0/.test(bar));
  // In-bar field: return ends editing, accent underline, labelled "League name".
  assert(/returnKeyType="done"/.test(bar) && /onSubmitEditing=\{rename\.onEnd\}/.test(bar));
  assert(/backgroundColor: colors\.accent/.test(bar));
});
