---
applyTo: "apps/mobile/**"
---

# Reviewing `apps/mobile/` (Expo / React Native)

- **Logic belongs outside components.** Anything that computes a number, a label or a state goes in `lib/` or `components/sp/logic/`, as a pure function with a test in `apps/mobile/tests-deno/`. Flag money, score or date maths written inline in JSX.
- **Use the existing formatters.** Money, percent and date strings come from the shared helpers (`components/sp/logic/money.ts` and friends). A new `toFixed`, `toLocaleString` or hand-built "$" string is a finding.
- **Different numbers keep different names.** "Season gain" (points scored in matchups) and "since the draft" (value minus cost) are different quantities. Flag code that shows one under the other's label.
- **A screen must be reachable.** A new component that nothing imports, or a button that only renders inside an empty-state branch, is a bug even if it compiles.
- **Supabase calls** resolve to `{ data, error }` and do not throw. Flag an ignored `error`, and a loading state that can never end when a call fails.
- **Effects.** Flag an effect whose dependency is a fresh object or array on every render, a subscription or timer without cleanup, and state updates after unmount.
- **Dates and times** go through the shared helpers, not a new formatter. `Intl.DateTimeFormat` with an hour needs `hourCycle` set; Hermes mislabels the parts without it.
- **Large text.** Text that can be scaled by the phone's text-size setting must not be given a fixed height or a single-line clip that would cut it off.
- **Dev-only knobs** (capture and fixture switches) must stay behind `__DEV__` and must never change what a release build does.

Do not raise: `StyleSheet.create` at the bottom of the file, the file-top `no-use-before-define` disable that goes with it, or copy wording (strings are approved by the owner).
