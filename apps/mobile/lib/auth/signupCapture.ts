// Stockpile — DEV-ONLY capture knobs for Create account (build 13, 2026-11-09). Pure: this file never mentions `__DEV__`, so Deno
// can import and test it; lib/shell/captureDev.ts is the one place that reads `__DEV__` and the env vars (same split as
// lib/shell/captureKnobs.ts). A release bundle compiles `__DEV__` to false and never consults any of them.
//
//   EXPO_PUBLIC_SIGNUP_ERROR=<kind>   pressing Create account answers with this error INSTEAD of calling the server, so an error
//                                     state can be shot without hammering production (the email cap is project-wide).
//   EXPO_PUBLIC_SIGNUP_PREFILL=1      the form opens with dummy values (no credential is ever typed on a simulator)
//
// kinds: email_rate | request_rate | network | weak | invalid_email | generic

export type SignupErrorKind = 'email_rate' | 'request_rate' | 'network' | 'weak' | 'invalid_email' | 'generic';

const ERRORS: Record<SignupErrorKind, { code?: string; message: string }> = {
  email_rate: { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' },
  request_rate: { code: 'over_request_rate_limit', message: 'For security purposes, you can only request this after 59 seconds.' },
  network: { message: 'Network request failed' },
  weak: { code: 'weak_password', message: 'Password should be at least 8 characters.' },
  invalid_email: { code: 'email_address_invalid', message: 'Unable to validate email address: invalid format' },
  generic: { message: 'boom' },
};

/** Dummy values only. Never a real address or a real password. */
export const PREFILL_EMAIL = 'dummy.user@example.test';
export const PREFILL_PASSWORD = 'Dummy-Pass-1';

export interface SignupCapture {
  error: { code?: string; message: string } | null;
  prefill: boolean;
}

export const NO_SIGNUP_CAPTURE: SignupCapture = { error: null, prefill: false };

/** Only a development build reads anything; an unrecognised value is ignored, never guessed. */
export function parseSignupCapture(isDev: boolean, env: { error?: string; prefill?: string }): SignupCapture {
  if (!isDev) return NO_SIGNUP_CAPTURE;
  const kind = env.error as SignupErrorKind | undefined;
  return {
    error: kind && Object.prototype.hasOwnProperty.call(ERRORS, kind) ? ERRORS[kind] : null,
    prefill: env.prefill === '1',
  };
}
