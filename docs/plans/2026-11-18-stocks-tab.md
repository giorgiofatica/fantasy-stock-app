# The Stocks tab, part 1: the list of stocks you can get

Status: Part 1 Approved (Giorgio, 2026-11-18: "part 1 approved") and built: the server read is merged (#542) and applied (2026-11-19), with no price columns (the accurate-prices rule, #533); the layout is decided (Giorgio, 2026-11-18: "A+C" on the board `design/stocks-list-1118`; the ruling is on `main` via #536); Part 2 (the screen) is Approved (Giorgio, 2026-11-18: "part 2 approved", the Planner's relay; the approval line is on `main` via #538) and Building: it is merged (#563, 2026-11-19) and in NO build, so nothing has been seen on a phone; Part 3 (the watchlist, claims and top movers) is Approved (Giorgio, 2026-11-22: "Yeah, that plan looks good. Let's implement it.") and not built
Planner session: "Planner" (Fable 5.2), 2026-11-18 · Orchestrator hand-off: 5021a5bb

**Revised 2026-11-18, the same day, after a later ruling.** Giorgio: "we can't be showing a
stock price that is a day old... it needs to show an accurate representation of what that
price is." The list no longer returns the stored price, which can be up to about two
trading days old. Rows get their price from the same live lookup the stock sheet uses.
Changed below: decision 6, "What a row returns", the stale-price risk, and Done means.

This is the revision of decision 12 of
[`2026-10-08-trading-window-and-watchlist.md`](2026-10-08-trading-window-and-watchlist.md)
(where search and the watchlist live). Everything else in that plan stands: search any time,
the per-league watchlist, daily claims, the waiver order. This file covers the tab itself
and, in this part, only the data behind its list.

## Goal

Today the only way to find a stock is to open "Buy a stock" from Portfolio and type a name
you already know. Managers get a fifth tab, **Stocks**, that opens on a list of the stocks
they can actually get in their league, the way a fantasy app's Players screen opens on the
available players. Part 1 builds the server side of that list, so the screen can be built
as soon as its layout is settled.

## Giorgio's rules

All typed in the Planner's chat unless noted, and all in `docs/PRODUCT_RULES.md` ("Stock
search gets its own tab").

- 2026-11-16: "right now, the only place to look up a stock is when you go to buy a stock...
  a discover page where I can go and search up stocks and then add them to a watch list".
  Picked B: search, the watchlist and browsing in a tab of their own.
- 2026-11-18: "the buy stock should live in that new tab. I think if I go to my portfolio and
  I click on on a stock that I own, I still have the option to do the selling from there."
- 2026-11-18: "For me to drop a player, I do that from my own roster, which would be like the
  portfolio here. So the selling aspect isn't really going to be too heavily involved in this
  part. It's more going to be the buying and seeing what's available."
- 2026-11-18, on the name: "Let's do C, option C, stocks... let's not do trade."
- 2026-10-08, the rule this plan makes one exception to: "I don't want people to be able to
  scrape anything".

## Decisions

| # | Question | Decision | Board section / date |
|---|---|---|---|
| 1 | Where the tab sits | Fifth, last on the right; the other four do not move | A/B mockup, 2026-11-18, "A" |
| 2 | Its name | "Stocks" | Three-way mockup, 2026-11-18, "C" |
| 3 | Where buying lives | In the Stocks tab. "Buy a stock" leaves Portfolio. Selling stays on a holding's card | His words, 2026-11-18 |
| 4 | What the tab opens on | A list of stocks, which search narrows; not an empty search field | A/B mockup after the research, 2026-11-18, "A" |
| 5 | Which stocks are in the list | Only stocks nobody in the league owns. An owned stock is still found by searching | Same mockup, "A" |
| 6 | What a row carries | The stock's price ("A"). Revised the same day: the price is a current one from the live lookup, never the stored one. The list itself returns no price, so the exception to "nothing scrapable" shrinks to names and categories | A/B mockup, 2026-11-18, "A"; his later ruling on old prices |
| 7 | The order it opens in | Largest companies first; the size figure orders the list and is never shown | A/B mockup, 2026-11-18, "A" |
| 8 | The action on a row | A round plus at the row's left edge; it opens the review, never a one-tap trade; teal while the market is open, brown after the close | Board `design/stocks-list-1118` (#534), 2026-11-18, "A+C" |
| 9 | Where search sits | The first icon in the chip row; tapping it swaps the row for a field with Cancel and a plain results list | Same board, "A+C" |
| 10 | The filter chips | "All" (new copy, approved with the pick), then our categories, scrolling sideways | Same board |

## Open questions

None blocks part 1. Open for the later parts:

- ~~The layout of the list.~~ Decided 2026-11-18 from his ESPN recording (decisions 8 to 10).
  Still open inside it: whether a manager can re-sort the list.
- **The tab's icon** (the Design Lead's; the board draws a magnifying glass).
- **Any trending or "most added" list.** "Most added" needs our own cross-league counts;
  movers need live prices and wait on the price-supplier decision.
- **Where the watchlist and claims sit on this screen.** Their rules are approved in the
  October plan; their place is part of the layout.

## Scope

In (part 1): one server read that returns a page of the league's available stocks, its
limits, and its tests.

Out, and why:

- The screen, the tab bar change, and taking "Buy a stock" off Portfolio: they wait for the
  layout. Nothing a manager can see changes in part 1.
- Typed search: it stays on the existing `symbols-search` function, which already finds any
  stock, owned or not, under its own limits.
- The watchlist, claims and the waiver order: the October plan.
- Any change to what the app may read from the `symbols` table directly. That stays as the
  2026-11-16 lockdown left it: `symbol`, `name`, `is_draftable` only.

## How it works

**From the manager's side (once the screen exists).** Open Stocks: the list shows the
biggest companies nobody in the league holds, each with its price. Scroll for more. Pick a
category to narrow it. Type to search instead. Tap a stock to open its sheet, where the
price shown is the price a buy would fill at (#514), and buy.

**From the system's side.** One new read, in the pattern of the three reader functions that
replaced direct `symbols` reads (`supabase/migrations/20261205000300_symbols_readers_functions.sql`):

1. **Who may call it.** A signed-in member of the league it asks about, checked inside the
   function (`auth.uid()` and `is_member`). Everyone else gets nothing: not an empty list
   that looks like "no stocks", a refusal the app can tell apart.
2. **Which stocks.** `is_draftable` stocks with a stored price, minus every stock any
   manager in that league currently holds. "Currently holds" is the net of draft picks and
   trades, per stock, greater than zero: a stock bought and then sold is available again. The
   two tables type the manager id and the quantity differently (`CLAUDE.md`, "Cross-table
   position queries need explicit casts"). "Draftable" is what the app already calls "this league's list": a stock that fails
   it shows "Not in this league's list" in search today, and is simply absent here.
3. **What a row returns.** Ticker, name and the stock's category. No price, and not the
   company-size figure, the industry, or anything else from the table. The screen asks the
   existing live price lookup for the prices of the rows it is showing (at most 25), under
   that lookup's own per-person limits. So a row shows the same price, from the same
   source, that the stock's sheet shows when it is opened.
4. **Order.** Company size, largest first, with the ticker as the tie-break so the order is
   stable. Stocks with no size figure come last.
5. **Category filter.** Optional, one of our categories (`supabase/seed/categories.json`),
   resolved the way the server already resolves a stock's category
   (`supabase/functions/_shared/category-eligibility.ts`: a curated override first, then the
   industry rule).
6. **Paging.** By position in that order ("after this size and ticker"), not by page number,
   so a page cannot be skipped to. The page size is capped on the server at 25 whatever the
   app asks for. Each answer says whether more follow (it fetches one extra row to know); it
   gives no total count, which would tell a caller the size of what they have not paged.
7. **Pacing and the record.** Per signed-in person, across all their leagues, using the
   existing limiter (`check_and_bump_rate_limit`): a per-minute limit that normal scrolling
   never meets, an hourly limit, and a daily one. The daily counter is the record of who
   read how much. Starting numbers for the builder to confirm against real scrolling: 20
   pages a minute, 120 an hour, 600 a day. At those limits, walking all of about 14,750
   stocks takes one account roughly a day, and shows up in the counters.
8. **Grants.** `SECURITY DEFINER` with `search_path` pinned; execute revoked from `public`,
   `anon`, `authenticated` and `service_role` by name, then granted to `authenticated`
   only, verified with the `proacl` query (`CLAUDE.md`, "Postgres function grants").

A database function is proposed over an edge function because the work is one query (the
anti-join on holdings) and the limiter and the membership check already exist in SQL. The
builder may argue for an edge function if the category resolution cannot be done in SQL
without duplicating the rules; that is the one design point left to them.

## Risks and edge cases

- **This re-opens, on purpose and narrowly, what the 2026-11-16 lockdown closed.** The test
  of "narrow" is in Done means: member-only, capped, paced, counted, three fields plus a
  category. A reviewer should read this plan next to the S1 finding in
  `docs/security/2026-11-13-brief-security-check.md`.
- **Partial state.** A stock with trades but no draft row, or a draft row and a later full
  sale, must be judged by its net quantity, per stock, never by "does any row exist"
  (`CLAUDE.md`, the all-or-nothing family).
- **Old prices.** The stored `last_price` can be up to about two trading days old, so it is
  never shown (his ruling, 2026-11-18); it is used only to decide that a stock is draftable.
  The live lookup is better but not yet enough: on the current feed a rarely traded stock's
  newest real trade can itself be a day old. That gap is the price-supplier decision and is
  not something this plan can close; the list must not hide it with a stand-in. A row whose
  live price has not arrived shows the app's "–", never a number from somewhere else.
- **The order shifting between pages.** Company sizes refresh in the background, so a stock
  can move while someone scrolls and appear twice or be missed. The app drops repeats by
  ticker; a missed stock is found by search. Acceptable for a browse list.
- **Ownership changing between pages.** A stock listed a moment ago can be bought by another
  manager. The buy path already refuses an owned stock on the server; the list is a guide,
  not a reservation (`docs/design/FANTASY_CONVENTIONS.md`, "A list is not a reservation").
- **Leagues before the draft, and finished leagues.** Before the draft nobody owns anything:
  the list is the draftable universe. In a finished season there is no buying (2026-11-18);
  the function still answers a member, and the screen decides what to show.
- **Licensing.** Prices on the rows come from the live lookup the app already uses. The company-size figure comes from the second supplier and is used only to
  order, never returned. Neither changes the open price-supplier question.

## Done means

- A member gets a page of at most 25 rows, largest first, none of them owned by anyone in
  that league, each with ticker, name and category, and a "more follow" flag. No price
  field is returned, shown by test.
- A stock bought and fully sold in the league is listed again; a stock held by any manager
  is not, whichever of draft or trade put it there.
- A signed-in non-member, and a signed-out caller, are refused, in tests that run the real
  migration (PGlite), and the function's grants are checked from `proacl`, not assumed.
- Asking for 1,000 rows returns 25. The limiter refuses past each limit and the daily counter
  shows the reads.
- The category filter returns only that category's stocks, with the same answer the server's
  existing category resolution gives.
- Nothing else about `symbols` is readable that was not before: the column grant is
  unchanged, shown by test.
- The architecture map is regenerated and current.
- By hand, with Giorgio: after `db push`, one read-only check that an account outside a
  league is refused and a member gets rows; recorded in `STATUS.md` by the Recorder.

## Part 2: the screen

Status of this part: Approved (Giorgio, 2026-11-18: "part 2 approved"). It is what a
manager sees; it depends on part 1's read.

**In.**
- A fifth tab, "Stocks", last in the bar, in every league phase where the other tabs show.
- The list as board `design/stocks-list-1118` draws it (A + C): the league pill; a row of
  controls (search icon, then the chips "All" and our categories); rows of logo, ticker,
  "name · category", price, with the plus at the left edge.
- Prices on the rows from the existing live lookup, for the rows on screen only; a row
  whose price has not arrived shows "–".
- More rows load as the manager scrolls, 25 at a time, until the server says no more follow.
- A chip narrows the list to that category.
- Search: the icon swaps the control row for a field and Cancel; results are the existing
  search's, with price. A result somebody owns says so with the existing words ("You own
  this", "Owned by {name}"), and "Not in this league's list" stays as it is.
- The plus opens the stock's existing sheet straight into its existing buy review (Buy
  selected, the review shown). A tap on the row opens the same sheet to look, with nothing
  selected. No buy happens without the review. (Wording corrected 2026-11-18: this bullet
  first read as if the plus and a row tap did the same thing. What he was told when he
  picked A was "Tapping it opens the review screen; it never buys in one tap", against a
  row tap "which opens the stock's page".)
- "Buy a stock" comes off Portfolio. A holding's card keeps Sell.

**Out, and why.**
- The star and the watchlist, and claims after the close: the October plan, not built. Until
  they are, the star is not drawn, and after the close the plus opens the stock's sheet,
  which already says "Market's closed. Opens {day} {time} ET."
- "Trending and recommended": no data for it yet.
- A filters sheet (ESPN's Availability, Playing, Pro Team): nothing of ours maps to it yet.
- Re-sorting the list: not decided.

**States the Design Lead specs from existing copy, shown to Giorgio only if one needs new
words or a look of its own:** before the draft (the list is browsable; buying is not open);
during a draft; a finished season (no buying, 2026-11-18); a full roster or no free slot
(the existing reason on the sheet); the list still loading; the list failing to load; a
category with no stocks left; the largest text size.

**Done means, for this part.**
- On a phone, in a matchup league mid-season: Stocks is the fifth tab; the list opens with
  large companies nobody in the league owns; each shows a current price; a category chip
  narrows it; scrolling loads more; the plus opens the review and a buy completes as it does
  today from search; the bought stock is gone from the list afterwards.
- A tap on a row opens the stock's sheet without the review; the plus opens it with the
  review showing.
- Before the draft, the sheet shows a disabled "Review buy" with the existing "Trading opens
  after the draft." (the Design Lead's spec, existing words), not a review the server then
  refuses.
- A stock another manager owns is not in the list and is found by search, marked.
- Portfolio no longer shows "Buy a stock"; tapping a holding still offers Sell.
- After the close the plus opens the sheet with the existing closed-market line; nothing
  claims.
- In a finished league nothing on the tab can start a buy.
- Giorgio walks it on a build at his text size; the Design Lead gates it at L and AX5.

**Workstreams.** Mobile, on Sonnet, after part 1 is merged and applied; the Design Lead
specs the states above first.

## Suggested workstreams

1. **Backend (this part):** the migration, its PGlite tests, the map. One worker.
2. **Design (blocked on screenshots):** the list's layout, modelled on the three apps, as a
   board for Giorgio.
3. **Mobile (blocked on 2):** the tab, the list, "Buy a stock" off Portfolio.

## Models

| Role / workstream | Model | Why |
|---|---|---|
| Backend read path | Opus, with a `security-reviewer` and a `supabase-reviewer` pass | A new `SECURITY DEFINER` read over a locked table, grants, and a partial-state query |
| Design | Design Lead's default | Layout from references |
| Mobile | Sonnet | UI over an existing sheet and search |

## Part 3: the watchlist, claims and top movers

Status of this part: Approved (Giorgio, 2026-11-22, typed in the Planner's chat after the
summary of this part: "Yeah, that plan looks good. Let's implement it."). Not built.
Approving the plan is not approval of any prod step; each push and deploy is his when it
comes.

### Why this part exists

Giorgio, 2026-11-22: "I don't want to just throw in a stocks tab that's like halfway done...
I would actually want to get those four elements in the build. And then from there, we do
the build and then we do the upgrade." The four elements were the star and the watchlist,
claims after the close, trending lists, and re-sorting. The order is his: these, then build
18, then the Expo upgrade.

### Decisions

| # | Question | Decision | Date |
|---|---|---|---|
| 1 | The watchlist and claims: what they are and how they work | The October plan, as approved, [`2026-10-08-trading-window-and-watchlist.md`](2026-10-08-trading-window-and-watchlist.md): its decisions 1 to 11 and 13 stand | 2026-10-09 |
| 2 | Where they live | A switch at the top of the tab: Available, Watching, Claims. A star on every stock row. Replaces the October plan's decision 12 | 2026-11-22, "B" |
| 3 | Trending | Today's top movers | 2026-11-22, "B" |
| 4 | Where top movers get their numbers | From the current source, with no supplier: "Rank only a defined set, for example the 500 largest companies"; "Skip any stock whose latest trade is too old, so a stale number can never rank"; "Refresh every few minutes while the market is open" | 2026-11-22, "this works" |
| 5 | Re-sorting | None. Largest companies first, only | 2026-11-22, "B" |

### What changes from the October plan

The October plan was written before the tab, before the accurate-prices rule and before the
`symbols` lockdown. Everything in it stands except these:

| October plan | Now | Why |
|---|---|---|
| The watchlist is a tab inside "Buy a stock" plus a "Watching" section on Portfolio | The Watching view of the Stocks tab. No Portfolio section (the Planner's reading of his 2026-11-16 pick, "the watchlist... in a tab of their own") | Decision 2 |
| Claim sits where Buy sits, in "Buy a stock" | The same rule on the tab: while the market is closed, the plus and the sheet's main button open the claim, not the buy | "Buy a stock" is gone (part 2) |
| The watchlist read joins `symbols.last_price` and shows price and day change from it | The read returns the saved stocks with name and category and NO price. Each row gets its price and today's change from the live lookup, as the Stocks list does | "A price shown to a manager is the stock's current price" (2026-11-18); `symbols` is readable only through reader functions since `20261206000000` |
| The run reads "the quote source `record-trade` uses" | The one shared price chain (`_shared/alpaca-price.ts`: trade, then bar, then a sane midpoint, then the last daily close; never a lone bid or ask) | The week-start ask-price bug (2026-11-17) |
| Claims need a completed draft | And an unfinished season: no claim is placed or filled once the season is over by date | "A finished season is closed to buying and selling" (2026-11-18) |
| Migration ranges 20261117 and 20261119 | The Orchestrator assigns new ranges after `20261208000000` | Those ranges are in the past |

Unchanged and worth restating, because the build rests on them: claims are blind (RLS, not
UI); one claim per stock per manager and at most 5 pending; 50 saved stocks per manager per
league; the run happens at the open, before live trading, one transaction per league with a
row that makes a retry safe; every trade goes through `public."record_trade_atomic"`; the
hold on live trading is per league and lifts by itself after 10 minutes.

### Top movers: how it works

**The set.** The 500 largest companies by `symbols.market_cap` among stocks that are active,
draftable and priced. 4,400 of the 10,472 draftable stocks carry a size (his read-only count,
2026-11-22). The other 6,072 can never rank, and say so wherever the list is described.

**The job.** A scheduled job, every 5 minutes while the market is open (driven by
`market_calendar`, not a fixed clock), on the pattern of the other cron functions: the cron
key guard, `runJob` so every exit writes a terminal status, an explicit `pg_net` timeout, and
an immediate 202 with the work in the background so it never holds the queue for the other
jobs (the 2026-11-11 lesson). It asks the current source for the snapshot of each stock in
the set, in batches, and for each works out today's change with the same chain `quote` uses:
the current price against the previous session's close.

**The freshness check.** A stock whose latest trade is older than 15 minutes is left out of
the ranking for that run. (The Planner's number, inside his "too old"; easy to change.)
A stock whose snapshot has no latest trade, or no previous close, is left out in the same
way: a missing figure never ranks. The source's reference does not mark either field as
always present, and it sees about 2.5% of market volume (the Researcher, 2026-11-22).

**The ranking is written whole or not at all.** If any batch fails, or fewer than 90% of the
set came back with a fresh trade, the run keeps the previous ranking and reports itself
partial. A ranking drawn from a subset is never published as the market's (CLAUDE.md,
"all-or-nothing": the verdict's scope must match the evidence's).

**What is stored.** The ranked symbols with the time of the ranking, the 100 biggest moves
either way. No price is read back from this table for display.

**What the tab shows.** The "Top movers" chip sits under Available, so it lists movers that
nobody in this league owns, up to 25 rows, biggest move first whether up or down. A reader
function for signed-in league members returns the ordered symbols with name and category
(nothing scrapable: no anonymous access, no price). Each row then takes its price and
"+11.2% today" from the live lookup, so the order can be a few minutes old and the numbers
are current.

**When the ranking is old.** While the market is open, a ranking more than 20 minutes old is
not shown as current: the chip's list shows the existing "didn't load" state. While the
market is closed, the list shows the last session's ranking; whether it needs a line saying
so is the Design Lead's board (new words go to Giorgio).

**With a supplier later.** The set widens to every stock and nothing on the screen changes.
Nobody contacts a supplier for this (his 2026-11-19 words stand).

### Scope

In: the watchlist (table, RLS, the save write, the read, the star, the Watching view); claims
(the October plan's tables, the place and cancel writes, the run at the open, the hold on
live trading, the waiver order and its weekly reset, the three notifications, the composer,
the Claims view); top movers (the job, its table and read, the chip).

Out: re-sorting (decision 5). A price supplier. Price alerts. A "Watching" section on
Portfolio. Ranked fallback claims. Anything on the web app.

### Open, and who settles it

1. ANSWERED 2026-11-22: the Design Lead's board `#call-stocks-tab-lists` is drawn, and he
   approved its seven new words ("yes to all the words"; the list is in
   `docs/PRODUCT_RULES.md`). The client workstreams build from that board.
2. ANSWERED 2026-11-22 (the Researcher; read through a summary, so no wording is quoted
   here): the source documents no limit on stocks per snapshot call, so the job keeps our
   own batch of 50 (ten calls per refresh for 500 stocks) and claims no documented number.
   The one documented rate is 200 calls a minute on the Basic plan; whether snapshot calls
   count under it is not stated. Two calls a minute is far below it, and the job logs the
   rate-limit headers the source returns and treats a refusal as a failed batch.
3. ANSWERED 2026-11-22 by the board (the Design Lead's ruling, drawn and explained, not a
   pick): the waiver order is the first row of Claims, the whole order on a tap.

### Settled during the build

From the watchlist's server work (#595, reported 2026-11-23). These are the Planner's
readings, each checked against the code. None changes an approved look or an approved word.

1. **"No longer tradable" means the buy would be refused.** The watchlist read returns
   `is_draftable`, because the app cannot read `symbols.active` since `20261206000000`. The
   app shows the line when `is_draftable` is false AND the league has not turned on "Allow
   non-draftable stocks (full universe)" (`leagues.allow_undraftable`). That is the test
   the buy path itself applies (`_shared/draft-validation.ts`, reason `not_draftable`), so
   the line and the refusal can never disagree.
   - The line therefore also appears for a stock that fell under the size or price floor,
     not only for a delisted one. In the app that stock cannot be bought, which is what the
     line says.
   - In a full-universe league the flag alone never shows the line. A delisted stock there
     reads as a price that did not load.
   - When two statuses apply, who owns it comes first ("You own this", "Owned by {name}"),
     because a holder can always sell; "No longer tradable" comes next; the slot lines come
     last.
   - The claims run (workstream 6) fails a claim as no longer tradable by the same test as
     the buy path, not by `active` alone.
2. **A watchlist is personal.** A hidden or deleted seat cannot save. Reading and removing
   your own saved stocks needs only membership. Taking over a team does not hand over the
   former manager's saved stocks; the new manager starts with none.
3. **New saves are paced** (the security review: saving, reading back and removing in a
   loop would disclose any stock's category). 30 a minute, 200 an hour, 500 a day, per
   person across all their leagues; the refusal is `rate_limited`. It gets no words of its
   own: the app treats it as any save that did not go through. If the board draws nothing
   for a save that did not go through, workstream 3 stops and reports, and the words go to
   Giorgio.

### Risks

- **This is the largest change to trading since the draft.** The claims run and the hold
  touch `record-trade`, `finalize_league_draft` and `process-week-results`. Each is
  re-created from `main`'s current body and only added to. None of it is deployed on a
  Friday afternoon, when the week is scored.
- **A dead claims job must never close a league's trading.** The hold lifts by itself; the
  job reports `failed`; a late run fails only the claims that live trades made impossible.
- **A wrong top mover.** Guarded by the set, the freshness check and the whole-or-nothing
  ranking. A stock that ranks still shows only live numbers.
- **Testing the run for real** needs a market open and two managers claiming the same stock.
  It is a phone-pass step with the test accounts, not something a unit test can stand in for.
- **Size.** Three database pushes and at least four function deploys, in an order. Build 18
  waits for all of it.

### Workstreams, in order

Each server workstream ends with Giorgio's prod steps and a check by data before the next
starts. At most about four pull requests open at a time.

| # | Workstream | Model | His steps after it |
|---|---|---|---|
| 1 | The board (Design Lead) | Design Lead | A pick, and a yes on new words |
| 2 | Watchlist, server | Opus, with the security and Supabase reviewers | `db push` |
| 3 | Watchlist, app (the switch, the star, Watching) | Sonnet | none |
| 4 | Top movers, server | Opus | `db push`, one deploy, then a look at the ranking by data |
| 5 | Top movers, app (the chip) | Sonnet | none |
| 6 | Claims, server (tables, writes, the run, the hold, the order and its reset, notifications) | Opus, with both reviewers | `db push`, then deploys of `claims-run`, `record-trade` and `process-week-results`, each byte-verified |
| 7 | Claims, app (the composer, Claims, the endings) | Sonnet | none |

Then build 18, the phone pass on it, and the Expo upgrade.

### Done means

1. Every "Done means" of the October plan, read against the table of changes above.
2. On a phone: the switch shows Available, Watching and Claims; a star saves a stock for this
   league only; Watching lists it with a current price; the watchlist of another league is
   separate.
3. After the close, the plus opens a claim; the claim shows under Claims and can be
   cancelled; at the next open it fills, loses or fails with its reason, and a notification
   says which.
4. Two test managers claim the same stock: the one earlier in the waiver order gets it, and
   moves to the back.
5. Top movers lists only stocks nobody in the league owns, each with a current price and
   today's change; with the job stopped, the list says it did not load and does not show an
   old ranking as current.
6. By data, after each server step: the tables and grants exist as designed (`proacl`, not
   the migration's word); the claims run wrote a row for the day; the ranking's time is
   within the last few minutes while the market is open.
