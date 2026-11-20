/**
 * barsFault (capture only): remove daily bars from the capture seam's fixture, so the value line's
 * missing-data states can be seen (the Planner's no-invented-stretch rule, 2026-11-18). Pure and
 * dependency-free, so tests-deno pins it; devSeam.ts reads the env behind SEAM_ON, production never does.
 */
// EXPO_PUBLIC_CAPTURE_BARS removes daily bars from the seam's fixture, so the value line's missing-data states can
// be seen: `from:2026-09-10` (no stock has a bar before that day: the 407-day clamp), `late:AAPL:2026-09-10` (one
// stock's bars begin that day), `gap:NVDA:2026-09-08:2026-09-14` (one stock has no bars in that range, inclusive),
// `none` (no bars at all). Anything else: no fault. Pure; devSeam.ts reads the env behind SEAM_ON.

export type BarsFault =
  | { kind: 'from'; date: string }
  | { kind: 'late'; symbol: string; date: string }
  | { kind: 'gap'; symbol: string; from: string; to: string }
  | { kind: 'none' };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function parseBarsFault(raw: string | null | undefined): BarsFault | null {
  if (!raw) return null;
  const [kind, a, b, c] = raw.split(':');
  if (kind === 'none' && a === undefined) return { kind: 'none' };
  if (kind === 'from' && a && ISO.test(a)) return { kind: 'from', date: a };
  if (kind === 'late' && a && b && ISO.test(b)) return { kind: 'late', symbol: a.toUpperCase(), date: b };
  if (kind === 'gap' && a && b && c && ISO.test(b) && ISO.test(c)) return { kind: 'gap', symbol: a.toUpperCase(), from: b, to: c };
  return null;
}

/** `bars` (one symbol's closes) with the fault applied. */
export function applyBarsFault(symbol: string, bars: { date: string; close: number }[], fault: BarsFault | null): { date: string; close: number }[] {
  if (!fault) return bars;
  const sym = symbol.toUpperCase();
  switch (fault.kind) {
    case 'none': return [];
    case 'from': return bars.filter((b) => b.date >= fault.date);
    case 'late': return sym === fault.symbol ? bars.filter((b) => b.date >= fault.date) : bars;
    case 'gap': return sym === fault.symbol ? bars.filter((b) => b.date < fault.from || b.date > fault.to) : bars;
  }
}
