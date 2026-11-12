package net.linksense.expo

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/** Registers the activity hook, so the integrator never edits MainActivity. */
class LinkSensePackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> =
    listOf(LinkSenseActivityListener())
}

/**
 * Sees every App Link intent. Only observes: LinkSense reports the open and
 * resolves first-launch attribution; routing stays with the app (Expo Router /
 * React Native Linking), so `onNewIntent` returns false.
 */
internal class LinkSenseActivityListener : ReactActivityLifecycleListener {
  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    // A re-created activity (rotation, process restore) carries the same
    // launch intent again; reporting it would count the open twice.
    if (savedInstanceState == null) {
      LinkSenseBridge.handle(activity.intent)
    }
  }

  override fun onNewIntent(intent: Intent?): Boolean {
    LinkSenseBridge.handle(intent)
    return false
  }
}
