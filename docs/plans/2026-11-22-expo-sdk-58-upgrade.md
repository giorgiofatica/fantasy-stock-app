# The Expo upgrade (SDK 54 to 58), so the app builds with Xcode 27

Status: Approved (Giorgio, 2026-11-22: "approved, we'll start it after build 18"). Not started; it starts after build 18 is out. Approving the plan is not approval of the build or of any merge
Planner session: "Planner" (Fable 5.2), 2026-11-22 · Orchestrator hand-off: this commit

## Goal

Apple's notice on build 17 (ITMS-90725) says uploads must be built with the iOS 27 SDK from
April 2027. An app on Expo SDK 54, built that way, does not launch correctly on iOS 27. The
app moves to Expo SDK 58, the first one built for iOS 27, and nothing a manager sees changes.

## Giorgio's rules

- 2026-11-22, on when: "I don't really understand why we would wait. Like we're just
  prolonging the inevitable... if we need to do an update, let's just nip it in the bud,
  especially since this thing isn't live yet. There's no one else but me. So I think now is
  the time to do these kind of updates." The research had advised early January.
- 2026-11-22, on the order: "Option A will do this build first", then, the same day, "I
  would actually want to get those four elements in the build. And then from there, we do
  the build and then we do the upgrade." So: the Stocks tab's part 3, build 18, then this.
- Standing: nothing goes to the App Store until he says. The builds and submits are his.

## What the research found

[`../research/2026-11-18-xcode-27-ios-27-sdk-requirement.md`](../research/2026-11-18-xcode-27-ios-27-sdk-requirement.md),
read 2026-11-18. The Researcher marked two changelog pages as read through a summarizer, so
every version number below is confirmed again in step 0 before anything is changed.

- It is four SDKs in one move: 54 (React Native 0.81) to 58 (React Native 0.88).
- SDK 58 uses the iOS "scene" life cycle by default, which is what iOS 27 needs.
- The largest unknown is Google sign-in: its return from the browser arrives through a
  callback that the scene life cycle moves. No source confirms it works. It is tested first.
- Invite links depend on the same kind of callback.
- The minimum iOS version rises from 15.1 to 16.4 (the iPhone 7 and the first iPhone SE drop
  off). Told to him on 2026-11-22.
- Not found: whether Apple's rule also blocks TestFlight uploads; how long Expo patches SDK 57.

## What I read in the app (main, 2026-11-22)

- Expo `~54.0.30`, React Native `0.81.5`, React `19.1.0`, expo-router `~6.0.21`,
  Reanimated `~4.1.1`, Worklets `0.5.1`, TypeScript `~5.9.2`. No `ios/` folder: the native
  project is generated at build time.
- `app.json`: version `1.3.0`, and the over-the-air update key is the app version
  (`runtimeVersion: { policy: "appVersion" }`). `eas.json` sets no build image.
- Four imports of `@react-navigation/native` (the research counted three; `useRowPrices` was
  added since): `app/_layout.tsx`, `DraftRoom.tsx`, `LiveDot.tsx`, `lib/stocks/useRowPrices.ts`.
- 94 files use the text-size workarounds written for React Native 0.81 (`remeasureKey`,
  `cappedType`, `useRowRemountKey`, capped text). Their comments name 0.81's renderer as the
  cause. A newer React Native may have fixed the cause, changed it, or neither.
- This Mac already has Xcode 27.0 and Node 24.12, so the simulators and the capture tools
  run on Xcode 27 today.

## Decisions

| # | Question | Decision | Whose |
|---|---|---|---|
| 1 | When | After build 18, before any new feature work | Giorgio, 2026-11-22 |
| 2 | Which SDK | 58. SDK 57 with its opt-in is the fallback only if 58 has a blocker | Planner, from the research |
| 3 | One jump or steps | One SDK at a time (55, 56, 57, 58), each a commit with the checks run, all on one branch and one pull request. Nothing in between ships. SDK 56 is passed through, not stopped on (its memory problem was fixed in 57) | Planner |
| 4 | The app's version | 1.4.0 for the upgraded app | Planner: see "Over-the-air updates" |
| 5 | Old iPhones | iOS 16.4 is the new minimum | Follows from SDK 56; told to him |
| 6 | What happens to the text-size workarounds | They stay. They are removed only if the Design Lead's sweep shows the cause is gone, and then as separate work | Planner |
| 7 | Feature work during it | Paused on the app. Server-only fixes are fine | Told to him 2026-11-22 |

## How it goes

### Step 0: check before touching anything (read-only)

- Confirm on Expo's own pages: SDK 58's current patch release, its React Native and React
  versions, the scene life cycle note, the Node requirement, and each SDK's breaking changes.
- Confirm the build image the `auto` setting gives an SDK 58 project is an Xcode 27 one.
- Confirm Expo Go for SDK 58 installs on this Mac's simulators. The Design Lead's captures
  and every worker's tap-through run in Expo Go; if it will not install, stop and report.
- Read whether `eas update` has ever been published to the `production` channel.
- Anything that differs from the research comes back to the Planner before step 1.

### Step 1: the upgrade, on its own branch

For each of 55, 56, 57, 58 in turn: Expo's install-and-fix command for that SDK, then Expo's
doctor, then the mobile checks CI runs (lint, types, the source manifest, the logic tests),
then a commit. Known changes to make along the way:

- Delete `newArchEnabled` and `android.edgeToEdgeEnabled` from `app.json` (removed in 55).
- Run the expo-router codemod at 56 and re-check the four `@react-navigation/native` imports.
- TypeScript goes to 6: fix the type errors it raises; do not loosen `tsconfig`.
- SDK 56 makes Expo's `fetch` the global one. Keep it unless Supabase calls or Realtime
  misbehave; the documented switch back is the fallback, and using it is reported.
- Set the app's version to 1.4.0.
- `deno.lock` and the mobile lockfile are regenerated, never hand-edited. CI's frozen-lock
  check must pass.
- No behaviour change, no new words, no restyling. A change that alters what a manager sees
  is a stop-and-report.

### Step 2: prove it in the simulator

In this order, because the first two decide whether SDK 58 is usable at all:

1. Google sign-in, start to finish.
2. An invite link, with the app closed and with it open.
3. Apple sign-in; email sign-in; sign-out.
4. A push notification tapped with the app closed and open.
5. The draft room's live updates and the live dot (Supabase Realtime, the four imports).
6. Charts on Portfolio and the stock sheet; the Game Night animations.
7. Buy and sell from the Stocks tab; the sale picker.

Then the Design Lead's full sweep at Large and at the largest text size, in both orders
(start large; change size while open), on every screen. This is where the 94 files of
text-size workarounds are judged.

### Step 3: build 19 and the phone pass

After the pull request is green and steps 1 and 2 are done, he merges it, makes build 19
(1.4.0) from `main`, and walks the full phone-pass list on his phone. Build 18 stays on
TestFlight as the known-good copy until 19 passes. Feature work resumes when it does.

## Over-the-air updates

The key that decides which app builds receive an over-the-air update is the app's version.
Builds 17 and 18 are 1.3.0 and have the old native code. If the upgraded code were also
1.3.0, an update published later would be offered to those old builds and could crash them.
Moving to 1.4.0 makes that impossible. `docs/STATUS.md` already says never to run
`eas update` from `main`; that stays.

## Risks

- **Google sign-in or invite links do not work under the new life cycle.** Found in step 2,
  before any build. If there is no fix in the library or in Expo, the fallback is SDK 57 with
  its opt-in, and it comes back to him first.
- **A text-size regression.** The workarounds may misbehave on the new renderer. The sweep
  finds it; fixes are part of this work.
- **A library with no SDK 58 version** (the charts, the date picker, Google sign-in). Step 1
  finds it at the install. A replacement library is a stop-and-report, not a worker's call.
- **The capture tools.** If Expo Go for SDK 58 does not run in the simulators, the Design
  Lead cannot gate. Checked in step 0, before anything changes.
- **The parked web join draft (#279)** will conflict in its lockfile and is refreshed after.
- **Time.** Feature work on the app is paused until build 19 passes on his phone.

## Done means

1. CI green on the pull request: lint, types (TypeScript 6, no loosened settings), the source
   manifest, the logic tests, the frozen locks.
2. Expo's doctor reports no problems.
3. Step 2's seven checks pass in the simulator, each with a recording or a still.
4. The Design Lead's sweep passes at Large and the largest size, both orders.
5. The EAS build log for build 19 shows an Xcode 27 image, and the build uploads with no
   ITMS-90725 notice.
6. Build 19 launches on his phone and the phone-pass list passes.

## Giorgio's steps

1. Approve this plan. Done, 2026-11-22.
2. Merge the pull request when it is called.
3. Make build 19 and submit it to TestFlight.
4. Walk the phone pass.

## Workstreams and models

One worker, Opus, for steps 0 to 2 (a wide change where a wrong guess is expensive). The
Design Lead for the sweep. No migration, no function deploy, no prod step until the build.
