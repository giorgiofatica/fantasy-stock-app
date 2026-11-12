import { createContext, ReactElement, useContext } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isPageSheet, screenTopInset } from '@/lib/shell/screenTopInset';

// Tells a screen's frame whether it is in an iOS page sheet (lib/shell/screenTopInset.ts). Set ONCE,
// by the root Stack's `screenLayout` (app/_layout.tsx), from each screen's own resolved `presentation`
// option, so a new `presentation: 'modal'` route is covered by declaring it, with nothing to forget
// in the screen. Frames read `useScreenTopInset()` instead of `useSafeAreaInsets().top`.
//
// Not a SafeAreaInsetsContext override: a sheet's RN <Modal> (InfoPopup, PlayerCard) opens its own
// full-screen window and must still clear the status bar, so only the frames opt in.

const InPageSheet = createContext(false);

type ScreenLayoutArgs = { options: { presentation?: string }; children: ReactElement };

/** The root Stack's `screenLayout`. Module-level so the navigator gets a stable reference. */
export function presentationScreenLayout({ options, children }: ScreenLayoutArgs): ReactElement {
  return <InPageSheet.Provider value={isPageSheet(options.presentation, Platform.OS)}>{children}</InPageSheet.Provider>;
}

/** The top offset this screen's frame clears: the safe-area top, or none inside an iOS page sheet. */
export function useScreenTopInset(): number {
  const insets = useSafeAreaInsets();
  return screenTopInset(insets.top, useContext(InPageSheet));
}
