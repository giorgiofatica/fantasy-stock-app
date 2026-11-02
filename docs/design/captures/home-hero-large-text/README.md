# Home hero at large text sizes: captures (`fix/home-hero-large-text`)

P1 from Giorgio's iPhone (1.3.0 (7), Larger Accessibility Sizes at max, 2026-10-30). Home's meta
line ("Your team" / "2nd of 4 · 2–0 · Week 3 of 11") showed only the tops of its glyphs. The gain
line lost "season gain", "today" and its "·"s; once a "·" started a line, against the keepDots
rule. One launch at the same size rendered correctly.

The stills are outside the repo, in `~/fantasy-stock-design-review/fix/home-hero-large-text/`.
`index.html` there pairs every before with its after. `phone-frames/` has two frames from
Giorgio's recordings.

## Cause

React Native 0.81's Fabric renderer does not re-measure a Text when the iOS text size changes,
unless that Text's props change too.

- On `UIContentSizeCategoryDidChange`, `RCTFabricSurface` commits the new `fontSizeMultiplier`.
  `SurfaceHandler::constraintLayout` dirties text measurements only behind the native feature
  flag `enableFontScaleChangesUpdatingLayout`, which defaults to `false`
  (`ReactNativeFeatureFlagsDefaults.h`).
- `ParagraphShadowNode::shouldNewRevisionDirtyMeasurement` re-measures only on new props.
- So a Text that scales natively and gets no new props keeps the box from the old scale, while
  its glyphs draw at the new one. When the text grew, the box clips it (the meta line, "season
  gain"). When it shrank, the line spreads out.

Why only the hero's words broke, and its digits did not:

- A **capped** Text switches to an explicit size once its cap engages (`cappedType.ts`). That is
  new props, so it is re-measured. This covers the league pill, the chart labels and "THIS WEEK".
- **RollingMoney** switches to its one-Text path above the large-text line (`rollDigits.ts`).
  Those are new nodes, so they are measured fresh. A ticking value also re-renders.
- The hero's `caption` / `callout` sp Texts have **no cap** and **static props**. Nothing makes
  them re-measure.

RN's own LogBox header ("Log 1 of 27") clipped the same way on the simulator, which points to the
framework, not to this screen.

## Triggers (simulator, Expo Go SDK 54, "calm-home 17e" / "calm-home 17 Pro")

| Trigger | Result on main |
|---|---|
| Clean cold launch at XXXL | correct (matches `gn-w4-home/04-live_open-xxxl-17e-light.png`) |
| Pull-to-refresh after a cold XXXL launch | correct (only the live dot differs, 962 px) |
| Live value ticks after first paint (a temporary DEV tick, not committed) | correct |
| **Text size changed with Home open, Large → XXXL** | **broken**: identical to the phone |
| **Text size changed with Home open, XXXL → AX XL** | **broken**: the line spreads out (364,450 px off the cold AX XL frame) |

The phone's fresh-install launch fits the same mechanism: the native multiplier changed after
Home's first layout. The live changes above are the reproducible form of it. While the bug was
showing, the capped Texts on the same screen had already switched to explicit sizes. That means JS
also saw the new scale (`useWindowDimensions`), which is the signal the fix keys on.

## Fix

`components/sp/logic/remeasureKey.ts`: every Text host is keyed by `fontScaleKey(fontScale)`.
A text-size change remounts it, and a new node is measured at the current multiplier. The hosts
are the sp `Text` primitive (both branches), RollingMoney (its one-Text path and each digit
column), ScoreDigits, PhaseChip, Money, and SymbolSearchField's three popovers.

The `TextInput` is deliberately not keyed, because a remount drops focus. While the scale holds,
the key holds, so nothing renders differently at any fixed size.

A fuller, native alternative (follow-up, needs a native build): turn on
`enableFontScaleChangesUpdatingLayout`. It also covers TextInput.

## Measurements (from pixels, one build per side: main `e2cf123b` / this branch)

- **L vs main: 0 px**, full frame, on 17e and 17 Pro, light and dark. Measured on `live_closed`,
  whose dots do not pulse.
- `live_open` L, before vs after: only the two pulsing dots differ (the chart's end dot and the
  LIVE chip's dot; boxes about 56 px and 36 px).
- After, **live change Large → XXXL vs a cold XXXL launch**: only the pulsing end dot differs, on
  all four phone × theme pairs. The hero region is 0 px.
- After, **live change XXXL → AX XL vs a cold AX XL launch**: 2,217 px, the end dot only.
- XXXL cold, before vs after: the end dot only. The fix does not change any approved XXXL screen.

## Stills

| Files | What |
|---|---|
| `live_open-{L,XXXL}-{17e,17pro}-{light,dark}-{before,after}.png` | cold launches |
| `live_open-trigger-L-to-XXXL-{17e,17pro}-{light,dark}-{before,after}.png` | **the trigger**: launched at Large, then the text size changed to XXXL with Home open |
| `live_open-trigger-XXXL-to-AXL-17e-light-{before,after}.png`, `live_open-AXL-17e-light-*` | the shrink direction, and its cold reference |
| `live_closed-L-*-{before,after}.png` | the strict L pixel diff |
| `repro/tick-hack_*` | the temporary DEV tick (main + hack): ticks alone are fine; a live change still breaks the non-ticking Texts |
