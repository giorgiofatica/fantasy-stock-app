# Onboarding: finish and feel

Status: Approved (Giorgio, 2026-11-25: "approved both"). Not built.
Planner, 2026-11-25. Builds on [`2026-10-14-onboarding.md`](2026-10-14-onboarding.md), which
stays the plan for what onboarding does. This one is about how quick it is and how it feels.

## Goal

A friend who taps an invite link is in the league in under half a minute, and the half
minute feels made, not assembled: each step moves into the next, the waits are moments, and
it ends on something they keep.

## Giorgio's rules

- 2026-11-25, after recording another app's onboarding (Pure: Poker & Mahjong) and reading
  the review of it: "i am in line with your findings and they match what i saw."
- The same day: "i didnt love some of the friction but the experience felt cool. Good
  transitions and good use of animations as well (eg the treasure reward at the end). Would
  love to plan how we could make the onboarding feel more modern and cool too".
- The same day, two picks (`docs/PRODUCT_RULES.md`, Onboarding): onboarding ends on something
  the new manager keeps, a crest ("B"); crests are a collection you earn, and nothing is
  bought ("B"). Crests have their own plan; this plan only leaves room for the reveal.
- Standing, from 2026-10-14: the invite is a link, not a code; three ways to sign in; a
  pre-filled username that can be changed; email and password sign-ups confirm their email;
  the three cards only on a cold install; push is asked after a league exists.
- Standing: no heading with a grey explainer under it (UX rule 12). Motion that does not run
  must leave the screen complete (Reduce Motion is binding, `docs/design/DESIGN_DIRECTION.md`).

## What we compared against

His recording, 4 minutes 53 seconds, kept with the references outside the repo (it shows
personal details). From opening the app to the last onboarding screen took about 4 and a half
minutes over about twenty screens, and no hand had been played.

- **Liked:** the real app visible behind the first sheet; one field per screen; the invite
  code resolving to the friend's handle; the heavy step asked late; small helps inside it
  (the text code filled itself in, "Continue anyway" past a lighting warning); an ending
  with a next step and a reward; every step moving into the next.
- **Friction:** the link did not carry the invite code (about 30 seconds outside the app to
  fetch it); a username that can never be changed; a forced join of strangers' groups; a
  brand animation and a payments pitch before any play; an identity check that was 40% of
  the whole; no sense of how long it would be; the real name shown on the profile unasked.

## What our onboarding is today

Read in the code on `main` at `8ad4d60c` and spot-checked.

**Invited friend, app installed.** The link opens "{inviter} invited you to {league}" with
Apple, Google and Use email. Apple or Google: one tap. "Pick a username", pre-filled, Keep.
The app joins the league with no tap. "You're in {league}" with the draft sentence and
Managers, Stakes, Season, then "Go to the league". The notifications ask. Home, with one tip
and "Build your queue". Three taps to be in.

**The same friend with email.** Create account (email, password, five rules ticked live),
"Check your email", leave for the mail app, tap the link, back in the app at the username.
Five screens.

**Cold install.** Three cards with Skip, "Get started" (Create a league / Join with a code),
account, username, then the four steps of Create league or the typed code.

**On a real phone today** (`docs/STATUS.md`, launch prep, parked): the https link does not
open the app, because the website does not yet serve the file that tells an iPhone to; the
web join page (#279) is parked; the email confirmation link lands on a dead page; sign-ups
are paused for everyone off the allow-list.

Against the other app's friction, ours has none of: the permanent username, the forced
join, the pitch before play, the identity check, the real name. It has, in part: the code
fetched by hand (only because the link is not live yet); a step outside the app (the email
path); two "Get started" in a row on a cold install; and three waits nobody has timed.

## Part 1: fixes

1. **The link comes first, and so does email that arrives.** Nothing here matters to a
   friend whose link opens a web page that goes nowhere, or who picks "Use email" and
   never gets the message. Two gates, both already on the launch-prep list, both his
   steps: the website serving the file that lets an iPhone open our links in the app; and
   our own email sender. The built-in sender reaches only addresses on the project's own
   team and a couple of messages an hour (`docs/STATUS.md`; confirmed again by the
   Researcher's reading of the provider's limits, 2026-11-25), so an outside friend who
   signs up by email would wait for a confirmation that never comes. Apple and Google are
   not affected. Launch prep stays its own parked list; this plan names these two as the
   precondition for letting anyone outside sign up, and adds nothing to them.
2. **The three waits get a budget and a measurement.** The join after the username shows a
   spinner with no words (`join-league.tsx`). "Keep" stays grey for up to 6 seconds while a
   name is made (`UsernamePicker.tsx`, `SUGGEST_TIMEOUT_MS`). Home shows only its header
   while leagues first load. Each is timed on a real phone, on Wi-Fi and on a weak signal,
   before anything is changed. The budget for the whole invited path with Apple or Google:
   under 30 seconds from the link to "You're in", measured from a screen recording the way
   the other app was.
3. **A cold install remembers what the person chose.** "Create a league" or "Join with a
   code" is held in memory only (`lib/shell/pendingRoute.ts`), so closing the app while
   waiting for the email loses it and the person lands on "No leagues yet". The invite does
   not have this fault; it is saved on the phone. The choice is saved the same way.
4. **One "Get started".** The last card's button and the next screen's title say the same
   words. The Design Lead rules which changes; if a word changes, it is his to approve.

## Part 2: small helps on the email path

The email path is our long one, and the only one that leaves the app.

1. **A button that opens the mail app** on "Check your email". Words to approve: "Open Mail".
2. **A code typed in the app, in place of a link.** We would email a short code; the
   person stays in the app, and the iPhone offers the code above the keyboard. It removes
   the trip out, the dead return page, and the email path's need for the link to open the
   app. It changes how email is confirmed, which decision 15 of the October plan settled
   on security grounds (one-time links). So it is not in this plan until two things are
   known: that our sign-in provider supports it for a new sign-up (the Researcher, from its
   documentation), and what the security review says. If both are good it comes to him as
   a question; if not, it is dropped and the link stays.

Already there, and kept: the iPhone's own strong-password offer, the five rules ticking
live, "Didn't receive it? Send again", the "Email confirmed" chip.

## Part 3: motion at four moments

**Three guardrails, from his own reaction to the other app.**
- Motion never adds a tap and never adds a wait. Anything that runs longer than about a
  second can be tapped through.
- With Reduce Motion on, every screen is complete without it.
- It holds at the largest text size, which is the size on his phone.

**The moments, all on the invited path.**
1. **Arrival.** The invitation opens: the inviter's mark, then the league's name, then the
   three buttons. Today the screen appears whole.
2. **The username.** The made-up name rolls into place, and "Change" rolls another. This
   is the wait of up to 6 seconds turned into the most playful second of the flow. If no
   name comes, the field is simply empty, as now.
3. **Taking your seat.** In place of the spinner with no words: the new manager's mark
   joins the others. No words are added.
4. **Between steps.** One move for every step forward, and the league's name stays where
   it is while the rest changes, so the flow reads as one thing.

The fifth moment, the reward on "You're in", is the crest's reveal and belongs to the
crests plan. Until that is built, "You're in" keeps today's tick.

**Touch and sound.** A light tap on the phone at the two moments that land (the username
settling, the seat taken). Sound is not used anywhere in the app today; whether onboarding
has any is a question for him below.

**How he judges it.** The Design Lead draws these as boards that move, in both themes and
at his text size, so motion is judged by watching it, not from stills. Each moment comes as
two versions side by side.

## Words

New, for his yes: "Open Mail". Nothing else in this plan adds a word; if a moving board
needs one, it is listed on the board.

## Open questions

1. **Sound.** A short sound at the end of onboarding, or none? The phone's silent switch
   would be honoured either way. For him, once there is something to hear.
2. **Does this ride in build 18, or after the Expo upgrade?** His call. The four moments
   can be made with what the app already has. A pre-made animation (the kind the other
   app's box was) needs a library the app does not have, which means a new build; that
   only matters for the crest's reveal.
3. **The typed code** (Part 2, item 2): waits on the Researcher and a security review.

## Scope

**In:** the timing of the three waits and the 30-second budget; the saved choice on a cold
install; one "Get started"; "Open Mail"; the four moments; touch.

**Out:** launch prep (its own list); crests and their reveal (their own plan); the web
join page; any change to what is asked of a new person or in what order; the cold install's
three cards, which were drawn and approved in October; showing league facts before sign-in
(ruled out on 2026-10-14 so that a link shows only the league's name and the inviter).

## Risks

- **Motion that costs time.** The reason for the guardrails. A moving board that looks
  good and adds two seconds is a failure by this plan's own goal, so every moment is timed
  in the build as well as drawn.
- **The username roll hiding a real fault.** If the name service is slow or down, the roll
  must not spin for ever: it ends at the same 6 seconds and leaves the empty field.
- **A second place that knows the flow.** The saved choice (Part 1, item 3) sits beside the
  saved invite. Both must be cleared the same way on sign-out, or one outlives the other;
  the tests cover a sign-out with each one pending and with both.
- **Old phones.** The moments are checked on the slowest phone we support, not only the
  newest.

## Workstreams

After Part 3 of the Stocks tab. The Orchestrator sets the order against build 18.

| # | Workstream | Model | His steps after it |
|---|---|---|---|
| 1 | Time the three waits on a phone; report before any change | Sonnet | none |
| 2 | The saved cold-install choice; one "Get started"; "Open Mail" | Sonnet, Design Lead gate | none (in the next build) |
| 3 | Moving boards for the four moments, two versions each | Design Lead | his picks |
| 4 | Build the picked moments, with touch; time each in the build | Sonnet, Design Lead gate | none (in the next build) |

## Done means

1. A screen recording on his phone, from tapping an invite link to "You're in" with Apple or
   Google, is under 30 seconds, and the three waits each have a measured time in `STATUS.md`.
2. A cold install that picks "Create a league", confirms its email after the app was
   closed, and comes back, lands on Create league.
3. A new person passes one "Get started", not two.
4. "Check your email" opens the mail app from its own button.
5. Each picked moment runs in the build, can be tapped through, and with Reduce Motion on
   the screen is complete without it; checked in both themes at the largest text size.
6. No step was added, and no tap, against the flow as it is on `main` today.
