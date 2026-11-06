# Phone pass, 1.3.0 (9): the one list, in order

Build 9 (TestFlight, from `514991dd`) contains everything on `main`. Nothing here waits for
another build. Numbers in parentheses are `WALKTHROUGH_1.3.md`'s items; the rest are build-8/9
fixes that never reached a phone.

**How this list works**

1. Steps run **top to bottom, one at a time**. Step N+1 does not start, and nobody mentions it,
   until step N is ticked.
2. A step is ticked when it passed, or is marked **unreachable** with the reason (for example "no
   tie exists"). A step that fails is NOT ticked: it gets a finding, the fix ships, and the step
   is re-run on the new build before the list moves on.
3. Setup is a step too. It sits right before the first check that needs it, so you never set up
   anything early.
4. The Orchestrator ticks this file from your recordings and reports only on the **current**
   step. Giorgio never has to look past the first unticked box.

**Already passed, nothing to redo:** (1) (2) (3) (4) (5) on builds 5 and 7; the two solo halves
of (8): the pre-draft Commissioner row opens "Make someone else commissioner", and in season the
row is static with its caption (build 8); a live size change on login with the email filled shows
no "Save Password?" sheet (build 8).

**Watch the whole way, every step:** Portfolio drawing blank for ~10 s on open or after a league
switch (18). Note the time and what you had just tapped if it happens.

---

## Part A · alone, your phone, no setup

- [ ] **Step 1. Fresh install first (17).** Delete the app, reinstall build 9. On Get started tap
  Create a league or Join with a code straight away. Right: it responds to the first tap.
- [ ] **Step 2. Text size to AX5.** Settings › Accessibility › Display & Text Size › Larger Text ›
  Larger Accessibility Sizes on, slider all the way right.
- [ ] **Step 3. Home at AX5, cold launch.** Hero whole, "season gain" and "today" present, no line
  starts with "·", nothing clipped.
- [ ] **Step 4. Home at AX5, live change.** Drop the size to L from Control Center, come back to
  Home, raise it to AX5 again without quitting. Right: same as step 3.
- [ ] **Step 5. The "Your season" strip.** Opens on a whole tile; "Wk N" never wraps; the small
  label is never bigger than the value; the upcoming opponent's name stays on one line; tapping a
  past week opens League › Schedule.
- [ ] **Step 6. League › Schedule, an unscored past week** shows "–", not a result.
- [ ] **Step 7. A tied week reads T** on Home and in Schedule. Tick as **unreachable** if none of
  your leagues has a tie (none did on 11-04).
- [ ] **Step 8. Times never split.** "9:30 AM ET" whole on This week, the pre-draft card, the
  draft lobby and the market-closed notes.
- [ ] **Step 9. "vs {name}"** breaks only after "vs".
- [ ] **Step 10. Invite code on one line** (League settings), and the "Invite code" label is never
  bigger than the code.
- [ ] **Step 11. Typing through a size change.** In Create league (or the draft search), type,
  raise the size, lower it again, keep typing. Right: the field returns to normal on blur; the
  draft search placeholder resizes after AX5 → L.
- [ ] **Step 12. Login with the PASSWORD filled plus a live size change.** Right: no "Save
  Password?" sheet.
- [ ] **Step 13. No intro cards** after Sign out, then Sign in.
- [ ] **Step 14. Create League A.** Create league: **size 4, playoff teams 3**, draft time
  tomorrow. Those two settings matter later (Part B) and can only be set at creation. Don't
  draft it.
- [ ] **Step 15. Pre-draft Home with Share (9).** In that league: Members card whole, "+N" circle
  whole, code and Share both there; Share opens the sheet with "Join my league with code …".
- [ ] **Step 16. Save queue (14).** In that league: Build your queue, add stocks, move one, Save
  queue; force-quit and reopen; the queue is as you left it.
- [ ] **Step 17. Text size back to normal (10).** Home and Portfolio look as before.

## Part B · three throwaway email accounts (T1, T2, T3)

- [ ] **Step 18. Allowlist three throwaway addresses (T1, T2, T3).** Sign-ups are gated, and a
  draft needs 4 members, so Part B uses three throwaways. In the Supabase SQL editor, addresses
  in lowercase, one row each:
  `INSERT INTO public.signup_allowlist (email, note) VALUES (lower('you+t1@gmail.com'), 'build-9 phone pass T1');`
  **Use a real email domain.** Supabase Auth refuses example.com and other test domains at
  sign-up ("Please enter a valid email address"; its `email_address_invalid`: "Example and test
  domains are currently not supported"). Plus-addressing on a real inbox works (`you+t1@gmail.com`,
  `+t2`, `+t3`); with Confirm email off, no mail is sent to it.
  (Deleting an account later leaves its row in place, so the address can sign up again.)
- [ ] **Step 19. Sign T1, T2 and T3 up** (a simulator is easiest; signing out and in on your
  phone also works) and have all three **join League A** (step 14) with its code: 4 members.
- [ ] **Step 20. Hand over, for real (8).** Your account, League A › League settings › Commissioner.
  Right: the list shows T1, T2 and T3; Hand over names the one you pick; Cancel. (Bots never
  appear; that's by design.)
- [ ] **Step 21. Move forward (11).** T1 leaves League A (League settings › Leave league): 3 in,
  3 playoff teams. Your Home or League tab names T1 with Move forward / Invite someone new. Tap
  Move forward. Right: it saves, the notice goes, and stays gone after a force-quit.
- [ ] **Step 22. Invite someone new (12).** T1 rejoins with the code and leaves again. Tap Invite
  someone new. Right: it saves; the notice stays until T1 joins again with the code, then goes by
  itself.
- [ ] **Step 23. The playoff-teams stepper (13).** T1 and T2 leave League A: 2 in, 3 playoff teams.
  Right: the card says "3 playoff teams, but 2 teams are in" with "Up to 2, one per team."; the
  minus makes it 2 and the line clears; League settings shows 2 after a force-quit. (Playoff
  teams can't be raised in the app; they're set at creation, which is why step 14 chose 3.)
- [ ] **Step 24. League B.** Create a second test league, size 4, draft time soon. T1, T2 and T3
  join with the code **before** the draft (a league refuses joins once its draft starts). Let the
  draft run on the clock; the server picks for anyone who doesn't. (The phone can't add bots;
  that's web-only and the web is paused.)
- [ ] **Step 25. Delete T1 (30).** On T1: Profile › Delete account. Wrong
  password first. Right: "That password isn't right. Try again." and the field clears. Right
  password → Delete my account → "Are you sure?" → Delete. Right: signed out, sign-in shows
  "Your account is deleted."
- [ ] **Step 26. What the league sees (31).** Your account, League B: Standings, Matchup and the
  team view show "Former manager" with the plain avatar, never the old name. Keep League B.

## Part C · a second phone (or a friend)

- [ ] **Step 27. A second real account on a second phone**, allowlisted the same way as step 18.
- [ ] **Step 28. Find a new manager, for real (32).** Your account, League B › League settings ›
  Members › the Former manager row › Find a new manager › Share, a real tap, to the other phone in
  Messages. On it, tap the link. Right: "Take over Former manager's team in {league}?" → Take the
  team puts that account in League B with that team. Open the same link from T3. Right:
  "Someone already took this team."
- [ ] **Step 29. A hand-typed take link waits for a tap (33).** A fresh Find a new manager link's
  code, typed as `fantasystockapp://take/CODE` into Notes while signed in, tapped. Right: "Take
  over a team" with Find league / Not now; nothing about the league until Find league; Not now
  does nothing.
- [ ] **Step 30. A run-back league.** A finished test league (League B once its season ends, or
  an older one), run back, with everyone having answered I'm in except the second account, and
  the draft not yet set.
- [ ] **Step 31. The nudge (15).** The row of the one who hasn't replied › Nudge again. Right: the
  other phone buzzes; opening the sheet again says once a day and when you nudged.
- [ ] **Step 32. The second account answers I'm in; then the Renewal change sheet at AX5 (7).**
  Change › the sheet's I'm out / I'm in pinned and reachable; tapping your current answer closes
  it with no change. Text size back after.
- [ ] **Step 33. Schedule the draft (16).** Everyone answered: the review screen. Right: Schedule
  the draft greyed with "Pick a future draft time." until a future time is picked; then it saves,
  Home shows the countdown, everyone is notified.
- [ ] **Step 34. The sale picker at AX5 (6)**, *market open*. In a fixed-amount-slot league, sell
  two stocks, then Buy a stock › Review buy. Right: "Which sale pays for this?" lists them, "Use …"
  pinned and reachable. Text size back after.

**Part C done = the 1.3 phone pass is complete except sign-in links.** Everything below needs
the dashboard work first.

## Part D · launch prep, then sign-in and invite links

- [ ] **Step 35. Launch prep** (STATUS §4 item 2, parked since 10-16): Supabase Auth redirect
  URLs, Confirm email, the Apple and Google providers, manual linking OFF, the Before-User-Created
  hook test, custom SMTP; Apple web sign-in (Services ID + the .p8 secret, which expires within 6
  months, so calendar it); the store/TestFlight URL in `universal-links.config.json` and #279
  merged.
- [ ] **Step 36. Sign-in and invite links (19–28)**, in the walkthrough's order.
- [ ] **Step 37. Delete an Apple-signed-in test account (29).** A test Apple ID that has signed
  in; after deletion the app is gone from Settings › your name › Sign in with Apple.

---

## Not phone checks (parked, for the record)

P3, awaiting the Design Lead: pull-to-refresh doesn't force a ledger reload; Home's summary
refresh after a trade is unchecked. Accepted, won't fix: the league-switcher P2; a focused field
keeping its scroll offset after a live L → AX5 (heals on a keystroke or blur).
