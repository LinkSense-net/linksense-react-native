# CLAUDE.md

Guidance for Claude Code in this repository.

## Project

`@linksense-net/react-native` — an **Expo Module** (expo-modules-core) wrapping the
LinkSense native SDKs. Works in Expo (SDK 53+, dev build) and in bare React
Native with `expo` installed. 0.3.0, proprietary. Changes are logged in `CHANGELOG.md`.

## Related repositories

- `../linksense` — backend. Source of truth for `/api/sdk/v1/*`, the error
  envelope (`{error:{code,message,details?}}`) and the strict link schemas
  (`src/features/links/schemas.ts` `createDynamicLinkSdkSchema` /
  `updateDynamicLinkSdkSchema`).
- `../linksense-ios` — iOS SDK. **Vendored** into `ios/LinkSenseCore/` by
  `scripts/sync-ios-sdk.sh <tag>`; never edit `ios/LinkSenseCore/` by hand.
- `../linksense-android` — Android SDK, consumed from Maven Central as
  `net.linksense:sdk` (`android/build.gradle`). Keep its version equal to the
  iOS tag in `scripts/sync-ios-sdk.sh`.
- `../linksense-flutter` — sister wrapper.

## Commands

- `npm run typecheck` · `npm test` (Jest, ts-jest) · `npm run build` (tsc → `build/`)
- `npm run sync-ios-sdk` — re-vendor the iOS SDK at the pinned tag
- Example app: `cd example && npm install && npx expo prebuild && npx expo run:ios|android`.
  `example/.env.local` (gitignored) holds `EXPO_PUBLIC_LINKSENSE_SDK_KEY`.

## Architecture

- **Native does only what must be native:** `configure`, `start` (install +
  deferred deep link, resolved as the promise value), `submitPastedLink` (iOS;
  Android exports it too and the native SDK always returns null),
  and observing Universal Links / App Links (`onDeepLink` event + `/open`
  reporting inside the SDKs).
- **Link CRUD is plain `fetch` in `src/links.ts`** against
  `<baseUrl>/api/sdk/v1/links`: those routes need only the SDK key, so the
  native SDKs add nothing. `baseUrl` is the native module's `baseUrl` constant
  (iOS: the vendored core's `BaseURL.value`, so `LINKSENSE_STAGING` builds hit
  staging; Android: `LinkSense.baseUrl`), falling back to `https://linksense.net`
  when absent.
  Wire shape is snake_case; `CLEAR` sends JSON null, `undefined` omits.
- **Error codes** (`toServerError` in `src/links.ts`): server codes pass through
  except `AUTH_REQUIRED` → `UNAUTHORIZED` and `CUSTOM_PATH_EXISTS` →
  `SLUG_EXISTS`. `ACCESS_DENIED` gets `error.accessDenied` parsed from the
  object `details`; `Retry-After` becomes `retryAfterSeconds`. Native modules
  map native `LinkSenseError`s to the same codes (`LinkSenseException(error)` on
  iOS, `toCodedException()` on Android). Keep them in line with the README
  cross-SDK table.
- **Link hooks:** iOS `LinkSenseAppDelegateSubscriber`, Android
  `LinkSensePackage` → `LinkSenseActivityListener`. Both only observe (return
  false) so the app's router still handles the link. A link that arrives
  before JS calls `configure` is queued in `LinkSenseBridge` and replayed on
  configure.
- **iOS pod is `LinkSenseReactNative`**, compiled together with the vendored
  SDK into one Swift module. It must not be named `LinkSense` (clashes with the
  SDK's `LinkSense` class).
- The SDK key format is pre-checked in JS (`src/index.ts`); both native
  `configure`s also throw on a bad key and reject with `INVALID_SDK_KEY`.
- Building the example against an unpublished `net.linksense:sdk`: pass a Gradle
  `--init-script` adding `mavenLocal()`; never commit `mavenLocal()`.
