# What do solo and small app developers use for a privacy policy that satisfies Apple, without hiring a lawyer?

Asked by: Giorgio on 2026-11-10 (via the Planner): "i assume not every app that goes on the app
store hires a lawyer for this. can it research what apps/company offer this as a service or
potentially for free? i dont want to assume but feel like theres some new age thing to help vibe
coders or coders with this" · Researcher session · Model: Opus 5.5 (legal and Apple licence reading;
switched by the Orchestrator) · Sources read 2026-11-10 (US Pacific); file dated 2026-11-11 as the
Planner named it. Nothing was signed up for or typed into any generator.

## Short answer

Most small developers use a **policy generator**: a questionnaire that produces a policy and usually
hosts it at a URL. They range from **free and open source** to about **$5–$25 a month**, and some
add attorney-drafted templates with automatic updates when laws change (Termageddon, $119 a year;
iubenda; Termly; GetTerms). The "new age" option exists too: open-source **AI skills that read the
codebase** and draft the policy and Apple's privacy label from it. No generator knows what our app
actually does, so any output is only as good as the data list we feed it (section A). We probably
don't need our own terms for Apple, because Apple's standard licence applies by default, but terms
are useful for the user-content rules.

## A. What the app actually collects (from the repo, `main` @ `28b06317`, read 2026-11-10)

A generator's output is usable only if it covers this list exactly. It builds on section D of
`2026-11-10-app-store-requirements.md`.

| Data | Where | Kept how long (as the code says) |
|---|---|---|
| Email address | Supabase Auth (email/password, Sign in with Apple (may be a private relay address), Google) | Until account deletion |
| Sign-in identity from Apple / Google | Supabase Auth identities; Apple token revoked on deletion (`delete-account`) | Until account deletion |
| Username and avatar | `user_profiles` (`username`; `avatar` is an **emoji text**, default `'📊'`, not a photo) | Until deletion (a deleted seat shows "Open team") |
| Push token | `push_tokens` (one Expo token per user) | Until deletion (`ON DELETE CASCADE`) |
| Notification history | `notification_log` (type, title, body, data, sent time, status) | Not stated in the migration |
| League data and holdings | `leagues` (league names), `league_members`, `drafts`, `trades`, `draft_queue`, `matchups`, standings, watchlist | League history stays after a member leaves (product rule); a deleted account is scrubbed |
| IP addresses (rate limits) | `rate_limit_counters.subject` may be `ip:<address>` (preview/join buckets) | Purged after 2 days (`purge_rate_limit_counters`, STATUS) |
| IP (invite preview) | `invite_preview_limits` keeps only a **salted hash** | Per STATUS #284 |
| Sign-up allowlist emails | `signup_allowlist` (email, note): emails allowed to sign up while sign-ups are paused; admin-only | Not stated |
| Account-deletion ledger | `account_deletions` (user id, stage, Apple-revoke state, last error) | Purged 7 days after it settles (migration `20261125000003` comment) |
| None of: ads, analytics, tracking, purchases, location, contacts, photos | `apps/mobile/package.json` has no such SDK | n/a |

**Third parties.** Supabase (database, auth, functions), Vercel (web), Expo's push service (which
relays to Apple Push), Sign in with Apple, and Google Sign-In all **receive or hold user data**.
**Alpaca and Finnhub** receive only stock symbols and our own server key, not user data, as far as
the request URLs in `supabase/functions` show. That is inference from the code: the policy should
still name them as data sources if it describes where prices come from.

## Findings

| # | Finding | Source (link) | Read on | Fact or inference |
|---|---|---|---|---|
| 1 | **Termly:** Free ($0) gives **1 basic legal policy**, HTML-embeddable. Starter is $10/month billed annually ($14 monthly), with 2 policies and "regular policy updates". Pro+ is $15/month annually ($20 monthly), with unlimited policies, "auto-updated policies" and Termly-hosted policies. Termly says it "works with a team of lawyers and legal experts", and that it is not a law firm and its materials are not legal advice. Terms and EULA generators appear among its products, but which plans include them isn't stated. Mobile apps aren't mentioned. A 50% code ends 2026-11-28. | termly.io/pricing | 2026-11-10 | Fact |
| 2 | **iubenda:** Essentials is $5.99/month annually ($6.99 monthly) for a privacy and cookie policy. Advanced is $24.99/month annually and adds Terms and Conditions. Ultimate is $99.99/month and adds the "Mobile SDK". Updates are "drafted and vetted by our in-house team of international lawyers", and plans stay "current when laws change". A free plan exists but its limits aren't stated; hosted vs export isn't stated. | iubenda.com/en/pricing | 2026-11-10 | Fact |
| 3 | **GetTerms:** Starter is $5/month annually, $9 monthly or **$199 "Lifetime"**. Business is $8, $12 or $249. "A standard Terms of Service document is included with every generated policy." Policies can be hosted, embedded, or exported as HTML, Markdown or PDF. The page says "Written for humans, reviewed by lawyers". The free version carries GetTerms branding; its limits aren't stated. Page modified 2026-10-27. | getterms.io/pricing | 2026-11-10 | Fact (whether "Lifetime" is a one-off charge isn't stated) |
| 4 | **Termageddon:** **$12/month or $119/year** per website or application. One licence covers privacy policy, terms and conditions, disclaimer, **EULA** and cookie policy, plus "Automatic Updates & Email Notifications". Its structured data says it is "founded and maintained by licensed privacy attorneys" (the co-founder is listed as a licensed attorney and CIPP). Hosted vs export isn't stated. It is open to businesses formed in the US, Canada, Ireland, the UK, the EU, Australia and South Africa. | termageddon.com/pricing | 2026-11-10 | Fact |
| 5 | **TermsFeed:** the generator is free and covers mobile apps on iOS and Android; hosting generated policies is free; premium clauses cost a **one-time fee** (amount not found); a subscription of about $10/month is mentioned. TermsFeed's site refused my fetches (403), so this comes from search summaries of its own pages. | termsfeed.com (privacy-policy-generator, help pages), via search | 2026-11-10 | Fact per search summary; **price not verified** |
| 6 | **App Privacy Policy Generator (open source):** "A free, open-source web app to generate privacy policies and terms & conditions" for Android, iOS, KaiOS and Web. **AGPL-3.0**, about 4.9k GitHub stars. It exports HTML or Markdown (you host it), with a one-click "Deploy" to Flycricket. Its disclaimer text didn't render, so I couldn't read it. No last-commit date was shown. | github.com/nisrulz/app-privacy-policy-generator; app-privacy-policy-generator.nisrulz.com | 2026-11-10 | Fact |
| 7 | **AI, codebase-reading:** an open-source Claude Code skill ("privacy-policy", repo rshankras/claude-code-apple-skills, **MIT**) "detects data collection patterns and third-party SDKs", generates a privacy policy, terms and EULA for Apple-platform apps, and maps data to Apple's privacy-label categories. No legal disclaimer or lawyer review is stated. Several other AI-branded generators exist; I found no independent testing of any of them. | agent-skills.md/skills/rshankras/claude-code-apple-skills/privacy-policy; search | 2026-11-10 | Fact (what the page says); quality untested |
| 8 | **Apple's default licence:** "If you don't provide a custom EULA, the standard EULA is applied to your app." It covers a licence to use the app, a warranty disclaimer ("AS IS"), liability capped at **$50**, external services at the user's risk, export rules, and California law. It does **not** cover the developer's privacy practices (beyond technical device data), user conduct (except a line on external services), in-app content rules, or account termination. | developer.apple.com/help/app-store-connect/manage-app-information/provide-a-custom-license-agreement/; apple.com/legal/internet-services/itunes/dev/stdeula/ | 2026-11-10 | Fact |
| 9 | Apple's user-generated-content rule (1.2) says it is "your responsibility to remove content that violates this guideline, **your terms of service, or your community standards**". So an app with usernames and league names benefits from its own short terms or community rules, even though the EULA covers the licence. | App Review Guidelines 1.2 (read for the App Store file) | 2026-11-10 | Fact (quote); the conclusion is inference |
| 10 | **Support URL:** required in App Store Connect. It "must lead to actual contact information (legal address, email address, telephone number), as may be required by local law, so that users can reach you regarding app issues, general feedback, and feature enhancement requests." | developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/ | 2026-11-10 | Fact |
| 11 | **CCPA applies** to a for-profit business that meets **any one** of: revenue over $25 million (adjusted to **$26,625,000** from 2025-01-01); buys, sells or shares personal information of 100,000+ California residents or households; or makes 50%+ of revenue from selling it. | oag.ca.gov/privacy/ccpa (updated 2026-08-28); cppa.ca.gov/regulations/cpi_adjustment.html | 2026-11-10 | Fact |
| 12 | **COPPA** covers a general-audience app only where the operator has "actual knowledge" it is collecting from a child under 13. "The Rule does not require operators to ask the age of visitors." The rule was amended 2025-04-22. | ftc.gov, "Complying with COPPA: Frequently Asked Questions" (first 100,000 characters read) | 2026-11-10 | Fact |
| 13 | **CalOPPA** (Cal. Bus. & Prof. Code §22575) is the California law that requires an online service collecting personal information from California residents to post a privacy policy. Both official pages I tried (leginfo, oag.ca.gov) refused my fetch (403), so **its text was not read** this session. | leginfo.legislature.ca.gov; oag.ca.gov/privacy/privacy-laws | 2026-11-10 | Named, not read |
| 14 | **GDPR Article 13** (if the EU storefront is on) lists what users must be told at collection. Article 13(1): the controller's identity and contact, the DPO if any, the purposes and legal basis, legitimate interests if relied on, recipients, and transfers outside the EU with their safeguards. Article 13(2): retention period, the rights of access, rectification, erasure, restriction, objection and portability, withdrawal of consent, the right to complain to a supervisory authority, whether providing the data is required, and automated decision-making. | gdpr-info.eu/art-13-gdpr/ (a reproduction of Regulation (EU) 2016/679, not the Official Journal) | 2026-11-10 | Fact per reproduction |
| 15 | **No documented App Review rejection was found for using a generated template as such.** 2026 forum threads show reviewers checking policy *specifics*. In one, a rejection under 5.1.1(i)/5.1.2(i) concerned third-party AI data sharing and the reviewer not seeing a consent prompt ("We were not presented with the consent prompt…"), not template wording. | developer.apple.com/forums/thread/820209 (March 2026) and search of 5.1.1 threads | 2026-11-10 | Fact (thread); developer posts, not Apple staff |
| 16 | **One-off lawyer review prices** posted by firms and marketplaces: a marketplace listing showed bids of **$325–$1,975** for a website terms and privacy review; one firm lists **$1,500** per document or **$2,500** for privacy plus terms; another **$1,000** for a website review (implementing the changes not included); a UK firm lists app terms from **£700**. | contractscounsel.com listing; terms.law/services/privacy-policy-review; klemchuk.com/flat-fee-website-review; sprintlaw.co.uk, via search summaries | 2026-11-10 | Vendors' own advertised prices, read through search summaries; not verified individually |

## What this means for Stockpile

**Fit against Apple 5.1.1(i)** (App Store file, finding 1). Apple asks for three things, and
generators handle them differently:

- **"What data, how it's collected, every use"**: a generator asks, and we answer. The answers are
  section A. Every row there must appear, including the less obvious ones: push tokens,
  notification history, rate-limit IPs, the sign-up allowlist and the deletion ledger.
- **"Third parties give equal protection"**: this is a specific Apple sentence. Whether each
  generator's template includes it was **not verified**. Check the generated text for it before
  publishing.
- **"Retention and deletion, how to revoke consent or request deletion"**: generators give generic
  retention wording. Our real facts are specific (immediate account deletion, 2-day IP purge,
  7-day ledger purge) and have to be typed in. The account-deletion plan already said the retention
  line belongs in the policy (`docs/plans/2026-10-21-account-deletion.md:278`).

**Laws a generator's output needs to cover** (named only; whether each applies is a legal call):

- **US launch:** CalOPPA (finding 13); COPPA, which applies only on actual knowledge of under-13
  users (finding 12; a 13+ rating is not itself a COPPA trigger, which is my inference); the CCPA
  if any threshold is met (finding 11; at launch none looks met, which is my inference); other
  states' comprehensive privacy laws, whose thresholds are mostly by consumer count (not read
  individually); and Apple's own 5.1.1(i), which is contractual, not law.
- **If the EU storefront is on:** GDPR (Article 13 contents, finding 14) and its UK counterpart
  (not read). The web pages may also bring EU cookie rules into play (not read). This ties to the
  EU-trader question in the App Store file.

**Do we need our own terms?** Not for Apple: the standard EULA applies automatically (finding 8).
But it doesn't cover what makes this app work: user conduct, usernames and league names, removing
content, closing accounts, league and commissioner rules, and "no real money / not investment
advice". Guideline 1.2 points to "your terms of service, or your community standards" (finding 9).
Short terms would cover those, and most generators below include them.

**Support page (1.5).** Apple's field definition (finding 10) asks for a page leading to "actual
contact information … as may be required by local law". The cheapest honest version: one static
page on the existing web domain (`apps/web` already deploys to Vercel) with a support email address
that is actually read, linked from Profile in the app. Whether a postal address or phone number is
legally required, and which one, is Giorgio's or a lawyer's call. Note the overlap with the EU
trader display, which publishes contact details anyway.

## Not found / not sure

- **TermsFeed's prices** (its site returned 403 to my fetches) and **whether GetTerms' "Lifetime"
  is a one-off charge**.
- **Hosted vs exported output** for Termageddon and iubenda, and the **free-plan limits** of
  iubenda and GetTerms.
- **The full disclaimers** of the open-source generator (its disclaimer text didn't render) and of
  Termageddon and GetTerms (not on their pricing pages).
- **The text of CalOPPA** (403 on both official sources), the **UK GDPR**, EU cookie rules, and
  other US states' privacy laws.
- **Whether each template includes Apple's "equal protection" sentence.** It can only be checked on
  generated output, which I did not produce.
- **The quality of any AI generator.** None has independent testing that I found.
- **Lawyer-review prices** come from vendors' own pages via search summaries.

## Recommendation

My advice, not a decision. Three options I'd put in front of Giorgio:

| Option | Cost | Trade-off |
|---|---|---|
| **1. An attorney-built generator with updates: Termageddon** (or GetTerms at a lower price, "reviewed by lawyers") | $119/yr (Termageddon); about $60–$108/yr or $199 "Lifetime" (GetTerms) | Privacy policy, terms and EULA in one place, kept current as laws change. Still only as accurate as our answers, and hosting format is unconfirmed for Termageddon |
| **2. Free: the open-source generator or TermsFeed's free tier, fed from section A** (the codebase-reading AI skill is the same idea, automated) | $0 | Fastest, and the text is ours to host on the web domain. No updates when laws change, and nobody qualified checks it |
| **3. Either of the above, plus a one-off lawyer review before launch** | Generator cost plus roughly $1,000–$2,500 for a flat-fee review (finding 16) | The only option where someone qualified reads it against our real data flows. Worth it if the EU storefront goes on or real money ever comes |

Whichever he picks, the input is section A. I'd also keep the generated policy in the repo next to
the data list, so a new table or SDK prompts a policy update. The Recorder or Orchestrator can
decide where.

## Open questions for Giorgio

1. Which of the three options (or another)?
2. Is the EU storefront on at launch? It decides whether the policy must cover GDPR.
3. What contact details are you willing to publish on the support page: email only, or also a
   postal address or phone if the law needs one?
4. Do you want short terms of service (user conduct, usernames, league rules, "no real money")
   alongside the policy, or Apple's standard licence only?
