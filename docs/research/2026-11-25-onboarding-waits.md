# Onboarding: the three waits (Workstream 1)

2026-11-25. For the Orchestrator. Plan: `docs/plans/2026-11-25-onboarding-finish-and-feel.md`
(approved). Code read on `main` at `0687e35f`.

**Nothing here was measured.** No app run, no simulator, no call to prod, no app code changed.
Call counts and order are read from the code. Every duration is either a constant in the code
or marked as an estimate. Deployed function versions were not compared with `main`.

Paths are under `apps/mobile/` unless they start with `supabase/`.

## Short version

| Wait | What gates it | Normal case | Worst case |
|---|---|---|---|
| 1. Invite spinner | 5 round trips from the phone, one after another. **3 of them run after the join has already succeeded.** | A few seconds at most (estimate) | No app deadline, no words, no back control |
| 2. Grey "Keep" | **1** database call. There is no name-making server function. | About one round trip | 6 s, then an empty field. "Change" works throughout |
| 3. Home header-only | 3 stages of reads, then a skeleton while 1 to 3 more run | New pre-draft member: 4 stages to the card | Header or skeleton with no end and no message |

Found on the way (from the code; none seen on a device):

1. **A skeleton that does not end by itself.** If `get_home_summary` fails while the league
   list reads fine, Home stays on its skeleton with no error (Wait 3, "stuck skeleton").
2. **A likely "No leagues yet" flash** for a brand-new invited member, between "Keep" and
   the join screen (Wait 3, "what a new member sees").
3. **The plan's picture of Wait 2 needs one correction.** The 6 s is a cap for a stalled
   connection, not the usual wait. A "rolling name" animation that runs longer than the call
   would add time, which the plan's first motion guardrail forbids.

## No app deadline on any of these calls

The only client timeout is for sign-in traffic: 25 s on URLs containing `/auth/v1/`
(`lib/auth/authFetch.ts:16,39`). Database reads, database functions (`rpc`) and edge
functions have none.

React Native 0.81.5 passes the request's timeout (default 0) to iOS
(`RCTNetworking.mm:326`). What iOS does with that value I did not test, so I give no number
for how long a stalled request lasts. The edge gateway ends a function request at about
150 s (CLAUDE.md, success signal 8). That does not cover a phone that never reaches it.

A device that is plainly offline fails fast and reaches the error paths. The long case is a
connection that stays open and answers nothing.

---

## Wait 1: the spinner in `join-league.tsx`

**What it is:** invite mode with `step === 'code'` and `findStatus === 'loading'`
(`app/join-league.tsx:429-438`). A bare `ActivityIndicator`: no words, no footer, no back
control.

It starts when the screen mounts. The root layout pushes it once the phase is `ready`
(`app/_layout.tsx:230`), which is right after "Keep" for a new member.

### Critical path (all sequential)

| # | Call from the phone | Inside it, in order | Code |
|---|---|---|---|
| 1 | `preview-league` | `getUser` → 2 rate-limit rpcs (parallel) → league by code → member count → "already a member?" → inviter's username. **6 stages**, 8 if the code is a `league_invites` code; the inviter read is skipped in some cases | `supabase/functions/preview-league/index.ts:63-127` |
| – | local write `markTried` | on the phone, before the join | `lib/invite/inviteJoin.ts:122` |
| 2 | `join-league` | `getUser` → 2 rate-limit rpcs (parallel) → `join_league_by_code` (one transaction; locks the league row; may also set the draft order). **3 stages** | `supabase/functions/join-league/index.ts:101-187` |
| – | local write `clear` | the stored invite is dropped here | `inviteJoin.ts:98` |
| 3 | `refresh()`: own `league_members` rows | | `lib/LeagueContext.tsx:328-332` |
| 4 | `refresh()`: the `leagues` rows | | `LeagueContext.tsx:340-344` |
| 5 | `refresh()`: 5 reads in parallel | `get_home_summary`, member counts, season rows (if any), `market_session_status`, `market_calendar`. The slowest one sets the time | `LeagueContext.tsx:176-184,365` |

Only then does "You're in" render (`join-league.tsx:262-264`, then `293-299`). The tap
variant (a link opened while already signed in) runs call 1 alone, and calls 2 to 5 sit
behind the Join button's own spinner.

### Expected time (estimate, not measured)

Roughly 5 phone round trips plus the work inside two functions (9 sequential server stages,
and the database reads). My assumptions, none of them measured here: a round trip of about
0.1 s on good Wi-Fi and 0.5 s or more on a weak signal; tens of milliseconds per server
stage; up to a couple of seconds extra when a function starts cold, and each of the two can
start cold separately.

- Good Wi-Fi, functions warm: about 1 to 2 s.
- Both functions cold: about 2 to 5 s.
- Weak signal: about 4 s and up.

The recording replaces these numbers. Treat them as a guess about size only.

### What can make it long, or leave it spinning

| Path | Result | Feedback while waiting |
|---|---|---|
| `preview-league` stalls | Spinner until the platform or gateway gives up, then the code form with an error and "Find league" to retry | Spinner only |
| `join-league` stalls | Same, ending on the preview with an error and "Join". `triedJoin` is saved, so a lost answer is handled | Spinner only |
| **A read in 3, 4 or 5 stalls** | **Spinner continues although the person has joined.** The invite is already cleared (`inviteJoin.ts:98`). After an app restart they are a member, but "You're in" never shows | Spinner only |
| A read in 3 or 4 *fails* (returns an error) | Not a hang. "You're in" shows without the facts rows; Home then shows its load-failed state | The screen moves on |
| `get_home_summary` alone fails | "You're in" shows. Home then hits the stuck skeleton (Wait 3) | None |
| A newer read replaces `refresh()` | `refresh()` returns early; "You're in" can show before its rows arrive | Rows appear late |
| A newer invite replaces this one | The screen leaves by itself (`autoJoin.ts:188`) | Handled |
| Rate limit, 5xx, offline | Error paths with copy and a retry tap. No automatic retry | Handled |

**No way out:** the spinner renders `AuthScaffold` with no `back`, and the route is a
`fullScreenModal` (`_layout.tsx:69,406`), which I expect cannot be swiped away on iOS
(not tried). If so, the only exit from a stall is closing the app.

### Ways to shorten it (proposals only)

- **A. Show "You're in" when the join answers; let the facts rows arrive after.** This takes
  calls 3 to 5 (3 of the 5 round trips) off the wait. The headline and draft sentence come
  from calls 1 and 2. Ruling C1 in the code (`join-league.tsx:532`) says the rows are read
  after the join and never taken from the preview; this keeps that. Cost: the card appears a
  moment later, which the Design Lead should see. It must also check the two things that
  assume the list is ready: the "Go to the league" tap and the active-league choice.
- **B. Put a deadline on the two function calls and on `refresh()`.** The calls would fall
  into the error paths that already exist, with their copy and retry tap. For `refresh()`,
  the deadline should continue to "You're in", never to an error, because the join is done.
  This shortens only the worst case, and needs no new words.

Smaller, server side: the last three reads in `preview-league` (count, membership, inviter)
do not depend on each other and could run in parallel. That is a function deploy for a
small gain, so I would do it only if the recording shows call 1 is the slow one.

---

## Wait 2: grey "Keep"

**What it is:** on first run the picker starts in `suggesting`. "Keep" is disabled, the
field is empty and locked, and the field's trailing icon shows "checking"
(`components/shell/UsernamePicker.tsx:215,224,233,267`). **"Change" is enabled the whole
time** and opens the field for typing (`:268,122-125`).

**What it waits on:** there is no `suggest-username` function. The phone makes 8 names
itself (`lib/shell/gamertag.ts:71-82`), then makes **one** call, the `check_usernames` rpc,
to see which are free (`gamertag.ts:97-108`). It tries up to 3 batches, but only if all 8
names in a batch are taken.

**The timeout:** `SUGGEST_TIMEOUT_MS = 6000` (`UsernamePicker.tsx:57`), one cap over all
the attempts (`:97-98`). At the cap the screen becomes the plain form with an empty field.
The late answer is ignored; the request itself is not cancelled.

**Server work** (`supabase/migrations/20261116000000_scrape_hardening.sql:69-124`): a
sign-in check, two rate-limit counter writes, then up to 8 lookups on the unique index
over `lower(username)` (`20251210100000_create_user_profiles.sql:10-12`). It is one
database function with no cold-starting edge function in front. I expect milliseconds
(estimate).

**How often does a real name beat 6 s?** I cannot give a percentage without production
data. From the code:

- A second batch is practically never needed. There are 54 adjectives × 42 animals × 990
  numbers, about 2.2 million names before the safety filter. All 8 being taken is not a
  realistic case at our size.
- So the wait is one request, on a connection the phone used moments earlier to read the
  profile. A name arrives in time whenever that one request completes within 6 s.
- I expect that on any working connection, including a poor one. The cap should matter only
  when a request stalls, or the database or API is badly slow.
- Offline does not wait 6 s. The call fails, and the empty field appears at once.

**Worst case:** 6 s. **No feedback:** none strictly, since the field shows "checking". No
words say why "Keep" is grey, and nothing says "Change" is a way past it. When the cap hits,
the screen turns into the empty form without explanation (intended).

**Next to it:**

- Before this screen appears, the app reads the profile (`lib/SessionProvider.tsx:198-221`).
  That read has no deadline, and until it returns the previous screen stays up.
- After "Keep", `set_username` runs with a button spinner and no deadline, then a short
  motion hold. A transport failure falls back to the typing form.

### Ways to shorten it (proposals only)

- **A. Ask for the name earlier:** start the check as soon as a sign-in is known to have no
  username, before the screen is drawn. This hides most of the round trip, at the cost of
  holding the result outside the picker.
- **B. Leave the timing alone and make the roll follow the answer.** The name settles as
  soon as the answer arrives; any minimum animation time is kept short enough not to be a
  wait, and a tap ends it. I would not lower the 6 s before the recording: lowering it only
  turns slow successes into empty fields.

This matters for Workstream 3. The plan calls this "the wait of up to 6 seconds turned into
the most playful second". In the usual case there may be much less than a second of real
waiting.

---

## Wait 3: Home shows only its header

**The gate:** with no leagues in hand and the league list loading, Home renders
`ShellHeader` and nothing else (`app/(tabs)/index.tsx:430-440`; the rule is
`lib/game/leagueView.ts:35-37`). That comment says "the header and a skeleton"; the League
tab draws one (`app/(tabs)/league.tsx:296-304`), **Home does not**.

### What gates first paint

| Stage | Read | Screen |
|---|---|---|
| 1 | own `league_members` | header only |
| 2 | `leagues` | header only |
| 3 | 5 in parallel (the Wait 1, call 5 set) | header only |
| 4 | `get_home_league` | skeleton |
| 5 | `quote` (edge function), only if anyone holds or traded a stock | skeleton |
| 6 | `historical-bars` (edge function), same condition; **waits for 5 although it does not use its answer** | skeleton |

Stages 1 to 3 are `LeagueContext.tsx:328-381`. Stages 4 to 6 are
`lib/home/useHomeLeague.ts:667,694,711`.

- **New member, one league, before the draft:** no symbols, so 5 and 6 are skipped. Four
  stages to the pre-draft card. The card then starts its own reads: draft status
  (`draft-control`), and `get_draft_order` with the names. It can show the league's stored
  draft date meanwhile.
- **In season:** all six. Inside `quote`, uncached symbols go to the price vendor 5 at a
  time, batch after batch, with up to 4 tries per symbol
  (`supabase/functions/quote/index.ts:131-147`, `_shared/alpaca-price.ts`). Not part of
  onboarding, but it is the same "Home is slow" screen later.
- **Cold launch while signed in:** the splash holds until the profile is read. The league
  reads start alongside that read, so part of stages 1 to 3 hides behind the splash. An
  expired session token is refreshed first, an extra round trip.

### What a new member sees (from the code)

1. The league list was already read at sign-in, while they were on the username screen,
   and came back empty.
2. They tap "Keep". The tabs mount with an empty, finished list, so Home's rule gives
   **"No leagues yet"** (`leagueView.ts:36-37`).
3. The join screen is pushed on the next tick and slides over it. So that screen is
   **likely visible for the length of the slide**. It is the wrong thing to show someone
   arriving by invite. The recording should confirm it.
4. After the join, `refresh()` sets loading again with the list still empty, so Home goes
   **header-only**, hidden behind the join screen.
5. By "You're in" the league list has arrived, and Home's own read has started underneath.
   By the time they pass "Go to the league" and the notifications ask, Home is probably
   ready (inferred).

So on the invited path the header-only wait is mostly hidden. They would meet it on later
cold launches.

### Worst cases and missing feedback

- **Header-only:** no spinner, skeleton, words or accessibility busy state, and no
  pull-to-refresh, because this branch has no scroll view. A stall in stage 1, 2 or 3 holds
  it, and Home offers no retry. A read that *fails* does reach the load-failed state with
  Try again (stages 1 and 2).
- **Stuck skeleton:** if `get_home_summary` returns an error, `fetchSheetFacts` logs it and
  goes on with an empty summary (`LeagueContext.tsx:187-188`). The list is published as
  loaded. `useHomeLeague` then finds no summary and sets `'no-league'`
  (`useHomeLeague.ts:659-661`). `HomeBody` has no branch for that: with no view model it
  draws the skeleton (`index.tsx:140`). **No error, no retry button, no automatic retry.**
  A pull-to-refresh would re-read and could recover it, but nothing says so. The same
  happens if the summary lacks a row for the active league. This is the partial-read shape
  CLAUDE.md warns about: one of several reads fails and the screen reads it as "still
  loading".
- **Skeleton, stalled:** a stall in stage 4, 5 or 6 keeps the skeleton. A *failed*
  `get_home_league` shows "Couldn't load this league". A failed quote or bars read still
  draws Home.

### Ways to shorten it (proposals only)

- **A. Draw `HomeSkeleton` under the header while pending**, as League already does. It
  makes the wait no shorter, but it stops looking broken. It changes a look, so it goes to
  the Design Lead.
- **B. Cut the chain:** run `quote` and `historical-bars` in parallel (saves one stage in
  season; nothing for a pre-draft member). A larger option is reading memberships and
  leagues in one request (saves one stage everywhere, including Wait 1). That one touches
  the failed-versus-empty rules in `lib/shell/leagueRead.ts`, so it needs their tests.

Two fixes that are about correctness more than speed, each worth its own small change:

- Give the missing-summary case an error state with Try again.
- Do not show "No leagues yet" while an invite is still waiting to be joined. Dismissed,
  failed and refused invites must still reach the normal empty state.

---

## What to record (Giorgio's part)

The 30 s budget is the whole path, so it includes more than these three waits: the arrival
screen, Apple or Google's own sheet, the profile read, and the time a person takes to read
and tap. (The signed-out `invite-preview` call behind the arrival screen answers no faster
than 400 ms by design: `supabase/functions/invite-preview/respond.ts:22`.)

**To check before he starts** (Orchestrator):

- The build on his phone contains this onboarding flow. I did not check which build does.
- He has a test sign-in that **has never picked a username** and is allowed to sign up
  (the plan says sign-ups are paused for everyone off the allow-list). Each full run uses
  one up. I did not check whether deleting a test account makes the sign-in new again.
- The test league has a free seat and its draft is more than an hour away, or has no time.
- **The shared https link does not open the app yet** (plan, "on a real phone today"). He
  uses `fantasystockapp://join/<CODE>`, typed into Safari, then "Open". Signed out, it
  runs the same automatic join (`lib/invite/autoJoin.ts:113-118`). Safari's prompt is not
  part of the real path, so **the clock starts when the app appears**. The result is a
  stand-in until the real link works.

**Recordings** (iPhone screen recording, one take each, no pausing, kept outside the repo
because they show personal details):

1. **Invited path, Wi-Fi.** Signed out, app closed. Start recording, open the link, use
   Apple or Google, tap "Keep" as soon as it turns solid, wait for "You're in", tap "Go to
   the league", answer the notifications ask, stop once Home is full.
2. **Invited path, weak signal.** The same with a second unused sign-in. Use a spot with
   poor cellular and Wi-Fi off, or the iPhone's Network Link Conditioner if Developer
   settings are on. Say which was used.
3. **Home on launch, Wi-Fi.** Signed in as a member: swipe the app closed, start
   recording, tap the icon, stop when Home is full. Do it once after the app has been
   unused for over an hour, and once straight after.
4. **Home on launch, weak signal.** Recording 3, once, on the weak connection.

For a spinner or blank screen that does not end: leave it recording for 60 s, then stop. Do
not tap around first.

**Times to read from the video** (a session can do this frame by frame; he does not need to
time anything):

| Mark | Frame |
|---|---|
| T0 | the app appears from the link |
| T1 | the invitation with its three buttons is complete |
| T2 | tap on Apple or Google |
| T3 | "Pick a username" appears |
| T4 | "Keep" turns solid with a name (or the empty field appears) |
| T5 | tap on "Keep" |
| T6 | the join spinner appears (**also: does "No leagues yet" show between T5 and T6?**) |
| T7 | "You're in" |
| T8 | tap on "Go to the league" |
| T9 | Home is full |

Budget: **T0 to T7, under 30 s.** Wait 1 = T6 to T7. Wait 2 = T3 to T4. For recordings 3
and 4, note the icon tap, the first header-only frame, the first skeleton frame and the
first full Home.

These recordings time what the person sees. They cannot split Wait 1 into its five calls.
If Wait 1 is over a few seconds, splitting it needs temporary timing logs or the function
logs, which is a separate, later decision.
