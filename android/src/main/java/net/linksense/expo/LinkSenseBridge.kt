package net.linksense.expo

import android.content.Intent
import net.linksense.sdk.LinkSense

/**
 * Glue between the activity hook and the JS-facing module.
 *
 * The launch intent reaches `Activity.onCreate` before the JS bundle has run
 * `configure()`, so the SDK can't handle it yet. It is held here and replayed
 * once JS configures the SDK.
 */
internal object LinkSenseBridge {
  @Volatile var module: LinkSenseModule? = null
  private var configured = false
  private val pending = mutableListOf<Intent>()

  val isConfigured: Boolean
    @Synchronized get() = configured

  fun handle(intent: Intent?) {
    if (intent?.action != Intent.ACTION_VIEW || intent.data == null) return
    val ready = synchronized(this) {
      if (!configured) pending += intent
      configured
    }
    if (ready) forward(intent)
  }

  fun markConfigured() {
    val queued = synchronized(this) {
      configured = true
      pending.toList().also { pending.clear() }
    }
    queued.forEach(::forward)
  }

  private fun forward(intent: Intent) {
    LinkSense.handleIntent(intent) { uri ->
      module?.sendEvent("onDeepLink", mapOf("url" to uri?.toString()))
    }
  }
}
