import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * React Native Turbo Module spec — codegen reads this file to emit the
 * native protocol definitions (`LinkSenseSpec.h` on iOS and the Kotlin
 * spec under `android/.../specs/` during a regular `pod install` /
 * Gradle sync).
 *
 * Keep every method signature in sync with the method-channel names on
 * the Flutter side (`net.linksense.flutter/method`) — the wire contract
 * is identical, only the transport changes.
 *
 * Important codegen constraints:
 *   * Only primitives / structural objects / arrays / `Promise<...>`
 *     types are allowed. We use broad `Object` / `Object[]` types where
 *     the server response is effectively arbitrary JSON — strict types
 *     live on the TS facade side (`src/index.ts`).
 *   * Deferred deep links go through the NativeEventEmitter channel
 *     `onDeferredDeepLink` rather than being a spec method — Turbo
 *     Modules support event emission via `addListener` / `removeListeners`.
 */
export interface Spec extends TurboModule {
  configure(config: {
    sdkKey: string;
    baseUrl?: string;
    enableClipboard?: boolean;
    enableInstallReferrer?: boolean;
    enableFingerprint?: boolean;
    logLevel?: string;
  }): Promise<void>;

  start(): Promise<void>;

  createLink(options: Object): Promise<Object>;
  getLink(id: string): Promise<Object>;
  updateLink(id: string, options: Object): Promise<Object>;
  deleteLink(id: string): Promise<void>;

  /** NativeEventEmitter bookkeeping — required by TurboModule spec even
   *  when we only emit from the native side. */
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('LinkSenseSpec');
