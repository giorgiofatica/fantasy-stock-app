# Phase 4b: retire the old signing secret

Status: Approved (Giorgio, 2026-11-16)
Planner session: Planner (Fable 5.2) · Orchestrator hand-off: —

Research this plan is built on: `docs/security/2026-11-16-legacy-jwt-secret-research.md`
(the Orchestrator, PR #463, `c2486f50`; official Supabase docs with URLs, and the probe results
measured in prod). Code facts below were read at `origin/main` @ `afa5cbf6`.

## Goal

The old admin key that sat in local files on Giorgio's Mac stops working everywhere, for
good. On 2026-11-16 the old-style API keys were disabled (Phase 4) and every copy found on
disk was removed. That key is a token signed by the project's old signing secret, and the
project still trusts that secret. Supabase's guide for an exposed admin key says to also
revoke the secret. This plan does that without signing anyone out and without breaking the
app.

## Giorgio's rules

- 2026-11-13, on the five medium security items: "I want them done."
- Standing (`CLAUDE.md`, Secret handling): a real key that was exposed is rotated, "even test
  exposure requires rotation".
- Standing: merges, deploys, `db push` and every dashboard step are his alone. Nothing goes
  to the App Store until he says.
- Phone and dashboard work is handed to him one step at a time, each with its check, and a
  later step's material is never handed early.

## Where things stand (measured, 2026-11-16)

| Route | The old admin key today |
|---|---|
| Database (REST) | Refused, 401 "Legacy API keys are disabled" |
| Server functions gateway | Refused, same message |
| Sign-in admin API | Refused, same message |
| Live updates (Realtime) | **Not tested** |

The disable is reversible, and its own confirm dialog said the keys "remain valid as a JWT".
So the accurate status is "refused on three routes, one untested", not "dead". Old chat
transcripts on the Mac still contain the key, which is why this plan revokes the secret
instead of hunting copies.

## Decisions

| # | Question | Decision | Who |
|---|---|---|---|
| 1 | Do Phase 4b at all | Yes. The key was exposed, the secret that signs it is still trusted, and one route is untested. | Giorgio's standing rule |
| 2 | How urgent | Normal pace. The key never left the Mac, was never committed, and is refused on the three routes probed. Not tonight, not rushed. | Orchestrator ruling 2026-11-16 |
| 3 | Take the safe path on the gateway check, or test and see | **Safe path.** Supabase's docs disagree on whether the functions gateway check (`verify_jwt = true`) accepts tokens signed the new way: one page warns the switch "might break your app", another says the gateway validates both. All 12 gated functions move to `verify_jwt = false` with the check done in their own code, before anything is switched. | Planner |
| 4 | What "the check in their own code" is | The check 11 of the 12 already have: ask the sign-in server who the caller is (`auth.getUser()`). It does not depend on how the token was signed, so it keeps working through the switch. No new verification scheme is introduced. | Planner |
| 5 | The one function without it | `symbol-name` gets the same check. Today it relies on the gateway and on the stock table refusing callers who are not signed in. | Planner |
| 6 | When the switch and the revoke happen | Outside these windows: a live draft, Mon and Tue 14:30–16:00 UTC (week-start snapshots), Fri 21:00–22:30 UTC (week-end and scoring). Steps 4 to 7 are done in one sitting of about two hours. | Planner |
| 7 | Proof at the end | The same read-only probe as Phase 4, plus Realtime. The key is revealed from the dashboard at that moment and typed into a hidden prompt; it is never written to a file again. | Orchestrator ruling 2026-11-16 |
| 8 | After the revoke | The old keys are never re-enabled and the old secret is never deleted or re-trusted. Undoing the revoke would re-trust the exposed key. | Research, item 3 |

## Open questions

None for Giorgio. Two things need him to look, not decide (Step 0).

## What the code looks like today

Twelve functions have `verify_jwt = true` in `supabase/config.toml`: `quote`,
`historical-bars`, `symbols-search`, `symbol-name`, `preview-league`, `join-league`,
`leave-league`, `delete-account`, `draft-control`, `validate-and-record-pick`, `record-trade`,
`send-notification`.

The research first listed four of them as having no user check in their own folder, with
the note that they "may use a shared helper". I read the code, the Orchestrator verified it
(2026-11-16), and the research file now says one:

- **`quote`, `historical-bars`, `symbols-search` do check the user in code**, through
  `_shared/market-guard.ts` (`resolveUser` and `guardSignedInCaller`, both of which call
  `auth.getUser()`).
- **`symbol-name` is the only one with no user check of its own.** It forwards the caller's
  token to the database and lets the stock table's signed-in-only grant refuse anyone else.

So 11 of 12 already do what Decision 4 asks. The comments in `quote` and `ticker-quotes` make
the same point about the gateway check: it also passes the public app key, so it was never a
sign-in check.

Nothing else in the repo depends on the old secret:

- No code verifies a token by hand or reads the secret (no `JWT_SECRET`, `jose`, `djwt` or
  `HS256` anywhere in functions, migrations, mobile or web).
- `delete-account` reads claims from Apple's and Google's identity tokens, not from ours.
- Scheduled jobs use an `sb_secret_` key, which is not a signed token.
- The app's key and the web's key are `sb_publishable_` (Phase 4 checks a and b).
- The mobile app uses one live-updates channel (`draft-room:{league}`,
  `lib/game/useDraftRoom.ts`). It authenticates with the player's own session, so it must be
  exercised after the switch (Step 4).

## The steps

Each row is one hand-off to Giorgio where it says so. "Undo" is what happens if its check
fails.

| # | Step | Who | Check before moving on | Undo |
|---|---|---|---|---|
| 0 | Two looks on the dashboard: the access-token lifetime (the wait in step 5 is that plus 15 minutes; the research assumes one hour), and that the signing-keys page offers "Migrate". | Giorgio | Lifetime noted; the page matches the research | n/a |
| 1 | Build: the 12 functions go to `verify_jwt = false`; `symbol-name` gains the user check; tests for both. | One Opus security chip, run by the Orchestrator | See "What the build must prove" | Revert the PR |
| 2 | Merge, then deploy the 12 functions from the deploy checkout, verified as `CLAUDE.md` requires. | Giorgio | For each function: a request with no credentials gets **our** 401 body, not the gateway's, and the dashboard's Verify JWT toggle is off. On the phone: Home loads, a stock sheet opens, the queue saves. | Redeploy the previous version |
| 2b | The probe is replaced before any dashboard step. The Phase 4 scripts read the key from a file that is now clean, so they stop at setup. The new one runs the control line alone with no old key, and in its full mode takes the old key from a hidden prompt and covers REST, functions, sign-in admin and Realtime (a channel join with the old key as the token: joined or refused). Dry-run by the Orchestrator first. | Orchestrator | The control line prints 200 with 0 rows on Giorgio's Mac | n/a |
| 3 | Dashboard: Migrate the signing secret. This creates the new key in standby. Nothing changes for players. | Giorgio | Probe line P1 still 200 with 0 rows; the app still loads | Reversible in the dashboard |
| 4 | Dashboard: Rotate. New sessions are signed the new way. Nobody is signed out. | Giorgio | On the phone after a fresh start: Home loads; a stock sheet opens (prices, name, chart: four of the functions); the queue saves; **a draft room or pre-draft room opens and updates live**; sign out and back in. On the web: one sign-in, if a web sign-in page is live by then (the web client is a separate build of the same library and gets new-signed sessions too; today the web app is paused and serves only the landing page, so there may be nothing to check). Scheduled jobs: the timestamped `net._http_response` query shows only 200 and 202. | Rotate back (state changes are throttled about five minutes) |
| 5 | Wait: the access-token lifetime plus 15 minutes (75 minutes at one hour). | n/a | Clock | n/a |
| 6 | Dashboard: Revoke the old secret. | Giorgio | He reads the confirm dialog to the Planner before confirming, as in Phase 4 | **Treated as final** |
| 7 | Probe, read-only: the old key must be refused on REST, the functions gateway, the sign-in admin API **and Realtime**. Then the phone checks from step 4 once more, and a `db-snapshot` re-capture. | Giorgio runs; Orchestrator verifies | All four refused; the app and the jobs still work | n/a |

Steps 3 to 7 happen in one sitting. Steps 1, 2 and 2b can land days earlier and are safe
alone: they change who performs a check, not whether it happens.

## What the build must prove (step 1)

- **Each of the 12 refuses a caller with no token, a caller with only the public app key, and
  a caller with an expired token**, with our own 401, before **any** side effect: a database
  read or write, a supplier call, a push sent (`send-notification`), an account touched
  (`delete-account`), a rate-limit counter bumped. This is the boundary once the gateway
  check is off, so it is tested per function, not sampled, and it is how the Orchestrator
  gates the build.
- **A real signed-in caller still gets through** on each.
- **`symbol-name` returns 401, not 500, for a caller who is not signed in.** Today a refused
  read surfaces as "Failed to lookup symbol".
- **No function accepts a `service_role` token as a user.** A token with no user behind it
  must fail the check. This is the property that makes the old key useless at the function
  level even before the revoke.
- `supabase/tests/market_data_guards.test.ts` and `scripts/gen-architecture.mjs` both read
  `verify_jwt`; the architecture map is regenerated and the guard test updated in the same PR.
- Two traps from `CLAUDE.md` that apply directly:
  - A `verify_jwt` true-to-false flip may not take on the first deploy. The proof is a
    no-credential request that reaches our code, plus the dashboard toggle. The deploy's own
    output proves nothing.
  - A deploy ships whatever is in the folder it runs from. Before deploying 12 functions, the
    Orchestrator diffs what is deployed against `main` for each, so no unrelated merged change
    rides along unnoticed.

## Risks

| Risk | How likely | What limits it |
|---|---|---|
| The switch breaks something that still expects the old signing | Low after steps 1 and 2 | Step 4 is reversible and has a full phone check before the wait starts |
| Live updates stop after the switch | Unknown: not documented either way | Checked at step 4, before the point of no return. If it fails, rotate back and stop |
| A player's session is cut at the revoke | Low | The wait in step 5 outlasts every token signed the old way. The research quotes Supabase: "no users will be forcefully signed out" at the rotate |
| Database access rules read the token differently afterwards | Low; the research marks this as an inference, not a documented fact | The phone check at step 4 does a read and a write under the rules |
| The 12 functions get junk traffic that the gateway used to stop | Certain, small | Each function refuses before doing work; the four market-data functions already rate-limit per user |
| Step 6 is confirmed and something was missed | Low | Everything that can be tested is tested at step 4 on the new signing while the old is still trusted. Step 6 only removes the old |

## What this plan does not do

- It does not change how players sign in, or anything they see.
- It does not touch the mobile app, so it does not need build 15 and build 15 does not need
  it.
- It does not delete the old secret or the old keys. Revoked and disabled is the end state.
- It does not clean old chat transcripts. Once the secret is revoked, a copy of the key in a
  transcript is inert.

## After it is done

- `docs/migrations/MIGRATION_STATUS.md` and `docs/STATUS.md`: Phase 4 and 4b closed, and the
  note that the Phase 4 disable was reversible all along (it was recorded as a one-way door).
  The Recorder writes these from the Orchestrator's verified results.
- `CLAUDE.md`'s Secret handling section could gain one line: a clean history scan says
  nothing about ignored local files; scan the working tree too and classify each token by its
  decoded role, never by reading it.
