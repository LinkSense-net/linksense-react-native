/**
 * Wire-shape tests for the JS link client. The server's link schemas are
 * `.strict()`, so a stray or renamed field is a FORBIDDEN_FIELD at runtime —
 * these catch that drift first.
 */

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo', () => ({
  NativeModule: class {},
  requireNativeModule: () => ({
    configure: jest.fn().mockResolvedValue(undefined),
    start: jest.fn().mockResolvedValue(null),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  }),
}));

import LinkSense, { CLEAR, LinkSenseError } from '../index';
import { LinkClient } from '../links';

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
  return { links: new LinkClient(KEY, fetchImpl as unknown as typeof fetch), fetchImpl };
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
    expect(init.headers['X-LinkSense-SDK-Version']).toBe('0.2.0');
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

  it('keeps the code when details is an object (plan gate)', async () => {
    const { links } = client(reply(403, { error: { code: 'ACCESS_DENIED', message: 'Pro only', details: { plan: 'starter' } } }));
    const error = await links.create({ name: 'T' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LinkSenseError);
    expect(error).toMatchObject({ code: 'ACCESS_DENIED', fieldErrors: {} });
  });

  it('reads Retry-After on 429', async () => {
    const { links } = client(reply(429, { error: { code: 'RATE_LIMITED', message: 'slow' } }, { 'Retry-After': '42' }));
    await expect(links.get('l')).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 42 });
  });

  it('wraps a failed fetch as NETWORK', async () => {
    const links = new LinkClient(KEY, jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch);
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

describe('facade', () => {
  it('rejects a malformed SDK key before touching native code', async () => {
    await expect(LinkSense.configure({ sdkKey: 'ls_sdk_nope' })).rejects.toMatchObject({ code: 'INVALID_SDK_KEY' });
  });

  it('refuses link calls before configure', () => {
    expect(() => LinkSense.getLink('l')).toThrow(LinkSenseError);
  });
});
