# Claims, prices and the stock list fix themselves

Status: Draft, for Giorgio's approval. One pick is open (decision 1) and two sentences need his yes. Nothing here is built
Planner session: "Planner" (Fable 5.2), 2026-11-23 · Orchestrator hand-off: this commit

## Goal

A manager should almost never read "Claims weren't processed on Monday" or "AAPL isn't in
this league's list of stocks" because of something that went wrong on our side. When a
claim, a price or the stock list starts to fail for a reason that is ours, the system
notices and repairs it without a person. The messages stay, as the last resort.

## Giorgio's rules

- 2026-11-23, the Planner's chat, after approving the two failed-claim messages: "Now, my
  only thing is that kind of like we can't have happen where there's like a missed, like a
  stock's not showing its price or something like that. We really need to make sure that
  messages like the stock isn't in this league's list or claims weren't processed on
  Monday. Like those really cannot be happening. I understand we have them as fallbacks,
  but like we need to have some sort of also trigger to where if something like that's
  occurring, there's an automatic fix being done in place."
- 2026-11-17: "There should always be a price for a stock. We cannot be building an app
  that will have a human type in the price." Shown three options then, he chose the
  automatic one over an alert and over a person stepping in.
- 2026-11-18: "we can't be showing a stock price that is a day old".
- Claims are "processed at the next open 9:30 ET at the opening price" (2026-10-08).

## What is already automatic (read in the code, 2026-11-23)

- The claims run is called every minute through the trading day until it has run, so one
  bad minute does not lose the day (workstream 6's design).
- A failed price refresh keeps the stock's last price (`enrich-symbols/batch.ts`: a failed
  or empty price answer leaves `last_price` as it was). A failed refresh cannot take a
  stock off the list.
- Weekly scoring always finds a price (#513, the previous close as the last step).
- A price on screen is asked for again every 20 seconds while the screen is open
  (`lib/stocks/useRowPrices.ts`), so one failed lookup repairs itself.

## What is not, and the fix for each

### 1. A claim on a stock with no price at the open

Today's design (the plan for part 3, point 9): wait 3 minutes, then that claim fails.
**Decision 1 is his, between two fixes:**

- **A. Wait for today's first price.** The claim stays pending and fills at the first
  price our source shows for that stock today, whenever it comes. While it waits, nobody
  can buy that stock live in that league, or a fast tapper would take it at yesterday's
  price. The claim fails only if the whole session passes with no price.
- **B. After 10 minutes, use the last known price.** The claim fills at the price a live
  buy would get at that moment, which for a stock that has not traded today is
  yesterday's. It always fills, and quickly. It can fill at a day-old price.

The Planner recommends A. B hands a bargain to a claim on a stock that jumped overnight
and has not yet traded on our source, and "at the opening price" would not be true of it.
A costs more to build and has two consequences he should know: a manager who tries to buy
that stock live while a claim waits is refused, so they learn that someone has claimed it
(not who); and one new sentence is needed for the rare day with no price at all.

Either way, the rest of the league's claims run at the open as designed. Only the claims
on the unpriced stock are affected.

### 2. A whole session with no claims run

Today's design: those claims fail ("Claims weren't processed on Monday").

- **Something separate checks that the run happened.** A scheduled check inside the
  database, not the run itself, looks a few minutes after each open for any league with
  claims due and no run recorded. It calls the run again, and records that it had to. A
  job cannot be trusted to report its own death (CLAUDE.md, the stranded `running` row).
- **Claims that reach the close unrun move to the next open by themselves.** Done in the
  database, so it works even when the run's own code is what is broken. The claim stays
  pending and its row reads the new day ("Claimed · fills Tue 9:30 AM ET"). The manager is
  told (words below). A claim is never run after the close at that morning's price: the
  week-end snapshot has already been taken by then.
- The waiver order used is the order at the run that finally happens.
- "Claims weren't processed on Monday", as an ending, is then left for a claim that could
  not be moved (the season ended first).

### 3. A stock taken off the list by our own stale or broken data

- **The run judges a claimed stock on fresh numbers.** Whether the stock is in the list is
  decided at the run with the price the claim is about to fill at, not the stored price,
  which can be two days old.
- **A size we already know is not wiped by an incomplete answer.** The refresh replaces a
  stock's company size with nothing when the supplier answers "ok" without one
  (`batch.ts`: `marketCap = prof.marketCap ?? null`). A missing size takes the stock off
  the list. The known size is kept unless a real new one arrives.
- **A refresh that would drop many stocks at once does not apply.** If one run would take
  more than a small share of its stocks off the list, it writes none of those drops and
  reports itself failed. One stock leaving is news about the stock; many leaving together
  is news about our data.
- To check, not assumed: nothing in the code today marks a stock inactive
  (`refresh-symbols` only ever writes `active: true`). If so, a delisted stock stays on
  the list until its numbers fall under a floor. The worker confirms it and reports; the
  fix, if needed, is its own decision.
- When a company really has left the market, the message is true and nothing is "fixed".

### 4. Somebody is told when the system had to repair something

Open question 2. The repairs above are silent by design. The Planner recommends one push
to Giorgio's own phone, once a day at most, when a repair ran or could not: a run that had
to be called again, claims moved to the next open, a refresh that refused to apply. It
uses the push path that exists. Without it, the only trace is a row in a status table
nobody is looking at.

## Words that need his yes

1. Claims moved to the next open (a push, and the claim's row shows the new time):
   **"Claims weren't processed on Monday. Your AAPL claim moves to Tuesday's open."** The
   first sentence is approved (2026-11-23); the second is new.
2. Only if he picks A: the rare day with no price at all:
   **"AAPL had no price on Monday"**, with "Nothing was bought." under it.
3. Only if he picks A: what a live buyer of a stock with a waiting claim reads. The
   approved "Claims are being processed. Try again in a minute." would be untrue of a
   wait that can last hours. The Design Lead words it; it comes to him.

## Open questions

1. Decision 1, A or B. His.
2. A push to his own phone when a repair runs. His; the Planner recommends yes.
3. The share that counts as "many stocks at once" in fix 3. The worker proposes it from a
   read-only count of how many stocks normally change in one refresh; the Planner agrees
   it before it is built.

## Scope

**In:** the three fixes above; the check that the run happened; the move to the next open;
the words; tests for each (a stock with no price at the open; a session with no run, with
the run's code made to fail; a refresh that answers with no sizes; a refresh that would
drop a tenth of its stocks).

**Out, and why:**
- Live buying and selling at a price from before today's session. A live buy of a stock
  that has not traded today already fills at yesterday's price. That is the same weakness
  as B, it exists today, and closing it for live trades would refuse many honest buys with
  our current source. It belongs with the price supplier, which is parked on his word.
- Alerts to anyone but him. No new service is connected to production.
- Top movers: its job already keeps the previous ranking when a run is incomplete.

## Risks

- Fix 2 and fix 1A add states a claim can be in (waiting for a price; moved a day). Each
  is one more thing the run must not get half right: every state has a test for the
  partly done case, and each repair can be run twice without doing its work twice.
- The check on the run shares the database's scheduler with the run. If the scheduler
  itself stops, neither fires. That also stops weekly scoring and is outside this plan;
  the move to the next open still happens when it returns.
- A claim moved from Friday to Monday crosses the weekly reset of the waiver order. It
  runs in Monday's order, as the October plan already says for claims placed on a Friday.

## Workstreams

After workstream 6 of part 3 (the claims server), before build 18. The Orchestrator
assigns migration ranges after the latest applied.

| # | Workstream | Model | His steps after it |
|---|---|---|---|
| 1 | The run: decision 1, and judging a claimed stock on fresh numbers | Opus, both reviewers | a deploy of `claims-run` |
| 2 | The check that the run happened, and the move to the next open | Opus, both reviewers | `db push`, then a look by data |
| 3 | The refresh: keep a known size; refuse a mass drop | Opus | a deploy of `enrich-symbols` |
| 4 | The app: the moved claim's row and push; the words | Sonnet, Design Lead gate | none |

## Done means

1. With the price source answering nothing for one claimed stock at the open, the other
   claims in the league still run, and that one behaves as decision 1 says.
2. With the run's code made to fail for a whole session, every pending claim is pending
   for the next session by the end of the day, its manager was told once, and nothing was
   bought or sold.
3. A refresh that answers "ok" with no size leaves the stock's size and its place on the
   list unchanged.
4. A refresh that would take a tenth of its stocks off the list changes none of them and
   reports itself failed.
5. Each repair, run twice, does its work once.
6. `STATUS.md` records, by data, the first real morning the run was checked.
