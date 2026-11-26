# A setting for people who are colour blind

Status: Draft (for Giorgio's approval). Not built.
Planner, 2026-11-25.

## Goal

Nothing in the app depends on telling two colours apart, for anyone, with no setting. And
a setting adds more for those who want it: a clearer pair of colours for a gain and a
loss, and an arrow on each.

## Giorgio's rules

All 2026-11-25, in the Planner's chat (`docs/PRODUCT_RULES.md`, Accessibility).

- "for color blind, there should be an accessibility setting in our app that would help
  with that. is it required by apple? even if its not, we should have it".
- What the setting does: "C", both different colours and arrows.
- Standing, from the design direction: "Colour is never the only code."
- Standing: the largest text size is the size on his phone; Reduce Motion is binding; no
  heading with a grey explainer under it.

## What Apple requires

The Researcher's reading of Apple's own pages (`docs/research/2026-11-25-colour-blind-setting.md`).

- **Its review rules:** nothing on accessibility or colour.
- **Its design guidelines:** do not rely on colour alone. Advice. They name blue against
  orange as a hard pair as well as red against green.
- **The labels on an App Store page:** voluntary today. One is "Differentiate Without
  Color Alone". Apple says sharing these details will become required over time, with no
  date; it is worded as declaring, not as supporting. To claim that label, every common
  task must work without colour, first launch and sign-in included, and Apple's page says
  an app should ideally do so by default, with a setting as the last resort.
- **Not read:** Apple's developer contract, and the law. So this is "Apple's review rules
  do not require it", not "nothing requires it".

## What the app does today

Read in the code on `main` at `8ad4d60c` by a read-only audit and spot-checked. The audit,
with a file and line for every row: `docs/research/2026-11-25-colour-only-audit.md`.

Already sound: a gain or a loss always carries its sign; a result is the letter W, L or T
in neutral ink; "you" is a ring, a bolder name and the left side as well as blue; a stock's
category carries its three-letter code; live and final are words with a dot; a medal has
its number.

**Colour alone, in four places:**
1. The chips on the Stocks tab: the selected one differs only in colour.
2. The budget chips in Create league: the same.
3. The plus and minus buttons of a stepper at its limit: only paler.
4. The draft clock in its last ten seconds: the ring and the digits turn red, and nothing
   else changes.

**Partly colour, about nine places**, among them: the selected half of a two-way switch; a
wrong field marked by a red border with the words further down; the winner in the bracket,
bolder, with "won" only spoken by VoiceOver; the current week's tile on Home.

There is no test that catches colour used alone. Contrast is tested; this is not.

## Part 1: for everyone, with no setting

The four places and the partial ones get a second signal: a shape, a weight, a mark or a
word. Which, case by case, is the Design Lead's to rule, and anything that adds a word is
his to approve. The test Apple suggests is the bar: with the whole screen turned grey,
every one of these still reads.

This is most of the benefit, and it is what a person who never opens Settings gets.

## Part 2: the setting

**What it does (his pick, C).**
- **A different pair of colours for a gain and a loss**, wherever those two colours are
  used: figures, the lines of charts, the tint behind a gain. The pair is the Design
  Lead's to propose and his to pick, shown in both themes and through the three kinds of
  colour blindness and grey, as the crest board was. No pair works for every kind; the
  arrows are what cover the rest.
- **An arrow on every gain and every loss**, up or down, beside the figure. A figure that
  is flat gets none.
- The Planner's reading of the pick, which was drawn on two Standings rows: it covers the
  gain and loss colours and their arrows. Other colours that mean something (a category, a
  medal, a crest) are not swapped by the setting; they are told apart without colour
  already, or will be under Part 1.

**Where it is.** A switch in Profile › Appearance, under System, Light and Dark. It is
kept on the phone, as the theme is, not on the account. Its name is his to approve.

**The phone's own switch.** An iPhone has "Differentiate Without Color". The app cannot
read it today: that needs a small piece of native code and a new build. So the setting
ships as our own switch first. Following the phone's switch is added when a build allows,
and then our switch is on from the start for anyone whose phone has it on.

**Crests.** With the setting on, a shield may carry a stronger pattern. The Design Lead
shows it on the crest set.

## Words

None approved. Needed: the switch's name; anything Part 1 adds.

## Open questions

For him, with drawings:
1. The pair of colours.
2. The switch's name and how it looks in Appearance.
3. Whether to claim Apple's label once every common task passes. Not before.

For the Researcher, if he wants it: what the law asks, which was not looked at.

## Scope

**In:** Part 1's places; the pair; the arrows; the switch; a test.

**Out:** following the phone's switch (waits for a build); a colour pair for anything but a
gain and a loss; claiming the App Store label; the screens for claims, which are not built
and must meet Part 1 when they are.

## Risks

- **An arrow widens the tightest rows.** Standings, the holdings list and the movers list
  put a figure at the right edge. Each is checked at the largest text size, where a figure
  already has least room.
- **A second pair of colours is a second set to keep right.** Both themes, each pair
  against each surface, in the contrast test that exists.
- **The setting becoming the excuse.** If something new uses colour alone because "there
  is a setting for that", Part 1 is undone. Hence the test, and a line in the Design
  Lead's gate.
- **A test that proves less than it says.** No program can tell that a screen "relies on
  colour". The test covers the shared controls that had the fault (the chips, the stepper,
  the switch, the clock): each must change something other than colour between its states.
  Screens are checked by eye in grey at the gate.

## Workstreams

After Part 3 of the Stocks tab. The Orchestrator sets the order.

| # | Workstream | Model | His steps after it |
|---|---|---|---|
| 1 | Boards: Part 1's fixes in grey; the pair, through the four checks; arrows in the tight rows at the largest text size; the switch | Design Lead | his picks and his words |
| 2 | Build Part 1 and the test | Sonnet, Design Lead gate | none (in the next build) |
| 3 | Build the setting: the pair, the arrows, the switch | Sonnet, Design Lead gate | none (in the next build) |
| 4 | Follow the phone's switch | Sonnet | a new build |

## Done means

1. With the phone's screen turned grey and the setting off, a person can tell the
   selected chip, a stepper at its limit, the clock's last ten seconds and a wrong field.
2. With the setting on, every gain and loss in the app shows an arrow and the picked pair,
   in both themes; with it off, nothing has changed from today.
3. At the largest text size, no row that gained an arrow clips or wraps.
4. The contrast test passes for the picked pair on every surface it sits on.
5. A shared control whose states differ only in colour fails the new test.
6. The setting survives closing the app.
