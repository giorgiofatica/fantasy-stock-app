// A two-sentence refusal on a takeover or invite link becomes a heading and a what-to-do line (PRODUCT_RULES, "Every dead end on a
// takeover or invite link takes the same form"; board #call-refusal-family). The source strings stay whole, so the words live in ONE
// place; the split happens at render, at the FIRST ". ". Pure.
//
//   "This invite link doesn't work anymore. Ask for a new one."  →  heading "This invite link doesn't work anymore."
//                                                                   line    "Ask for a new one."
//
// Always `heading + ' ' + line === text` (the full stop stays with the heading). Only call it on the four fixed refusal strings:
// a sentence that carries a name ("You're already in St. Louis.") has a ". " the person typed, and is never split.

export interface SplitRefusal {
  heading: string;
  line?: string;
}

export function splitRefusal(text: string): SplitRefusal {
  const i = text.indexOf('. ');
  if (i < 0) return { heading: text };
  return { heading: text.slice(0, i + 1), line: text.slice(i + 2) };
}
