/**
 * A label must never break mid-word (Design Lead rule, 2026-10-19; the label-no-midword round). A row keeps its one-line
 * layout (label beside its value, chevron or switch) until the label's own text breaks inside a word; only then does it
 * stack, the value and control dropping under the label. This is the pure check on the label Text's `onTextLayout`
 * lines: a line that ends without a space or a hyphen, and is not the last, has been broken inside a word.
 */
export interface LabelLine {
  text: string;
}

/** A word break is a space or a hyphen (the ASCII one, or U+2010 to U+2015). Anything else at a line's end is a break inside a word. */
const WORD_BOUNDARY_END = /[\s\-\u2010-\u2015]$/;

export function labelBreaksMidWord(lines: readonly LabelLine[]): boolean {
  return lines.some((line, i) => i < lines.length - 1 && line.text.length > 0 && !WORD_BOUNDARY_END.test(line.text));
}

/** A label column narrower than any one glyph (a value and a control took the whole row) has lost its label altogether:
 * it reports no broken lines, because there is no room for a line. 12pt is under one glyph at the smallest text size. */
export const LABEL_COLLAPSED_PT = 12;

export function labelCollapsed(width: number): boolean {
  return width < LABEL_COLLAPSED_PT;
}

/**
 * The row's memory of a break: the text size (fontScale) at which its label broke, or null. It LATCHES: once a label has
 * broken at a size the row stacks, the label then has the whole row and reports no break, and that "no break" must not
 * un-stack it (it would break again: a layout loop). It only re-evaluates when the text size changes.
 */
export type LabelSignal = { kind: 'lines'; lines: readonly LabelLine[] } | { kind: 'width'; width: number };

export function nextBrokeAt(brokeAt: number | null, fontScale: number, signal: LabelSignal): number | null {
  const broke = signal.kind === 'lines' ? labelBreaksMidWord(signal.lines) : labelCollapsed(signal.width);
  return broke ? fontScale : brokeAt;
}

/**
 * Where a stacked row's sub-line goes (Design Lead gate, AX5, 2026-11-02): a stacked row reads label, then VALUE, then the
 * sub-line. With the sub inside the label's block, "You" landed six lines below "Commissioner", right after "...after the
 * season.", and read as part of the caption. Only a STACKED row with a sub-line moves it; a row laid out beside (every size
 * where the label fits) keeps its sub under its label, so nothing moves there.
 */
export function subAfterValue(stacked: boolean, sub: string | undefined): boolean {
  return stacked && !!sub;
}

/** Stacked only for the text size at which the label broke; a different size starts over beside. */
export function isStacked(brokeAt: number | null, fontScale: number): boolean {
  return brokeAt === fontScale;
}

/**
 * A stacked row's value, measured: how many lines it ran to, and at which text size (fontScale). A value that runs to
 * several lines reads left-aligned; one line keeps its right alignment. Like the label's latch, the count belongs to the
 * size it was measured at: after a live Dynamic Type change React Native keeps the old count until something re-measures,
 * so a count from another size reads as one line (the default) until the row reports again.
 */
export interface MeasuredLines {
  fontScale: number;
  lines: number;
}

export function valueLinesAt(measured: MeasuredLines, fontScale: number): number {
  return measured.fontScale === fontScale ? measured.lines : 1;
}
