import AsyncStorage from '@react-native-async-storage/async-storage';

import { pendingInvite } from '../invite/pendingInviteStore';
import { pendingTakeover } from '../invite/pendingTakeoverStore';
import { pendingRoute } from '../shell/pendingRoute';
import type { LeaverStateDeps } from './leaverStateCore';

// The real stores behind lib/account/leaverStateCore.ts (which has the reasoning). Shared by the plain sign-out and the
// end of an account deletion, so the two can never clear different sets.
export function leaverStateDeps(userId: string | null): LeaverStateDeps {
  return {
    clearPendingTakeover: () => pendingTakeover.clear(),
    clearPendingInvite: () => pendingInvite.clear(),
    clearPendingRoute: () => pendingRoute.forget(),
    removeItem: (key) => AsyncStorage.removeItem(key),
    userId,
  };
}
