# The draft room: familiar, open an hour early, phone then laptop

Status: Approved (Giorgio, 2026-11-10)
Planner session: Planner (Fable 5.2) · Orchestrator hand-off: —

## Goal

The draft room is one real place. It opens an hour before the draft, you walk in through a
button, and it is the same room the draft then runs in. Someone who has drafted on ESPN,
Yahoo or Sleeper recognises it at once: a board of picks, a clock, a list to draft from, a
queue, their team. It is built for the phone first, then for a laptop as the same layout
with more room.

Today "Draft room open" is a label on a countdown card: the League tab stays the lobby and
the room only appears once the draft has started. The phone room already has a snake board,
a clock, stock search and a queue; it lacks the tabbed panel, an action on every row, and
being open before the start. There is no laptop room (the web is a paused landing page; an
old web draft page predates the redesign and is not live).

## Giorgio's rules

All 2026-11-10, verbatim.

- The room is real: "When the draft room opens, for example, in ESPN Fantasy Football, you
  literally enter like a room … You can see the order, like how people are ordered. You can
  see players … That's the same thing I want to emulate." "I don't just want to see draft
  room open, but then there is no room that you can enter into. When the draft room opens,
  there should be something I click on."
- It is the draft room, not a preview: "our draft room is just a preview. Like the draft
  room is just something you can enter an hour before, but then that's actually going to be
  where you're drafting."
- Familiar: "A user needs to be able to open it and be like, oh, this is just like ESPN or
  Yahoo or Sleeper. This is very familiar. I know how this works. I know how to queue. I
  know how to draft. I know how to see the order I'm in".
- Both sizes: "it is important that the draft room and the draft experience works well on
  both the phone and the desktop … I don't want to make a decision for the user."
- Order of work and the relation between them: "phone first, then laptop. The phone and the
  laptop should be the exact like kind of same layout. It's just the laptop is like an
  expanded version that has a bit more space and things are separated. The phone needs to
  just be more condensed."
- From drafting League B on build 1.3.0 (12): "there is no way to like add something to your
  queue and then just press draft directly from the queue. I have to then go back up to the
  search bar and type it all in again … I'm queuing them not just because if I step away,
  but that way … I can like jot down what I want to draft." "if you have something queued and
  then someone else in the draft takes it, it disappears." "in the latest picks little
  section, it just says the ticker name. It would be good if it also included the … actual
  name." "at the end of the draft … ESPN, I know, will have like a little draft recap pop-up
  thing. That's also something we should add in." On what the recap is: "right after you're
  done, it shows your draft recap. And then later, there should be some way in the app to
  kind of go back and see like the draft as a whole … like a little draft recap room … have
  like kind of almost little superlatives … the person that picked the most expensive
  drafts, or the person that picked the most budget friendly ones, or who made the quickest
  picks … Just kind of a little fun interactive thing." Then: "structure is right, include
  all the awards". And on the queue card: "I don't like this
  format of like header and then this text sub header that explains things … It just makes
  it cluttered. You use way too many words, and it's such like a red flag for vibe coding."
- His picks from the mockups: "A, a button into the room" · "A, the ESPN way" · "A, it
  tells you, you tap".
- The reveal: "when someone first opens up the draft room … whenever they first open it up,
  I want maybe like some sort of little animation of a sort that kind of reveals what their
  draft pick is … Something cool animation that like this is your draft pick". Of four
  concepts: "I think I like three the most" (the board seats itself). On the first sketch:
  "I don't love that there's like a box that's on top of like the grid, and then there's
  like, oh, intersecting lines and overlapping … the draft grid and stuff kind of disappears
  for a second for that big visual to pop up." On the revised sketch: "much better". And:
  "A, keep it a surprise".

Earlier rulings that still hold: "the draft room will open at 11 a.m. and the draft will
automatically start at noon" (2026-10-06); the board keeps the app's own look, "without it
being like a carbon copy of Sleeper" (2026-10-12). Familiar structure, Game Night look.

## Decisions

| # | Question | Decision | Who |
|---|---|---|---|
| 1 | Is there a room before the draft | Yes, from T−1h, and it is THE draft room in a before-the-start state, not a separate preview screen. | Giorgio |
| 2 | How you get in | A button. Home's and the League tab's countdown card keep their place and gain "Enter the draft room" for the whole hour and for the whole draft; the room opens as its own full screen. The room-open and draft-start pushes open it directly. | Giorgio (A) |
| 3 | The model | The structure the three apps share: a board of picks with every manager's column and the pick on the clock marked; the clock and whose turn it is at the top; a list of stocks with search; your queue; your team. | Giorgio |
| 4 | Phone layout | Sleeper's phone arrangement: clock on top, the board under it, then a panel with tabs **Stocks · Queue · Team**. | Giorgio (his reference) |
| 5 | Laptop layout | The same parts, expanded and separated, ESPN-style: clock and board across the top; stocks in the centre; queue and team in one side column; picks in the other. Same names, same order of importance, same actions as the phone. | Giorgio |
| 6 | Build order | Design both sizes together on one board; build the phone room first; the laptop room follows as its own project once the web app is switched on (it needs web sign-in from launch prep). | Giorgio |
| 7 | The row's action | The ESPN way. A stock row shows **Queue** before the draft and while others pick. When it is your pick the row shows **Draft**, with queueing still available as a small control. No Draft button exists that cannot draft. | Giorgio (A) |
| 8 | Before the start | You can browse and search stocks, open a stock's card, build and reorder your queue, see the full order with your column marked and your team's empty slots. You cannot pick. The countdown sits where the pick clock will be. | Giorgio + standing rules |
| 9 | At the start, in the room | Nothing reloads or navigates: the countdown becomes the first pick's clock and the board goes live in place. | Planner, from the references |
| 10 | At the start, elsewhere in the app | It tells you, you tap. The countdown card turns live (who is picking, how many picks until you) with the same button. The app never replaces the screen you are on. Your-turn buzz and chime on any tab stay as they are. | Giorgio (A) |
| 11 | Before T−1h | Today's lobby (countdown, queue). The order is set when the room opens, so there is no board earlier. | Standing rule |
| 12 | Chat, "who is here", draft grades, reactions | Not in this plan. Each is its own decision; none is needed for the room to feel familiar. | Planner |
| 13 | A league that is not ready at T−1h | Postponed, as today; no room, and the postponed card says why. | Standing rule |
| 14 | The order reveal | The first time you enter the room for a draft whose order was drawn at random, the order is revealed on the board: every manager's avatar shuffles along the top (fast, then slowing), they settle into their columns and the position labels fade in, your avatar is ringed and your number appears alone as large type ("You pick / 3rd / of 6"), then the number lifts away and the board and your highlighted column fade in. You are then in the room; nothing to dismiss. | Giorgio (concept 3, revised sketch) |
| 15 | Nothing overlaps | During the shuffle and the number the board's grid is NOT drawn: an empty stage, no card or box behind the number, no lines crossing it. The grid appears only after the number has gone. | Giorgio |
| 16 | Reveal ground rules | Once per draft per manager, on the first entry; three to four seconds; a tap skips to the end state; skipped entirely when the draft is live or within 30 seconds of starting, and when the order was not random; with Reduce Motion the end state shows with no animation; one short haptic as your column lights. In a league wider than the screen it ends centred on your column. "Seen" is remembered on the device per league and draft; a reinstall may replay it, which is harmless. | Planner |
| 17 | Keep it a surprise | Until you have entered the room once, your position is shown nowhere else: the room-open push no longer states it, and Home's and League's cards and the lobby do not show the order. After your first entry they do. Someone who never enters before the draft simply sees their position, with no animation. This CHANGES the 2026-10-06 rule that the room-open push carries your draft position. Proposed push line (NEW copy, his to approve on the board): "The draft room is open. Come see where you pick." | Giorgio (A) |
| 18 | Draft from your queue | On your pick, every row in your Queue shows **Draft**, the same control the Stocks rows show (decision 7). You never retype a stock you already queued. "ESPN has this in their draft … when it becomes my turn, the little queue button turns into a draft." | Giorgio 11-10 (build 12 draft) |
| 19 | A taken stock leaves your queue | The moment any manager drafts a stock (you included), it disappears from every queue that held it, on the server and on screen, with no "Save queue" step and no "Not saved yet". Build 12 kept the drafted stock in the queue, then showed it removed but unsaved. | Giorgio 11-10 |
| 20 | Latest picks say what was picked | Each line carries the ticker AND the company name ("I don't know what TOK is"). Planner addition for the board: who picked it, as ESPN's pick list shows. | Giorgio 11-10; manager name = Planner |
| 21 | No heading-plus-explainer blocks | The queue's paragraph ("If you step away, we'll auto-pick from your queue…") goes. The room explains nothing in running text under a heading; the one-time tip already teaches auto-pick. See the app-wide rule in PRODUCT_RULES. | Giorgio 11-10 |
| 22 | Right after your last pick | Your own recap, as today (your roster with prices and the Week 1 button), now with company names, plus one link: "See the whole draft". | Giorgio 11-10 |
| 23 | The draft recap room | A place you can go back to at any time: a **Draft recap** row on the League tab (and the link in 22). Three tabs: **Awards** (the superlatives and a few draft stats), **Board** (the finished board, every pick in order with who made it), **Teams** (each manager's team, one at a time). "there should be some way in the app to kind of go back and see like the draft as a whole … who made what picks". Read-only, leaguemates only. | Giorgio 11-10 ("structure is right") |
| 24 | The awards | "include all the awards": **Big spender** (priciest picks on average), **Bargain hunter** (cheapest on average), **Quickest draw** (fastest picks), **Down to the wire** (used the most of the clock), **On autopilot** (most auto-picks), **All in** (most picks from one sector), **Spread out** (most different sectors), **First off the board** (the first pick and who made it), **Steal of the draft** (the pick that has gained the most since draft day; it updates through the season). Award names and their one-line reasons are NEW copy, approved on the board. | Giorgio 11-10 |
| 25 | How awards are worked out | From what the draft already records: `drafts.entry_price`, `recorded_at` (a pick's time is its `recorded_at` minus the turn's start, the previous pick's `recorded_at` or the draft start), `pick_source`, `pick_number`, the stock's category. Rules: auto-picks do not count toward the two speed awards; a manager with no manual pick cannot win them; ties share the award; an award with no eligible winner is not shown (never an empty card); an Open team never wins one; "Steal of the draft" uses the same gain the Portfolio shows, per share since the draft price. | Planner |
| 26 | Tone | Light and friendly. The two that single someone out ("Down to the wire", "On autopilot") are worded as a wink, not a telling-off; the Design Lead shows the wording and Giorgio approves it. | Planner; copy on the board |

## Open questions

None for the plan. The Design Lead draws the phone room and the laptop room from these
decisions; Giorgio approves the screens and any NEW copy on the board before the build
(the Stocks / Queue / Team tab names, "Enter the draft room", the live card's lines, the
slot wording, the line that says when picking starts, the room-open push). The reveal is
gated from a simulator RECORDING, not stills: pacing, the hold on the number, the haptic.

## Scope

In, phone (this build): the room's before-the-start state; the entry button and the live
card on Home and League; the tabbed panel; Queue / Draft row actions; the push
destinations; the read paths answering before the start.
In, design only (this plan): the laptop layout on the same board.
Out: the laptop build (next plan, after the web app is on); chat, presence, grades; any
change to when the order is set, when the draft starts, the pick clock or auto-pick; joining
after the room opens.

## How it works

**The player, on a phone.** Until T−1h: the lobby. At T−1h a push says the room is open and invites you in, WITHOUT your
position (decision 17); Home and League show "Enter the draft room". Your first entry plays the order reveal
(decisions 14–16); after it you are inside: the countdown, the board with every manager's
column and yours marked, and the panel on Stocks. You search,
open a stock's card, tap Queue, switch to Queue to reorder, look at Team for your empty
slots. At T the countdown becomes the clock. While others pick, rows still say Queue; on
your pick they say Draft and the room says it is your turn as it does today. If you are
elsewhere in the app at T, the card goes live and you tap in.

**The system.** `app/(tabs)/league.tsx` mounts `DraftRoom` only while `drafting`;
`room_open` (`lib/game/autoStart.ts`) renders the lobby. The room becomes a route of its
own (reached from both cards and from the pushes) with three states chosen from the
server's fields: waiting (`not_started` + start_state `room_open` + an order with one entry
per member), live, ending. `lib/game/useDraftRoom.ts` already reads the clock
(`get_draft_clock`), the order (`get_draft_order`), picks, names and the queue; W2 confirms
each read ANSWERS for a member before the start and returns a clean waiting answer rather
than an error. `components/game/DraftBoard.tsx` is kept (its look is approved); the panel
replaces the room's stacked search / latest picks / queue sections with the three tabs;
the lobby's `QueueEditor` is the Queue tab, one component, one save path. Row actions come
from one pure function of (state, whose pick, already drafted, in queue) so no row can show
a control that does nothing. The live card on Home/League reads the same status the room
does. The known stale read in `lib/home/usePreDraftData.ts` (the order fetched once) is
fixed as part of this, since the card must be right at T−1h and at T.

**Laptop (design now, build later).** Same parts and names; the board and clock span the
top; stocks centre; queue and team stacked on one side; picks on the other. The Design Lead
shows where each phone tab lands so the two read as one room.

## Risks and edge cases

- **The room must follow the server, not the phone's clock.** No room on a locally derived
  `room_open`; require the server state and a full order (a count per member, never "any
  row"), or the postponed path shows instead.
- **The T boundary.** A manager who entered at T−59 and left the phone idle must be live at
  T on return; a queue save in flight at T must land or say it did not.
- **The densest screen in the app at the largest text size.** Board plus tabs plus rows at
  AX5 is part of the board, with stills, not a later fix. The pinned clock rule from
  2026-11-06 stands.
- **Familiar, not copied.** Structure from the references; colours, tiles and type are Game
  Night. Third-party screenshots stay in `~/fantasy-stock-design-review/references/`.
- **The surprise leaking.** The order is on the server from T−1h and `get_draft_order`
  returns it; the surprise is a presentation rule, not a secret. The cards and the push must
  not print it before the first entry, and the leaguemate team view and any other surface
  that could show seat numbers is checked too. A manager who has seen it can tell the
  others; that is fine.
- **The reveal in the way.** It must never delay a pick: skipped when live or within 30
  seconds of the start, and a tap ends it.
- **Two sizes drifting.** The laptop build later must reuse the phone room's state logic
  and row-action function, not re-derive them.

## Done means

- From T−1h one button on Home and on League opens the room; it shows the countdown, the
  full order with your column, stocks with search and prices, your queue and your team.
- Rows show Queue until it is your pick, then Draft; no control on the screen does nothing.
- At T the room goes live in place; outside the room the card goes live and the app does
  not navigate by itself.
- A postponed league has no room.
- On your pick a queued stock is drafted from the Queue tab in one tap; a stock drafted by
  anyone is gone from every queue at once with nothing left to save (two-account test);
  Latest picks show ticker and company name; no heading-plus-paragraph block in the room;
  the draft ends on your recap with "See the whole draft".
- League › Draft recap opens the room at any time after the draft: Awards, Board, Teams.
  Each award names the right manager from a fixture draft with known prices and times
  (Deno table test incl. ties, an all-auto manager, an Open team); an award with no winner
  is absent; "Steal of the draft" changes when prices do.
- First entry plays the reveal once, with no element overlapping the number; a second
  entry does not; Reduce Motion shows the end state; entering a live draft skips it; before
  the first entry neither the push nor any card shows the manager's position.
- Deno tests for state selection and the row-action table; simulator recordings across
  T−1h and T, in the room and outside it; Design Lead PASS at L and AX5 in both themes;
  Giorgio drafts a real League on his phone and it reads as familiar.
- The laptop layout is on the board and approved, ready for its own plan.

## Suggested workstreams

W1 board: references captured, then the phone room (waiting, others picking, your pick),
the live card, and the laptop layout, as "Your call" sections with the NEW copy listed.
W2 read paths before the start, plus the stale order read (Opus; `supabase-reviewer` if a
migration is needed). W3 the phone room: route, states, tabs, row actions, cards, push
destinations (after Giorgio's board sign-off). W4 gate, recordings, the phone check. W5 the recap room: one read RPC returning the
board, teams and computed awards for a league's draft (members only, SECURITY DEFINER with
the usual grants; Opus + `supabase-reviewer`), the League row, the three tabs, the ending's
link. W5 can ship after the room itself; "Steal of the draft" may follow in the next build
if it would hold the rest.

## Models

| Role / workstream | Model | Why |
|---|---|---|
| Planner | Fable 5.2 | The plan |
| W1 board | Design Lead on Opus | Judgement; two sizes of the densest screen |
| W2 read paths | Opus | Draft-state rules and grants |
| W3 phone room | Opus plan turn, then Sonnet | Well-specified once the board is signed off |
| Reviews | Sonnet reviewers; Opus for the Orchestrator's pass | Checklist vs judgement |
