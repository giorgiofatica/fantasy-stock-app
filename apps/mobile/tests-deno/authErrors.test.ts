/**
 * Hermetic unit tests for lib/authErrors.ts's shared error-message mapper.
 * Run from apps/mobile/tests-deno (see that directory's deno.json):
 *
 *   cd apps/mobile/tests-deno && deno test .
 *
 * Every case here matches something login.tsx already relied on (message
 * text) before this was extracted, plus two new ones reset-password.tsx
 * needs that login.tsx never triggered: 'same_password' and a network
 * failure. error.code is checked first (GoTrue's stable machine-readable
 * code) with the message text as a fallback for transport-level failures
 * that never got a code.
 *
 * lib/authErrors.ts deliberately does not import constants/passwordRules.ts
 * (Deno can't resolve this app's `@/*` alias — see that file's header
 * comment), so these tests pass a literal stand-in string as
 * weakPasswordMessage rather than importing PASSWORD_RULE_SENTENCE; the
 * real call sites (login.tsx, reset-password.tsx) pass the real one.
 */
import { assert, assertEquals, assertNotEquals } from 'jsr:@std/assert';
import { authErrorTarget, classifyAuthError, EMAIL_RATE_LIMIT_MESSAGE, getAuthErrorMessage, isSignupsPausedError, REQUEST_RATE_LIMIT_MESSAGE } from '../lib/authErrors.ts';
import { SOURCES } from './sourceManifest.generated.ts';

const RULE_SENTENCE_STANDIN = 'Use at least 8 characters, with an uppercase letter, a lowercase letter, a number, and a symbol.';

Deno.test('getAuthErrorMessage: invalid credentials, by code', () => {
  assertEquals(
    getAuthErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
    'Invalid email or password. Please try again.'
  );
});

Deno.test('getAuthErrorMessage: invalid credentials, by message only (no code)', () => {
  assertEquals(
    getAuthErrorMessage({ message: 'Invalid login credentials' }),
    'Invalid email or password. Please try again.'
  );
});

Deno.test('getAuthErrorMessage: email not confirmed', () => {
  assertEquals(
    getAuthErrorMessage({ code: 'email_not_confirmed', message: 'Email not confirmed' }),
    'Please verify your email before signing in.'
  );
});

Deno.test('getAuthErrorMessage: user already registered', () => {
  assertEquals(
    getAuthErrorMessage({ code: 'user_already_exists', message: 'User already registered' }),
    'An account with this email already exists.'
  );
});

Deno.test('getAuthErrorMessage: same_password (new case, updateUser reusing the current password)', () => {
  assertEquals(
    getAuthErrorMessage({ code: 'same_password', message: 'New password should be different from the old password.' }),
    'Your new password needs to be different from your current one.'
  );
  // Message-only fallback, in case a future SDK version omits the code.
  assertEquals(
    getAuthErrorMessage({ message: 'New password should be different from the old password.' }),
    'Your new password needs to be different from your current one.'
  );
});

Deno.test('getAuthErrorMessage: weak_password returns the caller-supplied policy sentence', () => {
  assertEquals(
    getAuthErrorMessage({ code: 'weak_password', message: 'Password should be at least 8 characters.' }, RULE_SENTENCE_STANDIN),
    RULE_SENTENCE_STANDIN
  );
});

Deno.test('getAuthErrorMessage: weak_password with no override falls back to a generic message', () => {
  assertEquals(
    getAuthErrorMessage({ code: 'weak_password', message: 'Password should be at least 8 characters.' }),
    'That password does not meet the required strength.'
  );
});

Deno.test('getAuthErrorMessage: invalid email', () => {
  assertEquals(
    getAuthErrorMessage({ code: 'email_address_invalid', message: 'Unable to validate email address: invalid format' }),
    'Please enter a valid email address.'
  );
});

Deno.test('getAuthErrorMessage: rate limited', () => {
  assertEquals(
    getAuthErrorMessage({ code: 'over_request_rate_limit', message: 'For security purposes, you can only request this once every 60 seconds.' }),
    'Too many attempts — please wait a minute and try again.'
  );
});

// Build 13 (Giorgio's recording of 1.3.0 (12)): Supabase's built-in SMTP is capped PER HOUR for the whole project, so the email-send
// cap cannot say "wait a minute". It has its own line; the per-request cap keeps the minute.
Deno.test('getAuthErrorMessage: the EMAIL-send cap has its own line, and it is not the one-minute line', () => {
  const email = getAuthErrorMessage({ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' });
  assertEquals(email, EMAIL_RATE_LIMIT_MESSAGE);
  assertEquals(email.includes('minute'), false);
  assertEquals(email, "We can't send another email right now. Try again later.", "Giorgio's approved wording, verbatim");
  assertNotEquals(email, REQUEST_RATE_LIMIT_MESSAGE);
});

Deno.test('getAuthErrorMessage: the per-request cap keeps the one-minute line (unchanged wording)', () => {
  assertEquals(REQUEST_RATE_LIMIT_MESSAGE, 'Too many attempts — please wait a minute and try again.');
  assertEquals(getAuthErrorMessage({ code: 'over_request_rate_limit', message: 'x' }), REQUEST_RATE_LIMIT_MESSAGE);
  // A rate-limit message with no code (a transport quirk) is the per-request line, not the hour line.
  assertEquals(getAuthErrorMessage({ message: 'Rate limit exceeded' }), REQUEST_RATE_LIMIT_MESSAGE);
  assertEquals(getAuthErrorMessage({ message: 'For security purposes, you can only request this after 12 seconds.' }), REQUEST_RATE_LIMIT_MESSAGE);
});

Deno.test('the email cap is also recognised from its message when GoTrue sends no code', () => {
  assertEquals(classifyAuthError({ message: 'Email rate limit exceeded' }), 'email_rate_limit');
  assertEquals(classifyAuthError({ code: 'over_email_send_rate_limit' }), 'email_rate_limit');
});

// GoTrue sends over_email_send_rate_limit for the per-address minimum interval too; only the message tells the two apart.
Deno.test('over_email_send_rate_limit WITH the minimum-interval message is the one-minute line, not the hour line', () => {
  const interval = { code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 60 seconds.' };
  assertEquals(classifyAuthError(interval), 'request_rate_limit');
  assertEquals(getAuthErrorMessage(interval), REQUEST_RATE_LIMIT_MESSAGE);
  assertEquals(authErrorTarget(interval), 'form');
});

Deno.test('the approved wording is ONE constant: no other app source spells the email-cap line', () => {
  const needle = "We can't send another email";
  const hits = Object.entries(SOURCES).filter(([, t]) => t.includes(needle)).map(([f]) => f);
  assertEquals(hits, ['lib/authErrors.ts']);
  // Approved (2026-11-09): no pending marker is left on it.
  assert(!SOURCES['lib/authErrors.ts'].includes('PENDING APPROVAL'));
});

// Which part of a form shows an error (lib/authErrors.ts authErrorTarget; lib/auth/formError.ts draws it).
Deno.test('authErrorTarget: field errors stay on their field', () => {
  assertEquals(authErrorTarget({ code: 'weak_password', message: 'Password should be at least 8 characters.' }), 'password');
  assertEquals(authErrorTarget({ code: 'email_address_invalid', message: 'x' }), 'email');
  assertEquals(authErrorTarget({ message: 'Unable to validate email address: invalid format' }), 'email');
  assertEquals(authErrorTarget({ code: 'user_already_exists', message: 'User already registered' }), 'email');
});

Deno.test('authErrorTarget: an error about no field is the FORM\'s (rate limits, network, signups paused, generic, nothing)', () => {
  for (const e of [
    { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' },
    { code: 'over_request_rate_limit', message: 'x' },
    { message: 'Network request failed' },
    { message: 'Signups not open for new signups' },
    { message: 'boom' },
    {},
    null,
  ]) {
    assertEquals(authErrorTarget(e), 'form', JSON.stringify(e));
  }
});

Deno.test('every kind classifyAuthError can return has a message AND a target (they read one verdict, so they cannot drift)', () => {
  const samples = [
    { code: 'invalid_credentials' }, { code: 'email_not_confirmed' }, { code: 'user_already_exists' }, { code: 'same_password' },
    { code: 'weak_password' }, { code: 'email_address_invalid' }, { code: 'over_email_send_rate_limit' }, { code: 'over_request_rate_limit' },
    { message: 'Signups not open for new signups' }, { message: 'Network request failed' }, { message: 'zzz' },
  ];
  const kinds = new Set(samples.map(classifyAuthError));
  assertEquals(kinds.size, samples.length, 'each sample is a distinct kind');
  for (const e of samples) {
    assert(getAuthErrorMessage(e).length > 0);
    assert(['email', 'password', 'form'].includes(authErrorTarget(e)));
  }
});

Deno.test('getAuthErrorMessage: signups closed — Giorgio\'s final text, verbatim, through brand.name', () => {
  // Phase 3b-1 spec row 3: "{brand.name} is not open for new signups yet —
  // check back soon. Existing accounts can still sign in."
  assertEquals(
    getAuthErrorMessage({ message: 'Signups not open for new signups' }, undefined, 'Stockade'),
    'Stockade is not open for new signups yet — check back soon. Existing accounts can still sign in.'
  );
  // No product name passed: a neutral subject, never a hard-coded brand.
  assertEquals(
    getAuthErrorMessage({ message: 'Signups not open for new signups' }),
    'This app is not open for new signups yet — check back soon. Existing accounts can still sign in.'
  );
});

Deno.test('isSignupsPausedError: only the signup gate\'s refusal', () => {
  assertEquals(isSignupsPausedError({ message: 'Sign-ups are not open for new signups right now' }), true);
  assertEquals(isSignupsPausedError({ message: 'Invalid login credentials' }), false);
  assertEquals(isSignupsPausedError(null), false);
});

Deno.test('getAuthErrorMessage: network failure (new case, no code — never reached the server)', () => {
  assertEquals(
    getAuthErrorMessage({ message: 'Network request failed' }),
    'Network error — check your connection and try again.'
  );
  assertEquals(
    getAuthErrorMessage({ message: 'TypeError: Failed to fetch' }),
    'Network error — check your connection and try again.'
  );
});

// W4 Onboarding gate (Design Lead, 2026-10-14): never the server's own words. An unrecognized
// error used to fall back to its message (raw GoTrue English on Sign in / Create account /
// Forgot password); it now reads the generic line.
Deno.test('getAuthErrorMessage: an unrecognized error reads the generic line, never its own message', () => {
  assertEquals(
    getAuthErrorMessage({ message: 'Something wildly specific broke.' }),
    'Something went wrong. Please try again.'
  );
});

Deno.test('getAuthErrorMessage: no message at all falls back to a generic string', () => {
  assertEquals(getAuthErrorMessage({}), 'Something went wrong. Please try again.');
  assertEquals(getAuthErrorMessage(null), 'Something went wrong. Please try again.');
});
