/**
 * auth-fields-above-keyboard (2026-11-06, Giorgio's recording of 1.3.0 (11)): on Create account with the keyboard up on Email,
 * the Password field was out of sight, so the form read as email-only. AuthScaffold now scrolls a focused field to the top of
 * the window above its docked footer, so the next field (and its rules) sit under it.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  BOTTOM_BREATHING, BOX_BORDER, LABEL_GAP, LABEL_LINE_HEIGHT, TOP_BREATHING, fieldRevealOffset, footerSecondaryShown, keyboardUpAfter, labelReach, stepReveal,
  type RevealEvent,
} from '../components/shell/authFieldReveal.ts';
import { SOURCES } from './sourceManifest.generated.ts';

/** Drive the state machine through events, returning the events that asked for a scroll. */
function run(events: RevealEvent[]): { asked: RevealEvent[]; focused: boolean } {
  let focused = false;
  const asked: RevealEvent[] = [];
  for (const e of events) {
    const s = stepReveal(focused, e);
    focused = s.focused;
    if (s.reveal) asked.push(e);
  }
  return { asked, focused };
}

Deno.test('a focus always asks for a scroll to the field (including Email -> Password with the keyboard staying up)', () => {
  assertEquals(run(['focus']).asked, ['focus']);
  assertEquals(run(['focus', 'focus']).asked, ['focus', 'focus']);
});

Deno.test('the keyboard resizing the scroll view re-scrolls ONLY while a field is focused', () => {
  // Focus lands first (window still full height, content cannot scroll yet), then the keyboard shrinks the window.
  assertEquals(run(['focus', 'layout', 'keyboard']).asked, ['focus', 'layout', 'keyboard']);
  // No field: a layout change (rotation, a banner) or a keyboard event must not move the screen.
  assertEquals(run(['layout', 'keyboard']).asked, []);
});

Deno.test('after a blur nothing scrolls until the next focus', () => {
  const r = run(['focus', 'blur', 'layout', 'keyboard']);
  assertEquals(r.asked, ['focus']);
  assertEquals(r.focused, false);
  assertEquals(run(['focus', 'blur', 'focus', 'layout']).asked, ['focus', 'focus', 'layout']);
});

Deno.test('a blur never asks for a scroll', () => {
  assertEquals(stepReveal(true, 'blur'), { focused: false, reveal: false });
  assertEquals(stepReveal(false, 'blur'), { focused: false, reveal: false });
});

Deno.test('the field geometry matches Field.tsx: callout line 18, label gap 6, 2pt border, 4pt above the label, 6pt under the box', () => {
  // Literals on purpose: the formula tests below import these constants, so only these pin their values.
  assertEquals([LABEL_LINE_HEIGHT, LABEL_GAP, BOX_BORDER, TOP_BREATHING, BOTTOM_BREATHING], [18, 6, 2, 4, 6]);
  assertEquals(labelReach(1), 26);
  assertEquals(labelReach(3), 62);
});

Deno.test('labelReach: the label line scales with the system text size; the gap and border do not', () => {
  assertEquals(labelReach(1), LABEL_LINE_HEIGHT + LABEL_GAP + 2);
  assertEquals(labelReach(3), LABEL_LINE_HEIGHT * 3 + LABEL_GAP + 2);
  assert(labelReach(3.1) > labelReach(3));
  // A nonsense scale (0, NaN) is read as 1, never as a collapsed label.
  assertEquals(labelReach(0), labelReach(1));
  assertEquals(labelReach(NaN), labelReach(1));
});

Deno.test('fieldRevealOffset: the label lands just under the top edge, so what fits below (next field, rules) is in the window', () => {
  // Create account at the default size: the Email box starts ~ y 310 in the content; the window (keyboard up) is ~ 300 tall.
  const input = { inputTop: 310, inputHeight: 50, viewportHeight: 300, fontScale: 1 };
  assertEquals(fieldRevealOffset(input), 280); // 310 - 26 (label) - 4
  // The Password box (below Email) then sits inside the window too.
  const off = fieldRevealOffset(input);
  const passwordBoxBottom = 310 + 50 + 20 + 18 + 6 + 2 + 50; // email box + gap + password label + gap + border + box
  assert(passwordBoxBottom - off <= input.viewportHeight, `password box bottom ${passwordBoxBottom - off} must be inside ${input.viewportHeight}`);
});

Deno.test('fieldRevealOffset: never negative (a field near the top leaves the content where it is)', () => {
  assertEquals(fieldRevealOffset({ inputTop: 20, inputHeight: 50, viewportHeight: 600, fontScale: 1 }), 0);
  assertEquals(fieldRevealOffset({ inputTop: 0, inputHeight: 50, viewportHeight: 600, fontScale: 1 }), 0);
});

Deno.test('fieldRevealOffset: where the window is too short for label + box, the box stays in and the label gives way', () => {
  // The largest accessibility size: a tall label (scale 3.1), a tall box, a short window.
  const input = { inputTop: 700, inputHeight: 150, viewportHeight: 200, fontScale: 3.1 };
  const off = fieldRevealOffset(input);
  const labelAtTop = 700 - labelReach(3.1) - TOP_BREATHING;
  assert(off > labelAtTop, 'the offset moves further than label-at-top');
  // The input's bottom edge is inside the window (with its breathing room), and its top still is too.
  assertEquals(input.inputTop + input.inputHeight - off, input.viewportHeight - BOTTOM_BREATHING);
  assert(input.inputTop - off >= 0);
});

Deno.test('fieldRevealOffset: a window that cannot hold even the box still shows its bottom edge (the typed line)', () => {
  const off = fieldRevealOffset({ inputTop: 500, inputHeight: 150, viewportHeight: 120, fontScale: 1 });
  assertEquals(off, 536); // 500 + 150 + 6 - 120
});

// ---- wiring: the pure rules are worth nothing if the scaffold does not use them -----------------------------------------------

const scaffold = SOURCES['components/shell/AuthScaffold.tsx'];

Deno.test('AuthScaffold feeds a bubbled field focus / blur through stepReveal and scrolls with fieldRevealOffset', () => {
  assert(scaffold.includes("from '@/components/shell/authFieldReveal'"));
  assert(scaffold.includes('stepReveal('));
  assert(scaffold.includes('fieldRevealOffset('));
  // The ScrollView hears its descendants' focus and blur (they bubble), so no Field prop is involved.
  assert(/<ScrollView[\s\S]*?onFocus=\{/.test(scaffold));
  assert(/<ScrollView[\s\S]*?onBlur=\{/.test(scaffold));
});

Deno.test('AuthScaffold re-scrolls when the keyboard resizes the scroll view (layout) and on the keyboard events', () => {
  assert(/<ScrollView[\s\S]*?onLayout=\{/.test(scaffold));
  assert(scaffold.includes("Keyboard.addListener('keyboardDidShow'"));
  assert(scaffold.includes("Keyboard.addListener('keyboardDidChangeFrame'"));
});

Deno.test('the layout handler records the window height AND asks stepReveal for a re-scroll (the keyboard just resized it)', () => {
  const onLayout = scaffold.slice(scaffold.indexOf('onLayout={'), scaffold.indexOf('style={styles.fill}', scaffold.indexOf('onLayout={')));
  assert(onLayout.includes('viewportHeight.current = e.nativeEvent.layout.height;'));
  assert(onLayout.includes("step('layout');"));
});

Deno.test('AuthScaffold still hands its ScrollView to a caller (delete-account scrolls it to the end)', () => {
  assert(scaffold.includes('forwardRef<ScrollView'));
  // The scaffold keeps its own handle AND forwards the node to the caller's ref (a function ref or an object ref).
  assert(scaffold.includes('ref={setScroll}'));
  const setScroll = scaffold.slice(scaffold.indexOf('const setScroll = '), scaffold.indexOf('const inField = '));
  assert(setScroll.includes('scrollRef.current = node;'));
  assert(setScroll.includes("typeof ref === 'function'") && setScroll.includes('ref(node)') && setScroll.includes('ref.current = node'));
  assert(SOURCES['app/delete-account.tsx'].includes('<AuthScaffold ref={scrollRef}'));
});

Deno.test('the screens\' Field props are untouched by this fix: the scaffold alone owns the scrolling', () => {
  // A field must not need to know about the scroll view (the password-eye work edits the same Field lines).
  for (const f of ['app/create-account.tsx', 'app/login.tsx', 'app/forgot-password.tsx', 'components/shell/NewPasswordForm.tsx']) {
    assert(!SOURCES[f].includes('authFieldReveal'), f);
    assert(!SOURCES[f].includes('scrollReveal'), f);
  }
});


// ---- the footer's secondary line goes while the keyboard is up (Design Lead gate on #345: Create account failed at AX5) ---------

Deno.test('the keyboard is up after a show and down after a hide', () => {
  assertEquals(keyboardUpAfter('show'), true);
  assertEquals(keyboardUpAfter('hide'), false);
});

Deno.test('the footer\'s secondary line shows with the keyboard down and goes while it is up', () => {
  assertEquals(footerSecondaryShown(false), true);
  assertEquals(footerSecondaryShown(true), false);
  // The whole cycle: down -> up -> down.
  assertEquals([false, keyboardUpAfter('show'), keyboardUpAfter('hide')].map(footerSecondaryShown), [true, false, true]);
});

Deno.test('AuthScaffold docks footerSecondary UNDER the footer and gates it on the keyboard', () => {
  assert(scaffold.includes('footerSecondary?: ReactNode;'));
  assert(scaffold.includes('function AuthScaffold({ children, footer, footerSecondary, back, centerBody }, ref)'));
  const dock = scaffold.slice(scaffold.indexOf('{footer ? ('), scaffold.indexOf('</KeyboardAvoidingView>'));
  // Primary first, then the secondary only when the keyboard is down; both inside the one docked footer View.
  assert(dock.indexOf('{footer}') !== -1 && dock.indexOf('{footer}') < dock.indexOf('footerSecondaryShown(keyboardUp) ? footerSecondary : null'));
  assert(dock.includes('styles.footer'));
});

Deno.test('the keyboard state comes from the WILL events on iOS (the line is gone before the keyboard has finished rising)', () => {
  assert(scaffold.includes("ios ? 'keyboardWillShow' : 'keyboardDidShow'"));
  assert(scaffold.includes("ios ? 'keyboardWillHide' : 'keyboardDidHide'"));
  assert(scaffold.includes("setKeyboardUp(keyboardUpAfter('show'))"));
  assert(scaffold.includes("setKeyboardUp(keyboardUpAfter('hide'))"));
  assert(scaffold.includes("const ios = Platform.OS === 'ios';"));
});

Deno.test('the footer shrinking resizes the scroll view, whose onLayout re-scrolls to the focused field', () => {
  // The window grows when the secondary line goes (and shrinks when it returns): the layout handler is what re-reveals.
  assert(scaffold.includes("step('layout');"));
});

Deno.test('Create account puts "Already have an account? Sign in" in footerSecondary, not in the footer', () => {
  const src = SOURCES['app/create-account.tsx'];
  assert(src.includes('footerSecondary={footerSecondary}'));
  assert(src.includes('footer={footer}'));
  const noComments = (t: string) => t.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const footerDecl = noComments(src.slice(src.indexOf('const footer = '), src.indexOf('const footerSecondary = ')));
  assert(footerDecl.includes('label="Create account"') && footerDecl.includes('label="Sign in instead"'));
  assert(!footerDecl.includes('Already have an account?'));
  const secondaryDecl = src.slice(src.indexOf('const footerSecondary = '), src.indexOf('if (sentTo)'));
  assert(secondaryDecl.includes('Already have an account?'));
  assert(secondaryDecl.includes("router.replace('/login')"));
  // Signups paused: the footer is "Sign in instead" alone; there is no second line to hide or show.
  assert(secondaryDecl.includes('paused ? null'));
});

Deno.test('the password rules checklist is capped at 1.3x, the same as row text, glyph and label alike', () => {
  const field = SOURCES['components/shell/Field.tsx'];
  assert(field.includes('export const RULES_MAX_SCALE = 1.3;'));
  const rules = field.slice(field.indexOf('{rules.map('), field.indexOf('</View>\n      ) : null}', field.indexOf('{rules.map(')));
  assertEquals((rules.match(/maxFontSizeMultiplier=\{RULES_MAX_SCALE\}/g) ?? []).length, 2);
  assert(rules.includes("{rule.ok ? '✓' : '○'}") && rules.includes('{rule.label}'));
});
