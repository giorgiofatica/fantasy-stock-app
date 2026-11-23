// Stockpile — the gap between the parts of a gain line, given to the LAYOUT instead of a space
// character (the Design Lead's P3, 2026-11-22; Giorgio's phone at AX5).
//
// Why: a gain line is a wrapping row of units — the dollars, the percent in brackets, the grey
// words ("season gain", "today"). The gap between two units used to be a literal space INSIDE the
// next unit's string (`" today"`, `" ("`, `" · "`), and a space that begins a Text survives a wrap:
// the wrapped part started its new line indented by one space. The strings now carry no gap and the
// row carries `columnGap`, which exists only BETWEEN two units on the same line, so a wrapped line
// starts flush.
//
// The width is a space's own: 0.205 em, Archivo-Medium's space advance (the callout face; Regular
// is 0.209 and Bold 0.196, so the largest gap against the glyph it replaces is ~0.1 pt at 13 pt).
// It scales with Dynamic Type exactly as the glyph did, up to the line's own cap (the explicit
// size cappedType.ts applies is fontSize × cap, so the gap uses the same product). Pure, for
// tests-deno.

/** One space, in em: Archivo-Medium's advance for U+0020 (unitsPerEm 1000, advance 205). */
export const SPACE_EM = 0.205;

/** The gap, in points, that stands in for one space of a `fontSize` line at `fontScale`, under `cap`. */
export function gainGap(fontSize: number, fontScale: number, cap?: number): number {
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const applied = cap === undefined ? scale : Math.min(scale, cap);
  return fontSize * applied * SPACE_EM;
}
