#!/usr/bin/env bash
# Vendor the LinkSense iOS SDK sources into ios/LinkSenseCore/ at a pinned tag.
#
# Why vendor: Expo builds iOS with CocoaPods, the iOS SDK ships only as a Swift
# package, and CocoaPods trunk is being wound down. Compiling the SDK sources
# inside this pod is the dependable path. The sources are public
# (LinkSense-net/linksense-ios-sdk), so nothing is exposed that isn't already.
#
# Usage: scripts/sync-ios-sdk.sh [tag]   (default: the pinned IOS_SDK_TAG below)
# Commit the result. Bump IOS_SDK_TAG together with the Android dependency in
# android/build.gradle so both platforms ship the same SDK version.
set -euo pipefail

IOS_SDK_TAG="${1:-v0.2.0}"
REPO="https://github.com/LinkSense-net/linksense-ios-sdk.git"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/ios/LinkSenseCore"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git clone --quiet --depth 1 --branch "$IOS_SDK_TAG" "$REPO" "$tmp/sdk"

rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$tmp/sdk/Sources/LinkSense/." "$DEST/"
echo "$IOS_SDK_TAG $(git -C "$tmp/sdk" rev-parse HEAD)" > "$DEST/VERSION"

echo "Vendored LinkSense iOS SDK $IOS_SDK_TAG into ios/LinkSenseCore/"
