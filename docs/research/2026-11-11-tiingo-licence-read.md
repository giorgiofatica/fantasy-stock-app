# Can Tiingo be the long-term licensed data source for a free public app, and what does it cost and restrict as we grow?

Asked by: Giorgio on 2026-11-11 (via the Planner): "have the researcher read tiingo's licence in
full. im looking at big picture and scalability." · Researcher session · Model: Opus 5.5 (licence
reading; switched by the Orchestrator) · Read 2026-11-11. Builds on #380 (Alpaca) and #382 (free
sources). Nothing was signed up for, no quote was requested, and nothing was sent.

## Short answer

**Probably yes, but the licence that would govern us is not published.** Tiingo's public pages say:
- self-serve plans are internal-only;
- showing data to anyone outside your organisation needs a **redistribution licence**, which its
  terms call available only "upon special request and permission" with "additional fees";
- the Base Equities redistribution package costs **$250/month for start-ups or $500 for
  enterprise**;
- its 24x5 prices are "unencumbered by exchange licensing", with no per-user exchange fees and no
  exchange reporting.

Fundamentals (market cap, industry) are a separate redistribution add-on at $200 or $500 a month,
so a full replacement is about **$450–$1,000 a month** at list price.

Three things must be settled in writing before relying on it:
- what "start-up" means;
- what the redistribution contract allows on screens and storage;
- a terms clause, seen only through search excerpts, requiring **deletion of all Tiingo data,
  backups included, when the paid plan ends**. That clause would reach our stored trade prices and
  weekly snapshots.

## How this was read, and its limit

- **Tiingo's Terms of Use** (app.tiingo.com/tos, "last updated October 6, 2026") sit behind a
  Cloudflare bot check. I didn't bypass it, and the public web archive is blocked to my tools. The
  terms below come from **search-engine excerpts of that page**, marked "per excerpt". Two search
  summaries disagreed on whether a deletion clause exists, so it is flagged.
- **No redistribution licence agreement, order form or fundamentals licence is published.** The
  developer appendix says to email for one, with the address hidden on the page.
- The pricing, product and API documentation pages were read directly.

## Findings

| # | Finding | Source | Read on | Fact or inference |
|---|---|---|---|---|
| 1 | **Terms §7.3:** API data is for internal use only. Individuals use an Individual plan, while anyone representing "an organization or business" must use a Commercial plan. Redistribution is "only available upon special request and permission" and carries "additional fees". | app.tiingo.com/tos (2026-10-06), per excerpt | 2026-11-11 | Fact per excerpt |
| 2 | **API docs:** Basic and Power data is "for internal and personal use only"; Commercial "is licensed for internal commercial usage"; neither may redistribute. Redistribution: "All of our redistributable pricing is based on a flat rate" with higher usage limits; email Tiingo. | tiingo.com/documentation | 2026-11-11 | Fact |
| 3 | **Internal use** means "you may only use the data for your own personal use and you may not display or share the data with another person or organization". | tiingo.com/about/pricing | 2026-11-11 | Fact |
| 4 | **Developer appendix:** an app whose users bring their own Tiingo token needs no licence, but "Tiingo must be clearly attributed as the data source". That route "is not meant for developers digesting Tiingo data and then redistributing", and if you "redistribute Tiingo's data without requiring your users to make their own Tiingo account … you will have to get a redistribution license". | tiingo.com/documentation/appendix/developers | 2026-11-11 | Fact |
| 5 | **24x5 page** (last updated 2026-11-04): "unencumbered by exchange licensing"; "your end users need no exchange licenses, and there are no per-user exchange fees or exchange usage reporting". The method is "approved for redistribution by four or more trading venues". "Self-serve plans are licensed for internal use only, so showing the data to people outside your organization requires a Tiingo redistribution license." The Base Equities licence is "$250/month for startups and $500/month for enterprise" and includes End-of-Day Prices, 24x5 Real-time, Corporate Actions, Security Master and Real-time IEX Derived. | tiingo.com/products/consolidated-real-time-stock-api | 2026-11-11 | Fact |
| 6 | **What 24x5 is:** derived reference prices "from multiple US exchanges, ATSs, and OTC venues", Sunday 8 p.m. to Friday 8 p.m. ET, updated "as often as every 250 milliseconds". Snapshot fields: `tngoLast`, `lqRefPrice`, `prevClose`, `open`, `high`, `low`, `volume`, plus derived bid and ask. "Fields may be null when the underlying consolidated feed has not published that value." Whether it is SIP-based is not stated. | tiingo.com/documentation/equity-realtime-stock-data; product page | 2026-11-11 | Fact |
| 7 | **What "IEX Derived" is:** the raw IEX fields (`last`, `bidPrice`, `askPrice`, timestamps) are "null unless you are registered with IEX". `tngoLast`, `open`, `high`, `low` and `mid` are Tiingo's own; `tngoLast` is the last price or a mid price "only when … a good proxy", replaced by the official print later. Since 2025-02-01 the full TOPS feed needs a signed IEX agreement; the derived feed "isn't a substitute for the TOPS feed" and adds no IEX cost. Tiingo recommends 24x5 as its successor. | tiingo.com/documentation/iex | 2026-11-11 | Fact |
| 8 | Read against IEX's own policy (#382, finding 14: derived data that "cannot be reverse engineered" may be distributed free), Tiingo's derived reference price is presented as falling outside IEX's licensing. Only IEX can confirm that. | Findings 6–7 with IEX policy §11 | 2026-11-11 | Inference |
| 9 | **End-of-day:** fields are `open`, `high`, `low`, `close`, `volume`, adjusted values, `divCash` and `splitFactor` (CRSP-style adjustment). US prices arrive around 5:30 p.m. EST, with corrections until 8 p.m. **Whether `close` is the official consolidated close is not stated.** Examples are single-ticker. | tiingo.com/documentation/end-of-day | 2026-11-11 | Fact |
| 10 | **Batch calls:** the IEX and 24x5 docs show an **all-tickers** endpoint (`/iex`, `/tiingo/equity/intraday`) and single-ticker endpoints. A multi-ticker parameter and any per-call maximum are **not documented**. A third-party R wrapper says EOD downloads are "sequential" and Tiingo "does not support batch downloads" (it may be outdated). | IEX and 24x5 docs; riingo docs on CRAN | 2026-11-11 | Fact (docs); wrapper note is secondary |
| 11 | **Rate limits:** Starter 50/hour, 1,000/day, 500 symbols a month, 1 GB. Power 10,000/hour, 100,000/day, all symbols, 40 GB. Commercial 20,000/hour, 150,000/day, 100 GB (from the fundamentals page). Redistribution limits are **not listed** (only "higher usage limits"). | tiingo.com/about/pricing; tiingo.com/products/fundamental-data-api | 2026-11-11 | Fact |
| 12 | **Security list:** a meta endpoint returns `ticker`, `name`, `exchangeCode`, `description`, `startDate`, `endDate`. `supported_tickers.zip` is updated daily (its fields weren't described). Coverage claims: IEX "14,000+ tickers"; 24x5 "supported US equities and ETFs". | EOD and IEX docs | 2026-11-11 | Fact |
| 13 | **Fundamentals:** a daily metrics endpoint includes **`marketCap`**. The meta endpoint's `sector` and `industry` are "derived from" `sicSector` and `sicIndustry` (SIC-based). Coverage: "5,500+ Equities" on the docs page but "14,000+ tickers (US Equities and ADRs)" on the product page, which conflict. It is an add-on: Commercial internal $100 (start-up) or $200 (enterprise) a month; **redistribution add-on $200 (start-up) or $500 (enterprise) a month**. The table was hard to read, so the plan mapping is uncertain. What fundamentals redistribution permits isn't described. | tiingo.com/documentation/fundamentals; tiingo.com/products/fundamental-data-api | 2026-11-11 | Fact (including the conflicts) |
| 14 | **Derived products (terms §1.6):** aggregate statistics and **percentage returns are allowed provided the underlying data cannot be reconstructed** from them. A series that can be reconstructed "is prohibited unless Company expressly approves it in writing". No benchmarking or competing products. | app.tiingo.com/tos, per excerpt | 2026-11-11 | Fact per excerpt |
| 15 | **Storage:** trial and Starter plans may not "write, save, archive, back up, or otherwise retain Tiingo Data in persistent storage". After a paid plan ends, "you must promptly and permanently delete all Tiingo Data from every system owned, leased, or controlled by you", backups included. A second search summary found no deletion clause, so this is **unconfirmed**. | app.tiingo.com/tos, per excerpts | 2026-11-11 | Fact per excerpt; needs a direct read |
| 16 | **Money and contract:** fees are "non-refundable and non-creditable"; subscriptions auto-renew. For a price increase, Tiingo "will either obtain your affirmative consent … or allow you to cancel for at least fourteen (14) days after the increased charge". Tiingo may suspend or terminate an account and is not liable for that beyond any required refund. You indemnify Tiingo. Consequential damages are excluded (the dollar cap wasn't seen). Binding individual arbitration, with class-action and jury waivers. **Governing law not found.** | app.tiingo.com/tos, per excerpts | 2026-11-11 | Fact per excerpt |
| 17 | **Start-up vs enterprise is not defined** on any page read, and nor are the contract term, renewal or termination of the redistribution licence itself. | pricing and product pages | 2026-11-11 | Not published |
| 18 | **Attribution for redistribution** isn't stated on the product pages. Only the developer appendix requires "clearly attributed" for bring-your-own-token apps. No delay wording applies, because the data is real-time derived. | Findings 4–5 | 2026-11-11 | Fact (absence); requirement under the licence unknown |
| 19 | **Marketdata.app Commercial** (for comparison): **display**: the addendum allows display "inside charts, dashboards, and other human-readable interfaces"; programmatic redistribution (APIs, bulk feeds, exports) is prohibited without written approval; the customer binds its "Downstream Clients" and remains "fully responsible" for their compliance. **Growth**: $333/$666/$999 a month with a quarterly commitment (#382). Its marketing says no exchange fees or per-user fees, but the addendum puts "associated fees or charges imposed by the Venues" and end-user licensing on the customer, which conflict. **Storage**: on termination, delete licensed data, except data built into internal analyses, reports or audit materials made during the term. | marketdata.app/terms/commercial-use-addendum (via search summary; direct fetch returned 404); marketdata.app/pricing | 2026-11-11 | Fact per search summary of its own pages |

## Answers to the Planner's nine points

1. **Display rights.** Publicly, only this: a redistribution licence is needed to show data
   outside your organisation (findings 1–5), and the 24x5 derived data needs no end-user exchange
   licences. **What the licence actually permits is not published.** Mobile app, charts and
   history, a public website, any user cap: none of it is stated. Forbidden on every plan:
   benchmarking, competing products, reconstructable series without written approval (finding
   14), and using the raw IEX fields without your own IEX agreement (finding 7).
2. **Growth.** It's a flat rate (finding 2), so there's no per-user fee and no exchange reporting
   for 24x5 (finding 5). Start-up vs enterprise is undefined (finding 17), and redistribution usage
   limits aren't listed. Exchange fees are not passed through for the derived feeds, per Tiingo.
   The raw IEX fields would bring IEX's own fees.
3. **Storage and derived data.** Percentage gains are allowed if the price can't be rebuilt
   (finding 14). Our screens show a buy price next to a gain, so the price can be rebuilt; that
   needs Tiingo's written approval or the licence's wording (inference). On storage, the terms
   reportedly require deleting **all** Tiingo data, backups included, when a paid plan ends
   (finding 15). That would reach `week_snapshots`, `trades` fill prices and chart caches. It's
   the clause to negotiate out, or confirm, before building on Tiingo.
4. **Attribution.** Not published for the redistribution licence. Expect at least "Data provided by
   Tiingo"-style credit (inference from finding 4). No delay wording, since the data is real-time.
5. **"Real-time IEX Derived" vs "24x5":** see findings 6–8. Both are Tiingo-computed reference
   prices, not raw exchange prints. 24x5 draws on many venues, updates every 250 ms, and covers
   evenings and overnight. `tngoLast` can be a mid price, not a trade.
6. **Fit to our calls:** see the table below.
7. **Fundamentals.** `marketCap` daily and SIC-based sector and industry are in the add-on.
   Redistribution add-on: $200 (start-up) or $500 (enterprise) a month. Display terms not
   published. Coverage figures conflict (finding 13).
8. **Contract.** See finding 16. Organisations must use a Commercial plan (finding 1), and the
   redistribution licence's own term, renewal, termination and liability terms are unpublished. An
   individual can hold an Individual plan, but whether an individual may sign a redistribution
   licence isn't stated.
9. **What only Tiingo can answer:** see the draft question below.

### Fit to our needs (the #382 per-need table, with a Tiingo endpoint for each)

| Need | Tiingo endpoint | Fit / gap |
|---|---|---|
| On-screen latest prices | 24x5 snapshot (`/tiingo/equity/intraday[/<ticker>]`) or IEX (`/iex`) | Fits. Show `tngoLast` or `lqRefPrice`, which is a reference price, not a trade print |
| Monday open / Friday close for scoring | EOD (`/tiingo/daily/<ticker>/prices`) `open` / `close` | Fits, if Friday's close may be read after about 5:30 p.m. ET and corrections until 8 p.m. are allowed for. Whether it's the official close isn't stated. One request per ticker (finding 10) |
| Draft-time live prices in batches (auto-pick, 50-symbol queue) | 24x5 or IEX **all-tickers** endpoint, filtered on our side | One call returns everything, so batch size isn't a constraint. A documented `tickers=` parameter wasn't found. Redistribution rate limits unknown (finding 11) |
| Market cap for ranking and draftability | Fundamentals daily (`marketCap`) | Add-on. Coverage "5,500+" vs "14,000+" conflict. ETFs probably lack it (inference); SEC shares outstanding (#382) could fill gaps |
| Market calendar | **None found** in the docs read | Gap. Use the NYSE's published holidays (#382) |
| Symbol universe with categories | Meta / `supported_tickers.zip` (ticker, name, exchange); fundamentals meta (SIC sector/industry) | Fits, but categories come from SIC instead of Finnhub's industry names, so `category_rules` would need remapping. Asset-type field in the zip file not confirmed |
| Corporate actions (splits, dividends) | Included in Base Equities; docs at `/documentation/corporate-actions/*` | Fits (not read in detail) |

**Coverage against our `symbols` table** (about 14,750 active US equities and ETFs per CLAUDE.md):
IEX and 24x5 claim 14,000+ tickers and "about 98% of end-customer use cases". Fundamentals cover
fewer: 5,500+ per the docs. Expect gaps in market cap and industry for smaller names and ETFs. That
is inference; matching against `supported_tickers.zip` would settle it.

## Not found / not sure

- **The redistribution licence agreement itself** (the governing document), and the definitions of
  start-up and enterprise.
- **The full Terms of Use text** (Cloudflare check). In particular, the deletion-on-termination
  clause, the liability cap and governing law were seen only in excerpts, or not at all.
- **Attribution wording** under redistribution, and **usage limits** under redistribution.
- **Batch parameters** for the IEX and 24x5 endpoints, and whether EOD `close` is the official
  close.
- **Uptime and support terms:** none published for these plans (the docs mention "priority
  support" only for the developer program).
- **Marketdata.app's addendum** was read through a search summary (direct fetch returned 404). Its
  marketing and addendum conflict on exchange fees.

## Recommendation

My advice, not a decision.

1. **Tiingo fits technically and is the cheapest published display licence**, about $450 a month
   at start-up list price for prices plus fundamentals. But don't build on it until three things
   are in writing: the redistribution agreement's display scope (mobile app, charts, history,
   whether a public web page is allowed); the start-up definition and price path; and what happens
   to stored prices if the licence ends.
2. **The deletion clause is the scalability risk, not the price.** Our scores, trades and snapshots
   are built on stored prices. A licence that forces deleting them at the end makes switching
   providers later very costly. Ask for a carve-out for prices embedded in game history (fills,
   weekly snapshots), similar to marketdata.app's "internal analyses, reports" exception.
3. **Keep market cap and calendar provider-independent.** SEC shares outstanding and the NYSE
   holiday list (#382) avoid paying for the fundamentals add-on just for market cap and fill
   Tiingo's coverage gap.

## Draft question to Tiingo: NOT TO BE SENT

> **NOT TO BE SENT.** A draft for Giorgio, with no personal or project identifiers; he would add
> them himself.
>
> We're building a free, simulated fantasy stock-market game for iOS: players draft and trade US
> stocks and ETFs with play money in private leagues, with no real money or brokerage. We'd like to
> use your Base Equities redistribution licence (24x5 and EOD) and the fundamentals redistribution
> add-on to (1) show current prices, daily charts and history to signed-in players in the app, and
> possibly on a public web page, (2) price simulated trades and score weekly results on our server,
> and (3) keep those trade prices and weekly snapshots as permanent game history. Could you send the
> redistribution agreement and confirm: what counts as a start-up; whether (1)–(3) are covered;
> whether stored trade and score prices may be kept after the licence ends; the required
> attribution; usage limits; and whether any exchange fees apply?

## Open questions for Giorgio

1. Is a licensed provider at about $450 a month (start-up list price) acceptable as the long-term
   base, before any negotiation?
2. Should prices ever appear on a public web page, or only in the app for signed-in players? It
   changes what to ask for.
3. May the Planner send the draft question above, or should it wait?
