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
- [ ] **Step 13. No intro cards after Sign out, then Sign in.** Profile › Sign out, then sign back
  in with your account. Right: the three intro cards (the swipeable screens a fresh install shows
  before Get started) do NOT appear again; you land straight on Home.
- [ ] **Step 14. Create League A.** Create league: **size 4, playoff teams 3**, draft time
  tomorrow. Those two settings matter later (Part B) and can only be set at creation. Don't
  draft it.
- [ ] **Step 15. Pre-draft Home with Share (9).** In that league: Members card whole, "+N" circle
  whole, code and Share both there; Share opens the sheet with "Join my league with code …".
- [ ] **Step 16. Save queue (14).** In League A: Home › Build your queue takes you to the League
  tab; scroll down to "Your queue" there. Add two or three stocks and move one with the arrows.
  Right: Save queue appears with "Not saved yet." under it; tap it and both go away; force-quit
  and reopen; the queue is as you left it.
- [ ] **Step 17. Text size back to normal (10).** Settings › Accessibility › Display & Text Size ›
  Larger Text: put the slider back to your usual size. Then open Home and Portfolio. Right: they
  look the way they did before this pass started.

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
- [ ] **Step 19. Sign T1, T2 and T3 up and join League A.** Two checks on League A first: League
  settings › Playoff teams must read **3** (set at creation; if it isn't 3, create a new League A
  with size 4 and playoff teams 3 and use that instead), and its draft must be **more than an hour
  away** (if it shows Postponed, Pick a new draft time about two days out). Then sign T1, T2 and T3
  up on build 12 (Profile › Sign out › Create account; Password shows above the keyboard; a
  "Verify Email" message arrives in your Gmail: tap Verify, ignore the localhost page that fails
  to load (that is launch prep; the verification still counts), go back to the app and sign in
  with the password) and have all three join with the code: 4 members.
- [ ] **Step 20. Hand over, for real (8).** Your account, League A › League settings › Commissioner.
  Right: the list shows T1, T2 and T3; Hand over names the one you pick; Cancel. (Bots never
  appear; that's by design.)
- [ ] **Step 21. Move forward (11).** T1 leaves League A (League settings › Leave league): 3 in,
  3 playoff teams. Your Home or League tab names T1 with Move forward / Invite someone new. Tap
  Move forward. Right: it saves, the notice goes, and stays gone after a force-quit.
- [ ] **Step 22. Invite someone new (12).** T1 rejoins with the code and leaves again. Tap Invite
  someone new. Right: it saves; the notice stays until T1 joins again with the code, then goes by
  itself. **Failed on build 12.** Its re-run on build 14 is step 22b, further down. This step clears
  by itself when 22b passes; don't re-mark it here.
- [ ] **Step 23. League B, and the playoff-teams stepper (13).** The stepper only appears once four
  managers are in (draft-control computes the playoff blocker only above the 4-member floor), so
  it is checked in a new league, not League A. As yourself: Create league, **size 6, playoff teams
  5** (sizes are 4, 6, 8 … 16; there is no 5), draft time about **2 to 3 hours from now** on a
  quarter hour (:00, :15, :30 or :45). Then T1, T2 and T3 each join with League B's code; all joins
  must be done more than an hour before the draft (joins are refused once the room opens). Back as
  yourself: with 2 or 3 in, the card says "Fewer than 4 teams have joined"; once the fourth is in
  it should change to "5 playoff teams, but 4 teams are in" with a Playoff teams stepper and "Up to
  4, one per team." Tap the **minus** once. Right: it reads 4 and that part of the card clears;
  League settings shows Playoff teams 4 after a force-quit.
- [ ] **Step 24. League B drafts with 4 of 6.** Leave League B alone until its draft time. Right:
  the draft room opens an hour before, the draft starts on time with four managers in a six-team
  league, and the server picks for anyone who doesn't (the throwaways). If it shows Postponed
  instead, mark this failed with what the card says. (The phone can't add bots; that's web-only
  and the web is paused.)
- [ ] **Step 24b. League A: back to four needs no tap.** (Page id 42.) League A has two managers
  right now and shows "left the league" with Move forward with 2 / Invite someone new. **Don't tap
  either button.** The check is that the card clears by itself once four are in.
  1. Profile › Sign out. Sign in as T1.
  2. Tap the league name at the top left › Join with code › League A's code. Sign out.
  3. Sign in as T2 and join the same way. Sign out.
  4. Sign in as yourself and open League A. Right: Members reads 4 of 4 joined; the "left the
     league" box and its two buttons are gone; "Fewer than 4 teams have joined" is gone; **Pick a
     new draft time** is bright and can be tapped, with no tap from you first. Wrong: either box is
     still there, or the button is still faded. Don't pick a draft time yet; a later step sets it.
- [ ] **Step 22a. Make a fifth account, T4.** (Page id 46.) The re-run of step 22 needs five people
  in one league, and you have four accounts.
  1. Supabase SQL editor, first:
     `INSERT INTO public.signup_allowlist (email, note) VALUES (lower('you+t4@gmail.com'), 'build-9 phone pass T4');`
     The account can't be created until this row exists.
  2. Supabase dashboard › Authentication › Users › Add user › Create new user. That email, a
     password you choose, and tick **Auto Confirm User**. Don't use the app's Create account for
     this one: that is what hit the email limit with T3.
  Right: T4 is in the Users list. This one needs no build, so it can be done while build 14 is
  still building.
- [ ] **Step 24c. Install build 14.** (Page id 43.) The build with today's fixes is **1.3.0 (14)**
  (from `6ca0e0c4`, fingerprint `8cd5f9f8`). Build 13 was made earlier in the day (from `67a937ae`)
  and is missing the queue fix, so skip it. Run the submit command the Orchestrator gave you for
  build 14, then install it from TestFlight. Right: TestFlight shows 1.3.0 (14) installed. **Do this
  before step 25:** once T1 is deleted, League A has three managers and can never draft, and a later
  step needs that draft.
- [ ] **Step 22b. Invite someone new, on build 14.** (Page id 47.) On build 14, at your usual
  text size. This uses a new league, League C, and doesn't touch League A. **Don't tap "Move forward
  with 4" or "Move forward with 4 instead" at any point:** either one answers the question for good.
  1. As yourself: Create league, **size 6, playoff teams 4**, draft time **a week from now** on a
     quarter hour (a real time, not "later"). Copy its invite code.
  2. As T1, T2, T3 and T4 in turn: sign in › tap the league name at the top left › Join with code ›
     League C's code › sign out. T4 is asked for a username the first time; any will do. Members
     reads 5 of 6.
  3. As T1: League C › League settings › Leave league › Leave. Sign out.
  4. As yourself, open League C on the League tab. Right, before you tap anything: a warning card
     titled "The draft can't start yet", and inside it one section, "{T1's name} left the league",
     with two buttons: Move forward with 4 and Invite someone new.
  5. Tap **Invite someone new**. Right: the button shows a spinner while it saves, then the section
     changes to "Invite someone to take {T1's name}'s place", the line "Share the code. When someone
     joins, the draft is ready to go.", the invite code, Share invite code, and a text link "Move
     forward with 4 instead". The two buttons are gone. Nothing is larger than the card's title and
     the name isn't split across lines. (If you tap Share invite code, cancel the share sheet.)
  6. Force-quit the app and open it again. Right: League C still shows "Invite someone to take …",
     not the two buttons.
  7. As T1: join League C again with the code. Sign out. Nobody else joins or leaves between parts 5
     and 7.
  8. As yourself: League C. Right: the whole warning card is gone with no tap from you, and League
     shows the normal countdown to the draft.
  Wrong, at part 5: the button dims and the section stays "left the league" with the same two
  buttons (what build 12 did), the spinner never ends, or an error line appears. Wrong, at part 6:
  the two buttons are back. Wrong, at part 8: any "left the league" or "Invite someone to take …"
  section is still there.
- [ ] **Step 24d. League A: one card when a manager leaves.** (Page id 45.) On build 14, at your
  usual text size. Do this before 24e, which sets League A's draft time: a manager can only leave
  while the draft is unset or more than an hour away.
  1. As T1: League A › League settings › Leave league › Leave. Sign out.
  2. As yourself: open League A. Right: one card that says T1's name "left the league", then
     "Fewer than 4 teams have joined.", the invite code and Share invite code. No Move forward, no
     Invite someone new, nothing larger than the card's title, no name split across two lines. If
     League A shows Postponed, the note under Pick a new draft time fits on screen.
  3. As T1: join League A again with League A's code. Sign out.
  4. As yourself: the "left the league" part is gone with no tap from you, and nothing stops you
     picking a draft time.
  This is not the re-run of step 22; leave 22 marked Failed.
- [ ] **Step 24e. A drafted stock leaves every queue.** (Page id 44.) On build 14, in League A with
  four managers. Pick one stock for this, called X here: a mid-size company, not a household giant,
  so the automatic picks don't take it first.
  1. As yourself: set League A's draft time to about **1 hour 15 minutes from now**, on a quarter
     hour (the Pick a new draft time card, or League settings; it must be at least an hour away).
  2. Sign out, sign in as T2. League A › Your queue: add X, Save queue. Sign out.
  3. Sign in as yourself. League A › Your queue: add X, Save queue. Stay signed in.
  4. In the Supabase SQL editor, with X replaced by the ticker in capitals, in both places:
     `SELECT (SELECT count(*) FROM draft_queue q WHERE q.league_id = 'e1ac3484-e017-4e0c-a8a6-0337d0c0311d' AND q.symbol = 'X') AS queued_x, (SELECT count(*) FROM drafts d WHERE d.league_id = 'e1ac3484-e017-4e0c-a8a6-0337d0c0311d' AND upper(d.symbol) = 'X') AS drafted_x;`
     Right: **queued_x 2, drafted_x 0**.
  5. At the draft time, be in the room and watch Your queue. If it's your pick and X is still
     there, draft X. Right: the moment X is drafted, by you or by anyone else (the server may pick it
     for T2 first, and that counts), X disappears from your queue and the count drops by one, with no
     "Save queue" and no "Not saved yet".
  6. Run the same query again, any time after X is drafted. Right: **queued_x 0, drafted_x 1**. T2
     never touched the queue again, so only the server can have removed T2's copy.
  7. You can leave the room; the server picks for everyone who is away. Let League A's draft finish
     before step 25.
- [ ] **Step 25. Delete T1 (30).** On T1: Profile › Delete account. Wrong
  password first. Right: "That password isn't right. Try again." and the field clears. Right
  password → Delete my account → "Are you sure?" → Delete. Right: signed out, sign-in shows
  "Your account is deleted." T1 is also in League C, so League C will show "left the
  league" again after this. That is expected; leave it.
- [ ] **Step 26. What the league sees (31).** Your account, League B: Standings, Matchup and the
  team view show "Open team" with the plain avatar, never the old name. Keep League B.

## Part C · a second phone (or a friend)

- [ ] **Step 27. A second real account on a second phone**, allowlisted the same way as step 18.
- [ ] **Step 28. Find a new manager, for real (32).** Your account, League B › League settings ›
  Members › the Open team row › Find a new manager › Share, a real tap, to the other phone in
  Messages. On it, tap the link. Right: the takeover question names the Open team in {league} → Take the
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

- [ ] **Step 35. Launch prep** (STATUS §4 item 2): Supabase Auth Site URL (still localhost) and
  redirect URLs, the email templates rebranded (old logo today), the Apple and Google providers,
  manual linking OFF, the Before-User-Created hook test, custom SMTP; Apple web sign-in (Services
  ID + the .p8 secret, which expires within 6 months, so calendar it); the store/TestFlight URL in
  `universal-links.config.json` and #279 merged.
- [ ] **Step 36. Sign-in and invite links (19–28)**, in the walkthrough's order.
- [ ] **Step 37. Delete an Apple-signed-in test account (29).** A test Apple ID that has signed
  in; after deletion the app is gone from Settings › your name › Sign in with Apple.

## Part E · build 12 spot check at AX5 (the Design Lead's ask; quick, any time after Part B)

- [ ] **Step 38. The draft lobby at AX5.** Nothing clipped or cut with "…"; the roster header
  wraps whole.
- [ ] **Step 39. A renewal card and the champion banner at AX5.** Both whole; amounts and names on
  their own lines.
- [ ] **Step 40. Draft room: roster header plus the two-line Latest picks together.** Both
  readable at once; no overlap.
- [ ] **Step 41. VoiceOver on the pinned "Your pick" clock chip.** It reads the time left and
  whose turn it is, then nothing odd.

---

## Not phone checks (parked, for the record)

P3, awaiting the Design Lead: pull-to-refresh doesn't force a ledger reload; Home's summary
refresh after a trade is unchecked. Accepted, won't fix: the league-switcher P2; a focused field
keeping its scroll offset after a live L → AX5 (heals on a keystroke or blur).
