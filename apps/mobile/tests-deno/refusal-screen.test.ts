/**
 * Every dead end on a takeover or invite link takes ONE form (PRODUCT_RULES, "Every dead end on a takeover or invite link takes the same
 * form"; board #call-refusal-family; Giorgio's sign-off 2026-11-12). It starts with the takeover's "already taken" screen (pick A, built like
 * the takeover QUESTION): a 64pt neutral disc with a drawn icon, the sentence as the heading, an optional line, a docked full-width pill, an
 * optional muted "Not now", all in the AuthScaffold footer, through one shared RefusalScreen. Words are unchanged.
 *
 *   cd apps/mobile/tests-deno && deno test refusal-screen.test.ts
 */
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';
import { GO_TO_HOME, NOT_NOW, OPEN_THE_LEAGUE, TAKEN_LINE, TRY_LATER } from '../lib/account/deleteCopy.ts';
import { takeoverRefusal, type RefusalState } from '../lib/account/takeoverRefusal.ts';
import { interpretTakeoverPreview } from '../lib/account/takeoverView.ts';
import { ICON_GLYPHS } from '../components/sp/logic/icon.ts';
import { INVITE_COPY } from '../lib/invite/inviteCopy.ts';
import { ARRIVAL_COPY } from '../lib/invite/arrivalView.ts';
import { JOIN_COPY } from '../lib/join/joinPreview.ts';
import { splitRefusal } from '../lib/refusalSplit.ts';
import { keepName } from '../lib/account/keepName.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const src = (p: string) => strip(SOURCES[p]);
const landing = src('components/shell/TakeoverLanding.tsx');
const refusal = src('components/shell/RefusalScreen.tsx');
const mapping = src('lib/account/takeoverRefusal.ts');
const arrival = src('components/shell/InviteArrival.tsx');

// ── The shared frame ────────────────────────────────────────────────────────

Deno.test('RefusalScreen: props are icon, heading, optional line, primary, optional secondary', () => {
  const props = refusal.slice(refusal.indexOf('export interface RefusalScreenProps'), refusal.indexOf('export function RefusalScreen('));
  assert(/icon: IconName;/.test(props));
  assert(/heading: string;/.test(props));
  assert(/line\?: string;/.test(props), 'the line is optional');
  assert(/primary: \{ label: string; onPress: \(\) => void \};/.test(props));
  assert(/secondary\?: \{ label: string; onPress: \(\) => void \};/.test(props), 'the secondary is optional');
});

Deno.test('RefusalScreen: the line renders only when given, the "Not now" only when given, under the full-width pill', () => {
  assert(refusal.includes('{line ? ('), 'no line prop, no line');
  assert(refusal.includes('{line}</Text>'));
  assert(refusal.includes('{secondary ? <Link label={secondary.label} onPress={secondary.onPress} muted /> : null}'), 'no secondary prop, no link; it is the muted Not-now link');
  const footer = refusal.slice(refusal.indexOf('footer={'), refusal.indexOf('>\n      <View style={styles.block}>'));
  assert(footer.indexOf('<Button') > 0 && footer.indexOf('<Button') < footer.indexOf('<Link'), 'the pill, then the Not now under it');
  assert(footer.includes('<Button label={primary.label} onPress={primary.onPress} fullWidth />'), 'a full-width pill, docked in the footer');
  assertEquals(NOT_NOW, 'Not now');
});

Deno.test('RefusalScreen: built like the question screen: 64pt neutral disc, glyph at the avatar\'s 0.58, ScreenTitle at 1.15, line body text2 capped at 2x, icon hidden from VoiceOver', () => {
  const q = landing.slice(landing.indexOf("const found = state.kind === 'found'"));
  assert(q.includes('<Avatar name={label} size={DISC} tone="neutral" />') && landing.includes('const DISC = 64;'));
  assert(refusal.includes('export const REFUSAL_DISC = 64;'));
  assert(refusal.includes('backgroundColor: colors.inset'), 'the neutral Avatar\'s fill');
  assert(refusal.includes('Math.round(REFUSAL_DISC * DELETED_GLYPH_RATIO)') && src('components/sp/Avatar.tsx').includes('export const DELETED_GLYPH_RATIO = 0.58;'));
  assert(refusal.includes('color={colors.text2}'), 'the glyph ink');
  assert(refusal.includes('<ScreenTitle style={styles.title} maxFontSizeMultiplier={REFUSAL_TITLE_MAX_SCALE}>{heading}</ScreenTitle>'), 'a header, at the question\'s cap');
  assert(refusal.includes('export const REFUSAL_TITLE_MAX_SCALE = 1.15;') && landing.includes('export const TAKEOVER_TITLE_MAX_SCALE = 1.15;'), 'the same ceiling as the question');
  assert(refusal.includes('export const REFUSAL_LINE_MAX_SCALE = 2;') && refusal.includes('<Text variant="body" tone="secondary" maxFontSizeMultiplier={REFUSAL_LINE_MAX_SCALE}'), 'the line: body, text2, 2x');
  const disc = refusal.slice(refusal.indexOf('<View testID="refusal-disc"'), refusal.indexOf('</View>', refusal.indexOf('<View testID="refusal-disc"')));
  assert(disc.includes('accessibilityElementsHidden') && disc.includes('importantForAccessibility="no-hide-descendants"') && disc.includes('accessible={false}'), 'a picture only');
  assert(refusal.includes('<AuthScaffold\n      centerBody\n      footer={'), 'the footer is the scaffold\'s');
  const styles = refusal.slice(refusal.indexOf('const styles = StyleSheet.create'));
  assert(/block: \{\s*alignItems: 'center',\s*gap: space\[4\],\s*\}/.test(styles), 'the question\'s block: centred, gap space[4]');
  assert(/actions: \{\s*gap: space\[3\],\s*\}/.test(styles), 'the question\'s docked actions: gap space[3]');
  assertFalse(refusal.includes('Pressable') || refusal.includes('WarnPanel'), 'no hand-built link, no panel');
});

Deno.test('the shared Link is the one the landing used: 44pt, accent or muted, bold headline face, capped at the warn text scale', () => {
  const link = src('components/shell/Link.tsx');
  assert(link.includes('minHeight: 44') && link.includes('accessibilityRole="link"'));
  assert(link.includes('muted ? colors.text2 : colors.accent') && link.includes('maxFontSizeMultiplier={WARN_TEXT_MAX_SCALE}'));
  assert(landing.includes("import { Link } from '@/components/shell/Link';") && !landing.includes('function Link('));
});

// ── The icons ───────────────────────────────────────────────────────────────

Deno.test('icons: every refusal icon is a semantic key in icon.ts, Ionicons outline; none reuses a tab or the filled trophy', () => {
  assertEquals(
    [ICON_GLYPHS.person, ICON_GLYPHS.unlink, ICON_GLYPHS.league, ICON_GLYPHS.clock, ICON_GLYPHS.offline],
    ['person-outline', 'unlink-outline', 'trophy-outline', 'time-outline', 'cloud-offline-outline'],
  );
  // Its own semantic key (the tab bar's `tabLeague` draws the same outline, but a tab's key is the tab's); never the FILLED `trophy`.
  assert('league' in ICON_GLYPHS && ICON_GLYPHS.league !== ICON_GLYPHS.trophy, '"already in" is its own outline key, not the filled trophy');
  assert(mapping.includes("icon: 'league'") && !mapping.includes("'tabLeague'") && !mapping.includes("'trophy'"), 'the mapping names `league`, never a tab key');
  assert(ICON_GLYPHS.clock !== ICON_GLYPHS.pending, 'a wait is a clock, not the hourglass');
  assert(!refusal.includes('Icon name='), 'drawn through the logic table, never a raw glyph');
});

// ── The split ───────────────────────────────────────────────────────────────

Deno.test('splitRefusal: the first ". " splits heading from line; heading + " " + line is the original string, exactly (the four pairs)', () => {
  const pairs: Array<[string, string, string]> = [
    [INVITE_COPY.dead, "This invite link doesn't work anymore.", 'Ask for a new one.'],
    [JOIN_COPY.rateLimited, 'Too many tries.', 'Wait a moment, then try again.'],
    [TRY_LATER, 'Too many tries.', 'Try again later.'],
    [JOIN_COPY.unreachable, "Couldn't reach the league.", 'Check your connection, then try again.'],
  ];
  for (const [text, heading, line] of pairs) {
    const s = splitRefusal(text);
    assertEquals(s, { heading, line });
    assertEquals(`${s.heading} ${s.line}`, text, 'no word changes');
  }
  assertEquals(splitRefusal(TAKEN_LINE), { heading: TAKEN_LINE }, 'one sentence: no line');
  assertEquals(splitRefusal('First. Second. Third.'), { heading: 'First.', line: 'Second. Third.' }, 'the FIRST ". "');
});

// ── The mapping: one test per screen, over the existing strings ──────────────

const SPEC: Array<[string, RefusalState, string, string | undefined, string, string | undefined]> = [
  // [name, state, heading, line, primary label, secondary label]
  ['taken', { kind: 'taken' }, 'Someone already took this team.', undefined, 'Go to Home', undefined],
  ['dead takeover link', { kind: 'dead' }, "This invite link doesn't work anymore.", 'Ask for a new one.', 'Go to Home', undefined],
  ['already in', { kind: 'member', leagueName: 'Stock Scudetto' }, "You're already in Stock\u00a0Scudetto.", undefined, 'Open the league', undefined],
  ['short wait', { kind: 'rate_limited', wait: 'moment' }, 'Too many tries.', 'Wait a moment, then try again.', 'Try again', 'Not now'],
  ['hour wait', { kind: 'rate_limited', wait: 'later' }, 'Too many tries.', 'Try again later.', 'Not now', undefined],
  ['no connection', { kind: 'unknown' }, "Couldn't reach the league.", 'Check your connection, then try again.', 'Try again', 'Not now'],
];
const ICONS: Record<string, string> = { taken: 'person', 'dead takeover link': 'unlink', 'already in': 'league', 'short wait': 'clock', 'hour wait': 'clock', 'no connection': 'offline' };
const ACTION: Record<string, string> = { 'Go to Home': 'home', 'Open the league': 'open', 'Try again': 'retry', 'Not now': 'notNow' };

for (const [name, state, heading, line, primary, secondary] of SPEC) {
  Deno.test(`mapping, ${name}: ${ICONS[name]} icon, heading, ${line ? 'line, ' : 'no line, '}primary "${primary}"${secondary ? ', secondary "Not now"' : ', no secondary'}`, () => {
    const s = takeoverRefusal(state);
    assertEquals(s.icon, ICONS[name]);
    assertEquals(s.heading, heading);
    assertEquals(s.line, line);
    assertEquals(s.primary, { label: primary, action: ACTION[primary] });
    assertEquals(s.secondary, secondary ? { label: 'Not now', action: 'notNow' } : undefined);
  });
}

Deno.test('mapping: the words are the shipped constants, never retyped', () => {
  assertEquals([GO_TO_HOME, OPEN_THE_LEAGUE, NOT_NOW], ['Go to Home', 'Open the league', 'Not now']);
  assertEquals(ARRIVAL_COPY.tryAgain, 'Try again');
  for (const name of ['TAKEN_LINE', 'GO_TO_HOME', 'OPEN_THE_LEAGUE', 'NOT_NOW', 'TRY_LATER', 'JOIN_COPY.rateLimited', 'JOIN_COPY.unreachable', 'INVITE_COPY.dead', 'MONEY_COPY.tryAgain']) {
    assert(mapping.includes(name), name);
  }
  assertFalse(/["'`](Someone already|Go to Home|Open the league|Too many|Couldn't reach|Try again|Not now)/.test(mapping), 'no string literal of these words in the mapping');
});

Deno.test('mapping: the hour\'s lockout has no Try again anywhere (it would fail for an hour)', () => {
  const s = takeoverRefusal({ kind: 'rate_limited', wait: 'later' });
  assertEquals([s.primary.action, s.secondary], ['notNow', undefined]);
  // an unknown wait is the longer line, never understated
  assertEquals(interpretTakeoverPreview({ transport: false, reason: 'rate_limited', body: {} } as never), { kind: 'rate_limited', wait: 'later' });
});

Deno.test('already in: a name with ". " in it is never split; no name never shows an empty or "null" one (the app just opens Home)', () => {
  const s = takeoverRefusal({ kind: 'member', leagueName: 'St. Louis Traders' });
  assertEquals([s.heading, s.line], ["You're already in St.\u00a0Louis\u00a0Traders.", undefined]);
  // a reply with no league name is a member with a null name; the container opens Home instead of drawing a screen
  const v = interpretTakeoverPreview({ transport: false, reason: 'already_member', body: {} } as never);
  assertEquals(v, { kind: 'member', leagueName: null, leagueId: null });
  const screen = src('app/takeover.tsx');
  const silent = screen.slice(screen.indexOf('if (v.kind === \'member\') {'), screen.indexOf("if (v.kind === 'taken' || v.kind === 'dead')"));
  assert(silent.includes('if (v.leagueName) {') && silent.includes('if (code) await pendingTakeover.clear(code);') && silent.includes("router.replace('/(tabs)');"));
  assertFalse(refusal.includes('null') && /leagueName/.test(refusal), 'RefusalScreen knows no league name');
});

// ── The wiring ──────────────────────────────────────────────────────────────

Deno.test('landing: every dead end is a RefusalScreen bound to the container\'s handlers; the take-failed panel is left alone', () => {
  const branch = landing.slice(landing.indexOf("if (state.kind === 'taken'"), landing.indexOf("if (state.kind === 'tap')"));
  assert(branch.includes("state.kind === 'taken' || state.kind === 'dead' || state.kind === 'member' || state.kind === 'unknown' || state.kind === 'rate_limited'"));
  assert(branch.includes('const spec = takeoverRefusal(state);'));
  assert(branch.includes('const run = { home: onHome, open: onOpen, retry: onRetry, notNow: onNotNow };'));
  assert(branch.includes('<RefusalScreen') && branch.includes('onPress: run[spec.primary.action]') && branch.includes('run[spec.secondary.action]'));
  assertFalse(branch.includes('WarnPanel') || branch.includes('<Link') || branch.includes('<AuthScaffold'), 'no panel, no text link, no one-off frame');
  // the take-failed panel above "Take the team" is NOT in this family
  assert(landing.includes('{takeFailed ? <WarnPanel text={takeFailed === \'unreachable\' ? JOIN_COPY.unreachable : waitLine(takeFailed)} /> : null}'));
  assert(landing.includes('<Button label={TAKE_THE_TEAM}'));
});

Deno.test('invite arrival: ONLY the dead link is a RefusalScreen (broken link, split heading + line, Sign in to /login); full and closed keep their panel', () => {
  const dead = arrival.slice(arrival.indexOf('if (!view.title && view.refusal === INVITE_COPY.dead) {'), arrival.indexOf('return (', arrival.indexOf('if (!view.title && view.refusal === INVITE_COPY.dead) {') + 40));
  assert(dead.includes('const words = splitRefusal(INVITE_COPY.dead);'));
  assert(dead.includes('<RefusalScreen icon="unlink" heading={words.heading} line={words.line} primary={{ label: ARRIVAL_COPY.signIn, onPress: () => router.push(\'/login\') }} />'));
  assertEquals(ARRIVAL_COPY.signIn, 'Sign in');
  assertEquals(arrival.split('<RefusalScreen').length - 1, 1, 'one dead end on the arrival');
  assert(arrival.includes('{view.refusal ? <WarnPanel text={view.refusal} /> : null}'), 'full / not taking players keep the panel above Sign in');
});

Deno.test('already in: the league NAME is one piece (keepName) so it wraps as a whole; the sentence around it keeps its breakable spaces', () => {
  const s = takeoverRefusal({ kind: 'member', leagueName: 'Stock Scudetto' });
  assertEquals(s.heading, `You're already in ${keepName('Stock Scudetto')}.`);
  assert(s.heading.includes('Stock\u00a0Scudetto'), 'no break inside the name');
  assert(s.heading.startsWith("You're already in "), 'the words around the name still break at ordinary spaces');
  assertEquals(s.heading.replaceAll('\u00a0', ' '), "You're already in Stock Scudetto.", 'the words are unchanged: only the spaces inside the name differ');
  assertEquals(s.heading.split('\u00a0').length - 1, 1, 'only the name carries the no-break space');
  // a long name keeps its spaces breakable (keepName), so it can still wrap between words instead of mid-word
  const long = takeoverRefusal({ kind: 'member', leagueName: 'The Very Long Stock League Of Friends' });
  assertFalse(long.heading.includes('\u00a0'));
  assert(mapping.includes('name: keepName(state.leagueName)') && mapping.includes("import { keepName } from './keepName';"));
});
