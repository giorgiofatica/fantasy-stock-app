/**
 * Design Lead ruling 2026-11-09 on the form-level message (R5): it stays in the scroll body under the fields, and
 *  (a) it is part of the reveal: when it appears while a field is focused the minimum scroll includes the message, so it clears the docked button the
 *      way the rules do (with no field focused the page goes to it, and again once the keyboard has closed);
 *  (b) it is capped at 1.6x (CARD_LINE_MAX_SCALE): at AX5 the uncapped rate-limit message ran five huge lines and pushed the form off the screen.
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { revealOffset } from '../components/shell/authFieldReveal.ts';
import { BOTTOM_BREATHING } from '../components/shell/authFieldReveal.ts';
import { CARD_LINE_MAX_SCALE } from '../lib/game/draftClockCard.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const msg = SOURCES['components/shell/FormMessage.tsx'];
const scaffold = SOURCES['components/shell/AuthScaffold.tsx'];

Deno.test('the cap is the card-line cap, 1.6x, from the one constant', () => {
  assertEquals(CARD_LINE_MAX_SCALE, 1.6);
  assert(msg.includes("import { CARD_LINE_MAX_SCALE } from '@/lib/game/draftClockCard';"));
  assert(msg.includes('export const FORM_MESSAGE_MAX_SCALE = CARD_LINE_MAX_SCALE;'));
  assert(msg.includes('maxFontSizeMultiplier={FORM_MESSAGE_MAX_SCALE}'));
});

Deno.test('every auth screen draws its form message through FormMessage (no uncapped FieldError for a form-level line)', () => {
  for (const f of ['app/create-account.tsx', 'app/login.tsx', 'app/forgot-password.tsx', 'components/shell/NewPasswordForm.tsx']) {
    const s = SOURCES[f];
    assert(/<FormMessage[ >]/.test(s), f);
    assert(!/FieldError>\{(errorView\.)?formMessage/.test(s), `${f} still draws its form message with FieldError`);
  }
});

Deno.test('FormMessage tells the scaffold where it is and when it appears, and un-registers when it goes', () => {
  assert(msg.includes('const tail = useContext(RevealTailContext);'));
  assert(msg.includes('tail.register(box.current);') && msg.includes('tail.appeared();'));
  assert(msg.includes('return () => tail.register(null);'));
  assert(msg.includes('}, [tail, children]);'), 'a changed message is a new appearance');
  assert(msg.includes('<View ref={box} collapsable={false}>'));
});

Deno.test('the scaffold counts the message in the focused field\'s reveal: the block\'s bottom becomes the message\'s bottom', () => {
  assert(scaffold.includes('const tailView = useRef<View | null>(null);'));
  assert(scaffold.includes('tail.measureLayout(inner as never, (_tx, tailTop, _tw, tailHeight) => place(top, Math.max(bottom, tailTop + tailHeight)), () => place(top, bottom));'));
  assert(scaffold.includes('const tail = tailView.current;\n          if (!tail) return place(top, bottom);'), 'no message: the block as it was');
  assert(scaffold.includes('withTail(blockTop, blockTop + blockHeight)'));
  assert(scaffold.includes('<RevealTailContext.Provider value={tail}>{children}</RevealTailContext.Provider>'));
});

Deno.test('on appearing: a focused field re-reveals (the minimum, now including the message), no field -> the page goes to the message', () => {
  const appeared = scaffold.slice(scaffold.indexOf('appeared: () => {'), scaffold.indexOf('[revealFocused],', scaffold.indexOf('appeared: () => {')));
  assert(appeared.includes('if (inField.current) revealFocused();'));
  assert(appeared.includes('scrollToEnd({ animated: !reducedRef.current })'));
  assert(appeared.includes('restOffset.current = null;') && appeared.includes('returning.current = false;'), 'the remembered rest no longer describes the page');
});

Deno.test('once the keyboard has closed, a showing message keeps the page at its end (the footer\'s second line is back)', () => {
  const hide = scaffold.slice(scaffold.indexOf("Keyboard.addListener('keyboardDidHide'"), scaffold.indexOf('];', scaffold.indexOf("Keyboard.addListener('keyboardDidHide'")));
  assert(hide.includes('if (tailView.current)') && hide.includes('scrollToEnd({ animated: !reducedRef.current })'));
});

// The rule itself: a block that now ends at the message needs more scroll, never less, than the same field without it.
Deno.test('revealOffset with the message in the block scrolls at least as far as without it, and the focused box still wins at AX5', () => {
  const base = { current: 0, blockTop: 303, blockBottom: 424, inputTop: 318, inputBottom: 368, viewportHeight: 386, contentHeight: 900 };
  const without = revealOffset(base);
  const withMessage = revealOffset({ ...base, blockBottom: 424 + 24 + 40 }); // 24 gap + a two-line message
  assert(withMessage >= without);
  assertEquals(withMessage, 424 + 64 + BOTTOM_BREATHING - 386, 'the message just clears the footer');
  // A window too short for the field and its message: the rules and the message give way, the box stays fully visible.
  const ax5 = { current: 0, blockTop: 600, inputTop: 660, inputBottom: 810, blockBottom: 1300, viewportHeight: 200, contentHeight: 2400 };
  const y = revealOffset(ax5);
  assert(ax5.inputTop - y >= 0 && ax5.inputBottom - y <= ax5.viewportHeight);
});
