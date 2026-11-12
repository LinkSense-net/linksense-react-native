import {
  CLEAR,
  type CreateLinkOptions,
  type LinkMetadataValue,
  LinkSenseError,
  type LinkSenseLink,
  type UpdateLinkOptions,
} from './types';

/**
 * Link CRUD over `/api/sdk/v1/links`. Plain HTTPS from JS, identical on both
 * platforms: these routes need only the SDK key (no device fingerprint), so
 * there is nothing for the native SDKs to add.
 */

export const BASE_URL = 'https://linksense.net';
export const SDK_VERSION = '0.2.0';

type FetchLike = typeof fetch;

export class LinkClient {
  constructor(
    private readonly sdkKey: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  create(options: CreateLinkOptions): Promise<LinkSenseLink> {
    return this.request('POST', '/api/sdk/v1/links', serializeCreateOptions(options)).then(deserializeLink);
  }

  get(id: string): Promise<LinkSenseLink> {
    return this.request('GET', linkPath(id)).then(deserializeLink);
  }

  update(id: string, options: UpdateLinkOptions): Promise<LinkSenseLink> {
    return this.request('PATCH', linkPath(id), serializeUpdateOptions(options)).then(deserializeLink);
  }

  async delete(id: string): Promise<void> {
    await this.request('DELETE', linkPath(id));
  }

  private async request(method: string, path: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.sdkKey}`,
          Accept: 'application/json',
          'X-LinkSense-SDK-Version': SDK_VERSION,
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });
    } catch (error) {
      throw new LinkSenseError('NETWORK', (error as Error).message ?? 'Network request failed');
    }

    const text = await response.text();
    let json: unknown = undefined;
    if (text.length > 0) {
      try {
        json = JSON.parse(text);
      } catch {
        if (response.ok) throw new LinkSenseError('DECODE_FAILURE', 'Response was not JSON', { status: response.status });
      }
    }

    if (!response.ok) throw toServerError(response, json);
    const data = (json as { data?: unknown } | undefined)?.data;
    return (data ?? {}) as Record<string, unknown>;
  }
}

function linkPath(id: string): string {
  return `/api/sdk/v1/links/${encodeURIComponent(id)}`;
}

/** Server envelope: `{ error: { code, message, details? } }`. `details` is a
 *  `[{field, message}]` list for validation errors, an object for plan gates. */
function toServerError(response: Response, json: unknown): LinkSenseError {
  const err = (json as { error?: { code?: unknown; message?: unknown; details?: unknown } } | undefined)?.error;
  const code = typeof err?.code === 'string' ? err.code : `HTTP_${response.status}`;
  const message = typeof err?.message === 'string' ? err.message : `HTTP ${response.status}`;
  const fieldErrors: Record<string, string> = {};
  if (Array.isArray(err?.details)) {
    for (const d of err.details as { field?: unknown; message?: unknown }[]) {
      if (typeof d?.field === 'string' && typeof d?.message === 'string' && !(d.field in fieldErrors)) {
        fieldErrors[d.field] = d.message;
      }
    }
  }
  const retryHeader = Number(response.headers.get('Retry-After'));
  return new LinkSenseError(code, message, {
    status: response.status,
    retryAfter: Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : undefined,
    fieldErrors,
  });
}

// --- Wire shapes: createDynamicLinkSdkSchema / updateDynamicLinkSdkSchema (strict) ---

export function serializeCreateOptions(options: CreateLinkOptions): Record<string, unknown> {
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

export function serializeUpdateOptions(options: UpdateLinkOptions): Record<string, unknown> {
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

/** The server returns the raw `dynamic_links` row (`social_*` columns) plus `full_url`. */
export function deserializeLink(raw: Record<string, unknown>): LinkSenseLink {
  const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  return {
    id: String(raw.id),
    projectId: String(raw.project_id),
    name: String(raw.name),
    slug: String(raw.custom_path ?? ''),
    fullUrl: String(raw.full_url),
    desktopUrl: str(raw.desktop_url),
    iosFallbackUrl: str(raw.ios_fallback_url),
    androidFallbackUrl: str(raw.android_fallback_url),
    ogTitle: str(raw.social_title ?? raw.og_title),
    ogDescription: str(raw.social_description ?? raw.og_description),
    ogImageUrl: str(raw.social_image_url ?? raw.og_image_url),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    metadata:
      raw.metadata != null && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
        ? (raw.metadata as { [key: string]: LinkMetadataValue })
        : null,
    iosClipboardEnabled: Boolean(raw.ios_clipboard_enabled ?? false),
    createdAt: String(raw.created_at),
    updatedAt: String(raw.updated_at),
  };
}
