# What do the Players screens and waiver wires of ESPN, Yahoo and Sleeper look like and how do they work?

Asked by: Giorgio on 2026-11-18, via the Planner: "research the players tab and the waiver wire of
ESPN Fantasy Football, Yahoo, Sleeper... and kind of understand how that UI, UX looks like, those
mechanisms, and then we can try to reflect that here." · Researcher session · Model: Sonnet 5.5 ·
Read 2026-11-18. The mechanics (watch list, free agent vs waiver claim, priority, FAAB) are
already in [`../design/FANTASY_CONVENTIONS.md`](../design/FANTASY_CONVENTIONS.md) and aren't redone.

## Short answer

**The official help pages describe the flows well and the screens poorly.** I could confirm, for
all three apps, the add and drop sequence, how waiver players differ from free agents, and the
watch list. I could **not** confirm, from any first-party page, what the mobile Players screen
opens on, how filters are presented (chips, sheet, segmented control), or what one row shows in the
app. Those facts are web-only in the sources, or missing. **Nothing here is from a screenshot or
from using the apps**: I can't open them. Treat the screen-layout parts as a list of what is
known, and use real screenshots (Giorgio's phone or the Design Lead) for the rest. One finding
changes an existing assumption: **Sleeper's watch list is account-wide, ESPN's per-league** (see 9).

## Sources and which season they describe

All read 2026-11-18, all first-party unless marked. The pages are current for the **2026 season**;
dates are the pages' own.

- **ESPN:** support.espn.com "Adding Free Agents" (updated 2026-08-11), "How to add a Free Agent"
  (2026-11-09), "Claim a Player Off Waivers" (2026-11-09), "Fantasy Football Acronyms"
  (2026-08-11); ESPN press release on the 2025 redesign (2025-08-07); ESPN article "Tools of the
  trade: How to use the ESPN fantasy app" (**baseball**, 2026-02-10); ESPN 2025 app-features
  article (2025-08-04).
- **Yahoo:** help.yahoo.com "Add and drop players in the iOS app" and "…Android app" (undated),
  "Welcome to the redesigned Yahoo Fantasy app" (undated), "Overview of Waivers and Free Agents"
  (undated), the web Player List page (football.fantasysports.yahoo.com/f1/101/players, 2026
  season, **web**), "Visual Vitamins" redesign article (2026-08-27).
- **Sleeper:** support.sleeper.com "Watch List vs. Draft Queue" (2026-09-21), "How to view
  Cross-League Ownership" (2026-09-22), "How does FAAB bidding work?" (2026-09-23), "Waivers for
  Regular Season & Playoffs" (2026-09-15); sleeper.com/fantasy-football (the '26 season page).
- **Not first-party** and marked where used: search summaries of third-party developer notes about
  Sleeper's Players page.

## What each app does, question by question

"App" means a mobile app page; "Web" means a desktop page; "?" means not found.

### 1. Where the screen lives

| App | Finding | Source | Fact or inference |
|---|---|---|---|
| ESPN | App: "Click on the Players page" (its position in the bar isn't described). Web: My Team › Players tab › "Add Players" in the dropdown. Bottom-tab labels: **not found** | ESPN "How to add a Free Agent" | Fact |
| Yahoo | A screen inside the league. Android: Fantasy Home › sport › league › **Players** tab. iOS: from the team page tap Players. You swipe left or right between the team, matchup, players and league screens; the team switcher is at the top | Yahoo Android/iOS add-drop pages; redesigned-app page | Fact |
| Sleeper | A **PLAYERS** tab on mobile (confirmed only by the watch-list article). Web uses a checkbox filter | Sleeper "Watch List vs. Draft Queue" | Fact |

### 2. What it opens on, before you type or filter

| App | Finding | Source | Fact or inference |
|---|---|---|---|
| ESPN | **Web:** "All available players, sorted by percentage rostered, from highest to lowest." **App:** not stated. The baseball app article mentions a drop-down menu atop the player list and a "Research" view | ESPN Adding Free Agents; ESPN baseball article | Fact (web); app default not found |
| Yahoo | **?** The web legend lists "All Available Players" and "Free Agents Only" among the Status options, but not which is the default | Yahoo web Player List | Not found |
| Sleeper | **?** Nothing first-party. A third-party developer note describes Sleeper's page as modes "Search / Trend / Available / Leaders" with position chips, but that describes someone's imitation, not Sleeper's own words | Search summary of a developer issue | Not verified |

### 3. The search field

| App | Finding | Source | Fact or inference |
|---|---|---|---|
| ESPN | Web: a **Search field** sits with the position and filter controls on the same Add Players page (it narrows that list) | ESPN Adding Free Agents | Fact (web) |
| Yahoo | App: "search for players or browse available ones" on the Players tab; same screen | Yahoo iOS add-drop page | Fact |
| Sleeper | ? | | Not found |

### 4. Filters and sorts, and how they're presented

| App | What is offered | Presentation | Defaults | Source |
|---|---|---|---|---|
| ESPN (web) | Position; **Search**; filters for **availability, Team, Health, Watchlist**. Sort by columns, including **"+/-"** (most added in the past 7 days among players "still available in your league"; click again for most dropped) and **%ROST** | Web: dropdown plus filters. **App presentation: not found** | Available players, %rostered high to low | ESPN Adding Free Agents; baseball article |
| Yahoo (web) | **Status:** All Players, All Available Players, Available (IR eligible), Free Agents Only, **Waivers Only**, Keepers Only, **My Watch List**, All Taken Players. **Position:** All Offense, QB, RB, WR, TE, W/R/T, K, DEF. NFL Teams; Fantasy Teams; stat time frames (projected weeks, last 4 weeks, season); Reset Filters; clickable column headers; "Next 25 / Previous 25" paging | Web filters. **App presentation: not found** | **?** | Yahoo web Player List |
| Sleeper | Watch List filter (star) on mobile, checkbox on web. Everything else **not found** | **Not found** | **?** | Sleeper watch-list article |

### 5. Anatomy of one row, and what its action is

| App | Row contents | Row action | Source | Fact or inference |
|---|---|---|---|---|
| ESPN | Columns defined on ESPN's acronym page: **%ROST** (percent of teams rostering), **+/-** (change in %rostered), **PRK** (position rank), **PTS** (season points), **PROJ** (projected points for the week), **OPRK** (opponent's rank), **%ST** (percent started); injury codes Q, D, O, IR, SSPD. Whether all of these sit on one mobile row isn't stated. Player Rater columns PR7/PR15/PR30 exist in baseball | **Tap the player**; a green **Add** or yellow **Claim** button appears. Since 2025 "quick-action buttons" on the Players screen "eliminate the need to go to the player card to add a player" | ESPN acronyms; ESPN Adding Free Agents; ESPN press release 2025-08-07 | Fact |
| Yahoo | Web columns: Roster Status, GP, Bye, **Fan Pts**, Pre-Season and Actual rank, **% Ros**, stat columns; status codes D, Q, O, IR | **Add Player icon** on the row (web and app); Drop Player, Propose Trade and Add to Watch List icons exist in the action legend | Yahoo web Player List; iOS add-drop page | Fact |
| Sleeper | Sleeper's page promises "Roster %, and Start %" in its research, but a developer note says its API has no ownership percentage. **Conflict, unresolved.** Row layout not found | A **Waiver icon next to a player** in the Players tab (for FAAB claims); tapping a player card opens the transaction screen | Sleeper FAAB article; cross-league ownership article; sleeper.com | Fact (action); contents unverified |

### 6. How availability and ownership are shown

| App | Finding | Source | Fact or inference |
|---|---|---|---|
| ESPN | **Colour carries the mode:** green = free agent, "immediately available"; yellow = on waivers, "not available until the waiver claims process". Web shows a green or yellow "+". The default list is "all available players", so owned players are **not in it** | ESPN Claim a Player Off Waivers; Adding Free Agents | Fact |
| Yahoo | Taken players are reachable through the **"All Taken Players"** status filter; the Fantasy Teams filter selects an owner. A free agent "will be placed on Waivers when their game for the week is scheduled to begin". How a waiver player is marked on the row: **not found** | Yahoo web Player List | Fact |
| Sleeper | A **waiver icon** marks the claim action. Tapping a player card on mobile shows ownership **across your leagues**, with **Add, Claim, Trade or Drop** prompts. A player locked in a league that hasn't drafted shows "Add" but can't be added | Sleeper cross-league ownership article; FAAB article | Fact |

### 7. Curated or trending lists

| App | Finding | Source | Fact or inference |
|---|---|---|---|
| ESPN | The 2025 redesigned Players screen "shows recommended players to add and trending pickups". Web has a **Trending** tab in the Players › Add Players portal; the **+/-** sort is the same idea | ESPN press release 2025-08-07; baseball article | Fact; where on screen: not stated |
| Yahoo | **Not found** | | Not found |
| Sleeper | Trending adds/drops exist in Sleeper's developer API (past 24 hours). The in-app presentation wasn't confirmed | Sleeper API docs, via search summary | Fact (API); app not found |

### 8. The add flow, from row to done

| App | Steps | What confirms it | Source |
|---|---|---|---|
| ESPN (app) | Players page › **tap the player** › green **Add** (or yellow **Claim**) › if the roster is full you "will be prompted to drop a player": tap **Drop** next to a player (it turns red; several can be chosen) › **Confirm** | A confirmation message. A free-agent add lands on your bench at once; a claim "must wait" until waivers process (about 3:00 AM ET daily) | ESPN How to add a Free Agent; Claim a Player Off Waivers |
| Yahoo (app) | Players tab › **Add Player icon** on the row › "select a player to drop" if needed › **Add & Drop** or **Next** › **Confirm** or **Submit** | The confirm step. A claim differs by league setting: standard waivers freeze a dropped player for a period (2 days default), continuous waivers keep everyone on waivers with a clock. Claims can be **conditional** ("add D, dropping A or B") | Yahoo iOS add-drop page; Overview of Waivers |
| Sleeper | Players tab › **Waiver icon** on the player › a **bid screen** (FAAB: blind, default $0 minimum) › pending claims in **Team › Transactions** (edit a bid, cancel, reorder equal-amount claims) | Outcomes appear in the league's transaction history and league chat; tapping the dollar amount shows every bid. How to choose a drop and how a plain free-agent add works: **not found** | Sleeper FAAB article |

### 9. The watch list on that screen

| App | Finding | Source | Fact or inference |
|---|---|---|---|
| ESPN | Flag a player from the Add Player screen; filter by Watchlist on the same page. Per league (from our conventions file; I didn't re-verify) | FANTASY_CONVENTIONS; ESPN help "Adding/Removing a Player From the Watch List" (not re-read) | Fact (existing doc) |
| Yahoo | "Add to Watch List" / "Remove from Watch List" icons on the row; "My Watch List" is a **Status filter of the same list**. The legend notes the watch list "can be unavailable". Scope across leagues: **not stated** | Yahoo web Player List | Fact |
| Sleeper | **Star** on the player card; on mobile "PLAYERS tab › WATCH LIST filter (star)". "**Watchlist is account-wide**", so tracked players appear in all your leagues | Sleeper "Watch List vs. Draft Queue" (2026-09-21) | Fact |

### 10. Where DROP lives

| App | Finding | Source | Fact or inference |
|---|---|---|---|
| ESPN | The drop prompt appears **during an add** when the roster is full. A separate route: **Roster tab › tap the player's name › Drop Player › confirm** | ESPN Add or Drop a Player (via search summary); Claim a Player Off Waivers | Fact |
| Yahoo | From **your team page: tap a player › Drop Player icon › "Yes, do it!" / "Drop from Roster"**. The Player List's action legend also includes Drop Player, so the players list offers it for your own players on the web | Yahoo iOS add-drop page; web legend | Fact |
| Sleeper | Tapping a player card you own shows **Drop** among the prompts (mobile) | Sleeper cross-league ownership article | Fact |

So all three support Giorgio's premise that drop lives on your own roster, and two of the three
also offer it from the player card or list. None of the sources show a Drop button on the
available-players list for a player you don't own.

### 11. Empty and edge states worth copying

| App | State | Source |
|---|---|---|
| ESPN | A **"Can't Drop"** label (and a greyed Drop on the web) for undroppable players; in leagues with position limits "you must drop a player with the same primary position"; a roster-full drop prompt | ESPN Claim a Player Off Waivers |
| Yahoo | **Disabled Add with a reason in the legend:** "No more roster moves available", "Add Player functionality is disabled", "Actions locked by commissioner", "Player on Can't Cut list" | Yahoo web Player List |
| Sleeper | A commissioner can **lock** days so adds are blocked while drops are allowed; the **24-hour rule** sends a player dropped within 24 hours of a free-agent add straight back to free agency | Sleeper waivers articles |
| (none) | **"No results" wording** wasn't found for any of the three | | 

## What this means for Stockpile

Everything in this section is the Researcher's reading, kept apart from the facts above. The
repo was read-only (`main` @ `49044e06`).

| Fantasy pattern | Nearest equivalent here today | Gap or difference |
|---|---|---|
| Players is a tab or a screen in the league | `StockSearchScreen` today, reached from "Buy a stock" on Portfolio; the fifth tab "Stocks" is decided (last in the bar) | In ESPN and Yahoo it is a league screen; ours is a bottom tab. Whether the tab follows a league switcher isn't in the sources |
| Opens on the available-players list, sorted by popularity (ESPN: %rostered) | Opens **empty** until you type (search results appear inline; "the focused field and its placeholder say what to type") | A fantasy list is never empty. Our default could be "Available in this league" plus a sort. **%rostered has no equivalent:** a stock has one owner in a league (binary), and a cross-league popularity count would be a new aggregate we don't compute. In-league, the nearest signal is who owns it ("Owned by {name}") |
| Search field on the same list | Search with results inline below, no list behind it | Fantasy apps use one list that search narrows. A list-first screen would match them |
| Position filter | **Category** (11 in `supabase/seed/categories.json`: Technology, Financials, Healthcare… Misc) and, in price-tier leagues, the **price tier** slot | These are our "positions". Which slot a stock fits matters in tier and category leagues ("No free slot") |
| Availability filter (available / waivers / all) | The four ownership states already in search rows: free (nothing shown), "You own this", "Owned by {name}", "No free slot", plus "Not in this league's list" | The states exist but there's no filter on them. ESPN's default hides owned players; ours shows them labelled |
| Team, Health, Opponent, Projections | None | No equivalent; not needed |
| Trend arrow, +/- (most added), recommendations | **Most added** needs counts of buys and claims across leagues (our own data, no supplier). **Movers and most active** need live prices, which wait on the price-supplier decision (`PRODUCT_RULES.md`, 2026-11-16) | Browsing by our categories needs nothing new |
| Green Add / yellow Claim by waiver state | **Buy** while the market is open, **Claim** while closed (ruled 2026-10-08/09) | Same split, with the clock as the trigger, not a waiver period |
| "Who do you drop?" when the roster is full | A claim "names the sale that frees the slot" ("Buy X, funded by selling Y"); price-tier and category leagues show "No free slot" | Matches the pattern; the sheet already handles it |
| Watch list flag, shown as a filter of the same list | **Save / Saved (star)** and a per-league list (rulings 2026-10-08/09), shown on unowned stocks and other managers' stocks, never on one you own | **Sleeper's is account-wide, ESPN's per league.** Giorgio's per-league ruling matches ESPN; the conventions file only cites ESPN/Yahoo/Sleeper together |
| Drop from your own roster | **Sell from Portfolio** on a stock you own (the premise). Today a search result for a stock you own **opens the sheet on Sell** ("sell-from-search", ruled A) | In all three apps, drop on an owned player lives on the roster or card, not as a button on the available list. Whether the Stocks tab keeps "You own this → Sell" is a call for the Planner and Giorgio |
| Disabled actions with the reason (Yahoo's legend) | "Not in this league's list" (dimmed, with its reason), "No free slot" | Same idea; also worth copying: a reason for a locked day or a closed market |
| "No results" wording | `COPY.noStockMatches(query)` plus a "try a ticker or name" line | Not found at the three apps; ours already follows a good convention |

## Not found / not sure

- **The mobile screens themselves.** For all three: the default list and sort of the Players tab,
  filter presentation (chips, sheet, segmented control), row anatomy, and Sleeper's tab and
  filter layout. The first-party pages are help articles, not screen specs, and many of the
  concrete details (columns, filters) are **web**.
- **ESPN's bottom-tab labels**, how its 2025 "recommended and trending" modules sit relative to
  the full list, and whether a Watchlist filter exists on the app's Players screen.
- **Yahoo's default Status filter**, how waiver players are marked on a row, and trending lists.
- **Sleeper's Players tab modes and filters** and any in-app trending view.
- **Screens change by season.** These pages describe the 2026 season; ESPN redesigned in 2025,
  Yahoo's "Visual Vitamins" refresh (2026-08-27) changed headers, tabs and tables but its articles
  say nothing about the Players tab.
- **No screenshots were taken or committed.** Any captured later stay in
  `~/fantasy-stock/local/design-review/references/`, and this file links to sources instead.

## Recommendation

My advice, not a decision.

1. **Close the screen-layout gap with real captures before drawing mockups.** The facts above
   settle flows and states, but not layout. The cheapest way to finish: Giorgio (or the Design
   Lead) screenshots the Players tab of each app, default view, a filter open, and one row, into
   the references folder, and I (or the Design Lead) annotate them. I can't open the apps.
2. **What the sources agree on, safe to copy:** one list with search and filters on the same
   screen; availability decides the action and its colour (here: Buy vs Claim); a roster-full
   step that names what you give up; a watch list that is a filter of the same list; a reason
   shown for every disabled action; drop kept on your own roster or card.
3. **What to decide, not copy:** the default view (an "Available in this league" list needs a sort
   that doesn't depend on live prices, so categories or price tier first), the %rostered
   substitute, and whether a stock you own appears on this screen with Sell.

## Open questions for Giorgio

1. Should the Stocks tab open on a list of available stocks (with search narrowing it), instead
   of on an empty search field?
2. May someone screenshot the Players tab of the three apps (default view, a filter open, one
   row) so the mockups copy real layouts and not descriptions?
3. Should a stock you already own appear on the Stocks tab marked "You own this", or be hidden
   from the default list, as ESPN hides owned players?
