// The two approved "Too many tries" lines, in ONE place (hoisted 2026-11-23 so a third flow could reuse
// them without a copy). Every screen that shows either imports it from here; the old names
// (JOIN_COPY.rateLimited, deleteCopy's TRY_LATER, leaveLeague's rate_limited line) now point at these.
// Pure and dependency-free, so tests-deno pins the bytes.
//
//   TOO_MANY_TRIES_WAIT   a short limit (an edge function's per-minute 429): joining a league, taking over a
//                         team, leaving a league, and a buy review paced per minute (record-trade).
//   TOO_MANY_TRIES_LATER  a long limit (an hour or a day): the account-deletion proof, a takeover code
//                         lockout, and a buy review past record-trade's hourly or daily cap (preview_limited).
//                         Never understate an hour's lockout with the short line.
//
// Approval: docs/PRODUCT_RULES.md, "Too many taps on 'Review buy' reuse the approved 'Too many tries'
// lines (B)" (2026-11-23), and the account-deletion / takeover rulings it names.
export const TOO_MANY_TRIES_WAIT = 'Too many tries. Wait a moment, then try again.';
export const TOO_MANY_TRIES_LATER = 'Too many tries. Try again later.';
