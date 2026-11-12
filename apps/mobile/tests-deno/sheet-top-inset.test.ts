/**
 * Build 14 (Giorgio, League settings): a ~70pt empty band above "Cancel". An iOS page sheet
 * (`presentation: 'modal'`) already starts below the status bar, and SetupScaffold cleared the
 * safe-area top inset again inside it (~62pt on iPhone 17). Forgot password (AuthScaffold), a
 * player's portfolio (PlayerPortfolioScreen) and Trade history (ShellHeader) had the same shape. (2026-11-12: all four now draw
 * the shared SheetBar, which reads the hook.)
 *
 * Now the root Stack's `screenLayout` learns "page sheet" from each screen's own presentation
 * (components/shell/ScreenPresentation.tsx) and the frames read `useScreenTopInset()`. This file
 * lists EVERY page-sheet route from app/_layout.tsx, so a new sheet route is checked by declaring
 * it, and walks each route's component imports: the frame must read the sheet-aware inset, and no
 * file it renders may clear the raw `insets.top` unless that file opens its own full-screen
 * <Modal> window (InfoPopup), where the status bar is really there.
 * Run: `cd apps/mobile && deno test --no-check --sloppy-imports --allow-read --allow-env --unstable-raw-imports tests-deno/`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import layout from '../app/_layout.tsx' with { type: 'text' };
import presentation from '../components/shell/ScreenPresentation.tsx' with { type: 'text' };
import { IOS_SHEET_PRESENTATIONS, isPageSheet, SHEET_TOP_INSET, screenTopInset } from '../lib/shell/screenTopInset.ts';
import { SOURCES } from './sourceManifest.generated.ts';

/** `const NAME = { ... presentation: 'x' ... } as const;` in _layout → NAME: x (undefined when none). */
function optionConsts(): Map<string, string | undefined> {
  const out = new Map<string, string | undefined>();
  for (const m of layout.matchAll(/const (\w+) = (\{[^}]*\}) as const;/g)) {
    out.set(m[1], /presentation: '(\w+)'/.exec(m[2])?.[1]);
  }
  return out;
}

/** Every <Stack.Screen> in _layout with the presentation its options resolve to. */
function screens(): { name: string; presentation: string | undefined; options: string }[] {
  const consts = optionConsts();
  return [...layout.matchAll(/<Stack\.Screen name="([^"]+)"(?: options=\{(\{[^}]*\}|\w+)\})?/g)].map((m) => {
    const options = m[2] ?? '';
    const p = options.startsWith('{') ? /presentation: '(\w+)'/.exec(options)?.[1] : consts.get(options);
    return { name: m[1], presentation: p, options };
  });
}

const sheetRoutes = () => screens().filter((s) => isPageSheet(s.presentation, 'ios')).map((s) => s.name);

/** The source files a route renders: its route file plus every app/ or components/ file it imports, transitively. */
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

const readsRawTop = (src: string) => /insets\.top\b|top:\s*insets\b/.test(src);
const opensOwnWindow = (src: string) => /<Modal\b/.test(src);

Deno.test('screenTopInset: a page sheet clears nothing; every other screen clears the full safe-area top', () => {
  assertEquals(SHEET_TOP_INSET, 0);
  assertEquals(screenTopInset(62, true), 0, 'a page sheet already starts below the status bar');
  assertEquals(screenTopInset(62, false), 62, 'a full-screen screen starts under the status bar');
  assertEquals(screenTopInset(0, false), 0);
});

Deno.test('isPageSheet: only an iOS sheet presentation; fullScreenModal, a push and every Android presentation keep the inset', () => {
  for (const p of IOS_SHEET_PRESENTATIONS) assertEquals(isPageSheet(p, 'ios'), true, p);
  for (const p of ['fullScreenModal', 'card', 'transparentModal', 'containedModal', undefined]) assertEquals(isPageSheet(p, 'ios'), false, String(p));
  // react-native-screens: on Android 'modal' (and pageSheet) is "equivalent to push", full screen under an edge-to-edge status bar.
  for (const p of [...IOS_SHEET_PRESENTATIONS, 'fullScreenModal']) assertEquals(isPageSheet(p, 'android'), false, `android ${p}`);
});

Deno.test('the root Stack sets presentationScreenLayout, and it reads the screen\'s own presentation', () => {
  assertEquals((layout.match(/<Stack\b(?!\.)/g) ?? []).length, 1, 'one Stack in app/_layout.tsx');
  assert(/<Stack screenOptions=\{HIDDEN_HEADER\} screenLayout=\{presentationScreenLayout\}>/.test(layout));
  assert(/isPageSheet\(options\.presentation, Platform\.OS\)/.test(presentation), 'the context comes from the presentation option');
  assert(/createContext\(false\)/.test(presentation), 'outside the Stack (and by default) a screen is not a sheet');
  assert(/screenTopInset\(insets\.top, useContext\(InPageSheet\)\)/.test(presentation), 'the hook passes the real safe-area top through');
});

Deno.test('the page-sheet routes read from app/_layout.tsx are the four known, plus any added later', () => {
  const routes = sheetRoutes();
  for (const r of ['forgot-password', 'league-settings', 'player-portfolio', 'trade-history']) assert(routes.includes(r), `${r} enumerated`);
  // Full-screen siblings stay out of the list.
  for (const r of ['create-league', 'join-league', 'takeover', '(tabs)']) assert(!routes.includes(r), `${r} is not a sheet`);
});

for (const route of sheetRoutes()) {
  Deno.test(`page sheet ${route}: its frame reads useScreenTopInset, and nothing it renders clears the raw status-bar inset`, () => {
    const files = closure(route);
    assert(files.length > 1, `${route}: import walk found its components`);
    assert(files.some((f) => /useScreenTopInset\(\)/.test(SOURCES[f])), `${route}: no file reads useScreenTopInset()`);
    const doubled = files.filter((f) => readsRawTop(SOURCES[f]) && !opensOwnWindow(SOURCES[f]));
    assertEquals(doubled, [], `${route}: clears insets.top inside a sheet that already starts below the status bar`);
  });
}

Deno.test('full-screen screens keep the inset: create-league and the tabs reach the frames through the non-sheet path', () => {
  const byName = new Map(screens().map((s) => [s.name, s]));
  assertEquals(byName.get('create-league')?.presentation, 'fullScreenModal');
  assertEquals(isPageSheet(byName.get('create-league')?.presentation, 'ios'), false);
  assertEquals(isPageSheet(byName.get('(tabs)')?.presentation, 'ios'), false);
  assert(closure('create-league').includes('components/game/SetupScaffold.tsx'), 'Create league shares SetupScaffold with League settings');
  // The shared frames clear the hook's value, which is the full safe-area top outside a sheet.
  // The sheet bar (SheetBar.tsx) is the top of all four sheet routes now; SetupScaffold / AuthScaffold keep the inset for their non-sheet screens (Create league, the auth forms), ShellHeader for the tabs.
  for (const f of ['components/game/SetupScaffold.tsx', 'components/shell/AuthScaffold.tsx', 'components/shell/ShellHeader.tsx', 'components/shell/SheetBar.tsx']) {
    assert(/useScreenTopInset\(\)/.test(SOURCES[f]), `${f} reads useScreenTopInset()`);
    assert(!readsRawTop(SOURCES[f]), `${f} still clears raw insets.top`);
    assert(/(height|paddingTop): topInset\b/.test(SOURCES[f]), `${f} lays out the hook value at its top`);
  }
});
