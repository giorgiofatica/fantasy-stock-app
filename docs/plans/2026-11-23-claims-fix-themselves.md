# Claims, prices and the stock list fix themselves

Status: Approved (Giorgio, 2026-11-23: "approved, show me the screens"). Not built. Approving the plan is not approval of any merge, database push or deploy
Planner session: "Planner" (Fable 5.2), 2026-11-23 · Orchestrator hand-off: this commit

## Goal

A claim should not fail to go through because of something that went wrong on our side.
When a claim, a price or the stock list starts to fail for a reason that is ours, the
system notices and repairs it without a person. Since his ruling later the same day, a
claim that does not go through shows no message at all, so nothing tells a manager when we
got it wrong. That makes the repairs matter more, not less.

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

**The fix: try for today's price, then use the price a live buy would get.** For the 10
minutes the league is already held, the run keeps asking for a price from today's session
for that stock. If none has come by then, the claim fills at the price a live buy of that
stock would get at that moment, which for a stock that has not traded today is the last
known one. The sale and the buy are both priced this way. A claim never fails for lack of
a price.

This is the Planner's reading of his words, "It has to be automatic at markets open" and
"at whatever price NVIDIA is" (2026-11-23), told to him as a reading. He was first shown
two other ways and picked neither letter: waiting through the morning for the stock's
first price (it needs that stock frozen for everyone else, which tells them it was
claimed), and waiting with nothing frozen (a fast tapper takes the stock first).

Known and accepted for now: for a quiet stock the last known price can be yesterday's. A
live buy of the same stock a minute later gets the same price, so the claim is treated as
every other buy is. Closing that for claims and live buys together needs the price
supplier, parked on his word.

The rest of the league's claims run at the open as designed.

### 2. A whole session with no claims run

Today's design: those claims fail ("Claims weren't processed on Monday").

- **Something separate checks that the run happened.** A scheduled check inside the
  database, not the run itself, looks a few minutes after each open for any league with
  claims due and no run recorded. It calls the run again, and records that it had to. A
  job cannot be trusted to report its own death (CLAUDE.md, the stranded `running` row).
- **Claims that reach the close unrun move to the next open by themselves.** Done in the
  database, so it works even when the run's own code is what is broken. The claim stays
  pending and its row reads the new day ("Claimed · fills Tue 9:30 AM ET", approved
  words). No notice is sent: his ruling is no message for a claim that did not go through.
  A claim is never run after the close at that morning's price: the week-end snapshot has
  already been taken by then.
- The waiver order used is the order at the run that finally happens.
- A claim cannot be cancelled from the open of its run day until it is resolved or moved.
  If the run never comes, the move at the close is what frees it (the Planner's ruling on
  the claims server's `claim_locked`, 2026-11-23).

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

### 4. He is told when the system had to repair something, and it is logged

His answer, 2026-11-23: "Yes, i want to be able to track the performance of the app. so i
should get a notification and eventually itll be logged into some sort of dashboard or
place where i can view".

- **A log of repairs.** Each repair writes one row when it happens: what it was (a run
  called again, claims moved to the next open, a refresh that refused to apply, a claim
  filled at a fallback price), when, which leagues, and whether it worked. Written by the
  server only and readable by no manager. It is the record a dashboard is later built on.
- **A notice to him.** One push to his own account, at most once a day, on a day the log
  gained a row. It says what was repaired and how many leagues it touched. His account is
  named in a server setting, not in the app. It uses the push path that exists.
- **Not a message to managers.** No manager is sent or shown anything.
- The words of the notice are ours to him, not app copy; they are plain and say what
  happened ("The claims run didn't start this morning and was restarted. 2 leagues.").
- The dashboard itself is "eventually" in his words and is out of this plan.

## Words

None. A moved claim uses the approved "Claimed · fills {day} 9:30 AM ET". The sentences
this draft first proposed are withdrawn with his ruling of the same day.

## Open questions

1. ANSWERED 2026-11-23: yes, a notice to him, and a log (fix 4).
2. ANSWERED 2026-11-24 (the Planner, on the worker's proposal; "Settled during the build",
   point 1): more than 2 stocks, or more than a twentieth of the run if that is larger.
3. OPEN, found by the count of 2026-11-24, not part of workstream 3:
   - **424 stocks are off the list only because we hold no company size for them**
     (active, not a fund, on a listed exchange, priced at $1 or more, already refreshed).
     Fix 3 keeps a size we know; it cannot bring back one we never had or already lost.
     Whether these are stocks the supplier never sizes or ones a past incomplete answer
     wiped is not known. To decide on data, a read-only breakdown: by exchange, by price
     band, by when last refreshed, by whether an industry is held (an industry without a
     size means the supplier did answer once), the names, and how many are held or
     watched in any league. The Planner reads it and takes it to Giorgio only if real
     companies are among them.
   - **A run writes 25 stocks at the median, half of what it asks for.** ANSWERED
     2026-11-24 (the worker): not a fault. About half of every run is the stocks with no
     price, asked for again each time (`priorityCapFor`), and they are off the list
     already, so they can never be drops. It does mean a priced stock's turn comes round
     about half as often as the run size suggests, for as long as there are stocks our
     price source never prices. Sized the same day at 388 stocks (question 4), and
     answered there: they are asked again once a day, not every run.
   - **Nothing ever takes a delisted stock off the list** (workstream 3's check,
     confirmed 2026-11-24). The exchange feed only adds and updates
     (`refresh-symbols` writes `active: true`); no code writes `active: false`. A stock
     that leaves the feed is never touched by it again, the supplier answers "empty" for
     it, which keeps its size, and the price source has nothing new, which keeps its
     price. So it stays on the list with frozen numbers. Workstream 3 changed nothing
     here. What is already ruled (`docs/PRODUCT_RULES.md`): for a manager who holds it,
     its last real price stands; for everyone else it should be off the list, and "isn't
     in this league's list" is then true. What is missing is the thing that takes it off:
     nothing records when a stock was last in the feed. To size it first, read-only: the
     on-list stocks refreshed in the past few days whose data has not changed in two
     weeks, with their names, and how many of them anyone holds. That number also catches
     stocks our price source simply never trades, so the names are read, not just
     counted. If it needs a fix, it is an addition to this plan for his approval, with
     the same guard as the mass drop: a feed that comes back short must not take stocks
     off the list.
   - **A refresh cut off before its end now writes nothing** (workstream 3 writes after
     it has fetched everything; before, it kept the stocks it had reached). Accepted, on
     two conditions: a run the supplier stops early still writes the stocks it judged,
     and a run stops fetching at a fixed time of its own, well inside the limit, and
     writes what it has. A run that can only ever lose all its work is the refusal with
     no way back that this plan exists to remove.

4. **What the read-only audit of 2026-11-24 found** (run by Giorgio; the output is kept
   outside the repo). Both gaps in question 3 are real, neither touches a manager today
   (nobody holds or watches any of these stocks), and they look like one gap seen twice:
   the app has no way to know that a ticker no longer exists.
   - **The 424 with no size.** About 250 are things a size floor was never meant for
     (notes, preferred shares, warrants, rights, units, blank-cheque companies, funds).
     About 175 read as ordinary shares, and well-known companies are among them. 370 of
     the 424 hold no industry either, so the supplier has likely never answered for them;
     54 hold an industry and no size, so it answered at least once and the size was never
     sent or was wiped. All 424 were refreshed in the past two weeks, so the refresh
     reaches them and gets nothing.
   - **Frozen on the list: 1,143**, an over-count as expected. Of the oldest 200, about
     155 are funds whose stored numbers simply never change. The other 44 include
     companies that were bought or merged, and funds that reached their end date. So a
     company that has left the market does stay on the list.
   - **Not known yet, and needed before a fix is written:** which of the well-known names
     with no size still trade under that ticker today and which were renamed or bought
     (the Researcher, from public sources); and what the supplier actually answers for
     the ones that still trade (workstream 3 adds this to the run's own line: how many
     stocks answered "ok" with no size, and how many answered nothing, with the first
     twenty symbols of each). No fix is built from the counts alone.
   - **Stocks with no price at all: 388** (counted by Giorgio the same day; active, and of
     a kind the price source accepts). The refresh gives half of every run to these and
     asks again for each about every three hours. In September there were 4,749; what is
     left is what the source has never priced. So half of the refresh is spent asking the
     same 388 questions eight times a day, and every other stock waits about four days
     for its turn instead of two.
   - **The Planner's answer (2026-11-24), a build detail in workstream 3:** a stock with
     no price that has already been asked is asked again once a day at most; one that has
     never been asked keeps its place at the front. The worker first confirms from the
     runs' own lines that the priority half comes back with almost no prices; if it does
     not, it reports and builds nothing. Tests: a stock with no price is not picked twice
     in a day; a new stock is picked at once; with the backlog out of the way a run fills
     with the stocks waiting longest.

5. **What the Researcher found** (2026-11-24, public sources only,
   `docs/research/2026-11-24-symbol-lifecycle-audit.md`), for 50 well-known names from
   the audit:
   - **Frozen on the list, 25 of 25:** the company was bought, merged or taken private,
     and the ticker is gone from the exchange feed. So the gap is confirmed: a company
     that has left the market stays on our list.
   - **No size, 25:** 21 are the OLD ticker of a company that changed its ticker and
     still trades under the new one (the new ticker is in the feed as its own row); 2
     were bought; 1 is a new listing; 1 was renamed and carries an exchange warning flag.
     So most of the well-known names with no size are not companies missing from the
     list. They are dead tickers, and the live company is on the list under its new one.
   - **The feed only shows what is listed today.** A ticker that leaves simply stops
     appearing, and a rename is one row gone and another arrived with nothing joining
     them. There is no free file of changes; the exchange's own change list is paid.
   - **One case where gone from the feed did not mean gone:** a company that says it
     still holds its ticker is in neither feed file. So absence alone is not proof.
   - **Not settled:** what our size supplier answers for a renamed ticker; and whether
     the price supplier we already use publishes ticker changes and buy-outs in a form a
     program can read. If it does, that joins an old ticker to its new one and gives the
     price a buy-out paid, which the feed cannot. The Researcher is asked.
   - **What this makes of the fix.** Two parts, and the second needs a ruling of his:
     (a) a ticker that has left the market leaves the list for everyone who does not hold
     it. Already ruled; needs a signal that cannot be set off by a short download.
     (b) what a manager who HOLDS it sees when the company changes its ticker (the real
     shares carry on under the new one) or is bought (the real shares become cash). Today
     the holding would freeze at its last price while the real company moves on. Nobody
     holds one now. This goes to him as a question with drawings once the Researcher's
     second answer says what can be built.
   - **ANSWERED in part, 2026-11-24** (`docs/PRODUCT_RULES.md`): for a company bought
     out, B. The app sells the holding at its last real price the day it stops trading,
     returns the money, opens the slot and tells the manager. Still open: a company that
     only changes its ticker, which waits on the supplier check (whether our plan can
     read ticker changes and buy-outs); and a stock that stops trading for any other
     reason. The fix is written as an addition to this plan once that check is back.

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
- A dashboard, or any screen for the log. He said "eventually"; it gets its own plan.
- Top movers: its job already keeps the previous ranking when a run is incomplete.

## Risks

- Fix 2 adds a state a claim can be in (moved a day). It is one more thing the run must
  not get half right: it has a test for the partly done case, and each repair can be run
  twice without doing its work twice.
- With no message for a claim that did not go through, a fault of ours is invisible to
  the manager it hurt. The check on the run, the log and the notice to him (fix 4) are
  the only way it is seen.
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
| 1 | The run: the price fallback (fix 1), and judging a claimed stock on fresh numbers | Opus, both reviewers | a deploy of `claims-run` |
| 2 | The check that the run happened, the move to the next open, the log of repairs and the notice to him | Opus, both reviewers | `db push`, a server setting naming his account, then a look by data |
| 3 | The refresh: keep a known size and a known industry; refuse a mass drop; drop a held stock on its second reading | Opus | `db push` (one new column on the stock list) FIRST, then a deploy of `enrich-symbols` |
| 4 | The app: a moved claim's row shows its new time | Sonnet, Design Lead gate | none |

## Done means

1. With the price source answering nothing from today's session for one claimed stock,
   the other claims in the league run at the open, and that one fills within the
   10-minute hold at the price a live buy would get.
2. With the run's code made to fail for a whole session, every pending claim is pending
   for the next session by the end of the day, no manager was sent anything, and nothing
   was bought or sold.
3. A refresh that answers "ok" with no size leaves the stock's size and its place on the
   list unchanged.
4. A refresh that would take a tenth of its stocks off the list changes none of them and
   reports itself failed.
5. Each repair, run twice, does its work once.
6. A repair made in a test writes one row to the log and one notice to the named
   account, and nothing to any other account.
7. `STATUS.md` records, by data, the first real morning the run was checked.

## Settled during the build

1. **The mass drop in fix 3** (the Planner, 2026-11-24, on the worker's proposal sent by
   the Orchestrator; a build detail under the approved plan, not a ruling of his).
   - **What counts.** A drop is a stock on the list before the run that the run would
     take off. A run refuses when its new drops number more than 2, or more than a
     twentieth of the stocks it judged if that is larger. For the usual run of 50 that is
     3 or more; for the largest run of 80 it is 5 or more. A tenth is always refused, as
     "Done means" 4 requires.
   - **The count.** The worker's read-only count of prod decides whether 2 stands. If the
     95th percentile of on-list stocks within a tenth of a floor, per past run, is 2 or
     less, it stands. If it is 3 or more the fixed number may rise, but never above 4 (5
     of 50 is the tenth that must be refused). If the count says more than 4 is needed,
     the numbers come back to the Planner; the rule is not applied by itself.
     **Counted 2026-11-24** (read-only, run by Giorgio; 144 runs in 24 hours): on-list
     stocks within a tenth of a floor per run, median 0, 95th percentile 1, most 2. So 2
     stands: a run refuses at 3 or more new drops. The worker offered 3 for a margin (2
     is the most seen in the sample). Kept at 2: the count is of stocks NEAR a floor, not
     of stocks that crossed one, so 2 already has margin; and since a held stock is
     dropped on its second reading, a refusal that was not needed costs a few days'
     delay, while a drop that should have been refused is the fault this fix exists for.
   - **The same count found two things outside this fix**, both open (question 3 above):
     a run writes 25 stocks at the median, not the 50 it asks for, so a stock's turn
     comes round in about four days, not two; and 424 stocks are off the list only for
     want of a size.
   - **A held stock moves on in the queue.** The proposal left a held stock with no write
     at all, so that it would be tried again in ten minutes. Read against the code that
     jams the refresh: a run takes the stocks with the oldest `enriched_at` first
     (`batch.ts`, the stalest-first query), so a stock that is never written stays at the
     front and is in every run from then on. Three held stocks would then put every later
     run over the limit, every later drop would join them, and once the held stocks
     filled a run the refresh would stop for every stock (the file's own header warns of
     this: the cursor "would spin on the same dead symbols forever"). So a held stock
     gets its place in the queue moved on and the time it was held written down, and
     nothing else: its size, price and place on the list stay as they were.
   - **It fixes itself on the second reading.** The stock's turn comes round again by
     itself (two to four days later at the pace measured on 2026-11-24). If the fresh numbers put it back over the floors, the mark is
     cleared and nothing was ever dropped: that was our data. If they still put it under
     a floor, it is dropped then: that is news about the stock. This is the automatic fix
     his rule asks for; nobody has to look.
   - **A daily limit, not a quiet day** (CORRECTED 2026-11-24; the first version of this
     point was the Planner's and was wrong). The first version let a second reading drop
     a stock only if no stock had been held in the past 24 hours, and gave a stock held
     again a fresh mark. The worker found that two groups held within a day of each
     other can then keep each other held for good. It is wider than that: any set of
     held groups with less than a day between each of them, round the whole queue, holds
     itself for ever, since every return finds a fresh mark. That is a refusal with no
     way back, the fault this plan exists to remove. Neither of the worker's two repairs
     (a shorter window; leaving a group's own marks out) closes it. The rule is now:
     - The mark is the time the stock was FIRST held. It is not refreshed.
     - A second reading can drop a stock only when the mark is at least 24 hours old,
       so it is never the same day's numbers.
     - A run that is itself refusing new drops applies no second-reading drops either.
     - **At most 20 stocks leave the list in any 24 hours**, counting every kind of drop.
       A drop past that is held and comes round again. This needs the time each drop was
       applied, kept in a column of its own (not the held-at mark doing two jobs). That
       time is never cleared: it means "when this stock last left the list". (The
       Planner first wrote "cleared when the stock is back"; the worker showed that a
       fault which drops a stock and returns it a turn later would then be missed by the
       count, so far more than 20 could leave in a day.)
     - Only a drop has to wait for a mark 24 hours old. A held stock whose numbers pass
       is cleared at once, however young the mark: that decides nothing against it.
     - If the count of the past day's drops cannot be read, the run treats the day's
       limit as used up and says so; the next run tries again.
     - Known and accepted: two runs that overlap can together pass 20 by one run's
       allowance; and a held stock's stored price and size do not move while it is held
       (buys and claims use the live price, so only the stored figures lag).
     - What it gives: no held group depends on another, so nothing can lock. A fault that
       lasts for days cannot empty the list: the most that can leave is 20 a day, each
       day's holds are reported, and a stock dropped by bad numbers comes back by itself
       on its next turn once the numbers are right. It also closes a gap the first
       version left open: a fault that drops one or two stocks in every run stayed under
       the per-run limit and was never refused.
     - Why 20: stocks near a floor come up about 20 times a day in the count of
       2026-11-24, and few of those cross it. The run's line reports how many drops were
       applied in the past 24 hours, so the number is set from data after the deploy.
   - **A stock held before does not count as a new drop**, so a group that comes round
     together for its second reading is not refused for being a group.
   - **Order of writes.** The run works out every stock's verdict before it writes any
     drop. A run that is cut off part way has written no drop and no mark; those stocks
     are simply judged again.
   - **How it reports.** The cron's answer is already sent before the run starts, so the
     failure is the run's own line on the error stream, with `ok` false, the reason and
     the held stocks, and still carrying the run's other counts. The record that lasts is
     one row in the log of repairs (fix 4). A second reading that clears or drops writes
     no row; a held stock held again does.
   - **A known industry is kept too**, by the same rule as the size: an "ok" answer
     without one does not wipe it. The industry decides the stock's categories, and so
     which slot it can fill.
   - **Tests, beyond "Done means" 3 and 4:** a run of 50 with 3 drops writes none of the
     three and applies the other 47; the three are not in the next run; on their next
     turn with good numbers the marks clear and nothing left the list; on their next turn
     with the same numbers all three are dropped; two groups held twelve hours apart
     both drop on their second reading; a stock that comes round again inside 24 hours
     keeps its mark and is not dropped; with 20 drops applied in the past 24 hours a
     further drop, new or held before, is held and reported; with every run failing for
     two full turns of the queue no more than 20 leave in any 24 hours; a stock dropped
     by bad numbers is back on the list on its next turn with good ones, and still
     counts toward that day's 20; a stock held an hour ago whose numbers now pass is
     cleared; with the day's count unreadable no drop is applied; a single drop
     on an ordinary day is applied at once; a run cut off before its end leaves no drop
     and no mark.
