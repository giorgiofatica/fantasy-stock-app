# Is there a free source of US stock data we're allowed to use in a free public app, to replace Alpaca and Finnhub?

Asked by: Giorgio on 2026-11-11 (via the Planner): "it seems like we need to pivot. is there any
way or any resources we can use for free that we can pull market data from and replace our
reliance on alpaca and finnhub so we are not breaking any rules? outside of tiingo" ·
Researcher session · Model: Opus 5.5 (licence reading; switched by the Orchestrator) · Read
2026-11-10/11. Builds on `2026-11-11-alpaca-market-data-display-rights.md`. Nothing was signed
up for or sent.

A fact from Giorgio since that file: "my alpaca account key is a free paper trading account". So
Alpaca's Terms and Conditions apply, and its brokerage Customer Agreement probably does not.

## Short answer

Throughout, "free to use" and "free to show in a public app" are kept apart; the second is the
question.

- **Real-time (tier A): nothing free that is allowed.** Every exchange charges for real-time
  display or needs a signed agreement (IEX: $500–$1,000 a month plus reporting). The free API
  tiers all say personal or internal use.
- **15-minute delayed (tier B): allowed at the exchange level, but no free supply.** IEX's own
  policy says delayed IEX data needs no agreement and no fee to show. But IEX doesn't hand it out
  itself; it "must … be obtained through another Data Subscriber". Every free vendor tier I read
  forbids passing data on.
- **End-of-day (tier C): one free, allowed source.** IEX's own next-day historical files (HIST) are
  free, need no agreement, and only require the credit "Data provided for free by IEX". The catch:
  they are raw exchange packet captures needing a parser, and they hold IEX-only trades, not the
  official open and close. The other parts (company list, industry, shares outstanding for market
  cap, holiday calendar) have free public sources: SEC EDGAR, OpenFIGI, and the NYSE's published
  holidays.

## What the app needs, and which tier each part can live with

The needs come from the Orchestrator's list and the earlier repo mapping. The tiers are an
inference; picking one is Giorgio's product call.

| Need | Today | Tier it can live with | Free, allowed replacement found |
|---|---|---|---|
| On-screen latest prices | Alpaca IEX real-time | A, or B with a "delayed 15 minutes" label | **None free.** B is allowed at the exchange level, but needs a vendor that permits passing it on |
| Monday open / Friday close for scoring | Alpaca bars and quotes (server-only) | **C** if scoring may run a day later (Friday close on Saturday, Monday open on Tuesday) | **IEX HIST** (T+1). But it gives IEX's first and last trades, not the official consolidated open and close |
| Live price at draft pick time (auto-pick, draftable floor) | Alpaca snapshots | A today. C if auto-pick and the floor use yesterday's close (a product change) | Same as above |
| Market cap for ranking and draftability | Finnhub | C (it moves slowly) | **SEC EDGAR shares outstanding** × our own licensed price |
| Industry | Finnhub `finnhubIndustry` (feeds category eligibility: `_shared/category-eligibility.ts`, mobile `symbolCategories.ts`) | C | **SEC SIC codes.** A different taxonomy, so category rules would need remapping |
| Market calendar | Alpaca paper API `/v2/calendar` (`refresh-market-calendar/index.ts:66,143`) | C | **NYSE's published holiday and early-close list** |
| Symbol list | NASDAQ Trader `nasdaqlisted.txt` / `otherlisted.txt` | C | **SEC `company_tickers.json`** plus OpenFIGI |

## Findings

### Exchanges

| # | Finding | Source | Read on | Fact or inference |
|---|---|---|---|---|
| 1 | **IEX Market Data Policies (September 2026):** "Delayed" means at least 15 minutes old. "Recipients of Delayed IEX Market Data via either Controlled or Uncontrolled Distribution do not need to complete, sign and deliver any agreement and do not need to pay any fees for the receipt, use, or distribution of Delayed IEX Market Data." They must still follow the Display and Access Control Requirements. | iex.io/documents/iex-market-data-policies (PDF "September 2026") | 2026-11-11 | Fact |
| 2 | **But IEX won't send delayed data itself:** "Delayed IEX Market Data cannot be obtained directly from IEX and must instead be obtained through another Data Subscriber, such as a market data provider." | Same, §1 | 2026-11-11 | Fact |
| 3 | **IEX display rules for delayed data:** a prominent credit, "IEX Delayed Price and Last Sale", and a delay message such as "IEX Market Data Delayed 15 minutes". A ticker must repeat the credit at least every 90 seconds. Every user needs their own username and password, and the distributor must track access (§6). Delayed distributors must report usage to IEX on request (§8). | Same, §§5, 6, 8 | 2026-11-11 | Fact |
| 4 | **IEX real-time:** anyone who passes it on in a way they don't fully control needs IEX's Data Subscriber Agreement, written approval before giving real-time data to outside subscribers, monthly usage reports, and audits (§§2, 8–10). The fee schedule (effective 2026-11-01) lists real-time TOPS at **$1,000/month** access in one table and **$500/month** in another. The page doesn't explain the conflict; a schedule for 2026-12-01 is pending. | Same §§2, 8–10; iex.io/resources/trading/fee-schedule | 2026-11-11 | Fact (conflict unresolved) |
| 5 | **IEX "Digital Media Enterprise License":** lets a subscriber show IEX data "to an unlimited number of users via … mobile devices … provided such IEX Market Data may only be used for informational and non-trading purposes". Those users needn't sign anything or be reported. It needs pre-approval of the platform. **No price was found** on the fee schedule. | IEX Market Data Policies §17 | 2026-11-11 | Fact; price not found |
| 6 | **IEX HIST (next-day historical files):** free files of the IEX feeds, "provided in pcap format", posted "on a T+1 basis". Policy §15: IEX "does not require an IEX Data Subscriber Agreement from any Person who receives, uses, or distributes IEX Historical Data" under its terms. The terms ask for one credit, "Data provided for free by IEX. By accessing or using IEX Historical Data, you agree to the IEX Historical Data Terms of Use", and forbid illegal use. They state no personal-use or display limit. | iextrading.com/trading/market-data/; iex.io/products/market-data-connectivity/hist-terms; Policies §15 | 2026-11-11 | Fact. That HIST suits our use is inference: the terms read here are short and contain no display limit |
| 7 | **Data you store from the live feed isn't HIST:** "Real-Time or Delayed IEX Market Data that is databased or stored beyond the current trading day will not be considered IEX Historical Data." | Policies §1 | 2026-11-11 | Fact |
| 8 | **IEX's old free web API is gone:** "The IEX API … were retired on November 18, 2021". IEX Cloud is also gone (per the Planner's brief). Today IEX data comes only through connectivity, a vendor, or the HIST files. | Search summary of IEX's HIST and alert pages; iex.io market-data page | 2026-11-11 | Fact per search summary |
| 9 | **Cboe** (BZX, BYX, EDGX, EDGA): its North American Data Policies list "Data Agreement Not Required" for delayed and for end-of-day/historical distribution. Cboe DataShop also sells a delayed **SIP** product at $250/year access plus a $250 delayed redistribution fee. | cdn.cboe.com/resources/membership/Market_Data_Policies.pdf (35 pages, **read through a search summary, not opened**); datashop.cboe.com/sip-fees | 2026-11-11 | Fact per summary; **verify in the PDF**. How you would receive Cboe delayed data without a vendor wasn't found |
| 10 | **MIAX Pearl Equities:** its policies set a 15-minute delay for Top of Market. Its 2024 fee notice lists Top of Market at $1,000/month for internal and **$2,000/month for external** distribution, plus per-user fees ($0.10 non-professional). No free delayed-display terms were found. | miaxglobal.com market data policies and 2024 fee alert (search summary) | 2026-11-11 | Fact per summary; may be outdated |
| 11 | **MEMX:** a 2023 filing proposed $2,500/month for external distribution of its depth feed. No delayed-data terms were found. | SEC/Federal Register filings (search summary) | 2026-11-11 | Fact per summary; current schedule not read |
| 12 | **LTSE:** 2025 filings list its **Last Sale feed at $0/month**, top of book $500, depth $2,500. LTSE's own trades are a very small share of US volume, so its last sale is not a usable price for most stocks. | SEC filing SR-LTSE-2025-20 and Federal Register (search summary) | 2026-11-11 | Fee: fact per summary. Usefulness: inference |
| 13 | **Real-time direct from any exchange means running a feed handler.** IEX uses its own transport protocol over connectivity or an extranet; there is no simple web API. | IEX market-data page (protocols, connectivity forms) | 2026-11-11 | Fact for IEX; inference for the others |

### Derived numbers (showing a % gain or rank, never a price)

| # | Finding | Source | Read on | Fact or inference |
|---|---|---|---|---|
| 14 | IEX "Derived Data" is information made from IEX data "if and only if" it "cannot be reverse engineered to recreate all or a portion of any IEX Market Data or be used to create … a reasonable substitute". Derived Data may be distributed externally "free of charge and without such non-Affiliate entities having to enter into an IEX Data Subscriber Agreement". | IEX Market Data Policies §11 | 2026-11-11 | Fact |
| 15 | Applied to us: a **rank or a win/loss** looks like Derived Data. A **percentage gain shown next to a known buy price** lets anyone recompute the current price, so it likely does **not** qualify. Derived Data also doesn't remove the need to **receive** the real-time data lawfully (agreement and access fee). | §11 read against our screens | 2026-11-11 | Inference |
| 16 | **Squaring "non-display free" with "$1,000 access":** these are two separate fees. The access fee is for receiving real-time TOPS ($1,000, or $500 in the other table). The non-display fee is an extra charge for using the data in automated ways (the policy lists "portfolio valuation" among them), and it is FREE for TOPS. And §13: where non-display use only creates Derived Data that is then displayed, "the fees for Non-Display use shall not apply". So server-side scoring adds no fee beyond access. | Fee schedule; Policies §13 | 2026-11-11 | Fact |
| 17 | The derived-data policies of CTA, UTP, Nasdaq and Cboe were **not read**. | n/a | 2026-11-11 | Not found |

### Public sources for the parts that aren't prices

| # | Finding | Source | Read on | Fact or inference |
|---|---|---|---|---|
| 18 | **SEC.gov content is public:** "Information presented on sec.gov is considered public information and may be copied or further distributed by users of the web site without the SEC's permission". It asks for citation, bars use of the SEC seal and logos, and forbids unclassified bots. Fair access is **10 requests per second**, and automated clients must declare a user agent (company name and contact). | sec.gov/privacy; sec.gov "Accessing EDGAR Data" (reviewed 2024-06-26) | 2026-11-11 | Fact |
| 19 | **What EDGAR offers:** `company_tickers.json` maps ticker, CIK and company name, though the SEC does "not guarantee accuracy or scope". Company facts come as JSON from data.sec.gov. The SIC industry code list is linked. That data.sec.gov includes `EntityCommonStockSharesOutstanding` per company is from my knowledge, not re-read today. | sec.gov "Accessing EDGAR Data" | 2026-11-11 | Fact (first three); the shares-outstanding field is Researcher's knowledge, verify |
| 20 | **The NASDAQ Trader site's copyright:** content "may not be copied, reproduced, transmitted, displayed … distributed" except one copy for the viewer's own use. Any other use "requires the prior written consent of Nasdaq and may require a fee". This page covers the site; the symbol-directory page itself shows no separate licence. | nasdaqtrader.com/Trader.aspx?id=CopyDisclaimMain (© 2021) | 2026-11-11 | Fact. That it covers the `.txt` files our `refresh-symbols` downloads is inference |
| 21 | **OpenFIGI:** FIGI identifiers are dedicated "to the public domain" and "may be freely reproduced, distributed … for any purpose, commercial or non-commercial", including "redistribution … to your customers". | openfigi.com/docs/terms-of-service (2018-11-27) | 2026-11-11 | Fact. Rate limits not read |
| 22 | **NYSE holidays:** the NYSE publishes its 2026 and 2027 closures and early closes (e.g. 2026-11-26 closed, 2026-11-27 closes 1:00 p.m. ET). The page's reuse terms sit on ICE's terms page, which I didn't read. | nyse.com/markets/hours-calendars | 2026-11-11 | Fact (dates). That a list of holiday dates is a fact anyone may record is inference |

### Free tiers people reach for: free to use, not to show

| # | Service | What its own terms say about a public app | Source | Fact or inference |
|---|---|---|---|---|
| 23 | **Alpha Vantage** | Licence is "for personal, non-commercial use". It counts as "commercial use" if you "provide information … as part of any type of commercial activity that allows individuals or entities other than User to access information directly or indirectly"; otherwise contact premium@. | alphavantage.co/terms_of_service (PDF) | Fact |
| 24 | **Finnhub** (our current market-cap source) | Personal plans "can't be used by any business even internally without a written approval"; no sharing of data "or derived results". | finnhub.io/terms-of-service (prior file) | Fact |
| 25 | **EODHD** | Non-professional users may not be "selling, reselling, retransmitting, redistributing, displaying, or granting access to the Information"; business use is a professional or commercial plan. | eodhd.com/financial-apis/terms-conditions | Fact |
| 26 | **Twelve Data** | Free plan: "Internal non-display usage". | twelvedata.com/pricing (prior file) | Fact |
| 27 | **Massive (ex-Polygon) Stocks Basic** | $0, end-of-day only, 2 years of history, 5 calls a minute, current day excluded. The pricing page puts commercial use, display and redistribution on the paid **Business** tier. | massive.com (search summary of its pricing and knowledge-base pages) | Fact per summary |
| 28 | **Yahoo (Finance)** | No collecting data "using any automated means … without our express, prior permission"; no using data "to create any database, archive, mobile application, data feed, widget". | legal.yahoo.com Terms (US version dated 2025-05-15) | Fact |
| 29 | **Tiingo free** | "Internal Use Only". | tiingo.com/about/pricing (prior file) | Fact |
| 30 | **Marketdata.app free** | "Internal use", stock data 24 hours delayed. | marketdata.app/pricing | Fact |
| 31 | **Stooq** | Terms page not read. A third-party package says the data is Stooq's or its providers' property, usable only under stooq.com/terms.html. | Search (secondary) | Not verified |
| 32 | **Marketstack** | Its terms redirect to its parent company's general legal page, which has no Marketstack terms. A vendor summary says paid tiers allow "commercial use", but display wasn't confirmed. | marketstack.com/terms → ideracorp.com/legal/APILayer | Not verified |
| 33 | **Nasdaq Data Link** | Not read (licences vary per dataset). | n/a | Not verified |

### What comparable apps say on their own pages

| # | Finding | Source | Read on | Fact or inference |
|---|---|---|---|---|
| 34 | **HowTheMarketWorks** footer: "Quote data is delayed at least 15 minutes and is provided by XIGNITE and QuoteMedia." | howthemarketworks.com | 2026-11-11 | Fact |
| 35 | **Wall Street Survivor** has the same footer. Its FAQ says "Due to NASDAQ, NYSE and AMEX regulations, the WallStreet Survivor will display a delayed price estimate for 15-20 minutes", while "All orders are executed at the real-time bid/ask prices when placed during market hours", and after-hours orders fill "at the open price of the stock at market open". | app.wallstreetsurvivor.com/faq | 2026-11-11 | Fact |
| 36 | That pattern (show delayed prices, fill orders server-side at real-time prices) is how those two games split display from non-display use, and both pay licensed vendors for it. Investopedia's and MarketWatch's simulators couldn't be read: both domains blocked my tools. | Findings 34–35 | 2026-11-11 | Inference |

### For comparison: the two cheapest paid display licences besides Tiingo

| # | Finding | Source | Read on | Fact or inference |
|---|---|---|---|---|
| 37 | **Marketdata.app Commercial:** "Commercial use, with display to end users and redistribution in your product", real-time stock prices. **$333/month** for 6 months, then $666, then $999 a month, with a quarterly commitment. "Best for products that display market data to their users." | marketdata.app/pricing | 2026-11-11 | Fact |
| 38 | **Massive Stocks Business:** $2,499/month, "No Exchange Fees or Approvals". Display terms aren't stated on the page, though a search summary of its pricing says Business adds display and redistribution rights. A vendor called Eulerpool advertises display at $499–$1,999/month (search summary only, not read). | massive.com/business (prior file); search | 2026-11-11 | Fact (price); display per summary |

## What this means for Stockpile

- **Tier A (keep live prices as today):** no free route exists. The real choices are paid: Tiingo
  ($250/month, prior file), marketdata.app ($333 a month rising to $999), Alpaca's consent if it
  gives it, or IEX directly (agreement, $500–$1,000 a month, reporting, audits, and a feed handler
  we would have to build and run). IEX's Digital Media licence (finding 5) fits an "informational,
  non-trading" game on its face, but its price is unknown.
- **Tier B (prices delayed 15 minutes, with a "delayed" label):** the exchanges allow it (IEX
  explicitly, Cboe per its policy summary), but we would still need someone to supply the delayed
  data under terms that let us pass it on. No free supplier was found, so in practice B also
  means paying a vendor. The comparable games do exactly this.
- **Tier C (end-of-day only):** IEX HIST is free, needs no agreement, and asks only for the credit
  line. Scoring could move to it if the week-start and week-end jobs run a day later. Three
  costs:
  - **Engineering:** a scheduled job to download daily packet-capture files (size not stated) and
    decode IEX's protocol. Open-source parsers exist, but I didn't evaluate them.
  - **Accuracy:** IEX trades only, so "Monday open" becomes IEX's first trade, not the official
    opening price. That's the same as today, since we already use `feed=iex`. Thinly traded stocks
    may have no IEX trade on a given day.
  - **Product:** live trading at the current price and live portfolio values can't run on
    end-of-day data. That is Giorgio's call.
- **Non-price data is the easy part:**
  - **Symbol list:** SEC tickers (public, citation requested), replacing the NASDAQ Trader files,
    whose site bars copying without consent (finding 20).
  - **Industry:** SEC SIC codes. This means remapping the category rules, which use Finnhub's
    industry names today.
  - **Market cap:** SEC shares outstanding × our own price.
  - **Calendar:** the NYSE's published holidays.
  - **Identifiers:** OpenFIGI, public domain.
- **Whatever tier is chosen, the Alpaca and Finnhub problem stays until both are removed or
  licensed.** Both show up in every scoring path today.

## Not found / not sure

- **IEX's TOPS price:** $1,000 or $500? The fee schedule lists both.
- **The Digital Media Enterprise License price**, and whether a simulated-trading game counts as
  "non-trading purposes" (only IEX can say).
- **Cboe's policies PDF** (35 pages, read through a search summary only) and any free route to
  Cboe delayed data. **MEMX, MIAX and LTSE** current schedules were read through filings and
  summaries, not the exchanges' own fee pages.
- **IEX HIST file sizes and retention.** The download table on IEX's page was empty when read; a
  search summary says trailing twelve months, no registration.
- **Whether `EntityCommonStockSharesOutstanding` is filled in for all the stocks we need.** It
  depends on each company's filings and can lag a quarter.
- **The full terms of Stooq, Marketstack and Nasdaq Data Link**, ICE's terms for the NYSE holiday
  page, OpenFIGI's rate limits, and the CTA/UTP/Nasdaq/Cboe derived-data policies.
- **The Investopedia and MarketWatch simulators' footers** (their domains blocked my tools).

## Recommendation

My advice, not a decision.

1. **Decide the tier first.** It decides everything else. If live trading at the current price
   stays (tier A), there is no free answer, and the comparison is Tiingo at $250/month against
   marketdata.app at $333 rising to $999.
2. **Move the non-price data to public sources either way:** SEC tickers and SIC codes, shares
   outstanding for market cap, the NYSE holiday list, OpenFIGI. That removes Finnhub and the
   NASDAQ Trader files, and it costs engineering time only.
3. **If Giorgio wants a free route, the honest one is tier C with IEX HIST.** End-of-day scoring
   and next-day prices on screen, credited "Data provided for free by IEX", with a parsing job to
   build. It changes the game, so it needs his ruling and probably a board.
4. **Before building on HIST, read its full terms page once more and ask IEX** whether a public
   game may show HIST-derived prices. The terms read here are short, and the Digital Media licence
   question can go in the same email (Giorgio's call; nothing has been sent).

## Open questions for Giorgio

1. Which tier: live prices (paid), delayed 15 minutes (paid supplier, labelled delayed), or
   end-of-day (free via IEX HIST, with a parsing job and a game change)?
2. Can weekly scoring run a day late (Friday's close scored on Saturday, Monday's open on Tuesday)?
3. Which Finnhub plan is the market-cap key on? It matters only until market cap moves to SEC data.
4. May the Planner ask IEX about the Digital Media licence price and HIST display use, or is this
   research-only for now?
