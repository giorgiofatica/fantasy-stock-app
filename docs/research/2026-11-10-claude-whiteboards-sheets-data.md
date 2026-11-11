# Are Claude Whiteboards, Sheets and Data useful for what we're building, now or after launch, especially for tracking how the app is used?

Asked by: Giorgio on 2026-11-10 · Researcher session: Researcher (quizzical-lumiere-85ec0f) · Model: Opus 5.5

## Short answer
Yes, but they are tools for you, not features for players. **Claude Data** helps most. A live dashboard over the Supabase database can show today's health checks, and later signups, leagues, drafts and trades. Before it can show usage funnels, the app has to start recording events: the onboarding plan's three metrics aren't built yet. Sheets and Whiteboards are useful for trackers and for thinking, but the record still lives in the repo.

## Findings
| # | Finding | Source (link) | Read on | Fact or inference |
|---|---|---|---|---|
| 1 | Announced 2026-11-10: Whiteboards (beta), Sheets (beta), and Data, which was Dashboards and is now generally available. The Claude account's post: "build a tracker in a sheet, and tell a story with your data." | [Anthropic article](https://claude.com/resources/articles/sheets-whiteboards-data); [Claude on X](https://x.com/claudeai/status/2120206365759094857) | 2026-11-10 | Fact |
| 2 | All three are on every paid plan, on web, desktop and mobile. Team plans have them on by default. Enterprise has Whiteboards and Sheets off by default, and Data comes on 2026-11-19. | [Anthropic article](https://claude.com/resources/articles/sheets-whiteboards-data) | 2026-11-10 | Fact |
| 3 | They are already enabled on your account. This session's artifact catalog lists "Data", "Sheets", "Whiteboard", "Docs", "Slides", "Design" and "Design System" as types it can create. | Artifact type listing in this session | 2026-11-10 | Fact (seen directly) |
| 4 | **Whiteboards**: a shared infinite canvas with blocks, arrows, sections and sketches, and live cursors. Claude turns a talk-through into a timeline with owners and dates, groups ideas by theme, and drafts action items. A board can become a doc or a deck, or move to Miro or Lucid. | [Anthropic article](https://claude.com/resources/articles/sheets-whiteboards-data); type listing | 2026-11-10 | Fact |
| 5 | **Sheets**: a shared grid with tabs, formulas, formatting and drop-downs, built from a prompt. Claude notes each cell it edits. Anthropic calls it "simple spreadsheet functionality" for now. It exports to .xlsx or CSV. | [Anthropic article](https://claude.com/resources/articles/sheets-whiteboards-data); [iClarified](https://www.iclarified.com/103419/anthropic-launches-claude-sheets-and-whiteboards-previews-meetings) | 2026-11-10 | Fact |
| 6 | **Data** needs a data connector. Named examples are Redshift, BigQuery, ClickHouse, Snowflake and Salesforce. Named partners are PostHog, Amplitude, Mixpanel, Omni and Sigma. Anthropic gives no full list of connectors. | [Anthropic article](https://claude.com/resources/articles/sheets-whiteboards-data); [connectors article](https://claude.com/resources/articles/more-ways-to-work-with-claude-sheets-whiteboards-and-interactive-connectors) | 2026-11-10 | Fact |
| 7 | In a Data dashboard, each number is "one call of any tool" on a connector, and a Sources panel shows where every number came from. Queries run **only while someone has the page open**: "Nothing runs on a timer." Each viewer runs them with their own connector access. In the beta, a person can instead share their connector, and then viewers see only the approved results. | The Data type's own instructions (SKILL.md, sources.md) | 2026-11-10 | Fact |
| 8 | Data can also draft "data stories" and narrated videos (the type calls them "Visual shorts"), plus certified queries (beta), per-dashboard refresh cadences, and version history with rollback. | [Anthropic article](https://claude.com/resources/articles/sheets-whiteboards-data); type file visual-short.md | 2026-11-10 | Fact |
| 9 | Supabase has an official MCP server that works as a Claude.ai connector from the directory. It has a `read_only=true` mode that runs SQL "as a read-only Postgres user", plus `project_ref` scoping to one project. Its docs warn: "Connect to a production project only when the task requires production evidence." They also call prompt injection "the primary attack vector unique to LLMs". | [Supabase MCP docs](https://supabase.com/docs/guides/ai-tools/mcp.md) | 2026-11-10 | Fact |
| 10 | PostHog's remote MCP server is in the Claude connector directory with read and write tools: trends, funnels, retention and SQL. | [PostHog MCP docs](https://posthog.com/docs/model-context-protocol/claude-desktop) | 2026-11-10 | Fact |
| 11 | Stockpile has **no product-analytics SDK** today: no PostHog, Sentry, Amplitude or Mixpanel in any `package.json`. No event table exists either. The onboarding plan's metrics (`invite_opened`, `joined_from_invite`, `league_created_and_shared`, plus a weekly query and day-7 retention) are planned in `docs/plans/2026-10-14-onboarding.md` (§W6, "Done means") but are not in the code. | Repo grep at `e49d06dc` | 2026-11-10 | Fact |
| 12 | Most usage questions can already be answered from tables that exist: `user_profiles`, `leagues`, `drafts`, `trades`, `league_activity` (a view), `notification_log`, `push_tokens`, `cron_job_status`. | Repo, `supabase/migrations/` | 2026-11-10 | Fact (I didn't check each column's name against prod) |

## What this means for Stockpile

**Claude Data while we're building: an "effect, not status" health page.** `CLAUDE.md` lists eight cases where a job reported success and did nothing. Its rule is to check the data a job writes. A Data dashboard is a natural home for those checks, run as read-only counts:
- matchups with no score past their week end (the `unscored` check);
- the number of active symbols with no price (the #7 backlog);
- snapshot coverage per participant for the current week;
- the last terminal `cron_job_status` row for each job.

The weakness (finding 7): **it never runs by itself**. Nothing happens unless you open the page, so it can't alert you. *(Inference.)* It replaces the hand-run queries, not a monitor.

**Claude Data after launch: tracking how the app is used.** From tables that already exist (finding 12), with no new code:
- signups per week;
- leagues created, and how many reach four managers;
- drafts completed;
- auto-picks against manual picks;
- trades per active manager per week;
- leagues that go to Run it back.

The invite funnel and day-7 retention need the onboarding plan's events first (finding 11). *(Inference:)* "Who opened the app today" isn't in any table either. It needs either a small server-side event table or a client SDK such as PostHog (a named Data partner, finding 10).

**Privacy and the "Lock everything down" rule** (PRODUCT_RULES, 2026-10-08: "the more secure and locked down this can be the better"):
- Connecting the prod database to Claude puts query results into Claude's context.
- The profile-visibility rule (2026-10-08) and the account-deletion rule (2026-10-21) both limit who sees player data.
- *(Inference:)* A dashboard that reads raw rows (emails, usernames, holdings) would be a new way out for that data. One that reads only counts and totals carries little.
- Supabase itself advises read-only mode and staying off prod unless you need prod evidence (finding 9).

**App Store.** *(Inference, not checked; this is App Store policy reading, so an Opus pass first.)* A client analytics SDK such as PostHog would probably change the app's privacy label ("Usage Data" / "Product Interaction"). Server-side counts over existing tables would not, because they collect nothing new.

**Sheets, now.** Sheets suit trackers that change daily and don't need to live in git:
- a TestFlight tester roster and their feedback (personal data, which is better kept out of the repo anyway);
- a launch-readiness list (App Store assets, the naming decision, the email-template redraw);
- a bug triage list from phone passes.

The phone pass already has its own page, and the Recorder owns its repo mirror. *(Inference:)* A Sheet would be a third copy, so don't move it.

**Whiteboards, now.** Good for your Planner talks, and for laying out the road to launch with dates. Two existing rules limit them:
- product rulings must still be written into `PRODUCT_RULES.md`;
- design calls still go on the key-screens board as A/B mockups (PRODUCT_RULES, "How decisions get made").

*(Inference:)* A whiteboard is the scratch space before a ruling, not where the ruling lives.

**Not for players.** *(Inference.)* None of the three can be built into the app. They are workspaces inside Claude. A "weekly league recap story" for players would be an app feature to plan and build, not a Claude Data artifact.

## Not found / not sure
- **Whether Data works through the Supabase connector.** Anthropic names warehouses and CRMs but never Postgres or Supabase. The type's rules say any connector tool call can back a number (finding 7), so the Supabase connector's `execute_sql` should work. I haven't tried it, so this is unconfirmed until one test dashboard runs.
- **Pricing and usage.** No source says whether these draw extra usage or have row and size limits. The article lists none.
- **Your plan's defaults.** On Team they're on by default. Finding 3 shows they work on your account, but I didn't check your exact plan or org settings.
- **The newest source is the launch day itself** (2026-11-10). Both Sheets and Whiteboards are beta and may change.
- I didn't look at Claude Meetings (announced as a preview the same day), because you didn't ask about it.

## Recommendation
Using these is your call, not a product rule. Suggested order:

1. **Now: one Claude Data "ops health" page.** Use Supabase's connector in read-only mode, scoped to the one project, with **count-only queries** (no emails, usernames or holdings rows), and open it after each Friday's scoring. It's cheap, it encodes the repo's hardest-won lesson, and it tests whether the connector works before launch depends on it. Trade-off: it reads prod, which Supabase advises against. Read-only counts keep that small, but they don't remove it.
2. **Before launch: decide how usage gets recorded.** This is a Planner topic with you, and the onboarding plan's W6 metrics already assume it. There are two options:
   - **(a) Server-side events in our own database.** Nothing new leaves the app, the privacy label doesn't change, and it fits "lock everything down". It costs a small table and some code.
   - **(b) A PostHog SDK.** You'd get funnels and retention for free, and a Claude Data partner. It's a new third party, it changes the privacy label, and it needs a security review.

   I lean (a) because of the lock-down rule, but that's a product decision.
3. **After launch: a "how players use it" Data page** on top of whichever option you choose, plus a monthly data story for yourself.
4. **Sheets and Whiteboards when useful**, for the tester roster, launch checklist and planning boards, with rulings still written into the repo.

## Open questions for Giorgio
- Are you OK with Claude reading **counts** from the production database, if raw player data is never pulled?
- Who besides you would see a usage dashboard? A shared connector shows your access's results to every viewer.
- For usage tracking after launch: our own events, or a third-party tool like PostHog? (The Planner can bring you an A/B.)
