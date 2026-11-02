// Stockpile — the React key that makes a Text re-measure after a Dynamic Type change. Pure,
// for tests-deno.
//
// The bug (P1, 2026-10-30, Giorgio's iPhone, 1.3.0 (7), largest accessibility size): Home's
// meta line showed only the tops of its glyphs, and the gain line lost "season gain", "today"
// and its "·"s, while the digits beside them drew fine. One launch at the same size was
// correct. Reproduced in the simulator by changing the text size with Home open, either way
// (docs/design/captures/home-hero-large-text/README.md).
//
// Cause, in React Native 0.81's Fabric renderer: when iOS changes the content size category,
// RCTFabricSurface commits the new `fontSizeMultiplier`, but SurfaceHandler::constraintLayout
// dirties text measurements only behind `enableFontScaleChangesUpdatingLayout`, a native
// feature flag that defaults to false. A paragraph is re-measured only when it gets new props
// (ParagraphShadowNode::shouldNewRevisionDirtyMeasurement). So a Text that scales natively
// and whose props do not change keeps the box measured at the OLD multiplier and draws its
// glyphs at the new one: clipped when the text grew, spread out when it shrank. Texts that DID
// change survived: a capped Text switches to an explicit size (cappedType.ts), RollingMoney
// switches to its one-Text path (rollDigits.ts), and a ticking value re-renders.
//
// The fix: every Text host (the sp Text primitive and the raw RN Texts outside it) is keyed by
// the scale, so a scale change remounts it, and a new node is measured at the current
// multiplier. JS learns the new scale from the same iOS notification (RCTAccessibilityManager
// → didUpdateDimensions → useWindowDimensions). While the scale holds, the key holds, so
// nothing remounts and nothing renders differently at any fixed size.
//
// TextInput (2026-11-02, Design Lead ruling): an UNFOCUSED filled field kept its text at the
// old glyph size inside a grown box, while a focused one updated natively. So a TextInput host
// is keyed by the scale only while it is unfocused (inputRemountKey): a focused field keeps the
// key it took focus with (a remount would drop the keyboard), and on blur it takes the current
// key, so a size change made while typing settles at blur with one remount. The fields are
// controlled, so the value survives; a remounted field must not re-run `autoFocus`
// (remountAutoFocus), or a size change would raise the keyboard on its own. Turning the native
// flag on would cover all of this, but that needs native code and a new build.

/** The key for a Text drawn at `fontScale`: equal for equal scales, different for different
 * ones. A non-finite scale gets one fixed key. */
export function fontScaleKey(fontScale: number): string {
  return Number.isFinite(fontScale) ? `fs-${fontScale}` : 'fs-unknown';
}

/** The key for a TextInput host: the key it took focus with while it is `focused` (frozen, so
 * the keyboard stays up), the current scale's key while it is not. */
export function inputRemountKey(focused: boolean, keyAtFocus: string, currentKey: string): string {
  return focused ? keyAtFocus : currentKey;
}

/** The `autoFocus` a TextInput host gets: the caller's, on its first mount only. A host remounted
 * for a scale change must not take focus by itself. */
export function remountAutoFocus(autoFocus: boolean | undefined, remounted: boolean): boolean | undefined {
  return remounted ? false : autoFocus;
}
