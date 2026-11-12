# Changelog

## 0.3.0

Aligns the API with the other LinkSense SDKs (iOS, Android, Flutter) — see the
cross-SDK table in the README. Wraps native iOS and Android SDK 0.3.0.

### Breaking

- `AUTH_REQUIRED` is gone from `LinkSenseErrorCode`; the server's `AUTH_REQUIRED`
  now surfaces as `UNAUTHORIZED`.
- `CUSTOM_PATH_EXISTS` is now `SLUG_EXISTS` (both wire codes map to it).
- The `LinkSenseError` constructor detail key `retryAfter` is now
  `retryAfterSeconds`, matching the `retryAfterSeconds` property.
- Link CRUD follows the native SDK's API host instead of always using
  production: a staging native build (iOS `LINKSENSE_STAGING`) talks to staging.
- The native module must implement `submitPastedLink` on both platforms; the JS
  fallback for a missing native method is gone.

### Added

- `error.accessDenied` (`AccessDeniedDetails`: `serverMessage`,
  `upgradeRequired`, `plan?`, `currentUsage?`, `limit?`) on `ACCESS_DENIED`.
- Android `submitPastedLink`, backed by the native SDK (always resolves `null`).
- Both native `configure`s reject a malformed key with `INVALID_SDK_KEY`.

### Fixed

- The JS link client no longer hardcodes `https://linksense.net`.

## 0.2.0

Rebuilt as an Expo Module over the native LinkSense iOS and Android SDKs.
