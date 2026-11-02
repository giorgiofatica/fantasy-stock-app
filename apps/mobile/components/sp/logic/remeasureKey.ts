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
// Not covered: TextInput (a remount would drop focus and what's typed). Turning the native
// flag on would cover it, but that needs native code and a new build.

/** The key for a Text drawn at `fontScale`: equal for equal scales, different for different
 * ones. A non-finite scale gets one fixed key. */
export function fontScaleKey(fontScale: number): string {
  return Number.isFinite(fontScale) ? `fs-${fontScale}` : 'fs-unknown';
}
