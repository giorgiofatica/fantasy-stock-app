# Auth screens: scrolling, focus and layout fixes (build 13)

Status: Draft (rules from Giorgio's build-12 recordings, 2026-11-09; one copy line awaits his OK)
Planner session: Planner (Fable 5.2) · Orchestrator hand-off: —

## Goal

Create account (and every screen on the same scaffold) behaves like a short native form:
it does not scroll when everything fits, it moves only as far as it must when a field takes
focus, the brand is never cut, and an error sits where its cause is. Found on build 1.3.0
(12) during step 19 of the phone pass; none of it blocks step 19, all of it is on the first
screen a new player sees.

Evidence: `~/Downloads/ScreenRecording_11-09-2026 14-14-27_1.MP4` (20 s, normal text size)
and `…14-09-38_1.MP4`. Not in the repo (captures stay out).

## Giorgio's rules

2026-11-09, verbatim:
- "the scrolling mechanism on this create account page is just not like functioning
  correctly, in the sense of sometimes it allows me to scroll down, sometimes it allows me to
  scroll up. There really should not be a reason why it should be able to scroll."
- "When I click on the password field, it like shoots the like screen up super high. So the
  password thing is at the very top, and there's a huge gap, and then the create account
  button".
- "the stockpile at the top is cut off."
- "there's just some like formatting issues, and also like scrolling issues with like when we
  should allow it to scroll, where it should be able to scroll. Sometimes it seems a little
  janky."
- On delegating: "things … you could pass off in a well documented plan to the orchestrator
  and have it delegate".

## Decisions

| # | Rule | Source |
|---|---|---|
| R1 | **No scroll when it fits.** With the content shorter than the window, the screen does not scroll and does not bounce, keyboard up or down. It scrolls only when content exceeds the window (large text, a banner, the keyboard cutting the window). | Giorgio 11-09 |
| R2 | **Back to rest.** When the keyboard closes and the content fits again, the screen returns to offset 0 (animated, or instant under Reduce Motion). It never rests with the title under the status bar or a gap above the brand. | Giorgio 11-09 (frames rest at three different offsets) |
| R3 | **Minimum reveal.** A field that takes focus moves the screen only as far as needed for its whole block (label, box, error line, rule checklist) to sit above the docked button with the existing breathing space. Already visible → no movement. It is never pinned to the top. Where the block cannot fit (largest text), the box being typed into wins, then its label, as today. This REPLACES #345's "scrolled to the TOP of that window" rule in `authFieldReveal.ts`. | Giorgio 11-09 |
| R4 | **The wordmark is never cut.** The brand lockup shows the whole product name at every text size on every screen that has it; no clip, no "…". Build 11 showed it whole, build 12 reads "Stockpil": find the regression, do not just widen a box. | Giorgio 11-09 |
| R5 | **Errors sit where the cause is** (UX rules 8/9). A password problem stays under Password; an email problem (invalid, already registered) goes under Email; anything else (the email send limit, a request limit, network) is a form-level message with NO red border on any field. Placement = an existing pattern (the `WarnPanel` used for paused sign-ups, or a line above the primary button); the Design Lead picks which. | Planner, standing rule |
| R6 | **The email send limit says the truth.** `over_email_send_rate_limit` gets its own line; `over_request_rate_limit` keeps "Too many attempts — please wait a minute and try again." NEW copy, awaiting Giorgio: "We can't send another email right now. Try again later." | Planner; copy pending |
| R7 | **A visible password is still a password.** With the eye open the field keeps `autoCorrect={false}`, `spellCheck={false}` and its password content type; the keyboard neither predicts nor learns it. Check the QuickType bar (it offered saved email addresses over the visible password in the recording). | Planner, security floor |

## Open questions

1. R6's sentence, for Giorgio (not blocking the build of R1–R5, R7).
2. For the Design Lead: R5's form-level placement, and whether R3's breathing constants
   (`TOP_BREATHING` 4, `BOTTOM_BREATHING` 6) still read right once the field is no longer at
   the top.

## Scope

In: `components/shell/AuthScaffold.tsx`, `components/shell/authFieldReveal.ts`, the brand
lockup (`BrandLockup` and its callers), `lib/authErrors.ts`, `components/shell/Field.tsx`
where the eye and the error line live, and the error wiring in `app/create-account.tsx`,
`login.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `change-password.tsx`,
`delete-account.tsx`. All 13 `AuthScaffold` screens are re-shot, because R1–R3 are scaffold
behaviour.

Out: custom SMTP, Site URL and the email templates (launch prep, Giorgio's dashboard); the
look of any screen at rest with the keyboard down at normal size (must stay pixel-identical
apart from the restored wordmark); Android-specific keyboard work beyond not regressing.

## How it works

**R1, R2 (scaffold).** The scaffold already tracks `contentHeight` and the window height.
Scrolling and bounce are enabled only while `contentHeight > windowHeight` (iOS:
`scrollEnabled`, `bounces` / `alwaysBounceVertical={false}`). `keyboardDismissMode` stays
`interactive` where the screen scrolls; where it does not, a tap outside a field dismisses
(`keyboardShouldPersistTaps="handled"` already does this). On keyboard hide (and on blur
with no field focused) the scaffold scrolls to `min(currentOffset, max(0, contentHeight −
windowHeight))`, which is 0 when the content fits. The `layout`/`keyboard` re-reveal stays,
gated on focus as today.

**R3 (reveal).** `fieldRevealOffset` takes the focused field's BLOCK (top of the label to the
bottom of its error/rules), the current offset and the window height, and returns:
- the current offset, if the block is inside the window;
- else the smallest offset that brings the block's bottom to the window's bottom minus the
  breathing space, capped so the label's top does not leave the window; when both cannot
  hold, the box wins, then the label (today's large-text rule);
- never negative, never past `contentHeight − windowHeight`.
The scaffold measures the Field's wrapper (not only the `TextInput`), so the rule checklist
counts. Moving Email → Password with the keyboard up applies the same rule: on Create
account at normal size both fields and the rules fit above the button, so nothing moves.

**R4.** Reproduce on the simulator at L and AX5 on Create account and Sign in. Suspects, in
order: the 1.3× cap added in #345 meeting the capped-Text "measure twin" (the fix pattern is
`cappedType.ts`, see #298), then a fixed width on the lockup row. The fix must hold on all
five lockup screens (create account, sign in, change password, reset password, confirm
email sent).

**R5, R6.** `getAuthErrorMessage` grows a second return: where the message belongs
(`'email' | 'password' | 'form'`). Screens route it: `Field error=` for a field, the
form-level slot otherwise; `invalid` (the red border) is set only for the field named.
`authErrors.test.ts` gains the two rate-limit codes as separate cases and the placement for
every mapped code.

**R7.** In `Field`'s eye path, assert the props above in both states; the no-remount rule
from #343 stands (a remount raises "Save Password?").

## Risks and edge cases

- **Largest text (AX5), Giorgio's own size.** The window above the keyboard is ~130 pt; R3
  must not undo #345's guarantee that the box being typed into is always visible. Both
  directions tested: L → AX5 live, and AX5 cold.
- **Disabling scroll kills drag-to-dismiss** on screens that fit. Accepted (tap outside
  dismisses); the Design Lead confirms it feels right on the phone, not only in stills.
- **Delete account scrolls its scaffold to the end** through the forwarded ref; R1/R2 must
  not fight that call.
- **AutoFill** fills both fields without a tap; the reveal must not jump when focus has not
  moved.
- **Stale offset** after the secondary footer line returns on keyboard hide (the window
  shrinks again): R2 runs after that layout, not before.

## Done means

- Create account at normal size, keyboard down: a drag does nothing; nothing moves.
- Tap Email, then Password, at normal size: Email, Password and the rules are all visible
  above Create account; no empty band taller than the breathing space; the brand may scroll
  off only if it must.
- Close the keyboard: the screen is exactly as before it opened (frame-diff = 0 against the
  rest frame).
- "Stockpile" whole on the five lockup screens at L and AX5, both themes.
- A forced `over_email_send_rate_limit` shows the form-level line with no red field; a wrong
  password still marks Password.
- Eye open: typing shows no predictive text and no suggestions bar content from the field.
- Hermetic: new `fieldRevealOffset` cases (fits → no move; below → minimum; large text → box
  wins; clamp), `stepReveal` unchanged, the error placement table. Simulator recordings of
  Create account and Sign in at L and AX5 (tap, next key, AutoFill), frame-diffed per
  `sim-recording` method, plus stills of all 13 scaffold screens at rest proving no change.
- Design Lead PASS; then Giorgio re-checks on the phone as part of build 13.

## Suggested workstreams

One worker (R1–R5, R7; R6 lands when the copy is approved, same branch if it arrives in
time): plan turn → build → self-captures → Orchestrator verification → Design Lead gate.
`ux-reviewer` on the diff. No migrations, no functions, no prod steps. Ships in build 13
with whatever else is ready; step 19 does not wait for it.

## Models

| Role | Model | Why |
|---|---|---|
| Planner | Fable 5.2 | This spec |
| Worker | Sonnet 5.5 after an Opus plan turn | Well-specified layout work; no auth logic changes |
| `ux-reviewer` | Sonnet | Checklist |
| Design Lead gate | Opus | Judgement on feel and the AX5 trade-offs |
| Orchestrator | Opus | Verification, the build |
