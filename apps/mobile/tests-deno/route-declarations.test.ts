/**
 * S-15: every route file must be DECLARED in app/_layout.tsx. expo-router
 * auto-adds an undeclared route file as an unguarded screen -- outside both
 * Stack.Protected guards -- so it is reachable signed out (a deep link). That
 * is how app/stock-search.tsx sat open (the route is gone since 2026-11-22). This test enumerates the route files
 * from the generated source manifest, so a NEW route file fails here until it
 * is declared -- ONCE the manifest is regenerated. LIMIT: this suite runs
 * without --allow-read, so it cannot list app/ itself; a route file added
 * without regenerating the manifest is invisible here.
 * `node tests-deno/gen-source-manifest.mjs --check` (exit 1 if stale) closes
 * that gap and is not yet wired into CI.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import layout from '../app/_layout.tsx' with { type: 'text' };
import { SOURCES } from './sourceManifest.generated.ts';

/** Special files that are not routes. */
const NOT_ROUTES = new Set(['_layout', '+html', '+not-found', '+native-intent']);

function routeNames(): string[] {
  const names = new Set<string>();
  for (const path of Object.keys(SOURCES)) {
    const top = /^app\/([^/]+)\.tsx$/.exec(path);
    if (top && !NOT_ROUTES.has(top[1])) names.add(top[1]);
    const group = /^app\/(\([^)]+\))\//.exec(path);
    if (group) names.add(group[1]);
  }
  return [...names].sort();
}

Deno.test('every route file in app/ has a Stack.Screen in app/_layout.tsx', () => {
  const routes = routeNames();
  assert(routes.includes('trade-history') && routes.includes('(tabs)') && routes.includes('login'), 'manifest enumeration broke');
  const undeclared = routes.filter((r) => !layout.includes(`<Stack.Screen name="${r}"`));
  assertEquals(undeclared, [], 'undeclared routes are auto-added OUTSIDE the sign-in guards');
});

Deno.test('the retired stock-search route is gone: no route file, no Stack.Screen, no link or Stack option naming it', () => {
  assertEquals(routeNames().includes('stock-search'), false);
  assertEquals(layout.includes('name="stock-search"'), false);
  // The Stocks tab (app/(tabs)/stocks.tsx) is where buying starts; nothing in the app reaches for the old route.
  for (const [path, text] of Object.entries(SOURCES)) {
    if (!/^(app|components|lib)\//.test(path)) continue;
    assertEquals(/['"`]\/stock-search['"`]/.test(text), false, `${path} navigates to /stock-search`);
  }
});
