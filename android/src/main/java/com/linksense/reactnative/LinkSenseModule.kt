package com.linksense.reactnative

import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
// Native SDK import — bound via the gradle dependency. Pre-release, the
// dependency is commented out, but this file compiles against the
// sibling Android SDK project for local testing.
import net.linksense.sdk.LinkSense
import net.linksense.sdk.LinkSenseConfiguration
import net.linksense.sdk.LinkSenseError
import net.linksense.sdk.LogLevel
import net.linksense.sdk.links.CreateLinkOptions
import net.linksense.sdk.links.FieldUpdate
import net.linksense.sdk.links.Link
import net.linksense.sdk.links.LinkMetadataValue
import net.linksense.sdk.links.UpdateLinkOptions

/**
 * React Native Turbo Module bridge for Android.
 *
 * Delegates every call to the shared `LinkSense` Kotlin facade. Mirrors
 * the Flutter Android plugin (`LinksensePlugin.kt`) so both wrappers
 * translate options identically — any drift would show up as a failing
 * server `FORBIDDEN_FIELD` on one platform but not the other.
 */
@ReactModule(name = LinkSenseModule.NAME)
class LinkSenseModule(reactContext: ReactApplicationContext) :
    NativeLinkSenseSpec(reactContext) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    override fun getName(): String = NAME

    @ReactMethod
    override fun configure(config: ReadableMap, promise: Promise) {
        try {
            val sdkKey = config.getString("sdkKey") ?: run {
                promise.reject("INVALID_INPUT", "sdkKey is required")
                return
            }
            val baseUrl = if (config.hasKey("baseUrl") && !config.isNull("baseUrl")) config.getString("baseUrl") else null
            val enableClipboard = if (config.hasKey("enableClipboard")) config.getBoolean("enableClipboard") else false
            val enableInstallReferrer = if (config.hasKey("enableInstallReferrer")) config.getBoolean("enableInstallReferrer") else true
            val enableFingerprint = if (config.hasKey("enableFingerprint")) config.getBoolean("enableFingerprint") else true
            val logLevelName = if (config.hasKey("logLevel")) config.getString("logLevel") ?: "off" else "off"
            val logLevel = when (logLevelName) {
                "error" -> LogLevel.ERROR
                "info" -> LogLevel.INFO
                "debug" -> LogLevel.DEBUG
                else -> LogLevel.OFF
            }
            // `enableClipboard` is iOS-only — Android uses Install Referrer.
            // Track it for parity across the Turbo Module spec even though it's unused.
            @Suppress("UNUSED_VARIABLE") val _clipboard = enableClipboard

            LinkSense.configure(
                reactApplicationContext,
                LinkSenseConfiguration(
                    sdkKey = sdkKey,
                    baseUrl = baseUrl,
                    enableInstallReferrer = enableInstallReferrer,
                    enableFingerprint = enableFingerprint,
                    logLevel = logLevel,
                ),
            )
            promise.resolve(null)
        } catch (t: Throwable) {
            promise.reject("UNKNOWN", t.message ?: "configure failed", t)
        }
    }

    @ReactMethod
    override fun start(promise: Promise) {
        try {
            LinkSense.onDeferredDeepLink { uri ->
                val encoded = uri?.toString() ?: ""
                reactApplicationContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(EVENT_DEEP_LINK, encoded)
            }
            LinkSense.start()
            promise.resolve(null)
        } catch (t: Throwable) {
            promise.reject("UNKNOWN", t.message ?: "start failed", t)
        }
    }

    @ReactMethod
    override fun createLink(options: ReadableMap, promise: Promise) {
        val parsed = readCreateOptions(options) ?: run {
            promise.reject("INVALID_INPUT", "createLink requires name")
            return
        }
        scope.launch {
            try {
                val link = LinkSense.createLink(parsed)
                promise.resolve(encodeLink(link))
            } catch (t: Throwable) { rejectWithLinkSenseError(promise, t) }
        }
    }

    @ReactMethod
    override fun getLink(id: String, promise: Promise) {
        scope.launch {
            try { promise.resolve(encodeLink(LinkSense.getLink(id))) }
            catch (t: Throwable) { rejectWithLinkSenseError(promise, t) }
        }
    }

    @ReactMethod
    override fun updateLink(id: String, options: ReadableMap, promise: Promise) {
        val parsed = readUpdateOptions(options)
        scope.launch {
            try { promise.resolve(encodeLink(LinkSense.updateLink(id, parsed))) }
            catch (t: Throwable) { rejectWithLinkSenseError(promise, t) }
        }
    }

    @ReactMethod
    override fun deleteLink(id: String, promise: Promise) {
        scope.launch {
            try {
                LinkSense.deleteLink(id)
                promise.resolve(null)
            } catch (t: Throwable) { rejectWithLinkSenseError(promise, t) }
        }
    }

    // NativeEventEmitter bookkeeping — required by the spec.
    @ReactMethod override fun addListener(eventName: String) { /* no-op */ }
    @ReactMethod override fun removeListeners(count: Double) { /* no-op */ }

    // MARK: - Option / error translation (parallel to Flutter's LinksensePlugin.kt)

    private fun readCreateOptions(map: ReadableMap): CreateLinkOptions? {
        val name = map.getString("name") ?: return null
        return CreateLinkOptions(
            name = name,
            desktopUrl = map.getStringOrNull("desktop_url"),
            slug = map.getStringOrNull("slug"),
            tags = map.getStringListOrNull("tags"),
            metadata = map.getMapOrNull("metadata")?.let(::toMetadataMap),
            iosClipboardEnabled = map.getBooleanOrNull("ios_clipboard_enabled"),
            iosFallbackUrl = map.getStringOrNull("ios_fallback_url"),
            androidFallbackUrl = map.getStringOrNull("android_fallback_url"),
            ogTitle = map.getStringOrNull("og_title"),
            ogDescription = map.getStringOrNull("og_description"),
            ogImageUrl = map.getStringOrNull("og_image_url"),
        )
    }

    private fun readUpdateOptions(map: ReadableMap): UpdateLinkOptions {
        return UpdateLinkOptions(
            name = map.getStringOrNull("name")?.let(FieldUpdate::Set) ?: FieldUpdate.Absent,
            desktopUrl = fieldUpdateString(map, "desktop_url"),
            tags = map.getStringListOrNull("tags")?.let(FieldUpdate::Set) ?: FieldUpdate.Absent,
            metadata = fieldUpdate(map, "metadata") { raw ->
                if (raw == null) null else toMetadataMap(raw as ReadableMap)
            },
            iosClipboardEnabled = map.getBooleanOrNull("ios_clipboard_enabled")?.let(FieldUpdate::Set) ?: FieldUpdate.Absent,
            iosFallbackUrl = fieldUpdateString(map, "ios_fallback_url"),
            androidFallbackUrl = fieldUpdateString(map, "android_fallback_url"),
            ogTitle = fieldUpdateString(map, "og_title"),
            ogDescription = fieldUpdateString(map, "og_description"),
            ogImageUrl = fieldUpdateString(map, "og_image_url"),
        )
    }

    private fun fieldUpdateString(map: ReadableMap, key: String): FieldUpdate<String?> {
        if (!map.hasKey(key)) return FieldUpdate.Absent
        return if (map.isNull(key)) FieldUpdate.Clear else FieldUpdate.Set(map.getString(key))
    }

    private fun <T> fieldUpdate(map: ReadableMap, key: String, transform: (Any?) -> T?): FieldUpdate<T?> {
        if (!map.hasKey(key)) return FieldUpdate.Absent
        val raw: Any? = if (map.isNull(key)) null else when (key) {
            "metadata" -> map.getMap(key)
            else -> map.getString(key)
        }
        return if (raw == null) FieldUpdate.Clear else FieldUpdate.Set(transform(raw))
    }

    private fun toMetadataMap(raw: ReadableMap): Map<String, LinkMetadataValue> {
        val result = mutableMapOf<String, LinkMetadataValue>()
        val iterator = raw.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            val value = toMetadataValue(raw, key) ?: continue
            result[key] = value
        }
        return result
    }

    private fun toMetadataValue(raw: ReadableMap, key: String): LinkMetadataValue? {
        return when (raw.getType(key)) {
            com.facebook.react.bridge.ReadableType.Null -> LinkMetadataValue.Null
            com.facebook.react.bridge.ReadableType.Boolean -> LinkMetadataValue.BoolValue(raw.getBoolean(key))
            com.facebook.react.bridge.ReadableType.Number -> {
                val d = raw.getDouble(key)
                if (d % 1.0 == 0.0) LinkMetadataValue.LongValue(d.toLong())
                else LinkMetadataValue.DoubleValue(d)
            }
            com.facebook.react.bridge.ReadableType.String -> LinkMetadataValue.StringValue(raw.getString(key) ?: "")
            com.facebook.react.bridge.ReadableType.Map -> {
                val nested = raw.getMap(key) ?: return null
                LinkMetadataValue.ObjectValue(toMetadataMap(nested))
            }
            com.facebook.react.bridge.ReadableType.Array -> {
                // Arrays in metadata are rare but supported server-side.
                // Omit for now — integrators can flatten to an object key
                // if they need ordered values.
                null
            }
        }
    }

    private fun encodeLink(link: Link): WritableMap = WritableNativeMap().apply {
        putString("id", link.id)
        putString("project_id", link.projectId)
        putString("name", link.name)
        putString("custom_path", link.slug)
        putString("full_url", link.fullUrl)
        putString("desktop_url", link.desktopUrl)
        putString("ios_fallback_url", link.iosFallbackUrl)
        putString("android_fallback_url", link.androidFallbackUrl)
        putString("og_title", link.ogTitle)
        putString("og_description", link.ogDescription)
        putString("og_image_url", link.ogImageUrl)
        val tagsArray = Arguments.createArray()
        link.tags.forEach { tagsArray.pushString(it) }
        putArray("tags", tagsArray)
        putBoolean("ios_clipboard_enabled", link.iosClipboardEnabled)
        putString("created_at", link.createdAt)
        putString("updated_at", link.updatedAt)
    }

    private fun rejectWithLinkSenseError(promise: Promise, error: Throwable) {
        when (error) {
            is LinkSenseError.NotConfigured -> promise.reject("NOT_CONFIGURED", error.message, error)
            is LinkSenseError.InvalidSdkKey -> promise.reject("INVALID_SDK_KEY", error.message, error)
            is LinkSenseError.Network -> promise.reject("NETWORK", error.message, error)
            is LinkSenseError.Server -> promise.reject(error.code, error.serverMessage,
                WritableNativeMap().apply { putInt("status", error.status) })
            is LinkSenseError.DecodeFailure -> promise.reject("DECODE_FAILURE", error.message, error)
            is LinkSenseError.ForbiddenCrossScope -> promise.reject("FORBIDDEN_CROSS_SCOPE", error.message, error)
            is LinkSenseError.ForbiddenField -> promise.reject("FORBIDDEN_FIELD", error.message, error)
            is LinkSenseError.RateLimited -> promise.reject("RATE_LIMITED", error.message,
                WritableNativeMap().apply { error.retryAfterSeconds?.let { putInt("retryAfter", it) } })
            else -> promise.reject("UNKNOWN", error.message ?: "unknown", error)
        }
    }

    // ReadableMap helpers — null-aware accessors the bridge API should
    // really have out of the box.
    private fun ReadableMap.getStringOrNull(key: String): String? =
        if (hasKey(key) && !isNull(key)) getString(key) else null
    private fun ReadableMap.getBooleanOrNull(key: String): Boolean? =
        if (hasKey(key) && !isNull(key)) getBoolean(key) else null
    private fun ReadableMap.getMapOrNull(key: String): ReadableMap? =
        if (hasKey(key) && !isNull(key)) getMap(key) else null
    private fun ReadableMap.getStringListOrNull(key: String): List<String>? {
        if (!hasKey(key) || isNull(key)) return null
        val arr = getArray(key) ?: return null
        val out = ArrayList<String>(arr.size())
        for (i in 0 until arr.size()) {
            arr.getString(i)?.let { out.add(it) }
        }
        return out
    }

    companion object {
        const val NAME = "LinkSenseSpec"
        private const val EVENT_DEEP_LINK = "onDeferredDeepLink"
    }
}
