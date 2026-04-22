# @linksense/react-native

React Native Turbo Module for [LinkSense](https://linksense.net) dynamic
links and deferred deep linking on iOS and Android. Closed-source —
source available per-customer under NDA.

- **Minimum React Native**: 0.76 (New Architecture / Turbo Modules only)
- **Minimum iOS**: 14 · **Minimum Android**: API 24
- **Architecture**: Turbo Modules only. Old-architecture bridge is
  deprecated upstream in RN 0.76+; supporting both doubles the plugin
  surface for zero customer benefit in 2026.
- **Expo**: `@linksense/expo` wraps this package — pending, tracked
  separately.

## Install

```sh
npm install @linksense/react-native
# or
yarn add @linksense/react-native
```

iOS:

```sh
cd ios && pod install
```

Android autolinking discovers the package — no manual registration needed.

## Configure

```tsx
import LinkSense from '@linksense/react-native';

await LinkSense.configure({
  sdkKey: 'ls_sdk_<project>_<random>',
  enableClipboard: false,     // iOS opt-in; default false
  enableInstallReferrer: true, // Android; default true
  logLevel: 'off',
});

LinkSense.onDeferredDeepLink((url) => {
  if (url != null) router.handle(url);
});

await LinkSense.start();
```

## Data collected

No IDFA. No AAID. No ANDROID_ID. Per-project device-ID hashing.
See [../linksense-ios/PRIVACY.md](../linksense-ios/PRIVACY.md) and
[../linksense-android/PRIVACY.md](../linksense-android/PRIVACY.md).

## License

Proprietary. Source available to active LinkSense customers under NDA.
