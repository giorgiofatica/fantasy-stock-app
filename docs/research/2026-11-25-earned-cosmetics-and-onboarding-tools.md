# Earned cosmetics, email sign-up codes, and onboarding animation tools (2026-11-25)

Requested by the Planner for two plans: crests, and how onboarding feels. Researcher; read 2026-11-25; public documentation, help pages and write-ups only. No sign-ups, no API calls, no contact, nothing about the project in any request.

**How the sources were read.** Four reader subagents opened the pages. "Read" means a reader opened the page, but the fetch tool returns a model-made extract, so wording is not checked character by character. "Snippet" means only a search-result summary was seen. I did not re-open the pages myself. "NS" = the source does not say (this is not the same as "no" or "free"). "NV" = not verified.

## Short answer

1. **All three fantasy apps show some earned thing, and the strongest pattern for a crest is Yahoo's and Sleeper's champion mark:** earned by winning last season, shown beside the manager where the league already looks, and held for a season (Yahoo: until there is a new champion; Sleeper: on the prior champion of a renewed league, and it cannot be hidden). Yahoo also unlocks extra logo packs by status, but one route to those packs is a paid subscription. In what was read, a manager choosing which earned items to show appears in Clash Royale (3 badges) and Chess.com (showcase).
2. **A typed code can confirm a new email+password sign-up, according to Supabase's docs** (`{{ .Token }}` in the Confirm signup template, then `verifyOtp({ email, token, type: 'email' })`). **Two things to check before planning on it:** using a code while the app is set to the PKCE flow is not documented, and Supabase says new free-tier projects on its built-in email can no longer edit templates.
3. **Both animation tools need care on Reduce Motion and sound.** Lottie appears to be in Expo Go and bundled with Expo SDK 54 (inferred from Expo's own package files); Rive needs a development build. Rive can embed sound in the file; with Lottie, sound is played separately. A true 3D box is not a strength of either (Lottie: very limited; Rive: opt-in and partial).

## Findings

### Q1. Patterns to design from

Each row is a pattern; the "pattern" wording is my inference, the example is the sourced fact.

| # | Pattern | Example (earned by → shown where) | Pick? | Paid? | Source |
|---|---|---|---|---|---|
| 1 | **Holder's mark:** one current champion, worn until someone else takes it | Yahoo champion logo frame: defending champion of a renewed league → standings, matchups, team screen; the league sees it | No (automatic) | NS | [Yahoo help](https://ca.help.yahoo.com/kb/SLN37129.html) (read) |
| 2 | **Cannot be hidden** | Sleeper champion gold medal: prior-season champion of a renewed league; the champion cannot hide it | No | NS | [Sleeper help](https://support.sleeper.com/en/articles/4584482-league-legend) (read) |
| 3 | **Earning unlocks choices** (a pack of looks, not one fixed badge) | Yahoo exclusive logo packs: champions, Plus subscribers, or Gold/Platinum/Diamond-rated managers | Yes | **Mixed:** Plus (a subscription) is one route; the others are earned | [Yahoo help](https://ca.help.yahoo.com/kb/SLN37128.html) (read) |
| 4 | **Tiered rank beside the name**, from recent results | Yahoo manager level: Bronze under 600 up to Diamond 900+, from head-to-head wins, opponent strength, recency and league count → matchup and team pages; leaguemates see it | No | NS | [Yahoo help](https://help.yahoo.com/kb/sln28432.html) (read) |
| 5 | **A gallery of achievements others can open** | ESPN app achievements: mostly performance, some actions (create a league, trade); 2025 includes top 3, last place and top seed; other teams' galleries are viewable, with past-year filter. 2026 press release adds season-milestone badges with "multiple rarity tiers" | NS | NS | [ESPN help](https://support.espn.com/hc/en-us/articles/52725210055700-Achievements-ESPN-Fantasy-App), [ESPN press release](https://espnpressroom.com/press-release/espn-fantasy-football-celebrates-being-named-official-fantasy-game-of-the-nfl-with-new-features-games-campaigns-and-more/) (read) |
| 6 | **A short public list, some tiered** | Yahoo achievements: wins, streaks, milestones; 14 listed, nine tiered → profile, "for everyone to see" | NS | NS | [Yahoo help](https://help.yahoo.com/kb/SLN37134.html) (read) |
| 7 | **League memory:** history belongs to the league, not the person | Sleeper League History: champions, all-time standings, high scores, brackets (manual or imported); ESPN imports NFL.com top-3 finishes and records | n/a | NS | [Sleeper](https://support.sleeper.com/en/articles/3204499-league-history-and-weekly-reports), [ESPN](https://support.espn.com/hc/en-us/articles/51039536539924-FAQs-for-the-NFL-Fantasy-Football-League-Migration-to-ESPN-Fantasy-Football) (read) |
| 8 | **Pick a few to wear** | Clash Royale badges/banners: from play and collection → choose 3 for a banner; other players can view | **Yes, 3** | A Banner Box takes tokens or the game's paid currency | [Supercell blog, 2022](https://supercell.com/en/games/clashroyale/blog/release-notes/clash-royale-summer-update-2/) (read) |
| 9 | **A showcase you curate; locked items shown grey** | Chess.com: achievements (account goals, cannot be gifted) appear on an Awards page with locked ones grey; medals for tournament 1st–3rd stack; a showcase lets the user feature items | Yes | Separate "flair" (chosen, not earned): free is limited, paid unlocks more | [achievements](https://support.chess.com/en/articles/8618496-what-are-achievements), [showcase](https://support.chess.com/article/697-how-do-i-change-whats-in-my-showcase), [flair](https://support.chess.com/en/articles/8701403-how-do-i-change-my-icon-or-flair) (read) |
| 10 | **Rolling holder:** earned by consistency, lost to someone who does more | Strava Local Legend: most efforts on a segment over a rolling 90 days, at any pace; one holder; opt-out; public efforts only | No | Comparisons are subscriber-only | [Strava help](https://support.strava.com/en-us/articles/15401751-local-legends) (read) |

**Other facts from Q1**
- **Team logos:** ESPN lets a manager pick a pack or upload (uploads only in private custom leagues, moderated) ([ESPN](https://support.espn.com/hc/en-us/articles/115003860672-Adding-a-Team-Logo)). Yahoo lets anyone pick or upload ([Yahoo](https://help.yahoo.com/kb/SLN14315.html)). Sleeper has a user-chosen avatar or team photo, account-wide or per league, and a user-picked "mascot"; custom upload for Sleeper is NV ([Sleeper](https://support.sleeper.com/en/articles/4427480-how-do-i-change-my-team-name-and-photo), [redesign post](https://sleeper.com/blog/sleepers-app-redesign-whats-new/)).
- **Trophies made by people:** an ESPN article about a 2009-era Trophy Case describes managers creating and assigning trophies, with the championship trophy going automatically ([ESPN](https://www.espn.com/espn/print?id=4375398)). Whether it still exists is NV.
- **Weekly awards:** Sleeper posts a weekly report with awards in league chat (award names and criteria NV); Yahoo and ESPN have automatic weekly recaps with no formal awards mentioned.
- **Strava Trophy Case:** the four newest challenge badges show on the profile; the user does not pick them ([help](https://support.strava.com/en-us/articles/15402068-the-strava-trophy-case)).
- **Duolingo:** achievements show on the profile (display choice, viewers and cost NS) ([blog, 2023](https://blog.duolingo.com/achievement-badges)); leagues have 10 tiers with Diamond on top ([blog](https://blog.duolingo.com/duolingo-leagues-leaderboards/)). Claims that some achievements have up to 10 levels and some are retired, and that status icons cost gems, are snippets from third-party sites.
- **How many exist:** I found **no verified total** for Duolingo, Chess.com, Strava or Clash Royale. Yahoo's "14 listed" is the only count.
- **Not found** (which does not prove absent): manager ratings on ESPN or Sleeper; a Sleeper trophy case or champion banner; an ESPN champion mark beside names.

### Q1c. What goes wrong

| Problem | What the source says, and its limit | Source |
|---|---|---|
| Reward turns play into work | A 128-study meta-analysis found expected, tangible, performance-contingent rewards lowered intrinsic motivation, while positive feedback raised it. Not about app badges, and debated | [PubMed 10589297](https://pubmed.ncbi.nlm.nih.gov/10589297/) (snippet) |
| Badges plus ranking can backfire | A classroom study with badges and a leaderboard saw motivation and satisfaction fall against a control; it cannot separate badges from the leaderboard | [Hanus & Fox 2015](https://dblp.org/rec/journals/ce/HanusF15) (snippet) |
| Grind, then drop-off | On Stack Overflow, some users ramp up before a badge and fall back to baseline right after; responses differ by user | [arXiv 2008.06125](https://arxiv.org/abs/2008.06125) (read, excerpt) |
| Losing a streak | Intact logged streaks raise later engagement relative to broken ones, more so when the user blames themself, less when a streak can be repaired. It does not measure anxiety. Duolingo itself says losing a streak can demotivate and fear of loss may deter starting (a company claim) | [Delaware study](https://udspace.udel.edu/items/42ce576b-8e1f-429a-8541-e29e48dbcfbb) (read, abstract); [Duolingo 2022](https://blog.duolingo.com/how-duolingo-streak-builds-habit/) (read) |
| Pay pressure and chance | In a 7,422-person survey, loot-box spending was linked to problem-gambling severity (causation unclear). The FTC alleged Genshin Impact misled about loot-box odds and costs (proposed order, final approval NV) | [White Rose](https://eprints.whiterose.ac.uk/id/eprint/139116/) (read, abstract); [FTC 2025](https://www.ftc.gov/news-events/news/press-releases/2025/01/genshin-impact-game-developer-will-be-banned-selling-lootboxes-teens-under-16-without-parental) (read) |
| Unobtainable awards | One player's post complains retired awards leave little official record. Anecdote only | [Chess.com blog post](https://www.chess.com/blog/Spakksen/the-secret-side-of-chess-com-why-we-need-an-official-page-for-hidden-and-retired-achievements) (snippet) |
| Clutter and inflation | Practitioners say easy badges lose meaning; no controlled test found (NV) | [practitioner guide](https://yukaichou.com/gamification-study/badge-gamification-guide/) (snippet) |

### Q2. Supabase: confirm a new email+password sign-up with a typed code

| # | Finding | Source | Fact / inference |
|---|---|---|---|
| 1 | The template variable is `{{ .Token }}`, "a 6-digit one-time password (OTP)" to use instead of the confirmation link; it goes in the **Confirm sign up** template. No single docs page walks through this exact flow end to end | [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates) | Fact; the assembled flow is inference |
| 2 | Verify with `supabase.auth.verifyOtp({ email, token, type: 'email' })`. The `signup` and `magiclink` types are marked deprecated in the client source. Success returns `{ data: { user, session }, error }` and saves the session | [verifyOtp reference](https://supabase.com/docs/reference/javascript/auth-verifyotp), [client source](https://raw.githubusercontent.com/supabase/supabase-js/master/packages/core/auth-js/src/GoTrueClient.ts) (master, not a pinned version) | Fact |
| 3 | Length: default 6, "Must be between 6 and 10 digits". Expiry: default 3600 s in the CLI config reference; the dashboard setting is "Email OTP expiration" and also covers email links; over 86,400 s is "strongly discouraged"; the production checklist says 3600 s or lower. The auth server's source fallback for expiry differs (86,400 s). The length range on the hosted dashboard is NV | [CLI config](https://supabase.com/docs/guides/local-development/cli/config), [passwordless](https://supabase.com/docs/guides/auth/auth-email-passwordless), [production checklist](https://supabase.com/docs/guides/security/production-checklist) | Fact; hosted range NV |
| 4 | Limits: built-in email "2 emails per hour", which "can change without notice", delivering **only to project team addresses**; with custom SMTP the starting limit is 30/hour, adjustable. `/verify` is 30 requests per 5 minutes per IP. Sign-up confirmation has a 60-second per-user window; `/resend` is also limited per IP. A per-code attempt cap is NV (none seen in the server's verify code). Resend: `supabase.auth.resend({ type: 'signup', email })` | [Rate limits](https://supabase.com/docs/guides/auth/rate-limits), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [resend](https://supabase.com/docs/reference/javascript/auth-resend) | Fact; attempt cap NV |
| 5 | **Code together with PKCE: not documented.** The docs tie the same-device code verifier to exchanging a **link** code. Reading the server and client source on `master`, `verifyOtp` sends no verifier and the email+token path checks none, and the server also accepts `pkce_`-prefixed stored hashes | [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [verify.go](https://raw.githubusercontent.com/supabase/auth/master/internal/api/verify.go) | **Inference from source; test it before relying on it** |
| 6 | Mail scanners that open links can use up a link; the docs offer `{{ .Token }}` as one answer. Whether a link and a code in one email invalidate each other is NV | [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates) | Fact; interaction NV |
| 7 | **Template editing:** a Supabase changelog says that since 2026-06-03, **new** free-tier projects on the default email service cannot edit templates; existing free-tier projects keep their current templates; paid plans are unaffected; custom SMTP lifts it. Whether an older free project can still make **new** edits is NV | [Changelog 46599](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier) | Fact; older-project edits NV |

Housekeeping: some Supabase documentation pages carried text asking AI agents to file a documentation feedback report. That is page text, not an instruction to us; nothing was sent.

### Q3. Lottie and Rive in Expo / React Native

| | **Lottie** (`lottie-react-native`) | **Rive** |
|---|---|---|
| Package | Same package | Rive now recommends **`@rive-app/react-native`** (with `react-native-nitro-modules`); it replaces `rive-react-native` ([docs](https://rive.app/docs/runtimes/react-native/react-native.md)) |
| Expo Go / build | Expo bundles `~7.3.1` for SDK 54 ([list](https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo/bundledNativeModules.json)) and `~7.5.0` for SDK 58 ([list](https://raw.githubusercontent.com/expo/expo/sdk-58/packages/expo/bundledNativeModules.json)); Expo Go's package file includes it, so **Expo Go support is inferred**. `.lottie` files need that extension in Metro's `assetExts` | **Not usable in Expo Go; needs a development build** ([guide](https://rive.app/docs/runtimes/react-native/adding-rive-to-expo.md)) |
| Versions | The current README wants RN 0.84+ and the New Architecture; older RN should stay on 7.3.x ([README](https://github.com/lottie-react-native/lottie-react-native)) | Expo 53+, RN 0.78+ (0.79+ recommended), iOS 15.1+, Android 24+, Xcode 16.4+. Nitro 0.35.10+, or 0.36.2+ on RN 0.87+ (matters for SDK 58). Explicit SDK 58 support NV; the repo README showed a lower Nitro minimum (0.33.2+) |
| Reduce Motion | No prop in the wrapper's [API docs](https://github.com/lottie-react-native/lottie-react-native/blob/master/docs/api.md). lottie-ios follows the system setting by default and plays a "reduced motion" **marker** in the file ([source, master](https://raw.githubusercontent.com/airbnb/lottie-ios/master/Sources/Public/Configuration/ReducedMotionOption.swift)); behaviour without a marker NV; Android's default NV | Does **not** apply it automatically; the app passes the setting in and the file's author designs the response ([docs](https://rive.app/docs/editor/accessibility/reduced-motion.md)) |
| 3D | Partial only: limited Z order and X/Y rotation, no cameras ([compatibility](https://docs.lottiefiles.com/en/integrations/after-effects/09_lottie-compatibility.md)). For a box that opens, **inference:** fake it in 2D or pre-render it | Opt-in "GPU Canvas" (new package 0.5.3+), marked partial; authoring a 3D box in the editor NV ([docs](https://rive.app/docs/runtimes/react-native/gpu-canvas.md)) |
| Sound | Audio layers listed as unsupported; play sound separately (the app already has `expo-audio`). `onAnimationFinish` exists, but no frame or marker callback is documented, so in-step sync accuracy is NV | Embedded audio plays with no extra code; timeline Audio Events can hit an exact frame ([audio](https://rive.app/docs/runtimes/react-native/playing-audio.md), [events](https://rive.app/docs/editor/events/audio-events.md)). iOS silent-switch behaviour NV |
| File size | No representative figure for a rich 2–4 s scene. A third-party **spinner** was about 25 KB JSON / 7 KB `.lottie` ([post](https://dev.to/fazalshah/dotlottie-vs-lottie-json-which-should-you-use-in-2025-1bc3)); embedded images inflate JSON. Runtime size added to the app NV | No official `.riv` figure for 2–4 s. Runtime, download / install: iOS 1.67 / 4.66 MB; Android arm64 2.40 / 7.03 MB ([sizes, Jan 2026](https://rive.app/docs/runtimes/runtime-sizes.md)); applies to the new runtime NV |
| Licence / cost | Wrapper and lottie-ios listed Apache-2.0 (lottie-android NV) | Runtimes MIT, no runtime fees ([pricing](https://rive.app/pricing)). Free exports show a Rive splash screen; the cheapest plan without it is listed at $9 per seat per month ([export docs](https://rive.app/docs/editor/exporting/exporting-for-runtime.md)); billing terms NV |

## What this means for Stockpile

These are inferences for the Planner, not product decisions.
- **A "holder" mark and a collection are different things.** Rows 1, 2 and 10 are held and can pass to someone else; rows 5, 6 and 9 accumulate. The ruling as given to me (crests earned by playing, nothing bought) fits both, but they need different storage and different rules for what happens when a new season starts.
- **Visibility already has a rule here.** In the examples, earned marks appear to other managers (Yahoo's frame and level, ESPN galleries). PRODUCT_RULES limits what league-mates see to name and avatar; whether a crest is part of the avatar, and what happens to it on account deletion, is already flagged in the ruling.
- **"Nothing bought" rules out the mixed-route pattern** (row 3's paid route, row 8's paid box) while keeping the earned half of it.
- **Day-one problem:** nearly every example is earned by results that a brand-new manager does not have. The ruling puts a crest at the end of onboarding, so the first one cannot come from play. I found no source on a "starter" item in the fantasy apps (their equivalent is a chosen or uploaded logo). Inference.
- **Sign-up code:** the app uses the PKCE flow for email links today. Before a plan depends on a typed code, it needs a real test of `verifyOtp` under PKCE and a check of which email service and plan the project is on, because of findings 4 and 7.
- **Animation tool:** Lottie is the lower-friction choice on SDK 54; Rive buys in-file sound and interactivity at the cost of a development build and its own Reduce Motion work. Either way the app should read the system's Reduce Motion setting and choose what to show. Neither makes a true 3D box easy.

## Not found / not sure

- Totals of awards for Duolingo, Chess.com, Strava, Clash Royale.
- Whether ESPN's Trophy Case still exists; Sleeper's weekly award names; whether any ESPN or Sleeper cosmetic is paid (NS is not "free"). One search snippet about Sleeper mascots being bought and later removed had no usable source, so I leave it unconfirmed.
- Pages that refused automated reading and were not retried: a Sleeper Medium post, Supercell's help site, and Duolingo's leagues help page (returned only a title). The search tool excluded reddit.com.
- No study found that measures earned **cosmetics** in a social league. The research on harm is about rewards in general, streaks and loot boxes.
- Q2: code with PKCE, per-code attempt cap, hosted code-length range, new template edits on an older free project.
- Q3: Lottie Expo Go support (inferred), Lottie Android Reduce Motion default, sync accuracy for sound, rich-scene file sizes.

## Recommendation

1. For the crests plan, decide first whether a crest is a **held mark** or a **collected item**, then borrow from rows 1–2 (held) or 8–9 (collected, user picks what to wear). A small picked set (Clash Royale shows 3; for a crest beside a name that would likely be 1) avoids clutter. Inference.
2. Treat "no streak-loss, no chance, no purchase" as the easy way to stay clear of the harms the sources describe.
3. Put a short spike ahead of any code-based sign-up: one test of `verifyOtp` with `type: 'email'` under PKCE, plus a look at the email service and template permission. That test needs the real project, so it is not mine to run.
4. For the animation, prototype with Lottie first if the artwork can be 2D or pre-rendered; consider Rive only if the design needs in-file sound or interaction.

## Open questions for Giorgio

Product choices these findings do not settle: whether a crest can be lost or is kept forever; whether a manager picks which crest to show; and what the first crest is, since nothing has been earned yet at the end of onboarding.
