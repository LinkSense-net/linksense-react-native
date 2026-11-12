import ExpoModulesCore

/// JS name `LinkSense`. Wraps the vendored iOS SDK (ios/LinkSenseCore/), which
/// compiles into this same module, so its types are used directly.
public class LinkSenseModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LinkSense")

    Events("onDeepLink")

    OnCreate {
      LinkSenseBridge.shared.module = self
    }

    // The key format is validated in JS (src/index.ts) for both platforms.
    AsyncFunction("configure") { (sdkKey: String, enableClipboard: Bool, logLevel: String) in
      LinkSense.shared.configure(
        LinkSenseConfiguration(sdkKey: sdkKey, enableClipboard: enableClipboard, logLevel: Self.level(logLevel))
      )
      LinkSenseBridge.shared.markConfigured()
    }

    /// Resolves with the deferred deep link for this install, or null. Fires
    /// once per process; JS caches the promise.
    AsyncFunction("start") { (promise: Promise) in
      guard LinkSenseBridge.shared.isConfigured else {
        promise.reject(LinkSenseException("NOT_CONFIGURED", "Call configure() before start()"))
        return
      }
      LinkSense.shared.onDeferredDeepLink { url in promise.resolve(url?.absoluteString) }
      LinkSense.shared.start()
    }

    /// iOS 16+ no-prompt clipboard path: the user's own paste gesture supplies
    /// the text. Resolves with the matched deep link, or null.
    AsyncFunction("submitPastedLink") { (text: String, promise: Promise) in
      LinkSense.shared.submitPastedLink(text) { url in promise.resolve(url?.absoluteString) }
    }
  }

  private static func level(_ raw: String) -> LogLevel {
    switch raw {
    case "error": return .error
    case "info": return .info
    case "debug": return .debug
    default: return .off
    }
  }
}

/// Rejects the JS promise with `code`, which the TS layer turns into a
/// `LinkSenseError` with the same code.
final class LinkSenseException: GenericException<(code: String, message: String)> {
  init(_ code: String, _ message: String) {
    super.init((code: code, message: message))
  }

  override var code: String { param.code }
  override var reason: String { param.message }
}
