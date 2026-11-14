import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../supabase';
import { signOutOfGoogle } from '../auth/socialSignIn';
import { endSessionCore } from './endSessionCore';
import { leaverStateDeps } from './leaverState';
import { forceSignedOut } from './forcedSignOut';

// Account deletion (W4) — after {ok:true} (or a committed `stage`): the server deleted, or is finishing the deletion of,
// the auth user, so this phone's session is dead. lib/account/endSessionCore.ts has the reasoning and the branches; this
// binds the real client, storage and stores. The one-time line is raised by the caller BEFORE this runs, so Sign in shows
// it from its first render.
export async function endSessionAfterDeletion(userId: string | null): Promise<void> {
  await endSessionCore({
    ...leaverStateDeps(), // the pending takeover, invite and route: the same set a plain sign-out clears
    signOutLocal: () => supabase.auth.signOut({ scope: 'local' }),
    removeItem: (key) => AsyncStorage.removeItem(key),
    forceSignedOut,
    signOutOfGoogle,
    userId,
  });
}
