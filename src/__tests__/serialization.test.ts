/**
 * Wire-shape tests for the JS link client. The server's link schemas are
 * `.strict()`, so a stray or renamed field is a FORBIDDEN_FIELD at runtime —
 * these catch that drift first.
 */

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
const mockNative = {
  configure: jest.fn().mockResolvedValue(undefined),
  start: jest.fn().mockResolvedValue(null),
  submitPastedLink: jest.fn().mockResolvedValue('https://acme.com/maria'),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  baseUrl: undefined as string | undefined,
};
jest.mock('expo', () => ({
  NativeModule: class {},
  requireNativeModule: () => mockNative,
}));

import LinkSense, { CLEAR, LinkSenseError } from '../index';
import { DEFAULT_BASE_URL, LinkClient } from '../links';

const KEY = 'ls_sdk_0123abcd_0123456789abcdef0123456789abcdef';
const ROW = {
  id: 'link-1',
  project_id: 'project-1',
  name: 'Maria',
  custom_path: 'maria',
  full_url: 'https://acme-42.linksense.net/maria',
  desktop_url: null,
  ios_fallback_url: 'https://acme.com/ios',
  android_fallback_url: null,
  social_title: 'Meet Maria',
  social_description: null,
  social_image_url: null,
  tags: ['launch'],
  metadata: { campaign: 'spring' },
  ios_clipboard_enabled: true,
  created_at: '2026-04-21T10:00:00Z',
  updated_at: '2026-04-21T10:00:00Z',
};

function reply(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name] ?? null },
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

function client(response: Response) {
  const fetchImpl = jest.fn().mockResolvedValue(response);
  return { links: new LinkClient(KEY, DEFAULT_BASE_URL, fetchImpl as unknown as typeof fetch), fetchImpl };
}

function sentBody(fetchImpl: jest.Mock): Record<string, unknown> {
  return JSON.parse(fetchImpl.mock.calls[0]![1].body as string);
}

describe('createLink', () => {
  it('sends the allowlist and omits null/undefined fields', async () => {
    const { links, fetchImpl } = client(reply(201, { data: ROW }));
    await links.create({ name: 'Maria invite', slug: 'maria', tags: ['launch'] });
    expect(sentBody(fetchImpl)).toEqual({ name: 'Maria invite', slug: 'maria', tags: ['launch'] });
  });

  it('forwards metadata, arrays included', async () => {
    const { links, fetchImpl } = client(reply(201, { data: ROW }));
    await links.create({ name: 'T', metadata: { campaign: 'spring', ids: [1, 2], on: true } });
    expect(sentBody(fetchImpl).metadata).toEqual({ campaign: 'spring', ids: [1, 2], on: true });
  });

  it('authenticates against production with the SDK headers', async () => {
    const { links, fetchImpl } = client(reply(201, { data: ROW }));
    await links.create({ name: 'T' });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://linksense.net/api/sdk/v1/links');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(init.headers['X-LinkSense-SDK-Version']).toBe('0.3.0');
  });
});

describe('updateLink', () => {
  it('distinguishes absent (omit) from CLEAR (send null)', async () => {
    const { links, fetchImpl } = client(reply(200, { data: ROW }));
    await links.update('l', { name: 'renamed', desktopUrl: CLEAR });
    expect(sentBody(fetchImpl)).toEqual({ name: 'renamed', desktop_url: null });
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://linksense.net/api/sdk/v1/links/l');
    expect(fetchImpl.mock.calls[0]![1].method).toBe('PATCH');
  });
});

describe('deleteLink', () => {
  it('accepts an empty 204 body', async () => {
    const { links, fetchImpl } = client(reply(204, undefined));
    await expect(links.delete('l')).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls[0]![1].method).toBe('DELETE');
  });
});

describe('errors', () => {
  it('maps details[] to fieldErrors', async () => {
    const { links } = client(
      reply(400, { error: { code: 'INVALID_INPUT', message: 'Validation failed', details: [{ field: 'slug', message: 'bad' }] } }),
    );
    await expect(links.create({ name: 'T' })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      status: 400,
      fieldErrors: { slug: 'bad' },
    });
  });

  async function errorFor(status: number, code: string, details?: unknown): Promise<LinkSenseError> {
    const { links } = client(reply(status, { error: { code, message: 'nope', ...(details !== undefined && { details }) } }));
    const error = await links.create({ name: 'T' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LinkSenseError);
    return error as LinkSenseError;
  }

  it('normalizes AUTH_REQUIRED to UNAUTHORIZED', async () => {
    expect((await errorFor(401, 'AUTH_REQUIRED')).code).toBe('UNAUTHORIZED');
    expect((await errorFor(401, 'UNAUTHORIZED')).code).toBe('UNAUTHORIZED');
  });

  it('normalizes CUSTOM_PATH_EXISTS and SLUG_EXISTS to SLUG_EXISTS', async () => {
    expect((await errorFor(409, 'CUSTOM_PATH_EXISTS')).code).toBe('SLUG_EXISTS');
    expect((await errorFor(409, 'SLUG_EXISTS')).code).toBe('SLUG_EXISTS');
  });

  it('parses full ACCESS_DENIED details (quota reached)', async () => {
    const error = await errorFor(403, 'ACCESS_DENIED', { upgradeRequired: true, plan: 'starter', currentUsage: 50, limit: 50 });
    expect(error.code).toBe('ACCESS_DENIED');
    expect(error.fieldErrors).toEqual({});
    expect(error.accessDenied).toEqual({ serverMessage: 'nope', upgradeRequired: true, plan: 'starter', currentUsage: 50, limit: 50 });
  });

  it('parses partial ACCESS_DENIED details (no plan)', async () => {
    const error = await errorFor(403, 'ACCESS_DENIED', { upgradeRequired: true, plan: 'none' });
    expect(error.accessDenied).toEqual({ serverMessage: 'nope', upgradeRequired: true, plan: 'none' });
  });

  it('parses ACCESS_DENIED without details (platform not allowed)', async () => {
    const error = await errorFor(403, 'ACCESS_DENIED');
    expect(error.accessDenied).toEqual({ serverMessage: 'nope', upgradeRequired: false });
  });

  it('sets accessDenied only for ACCESS_DENIED', async () => {
    expect((await errorFor(404, 'NOT_FOUND')).accessDenied).toBeUndefined();
  });

  it('reads Retry-After on 429', async () => {
    const { links } = client(reply(429, { error: { code: 'RATE_LIMITED', message: 'slow' } }, { 'Retry-After': '42' }));
    await expect(links.get('l')).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 42 });
  });

  it('wraps a failed fetch as NETWORK', async () => {
    const links = new LinkClient(KEY, DEFAULT_BASE_URL, jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch);
    await expect(links.get('l')).rejects.toMatchObject({ code: 'NETWORK' });
  });
});

describe('deserialization', () => {
  it('maps the raw dynamic_links row to the public type', async () => {
    const { links } = client(reply(200, { data: ROW }));
    const link = await links.get('link-1');
    expect(link).toMatchObject({
      id: 'link-1',
      projectId: 'project-1',
      slug: 'maria',
      fullUrl: 'https://acme-42.linksense.net/maria',
      iosFallbackUrl: 'https://acme.com/ios',
      ogTitle: 'Meet Maria',
      tags: ['launch'],
      metadata: { campaign: 'spring' },
      iosClipboardEnabled: true,
    });
  });
});

describe('base URL', () => {
  it('uses the given base URL', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(200, { data: ROW }));
    await new LinkClient(KEY, 'https://linksense-staging.net/', fetchImpl as unknown as typeof fetch).get('l');
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://linksense-staging.net/api/sdk/v1/links/l');
  });
});

describe('facade', () => {
  afterEach(() => {
    mockNative.baseUrl = undefined;
    jest.restoreAllMocks();
  });

  async function configuredFetchUrl(): Promise<string> {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(reply(200, { data: ROW }));
    await LinkSense.configure({ sdkKey: KEY });
    await LinkSense.getLink('l');
    return fetchSpy.mock.calls[0]![0] as string;
  }

  // Must run before any successful configure(): the facade is a singleton.
  it('refuses link calls before configure', () => {
    expect(() => LinkSense.getLink('l')).toThrow(LinkSenseError);
  });

  it('rejects a malformed SDK key before touching native code', async () => {
    mockNative.configure.mockClear();
    await expect(LinkSense.configure({ sdkKey: 'ls_sdk_nope' })).rejects.toMatchObject({ code: 'INVALID_SDK_KEY' });
    expect(mockNative.configure).not.toHaveBeenCalled();
  });

  it('maps a native INVALID_SDK_KEY rejection to LinkSenseError', async () => {
    mockNative.configure.mockRejectedValueOnce(Object.assign(new Error('SDK key format is invalid.'), { code: 'INVALID_SDK_KEY' }));
    const error = await LinkSense.configure({ sdkKey: KEY }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LinkSenseError);
    expect(error).toMatchObject({ code: 'INVALID_SDK_KEY' });
  });

  it('sends link CRUD to the native baseUrl constant', async () => {
    mockNative.baseUrl = 'https://linksense-staging.net';
    expect(await configuredFetchUrl()).toBe('https://linksense-staging.net/api/sdk/v1/links/l');
  });

  it('falls back to production when native exports no baseUrl', async () => {
    expect(await configuredFetchUrl()).toBe('https://linksense.net/api/sdk/v1/links/l');
  });

  it('delegates submitPastedLink to native', async () => {
    await expect(LinkSense.submitPastedLink('https://acme-42.linksense.net/maria')).resolves.toBe('https://acme.com/maria');
    expect(mockNative.submitPastedLink).toHaveBeenCalledWith('https://acme-42.linksense.net/maria');
  });

});
