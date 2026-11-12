# Create league › Season, the strip (B): gate stills

**The 16 PNGs are not in the repo** (review screenshots live outside it, Giorgio 2026-10-14; `.gitignore`): they are in
`~/fantasy-stock-design-review/feat-season-step-strip/`, named as the table below lists them.

Stills for the Design Lead's gate on `feat/season-step-strip` (spec: PRODUCT_RULES, "The Season step in Create
league", Giorgio picked B on board #call-season-step, 2026-11-10; the limit lines dropped on #call-limit-lines B,
2026-11-11). Taken on commit `0423574d`.

## How they were captured

- One simulator, "Season strip 17": iPhone 17, iOS 27.0, Expo Go 54.0.7, status bar fixed at 9:41. Own Metro on
  port 8420, restarted with `--clear` per fixture; the bundle is pre-warmed before each launch, so no frame is a
  loading splash.
- Supabase points at a dead port (`http://127.0.0.1:9`) and the session is a fixture (`EXPO_PUBLIC_SHELL_FIXTURE=leagues`,
  `EXPO_PUBLIC_GAME_SEAM=1`): nothing is read or written.
- Cold launch straight into the Season step (`EXPO_PUBLIC_CREATE_FIXTURE=season`), no tap before the shot, shot once two
  consecutive screenshots match. The Season values come from the DEV-only knob
  `EXPO_PUBLIC_CREATE_SEASON=<managers>,<weeks>,<playoff teams>` (`lib/shell/captureKnobs.ts`, read only in
  `captureDev.ts`, pinned by `tests-deno/season-step.test.ts`).
- Sizes: **L** = `large`, **AX5** = `accessibility-extra-extra-extra-large` (Giorgio's phone). `-end-` = scrolled to the
  end of the page by `EXPO_PUBLIC_SHELL_SCROLL_END=1`.
- File names: `season-<state>-17-<l|ax5>-<light|dark>.png`.

## States

| File | Season (managers, weeks, playoff teams) | Shows |
|---|---|---|
| `season-default-17-l-light.png`, `-l-dark.png` | 8, 11, 4 | The default: three identical boxes, "11 wks", the strip SF / F, "Wk 1" and "Wk 13", "No byes." |
| `season-default-17-ax5-light.png`, `season-default-end-17-ax5-light.png` | 8, 11, 4 | AX5, top and scrolled to the strip: each box under its label, the strip on one row, nothing clipped |
| `season-big16-r16-17-l-light.png`, `-l-dark.png` | 16, 15, 16 | R16 / QF / SF / F, "Wk 19", "No byes."; Managers +, weeks − and Playoff teams + greyed, no line |
| `season-big16-r16-17-ax5-light.png`, `season-big16-r16-end-17-ax5-light.png` | 16, 15, 16 | The same at AX5, top and end |
| `season-big16-wc-17-l-light.png` | 16, 15, 9 | WC / QF / SF / F, "The top 7 seeds get first-round byes." |
| `season-weeks-floor-17-l-light.png`, `-ax5-light.png` | 6, 5, 4 | Regular season at its floor: − greyed, no line |
| `season-pt-max-17-l-light.png` | 6, 11, 6 | Playoff teams at its max: + greyed, no line; "The top 2 seeds get first-round byes." |
| `season-pt-min-17-l-light.png` | 8, 11, 2 | Playoff teams at 2: − greyed, no line; F only, "Wk 12" |
| `season-mgr-min-17-l-light.png` | 4, 11, 3 | Managers at 4: − greyed, no line; "The top seed gets a first-round bye." |
| `season-long-season-17-l-light.png`, `season-long-season-end-17-ax5-light.png` | 16, 30, 16 | A 34-tile strip (the gap thins to 1 pt past 24 tiles), "Wk 34"; one row at L and at AX5 |

## Observed, not changed (for the Design Lead)

- At AX5 the Playoff teams row is about 90 px taller than Managers and Regular season, above and below its label: the
  "i" (44 pt minimum, scaling with the text) sets that row's height, so the three steppers are not identical in height
  there (they are at L). It comes from the Stepper's label-with-info layout (#415), not from this change.
- At AX5 "No byes." is the largest text on the step after the title (callout, uncapped, like the stepper labels).
