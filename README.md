# @linksense-net/react-native

[LinkSense](https://linksense.net) for Expo and React Native: deferred deep
linking, app-open reporting for Universal Links / App Links, and dynamic-link
creation. An Expo Module over the native LinkSense iOS and Android SDKs (0.3.0).

- **Expo** SDK 53+ with a development build or EAS Build (not Expo Go: this
  package has native code). Bare React Native works too with `expo` installed.
- **New Architecture**, React Native 0.79+
- **iOS** 16+ · **Android** API 24+

## Install

```sh
npx expo install @linksense-net/react-native expo-build-properties
```

## Configure the app (`app.json`)

Replace `your-project` with your LinkSense project subdomain, and use the bundle
ID / package name registered for the project in the LinkSense dashboard.

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.example.app",
      "associatedDomains": ["applinks:your-project.linksense.net"]
    },
    "android": {
      "package": "com.example.app",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [{ "scheme": "https", "host": "your-project.linksense.net" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    "plugins": [["expo-build-properties", { "ios": { "deploymentTarget": "16.0" } }]]
  }
}
```

No AppDelegate or MainActivity changes: the module hooks Universal Link and App
Link delivery itself. It only observes them, so keep routing links with Expo
Router or `expo-linking` as you do today.

For App Links / Universal Links to verify, the project's iOS app (Team ID) and
Android app (SHA-256 signing fingerprint) must be set in the dashboard;
LinkSense serves the `.well-known` files for you.

## Use

```tsx
import LinkSense from '@linksense-net/react-native';

await LinkSense.configure({ sdkKey: process.env.EXPO_PUBLIC_LINKSENSE_SDK_KEY! });

// First launch: the link that led to this install, or null. Later launches: null.
const deferredDeepLink = await LinkSense.start();
if (deferredDeepLink) router.push(new URL(deferredDeepLink).pathname);
```

Call `configure` and `start` once, as early as possible (for example in your
root layout's effect). A link that opens the app before `configure` runs is held
and reported once you configure.

### Links opened while installed

Every Universal Link / App Link that opens the app is reported to LinkSense, so
opens show in your analytics. To also receive the URL LinkSense resolved:

```tsx
const unsubscribe = LinkSense.onDeepLink(url => { /* analytics, logging */ });
```

### Paste-to-attribute (iOS)

On iOS 16+ reading the clipboard shows a system prompt. If your onboarding has
a "paste your invite link" field, pass the text and LinkSense attributes the
install with no prompt:

```tsx
const deepLink = await LinkSense.submitPastedLink(text); // always null on Android
```

`enableClipboard: true` instead reads the clipboard automatically on first
launch (with the prompt).

### Create links

```tsx
const link = await LinkSense.createLink({ name: 'Invite from Maria', tags: ['invite'] });
share(link.fullUrl);

await LinkSense.updateLink(link.id, { ogTitle: 'Join Maria on Acme' });
await LinkSense.deleteLink(link.id);
```

Errors are `LinkSenseError` with a `code` (`INVALID_SDK_KEY`, `NOT_CONFIGURED`,
`NETWORK`, `UNAUTHORIZED`, `NOT_FOUND`, `SLUG_EXISTS`, `INVALID_INPUT`,
`ACCESS_DENIED`, `RATE_LIMITED`, …), the HTTP `status`, `retryAfterSeconds`,
`fieldErrors` for validation errors, and `accessDenied` for `ACCESS_DENIED`:

```tsx
try {
  await LinkSense.createLink({ name: 'Invite' });
} catch (e) {
  if (e instanceof LinkSenseError && e.code === 'ACCESS_DENIED' && e.accessDenied?.upgradeRequired) {
    // e.accessDenied: { serverMessage, upgradeRequired, plan?, currentUsage?, limit? }
  }
}
```

Link calls go to the API host the native SDK was built against.

## Options

| Option | Platform | Default | |
|---|---|---|---|
| `sdkKey` | both | — | `ls_sdk_…` from the dashboard (publishable) |
| `enableClipboard` | iOS | `false` | read the clipboard on first launch (shows the paste prompt) |
| `enableInstallReferrer` | Android | `true` | read the Play Install Referrer |
| `enableFingerprint` | Android | `true` | send the probabilistic fingerprint |
| `logLevel` | both | `'off'` | `'error' \| 'info' \| 'debug'` |

## Data collected

No IDFA, no AAID, no ANDROID_ID. See the native SDKs' privacy notes:
[iOS](https://github.com/LinkSense-net/linksense-ios-sdk/blob/main/PRIVACY.md) ·
Android (`net.linksense:sdk`, PRIVACY.md in the artifact sources). The iOS
privacy manifest ships inside this package.

## Cross-SDK API (0.3.0)

The same surface in every LinkSense SDK. Names differ only where the platform idiom does.

| Concept | iOS (Swift) | Android (Kotlin) | Flutter (Dart) | React Native (TS) |
|---|---|---|---|---|
| Configure (throws on a malformed key) | `try LinkSense.configure(_:)` | `LinkSense.configure(context, config)` | `await LinkSense.configure(config)` | `LinkSense.configure(config)` |
| Start / deferred link | `start()` + `onDeferredDeepLink { }` | `start()` + `onDeferredDeepLink { }` | `start()` + `deferredDeepLinks` stream | `await start()` |
| Link opens | `continueUserActivity(_:handler:)` | `handleIntent(intent) { }` | `deepLinks` stream | `onDeepLink(listener)` |
| Pasted link | `submitPastedLink(_:completion:)` | `submitPastedLink(text)` (no-op, returns null) | `submitPastedLink(text)` | `submitPastedLink(text)` |
| Create / get / update / delete | `createLink` / `getLink` / `updateLink` / `deleteLink` | same, `suspend` | same, `Future` | same, `Promise` |
| Update: leave field / set / clear | `.unchanged` / `.set(v)` / `.clear` | `FieldUpdate.Unchanged` / `Set(v)` / `Clear` | `null` / `FieldUpdate.set(v)` / `FieldUpdate.clear()` | `undefined` / `v` / `CLEAR` |
| Link metadata | `link.metadata` | `link.metadata` | `link.metadata` | `link.metadata` |

| Error | iOS `LinkSenseError` | Android `LinkSenseError` | Flutter | RN `error.code` |
|---|---|---|---|---|
| Not configured | `.notConfigured` | `NotConfigured` | `LinkSenseNotConfiguredException` | `NOT_CONFIGURED` |
| Malformed SDK key | `.invalidSdkKey` | `InvalidSdkKey` | `LinkSenseInvalidSdkKeyException` | `INVALID_SDK_KEY` |
| Bad / revoked key | `.unauthorized` | `Unauthorized` | `LinkSenseUnauthorizedException` | `UNAUTHORIZED` |
| Plan limit / platform not allowed | `.accessDenied(details)` | `AccessDenied(...)` | `LinkSenseAccessDeniedException` | `ACCESS_DENIED` + `error.accessDenied` |
| Rate limited | `.rateLimited(retryAfterSeconds:)` | `RateLimited(retryAfterSeconds)` | `LinkSenseRateLimitedException.retryAfterSeconds` | `RATE_LIMITED` + `error.retryAfterSeconds` |
| Slug taken | `.slugExists` | `SlugExists` | `LinkSenseSlugExistsException` | `SLUG_EXISTS` |
| Validation | `.invalidInput(fieldErrors:)` | `InvalidInput(fieldErrors)` | `LinkSenseInvalidInputException` | `INVALID_INPUT` + `error.fieldErrors` |
| Not found | `.notFound` | `NotFound` | `LinkSenseNotFoundException` | `NOT_FOUND` |

Access-denied details carry the same fields everywhere: `serverMessage`, `upgradeRequired` (false when absent), `plan`, `currentUsage`, `limit` (each optional).

## License

Proprietary — see [LICENSE](LICENSE).
