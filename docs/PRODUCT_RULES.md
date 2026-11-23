# Product rules

**The single source of truth for Giorgio's product decisions.** Every rule here was decided
by Giorgio. Quotes in "…" are his words, kept verbatim. Read this before planning or
building anything, and don't reopen a rule without him.

- **Who updates it:** the Planner (when a plan settles a decision) and the Orchestrator
  (when a decision is made mid-build). Add the date and, where possible, the board
  section or PR that recorded it.
- **Where decisions come from:** product and design choices go to Giorgio as side-by-side
  mockups on the key-screens board ("Your call" sections in
  `docs/design/screens/key-screens.html`), never as prose only.
- **Related:** what is live is in [`STATUS.md`](STATUS.md); plans are in [`plans/`](plans/).

---

## Direction

- **App first, landing last** (2026-09-29). The real app screens are designed and built
  first; the landing page later mirrors what the app actually looks like.
- **The bar** (2026-09-27): judge UI against Apple / Stripe / Linear (web) and Robinhood /
  Sleeper / Revolut / Arc (mobile). Correctness, honesty, tokens and reduced motion are
  table stakes, not the goal.
- **Captivating, not bland** (2026-10-12, after seeing 1.2.0 and a Sleek trial of Home):
  "everything I'm seeing is just so bland. It's not creative. It's not inspiring. It's,
  you know, you're not opening up an app and being like, wow. You're opening up an app and
  just seeing bland charts and bland everything. I want something that is captivating,
  something that is creative. I want to emulate other fantasy football apps and and make
  that bridge between them and investing apps. I want to create a, a kind of a, a blend
  between a, a, a sleeper and ESPN fantasy football with a Robin Hood or... Another sort of
  app like that. That's what I want." "Even the chart, like that's such an ugly chart."
  - The references, his list: fantasy = **Sleeper, ESPN Fantasy Football, Yahoo Fantasy
    Football**; investing = **Robinhood, E*TRADE**. What each does on screen and what we
    take is in [`design/REFERENCES.md`](design/REFERENCES.md).
  - Every direction and every screen is judged against those references side by side on the
    board, never against adjectives. "Calm" governs structure (one standout, room to
    breathe, UX rules 4–7); it never governs the visual language.
  - **Sleek (sleek.design) is rejected** for this app: "let's maybe not use Sleek, especially
    if it's going to charge us. Let's just maybe try to figure this out just in Claude Code."
    Design happens on the board, built here.
  - **Every section must elevate** (2026-10-12, approving the reset plan): "the main thing is
    that I don't want bland. I want every section to, in its own way, elevate the, the app,
    right?" His named examples of what is wrong in 1.2.0, verbatim:
    - Standings: "the way it looks right now in the app is awful. It is just a basic table
      with not even good like divide like dividing the columns and rows. It's it's ugly".
    - Matchup: "the chart doesn't even load" (a defect to fix, not a design choice).
    - Stocks: "you look at the different stocks and it's just they're so ugly."
    - The head-to-head is the heart of it: "I feel like even in the last one, like it
      captured that better head to head matchup look way better. And that should really be
      shown. And that's a huge part because of it's that like that fantasy football style".
      So the matchup is designed as a head-to-head scoreboard first (Sleeper/ESPN shape), and
      the 1.1.0 matchup look is a reference for what to keep.
    - His summary: "these are just some elements that really stuck out of just like, this is
      not how it's supposed to look. from a UI's perspective."
  - **The Matchup page is a fantasy-football matchup** (2026-10-12, also told to the
    Orchestrator directly): "the matchup page needs to look like the matchup pages from
    fantasy football apps, like an ESPN, like a Yahoo, like a sleeper, where it lists your
    stocks as if they are like a football roster, obviously without the positions, because
    that's not a thing, but it lists them like that and it shows their performance and it
    stacks them up so that you can see which maybe stocks are like how your stock is
    comparing to the other player's stock. We can maybe figure out a way to in, in what
    order that we list them like later on, but the matchup page should be one of the
    simpler ones. It should be just our themes, our take on that kind of fantasy football
    style matchup window." So: a scoreboard header, then a mirrored two-column roster (your
    stocks left, theirs right, row by row, each row's week performance shown), no position
    labels; the row ORDER is an open decision for later; keep the page simple.
    To the Orchestrator, the same day: "The matchup page should look like a matchup page
    from a fantasy football app, where it lists your stocks like a roster and shows the
    head-to-head performance of each. It's that simple. There really shouldn't be any other
    added elements." The week race chart is REMOVED ("If on ... there's a whole day where
    it's just going to sit there blank like that, we need to remove that"). Nothing on
    Matchup may sit blank or mean nothing for part of the week.
  - **Matchup roster row order** (2026-10-12): "let's order it that way. By uh, weak gain
    with the best going first." Then, the same day, by league type: "if it's the like
    category slots option, then the model should be listed like with the categories. So
    it'll show like text docs on a list of three. Um, and then, you know, it, it just shows
    each category and the stocks fit within those. And then with inside each of those, if
    there's multiple for a single category, then it will show by who's performing the best.
    For the other, uh, like game league types, game types, I don't know how we should call
    them. It'll just be ordered by who's performing the best, uh, since there aren't like
    positions." So:
    Then, asked about price tiers: "No, the price tier league should also have the same
    logic. Basically, if there's a mode where certain stocks are placed in certain
    categories, let's show them on the matchup page in those respective categories.
    Otherwise, we just show them in order by who's doing the best." So:
    - **Slotted leagues (category slots AND price tiers):** the roster is grouped by slot
      group in the league's slot order (e.g. "Tech ×3", then "Autos & Transport ×2", then
      "Flex"; or "$100–$200 ×2", then "$200–$400 ×2"), the group acting as the position
      label; within a group, stocks by week gain, best first. Both managers share the
      league's slot structure, so the mirrored rows pair up group by group.
    - **Unslotted leagues** (per-slot fixed-notional, budget-cap): one list per side by week
      gain, best first; no grouping, since there are no positions.
    - **When the order updates** (2026-10-12): "it should be at the end of each day, like
      the start of the next day, it'll reorder it to show like who's been doing the best.
      So it doesn't update like live per se, but updates at the end of the day. Let's just
      have it do that for now." So the order is recomputed once at each market close and
      holds through the next trading day; nothing re-sorts live. (On Monday the order is
      the draft/slot order until the first close, since every week gain is $0.00.)
    - **The exact moment** (2026-10-12, picked from three timelines: at the close, after
      trading ends, next morning): **after trading ends.** A day's close counts for the
      order only once that day's extended-hours trading is over, 8:00 PM ET (four hours
      after the close, so 5:00 PM ET on a 1:00 PM early close), so after-hours prints can
      never shuffle it again that evening. Until then the previous close's order holds.
      The prices on the rows still move live all day; only the order waits.
- **Giorgio's copy stays verbatim.** Propose changes; don't rewrite his words. A factual
  error goes to him as a decision.
- **Generic scoring copy:** rules, marketing and onboarding say "best performance wins",
  never "best return" or "biggest dollar gain", because capital varies by stake mode.
  - **Exception: a definition popup names what decides the winner** (2026-11-11). The "i"
    popup for a league type is a definition, so it may say the metric. Shown the Matchup
    popup two ways, A "the bigger dollar gain wins" (the line he had approved the day before)
    and B "the best performance wins", he picked "A". Rules pages, marketing and onboarding
    keep the generic wording. The Duration popup line, "The biggest gain at the end wins.",
    names no metric and stands as approved.
- **A sheet's top must not be a stuck block that cuts text** (2026-11-12, on League settings
  in build 14, recording 10:56). Giorgio: "the very top of like the pop-up where it says
  cancel, first off, there's a really weird amount of space between cancel and the very top.
  And then second, as you scroll, there's like that clear line that cuts off words where
  cancel is like stuck at the top. And then there's just that weird block at the top … I
  think we need to kind of reimagine pop-ups like that to where that's not an issue. So
  maybe you open up something like league, I don't know, an X or a close or a cancel
  appears, but it doesn't like cut off text … we got to figure out a better UI for that."
  So: no empty band above the close control; no hard line that slices the content as it
  scrolls under a pinned header; the way out stays easy to reach. He raised it as the same
  problem seen on other screens, so it is a rule for every tall sheet, not only League
  settings. Shown three directions the same day (A nothing pinned, B a floating close, C a
  slim bar), he picked "b": no bar; a small round close button floats in the sheet's top
  corner and stays there; the content scrolls the full height under it and fades softly as
  it passes, so nothing is sliced. The Design Lead draws it for his sign-off (every tall
  sheet, both themes, the largest text size, and what a form that can save shows in place of
  "Cancel").
  - **Amended the same day: a top bar, as on ESPN, replaces the floating close** (never
    signed off). He sent two screenshots of ESPN Fantasy's league manager ("Scoring
    Settings", "Basic Settings") and said: "i like the idea of having the top left being a
    back or close button and the top right being the save button. it is greyed out until you
    make a change and then you click save when it populates". Shown board `#call-sheet-bar`
    (A "League settings" in the bar with the name in a row, the Design Lead's
    recommendation; B the league's name in the bar), he answered: "B and no, hitting back or
    x just closes it". So, on every tall sheet:
    - **The bar.** Solid, in the card colour, starting at the sheet's top edge (no band
      above it). Close (×, 44 pt target) at the left; the title centred, bold, one line;
      on a sheet that can save, "Save" at the right. Rows scroll under the bar; once
      scrolled, a thin divider shows under it and a short fade in the bar's own colour
      (solid 6 pt, clear by 24 pt), so a row going under dissolves into the bar and no
      sliver of cut letters is ever left showing. At the top neither shows.
    - **Save.** Grey and inert until something changes, then the accent colour ("it is
      greyed out until you make a change"). Like a stepper at its end, the grey Save has
      nothing beside it to say why. Tapping it saves; on success the sheet closes and the
      screen below shows the change; on failure the sheet stays open with the error. There
      is no pinned "Save changes" button at the bottom any more.
    - **Closing never asks.** ×, back or a swipe down closes the sheet at once, and unsaved
      changes are dropped ("no, hitting back or x just closes it"). This is his call and it
      overrides the Design Lead's discard question: "Discard changes" and "Keep editing"
      were not approved and do not exist.
    - **Read-only sheets** (League settings for a member, a manager's team, Trade history,
      Forgot password) have the same bar with only the × and no Save. Forgot password's ×
      keeps the VoiceOver label "Back to sign in".
    - **Large text.** The bar's words stop growing at 1.3x, as iOS's own bars do, so the ×,
      the title and Save never collide; the rows under the bar grow fully.
- **League settings opens on the league's own name** (2026-11-12, Giorgio picked **C** on
  board `#call-settings-top`, relayed by the Orchestrator; his word: "C". He had said of the
  floating-close board's first screenful: "i dont love the top of it with League Settings
  and then League name right underneath. seems clunky and not well done." Shown A a smaller
  title, B the name as a card row (the Design Lead's recommendation) and C; he chose C.) It
  was drawn on the floating-close layout; when the top bar replaced that layout he kept it
  ("B and no, hitting back or x just closes it", board `#call-sheet-bar`), so the league's
  name is the **bar's** title. League settings has no "League settings" heading and no
  "League name" label: the bar reads "× · Serie A Traders ✎ · Save", and the first section
  under it is Draft. What the drawings left open, settled by the Design Lead so the build
  doesn't guess:
  - **Who can rename.** The commissioner, while the settings are editable (before the
    draft), sees a pencil after the name's last word. A member, and the commissioner once
    the settings lock, see the name with no pencil, and it does nothing when tapped.
  - **How the rename works: in place, in the bar, not a second sheet.** Tapping the name or
    the pencil turns the bar's title into a text field of the same size, with the cursor at
    the end and the keyboard up; the keyboard's return key ends editing. While editing, the
    pencil is hidden, an accent underline marks the field, and a name longer than the bar
    scrolls inside the field. The new name is a change like any other on the sheet: it turns
    the bar's Save on, and Save saves it with everything else. × or a swipe down drops it
    with the rest, without asking. A name problem (blank, or refused by moderation) shows
    right under the bar, in today's words, when Save is tapped.
  - **VoiceOver.** For the commissioner the title is one button: label "League name", value
    the name ("League name, Serie A Traders, button"); the pencil is decorative and not read.
    While editing, the field is labelled "League name". For a member the name is a header.
    "League name" is today's field label, so there are no new words.
  - **Long names and large text.** The bar holds one line between × and Save, so a name
    too long for it is shortened with "…" (the pencil stays visible after the "…"); the full
    name shows while renaming, and VoiceOver reads it whole. The title's text stops growing
    at the bar's 1.3x cap. (On the floating-close layout the title wrapped instead; the bar
    replaced that.)
  - **No new words.** C only removes "League settings" and "League name" from the top.
- **Nothing tappable does nothing** (2026-10-12): "make sure that there's no clickable
  actions or links or anything that's clickable in the app that then doesn't do anything.
  Like if there's any buttons or links or anything that should bring a pop-up or a redirect
  or anything like that, it needs to be active. We can't have buttons that don't do
  anything, links that don't do anything." Every control that looks tappable either does its
  job or is not shown (a control that can't act in the current state is hidden, or disabled
  with the reason beside it; never a silent no-op; two exceptions: a stepper at its end greys
  out its − or + with no reason beside it, per "Steppers at their ends: no line" under the
  Season step, 2026-11-11; and a sheet's Save in the top bar is grey with nothing beside it
  until something changes, per the top-bar amendment under "A sheet's top must not be a
  stuck block that cuts text", 2026-11-12). Audited once the UI redesign lands
  (plan `plans/2026-10-12-visual-language-reset.md`, W8) and checked at every gate after.
- **1.3 = the visual-language reset** (2026-10-12): "let's do the 1.3." The Game Night
  redesign ships as 1.3 with every screen on the new skin in both themes, after Giorgio's
  walkthrough in both themes; no 1.2.x with a partial reskin. The old direction's sections
  (`DESIGN_DIRECTION.md` §1, §9, §9A) are superseded by the Game Night token spec ("Yes, on
  point two"); §4, §5 and §9B stay.
- **1.2.0 TestFlight** ships only when EVERY screen is on the new UI, after Giorgio's
  full walkthrough. Phone only (`supportsTablet: false`); iPad is a later project.
- **Bots and the manual draft Start are testing tools only** (2026-10-06): bots exist "simply to simulate drafts" and "will get removed"; they're "not going to be a feature in the actual app". A real league always has real players, so never design product behaviour, copy or decisions around bot-only or one-real-player leagues. The manual Start is likewise "simply for testing purposes"; auto-start is the real feature. See **League size** under League lifecycle.
- **Board review answers** (2026-10-06): "Buy a stock" (tappable-but-blocked ownership, the
  Portfolio entry row, the search copy) and the stock chart ("A week ago" as the comparison
  line): "fine".
- **Direction chosen: "Game Night" (A), with tweaks** (2026-10-12, on the board's three
  directions, Light and Dark). Giorgio, section by section:
  - Home: "I like option A, game night the most. Uh, the broadcast version, I don't love the
    giant like purple kind of accent box thing in the middle. I think that's doing a little
    too much. And then Terminal just feels a little too robotic with some of the styling… I'm
    leaning more towards the game night as like the color palette and the styling."
  - Matchup: "I like the way that the game night one looks. I like the way that where you
    are is kind of shaded. And then I like the way that it says like the leads by and stuff".
  - Draft: "the game night one, I don't love the most… I do think it's just a little too
    similar to Sleeper in the sense that the squares are like color coded like that. I like
    the game night one. Look, but with the broadcast touch of having like it color coded just
    with that line at the bottom. I think that does enough to where you kind of see the
    breakdown by sector, but without it being like a carbon copy of Sleeper." So: Game Night
    styling, draft tiles NOT colour-filled; the slot/sector colour is a line along the
    bottom of each tile (the Broadcast treatment).
  - Standings: "the game night one is the best just because of that, like, style and
    formatting."
  - Portfolio: "it's going to be game night again."
  - Summary: "it's going to be kind of going towards that game night style, with just a few
    tweaks". Broadcast (B) and Terminal (C) are closed.
  - The Matchup roster's centre column in unslotted leagues: "let's go with its
    recommendation". The Design Lead's recommendation on the board (#call-direction, "Your
    call: the centre column (unslotted leagues)"): "Empty (recommended): The two numbers face
    each other across a gap. Nothing to explain." So in unslotted leagues the centre column
    is EMPTY. (Rejected there: a tier/sector pill, which disagrees across sides because rows
    pair best vs best, not slot vs slot; and row numbers, which "read like a position, which
    your ruling rules out".)
- **No sparklines on rows; the stock pop-up carries the detail** (2026-10-12): "on the
  portfolio page and on the matchup page … I don't want that like line thing there visible.
  What I want is that when you click on the stock, whether it's on the matchup page or the
  portfolio, it you know, like a pop-up window comes in where you can see more information
  and more details on that holding. So it'll give you information like, Uh, like as if you
  click on a player in fantasy where you kind of see … like for this one did you draft or
  did you pick it up off the waivers if so put the date where it was from and then like the
  price that you bought it at Uh, I would want to show that kind of line chart of its
  progression throughout the season in that kind of pop-up window." Reference: ESPN's
  player card (Giorgio's three screenshots, 2026-10-12, kept locally at
  `~/fantasy-stock/local/design-review/references/espn-player-card-{1,2,3}.webp`, not in the repo, per the
  references policy): header
  with name/team/position and the owning team, a key-figures strip, an Overview tab with
  this week's line, recent news, a game log, and a **Latest transaction** block ("Drafted
  8th by SUBSTATION SURFER · Aug. 30, 6:06 PM"). "I don't want to see these like those
  little lines showing the performance of the stock unless you click on it in the matchup
  in the portfolio." So: Portfolio and Matchup rows show ticker, performance and the slot
  pill, no chart; tapping a stock (yours or theirs) opens the stock sheet, which shows the
  season line chart of that holding, how it was acquired (drafted, with pick and date and
  price; claimed off waivers, with date and price; bought, with date and price) and the
  rest of the ESPN-style overview.
- **The stock player card, after the first mockups** (2026-10-12, Giorgio's review of the
  Design Lead's frames):
  - **Order like ESPN; acquisition at the bottom.** "I want the order of like the layout to be
    like you're on ESPN Fantasy. So like the fact that it says like drafted and then like kind
    of at the top, no, that should be at the bottom. It should say the date that you picked
    them up, whether that be draft and then you say the, and then it shows the pick and the
    amount that it was drafted at, or you show like the waiver wire, the date, and then …
    the price." So the "How you got it" block is the LAST section of the card: the date,
    then Draft (with the pick) or Waiver claim or Buy, then the price.
  - (2026-11-17: now TWO figures, Price and Week gain; see "On the card for a stock on a
    team" under "Every chart has the same six ranges".)
  - **Three key figures, not four.** "I like the kind of initial top card with like the price,
    the week gain since draft their position. I don't love the their position. In that, I
    think it does seem a little cluttered. Maybe we just go with three." So the strip is
    price · week gain · since draft (or since acquired); no "their position" figure.
  - **The season chart gets a real X axis with dates**, and NO "Drafted" label or marker on
    the chart: "there should be a, some sort of X axis with like dates on it. Also, if at the
    bottom, like we don't need to say drafted on that chart, like A player can see from this
    pop-up card if they were drafted or picked up on waivers."
  - (2026-11-17: the two stacked charts below are replaced by ONE chart with six ranges; see
    "Every chart has the same six ranges" under Home and Portfolio. The date-axis and
    realistic-movement points still describe what he expects of a chart.)
  - **The this-week chart shows the days of the week on its X axis** (Mon … Fri) and the
    mockup must use realistic movement: "why is there just like a flat line for half the
    chart and then like a slight pop-up? Like, that's not how it should be."
  - **No Save (star) on a stock you already own**: "there probably shouldn't be a save option
    if you already have the stock, if it's one of yours." Clarified the same day: "if I am
    looking at the player card of a stock I already own, there shouldn't be a save button
    because there's no reason to save it if I already own it. You should only have the save
    if it's a stock that's not currently being held or an opponent's stock that you want to
    keep tabs on." So Save shows on unowned stocks and on other managers' stocks; never on
    yours.
- **Redesign decisions, the consolidated list** (2026-10-12 evening; the Orchestrator's and
  Design Lead's 14 open items, answered in one go):
  - **Matchup shading = YOUR side, always**: "I was going more on the side of it's you. So
    when it's you versus someone, it shades it so that it's clear. Not whoever's winning.
    That's going to be able to be seen by the uh, the point total up top." (Option B; the
    1.1.0 leader-follows shade is NOT kept.)
  - Home's season chart X axis: two end-date labels (start and today). ("yeah") Superseded 2026-11-03:
    Home has no chart (see "No chart on Home" under Home and Portfolio).
  - The player card's draft amount = the price per share ($290.10), not the total put in.
  - For everything else he took the recommendations: "I'm going to go with your
    recommendation there. Let's just go with your recommendations on the rest after that."
    Namely: (4) categories: 10 hues plus a neutral Misc, short labels (Tech · Finance ·
    Health · Energy · Autos · Retail · Food · Media · Industry · Property · Misc; new copy);
    (5) the on-the-clock draft cell stays dark navy in Light, a single spotlight; (7) the
    1.2.0 walkthrough tests only what survives the reskin (first-pick push with the app
    closed, buzz/chime in-app, Run it back end to end); (8) the held post-1.1.0 drops
    (`start_new_league_season`, I6/I2b) may be released now, with his explicit go at the
    `db push` itself; (9) Matchup's "My matchup / All matchups" switch stays as navigation;
    (10) the watchlist's Home hook is decided after the Home rebuild; (11) your-turn colour
    = cyan; (12) the card's third figure = "Since the draft" ("Since Oct 2" for a later
    buy); (13) the Portfolio chart with range pills: yes; (14) the owner's avatar beside
    "Owned by": add; a weekly game log on the card: later.
- **Matchup: four states the approved frames never drew** (2026-10-12/13, from the W4 Matchup
  gate; board `#call-mx-order`, `#call-mx-empty`, `#call-mx-bye`, `#call-mx-withheld`).
  Giorgio picked **B** on all four, one at a time from the board images, and accepted the three
  new strings exactly as drawn:
  - **The row order says what it is:** one small line between the scoreboard and the rows,
    "Ordered by Wednesday's close", naming the last close whose trading has ended. It becomes
    "Thursday's close" once that day's trading ends (the re-order timing, his "after trading
    ends" ruling: PR #252). Rows still never re-order live.
  - **An empty slot is marked:** a slot with no stock (sold, not yet replaced) keeps its row
    and its half shows a dashed edge and "Empty"; your half keeps your shade inside it.
  - **The bye week:** the scoreboard card with your half as usual (avatar, name, this week's
    total), "Bye week" in the opponent's half, the shipped line "Bye week · no result" under
    the card, then your stocks in one column, best week first. No other new words.
  - **A final whose stock-by-stock figures can't be shown** (they don't reconcile to the posted
    score): the scoreboard, then "Stock-by-stock results aren't available for this week.", then
    both lineups as ticker and company only, no figures, in draft order, your side shaded.
- **Lock everything down; nothing scrapable** (2026-10-08): "I don't want people to be able
  to scrape anything and the more secure and locked down this can be the better." Chosen over
  keeping the public stock-symbol list readable (option B): the symbols table becomes
  signed-in only, and anything an anonymous caller (or any one signed-in player) could
  bulk-read is audited and locked down, with product-visible changes brought to Giorgio first.
- **Claude may read counts from production, as a trial, after a security read** (2026-11-10).
  Asked whether a Claude Data dashboard may read counts from the production database, never
  names, emails or holdings (the Researcher's report,
  `docs/research/2026-11-10-claude-whiteboards-sheets-data.md`): "yes as a trial, do the
  security read first". So: nothing is connected until the security read is done and he has
  seen it; the trial reads counts and totals only, read-only; connecting it is his own step;
  and it is looked at again before real players join, when "counts only" must be enforced by
  the database and not left as a habit in how queries are written. This is a tool for him,
  not a player feature, and it does not loosen the rule above.
  **Trial dropped after the read** (2026-11-10). The security read
  (`docs/security/2026-11-10-claude-data-connector-security-read.md`) and two catalog checks
  he ran on production showed that Supabase's connector reads every table, emails and
  password hashes included, and that nothing in the database itself stops its reader from
  sending data out. Supabase's own guidance is to use it on non-production data. His ruling:
  "ok then lets keep it away from prod data and skip it." So: Supabase's connector is never
  connected to production, trial or not. A page of totals, if he wants one, reads a file a
  scheduled job writes, with no live connection to the database.
- **Who can see other players** (2026-10-08, audit #8, option A): "i can only see other names
  and avatars of other users im in a leauge with. we cannot allow a user to see any
  information outside of the name/avatar of another member in their league (email, etc) or
  any info about users not in their league." So: another player's profile is visible only to
  people who share a league with them, and only their name and avatar. Nothing about players
  outside your leagues. **Before you join** (2026-10-11, option A, board
  `#call-join-commissioner`): the Join preview names nobody, not even the commissioner (no
  "Run by"); a full league reads "Ask your commissioner if they can make room."
  **After someone leaves** (2026-10-11, "A with frozen names", board `#call-leaver-names`):
  they stay named, with name and avatar, in the seasons they played with you (history is
  kept), frozen as they were when they left, so nothing about them after they leave
  reaches you. No "Former manager" label. **One exception, a deleted account** (2026-10-21):
  deletion scrubs the name and avatar too, so a deleted manager's seat shows a placeholder
  label instead ("we stick with the plan and change the product rules. we need to comply
  with the apple rules."). See **Account deletion** under League lifecycle.
- **The top bar** (2026-11-06, build 11, board `#call-top-bar`; his words: "the top bar with
  your profile icon doesnt appear on the portfolio page but does on the other tabs. also i dont
  love how it so clearly cuts off the page like that, not sure if theres a work around but maybe
  the top bar shouldnt always stay at the top and cutoff as you scroll." Then "A for both"):
  - **The same bar on every tab:** your league's pill on the left, your avatar (Profile) on the
    right. Portfolio shows the avatar too, and no phase chip; no tab shows the phase chip in the
    bar (each tab's own content says the phase).
  - **The bar scrolls away with the page.** It is the top of the page, not a fixed frame: it goes
    up with the content, so nothing is sliced under a fixed edge. Behind the clock the page colour
    fades out over a few points once you've scrolled, so nothing runs into the time. To switch
    league or open Profile mid-page: scroll back up, or tap the clock. No new words.
- **No added caveats:** implement Giorgio's rules as stated. Don't add exceptions he didn't ask for.
- **Product name:** "Stockpile" must go (a live trademark), with Stockade the front-runner,
  but naming is DEFERRED to pre-launch. Keep the bundle id, slug and scheme.

- **Times show in the player's own time zone** (2026-11-10; plan
  `docs/plans/2026-11-10-local-time-zone.md`): "we need this app to simply show the like time
  zone or whatever the user's phone is … If I am in Pacific time, I don't want to see Eastern
  time because that was confusing me at first." The zone is always named: "It's good that it
  tells me the time zone underneath, but the standard should be whatever the time zone the
  user's in." The market's own times too: "yes, market times should be local too". Display
  only: the market, the trading window, weeks and scoring keep running on Eastern Time.

- **No heading-plus-explainer pattern** (2026-11-10, said three times in one day). On Create
  league's Season step: "I really don't like this style of mainline like managers and then
  this like smaller subtitle that explains it. I think one that is very just red flag of like
  AI built, vibe coded. Secondly, I think it makes it far too cluttered." On the draft room's
  queue card: "I don't like this format of like header and then this text sub header that
  explains things … It just makes it cluttered. You use way too many words". So: a label is
  not followed by a grey sentence explaining it. The screen should make the thing clear by
  its layout and controls; where a fact is truly needed it is one short line, a value, or a
  one-time tip, "the right kind of balance between providing the user with the right
  information they need … but then also not clutter the UI." The Design Lead sweeps existing
  screens for it; new screens are gated on it.
  The third time, on League's postponed card and "Your queue · 4 of 50" with three lines
  under it: "This is a recurring theme that I've mentioned … I really don't like the draft is
  postponed big header and then a lot of text underneath subheader right below. To me, it
  makes certain things look clunky. It looks like too much is going on … We don't need that.
  I don't like that. We need to find a way to convey what the things are without having to
  over-explain … I feel like a user will be able to understand how things work without this
  repetitive couple lines of text under every single header." Because it kept coming back,
  the rule is now checked, not only stated: it is rule 12 in `docs/design/UX_RULES.md` (the
  `ux-reviewer` runs it at every gate) and a row in the gate checklist's mechanical checks.
  The test (the Planner's wording of his rule, 2026-11-10): a line under a heading stays only
  if it is a fact the player cannot see anywhere else on that card and needs right now (a
  time, a count, a name, what is blocking them). A line that says what the thing is, how it
  works, or repeats the heading or the button, goes.
  **Optional context for a choice we defined** (2026-11-10, on the Design Lead's sweep
  board for this rule): "so for the sweep of the app to remove the unneccessary sub headers
  and fluff. i like what the design lead presented but there are little tweaks i want to
  make to it. for example, on pt 4 create league screens, the different league types need to
  be explained or else the user wont know what they are selected. i dont want this to be
  shows in text below, but a little information i on the end of each bar with a pop up
  explaining would be great. it could even be a two part pop up, one explaining it with a
  concise word explanation and another with a visual. there should be a small x in the
  corner for the user to close out of and this should be a thing for all options. so for
  instances where a selection is key to process and has been defined by us and isnt obvious,
  then we need to give the user optional context". So: the sweep's direction is approved,
  with this change. Where a selection is key to the flow, was defined by us, and is not
  obvious, every option in it carries a small info "i" at the end of its row; tapping it
  opens a popup that explains the option, with a small x in the corner to close. No
  explaining text goes under the options. The popup may have two parts, words and a visual;
  the Design Lead shows him the form on the board, and the words in it are new copy for him.
  It is rule 13 in `docs/design/UX_RULES.md` and a row in the gate checklist, so the gate
  checks both directions: no explainer under a heading, and no unexplained choice of ours.
- **The "i" popup has two pages** (2026-11-11, picking B on the "i" board): "i like version
  B with the see an example and the second potential slide". Page 1 is the option's name, the
  short line; page 2 is the name and the visual. The × in the corner closes it from either
  page. The popup's words are still on the board for his approval.
- **No button in the "i" popup: just the dots** (2026-11-11, asked of the board's three ways:
  big button, just the dots, a small link): "is it better to have this button or simply have
  the two dots at the bottom and have it be swipable where the user dictates where they go.
  not sure if im a fan of the big button", then "just the dots". The player swipes between
  the two pages; the two dots under the card show the page and are themselves the page
  control (tap to turn, "Page 1 of 2" to VoiceOver). No "See an example" and no "Back".
- **The "i" popup lines, approved as written** (2026-11-11: "the popup lines are approved"):
  - Matchup: "Each week you play one team, and the bigger dollar gain wins. The best records
    make the playoffs."
  - Duration: "One race for the whole league. The biggest gain at the end wins."
  - Equal stakes: "Every pick is the same dollar amount, so a cheap stock counts as much as an
    expensive one."
  - Price tiers: "One share per pick. Each slot takes stocks in its own price range."
  - Budget cap: "One share per pick. Your shares together can't cost more than the cap."
  - Draft order: "Random shuffles it an hour before the draft; Manual lets you set it. Either
    way, it reverses each round."
  - Playoff teams: "The top teams in the standings play a bracket. When it doesn't fill
    evenly, the top seeds skip the first round."
  - Non-draftable stocks: "Off: stocks at $1 or more, on a major US exchange, from companies
    worth $250 million or more. On: every US stock, penny stocks too."
- **The pictures' spoken descriptions, approved as written** (2026-11-11: "approved", shown
  all seven verbatim by the Orchestrator). VoiceOver reads these on each popup's page 2, so
  the picture is never silent:
  - Matchup: "Example: in week 3 you gain $24.10 and Marco R. loses $8.30, so you win the
    week. After the regular season, the top 4 play off."
  - Equal stakes: "Example: $1,000 buys 89.29 shares of F, 5.36 of NVDA, or 1.09 of COST."
  - Price tiers: "Example: slot 1 takes stocks under $50, like F. Slot 2, $50 to $300, like
    NVDA. Slot 3, $300 and up, like COST."
  - Budget cap: "Example: one share each of F, NVDA, MSFT and COST costs $1,628.10, under a
    $2,500 cap."
  - Draft order: "Example: in round 1 Marco R. picks first and Elena M. fourth. In round 2 it
    runs back: Elena M. picks fifth and Marco R. eighth."
  - Playoff teams: "Example with 6 teams: seeds 1 and 2 skip the wild card round, 3 plays 6
    and 4 plays 5, then the semifinals and the final."
  - Non-draftable stocks: "Off, only draftable stocks like AAPL, NVDA, COST and F. On, every
    US stock, including a $0.40 stock or a $90 million company."
  - Duration's is on hold with Duration (not built, no row). "About {option}" on each i,
    "Close" on the ×, and "Page 1 of 2" are control labels, not copy.
- **Rounds gets no "i"** (2026-11-11, "1a" on the Design Lead's three questions): the Rounds
  stepper on Create league › Draft stays a label and a number, with nothing behind it.
- **Cut the league-name line** (2026-11-11, "3b cut"): "Don't worry. You will be able to
  change this later." under Create league's League name field goes. Nothing replaces it.
- **No draft order card while it waits, at 4 or more** (2026-11-11, "B" on
  `#call-waiting-card`, shown A the "DRAFT ORDER · WAITING" card with only its label, as the
  sweep left it, and B the card hidden): on the League tab before the draft, once 4 or more
  managers have joined, there is no draft order card until the order exists; the countdown is
  followed by your queue. When the order is set (an hour before the draft) the order card
  appears in its place, as before. Below 4 the card still shows "N of 4 managers" (what is
  blocking), as it does today; it has no progress bar (the board drew one by mistake; corrected
  2026-11-12, at the build gate). No new words.

## Scoring and standings

- **Dollars decide.** Dollar gain decides every matchup in every stake mode; percent is
  only the tiebreak. The UI shows the metric that decides the winner, via one shared helper.
- **A finished week that dollars did not decide says who won and why, winner first (A)**
  (2026-11-19, the Design Lead's board `#call-tiebreak-words`, branch
  `design/tiebreak-words-1119`, shown in the Planner's chat; typed there: "A"). The line
  under a finished week's card:
  - Percent tiebreak (level on dollars): **"Paolo M. won the tiebreak, +1.76% to +0.74%"**
  - One team had no stocks: **"Chiara R. won. Sofia F. had no stocks"**
  - Playoff, level on dollars and percent: **"Tied. Luca V. advances as the higher seed"**
  - Playoff, no stocks on either side: **"No stocks on either side. Chiara R. advances as
    the higher seed"**
  - Unchanged: a week won on dollars keeps "{winner} won by $X", and a true tie keeps
    "Dead even".
  - B (the reason first, e.g. "Tied on dollars. Paolo M. won on percent, +1.76% to +0.74%")
    was not picked.
  - **The season recap row: the W and L are bold and neutral, only the money is coloured,
    and the row carries no reason (A)** (2026-11-19, the same board, then A/B mockups in
    the Planner's chat). The board offered 1 (as built: the letter coloured by the result,
    the figure by its sign, so a red "L" beside a green "+$34.04") or 2 (the same with a
    grey reason word). He took neither. His words: "I think it's going to be a little
    confusing if there's a red L and then green money... I also don't think it's smart to
    put red where there's gains... I think maybe we make the P&L red and green, but we keep
    the L's and W's not red and green and just keep them like bolded neutrals or something
    like that." Shown that idea two ways (A: neutral letters and nothing else; B: neutral
    letters plus one grey word, "L · tiebreak", "L · seed", "W · they had no stocks"), he
    typed "A". So: the letter is in the normal dark ink, bold; the figure keeps its sign
    colour; no reason word on the row; the reason is on that week's card, one tap away.
    B was not picked, so the three reason words are not approved copy.
  - Scope: the recap rows only. W and L letters are drawn in other places; the Design
    Lead lists every place they are coloured and it comes back to him as a board. Nothing
    changes on those screens until he picks.
  - **W, L and T are neutral everywhere; the won-week banner stays blue** (2026-11-20, the
    Design Lead's board `#call-result-colour`, branch `design/result-colour-1119`, PR #578,
    with real-app stills of each place today against neutral in Light and Dark; typed in
    the Planner's chat: "A and keep blue").
    - Letters, pick A: the W, L and T are bold in the normal ink, like the recap rows, in
      the three other places that coloured them by the result: Home's "Your season" tiles,
      the League › Schedule rows, and the Matchup "i" popup (the W beside the winner). The
      money keeps its green or red. B (as before: W green, L red, T grey) was not picked.
    - The finished week's banner, pick 1: it stays blue on a week you won and grey on a
      week you lost or tied. The blue is your colour, not a result colour. 2 (grey for
      every week) was not picked.
    - Left as they are, and not part of the pick: the bracket (winner bold, the other
      grey), the medals, money everywhere, and the standings' up and down arrows.
    - No new words.
  - Why this came up: the line used to compare the two dollar figures by itself, so a
    percent-tiebreak week read "Dead even" under a band that named a winner, and a
    no-stocks week could name the wrong side. Since #566 (2026-11-19) such a week shows no
    line. These words replace "no line" once the server records why a week was won; it
    does not today, and the phone cannot work it out from the totals. That is a plan of its
    own (`docs/plans/2026-11-19-matchup-outcome-reason.md`), so nothing here ships
    before it. He approved that plan on 2026-11-20, shown today against the plan as a
    drawing: "Yeah, I like that plan where there's the small thing underneath if in case
    of a tiebreak."
- **There is always a price for a stock, and no person ever types one in** (2026-11-17).
  Asked what the app should do when a held stock has no trade for a whole day (the case the
  2026-11-17 week-price fix leaves with no price), and shown three options (A: use the
  stock's last closing price, automatically; B: wait for a person to enter a price; C: alert
  the owner and leave the week unscored), Giorgio's words: "No. I'm sorry. There should
  always be a price for a stock. We cannot be building an app that will have a human type in
  the price. There needs to be, like, that cannot happen. There always needs to be a price
  for a stock."
  - Ruled out by his words: a person entering a price (B), and any state where a week stays
    unscored because a stock has no price (C).
  - The Planner's reading, not his words: the way to meet it is A, the stock's last real sale
    price (its most recent close) used automatically when a day has no trade. That is a real
    price, not an ask or a guess. He was told this is what A does and was not asked to pick a
    letter again.
  - Why the case exists at all, for whoever builds it: prices come from one small exchange's
    feed, where a thinly traded stock can go a day with no trade even though it traded
    elsewhere. Fuller market coverage is part of the price-supplier decision. A stock that
    has stopped trading for good (delisted) is a separate case that this rule makes
    necessary to design: its last price cannot be used for ever.
  - **A missing number never shows as zero** (2026-11-18, on build 1.3.0 (17); typed in the
    Planner's chat). On his phone, the card for NVTS in the league test_081126 read "Week
    gain $0.00 / 0.00%" while the same card showed the stock down 4.21% that day. His words:
    "That Navitas thing is an issue because, as I mentioned, this app is going to be basing
    people's performances based off of the real market data. We can't have instances where we
    just don't have anything for something. We can't allow there to be, when there's a real
    stock that's down a certain percentage, it's just to be a zero. That's one of the things
    where we need to have a fallback to where it can still figure out what the amount is or
    something like that, because that's going to be an integral part of this app."
    - What the zero was, by the code: the card shows $0.00 and 0.00% when the league-week
      has no starting price recorded for the stock
      (`apps/mobile/lib/game/playerCardModel.ts`, `stockWeek`: a missing entry becomes 0). The
      Portfolio and manager-portfolio week rows read the same value.
    - Why the entry was missing here, found the same day from a read-only query he ran:
      test_081126 is an old Duration league. A Duration league has no weeks, so the server
      records no weekly prices for it by design, and the app showed week figures anyway.
      Matchup leagues are not hit by this cause. The fix: a league with no weeks shows no
      week figures, and a matchup holding with no recorded start shows "–", never zero.
    - **On Matchup, an unpriced stock shows a dash on its row, and the team's total is the
      total without that stock** (2026-11-19; shown the real screen at L, at his size and in
      Dark, PR #547; typed in the Planner's chat). The build had the row's figure as "–" and
      ALSO the team's total as "–" (the Planner's spec, so that a total leaving a stock out
      was never shown as the team's total). Asked whether a dash for the total was
      acceptable, his words: "row has the dash but up top accounts for total without that
      stock".
      - So: the stock stays in its slot with "–" where its figures go, and the total at the
        top is the sum of the stocks that do have a price. The total is a number, never a
        dash.
      - The Planner's reading, told to him and not his words: with both totals shown again,
        the line under the card that says who leads and by how much shows again too, worked
        out from those totals.
      - CORRECTION, the same day: the Planner also told him this matched how the server
        scores such a week. It does not. The server does not leave the stock out; it refuses
        to score the week until every holding has a price, and retries
        (`scoring-eligibility.ts`, `process-week-results`, `snapshot-week-end/close.ts`). So
        a posted week always includes every stock, and only the LIVE total during the week
        leaves one out. Told this, his words: "yes, i want the running total to not be zero
        if there is an issue with one stock." The ruling stands, for the live screen.
    - **A notice at the top of Matchup while a price is missing** (2026-11-19; his idea,
      then A/B mockups for the wording and the colour, in the Planner's chat). His words:
      "maybe what we do is we put a small info/warning banner at the top of the matchup page
      if there is an issue pulling the price of a stock to let the user know", and, on the
      first wording shown, "i think the banner needs to say something about arent loading
      right now and we are working to update it or something. so the user knows we are being
      proactive. and that the total will be updated with that when its done".
      - Approved copy (wording "A"): **"Prices for AAPL and JPM aren't loading right now.
        We're working on it, and the totals will update when they're back."** With one
        stock: **"The price for AAPL isn't loading right now. We're working on it, and the
        totals will update when it's back."** The stocks are named, not counted.
      - **Three or more stocks: the notice does not list them** (2026-11-19, typed in the
        Planner's chat after the two wordings above were approved). His words: "if its more
        than two we should just say something like we are having issue with multiple stocks
        or whatever. make it plural and general". One stock and two stocks stay named, as
        above. Approved copy: **"Prices for multiple stocks aren't loading right now. We're
        working on it, and the totals will update when they're back."** His words on it:
        "that wording is good, approved".
      - Where and when: under the "My matchup | All matchups" switch, above the totals;
        only while a price is missing during the week; never on a scored week.
      - Colour (pick "A"): the app's teal accent as a soft tint, with an info icon. Not
        yellow. His words: "maybe we put it in a color that matches our theme. we should
        have a select color palette and yellow doesnt really go with it". B (the app's
        neutral grey-blue) was not picked. The Design Lead sets the exact shades and Dark.
      - Told to him: "We're working on it" is true as the app and the server retrying by
        themselves until the price arrives; nobody fixes it by hand.
    - **Yellow is not part of the theme; the Design Lead audits where it appears**
      (2026-11-19, the same message: "A, and yes have the design lead audit the yellow").
      The palette has a yellow for warnings today (`warnTint`, `warnText`), used on the
      "The draft can't start yet" card among others, which he called a "big yellow box" on
      2026-11-09. The audit lists every use and comes back to him as a board of each one in
      the palette's own colours. Nothing changes on those screens until he picks.
      - **The pick: A, the teal tint** (2026-11-19, the Design Lead's board `#call-yellow`,
        PR #569, with real-app stills of today / A / B in Light and Dark shown in the
        Planner's chat; typed there: "A"). Every yellow warning takes the accent's soft
        tint with its words in teal, the same family as the Matchup price notice. It covers
        the five kinds of place the audit found: the refusal panel (on 13 screens), Home's
        "The draft can't start yet" card (fill, edge, small label and the Playoff teams
        stepper's ring), the stake-mode note in League settings, "TBD" on the Draft time
        row, and the draft search's "NOT DRAFTABLE" / owned badge. B (neutral grey) was not
        picked; in the stills its grey-edged refusal looked like the outlined button under
        it. No new words. Left as they are: the gold medal and the Property category's
        amber, since neither is a warning.
      - Told to him with the pick: with A a refusal and an information notice are the same
        colour, so the words carry the difference.
    - Ruled out by his words: any figure that reads as "flat" or "zero" because the app has
      nothing to compute it from.
    - The Planner's reading, not his words: where the week's starting price was not recorded,
      the app works the figure out from market data (the week's first real price, and failing
      that the last real close), on the server, the same for every manager. For a stock that
      has stopped trading, its last real price stands for as long as it takes; that also
      answers the delisted case above for what a manager sees. He was told this in plain
      words and not asked to choose a mechanism.
  - **A price shown to a manager is the stock's current price, never an old one and never
    missing, however rarely the stock trades** (2026-11-18; typed in the Planner's chat).
    Asked what a buy should do for a thinly traded stock whose most recent trade on our data
    source is from an earlier day (A: refuse the buy until it trades today; B: fill at that
    last price, as the app does now), he picked neither. His words: "So this is another area
    why we can't be showing a stock price that is a day old. If someone, it doesn't matter
    how rare the stock is, if someone searches up a stock and they look for it and they want
    to buy it, it needs to show an accurate representation of what that price is. So
    question one is this repeated thing of, we cannot be showing incorrect numbers on stock
    prices. We cannot be showing old, or we cannot be showing, just have nothing for a stock
    price. That just can't happen."
    - Ruled out by his words: a displayed or filled price that is a day old; a refusal or a
      blank because the app has no price; any stand-in.
    - What this means, and it is the Planner's reading: the rule cannot be met by code on
      the current data. Prices come from one small exchange's feed, on which a rarely traded
      stock can go a day or more with no trade while it trades elsewhere. The fixes of
      2026-11-17 and 18 (#505, #513, #514) made the app use only real prices, but for such a
      stock the newest real price it can see is still old. Meeting his rule needs a
      full-market price feed. That is the price-supplier decision, with a monthly cost and
      display terms, and this ruling makes it the next thing to bring him.
    - Until a full-market feed is in place, the buy path stays as it is (no lone bid or ask,
      the last real trade). That is known not to meet this rule for rarely traded stocks,
      and nothing should be built that papers over it.
    - It reaches the Stocks list he approved the same day: a row may not show the stored
      price, which can be up to about two trading days old. The plan is revised so rows show
      a current price or the list waits for the feed (see the plan).
  - **The kind of price feed: a calculated price for every stock (A)** (2026-11-18; a
    three-way comparison in the Planner's chat, from
    `docs/research/2026-11-18-full-market-feed-options.md`). Shown A (a price worked out each
    second from the whole market: never a day old, never missing, but an estimate and not
    one actual trade; list price about $250 to $1,000 a month, flat), B (real trades from
    every exchange, 15 minutes late; about $1,250 a month and up; a stock with no trade for
    hours still shows an old price) and C (real trades from every exchange, live; $3,000 or
    more a month plus about $3 per player; the same old-price gap; every player must declare
    they are not a finance professional), he picked **A**.
    - What the pick is: the KIND of feed the app moves to, chosen because it is the only one
      of the three that meets both halves of his rule above.
    - What the pick is NOT: a supplier, a contract, or a go-ahead to spend. He was told the
      prices were published list prices not confirmed with any supplier; that the right to
      show prices to players must be in writing first; that a week's test on rarely traded
      stocks comes before committing; and that one supplier's terms may require deleting its
      data when the plan ends, which matters because the app stores prices for scoring.
    - Told to him and not objected to: the cheaper upgrade of the current supplier does not
      work (its $99 plan covers the whole market but its terms are still personal use).
    - **Prices are shown only inside the app, to signed-in players; no supplier is contacted
      yet** (2026-11-19; typed in the Planner's chat). Asked whether prices should ever
      appear on a public web page, and whether to send the Planner's draft enquiry to the two
      low-cost suppliers (Tiingo, Intrinio), his words: "only inside the app, we wont send
      out yet ill ask when ready".
      - So an enquiry or a licence asks for in-app display to signed-in players only. The
        public web ticker for signed-out visitors is not part of what a supplier is asked
        for.
      - Nobody sends the enquiry or contacts a supplier until he says so. It is his to send.
    - Not decided: which supplier; when to start paying; whether scoring uses the same
      calculated price or the day's official open and close.
- **A Duration league is won by dollars too** (2026-11-11: "dollars, confirmed", confirming
  DR-001's "Duration (single long window, best total dollar return)", 2026-08-08): the
  biggest dollar gain at the end of the league wins, in every stake mode. Duration scoring
  is not built yet (the server sets only the start and end); its tiebreak and standings are
  for the plan.
- **Duration is hidden in Create league until it is built** (2026-11-11). Create league
  offered Duration while nothing on the server scores or ends a Duration league, so one
  created today would never have a winner. Shown two ways, A hide it (Create league offers
  only Matchup) and B show it greyed out as coming soon, he picked "A". Duration comes back
  when its scoring is planned, built and verified. The Planner's reading, not his words: the
  server refuses to create a Duration league as well, so the block does not rest on the app
  alone; Duration leagues that already exist are left as they are.
- **The League type card stays, with Matchup alone** (2026-11-11, "A" on the Design Lead's
  board, shown A keep the card with Matchup alone, B a fixed line "League type · Matchup",
  C drop it): Create league › League still shows "League type" as the option card, with
  Matchup as its one option, already selected, and its "i". When Duration comes back, it
  rejoins the same card. No new words.
- **"Season gain"** = regular-season `points_for` only. In the playoffs it stays at the
  final regular-season total.
- **Ranking** (standings = playoff seeding, one order, computed only in SQL
  `league_standings_ranked`): (1) win % = (W + 0.5·T)/GP, byes excluded, 0 GP = 0%;
  (2) a balanced mini-league head-to-head among the tied, only if every pair met equally
  often; (3) season gain; (4) joined_at; (5) user id.
- **Once the season is over, medals follow the playoffs** (2026-10-10, option A, board
  `#call-medals`). The finished season's "Final standings" put the champion 1st (gold,
  "Champion"), the Final's loser 2nd (silver, "Runner-up"), and the better-seeded of the
  two semifinal losers 3rd (bronze); everyone else keeps their regular-season place.
  Records and season gains stay the regular season's, and the Playoffs tab keeps the
  seeding. League › History and the season-complete card show the same medals.
- **Regular-season byes = no result**: neither a win nor a loss, and not counted in games
  played. No explanation of byes, just a short notice when members/weeks produce uneven
  byes.
- **League's two load failures** (2026-10-13, approved by Giorgio as written, relayed by the
  Orchestrator during the W4 League build): History reads "Your league's history didn't
  load." and Playoffs reads "The bracket didn't load.", each beside the existing "Try
  again". (Before, a failed read left the segment blank.)
- **The league list's load failure** (2026-10-14, Giorgio approved, relayed by the Orchestrator
  during the gn-sweep): when the read of your leagues fails, Home and League read "Your
  leagues didn't load." with "Check your connection, then try again." and "Try again" (one
  string, shared by both). "No leagues yet" shows only when that read succeeds with no
  leagues. (Before, a failed read said "No leagues yet" with Create / Join.)
- **A leaguemate's team opens from the standings and the matchup** (the Planner, 2026-10-16,
  F5 of the W8 tap-through; Giorgio has a veto), verbatim: "B, wire it. The standing rule
  'league features follow fantasy football' decides this: ESPN, Sleeper and Yahoo all open
  another manager's full team from the standings (and from the matchup header), and within a
  league rosters are public by convention; holdings are already visible here ('Owned by …'),
  so a read-only full view of a leaguemate's team exposes nothing new (only leaguemates, per
  the profile-visibility rule; it's a member-gated read). Entry points, two: (1) tapping a
  manager's row in League › Standings (and in Home's standings excerpt via the same
  ManagerRow); (2) tapping the opponent's avatar/name in the Matchup scoreboard header. Your
  own row opens your Portfolio tab instead. Nothing else links there; the deep link stays on
  the resume allow-list."
  - **Its words** (the Planner, same day): "View {name}'s team" / "View your portfolio" for
    VoiceOver; "{name}'s team didn't load" (no name known: "This team didn't load") with "Try
    again"; the screen's title is the manager's display name. A name ending in "s" still
    takes "'s" ("Francis's team").
  - **How the entry points behave** (Design Lead, 2026-10-16; the screens look the same at
    rest, so no A/B):
    - **Home's standings excerpt** is no longer one button. Its header (the title, "Through
      Week N" and the chevron) opens League › Standings, with its tap area grown to 44pt and
      the layout unchanged. Each manager row opens that manager's team, and yours opens your
      Portfolio. No chevrons on the rows; every row behaves the same, bots included.
    - **The Matchup scoreboard:** the WHOLE half is the button, not only the avatar and name
      (a far bigger target; tapping the score beside a name never does nothing). Your half
      opens your Portfolio. The lead line under the halves stays plain text. A "Bye week" half
      and the compact boards in All matchups open nothing.
    - **League › Standings** rows open the team the same way.
    - **VoiceOver:** a row or half keeps its content as its label (rank, name, record and
      season gain; or name and total), is a button, and carries the Planner's words as its
      action ("View {name}'s team" / "View your portfolio").

## Home and Portfolio

- **Home shows only the selected league**, with the league pill ("+N" hint) to switch.
  There's no "your other leagues" row.
- **Home hero:** team value is the big number; under it "+$X (+Y%) season gain · +$Z today"
  (the percent in brackets since 2026-11-17, "Dollars and their percent" below; before that
  "+$X · +Y% season gain · +$Z today"). Home has no chart (below).
- **No chart on Home; the matchup comes first** (2026-11-03, option A, board
  `#call-home-chart`). Giorgio on 1.3.0 (8): "I don't love the chart on the home screen... I
  don't love the dashed line up top. ...you don't really get a sense of what's going on,
  because there's not really clearly labeled axes. ...it's pretty redundant having that, and
  then the view of the portfolio page is very similar. I think the portfolio page graph is way
  more impactful and useful." His pick: "A". So, in season, Home is: the hero, then This week,
  then **"Your season"**, then Standings. The season chart and its 1W / 1M / Season tabs are
  gone from Home; the money line lives on Portfolio.
  - **"Your season"** is one row of tiles, one per week, scrolling sideways. A played week
    shows "Wk N", W / L / T and your score that week. This week's tile is outlined in your
    colour and never repeats This week's score (it says "Live" while the market is open).
    The weeks ahead show who you play. The title opens League › Schedule; a tile opens that
    week's matchup. Until a past-week matchup screen exists (Matchup shows only the current
    week today), this week's tile opens Matchup, and every other tile opens League › Schedule.
  - New strings, approved as written (2026-11-03): "Your season", "Wk 1" … "Wk 14".
- **A calm Home** (2026-10-12, option A "same content, calmer", board `#call-calm-home`),
  after Giorgio's first look at 1.2.0: "this UI on the home screen is awful. section bubbles
  are touching, it feels clunky, and there is too much going on". Same content, calmer:
  team value is the ONE standout number; This week, "Your season" and Standings sit under it
  (the season chart that sat directly under it is gone, 2026-11-03); This week and Standings
  are two quiet cards that open Matchup and League › Standings; sections never touch (24pt
  between blocks); one primary action per screen. Before the draft and after the season
  follow the same rules (fewer, merged cards; the countdown leads; Run it back or the ask is
  the only primary). Nothing is removed from Home; repeats are.
- **Portfolio's gain is "since the draft"** (value − cost). It's deliberately a different
  label from "season gain"; never reuse one for the other.
- **Every chart has the same six ranges: 1W, 1M, 3M, 6M, Season, YTD** (2026-11-17, build 14
  era; this replaces "Stock chart ranges" below). Giorgio's words, after seeing the sheet for
  a stock he owns: "this double graph look when you open a stocks window is awful", and then:
  "every chart like that, whether its the portfolio graph or the specific stock view, there
  should be 1 week, 1 month, 3 months, 6 months, Season, and YTD".
  - It applies to the Portfolio graph (1W / 1M / Season today), the stock sheet's chart (1W /
    1M / 3M / 1Y today) and the sheet for a stock you own or someone else owns (the player
    card).
  - The player card stops stacking two charts (a Season chart over a This week chart, his own
    ruling of 2026-10-12). It has one chart with these ranges. He had been shown A (one chart
    with a Week / Season switch) and B (one chart, season only) the same hour; his answer was
    this rule, which is A with six ranges.
  - 1Y is not in his list, so it goes; YTD and 6M take its place. 1W is the past five trading
    days and no chart has a dotted line (both ruled 2026-11-16, below). There is still no 1D.
  - **Ranges longer than the league has existed are greyed out** (2026-11-17, the same
    conversation, shown a Portfolio mockup for a one-week-old league where 1M, 3M, 6M and YTD
    would all draw the Season line). His words: "grey out the ranges longer than the league
    has existed." Said of the Portfolio graph, whose line starts at the draft. Stock charts
    were ruled later the same day (see "A range a chart cannot draw yet", below).
  - **The gain or loss shown with a chart follows the selected range** (2026-11-17, same
    message). His words: "we need to make sure the P/L number changes with each click to a
    different time frame". So choosing 1M shows the gain over that month, choosing Season
    shows the gain over the season, and so on, on every chart that has the ranges. Today the
    stock sheet's line under the price always says the day's change ("−$17.04 · −2.53%
    today") and Portfolio's says the season's. Not decided: the words that name each period
    beside the number, and where that number sits on the card for a stock you own, which
    already has three fixed figures (Price, Week gain, Since the draft). The Design Lead
    boards both; any new words come to him first.
  - **The range gain shows both numbers, the percent in brackets, then the period in words**
    (2026-11-17, boards `#call-gain-format` and `#call-range-gain`, PR #496; typed in the
    Design Lead's chat). His words, in order: "ok i like the past 6 months but i dont like the
    fact that there are two numbers only separated by a dot" (17:31Z); shown the two formats
    as mockups, "A" (17:41Z), "for both" (17:41Z), and, clarifying what "both" meant, "A both
    numbers and A with past 6 months word example" (17:43Z).
    - Format (A): the dollars, the percent in brackets, then the period, on every chart:
      **"+$54.60 (+41.42%) past 6 months"**. No dot between the two numbers. B (one number
      per chart: dollars on Portfolio and a manager's stock, percent on a stock you are
      looking at) was not picked. The reason given to him for keeping both: dollars decide
      matchups, and the percent is what compares stocks at different prices.
    - Words (A), approved copy by this pick: **"past week"**, **"past month"**, **"past 3
      months"**, **"past 6 months"**, **"this year"**, and for Season the existing **"since
      the draft"**. B (repeating the range label, "· 6M") was not picked; he had first leaned
      to it for fit ("might be hard to fit all those words in option A on one screen"), then
      chose the words once shown they fit on one line at his text size. A line that has to
      wrap never breaks inside a number; where exactly the bracket format breaks is the
      Design Lead's to set.
    - **On the card for a stock on a team: two figures at the top, and the range gain above
      the chart** (2026-11-17, the player-card half of `#call-range-gain`, PR #496; typed in
      the Orchestrator's chat, 18:06Z: "B and merged 499"). The top strip is Price and Week
      gain. The range's gain sits right above the chart, in the format above, the same place
      as on Portfolio and the stock sheet, so every chart reads the same way. A (three
      figures, the third following the range) was not picked. Week gain stays because it is
      the matchup week, Monday to now, which is not the same as 1W, the past five trading
      days. "Since the draft" is no longer a third figure; it is what the range gain says on
      Season. This replaces "Three key figures, not four" (2026-10-12). The Design Lead first
      recorded his earlier "for both" as covering this and withdrew it when he clarified.
    - This ruling was about the gain beside a chart. The other lines that pair dollars and
      a percent were asked about later the same day; see the next rule.
  - **Dollars and their percent: the percent goes in brackets, everywhere, not only beside a
    chart** (2026-11-17, A/B mockup in the Planner's chat; typed there, 23:23Z: "A"). The
    question put to him: brackets wherever a dollar figure sits beside its own percent (A),
    or beside charts only, with every other line keeping the dot (B). Before picking he
    asked what the UX rules point to ("What does all of those UI, UX laws we were reviewing,
    we talked about, what does that say?"); the Planner's answer was A, from UX rules 5 (the
    same kind of thing looks the same on every screen), 1 (money surfaces follow Robinhood)
    and 4 (the pair reads as one number in two forms), with the caveat that the rulebook
    never names brackets.
    - The rule: where a dollar gain and its percent sit together, it is **"+$X (+Y%)"**. No
      dot between the two.
    - The dot stays where it separates two different facts. The two lines he was shown:
      - Portfolio's line under the value: **"+$121.27 (+0.99%) today"**. This is already on
        main (#508), changed during a Design Lead review before he had been asked; his pick
        keeps it. B would have put back "+$121.27 · +0.99% today".
      - Home's line under the team value: **"+$343.59 (+2.86%) season gain · +$121.27
        today"**. Only the first pair takes brackets; the dot before "today" stays. The
        label "season gain" does not change.
    - Not shown to him, and covered by the rule's wording: every other line that pairs a
      dollar gain with its percent (a matchup's "This week" line, a roster row, the stock
      sheet's day change). The Design Lead lists them and applies the same format; if the
      brackets change how one of those lines fits or wraps, that still comes to him first.
  - **On a gain line only the numbers are coloured; the words stay grey** (2026-11-18, A/B
    mockup in the Planner's chat). The app was inconsistent: on Home the words after a
    figure ("season gain", "today") were grey, and on Portfolio they took the green or red
    of the figure ("today" since #508; the whole "since the draft" line). Shown A (words
    grey everywhere, only the numbers coloured) beside B (the words take the gain colour
    everywhere), on Home's line and Portfolio's two lines, he picked **A**.
    - So on Home and Portfolio the figure is green or red and the words that say what it is
      ("season gain", "today", "since the draft", and the period words of a chart's range
      gain) are the app's grey. Portfolio changes; Home already looks this way.
    - Shown to him: Home's line and Portfolio's two lines. Covered by the same pick because
      it is the same line: the range gain above any chart (the stock sheet, the player
      card, a manager's portfolio). Any other place a word follows a coloured figure is the
      Design Lead's to list, and comes to him only if it would look different from these.
    - Not asked: the weight of the words. They are regular weight in A as drawn; the figures
      keep theirs.
  - **Which range a chart opens on: your team on Season, a stock you are shopping for on 1W**
    (2026-11-17, board `#call-chart-default`, PR #496; typed in the Orchestrator's chat,
    18:00Z: "go with B"). The Portfolio graph and the card for a stock on a team open on
    Season. The stock sheet in Buy a stock opens on 1W. A (every chart opens on Season) was
    not picked. The reason given to him: each chart opens on what you most likely came to
    check, your team's whole run or a stock's recent move.
  - **A finished season's chart shows the whole season, without the six ranges** (2026-11-18,
    on build 1.3.0 (17); typed in the Planner's chat). His words: "once a season is over, I
    think that some of those options of like the viewing and the portfolio thing should be
    kind of grayed out or not an option, right? If a season's already completed, I think the
    graph should just show only it should there should be a bit different of a view, right?
    There shouldn't be the six options because let's say it's a season that's concluded like
    a year ago and I press 1 week, that doesn't really make sense. So if a season's over, that
    chart should just show the full season progression of how the portfolio was. And maybe
    you can give me some mock-ups of what that'll look like because I don't think it should
    have all those six options if most of those don't even apply."
    - Decided by his words: in a league whose season is over, the Portfolio graph draws the
      season from the draft to its last day, and the six range buttons are not offered.
    - **The look: the season line alone (A)** (2026-11-18, A/B mockup in the Planner's chat).
      Shown A (the season line alone) beside B (the line with the week-by-week results under
      it, the "Your season" strip from Home), his words: "No, I think just the chart, because
      that week by week thing is going to appear on the homepage. Like, that's where that
      lives. I don't think we need to clutter it. So just option A."
    - What A showed, and so what the pick covers on the Portfolio screen of a finished
      league: the label "Portfolio value" with the existing "Final" chip, the value, the
      gain "since the draft", the line from the draft to the season's last day, then
      Holdings. No range buttons, no "today" line, no "Buy a stock".
    - **The value stops at the season's last day.** This was drawn in both mockups and put to
      him in words ("the value stops at the season's last day... check that you agree"); he
      picked A without objecting. It is not a sentence of his own. On build 17 a finished
      league's Portfolio still moved with that day's market ("+$8.49 (+0.47%) today" on a
      league marked Final); that goes.
    - **The card for a stock from a finished season shows the season only (A)** (2026-11-18,
      A/B mockup in the Planner's chat). Shown A (no figures at the top; the gain "since the
      draft", the chart to the season's last day, and "How you got it") beside B (the same,
      keeping the stock's live Price and today's change at the top), his words: "Yeah, so
      probably just A, because like, look, this is a previous season. Today's pricing
      doesn't really matter. Like, if I drafted a 6 week season a year ago and I look at it
      today, doesn't really matter what the performance is until until now. The season's
      over."
      - Gone from that card in a finished season: Price, Week gain, the range buttons and
        Sell.
    - **A finished season is closed to buying and selling.** Drawn in every mockup that day
      ("Buy a stock" off Portfolio, Sell off the card) and put to him twice in words, the
      second time as "Tell me if you want trading to stay open after a season ends"; he
      picked A both times and did not ask for it to stay open. It is not a sentence of his
      own beyond "The season's over." On build 17 a finished league's Portfolio still
      offered "Buy a stock".
    - **The Matchup tab after the season: a recap of every week, not a blank and not only
      the last matchup** (2026-11-18, the same board, call 1; typed in the Planner's chat).
      Found that day: in a league whose season is complete the Matchup tab is blank
      (`apps/mobile/app/(tabs)/matchup.tsx`, `if (view.kind === 'complete') return null`),
      with no ruling behind it. Shown A (keep the last matchup with its final result) beside
      B (blank, as now), he picked neither. His words: "for For number one, there should be
      some sort of like recap of it. Like if I go to the season or matchup when the season's
      over, there should be like all the weeks like listed, and then I can click on one and
      see how like each week's matchup went. Could you mock up something for that?"
      - Decided by his words: after the season the tab lists the season's weeks, and tapping
        a week shows how that week's matchup went.
      - **The recap's look: your result and your gain on each row (A)** (2026-11-18, A/B
        mockup in the Planner's chat; "A"). Each row is a week: its label ("Wk N", or the
        existing round chip for a playoff week), "vs {name}", W or L, and your own gain that
        week, with a chevron. Tapping a row opens that week's matchup in the existing
        finished-week view, with a Back control. B (both teams' totals on the row, which
        needed the new word "to") was not picked. No new words in A.
      - Told to him with the mockup and not objected to: the weeks run newest first, so the
        final is at the top; the "My matchup | All matchups" switch stays, and "All
        matchups" lists every team's results the same way; a manager who missed the
        playoffs or was knocked out sees the weeks they played, with the app's existing
        line for them ("Out in the {round}", "You didn't make the playoffs.") at the top.
        These three are the Planner's assumptions, stated to him, not his own sentences.
    - Not shown to him: a manager's portfolio viewed from a finished league. The Design Lead
      specs it to match A and shows him only if it needs a look of its own.
    - This is an exception to the grey-in-place rule below, which is about a range a chart
      cannot draw YET.
  - **A range a chart cannot draw yet is greyed in its place, never hidden** (2026-11-17, board
    `#call-season-predraft`, PR #496; typed in the Orchestrator's chat, 18:04Z: "B and D").
    - B: before the league has drafted there is no season, so the stock sheet's Season button
      shows greyed out in its usual place. The row keeps its six buttons. A (hide Season, five
      buttons) was not picked.
    - D: on a stock's chart, a range longer than the stock's own trading history is greyed out
      until the stock is old enough: a recent listing shows 3M, 6M and YTD greyed. C (those
      ranges still work and show the shorter history) was not picked. Before picking he asked
      "when you say new stock, you mean a recent ipo? or new stock to the portfolio?" and was
      told a recent IPO: a stock's chart is its market history, whoever owns it. So buying a
      stock yesterday greys nothing on its chart.
    - This extends his grey-out ruling for the Portfolio graph (above) to stock charts, which
      that ruling had left open.
  - The Design Lead's spec, NOT asked of him (2026-11-17): on a stock's chart the shortest
    range, 1W, never greys. A stock listed less than a week ago would otherwise have every
    range greyed and nothing to open on, since the stock sheet opens on 1W; so 1W stays
    available and draws only the days that exist. Treated as what his rule needs to work, and
    to be raised with him if he ever questions it.
  - The Design Lead's spec, shown to him on that board under both options and not objected
    to (not his own ruling): after the draft, Season runs from the league's draft day to now
    for ANY stock, owned or not. It is the same window for everyone in the league.
- **Stock chart ranges** (2026-10-05, option A; SUPERSEDED 2026-11-17 by the rule above): 1W /
  1M / 3M / 1Y, with 1W the default.
  There's no 1D, because the price history (historical-bars) is daily bars only.
- **The stock chart has no dotted line** (2026-11-16, build 1.3.0 (14), the stock sheet).
  Giorgio's words: "I don't understand what this dotted line is because on some it's up. I
  mean, I guess it's where like the stock started that day... quite frankly, I don't love that
  sometimes it's up high, sometimes it's down low. I think we just get rid of that. Like it to
  me, it sometimes it looks like a y-axis or an x-axis." So the dashed reference line (the
  range's first close, a Design Lead ruling of 2026-10-06) is removed from the stock chart.
  The change line under the price ("−$17.04 · −2.53% today") is not what he objected to.
- **1W on the stock chart is the past week, not this calendar week** (2026-11-16, same
  screen). On a Monday the 1W chart was one stroke under a Mon to Fri axis. His words: "on a
  Monday... I click the 1 week on deer, and it's just a straight line down. I don't love
  that... It doesn't do just like the week you're in... that needs to be changed." His
  reference was Apple's Stocks app, whose 1W shows the last five trading days whatever day it
  is (a reference only; third-party screenshots are not kept in the repo). So 1W always shows
  the past five trading days. Shown A (one point a day, from the daily history we have) beside
  B (detail inside each day, like his reference, which needs prices within the day that we do
  not fetch), he picked, the same day: "A now, B later with the supplier". So A is built now,
  and B is part of the price-supplier work, not a separate promise with a date.
- **Buy a stock: the top of the screen is too crowded** (2026-11-16, Portfolio › Buy a
  stock). His words: "I don't love how we're formatting it to where it's like League B up top
  and then like a small little portfolio and then big buy of the stock and then the thing. It
  just looks like that top left is a bit too jumbled and there's too much going on. I think we
  need to kind of reimagine how we make sure to be able to give the user an option to go back
  to the previous page while still having like whatever's important on the page they're on and
  it not just be all right next to each other, because I think it looks weird that there's
  this huge big basically blank page and just all the text is all in like the same top left
  area." Not ruled how: the Design Lead boards it (the league pill, the back link, the title
  and the search field), and it comes to him as A / B.
  - **Ruled the same day: "B"** (board `#call-buy-top`, PR #478; typed in the Orchestrator's
    chat, 2026-11-16 21:44Z: "B, and merged 483", in reply to "A or B for the top of Buy a
    stock"). The top of Buy a stock is ONE row: the back arrow and the search field ("Search by
    ticker or name"). No title. The league pill is not on this page: you buy for the league
    you came from, and switching leagues stays on the tabs. VoiceOver keeps "Portfolio" on the
    back arrow. At the largest text size the empty field's placeholder may end in "…". No
    new words. This is about the page as it is today; where "Buy a stock" itself ends up once
    stock search has its own tab is a separate, open question (see "Stock search gets its own
    tab").
- **Cash from sales** (2026-10-05, option A, budget-cap and price-tier leagues): a sale's cash
  shows as its own "Cash from sales" line, and the header value includes it, matching Home.
- **Market-data credit line**: credit Alpaca on price surfaces.
- **Live price on screen is preferred; a 15-minute-old price is acceptable if the terms
  require it** (2026-11-12). Shown the two side by side (A: the price on screen is live and
  is the price a buy fills at, as the app does today; B: the price on screen is about 15
  minutes old, labelled as delayed, and the buy still fills at the real current price on the
  server, as HowTheMarketWorks, Wall Street Survivor and StockTrak do), Giorgio's words: "i
  prefer a but b would be acceptable if its what terms dictate". So a price supplier is
  asked for both, A is chosen where the licence and its cost allow it, and B is the
  fallback, not a failure. B's on-screen words (the delayed label, a total that can differ
  from the fill) are not written or approved yet; they go to him before any build. The
  supplier is not chosen, and the Alpaca credit line above changes with it.
- **Appearance:** System / Light / Dark. One layout and component set with two complete
  themes; no screen mixes them.
- **Both themes, designed together, neither first** (2026-10-12, overruling the reset plan's
  "dark first"): "I don't want the app to only be in dark mode. I want us to build an app
  that can work well and is designed for either light or dark mode. Orchestrator just told
  me that it was dark mode first, then light. No. I want one that it doesn't matter what
  mode you're in, it's going to be built for either." So every direction on the board, every
  token, every screen and every gate is done in Light AND Dark at the same time; a screen is
  not approved in one theme without the other; the references for Light are E*TRADE and
  Yahoo's light surfaces, for Dark Sleeper, ESPN and Robinhood.

- **League › Schedule** (2026-10-05, option A, "keep it"; 3c-D4): the League tab keeps the
  full season schedule, every week in order: past weeks with your result and score, this
  week "● Live", next week "vs {name} · Next", then a closing playoffs line ("Then the
  playoffs: 4 teams · 2 weeks of playoffs · no byes."). Not dropped to Standings + History.

- **Manager rows** (2026-10-08, S-10): one row style everywhere a list of managers appears
  (League standings, Home's excerpt, History, the lobby, the Run it back list, the bracket).
  Giorgio: "just bold the users name. dont need to put the (you), people know their name.
  just bold it." Then, asked about the tint: "blue tint as well". So: your name is bold and
  your row keeps the light blue tint; everyone else's name is regular weight; no "(you)"
  label. Gains are coloured by sign; movement arrows on League only.
- **Draft recap** (2026-10-08): the designed League › History recap is NOT in 1.2.0 (Design
  Lead ruling, 1.3). Nothing in 1.2.0 links to it; the draft's ending is Draft complete.

## Draft

- **"A draft pick CAN NEVER be unused."** A missed turn is always auto-picked. There's no
  Skip, and no unfilled-slot state for people.
- **No late picks** (2026-10-13, relayed by the Orchestrator): once a manager's clock has
  expired, the server refuses their own pick (a 2-second grace for network latency only)
  and the auto-pick takes the turn. Judged on the server's clock, never the phone's.
  - **After the clock, only the auto-pick fills the turn** (2026-10-13), a stalled turn
    included: no manual rescue. "the auto pick has to work"
- **Auto-pick picks a good stock**: the manager's queue first, then the best available,
  meaning the largest market cap that fits. It must NEVER break the league's criteria
  (price brackets, category slots, budget, the draftable universe).
  - **The auto-pick never stalls on a stale price** (2026-10-13). Giorgio's ruling:
    after a manager's clock expires, only the auto-pick fills the turn, a stalled one
    included: "the auto pick has to work". So any stock that is legal at its LIVE price
    must be found. A stock is never ruled out on its cached catalog price when a live
    price could make it fit: when the cached price is up to 50% past a slot's
    bracket or the budget left, or the budget reserve is the only thing refusing it.
    Those stocks are live-priced, in batches. "No legal stock" is reported only after
    that. While prices are unavailable (a vendor outage, shown as Paused), the turn
    keeps retrying and fills on its own once prices come back.
- **The auto-pick always stays within the league's rules** (2026-10-13). Giorgio: "auto
  draft needs to work. if a user wants to auto draft it has to work and pick a stock
  within the paramters". And: "if a player runs out of time, then it auto picks for them.
  there can never be an instance where a player doesnt get a pick. its like fantasy
  football, you run out of time and it auto drafts for you."
  - The auto-pick is the missed-turn path. There's no auto-draft switch to opt into.
  - It only takes a stock that fits the price range, the category and the budget. With
    the never-stall rules above it always finds one, unless no stock fits at all.
  - If no stock fits, the turn waits and keeps retrying. Nobody is notified (see below).
  - This supersedes the same day's "closest stock" and "cheapest anyway" rulings.
- **Small text under a heading goes, on the pre-draft League screen too** (2026-11-16, build
  1.3.0 (14), the League tab before a draft; the fourth time he has said it, after UX rule 12).
  His words on the queue card: "there's still the issue where we have like the header and then
  there's just like a bunch of smaller subtext subheader below it that I don't want. I don't
  want a page covered in text." On saving: "I don't like the save queue button. It should just
  automatically save if I do anything". On the card as a whole: "it's weird that there's just
  like the your queue, then a bunch of little text, and then kind of a bigger stock thing, and
  then a big search bar, and then a big save queue button. It just looks cluttered." On the
  draft card: "I don't love that there's draft starts, this big, date thing, and then two lines
  of smaller text below it. We really need to work on removing these small subheader text."
  - Already on `main`, not yet in a build (they arrive with build 15): the queue saves by
    itself with no "Save queue" and no "Not saved yet." (ruled 2026-11-11); the line "If you
    step away, we'll auto-pick from your queue…" is cut (the rule-12 sweep); the "Draft order ·
    Waiting" card is gone at four or more managers (#422); and both lines he quoted under the
    draft countdown ("The draft starts automatically at…" and "The draft room opens at…") are
    cut (`autoStart.ts` `countdownCopy`, the rule-12 sweep, row 7). Build 14 predates all of
    these.
  - Not done: what is left under the countdown is one line, the date and time as a value
    ("Tue, Nov 17 · 7:30 PM ET"), and the queue card's overall weight (a large search field
    under the list). What stays is not ruled: the Design Lead boards both and they come to
    him as A / B. (Corrected 2026-11-16: this note first listed the two cut lines as not
    done. The Planner had matched them in code comments, not in what the card shows.)
  - **The draft card, ruled the same day: "B"** (board `#call-draft-card`, PR #478; typed in the
    Orchestrator's chat, 2026-11-16 21:45Z: "B", in reply to "Next board: the draft card on the
    League tab. A or B?"). The date and time move into the small label above the countdown,
    and nothing sits under the countdown. The two labels are new copy, approved by this pick
    (he was told that picking B approves the wording): **"Draft · {Sat, Nov 14} · {6:44 PM
    ET}"** before the room opens, and **"Draft room open · {12:48 PM ET}"** once it is open.
    The format follows the existing draft-time copy, and the time stays together on one line
    at the largest text sizes. A (build 15 as it stood: "Draft starts in", the countdown, the
    date on a line under it) was not picked.
  - **The queue card, ruled the same day: "B"** (board `#call-queue-card`, PR #478; typed in
    the Orchestrator's chat, 2026-11-16 21:45Z: "B", in reply to "Next board: your queue card.
    A or B?"). The search is no longer a large box under the list. It is the queue list's last
    row: one line, "+ Search by ticker or name", in the accent colour, with no box. A tap turns
    that row into the search field in place, with the same results as today. No new words. The
    lobby and the draft room share one queue editor, so it applies to both. A (build 15 as it
    stood: autosave, no "Save queue", no small lines, the big grey search box under the list)
    was not picked.
- **In the draft room, on someone else's turn: the round and pick are the card's label**
  (2026-11-16, board `#call-draft-turn`, PR #478; typed in the Orchestrator's chat, 21:46Z:
  "B", in reply to "Next board: the draft room while someone else is picking. A or B?"). The
  card had "{name} is up" with two small lines under it ("Round 2 of 6 · Pick 11" and "3
  picks until you"). Now "Round 2 of 6 · Pick 11" is the small label above "{name} is up",
  and one line about you sits under it: "3 picks until you", or after your own pick, "You
  took {SYMBOL} · you're up in 3 picks" in your colour. No new words; the existing lines are
  rearranged. A (the two lines joined into one) was not picked. Part of the rule-12 work on
  small text under headings.
- **The commissioner's "The draft can't start yet" card has no line under its heading**
  (2026-11-16, board `#call-blockers-card`, PR #478; typed in the Orchestrator's chat, 21:47Z:
  "A", in reply to "the commissioner's "The draft can't start yet" card. A or B?"). Both lines
  are cut: "Fix these before {6:00 PM ET}, when the draft room opens." and "If they're still
  open then, the draft is postponed." The "Needs you before {time}" tag, the heading and the
  blocker rows stay. B, the Design Lead's pick (keep only the postponed line, as the one fact
  shown nowhere else), was not picked; he was told A was "the stricter version if you'd rather
  have no lines anywhere" and chose it.
  - The Planner's reading, not his words: he cut a line that stated a consequence, so "it is
    a fact you can't see elsewhere" does not by itself earn a small line under a heading. A
    future board that wants to keep one should expect to be asked the same question.
- **The auto-pick is instant** (2026-11-10, from the build-14 draft on his phone). Giorgio:
  "the auto pick was way too slow. sometimes it took up to 20 seconds after the time expired
  to make the pick. the selection needs to be instant so the draft flow continues". So: when
  a turn's clock reaches zero the pick is made and shown at once, and the next manager's
  clock starts. A wait the eye can see after zero is a defect, on every turn, whether or not
  anyone has the draft room open. The only waits allowed are the ones already ruled above: a
  price outage (shown as Paused) and a turn with no legal stock.
- **No notification when the auto-pick is slow or stuck** (2026-10-13). Giorgio: "Drop the
  wrong 'pick manually' notification and don't add a new one. The commissioner can't do
  anything about it anyway." The commissioner still gets the one "waiting on prices"
  notice during a price outage.
- **Draft budget: no cushion, never stuck** (2026-10-13, budget-cap leagues). Giorgio:
  "safety cushion? when did i ever say there should be a safety cushion?"
  - A pick must leave enough budget to fill the manager's remaining slots at current
    prices, exactly. No extra 10% on top.
  - Never stuck: if prices moved so a manager's remaining slots no longer fit the budget
    left, a pick that doesn't make that gap worse is still allowed, so the draft keeps
    going.
  - Never over budget: a pick can never cost more than the budget left.
  - Same rule for manual picks and the auto-pick.
- **Pick clock:** 60 s default, commissioner-configurable 30–90 s.
- **Draft order:** a league setting with two modes, Random or Manual, never an automatic
  commissioner-first. Both lock at T−1h. If Manual was never saved, the random order
  locks. The order is set at the later of T−1h and the league reaching 4 members. A
  joiner after T−1h picks last. (Since 2026-10-14 nobody can join after T−1h; see "Share hides
  while teams are locked" under League lifecycle.)
- **The draft starts by itself** (2026-10-06): "the draft is not something that is
  started manually. It should be something that starts at the minute that is selected by
  the commissioner. So if the commissioner sets it for noon tomorrow, the draft room will
  open at 11 a.m. and the draft will automatically start at noon."
  - The countdown ("Draft starts in …") shows as soon as a draft date is set.
  - At T−1h the draft room opens and the order is set.
  - Two pushes to everyone: when the room opens (with your draft position), and when
    the draft starts.
- **The draft room is a real, familiar room** (2026-11-10; plan
  `docs/plans/2026-11-10-pre-draft-room.md`):
  - It opens an hour early and it is the room you draft in: "When the draft room opens,
    there should be something I click on." "the draft room is just something you can enter
    an hour before, but then that's actually going to be where you're drafting."
  - Familiar from the fantasy apps: "A user needs to be able to open it and be like, oh, this
    is just like ESPN or Yahoo or Sleeper … I know how to queue. I know how to draft. I know
    how to see the order I'm in". Structure from them, the look stays ours (2026-10-12).
  - Phone and laptop: "phone first, then laptop. The phone and the laptop should be the exact
    like kind of same layout. It's just the laptop is like an expanded version … The phone
    needs to just be more condensed."
  - His picks: "A, a button into the room"; "A, the ESPN way" (rows show Queue, and Draft
    only when it is your pick); "A, it tells you, you tap" (at the start the app never
    replaces the screen you are on).
  - **The order reveal:** the first time you open the room, "some sort of little animation
    … that kind of reveals what their draft pick is". Chosen: the board seats itself (the
    avatars shuffle and settle, your number appears alone, then the board comes in). Nothing
    overlaps the number: "the draft grid and stuff kind of disappears for a second for that
    big visual to pop up." And "A, keep it a surprise": your position shows nowhere, the
    room-open notification included, until you have entered the room once. This replaces the
    2026-10-06 line that the room-open push carries your draft position.
  - **In the room:** on your pick you draft straight from your queue ("I should be able to
    draft right from there"); a stock anyone drafts "disappears" from every queue; Latest
    picks show "the … actual name" beside the ticker.
  - **After the draft:** "right after you're done, it shows your draft recap. And then later,
    there should be some way in the app to kind of go back and see like the draft as a whole
    … like a little draft recap room", with "little superlatives … Just kind of a little fun
    interactive thing." A Draft recap row on the League tab opens Awards, Board and Teams;
    "include all the awards" (Big spender, Bargain hunter, Quickest draw, Down to the wire,
    On autopilot, All in, Spread out, First off the board, Steal of the draft).
- **When a draft can't start** (2026-10-06):
  - The commissioner is warned BEFORE the room opens, with time to fix it.
  - The real gate is room-open time (T−1h). If the league still isn't ready then, the
    draft is postponed, everyone is notified, and the commissioner fixes it and picks a
    new time. No late start: "people still need an hour heads up and notice."
- **Draft time** (2026-10-06): only in 15-minute increments (:00 / :15 / :30 / :45), and at
  least one hour out. It can't change once the room opens, except when postponed.
- **Draft-time changes** (2026-10-06): "Anytime a draft time is changed, everyone receives
  a notification to know exactly when it's happening." Everyone means every member,
  including the person who made the change: "Everyone in the league gets the
  notifications when draft times are changed."
- **Setting the draft time** (2026-10-06, "B on both", the UX audit's "Your call" sections,
  PR #140; relayed by the Orchestrator):
  - The draft-time picker commits ONLY on a full-width "Set draft time" button. The × closes
    without saving. Where a time is optional, "Set later" is a text button.
  - On Home, when the commissioner has no draft time set, "Set draft time" is the primary
    action and opens the picker in place ("Pick a time, and the countdown starts here."),
    with "Build your queue" secondary.
- **A draft deadline always names its day** (2026-11-11, from the build 1.3.0 (14) phone
  pass, step 25, where "before 6:30 PM ET" read as tonight for a draft six days away;
  Giorgio picked **B** on board #call-deleted-leaver, PR #403, over the Design Lead's A,
  relayed by the Orchestrator; his words: "include today when day of"). The commissioner's
  blockers card says the day in both places, the tag ("Needs you before …") and the line
  ("Fix these before …, when the draft room opens."), today included: "before 6:30 PM ET
  today", "before 6:30 PM ET tomorrow", "before 6:30 PM ET on Tue, Nov 17". The day follows
  the phone's own date and the time its own zone (Times show in the player's own time zone).
- **Your turn in the draft room** (2026-10-06, Giorgio's board review): your turn must be
  impossible to miss. "That top part of the screen should like flash a color when they're
  up just to make sure that they're they really notice it", with text "that's very hard to
  miss" (a colour change and bold), plus "a sound notification or a buzz".
- **You're always told it's your turn** (2026-10-11): "if a draft is happening, the player
  should be notified if its their turn even if they close the app." Every turn, the FIRST
  pick included, gets an "It's your turn" push the moment it starts, whether the app is
  closed or open. With the app open (any tab), it buzzes and chimes once per turn and the
  banner adds no second sound; in silent mode, just the buzz.
- **The draft board's look** (2026-10-06): Giorgio is "not a fan" of the current draft
  board UI. A redesign is wanted, but later ("save that for later"), not in the current
  pass.
- **The clock card: no ", then N", no "60-second picks"** (2026-10-13, on the W4 Draft room,
  relayed by the Orchestrator): "I don't like the then blank blank picked twice. I think it
  just should show the you're on the clock and then what round and pick number it is. I don't
  think it needs that last thing at the bottom." His words were about the your-turn card. On
  BOTH clock cards (yours and someone else's) exactly two things go: the snake suffix (", then
  12": the round line reads "Round 2 of 6 · Pick 11") and the "60-second picks" line. Nothing
  else changes: the headline ("You're on the clock" / "{Name} is up"), the clock ring and its
  digits, the status lines (a stalled turn, auto-pick waiting for prices) and, on someone
  else's card, the lines that tell you when you're up ("You took AAPL · you're up in 2 picks",
  U-09; "3 picks until you", UX rule 10) all stay.
- **No "Auto" tag on the draft board** (2026-10-13, final; the A/B was cancelled): "no auto
  tag". A tile shows the pick, the category code and the ticker; an auto-pick is said in the
  pick log's words and to VoiceOver, never as a mark on the tile.
- **The queue row** (2026-11-05, option A; board `#call-queue-row`, relayed by the
  Orchestrator). On build 9 (step 16): "the queue only shows the ticker name, it should have
  Corporation Name (with ... if the name is too long), ticker, and price." Shown A (like the
  draft room's search) and B (like Holdings, with the round ticker badge), he picked: "i want
  option A".
  - A queue row reads: the position, the ticker over the company name, the price on the
    ticker's line, then up / down / remove as before.
  - The ticker is never cut and never split across lines; only the company name ends in
    "…". When the ticker and the price don't both fit on one line, the price moves under the
    ticker.
  - The price is the stock's latest trade, the same number the draft search shows, read when
    the card opens. A price that doesn't load shows "–", never "$0.00" and never a blank;
    while it loads, a placeholder bar holds its place. No fallback to a stored price (it can
    be days old, with nothing saying so).
  - The row's text stops growing at 1.3×, as Holdings and Schedule rows do, so the buttons
    stay on the row at the largest text sizes.
  - While the market is closed, one line under the card's intro: "Prices at Wednesday's
    close." (the day changes with the last close). Approved by Giorgio, 2026-11-05: "the copy
    line is fine".
- **Your queue saves as you go** (2026-11-11, "B saves as you go"; board `#call-queue-save`,
  shown A keep the button, B saves as you go, and B when a save fails, relayed by the
  Orchestrator). Every add, remove or reorder saves on its own a moment after you stop, before
  the draft and in the room. There is no "Save queue" button and no "Not saved yet." If a save
  fails, "Your queue couldn't be saved." shows in place with "Try again", and the list stays as
  you left it. No new words. Until this is built, "Save queue" and "Not saved yet." stay (the
  rule-12 sweep does not cut them on its own).
- **The clock while you search** (2026-11-06, option A; board `#call-draft-clock`, relayed by
  the Orchestrator; his words: "A for clock"). On your running clock the search scrolls up to
  clear the keyboard, which took the clock card off the screen while you choose.
  - While it is your pick and your clock is running, and the clock card is off the screen, a
    small clock is pinned at the top of the draft room: the ring, the seconds, and "Your pick".
    It goes when the card is back in view, when you pick, or when your turn ends.
  - "Your pick" is approved as written with A (he picked A from frames labelled with it; the
    Orchestrator told him it was new wording).
  - The room's order stays as it is: the clock card, the draft board, then the search.

## Trading

- **Trades are whole positions**: a sell is the entire position, and a buy invests the
  whole source. No partial amounts.
- **Per-slot (fixed_notional) leagues:** a replacement buy uses exactly the sold slot's
  sale proceeds. The user picks which freed slot funds a buy.
- **Budget-cap and price-tier leagues:** one share per buy, the whole position per sell,
  and a sale's cash returns to the budget (budget-cap). Price-tier leagues have no budget.
- **Price-tier trades** (2026-10-06, option A, "Replace in the same tier"): selling frees
  that stock's slot; a buy must fit a free slot by its price and takes it ("Fills your
  $100–$200 slot"). A tier is set by the entry price and never moves. Category slots name
  their category ("Fills your Tech slot"); a slot with neither is "Flex".
- Trading follows market hours (the server refuses closed-market trades).
- **Trading window** (2026-10-08): the market-hours rule stays. Giorgio considered a
  fantasy-style lock (trade only while the market is closed) and ruled against it: "im
  leaning keeping it like a real portfolio where i cant buy/sell after hours." Decision on
  the Planner's three options: "Immediate A with C as the long term plan", where A = trade
  only while the market is open, and C = later, orders placed after hours that fill at the
  next open (Robinhood-style). C is parked as a future plan, not built now.
- **Search and save any time** (2026-10-08): "a user should still be able to search a stock
  when they arent allowed to buy. they should still be able to search and add stocks to a
  watchlist or something to save for later." Search never depends on market hours; a
  watchlist exists (plan: [`plans/2026-10-08-trading-window-and-watchlist.md`](plans/2026-10-08-trading-window-and-watchlist.md)).
- **Stock search gets its own tab** (2026-11-16, build 1.3.0 (14)). Giorgio's words: "right
  now, the only place to look up a stock is when you go to buy a stock. There should be some
  sort of search feature. Maybe there's just a new tab at the bottom that's just a little
  magnifying glass or something, and there's just like a search, kind of like a discover or
  like a search, almost like a waiver wire kind of style for if it's fantasy football. That
  way... I can go in and I can look at different stocks and I can kind of look around, see
  different markets, something like that. So maybe that's something that we start planning is
  almost like a what our version of like the waiver wire is going to look like a discover page
  where I can go and search up stocks and then add them to a watch list or add them to
  something like that. Also, once the season begins, because right now, if I want to look up a
  stock, I have to go to the buy a stock tab or bar in the portfolio."
  - Shown his 2026-10-09 pick (A: the watchlist as a tab inside "Buy a stock" plus a
    "Watching" section on Portfolio, four tabs) beside B (search, the watchlist and browsing
    in a tab of their own in the bottom bar, five tabs), he picked **B**. This replaces
    decision 12 of the watchlist and claims plan for where it lives. Everything else in that
    plan stands: search any time, the per-league watchlist, daily claims, the waiver order.
  - **Buying lives in the new tab; selling stays on a stock you own** (2026-11-18; typed in
    the Planner's chat). His words: "Now, for the discover, I think then the buy stock should
    live in that new tab. I think if I go to my portfolio and I click on on a stock that I
    own, I still have the option to do the selling from there. But this new discover tab
    should be the true home of the buy and sell and the search function when it comes to
    stocks."
    - So "Buy a stock" leaves Portfolio and the new tab is where a manager searches and buys.
      Tapping a holding on Portfolio still opens its card with Sell. A stock you hold can
      still be sold from wherever its sheet opens, search included (2026-10-10, board
      `#call-sell-from-search`).
    - He called it "discover" here, as he did on 2026-11-16. The tab's name is still not
      decided.
  - **The new tab is the fifth, last on the right** (2026-11-18, A/B mockup in the Planner's
    chat). Shown A (Home · Matchup · League · Portfolio · the new tab) beside B (the new tab
    in the centre, League and Portfolio each one place to the right), he picked **A**. The
    four existing tabs do not move.
  - **Its name should say it is where you buy and sell, not only search** (same message). His
    words: "I'm thinking we should name it something like market or something where it also
    indicates that it's not only a search, but also where you could buy or sell your
    portfolio." So "Discover" (his working word until now, used in the mockup) and "Search"
    are out.
  - **The tab is called "Stocks"** (2026-11-18, three-way mockup in the Planner's chat: A
    "Market", B "Trade", C "Stocks"). His words: "That's actually a really good stocks is
    actually a really good suggestion, seeing as though it kind of let's not do trade. Let's
    do C, option C, stocks." What he was told with the options: "Stocks" is the direct match
    for the "Players" tab in ESPN, Yahoo and Sleeper; "Market" already means the stock
    market's hours elsewhere in the app ("Market closed"); "Trade" in fantasy football means
    swapping with another manager, which this app does not have. "Stocks" is approved copy
    for the tab's label. The icon is the Design Lead's to choose; the magnifying glass in
    the mockup was a stand-in.
  - **The Stocks tab is about buying and seeing what is available; selling is done from your
    roster, as in fantasy football** (2026-11-18, the same conversation, after being shown
    the tab opening on search alone or on search plus our categories). His words: "So
    thinking in terms of ESPN fantasy football, right? For me to drop a player, I do that
    from my own roster, which would be like the portfolio here. So the selling aspect isn't
    really going to be too heavily involved in this part. It's more going to be the buying
    and seeing what's available. So what I want you to do is research the players tab and
    the waiver wire of ESPN Fantasy Football, Yahoo, Sleeper... and kind of understand how
    that UI, UX looks like, those mechanisms, and then we can try to reflect that here."
    - This narrows his earlier "true home of the buy and sell" (above): the tab is the home
      of search and buying; selling lives on Portfolio, on a stock you own. A stock you hold
      can still be sold from its sheet wherever that opens.
    - He did not pick between those two mockups (search alone, or search plus categories);
      the research came first.
  - **The Stocks tab opens on a list of the stocks you can get** (2026-11-18, after the
    research in `docs/research/2026-11-18-players-tab-and-waiver-wire-ui.md`; A/B mockup in
    the Planner's chat). The research found that the three apps' Players screens are one
    list that search and filters narrow, never an empty search field (ESPN's site opens on
    "all available players"). Shown that layout with A (only stocks nobody in the league
    owns) beside B (every stock, with owned ones marked "You own this" or "Owned by {name}"),
    he picked **A**.
    - So, decided: the tab opens on a list, not an empty search; search narrows that same
      list; a stock owned by you or by another manager is not in the default list.
    - Told to him with the options and not objected to: an owned stock can still be found by
      searching for it; our categories stand in for positions as the filters.
    - The mockup was a first draft from descriptions, and he was told so. NOT decided, and
      not to be built from the mockup: the layout itself (rows, the filter presentation, the
      "All" chip and the plus button were placeholders), which waits for his screenshots of
      the real apps; the order of the list (the Planner's proposal, largest companies first,
      was mentioned and not asked); and any trending or "most added" list.
  - **Each row of that list shows the stock's price, under tight limits** (2026-11-18, A/B
    mockup in the Planner's chat). Put to him as a conflict with his own ruling ("I don't
    want people to be able to scrape anything", 2026-10-08, the reason the stock table was
    locked down on 2026-11-16): a list of every available stock is a way to walk the stock
    universe, and with prices on the rows it is a way to collect our stored price for each;
    limits make that slow, members-only and logged, not impossible. Shown A (the price on
    every row) beside B (name and category on the row, the price only when a stock is
    opened), he picked **A**.
    - What he was told A comes with, and so what the build owes: the list is for signed-in
      members of that league only, paced per person, capped per page, and logged; the prices
      are delayed ones; only stocks nobody in that league owns are listed.
    - This is a knowing exception to "nothing scrapable" for this one list, not a change to
      that rule. Nothing else about the stock table opens up.
  - **The list opens with the largest companies first** (2026-11-18, A/B mockup in the
    Planner's chat). Shown A (largest companies first) beside B (A to Z by ticker), he
    picked **A**. The reason given to him: ESPN opens its list on the most widely rostered
    players so the names you know come first; a stock has one owner per league here, so that
    measure does not exist, and company size is the nearest stand-in that needs no new data.
    - Told to him: the company-size figures come from the current data supplier and are
      refreshed in the background, so the order can lag the market a little; the figure is
      used only to order the list and is not shown.
    - This is the order the list OPENS in. Whether a manager can re-sort it (by price, for
      one) is part of the layout and is not decided.
  - **The list's layout, modelled on ESPN's Players tab: a plus on each row, and search as
    an icon** (2026-11-18, the Design Lead's board `design/stocks-list-1118`, PR #534, drawn
    from his own screen recording of ESPN's Players tab; shown to him in the Planner's chat).
    The board asked two things, "A or B, and C or D"; his answer: "A+C".
    - **A:** each row has a round plus at its left edge. It opens the review; it never
      trades in one tap. It is teal while the market is open (a buy) and brown after the
      close (a claim), as ESPN's is green for an add and orange for a waiver claim. B (no
      button; tap the row) was not picked.
    - **C:** search is the first icon in the row of category chips; tapping it swaps that
      row for a search field with Cancel and shows a plain list of results. D (a search
      field always visible above the chips) was not picked.
    - A row, as drawn: the stock's logo, ticker, "name · category", and its price. The chips
      are "All" then our categories, scrolling sideways; a chip filters the list.
    - Copy: **"All"** is new and was marked as the one new word on the board and in the
      question put to him ("is 'All' approved?"). His answer named only the letters; it is
      treated as approved with the pick, as board copy has been before, and goes in the next
      copy summary for him to strike if he disagrees.
    - Told to him with the board, and not objected to: the star (the watchlist) and the
      brown after-hours plus (a claim) belong to the October watchlist and claims plan and
      are not built; in the first version the plus after hours opens the stock's sheet, which
      already says when the market reopens, and the star arrives with the watchlist. ESPN's
      "Trending and recommended" section is left out until the app has the data for it.
  - **In a finished season the Stocks tab can be browsed but offers no way to buy (A)**
    (2026-11-18, the Design Lead's board `design/three-calls-1118`, PR #548, call 2; typed in
    the Planner's chat: "2 A"). The list stays; the rows have no plus; a stock's sheet has
    no Buy and no line about the season. B (the plus kept, and the sheet saying the existing
    "{league}'s season is over.") was not picked.
  - **The tab's icon is a storefront (B)** (same board, call 3; "3 B"). A, the magnifying
    glass, was his first idea for the tab (2026-11-16) and what the day's mockups showed; it
    was not picked. The reason given to him: the search button inside the tab is also a
    magnifying glass, so with A one icon would mean two things on one screen, and the
    storefront says where you get stocks.
  - **A long ticker shrinks to fit its round badge (A)** (2026-11-19, the Design Lead's board
    `design/ticker-disc-1118`, PR #565; typed in the Planner's chat: "A for ticker"). The
    round badge on a stock row (Holdings, the Stocks list, search) could not fit a
    five-letter ticker at the app's 11pt minimum, so GOOGL, BRK.B and AMGN showed as "GO…",
    "BR…" and "AM…". With A the badge stays round, the rows stay aligned, and the text in
    the badge shrinks to fit (about 9pt). That is the one exception to the 11pt rule, allowed
    because the full ticker is printed beside the badge. B (the badge widens into a pill on
    those rows) was not picked.
    - Trade history has its own copy of the same badge, with the same defect. It was not on
      the board he picked from. The Planner's reading, not his words: the pick is how that
      badge behaves, not a look for three screens, so it covers Trade history and any other
      copy of the badge at the same size (UX rule 5, the same thing looks the same
      everywhere). A copy of the badge at a different size, where the text would go well
      below 9pt, is not covered and goes to him first.
  - Not decided: whether a manager can re-sort the list, and what else
    browsing offers ("look around, see different markets"). Browsing by our own categories needs nothing new; lists
    that depend on live market data (movers, most active) wait on the price-supplier
    decision. These go to him as mockups in the plan's revision. The names in the mockup
    ("Stocks", "Watching") were placeholders.
  - **The Stocks tab goes into a build whole, not half done** (2026-11-22, typed in the
    Planner's chat). The tab as built (the list, chips, search, the plus) is merged and in
    no build. Asked whether build 18 should go out with it as it is and the rest follow
    after the Expo upgrade, he said no: "I don't want to just throw in a stocks tab that's
    like halfway done, that there's still major elements that are not done... if we have
    something kind of an idea floating around, I would rather work on getting that
    implemented into a build instead of doing a build and then having to go back and do
    more fixes. So if anything, I would actually want to get those four elements in the
    build. And then from there, we do the build and then we do the upgrade."
    - The four elements, as listed to him: the star and the watchlist; claims after the
      market closes (the waiver wire); trending and most-active lists; re-sorting the
      list. The first two are the approved October plan
      (`docs/plans/2026-10-08-trading-window-and-watchlist.md`), not built.
    - The order, his: these four, then build 18, then the upgrade.
    - A correction he made, kept here so it is not repeated: the Planner had presented
      "the rest after the upgrade" as following from his own reasoning. His words: "That's
      not my own reasoning."
  - **Trending on the Stocks tab is today's top movers (B)** (2026-11-22, A/B mockups in
    the Planner's chat; typed there: "B"). The list ranks stocks by today's price change
    across the whole market, each row with its price and "+11.2% today" in its sign
    colour. A (the stocks managers bought or claimed most in the past seven days, from our
    own data) was not picked, and neither was "A now and B later".
    - **It is built now, on the stocks where our data is good, with no supplier** (the
      same day). The Planner had told him B needed the price supplier and that build 18
      would wait on it. He questioned that: "can't we just look at, we calculate the
      percentage moves already... why can't we just have a cron job or something work and
      figure out what the top movers are? I don't see why that requires anything else than
      the information that we already have." He was right; the Planner had overstated it.
      The app already works out a stock's change today from the current source, and a
      scheduled job can rank a set of stocks. What needs a supplier is only the WHOLE
      market: the current source sees one small exchange, so a rarely traded stock's
      latest trade can be hours old, and those stocks are the ones that top a whole-market
      list. The version put to him, to which he answered "this works":
      - "Rank only a defined set, for example the 500 largest companies. We already hold
        company size; it's how the Stocks list is sorted."
      - "Skip any stock whose latest trade is too old, so a stale number can never rank."
      - "Refresh every few minutes while the market is open."
    - So trending does NOT put the price supplier on the path to build 18. His 2026-11-19
      words on the supplier are untouched ("we wont send out yet ill ask when ready"). With
      a supplier later, the same list widens to the whole market.
    - The Planner's choices inside that, to settle in the plan and not his words: the set
      is the 500 largest (his "this works" covered "for example"); how old is "too old";
      what the list shows when the market is closed.
    - Not decided: the chip's name and where it sits; how many rows; whether it lists only
      stocks available in this league.
  - **Watching and Claims sit behind a switch above the list (B)** (2026-11-22, A/B
    mockups in the Planner's chat; typed there: "B"). A three-way switch at the top of the
    tab: Available, Watching, Claims (with the number pending). It is the control Matchup
    uses for "My matchup | All matchups". Under Available, the row of chips stays for
    narrowing what you browse (All, Top movers, the categories). Every stock row carries a
    star at its right edge (tap to watch in this league; filled means watching); the plus
    stays at the left edge, so the two are never side by side. A (Watching, Claims and Top
    movers as more chips in the one row) was not picked.
    - This replaces decision 12 of the October plan (the watchlist inside "Buy a stock"
      and a "Watching" section on Portfolio). Whether Portfolio keeps a "Watching" section
      is not decided.
    - The names ("Available", "Watching", "Claims", "Top movers") and the star's look were
      the Planner's in the mockup. The October plan's approved words are Save / Saved for
      the star and Claim / Claims for the waiver wire; the Design Lead's board settles the
      rest at his text size, and new words go to him.
    - Recorded for the build: 4,400 of the 10,472 draftable stocks carry a company size
      (his read-only count, 2026-11-22). The other 6,072 cannot rank in Top movers and sort
      to the end of the list.
  - **The list is not re-sortable: largest companies first, only (B)** (2026-11-22, A/B
    mockups in the Planner's chat; typed there: "B"). A was a sort control under the chips
    (Largest first; Price, high to low; Price, low to high; A to Z), with the order taken
    from the price the server last saved for each stock (up to about two days old) while
    each row showed its current price. The Planner recommended A; he picked B. The chips
    narrow the list and search finds a stock. This settles the fourth of the four
    elements: there is nothing to build for it.
  - **The plan for the three that are built is approved** (2026-11-22): Part 3 of
    `docs/plans/2026-11-18-stocks-tab.md` (the watchlist, claims and top movers). His
    words: "Yeah, that plan looks good. Let's implement it."
  - **The words on the Stocks tab's lists are approved** (2026-11-22 Pacific, the Design
    Lead's board `#call-stocks-tab-lists`, branch `design/stocks-tab-lists-1122`; typed in
    the Design Lead's chat, read there by the Planner: "yes to all the words"). The board
    listed seven new words "for your yes (strike any you don't want)":
    - **"Available"**: the first view of the switch (the stocks nobody in the league owns).
    - **"Watching"**: the second view (your saved stocks in this league).
    - **"Top movers"**: the chip under Available.
    - **"Star a stock to watch it here."**: Watching, when nothing is saved.
    - **"No claims pending."**: Claims, when you have none.
    - **"+11.2% Fri"**: a mover's or a saved stock's change while the market is closed,
      the last session's change named by its day (the same "Fri" as "at Fri close").
    - **"MON 9:30 AM ET"**: the small label over the endings in Claims.
    - Reused, already approved: Claim, Claims, Save, Saved, Waiver order, Pending, Cancel,
      the status lines, the composer's words and the three endings (the October plan,
      2026-10-09), and "Stocks didn't load", "Check your connection, then try again.",
      "Try again", "Market's closed. Opens Mon 9:30 AM ET." (in the app today).
    - His yes was to the words. Two things the board drew and explained without asking,
      which are the Design Lead's rulings and not his picks:
      - A claim is the palette's rust brown (the Retail category's colour). His
        2026-11-18 pick was a plus that is "brown after the close (a claim)"; the brown
        drawn then was the warning colour, which became teal on 2026-11-19.
      - The league's waiver order is the first row of Claims ("You're 3rd of 6 in the
        waiver order"), and a tap shows the whole order. This settles the plan's open
        question 3.
    - Also settled by the board: Top movers while the market is closed takes no extra
      line; the day goes on the figure ("+11.2% Fri").
  - **A claim has a colour of its own, never the warning colour: the rust (A)** (2026-11-23,
    typed in the Planner's chat: "warning and claim should not have the same color. i lean
    A"). This makes the Design Lead's rust his pick, and adds a rule.
    - What he was shown, in two drawings: A, the plus after the close in the rust
      (`#A34C1B` Light, `#F9A781` Dark), as on the board; B, the brown drawn on 2026-11-18,
      which was the old warning colour (`#784900` Light, the yellow `#FAC547` Dark); and C,
      the plus staying teal after the close, with the word "Claim" on the next screen
      carrying the meaning. B and C were not picked.
    - He asked first "why are we deviating from our normal color scheme?". The answer given:
      the 2026-11-18 brown was the warning colour on loan; warnings became teal on
      2026-11-19, so a claim left alone would have turned the same teal as Buy.
    - Told to him, and A leaned to all the same: in Dark the rust's peach sits close to the
      pink of a down day. Not objected to; if it bothers him on a phone, a browner Dark
      shade is a new call for him, not a quiet change.
    - The Planner's recommendation was C, slightly. Recorded so the pick is not read as the
      Planner's.
    - For the build (the Planner's reading of his rule, not his words): a claim's colour is
      a named colour of its own in the theme, with the rust as its value. It does not point
      at the warning colour or at the Retail category's colour, so changing either of those
      later cannot change a claim without anyone deciding to.
- **The Expo upgrade is done now, not in January** (2026-11-22, typed in the Planner's
  chat). Apple's notice (ITMS-90725, on build 17) requires the iOS 27 SDK from April 2027,
  which for this app means moving from Expo SDK 54 to 58
  (`docs/research/2026-11-18-xcode-27-ios-27-sdk-requirement.md`). The research advised
  starting in early January. His words: "I don't really understand why we would wait. Like
  we're just prolonging the inevitable... if we need to do an update, let's just nip it in
  the bud, especially since this thing isn't live yet. There's no one else but me. So I
  think now is the time to do these kind of updates." Order, his pick "A": build 18 first
  ("Option A will do this build first"), then the upgrade, so the upgraded build can be
  compared against a known one. Told to him: feature work pauses while it runs, the phone
  pass is redone after it, and the minimum iOS version rises from 15.1 to 16.4 (the iPhone
  7 and the first iPhone SE drop off).
- **The watchlist is per league** (2026-10-08): "by league. if im in multiple fantasy football
  leagues, each one has its own waiver wire. if i want to buy apple in one league, i may not
  be able to in another if another player has it, i already have it, or it doesnt fit my
  team by one of the league rules." A per-player list "makes no sense".
- **The watchlist is not a queue** (2026-10-08): "multiple players can save the same stock,
  its like a player on the waiver wire. i can want to add them but so can someone else."
  Saving reserves nothing. Separately, "there should be a way to save stocks to keep an eye
  on them, and a way to queue them to add the next day that works like the waiver wire."
- **The waiver wire: daily claims** (2026-10-08). Giorgio chose daily moves over a weekly
  lineup lock: "a user should be able to trade daily. this is based on fantasy football,
  doesnt need every same rule. an investor should be able to make moves mid week. so our
  'waiver wire' will be a daily thing. you can claim stocks after the close of each day. if
  no one else claims that day, you get it. if two or more people claim, then we have the
  order decide. the order works like fantasy football, starts as reverse draft order. then
  shifts based on wins/loss and claims made."
  - A claim is placed only while the market is closed (Claim is Buy's closed-market twin;
    during market hours you just Buy). It is processed at the next market open, 9:30 ET, at
    the opening price, before live trading opens for that day.
  - A claim is "Buy X, funded by selling Y" (or by cash in a budget-cap league); if the claim
    loses, Y is not sold. Whole positions only, as always.
  - Claims are blind: you cannot see who else has claimed a stock or how many. Holdings stay
    visible ("Owned by …" as shipped); you only ever see leaguemates.
  - The order: starts as reverse draft order; ANY successful claim (contested or not) moves
    you to the back of the line; after each week is scored the order resets to reverse
    standings (last place first, standings tiebreaks apply).
  - After the run, the loser is told who won and why, in one short clause.
- **Where the watchlist lives** (2026-10-09, "C and approved", board `#call-watchlist`): a
  Watchlist tab inside "Buy a stock" (the player pool, as ESPN / Sleeper / Yahoo keep it) plus
  a "Watching" section on the Portfolio tab ("See all (N)" opens the tab); one list behind
  both. Rows: ticker + one status line (availability in this league, or "Claimed · fills Mon
  9:30 AM ET"); Buy only while the market is open; Claim only while closed, also on "No free
  … slot" rows since the claim names the sale that frees the slot. Names: Save/Saved (star)
  and Claim/Claims; never "Queue" (the draft's word) or "Order".
- **League features follow fantasy football, not a brokerage** (2026-10-08): anything that
  belongs to a league (watchlist, draft, waivers-like queues, standings, trades between
  managers) is modelled on how ESPN / Sleeper / Yahoo fantasy football do it; brokerage
  conventions (Robinhood) apply only to money surfaces (portfolio value, a stock's price and
  chart, buy/sell mechanics). Giorgio: "i need you to research fantasy football so that this
  doesnt come up." Reference: [`design/FANTASY_CONVENTIONS.md`](design/FANTASY_CONVENTIONS.md).
- **You can only sell what you own** (2026-10-09, on seeing 1.1.0's trade
  screen): "the sell option still has a search bar...thats not correct. i can only sell what
  i have so it should be a dropdown list or something. i shouldnt be able to search any
  stock, only see what i haave. cant sell what you dont own." So: you can only sell a stock
  you hold; the sheet of a stock you don't own does not offer Sell at all (enforced in 1.2.0
  by fix/sell-only-held); the 1.1.0 search-to-sell screen is retired with 1.2.0. A stock you
  DO hold can be sold from wherever its sheet opens, including from search (2026-10-10,
  option A, board #call-sell-from-search): the same stock's sheet looks the same from any
  entry point.

## League lifecycle

- **League size** (2026-10-06): a league needs at least 4 managers to draft, and every
  manager is a real person. Bots and the manual Start button are testing tools for the
  test account only; they are never a product feature, and no rule about players is ever
  written around them. (Code: `MIN_DRAFT_MEMBERS = 4` in
  `supabase/functions/draft-control/rules.ts`; the draft order also waits for 4.)
- **Account deletion** (2026-10-21; plan `docs/plans/2026-10-21-account-deletion.md`). Giorgio
  asked to "plan out the flow" after the Orchestrator flagged App Store guideline 5.1.1(v),
  and to "research how espn fantasy football, yahoo fantasy football, and sleeper handle if
  someone deletes their account mid season" (all three: the team outlives the account; the
  commissioner reassigns it). His rulings, verbatim:
  - The mid-season team: "A plus C in this plan but we delete the account asap, not the 30
    day window like sleeper". So: the seat stays in every league that has drafted this
    season and keeps playing on what it holds (A); the commissioner can hand it to a new
    manager (C); the account itself is gone when the request returns, with no grace period.
  - The leaver rule's "No 'Former manager' label": "we stick with the plan and change the
    product rules. we need to comply with the apple rules." A deleted manager's name and
    avatar are scrubbed; the seat shows a placeholder label (wording = board call).
  - A takeover: "keep the teams record just the owner is gone". The new manager inherits
    the seat whole: roster, cash, record, waiver position, past weeks under their name.
  - A commissioner who deletes: "lets just make the first person to join the league (besides
    the commissioner) to auto become the commissioner". No picker, no refusal, in any
    window; a league with nobody else in it is deleted with the account.
  - The flow: "we also need to decide where the account deletion button and process lives.
    and i want to add a 'are you sure, this cant be reversed' kinda thing to ensure the user
    isnt misclicking or is sure of their action". So: after the destructive button a final
    "Are you sure? This can't be undone." alert, safe default "Keep my account".
  - The location, from the A/B mockup: "last row in profile works but we shouldnt have it be
    highlighted, that draws attention to it. the flow is also good". So: the last Profile
    row, below Sign out, a plain row with danger text only, no tint or highlight.
  Planner rulings under standing rules (Giorgio may veto): confirming = re-authenticate
  (password / Apple / Google), the destructive button, then the are-you-sure alert; before the draft deletion acts like leaving; during a live draft the seat
  auto-picks (in an unclocked draft too, as soon as it is the seat's turn: "there can never
  be an instance where a player doesn't get a pick"; Orchestrator ruling 2026-10-21) and
  takeover opens once the draft is complete; after deletion the sign-in
  screen says once "Your account is deleted."; the same email may sign up again as a new
  account with no history.
  **Giorgio's board picks (2026-10-21, `#call-del-label`, `#call-del-screen`, `#call-del-find`):**
  - **The seat's label is "Open team"** (B; **changed 2026-11-06**, Giorgio: "B: Open Team". It
    was A, "Former manager", from 2026-10-21), everywhere a deleted manager's name would be
    (standings, matchups, history and past seasons, Members, Home), with the default avatar (a
    person glyph on a neutral disc, never initials of the label), in the secondary text colour.
    The two sentences that named the seat are reworded so they never read "Open team's team":
    the takeover question **"Take over the open team in {league}?"** and the commissioner's push
    **"{Name} took over the open team."** (both approved by Giorgio, 2026-11-06: "both sentences
    are fine").
  - **The delete screen explains each league on its own line** (B): "Delete your account?",
    then "This deletes your account right away.", then one line per league, verbatim:
    "Your team stays as “Open team”. {Earliest member} becomes the commissioner." (a
    league you run, with other managers) / "Your team stays as “Open team”. The
    commissioner can hand it to a new manager." (a league you play in) / "It hasn’t drafted
    yet, so you leave it." (before its draft) / "No other managers, so it’s deleted with your
    account." (a league you run alone); then "Past seasons keep your results under “Open
    team”." Then the proof and "Delete my account".
  - **"Find a new manager" is a pill on the seat's Members row** (B), for the commissioner
    only. The standings row looks like every other row and opens the seat's team view (as
    every row does), where "Find a new manager" is the commissioner's button.
  - **The new words, approved verbatim ("Use as written"):** "Confirm it's you to continue"
    (above the Apple / Google button; the password version keeps the plan's "Enter your
    password to continue"); "Confirmed with Apple" / "Confirmed with Google" (after the
    proof); the share text "Take over a team in {league}"; on a takeover link already used,
    "Someone already took this team." with "Go to Home" (no heading); "Not now" under "Take
    the team" (reused from the notifications ask); and the league lines above.
  - **The "already taken" screen is built like the takeover question** (2026-11-12, from the
    build 1.3.0 (14) phone pass, step 28c). Giorgio's words: "the already took this team
    message does not fit the format and theme of the app too". Shown the screen as shipped (a
    yellow warning panel and a text link, centred, no icon) beside two options, he picked
    **A**: the person icon, then "Someone already took this team." as the screen heading, and
    "Go to Home" as the docked primary button. The words do not change. This replaces "(no
    heading)" in the line above for this screen. The other dead takeover links, "already in
    this league" and the invite arrival's dead link use the same panel-and-link pattern; they
    are not ruled here and go to him on a board before they change.
  - **Every dead end on a takeover or invite link takes the same form** (2026-11-12, board
    `#call-refusal-family`, PR #444; Giorgio's words: "all screens look good"). Shown all seven
    in the "already taken" screen's form, Light and Dark, Large and his text size, with the
    small grey second lines pointed out to him against the no-subtext rule, he kept them. One
    layout: a picture in a grey disc, the sentence as the screen heading, at most one line
    under it, the way out as the docked primary button, and "Not now" in grey under it where
    the screen has one today. No yellow panel, no text link. The words do not change:
    - a dead takeover link: the broken-link picture, "This invite link doesn't work
      anymore." with "Ask for a new one." under it, and "Go to Home";
    - already in the league: the trophy, "You're already in {league}.", and "Open the league"
      (when the reply names no league, the app still just opens Home, as today);
    - too many tries, a short wait: the clock, "Too many tries." with "Wait a moment, then try
      again.", "Try again", and "Not now";
    - too many tries, an hour: the clock, "Too many tries." with "Try again later.", and "Not
      now" as the docked button (there is no Try again: it would fail);
    - no connection: the crossed-out signal, "Couldn't reach the league." with "Check your
      connection, then try again.", "Try again", and "Not now";
    - the invite arrival's dead link (signed out): the broken-link picture, the dead-link pair,
      and "Sign in".
    Two calls of the Design Lead's that he signed off with it: a refusal written as two
    sentences is split at the full stop, the first as the heading and the second (what to do)
    as the line under it, with no word changed; and that line stops growing at 2x its size,
    so at the largest text size it never outgrows the heading. Not covered: the invite's
    "full" and "not taking players" lines, which keep their place above Sign in, and Join's
    lines inside the Join sheet.
  - **Two more dead ends join that family: the dead reset link and "Nothing here"**
    (2026-11-16, board `#call-dead-links`, PR #478; typed in the Orchestrator's chat, 21:47Z:
    "B", in reply to "Last board: the two dead-end screens. A or B?"). Both take the family's
    form: a picture, the heading ending in a full stop, at most one line under it, and the way
    out docked at the bottom.
    - the dead password-reset link: "This link didn't work." with one line under it, **"It may
      have been opened on a different device."** That line is new copy, approved by this pick;
      it is cut down from the sentence the screen shows today.
    - the not-found page: "Nothing here." with one line under it, "This link is old or
      incomplete.", which is today's first sentence.
    A (the heading alone, no line) was not picked. He was reminded that on the board before
    it he went with no line. So his choices on one line under a heading are per screen: he
    kept one on these two dead ends and on the seven of 2026-11-12, and cut both on the
    commissioner's "The draft can't start yet" card the same day.
  - **A scheme takeover link still waits for a tap; the shared https link does not**
    (2026-11-12, same step). Giorgio's words: "dont love that i open the invite link and then
    it makes me "find the league" to be able to join. the invite link is for a specific
    league. that is an unnecessary step and needs to be cleaned up." What he opened was the
    `fantasystockapp://take/<code>` link, typed into Safari because the https share link
    cannot open the app yet (no association file is served; the web piece is open). The https
    link previews the team by itself, with no "Find league" tap, which is what he asked for.
    The scheme link keeps its tap because any page can fire one with a made-up code and each
    wrong code counts toward the lockout. No rule changed; the fix for what he felt is the
    https link opening the app. Not yet confirmed by him after hearing this.
- **When managers leave before the draft, below four** (2026-11-10, from the build 1.3.0 (12)
  phone pass, where "Move forward with 2" could only be refused):
  - Below four managers there is no "Move forward" and no "Invite someone new" button: one
    card says who left, "Fewer than 4 teams have joined.", the invite code and Share (board
    pick **B**, made in the Orchestrator's chat; copy approved there: "Invite someone to take
    their place"). A league needs four to draft, so inviting is the only path and is treated
    as already chosen.
  - Once four are back in: "A, four are in so it's ready". No extra tap; the question does not
    come back, and the draft time can be picked. Someone who comes back is never listed as
    having left.
  - With four or more still in after a leave (six down to five), nothing changes: the
    commissioner still chooses between moving forward and inviting someone new.
- **A deleted account that leaves before the draft is "A manager"** (2026-11-11, from the
  build 1.3.0 (14) phone pass, step 25; Giorgio picked **A** on board #call-deleted-leaver,
  PR #403, relayed by the Orchestrator; his words: "A, manager left the league"). Before the
  draft there are no teams, so the deleted seat's label ("Open team") never names a leaver,
  and the account's name stays hidden. The commissioner's card reads "A manager left the
  league", the same words as the push ("A manager left {league}. Confirm your roster before
  the draft."). Two or more leavers, any of them deleted, read "N managers left the league";
  once inviting, "Invite someone to take their place" (approved 2026-11-10).
- **The Leave sheet when your leave takes the league below four** (2026-11-12, from the build
  1.3.0 (14) phone pass, step 24d; Giorgio picked **B** on board `#call-leave-below-four`,
  relayed by the Orchestrator; his word: "B"; shown today, A and B side by side, with A as the
  Design Lead's recommendation). Before the draft, when leaving takes the league below four
  (four down to three, or fewer), the member's Leave sheet drops "{commissioner} chooses
  whether to go ahead with one fewer team or invite someone new." (false there: below four
  the commissioner gets no choice, see the rule above) and adds nothing in its place. It
  keeps only "You can rejoin with the invite code until {time}."; with no draft time yet that
  line is absent too, so the sheet is the title ("Leave {league}?") and its two buttons. With
  five or more before the leave, the sheet is unchanged. No new words (A's "The draft waits
  until 4 teams are in." was not taken).
- **Playoffs:** the commissioner sets any playoff team count P from 2 up to the number of
  managers (never more). The bracket is derived (weeks = ceil(log2 P); byes to the top
  seeds). Rounds are named by teams left: Final / Semifinals / Quarterfinals / Round of
  16; a first round with byes is "Wild card".
- **The slot availability check runs by itself; there is no "Check availability" button**
  (2026-11-17, build 1.3.0 (16), Create league › Stakes › Price tiers; typed in the
  Orchestrator's chat, 17:54–17:55Z). He asked "what is the purpose of check availability?"
  and, once told, said: "how will a user, especially a new user, understand or know what that
  means? that should be done by us automatically imo and then notify the user if something
  cannot work".
  - The app checks whether enough stocks fit each slot without being asked. The button goes.
  - The player is told only when something cannot work: the existing shortfall words for a
    slot that cannot be filled, or the existing "Couldn't check availability. Try again." if
    the lookup itself fails. When every slot works, nothing is shown.
  - **A slot that cannot be filled blocks creating the league** (board `#call-slot-check`, PR
    #499; typed in the Orchestrator's chat, 2026-11-17 18:10Z: "B, and merged 502"). When the
    automatic check finds a slot with too few matching stocks, that slot's line shows in red
    with the slot's other errors ("Only 9 draftable stocks match — the league needs at least
    16."; a cut of existing words, no new ones), and "Create league", and "Save" in League
    settings, grey out until the slot can be filled. A lookup that FAILS never blocks: it
    shows "Couldn't check availability." with a small "Try again". A (a yellow warning that
    still lets you create, with the draft postponed if the slot is still short at draft time)
    was not picked. The reason given to him: a slot that is short can never be drafted, and
    the fix is one field away. This changes today's behaviour, where a shortfall did not block
    creating the league and the draft's own start check was the only backstop; that check
    stays as the backstop.
  - Not decided, the Design Lead's to spec: when the check runs (after edits settle, on
    leaving the step, or both).
- **Create league needs an easier way out** (2026-11-17, same sitting, 17:47Z, the
  Orchestrator's chat). His words: "one thing when creating the league, i need to hit back a
  bunch before i can get back to the cancel button. should be a bit easier of a way to x
  out". Ruled the same day (below). Related, already ruled: a sheet's close never asks and drops edits at
  once (2026-11-12, "B and no"), and a tall sheet's close is a floating round button
  (2026-11-12, "b").
  - **Ruled: "A"** (board `#call-create-close`, PRs #497 and #499; typed in the Orchestrator's
    chat, 2026-11-17 18:08Z: "A, and merged 500 and 501"). Every step of Create league has a ×
    at the top right that closes the whole flow at once and drops the half-made league, with
    no prompt, as he ruled for sheets on 2026-11-12. "‹ Back" stays at the top left, and
    "Step N of 4" moves to the centre. Step 1's "Cancel" becomes the ×, read by VoiceOver as
    "Close". No new words. B (the × at the top left, Back as a button beside Next) was not
    picked.
- **The Season step in Create league** (2026-11-10, build 12; Giorgio picked B, board
  #call-season-step). His words: "B for the season step, the one with a strip". The note that
  started it: "I really don't like this style of mainline like managers and then this like
  smaller subtitle that explains it. I think one that is very just red flag of like AI built,
  vibe coded. Secondly, I think it makes it far too cluttered. ... Also, I want the regular
  season weeks button to be just as big as the managers and playoff teams. We can abbreviate
  weeks into just WKS to kind of fit this".
  - Managers, Regular season and Playoff teams are three identical steppers, with no line under
    any label. The weeks value reads "11 wks" (lowercase: a unit, like "30 seconds"); VoiceOver
    still says "11 weeks".
  - Under them, a season strip: one tile per regular-season week, then the playoff weeks, wider
    and named with the season chart's chips (WC / SF / F, QF / R16 for bigger brackets), "Wk 1"
    under the first tile and the season's last week ("Wk 14") under the last. Then one line, the
    bye clause from the playoff line ("The top 3 seeds get first-round byes."; "No byes." when
    there are none). Both update as you step.
  - The limits stay on the steppers: − and + grey out at the ends, and the reason shows under
    that stepper only while it is at the end ("2 to 6, up to your expected managers"; "At
    least 5 weeks, so every team plays every other team once."). Managers at 4 or 16 has no
    reason line yet: new words, for Giorgio, when it is built.
  - **Managers at 4 and 16: no line** (2026-11-11, both options on `#call-managers-limit`
    rejected): "I don't like this idea of adding in like this smaller subtext to explain things
    that don't need to be explained. Like, if there needs to be an extra explanation for
    something, I want it to be in like a little information thing or something that the user
    would have to click to then see, because adding in those right now, it just adds clutter.
    Like, no one wants to run something as a bunch of tiny little subheaders." So − greys out
    at 4 and + at 16, with nothing beside them.
  - **Steppers at their ends: no line** (2026-11-11, "option B" on `#call-limit-lines`, shown A
    keep the two limit lines and B drop them, at Playoff teams 6 of 6 and Regular season 5
    weeks): the two approved limit lines go too, "2 to 6, up to your expected managers" and
    "At least 5 weeks, so every team plays every other team once." A stepper at its end just
    greys out its − or +, with nothing beside it, and nothing is added to the Playoff teams
    "i". This overrides, for steppers at their ends, the "disabled with the reason beside it"
    clause of "Nothing tappable does nothing": the greyed button shows it can't go further, so
    it is still never a silent no-op. So the bullet above ("the reason shows under that stepper
    only while it is at the end") no longer holds.
  - Removed: "How many you expect, you included" and "We check this again when the draft
    starts." (the draft-time blockers card catches a league that came in smaller).
  - Not yet decided: sweeping the same pattern from the Draft step, the Duration lengths, League
    settings and the renewal review (the Design Lead recommended it with this call).
- **Leaving a league** (2026-10-06): "a player cannot leave a league after a draft, they
  are locked in for that season." The window: "you can only leave before a season starts
  (the hour before the draft) or after it is over."
  - So leaving is allowed until T−1h and after the season. After the season, "leave" hides
    the league for that player; history is kept.
  - When someone leaves before the draft, the commissioner must reconfirm: "move forward
    with 1 less" or "invite someone new to replace".
  - **Below 4, there is nothing to move forward with** (2026-11-10, phone pass step 23, build
    12; Giorgio picked B, board #call-below-four, relayed by the Orchestrator; his word: "B").
    A league needs 4 managers to draft, so below 4 the commissioner is not offered "Move
    forward with N" or "Move forward with N instead". The leaver card and "Fewer than 4 teams
    have joined" become ONE card: who left (the title), then "Fewer than 4 teams have joined.",
    the invite code and Share invite code. At 4 or more, nothing changes: "Move forward with N"
    and "Invite someone new", and the inviting state with "Move forward with N instead".
  - **"Invite someone to take their place"** (approved 2026-11-10, his words: "sentence is
    fine"): the inviting state's title when two or more left or the leaver isn't named; with
    one named leaver it is "Invite someone to take {name}'s place".
  - Open (Planner + Design Lead, 2026-11-10): what happens when joins bring a below-4 league
    back to 4. Today the row stays "pending" through the joins, so the choose card would come
    back at 4 naming the people who left (or who just rejoined).
- **Leave league is ON in 1.3** (2026-10-30, Giorgio, during the 1.3.0 (5) phone pass, relayed by the
  Orchestrator): build 5 shipped with the switch unset, so no one could leave and League settings was
  unreachable in season. Every member gets League settings (and Leave league inside it) in the real builds;
  the commissioner ALWAYS gets League settings, in season too (Members, Find a new manager, Transfer, the
  invite code), whatever the switch says.
- **The leave sheets keep "Stay" as a button** (2026-10-06, Giorgio overruled the Design
  Lead's G-3): "I want stay as a button." "Leave league" stays the red button.
- **Share hides while teams are locked** (2026-10-13; Giorgio picked B (board #call-share-locked),
  relayed by the Orchestrator during the W4 League gate): the invite row's Share is hidden from an
  hour before the draft until the season ends, for members and the commissioner alike; the invite
  code itself stays visible. Share is shown before the draft (a renewed season too), when a code
  can be used; hidden while locked and after the season, until a renewal (a completed season
  refuses a join: preview-league's 'season_completed'). No new copy.
  **No joins once the room opens** (2026-10-14, Giorgio, relayed by the Orchestrator): "once
  the draft room opens (an hour before) the league is considered started. no one can join and
  the share link cannot work". The server now enforces it (20261123000000): from T−1h a code is
  refused by join-league and by the preview, the same moment Share hides, with the
  started-draft refusal ('draft_started'), so no new copy. Run it back answers lock at the same
  moment (Giorgio, 2026-10-14; see Run it back). A league short of 4 managers when
  its room would open is postponed then, at the T−1h gate, never left for the start (the
  auto-start gate already did this; now pinned by test). A postponed draft has no time, so
  its code works again and Share comes back.
- **The commissioner** (2026-10-06): "A commissioner cannot leave, but a commissioner can
  transfer that title to someone else and then leave." "A commissioner can only hand over
  the title before or after a season." The season runs from when the draft room opens
  (T−1h) to the season's end. Transfer is a separate action from leaving.
- **Run it back** (2026-10-04): a finished league can be renewed with the same group, as a
  new season.
  - Only the commissioner starts it.
  - Every Season 1 player answers "I'm in" / "I'm out" and can flip until the draft is set.
    **Answers lock when the draft room opens** (2026-10-14, Giorgio, relayed by the
    Orchestrator): from T−1h an "I'm in" or "I'm out" is refused ("The draft has started, so
    answers are locked."), as joining is (see "Share hides while teams are locked"). This
    SUPERSEDES the design's rev 3.1 "free flips until the draft starts". A postponed draft
    takes answers again.
  - The commissioner sees each reply on "Who's running back". "Running back" is Giorgio's
    copy, with the name in bold.
  - The draft can't be set while replies are pending.
  - Newcomers can join by code and aren't blocked by Season 1's team count.
  - It's always a NEW draft (no keepers), and settings carry over.
  - Ships switched ON in 1.2.0 (Giorgio, 2026-10-11: "run it back on 1.2.0 ON").

## Onboarding

All 2026-10-14, in the Planner session. Plan: [`plans/2026-10-14-onboarding.md`](plans/2026-10-14-onboarding.md).
Research: [`design/reviews/onboarding-best-practices-2026-10-14.md`](design/reviews/onboarding-best-practices-2026-10-14.md).

- **Plan before build:** "that onboarding is going to be very important when a when a user
  first downloads the app. And I don't want it to be done without our clear plan implemented."
- **The first-time user is the invited friend:** "this app would mainly be shared through like
  invited friends. One person finds it, thinks of the idea, and they share it with their group
  of friends to join. I think that's going to be the main way in which users are like discover
  the app and join."
- **The invite is a link, not a code:** "just sending a text code isn't going to do anything if
  they don't have the app downloaded. So it should be a link that then would... do like one of
  two things. If they already have the app downloaded, it'll automatically like bring them to
  the app. And then from there, once they make their account and onboard, it'll automatically
  have them join that league. Or if they don't have the app, it'll redirect them to like the
  web page version just on a browser. And the same thing, if they make, once they make an
  account, they join the league. And then there's going to obviously be something on that web
  page that prompts them to download the app." The join from a link is automatic (no extra
  tap); the web page does one job (join) then "You're in {league}. Get the app to draft and
  play."
- **Three sign-in options:** "we should absolutely give the option. So there should be three
  options. One is just like email and password. Then we absolutely need to add sign in with
  Apple and Google. Because I feel like most users are going to just want to click that and
  then have their thing linked."
- **A pre-generated username:** "when they get to that, like creating their username screen, I
  feel like one good practice is to, when possible, give like a pre-generated thing so they
  don't have to type out something long… we're already going to have like a pre-set username
  that they can just go with and they can change later." One username screen after ANY sign-in,
  pre-filled, one tap to keep; the email form has no username field; changeable in Profile.
  **The suggestion is a gamertag, never a name** (2026-10-14, board `#call-ob-username`: none of
  the three drawn styles): "I want the username to be generated not by putting someone's first
  name and then two digits, but doing it in the style that kind of like Xbox does for their gamer
  tags. So when you first log in, make an account, it gives you like typically some sort of
  adjective or word and then like a animal. So it'll be like helpedhornet151 or something like
  that. Something kind of playful and also unique that way. I mean, if there's a bunch of signups
  and it's all like Bob 11, Bob 12, Bob 13, I feel like that's just kind of that. And also, we
  don't know if users want to keep their name visible. So let's not expose their first names if
  maybe that's something they don't want." So the generator is always {adjective or word}
  {animal}{digits} (e.g. "HelpfulHornet151"), and it never uses a first name or anything else
  from Apple, Google or the email address: a privacy rule as well as a style. The line under the
  field, "You can change it later in Profile.", is approved.
  **Clarified the same day (2026-10-14, W2 auth review) (A):** the rule is never SHOW or USE a name.
  His words: "I meant never show it. Like if someone joins the app, I would rather the username
  not automatically have their actual name in it just in case they don't want that shown. But
  obviously if we're taking in their, they're using Google or Apple or something like that that
  shares their name, then that's fine. It was mainly just changing how the username is
  automatically generated." The decision: the name from Apple / Google is stored (by Supabase, in
  `auth.users.raw_user_meta_data`, `auth.identities.identity_data` and each JWT's `user_metadata`)
  but never read or shown by the app, and the username generator never uses it. No scrub trigger.
  The app requests the email scope only (Apple asks for no name scope at all) and nothing in the
  app reads, copies or logs that metadata.
- **Email links use PKCE one-time codes (B)** (decision, 2026-10-14, W2 auth): the email-confirmation
  link and the password-reset link carry a one-time code (`flowType: 'pkce'`), not session tokens.
  Rationale: a link opened on another device, or intercepted by another app, can't be used, because
  the code only exchanges with the verifier held by the app that started the flow (so no stored
  nonce is needed any more). Opened on another device, the confirmation simply falls back to signing
  in with the password (accepted). "Didn't receive it? Send again" stays, on both Check-your-email
  variants (invite and no invite); it repeats `signUp` for the same address, because Supabase's
  `resend()` sends no code challenge.
- **Google uses native one-tap with the nonce check skipped; Apple keeps its nonce (C)** (decision,
  2026-10-14, W2 auth; "option 1"): Google's sign-in is `@react-native-google-signin`'s native
  one-tap, its ID token passed to `signInWithIdToken` with no nonce, and the Supabase Google
  provider has "Skip nonce checks" ON. Apple sends a SHA-256-hashed nonce and passes the raw value.
  Rationale: Google's sign-in itself stays verified (signature, and audience = our own client IDs);
  the nonce would only add replay protection, which the native Google library can't supply. The
  residual risk: a captured Google ID token could be replayed within its validity window. It is
  bounded to tokens issued to OUR iOS / web client IDs, because the Google provider's Client IDs
  list must hold exactly those two and nothing else.
- **The three cards show only on a cold install** (no invite): "B, cards only for cold
  installs." Skip is remembered forever; link arrivals never see them; "How it works" lives in
  Profile. The card titles stay as approved on 2026-09-29. **The scenes are B, the real
  screens** (2026-10-14, board `#call-ob-cards`): the draft squares with their category lines,
  the Matchup scoreboard with the lead changing, and FINAL with the real scoreboard; not the
  2026-09-29 "VS" and tug-bar scenes.
- **Email confirmation:** "Apple and Google sign-ins are already verified, but if you just do
  email and password, you have to confirm your email. I think that way we can block fake
  addresses. I think it's still good for security's sake." The confirmation link must bring an
  invited friend straight back into the join.
- **Push permission** is asked right after joining or creating a league, with one line of why,
  never during sign-up (recommendation taken).
- **The new onboarding strings** (2026-10-14, approved via the Planner, shown the board frames:
  "fine"), verbatim:
  - **"Not now"**, a text link under the notifications pre-prompt's "Continue". A user who taps it
    is never pre-prompted again; notifications stay reachable in Settings.
  - **Check your email** after an email sign-up: with an invite, "We sent a link to {email}. Tap
    it to finish joining {league}." with "Didn't receive it? Send again"; with no invite, "We sent
    a link to {email}. Tap it to finish creating your account."
  - **The "Email confirmed" chip** (✓, in the chip's capitals) above "Pick a username" when the
    confirmation link brings you back.
- **The inviter's name** shows on the invite page and the link-arrival preview ("{Roberto}
  invited you to {Stock Scudetto}"); the inviter only, nobody else (recommendation taken;
  amends the 2026-10-11 "no commissioner name" rule for link arrivals only).
- **A shared invite link never joins a signed-in person without a tap** (2026-11-13, from the
  brief security check, item A2). Shown the two side by side (A: tapping the link joins at
  once, the rule the Planner and the Orchestrator set on 2026-10-14 as decision 18 of the
  onboarding plan; B: the link opens straight on that league's preview with a Join button and
  "Not now", and nothing is joined until the tap), Giorgio picked **B**. Reason given to him:
  with A, any link, message or QR code carrying an invite puts a signed-in person in that
  league; B costs one tap and matches the takeover link, which always waits. The link still
  opens directly on the league: no code to type and no "Find league" step (his words,
  2026-11-12: "the invite link is for a specific league. that is an unnecessary step"). This
  covers a person who is already signed in when the link arrives, for the https link and
  the scheme link alike. A signed-out arrival is not changed by this ruling (the invite
  screen, then sign-in, then the join). The preview's words in the mockup were placeholders;
  the screen reuses the shipped Join preview unless he approves new words.
- **Before sign-in the invite shows the league's name and the inviter, nothing else**
  (2026-10-14, board `#call-ob-arrival`: **B**). The no-sign-in preview returns only the name,
  the inviter and why a link can't be used (the Planner's security ruling), so the arrival, in
  the app and on the web page, is "{inviter} invited you to {league}" (no inviter: "You're
  invited to {league}"; while the preview loads, or when it can't be reached: "You're invited to
  a league", the B call's own fallback), then Continue with Apple, Continue with Google, Use
  email. No Managers / Draft / Stakes / Season card before sign-in.
  - **The facts move to "You're in {league}"** (same call: **C1**): a card with Managers, Stakes
    and Season under the draft sentence in the app; the web page, which has no draft sentence,
    adds a Draft row. Not on the pre-draft Home.
  - **When the link can't be used**, the yellow warning panel replaces the buttons, with "Sign in"
    under it (approved via the Planner), verbatim: "{league} is full. Ask whoever invited you if
    they can make room." / "{league} isn't taking new players right now." / "This invite link
    doesn't work anymore. Ask for a new one."
  - **A dead link has no heading** (the Planner, 2026-10-14): that screen is only "This invite
    link doesn't work anymore. Ask for a new one." and "Sign in".
  - **"Ask whoever invited you" belongs to the invite-link flow only** (the Planner, 2026-10-14):
    a "full" refusal after the join, when the friend arrived by link, also reads "{league} is
    full. Ask whoever invited you if they can make room." Everywhere else (a typed code, and so
    on) the shipped "Ask your commissioner if they can make room." stays.
- **No theme choice in onboarding** (System by default, Profile › Appearance), and the game's
  unfamiliar ideas (the week window, dollars decide) are taught in place, one line, once, on
  the first pre-draft Home and in the first draft room, never on a launch card.
  - **The pre-draft Home line:** "Your week runs Monday's open to Friday's close. Best
    performance wins." (the plan's line, with its ending set by "Generic scoring copy" above:
    onboarding says "best performance wins", never "best dollar gain").
  - **The draft-room line** (the Planner, 2026-10-14), verbatim: "Out of time? We pick for you:
    your queue first, then the best stock that fits your league's rules." Shown the first time
    someone enters any draft room, in the same first-time tip above the board; it goes away on
    a tap of its × or on that person's first pick, and never shows again. "First pick" means
    the first pick recorded for them, an auto-pick included (the line explains auto-picks); a
    refused pick does not count (Design Lead, onboarding W4 gate, 2026-10-15).
- **One no-league empty state on every tab** (Home, Matchup, League, Portfolio): Create a
  league / Join with a code (recommendation taken).

- **Sign-in and sign-up screens behave like a short native form** (2026-11-09, from Giorgio's
  build 1.3.0 (12) recordings; spec `docs/plans/2026-11-09-auth-screen-layout.md`):
  - No scrolling when everything fits: "There really should not be a reason why it should be
    able to scroll." The screen returns to rest when the keyboard closes.
  - A focused field moves the screen only as far as it must: "When I click on the password
    field, it like shoots the like screen up super high. So the password thing is at the very
    top, and there's a huge gap". Never pinned to the top; this replaces the build-12 rule.
  - **When the field, its rules and an error can't all fit above the keyboard** (largest text
    sizes): the box being typed in stays in view; the error and the rules give way first, then
    the label (2026-11-10, Giorgio: "A, box wins").
  - The wordmark is never cut: "the stockpile at the top is cut off."
  - An error sits where its cause is; a message that is not about a field never marks a field.
  - **Show / hide password** (2026-11-06): "we should add a hide/view eye icon for the
    password so you can see what you are typing". Every password field has the eye; a visible
    password still gets no keyboard suggestions.
  - **Copy, approved 2026-11-09** ("A, try again later"), for the email send limit:
    "We can't send another email right now. Try again later." The request limit keeps
    "Too many attempts — please wait a minute and try again."
  - The confirmation email's look is out of date ("has like an old stockpile logo that needs
    to be updated"); it is redrawn in the current look as part of launch prep.

## How decisions get made

- Every product/design choice goes to Giorgio as side-by-side mockups ("Your call" on the
  board), with a recommendation, never as prose only.
- **The board shows only open calls** (2026-10-12): "the app screens like page that it shows
  me when it wants me to pick between different mockups needs to be cleaned up. There are so
  many sections up top for me to choose from. It is kind of difficult to find what I need
  to. It there should be like an archive of picks that have been decided, and that should
  only show me like the ones that are in progress. Because it's turning into it's because
  it's getting too messy." So: the top navigation and the opening of the board list ONLY the
  "Your call" sections still awaiting Giorgio, newest first; every decided call moves to a
  collapsed **Archive** at the end, stamped with the decision and date (and the PR that
  recorded it). A section is archived the moment its decision is recorded here. Approved
  key screens stay on the board as the reference, under their own heading, not mixed with
  the calls.
- A rule is recorded here the moment it's decided. If a rule here and the code disagree,
  the code is wrong until Giorgio says otherwise.
- **UX standard** (2026-10-06): every screen and flow is designed, built and reviewed against
  the eleven rules in [`design/UX_RULES.md`](design/UX_RULES.md). Audit findings graded P0/P1
  block the 1.2.0 cut; P2/P3 go to a 1.3 backlog. A product rule beats a UX rule; a UX rule
  that seems to contradict one is a question for Giorgio, not a finding. Plan:
  [`plans/2026-10-06-ux-rulebook.md`](plans/2026-10-06-ux-rulebook.md).
