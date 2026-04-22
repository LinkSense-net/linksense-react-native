// Turbo Module bridge. Generated spec header is produced by `pod install`
// (RN codegen) from `src/NativeLinkSense.ts` and lives at
// `ios/LinkSenseSpec/LinkSenseSpec.h`. We implement that protocol here
// and delegate every call to the native Swift LinkSense facade.

#import "LinkSense.h"

#if __has_include(<React-Codegen/LinkSenseSpec/LinkSenseSpec.h>)
#import <React-Codegen/LinkSenseSpec/LinkSenseSpec.h>
#elif __has_include("LinkSenseSpec/LinkSenseSpec.h")
#import "LinkSenseSpec/LinkSenseSpec.h"
#endif

#if __has_include(<LinkSense/LinkSense-Swift.h>)
#import <LinkSense/LinkSense-Swift.h>
#endif

#import <React/RCTUtils.h>

@interface LinkSenseModule : NSObject <NativeLinkSenseSpec, RCTBridgeModule>
@end

@implementation LinkSenseModule

RCT_EXPORT_MODULE(LinkSenseSpec)

+ (BOOL)requiresMainQueueSetup { return NO; }

- (NSArray<NSString *> *)supportedEvents {
    return @[@"onDeferredDeepLink"];
}

// MARK: - Turbo Module methods

- (void)configure:(JS::NativeLinkSense::SpecConfigureConfig &)config
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject {
    // Delegate to the native Swift SDK facade. When the pod is wired up
    // (LinkSense module available), this bridges directly.
#if __has_include(<LinkSense/LinkSense-Swift.h>)
    LinkSenseConfiguration *cfg = [[LinkSenseConfiguration alloc]
        initWithSdkKey:config.sdkKey()
               baseURL:config.baseUrl() ? [NSURL URLWithString:config.baseUrl()] : nil
       enableClipboard:config.enableClipboard()
              logLevel:[self mapLogLevel:config.logLevel()]];
    [[LinkSense shared] configure:cfg];
    resolve(nil);
#else
    reject(@"NOT_CONFIGURED", @"Native LinkSense SDK missing", nil);
#endif
}

- (void)start:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if __has_include(<LinkSense/LinkSense-Swift.h>)
    __weak typeof(self) weakSelf = self;
    [[LinkSense shared] onDeferredDeepLink:^(NSURL * _Nullable url) {
        [weakSelf sendEventWithName:@"onDeferredDeepLink" body:url.absoluteString ?: @""];
    }];
    [[LinkSense shared] start];
    resolve(nil);
#else
    reject(@"NOT_CONFIGURED", @"Native LinkSense SDK missing", nil);
#endif
}

- (void)createLink:(NSDictionary *)options
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject {
    // The full options↔native mapping lives in the shared Swift bridge.
    // For this file: delegate to a helper in SwiftLinkSenseRNBridge.swift
    // (to be authored alongside the Swift SDK pod).
    [self dispatchLinkOp:@"createLink" args:options resolve:resolve reject:reject];
}

- (void)getLink:(NSString *)linkId
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject {
    [self dispatchLinkOp:@"getLink" args:@{@"id": linkId} resolve:resolve reject:reject];
}

- (void)updateLink:(NSString *)linkId
           options:(NSDictionary *)options
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject {
    [self dispatchLinkOp:@"updateLink"
                    args:@{@"id": linkId, @"options": options ?: @{}}
                 resolve:resolve
                  reject:reject];
}

- (void)deleteLink:(NSString *)linkId
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject {
    [self dispatchLinkOp:@"deleteLink" args:@{@"id": linkId} resolve:resolve reject:reject];
}

// NativeEventEmitter bookkeeping — required by the TurboModule spec.
- (void)addListener:(NSString *)eventName { /* no-op */ }
- (void)removeListeners:(double)count { /* no-op */ }

// MARK: - Helpers

- (void)dispatchLinkOp:(NSString *)op
                  args:(NSDictionary *)args
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject {
    // Delegated to SwiftLinkSenseRNBridge which centralises the
    // options→Link translation logic shared with the Flutter plugin.
    // The Swift side will call `resolve` with the JSON-encoded link or
    // `reject` with the typed error code (NOT_CONFIGURED, NETWORK,
    // FORBIDDEN_CROSS_SCOPE, FORBIDDEN_FIELD, RATE_LIMITED, ...).
    [[LinkSenseRNBridge shared] dispatchOperation:op
                                         arguments:args
                                           resolve:resolve
                                            reject:reject];
}

- (long)mapLogLevel:(NSString *)raw {
    if ([raw isEqualToString:@"error"]) return 1;
    if ([raw isEqualToString:@"info"]) return 2;
    if ([raw isEqualToString:@"debug"]) return 3;
    return 0;
}

// MARK: - TurboModule

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
    return std::make_shared<facebook::react::NativeLinkSenseSpecJSI>(params);
}

@end
