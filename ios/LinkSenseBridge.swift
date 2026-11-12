import Foundation

/// Glue between the app-delegate hook and the JS-facing module.
///
/// iOS delivers a cold-launch Universal Link to the app delegate before the JS
/// bundle has run `configure()`. The SDK can't handle it yet, so it is held
/// here and replayed once JS configures the SDK.
final class LinkSenseBridge {
  static let shared = LinkSenseBridge()

  private let lock = NSLock()
  private weak var _module: LinkSenseModule?
  private var _isConfigured = false
  private var pending: [NSUserActivity] = []

  var module: LinkSenseModule? {
    get { lock.withLock { _module } }
    set { lock.withLock { _module = newValue } }
  }

  var isConfigured: Bool { lock.withLock { _isConfigured } }

  func handle(_ activity: NSUserActivity) {
    guard activity.activityType == NSUserActivityTypeBrowsingWeb, activity.webpageURL != nil else {
      return
    }
    let ready: Bool = lock.withLock {
      if !_isConfigured { pending.append(activity) }
      return _isConfigured
    }
    if ready { forward(activity) }
  }

  func markConfigured() {
    let queued: [NSUserActivity] = lock.withLock {
      _isConfigured = true
      defer { pending.removeAll() }
      return pending
    }
    queued.forEach(forward)
  }

  private func forward(_ activity: NSUserActivity) {
    LinkSense.shared.continueUserActivity(activity) { [weak self] url in
      self?.module?.sendEvent("onDeepLink", ["url": url?.absoluteString as Any])
    }
  }
}
