import ExpoModulesCore

/// JS name `LinkSense`. Wraps the vendored iOS SDK (ios/LinkSenseCore/), which
/// compiles into this same module, so its types are used directly.
public class LinkSenseModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LinkSense")

    Events("onDeepLink")

    /// The API host the vendored core was built against (staging under
    /// `LINKSENSE_STAGING`). JS link CRUD uses it, so both halves hit one backend.
    Constants(["baseUrl": BaseURL.value.absoluteString])

    OnCreate {
      LinkSenseBridge.shared.module = self
    }

    // JS (src/index.ts) pre-checks the key format; the core re-checks and throws.
    AsyncFunction("configure") { (sdkKey: String, enableClipboard: Bool, logLevel: String) in
      do {
        try LinkSense.shared.configure(
          LinkSenseConfiguration(sdkKey: sdkKey, enableClipboard: enableClipboard, logLevel: Self.level(logLevel))
        )
      } catch let error as LinkSenseError {
        throw LinkSenseException(error)
      }
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

  /// Codes match the JS `LinkSenseErrorCode` union (README cross-SDK table).
  /// Only the code and message cross the bridge; `retryAfterSeconds` and the
  /// access-denied details are carried in the message.
  convenience init(_ error: LinkSenseError) {
    let code: String
    switch error {
    case .notConfigured: code = "NOT_CONFIGURED"
    case .invalidSdkKey: code = "INVALID_SDK_KEY"
    case .network: code = "NETWORK"
    case .server(let serverCode, _, _): code = serverCode
    case .decodeFailure: code = "DECODE_FAILURE"
    case .forbiddenCrossScope: code = "FORBIDDEN_CROSS_SCOPE"
    case .forbiddenField: code = "FORBIDDEN_FIELD"
    case .rateLimited: code = "RATE_LIMITED"
    case .unauthorized: code = "UNAUTHORIZED"
    case .notFound: code = "NOT_FOUND"
    case .slugExists: code = "SLUG_EXISTS"
    case .accessDenied: code = "ACCESS_DENIED"
    case .invalidInput: code = "INVALID_INPUT"
    }
    self.init(code, error.localizedDescription)
  }

  override var code: String { param.code }
  override var reason: String { param.message }
}
