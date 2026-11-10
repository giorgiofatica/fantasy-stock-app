// Stockpile — the lockup's wordmark size (build 13, Giorgio's recording of 1.3.0 (12): "Stockpil", the final "e" cut). Pure, for tests-deno.
//
// WHAT THE RECORDING SHOWS. The wordmark (`title`, Archivo Bold 22) is the only Text on the auth screens whose box HUGS its glyphs: every other
// line sits in a full-width column, so a box that is a little narrow than its text never shows. In the frames the box is ~87-89pt wide and the
// glyphs are drawn at full size; Archivo Bold 22 "Stockpile" is 99.07pt (CoreText, measured from assets/fonts/archivo/Archivo-Bold.ttf). The
// box is ~0.88-0.90 of the text: a box measured at ANOTHER font scale than it is drawn at (Archivo Bold at 0.882, iOS's Small, is 87.4pt).
// That is the stale-measure family of lib/sp remeasureKey.ts: Fabric re-measures a natively scaled Text only on new props, so any path that
// leaves the native multiplier at measure time and at draw time out of step clips the one Text that hugs its content.
//
// THE FIX. The wordmark carries its scale in its PROPS: an explicit fontSize / lineHeight (the size native scaling would have drawn, never above
// the title's own cap) with `allowFontScaling` off. Measure and draw then use the same number and no native multiplier is involved, so they
// cannot disagree. At every scale the glyphs are the size they were: the same x fontScale the system would have applied, capped where
// the `title` variant caps (1.6), so nothing looks different.

/** The wordmark's base size: `title` (22) with the lockup's own 26pt line (BrandBars.tsx). */
export const WORDMARK_FONT_SIZE = 22;
export const WORDMARK_LINE_HEIGHT = 26;

export interface WordmarkSize {
  fontSize: number;
  lineHeight: number;
}

/** The size the wordmark is drawn at for a system `fontScale`, capped at `cap`. A nonsense scale (0, NaN) reads as 1, never as a collapsed or huge wordmark. */
export function wordmarkSize(fontScale: number, cap: number): WordmarkSize {
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? Math.min(fontScale, cap) : 1;
  return { fontSize: WORDMARK_FONT_SIZE * scale, lineHeight: WORDMARK_LINE_HEIGHT * scale };
}
