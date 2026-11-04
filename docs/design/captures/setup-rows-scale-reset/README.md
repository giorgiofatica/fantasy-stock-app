# Setup rows and "Week N" at AX5 (Design Lead P1 + P2, 2026-11-03)

Branch `fix/setup-rows-scale-reset`, from main `137e158b` (not stacked on #326). Device: iPhone 17e, `large` (L) and
`accessibility-extra-extra-extra-large` (AX5). Frames: `~/fantasy-stock-design-review/fix/setup-rows-scale-reset/` (outside the repo).

## P1: Create league › Price tiers › Add slot, Stocks / Min / Max row

**What:** after a live L → AX5 → L the row kept its AX5 widths and "Max" was pushed off the card (main: `main-slot-L-after-AX5.png`).

**Cause:** the same as #318 (SetupRows' `remountKey`). Fabric re-measures a view only when it gets new props, so the row's
wrapper Views kept the old size's flex layout. The slot fields' own Texts and TextInputs were already keyed by the scale; their
CONTAINER was not.

**Fix:** `components/game/useRowRemountKey.ts` returns a key for a container of text fields (the scale's key, frozen while a field
in the row is focused, one remount on blur: `inputRemountKey`, the #319 rule). `SlotBuilder` puts it on the fields row's `<View>`
and `onFocus` / `onBlur` on all three Fields. The typed values live in the screen's wizard state, above the key.

| Run | Result |
|---|---|
| slot at L vs L → AX5 → L (branch) | **0 px** (`fix-slot-L-ref` vs `fix-slot-L-after-AX5`) |
| the same on main | Max off the card |
| typed Min 50, Max 200, L → AX5 → L | values kept, **0 px** (`fix-vals-*`) |
| L (main) vs L (branch) and AX5 (main) vs AX5 (branch) | the status-bar clock only |
| AX5 → L (cold AX5 slot, then L) | row layout identical to cold L; the only difference is the Min / Max placeholders' interiors (the stale placeholder #326 fixes) |
| with #326's Field files overlaid | slot L → AX5 → L **0 px**, placeholders correct (`both-slot-*`) |

Not captured: L → AX5 live with the slot scrolled into view next to a cold AX5 frame (the page's scroll offset differs between a
live change and a cold launch, the known P3); the AX5 frames are in `fix-slot-AX5.png` and `fix-slot-cold-AX5.png` (stacked column, as designed).

**Known limit:** tapping from one slot field to a sibling after a text-size change made WHILE a field was focused unfreezes the key at
the first blur, so the sibling can be remounted just as it takes focus. Not reproduced and not tried; it needs a size change with
the keyboard up and then a tap on a neighbour.

### Sweep of the other rows (L → AX5 → L, 0 px unless noted; the error toast's badge at the bottom is excluded)

| Surface | Result |
|---|---|
| Step 2 Season: three Steppers | 0 |
| Step 3 Draft: Pick clock segmented control, Draft time SettingRow, Draft order, Rounds Stepper | 0 (388 px, all in the toast's count badge) |
| Step 4 Stakes top: three ChoiceRows, SwitchRow | 0 (2,149 px, all in the toast's badge) |
| Step 4 Budget cap: Field + the four-chip `RowWrap` | 0 |
| Step 4 Equal stakes: Field with helper | 0 |
| Step 4 Price tiers: the slot row | **fixed here** |
| Step 1 League (name field focused) | not a row; the focused-field scroll offset is a separate finding (see Recheck) |
| League summary SettingRows | already keyed by #318 |
| Other `<Field>` screens (sign-in, sign-up, forgot / new password, delete account, join, username, league settings) | single fields, not rows: nothing to key |

## P2: "Week N" splits across lines

**What:** at AX5 Home's Standings header read "Through Week" / "5" (the number alone on its line). With a no-break space it reads
"Through" / "Week 5". Frames: `home-standings-AX5-before.png`, `home-standings-AX5-after.png`.

**Fix:** `keepWeek` in `lib/game/keepDots.ts` (a no-break space between "Week" / "week" and a digit; display only, every
accessibilityLabel keeps the plain space), applied at every visible, wrapping "Week N":

| Surface | Text | Wraps? | keepWeek |
|---|---|---|---|
| Home › Standings card header | "Through Week N" | yes (the P2) | yes |
| Home › This week card, result line | "You win Week 6" | yes | yes |
| Home › This week card, right label | "Week 7 starts Mon 9:30 AM ET" | yes | yes |
| Home › season-complete Best week tile | "Week 11" | headline | yes |
| Draft complete: line and button | "Week 1 starts …", "See your Week 1 matchup" | yes | yes |
| League › Playoffs bracket round tag | "… · playoff week 2" | yes | yes |
| League › Standings column head | "Through Week N" | **no**: `numberOfLines={1}` | **no** (a no-break space moved the last digit by a fraction of a pixel, 329 px; left as it was, so League is byte-identical) |
| Home hero meta line | "Week 6 of 14 · …" | yes | already (keepDots keeps a ≤ 24-character segment whole) |
| Schedule rows | "W6" | no "Week N" text (VoiceOver label only) | n/a |
| Home › "Your season" tiles (#325) | "Wk N" | no: ruled to never wrap in #325; the "Week N, …" form is a VoiceOver label only | n/a |
| Phase chips, league switcher pill | "Week 6" | no: `numberOfLines={1}` | n/a |

Seen while capturing, not part of this brief: Home's This week card at AX5 wraps "Week 7 starts / Mon 9:30 AM / ET", leaving "ET" alone on its line.

## Recheck (task A, branch `fix/search-placeholder-font-scale`, no code)

Create league step 1, name field focused and overflowing, live L → AX5: **not healed**. "Serie A Trade" with the "rs" cut off and no caret,
against cold AX5's "erie A Traders|". Two live runs are pixel-identical (0 px); frames `recheck-cl-*`, crop `crops/recheck-create-league-field.png`.
The scaled-props fix puts the new size in the field's props, but a focused field is never remounted and the native text view keeps its
horizontal scroll offset, so it does not move. The accepted checklist line stays.
