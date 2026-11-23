# How does ESPN's waiver wire handle several claims, and the order of a manager's own claims?

Asked by: Giorgio on 2026-11-23 via the Planner: "look into how the waiver wire works for like ESPN
before a week has kicked off", wanting our daily claims to "work the same way, except it happens
daily", and "I get a multiple claims. I get to order the priority." · Researcher session · Model:
Sonnet 5.5 · Read 2026-11-23, through a web-fetch agent that returns page summaries, so quotes are
extracted wording. The 2007 ESPN rules page the Planner already holds is not redone.

## Short answer

**ESPN's own help pages answer almost none of the multi-claim questions.** They state that you can
drag your pending claims into your preferred order (Pending Moves, web), that the order of teams
decides a contested player, that a winner moves to the end, and that waivers run daily around 3 a.m.
ET. They say nothing about two claims sharing a drop, several claims on one player, an invalid
claim, a worked example, or what you are told after the run. **Yahoo is the one that answers the
core of it, with a worked example** (several claims dropping the same player; the one that loses
its drop is "voided" and the next is processed). **Sleeper** marks the same situation "Invalid".
Both support allowing two claims to name the same drop (your question 2).

## Findings

Source key: "S" = the source states it; "I" = my inference. Dates are the page's own "Updated" date
where one was shown.

### 1. Ordering your own claims, and what the order decides

| App | Finding | Source | S / I |
|---|---|---|---|
| ESPN | "Inside Pending Moves, you can: Reorder claims by dragging them into your preferred priority." Pending Moves is described for the **web**; the app section of the same page mentions only the claim and confirm steps. Exactly what that order does at the run: **not stated** | support.espn.com "Claim a Player Off Waivers" (360000036711, updated 2026-11-09) | S (control); order effect not stated |
| ESPN | Team-vs-team priority: "once a team successfully makes a waiver claim, they move to the bottom of the waiver priority list." Public leagues set the order automatically; private leagues' commissioners can drag teams (not after a Salary Cap run) | "Waiver Order Overview…" (4669787227668 and 360000093771, updated 2026-08-11) | S |
| Yahoo | My Team › "Edit Waiver Priority" › "Change Priority", "using the drop-down menus" under "Priority". Claims "set to process on different dates are listed in chronological order and can't be changed." Within one manager's list, how the order decides processing is **not stated**, but the conditional-claims example (finding 2) shows it is processed in order | help.yahoo.com SLN8829 (undated) | S (control); I (the effect) |
| Sleeper | Team › Transactions: "Edit an existing bid", "Cancel a claim", "Reorder claims with the same bid amount". "Waiver claim priority is determined first by bid amount." (FAAB leagues, so reordering applies only among equal bids) | support.sleeper.com "How does FAAB bidding work?" (1876040, updated 2026-09-23) | S |

### 2. Several claims, one drop

| App | Finding | Source | S / I |
|---|---|---|---|
| ESPN | **Not stated** on any page read | | Not found |
| Yahoo | Worked example: "Waiver Claim 1 - Add Player C, drop Player A / Waiver Claim 2 - Add Player D, drop Player A / Waiver Claim 3 - Add Player D, drop Player B." Then: "If Waiver Claim 1 is successful, Waiver Claim 2 is voided because you no longer own Player A, but you still have a chance to get Player D because of Waiver Claim 3." The idea: "if 1 claim is voided for any reason, the next claim is processed". Yahoo calls these **conditional claims** and recommends them | help.yahoo.com SLN6811 (undated) | S |
| Sleeper | A bid is invalid if "You tried to drop a player in this bid who you had already dropped in a previous successful bid." (so two claims sharing a drop are accepted; the later one fails if the earlier one succeeded) | "Why was my waiver claim invalid?" (3978623, 2026-09-24) | S |

If the first claim **fails** (someone else wins the player), the second is still processed: Yahoo
"if 1 claim is voided … the next claim is processed" (S). What the manager is told about the voided
claim: not stated (see 6).

### 3. Several claims on one player to add

| App | Finding | Source | S / I |
|---|---|---|---|
| ESPN | Not stated | | Not found |
| Yahoo | Yes in practice: the example has Claims 2 and 3 both adding Player D with different drops. Whether it is a general rule is not stated | SLN6811 | S (example) |
| Sleeper | Not stated | | Not found |

### 4. A claim that cannot be completed at the run

| App | Finding | Source | S / I |
|---|---|---|---|
| ESPN | **Not stated.** Only "If a team submits a successful claim, that team receives the player." and "If no one claimed the player, they clear waivers." Whether the next team in priority gets the player when the first claim is invalid: not stated | "Claim a Player Off Waivers" (2026-11-09) | Not found |
| Yahoo | A claim can be "voided for any reason"; the drop-player-gone case is the stated example. The next claim of the same manager proceeds. Whether the next *manager* gets the player: not stated | SLN6811 | S (voided); not stated (next manager) |
| Sleeper | Invalid reasons: "You did not have enough FAAB"; "You no longer have enough space on your roster because you added a player to your roster, and are not dropping a player on this bid"; the previously-dropped-player reason (finding 2). The result shows a higher bid "(Invalid)" beside the losing team, which implies the next valid bid wins | 3978623; 1876040 | S (reasons); I (next bid wins) |

### 5. Inside one run: does a winner move to last before their next claim?

| App | Finding | Source | S / I |
|---|---|---|---|
| ESPN | The sequencing is **not stated** and there is **no worked example** on the support pages. The old rules text says "When a claim is resolved, the waiver position for the team that receives the player is changed to the lowest possible priority (10)." The overview pages add: "This process continues until all waiver claims are processed." Read together, the order is re-ranked as each claim resolves | espn.com print rules page (2008); Waivers Overview (360000041152, updated 2026-11-09) | **I** |
| Yahoo | "When a claim is successful, that manager drops to the bottom of the priority list." Mid-run timing: not stated | SLN6811 | S (rule); mid-run not stated |
| Sleeper | "For every successful waiver claim, that team owner drops to the bottom of the order, while everyone else moves up one." Mid-run timing: not stated | support.sleeper.com 1876041 (2026-09-24) | S (rule); mid-run not stated |

### 6. What the manager sees after the run

| App | Finding | Source | S / I |
|---|---|---|---|
| ESPN | **Not stated** for won, lost or invalid. Only the submission confirmation is described ("You will see a confirmation message once it has been submitted."; web: "A green confirmation banner"). The commissioner can reverse a claim | "Claim a Player Off Waivers"; Waiver Order Overview | Not found |
| Yahoo | Not stated. Only "You can view your waiver rank standings on the 'League' page, in the 'Waiver' column." | SLN6811 | Not found |
| Sleeper | "Once waivers process, the results will appear in: Your league's transaction history; Your league chat." Tapping the dollar amount "will show every bid submitted for that player", with a higher invalid bid "marked as (Invalid)". Push notifications: not stated | 1876040; 3978623 | S |

### 7. Before the run, can anyone see claims on a player?

| App | Finding | Source | S / I |
|---|---|---|---|
| ESPN | Not stated. You can see "your Waiver Claim Position" and the **full league order** ("Waiver Order List") on the web, but not other managers' claims | "Claim a Player Off Waivers" | S (order visible); claims not stated |
| Yahoo | FAB: "Offers are blind, so other managers can't see what your offer is." Standard claims: not stated | SLN6811 | S (FAB); otherwise not stated |
| Sleeper | "Bids are blind — other managers cannot see your bid amount." Pending non-FAAB claims: not stated | 1876040 | S (FAAB); otherwise not stated |

### Timing and reset, since the Planner mentioned them

- **ESPN, daily:** "Waivers are typically processed daily around 3:00 AM ET." The Waiver Period page says "The Standard league waiver process begins daily between 3 a.m. and 5 a.m. ET." Players dropped after more than 24 hours go to waivers; "Free Agents can be added immediately and do not affect waiver priority." (updated 2026-11-09)
- **ESPN order reset:** two commissioner options. "Reset Each Week": "Each Monday at 12:00 AM PT / 3:00 AM ET … the order resets" by inverse standings. "Move to Last After Claim": "The order does not automatically reset." The starting order "begins as the inverse of the draft order." (Waiver Order Overview, 2026-08-11)

## What this means for Stockpile

Everything here is the Researcher's reading, kept apart from the findings above.

- **Your daily model already matches ESPN's core:** daily processing, order decides contested
  players, a winner moves to the end, free agents don't touch the order, and a weekly reset to
  inverse standings (FANTASY_CONVENTIONS). ESPN gives you nothing more on multiple claims.
- **For ordering several of your own claims,** the best evidence is **Yahoo's "conditional claims"**:
  a manager's claims form an ordered list, processed in sequence, and a claim that can no longer
  be completed is "voided" while the next proceeds. ESPN's drag-to-reorder control in Pending
  Moves is the same idea (control only; effect unstated). A simple rule consistent with both:
  **at the run, process each manager's list top to bottom, and the order decides which claim is
  tried first** (inference).
- **Question 2 (two claims naming the same drop):** Yahoo explicitly recommends it and Sleeper
  accepts it, marking the later claim invalid when the earlier one succeeded. Allowing it matches
  both; ESPN is silent. The Planner's recommendation to allow it is consistent with the evidence.
- **Claims judged from the new position within a run** is the standard rolling-waivers behaviour
  as the three apps state the rule (a successful claim sends you to the bottom); the pages don't
  show mid-run timing, so it is worth deciding explicitly for our run (inference).
- **After the run,** none of the three describes won, lost and invalid wording for the football
  apps except Sleeper's league chat, transaction history and "(Invalid)" marker. This is the
  part to design ourselves.

## Not found / not sure

- Everything marked "not stated": ESPN on questions 2–4 and 6–7, and the same-run timing and result
  wording for all three. ESPN's support pages for these were read in full (six pages, plus the
  claim, period and 2007/2008 rules pages); they simply don't say.
- **ESPN's mobile control for reordering**: the Pending Moves instructions are written for the web.
- Whether a manager may submit **more than one claim for the same add player** as a general rule.
- Quotes come through a fetch agent's extraction; the Yahoo page for priorities (SLN8829) and the
  Yahoo overview carry no date. The 2008 ESPN rules text is outdated (its schedule conflicts with
  the current pages) and is cited only for its priority sentence.
- No app was opened and no support contacted; this is help-page reading only.

## Recommendation

My advice, not a decision.

1. **Copy Yahoo's conditional-claims model, labelled as our own rule:** a manager's claims are an
   ordered list; at the run each is tried in order; a claim that can't be completed (drop player
   gone, no slot) is skipped and the next is tried.
2. **Allow two claims to name the same drop** (question 2), as Yahoo recommends and Sleeper
   accepts, with a clear message when the later one loses its drop.
3. **Design the after-run messages ourselves** (won, lost, skipped), using Sleeper's league chat
   and transaction history as the only documented model.
4. **State the same-run position rule explicitly** (a winner moves to last before their next
   claim is judged), since no source spells it out.

## Open questions for Giorgio

1. When a claim is skipped because its drop player is already gone, should the manager be told in
   the app (and pushed), or only see it in the claims list?
2. Should one manager be allowed several claims on the same stock with different drops (Yahoo's
   example), or one claim per stock?
