# What does Apple require of an app on the App Store, and does Stockpile meet it as we build?

Asked by: Giorgio on 2026-11-10 ("research apples app requirement for builders that want to make
an app on the app store … look at official apple documentation mainly") · Researcher session ·
Model: Opus 5.5 (App Store reading; switched by the Orchestrator)

## Short answer

Most of Apple's rules are already met: Sign in with Apple next to Google, in-app account deletion
with Apple token revocation, no in-app purchases, no tracking or analytics SDKs, the encryption flag.
**Four things block a first submission:** (1) there is no privacy policy or support page (the web
links are `#`); (2) App Review needs a working demo account, and a league needs four real managers;
(3) Apple requires permission to show third-party data, and Alpaca's support page says its data
cannot be redistributed; (4) the age-rating and user-generated-content answers are Giorgio's to
give. Real-money leagues, if they ever come, add three more rules and need a company, not a
person, as the developer.

## Sources read (all on 2026-11-10)

Apple, primary:
- **App Review Guidelines**, developer.apple.com/app-store/review/guidelines/, "Last Updated:
  October 16, 2026". Read in full (all five sections).
- **Apple Developer Program License Agreement (DPLA)**, developer.apple.com/support/terms/
  apple-developer-program-license-agreement/, section 3.3.1 (the page carries October 29, 2026).
- **Upcoming requirements**, developer.apple.com/news/upcoming-requirements/.
- **Offering account deletion in your app**, developer.apple.com/support/offering-account-deletion-in-your-app/.
- **App privacy details**, developer.apple.com/app-store/app-privacy-details/.
- **Age ratings values and definitions** (App Store Connect Help), developer.apple.com/help/
  app-store-connect/reference/age-ratings-values-and-definitions/ (first 100,000 characters; the
  Korea section at the end was not read).
- **App Review** page, developer.apple.com/distribute/app-review/ (common rejections, demo accounts).
- **Describing use of required reason API**, developer.apple.com/documentation/bundleresources/
  describing-use-of-required-reason-api.
- **EU Digital Services Act trader requirements** (App Store Connect Help), developer.apple.com/help/
  app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/.
- **App Store categories**, developer.apple.com/app-store/categories/.
- **Developer news posts on age laws**: "New requirements for apps available in Texas"
  (2025-10-08, `?id=btkirlj8`), "Next steps for apps distributed in Texas" (2025-11-04,
  `?id=2ezb6jhj`), "Update on age requirements for apps distributed in Texas" (2025-12-23,
  `?id=8jzbigf4`), "Age requirements for apps distributed in Brazil, Australia, Singapore, Utah,
  and Louisiana" (2026-02-24, `?id=f5zj08ey`), "Update for Apps Distributed in Texas"
  (2026-06-03, `?id=sg176nne`), all at developer.apple.com/news/.

Not Apple, each checked against Apple or used only for its own terms:
- **Expo, "Privacy manifests"**, docs.expo.dev/guides/apple-privacy/ (modified 2026-07-29).
  Checked against Apple's required-reason page; only Expo-specific mechanics are taken from it.
- **Alpaca Support, "Can I redistribute Alpaca API data via my platform?"**,
  alpaca.markets/support/redistribute-alpaca-api (dated November 2022). This is Alpaca's own page, so
  it is the primary source for Alpaca's terms. It is not Apple.
- MacRumors, AppleInsider, Engadget and a dev.to post turned up while I searched for the Texas and
  age-assurance dates. **I used none of them as a source.** Every date below comes from Apple's own
  news posts, which replaced them. (The secondary sources disagreed with each other on the Texas
  start date. Apple's posts settle it.)

## Findings

| # | Finding | Source (link) | Read on | Fact or inference |
|---|---|---|---|---|
| 1 | **Privacy policy:** every app must link to its privacy policy both in the App Store Connect field **and inside the app** "in an easily accessible manner". The policy must say what is collected and how, every use, that third parties give equal protection, retention and deletion, and how to revoke consent or request deletion. | Guidelines 5.1.1(i) | 2026-11-10 | Fact |
| 2 | **Support and contact:** "make sure your app and its Support URL include an easy way to contact you". The App Review page adds that a support link with current contact information and a privacy policy link are "required for all apps". | Guidelines 1.5; developer.apple.com/distribute/app-review/ ("Broken links") | 2026-11-10 | Fact |
| 3 | **Completeness (2.1(a)):** a submission must have "fully functional URLs", no placeholder text or empty websites, demo account info for a login, and the backend turned on. A built-in demo mode needs Apple's prior approval. More than 40% of unresolved issues fall under 2.1. | Guidelines 2.1(a); App Review page | 2026-11-10 | Fact |
| 4 | **User-generated content (1.2):** apps that let users "create … share, or otherwise contribute content" must have all four: a filter for objectionable material, a way to report content with timely responses, the ability to block abusive users, and published contact information. | Guidelines 1.2 | 2026-11-10 | Fact |
| 5 | The **age-rating** definition of user-generated content is narrower: the "broad distribution of content created by users". | Age ratings values and definitions, "Capabilities" | 2026-11-10 | Fact |
| 6 | **Account deletion:** an app that supports account creation must offer deletion inside the app (5.1.1(v)). Deletion removes the account record and associated personal data, including user content shared with others. Deactivation alone is insufficient. Apps using Sign in with Apple "should use the Sign in with Apple REST API to revoke user tokens". | Guidelines 5.1.1(v); Offering account deletion page | 2026-11-10 | Fact |
| 7 | **Login services (4.8):** an app that uses a third-party login such as Google Sign-In for the primary account must also offer an equivalent login that limits data to name and email, lets users hide their email, and does not collect interactions for advertising without consent. | Guidelines 4.8 | 2026-11-10 | Fact |
| 8 | That equivalent is what Sign in with Apple provides (email hiding, name and email only). So Apple + Google + email/password satisfies 4.8. | Guidelines 4.8 read against Apple's Sign in with Apple behaviour | 2026-11-10 | Inference (4.8 does not name Sign in with Apple) |
| 9 | **Third-party content (5.2.2):** if an app "displays content from a third-party service, ensure that you are specifically permitted to do so under the service's terms of use. Authorization must be provided upon request." | Guidelines 5.2.2 | 2026-11-10 | Fact |
| 10 | Alpaca's support page answers its own question "Can I redistribute Alpaca API data via my platform?" with "Unfortunately, you cannot redistribute Alpaca API data." The page is dated November 2022, is one sentence long, and does not say whether showing prices inside an app counts as redistribution. | alpaca.markets/support/redistribute-alpaca-api | 2026-11-10 | Fact (Alpaca's words); the scope question is open |
| 11 | **Financial apps (3.2.1(viii)):** apps "used for financial trading, investing, or money management" should be submitted by the financial institution performing those services, with licences where offered. **Regulated fields (5.1.1(ix)):** apps in financial services or gambling should be submitted by a legal entity, not an individual developer. | Guidelines 3.2.1(viii), 5.1.1(ix) | 2026-11-10 | Fact |
| 12 | Neither 3.2.1(viii) nor 5.1.1(ix) mentions simulated or paper trading. Stockpile performs no trading or money service, so on their text neither applies. The risk is a reviewer who reads "stocks + portfolio" as investing. That is handled with metadata and review notes that say "simulated, no real money", not with a licence. | Guidelines text; DR-001 | 2026-11-10 | Inference |
| 13 | **Gaming and contests (5.3):** sweepstakes and contests must be sponsored by the developer, and official rules shown in the app must say Apple is not a sponsor (5.3.1–5.3.2). Real-money gaming needs licences in each location, geo-restriction to those locations, and a free app (5.3.4). In-app purchase may not buy credit for real-money gaming (5.3.3). | Guidelines 5.3 | 2026-11-10 | Fact |
| 14 | **Push (4.5.4):** push must not be required for the app to work, must not carry sensitive information, and is not for marketing without explicit opt-in and an in-app opt-out. | Guidelines 4.5.4 | 2026-11-10 | Fact |
| 15 | **Downloaded code:** the DPLA allows interpreted code to be downloaded only if it does not change the app's primary purpose, does not bypass signing, sandbox or security, and does not create a storefront. Guideline 2.5.2 is the matching rule. This covers over-the-air JS updates (`expo-updates`). | DPLA 3.3.1; Guidelines 2.5.2 | 2026-11-10 | Fact (rule); its application to OTA is inference |
| 16 | **Upload minimums now in force:** built with Xcode 26 or later with the iOS 26 SDK (since 2026-04-28); target iOS 13 or later (since 2026-09-09). | Upcoming requirements | 2026-11-10 | Fact |
| 17 | **Required-reason APIs:** since 2024-05-01, App Store Connect does not accept apps that use a required-reason API (UserDefaults, file timestamp, system boot time, disk space, active keyboards) without declaring the reason in a privacy manifest, including uses inside third-party SDKs. | Describing use of required reason API; Upcoming requirements | 2026-11-10 | Fact |
| 18 | Expo says its SDK packages that use these APIs ship their own `PrivacyInfo` file, that Apple does not always parse those from static CocoaPods, and that app-level reasons go in `ios.privacyManifests` in `app.json`. | docs.expo.dev/guides/apple-privacy/ (checked against #17) | 2026-11-10 | Fact (Expo's words; consistent with Apple's #17) |
| 19 | **App privacy label:** required for new apps and updates, covering third-party SDKs. "Collect" means data sent off the device and kept longer than needed to serve the request in real time. Data counts as optional to disclose only if it meets **all** four criteria (not used for tracking or ads, infrequent, not primary functionality, user-provided each time). Answers can be updated without an app update. | App privacy details | 2026-11-10 | Fact |
| 20 | **Age-rating definitions:** *Contests*: "Events that allow users to compete with one another for rankings, rewards, or the achievement of personal goals". *Simulated Gambling*: "Betting or wagering without using real money …". *Gambling*: the same with real money. Infrequent contests → 4+, **frequent contests → 13+**, infrequent simulated gambling → 13+ (Australia R 18+), **frequent simulated gambling → 18+**, gambling → 18+. | Age ratings values and definitions | 2026-11-10 | Fact |
| 21 | **18+ downloads are now gated in some countries:** since 2026-02-24, Apple blocks downloads of 18+ apps in Australia, Brazil and Singapore unless the user is confirmed to be an adult. | Apple news `?id=f5zj08ey` (2026-02-24) | 2026-11-10 | Fact |
| 22 | **US age-assurance laws:** Texas SB 2420 has applied to new Texas Apple Accounts since 2026-06-04, after a court lifted the injunction (Apple had paused on 2025-12-23). Utah (new accounts from 2026-05-06) and Louisiana (from 2026-07-01) share age categories through the **Declared Age Range API**. Apple frames these as **developers' obligations under those laws**, not as App Review rules, and says it is "the developer's responsibility" to decide what is a "significant change". A change in age rating counts as one under Texas law. | Apple news `?id=sg176nne` (2026-06-03), `?id=8jzbigf4`, `?id=2ezb6jhj`, `?id=f5zj08ey` | 2026-11-10 | Fact (Apple's framing); what Stockpile must do is a legal question |
| 23 | **EU trader status:** every developer must declare trader or non-trader. A trader's phone and email, plus a street address or P.O. box for individuals, are **published on the EU product page**. A non-trader declaration tells EU users that consumer-protection rights do not apply. Without trader status an app is removed from the EU storefront. | DSA trader help page; Upcoming requirements | 2026-11-10 | Fact |
| 24 | **Category:** Games is defined as "single or multiplayer interactive activities for entertainment purposes" (sports and simulation among its examples). Finance covers apps that "perform financial transactions or assist … financial matters" (investment is an example). Sports lists "fantasy sports companions". Picking an inappropriate category is itself against the guidelines. | App Store categories | 2026-11-10 | Fact |
| 25 | **Metadata:** app name ≤ 30 characters, unique, no trademarked terms (2.3.7); name and icons consistent across the store and the device (2.3.8); screenshots show the app in use, with fictional account data (2.3.3, 2.3.9); category fits (2.3.5); age questions answered honestly (2.3.6); new features described specifically in Review Notes (2.3.1(a)). | Guidelines 2.3 | 2026-11-10 | Fact |
| 26 | **Ratings prompt:** use Apple's API; custom review prompts are disallowed (5.6.1). Apps may not force rating or reviewing to unlock features (3.2.2(x)). | Guidelines 5.6.1, 3.2.2(x) | 2026-11-10 | Fact |
| 27 | **iPad:** iPhone apps "should run on iPad whenever possible" (2.4.1). An iPhone-only app still runs on iPad in compatibility mode. | Guidelines 2.4.1 | 2026-11-10 | Fact (rule); the compatibility-mode note is Researcher's knowledge, not re-read today |

## What this means for Stockpile

A correction first, for the Orchestrator's framing: **there are no real-money stake modes.**
`stake_mode` is `fixed_notional | price_tiers | budget_cap`
(`supabase/migrations/20260810000002_leagues_add_stake_mode.sql`), all simulated. DR-001
(`docs/decisions/DR-001-in-house-simulated-trading.md`) defers real-money leagues post-launch.
Everything below treats Stockpile as a free, simulated, fantasy-league game.

### A. Already met (with the evidence)

| Guideline | Stockpile today | Evidence |
|---|---|---|
| 4.8 login services | Sign in with Apple alongside Google and email/password | `app.json` `usesAppleSignIn: true`, `expo-apple-authentication`; Google added by `app.config.js` |
| 5.1.1(v) in-app deletion, SIWA token revocation | Profile › Delete account; `delete-account` calls `revokeAppleToken` | `supabase/functions/delete-account/index.ts`; STATUS 2026-10-22 (server live, screens in 1.3.0 builds). The live phone check is still open per STATUS |
| 5.1.1(x), 5.1.1(iii) data minimisation | No name requested or stored | `apps/mobile/lib/auth/socialSignIn.ts` PRIVACY note (Giorgio, 2026-10-14) |
| 3.1.1 in-app purchase | Nothing is sold | No StoreKit / IAP dependency in `apps/mobile/package.json` |
| 5.1.2 tracking / ATT | No ads, analytics or tracking SDK, so no ATT prompt is needed | `package.json` dependency list |
| 4.5.4 push | Game events only (closed type set); requested via the system prompt | `supabase/functions/send-notification/index.ts` (`NOTIFICATION_TYPES`); `apps/mobile/lib/notifications.ts`. That the app works with push declined is **not verified**: worth one check |
| Export compliance | `ITSAppUsesNonExemptEncryption: false` | `app.json` |
| 17 required-reason APIs | Every build so far (latest 1.3.0 (14)) was accepted into TestFlight, and since 2024-05-01 App Store Connect refuses uploads with undeclared reasons | STATUS build list. This is inference from the upload being accepted; read the build's privacy report before release |
| 16 SDK minimums | Production builds go through EAS on the current SDK | Inference: confirm the Xcode image in the EAS build log is 26.x |
| 2.5.14 recording | `expo-audio` with microphone off | `app.json` plugin config |
| 1.2 filter (1 of 4) | Usernames and league names pass a blocklist | `apps/mobile/lib/contentModeration.ts` (used by `UsernamePicker.tsx`, `create-league.tsx`) |

### B. Needs a decision or build work before the first submission

1. **Privacy policy + support page (1.5, 5.1.1(i), 2.1(a)): build work, blocking.** No policy
   exists. The landing page's "Privacy Policy" and "Terms of Service" links are `href="#"`
   (`apps/web/src/pages/LandingPage.jsx:412-413`), which 2.1(a) treats as placeholder content.
   No in-app privacy link exists (grep of `apps/mobile` for "privacy" finds only code comments).
   Needed: a hosted privacy policy (contents per finding 1; the account-deletion plan already says
   its retention line belongs there, `docs/plans/2026-10-21-account-deletion.md:278`), a support
   page with a working contact, both URLs in App Store Connect, and a link inside the app
   (Profile is the obvious host). Writing the policy is Giorgio's (or a lawyer's) work, not code.
2. **Demo account for App Review (2.1(a)): decision + setup, blocking.** A league needs four
   real managers to draft (PRODUCT_RULES, League size, 2026-10-06), so a reviewer who signs up
   alone sees an empty app. Apple wants "an active demo account". The usual approach is test
   accounts Giorgio controls, already in a league that has drafted, plus Review Notes that explain
   the non-obvious parts: trades only during market hours (a reviewer at night sees the market
   closed), weekly scoring, invite links. A built-in demo mode needs Apple's prior approval and
   would be a product change. The backend must be live during review.
3. **Market-data display rights (5.2.2): decision, blocking in my reading.** The app shows prices
   from Alpaca to every user (`StockSheetBody`, `PortfolioScreen`, `PlayerCard`,
   `symbols-search`, `quote`, `ticker-quotes`). Apple requires permission under the provider's
   terms, provided on request. Alpaca's only public answer I found says its data "cannot" be
   redistributed (finding 10). `apps/mobile/lib/money/moneyCopy.ts:102` already flags the credit
   line "Market data provided by Alpaca" as wording "to confirm with the provider's terms". This
   is the largest open item, and settling it is outside Apple's documents: it needs Alpaca's
   written answer (or their market-data agreement) on in-app display to end users, or a data
   source whose licence allows it.
4. **User-generated content safeguards (1.2): decision.** Usernames and league names are text
   other managers see. 1.2's wording ("create … share") covers them. The age-rating definition
   ("broad distribution") arguably does not, because they stay inside a private league. The filter
   exists. Report, block and published contact do not. My reading: a reviewer may well treat
   names as UGC, and the cheapest safe position is a "Report" path plus the published contact
   from item 1. What "block" means in a closed league of friends is a product question for
   Giorgio and the Planner (FANTASY_CONVENTIONS: the commissioner model).
5. **Age rating and the Contests / Simulated Gambling answers (2.3.6): Giorgio's answers.** See
   section D. The answers decide whether the app is 13+ or 18+, and 18+ blocks downloads in three
   countries.
6. **Category (2.3.5): Giorgio's choice.** Games (Sports/Simulation as secondary, or Sports as
   primary, since Apple's Sports examples include "fantasy sports companions") fits the
   fantasy-league product rule. Finance would invite the 3.2.1(viii) "financial institution"
   reading (finding 12). Researcher's inference: avoid Finance.
7. **Metadata that states the model (2.3, 3.2.1(viii)): build work at submission.** Description,
   subtitle and Review Notes say plainly that the app is a simulated fantasy game with no real
   money, no brokerage and no investment advice. Screenshots use test accounts (2.3.9).
8. **App name (2.3.7, 2.3.8, 5.2.1, 4.1(c)): already a known decision.** The on-device name comes
   from `app.json` `"name": "fantasy-stock-app"`, which differs from any store name, and the
   product name is deferred because "Stockpile" is a live trademark (memory: naming deferred to
   pre-launch). Both the store name and the device name must be settled together before
   submission.
9. **EU trader status (finding 23): Giorgio's choice.** If the developer account is an
   individual, declaring trader publishes a street address or P.O. box, phone and email on the EU
   product page. Declaring non-trader publishes nothing, but is a legal statement about whether
   this is a business. The alternative is leaving the EU out of distribution.

### C. Only if a feature is added later

| If Stockpile adds … | Rules that switch on |
|---|---|
| Real-money leagues (DR-001, deferred) | 3.2.1(viii) and 5.1.1(ix) (submitted by a legal entity / licensed institution); 5.3.4 (licences per location, geo-restriction, free app); 5.3.3 (no IAP for real-money credit); age rating "Gambling" → 18+ (finding 20) and the 18+ download gates (finding 21). The App Privacy "Regulated Financial Services" disclosure rules start to matter |
| Prizes for league winners | 5.3.1–5.3.2: developer-sponsored, official rules in the app, "Apple is not a sponsor" |
| Premium features or subscriptions | 3.1.1 / 3.1.2: in-app purchase only (subscriptions ≥ 7 days, restore mechanism) |
| Ads | 2.5.18 (age-appropriate, report-an-ad, no ads in notifications); ATT if any tracking; privacy-label purposes |
| Analytics (e.g. the onboarding W6 metrics, or PostHog) | Privacy label "Usage Data › Product Interaction"; 5.1.1(ii) consent for usage data "even if … anonymous"; a third-party SDK's own privacy manifest |
| Chat / trash talk | 1.2 in full (report, block, timely response); age rating "Messaging and chat" |
| Photo avatars from the camera roll | 5.1.1(iii) (use the out-of-process picker); privacy label "Photos or Videos". `user_profiles` already has an avatar column (`20251230230000_add_avatar_to_profiles.sql`), but no in-app upload was found |
| Over-the-air updates that add features | Stay inside DPLA 3.3.1 / 2.5.2 (finding 15): an OTA update must not change the app's purpose; ship new features through review |

### D. App Privacy label and age rating

**What the repo shows the app collects** (my reading of the code; the right Apple data type for
each row is App Store Connect's choice, and **Giorgio answers**):

| Data | Where | Likely Apple data type | Linked to user | Purpose | Needs Giorgio |
|---|---|---|---|---|---|
| Email address | Supabase Auth (email/password, Apple, Google; Apple may give a private relay address) | Contact Info › Email Address | Yes | App Functionality | Confirm |
| Name | Not requested or stored (`socialSignIn.ts`) | none | | | Confirm nothing else stores one |
| Username, account id | `user_profiles`, `auth.users` | Identifiers › User ID | Yes | App Functionality | Confirm |
| Push token | `push_tokens` | Identifiers › Device ID (my reading; Apple's page lists Device ID without naming push tokens) | Yes | App Functionality | **Yes**: decide whether to disclose |
| Leagues, picks, trades, queue, watchlist, results | `drafts`, `trades`, `draft_queue`, `matchups`, … | User Content › Gameplay Content | Yes | App Functionality | Confirm |
| League names | `leagues` | User Content › Other User Content | Yes | App Functionality | Confirm |
| IP address (rate limits) | `rate_limit_counters.subject` may be `ip:<addr>` for the preview/join buckets (`20260716000000`), purged after 2 days (STATUS, `purge_rate_limit_counters`); invite preview keeps only a salted hash | Not a named type. Possibly "Other Data Types", or exempt if not kept beyond what serving the request needs | Not linked to account in the table | App Functionality (security) | **Yes** |
| Server logs (Supabase platform, Vercel) | Platform logs keep request metadata for the vendor's retention period | Covered by "third-party partners" in Apple's definition | Varies | App Functionality | **Yes**: ask what each vendor retains |
| Search text | `symbols-search` keeps only per-user hit counters, as far as I read | Search History: probably not collected | | | Verify the function logs no query text |
| Analytics, crash, ads | None in dependencies | none today | | | Re-answer when W6 metrics or any SDK lands |

Tracking: none found, so the label should say "Data Not Used to Track You", with no ATT prompt.

**Age-rating questionnaire, item by item** (definitions in finding 20; the answers are
Giorgio's, because 2.3.6 says to answer "honestly" and a mis-rating can draw regulator interest):

| Item | Stockpile | My reading | Effect |
|---|---|---|---|
| Contests | Weekly head-to-head matchups, standings, playoffs, all season | Fits "compete … for rankings", and frequently | "Frequent contests" → **13+** |
| Simulated gambling | Fake-money portfolios, no stake, no odds, no payout | Does not look like "betting or wagering". Giorgio's call | None → no effect. Infrequent → 13+ and R 18+ in Australia. Frequent → **18+**, which gates downloads in AU/BR/SG |
| Gambling | No real money | None | None. Would be 18+ with real-money leagues |
| User-generated content | Usernames and league names inside private leagues | Arguably not "broad distribution" | Listed among 4+ items; also ties to the 1.2 decision (B4) |
| Messaging and chat | None | None | |
| Advertising | None | None | |
| Unrestricted web access | No in-app browser (`expo-web-browser` is installed but unused) | None | |
| Parental controls, age assurance | None | None | |
| Everything else (violence, sexual, drugs, medical, horror, profanity) | None; the username/league-name filter blocks profanity | None | |

Likely outcome if Giorgio answers as above: **13+**, driven by frequent contests.

**US age-assurance laws (finding 22)** are separate from the rating. In Texas, Utah and Louisiana,
new accounts carry an age category the app can read through the Declared Age Range API (iOS 26+).
Apple calls acting on it the developer's legal obligation. What that obligation is for a free
game with no purchases and no chat is a question for a lawyer, not for App Review documents. I
flag it rather than answer it.

## Not found / not sure

- **Whether Alpaca permits in-app display.** Alpaca's one public answer (November 2022) says no
  redistribution and does not separate display inside an app from resale. Their customer and
  market-data agreements were not read (one search turned up only third-party copies and memos,
  which I did not use). Settled by: Alpaca's written answer, or reading the agreement that
  Stockpile's Alpaca account is actually under. This could be its own research task.
- **Whether App Review treats usernames and league names as UGC.** Apple's two definitions
  differ (findings 4 and 5). No Apple page addresses closed-group names. Settled only by
  submitting, or by asking App Review in advance through App Store Connect.
- **How Apple classifies push tokens and rate-limit IPs** on the privacy label. The page lists
  data types without naming either. Judgement, recorded in section D.
- **Whether the app works with push declined**, and whether **any build has been opened on an
  iPad**. Neither was checked.
- **The account type** (individual or organisation) is not in the repo. It matters for the EU
  trader display (finding 23) and, if real money ever comes, for 5.1.1(ix).
- **The Korea section** of the age-rating page was not read (it was past the fetch limit).
- **Apple's App Review Guidelines change often** (this edition is 2026-10-16). Re-read them
  before submission, and re-check the age-law posts: the Texas position changed twice in eight
  months.
- **Expo's privacy-manifest mechanics** rest on Expo's own page. The rule they serve (finding 17)
  is Apple's.

## Recommendation

My advice, not a decision.

1. **Start the three blockers that take outside time now:** the privacy policy and support page
   (Giorgio, perhaps with a lawyer), the Alpaca data question (an email to Alpaca, or a separate
   research task), and the age-law question (a lawyer). None needs app code yet, and they gate
   submission more than any build does.
2. **Build the two small in-app pieces with the next UI pass:** a Privacy Policy and a Support
   link on Profile, and a Report path for usernames and league names. That closes 1.2's "report"
   and 1.5's "contact" in one place, whichever way the UGC question falls.
3. **Answer the age questionnaire as a 13+ app** (frequent contests; simulated gambling "None"),
   if Giorgio agrees that the game is not betting. Write the reasoning into Review Notes. The
   trade-off: if a reviewer disagrees and re-rates it 18+, downloads are gated in three
   countries. A cautious "Infrequent simulated gambling" costs an R 18+ in Australia.
4. **Pick Games as the primary category, and say "simulated, no real money" everywhere** a
   reviewer looks (description, subtitle, Review Notes, the first screen they see). Finance would
   invite the "financial institution" reading.
5. **Plan the review kit like a release step:** a pre-drafted league of test accounts, the demo
   login, notes covering market hours and weekly scoring, and the backend checked live during
   the review window.
6. **Turn section A into a pre-submit checklist** in `docs/` (the Orchestrator's or the Recorder's
   call), so each build re-checks these rules rather than relying on memory.

## Open questions for Giorgio

1. Is the Apple Developer account in your name or in a company's? (EU trader display, and any
   future real money.)
2. Do you want the EU storefront at launch? If yes: trader or non-trader?
3. Is Stockpile, in your words, "betting or wagering"? Your answer sets 13+ versus 18+.
4. Who writes the privacy policy and terms: you, a template service, or a lawyer?
5. Will you ask Alpaca directly whether in-app display of its prices is allowed under your
   account, or should the Planner open a separate research task on market-data licences?
6. Primary category: Games or Sports?
