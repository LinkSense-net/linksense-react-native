import { Platform } from 'react-native';

import NativeLinkSense from './LinkSenseModule';
import { LinkClient } from './links';
import {
  type CreateLinkOptions,
  type LinkSenseConfiguration,
  LinkSenseError,
  type LinkSenseLink,
  type UpdateLinkOptions,
} from './types';

export * from './types';

const SDK_KEY_PATTERN = /^ls_sdk_[0-9a-f]{8}_[0-9a-f]{32}$/;

/**
 * LinkSense for Expo / React Native.
 *
 *     await LinkSense.configure({ sdkKey: 'ls_sdk_…' });
 *     const deepLink = await LinkSense.start(); // deferred deep link, or null
 *
 * Universal Links / App Links are observed natively (no AppDelegate or
 * MainActivity edits): each open is reported to LinkSense. Keep routing them
 * with Expo Router / `expo-linking` as usual.
 */
class LinkSense {
  private links: LinkClient | null = null;
  private startPromise: Promise<string | null> | null = null;

  async configure(configuration: LinkSenseConfiguration): Promise<void> {
    if (!SDK_KEY_PATTERN.test(configuration.sdkKey)) {
      throw new LinkSenseError('INVALID_SDK_KEY', 'SDK key must look like ls_sdk_<8 hex>_<32 hex>');
    }
    const logLevel = configuration.logLevel ?? 'off';
    try {
      if (Platform.OS === 'ios') {
        await NativeLinkSense.configure(configuration.sdkKey, configuration.enableClipboard ?? false, logLevel);
      } else {
        await NativeLinkSense.configure(
          configuration.sdkKey,
          configuration.enableInstallReferrer ?? true,
          configuration.enableFingerprint ?? true,
          logLevel,
        );
      }
    } catch (error) {
      throw toLinkSenseError(error);
    }
    this.links = new LinkClient(configuration.sdkKey, NativeLinkSense.baseUrl);
  }

  /**
   * Report the install (first launch only) and resolve with the deferred deep
   * link that brought the user here, or `null`. Call once per launch, after
   * `configure`; repeated calls return the same promise.
   */
  start(): Promise<string | null> {
    if (this.startPromise == null) {
      this.startPromise = NativeLinkSense.start().catch((error: unknown) => {
        this.startPromise = null;
        throw toLinkSenseError(error);
      });
    }
    return this.startPromise;
  }

  /**
   * Fires when a Universal Link / App Link opened the app, with the URL
   * LinkSense resolved for it (on the very first launch this can be the
   * matched deferred link rather than the tapped URL). Returns an unsubscribe.
   */
  onDeepLink(listener: (url: string | null) => void): () => void {
    const subscription = NativeLinkSense.addListener('onDeepLink', event => listener(event.url ?? null));
    return () => subscription.remove();
  }

  /**
   * iOS 16+: attribute from a link the user pasted (your own paste UI), with
   * no system paste prompt. Resolves with the matched deep link, or `null`.
   * Always `null` on Android, where the Play Install Referrer covers this.
   */
  async submitPastedLink(text: string): Promise<string | null> {
    try {
      return await NativeLinkSense.submitPastedLink(text);
    } catch (error) {
      throw toLinkSenseError(error);
    }
  }

  createLink(options: CreateLinkOptions): Promise<LinkSenseLink> {
    return this.requireLinks().create(options);
  }

  getLink(id: string): Promise<LinkSenseLink> {
    return this.requireLinks().get(id);
  }

  updateLink(id: string, options: UpdateLinkOptions): Promise<LinkSenseLink> {
    return this.requireLinks().update(id, options);
  }

  deleteLink(id: string): Promise<void> {
    return this.requireLinks().delete(id);
  }

  private requireLinks(): LinkClient {
    if (this.links == null) throw new LinkSenseError('NOT_CONFIGURED', 'Call configure() first');
    return this.links;
  }
}

export default new LinkSense();

function toLinkSenseError(error: unknown): LinkSenseError {
  if (error instanceof LinkSenseError) return error;
  const err = error as { code?: unknown; message?: unknown } | null;
  const code = typeof err?.code === 'string' ? err.code : 'UNKNOWN';
  const message = typeof err?.message === 'string' ? err.message : String(error);
  return new LinkSenseError(code, message);
}
