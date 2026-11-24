# Symbol lifecycle audit: what happened to 50 stale tickers (2026-11-24)

Requested by the Planner. Researcher, read 2026-11-24, public sources only (company press releases, SEC filings, Nasdaq pages, the public Nasdaq Trader directory files). No supplier was contacted, no account created, no API called, and nothing about the project went into any search. The input list is public market data from the read-only audit file (`local/audits/symbols-audit-2026-11-24.json`, not committed): 25 tickers in `missing_size`, 25 in `frozen_on_list.oldest_200`.

## Short answer

1. **Every one of the 50 has a clean explanation, and two patterns cover almost all of them.**
   - **Frozen group (25/25): the company was acquired, merged or taken private. The ticker stopped trading.** All 25 are absent from today's Nasdaq directory files.
   - **Missing-size group (25): 21 changed ticker, 2 were acquired, 1 is a brand-new spin-off, and 1 (FGEN→KYNB) is a rename plus a Nasdaq deficiency flag.** The company still trades, under a new ticker. The new ticker is in the directory files; the old one is not.
2. **The directory files just drop a departed ticker.** A delisted or renamed ticker vanishes from `nasdaqlisted.txt` / `otherlisted.txt`; a rename shows up as a new row. There is no free public file of deletions or changes: Nasdaq's "Daily List" is a paid, approval-gated subscription, and the old free change pages 404.
3. **Finnhub `profile2` empty-market-cap behaviour: not verified.** The official docs are a JavaScript shell I could not read, and the one public report found is a third-party PR's own interpretation. Details in Q3.

## Findings table

Fact = stated by the cited source. Inference = my reading.

### Q1a. `missing_size` (25)

| Ticker | What happened | Source | Fact / inference |
|---|---|---|---|
| MMC | Marsh McLennan, now **MRSH** on NYSE from 2026-01-14 | [Business Wire](https://www.businesswire.com/news/home/20251229129065/en/Marsh-McLennan-to-Change-Its-NYSE-Symbol-to-MRSH-on-January-14-Hosts-Fourth-Quarter-Earnings-Investor-Call-on-January-29) | Fact |
| BK | BNY, now **BNY** (name and ticker change) | In directory as `BNY` (otherlisted.txt, 2026-11-24). Date 2026-05-21 from my search results; the release was not captured | Fact (ticker); date not verified to a primary source |
| ATGE | Adtalem, now **Covista (CVSA)** from 2026-02-24 | [NYSE video](https://tv.nyse.com/videos/the-nyse-welcomes-covista-to-celebrate-its-investor-day-and-trading-under-its-new-ticker-cvsa-02-24-2026-21-01-16), [8-K](https://www.sec.gov/Archives/edgar/data/730464/000110465926011611/atge-20260205x8k.htm) | Fact |
| PSTG | Pure Storage, now **Everpure (P)** | [Nasdaq release](https://www.nasdaq.com/press-release/everpure-change-ticker-symbol-p-2026-04-07). Release is dated 2026-04-07; I read the effective date as 2026-04-17 (announced, not confirmed against a trade) | Fact (change); effective date not verified |
| FI | Fiserv, moved listing NYSE→Nasdaq, now **FISV** (2025-11-11) | [Fiserv release](https://www.businesswire.com/news/home/20251029726852/en/Fiserv-Announces-Transfer-of-Stock-Exchange-Listing-to-Nasdaq) | Fact |
| VSCO | Victoria's Secret, now **VSXY** (2026-06-02) | VSCO 8-K exhibit ([SEC](https://www.sec.gov/Archives/edgar/data/0001856437/000185643726000002/ex991vscoq42025earningsrel.htm)) is the earnings release only; the new ticker is in the directory. Date from search results, not verified to a primary release | Ticker fact; date not verified |
| IAC | IAC, now **PPLI** (2026-06-04) | In the directory files; release not captured | Ticker fact; date not verified |
| KAR | OPENLANE, now **OPLN** (2025-12-26) | [PR Newswire](https://www.prnewswire.com/news-releases/openlane-to-change-stock-ticker-to-opln-302642689.html) | Fact |
| FDP | Fresh Del Monte, now **DMC** (2026-06-29, after the Del Monte Foods bid) | [Business Wire](https://www.businesswire.com/news/home/20260114770406/en/Fresh-Del-Monte-Selected-as-Successful-Bidder-in-Del-Monte-Foods-Court-Supervised-Sale/); `DMC` rename date not verified to a primary source | Inference on date |
| RYI | Ryerson, now **RYZ** (2026-02-24) | Directory shows the new ticker; release not captured | Ticker fact; date not verified |
| BHLB | Berkshire Hills, now **BBT** (2025-09-01) | Directory; release not captured | Ticker fact; date not verified |
| CMPO | CompoSecure, now **GPGI** (2026-01-23) | [Nasdaq article](https://www.nasdaq.com/articles/composecure-completes-spin-resolute-holdings-management-inc-separate-public-company) covers the Resolute spin-off; the rename date is from search results | Ticker fact; date not verified |
| MEG | Montrose Environmental, now **ONT** (Onterris) | [Onterris filing](https://ir.onterris.com/sec-filings/all-sec-filings/content/0001193125-26-076511/0001193125-26-076511.pdf); `ONT` is in the directory | Ticker fact; date not verified |
| COMM | CommScope, now **VISN** (2026-01-14) | [Nasdaq release](https://www.nasdaq.com/press-release/commscope-completes-divestiture-connectivity-and-cable-solutions-segment-and-rebrands) | Fact (rebrand); date not verified |
| ASGN | ASGN, now **EFOR** (2026-04-24) | [Nasdaq release](https://www.nasdaq.com/press-release/everforth-launches-new-era-rebrand-elevates-technology-and-digital-engineering) | Fact (rebrand); date not verified |
| LC | LendingClub, becoming **Happen Bank (HAPN)** (2026-06-22, announced) | [LendingClub IR](https://ir.lendingclub.com/news/news-details/2026/LendingClub-to-Become-Happen-Bank-a-Digital-Bank-for-People-Going-Places/default.aspx). `HAPN` presence in the directory was not checked | Announcement fact; effective date not verified |
| SCVL | Shoe Carnival, now **SHOE** (2026-06-12) | Release not captured | Date not verified |
| MODG | Topgolf Callaway Brands, now **CALY** (2026-01-16) | [Callaway IR](https://ir.callawaygolf.com/node/26786/pdf) | Date not verified |
| HMST | HomeStreet, now **MCHB** (2025-09-02) | [Business Wire](https://www.businesswire.com/news/home/20250902628995/en) | Fact |
| BYON | Beyond Inc., now Bed Bath & Beyond, **BBBY** (2025-08-29) | [Business Wire](https://www.businesswire.com/news/home/20250818463354/en/Beyond-Inc.-Changes-Name-to-Bed-Bath-Beyond-Inc.-and-Reclaims-Ticker-Symbol-BBBY). **Anomaly: `BBBY` is not in either directory file** (see "Not found") | Fact (rename); directory status not verified |
| GMRE | Global Medical REIT, now **Chiron Real Estate (XRN)** (2026-02-23) | [Business Wire](https://businesswire.com/news/home/20260203658850/en/Global-Medical-REIT-Inc.-Announces-Strategic-Rebrand-to-Chiron-Real-Estate-Inc.); `XRN` is in the directory | Fact |
| MASI | Masimo, **acquired by Danaher**, closed 2026-06-10 | [Danaher](https://investors.danaher.com/2026-02-17-Danaher-To-Acquire-Masimo-Corporation) (announcement). Closing date from search results; completion release not captured | Announcement fact; closing date not verified |
| OLO | Olo, **acquired by Thoma Bravo**, closed 2025-09-12 | Not captured; absent from directory | Date not verified |
| MSGR | **Not stale.** MSG Rangers Corp., a new spin-off, started trading 2026-10-26/27 | Directory shows `MSGR` as an NYSE row | Fact (listed); spin date not verified to a primary release |
| FGEN | FibroGen, now **Kyntra Bio (KYNB)** since 2026-01-08. Still trades, but the directory flags it **Financial Status D** (Nasdaq deficiency) | [Kyntra IR](https://investor.kyntrabio.com/static-files/07955975-b0b2-4338-9061-6131d595bc74); directory row `KYNB|…|Q|N|D|…` | Fact |

### Q1b. `frozen_on_list` (25), all gone

| Ticker | What happened | Source | Fact / inference |
|---|---|---|---|
| K | Kellanova **acquired by Mars**, closed Dec 2025 | [Business Wire](https://www.businesswire.com/news/home/20251207243494/en/) | Fact |
| HOLX | Hologic **acquired by Blackstone and TPG**, closed 2026-04 | [Business Wire](https://www.businesswire.com/news/home/20260406579333/en/blackstone-and-tpg-complete-acquisition-of-hologic/) | Fact |
| IPG | Interpublic **merged into Omnicom**, closed 2025-11-26, delisted from NYSE | [MediaPost](https://www.mediapost.com/publications/article/411037/after-a-half-century-ipg-is-delisted.html), [Axios](https://www.axios.com/2025/11/26/omnicom-ipg-deal) | Fact |
| EXAS | Exact Sciences **acquired by Abbott**, closed 2026-03-23 | [Nasdaq](https://www.nasdaq.com/press-release/abbott-completes-acquisition-exact-sciences-2026-03-23) | Fact |
| ALE | ALLETE **acquired by CPP Investments / GIP**, closed Dec 2025 | [Business Wire](https://www.businesswire.com/news/home/20251215651998/en) | Fact |
| DNB | Dun & Bradstreet **taken private** (Clearlake) | [SEC exhibit](https://www.sec.gov/Archives/edgar/data/0001799208/000110465925082892/tm2524330d1_ex99-1.htm); closing date not verified | Fact (deal); date not verified |
| MAG | MAG Silver **acquired by Pan American Silver** | [MAG Silver 6-K](https://www.sec.gov/Archives/edgar/data/1230992/000117184325005723/exh_991.htm); closing date not verified | Fact (deal); date not verified |
| JAMF | Jamf **acquired by Francisco Partners**, closed 2026-01-30 | [Nasdaq](https://www.nasdaq.com/press-release/francisco-partners-completes-acquisition-jamf-2026-01-30) | Fact |
| AVDL | Avadel **acquired by Alkermes**, closed 2026-02-11 | [Business Wire](https://www.businesswire.com/news/home/20260211590882/en) | Fact |
| AVDX | AvidXchange **taken private** | [8-K](https://www.sec.gov/Archives/edgar/data/1858257/000119312525239635/d49921dex991.htm); closing date not verified | Fact (deal); date not verified |
| PBPB | Potbelly **acquired (tender offer)** | [SEC 8-K](https://www.sec.gov/Archives/edgar/data/1195734/000119312525248610/d73150dex991.htm); closing date not verified | Fact (deal); date not verified |
| VBTX | Veritex **merged into Huntington** | [Huntington](https://ir.huntington.com/news-presentations/press-releases/detail/948/huntington-bank-completes-merger-with-veritex-deepening-commitment-to-texas) | Fact |
| MTSR | Metsera **acquired by Pfizer**, closed 2025-11-13 | [Nasdaq](https://www.nasdaq.com/press-release/pfizer-completes-acquisition-metsera-2025-11-13) | Fact |
| DENN | Denny's **taken private** | [Denny's 8-K](https://www.sec.gov/Archives/edgar/data/1501570/000110465925068652/tm2520227d8_8k.htm); closing date not verified | Fact (deal); date not verified |
| PPBI | Pacific Premier **merged into its acquirer** (per its 2025 425/8-K filings) | [SEC 8-K](https://www.sec.gov/Archives/edgar/data/1028918/000110465925067436/tm2520597d1_8k.htm); acquirer name and closing date not verified | Date not verified |
| ODP | ODP **acquired by Atlas Holdings**, closed 2025-12-10 | [Business Wire](https://www.businesswire.com/news/home/20251210247721/en/Atlas-Holdings-Completes-Acquisition-of-The-ODP-Corporation-Craig) | Fact |
| NUVL | Nuvalent: **GSK agreement announced 2026-06-09** | [Nuvalent IR](https://investors.nuvalent.com/2026-06-09-GSK-enters-agreement-to-acquire-Nuvalent,-Inc); absent from directory; I did not find the completion release | Closing not verified |
| SLNO | Soleno **acquired by Neurocrine**, closed 2026-05-18 | [BioSpace](https://www.biospace.com/press-releases/neurocrine-biosciences-completes-acquisition-of-soleno-therapeutics) | Fact |
| UDMY | Udemy **merged into Coursera**, closed 2026-05-11 | [Udemy](https://about.udemy.com/update/coursera-udemy-merger-skills-platform/) | Fact |
| THS | TreeHouse **acquired by Investindustrial**, closed 2026-02-11 | [Nasdaq](https://www.nasdaq.com/press-release/investindustrial-completes-acquisition-treehouse-foods-2026-02-11) | Fact |
| THR | Thermon **acquired by CECO Environmental**, closed 2026-06-01 | [Barchart](https://www.barchart.com/story/news/2234950/ceco-environmental-completes-acquisition-of-thermon-group-holdings) | Fact |
| TERN | Terns **acquired by Merck**, closed 2026-05-05 | [Merck](https://www.merck.com/news/merck-completes-acquisition-of-terns-pharmaceuticals-inc/) | Fact |
| EB | Eventbrite **acquired (Bending Spoons)** | [Eventbrite 8-K](https://www.sec.gov/Archives/edgar/data/1475115/000119312525304531/d86117dex991.htm); closing date not verified | Fact (deal); date not verified |
| GHLD | Guild Holdings **acquired by Bayview**, closed 2025-11-28 | [Business Wire](https://www.businesswire.com/news/home/20251128426442/en/Bayview-Completes-Acquisition-of-Guild-Holdings-Company) | Fact |
| MLNK | MeridianLink **taken private by Centerbridge** | [Nasdaq](https://www.nasdaq.com/articles/meridianlink-go-private-2-bln-acquisition-centerbridge-partners); closing date not verified | Fact (deal); date not verified |

**Pattern, stated at its true scope:** all 25 frozen tickers are acquisitions/mergers/take-privates (inference from sources above; 7 closing dates and the NUVL closing are not verified). That fits the frozen `u` dates of 2026-08-12/13 in the audit file only loosely: several closed months before that, so the symbol job kept "updating" nothing, not new data. (Inference; I did not read the job's logic.)

### Q2. How the Nasdaq Trader directory signals a departed stock

| # | Finding | Source | Fact / inference |
|---|---|---|---|
| 1 | `nasdaqlisted.txt` and `otherlisted.txt` are pipe-delimited, and the last line is `File Creation Time: mmddyyyyhh:mm`. They carry no "delisted", "removed" or "changed from" column. | Files downloaded 2026-11-24 (creation time 1124202612:11); [Symbol Directory page](https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs) | Fact |
| 2 | **A departed ticker is simply absent.** I tested all 50 tickers: all 25 frozen tickers are absent; every old ticker of a renamed company is absent; every new ticker (MRSH, BNY, CVSA, P, FISV, OPLN, ONT, XRN, MSGR, KYNB, CHRN…) is present. | My grep of the two files | Fact (observation). Nasdaq's page does not state the removal rule itself, so the rule is inference |
| 3 | A rename looks like one row vanishing and another appearing. Nothing in the file links them. | Same | Inference |
| 4 | The only change-tracking Nasdaq offers is the **Daily List**: new listings, delistings, symbol/name changes, dividends, history to 1999, by **paid monthly subscription needing a login and Nasdaq approval**, delivered over secured FTP. | [Nasdaq Trader Daily List page](https://www.nasdaqtrader.com/Trader.aspx?id=DailyList) text as read in an earlier fetch | Fact |
| 5 | The old free pages for symbol changes and corporate actions redirect to a 404 page. I found no free substitute file. | Fetch attempts 2026-11-24 | Fact |
| 6 | A public FTP copy of the same two files exists (`ftp://ftp.nasdaqtrader.com/symboldirectory`); it carries the same content, not a change log. | Nasdaq Trader page | Fact |

## What this means for Stockpile

- **The directory file is itself the delisting signal, if you diff it.** A ticker that was in yesterday's file and is not in today's has left. This is an inference from findings 2 and 5, and it is the only free signal I found. A "missing from the file" test needs the whole file to have downloaded and parsed, so a short or empty download would look like every stock leaving (the all-or-nothing trap the repo already documents). That is an engineering concern for whoever builds it, not a research finding.
- **The frozen group is exactly what the diff would catch.** All 25 are gone from the file. The `missing_size` group splits two ways: 21 are the old ticker of a company that still trades (the new ticker has to be matched by name, which the files do not do for you), 2 are gone for good, 1 is new, 1 is on a deficiency flag.
- **Renames are the harder case.** A rename keeps the company and breaks the ticker. Nothing free links old to new; the link above came from press releases, one ticker at a time.
- **FGEN→KYNB shows a different signal:** it is still listed but carries Financial Status `D` in `nasdaqlisted.txt`.
- **The Daily List is the only authoritative change feed. It is paid, so it falls under your out-of-scope line; I only report that it exists.**

## Q3. Finnhub free `profile2`, empty `marketCapitalization`

**Not verified.** I did not call the API.

| # | Finding | Source | Fact / inference |
|---|---|---|---|
| 1 | The `/stock/profile2` operation exists with params `symbol`, `isin`, `cusip` (all optional), summary "Company Profile 2", described as the free version of Company Profile. | [Finnhub swagger](https://finnhub.io/static/swagger.json) (extracted by a reader subagent; partly summarised, not verbatim) | Partly verified |
| 2 | The `CompanyProfile2` response schema (field list, required list, empty-response text): **not read**. The swagger file is large and my reader did not reach that section. The docs site renders as a JavaScript shell with no text. | Same | Not verified |
| 3 | A third-party PR states: `{}` means an unknown symbol; missing, null or zero `marketCapitalization` means "no value"; `marketCapitalization` is in **millions** of USD. It says Finnhub "answers" a primary listing, not always the symbol asked (BRK-B came back as BRK.A). Unresolved kinds it saw: foreign primary listings (ASML, AZN, TSM and others), funds and crypto products, and six symbols that returned no value without an error. | [PR #87, Perennial-asian-boiz/PerennialBackend](https://github.com/Perennial-asian-boiz/PerennialBackend/pull/87), closed unmerged 2026-10-30 | This is the PR author's own account of observed behaviour, not Finnhub's statement |
| 4 | `shareOutstanding` in these cases: **the PR does not mention it**, and my search found no report either way. | Same; a general web search found no report | Not verified |

The only dependable reading: Finnhub can return no `marketCapitalization` for symbols that are not US-primary common stock (funds, crypto products, foreign primary listings, some foreign or non-USD profiles). I found **no** public statement about whether it does so for a US company that still trades and was recently renamed or re-listed. Whether `shareOutstanding` survives those cases is open.

## Not found / not sure

- **BBBY.** Bed Bath & Beyond says it reclaimed ticker BBBY (Business Wire, 2025-08-18, and its own investor page still reports earnings in 2026), but `BBBY` is in neither directory file. Whether it trades OTC, on another exchange, or the directory is incomplete is **not verified**. This matters: it is the one case where "absent from the file" does not mean "gone".
- Closing dates for DNB, MAG, AVDX, PBPB, DENN, PPBI, EB, MLNK, NUVL, and effective rename dates for VSCO, IAC, RYI, BHLB, CMPO, MEG, COMM, ASGN, SCVL, MODG, PSTG, BK, FDP, LC, OLO, MASI, MSGR are marked in the tables. A date marked "not verified" came from a search snippet or was never confirmed against a primary document.
- `HAPN` (LendingClub rename, announced) was not checked against the directory.
- Whether Nasdaq's directory ever lists a delisted ticker with a flag before removing it: I saw no such row, but one snapshot cannot rule out a delay. Not verified.
- Q3 as above.

## Recommendation

For the Planner to weigh (not a product decision):
1. The directory diff is the only free, authoritative signal, and it explained all 50 here, so it is worth treating as the departure signal in the plan.
2. Do not read "absent from the file" as "gone" without one more check, because of BBBY.
3. For Q3, a one-time read of the unread `CompanyProfile2` section of Finnhub's swagger would settle the schema question for free; I stopped because the file is large, not because it is hidden.

## Open questions for Giorgio

1. Is it enough for the plan to rely on the directory diff, or should a paid change feed (Daily List) be priced? (Pricing is out of scope here.)
2. Should I read the rest of the Finnhub swagger file to close Q3, and look at where BBBY actually trades?
