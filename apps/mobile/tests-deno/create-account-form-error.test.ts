/**
 * Create account's errors (build 13, Giorgio's recording of 1.3.0 (12), 2026-11-09): "Too many attempts" drew under the PASSWORD field with a red
 * border, as if the password were wrong. An error about no field is now the form's own message, docked above the primary button, with no red
 * border on any field; field errors stay on their field. Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { fromAuthError, missingFields, NO_FORM_ERROR_VIEW, viewOf, weakPasswordLocal } from '../lib/auth/formError.ts';
import { NO_SIGNUP_CAPTURE, parseSignupCapture, PREFILL_EMAIL } from '../lib/auth/signupCapture.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const RULE = 'Use at least 8 characters, with an uppercase letter, a lowercase letter, a number, and a symbol.';

Deno.test('no error: nothing on any field, no form message', () => {
  assertEquals(viewOf(null), NO_FORM_ERROR_VIEW);
});

Deno.test('the email-send cap is the FORM\'s message: no field error, no red border anywhere', () => {
  const v = viewOf(fromAuthError({ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }, RULE, 'Stockpile'));
  assertEquals(v.formMessage, "We can't send another email right now. Try again later.");
  assertEquals([v.emailError, v.passwordError, v.emailInvalid, v.passwordInvalid], [null, null, false, false]);
});

Deno.test('every non-field error is the form\'s: request cap, network, generic, signups paused', () => {
  for (const e of [{ code: 'over_request_rate_limit', message: 'x' }, { message: 'Network request failed' }, { message: 'boom' }, { message: 'Signups not open for new signups' }]) {
    const v = viewOf(fromAuthError(e, RULE, 'Stockpile'));
    assert(v.formMessage && v.formMessage.length > 0, JSON.stringify(e));
    assertEquals([v.emailError, v.passwordError, v.emailInvalid, v.passwordInvalid], [null, null, false, false], JSON.stringify(e));
  }
});

Deno.test('a weak password stays on the Password field (red box + its message), and the form has no message', () => {
  const v = viewOf(fromAuthError({ code: 'weak_password', message: 'x' }, RULE, 'Stockpile'));
  assertEquals(v, { emailError: null, emailInvalid: false, passwordError: RULE, passwordInvalid: true, formMessage: null });
  const local = viewOf(weakPasswordLocal('Your password needs: a number.'));
  assertEquals([local.passwordError, local.passwordInvalid, local.formMessage], ['Your password needs: a number.', true, null]);
});

Deno.test('an invalid email (and an address already taken) stays on the Email field', () => {
  const v = viewOf(fromAuthError({ code: 'email_address_invalid', message: 'x' }, RULE, 'Stockpile'));
  assertEquals(v, { emailError: 'Please enter a valid email address.', emailInvalid: true, passwordError: null, passwordInvalid: false, formMessage: null });
  const taken = viewOf(fromAuthError({ code: 'user_already_exists', message: 'x' }, RULE, 'Stockpile'));
  assertEquals([taken.emailError, taken.emailInvalid, taken.passwordInvalid], ['An account with this email already exists.', true, false]);
});

Deno.test('submitting with a field empty: the form\'s message, and ONLY the empty field(s) are red', () => {
  const noEmail = viewOf(missingFields('', 'Passw0rd!x'));
  assertEquals([noEmail.formMessage, noEmail.emailInvalid, noEmail.passwordInvalid, noEmail.emailError, noEmail.passwordError], ['Please enter email and password', true, false, null, null]);
  const noPassword = viewOf(missingFields('a@b.co', ''));
  assertEquals([noPassword.emailInvalid, noPassword.passwordInvalid], [false, true]);
  const neither = viewOf(missingFields('', ''));
  assertEquals([neither.emailInvalid, neither.passwordInvalid], [true, true]);
});

Deno.test('one message in one place: a state never draws both a field error and a form message', () => {
  for (const s of [fromAuthError({ code: 'weak_password' }, RULE), fromAuthError({ code: 'email_address_invalid' }), fromAuthError({ message: 'x' }), missingFields('', ''), weakPasswordLocal('m')]) {
    const v = viewOf(s);
    const places = [v.emailError, v.passwordError, v.formMessage].filter((x) => x !== null);
    assertEquals(places.length, 1);
  }
});

// ---- wiring --------------------------------------------------------------------------------------------------------------------

const create = SOURCES['app/create-account.tsx'];

Deno.test('Create account draws each error where viewOf says, and nowhere else', () => {
  assert(create.includes("from '@/lib/auth/formError'"));
  // The Password field takes ITS error and its own invalid flag only; the old "any formError is Password's" is gone.
  assert(create.includes('error={errorView.passwordError}') && create.includes('invalid={errorView.passwordInvalid}'));
  assert(create.includes('error={errorView.emailError}') && create.includes('invalid={errorView.emailInvalid}'));
  assert(!create.includes('error={formError}'), 'the whole error must never go to the Password field again');
  assert(!/getAuthErrorMessage\(/.test(create), 'the screen routes through fromAuthError, which owns the message and the target');
});

Deno.test('the form message sits in the SCROLL BODY under the fields, never in the docked footer (at AX5 a docked message took most of the screen)', () => {
  const footer = create.slice(create.indexOf('const footer = '), create.indexOf('const footerSecondary = '));
  assert(!footer.includes('formMessage') && !footer.includes('FieldError'), 'the footer is the primary button alone');
  const body = create.slice(create.indexOf('<AuthScaffold'));
  const fields = body.indexOf('<View style={styles.fields}>');
  const message = body.indexOf('errorView.formMessage ? <FieldError>{errorView.formMessage}</FieldError> : null');
  assert(fields > -1 && message > body.indexOf('</View>', body.indexOf('rules={passwordRules}')), 'after the fields block');
  assert(message < body.indexOf('<WarnPanel'), 'and before the signups-paused panel');
});

Deno.test('the message is scrolled into view when it appears (the keyboard may be up), a jump under Reduce Motion', () => {
  const effect = create.slice(create.indexOf('const formMessage = errorView.formMessage;'), create.indexOf('// DEV captures only'));
  assert(effect.includes('if (!formMessage) return;'));
  assert(effect.includes('scrollRef.current?.scrollToEnd({ animated: !reduced })'));
  assert(effect.includes('const t = setTimeout(toEnd, 0);'), 'once it has laid out');
  assert(effect.includes("Keyboard.addListener('keyboardDidHide', toEnd)"), 'and again when the keyboard has finished closing (the footer\'s second line is back)');
  assert(effect.includes('clearTimeout(t);') && effect.includes('hidden.remove();'), 'both are cleaned up');
  assert(effect.includes('[formMessage]'));
});

Deno.test('a server refusal and the local checks all go through the state, and typing clears it', () => {
  assert(create.includes('setFormError(missingFields(email, password))'));
  assert(create.includes('setFormError(weakPasswordLocal('));
  assert(create.includes('setFormError(fromAuthError(result.error, PASSWORD_RULE_SENTENCE, brand.name))'));
  assert((create.match(/if \(formError\) setFormError\(null\)/g) ?? []).length >= 2);
});

// ---- the capture knobs (so a state can be shot without hitting the server) -----------------------------------------------------

Deno.test('capture knobs: dead outside a dev build; an unknown kind is ignored, never guessed', () => {
  assertEquals(parseSignupCapture(false, { error: 'email_rate', prefill: '1' }), NO_SIGNUP_CAPTURE);
  assertEquals(parseSignupCapture(true, { error: 'nope' }), { error: null, prefill: false });
  assertEquals(parseSignupCapture(true, { error: 'constructor' }), { error: null, prefill: false });
  assertEquals(parseSignupCapture(true, { error: 'email_rate', prefill: '1' }).error?.code, 'over_email_send_rate_limit');
  assertEquals(parseSignupCapture(true, { prefill: '1' }).prefill, true);
});

Deno.test('capture knobs: the pre-filled values are dummies on a reserved test domain', () => {
  assert(PREFILL_EMAIL.endsWith('.test') || PREFILL_EMAIL.endsWith('example.test'));
  assert(!PREFILL_EMAIL.includes('gmail') && !PREFILL_EMAIL.includes('giorgio'));
});

Deno.test('capture knobs are read in ONE place, under __DEV__, and the screen takes the mocked error instead of the server', () => {
  const dev = SOURCES['lib/shell/captureDev.ts'];
  assert(dev.includes("parseSignupCapture(__DEV__, { error: process.env.EXPO_PUBLIC_SIGNUP_ERROR, prefill: process.env.EXPO_PUBLIC_SIGNUP_PREFILL })"));
  const readers = Object.entries(SOURCES).filter(([f, t]) => /^(app|components|lib)\//.test(f) && t.includes('process.env.EXPO_PUBLIC_SIGNUP_ERROR')).map(([f]) => f);
  assertEquals(readers, ['lib/shell/captureDev.ts']);
  assert(create.includes('SIGNUP_CAPTURE.error ? { error: SIGNUP_CAPTURE.error, needsConfirmation: false } : await signUp(email.trim(), password)'));
});
