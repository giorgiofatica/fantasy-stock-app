# What does building with Xcode 27 / the iOS 27 SDK take for this app (Apple notice ITMS-90725)?

Asked by: the Orchestrator on 2026-11-18 (not urgent; Apple's deadline is April 2027) · Researcher
session · Model: Sonnet 5.5 (technical, no licence text) · Read 2026-11-18. Read-only: no files in
the app were changed.

## Short answer

**It is not only a build-image setting, and it needs an Expo SDK upgrade.** Expo's own docs say an
app built with the iOS 27 SDK launches correctly on iOS 27 only if it uses the UIKit **scene
life cycle**. Expo SDK 58 (released 2026-10-15, React Native 0.88) does that by default; SDK 57
supports it as an opt-in; the SDK 54, 55 and 56 guides don't mention it. Our app is on SDK 54,
and Expo's guidance for older SDKs is to stay on the Xcode 26 image. **Recommendation:** plan the
move to SDK 58 and start it in early January 2027, after 1.3.0 reaches the App Store. Until
Apple's deadline, builds on the current setup keep uploading.

## Our setup (read from `main` @ `3e099474`)

- `apps/mobile/eas.json`: no `image` set on any profile, so EAS uses its `auto` alias.
- `apps/mobile/package.json`: Expo `~54.0.30`, React Native `0.81.5`, React `19.1.0`, expo-router
  `~6.0.21`, react-native-reanimated `~4.1.1`, react-native-worklets `0.5.1`, expo-notifications
  `~0.32.16`, expo-updates `~29.0.16`, `@react-native-google-signin/google-signin ^16.1.5`,
  `@react-navigation/native ^7.1.8`, TypeScript `~5.9.2`.
- `apps/mobile/app.json` has `newArchEnabled: true`; there is no `ios/` directory (managed, with
  Continuous Native Generation); `app.config.js` adds the Google sign-in plugin when a client ID is
  set.

## Findings

| # | Finding | Source (link) | Read on | Fact or inference |
|---|---|---|---|---|
| 1 | **EAS images:** with no `image` in `eas.json`, "your build by default will use the `auto` alias", chosen from the project's Expo SDK and React Native versions. `sdk-54` points at the Xcode **26.0** image; Xcode 27 images exist (27.0, 27.1 RC, 27.2) and the `latest` alias is on 27.1. | docs.expo.dev/build-reference/infrastructure (modified 2026-11-09) | 2026-11-18 | Fact |
| 2 | **The Xcode 27 caveat, in Expo's own words:** "Apps built on Xcode 27 images, including `latest`, launch on iOS 27 only if they use the UIKit scene life cycle." On older SDKs, "use `auto` or your `sdk-` alias". | Same page | 2026-11-18 | Fact |
| 3 | **Expo's scene guide:** "apps built with Xcode 27 that still use the application-based life cycle do not launch correctly on iOS 27". **SDK 58 and newer** use scenes by default. **SDK 57** keeps the old life cycle unless you set `ios.enableSceneSupport` in `expo-build-properties` (needs `expo@57.0.23` or newer). **SDK 54, 55 and 56 are not mentioned**, so I can't say they can opt in. Managed (CNG) projects just re-run `prebuild --clean`. | expo.fyi/ios-scene-lifecycle (the GitHub `expo/fyi` page) | 2026-11-18 | Fact |
| 4 | **SDK 58** (2026-10-15): React Native 0.86 → 0.88, "SDK 58 is built for iOS 27". Prebuild now generates a `SceneDelegate` and the scene manifest. React 19.3.0 per the docs. Node 22.13 or newer. | expo.dev/changelog/sdk-58; docs.expo.dev/versions/latest | 2026-11-18 | Fact |
| 5 | **Apple:** the Apple Upcoming Requirements page I read lists only the current rule (Xcode 26 / iOS 26 SDK, since 2026-04-28). **The April 2027 entry wasn't on it**; the ITMS-90725 wording comes from the Orchestrator's message. | developer.apple.com/news/upcoming-requirements | 2026-11-18 | Fact (what the page shows); the notice text is unverified here |
| 6 | **SDK 55** (2026-02-25): React Native 0.83, React 19.2. The Legacy Architecture was removed ("you will not be able to use the Legacy Architecture in SDK 55 projects and later") and `newArchEnabled` was removed from `app.json`. Minimum Xcode 26. `edgeToEdgeEnabled` removed from `app.json`. The `notification` field removed from the `app.json` schema. `eas update` now requires `--environment`. | expo.dev/changelog/sdk-55 | 2026-11-18 | Fact |
| 7 | **SDK 56** (2026-05-21): React Native 0.85; **Hermes v1 is the default engine**; minimum iOS **16.4** (up from 15.1); minimum Xcode 26.4; `expo/fetch` becomes the global `fetch` (opt out with `EXPO_PUBLIC_USE_RN_FETCH=1`); **expo-router no longer depends on React Navigation** (a codemod and migration guide are provided); `expo` no longer depends on `@expo/vector-icons`; TypeScript 6.0.3. Known issue: importing `react-native-worklets` or `react-native-reanimated` "can increase your app's memory usage drastically", fixed in SDK 57. | expo.dev/changelog/sdk-56 | 2026-11-18 | Fact |
| 8 | **SDK 57** (2026-06-30): React Native 0.86; Reanimated 4.3–4.5, Worklets 0.8–0.10, Gesture Handler 2.31–2.32; "no breaking changes" from RN 0.85. | expo.dev/changelog/sdk-57 | 2026-11-18 | Fact |
| 9 | **SDK 58 breaking changes:** React Native 0.87's Strict TypeScript API is the default (deep imports from `react-native/Libraries/*` become type errors); removed `InteractionManager`, the `Touchable` root export, the `Modal` `animated` prop, and the `StatusBar` props `backgroundColor`, `translucent`, `networkActivityIndicatorVisible`; `ImageBackground` deprecated; expo-router's navigation core "reworked" and projects default to `web.output: "server"` **when `web.output` is not set**; `NODE_ENV` is now set by the command, changing which `.env` files load; **foreground notifications are shown by default unless `setNotificationHandler` says otherwise**; macOS unsupported. | expo.dev/changelog/sdk-58 | 2026-11-18 | Fact |
| 10 | **iOS 27 behaviour changes Expo lists:** "Xcode 27 replaces Simulator.app with Device Hub"; "`requireFullScreen` no longer opts your app out of resizing"; `ScreenOrientation.lockAsync` may have no effect while the app is resizable. | expo.dev/changelog/sdk-58 | 2026-11-18 | Fact |
| 11 | **Expo's upgrade advice** (an older post, 2025-09-10): read the changelog first, use development builds, upgrade the SDK separately from other big changes, and upgrade in stages. It doesn't say whether to upgrade one SDK at a time or jump. | expo.dev/blog/expo-sdk-upgrade-guide | 2026-11-18 | Fact |
| 12 | **Expo's support window for old SDKs:** not found. The docs' release-statuses page doesn't contain a table of supported SDKs. | docs.expo.dev/more/release-statuses | 2026-11-18 | Not found |

## What this means for Stockpile

**(a) Is it only the EAS image?** No. Pointing `eas.json` at an Xcode 27 image would produce an
iOS 27 SDK build, but Expo says an SDK 54 app (old life cycle) built that way "does not launch
correctly on iOS 27" (findings 2–3). Whether SDK 54 and React Native 0.81 even compile on Xcode 27
isn't documented; Expo's default for SDK 54 stays Xcode 26 (finding 1). The apps already on the
store keep working; the requirement bites at **upload** time after April 2027 (inference from the
notice text).

**(b) Which SDK, and what it breaks for us.** SDK 58 (RN 0.88) is the one Expo built for iOS 27.
SDK 57 (RN 0.86) is a possible stop, with scenes by opt-in, but the SDK 57 guide doesn't say how
long it is patched (finding 12), so I'd not plan around it. Going 54 → 58 crosses four SDKs. What I
checked against our code (`apps/mobile`, grep read on `main`):

| Area | Effect on us |
|---|---|
| **New Architecture** | Already on (`newArchEnabled: true`). SDK 55 removes the flag from `app.json`, so delete it then. No migration work |
| **Reanimated 4.1 / Worklets 0.5** | Bumped by `expo install --fix` to 4.3–4.5 / 0.8–0.10. Avoid stopping on SDK 56 (the memory regression, finding 7) |
| **expo-router 6** | SDK 56 removes its React Navigation dependency, with a codemod. We import `@react-navigation/native` directly (`app/_layout.tsx` theme provider; `useIsFocused` in `components/game/DraftRoom.tsx` and `components/sp/game/LiveDot.tsx`). Those three imports are the part to retest. The SDK 58 "navigation core rework" is a second change to test |
| **Removed RN APIs** | I found **no** use of `InteractionManager`, `ImageBackground`, deep `react-native/Libraries` imports, `Modal animated`, or the removed `StatusBar` props. `TouchableOpacity` (used in `components/SymbolSearchField.tsx`) is a normal component, not the removed `Touchable` root export |
| **expo-notifications** | `lib/notifications.ts` already sets a notification handler, so the SDK 58 foreground-default change shouldn't alter behaviour. We don't use the removed `notification` field in `app.json` |
| **expo-router web output** | `app.json` sets `web.output: "static"` explicitly, so the new server default shouldn't apply (inference) |
| **expo-updates** | Bytecode diffing is on by default in SDK 56; `eas update` needs `--environment` in SDK 55. A new runtime version is needed per SDK, so OTA updates don't cross the upgrade |
| **`app.json` clean-up** | `android.edgeToEdgeEnabled` is removed in SDK 55; we have it. Harmless on an iPhone-only app, but it should be deleted |
| **TypeScript** | SDK 56 bumps to 6.0.3; we are on `~5.9.2`. `expo install --fix` aligns it, so expect type errors to fix |
| **`fetch`** | SDK 56 makes `expo/fetch` the global `fetch`. supabase-js, Realtime and the edge-function calls should be retested, with `EXPO_PUBLIC_USE_RN_FETCH=1` as the documented escape hatch |
| **iOS minimum** | 15.1 → 16.4 at SDK 56. We set none explicitly. Drops iPhone 7 and iPhone SE (1st gen) |
| **Google sign-in** | **The main unknown.** The scene life cycle moves URL and user-activity callbacks off `AppDelegate`; Expo says it forwards them to `ExpoAppDelegate` subscribers (finding 3), but `@react-native-google-signin` returns from the browser through a URL callback and I found no source confirming it works under scenes (the library's iOS guide targets bare React Native). Test sign-in on a real iOS 27 device |
| **Deep links** | The invite flow depends on URL events (`lib/auth/authLink.ts`, `app/_layout.tsx` use `Linking`; `associatedDomains` in `app.json`). Expo forwards URL events to its subscribers (finding 3). Retest cold-start and warm links |
| **Node** | SDK 58 needs Node 22.13 or newer (docs). Check the machine and EAS defaults |

**(c) When will Expo support Xcode 27 images?** They exist now: 27.0, 27.1 RC (alias `latest` and
`sdk-58`) and 27.2 (finding 1). SDK 58 shipped 2026-10-15. Known issues are the scene life cycle
(finding 3) and the iPad resizing and orientation changes (finding 10), which affect iPad apps more
than our iPhone-only one (inference).

## Not found / not sure

- Whether **SDK 54 / RN 0.81 builds, or can be patched for scenes**, under Xcode 27: no Expo page
  says (finding 3 is silent on SDK 54–56).
- **Apple's April 2027 notice** isn't on the Upcoming Requirements page I read (finding 5), and
  whether a TestFlight upload is also blocked, or only App Store submission, is not stated.
- **Expo's support window** for SDK 57 and older (finding 12).
- **Google sign-in under scenes**, and whether Expo's plugin handles it. Needs a device test.
- **How `expo install --fix` resolves** our third-party packages (`react-native-gifted-charts`,
  `react-native-svg`, `@expo-google-fonts/inter`) at SDK 58. I did not run it (read-only).
- The SDK 55 and 56 changelog pages were read through a summarizer, so version numbers should be
  confirmed at upgrade time.

## Recommendation

My advice, not a decision.

1. **Don't change the image now.** An Xcode 27 image on SDK 54 gives an app that won't launch
   properly on iOS 27 (finding 2). Keep the `auto` alias (Xcode 26) until the upgrade.
2. **Plan the SDK 58 upgrade, and start it in early January 2027,** once 1.3.0 is on the App
   Store and SDK 58 has had a few patch releases. That leaves about three months before April for
   the work, a phone pass and App Review. Doing it earlier would collide with the current
   release.
3. **Do it as its own branch with one-SDK-at-a-time checkpoints** if the jump proves rough, using
   `expo install expo@^58.0.0 --fix` and `expo-doctor` (finding 4). Test first: Google
   sign-in, invite deep links, push-notification taps, the three `@react-navigation` imports,
   and Supabase fetch calls.
4. **Fallback:** SDK 57 with `enableSceneSupport` if SDK 58 shows a blocker, accepting an unknown
   patch window (finding 12).

## Open questions for Giorgio

1. Is early January 2027 acceptable as the start of the SDK upgrade (after 1.3.0 ships), or do
   you want it earlier?
