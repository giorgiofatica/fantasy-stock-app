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
// (remountAutoFocus), or a size change would raise the keyboard on its own. A credential host (a
// password or its email) is never remounted at all (lib/inputRemount.ts: iOS would offer to save
// a half-typed password).
//
// The PLACEHOLDER (P1, live font-scale sweep 2, 2026-11-03: the draft room's "Search by ticker or
// name..." kept its AX5 size in an L-size field after AX5 -> L, on the on-the-clock room and the
// queue editor, though the field was already keyed by the scale). Isolated in the simulator:
//  - the remount DID happen (the host rendered with the new key at the new fontScale), a second
//    remount 500 ms later changed nothing, and the native multiplier at L is correct (a field given
//    an explicit fontSize x fontScale with native scaling still ON drew L-size glyphs);
//  - the cause is Fabric's view recycling. A remount unmounts the old native text field and mounts
//    a new one, but the mounting layer hands the new node a RECYCLED native view, and
//    RCTTextInputComponentView.updateProps diffs the new props against the view's OWN last props
//    (`_props`, which prepareForRecycle never resets), not against the props it was passed. The
//    placeholder is drawn from `defaultTextAttributes`, which are rebuilt (font size x the native
//    multiplier) ONLY when `textAttributes` differ from those last props. The scale is not in the
//    props, so a field remounted onto a view that last drew at another size sees identical
//    attributes, skips the rebuild, and keeps that size's placeholder; the typed text is re-applied
//    through state and is unaffected. Which view comes out of the pool depends on what the app
//    mounted before, so the same change can heal one way and break the other;
//  - a prop that DOES differ with the scale heals it (a letterSpacing above RN's float epsilon, or
//    an explicit fontSize), so the fix puts the scale in the props: scaledInputFont.
// Turning the native flag on would cover all of this, but that needs native code and a new build.

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

/** The key a TextInput host takes: the scale-driven key (inputRemountKey) when the host may be
 * remounted, the key it mounted with, forever, when it may not (a credential host,
 * lib/inputRemount.ts). */
export function inputHostKey(remounts: boolean, keyAtMount: string, scaledKey: string): string {
  return remounts ? scaledKey : keyAtMount;
}

/** The `autoFocus` a TextInput host gets: the caller's, on its first mount only. A host remounted
 * for a scale change must not take focus by itself. */
export function remountAutoFocus(autoFocus: boolean | undefined, remounted: boolean): boolean | undefined {
  return remounted ? false : autoFocus;
}

/** The explicit size props for a TextInput host, so the scale is in its props: `fontSize` x `fontScale`
 * with native scaling off, which iOS draws at the size it would scale `baseFontSize` to itself (it scales
 * fontSize and lineHeight and nothing else, cappedType.ts), but which makes a recycled native view see
 * a different `textAttributes` whenever the scale differs and so rebuild its placeholder attributes
 * (see "The PLACEHOLDER" above). Null when the host takes no explicit size: one that may not remount
 * (a credential host, lib/inputRemount.ts), a base size that is not positive, or a non-finite scale
 * (it scales natively then). */
export function scaledInputFont(
  baseFontSize: number,
  fontScale: number,
  remounts: boolean
): { fontSize: number; allowFontScaling: false } | null {
  if (!remounts || !(baseFontSize > 0) || !Number.isFinite(fontScale) || !(fontScale > 0)) return null;
  return { fontSize: baseFontSize * fontScale, allowFontScaling: false };
}
