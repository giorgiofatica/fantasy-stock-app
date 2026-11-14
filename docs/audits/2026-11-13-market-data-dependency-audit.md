# Market-data dependency audit: what we fetch, who sees it, what we keep

Asked by: Giorgio, 2026-11-13 ("the first two make sense for me. They kind of seem like an
audit") · Written by: Planner (Fable 5.2) · Read-only: code and docs at `origin/main`
@ `707f11e6`, cron schedule from `docs/architecture/db-snapshot.json` (captured 2026-11-11).
Nothing was run against prod, nothing was sent to any supplier.

This is a findings file, not a plan. It answers two questions:

1. Every place the app uses Alpaca, Finnhub or the NASDAQ Trader symbol files.
2. What we store from those sources.

It ends with what the findings mean for the supplier choice and a list of things I could not
establish from the code.

## Short answer

- **Alpaca is called from 12 edge functions through 9 separate copies of the request code.**
  There is no single module to swap. Every price call uses `feed=iex` on one shared key pair
  (`ALPACA_API_KEY` / `ALPACA_API_SECRET`).
- **Finnhub is called from one place** (`enrich-symbols`), for two fields: industry and market
  cap. **NASDAQ Trader is called from one place** (`refresh-symbols`), for the symbol list.
- **The uses split cleanly into three kinds**, which is how suppliers license them: shown to a
  player (4 functions), used only by the server to fill or score (6 functions), and reference
  data refreshed in the background (3 functions).
- **We keep provider prices permanently in four tables** (`drafts`, `trades`,
  `week_snapshots`, `symbols`) and results derived from them in a fifth (`matchups`). Past
  seasons are built from these, so a licence that requires deleting stored data on
  termination would erase game history.
- **Three findings beyond the inventory** (section 5): any signed-in user can read every
  cached price and market cap straight from the `symbols` table, outside the rate limits; the
  web ticker tape is an anonymous public price display; and the category game type is keyed on
  Finnhub's own industry names.

## 1. Every supplier call

Sources are file paths under `supabase/functions/`. "Shown" means the value reaches a player's
screen as a price. Limits and cache times are the constants in each file.

### 1a. Shown to a player

| Function | Supplier call | What it returns | Called from | Limits and cache |
|---|---|---|---|---|
| `quote` | Alpaca per symbol: latest trade, then latest bar, then latest quote; plus a snapshot and 5 daily bars for the day's change | Latest price and change, one symbol or a batch | Mobile: Home (`useHomeLeague`), Portfolio (`priceReads`). Web: trade modal, draft page, dashboard, leaderboard | Signed-in only. 120 calls a user a minute. Up to 250 symbols a call. 30 s cache per worker |
| `ticker-quotes` | Same per-symbol chain as `quote` | Latest price and change | Mobile: the stock sheet (`useStockSheetData`), held symbols (`useStockPrices`). **Web: the ticker tape, with no sign-in** | Signed-in: 120 a minute, any symbol. Anonymous: 21 fixed symbols only, 60 a minute per address, 600 a minute overall. 60 s cache |
| `historical-bars` | Alpaca daily bars (`timeframe=1Day`), up to 5 pages | Daily price history for charts | Mobile: Home, Portfolio, the stock chart (`useStockChartData`), Matchup | Signed-in only. 60 a minute. 50 symbols a call. At most 407 days back |
| `symbols-search` | Alpaca latest trades, one request for up to 50 symbols | Search results with a price; batch prices for the draft queue | Mobile: draft and trade search (`useSymbolSearch`), the queue (`useQueueQuotes`). Web: draft controls, trade modal | Signed-in only. 120 a minute. 60 s server cache |

`symbol-name` is also called by the app but reads only our own `symbols` table.

**Where a price is on screen with the supplier credit** (`COPY.alpacaCredit`, "Market data
provided by Alpaca", `apps/mobile/lib/money/moneyCopy.ts`): Portfolio, stock search, the stock
sheet, trade review and its confirmation, trade history, the draft player card. Home and
Matchup show values and gains built from prices.

**How often the app asks** (from the functions' own comments, not measured): Home asks for
one batch every 30 seconds while live; the stock sheet is one call per open; held symbols are
quoted three at a time with a 2-minute cache; the draft queue is one batch per opening, reused
for 60 seconds.

### 1b. Used only by the server

| Function | Supplier call | What the price is used for | When |
|---|---|---|---|
| `record-trade` | `fetchFillPrice` (`_shared/alpaca-price.ts`): latest trade, then bar, then quote | The price a buy or sell is recorded at | Each trade a player makes |
| `validate-and-record-pick` | `fetchFillPrice` | The entry price of a draft pick | Each manual pick |
| `_shared/draft-write.ts` (auto-pick, used by `draft-autopick-sweep` and `draft-control`) | `fetchSnapshotPrices` (up to 5 requests of 100 symbols), then `fetchFillPrice` | Screening candidates at a live price, then the pick's entry price. Also writes `symbols.last_price` | Each auto-pick. The sweep runs every 2 seconds and calls Alpaca only when a pick is due |
| `snapshot-week-start` | Daily bars for the session date; latest quotes for any symbol the bars miss | The week's opening price for every held position | Mon and Tue 14:35 UTC |
| `snapshot-week-end` | Same pair of calls | The week's closing price | Fri 21:05 UTC; heal Mon and Tue 15:30 UTC |
| `process-week-results` | Latest quotes, many symbols in one request | Scoring matchups | Fri 21:15 UTC; heals Fri 22:00 and Sat 15:00 UTC |

### 1c. Reference data, refreshed in the background

| Function | Supplier | What it fetches | Stored in | When |
|---|---|---|---|---|
| `enrich-symbols` | **Finnhub** `stock/profile2`, one call per symbol, spaced 1.1 s | Industry name (`finnhubIndustry`) and market cap | `symbols.gics_industry`, `symbols.market_cap` | Every 10 minutes, 50 symbols a run |
| `enrich-symbols` | Alpaca snapshots, 50 symbols a request | A cached price | `symbols.last_price` | Same run |
| `refresh-symbols` | **NASDAQ Trader** `nasdaqlisted.txt` and `otherlisted.txt` | Symbol, name, exchange, ETF flag | `symbols` (symbol, name, exchange, is_etf, active) | Every 6 hours |
| `refresh-market-calendar` | Alpaca **trading** API `/v2/calendar` (`paper-api.alpaca.markets`, same key pair) | Trading days with open and close times | `market_calendar`, `market_calendar_coverage` | Daily 10:20 UTC |

Volume, for a supplier's "usage limits" answer: `enrich-symbols` at 50 symbols every 10
minutes is about 7,200 Finnhub calls and 144 or more Alpaca requests a day. With about 14,750
active symbols (the figure in `CLAUDE.md`), one full pass takes about two days, which is why a
cached price can be up to two trading days old.

## 2. What we store

| Table and column | What it holds | Written by | Kept how long | Shown to players |
|---|---|---|---|---|
| `drafts.entry_price` | The price each pick was made at | `validate-and-record-pick`, auto-pick | For the life of the league, and past seasons | Yes: cost basis, activity, avg entry |
| `trades.price`, `trades.total_value` | The price and value of each trade | `record-trade` | Same | Yes: trade history, activity |
| `week_snapshots.week_start_price`, `week_end_price` | Each position's price at the week's open and close | The two snapshot jobs | Same | Indirectly: weekly gains |
| `matchups.team1_gain`, `team2_gain` | Dollar gains computed from the snapshots | `process-week-results` | Same | Yes: scores, standings, results |
| `symbols.last_price`, `last_price_at` | A cached price per symbol, up to about two days old | `enrich-symbols`, auto-pick (`record_live_prices`) | Overwritten on each refresh | Used for draftability, price-tier slots and auto-pick; readable directly (see 5a) |
| `symbols.market_cap` | Market cap in dollars | `enrich-symbols` (Finnhub) | Overwritten | Used for the $250M draftability floor and auto-pick ranking |
| `symbols.gics_industry` | Finnhub's industry name | `enrich-symbols` (Finnhub) | Overwritten | Used to place a stock in a roster category |
| `symbols.symbol`, `name`, `exchange`, `is_etf`, `active` | The stock list | `refresh-symbols` (NASDAQ Trader) | Overwritten | Yes: names in search and everywhere a stock is shown |
| `market_calendar`, `market_calendar_coverage` | Trading days and hours | `refresh-market-calendar` (Alpaca) | Kept | Indirectly: market open or closed, trading window |

Two kinds of stored data behave differently if a supplier is dropped:

- **Game records** (`drafts`, `trades`, `week_snapshots`, `matchups`). These are the league's
  history. They cannot be refetched or recomputed without the original prices. This is the
  data the "may stored prices be kept after the licence ends" question protects.
- **Caches** (`symbols.last_price`, `market_cap`, `gics_industry`, the calendar). These are
  refreshed constantly and can be refilled from a new source.

Derived numbers shown to players (gains, portfolio value, standings) are computed from the
game records. The research notes that a gain shown next to a buy price can recreate the
price (`docs/research/2026-11-11-free-market-data-sources.md`, finding 15), so "derived" is
not automatically outside a licence.

## 3. The three kinds of use, side by side

| Kind | Functions | Freshness the code needs today | Under "delayed on screen" (option B) |
|---|---|---|---|
| Shown to a player | `quote`, `ticker-quotes`, `historical-bars`, `symbols-search` | Latest trade; daily bars | These four would serve the 15-minute-old price |
| Server-only fill or score | `record-trade`, `validate-and-record-pick`, auto-pick, both snapshot jobs, `process-week-results` | Latest trade at the moment of the action; official-session bars for the week | Unchanged: still the current price |
| Reference data | `enrich-symbols`, `refresh-symbols`, `refresh-market-calendar` | Slow: days | Unchanged |

Giorgio's ruling (2026-11-12, `PRODUCT_RULES.md`): "i prefer a but b would be acceptable if
its what terms dictate". Under B, the split above is already where the code divides, which
makes B cheap to build on the server side. What B changes for a player, from the code:

- **The price in the draft search and queue would differ from the pick's recorded price.**
  Today both come from the same latest trade (`apps/mobile/lib/game/queueRow.ts` says "the
  SAME number the draft search shows").
- **Per-slot leagues size a position as the slot's dollars divided by the fill price**, so
  the share count shown before a buy would be an estimate.
- **Auto-pick already checks a candidate at its live price** before picking
  (`_shared/auto-pick.ts`). A stock that looks legal at the delayed price can be refused at the
  live one, for a manual pick as well.

None of that has approved wording yet.

## 4. What stands between today's code and a new supplier

- **Nine copies of the Alpaca request.** The base URL and headers are written out separately
  in `_shared/alpaca-price.ts`, `quote`, `ticker-quotes`, `historical-bars`,
  `symbols-search`, `enrich-symbols/batch.ts`, `snapshot-week-start`, `snapshot-week-end` and
  `process-week-results`. `quote` and `ticker-quotes` each carry their own copy of the same
  three-step price chain that `fetchFillPrice` has. A swap today means nine edits that must
  agree; a single shared module first would make it one.
- **Alpaca's response shapes are read directly** in each place (`latestTrade.p`,
  `dailyBar.c`, `prevDailyBar.c`, the bars page format). There is no neutral "price" type
  between the supplier and the game.
- **Supplier-specific rules are baked in.** `ALPACA_TICKER_RE` filters symbols Alpaca
  rejects; the batch bisecting exists because Alpaca's multi-symbol endpoint fails whole;
  `symbols.price_unsupported` records Alpaca's format gaps. A new supplier has different
  gaps.
- **The supplier's name is in the app's words.** `COPY.alpacaCredit` appears on six mobile
  surfaces. `PRODUCT_RULES.md` has the rule "credit Alpaca on price surfaces".
- **The calendar comes from Alpaca's trading API, not its data API.** A data-only supplier
  (Tiingo has no calendar, per its licence read) does not replace it. The research names the
  NYSE's published holiday list as the public source.

## 5. Findings beyond the inventory

### 5a. Any signed-in user can read every cached price and market cap directly

`supabase/migrations/20261114000000_symbols_signed_in_only.sql` grants `select` on the whole
`symbols` table to `authenticated`, with a policy of `USING (true)`. The mobile app reads the
table directly (`from('symbols')` in `categoryData.ts`, `useSymbolCategories.ts`,
`useQueueQuotes.ts`), and filters on `last_price` for price-tier slot counts.

So a signed-in account can page through all of about 14,750 rows of `last_price` and
`market_cap` through the REST API. The per-user limits on `quote`, `ticker-quotes`,
`historical-bars` and `symbols-search` (the 2026-10-08 ruling, "nothing scrapable") do not
cover this path.

- Why it matters here: a redistribution licence is about who can obtain the data from us.
  This is a bulk read of supplier-derived data that the rate limits were meant to prevent.
- What I did not confirm: the live grant. This is the migration's text; a later migration or
  an out-of-band change could differ. `docs/architecture/db-snapshot.json` is the place to
  check. Passed to the Orchestrator for the security check.

### 5b. The web ticker tape shows prices to people who are not signed in

`ticker-quotes` runs with `verify_jwt = false` and serves 21 fixed symbols to anonymous
callers for the web ticker (`apps/web/src/Ticker.jsx`). The web app is paused today
(`APP_PAUSED`), so nothing renders it, but the endpoint answers.

This is the one place prices leave the signed-in app. The Tiingo read asks the same thing as
an open question: "Should prices ever appear on a public web page, or only in the app for
signed-in players? It changes what to ask for."

### 5c. The category game type is keyed on Finnhub's industry names

`category_rules.gics_industry` maps an industry name to a roster category, and the column is
filled with Finnhub's `finnhubIndustry` strings. Every public replacement in the research
(SEC SIC codes; Tiingo's fundamentals, also SIC) uses a different list of industries. Leaving
Finnhub means rewriting the category rules, and the seed migration that holds them is already
applied and must not be regenerated (`CLAUDE.md`; `scripts/gen-category-seed-migration.mjs`
writes a new file each run).

### 5d. Market cap has two jobs, with different needs

`symbols.market_cap` gates draftability (at least $250M, `_shared/symbol-eligibility.ts`) and
ranks auto-pick's "best available" (`MARKET_CAP_STRATEGY`). ETFs have no market cap from
Finnhub and are draftable on price and exchange alone. A replacement that is only roughly
right (shares outstanding from a quarterly filing times a price) is fine for the floor and
for ranking, but companies with more than one share class would need checking.

### 5e. The symbol list needs an exchange and an ETF flag, not just names

Draftability requires `exchange` to be one of five named venues and reads `is_etf`. Both
come from the NASDAQ Trader files today. The research names the SEC's `company_tickers.json`
as the public replacement, which it describes as mapping ticker, CIK and company name.
Whether a public source also gives the listing exchange and marks ETFs was not established
(see section 7).

## 6. What this means for the supplier question

Advice, not decisions.

1. **Ask each supplier about the three kinds separately**: display to signed-in players,
   server-only real-time use, and permanent storage of trade and score prices. The draft
   question already does this.
2. **Usage numbers to give them**: about 14,750 symbols; a background price refresh of 50
   symbols every 10 minutes; per-player ceilings of 120 price calls and 60 history calls a
   minute; batches up to 250 symbols; 407 days of daily history; scoring reads on Monday,
   Tuesday and Friday.
3. **Decide the public web page before signing.** If prices stay inside the signed-in app,
   the anonymous ticker path should be removed, not left dormant.
4. **Reference data can leave Finnhub, NASDAQ Trader and Alpaca's calendar whichever price
   supplier is chosen**, in this order of effort: the calendar (smallest), the symbol list,
   market cap, then industry (largest, because of 5c).
5. **A single price module in front of the nine call sites, with no behaviour change, is
   worth doing first.** It is the same work for any supplier and turns the swap into one
   file.
6. **Nothing here changes the App Store blocker**: the app cannot be submitted showing
   Alpaca prices without Alpaca's written consent or a licensed replacement
   (`docs/research/2026-11-10-app-store-requirements.md`).

## 7. What I could not establish

- **Real call volumes.** Every frequency above is a code constant or a comment. Nobody has
  measured requests per day; with a handful of test accounts it would not mean much yet.
- **The live grants on `symbols`** (5a) and the live cron schedule since 2026-11-11.
- **Whether `process-week-results` still needs its own price read** now that both snapshot
  jobs write start and end prices. I read that it calls latest quotes, not every path that
  uses the result.
- **Whether a free public source gives listing exchange and an ETF flag** (5e). A question
  for the Researcher.
- **The web app's call sites in detail.** It is paused, and `quote/index.ts` itself warns
  that two web screens make one call per symbol and would exceed the limit if it were
  switched on.
- **How any supplier's symbols line up with our 14,750.** The Tiingo read expects gaps in
  market cap and industry for small names and ETFs, and says matching against its ticker
  file would settle it.

## Sources

- Code at `origin/main` @ `707f11e6`: `supabase/functions/` (the functions named above and
  `_shared/alpaca-price.ts`, `auto-pick.ts`, `draft-write.ts`, `symbol-eligibility.ts`),
  `supabase/migrations/` (`20250118000000`, `20260105000000`, `20260116000000`,
  `20261005000002`, `20261114000000`, `20261122000000`), `apps/mobile/lib/` and
  `apps/mobile/components/money/`.
- `docs/architecture/db-snapshot.json` (cron jobs, captured 2026-11-11).
- `docs/research/`: `2026-11-11-alpaca-market-data-display-rights.md`,
  `2026-11-11-free-market-data-sources.md`, `2026-11-11-tiingo-licence-read.md`,
  `2026-11-12-how-non-broker-apps-license-market-data.md`.
