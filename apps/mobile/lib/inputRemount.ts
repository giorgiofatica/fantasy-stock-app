// Stockpile — which TextInput hosts may be remounted when the text size changes. Pure, for
// tests-deno. The remount itself is components/sp/useInputRemountKey.ts (cause: remeasureKey.ts).
//
// A CREDENTIAL host is never remounted (Design Lead rulings, 2026-11-02): remounting a filled
// password field, or the filled account identifier (email / username) beside one, makes iOS read
// the form as torn down and raise its "Save Password?" sheet, which could store a half-typed
// password. The cost is that masked dots and credential emails keep the old text size after a
// live text-size change, until the field is focused or the screen reopens.
//
// A host IS a credential host by what it is, not by what it currently shows: any one of
//   password:   secureTextEntry, textContentType 'password' / 'newPassword',
//               autoComplete 'current-password' / 'new-password';
//   identifier: textContentType 'username' / 'emailAddress', autoComplete 'username' / 'email'.
// So a show-password toggle that turns secureTextEntry off on a field that holds a password
// cannot move it into the remount path (iOS keys its save heuristic on the content type too).

export interface RemountProps {
  secureTextEntry?: boolean;
  textContentType?: string;
  autoComplete?: string;
}

const CREDENTIAL_CONTENT_TYPES: readonly string[] = ['password', 'newPassword', 'username', 'emailAddress'];
const CREDENTIAL_AUTO_COMPLETE: readonly string[] = ['current-password', 'new-password', 'username', 'email'];

/** True for a plain field that is remounted on a text-size change; false for a credential host. */
export function remountOnScaleChange(props: RemountProps): boolean {
  if (props.secureTextEntry) return false;
  if (props.textContentType !== undefined && CREDENTIAL_CONTENT_TYPES.includes(props.textContentType)) return false;
  if (props.autoComplete !== undefined && CREDENTIAL_AUTO_COMPLETE.includes(props.autoComplete)) return false;
  return true;
}
