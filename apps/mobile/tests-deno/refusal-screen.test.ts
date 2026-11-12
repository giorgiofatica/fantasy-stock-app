/**
 * The takeover's "already taken" screen is built like the takeover QUESTION (PRODUCT_RULES, 2026-11-12, Giorgio's pick A), through
 * one shared frame, RefusalScreen, so the rest of the dead-link family is only wiring: a 64pt neutral disc with a drawn icon, the
 * sentence as the heading, an optional line, a docked full-width pill, an optional muted "Not now", all in the AuthScaffold footer.
 *
 *   cd apps/mobile/tests-deno && deno test refusal-screen.test.ts
 */
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';
import { GO_TO_HOME, NOT_NOW, TAKEN_LINE } from '../lib/account/deleteCopy.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const src = (p: string) => strip(SOURCES[p]);
const landing = src('components/shell/TakeoverLanding.tsx');
const refusal = src('components/shell/RefusalScreen.tsx');

/** The 'taken' branch of the landing: from its `if` to the next branch. */
const takenBranch = landing.slice(landing.indexOf("if (state.kind === 'taken')"), landing.indexOf("if (state.kind === 'dead')"));

Deno.test('taken view: RefusalScreen with the person icon, the sentence as the HEADING and "Go to Home" as the docked primary', () => {
  assert(takenBranch.length > 0 && takenBranch.length < 400, 'the branch was found and is one return');
  assert(takenBranch.includes('<RefusalScreen icon="person" heading={deadLine(state)} primary={{ label: GO_TO_HOME, onPress: onHome }} />'));
  assertEquals([TAKEN_LINE, GO_TO_HOME], ['Someone already took this team.', 'Go to Home'], 'the words are unchanged');
  assert(src('lib/account/takeoverView.ts').includes("v.kind === 'taken' ? TAKEN_LINE : INVITE_COPY.dead"), 'the heading is the taken sentence');
});

Deno.test('taken view: no WarnPanel and no text link (Link is not the primary)', () => {
  assertFalse(takenBranch.includes('WarnPanel'));
  assertFalse(takenBranch.includes('<Link'));
  assertFalse(takenBranch.includes('<AuthScaffold'), 'the frame is RefusalScreen\'s, not a one-off');
});

Deno.test('the other refusal views are untouched: dead keeps the panel and the link, member / unknown / rate_limited keep theirs', () => {
  const dead = landing.slice(landing.indexOf("if (state.kind === 'dead')"), landing.indexOf("if (state.kind === 'member')"));
  assert(dead.includes('<WarnPanel text={deadLine(state)} />') && dead.includes('<Link label={GO_TO_HOME} onPress={onHome} />'));
  assertFalse(dead.includes('RefusalScreen'));
  const rest = landing.slice(landing.indexOf("if (state.kind === 'member')"));
  assertFalse(rest.includes('RefusalScreen'));
  assert(rest.includes('<Link label={OPEN_THE_LEAGUE} onPress={onOpen} />') && rest.includes('<Link label={NOT_NOW} onPress={onNotNow} muted />'));
});

Deno.test('RefusalScreen: props are icon, heading, optional line, primary, optional secondary', () => {
  const props = refusal.slice(refusal.indexOf('export interface RefusalScreenProps'), refusal.indexOf('export function RefusalScreen('));
  assert(/icon: IconName;/.test(props));
  assert(/heading: string;/.test(props));
  assert(/line\?: string;/.test(props), 'the line is optional');
  assert(/primary: \{ label: string; onPress: \(\) => void \};/.test(props));
  assert(/secondary\?: \{ label: string; onPress: \(\) => void \};/.test(props), 'the secondary is optional');
});

Deno.test('RefusalScreen: the line renders only when given, the "Not now" only when given, both muted-secondary and under the pill', () => {
  assert(refusal.includes('{line ? ('), 'no line prop, no line');
  assert(refusal.includes('{line}</Text>'));
  assert(refusal.includes('{secondary ? <Link label={secondary.label} onPress={secondary.onPress} muted /> : null}'), 'no secondary prop, no link; it is the muted Not-now link');
  const footer = refusal.slice(refusal.indexOf('footer={'), refusal.indexOf('>\n      <View style={styles.block}>'));
  assert(footer.indexOf('<Button') > 0 && footer.indexOf('<Button') < footer.indexOf('<Link'), 'the pill, then the Not now under it');
  assert(footer.includes('<Button label={primary.label} onPress={primary.onPress} fullWidth />'), 'a full-width pill, docked in the footer');
  assertEquals(NOT_NOW, 'Not now');
});

Deno.test('RefusalScreen: built like the question screen: 64pt neutral disc, the glyph at the avatar\'s 0.58, ScreenTitle capped at 1.15, block gap 4, centred body', () => {
  const q = landing.slice(landing.indexOf("const found = state.kind === 'found'"));
  assert(q.includes('<Avatar name={label} size={DISC} tone="neutral" />') && landing.includes('const DISC = 64;'));
  assert(refusal.includes('export const REFUSAL_DISC = 64;'));
  assert(refusal.includes("backgroundColor: colors.inset"), 'the neutral Avatar\'s fill');
  assert(refusal.includes('Math.round(REFUSAL_DISC * DELETED_GLYPH_RATIO)') && src('components/sp/Avatar.tsx').includes('export const DELETED_GLYPH_RATIO = 0.58;'));
  assert(refusal.includes('color={colors.text2}'), 'the glyph ink of the person disc');
  assert(refusal.includes('<ScreenTitle style={styles.title} maxFontSizeMultiplier={REFUSAL_TITLE_MAX_SCALE}>{heading}</ScreenTitle>'));
  assert(refusal.includes('export const REFUSAL_TITLE_MAX_SCALE = 1.15;') && landing.includes('export const TAKEOVER_TITLE_MAX_SCALE = 1.15;'), 'the same ceiling as the question');
  assert(refusal.includes('<AuthScaffold\n      centerBody\n      footer={'), 'the footer is the scaffold\'s');
  const styles = refusal.slice(refusal.indexOf('const styles = StyleSheet.create'));
  assert(/block: \{\s*alignItems: 'center',\s*gap: space\[4\],\s*\}/.test(styles), 'the question\'s block: centred, gap space[4]');
  assert(/actions: \{\s*gap: space\[3\],\s*\}/.test(styles), 'the question\'s docked actions: gap space[3]');
  assertFalse(refusal.includes('Pressable'), 'no hand-built link');
});

Deno.test('the shared Link is the one the landing used: 44pt, accent or muted, bold headline face, capped at the warn text scale', () => {
  const link = src('components/shell/Link.tsx');
  assert(link.includes('minHeight: 44') && link.includes('accessibilityRole="link"'));
  assert(link.includes('muted ? colors.text2 : colors.accent') && link.includes('maxFontSizeMultiplier={WARN_TEXT_MAX_SCALE}'));
  assert(landing.includes("import { Link } from '@/components/shell/Link';") && !landing.includes('function Link('));
});
