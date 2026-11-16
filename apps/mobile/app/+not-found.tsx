import { router, Stack } from 'expo-router';

import { RefusalScreen } from '@/components/shell/RefusalScreen';
import { NOT_FOUND } from '@/lib/shell/deadLinkCopy';

// 3f — Not found (1.2.0; board key-screens.html #not-found; the dead-end family's form since 2026-11-16, board #call-dead-links, B).
// Every bad deep link lands here: a calm dead end with ONE way out. Replaces the Expo default ("Oops!").
//
// - No tab bar and no back arrow, and the swipe-back is off: a cold-start link has nothing behind it to go back to.
// - "Go to Home" REPLACES the stack (pops to the root, then replaces it), so the dead end can't be reached again with Back. Signed
//   out, Home is guarded and sends the user to sign-in, exactly as a cold start does.
function goHome() {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
}

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <RefusalScreen
        icon={NOT_FOUND.icon}
        heading={NOT_FOUND.heading}
        line={NOT_FOUND.line}
        primary={{ label: NOT_FOUND.primary, onPress: goHome }}
      />
    </>
  );
}
