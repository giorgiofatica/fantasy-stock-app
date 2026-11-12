# Your queue saves as you go: gate stills (`feat/queue-autosave`)

PRODUCT_RULES "Your queue saves as you go" (2026-11-11); board `#call-queue-save` (frames B and B-fails).
Simulator "queue-autosave 17" (iPhone 17, 402×874 pt), iOS 27.0, Expo Go SDK 54, status bar 9:41, light.
Stills live outside the repo (Giorgio, 2026-10-14): `~/fantasy-stock-design-review/feat-queue-autosave/`.
Every frame is a cold launch (Metro restarted with `--clear`, bundle pre-fetched over HTTP, then the app opened at `/--/league`).

The add is the capture script's `queueadd:NVDA` (QueueEditor's DEV capture action: the same add a search result's tap
makes), then the save 800 ms later. The dev seam now reads back what its `set_draft_queue` stored
(`lib/game/seamCalls.ts`); before that the re-read after each save answered the fixture's AAPL, CRM, V and NVDA vanished.

| File | State | Env (plus `GAME_SEAM=1`, `CAPTURE_SCRIPT=queueadd:NVDA@6000[,scrollto:N@9000]`) |
|---|---|---|
| `lobby-added-L-light.png` | Lobby, after adding NVDA and the save landing: "4 of 50", nothing under the list | `SHELL_FIXTURE=leagues`, `SHELL_ACTIVE_LEAGUE=fx-seriea`, `DRAFT_START_FIXTURE=scheduled` |
| `lobby-failed-L-light.png` | Lobby, the save failed: "Your queue couldn't be saved." + Try again; NVDA kept | same + `CAPTURE_FAIL_ONCE=set_draft_queue` |
| `lobby-after-try-again-L-light.png` | The same session after tapping Try again: the line is gone, the list unchanged | same |
| `room-added-L-light.png` | Draft room (someone else's turn), after adding NVDA | `SHELL_FIXTURE=drafting`, `DRAFT_ROOM_FIXTURE=theirs_first` |
| `room-failed-L-light.png` | Draft room, the save failed | same + `CAPTURE_FAIL_ONCE=set_draft_queue` |
| `lobby-added-AX5-light.png` | Lobby at AX5 (`accessibility-extra-extra-extra-large`) | as lobby |
| `lobby-failed-AX5-light.png` | Lobby at AX5, the save failed | as lobby failed |
| `room-added-AX5-light.png` | Room at AX5 | as room |
| `room-failed-AX5-light.png` | Room at AX5, the save failed | as room failed |
