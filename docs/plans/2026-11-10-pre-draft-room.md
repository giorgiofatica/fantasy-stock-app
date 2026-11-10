# The draft room: familiar, open an hour early, phone then laptop

Status: Draft (all four decisions settled with Giorgio 2026-11-10; awaiting his "approved")
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
- His picks from the mockups: "A, a button into the room" · "A, the ESPN way" · "A, it
  tells you, you tap".

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

## Open questions

None for the plan. The Design Lead draws the phone room and the laptop room from these
decisions; Giorgio approves the screens and any NEW copy on the board before the build
(the Stocks / Queue / Team tab names, "Enter the draft room", the live card's lines, the
slot wording, the line that says when picking starts).

## Scope

In, phone (this build): the room's before-the-start state; the entry button and the live
card on Home and League; the tabbed panel; Queue / Draft row actions; the push
destinations; the read paths answering before the start.
In, design only (this plan): the laptop layout on the same board.
Out: the laptop build (next plan, after the web app is on); chat, presence, grades; any
change to when the order is set, when the draft starts, the pick clock or auto-pick; joining
after the room opens.

## How it works

**The player, on a phone.** Until T−1h: the lobby. At T−1h a push says the room is open
with your position; Home and League show "Enter the draft room". Inside: the countdown, the
board with every manager's column and yours marked, and the panel on Stocks. You search,
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
- **Two sizes drifting.** The laptop build later must reuse the phone room's state logic
  and row-action function, not re-derive them.

## Done means

- From T−1h one button on Home and on League opens the room; it shows the countdown, the
  full order with your column, stocks with search and prices, your queue and your team.
- Rows show Queue until it is your pick, then Draft; no control on the screen does nothing.
- At T the room goes live in place; outside the room the card goes live and the app does
  not navigate by itself.
- A postponed league has no room.
- Deno tests for state selection and the row-action table; simulator recordings across
  T−1h and T, in the room and outside it; Design Lead PASS at L and AX5 in both themes;
  Giorgio drafts a real League on his phone and it reads as familiar.
- The laptop layout is on the board and approved, ready for its own plan.

## Suggested workstreams

W1 board: references captured, then the phone room (waiting, others picking, your pick),
the live card, and the laptop layout, as "Your call" sections with the NEW copy listed.
W2 read paths before the start, plus the stale order read (Opus; `supabase-reviewer` if a
migration is needed). W3 the phone room: route, states, tabs, row actions, cards, push
destinations (after Giorgio's board sign-off). W4 gate, recordings, the phone check.

## Models

| Role / workstream | Model | Why |
|---|---|---|
| Planner | Fable 5.2 | The plan |
| W1 board | Design Lead on Opus | Judgement; two sizes of the densest screen |
| W2 read paths | Opus | Draft-state rules and grants |
| W3 phone room | Opus plan turn, then Sonnet | Well-specified once the board is signed off |
| Reviews | Sonnet reviewers; Opus for the Orchestrator's pass | Checklist vs judgement |
