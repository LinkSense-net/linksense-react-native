import ExpoModulesCore

/// Sees every Universal Link the app receives, so the integrator never edits
/// AppDelegate. Returns `false`: LinkSense only observes the link (to report
/// the open and resolve first-launch attribution). Routing stays with the
/// app's own handler, e.g. Expo Router / React Native Linking.
public class LinkSenseAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    LinkSenseBridge.shared.handle(userActivity)
    return false
  }
}
