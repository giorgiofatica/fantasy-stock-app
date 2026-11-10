/**
 * R5 of docs/plans/2026-11-09-auth-screen-layout.md (Planner, from Giorgio's build-12 recordings): an error sits where its cause is. A password problem
 * stays under Password; an email problem under Email; anything else (the email send limit, a request limit, the network, a refusal) is the form's own
 * message with NO red border on any field. Create account, Sign in, Forgot password and the new-password form (Reset / Change) all route through
 * lib/authErrors.ts getAuthError + lib/auth/formError.ts. Delete account already does (wrong password on the field, the rest in a WarnPanel).
 * Run: `cd apps/mobile/tests-deno && deno test .`
 */
import { assert, assertEquals } from 'jsr:@std/assert';
import { getAuthError, REQUEST_RATE_LIMIT_MESSAGE, EMAIL_RATE_LIMIT_MESSAGE, type AuthErrorTarget } from '../lib/authErrors.ts';
import { fromAuthError, localError, viewOf } from '../lib/auth/formError.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const RULE = 'Use at least 8 characters, with an uppercase letter, a lowercase letter, a number, and a symbol.';

// The placement table: every error the mapper can name, and where it goes.
const TABLE: Array<[string, unknown, AuthErrorTarget]> = [
  ['invalid credentials (a wrong password)', { code: 'invalid_credentials', message: 'Invalid login credentials' }, 'password'],
  ['weak password', { code: 'weak_password', message: 'x' }, 'password'],
  ['same password', { code: 'same_password', message: 'x' }, 'password'],
  ['invalid email', { code: 'email_address_invalid', message: 'x' }, 'email'],
  ['already registered', { code: 'user_already_exists', message: 'x' }, 'email'],
  ['email not confirmed', { code: 'email_not_confirmed', message: 'Email not confirmed' }, 'form'],
  ['email send cap', { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }, 'form'],
  ['per-address interval', { code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 60 seconds.' }, 'form'],
  ['request cap', { code: 'over_request_rate_limit', message: 'x' }, 'form'],
  ['signups paused', { message: 'Signups not open for new signups' }, 'form'],
  ['network', { message: 'Network request failed' }, 'form'],
  ['unmapped', { message: 'boom' }, 'form'],
];

Deno.test('placement table: every mapped error goes where its cause is', () => {
  for (const [name, e, target] of TABLE) assertEquals(getAuthError(e, RULE, 'Stockpile').target, target, name);
});

Deno.test('getAuthError returns the message the old mapper returned (the words did not move)', () => {
  assertEquals(getAuthError({ code: 'over_request_rate_limit' }).message, REQUEST_RATE_LIMIT_MESSAGE);
  assertEquals(getAuthError({ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }).message, EMAIL_RATE_LIMIT_MESSAGE);
  assertEquals(getAuthError({ code: 'invalid_credentials' }).message, 'Invalid email or password. Please try again.');
});

Deno.test('Sign in: a wrong password still marks Password (red box + its message), and the form has no message', () => {
  const v = viewOf(fromAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' }, RULE, 'Stockpile'));
  assertEquals(v, { emailError: null, emailInvalid: false, passwordError: 'Invalid email or password. Please try again.', passwordInvalid: true, formMessage: null, formTone: 'error' });
});

Deno.test('Sign in: an unconfirmed address, a rate limit and the network are the form\'s message, with no red field', () => {
  for (const e of [{ code: 'email_not_confirmed' }, { code: 'over_request_rate_limit' }, { message: 'Network request failed' }]) {
    const v = viewOf(fromAuthError(e, RULE, 'Stockpile'));
    assert(v.formMessage);
    assertEquals([v.emailInvalid, v.passwordInvalid, v.emailError, v.passwordError], [false, false, null, null], JSON.stringify(e));
  }
});

Deno.test('Forgot password: a bad address is on Email; the resend floor and a server refusal are the form\'s message', () => {
  assertEquals(viewOf(localError('email', 'Please enter a valid email address')).emailError, 'Please enter a valid email address');
  assertEquals(viewOf(localError('email', 'x')).emailInvalid, true);
  const resend = viewOf(fromAuthError({ message: 'For security purposes, you can only request this after 60 seconds.', code: 'over_email_send_rate_limit' }));
  assertEquals([resend.formMessage, resend.emailInvalid], [REQUEST_RATE_LIMIT_MESSAGE, false]);
  const secure = viewOf(localError('form', 'Could not start a secure password reset on this device. Please try again.'));
  assertEquals([secure.formMessage === null, secure.emailInvalid], [false, false]);
});

// ---- wiring -------------------------------------------------------------------------------------------------------------------

const login = SOURCES['app/login.tsx'];
const forgot = SOURCES['app/forgot-password.tsx'];
const form = SOURCES['components/shell/NewPasswordForm.tsx'];

Deno.test('Sign in routes every error through the state and draws each in its own place', () => {
  assert(login.includes("from '@/lib/auth/formError'"));
  assert(login.includes('setError(missingFields(email, password))'));
  assert(login.includes('setError(fromAuthError(authError, PASSWORD_RULE_SENTENCE, brand.name))'));
  assert(login.includes('setError(fromAuthError(resendError, PASSWORD_RULE_SENTENCE, brand.name))'));
  assert(login.includes('error={errorView.passwordError}') && login.includes('invalid={errorView.passwordInvalid}'));
  assert(login.includes('error={errorView.emailError}') && login.includes('invalid={errorView.emailInvalid}'));
  assert(login.includes('{errorView.formMessage ? <FormMessage tone={errorView.formTone}>{errorView.formMessage}</FormMessage> : null}'));
  assert(!login.includes('error={error}'), 'the whole error never goes to the Password field again');
  assert(!/getAuthErrorMessage\(/.test(login));
});

Deno.test('Sign in: the "Send again" link stays with the form\'s message (it belongs to the unconfirmed notice)', () => {
  const body = login.slice(login.indexOf('{errorView.formMessage ?'));
  assert(body.indexOf('{unconfirmed ? (') > -1 && body.indexOf('{unconfirmed ? (') < body.indexOf('Forgot password?'));
});

Deno.test('Forgot password routes through the state: Email for an address problem, the form\'s message otherwise', () => {
  assert(forgot.includes("localError('email', 'Please enter your email address')"));
  assert(forgot.includes("localError('email', 'Please enter a valid email address')"));
  assertEquals(forgot.split('setError(fromAuthError(RESEND_TOO_SOON))').length - 1, 2, 'both the fast path and the critical-section check');
  assert(forgot.includes('setError(fromAuthError(resetError))'));
  assert(forgot.includes("localError('form', 'Could not start a secure password reset on this device. Please try again.')"));
  assert(forgot.includes('error={errorView.emailError}') && forgot.includes('invalid={errorView.emailInvalid}'));
  assert(forgot.includes('{errorView.formMessage ? <FormMessage>{errorView.formMessage}</FormMessage> : null}'));
  assert(!/getAuthErrorMessage\(/.test(forgot));
});

Deno.test('the new-password form: a password problem on New password, anything else the form\'s message', () => {
  assert(form.includes('submit: (password: string) => Promise<FormErrorState | null>;'));
  assert(form.includes("if (error.target === 'password') setPasswordError(error.message);"));
  assert(form.includes('else setFormError(error);'));
  assert(form.includes('{formMessage ? <FormMessage>{formMessage}</FormMessage> : null}'));
  // The stale form message goes with the next attempt and with typing.
  assert(form.includes('setFormError(null);'));
  for (const f of ['app/change-password.tsx', 'app/reset-password.tsx']) {
    const s = SOURCES[f];
    assert(s.includes('fromAuthError(error, PASSWORD_RULE_SENTENCE, brand.name)'), f);
    assert(!/getAuthErrorMessage\(/.test(s), f);
  }
});

Deno.test('Delete account keeps its own routing: a wrong password on the field, a limit / failure in a panel (no change needed)', () => {
  const v = SOURCES['components/shell/DeleteAccountView.tsx'];
  assert(v.includes('error={state.proofRejected ? PASSWORD_WRONG : null}'));
  assert(v.includes('{state.failed ? <WarnPanel text={DELETE_FAILED} /> : null}'));
  assert(v.includes('{state.rateLimited ? <WarnPanel text={TRY_LATER} /> : null}'));
});

Deno.test('no screen sends a whole error to a password field any more: the only getAuthErrorMessage callers are the single-line surfaces', () => {
  const callers = Object.entries(SOURCES).filter(([f, t]) => /^(app|components)\//.test(f) && /getAuthErrorMessage\(/.test(t)).map(([f]) => f).sort();
  assertEquals(callers, ['components/shell/ConfirmEmailSent.tsx', 'components/shell/SocialSignIn.tsx']);
});

// ---- Design Lead ruling 2026-11-09: "email not confirmed" is a NOTE (a next step), not a failure ------------------------------------

import { NO_FORM_ERROR_VIEW, missingFields } from '../lib/auth/formError.ts';
import { PREFILL_EMAIL, parseSignupCapture } from '../lib/auth/signupCapture.ts';

Deno.test('an unconfirmed address reads as a note (primary text, not danger red); every other form message is an error', () => {
  assertEquals(viewOf(fromAuthError({ code: 'email_not_confirmed', message: 'Email not confirmed' })).formTone, 'note');
  assertEquals(viewOf(fromAuthError({ message: 'Email not confirmed' })).formTone, 'note');
  for (const e of [{ code: 'over_request_rate_limit' }, { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }, { message: 'Network request failed' }, { message: 'boom' }]) {
    assertEquals(viewOf(fromAuthError(e)).formTone, 'error', JSON.stringify(e));
  }
  assertEquals(viewOf(localError('form', 'x')).formTone, 'error');
  assertEquals(viewOf(missingFields('', '')).formTone, 'error');
  assertEquals(NO_FORM_ERROR_VIEW.formTone, 'error');
});

Deno.test('the unconfirmed note is the form\'s message with NO red field, and its words are the existing mapper line', () => {
  const v = viewOf(fromAuthError({ code: 'email_not_confirmed' }));
  assertEquals(v.formMessage, 'Please verify your email before signing in.');
  assertEquals([v.emailError, v.passwordError, v.emailInvalid, v.passwordInvalid], [null, null, false, false]);
});

Deno.test('Sign in draws the note through FormMessage with its tone, then "Send again" as an accent text button (the W2 copy)', () => {
  assert(login.includes('<FormMessage tone={errorView.formTone}>{errorView.formMessage}</FormMessage>'));
  const body = login.slice(login.indexOf('<FormMessage tone='));
  const resend = body.slice(body.indexOf('{unconfirmed ? ('), body.indexOf('Forgot password?'));
  assert(resend.includes('{COPY.resend}'));
  assert(resend.includes('color={colors.accent}'), 'an accent text button, not red');
  assertEquals(SOURCES['constants/confirmEmailCopy.ts'].includes(`resend: "Didn't receive it? Send again"`), true, 'the approved W2 wording');
  const msg = SOURCES['components/shell/FormMessage.tsx'];
  assert(msg.includes("color={tone === 'note' ? colors.text : colors.danger}"));
});

Deno.test('capture knob: not_confirmed is a Sign in error kind; Sign in takes the knob and its dummy prefill', () => {
  assertEquals(parseSignupCapture(true, { error: 'not_confirmed' }).error?.code, 'email_not_confirmed');
  assertEquals(parseSignupCapture(false, { error: 'not_confirmed' }).error, null);
  assert(login.includes('SIGNUP_CAPTURE.error ? { error: SIGNUP_CAPTURE.error } : await signIn(email.trim(), password)'));
  assert(login.includes('useState(SIGNUP_CAPTURE.prefill ? PREFILL_EMAIL :'));
  assert(PREFILL_EMAIL.endsWith('.test'));
});
