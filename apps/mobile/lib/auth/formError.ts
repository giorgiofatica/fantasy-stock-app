// Stockpile — where Create account shows an error (build 13, Giorgio's recording of 1.3.0 (12), 2026-11-09). Pure, for tests-deno.
//
// Build 12 put EVERY error under the Password field with a red border, so "Too many attempts" read as a problem with
// a password that was fine. The rule now:
//   - an error ABOUT a field is shown on that field (weak password -> Password; invalid email, address taken -> Email);
//   - an error about neither (a rate limit, the network, the signup gate, anything unmapped) is the FORM's message,
//     docked above the primary button, and no field gets a red border;
//   - "enter your email and password" is the form's message too, with only the EMPTY field(s) marked.
// The words are lib/authErrors.ts's; this file only decides the home and the borders.

import { getAuthError, type AuthErrorTarget } from '../authErrors';

export interface FormErrorState {
  target: AuthErrorTarget;
  message: string;
  /** Marks a box red without a message of its own (an empty required field under the form's message). */
  emailInvalid: boolean;
  passwordInvalid: boolean;
}

export interface FormErrorView {
  emailError: string | null;
  emailInvalid: boolean;
  passwordError: string | null;
  passwordInvalid: boolean;
  /** The form-level message, or null. */
  formMessage: string | null;
}

export const NO_FORM_ERROR_VIEW: FormErrorView = { emailError: null, emailInvalid: false, passwordError: null, passwordInvalid: false, formMessage: null };

/** A server (or transport) error from signUp, routed to where it belongs. */
export function fromAuthError(error: unknown, weakPasswordMessage?: string, productName?: string): FormErrorState {
  const { message, target } = getAuthError(error, weakPasswordMessage, productName);
  return { target, message, emailInvalid: false, passwordInvalid: false };
}

/** A message of the screen's own (not from the server): on the named field, or the form's. */
export function localError(target: AuthErrorTarget, message: string): FormErrorState {
  return { target, message, emailInvalid: false, passwordInvalid: false };
}

/** Submit with a field empty: the form's message, and only the empty field(s) red. */
export function missingFields(email: string, password: string): FormErrorState {
  return { target: 'form', message: 'Please enter email and password', emailInvalid: !email, passwordInvalid: !password };
}

/** The local password-rule check failed: about the password, so on the Password field. */
export function weakPasswordLocal(message: string): FormErrorState {
  return localError('password', message);
}

/** What the screen draws for a state: one message in one place, and a red box only where it is earned. */
export function viewOf(state: FormErrorState | null): FormErrorView {
  if (!state) return NO_FORM_ERROR_VIEW;
  return {
    emailError: state.target === 'email' ? state.message : null,
    emailInvalid: state.target === 'email' || state.emailInvalid,
    passwordError: state.target === 'password' ? state.message : null,
    passwordInvalid: state.target === 'password' || state.passwordInvalid,
    formMessage: state.target === 'form' ? state.message : null,
  };
}
