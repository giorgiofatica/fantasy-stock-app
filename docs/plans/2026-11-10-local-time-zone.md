# Times in the player's own time zone

Status: Approved (Giorgio, 2026-11-10)
Planner session: Planner (Fable 5.2) · Orchestrator hand-off: —

## Goal

Every time a player reads is in their phone's time zone, with the zone named. Today the
app shows Eastern Time everywhere: Giorgio, in Pacific time, set up a league on build 1.3.0
(12) and the draft-time wheel read 2:30 PM while his phone read 10:22 AM. The market still
runs on Eastern Time; only what people read changes.

## Giorgio's rules

2026-11-10, verbatim, creating a league during the phone pass:
- "the draft time was set in Eastern time, even though I'm in Pacific time. So we need this
  app to simply show the like time zone or whatever the user's phone is, right? If I am in
  Pacific time, I don't want to see Eastern time because that was confusing me at first."
- "for like the US users, it should be whatever time zone you're in, right? It's good that it
  tells me the time zone underneath, but the standard should be whatever the time zone the
  user's in."
- Asked whether the market's own times go local too: "yes, market times should be local too".

## Decisions

| # | Question | Decision | Who |
|---|---|---|---|
| 1 | Which zone | The phone's current time zone, read when the screen draws (a traveller sees the zone they are in). No setting. | Giorgio 11-10 |
| 2 | Is the zone still named | Always. Every time keeps its label ("11:30 AM PT"): "It's good that it tells me the time zone underneath". Leaguemates in different zones each see their own time; the label keeps a shared screenshot or message unambiguous. | Giorgio 11-10 |
| 3 | Which times | **All of them:** draft time and the wheel that sets it, room-open and deadline times, "wasn't ready at…", countdown targets, renewal and leave deadlines, AND the market's own times ("Market opens 9:30 AM ET" reads "6:30 AM PT" in Pacific). Robinhood shows market hours in local time, and one rule is simpler to trust than two. | Giorgio 11-10 |
| 4 | The label's form | US zones use the short generic names the app already uses for Eastern: ET, CT, MT, PT, AKT, HT (never EST/EDT, which changes twice a year). Anywhere else: the offset, "GMT+1". | Planner |
| 5 | What does NOT change | Every rule and calculation: market hours, the trading window, the week window, claims at the open, scoring. They stay on `America/New_York`. Draft times stay on quarter hours and at least an hour out; both hold in any zone. | Planner |
| 6 | Notifications | A push names a time in the RECIPIENT's zone. The phone tells the server its zone; with none on file the push says ET, as today. | Planner |
| 7 | Who can see my zone | Nobody. It is stored beside the push token, owner-only, never sent to leaguemates (lock-everything-down rule). | Planner, standing rule |

## Open questions

None. (Market times: answered yes, 2026-11-10.)

## Scope

In: one display formatter and zone label for mobile; every screen that prints a time (the
call sites are in `components/game/DraftDateSheet.tsx`, `lib/game/autoStart.ts`,
`leaveLeague.ts`, `renewal.ts`, `lib/home/buildHomeViewModel.ts`, `draftCountdown.ts`,
`homeCopy.ts`, `lib/money/marketOpensLabel.ts`, `lib/shell/leagueSheet.ts`); the draft-time
wheel; the phone's zone stored with its push token; per-recipient times in
`draft-order-notify/plan.ts` and `_shared/renewal-copy.ts`.

Out: any change to market or scoring logic (`lib/marketHours.ts`, `lib/time/marketWeek.ts`,
`etParts.ts`, `_shared/market-hours.ts`, `_shared/week-window.ts` keep computing in
Eastern); a time-zone setting; the web join page (it prints no times); emails.

## How it works

**The player's side.** The draft-time wheel shows the phone's local time; the line under it
reads "Today · 11:30 AM PT (the earliest you can pick: an hour from now)". Home, the lobby,
the postponed card and the countdown read the same instant in local time with the label.
Two managers in New York and Los Angeles see "2:30 PM ET" and "11:30 AM PT" for the same
draft. A day label follows the local date ("Today" is the phone's today).
A deadline always names its day, today included (Giorgio, 2026-11-11, board #403 (b) B): the
pre-draft card's "Needs you before …" and "Fix these before …, when the draft room opens."
read "before 6:30 PM ET today", "before 6:30 PM ET tomorrow", "before 6:30 PM ET on Tue, Nov 17"
(local zone, as above). Call sites: `apps/mobile/lib/game/autoStart.ts` (the two strings) and
its pin `apps/mobile/tests-deno/game-auto-start.test.ts`.

**Mobile.** A pure `lib/time/localTime.ts`: `formatLocalTime(instant, zone, opts)` and
`zoneLabel(zone, instant)`, with the zone passed IN (never read inside), so Deno tests run
it for any zone. One hook reads the device zone (expo-localization's calendar time zone;
`Intl.DateTimeFormat().resolvedOptions().timeZone` as a cross-check) and re-reads it when
the app returns to the foreground. `zoneLabel` is a table from IANA zone to ET/CT/MT/PT/
AKT/HT (Arizona and Indiana zones included), else a GMT offset computed from the instant;
it does not depend on Hermes supporting `timeZoneName: 'shortGeneric'`. Every display call
site swaps its ET formatting for the formatter; `keepTime` (never split "9:30 AM ET") is
extended so no label, including "GMT+5:30", breaks from its time. The wheel: the picker
works in the device zone natively, so the ET re-projection in `DraftDateSheet` is removed
and the summary line uses the formatter. Hermes rule from 2026-10 stands: pin
`hourCycle`, validate every `formatToParts` part, and prove it on a device build, not only
under Deno.

**Server.** Migration (next free stamp): `push_tokens.time_zone text NULL`, checked against
`pg_timezone_names` in the owner's upsert path (reject anything else; no free text reaches
a formatter). `apps/mobile/lib/notifications.ts` writes it with the token on each save.
`draft-order-notify` and the renewal pushes format each recipient's times with that zone
through one shared `_shared/local-time.ts` (the same label table as mobile, parity-tested);
NULL or unknown → Eastern with "ET". RLS on `push_tokens` is already owner-only with anon
revoked; re-assert the grants and check `proacl`/policies after the push
(`supabase-reviewer`). `db-snapshot.json` re-captured.

## Risks and edge cases

- **Daylight saving.** The market is on New York's clock: in a zone that changes on a
  different date (or never, like Arizona or Hawaii), "market opens" moves by an hour for a
  few weeks. The formatter converts each instant, never adds a fixed offset; tests cover
  both US changeover weeks, Phoenix, Honolulu, London and Kolkata (a half-hour zone).
- **Midnight crossings.** 8:00 PM ET is tomorrow in London: day labels and "Today" follow
  the local date; the week strip's week numbers do NOT move (weeks are the market's).
- **The picker's floor.** "At least an hour from now, on a quarter hour" is checked on the
  instant; the wheel must not let a local time through that the server refuses, and the
  refusal copy must not say ET.
- **A stale stored zone** (a traveller who hasn't opened the app): the push is an hour or
  more off in wording only; it still names its zone, so it is never wrong, only less
  convenient. Refreshed on every foreground.
- **Privacy.** A time zone is coarse location. Owner-only storage, never in any RPC a
  leaguemate can call, deleted with the push token on account deletion (it is the same row).
- **Server and client label tables drifting.** One parity test reads both tables.
- **Large text.** "11:30 AM GMT+5:30" is longer than "9:30 AM ET": the Design Lead re-gates
  every surface that prints a time at AX5.

## Done means

- Phone set to Pacific: the wheel, its summary line, Home, the lobby, the postponed card
  and the market-closed notes all read Pacific times ending "PT"; set to Eastern they read
  as today. No "ET" appears anywhere on a Pacific phone.
- A draft set on a Pacific phone for 11:30 AM PT reads 2:30 PM ET on an Eastern phone, and
  starts at that instant.
- A push to a Pacific phone names a PT time; with no zone stored it names ET.
- Deno: the formatter and label across the zones and dates above; the parity test; the
  picker floor. PGlite: the `time_zone` check constraint and grants. Device: one real build
  check of the wheel and a push (Hermes).
- Design Lead PASS at L and AX5, both themes; Giorgio re-checks on his phone.

## Suggested workstreams

W1 mobile display (formatter, label, call sites, wheel). W2 server (migration, token write,
per-recipient pushes) after W1's label table exists. W3 Design Lead gate. Giorgio: `db push`
and the function deploys with the usual verification. Ships in the build after 13 unless it
is ready sooner; it does not block the phone pass.

## Models

| Role / workstream | Model | Why |
|---|---|---|
| Planner | Fable 5.2 | The plan |
| W1 mobile | Opus plan turn, then Sonnet | Many call sites, one clear rule |
| W2 server | Opus plan turn, then Sonnet; `supabase-reviewer` + `security-reviewer` | A new column on an owner-only table and its grants |
| Design Lead gate | Opus | Judgement at AX5 |
| Orchestrator | Opus | Verification, deploys |
