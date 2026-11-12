// The numbers and the decisions behind the sheet bar (components/shell/SheetBar.tsx), pure so tests-deno can pin them
// (Giorgio, 2026-11-12, "B and no, hitting back or x just closes it"; PRODUCT_RULES, the top-bar amendment under
// "A sheet's top must not be a stuck block that cuts text").

/** The bar's words (title, Save) stop growing here, as iOS's own bars do, so the ×, the title and Save never collide at the
 * largest text size. The rows under the bar grow fully. */
export const SHEET_BAR_MAX_SCALE = 1.3;

/** The bar's height, under the sheet's top edge ("~56 pt"). */
export const SHEET_BAR_HEIGHT = 56;

/** The × and Save sit in side slots of this width, so the title stays centred whether or not the sheet can save. */
export const SHEET_BAR_SIDE = 80;

/** The bar's side gutter: the × glyph and Save's last letter both sit this far from the sheet's edge (DL gate: Save was 8.7 pt from the edge, the × 19.7 pt). */
export const SHEET_BAR_GUTTER = 20;

/** The × is a 24 pt glyph (the `tab` icon role) centred in its 44 pt target. */
export const SHEET_BAR_CLOSE_GLYPH = 24;

/** The ×'s hit area (rule 3, 44 pt). */
export const SHEET_BAR_TARGET = 44;

/** The divider under a scrolled bar. */
export const SHEET_EDGE_DIVIDER = 1;

/** The fade under a scrolled bar: the bar's own colour, SOLID for at least one line of the sheet's row text at the current text size,
 * then clear over the next SHEET_EDGE_FADE_CLEAR pt (Design Lead, gate on 4def77bc: a fixed 6 pt band could not cover a 15-17 pt row line,
 * so the lower half of a row straddling the divider stayed legible with its top sliced). The solid part is a formula, not a constant:
 * 16 pt x min(fontScale, 3), so it grows with the text. */
export const SHEET_EDGE_ROW_TEXT = 16;
export const SHEET_EDGE_ROW_SCALE_CAP = 3;
export const SHEET_EDGE_FADE_CLEAR = 20;

const usable = (fontScale: number): number => (Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1);

/** The fade's solid band, in pt: one row line at the current text size. */
export function sheetFadeSolid(fontScale: number): number {
  return SHEET_EDGE_ROW_TEXT * Math.min(usable(fontScale), SHEET_EDGE_ROW_SCALE_CAP);
}

/** The fade's whole height: the solid band, then SHEET_EDGE_FADE_CLEAR pt of fade to clear. */
export function sheetFadeHeight(fontScale: number): number {
  return sheetFadeSolid(fontScale) + SHEET_EDGE_FADE_CLEAR;
}

/** The divider and the fade show only once the content has scrolled under the bar: at the top (and while pulled down past
 * it) neither shows. */
export function sheetEdgeShown(contentOffsetY: number): boolean {
  return contentOffsetY > 0;
}

/** Where the fade's gradient stops go: solid through the band, clear at the bottom edge. */
export function sheetFadeLocations(fontScale: number): [number, number, number] {
  return [0, sheetFadeSolid(fontScale) / sheetFadeHeight(fontScale), 1];
}

/** What the bar's Save shows. `off`: grey and inert (nothing differs from what was loaded). `on`: the accent, a tap saves.
 * `saving`: inert, with progress in place of nothing moving. */
export type SaveState = 'off' | 'on' | 'saving';

/** Save is on only while the form differs from what was loaded and nothing is being saved. `dirty` is derived by comparing
 * against the loaded values (lib/game/settingsDirty.ts), never a "touched" flag, so changing a value back to its original
 * turns Save grey again. */
export function saveState(a: { dirty: boolean; saving: boolean }): SaveState {
  if (a.saving) return 'saving';
  return a.dirty ? 'on' : 'off';
}

/** A grey or a saving Save does nothing when tapped (and VoiceOver reads it as dimmed). */
export function saveInert(state: SaveState): boolean {
  return state !== 'on';
}

/** The title's base size (the `headline` text role) and the size a text field in its place draws at: the field scales by hand (it
 * is keyed by the text size, components/sp/useInputRemountKey.ts), so its explicit size is capped here at the bar's 1.3x. */
export const SHEET_BAR_TITLE_SIZE = 17;
export function sheetBarFieldSize(scaledSize: number | undefined): number {
  const cap = SHEET_BAR_TITLE_SIZE * SHEET_BAR_MAX_SCALE;
  if (scaledSize === undefined || !(scaledSize > 0)) return SHEET_BAR_TITLE_SIZE;
  return Math.min(scaledSize, cap);
}

/** The rename pencil is drawn at the title's cap height (the title's base size), scaling with the text up to the bar's 1.3x, so it reads as a
 * pencil beside the title at every size (an icon-role size grew past the capped title). */
export function sheetBarPencilSize(fontScale: number): number {
  return SHEET_BAR_TITLE_SIZE * Math.min(Math.max(usable(fontScale), 1), SHEET_BAR_MAX_SCALE);
}
