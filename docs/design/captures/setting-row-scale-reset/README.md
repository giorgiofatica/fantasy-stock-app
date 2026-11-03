# SettingRow after a live text-size change: captures (`fix/setting-row-scale-reset`)

P2 from the Design Lead (2026-11-02). After a LIVE text-size change from AX5 (`accessibility-extra-extra-extra-large`)
down to Large, League settings' Draft time row stayed wrapped ("Sat, Oct 3 · / 7:00 PM ET", a tall row). A cold launch at
Large lays it out on one line. In season, the Commissioner row lost its "You" the same way.

Stills are outside the repo, in `~/fantasy-stock-design-review/fix/setting-row-scale-reset/`; `index.html` there pairs main with branch.

## Cause (measured, iPhone 17e, Expo Go)

Not the three candidates on the ticket's list.

- **`valueLines` (1):** not involved. At Large the row is not stacked (`stack=false`), so the value's `onTextLayout` is not attached and the
  count is never read. The log shows no value line event, and `brokeAt` (3.571) does not equal the new scale (1), so the latch had already let go.
- **The label latch (2):** working. `isStacked(brokeAt, fontScale)` was false at Large.
- **The value Text not keyed (3):** it is keyed (sp `Text`, #316) and DID remount: its box was re-measured at Large glyph size (2 lines, line 0 = 64pt).

The stale part is the row's own wrapper Views. React Native 0.81 Fabric keeps the flex layout those containers had at the old size when only
their Text children remount. Logged from the value's `onLayout`:

| | value box | label column | value lines |
|---|---|---|---|
| cold Large | 135 pt | 150 pt | 1 |
| live AX5 -> Large (main) | **79 pt** | **206 pt** | **2** |
| live AX5 -> Large (branch) | 135 pt | 150 pt | 1 |

The squeeze is the old size's column split, applied to Large-size text. Experiment: keying only the row's root View by `fontScaleKey` made
the live change equal the cold one (the log above), so the stale layout lives in the row's containers, not in any JS state.

## Fix

- `components/game/SetupRows.tsx`: `SettingRow`'s body View and `SwitchRow`'s root View are keyed by `fontScaleKey(fontScale)`
  (handed out by `useLabelBreaks` as `remountKey`). A scale change starts the whole row over; while the scale holds, the key holds.
- The value's line count is stored with the size it was measured at and read only there (`valueLinesAt`, `lib/game/labelBreaks.ts`),
  the same "only for the size it was measured at" rule the label latch uses. This is belt and braces: it did not cause this bug.

## Audit of other `onTextLayout` / `onLayout`-derived state in `components/`

- `SetupRows` (`useLabelBreaks`, `valueLines`): fixed above. `SwitchRow` shares the hook and the root key.
- `shell/FittedTitle` (`natural`, from a probe Text's `onTextLayout`) and `shell/UsernamePicker` (`tagWidth`, same): the probes are sp `Text`, keyed
  by the scale, so they remount and report again. Their other width is a View width, not a text size. Not changed.
- `sp/gn/RosterRow` (`numWidth`): a View width; the text width it is fitted against is computed from `fontScale`, not measured. Not changed.
- `home/RollingMoney` (`naturalWidth`): covered by #316's keys. Not changed.
- `Chart`, `Scoreboard`, `ThisWeekCard`, `Sheet`, `DraftBoard`, `Vignettes`, `SegmentedControl`, `ShellTabBar`, `BarsRefresh`:
  hold View widths or heights, not text measurements.

## Measurements (from pixels, light, one build per side: main `675ef08e` / this branch)

Pre-draft (Draft time row, `fx-seriea`, top of the page):
- Cold L, XXXL, AX5: **branch vs main byte-identical** (`cmp`).
- Live AX5 -> L vs cold L: main 222,488 px off; **branch 0**.
- Live AX5 -> XXXL vs cold XXXL: main 107,611 px off (also broken); **branch 0**.
- Live L -> AX5 vs cold AX5: 0 on both.

In season (Commissioner row, `fx-scudetto`, `LEAVE_LEAGUE=1`, scrolled to the end):
- Cold L, XXXL, AX5: branch vs main byte-identical.
- A live change keeps the scroll offset, a cold launch scrolls to the end: the frames are offset by 206 px. Compared on the League info card
  after that shift: live AX5 -> L main 6,558 px off (the "You" is gone), **branch 0**; live AX5 -> XXXL main 84,052 px off, **branch 0**.
- Live L -> AX5 differs from cold AX5 only by scroll position, identically on main and branch.
