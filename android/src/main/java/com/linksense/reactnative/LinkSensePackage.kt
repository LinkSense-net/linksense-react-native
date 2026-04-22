package com.linksense.reactnative

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Turbo Package registration. RN 0.76+ automatically discovers packages
 * listed in `android/app/build.gradle`'s autolinking config; integrators
 * do not need to add this manually.
 */
class LinkSensePackage : TurboReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return if (name == LinkSenseModule.NAME) LinkSenseModule(reactContext) else null
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
        val moduleInfo = ReactModuleInfo(
            LinkSenseModule.NAME,
            LinkSenseModule::class.java.name,
            /* canOverrideExistingModule = */ false,
            /* needsEagerInit = */ false,
            /* hasConstants = */ false,
            /* isCxxModule = */ false,
            /* isTurboModule = */ true,
        )
        mapOf(LinkSenseModule.NAME to moduleInfo)
    }
}
