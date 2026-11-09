// Friendly, user-facing translations of Supabase Auth errors — shared
// between login.tsx (sign in / sign up) and reset-password.tsx (password
// recovery), so the same server error reads the same way on every screen
// instead of a friendly message on one and a raw server string on another.
//
// Extracted from login.tsx's getUserFriendlyError (unchanged behavior for
// every case that already existed there) and extended with two cases
// login.tsx never needed: 'same_password' (reusing the current password
// via updateUser) and a network/transport failure.
//
// Prefers error.code — GoTrue's stable, machine-readable error code (see
// @supabase/auth-js's ErrorCode union, e.g. 'weak_password', 'same_password')
// — over string-matching error.message, and falls back to the message
// text where no code is present. A code is only ever absent for a
// transport-level failure (AuthRetryableFetchError) that never reached the
// server to get one, which is exactly the case the network check below
// exists to catch.
//
// Deliberately NO import of constants/passwordRules.ts's PASSWORD_RULE_SENTENCE
// here (unlike an earlier draft of this file): every other pure-logic module
// this app also runs through `deno test` (lib/recoveryLink.ts,
// lib/draftState.ts, lib/weekStatus.ts, ...) is self-contained, with zero
// cross-file imports, because Deno has no knowledge of this app's `@/*`
// tsconfig path alias and would fail to resolve one. Callers that want the
// shared password-policy sentence in the weak_password case pass it in via
// `weakPasswordMessage` instead (both real call sites do); a caller that
// doesn't gets a still-reasonable generic fallback.

/** The server-side signup gate's refusal (Before User Created hook); it has no stable code. */
export function isSignupsPausedError(error: any): boolean {
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
  return message.includes('not open for new signups');
}

/**
 * Signing in to an account whose email was never confirmed (onboarding W2: confirmation is ON).
 * Sign in then offers "Didn't receive it? Send again".
 */
export function isEmailNotConfirmedError(error: any): boolean {
  const code = typeof error?.code === 'string' ? error.code : '';
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
  return code === 'email_not_confirmed' || message.includes('email not confirmed');
}

/**
 * The email-send cap's line (`over_email_send_rate_limit` with GoTrue's "email rate limit exceeded"). Supabase's built-in SMTP is capped
 * PER HOUR and for the whole project, so "wait a minute" (the per-request line) is false for it; "later" is true whatever sends the mail.
 * The same code also carries the per-address ONE-MINUTE interval ("For security purposes, you can only request this after N seconds"):
 * that one keeps the minute line (classifyAuthError). Giorgio's wording, approved 2026-11-09 ("A, try again later").
 */
export const EMAIL_RATE_LIMIT_MESSAGE = "We can't send another email right now. Try again later.";

/** The per-request rate limit's line (`over_request_rate_limit`, and any rate-limit message without a code). */
export const REQUEST_RATE_LIMIT_MESSAGE = 'Too many attempts — please wait a minute and try again.';

/**
 * What an auth error IS, decided once. `getAuthErrorMessage` (the words) and `authErrorTarget` (which part of the screen
 * shows them) both read this, so a new kind cannot get a message and no home, or the reverse.
 */
export type AuthErrorKind =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'user_already_exists'
  | 'same_password'
  | 'weak_password'
  | 'invalid_email'
  | 'email_rate_limit'
  | 'request_rate_limit'
  | 'signups_paused'
  | 'network'
  | 'other';

export function classifyAuthError(error: any): AuthErrorKind {
  const code = typeof error?.code === 'string' ? error.code : '';
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) return 'invalid_credentials';
  if (isEmailNotConfirmedError(error)) return 'email_not_confirmed';
  if (code === 'user_already_exists' || message.includes('user already registered')) return 'user_already_exists';
  if (code === 'same_password' || message.includes('should be different from the old password')) return 'same_password';
  if (code === 'weak_password' || message.includes('password should be at least')) return 'weak_password';
  if (code === 'email_address_invalid' || message.includes('invalid email') || message.includes('unable to validate email')) return 'invalid_email';
  // GoTrue sends over_email_send_rate_limit for TWO different things, told apart only by the message. "For security purposes, you can only
  // request this after N seconds" is the per-address minimum interval (a minute, whatever the code); "email rate limit exceeded" is the
  // project-wide hourly cap on the built-in SMTP. So the interval message is read first, then the code.
  if (message.includes('for security purposes')) return 'request_rate_limit';
  if (code === 'over_email_send_rate_limit' || message.includes('email rate limit')) return 'email_rate_limit';
  if (code === 'over_request_rate_limit' || message.includes('rate limit')) return 'request_rate_limit';
  // Server-side signup gate (Before User Created hook).
  if (isSignupsPausedError(error)) return 'signups_paused';
  if (message.includes('network request failed') || message.includes('failed to fetch') || message.includes('network error')) return 'network';
  return 'other';
}

/**
 * `productName` is brand.name (constants/brand.ts), passed in rather than
 * imported for the same Deno reason as the password sentence above. Without
 * it the paused message uses a neutral subject — never a hard-coded brand.
 */
export function getAuthErrorMessage(error: any, weakPasswordMessage?: string, productName?: string): string {
  switch (classifyAuthError(error)) {
    case 'invalid_credentials':
      return 'Invalid email or password. Please try again.';
    case 'email_not_confirmed':
      return 'Please verify your email before signing in.';
    case 'user_already_exists':
      return 'An account with this email already exists.';
    case 'same_password':
      return 'Your new password needs to be different from your current one.';
    case 'weak_password':
      return weakPasswordMessage ?? 'That password does not meet the required strength.';
    case 'invalid_email':
      return 'Please enter a valid email address.';
    case 'email_rate_limit':
      return EMAIL_RATE_LIMIT_MESSAGE;
    case 'request_rate_limit':
      return REQUEST_RATE_LIMIT_MESSAGE;
    case 'signups_paused':
      // Giorgio's final text, verbatim (3b-1 spec row 3).
      return `${productName ?? 'This app'} is not open for new signups yet — check back soon. Existing accounts can still sign in.`;
    case 'network':
      return 'Network error — check your connection and try again.';
    case 'other':
      // Never the server's own words (W4 Onboarding gate, Design Lead 2026-10-14): an unmapped GoTrue
      // error reads the generic line, on every screen that calls this.
      return 'Something went wrong. Please try again.';
  }
}

/**
 * Where an auth error is shown on a form with an Email and a Password field (Create account, Sign in): on the field it is ABOUT, or, when it is
 * about neither (a rate limit, the network, a refusal, anything unmapped), in the form's own message with no red border anywhere.
 * Build 12 put "Too many attempts" under Password, red-bordering a field that was fine.
 */
export type AuthErrorTarget = 'email' | 'password' | 'form';

export function authErrorTarget(error: any): AuthErrorTarget {
  switch (classifyAuthError(error)) {
    case 'invalid_email':
    case 'user_already_exists':
      return 'email';
    // A wrong sign-in password is a password problem (a wrong email reads the same, on purpose: GoTrue never says which).
    case 'invalid_credentials':
    case 'weak_password':
    case 'same_password':
      return 'password';
    default:
      return 'form';
  }
}

/** The message AND where it belongs (R5 of docs/plans/2026-11-09-auth-screen-layout.md), decided together from one verdict. */
export interface AuthErrorReport {
  message: string;
  target: AuthErrorTarget;
}

export function getAuthError(error: any, weakPasswordMessage?: string, productName?: string): AuthErrorReport {
  return { message: getAuthErrorMessage(error, weakPasswordMessage, productName), target: authErrorTarget(error) };
}
