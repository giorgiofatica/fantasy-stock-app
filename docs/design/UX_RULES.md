# UX rules

**The UX standard every screen and flow is designed, built and reviewed against.**
Approved by Giorgio on 2026-10-06 (plan: [`../plans/2026-10-06-ux-rulebook.md`](../plans/2026-10-06-ux-rulebook.md)).
It sits beside [`DESIGN_DIRECTION.md`](DESIGN_DIRECTION.md) (visual identity, tokens, motion,
the craft floor) and [`../PRODUCT_RULES.md`](../PRODUCT_RULES.md) (what the product does).
This file says how a screen must *behave for the person using it*.

- **Owner:** the Design Lead. It proposes changes to Giorgio; it never edits a rule silently.
- **Checked by:** the `ux-reviewer` subagent at every UI gate, and by the Design Lead's gate
  report (see [`UI-UX-PROGRAM.md`](UI-UX-PROGRAM.md), "Design review gate").
- **Source:** the eighteen Laws of UX that apply to this app ([lawsofux.com](https://lawsofux.com/)),
  collapsed into eleven rules so that one decision is checked once, not six times. Rules 12
  and 13 are Giorgio's own (2026-11-10).
- **Precedence:** a product rule beats a UX rule. If applying a rule here would change what the
  product does (not how it looks or responds), that is a question for Giorgio, not a finding.

Each rule has three parts: **what we do**, **what it means here** (this app's screens), and
**how the gate checks it**. A rule with no check is advice, and advice drifts.

---

## 1. Familiar first

*From: Jakob's law, Mental model.*

**What we do.** Follow iOS conventions and the patterns of the apps our players already use:
**fantasy football (ESPN / Sleeper / Yahoo) for anything that belongs to a league** (watchlist,
draft, queues, standings, roster moves), **Robinhood for money surfaces only** (portfolio
value, a stock's price and chart, buy/sell mechanics). When a feature could be read either
way, it is a league feature first (Giorgio, 2026-10-08; see `FANTASY_CONVENTIONS.md`). We
depart from these patterns only with a stated reason.
Where the product deliberately differs from what a fantasy or brokerage app does, we say so
**at the moment it matters**, in place, not on a rules page nobody reads.

**What it means here.** Whole-position trades (no partial sells), dollars decide (percent is only
the tiebreak), byes are no result, the draft starts by itself, a missed turn is auto-picked:
every one of these contradicts a habit the player brings. Each gets a one-line explanation
where the player meets it: the trade sheet, the standings row, the draft countdown.

**How the gate checks it.** Each screen names its reference pattern (which app, which screen).
Each deliberate departure from that pattern or from the fantasy/brokerage model has an in-place
one-liner, and the reviewer can point at it.

## 2. Few choices, one primary

*From: Hick's law, Choice overload.* (Existing rule, DESIGN_DIRECTION gate; kept here.)

**What we do.** At a decision point, at most four options are visible, and exactly one is the
primary action.

**What it means here.** A sheet with Buy / Sell / Watch / Close is at the limit. League settings
are grouped so no group asks more than four things at once. Draft time is a picker, not a form.

**How the gate checks it.** Count the options at each decision point; find the one primary.

## 3. Reachable targets

*From: Fitts's law.*

**What we do.** Every tappable thing is at least 44 × 44 pt (existing rule). The screen's primary
action sits in the thumb zone (the bottom third) or is a full-width control. A destructive action
is never adjacent to the primary one.

**What it means here.** Make pick, Confirm trade, Join, Set draft time: bottom of the screen or
full width. Leave league and Sell never sit beside Buy or Confirm.

**How the gate checks it.** Measure the hit area; check the primary action's position; check
that no destructive control touches a primary one.

## 4. Chunk it

*From: Miller's law, Chunking, Working memory, Cognitive load.*

**What we do.** Groups of five to seven. Money and numbers formatted in chunks ($1,234.56, never
1234.56). And the rule that matters most: **never make the player remember something from
another screen.** Whatever limit a decision is subject to is shown where the decision is made.

**What it means here.** The trade sheet shows the budget, the slot it fills ("Fills your
$100–$200 slot") and the sale that pays for it. The draft shows the slots still open and the
budget left. The join preview shows what you are joining (stake mode, slots, draft date) before
you join. The playoff setting shows how many managers the league has.

**How the gate checks it.** Any list over seven items is sectioned or grouped. Every sheet shows
the limit it enforces. The reviewer asks, for each decision: "what would I need to have
memorised from elsewhere?" The answer must be nothing.

## 5. One cue per group

*From: Law of proximity, Common region, Similarity, Uniform connectedness.*

**What we do.** A group is made by **one** visual cue: space, or a card, or a rule line, never
several stacked. The same kind of thing looks the same on every screen: one row style for a
manager, one for a holding, one for a matchup.

**What it means here.** `Card` is the container; spacing on the 8 pt grid is the separator.
A manager row in standings, in the schedule and in the draft order is the same component.

**How the gate checks it.** The squint test (blurred, the groups still read in order). The
"same component for the same thing" check across every screen on the branch and on main.

## 6. One thing stands out

*From: Von Restorff effect, Selective attention.*

**What we do.** Each screen has exactly one emphasised element, and it answers **the question
of the day**.

**What it means here.** Home's hero answers the phase: before the draft, "when is the draft?";
Monday, "what do I hold?"; mid-week, "am I winning?"; Friday, "did I win?"; after the season,
"who won?". Team colours mark people, green/red mark money (existing rule), so emphasis never
competes with the money signal.

**How the gate checks it.** Blurred, one primary element shows. The Home hero matches the
league's phase in every state of the stress fixture.

## 7. First and last

*From: Serial position effect.*

**What we do.** The most important fact is first; the action is last. Tabs are ordered by how
often they are used. In any list the player is part of, their own row is pinned or marked,
never lost in the middle.

**What it means here.** Tab order Home · Matchup · League · Portfolio stands unless usage says
otherwise. Standings pin the player's row. The draft order marks "you". A matchup puts the
player's team first.

**How the gate checks it.** Per screen, the reviewer names what is first and what is last and
why. Any list containing the player shows them without scrolling to find themselves.

## 8. The system carries the complexity

*From: Tesler's law, Postel's law, Paradox of the active user.*

**What we do.** Safe defaults. Forgiving input: search accepts a company name or a ticker in
any case; league codes ignore case and spaces; pickers cannot produce a value the server will
refuse. **Every refusal the server can return is explained in place, with what to do next.**
Players do not read manuals; the refusal is the only place they will read the rule.

**What it means here.** The draft-time picker offers only :00/:15/:30/:45 and at least an hour
out, so `draft_time` can never be refused for shape. The server's refusal reasons each map to a
message and a next step: `market_closed` → "Market's closed. Opens Mon 9:30 ET."; `no_eligible_slot`
→ "No free slot fits $X. Sell a $100–$200 position first."; `roster_reconfirm_required` → the
commissioner's reconfirm choice; `not_your_turn`, `over_budget`, `symbol_owned`,
`trade_conflict` (retry), `calendar_unavailable` (try again shortly) likewise. The full table
lives in the audit document and is kept current.

**How the gate checks it.** The reviewer lists every `reason` the functions on the branch can
return (`record-trade`, `validate-and-record-pick`, `draft-control`, `join-league`,
`leave-league`, `preview-league`) and finds its in-place message and next step. A reason with
no message is a P0 on a money or draft action, P1 elsewhere.

## 9. Never leave them waiting blind

*From: Doherty threshold, visibility of system status (Nielsen).*

**What we do.** A visible response to every tap within 400 ms. Skeletons, not spinners, while a
screen loads. Optimistic updates where a wrong guess costs nothing (draft queue order, settings,
appearance), **never for money or picks**: a trade or a pick shows "Sending…" and then the
server's answer, and nothing on screen claims it happened before the server says so. The
system's state is always visible: the pick clock, market open/closed and when it opens next,
"scores Friday 5 pm ET", "snapshot pending".

**What it means here.** `record-trade` and `validate-and-record-pick` are the two places a
fabricated success would mislead someone about money or a roster. The client mirrors the
server's own lesson (CLAUDE.md: "verify the effect, not the status"): it renders the response,
not its hope.

**How the gate checks it.** Tap → a visible change under 400 ms on a throttled device (the
recording shows it). Every async state has a designed look, including failure. No money or
pick UI updates before the response.

## 10. Show progress, leave a hook

*From: Goal-gradient effect, Zeigarnik effect.*

**What we do.** Anything multi-step shows where you are and what is left. Anything that is
waiting **on you** stays visible on Home until it is done.

**What it means here.** Draft: "Round 11 of 16 · 3 picks until you". Onboarding: create →
invite → set the draft date, with the done steps ticked. Season: "Week 4 of 8", then the
playoff round name. Pending-on-you states that must surface on Home: no draft date set
(commissioner), a roster to reconfirm after someone left, an "I'm in / I'm out" reply for Run
it back, an invite code still unshared when the league is below four managers.

**How the gate checks it.** Every multi-step flow has a progress mark. Every pending-on-you
state in the stress fixture has a Home surface, and it disappears when the state resolves.

## 11. Design the peaks and the endings

*From: Peak-end rule, Flow.*

**What we do.** Each key flow has one authored peak and **a designed ending**. Nothing
interrupts a player mid-pick or mid-trade.

**What it means here.** The peaks exist (the Friday reveal; the signature moments S1–S6, H1–H6,
G1–G6, M1–M5). The endings are the gap: after a pick ("Yours. Next pick in 4 turns."), after a
trade (the confirmed position, the slot it filled), draft complete (the roster, the first week's
date), week over (the result, the record), season over (the champion, the player's finish, Run
it back). No push, sheet or toast arrives while the pick clock is running for you or a trade
sheet is open.

**How the gate checks it.** A table of flow → peak → ending exists in the audit document; every
ending is named and shown on the board. The reviewer confirms nothing interrupts the two
protected moments.

## 12. No explainer under a heading

*From: Giorgio, 2026-11-10, said three times in one day (`../PRODUCT_RULES.md`, "No
heading-plus-explainer pattern"). Not a Law of UX; a product rule this file enforces.*

**What we do.** A heading is not followed by a sentence that explains it. The layout and the
controls make the thing clear. "I feel like a user will be able to understand how things work
without this repetitive couple lines of text under every single header."

**What it means here.** A line under a heading stays only if it is a fact the player cannot
see anywhere else on that card and needs right now: a time, a count, a name, or what is
blocking them and what to do about it. It is one line. These go:

- a sentence saying what the thing is or how it works ("If you step away, we'll auto-pick
  from your queue when your time runs out. You can come back any time.");
- a line that repeats the heading, the eyebrow or the button ("POSTPONED" over "The draft is
  postponed" over "…then pick a new draft time." over a button named Pick a new draft time);
- a rule the control already enforces ("The new time needs at least an hour's notice." under
  a picker that cannot offer an earlier time): it appears only as the refusal, in place
  (rule 8), when the player actually hits it;
- a setting's label with a grey sentence under it restating the label (Create league's Season
  step).

How a feature works may be said once, in that feature's empty state, where there is nothing
else to show. A count belongs beside the heading as a number, not in a sentence. This rule
removes text; it never asks for new copy, and any replacement wording is new copy for Giorgio.

A definition the player needs in order to choose (what Matchup or Price tiers means) is not
an explainer to cut silently: it moves behind an "i" (rule 13).

**How the gate checks it.** On every capture, list each heading (card title, section label,
setting label, sheet title) with every line of text between it and the first control or row.
Each such line is named in the report with one of: *fact needed now* (which fact), or
*explainer* (a finding). More than one line under a heading is a finding whatever the lines
say. Proposed priority P1 on a screen being built or changed; P2 on a screen the branch did
not touch (it goes to the sweep list, not into the branch).

## 13. A choice we defined carries optional context

*From: Giorgio, 2026-11-10, on the rule-12 sweep board (`../PRODUCT_RULES.md`, "Optional
context for a choice we defined"). Not a Law of UX; a product rule this file enforces. It is
the other half of rule 12: that rule removes explaining text, this one says where a player
can still ask.*

**What we do.** Where a selection is key to the flow, was defined by us, and is not obvious,
each option has a small info "i" at the end of its row. Tapping it opens a popup that
explains that option, with a small x in the corner to close it. "i dont want this to be
shows in text below, but a little information i on the end of each bar with a pop up
explaining would be great."

**What it means here.** A selection gets the "i" only when all three hold:

- it is **key to the flow**: the player cannot go on without choosing, or the choice changes
  how the league plays;
- it was **defined by us**: the option is a term or a mode of this app, not something the
  player already knows (his example: the league types on Create league);
- it is **not obvious** from the option's name and the screen around it.

When it applies, it applies to every option in that selection ("this should be a thing for
all options"), not only the ones we judge to be hard. The popup holds a concise explanation
in words, and may have a second part with a visual ("it could even be a two part pop up").
**The popup's form** (Giorgio, 2026-11-11; PRODUCT_RULES "The 'i' popup has two pages" and
"No button in the 'i' popup: just the dots"): two pages, the option's name and its short line,
then the name and the visual. No button: a swipe turns the page, and the two dots under the
card are the page control (a 44pt row; tap to turn; VoiceOver "Page 1 of 2"). The × in the
corner closes it from either page; it always opens on page 1. Its words are approved per
popup (PRODUCT_RULES "The 'i' popup lines, approved as written"); any new popup's words are
new copy for him. Nothing is added under the option's label:
rule 12 still holds on the same screen. A limit keeps its reason at the limit (rule 8); the
"i" explains what an option is, not why a control refused.

The Planner's reading, not his words: the "i" is its own target (rule 3) and opening it does
not select the option; and an "i" on a choice that fails the three-part test (a count, a
date, a name) is clutter of the kind rule 12 removes.

**How the gate checks it.** On every capture, list each selection (option rows, a segmented
control, a picker of named modes) and answer the three parts for it. For each selection that
passes: every option has an "i"; the "i" opens a popup with an x that closes it; the popup
was captured open, at Large and at the largest text size; no explaining text sits under the
options. Findings: a selection that passes the test with no "i", or with an "i" on only some
options; a popup with no x; explaining text under an option that has an "i"; an "i" on a
choice that fails the test. Proposed priority P1 on a screen being built or changed; P2 on a
screen the branch did not touch (it goes to the sweep list, not into the branch).

---

## What the reviewer reports

For every gate, the `ux-reviewer` returns:

1. **Scope examined:** which screens, which states (phase, theme, text size, Reduce Motion),
   which recordings. A finding's verdict never exceeds its evidence; "not examined" is a row,
   not an omission.
2. **Findings:** one row each: screen · rule # · what is wrong · proposed priority · suggested fix.
3. **Rule 8 table** (refusal → message → next step) and **rule 11 table** (flow → peak → ending)
   for the screens on the branch.

The Design Lead answers every finding one of three ways: **fixed**, **accepted with a reason**,
or **escalated to Giorgio**. Silence is not an answer. Priority definitions are in the plan.
