require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "LinkSense"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://linksense.net"
  s.license      = { :type => "Proprietary", :file => "../LICENSE" }
  s.authors      = { package["author"] => "support@linksense.net" }
  s.platforms    = { :ios => "14.0" }
  s.source       = { :git => "https://github.com/jankokalj/linksense-react-native.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.requires_arc = true

  # Pre-release: the `LinkSense` native pod is referenced but not yet
  # public. Uncomment once the iOS SDK ships via CocoaPods / SPM pod.
  # s.dependency "LinkSense", "~> 0.1.0"

  # React Native New Architecture (Turbo Modules) is the only supported
  # path — RN 0.76+ ships New Architecture on by default.
  install_modules_dependencies(s)
end
