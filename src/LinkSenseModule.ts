import { NativeModule, requireNativeModule } from 'expo';

export type LinkSenseModuleEvents = {
  onDeepLink: (event: { url: string | null }) => void;
};

declare class LinkSenseNativeModule extends NativeModule<LinkSenseModuleEvents> {
  /** iOS signature. */
  configure(sdkKey: string, enableClipboard: boolean, logLevel: string): Promise<void>;
  /** Android signature. */
  configure(sdkKey: string, enableInstallReferrer: boolean, enableFingerprint: boolean, logLevel: string): Promise<void>;
  start(): Promise<string | null>;
  /** Always resolves `null` on Android. */
  submitPastedLink(text: string): Promise<string | null>;
  /** API host the native SDK was built against. Absent on pre-0.3.0 native code. */
  readonly baseUrl?: string;
}

export default requireNativeModule<LinkSenseNativeModule>('LinkSense');
