# A real draft room from the moment it opens

Status: Draft (Giorgio's direction 2026-11-10; board mockups before approval)
Planner session: Planner (Fable 5.2) · Orchestrator hand-off: —

## Goal

When the app says the draft room is open, there is a room to walk into. An hour before the
draft a manager enters the same room the draft will run in, sees where they pick, looks at
stocks and builds a queue, and is already in place when the first pick goes on the clock.
Today "Draft room open" is a label on a countdown card: the League tab stays the lobby
(countdown, a "Draft order" card, the queue) and the room itself only appears once the
draft has started.

## Giorgio's rules

2026-11-10, verbatim, from League B on build 1.3.0 (12):
- "When the draft room opens, for example, in ESPN Fantasy Football, you literally enter
  like a room where you can see like basically a preview of like the draft room that will
  appear once the draft starts. You can go in there. You can see the order, like how people
  are ordered. You can see players. You can see all that. That's the same thing I want to
  emulate."
- "I don't just want to see draft room open, but then there is no room that you can enter
  into. When the draft room opens, there should be something I click on. It brings me to the
  draft room, and then I can start prepping. I can see the order in which I'm going to be
  picking. I can start kind of doing some prep. Right now, it's just the queue, and that's
  it. But that's not really a draft room."

Standing rule this builds on (2026-10-06): "the draft room will open at 11 a.m. and the
draft will automatically start at noon"; at T−1h the room opens and the order is set.

## What the fantasy apps do (research, 2026-11-10)

- **ESPN:** the room opens one hour before the draft (ESPN support). An older ESPN rules
  page says you can enter the live draft lobby up to an hour early, the order is set
  randomly beforehand, and the first pick goes on the clock within minutes of the start.
  Inside: the player list in rank order, your queue (drag to reorder), picks as they land.
- **Yahoo:** "the draft room opens about 30 minutes before draft time" and Yahoo recommends
  being in ten minutes early; you pre-rank players, and autopick uses that list (Yahoo help).
- **Sleeper:** the draftboard exists as soon as a draft is scheduled; you can open it at any
  time ("Preview Your Draft Lobby"), the commissioner sets the order on the board, and
  nothing can be picked until the draft begins (Sleeper support).
- Common to all three: you are IN the real room before the first pick, the order is visible
  there, you can browse and queue, and the room simply turns live at the start.

The published help pages are thin on screenshots of the waiting state; the Design Lead adds
real captures to `~/fantasy-stock-design-review/references/` (never the repo) before
drawing.

## Decisions

| # | Question | Decision | Who |
|---|---|---|---|
| 1 | Is there a room before the draft | Yes. From T−1h the draft room is a place you enter, the same screen the draft runs in, in a "before the draft" state. | Giorgio 11-10 |
| 2 | How you get in | "there should be something I click on": the countdown card on Home and on the League tab gets one primary button into the room for the whole hour; the room-open push opens it directly. Exact button and whether the League tab simply BECOMES the room = board call. | Giorgio 11-10; placement open |
| 3 | What is in it before the draft | The draft order as the board will show it, with your slot marked ("the order in which I'm going to be picking"); the stocks you can draft, searchable, with prices ("You can see players"); your queue, editable; your empty roster with the league's slots; the league's draft settings (rounds, pick clock, budget); the time to the start where the pick clock will be. | Giorgio 11-10; layout = board |
| 4 | What you cannot do yet | Pick. Every pick control is present but waiting, and says when it starts. Nothing tappable does nothing: a tap on a waiting control explains itself or the control is not shown. | Standing rule |
| 5 | At the start | The room does not reload or navigate: the countdown becomes the first pick's clock and the board goes live in place. | Planner, from the research |
| 6 | Before T−1h | The lobby stays as it is (countdown, queue). The order is not set until the room opens, so there is no board to show earlier. | Planner, standing rule |
| 7 | Chat and "who is here" | Out of this plan. The app has no chat; presence needs live infrastructure and is its own decision. | Planner |
| 8 | A room that cannot open | If the league is not ready at T−1h the draft is postponed, as today; there is no room to enter, and the postponed card says why. | Standing rule |

## Open questions

Board calls for Giorgio, drawn by the Design Lead from this brief:
1. **The way in:** A, the League tab becomes the room at T−1h and Home's card has "Enter
   the draft room"; B, the lobby stays and both cards have the button, the room opening
   over it. (ESPN and Yahoo are B-like: a button into a dedicated room.)
2. **The waiting room's layout:** what leads (the order and your slot, or the stock list),
   and how the start countdown sits where the pick clock will be.
3. **Your slot's wording** ("You pick 3rd · picks 3, 6, 11…") and the waiting line on pick
   controls: NEW copy, approved by Giorgio on the board.

## Scope

In: the room's pre-draft state on mobile (`components/game/DraftRoom.tsx`,
`lib/game/useDraftRoom.ts`, `app/(tabs)/league.tsx`, Home's and the lobby's countdown card,
`DraftCountdownCard.tsx`), the room-open push's destination, and whatever the read RPCs
need to answer before the draft starts.

Out: any change to when the order is set or the draft starts; joining after the room opens
(still refused); chat and presence; the web.

## How it works

**The player's side.** Up to T−1h: today's lobby. At T−1h (push: the room is open, with
your position): Home and League show the button; the room opens on the order with your
slot marked, the stock list under the same search the draft uses, your queue, and the
countdown where the clock will be. You search, read the stock sheet, add to the queue and
reorder it. At T the first pick's clock starts in place; if it is your turn the room says
so exactly as it does today.

**The system's side.** `league.tsx` mounts `DraftRoom` only while `drafting`; the phase
`room_open` (`autoStart.ts` `LobbyPhase`) renders the lobby. The room gains a third state
beside live and ending: `waiting` (draft_status still `not_started`, start_state
`room_open`). `useDraftRoom` already reads the order (`get_draft_order`), the picks, the
names and the queue; before building, confirm each of `get_draft_clock`, `get_draft_order`
and the queue read ANSWERS for a member while `not_started` once the order is set (they
were written for a live draft; a refusal there must become a clean "waiting" answer, not an
error state). The queue editor already used in the lobby is reused inside the room, one
component, one save path. The transition at T rides the room's existing realtime/poll; the
clock card takes the start instant from the same server time the lobby countdown uses.

## Risks and edge cases

- **Order not set at T−1h** (fewer than 4, or another blocker): that is the postponed path,
  never a room with no order. The room must not open on `room_open` computed on the phone
  alone; it follows the server's start_state and an order with the right COUNT of entries
  (per-participant, not "any row").
- **A manager who opens the room at T−59 and leaves the phone:** the screen must still go
  live at T (keep-awake is not assumed; a foreground return re-reads).
- **Queue edits at the boundary:** a save in flight when the draft starts must land or say
  it did not; the auto-pick reads the saved queue.
- **Large text:** the waiting room is the densest screen in the app; AX5 stills are part of
  the board, not an afterthought.
- **The last minute:** today's `starting` phase ("Starting…") folds into the room.

## Done means

- At T−1h a member taps one button and is in the room; it shows the full order with their
  slot, a searchable stock list with prices, their queue and the countdown.
- No pick can be made before T; nothing tappable is dead.
- At T the same screen goes live with no reload, for a manager who was in the room and for
  one who opens it late.
- A postponed league shows no room.
- Deno tests for the room's state selection (lobby / waiting / live / ending) from the
  server's fields; simulator recordings across the T−1h and T boundaries; Design Lead PASS at
  L and AX5, both themes; Giorgio checks it in a real League on his phone.

## Suggested workstreams

W1 board (Design Lead: references, then the three "Your call" sections). W2 read-path check
and any RPC change (Opus; `supabase-reviewer` if a migration is needed). W3 mobile room
state and entries (after Giorgio's picks). W4 gate and phone check.

## Models

| Role / workstream | Model | Why |
|---|---|---|
| Planner | Fable 5.2 | The plan |
| W1 board | Design Lead on Opus | Judgement; the densest screen |
| W2 read paths | Opus | Draft-state rules and grants |
| W3 mobile | Opus plan turn, then Sonnet | Well-specified once the board is picked |
| Orchestrator | Opus | Verification |
