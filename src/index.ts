import { NativeEventEmitter, NativeModules } from 'react-native';

import NativeLinkSense from './NativeLinkSense';
import {
  CLEAR,
  type CreateLinkOptions,
  type LinkMetadataValue,
  type LinkSenseConfiguration,
  LinkSenseError,
  type LinkSenseErrorCode,
  type LinkSenseLink,
  type UpdateLinkOptions,
} from './types';

export * from './types';

/**
 * Public TS facade. Thin wrapper around the Turbo Module spec — we
 * translate our strongly-typed options into the loose `Object` shape
 * the codegen tolerates, and translate native errors into the typed
 * [LinkSenseError] subclass.
 */
class LinkSense {
  private emitter: NativeEventEmitter | null = null;
  private started = false;

  async configure(configuration: LinkSenseConfiguration): Promise<void> {
    try {
      await NativeLinkSense.configure({
        sdkKey: configuration.sdkKey,
        baseUrl: configuration.baseUrl,
        enableClipboard: configuration.enableClipboard ?? false,
        enableInstallReferrer: configuration.enableInstallReferrer ?? true,
        enableFingerprint: configuration.enableFingerprint ?? true,
        logLevel: configuration.logLevel ?? 'off',
      });
    } catch (error) {
      throw toLinkSenseError(error);
    }
  }

  async start(): Promise<void> {
    if (this.started) return;
    try {
      await NativeLinkSense.start();
      this.started = true;
    } catch (error) {
      throw toLinkSenseError(error);
    }
  }

  /**
   * Subscribe to deferred deep links. Returns an unsubscribe function.
   * Typical pattern:
   *
   *     const unsubscribe = LinkSense.onDeferredDeepLink(url => { ... });
   *     // later: unsubscribe();
   */
  onDeferredDeepLink(listener: (url: string | null) => void): () => void {
    if (this.emitter == null) {
      // NativeEventEmitter reads `addListener`/`removeListeners` off the
      // native module for Turbo Modules — the spec surfaces those.
      const nativeModule = (NativeLinkSense as unknown) || NativeModules.LinkSenseSpec;
      // NativeEventEmitter's constructor param is minimally typed — the
      // RN d.ts is `NativeModule | undefined` but accepts any object
      // with `addListener`/`removeListeners`. Cast via `unknown` so we
      // don't introduce an unnecessary `any`.
      this.emitter = new NativeEventEmitter(nativeModule as unknown as never);
    }
    const subscription = this.emitter.addListener('onDeferredDeepLink', (raw: string) => {
      listener(raw != null && raw.length > 0 ? raw : null);
    });
    return () => subscription.remove();
  }

  async createLink(options: CreateLinkOptions): Promise<LinkSenseLink> {
    try {
      const raw = await NativeLinkSense.createLink(serializeCreateOptions(options));
      return deserializeLink(raw as Record<string, unknown>);
    } catch (error) {
      throw toLinkSenseError(error);
    }
  }

  async getLink(id: string): Promise<LinkSenseLink> {
    try {
      const raw = await NativeLinkSense.getLink(id);
      return deserializeLink(raw as Record<string, unknown>);
    } catch (error) {
      throw toLinkSenseError(error);
    }
  }

  async updateLink(id: string, options: UpdateLinkOptions): Promise<LinkSenseLink> {
    try {
      const raw = await NativeLinkSense.updateLink(id, serializeUpdateOptions(options));
      return deserializeLink(raw as Record<string, unknown>);
    } catch (error) {
      throw toLinkSenseError(error);
    }
  }

  async deleteLink(id: string): Promise<void> {
    try {
      await NativeLinkSense.deleteLink(id);
    } catch (error) {
      throw toLinkSenseError(error);
    }
  }
}

export default new LinkSense();

// --- Serialization helpers ---

function serializeCreateOptions(options: CreateLinkOptions): Record<string, unknown> {
  const out: Record<string, unknown> = { name: options.name };
  if (options.desktopUrl != null) out.desktop_url = options.desktopUrl;
  if (options.slug != null) out.slug = options.slug;
  if (options.tags != null) out.tags = options.tags;
  if (options.metadata != null) out.metadata = options.metadata as Record<string, LinkMetadataValue>;
  if (options.iosClipboardEnabled != null) out.ios_clipboard_enabled = options.iosClipboardEnabled;
  if (options.iosFallbackUrl != null) out.ios_fallback_url = options.iosFallbackUrl;
  if (options.androidFallbackUrl != null) out.android_fallback_url = options.androidFallbackUrl;
  if (options.ogTitle != null) out.og_title = options.ogTitle;
  if (options.ogDescription != null) out.og_description = options.ogDescription;
  if (options.ogImageUrl != null) out.og_image_url = options.ogImageUrl;
  return out;
}

function serializeUpdateOptions(options: UpdateLinkOptions): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (options.name !== undefined) out.name = options.name;
  putWithClear(out, 'desktop_url', options.desktopUrl);
  if (options.tags !== undefined) out.tags = options.tags;
  putWithClear(out, 'metadata', options.metadata);
  if (options.iosClipboardEnabled !== undefined) out.ios_clipboard_enabled = options.iosClipboardEnabled;
  putWithClear(out, 'ios_fallback_url', options.iosFallbackUrl);
  putWithClear(out, 'android_fallback_url', options.androidFallbackUrl);
  putWithClear(out, 'og_title', options.ogTitle);
  putWithClear(out, 'og_description', options.ogDescription);
  putWithClear(out, 'og_image_url', options.ogImageUrl);
  return out;
}

function putWithClear(out: Record<string, unknown>, key: string, value: unknown): void {
  if (value === undefined) return;
  out[key] = value === CLEAR ? null : value;
}

function deserializeLink(raw: Record<string, unknown>): LinkSenseLink {
  return {
    id: String(raw.id),
    projectId: String(raw.project_id),
    name: String(raw.name),
    slug: String(raw.custom_path ?? raw.slug ?? ''),
    fullUrl: String(raw.full_url),
    desktopUrl: (raw.desktop_url as string | null) ?? null,
    iosFallbackUrl: (raw.ios_fallback_url as string | null) ?? null,
    androidFallbackUrl: (raw.android_fallback_url as string | null) ?? null,
    ogTitle: (raw.og_title as string | null) ?? (raw.social_title as string | null) ?? null,
    ogDescription: (raw.og_description as string | null) ?? (raw.social_description as string | null) ?? null,
    ogImageUrl: (raw.og_image_url as string | null) ?? (raw.social_image_url as string | null) ?? null,
    tags: Array.isArray(raw.tags) ? (raw.tags as unknown[]).map(String) : [],
    iosClipboardEnabled: Boolean(raw.ios_clipboard_enabled ?? false),
    createdAt: String(raw.created_at),
    updatedAt: String(raw.updated_at),
  };
}

function toLinkSenseError(error: unknown): LinkSenseError {
  if (error instanceof LinkSenseError) return error;
  const err = error as { code?: string; message?: string; userInfo?: Record<string, unknown> };
  const code = (err?.code as LinkSenseErrorCode) ?? 'UNKNOWN';
  const message = err?.message ?? String(error);
  const userInfo = err?.userInfo ?? {};
  const status = typeof userInfo.status === 'number' ? userInfo.status : undefined;
  const retryAfter = typeof userInfo.retryAfter === 'number' ? userInfo.retryAfter : undefined;
  return new LinkSenseError(code, message, { status, retryAfter });
}
