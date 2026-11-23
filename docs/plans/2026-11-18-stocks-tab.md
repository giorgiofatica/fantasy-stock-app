# The Stocks tab, part 1: the list of stocks you can get

Status: Part 1 Approved (Giorgio, 2026-11-18: "part 1 approved") and built: the server read is merged (#542) and applied (2026-11-19), with no price columns (the accurate-prices rule, #533); the layout is decided (Giorgio, 2026-11-18: "A+C" on the board `design/stocks-list-1118`; the ruling is on `main` via #536); Part 2 (the screen) is Approved (Giorgio, 2026-11-18: "part 2 approved", the Planner's relay; the approval line is on `main` via #538) and Building: it is merged (#563, 2026-11-19) and in NO build, so nothing has been seen on a phone; Part 3 (the watchlist, claims and top movers) is Approved (Giorgio, 2026-11-22: "Yeah, that plan looks good. Let's implement it.") and Building: its step 2, the watchlist server (#595), is merged and applied (migration `20261209000000`, 2026-11-23, checked by data); the db-snapshot is re-captured (#598); the `record-trade` list preview is merged and deployed (#600, 2026-11-23, byte-verified; its effect check waits for the build 18 phone pass); the Top movers server is merged, applied and deployed (#602, 2026-11-23; its first ranking was written, seen by data); the watchlist app is merged (#601, 2026-11-23) and in NO build; point 7's preview gate and pacing are merged and deployed (#604, `record-trade` at `5a1360e4`, byte-verified; effect checks at the phone pass); option A's server change is merged and applied (#606, `20261210500000`, 2026-11-23; checked by data); the claims server and run (#608) are built and open (not merged, not applied, not deployed), the claim notifications and the screens are NOT built, and the Top movers chip (#607) is a draft (the Orchestrator's account); the claims run is part of #608 (built, open); no build carries any of it
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
   - ANSWERED 2026-11-23 (`docs/PRODUCT_RULES.md`, "ok then b"): the WORDS of this line on
     Watching are "Not in this league's list", search's line, not "No longer tradable".
     The test above is unchanged. On the stock's own screen the Design Lead's ruling
     stands: the buy's sentence above a disabled "Review buy" (and a disabled Claim while
     the market is closed).
2. **A watchlist is personal.** A hidden or deleted seat cannot save. Reading and removing
   your own saved stocks needs only membership. Taking over a team does not hand over the
   former manager's saved stocks; the new manager starts with none.
3. **New saves are paced** (the security review: saving, reading back and removing in a
   loop would disclose any stock's category). 30 a minute, 200 an hour, 500 a day, per
   person across all their leagues; the refusal is `rate_limited`. It gets no words of its
   own: the app treats it as any save that did not go through. If the board draws nothing
   for a save that did not go through, workstream 3 stops and reports, and the words go to
   Giorgio.

From the watchlist's app work (workstream 3, reported 2026-11-23):

4. **The slot lines on Watching come from the server, in one call for the screen.** The
   board's lines ("Available · fits your $100–$200 slot", "No free $400+ slot") need the
   answer to "would a buy of this stock, at this price, take one of my slots?". The app
   never works that out itself (`apps/mobile/lib/money/tierContract.ts`). The server
   already answers it for one stock at a time (`record-trade`'s `preview`, `would_fill`,
   from the same `decideBuySlot` a real buy runs), but that call is paced at 30 a minute,
   so one call per row is ruled out. The watchlist read cannot answer it either: it holds
   no price, by rule. So the preview learns to answer for a list:
   - One call per screen of rows, never one per row. The app sends each stock with the
     price that row is showing, as the single preview does today, so the line and the
     price on the same row cannot disagree.
   - It runs the buy's own function. No second copy of the rule, on the server or in the
     app.
   - It answers only for stocks on the caller's own watchlist in that league. Otherwise a
     list call would hand out the category fit of any 50 stocks at a time, which is the
     disclosure the save pacing (point 3) exists to stop. The security reviewer reads it.
   - The answer stays advisory, as today: the buy checks again at the live price.
   - A row with no answer (a league with no slots; a price that didn't load) reads plain
     "Available". That is a cut of an approved line; it goes in the next copy summary for
     Giorgio to strike if he disagrees.
   - It is `record-trade` code, not a migration, and ships with a `record-trade` deploy
     (workstream 6 already has one). It is in before build 18.
   - Until then workstream 3 may merge with the lines it can already word (who owns it,
     "No longer tradable", plain "Available", "No free slot"), behind one function. That
     is a build order, not a look: it never goes into a build. The approved board stands
     in full.
5. **No star on search results yet.** His pick ("Every stock row carries a star at its right
   edge", 2026-11-22) was made on drawings of the lists under the switch. Search results
   were not drawn, and they have rows the lists do not (a stock someone owns; "Not in this
   league's list"). A pick covers the screens it was shown on, so workstream 3 builds no
   star there. A stock found by search is saved from its sheet, which the board does draw.
   The Design Lead draws the search rows with a star, and that drawing goes to Giorgio as a
   yes or no before build 18.
   ANSWERED 2026-11-23 (`docs/PRODUCT_RULES.md`): a star on a free stock, on "Owned by
   {name}" and on "No free slot"; none on "You own this" or "Not in this league's list".
6. **A stock you own is never on your watchlist** (his rulings, 2026-11-23: "no star for
   something you own. its in your portfolio so shouldnt need to be in the watchlist too",
   then "A": a watched stock you buy leaves the watchlist for good). The watchlist's server
   (`20261209000000`, applied 2026-11-23) was built before this rule and accepts a save of
   a held stock. One small migration brings it in line:
   - **"Holds" is the rule the Stocks list already uses** (`20261207000100`): the net of
     draft picks and trades, per manager and per stock, above the same threshold as
     `leagueOwnedSymbols`. Never "does any row exist". `drafts.user_id` is text and
     `trades.user_id` is uuid, so the casts are needed.
   - **A save of a stock the caller holds is refused**, in the trigger so every insert path
     is covered, and `set_watchlist` answers a reason of its own for it. The app never
     offers that star, so the reason gets no words: it is a save that did not go through.
   - **Coming to own a stock removes it from that manager's watchlist in that league.** It
     is done in the database, on every path that creates a holding (a buy, a claim that
     fills, a draft pick, an auto-pick), not by the app and not inside one function only,
     so a new path cannot forget it. It must never be able to fail a trade or a pick.
   - **A sale removes it too**, if a row is somehow still there. A save and a buy can cross
     in the same instant and leave a watched stock that is also held; without this, that
     row would come back into view after the sale, which is option B, the one he did not
     pick.
   - **The read leaves out a stock the caller holds**, so a row stranded by that same race
     is never shown while it is held. A stranded row still takes one of the 50 places
     until the sale removes it; the write should clear the caller's held rows before it
     counts, so the cap never refuses because of a row nobody can see.
   - **Rows already saved and held are removed by the migration**, with a count taken first
     in the hand-off's read-only checks (the table is one day old).
   - A pending claim does not make a stock held: it stays in Watching as "Claimed · fills
     Mon 9:30 AM ET" until the run. If the claim wins, the trade removes it.
   - The October status line "You own this" on Watching no longer occurs. "Owned by
     {name}" stays.
   - Its own migration and its own small pull request, on Opus with both reviewers (it
     touches the tables every trade writes to). Its timestamp must be later than every
     migration applied when it is pushed, or `db push` refuses it as out of order; the
     Orchestrator picks it. It is pushed before build 18, and can share a push with the top
     movers migration if both are merged by then.
   - Tests: the three ways of coming to own a stock each remove the row; a sale removes a
     stranded row; another manager's saved copy of the same stock is untouched; a save of a
     held stock is refused on both insert paths; a trade still succeeds when there is no
     row to remove.
7. **The single preview answers slot fit only for a stock the buy would accept.** Found by
   the security review of the list preview (#600), and already in production before it:
   `record-trade`'s `preview`, given a `symbol` and a `price`, reads that stock's category
   and answers `would_fill` for ANY stock, with no check that the stock can be bought. In a
   league with category slots that tells a member whether any stock belongs to a category,
   at the function's 30 calls a minute and with no hourly or daily limit. Giorgio's rule is
   "I don't want people to be able to scrape anything" (2026-10-08), so it is closed, not
   accepted:
   - **The preview applies the buy's own gate first.** For a stock the buy would refuse as
     `not_draftable` (not draftable, in a league that has not turned on the full universe),
     the preview answers that same refusal and never reads or returns the category fit.
     One rule, shared with the buy; not a list of "stocks the caller can see".
   - **Why this gate and not "saved or visible".** The stock's sheet opens on stocks that
     are not saved, and the buy must still show its slot line there. What the gate leaves
     answerable is the draftable stocks, whose categories the paced Stocks list already
     returns to any member. What it closes is the rest: the stocks no paced read returns.
   - **A preview that names a stock is paced by the hour and the day as well**, 200 an hour
     and 500 a day per person, the watchlist's own numbers, on counters of its own so a buy
     or a sell is never refused by them. This is for the full-universe league, where every
     stock can be bought and so every stock must be answerable: any member can create one.
     The counter sits beside the read it protects: a preview is counted only when it reads
     a category (a stock is named AND the league has a category slot). The gate above is
     wider on purpose: it applies to every preview that names a stock, so the preview
     always answers as the buy would, in leagues with no slots too.
   - **CORRECTED 2026-11-23: a screen does change, and the app changes with it.** This
     point first said "No screen changes... the app already has the words for both". That
     was the Planner's error, caught by the worker before any code: the words exist, but
     the preview never shows them. The app turns ANY refused preview into "Couldn't reach
     trading. Check your connection and try again." (`recordTrade.ts` returns null unless
     `ok` is true; `StockSheetBody.tsx` words null as `cantReach`). So with the gate alone,
     Buy on a stock that can't be bought would blame the connection.
     - The app maps the preview's `not_draftable` to the sentence the buy already shows
       for it, "{symbol} isn't in this league's list of stocks.", through the same mapper
       the buy uses (`refusals.ts`), so the two cannot drift. It appears before the review,
       where the board already puts a slot refusal. Existing approved words, earlier.
     - Where it can be seen: a race on today's app (a stock stops being draftable between
       the list loading and the tap), and, once Watching ships, the Buy on a row that reads
       "No longer tradable".
     - A paced preview keeps today's wording for now, which is the same connection
       sentence the 30-a-minute refusal already gets. It is wrong, and it is not new. The
       app's one sentence for pacing ("Too many trades in a row. Wait a moment and try
       again.") would be wrong in a different way for an hourly limit, so it is not reused.
       The Design Lead words a paced preview, and those words go to Giorgio.
     - Whether Buy should be offered at all on a stock that can't be bought is a look, so
       it is the Design Lead's to draw and Giorgio's to pick. It does not hold this fix.
     - Order: the app change ships in build 18. The server change may be deployed before
       it: on build 17 the gate is reachable only by the race, and reads as it would today.
   - The list preview (#600) keeps its own rule, saved stocks only, and applies the same
     gate to each stock in the list.
   - The watchlist migration's note on pacing (`20261209000000`) is not rewritten: applied
     migrations are not edited. The claim becomes true when this ships; until then it is
     overstated, and `STATUS.md` says so (the Recorder).
   - It is `record-trade` code and rides the same deploy as #600 if it is ready; if not,
     #600 does not wait for it. Opus, with the security reviewer. Tests: a non-draftable
     stock gets the buy's refusal and no `would_fill`, with the category read not made; the
     same stock in a full-universe league is answered; the 201st named preview in an hour
     is refused while a buy still goes through; a preview with no stock is never counted.
8. **Top movers, the server's readings** (#602, reported 2026-11-23; all four accepted):
   - "The 100 biggest moves either way" is the top 100 by the size of the move, up and down
     in one list. That is what the chip shows: biggest move first, whichever way.
   - The reader's pool is exactly Available's (draftable, priced, owned by nobody in the
     league). A ranked stock that stops being draftable drops out of the read.
   - The read is paced as the Stocks list is (20 a minute, 120 an hour, 600 a day); past a
     limit the chip shows "Stocks didn't load". No new words.
   - **An empty answer shows "Stocks didn't load", with Try again.** The read returns the
     ranking's time on each row, so zero rows carry no time and the app cannot tell "no
     ranking has ever been written" from "this league owns every ranked stock". Both mean
     there is no ranking to show, which is what the plan already says for a ranking that
     is too old. The second cause needs one league to hold every ranked stock that is
     still available, and is accepted as it stands. The first is real once: between the
     deploy and the job's first run. So the hand-off's check by data confirms a ranking
     exists before Giorgio opens the chip.
9. **The claims run, the server's design questions** (workstream 6, its design note,
   2026-11-23; answered from the October plan and his rules, before any of the run is
   written):
   - **"At the opening price" is this session's price, never yesterday's.** The shared
     price chain's first stage is the latest trade with no time limit, so seconds after
     the open a thinly traded stock's "price" can be the previous day's last print. The run
     does not use it. It uses the week-start pricing's rule (`fetchWeekPrices`): today's
     daily bar's open; failing that a trade made since this session opened; failing that a
     sane midpoint from this session; never a lone bid or ask, never a print from before
     the open. The stock bought and the stock sold are both priced this way.
     - What "the open" is: the first price our source shows in the session. Our source
       sees a small share of the market's trades, so this can differ from the exchange's
       official opening print, and a quiet stock may show nothing for a while. That is a
       limit of the current source, known and told to Giorgio.
     - A stock with no price yet holds that league's run until 3 minutes after the open
       (the worker's number, inside the 10-minute hold); then that claim fails with no
       price and the rest proceed. The October plan's "per claim, never per league" stands
       for the outcome; only the wait is shared.
     - A run that comes late in the day still fills at the open, not at the price of the
       moment it happens to run.
   - **If the first claimant cannot take the stock, the next claimant in the order gets
     it.** The October plan's steps named the winner by order first and tried the trade
     second, which would leave the stock with nobody and tell the others "{name} claimed
     AAPL" about a claim that failed. His rule is that the order decides "like fantasy
     football", and there a claim that cannot be completed is passed over. A manager is
     told they lost only to someone who actually got the stock.
   - **A manager moves to the back the moment a claim of theirs fills, inside the same
     run** (his rule: "any successful claim... moves you to the back"). So a second claim
     by the same manager is judged from the back of the order. The run takes, each time,
     the manager nearest the front who still has a claim waiting, and their earliest-placed
     claim. A claim that fails or loses moves nobody.
   - **One sale funds one claim.** `place_claim` refuses a sale that already funds another
     pending claim of the same manager, and the composer does not offer it. Two claims on
     one sale would be "this one, or else that one", which the October plan left out
     ("claims with ranked fallbacks: later if asked"). If that leaves the composer with
     nothing to offer, what it says is the Design Lead's to draw (workstream 7).
   - **Pushes: the rows now, the delivery as its own step, both before build 18.** The
     October plan is approved with "Each is a push". Workstream 6 writes the notification
     rows. Delivering them is a separate small server step after it, so the riskiest deploy
     of this part is not widened. The words of a push are the approved endings; how they
     split into a title and a body is the Design Lead's. Two reasons have no approved
     words yet and go to Giorgio with the claims screens: a claim on a stock that left the
     league's list (the October "AAPL is no longer tradable", overtaken by his 2026-11-23
     pick), and a claim whose day passed without a run.
   - A day that passes with no run fails its claims; they are never carried to another
     day's open (the October plan's open question 2).
   - The run answers the cron at once and works in the background, or finishes in well
     under a second when there is nothing to do: it is called every minute, and a slow
     answer holds every other scheduled job behind it (the 2026-11-11 lesson).
10. **A manager orders their own claims, and two may sell the same stock** (his rulings,
    2026-11-23, in `docs/PRODUCT_RULES.md`; the research is
    `docs/research/2026-11-23-espn-waiver-claim-ordering.md`). Built after the claims
    server (#608) as its own change; #608 does not wait for it.
    - **The order.** Each pending claim has a place in its manager's own list, 1 to 5. A
      new claim goes last. A write sets the whole order at once for the caller's own
      pending claims in one league, and is refused once that day's run has started, as
      cancel is. Cancelling a claim closes the gap.
    - **The run uses it.** Where the run takes "their earliest-placed claim" (point 9), it
      takes the first in the manager's order. Nothing else in the walk changes: the
      manager nearest the front goes next, a filled claim sends them to the back at once,
      a claim that loses or cannot be completed moves nobody and their next one is tried.
    - **One sale, two claims.** Point 9's refusal ('sale_in_use') is removed. At the run, a
      claim whose named sale was already used by an earlier claim of the same manager in
      that run is void: nothing is bought, nothing is sold, the order is unchanged. If the
      earlier claim did not fill, the sale is still theirs and the later claim runs
      normally. In a tier league this is what makes a second choice possible at all, since
      only a sale in the same tier can pay for the buy.
    - **Cash leagues.** Two claims paid from the budget need no rule: each fills if the
      budget still covers it, and the second fails as over budget if it does not.
    - **Unchanged:** one claim per stock per manager; five pending at most.
    - **The app (workstream 7).** The Claims list shows the order and lets the manager
      change it; ESPN's control is a drag. The Design Lead draws it, with what a void claim
      reads, and both go to Giorgio. The Planner's recommendation for the void claim: it
      shows in the Claims list and sends no push, because the manager got their first
      choice and a second message about it is noise.
    - **Tests.** A's first choice is taken by a manager ahead of them and A's second fills
      in the same turn; two claims on one sale, first fills, second void with the sale
      made once; first loses, second fills with that sale; a reorder after the run has
      started is refused; another manager cannot reorder or see the order.

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
