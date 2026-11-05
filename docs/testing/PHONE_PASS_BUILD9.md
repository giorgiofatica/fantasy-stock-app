# Phone pass, 1.3.0 (9): the one list

Build 9 (TestFlight, from `514991dd`) contains everything on `main`; nothing since it is app or
server code. So nothing here waits for another build. Tick here, nowhere else. Item numbers are
`WALKTHROUGH_1.3.md`'s; "new" items are build-8/9 fixes that never reached a phone.
Record kept by the Orchestrator (2026-11-05); order by the Planner.

## Already passed, don't redo

Items 1, 2, 3, 4 (build 5) · 5 (sell sheet on build 5, Review buy on build 7) · 8's two halves that
need no second member: the pre-draft Commissioner row opens "Make someone else commissioner", and
in season the row is static with its caption (build 8) · a live size change on login with the
email filled: no "Save Password?" sheet (build 8; the sheet seen at 178 s was iOS's own AutoFill
offer, not ours).

## Sitting 1 · alone, your phone, no setup

Start with the text size at AX5 (Larger Accessibility Sizes, slider right).

- [ ] **17. Fresh install first.** Delete the app, reinstall build 9, tap Create a league or Join
  with a code on Get started straight away. It must respond to the first tap.
- [ ] **Home at AX5, cold launch.** Hero whole, "season gain" and "today" present, no line starts
  with "·", nothing clipped.
- [ ] **Home at AX5, live change.** Drop the size to L in Control Center, come back, raise it to
  AX5 again without quitting. Same result as the cold launch.
- [ ] **The "Your season" strip.** Opens on a whole tile; "Wk N" never wraps; the small label is
  never bigger than the value; the upcoming opponent's name stays on one line; tapping a past
  week opens League › Schedule.
- [ ] **League › Schedule: an unscored past week** shows "–", not a result.
- [ ] **A tied week reads T** on Home and in Schedule. *Skip unless a tie exists; none of your
  leagues had one on 11-04.*
- [ ] **Times never split:** "9:30 AM ET" whole on This week, the pre-draft card, the draft lobby
  and the market-closed notes.
- [ ] **"vs {name}"** breaks only after "vs".
- [ ] **Invite code on one line** (League settings), and the "Invite code" label is never bigger
  than the code.
- [ ] **Typing through a size change.** In Create league (or the draft search), type, raise the
  size, lower it again, keep typing: the field returns to normal on blur. The draft search
  placeholder resizes after AX5 → L.
- [ ] **Login with the PASSWORD filled plus a live size change:** no "Save Password?" sheet.
- [ ] **No intro cards** after Sign out, then Sign in.
- [ ] **9. Pre-draft Home with Share.** A league with its draft more than an hour away: Members
  card whole, "+N" circle whole, code and Share both there; Share opens the sheet.
- [ ] **14. Save queue** in that pre-draft league: save, force-quit, reopen, queue intact.
- [ ] **10. Text size back to normal.** Home and Portfolio look as before.
- [ ] **18. Watch all sitting:** Portfolio drawing blank ~10 s on open or league switch. Note it
  if it happens.

## Sitting 2 · one throwaway email account, same phone (or a simulator)

Setup first: a throwaway address, allowlisted for sign-up (signups are gated; ask the
Orchestrator for the one-line allowlist SQL), signed up, and joined to a **drafted** test league
you commission (bots fill the other seats). Then, from that account's side where it says so:

- [ ] **8. Hand over, for real.** A **pre-draft** test league with the throwaway as a member: the
  list shows them; Hand over names them once picked; Cancel. (Bots never appear; that's by design.)
- [ ] **11. Move forward.** Throwaway leaves the pre-draft league; your card names them; Move
  forward saves and the notice stays gone after a force-quit.
- [ ] **12. Invite someone new.** Same with a second leave (or rejoin and leave again); the notice
  stays until someone joins with the code.
- [ ] **13. The playoff-teams stepper.** Playoff teams set higher than the managers now in; minus
  lowers it; League settings agrees after a force-quit.
- [ ] **30. Delete the throwaway (password).** Wrong password first → "That password isn't right.
  Try again." Then the right one → "Are you sure?" → signed out, "Your account is deleted."
- [ ] **31. What the league sees.** On your account, the drafted league shows "Former manager"
  with the plain avatar in Standings, Matchup and the team view; never the old name.

## Sitting 3 · a second phone (or a friend) and a run-back league

Setup: a second real account on a second phone; a finished test league run back with
everyone answered I'm in and the draft not yet set; a fixed-amount-slot league with two sales
made during market hours.

- [ ] **32. Find a new manager, for real.** From the Former manager row, Share with a real tap,
  Messages to the other phone, tap: "Take over Former manager's team in {league}?" → Take the
  team. The same link from a third account: "Someone already took this team."
- [ ] **33. A hand-typed take link waits for a tap.** `fantasystockapp://take/CODE` in Notes:
  "Take over a team" with Find league / Not now; nothing about the league until Find league.
- [ ] **7. The Renewal change sheet** at AX5.
- [ ] **15. The nudge.** Nudge again; their phone buzzes; a second open says once a day.
- [ ] **16. Schedule the draft.** Button greyed until a future time; saves; countdown on Home.
- [ ] **6. The sale picker** at AX5 *(market open)*.

## Sitting 4 · after launch prep (STATUS §4 item 2)

Blocked until: Supabase Auth redirect URLs, Confirm email, Apple + Google providers, manual
linking OFF, the Before-User-Created hook test, custom SMTP; Apple web sign-in (Services ID + the
.p8 secret, which expires within 6 months); the store/TestFlight URL in
`universal-links.config.json` and #279 merged.

- [ ] **19–28.** Sign-in and invite links, in the walkthrough's order.
- [ ] **29. Delete an Apple-signed-in test account.** Needs the Apple provider and a test Apple ID
  that has signed in. Afterwards the app is gone from Settings › your name › Sign in with Apple.

## Open follow-ups (not phone checks)

P3, awaiting the Design Lead: pull-to-refresh doesn't force a ledger reload; Home's summary
refresh after a trade is unchecked. Accepted, won't fix: the league-switcher P2; a focused field
keeping its scroll offset after a live L → AX5 (heals on a keystroke or blur).
