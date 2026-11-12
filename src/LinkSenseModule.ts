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
  /** iOS only. */
  submitPastedLink?(text: string): Promise<string | null>;
}

export default requireNativeModule<LinkSenseNativeModule>('LinkSense');
