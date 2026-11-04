# A search placeholder keeps its old size after a live text-size change (`fix/search-placeholder-font-scale`)

P1 from the live font-scale sweep 2 (2026-11-03): after a live AX5 → L change the unfocused "Search by ticker or name..." field drew
its placeholder at AX5 size inside the L-size field (only "Search..." showed). Stills are outside the repo, in
`~/fantasy-stock-design-review/fix/search-placeholder-font-scale/` (`index.html` pairs main with the branch; `frames/` every PNG; `crops/`).
Base: main `91bdea5f`. Sim: iPhone 17e, iOS 27.0, Expo Go 54.0.7, light. L = `large`, AX5 = `accessibility-extra-extra-extra-large`.

## Cause

The key #319 put on the field is right, and the remount happens (a temporary log showed a render at `fontScale=1 key=fs-1 focused=false`).
A second remount 500 ms later changed nothing, and the native multiplier at L is correct (a field given `fontSize: 18 × fontScale` with native
scaling still ON drew L-size glyphs). The stale part is native state:

- A remount mounts a new native text field, but Fabric's mounting layer hands it a RECYCLED native view.
- `RCTTextInputComponentView.updateProps` diffs the new props against the view's OWN last props (`_props`, which `prepareForRecycle` never
  resets), not against the props it is passed.
- The placeholder is drawn from `defaultTextAttributes`, rebuilt (font size × the native multiplier) only when `textAttributes` differ from
  those last props. The scale is not in the props, so a field remounted onto a view that last drew at another size skips the rebuild and
  keeps that size's placeholder. The typed text is re-applied through state and is unaffected.
- Which view comes out of the pool depends on what the app mounted before, so the same change can heal one way and break the other.
  A FOCUSED field is not remounted at all and shows the same stale placeholder (Buy a stock, below).
- A prop that differs with the scale heals it: `letterSpacing` above React Native's float epsilon (0.005; my first probe was under it and
  did nothing), or an explicit `fontSize`.

## Fix

`scaledInputFont` (`components/sp/logic/remeasureKey.ts`) puts the scale in the props: `fontSize × fontScale` with `allowFontScaling` off, the size
iOS draws anyway (it scales fontSize and lineHeight only, `cappedType.ts`). `useInputRemountKey(...).fontProps(baseFontSize)` hands it to the host;
a credential host gets null (never remounts, #319's rule stands) and the focus-frozen key is unchanged (the keyboard rule stands). Applied to all
three hook hosts: `SymbolSearchField` (the room, the queue editor), Buy a stock's search, and `Field` (a caller's own `inputFontSize` still wins).

## What was checked (px off the reference, device px 1170×2532)

| Surface | Result |
|---|---|
| Draft room, on the clock: live AX5→L | main 13,299 px in the field region, branch 0 (vs cold L) |
| Draft room: L→AX5→L round trip | 0 on both |
| Queue editor, scrolled to the end: live L→AX5 | main 16,358, branch 0 (vs cold AX5); cold AX5 branch = main, 0 |
| Queue editor: live AX5→L | main 0 (pool state), branch 0 in the field region |
| Buy a stock, focused: live AX5→L / L→AX5 | main 33,293 / 20,763, branch 0 / 0 |
| Buy a stock, unfocused: live AX5→L / L→AX5 | 0 / text equal to cold AX5 but 1 device px (0.33 pt) lower |
| Buy a stock cold L / AX5 vs main | only the caret's blink phase |
| League settings (`Field`, League name): cold L / AX5 vs main | 0 / 13 px (one row, delta 1, a card edge) |

Not reproduced (named so nobody re-finds them as "unchecked"): an EMPTY `Field` with a placeholder (Create league step 4 / SlotBuilder "any")
going stale. The Stake and Budget fields are prefilled; SlotBuilder's three fields remount together and a L→AX5→L round trip left their
placeholders right. The cause above says it can happen with the right pool history, which is why `Field` takes the fix too.

## Not fixed (separate finding)

Create league › Price tiers › Add slot: after L → AX5 → L the three fields (Stocks / Min / Max) keep a wider layout and Max is cut off. A stale
container layout (the #318 class), not a placeholder. Frames: `main-slot-L-before.png`, `main-slot-L-after-AX5-b.png`.

## Not touched

The league switcher's action row (the sweep's P2, accepted by the Design Lead): its cause is a container's flex split (the #318 class),
not the placeholder mechanism above, so this change does not explain or affect it.
