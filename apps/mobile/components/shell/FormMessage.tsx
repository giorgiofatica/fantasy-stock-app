/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { ReactNode, useContext, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { type } from '@/constants/tokens';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { CARD_LINE_MAX_SCALE } from '@/lib/game/draftClockCard';
import { RevealTailContext } from './FieldBlockContext';

// The form's own message on an auth screen (R5 of docs/plans/2026-11-09-auth-screen-layout.md): a rate limit, the network, an unconfirmed address.
// It sits in the scroll body under the fields (Design Lead ruling 2026-11-09), is capped at 1.6x so at the largest text size it cannot push the
// form off the screen (five huge lines in the AX5 still), and tells the AuthScaffold where it is so a reveal counts it (FieldBlockContext).
//   error: danger red, for a failure.
//   note:  the primary text colour, for a next step that is not a failure ("Please verify your email before signing in").

export const FORM_MESSAGE_MAX_SCALE = CARD_LINE_MAX_SCALE;

export type FormMessageTone = 'error' | 'note';

export function FormMessage({ children, tone = 'error' }: { children: ReactNode; tone?: FormMessageTone }) {
  const { colors } = useTheme();
  const tail = useContext(RevealTailContext);
  const box = useRef<View>(null);
  useEffect(() => {
    if (!tail) return;
    tail.register(box.current);
    tail.appeared();
    return () => tail.register(null);
  }, [tail, children]);
  return (
    <View ref={box} collapsable={false}>
      <Text
        variant="callout"
        color={tone === 'note' ? colors.text : colors.danger}
        maxFontSizeMultiplier={FORM_MESSAGE_MAX_SCALE}
        accessibilityLiveRegion="polite"
        style={styles.text}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: type.headline.fontFamily,
  },
});
