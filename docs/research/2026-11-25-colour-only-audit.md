# Where the app uses colour to mean something (2026-11-25)

For the plan [`plans/2026-11-25-colour-blind-setting.md`](../plans/2026-11-25-colour-blind-setting.md).
Asked for by the Planner. Read on `main` at `8ad4d60c` by a read-only subagent; nothing was run
and no screen was looked at. The Planner spot-checked four of its claims against the code
(the Stocks chips, the money sign, the draft clock's last ten seconds, the design rule) and
they held. Everything else is the subagent's reading. Paths are under `apps/mobile/` unless
they start with `docs/`.

## Short answer

The app mostly keeps its own rule, "Colour is never the only code"
(`docs/design/DESIGN_DIRECTION.md:657-660`). A gain or a loss always carries a sign, a
result is a letter in neutral ink, and "you" is a ring, a bolder name and the left side as
well as blue. Colour does the work **alone in four places** and **partly in nine**. No test
catches colour used alone; contrast is tested.

There is no claim colour in the app: the claims screens are not built
(`components/stocks/StocksScreen.tsx:11`). Warnings use the accent colours, not yellow.

## Colour alone (4)

| Where | What the colour means | What else carries it | Code |
|---|---|---|---|
| Stocks tab chips (categories, Top movers) | the selected chip | nothing a sighted person sees: fill and ink change, the weight does not. VoiceOver gets `selected` | `components/stocks/StocksScreen.tsx:323-330` |
| The shared `Chip` (Create league budget presets) | selected | fill and ink only; the field above shows the value | `components/sp/Chip.tsx:29-46`; `app/create-league.tsx:523` |
| Stepper minus and plus | the button is at its limit | the icon goes paler, nothing else | `components/game/Stepper.tsx:86,93` |
| Draft clock, last ten seconds | time is almost up | the ring and digits turn the loss colour. The digits always show the time and there is one warning haptic; nothing visual changes but colour (counted as "partly" by the subagent, as "alone" by the plan, since the colour change is the only signal that the state has changed) | `components/game/DraftRoom.tsx:182,190-196`; `lib/game/draftClockCard.ts:40`; `components/sp/gn/ClockRing.tsx:46` |

## Partly colour (9)

| Where | What the colour means | What else carries it | Code |
|---|---|---|---|
| SegmentedControl | the selected half | a lighter slab on a darker track, and darker text; no weight change | `components/sp/SegmentedControl.tsx:57-60,82,99` |
| Sign in / forgot password, a wrong field with no field error | the field is wrong | a red border the same width as the focused one; the words are in the message below | `components/shell/Field.tsx:89-91`; `app/login.tsx:154,171` |
| FormMessage | an error, not a note | colour only; no icon; the wording differs | `components/shell/FormMessage.tsx:36` |
| Bracket | winner and loser | the winner is bolder; "won" is only in the VoiceOver label | `components/game/BracketView.tsx:88-95` |
| Leave league row | disabled | paler; an optional line says why | `components/game/LeaveLeagueSheets.tsx:36-37` |
| A deleted manager's seat | a placeholder, not a person | paler name; the mark is a person glyph | `components/sp/useSeatInk.ts:13`; `components/sp/Avatar.tsx:67-69` |
| How-it-works cap bar | which stock is which segment | a legend in the same order, and the widths | `components/game/InfoVisuals.tsx:154-172` |
| Draft blockers, the playoff stepper | this needs fixing | a coloured border, inside a card that has a title | `components/game/DraftBlockersCard.tsx:159`; `components/game/Stepper.tsx:83` |
| Home, the current week's tile | this week | a tint and a thicker outline; "Live" only while the market is open | `components/home/YourSeason.tsx:115-116,159` |

## Not colour alone (already sound)

| What | What carries it besides colour | Code |
|---|---|---|
| A gain or a loss, everywhere money is shown | "+" or "−" from `formatMoney` / `formatPercent` with `sign: 'always'`; a flat figure has neither | `components/sp/logic/money.ts:115-123,147`; `components/sp/Money.tsx:53-59` |
| Today's change in the Stocks, movers and watching lists | "+" or "−" written by `changeText` | `lib/stocks/rowQuotes.ts:57` |
| Chart lines (Portfolio, stock sheet, player card) | one line only; the signed gain line above it | `components/sp/gn/Chart.tsx:116-117,172`; `components/sp/gn/RangeGainLine.tsx:43-46` |
| Range pills and segment tabs | fill or underline, and a heavier weight | `components/sp/gn/RangePills.tsx:60-69`; `components/sp/gn/SegmentTabs.tsx:54-56` |
| Standings movement | an up or down chevron and a number | `components/sp/gn/ManagerRow.tsx:184-192` |
| W / L / T | the letter, in neutral ink | `lib/game/weekResult.ts:76-79`; `components/game/ScheduleList.tsx:43,105` |
| You against an opponent | a ring, a bolder name, the left side; in Standings also an outline | `components/sp/gn/Scoreboard.tsx:208-222`; `components/sp/Avatar.tsx:41-51` |
| The tug bar | you on the left; "You lead by …" under it | `components/sp/game/TugBar.tsx:65-66`; `components/home/ThisWeekCard.tsx:214-225` |
| Owned, yours, no free slot, not in the list | the words | `components/stocks/SearchRow.tsx:41-63` |
| A stock's category on a draft tile | its three-letter code | `components/sp/gn/DraftTile.tsx:49,66` |
| Live, final and other phases | the word, and a dot | `components/sp/PhaseChip.tsx:58-88` |
| Medals | the number on the disc | `components/game/MedalDisc.tsx:28-29` |
| Password rules; username free or taken | a tick or a ring; a tick or a cross | `components/shell/Field.tsx:148-163`; `components/shell/UsernameStatusIcon.tsx:100,114` |
| The tab bar; the star; radios; the switch | filled or outline icon; filled or outline star and "Saved"; ring width; the thumb's position | `components/shell/ShellTabBar.tsx:136,158`; `components/stocks/StarButton.tsx:25` |
| Warning panels and red error lines | the words (no icon) | `components/sp/WarnPanel.tsx:19-22` |

## The colours that mean something

`constants/tokens/color.ts` (Light at lines 130-200, Dark at 202-272).

| Token | Light | Dark | Means |
|---|---|---|---|
| gain | #006C47 | #39EEBA | money up |
| loss | #C02447 | #F76D89 | money down; the clock's last ten seconds |
| zero | #505B72 | #98A8C5 | money flat |
| lossFill | #BD1F3D | #C12440 | a destructive button (Sell) |
| danger | #B7191C | #FB8371 | errors |
| you | #0064DC | #0067DF | you |
| live / accent | #00708E | #35EEFF | live, selected, links, warnings |
| medalGold / Silver / Bronze | #AD7300 / #7C8795 / #C36C36 | #ECAE30 / #BBC5D1 / #DE8F57 | first, second, third |
| the eleven category colours | (see the file) | (see the file) | a stock's category |

## What the app already reads, and what it tests

- Reduce Motion (`components/sp/motion.ts:9,58`, and `ReduceMotion.System` in five
  components), the text size (`components/sp/useLargeText.ts:7`), and the phone's light or
  dark setting (`components/sp/ThemeProvider.tsx:113`).
- Not found: any call to `AccessibilityInfo`, or any reading of bold text, greyscale,
  inverted colours, reduced transparency or increased contrast.
- Appearance offers "System", "Light" and "Dark" (`components/shell/AppearancePicker.tsx:22-25`),
  kept on the phone under `@stockpile/theme-preference` (`components/sp/ThemeProvider.tsx:69-81`).
- Contrast is enforced: `constants/tokens/contrastPairs.ts` (4.5 for text, 3 for graphics,
  both themes) by `tests-deno/sp-contrast.test.ts`.
- Not found: any test for colour blindness or for colour used alone.

## Not checked

- What anything looks like on a screen: how far apart two chart colours or the tug bar's
  two fills are to someone who is colour blind; whether the SegmentedControl's slab can be
  seen in Light.
- `app/design-gallery.tsx`, a developer screen, still draws red and green W and L. Whether
  it ships to users was not checked.
- `app/_layout.tsx:131` sets a notification colour that the custom tab bar may never draw.
- The native switch and spinner.
- The web app.
