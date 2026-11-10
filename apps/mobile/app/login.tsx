/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { space, type } from '@/constants/tokens';
import { brand } from '@/constants/brand';
import { CONFIRM_EMAIL_COPY as COPY } from '@/constants/confirmEmailCopy';
import { PASSWORD_RULE_SENTENCE } from '@/constants/passwordRules';
import { Button, type ButtonStatus } from '@/components/sp/Button';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { AuthScaffold } from '@/components/shell/AuthScaffold';
import { BrandLockup } from '@/components/shell/BrandBars';
import { ConfirmEmailSent } from '@/components/shell/ConfirmEmailSent';
import { ConfirmedEmailNotice } from '@/components/shell/ConfirmedEmailNotice';
import { DeletedAccountNotice } from '@/components/shell/DeletedAccountNotice';
import { usePendingInvite } from '@/lib/invite/usePendingInvite';
import { Field } from '@/components/shell/Field';
import { FormMessage } from '@/components/shell/FormMessage';
import { ScreenTitle } from '@/components/shell/ScreenTitle';
import { SocialSignIn } from '@/components/shell/SocialSignIn';
import { isEmailNotConfirmedError } from '@/lib/authErrors';
import { fromAuthError, missingFields, viewOf, type FormErrorState } from '@/lib/auth/formError';
import { useSession } from '@/lib/SessionProvider';
import { setConfirmFailedNotice } from '@/lib/auth/confirmFailedNotice';
import { setDeletedNotice } from '@/lib/account/deletedNotice';
import { clearSignInIntent, markSignInIntent } from '@/lib/shell/signInTransition';
import { useFixtureInitialRoute } from '@/lib/shell/fixtureRoute';

// Phase 3b-1 — Sign in (spec row 1, board "Sign in"). Strings verbatim from
// the previous login.tsx, sentence case: "Welcome back", "Sign in to your
// league", "Forgot password?", "New here? Create an account", "Sign in".
//
// S4: the brand bars rise on arrival; the button goes loading → ✓ done, and
// the root layout holds the ✓ for `quick` before the app crossfades and
// scales in (lib/shell/signInTransition.ts). The session flip is the
// navigation — nothing here calls the router on success.
//
// Create account moved to its own screen (app/create-account.tsx; board
// "Create account"), so this file is sign-in only.
//
// Onboarding W2 (plan 2026-10-14): Continue with Apple / Google above the
// email form. Email confirmation is ON, so an unconfirmed account's sign-in
// error ("Please verify your email before signing in.") carries "Didn't
// receive it? Send again" (forgot-password's own words), which resends the
// confirmation and shows "Check your email".

export default function SignInScreen() {
  const { colors } = useTheme();
  const { signIn, signUp } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<ButtonStatus>('idle');
  // One error at a time; WHERE it shows is lib/auth/formError.ts's call (R5): a wrong password on Password, an email problem on Email, the rest
  // (a rate limit, the network, an unconfirmed address) as the form's own message with no red border.
  const [error, setError] = useState<FormErrorState | null>(null);
  const errorView = viewOf(error);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const invite = usePendingInvite(); // the league named on "Check your email" when a link brought the person here
  const [sentTo, setSentTo] = useState<string | null>(null);
  const resending = useRef(false);
  const passwordRef = useRef<TextInput>(null);
  // DEV captures only: EXPO_PUBLIC_SHELL_INITIAL_ROUTE (e.g. /forgot-password) opens once.
  useFixtureInitialRoute();

  async function handleSignIn() {
    if (status !== 'idle') return;
    // "Your email is confirmed…" is for the first look; the next attempt clears it (W4).
    setConfirmFailedNotice(false);
    setDeletedNotice(false);
    if (!email || !password) {
      setError(missingFields(email, password));
      return;
    }
    setError(null);
    setStatus('loading');
    markSignInIntent();
    const { error: authError } = await signIn(email.trim(), password);
    if (authError) {
      clearSignInIntent();
      setStatus('idle');
      setUnconfirmed(isEmailNotConfirmedError(authError));
      setError(fromAuthError(authError, PASSWORD_RULE_SENTENCE, brand.name));
      return;
    }
    setStatus('done');
  }

  // "Send again" for an unconfirmed account. The password was just verified (GoTrue answers
  // email_not_confirmed only after it), and signUp() for the same address re-sends the confirmation
  // through the PKCE path (SessionProvider explains why not supabase.auth.resend()).
  async function handleResend() {
    if (resending.current) return;
    const to = email.trim();
    resending.current = true;
    const { error: resendError } = await signUp(to, password);
    resending.current = false;
    if (resendError) {
      setUnconfirmed(false);
      setError(fromAuthError(resendError, PASSWORD_RULE_SENTENCE, brand.name));
      return;
    }
    setSentTo(to);
  }

  if (sentTo) {
    return (
      <ConfirmEmailSent
        email={sentTo}
        league={invite?.leagueName ?? null}
        onResend={() => signUp(sentTo, password)}
        onBack={() => {
          setSentTo(null);
          setUnconfirmed(false);
          setError(null);
        }}
      />
    );
  }

  return (
    <AuthScaffold>
      <View style={styles.brand}>
        <BrandLockup />
      </View>
      <View style={styles.heading}>
        <ScreenTitle>Welcome back</ScreenTitle>
        <Text variant="body" tone="secondary">
          Sign in to your league
        </Text>
      </View>
      <ConfirmedEmailNotice />
      <DeletedAccountNotice />
      <SocialSignIn />
      <View style={styles.fields}>
        <Field
          label="Email address"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (error) setError(null);
            setUnconfirmed(false);
          }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          autoCorrect={false}
          spellCheck={false}
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          error={errorView.emailError}
          invalid={errorView.emailInvalid}
        />
        <Field
          ref={passwordRef}
          label="Password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (error) setError(null);
            setUnconfirmed(false);
          }}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleSignIn}
          error={errorView.passwordError}
          invalid={errorView.passwordInvalid}
        />
        {errorView.formMessage ? <FormMessage>{errorView.formMessage}</FormMessage> : null}
        {unconfirmed ? (
          <Pressable onPress={handleResend} accessibilityRole="link" style={styles.resend}>
            <Text variant="body" color={colors.accent} style={styles.bold}>
              {COPY.resend}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => router.push('/forgot-password')}
          accessibilityRole="link"
          style={styles.forgot}
        >
          <Text variant="body" color={colors.accent} style={styles.bold}>
            Forgot password?
          </Text>
        </Pressable>
      </View>
      <Button label="Sign in" status={status} onPress={handleSignIn} />
      <Pressable onPress={() => router.push('/create-account')} accessibilityRole="link" style={styles.switch} hitSlop={8}>
        <Text variant="body" tone="secondary" style={styles.center}>
          New here? <Text variant="body" color={colors.accent} style={styles.bold}>Create an account</Text>
        </Text>
      </Pressable>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  brand: {
    paddingTop: space[7],
  },
  heading: {
    gap: space[2],
  },
  fields: {
    gap: space[5],
  },
  resend: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  // A 44pt target (§9B), not a 32pt box with hit slop.
  forgot: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
  },
  bold: {
    fontFamily: type.headline.fontFamily,
  },
  switch: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
});
