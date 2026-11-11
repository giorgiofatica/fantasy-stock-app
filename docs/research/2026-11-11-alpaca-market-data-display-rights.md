# Are we allowed to show Alpaca's market data to players in a free app, and if not, what would make it allowed?

Asked by: Giorgio on 2026-11-10 (via the Planner: option "B", research before asking Alpaca),
following blocker 3 of `2026-11-10-app-store-requirements.md` · Researcher session ·
Model: Opus 5.5 (licence reading; switched by the Orchestrator) · Sources read 2026-11-10
(US Pacific); the file is dated 2026-11-11 as the Planner named it.

## Short answer

**Not under the public terms.** Alpaca's Terms and Conditions and its Customer Agreement both say
market data is for personal, non-commercial use and may not be displayed or distributed to others
without **Alpaca's written consent**. Showing prices to players, and scoring them on our server, are
both outside that. **What would make it allowed:** Alpaca's written consent (its terms anticipate
apps like ours and require 30 days' notice), or a provider that sells a display licence. Tiingo
publishes one at $250 a month for start-ups. A second, smaller problem turned up: the market caps
come from Finnhub, whose terms forbid business use of its personal plans without written approval.

## What the repo shows we use (read 2026-11-10 from `main` @ `28b06317`)

**Every Alpaca call asks for the IEX feed, in real time** (`feed=iex` on
`data.alpaca.markets/v2`): `quote/index.ts:112,269`, `ticker-quotes/index.ts:159`,
`symbols-search/index.ts:70`, `historical-bars/paginate.ts:116`, `_shared/alpaca-price.ts:21,150`
(used by `record-trade` via `fetchFillPrice`), `snapshot-week-start/index.ts:188,222`,
`snapshot-week-end/index.ts:169,203`, `process-week-results/index.ts:113`,
`enrich-symbols/index.ts:131-133`. No call asks for `sip` or `delayed_sip`. That matches Alpaca's
free **Basic** plan, which is "for equities only the IEX exchange" (finding 6). `refresh-market-calendar`
calls the **paper** trading API (`paper-api.alpaca.markets`, `:66`), which suggests the key belongs to
a paper-trading account. That is inference, and Giorgio confirms it below.

The three kinds of use the Orchestrator named, confirmed in code:

| Kind | Where | What players see |
|---|---|---|
| **(a) Shown on screen** | `quote`, `ticker-quotes` (mobile screens; the web ticker tape, which is paused behind `APP_PAUSED`), `symbols-search` (search and queue prices), `historical-bars` (Home and Portfolio charts), `record-trade` (the fill price in the trade review) | Live IEX last prices and daily bars, to every signed-in player |
| **(b) Server only** | `snapshot-week-start` / `-end` (Monday and Friday prices), `process-week-results`, `enrich-symbols` (prices feed the draftable price floor in `_shared/symbol-eligibility.ts`), the auto-pick screen in `_shared/alpaca-price.ts` | Not the prices themselves, but they decide scores, picks and which stocks can be drafted |
| **(c) Derived** | Weekly gains, percentages, standings, matchup results | Numbers computed from (a) and (b) |

The public landing page's ticker tape is **hard-coded** (`apps/web/src/pages/LandingPage.jsx`
`TAPE` / `MOVERS`, labelled "illustrative"). It shows no live data.

Two other sources the brief did not name: the **symbol list** comes from NASDAQ Trader's public
directory files (`refresh-symbols/index.ts:99-100`), and **market cap and industry** come from
**Finnhub** `stock/profile2` (`enrich-symbols/index.ts:2-9,108`). Market cap is used for
draftability on the server. No screen in `apps/mobile` reads `market_cap` (grep).

## Findings

| # | Finding | Source (link) | Read on | Fact or inference |
|---|---|---|---|---|
| 1 | **Alpaca Terms and Conditions, "Personal and Non-Commercial Usage":** you agree to use the Services and Content "solely for your own personal and non-commercial purposes". Anyone wishing to use them otherwise, "including without limitation commercial usage, or making the Services and Content available to others through your own application (a 'User Application')", must give Alpaca **30 days' advance written notice** before making it available, and Alpaca may restrict or disallow the app's connectivity "in Alpaca's sole discretion". | files.alpaca.markets/disclosures/library/TermsAndConditions.pdf (linked as current from alpaca.markets/disclosures; no version date) | 2026-11-10 | Fact |
| 2 | **Same document, "Content":** Content "is provided exclusively for personal and noncommercial access and use". No part may be "copied, reproduced, republished, uploaded, posted, **publicly displayed** … transmitted or distributed in any way … for publication or distribution or for any commercial enterprise, without **Alpaca's express prior written consent**." Content explicitly includes "market data such as quotations … and/or last sale information". | Same | 2026-11-10 | Fact |
| 3 | Findings 1 and 2 together: the notice clause is a floor, not a permission. A User Application needs notice **and**, for display or commercial use, written consent. | Same | 2026-11-10 | Inference (Researcher's reading of two clauses in one document) |
| 4 | **Alpaca Customer Agreement §30, "Use of Market Data"** (version V26.2026.07): "I agree not to reproduce, distribute, sell or commercially exploit the market data in any manner without written consent from Alpaca." It also says AlpacaDB "provides market data to non-professional Alpaca customers", with "non-professional" defined by the NASDAQ and NYSE agreements, which are incorporated "if I am provided access to such data". | files.alpaca.markets/disclosures/library/AcctAppMarginAndCustAgmt.pdf | 2026-11-10 | Fact |
| 5 | Whether the Customer Agreement binds **our** account depends on whether Giorgio opened a brokerage account or only a paper/data account. The Terms and Conditions bind any user of the website or API, so finding 1–2 applies either way. | Same two documents | 2026-11-10 | Inference |
| 6 | **Alpaca's plans:** Basic (free, default for paper and live) covers "for equities only the IEX exchange"; Algo Trader Plus is $99/month and covers "All US Stock Exchanges". **Broker API** plans (Standard, which includes equities, then $500 / $1,000 / $2,000 a month) "are real time IEX or 15 mins delayed SIP" and are "for broker partners building their own trading platforms". The page says nothing about display, redistribution or professional status. | docs.alpaca.markets/us/docs/about-market-data-api (updatedAt 2026-10-06) | 2026-11-10 | Fact |
| 7 | **Alpaca support:** "Unfortunately, you cannot redistribute Alpaca API data." (November 2022, one sentence.) | alpaca.markets/support/redistribute-alpaca-api | 2026-11-10 | Fact (already in the App Store file; not re-derived) |
| 8 | **No public Alpaca licence for display** was found: no data-redistribution agreement, no display add-on, no price on the disclosures page or in the data docs. The disclosures page lists only the T&C, the customer agreements and the two exchange subscriber agreements. | alpaca.markets/disclosures; docs page in #6 | 2026-11-10 | Fact (absence on the pages read) |
| 9 | **The NYSE display agreement** (the one Alpaca's Pro plan incorporates, "Last Update: March 4, 2013"): "Subscriber shall not furnish Market Data to any other person or entity." A Nonprofessional Subscriber receives data "solely for his or her personal, non-business use". "Market Data" includes "all information that derives from any such information". | files.alpaca.markets/disclosures/library/NYSE+Market+Data+Display+Services+Agreement.pdf | 2026-11-10 | Fact. It binds SIP data on a Pro plan, **not** our IEX-only Basic feed (finding 4's "if provided") |
| 10 | **IEX's own fee schedule** (effective 2026-11-01): real-time **TOPS** $1,000/month access (non-display free); real-time DEEP $2,500, DEEP+ $3,500; **delayed TOPS, DEEP and DEEP+ are FREE**. "Delayed" means at least **15 minutes** after IEX made it available, and a Data Subscriber may redistribute real-time data on a delayed basis. A "Data Subscriber" must have a Data Subscriber Agreement with IEX. "Non-Display" use is consuming real-time IEX data for any purpose other than display (trading platforms and automated trading are given as examples). The page shows a second TOPS figure ($500) in its base-rates table, which conflicts with the $1,000. | iex.io/resources/trading/fee-schedule | 2026-11-10 | Fact (including the page's internal conflict) |
| 11 | IEX runs an **External Distribution Rebate** program (2026-09-01 to 2028-08-31) for vendors that redistribute TOPS, DEEP and DEEP+, and requires an executed IEX Data Subscriber Agreement for new subscribers. | iex.io/products/equities/market-data-connectivity | 2026-11-10 | Fact |
| 12 | **UTP (Nasdaq-listed SIP) data policies:** the delay interval for Level 1 is **15 minutes**; there is no usage charge for properly delayed data; but **external redistribution of delayed data still carries a $250/month Delayed Redistributor fee** (real-time $1,000). | utpplan.com/DOC/datapolicies.pdf (published September 2023), as summarised by search; the PDF itself was not opened | 2026-11-10 | Fact per search summary of the primary document; **verify by reading the PDF** |
| 13 | **CTA (NYSE-listed SIP) delayed-data terms were not found** on ctaplan.com in this session. | ctaplan.com search | 2026-11-10 | Not found |
| 14 | **Tiingo:** self-serve plans are "Internal Use Only", and internal use means you "may not display or share the data" with another person or organization. A **Redistribution** package ("Formerly EOD + IEX Redistribution") includes End-of-Day Prices, 24x5 Real-time, Corporate Actions, Security Master and Real-time IEX Derived, at **"$250/Month for Start-ups"** and **"$500/Month for Enterprise"**. Fundamentals are a separate add-on with "individual and commercial tiers". | tiingo.com/about/pricing; tiingo.com/products/iex-api | 2026-11-10 | Fact (published price). What the licence permits in detail was not on the page |
| 15 | **Massive (formerly Polygon.io, renamed 2025-10-30):** individual stock plans are "Individual use only" (Stocks Advanced $199/month). **Stocks Business** is $2,499/month and lists "No Exchange Fees or Approvals". A "Full Market Delayed" add-on (15-minute, every US exchange) is $499/month. The business page states **no display or redistribution terms**. | massive.com/pricing; massive.com/business; the rename from the company's announcement as reported by FISD and EIN Presswire | 2026-11-10 | Fact (prices). Display rights: not stated |
| 16 | **Financial Modeling Prep:** displaying or redistributing its data "requires a specific Data Display and Licensing Agreement"; its Terms bar showing data in apps used by multiple people without one, free or paid; Enterprise is quoted individually. | site.financialmodelingprep.com/pricing-plans and /terms-of-service, as summarised by search (pages not fetched) | 2026-11-10 | Fact per search summary; verify by reading the terms |
| 17 | **Twelve Data:** every self-serve plan is labelled internal ("Internal non-display usage", "Internal display data access"). The commercial page returned **404**. | twelvedata.com/pricing; twelvedata.com/commercial | 2026-11-10 | Fact; commercial terms not found |
| 18 | **Finnhub (our market-cap source):** "All plan listed on Finnhub website is strictly for personal use unless explicitly stated otherwise." "Personal plan can't be used by any business even internally without a written approval." You agree "to not redistribute or share access to data **or derived results from the data**" without written approval. Data must be deleted when the subscription ends. | finnhub.io/terms-of-service (no date) | 2026-11-10 | Fact |
| 19 | **What Apple accepts as authorization (5.2.2):** no Apple page defines the form. Apple's App Review page says that where "partnership documentation or authorization" is needed, you attach it in App Store Connect's Attachment section and describe it in Review Notes. 5.2.2 itself says "Authorization must be provided upon request." | developer.apple.com/distribute/app-review/; Guidelines 5.2.2 (both read 2026-11-10 for the App Store file) | 2026-11-10 | Fact (where to put it); the form it takes is not specified |

## What this means for Stockpile

**(a) Prices shown on screen.** This is "making the … Content available to others through your own
application" and "publicly displayed … for any commercial enterprise" (findings 1–2). It needs
**Alpaca's written consent**, after at least 30 days' notice. A free app is still, in my reading,
a "commercial enterprise" and not "personal" use: Stockpile is a product offered to the public, not
Giorgio's own use. That is inference; a lawyer or Alpaca's answer settles it.

**(b) Server-only use (scoring, snapshots, draftable floor, auto-pick).** IEX's own rules treat
this as **Non-Display** use, free for TOPS (finding 10). But we don't take data from IEX: we take it
from Alpaca under Alpaca's terms, and those terms limit **all** use to personal and non-commercial,
not just display (finding 1). So server-only use does **not** escape the consent requirement, even
though it is the easier case to explain to Alpaca. Inference.

**(c) Derived values (gains, standings).** The exchange agreements count derived information as
Market Data (finding 9, for SIP), and Finnhub's terms name "derived results" explicitly
(finding 18). Alpaca's T&C don't define derived data. My reading: a weekly percentage computed from
Alpaca prices is still a use of Alpaca data, so it doesn't change the answer for (a) or (b).
Inference, and the least certain of the three.

**Does a 15-minute delay change the answer?** At the exchange level, partly. IEX delayed data is
free and redistributable (finding 10). UTP delayed data is free to use but still costs $250/month
to redistribute externally (finding 12). **At Alpaca's level, no:** Alpaca's consent clauses do not
depend on delay. A delay would also change the product: live buys at the current price
(`record-trade`; "A live buy while the market is open" in `design/FANTASY_CONVENTIONS.md`) and
live portfolio values are core to how the game plays. That is a product question for Giorgio, not research.

**The Finnhub dependency has the same shape and is easy to miss.** `enrich-symbols` uses Finnhub's
market cap to decide which stocks are draftable. Finnhub's personal plans can't be used "by any
business even internally" without written approval, and "derived results" can't be shared
(finding 18). Which Finnhub plan we're on is Giorgio's to say. The NASDAQ Trader symbol directory
terms were not read.

**Apple (5.2.2).** If Alpaca consents, the consent letter or email is the "authorization": attach it
in App Store Connect and mention it in Review Notes (finding 19). If we switch to a provider with a
published display licence, the licence order or confirmation serves the same purpose.

## Alternatives, if Alpaca can't be used for display

Only **one** provider I read publishes a price for a licence that covers display to end users. The
others either say self-serve is internal-only and require a custom agreement, or don't state display
terms. I did not find three or four with published display terms. That is the honest result.

| Provider | Published display terms | Price that includes display | Covers our needs? |
|---|---|---|---|
| **Tiingo** | Yes: a "Redistribution" package; self-serve plans are internal-only (finding 14) | **$250/month (start-ups)**, $500 (enterprise) | Live prices in market hours (IEX-derived and 24x5 real-time), daily open/close (End-of-Day), symbol list (Security Master): **yes on the page**. Market cap: fundamentals add-on, commercial price not read |
| **Massive (ex-Polygon)** | Not on the page; individual plans "Individual use only" | Stocks Business $2,499/month ("No Exchange Fees or Approvals") or Enterprise (custom); display rights to confirm | All of it, by the product list. The cost is the issue |
| **Financial Modeling Prep** | Requires a "Data Display and Licensing Agreement" (finding 16) | Custom quote | Quotes, EOD and market cap are all in its catalogue. Licence negotiated |
| **Alpaca Broker API** | Not stated; built "for broker partners" (finding 6) | $0–$2,000/month by tier | Real-time IEX or 15-min SIP. Probably the wrong product, because we are not a broker |
| Twelve Data | Self-serve internal only; commercial page 404 (finding 17) | Unknown | Unknown |

## Not found / not sure

- **Alpaca's actual answer.** Nothing public says whether Alpaca grants consent for an app like this,
  on what plan, or at what price. Only Alpaca can answer (finding 8).
- **Which Alpaca terms Giorgio's account accepted.** The T&C apply to any API user. The Customer
  Agreement applies if he opened a brokerage account. The NASDAQ/NYSE agreements apply only on a
  Pro/Algo Trader Plus plan. The code suggests a paper account on Basic (IEX), but that is inference.
- **CTA's delayed-data terms** (finding 13), and the full **UTP** and **FMP** documents (findings
  12, 16, read through search summaries only). The **Nasdaq subscriber agreement** was downloaded
  but not read. It binds only SIP data on a Pro plan.
- **Tiingo's licence text.** The price and package contents are published; the clause that grants
  display, and any attribution or per-user rules, were not on the pages read. Fundamentals'
  commercial price was not found.
- **Exchange "derived data" policies** (e.g. whether a weekly percentage gain is still exchange
  data) were not read beyond the NYSE definition.
- **NASDAQ Trader symbol-directory terms** were not read.
- Dates: Alpaca's T&C has no version date. The Customer Agreement is V26.2026.07. The NYSE agreement
  is from 2013. IEX's schedule is effective 2026-11-01. Finnhub's terms are undated.

## Recommendation

My advice, not a decision.

1. **Treat this as a pre-launch blocker, not a submission detail.** Today every price players see,
   and every score, rests on terms that require Alpaca's written consent. That is true before App
   Review ever asks.
2. **Ask Alpaca, but have the fallback priced first.** Tiingo's published $250/month Redistribution
   package covers live prices, daily bars and the symbol list on one licence. Knowing that number
   makes the Alpaca conversation a comparison, not a dependency. The trade-off: switching providers
   is real engineering work across about ten functions, and Tiingo's licence text still has to be
   read before relying on it.
3. **Don't delay prices to dodge the licence.** A 15-minute delay helps only at the exchange layer,
   not under Alpaca's terms, and it would change live trading, which is a product rule.
4. **Fix the Finnhub dependency in the same decision.** Either get Finnhub's written approval for
   business use, or take market cap from the new provider (Tiingo's fundamentals add-on, or FMP).
5. **Keep whatever consent or licence results as the 5.2.2 authorization**, ready to attach in App
   Store Connect.

## Draft question to Alpaca: NOT TO BE SENT

> **NOT TO BE SENT.** A draft for Giorgio, if he decides to ask. It contains no personal or project
> identifiers; he would add his account details himself.
>
> We are building a free, simulated fantasy stock-market game for iOS: players draft and trade
> stocks with play money in private leagues, with no brokerage accounts, no real money and no
> orders placed through Alpaca. Our server uses one Alpaca Market Data API key on the [Basic / other]
> plan (IEX feed) to (1) show current prices and daily price history to signed-in players, about
> [expected number] people, and (2) price trades and compute weekly portfolio gains and league
> standings on our server. Under your Terms and Conditions ("User Application", 30 days' notice) and
> Customer Agreement §30, may we use the data this way, and if so, what written consent, plan, delay,
> attribution or fees apply? If not, does Alpaca offer a display or redistribution licence for this
> use, and at what price?

## Open questions only Giorgio can answer

1. **Which Alpaca account and plan is the API key on?** Paper only, or a brokerage account? Basic or
   Algo Trader Plus?
2. **Which agreements did you accept when you signed up?** Terms and Conditions only, or also the
   Customer Agreement, and the NASDAQ/NYSE subscriber agreements if you ever picked a Pro plan?
3. **Which Finnhub plan is the market-cap key on** (free or paid personal), and did you accept any
   business terms?
4. **Do you want to ask Alpaca** (using the draft above), price Tiingo first, or both?
