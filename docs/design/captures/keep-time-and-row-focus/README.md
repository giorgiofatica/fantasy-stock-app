# keepTime, and the row-focus P3 (Design Lead, 2026-11-03)

Branch `fix/keep-time-and-row-focus`, from main `7f765999` (not stacked on #326 or #327). Device: iPhone 17e, `large` (L), `extra-extra-extra-large`
(XXXL) and `accessibility-extra-extra-extra-large` (AX5). Frames: `~/fantasy-stock-design-review/fix/keep-time-and-row-focus/`
(outside the repo; `index.html` there).

## P3-1: "the row remount key can drop the keyboard when focus moves to a sibling" — does NOT reproduce. Nothing changed.

`useRowRemountKey` only exists on #327's branch, so this was run with #327's `useRowRemountKey.ts` and `SlotBuilder.tsx` overlaid on
the working tree (reverted afterwards; nothing of it is in this commit). Create league › Price tiers › Add slot, Min / Max fields.

| Run | Result |
|---|---|
| Min focused at L → live AX5 → tap Max | Max takes focus, **keyboard stays up** (`p31-3`) |
| the same, from a clean launch (the exact gate) | Max focused, keyboard up (`p31-7`); tap Min: Min focused, keyboard up (`p31-8`) |
| Max focused at AX5 → live L → tap Min (reverse) | Min focused (caret), keyboard up, row still frozen (`p31-4`, `p31-5`) |
| then blur at AX5 | keyboard down, row in the AX5 stacked layout, **one** remount (`p31-9`) |

**Why it does not reproduce:** the old field's blur and the new field's focus reach React in the same batch, so `onBlur` (`setKeyAtFocus(null)`)
and `onFocus` (`setKeyAtFocus(key)`) land in ONE render: `keyAtFocus` ends non-null and the key never changes while focus stays in the row.
The proposed `requestAnimationFrame` deferral would add a timer and a cancel path for a case React already handles.

**An adjacent finding (not what was asked; not fixed here; it needs #327):** the key is frozen at the key the row had when focus first
entered it, and it only changes at the blur. If a text-size change goes there AND BACK inside one focus session (focus at L → AX5 → L
without leaving the row), the key at the blur equals the key at the focus, so nothing remounts and the row keeps the AX5 widths at L
(Max pushed off the card: `p31-4`, still there after the blur, `p31-6`). Reaching it takes two size changes with the keyboard up, so it is
P3 at most. The fix shape, if wanted: a `scaleChangedWhileFocused` flag set when the current scale differs from the scale at focus
(at ANY render during focus), and at the blur bump the key (`${scaleKey}:${n}`) when the flag is set. A small change in
`useRowRemountKey.ts`, to be made on top of #327 once it is on main.

## P3-2: keepTime

**Rule (DL):** a clock time is ONE phrase with its AM/PM and its zone, like keepMoney. `keepTime` in `lib/game/keepDots.ts` puts a no-break
space between the digits and AM/PM and between AM/PM and the zone (`ET` / `EST` / `EDT`), so a line breaks BEFORE the time
("Week 7 starts / Mon / 9:30 AM ET"), never inside it. The weekday before the time stays breakable. A separator ICU already made
non-breaking (U+202F) is left as it is. Display only: the producers (`lib/`) stay plain, VoiceOver labels stay plain.

### Every rendered time (what it is, whether it wraps, what was done)

| Surface | Text | Wraps? | keepTime |
|---|---|---|---|
| Home › This week card, right label | "Ends Fri 4:00 PM ET", "Resumes Fri 9:30 AM ET", "Week 7 starts Mon 9:30 AM ET" | yes (the P3) | yes (`ThisWeekCard`) |
| Home › hero (pre-season) | "· Season starts Mon 9:30 AM ET" | yes | yes (`HomeHero`) |
| Home › bye card lines | "Week 8 starts Mon 9:30 AM ET" | yes | yes (`PhaseMessageCard`) |
| Matchup › pre-season line | "Season starts Mon 9:30 AM ET" | yes | yes (`matchup.tsx`) |
| Home › pre-draft card | date "Sat, Oct 3 · 7:00 PM ET"; order line "The draft room opens Sat 6:00 PM ET, when the order is set." | yes | yes (`PreDraftCard`) |
| Draft complete | "Week 1 starts Mon 9:30 AM ET. You play …" | yes | yes (`DraftComplete`) |
| Draft lobby | order line "Draft order set Sat 6:00 PM ET, an hour before the draft"; the dotted caption | yes / through keepDots already | yes / unchanged (`DraftLobby`) |
| League › countdown card (lines, notes) | "The draft starts automatically at Sat, Oct 3 · 7:00 PM ET.", "The draft room opens at 6:00 PM ET, …", "The draft starts at …" | yes | yes (`DraftCountdownCard`) |
| League › blockers card (tag, title, line) | "Needs you before 6:00 PM ET", "The league wasn't ready at 6:00 PM ET. …" | yes | yes (`DraftBlockersCard`) |
| Draft date sheet | "Today · 3:15 PM ET" | yes | yes (`DraftDateSheet`) |
| League settings › Draft time row | "Sat, Oct 3 · 7:00 PM ET" | yes | **keepDots** (as Create league's Draft row already is) + an explicit plain accessibilityLabel |
| League settings › Leave row, leave sheet bullet | "You can leave until Sat 6:00 PM ET, when the draft order is set." | yes | yes (`LeaveLeagueSheets`) |
| Player card / stock sheet / trade review | "Market's closed. Opens Mon 9:30 AM ET." / "Trading opens …" | yes | yes (`PlayerCard`, `StockSheetBody`, `TradeReviewPanel`) |
| Trade history row | "Mon 9:30 AM ET · 10 sh @ $12.34" | yes | yes (`TradeHistoryScreen`, with keepMoney) |
| Portfolio pre-draft hook | "Sat, Oct 3 · 7:00 PM ET" | yes | yes (`PortfolioScreen`) |
| League switcher / header chip | "Draft Sat 7:00 PM ET" | can wrap | yes (`PhaseChip`) |
| Create league › Draft row; Join preview › Draft row; Joined body | "Sat, Oct 3 · 7:00 PM ET" | yes | already whole through keepDots / keepDotsIn: unchanged |
| Renewal "nudge again at 6:00 PM ET" | native iOS alert | not ours | no |
| `marketHours` "Pre-market (opens 9:30 AM ET)", `gameCopy.endsFriday`, `formatShortDateTime` | no consumer | — | no (nothing renders them) |

### Gate (device)

AX5 (and XXXL where the line wraps there). XXXL mostly fits on one line, so nothing to break; AX5 is the stress. No orphan AM/PM or zone in any still.

| Surface | AX5 | XXXL |
|---|---|---|
| This week, scored ("Week 7 starts / Mon / 9:30 AM ET") | `home-scored-AX5` | `home-scored-XXXL` |
| This week, closed ("Resumes Fri / 9:30 AM ET") | `home-closed-AX5` | (one line) |
| Pre-draft card: date and order line | `predraft-card-AX5`, `predraft-order-AX5` | `predraft-card-XXXL` |
| League countdown card | `league-countdown-AX5` | `league-countdown-XXXL` |
| Draft complete ("Week 1 starts / Mon / 9:30 AM ET.") | `draft-complete-AX5` | `draft-complete-XXXL` |
| League settings › Draft time ("Sat, Oct 3 · / 7:00 PM ET") | `league-settings-draft-time-AX5` | `league-settings-draft-time-XXXL` |

**Not device-shot** (covered by the worst-case line-breaker test over the real producer strings and a source guard per render site):
Matchup pre-season, Home bye, blockers card, date sheet, leave row / sheet, player card / stock sheet / review "Opens …" notes, trade
history, Portfolio pre-draft, the phase chip. Their fixtures need several taps each; say if any should be shot.

### Tests and mutants

`tests-deno/keep-time.test.ts` (29 tests): the helper's values, untouched cases, idempotence, the U+202F rule, composition with
keepMoney / keepDots, a negative control, every producer string at every width 4–70 (Hermes-style plain spaces: Deno's ICU writes a
narrow no-break space there, which would hide the bug), a source guard per render site, the plain a11y labels, and "the producers and
the one-line League head stay free of keepTime". Four existing source-guard tests that pinned the old render strings were updated to
the keepTime forms (same assertions, same copy). Full suite 2705 / 0.

**Mutants:** run by `mut3.sh`, which mutates ONLY the nth line matching an anchor regex and asserts the diff against the original
touches exactly that one line (keepDots.ts has look-alike lines in several helpers). 11 on the helper (`CLOCK_TIME`, `glue`, the
return line), 27 on the render sites, a11y labels, a polluted producer and the League head: **37 killed, 1 survives and is
equivalent** (`(\d{1,2}:` → `(\d:`: the regex is unanchored, so "12:05" matches from the "2" and glues the same characters; the
output is identical). The polluted-producer mutant fails by a ReferenceError on import (no `keepTime` there), which is also a kill.

### Rebase note

Rebased onto main `d2b7a3bf` (after #327 and #328). The three lines #327 also touched (`ThisWeekCard`, `DraftComplete`, `game-draft-complete.test.ts`) now
read `keepTime(keepWeek(x))`, pinned in `keep-time.test.ts` and `keep-week.test.ts`. #328 added a `resultLine` argument to
`thisWeekAccessibilityLabel`, so the VoiceOver pin accepts it (mutant: wrapping `rightLabel` in `keepTime` there is killed).
