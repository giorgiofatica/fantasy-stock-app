# Live text-size sweep: live change vs cold launch (`audit/live-font-scale-sweep`)

An audit, not a fix. No code changed. Stills are outside the repo, in
`~/fantasy-stock-design-review/audit/live-font-scale-sweep/` (`index.html` there has the table with
thumbnails; `frames/` every PNG and `*.diff.json`; `sheets/` six-up contact sheets per case; `crops/` the
evidence below; `case.sh`, `end.sh`, `script.sh`, `metro.sh`, `step.sh`, `diff.py` the harness; `frames2/` the heal-check frames).

**Base:** Every frame was captured on the app code of main `495eef9e` (= `6526e3f2`, which is main `675ef08e` + #318 @ `3f32d9b3` + #319 @ `3c587d35`, plus #320, a docs-only board change). This branch is rebased on main `91bdea5f`, which adds #321 (docs) and #322 (`fix/code-label-and-intro-cards`: `maxFontSizeMultiplier` on the Create league *done* screen's invite-code label and the draft blockers card's "Invite code" label, and session tracking of seen intro cards). **None of the captured states touches those**: sweep 1 and 2 never open Create league's done screen or the draft blockers card, and the fixtures show no intro cards. Re-run before relying on those two screens.

**Contents:** Sweep 1 (six screens; Result, Method, Results, Findings below) → **Heal check** (2026-11-03, the Design Lead's ruling on sweep 1's P1) → **Sweep 2** (sheets, Profile, draft room, Matchup/Portfolio to the end, 17 Pro spot check).

## Result

- **Update 2026-11-03 (sweep 2):** one new **P1** (the draft room's search placeholder keeps its AX5 size after AX5 → L), one new **P2**
  (league switcher sheet's action row, 1–2 px). Every sheet, Profile, Matchup and Portfolio to the end, and Home on a 17 Pro are 0 px.
  The heal check found sweep 1's P1 heals on the next keystroke or blur (accepted by the Design Lead).
- **One real divergence: a P1 candidate on Create league step 1, live Large → AX5.** The focused name
  field keeps the text position it had at Large: at AX5 it shows "Serie A Trade" with the last two letters
  clipped at the box's right edge and the caret out of view, where a cold AX5 launch shows "erie A Traders|".
  Reproduced twice (319,408 px both times), unchanged 21 s later.
- **No stale-container layout anywhere else.** Home, Matchup, League, Portfolio, League settings and the other
  three Create league steps: 22 cases, 65 valid live-vs-cold comparisons, 62 of them outside Create league's
  step 1. Every one of those 62 is 0 px off cold apart from pulsing dots and one 30 px antialiasing rounding
  (max channel delta 2 of 765). That includes League settings' SettingRows and the in-season Commissioner
  row at the end of the page in all three directions (#318's family) and every unfocused Field (#319).
- **No P2 spacing drift found in sweep 1** (sweep 2 found one, below).
- One P3 note (scroll offset after a live change on Create league, below).

## Method

- Simulator "Sweep 17e": iPhone 17e, iOS 27.0 (24A434), Expo Go 54.0.7, Light, status bar fixed at 9:41.
  Own simulator, own Metro on port 8310, `--clear` per fixture. Supabase URL dead (`127.0.0.1:9`): nothing
  is read or written. Fixtures from `.env.local` (`EXPO_PUBLIC_SHELL_FIXTURE=leagues`, `GAME_SEAM=1`,
  `HOME_FIXTURE`, `MATCHUP_FIXTURE`, `SHELL_ACTIVE_LEAGUE`, `SHELL_INITIAL_ROUTE`, `CREATE_FIXTURE`,
  `LEAVE_LEAGUE`); each case's exact env is in `frames/<case>.env.txt`.
- Sizes (this brief's names): **L** = `large`, **XXXL** = `extra-extra-extra-large`, **AX5** =
  `accessibility-extra-extra-extra-large` (Giorgio's phone). *Older captures in this repo call the AX5 command
  "XXXL" (fontScale 3.571); in this sweep XXXL is the standard size below it.*
- **Cold** = size set, Expo Go terminated and relaunched, frame after settling. **Live** = launch at the
  start size, then `xcrun simctl ui <udid> content_size <target>` with the screen open, frame 6 s later (28 s
  total in the end-of-page runs). Directions: AX5→L, AX5→XXXL, L→AX5; each is compared with the cold frame at
  the target size.
- **Same scroll offset, by construction.** Top of page: offset 0 in both. Scrolled: the same slow drag of about 540 pt (League
  settings about 730 pt), made AFTER the live change, exactly as on the cold launch (a drag before the change
  would clamp differently at each size). End of page: the repo's own `SHELL_SCROLL_END` / capture-script
  `scrollto:99999` knobs scroll both to the end. League settings L→AX5 at the end needed 5 flicks after the
  change (the knob fires once, at the start size).
- Compare: exact pixel diff (any channel delta > 0), with the count over Δ>24 and the max delta in
  `frames/*.diff.json`. Bounding boxes come from a 14 px dilation of the diff mask. The iOS home-indicator bar
  (x 363–808, y 2470–2532 px, 3x), which fades in and out on its own, is masked. Pulsing dots and the text
  caret are NOT masked; they are named below.
- A frame that was only Expo Go's "Opening project…" splash was caught and re-shot (Matchup stress cold AX5);
  all 132 frames of the 22 cases were checked for being a loaded app at the right size.

## Results (px off the cold frame at the target size)

Device px, 1170×2532. `—` = not run.

| Screen · state | Position | AX5→L | AX5→XXXL | L→AX5 | What differs |
|---|---|---|---|---|---|
| Home · live_closed | top | 0 | 0 | 0 | |
| Home · live_closed | scrolled ≈540 pt | 0 | 0 | 0 | |
| Home · live_closed | end of page | 0 | 0 | 0 | |
| Home · live_open | top | 2,575 | 1,243 | 1,178 | pulsing dots only: the chart's end-dot halo and the LIVE chip dot, ≤ 73×73 px each |
| Matchup · category slots | top | 0 | 0 | 0 | |
| Matchup · category slots | scrolled ≈540 pt | 0 | 0 | 0 | |
| Matchup · stress fixture | top | 0 | 0 | 0 | |
| League · Standings | top | 0 | 0 | 0 | |
| League · Standings | end of page | 0 | 0 | 0 | |
| League · Schedule | top | 1,352 | 588 | 1,352 | the pulsing LIVE chip dot only (73×73) |
| League · Schedule | end of page | 1,352 | 1,080 | 1,368 | the same dot |
| Portfolio | top | 0 | 0 | 0 | |
| Portfolio | scrolled ≈540 pt | 0 | 0 | 0 | |
| League settings · pre-draft | top | 0 | 0 | 0 | Draft time row stacked at AX5, one line at L: all match cold |
| League settings · pre-draft | end of page | 0 | 0 | — | |
| League settings · in season | top | 0 | 0 | 30 | max delta 2/765, four card-corner arcs: rounding noise |
| League settings · in season | scrolled ≈730 pt | 0 | 0 | 0 | |
| League settings · in season | end of page (League info, Commissioner, Leave league) | 0 | 0 | 0 | L→AX5 by 5 flicks after the change |
| Create league · 1 League (name field focused, keyboard up) | top | 295,780 | 328,048 | 319,408 | **see Findings** |
| Create league · 2 Season | top | 0 | 0 | 0 | |
| Create league · 3 Draft | top | 0 | 0 | 0 | |
| Create league · 4 Stakes | top | 0 | 0 | 0 | |

## Findings

### P1 candidate: Create league step 1, focused name field, live Large → AX5 (heals on keystroke or blur; accepted 2026-11-03, see Heal check)

- **What:** with the keyboard up and the name field focused ("Serie A Traders"), a live change L → AX5 leaves
  the text at the position it had at Large. At AX5 the text is wider than the box, so it ends at
  "Serie A Trade" with the right edge of the "d", "e" and the whole of "rs" cut off, and the caret is not
  visible. A cold AX5 launch scrolls to the caret and shows "erie A Traders|".
- **Evidence:** `crops/create-league-field-L-to-AX5.png` (1:1, live | cold), `crops/create-league-sheet.png`.
  Reproduced on a second run (`frames/cl-repro-*`: live vs cold 319,408 px both times, 21 s after the change
  identical to 6 s after). Only the direction that makes the text wider is affected.
- **Other directions on the same field:** AX5 → L and AX5 → XXXL are fine. After aligning the scroll offset
  (next note), the only difference from cold is the caret's blink phase (292 and 400 px; `crops/create-league-caret-AX5-to-L.png`).
- **Best guess:** `components/shell/Field.tsx`'s focused branch. `useInputRemountKey`
  (`components/sp/useInputRemountKey.ts`) freezes the host's key while the field is focused, on purpose (a
  remount drops the keyboard), so the native text field keeps its internal horizontal scroll from Large. On
  this screen the field is always focused (`autoFocus` in `app/create-league.tsx:307`), so #319's key never
  applies. Not verified: whether the next keystroke or a blur-and-refocus fixes the scroll (likely), and
  whether any other autofocused field behaves the same (the sign-in and delete-account fields are credential
  fields and out of this sweep).
- **Severity:** P1 by the brief's rule (text clipped, last letters hidden). The Design Lead may weigh it down:
  it needs a text-size change made while this one field is focused, and it is probably gone at the next keystroke.

### P3 note: the scroll offset survives a live change, a cold launch re-scrolls

On Create league step 1 the live frames sit 52 px (17.3 pt) higher than cold in all three directions (the
cold launch scrolls the focused field into view above the keyboard; the live change keeps the offset it had).
That is ordinary ScrollView behaviour, not a stale layout: with the offset aligned the live frame is the cold
frame (apart from the caret above). Listed so nobody reads the raw 295,780 / 328,048 px as layout drift.

### Not findings (named so they are not re-found)

- Pulsing dots (LIVE chip on Schedule and Home, the chart's end-dot halo), the text caret, and the iOS
  home-indicator bar differ between any two frames of the same state.
- League settings in season, L → AX5, top: 30 px, max channel delta 2/765, four rounded-corner arcs
  (`crops/settings-season-corner-noise.png`). Antialiasing rounding.

## Heal check: Create league step 1's focused field, live L → AX5 (Design Lead's ruling, 2026-11-03)

Same fixture and sequence as sweep 1 (launch at L, `content_size` to AX5 with the field focused and the keyboard up), then
THREE separate runs from the broken state, each compared with a cold AX5 launch that got the identical action.
Frames: `frames2/heal-*`, `i-*`, `ii-*`, `iii-*`; crops `crops/heal-i-keystroke.png`, `heal-ii-blur.png`, `heal-iii-tap-focused-field.png`.

| Run | Action from the broken state | Result |
|---|---|---|
| before | none | still broken: "Serie A Trade", "rs" clipped, no caret. Reproduced in **7 of 8** runs; the one clean run was the very first after the simulator booted |
| (i) | type one character | **heals.** Live "…rie A Tradersx\|", caret in view, same as cold AX5 + the same keystroke; 1,239 px apart (caret blink) |
| (ii) | tap elsewhere (blur) | **heals.** The unfocused field draws "Serie A Tra…", exactly as cold AX5 + the same tap. (The page behind sits 17 pt lower on the live run: kept scroll offset, see the P3 note above) |
| (iii) | tap into the field (it was still focused) | **does NOT heal.** Still "Serie A Trade", 312,616 px apart. The field was already focused, so the tap is a caret move, not a refocus. A blur followed by a tap in is (ii) then a fresh focus |

Ruling applies: at least one run restores it, so the DL accepts it. Checklist line, verbatim:

> a focused field whose text overflows after a live text-size increase keeps its old scroll offset until the next keystroke, blur or refocus (accepted, 2026-11-03)

The sim tool granted taps and typing without a prompt. Not tried: whether the keyboard's own dismissal (Next/Return) heals it.

## Sweep 2 (2026-11-03): sheets, Profile, draft room, full-length pages, 17 Pro

Narrowed: Light, live **L → AX5** and **AX5 → L** only, each against a cold launch at the target size. Same harness and masks as
sweep 1; `s2-*` frames. A sheet is opened at the START size (a tap, or the capture script), the size is changed with the sheet
open, and the frame is compared with a cold launch that opened the same sheet. The page BEHIND a sheet is scrolled differently on a
live run (it kept its offset) and is not compared: only the sheet's own pixels are (where a row says so).

| Screen · state | AX5→L | L→AX5 | What differs |
|---|---|---|---|
| Sheet: sell review (Portfolio, NVDA, price tiers) | 0 | 0 | |
| Sheet: buy review (Portfolio, AMD) | 0 | 0 | |
| Player card from Portfolio (NVDA) | 0 | 0 | |
| Player card from Matchup (NVDA) | 0 | 0 | |
| Sheet: league switcher ("Your leagues") | 7,291 | 0 | **P2:** the bottom action row, see Findings |
| Sheet: draft time (`DraftDateSheet`, Create league step 3) | 0 in the sheet (365,547 behind it) | 0 | the dimmed page behind it only (scroll offset kept); the sheet area y ≥ 900 px is 0 |
| Sheet: leave league (member view, Serie A Traders) | 0 | 0 | |
| Sheet: transfer commissioner | — | — | **not reachable**: it opens only for a commissioner while the leave window is open, and the commissioner fixture's draft time is in the past (window locked); no fixture has both (same as the sheet-scroll audit's note) |
| Profile, top | 0 | 0 | |
| Profile, end of page (Sign out, Delete account) | 0 | 0 | 3 flicks at AX5; a 4th moved 0 px |
| Draft room · on the clock (`on_clock`) | 34,164 | 0 | **P1:** the search field's placeholder, see Findings. The other two regions are the ticking pick clock |
| Draft room · pre-draft queue (League tab, Serie A Traders, no draft time) | 32,983 | 7,132 | **P1:** the same placeholder (AX5→L). The rest is the draft-order line's clock minute ("Thu 10:15 / 10:16 PM ET") |
| Draft room · someone else's pick (`theirs_first`) | 0 | 1,380 | the pick-clock digits (0:28 / 0:27) |
| Matchup · category slots, to the real end | 0 | 0 | 3 flicks at L, 5 at AX5; one more moved 0 px |
| Portfolio · to the end (`scroll:99999`) | 0 | 0 | |
| Home on **iPhone 17 Pro** (live_closed), top | 0 | 0 | the 17 Pro spot check |

### Findings (sweep 2)

**P1, draft room search field (AX5 → L): the placeholder keeps its AX5 size.** After a live AX5 → L change the unfocused
"Search by ticker or name…" field draws its placeholder at AX5 size inside a Large-size field: only "Search…" fits, the glyphs
overflow the field's top and bottom edges, and "by ticker or name" is gone. A cold L launch shows the whole line. Seen on both draft
screens that carry the field (the on-the-clock room: `crops/draft-room-search-placeholder-AX5-to-L.png`; the pre-draft queue editor:
`crops/draft-queue-search-placeholder-AX5-to-L.png`), in separate runs. Only the shrinking direction: L → AX5 matches cold.
- Component: `components/SymbolSearchField.tsx:96`, the TextInput. It is already keyed by `useInputRemountKey(undefined)` (so #319's
  key is on it), yet the placeholder is stale, so the key alone does not clear it here. Not verified: why (a guess: the remount
  happens while the native text size is still the old one, so the new field is created at AX5), and whether focus, a keystroke or
  blur clears it (the Create league heal check suggests focus/keystroke might).
- Not run: the same field on Buy a stock (`StockSearchScreen`), which has its own search box.

**P2, league switcher sheet, bottom action row (AX5 → L): the two pills are 1–2 device px (under 1 pt) off cold.** The
"Create league" pill's right edge and "Join with code"'s left edge sit 1–2 px away, and both labels shift by ≈1 px
(`crops/switcher-button-row-AX5-to-L.png`; 7,291 px, all in the four boxes at the pills' edges and labels). Everything else in the sheet is
identical. Sub-point spacing drift: a stateless wrapper holding a flex split from AX5 (the #318 shape, tiny here). L → AX5 matches cold.

**P3, the page behind a sheet.** A live run keeps the scroll offset the page had when it was opened; a cold launch opens it fresh.
On the draft-time sheet that is 365,547 px of dimmed background, 0 in the sheet. Not a layout bug.

**Timers and clocks** differ between any two frames of a live draft room (pick-clock digits, the draft-order line's minute): named,
not findings.

## What was NOT covered

- Dark theme, other text-size pairs (XXXL → AX5, L → XXL, AX → AX), and a first launch after install (the way Giorgio's phone first
  showed the Home hero bug). iPhone 17 Pro: only Home (sweep 2).
- Screens: League's History and Playoffs segments, Trade history, Join, onboarding, sign-in; the stock sheet's pre-review view,
  the Sale picker, the Renewal change sheet, How it works, the transfer-commissioner sheet (unreachable, above). League settings pre-draft was run at top and end only (not a
  mid-page scroll, and L → AX5 at the end).
- (Sweep 1) Matchup and Portfolio were scrolled one ≈540 pt drag, not to the end; sweep 2 took both to the real end (Matchup by
  flicks, Portfolio by the `scroll` script) and found 0 px.
- Native alerts, keyboards other than the Create league one, and VoiceOver.

## Files outside the repo

`~/fantasy-stock-design-review/audit/live-font-scale-sweep/`: `index.html`; `frames/<case>-{cold-L,cold-XXXL,cold-AX5,live-AX5toL,live-AX5toXXXL,live-LtoAX5}.png`
(cases: `home`, `home-s`, `home-end`, `home-live-open`, `matchup`, `mx-s`, `matchup-stress`, `league-standings`,
`league-standings-end`, `league-schedule`, `league-schedule-end`, `portfolio`, `pf-s`, `settings-predraft`,
`settings-predraft-end`, `settings-season`, `ss-s`, `settings-season-end`, `create-league`, `create-season`,
`create-draft`, `create-stakes`; `-s` = scrolled; sweep 2: `s2-*`, e.g. `s2-portfolio-sell-review`, `s2-switcher`, `s2-draft-onclock`, `s2-matchup-endf`; `settings-season-end-flick-live-LtoAX5.png`, `cl-repro-*`).
