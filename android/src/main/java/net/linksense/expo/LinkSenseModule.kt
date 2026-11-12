package net.linksense.expo

import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import net.linksense.sdk.LinkSense
import net.linksense.sdk.LinkSenseConfiguration
import net.linksense.sdk.LogLevel

/** JS name `LinkSense`. Wraps `net.linksense:sdk`. */
class LinkSenseModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LinkSense")

    Events("onDeepLink")

    OnCreate { LinkSenseBridge.module = this@LinkSenseModule }
    OnDestroy { if (LinkSenseBridge.module === this@LinkSenseModule) LinkSenseBridge.module = null }

    AsyncFunction("configure") { sdkKey: String, enableInstallReferrer: Boolean, enableFingerprint: Boolean, logLevel: String ->
      val context = appContext.reactContext?.applicationContext
        ?: throw CodedException("NOT_CONFIGURED", "React context unavailable", null)
      LinkSense.configure(
        context,
        LinkSenseConfiguration(
          sdkKey = sdkKey,
          enableInstallReferrer = enableInstallReferrer,
          enableFingerprint = enableFingerprint,
          logLevel = level(logLevel),
        ),
      )
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
  }

  private fun level(raw: String): LogLevel = when (raw) {
    "error" -> LogLevel.ERROR
    "info" -> LogLevel.INFO
    "debug" -> LogLevel.DEBUG
    else -> LogLevel.OFF
  }
}
