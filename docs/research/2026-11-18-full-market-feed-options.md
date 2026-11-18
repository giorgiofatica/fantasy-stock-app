# Full-market US price feeds we may show to users in a consumer app: options and monthly prices

Asked by: the Orchestrator on 2026-11-18, for Giorgio ("a shown price must be current, never a day
old, never missing"; IEX's one small exchange can leave a thin stock's newest trade a day old) ·
Researcher session · Model: **Sonnet 5.5**. The Opus switch was denied, so licence wording is
quoted in short excerpts and **anything uncertain is marked "needs a lawyer's or vendor's
confirmation"**. Read 2026-11-18. Builds on #380 (Alpaca display rights), #382 (free sources),
#383 (Tiingo licence read), #427 (how non-broker apps license data); those are referenced, not
repeated. Nothing was signed up for or sent.

## Short answer

1. **A paid Alpaca plan does not solve display.** Algo Trader Plus is $99/month and adds "All US
   Stock Exchanges", but the terms that stopped us before (personal and non-commercial use, written
   consent to show data to others) are unchanged on the pages read. Needs Alpaca's confirmation.
2. **There are three different things sold, and the price difference is large:**
   - **A flat-fee licence for a derived "reference price"** (Tiingo, Intrinio EquitiesEdge, Massive
     FMV): about **$250–$1,000 a month**, no per-user fees, a price for every stock every second,
     but a **modelled price, not an exchange trade**.
   - **Delayed consolidated (SIP) data:** about **$250 a month plus $250 a year** at exchange level,
     no per-user fees, 100% of US volume, **15 minutes late**.
   - **Real-time consolidated (SIP) data:** exchange fees of about **$3 per user per month** (three
     tapes × $1) plus **$1,000-a-month redistribution charges per tape**, passed through by a
     vendor. It scales with the number of players.
3. **Consolidated is not the same as current.** The SIP covers every exchange, so a stock trades
   more often there than on IEX, but a stock with no trade for hours still has an old last trade.
   Only the derived feeds are built to give a price for every stock continuously. (inference; needs
   each vendor's confirmation.)

## Findings

### The exchange layer: what real-time display costs per user

| # | Finding | Source (link) | Read on | Fact or inference |
|---|---|---|---|---|
| 1 | **CTA (NYSE-listed, Networks A and B) schedule:** Nonprofessional subscriber **$1.00 per month per subscriber** for each network. Per-quote-packet alternative **$0.0075**, capped so a vendor pays at most **$1.00 a month per non-professional customer** per network. Redistribution **$1,000 a month per network**. Professional Network A: $45 per device for 1–2 devices. "Charges apply to vendor providing service to nonprofessional subscribers." The schedule's own notes date from 2012–2015, so **it may not be current** | ctaplan.com/publicdocs/ctaplan/Schedule_of_Market_Data_Charges.pdf | 2026-11-18 | Fact (what the document says); currency needs confirmation |
| 2 | **UTP (Nasdaq-listed, Tape C):** nonprofessional "$1/month per Subscriber" and real-time redistributor $1,000 a month (September 2023 policy, via search summary of utpplan.com/DOC/datapolicies.pdf; also #382 finding 12). Delayed data needs no usage fee, but **external delayed display costs a $250/year admin fee plus $250/month "Delayed Redistributor Fee"** | utpplan.com data policies (summary); datashop.cboe.com/sip-fees | 2026-11-18 | Fact per summary; read the PDF to confirm |
| 3 | **Combined non-professional real-time stock cost:** Cboe DataShop's SIP page lists "Non-Professional … Stock … Real-Time **$3.00**" a month per subscriber, and Databento cites a "$3 monthly per-user display device fee on CTA and UTP". Three networks at $1 each gives the same $3 | datashop.cboe.com/sip-fees; databento.com/blog/us-stock-market-data (2023-10-20) | 2026-11-18 | Fact (both); the sum is my reading |
| 4 | **Nasdaq Basic** (one exchange's own full feed): non-professional **$1.00**; external distributor **$2,140** and internal **$1,680** per firm (2025–2027 price list). Databento says its distribution fees "start at $2,000 per month" | nasdaqtrader.com price list PDF (search summary); databento.com blog | 2026-11-18 | Fact per summaries |
| 5 | **Each user must be classified** professional or non-professional, and the rates differ a lot (professional stock real-time $66–$92 a month per user, per Cboe DataShop). Intrinio's guide: products serving both retail users and advisors "will likely need to classify, track, and report that split" | datashop.cboe.com/sip-fees; intrinio.com/blog/market-data-licensing-guide-for-fintechs (2026-08-20) | 2026-11-18 | Fact; who does the classifying for us needs the vendor's confirmation |

Cost illustration (my arithmetic, inference): real-time SIP direct, non-professional only, 1,000
active users ≈ 1,000 × $3 + redistribution ($1,000 per tape × 3) ≈ **$6,000 a month**, 100 users ≈
$3,300. A vendor can bundle or mark this up; the structure is what matters: **it grows with players**.

### Vendors, one by one

| # | Provider and plan | Monthly price | Real-time or delayed; coverage | Display / redistribution terms (short quotes) | Per-user fees | Delayed-for-display cheap? | Source | Confidence |
|---|---|---|---|---|---|---|---|---|
| 6 | **Alpaca Algo Trader Plus** | **$99** | Real-time, "All US Exchanges" (SIP: "The Algo Trader Plus subscription … offers SIP data"). Free plan: IEX, and SIP historical queries only if `end` is "at least 15 minutes old" | The pricing and docs pages say **nothing** on commercial use, display or redistribution. The T&C (#380 findings 1–2) still say "solely for your own personal and non-commercial purposes" and bar "publicly displayed … distributed" without "express prior written consent"; Pro-plan data is subject to the NASDAQ/NYSE subscriber agreements ("Subscriber shall not furnish Market Data to any other person") | Not stated | The free tier already allows SIP data 15 minutes old by API, but under the same terms | alpaca.markets/data; docs.alpaca.markets/us/docs/about-market-data-api (2026-10-06); market-data-faq (2026-09-21) | A paid plan is **not shown to permit display to our users**; **needs Alpaca's written confirmation** |
| 7 | **Massive (ex-Polygon) Business** | **$2,499**; add-ons: **Full Market Delayed $499** ("15-minute delayed trades and quotes from every US exchange"), **Full Market real-time $1,999**, Nasdaq Basic $1,999, Cboe EDGX $1,999, IEX $499 | Base plan "Real-time FMV + EOD SIP". **FMV** is Massive's own calculated price, once a second 4 a.m.–8 p.m. ET, not an exchange trade (search summary of massive.com docs). Trades/quotes need an add-on | Base plan: "No Exchange Fees or Approvals". For add-ons: "Additional exchange fees apply to these products." Individual plans: "For brokerage, redistribution, customer-facing display, or 200+ users, you'll need a Business plan" (#427) | Not stated | **Yes in structure:** Full Market Delayed is a separate $499 add-on (exchange fees on top, amount not stated) | massive.com/business; /stocks; docs (FMV) | Prices fact; fee pass-through **needs Massive's confirmation** |
| 8 | **Tiingo Redistribution** (#383) | **$250** start-ups / **$500** enterprise (plus fundamentals $200 / $500) | 24x5 consolidated **derived** reference price from many venues, "as often as every 250 milliseconds"; not SIP; not stated whether SIP-based | "unencumbered by exchange licensing … no per-user exchange fees or exchange usage reporting"; the governing agreement is unpublished | None (flat rate) | Not applicable (real-time derived) | tiingo.com/products/consolidated-real-time-stock-api (2026-11-04) | Per #383: agreement terms **need Tiingo's confirmation** |
| 9 | **Intrinio** | **Individual $150** (personal only, "No redistribution or display"); **Startup $333 for 6 months, $666 for 6, then $999** (quarterly billing) with "Commercial Use and Display Rights"; **Enterprise $1,250+** | **EquitiesEdge:** "Real-time stock prices" from Intrinio, "a highly accurate predicted bid, ask, and last price for all U.S. stocks"; on Individual and Startup. **Delayed SIP:** "Sourced from CTA A, CTA B, and UTP SIPs covering 100% of US equity volume", **Enterprise only** | EquitiesEdge: "no display or per user fees". Delayed SIP: "$250/year admin fee plus an additional $250/mo fee if you need to display the data. There are no per-user fees." Also "15-min delayed Stocks (CBOE ONE)" on Individual and Startup | None | **Yes:** delayed SIP $250/mo + $250/yr (Enterprise plan, $1,250+) | intrinio.com/pricing; /equitiesedge; /stock-prices-delayed-sip; blog guide (2026-08-20) | Display rights on Startup are stated; exchange-approval responsibility **needs Intrinio's confirmation** |
| 10 | **marketdata.app Commercial** (#382 finding 37) | **$333** for 6 months, then $666, then **$999**, quarterly commitment | Real-time stock prices; "display to end users and redistribution in your product" | The self-service plans are "Internal use"; its addendum puts exchange fees and end-user licensing on the customer, which conflicts with its own marketing | Per its addendum: **needs vendor confirmation** | Self-serve Starter–Prime are 15 min delayed via API but internal-only | marketdata.app/pricing; commercial addendum (via summary) | Conflict unresolved |
| 11 | **Twelve Data Business** | **Venture $499, Enterprise $1,099** (2026-04-01 post), custom Enterprise+; self-serve Grow $29–$79, Pro $99–$229, Ultra $329–$999 are "Internal" | Default US feed is real-time but "captures roughly 5% of this total market activity" (so **not full market**); full market "arrange licensed access" separately | "Business plans allow the use of data for commercial display"; "External distribution to users requires a US Equities Add-On"; "Any redistribution of data requires a separate agreement"; attribution "Data provided by Twelve Data" for redistributed use | Not addressed | Not stated | support.twelvedata.com (2026-08-18, 2026-10-22); twelvedata.com/news/march-2026-updates | Add-on price **needs vendor confirmation** |
| 12 | **Databento US Equities** | New "Databento US Equities: **$4,000**" a month from 2026-06-22; older posts show Standard $199 and Plus $1,500 (unclear which still apply) | A **raw exchange-feed provider** (all 15 exchanges per its hero text), not a display-ready price | Its own explainer: SIPs and most exchanges "consider the display of real-time quotes on a web or mobile app as a distribution use case"; its "zero distribution license fees" claim covers a four-exchange Equities Basic bundle (MIAX Pearl, IEX, NYSE National, NYSE Chicago), not the SIPs | The explainer cites "$3 monthly per-user display device fee on CTA and UTP" | Not stated | databento.com/blog/updates-to-subscription-pricing (2026-05-29); /blog/us-stock-market-data (2023-10-20) | Fact; **the display licence is a separate step, needs Databento's confirmation** |
| 13 | **Alpha Vantage Premium** | Plan prices not read | Real-time and 15-minute delayed US data via premium plans; "Nasdaq-licensed" | "premium plans for personal use. For commercial use, please contact sales." | Not stated | Not stated | alphavantage.co/premium; /realtime_data_policy (via search) | **Needs vendor confirmation** |
| 14 | **Finnhub** | Pages disagree: All-In-One **$3,500** a month (contact us) vs **$49.99 / $129.99 / $199.99** on a market-data pricing page | US real-time websocket on paid tiers (symbol-capped) | Our earlier read of its terms (#380): "strictly for personal use unless explicitly stated otherwise" and no sharing "derived results". The pricing pages did not render | Not stated | Not stated | finnhub.io/pricing (search summary); terms (#380) | Not usable for display on what I read; **needs Finnhub's confirmation** |
| 15 | **IEX direct** (#382) | $500 or $1,000 real-time TOPS; **delayed free** | One exchange only (the problem Giorgio named). IEX Cloud has shut down (per Alpha Vantage's migration guide, date not checked; IEX's own free API was retired 2021-11-18); the vendors above are the successors people use | Delayed: "do not need to complete, sign and deliver any agreement"; must be obtained through another Data Subscriber | None for delayed | Yes, but still IEX-only | #382 findings 1–4 | Fact |

## What this means for Stockpile

- **Giorgio's rule has two parts that products solve differently.** "Never a day old" is about
  freshness; "never missing" is about having a price at all. A SIP last trade is fresher than an
  IEX one, but a stock that hasn't traded in hours still shows an old trade. The three **derived**
  feeds (Tiingo, Intrinio EquitiesEdge, Massive FMV) are the only ones I found that are built to
  give a price for every stock, because they predict one from many sources (inference; **needs each
  vendor's confirmation on illiquid names**).
- **Real-time SIP is the expensive path and grows with players:** about $3 per player per month
  plus $1,000-a-month redistribution charges per tape, before any vendor margin (findings 1–3).
  Massive prices the add-on at $1,999 plus exchange fees; I found no flat-fee vendor offering it.
- **Delayed consolidated data is cheap and has no per-user fee** (about $250 a month plus $250 a
  year at exchange level, via Intrinio Enterprise from $1,250 or Massive's $499 add-on). It covers
  100% of volume, but it is 15 minutes old. Whether that meets "current" is Giorgio's call.
- **Alpaca's paid plan is the one that sounds cheapest ($99) but is not shown to be licensed for
  display** (finding 6).
- **Per-user classification matters for any real-time SIP route** (finding 5): every player would
  need a non-professional declaration, usually handled in the vendor's terms.

## Not found / not sure

- **Whether a paid Alpaca plan can license display to end users**, and the Pro-plan agreements'
  exact scope: **needs Alpaca's confirmation**.
- **Current CTA and UTP schedules**: the CTA document read carries 2012–2015 notes; the UTP figures
  come from a 2023 policy via a search summary. **Needs the exchanges' or a vendor's confirmation.**
- **CTA delayed-data display fees**: the CTA schedule read has no delayed section.
- **The add-on exchange fees** behind Massive's Full Market products, Twelve Data's US Equities
  add-on, and Intrinio's "$250 a month" in practice. **Need vendor confirmation.**
- **How derived reference prices behave on illiquid stocks**, and whether each can be called "the
  price" in a consumer app: vendor docs only.
- **Finnhub's current prices and whether any tier allows display**; **Alpha Vantage's prices.**
- **Barchart, Nasdaq Data Link, Xignite/Quodd, QuoteMedia, Benzinga** were not read for this
  question (their prices are unpublished or not fetched).
- Several figures come from **search summaries** of the vendors' own pages (marked); all prices
  are list prices as published, before negotiation or a start-up discount.

## Recommendation

My advice, not a decision, and not legal advice.

1. **Decide what "current" means first.** If a price modelled every second is acceptable, the
   derived-feed licences (Tiingo $250–$500, Intrinio Startup $333→$999, marketdata.app $333→$999,
   Massive $2,499) are the cheapest and have no per-user cost. If it must be an exchange trade,
   the realistic route is delayed SIP (about $250 a month plus $250 a year) or real-time SIP at a
   per-player cost.
2. **Don't count on a paid Alpaca plan for display.** Ask Alpaca in writing, using the draft in #380,
   only if Giorgio wants that route.
3. **Whatever is chosen, get the display scope, the storage-after-termination clause and the
   per-user classification terms in writing** (the questions in #383 apply to each vendor).
4. **Run each short-list vendor's feed on thin stocks before committing** (a one-week test of
   prices for 20 illiquid tickers), which no web page can answer.

## Open questions for Giorgio

1. Is a price modelled from many sources (a "reference price") acceptable as "the price", or must
   it be an actual exchange trade?
2. Is a price up to 15 minutes old acceptable as "current", if it is always present and always
   from the whole market?
3. If real-time exchange data is wanted, is a cost that grows by about $3 per player per month,
   plus fixed charges, acceptable?
