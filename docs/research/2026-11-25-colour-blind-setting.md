# Colour blindness: what Apple requires, what iOS offers, how apps do a setting (2026-11-25)

Requested by the Planner after Giorgio ruled that the app should have a colour-blind accessibility setting whether or not Apple requires it. Researcher; read 2026-11-25. Public pages only; no sign-ups, no contact, nothing about the project in any request. The Orchestrator approved doing this on Sonnet and asked that the key claims be easy to check.

**How the sources were read.**
- **Apple, Question 1:** I downloaded the pages and read the text myself (the HIG pages through the data file each page loads).
- **Questions 2 and 3:** two reader subagents used a fetch tool that returns a model-made extract, so wording there is not checked. "Snippet" means only a search summary was seen.
- **Quoting:** the Orchestrator asked for an exact quote on each "required / voluntary" claim. My quoting limit allows one, used for the most important sentence. Every other claim is a paraphrase with the page and section, so it can be checked against the source.

Marks: **Fact** = the source says it. **Inference** = my reading. **Not found** = I looked and did not find it (not proof it does not exist).

## Short answer

**No: I found nothing from Apple that requires an iOS app to support colour blindness today.** Three separate things:

| Layer | What it can do | What it says about colour |
|---|---|---|
| **App Review Guidelines** (can block a release) | Binding | **Nothing found.** No accessibility requirement and no colour line |
| **Human Interface Guidelines** (guidance) | Advice | Do not rely on colour alone; add shapes, icons or labels |
| **Accessibility Nutrition Labels** (what an app *declares* on its product page) | Voluntary today. Apple says declaring will become required, **no date found** | One label is "Differentiate Without Color Alone". Claiming it has conditions |

The one sentence about the future, on Apple's labels overview page: **"over time, you'll be required to share accessibility support details"** ([overview](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels), read 2026-11-25). The same sentence goes on to tie this to submitting new apps and updates. It is worded as **sharing details (declaring)**. I found nothing saying an app must **support** any feature.

## Q1. What Apple requires

### a. App Review Guidelines

| Finding | Mark |
|---|---|
| The [Guidelines](https://developer.apple.com/app-store/review/guidelines/) (page footer: last updated 2026-10-16) contain **no accessibility requirement and no rule about colour, contrast, VoiceOver or disability**. I searched the full text for accessib, colo(u)r, VoiceOver, disabilit and contrast. The only related use is a passing mention of "accessibility" as an example category of third-party app collections; the other hits are "accessible"/"accessibility" in unrelated senses (backend reachable, easy-to-find links) | **Fact** (as to this text) |
| Guideline 2.3 (accurate metadata) matters indirectly: the labels overview says labels should follow it, and that App Review can contact a developer to change labels that may be intentionally misleading or harmful | **Fact** ([overview](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels), section on evaluation criteria) |

### b. Human Interface Guidelines (guidance)

| Finding | Source | Mark |
|---|---|---|
| The Accessibility page has a section titled *Convey information with more than color alone*. It advises shapes or icons in addition to colour, and suggests letting people customise colour schemes such as chart colours. **It names red-green and also blue-orange as pairings that can be difficult**, so swapping to blue/orange is not automatically safe | [HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) | Fact |
| The Color page's *Inclusive color* section advises not relying only on colour to tell things apart, show what can be tapped, or carry essential information; text labels or glyph shapes are its examples | [HIG Color](https://developer.apple.com/design/human-interface-guidelines/color) | Fact |
| On contrast: it gives WCAG AA values (4.5:1 for text up to 17 pt; 3:1 at 18 pt, or bold), and says that if an app does not meet the minimum by default it should at least offer a higher-contrast scheme when Increase Contrast is on | HIG Accessibility | Fact |
| These are design guidance. I found no statement that App Review enforces them as such | | Inference |

### c. Accessibility Nutrition Labels

**What they are:** per-device statements on the App Store product page of which accessibility features an app supports, shown on devices running iOS 26 or later. The list: VoiceOver, Voice Control, Larger Text, Dark Interface, **Differentiate Without Color Alone**, **Sufficient Contrast**, Reduced Motion, Captions, Audio Descriptions. **Both names the Planner expected are right.** (Fact, [overview](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels).)

**Voluntary or required today**

| Claim | Mark |
|---|---|
| Today it is voluntary: the overview says providing the labels is voluntary to start, to give developers time to prepare | Fact |
| Apple says it will become mandatory, with ample time and evaluation resources first, and that over time sharing support details will be needed to submit apps and updates (quote above) | Fact |
| **No date found.** Apple's [Upcoming Requirements](https://developer.apple.com/news/upcoming-requirements/) page, read today, has no mention of accessibility or these labels. A web search found no Apple announcement with a date | Not found |
| The overview says a device with no information still shows a section saying support has not been indicated, and the section can also show that the app supports none of the features | Fact |
| Whether "none" would satisfy the future requirement is not stated | **Not found; do not assume** |

**What claiming either label commits an app to (all Fact, same overview unless noted)**
- People must be able to complete **all the app's common tasks** with the feature: the app's main functions **plus** first launch, login, purchase and settings.
- Judged per device; kept accurate and updated; if bugs break the criteria, the label should not be claimed.
- Follow Guideline 2.3. Apps may use a custom implementation (anything except VoiceOver and Voice Control). The overview advises considering the matching system setting even then, and says an in-app setting, if offered, should be **more granular** than the system one.

**Differentiate Without Color Alone** ([criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/differentiate-without-color-alone-evaluation-criteria))
- May be claimed if common tasks do not rely on colour as the only way to convey information. Apple's examples of failure: red-versus-green icons for positive/negative or online/offline. Remedies: position, order, shape, icons, text; for charts, legend order or in-chart labels.
- Apple says colour need not be removed, only not be the sole signal.
- It suggests testing with the **Grayscale** colour filter: if the app cannot be used in grayscale, rethink the design (while noting grayscale is not what colour-blind users see).
- It says an app should ideally do this **by default**, and treats a setting as a last resort or stop-gap.
- **But** it also says that if the app does use colour as the only differentiator (its example: colour-coded charts), it should let users adjust it with a setting or a choice of colour schemes.

**Sufficient Contrast** ([criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/sufficient-contrast-evaluation-criteria))
- May be claimed if common-task text, buttons and controls meet general contrast guidelines **by default**, usually 4.5:1 for most text. 3:1 is described as commonly recommended for non-text states.
- If not by default: with Apple's UI frameworks, check that Increase Contrast gives enough; with custom frameworks, offer colour schemes that meet the minimums.
- Check light and dark; test with Increase Contrast, Bold Text and Reduce Transparency.

### Ambiguities I am flagging, not resolving
1. **Can a setting earn "Differentiate Without Color Alone"?** One part of the criteria page ties the claim to common tasks not relying on colour alone; another allows colour-only elements if users can change them with a setting or colour schemes; and the page calls a setting a last resort. It does not say whether the setting may be **off by default**, or whether it must follow the iPhone switch. This is the sentence group to check before any claim.
2. **"Must" or "should":** the overview states the all-common-tasks condition with "must" in one place and "should" in another.
3. **Which contrast route applies to React Native** ("Apple-provided UI frameworks" versus "custom frameworks") is not stated.
4. **What the future requirement will accept** (see above).

### d. Anything else that makes it mandatory for a consumer game-like app
**Not found.** Nothing in the Guidelines or Upcoming Requirements. I did **not** read the Developer Program License Agreement. **I did not research law** (for example the European Accessibility Act or US disability law). "Apple does not require it" says nothing about legal duties.

## Q2. What the iPhone offers, and what an app can read

Apple describes these under Settings > Accessibility > Display & Text Size ([Apple Support](https://support.apple.com/en-us/111773); the iOS 26/27 layout was not verified).

| Setting | What it does | Can an app detect it? (UIKit) | React Native 0.81 |
|---|---|---|---|
| **Differentiate Without Color** | Asks apps to replace colour-only cues | Yes: `UIAccessibility.shouldDifferentiateWithoutColor` + change notification (iOS 13); SwiftUI `accessibilityDifferentiateWithoutColor` | **Not exposed** |
| **Increase Contrast** | Raises foreground/background contrast | Yes: `isDarkerSystemColorsEnabled` (iOS 8); `traitCollection.accessibilityContrast` (13) | `isDarkerSystemColorsEnabled`, `darkerSystemColorsChanged` (iOS). `DynamicColorIOS` takes optional `highContrastLight` / `highContrastDark` |
| **Color Filters** | Filters the whole screen to help tell colours apart | Only partly: `isGrayscaleEnabled` is documented as covering "Color Filters and Grayscale"; I found no API for **which** filter. Whether tint filters report true needs a device test | `isGrayscaleEnabled`, `grayscaleChanged` |
| **Classic Invert / Smart Invert** | Reverses colours (Smart spares images and media) | `isInvertColorsEnabled` (documented for Classic); no separate Smart Invert detector found | `isInvertColorsEnabled`, `invertColorsChanged` |

Sources: Apple API reference (for example [shouldDifferentiateWithoutColor](https://developer.apple.com/documentation/uikit/uiaccessibility/shoulddifferentiatewithoutcolor), [isGrayscaleEnabled](https://developer.apple.com/documentation/uikit/uiaccessibility/isgrayscaleenabled), [isDarkerSystemColorsEnabled](https://developer.apple.com/documentation/uikit/uiaccessibility/isdarkersystemcolorsenabled)); [React Native 0.81 AccessibilityInfo](https://reactnative.dev/docs/0.81/accessibilityinfo); [DynamicColorIOS](https://reactnative.dev/docs/dynamiccolorios).

- **Differentiate Without Color needs native code in React Native 0.81. (Fact.)** I also searched the installed React Native **0.81.5** `Libraries/` and `React/` folders: no mention of it. The 0.85.0 and 0.88.0 sources do not add it either (0.82–0.84 and 0.86–0.87 not checked). An open React Native pull request ([#59318](https://github.com/react/react-native/pull/59318)) proposes it; it is not released.
- **Expo SDK 54:** no module exposing it found (search not exhaustive). A small local Expo module (value plus change event) looks like the route (inference). Two community packages mention it ([accessibility-settings](https://registry.npmjs.org/react-native-accessibility-settings), 0.1.2, 2023; [nitro-stylesheet](https://registry.npmjs.org/react-native-nitro-stylesheet), 0.0.4, 2024); their native code and RN 0.81 support are **not verified**, and both look little maintained (inference).
- Method note: a reader fetched those two public package-registry records. The npm website refused one page (403); it was not retried, though the registry record for it had been requested at the same time.

## Q3. How apps do a colour-blind setting

| App | What changes | Where | Follows the iPhone setting? | Gain/loss without colour by default? |
|---|---|---|---|---|
| **Robinhood** (finance) | An "Accessible colors" switch for red-green deficiency; the resulting colours and any added shapes are not stated ([help](https://robinhood.com/us/en/support/articles/accessibility-options/)). Its [App Store page](https://apps.apple.com/us/app/robinhood-trading-investing/id938003185) declares Differentiate Without Color Alone | Settings, under app appearance / theme | Not stated | Not verified |
| **Binance** (finance) | A colour-vision palette with blue for up and orange for down, beside other palettes ([blog](https://www.binance.com/en/blog/ecosystem/color-your-trading-binance-adds-support-for-color-vision-deficiencies-421499824684903930), an older post; may be out of date) | Trading-screen style settings | Not stated | Not stated |
| **TradingView** (finance, heatmaps only) | A heatmap choice of Classic, Color-blind or Monochrome ([help](https://www.tradingview.com/support/solutions/43000707158-how-to-change-the-color-of-heatmaps/)). No app-wide mode found. Its App Store page declares no accessibility features | The heatmap's own settings | Not stated | Not stated |
| **Wordle** (game) | Green/yellow become orange/blue ([Wikipedia](https://en.wikipedia.org/wiki/Wordle), unofficial) | In-game settings | Not stated | n/a |
| **Trello** (reference) | Keeps label colours and **adds patterns** to them ([help](https://support.atlassian.com/trello/docs/adding-labels-to-cards/), [blog](https://www.atlassian.com/blog/trello/taco-tuesdays-learning-to-love-labels)) | From the labels menu (an older post also lists account settings) | Not stated | n/a |

- **Two patterns:** swap the palette (Binance, Wordle, TradingView heatmaps), or add a second signal and keep the colours (Trello). Robinhood's mechanism is not stated.
- None of these pages says the mode switches on from an iPhone setting. That does not prove they ignore it.
- Webull lets users pick up/down colours for non-crypto charts ([lesson](https://www.webull.com/learn/courseware/7NQx7u/Basic-Chart-Types-in-Technical-Analysis)), not described as a colour-blind feature.
- **Not found:** a documented colour-blind setting in any sports or fantasy phone app, or in Yahoo Finance or Coinbase. A search summary says Rocket League has one (team colours forced to orange and blue); its help page refused automated reading and was not bypassed.

## What this means for Stockpile

Inferences for the Planner, not product decisions.
- Giorgio's ruling is **more** than Apple requires today. Say it that way: not required, nothing found to enforce it, and a label that will probably have to be *answered* at some unstated future date.
- Apple's own advice puts the **default** first: gain and loss should read without colour (a sign, an arrow or words) for everyone, with a setting for what is left. A setting alone leans on the part of the criteria that is ambiguous (flag 1). The grayscale filter is a cheap test of the default.
- **Blue/orange is a common alternative, but the HIG names it too** as a pairing that can be hard, so a palette swap should not be the only signal.
- To follow the iPhone's **Differentiate Without Color** switch, a small native module is needed; that means a new build (inference). Increase Contrast can be read today.
- Declaring either label later is a separate step with its own bar (all common tasks, including onboarding, sign-in, purchase and settings; every device claimed; kept true on each update).

## Not found / not sure

- Any date for mandatory labels; whether declaring "none" will count.
- The Developer Program License Agreement (not read); law outside Apple (not researched).
- Whether a Color Filters tint is reported by any API; a Smart Invert detector.
- Default non-colour gain/loss cues in the finance apps listed; how Robinhood's switch looks.
- Nothing here was tested on a device.

## Recommendation

1. Tell Giorgio: **not required.** Nothing in the App Review Guidelines; HIG advice only; labels voluntary today, with Apple saying they will become required and giving no date, and worded as declaring.
2. In the plan, make colour never the only signal by default, then add the setting (signal shapes or labels and, if wanted, an alternate palette), and consider defaulting it on when the iPhone's Differentiate Without Color switch is on. Inference.
3. Do not declare the label until a screen-by-screen grayscale pass of the common tasks is done and flag 1 is settled.

## Open questions for Giorgio

- Should the setting only change colours and add marks, or should the marks be there for everyone with the setting changing the palette?
- Does he want to declare the App Store label once the work is done? Declaring is his call, and it carries the upkeep above.
