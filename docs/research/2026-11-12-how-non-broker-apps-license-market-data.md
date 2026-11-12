# How do consumer apps that aren't brokers get the right to show stock prices?

Asked by: Giorgio on 2026-11-12 (via the Planner): "how do other apps manage this kind of stuff?
apps that arent brokers or need to pull this data from somewhere?" · Researcher session · Model:
Sonnet 5.5 (the Planner said Sonnet is fine unless licence text; the widget and vendor terms read
here are excerpts and are marked) · Read 2026-11-12. Builds on #382 findings 34–36
(HowTheMarketWorks, Wall Street Survivor), which are not redone, only counted. Nothing was signed
up for or sent.

## Short answer

Of 12 non-broker sites and apps, **5 use a data vendor with delayed display**, **5 use real-time
data from a single exchange** (mostly Cboe BZX or each exchange's own last-sale trades), **2 are
something else**, and **none named an embedded widget** as its source. A licensed vendor is the
normal path; every large site that shows prices also forbids copying them in its own terms. The
shape closest to a free game is the three simulators' pattern: **delayed prices on screen, real-time
fills on the server**. The single-exchange pattern is the cheaper way to show something live, but
the sites using it also buy through a vendor or are exchanges themselves.

## The sites, from their own pages

All sources are each site's own pages. Most carry no date; dates are given where they exist.

| # | Site or app (kind) | Data source named | Real-time or delayed | Attribution line / terms | Free to users? | Source (read 2026-11-12) | Fact or inference |
|---|---|---|---|---|---|---|---|
| 1 | **HowTheMarketWorks** (stock game) | XIGNITE and QuoteMedia | Delayed at least 15 min on screen; orders filled at real-time bid/ask (FAQ, 2024-06-18) | "Quote data is delayed at least 15 minutes and is provided by XIGNITE and QuoteMedia." | Free tier | howthemarketworks.com; /?p=2082 | Fact (from #382) |
| 2 | **Wall Street Survivor** (simulator) | XIGNITE and QuoteMedia | Delayed 15–20 min; orders at real-time bid/ask | Same footer line | Free tier | app.wallstreetsurvivor.com/faq | Fact (from #382) |
| 3 | **StockTrak** (school simulator) | XIGNITE and QuoteMedia | Position values "delayed by 15 minutes"; on a trade "we'll take the most recent price (real time for US securities) within a second", so the cost shown can change | Same footer line | Not stated | learn.stocktrak.com/faq/complete-user-guide; stocktrak.com/securities-and-exchanges (June 16, 2022) | Fact |
| 4 | **Seeking Alpha** (finance news / research) | "Quodd (formerly Xignite)"; real-time "from Cboe BZX Exchange"; delayed "from Nasdaq UTP delayed feed" | Real-time from one exchange; delayed for the rest (length not stated). An older article says IEX is the source, with a 15-minute grace period | Fundamentals "provided by S&P Global Market Intelligence" | Free with paid tiers | help.seekingalpha.com (two articles, undated) | Fact; which article is current is unclear |
| 5 | **TradingView** (charting) | Free charts "display real-time US stock data from the Cboe exchange"; "no per-user fees imposed by the exchange"; "fewer price updates" | Real-time (Cboe only) free; its **widgets** show US stocks "Delayed" via "Cboe One" | None stated | Free tier | tradingview.com/support (43000473924); /widget-docs/markets/north-america | Fact |
| 6 | **StockAnalysis.com** (research site) | "real-time … from CBOE"; delayed "Nasdaq UTP"; private companies "Hiive" | Real-time (Cboe) plus delayed consensus with "a 15-minute delay" for the official open and close | "informational purposes only" | Free | stockanalysis.com/data-sources (updated 2026-06-14) | Fact |
| 7 | **Yahoo Finance** (news / quotes) | ICE Data Services | Nasdaq real-time; NYSE, OTC, Cboe indices 15 min | "Do not redistribute"; "not intended for trading or investing purposes" | Free | help.yahoo.com/kb/SLN2310.html (undated) | Fact |
| 8 | **Google Finance** (quotes) | "financial exchanges and other content providers" | NASDAQ and NYSE trades real-time; volume and other-venue data "consolidated and delayed by 15 minutes" | Users may not "download, store … or redistribute" | Free | google.com/googlefinance/disclaimer (undated) | Fact |
| 9 | **Nasdaq.com** (the exchange's own site) | Nasdaq's own feeds (Last Sale; Basic for bid/ask) | Last sale real-time; last five trades "delayed at least 15 minutes" (per search summary of its pages); bar refreshes every 3 s, charts once a minute | None found | Free | nasdaq.com market-activity pages, via search | Fact per search summary |
| 10 | **Finviz** (screener) | Vendor not named | Free: stock quotes delayed 1 minute; paid Elite real-time ($39.50/month) | None found | Free tier | finviz.com/help/faq, via search | Fact per search summary |
| 11 | **Sharesight** (portfolio tracker) | Vendor not named | "15 minute delayed pricing" for Nasdaq, NYSE, NYSE American, BATS (2021-07-01 post) | None found | Paid | sharesight.com/blog/sharesight-intraday-pricing-us-uk-stocks | Fact |
| 12 | **Divvy** (dividend tracker app) | "Polygon.io" (now Massive) | "Prices may be delayed up to 15 minutes depending on your data provider plan"; updated "whenever you open the app or pull to refresh" | No credit line on the page | Not stated | divvy-website.pages.dev/support | Fact |

Fantasy-stock and prediction apps: I found app-store listings only (TickerClash says "real-time",
Fantasy Stock League says nothing), no data-source statement. They are not counted.

## Patterns, counted (12 sites)

| Pattern | Count | Who |
|---|---|---|
| **(a)** Data vendor, delayed display | **5** | HowTheMarketWorks, Wall Street Survivor, StockTrak (Xignite and QuoteMedia); Sharesight (vendor not named); Divvy (Polygon/Massive) |
| **(b)** One exchange's real-time data, usually free of per-user fees | **5** | Seeking Alpha (Cboe BZX, bought through Quodd), TradingView (Cboe), StockAnalysis (Cboe plus Nasdaq UTP delayed), Google Finance and Nasdaq.com (each exchange's own last-sale trades) |
| **(c)** An embedded third-party widget whose owner holds the licence | **0** | None named it. TradingView and QuoteMedia sell widgets (below) |
| **(d)** Something else | **2** | Yahoo (ICE per-exchange mix), Finviz (1-minute delay, vendor unnamed) |

Two things to see in that count. Pattern (b) is real-time but **not the full market**: TradingView
says Cboe's data has "lower" volume and "fewer price updates", the same limitation as our IEX feed.
And it is not free of a licence: Seeking Alpha pays a vendor for it, and the two exchange-owned
sites hold their own rights.

## The vendors that keep recurring

| Vendor | Where it appeared | One line from its own site, on what it sells to apps like these | Published price |
|---|---|---|---|
| **Xignite / Quodd** | HTMW, WSS, StockTrak, Seeking Alpha | `xignite.com` redirects to quodd.com. Quodd offers "real-time and end-of-day … securities pricing", "flexible licensing models", and a section "For Early Stage & Startups" | None |
| **QuoteMedia** | HTMW, WSS, StockTrak | APIs, streaming, a "Web Widget Catalog", and "Free Financial Widgets"; "110+" exchanges | None; "request a demo" |
| **Polygon.io / Massive** | Divvy | Starter $29 and Developer $79 give 15-minute delayed data; Advanced $199 real-time, "non-pros only"; **Business $2,499**: "Anything your customers can see needs display and redistribution rights"; "For brokerage, redistribution, customer-facing display, or 200+ users, you'll need a Business plan"; startups: "25% or more off their first year" | Yes (massive.com/stocks) |
| **ICE Data Services** | Yahoo | Named as Yahoo's source for all US venues | n/a |
| **Cboe** | TradingView, StockAnalysis, Seeking Alpha | Cboe One feed: "real-time reference quotes". Its pages don't state display fees; a search summary of its BZX fee schedule lists a **$0 non-professional user fee** for BZX Top, which I couldn't read in full | Not read |
| **Nasdaq UTP** | Seeking Alpha, StockAnalysis | Used as the delayed feed (UTP's delayed data is free to use but has a $250/month external-redistributor fee, per #382 finding 12) | n/a |

Correction to #382 finding 15: Massive's pricing page does state display rights. They sit on the
**Business** plan. It also contradicts how Divvy appears to be licensed (a delayed plan, shown to
customers); how Divvy's arrangement works isn't published (inference only).

## The embedded-widget route

- **TradingView widgets:** "Widgets can only display data provided by TradingView, and we don't have
  an API for feeding your own data into them." For US stocks "we are only allowed to stream delayed
  data", and "Paid upgraded plans do not affect the data in the widgets." "It is not possible to
  download or export data." The widget pages say nothing about mobile apps; they mention websites,
  blogs and WordPress. The WebView guidance found (via search) covers TradingView's separate paid
  charting libraries, not the free widgets. Its terms say using TradingView products outside its
  site needs "proper attribution" (a search excerpt of an old policies page).
- **QuoteMedia widgets:** a free catalogue exists. Its widget terms weren't readable. Its general
  terms are for "personal, non-professional and noncommercial" use and bar redistribution "without
  the prior express written consent", and say widgets show real-time or delayed data by the
  viewer's entitlement (search summary).
- **What a widget cannot do for us:** it gives a picture on a screen, not data. We could not read a
  price from it to score a week, fill a trade at the current price, rank draft picks, or feed
  auto-pick. We would still need a licensed server feed for all of those. At best a widget could
  cover on-screen delayed charts (inference), and whether that is allowed inside a mobile app is
  unanswered by any page I read.

## What these sites do to cut cost

| Practice | Evidence |
|---|---|
| **Show delayed, fill at real-time on the server** | HTMW: "we fill all orders at the real-time bid ask prices (for US stocks)"; StockTrak: the price on a trade is "real time for US securities" and "can therefore change". The vendor licence covers the server's real-time use |
| **Real-time from one exchange only** | TradingView and Seeking Alpha use Cboe BZX; TradingView notes "no per-user fees imposed by the exchange" |
| **Delay everything else by 15 minutes** | Seeking Alpha, StockAnalysis, Google Finance, Sharesight, Yahoo (non-Nasdaq) |
| **Limit refresh rate** | Divvy updates "whenever you open the app or pull to refresh"; Nasdaq.com refreshes its quote bar every 3 seconds and its chart once a minute |
| **A 1-minute free delay with a paid real-time tier** | Finviz |
| **End-of-day scoring** | Not found for stocks among the sites read |

## Which pattern is closest to a free game with live trading at the current price

The **simulator pattern (a)**: HowTheMarketWorks, Wall Street Survivor and StockTrak are
the same kind of product, a simulated account where a vendor licence covers both display and
server-side fills. What it would mean for our three kinds of use (inference from these sites):

- **On-screen prices:** delayed about 15 minutes with a vendor credit, or real-time from one
  exchange through a vendor (the Seeking Alpha shape). Free sources don't permit either (#382).
- **Server-only scoring and fills:** still real-time or Friday-close data, covered by the vendor
  agreement. This is the part no free source covered, and the games get it from their vendor.
- **Derived gains and standings:** the games show prices anyway, so derived numbers weren't the issue
  for them. For us, a gain shown next to a buy price can recreate the price (#382 finding 15).

One consequence the games disclose and we would inherit: players see an older price than the one
they trade at, and StockTrak warns that "the total cost you see … can therefore change". Whether
that fits the fantasy-conventions rule that an immediate buy happens "while the market is open" is
a product question.

## What I could not read

- **Investopedia's and MarketWatch's simulators:** the domains blocked my tools.
- **Finviz's terms** (404), **TradingView's support article on delays** and **widget overview**
  (404), **Sharesight's data-sources page** (404), **Benzinga's delayed-quote product** (403),
  **Cboe's BZX fee schedule** (page cut off before market data), and **QuoteMedia's widget terms**.
- **Stocktwits, Simply Wall St, Morningstar, Stock Rover, Snowball, Delta:** no own-page data note
  found by search.
- **Fantasy-stock and prediction apps:** store listings only. None counted.
- Several findings (rows 9, 10; vendor claims about Cboe) come from search summaries of the sites'
  own pages, not full reads. Most pages carry no date; the ones that do are noted. Only US-facing
  English pages were looked at, so the counts describe this sample, not the market.

## Recommendation

My advice, not a decision.

1. **A licensed vendor is the normal path.** Every simulator in the sample names one, and the big
   free sites either are exchanges or buy through one. Nothing in the sample shows a stock app
   showing live prices from a free API.
2. **The cheapest shape is delayed display with real-time server fills**, which the three
   simulators use and which needs a vendor licence that covers real-time server use. It fits a
   fantasy game's weekly scoring. Whether Giorgio's rule for live buys allows a delayed price on
   screen is his call.
3. **Treat widgets as decoration only.** They can't feed scoring or fills and their mobile terms
   are unread.
4. **Before choosing a vendor, compare the same three questions for each** (display scope, storage
   after termination, derived numbers). Tiingo and marketdata.app were read this way in #383.

## Open questions for Giorgio

1. If prices were shown 15 minutes late while trades fill at the current price (the simulators'
   pattern), is that acceptable for the game, or must the price on screen match the fill?
2. Should the next read compare Quodd or QuoteMedia's start-up terms with Tiingo, since the
   simulators use them? Their prices aren't published, so it would mean asking.
