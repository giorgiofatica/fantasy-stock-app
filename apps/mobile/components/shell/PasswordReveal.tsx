/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';

import { Icon } from '@/components/sp/Icon';
import { iconPointSize } from '@/components/sp/logic/icon';
import { INITIAL_REVEALED, REVEAL_HIT_PT, revealState, revealTrailingMargin, type RevealState } from '@/lib/passwordReveal';

// A password field's show / hide toggle (lib/passwordReveal.ts holds the rules). Field draws it for
// every field its caller marks `secureTextEntry`, so no password field can be without it or drift.

/** The toggle's state for one field: hidden on every mount, flipped by `toggle`. */
export function usePasswordReveal(callerSecure: boolean | undefined): RevealState & { toggle: () => void } {
  const [revealed, setRevealed] = useState(INITIAL_REVEALED);
  return { ...revealState(callerSecure, revealed), toggle: () => setRevealed((r) => !r) };
}

/** The eye button at the right of the field's box. A Pressable never takes first responder, and every
 * password screen's AuthScaffold persists handled taps, so a tap keeps the field focused and the keyboard up. */
export function PasswordRevealButton({ reveal, boxPadding }: { reveal: RevealState & { toggle: () => void }; boxPadding: number }) {
  const { fontScale } = useWindowDimensions();
  const marginRight = revealTrailingMargin(iconPointSize('body', fontScale), boxPadding);
  return (
    <Pressable
      onPress={reveal.toggle}
      accessibilityRole="button"
      accessibilityLabel={reveal.label}
      style={({ pressed }) => [styles.button, { marginRight }, pressed ? styles.pressed : null]}
    >
      <Icon name={reveal.icon} size="body" tone="text2" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: REVEAL_HIT_PT,
    height: REVEAL_HIT_PT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.5,
  },
});
