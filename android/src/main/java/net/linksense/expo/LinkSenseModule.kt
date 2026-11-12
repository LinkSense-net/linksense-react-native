package net.linksense.expo

import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import net.linksense.sdk.LinkSense
import net.linksense.sdk.LinkSenseConfiguration
import net.linksense.sdk.LinkSenseError
import net.linksense.sdk.LogLevel

/** JS name `LinkSense`. Wraps `net.linksense:sdk`. */
class LinkSenseModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LinkSense")

    Events("onDeepLink")

    Constants("baseUrl" to LinkSense.baseUrl)

    OnCreate { LinkSenseBridge.module = this@LinkSenseModule }
    OnDestroy { if (LinkSenseBridge.module === this@LinkSenseModule) LinkSenseBridge.module = null }

    AsyncFunction("configure") { sdkKey: String, enableInstallReferrer: Boolean, enableFingerprint: Boolean, logLevel: String ->
      val context = appContext.reactContext?.applicationContext
        ?: throw CodedException("NOT_CONFIGURED", "React context unavailable", null)
      // JS (src/index.ts) pre-checks the key format; the SDK re-checks and throws.
      try {
        LinkSense.configure(
          context,
          LinkSenseConfiguration(
            sdkKey = sdkKey,
            enableInstallReferrer = enableInstallReferrer,
            enableFingerprint = enableFingerprint,
            logLevel = level(logLevel),
          ),
        )
      } catch (e: LinkSenseError) {
        throw e.toCodedException()
      }
      LinkSenseBridge.markConfigured()
    }

    /** Resolves with the deferred deep link for this install, or null. JS caches the promise. */
    AsyncFunction("start") { promise: Promise ->
      if (!LinkSenseBridge.isConfigured) {
        promise.reject(CodedException("NOT_CONFIGURED", "Call configure() before start()", null))
        return@AsyncFunction
      }
      LinkSense.onDeferredDeepLink { uri -> promise.resolve(uri?.toString()) }
      LinkSense.start()
    }

    /** A documented no-op on Android (the Play Install Referrer covers it): resolves null. */
    AsyncFunction("submitPastedLink") Coroutine { text: String ->
      try {
        LinkSense.submitPastedLink(text)?.toString()
      } catch (e: LinkSenseError) {
        throw e.toCodedException()
      }
    }
  }

  private fun level(raw: String): LogLevel = when (raw) {
    "error" -> LogLevel.ERROR
    "info" -> LogLevel.INFO
    "debug" -> LogLevel.DEBUG
    else -> LogLevel.OFF
  }
}

/**
 * Codes match the JS `LinkSenseErrorCode` union (README cross-SDK table). Only
 * the code and message cross the bridge; `retryAfterSeconds` and the
 * access-denied details are carried in the message.
 */
internal fun LinkSenseError.toCodedException(): CodedException {
  val code = when (this) {
    is LinkSenseError.NotConfigured -> "NOT_CONFIGURED"
    is LinkSenseError.InvalidSdkKey -> "INVALID_SDK_KEY"
    is LinkSenseError.Network -> "NETWORK"
    is LinkSenseError.Server -> this.code
    is LinkSenseError.DecodeFailure -> "DECODE_FAILURE"
    is LinkSenseError.ForbiddenCrossScope -> "FORBIDDEN_CROSS_SCOPE"
    is LinkSenseError.ForbiddenField -> "FORBIDDEN_FIELD"
    is LinkSenseError.RateLimited -> "RATE_LIMITED"
    is LinkSenseError.Unauthorized -> "UNAUTHORIZED"
    is LinkSenseError.NotFound -> "NOT_FOUND"
    is LinkSenseError.SlugExists -> "SLUG_EXISTS"
    is LinkSenseError.AccessDenied -> "ACCESS_DENIED"
    is LinkSenseError.InvalidInput -> "INVALID_INPUT"
  }
  return CodedException(code, message ?: code, this)
}
