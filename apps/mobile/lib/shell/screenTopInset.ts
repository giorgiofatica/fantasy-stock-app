// How far a screen's own frame starts below its top edge (build 14, League settings: a ~70pt empty
// band above "Cancel"). The safe-area top inset is the status bar's height, measured once for the
// whole window. A full-screen screen (a tab, a push, `fullScreenModal`) starts under the status bar,
// so it must clear it. An iOS page sheet (`presentation: 'modal'`) is drawn by UIKit BELOW the status
// bar already, so clearing it again inside the sheet spends the inset twice.
//
// Pure, so tests-deno can pin it; components/shell/ScreenPresentation.tsx is the React side (the
// root Stack's `screenLayout` learns the presentation from the screen's own options).

/** The `presentation` values iOS draws as a sheet that already starts below the status bar.
 * `modal` is UIModalPresentationAutomatic, a page sheet on iPhone since iOS 13 (react-native-screens
 * src/types.tsx). The app is portrait-only and iPhone-only (app.json), so a page sheet never turns
 * full-screen in compact height here. */
export const IOS_SHEET_PRESENTATIONS: readonly string[] = ['modal', 'pageSheet', 'formSheet'];

/** True only where the platform draws the screen as a sheet below the status bar. Android: every one
 * of these presentations is a full-screen push in react-native-screens ("On Android this is
 * equivalent to `push`"; formSheet is a bottom sheet the app does not use), and the app is
 * edge-to-edge (app.json `edgeToEdgeEnabled`), so content there sits under the status bar and keeps
 * the inset. */
export function isPageSheet(presentation: string | undefined, os: string): boolean {
  return os === 'ios' && presentation !== undefined && IOS_SHEET_PRESENTATIONS.includes(presentation);
}

/** The top offset inside a page sheet: none. The sheet's edge is already the safe edge, and each frame
 * keeps its own spacing below the offset (SetupScaffold's 44pt back row, ShellHeader's space[3]), so a
 * sheet and its full-screen sibling (League settings and Create league share SetupScaffold) draw the
 * frame identically below their safe edge. */
export const SHEET_TOP_INSET = 0;

/** The offset a screen's frame clears at its top: the safe-area inset, or none inside a page sheet. */
export function screenTopInset(safeAreaTop: number, inPageSheet: boolean): number {
  return inPageSheet ? SHEET_TOP_INSET : safeAreaTop;
}
