require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

# One pod: this Expo module plus the vendored LinkSense iOS SDK sources
# (ios/LinkSenseCore/, synced by scripts/sync-ios-sdk.sh). The pod must not be
# named "LinkSense": a Swift module sharing its name with the SDK's public
# `LinkSense` class breaks qualified lookups.
Pod::Spec.new do |s|
  s.name           = 'LinkSenseReactNative'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = { :type => 'Proprietary', :file => '../LICENSE' }
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = { :ios => '16.0' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/LinkSense-net/linksense-react-native.git', tag: "v#{s.version}" }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.swift'
  s.resource_bundles = {
    'LinkSensePrivacy' => ['LinkSenseCore/Resources/PrivacyInfo.xcprivacy'],
  }
end
