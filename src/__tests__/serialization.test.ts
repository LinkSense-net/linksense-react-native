/**
 * Pure-TS tests for the wire-shape serialization helpers in `index.ts`.
 * We don't exercise the Turbo Module itself here — that needs a real
 * React Native environment. This file catches drift in the
 * strict-schema field allowlist before it becomes FORBIDDEN_FIELD at
 * runtime.
 */

jest.mock('react-native', () => ({
  NativeEventEmitter: jest.fn(),
  NativeModules: { LinkSenseSpec: {} },
  TurboModuleRegistry: {
    getEnforcing: jest.fn(() => ({
      configure: jest.fn(),
      start: jest.fn(),
      createLink: jest.fn(),
      getLink: jest.fn(),
      updateLink: jest.fn(),
      deleteLink: jest.fn(),
      addListener: jest.fn(),
      removeListeners: jest.fn(),
    })),
  },
}));

import NativeLinkSense from '../NativeLinkSense';
import LinkSense, { CLEAR, LinkSenseError } from '../index';

describe('createLink serialization', () => {
  afterEach(() => jest.clearAllMocks());

  it('sends the allowlist and omits null/undefined fields', async () => {
    (NativeLinkSense.createLink as jest.Mock).mockResolvedValue({
      id: 'l', project_id: 'p', name: 'n', custom_path: 's',
      full_url: 'u', created_at: 'c', updated_at: 'u',
    });
    await LinkSense.createLink({ name: 'Maria invite', slug: 'maria', tags: ['launch'] });
    const args = (NativeLinkSense.createLink as jest.Mock).mock.calls[0]![0];
    expect(args).toEqual({
      name: 'Maria invite',
      slug: 'maria',
      tags: ['launch'],
    });
  });

  it('forwards metadata as a nested object', async () => {
    (NativeLinkSense.createLink as jest.Mock).mockResolvedValue({
      id: 'l', project_id: 'p', name: 'n', custom_path: 's',
      full_url: 'u', created_at: 'c', updated_at: 'u',
    });
    await LinkSense.createLink({
      name: 'Test',
      metadata: { campaign: 'spring-2026', lifetime: 86400, enabled: true },
    });
    const args = (NativeLinkSense.createLink as jest.Mock).mock.calls[0]![0];
    expect(args.metadata).toEqual({ campaign: 'spring-2026', lifetime: 86400, enabled: true });
  });
});

describe('updateLink serialization', () => {
  afterEach(() => jest.clearAllMocks());

  it('distinguishes absent (omit) from CLEAR (send null)', async () => {
    (NativeLinkSense.updateLink as jest.Mock).mockResolvedValue({
      id: 'l', project_id: 'p', name: 'n', custom_path: 's',
      full_url: 'u', created_at: 'c', updated_at: 'u',
    });
    await LinkSense.updateLink('l', { name: 'renamed', desktopUrl: CLEAR });
    const [, options] = (NativeLinkSense.updateLink as jest.Mock).mock.calls[0]!;
    expect(options).toEqual({ name: 'renamed', desktop_url: null });
    expect('tags' in options).toBe(false);
  });

  it('sets concrete values straight through', async () => {
    (NativeLinkSense.updateLink as jest.Mock).mockResolvedValue({
      id: 'l', project_id: 'p', name: 'n', custom_path: 's',
      full_url: 'u', created_at: 'c', updated_at: 'u',
    });
    await LinkSense.updateLink('l', { iosFallbackUrl: 'https://acme.com/ios', tags: ['launch'] });
    const [, options] = (NativeLinkSense.updateLink as jest.Mock).mock.calls[0]!;
    expect(options).toEqual({ ios_fallback_url: 'https://acme.com/ios', tags: ['launch'] });
  });
});

describe('error translation', () => {
  afterEach(() => jest.clearAllMocks());

  it('wraps native rejections as typed LinkSenseError', async () => {
    (NativeLinkSense.getLink as jest.Mock).mockRejectedValue({
      code: 'FORBIDDEN_CROSS_SCOPE',
      message: 'nope',
    });
    await expect(LinkSense.getLink('l')).rejects.toBeInstanceOf(LinkSenseError);
    try {
      await LinkSense.getLink('l');
    } catch (e) {
      expect((e as LinkSenseError).code).toBe('FORBIDDEN_CROSS_SCOPE');
    }
  });

  it('extracts retryAfter from userInfo', async () => {
    (NativeLinkSense.getLink as jest.Mock).mockRejectedValue({
      code: 'RATE_LIMITED',
      message: 'slow',
      userInfo: { retryAfter: 42 },
    });
    try {
      await LinkSense.getLink('l');
      fail('expected rejection');
    } catch (e) {
      expect((e as LinkSenseError).retryAfterSeconds).toBe(42);
    }
  });
});

describe('deserialization', () => {
  afterEach(() => jest.clearAllMocks());

  it('maps snake_case wire fields to camelCase public types', async () => {
    (NativeLinkSense.getLink as jest.Mock).mockResolvedValue({
      id: 'link-1',
      project_id: 'project-1',
      name: 'Maria',
      custom_path: 'maria',
      full_url: 'https://acme-42.linksense.net/maria',
      desktop_url: null,
      ios_fallback_url: 'https://acme.com/ios',
      android_fallback_url: null,
      og_title: 'Meet Maria',
      og_description: null,
      og_image_url: null,
      tags: ['launch'],
      ios_clipboard_enabled: true,
      created_at: '2026-04-21T10:00:00Z',
      updated_at: '2026-04-21T10:00:00Z',
    });
    const link = await LinkSense.getLink('link-1');
    expect(link.id).toBe('link-1');
    expect(link.projectId).toBe('project-1');
    expect(link.slug).toBe('maria');
    expect(link.fullUrl).toBe('https://acme-42.linksense.net/maria');
    expect(link.iosFallbackUrl).toBe('https://acme.com/ios');
    expect(link.ogTitle).toBe('Meet Maria');
    expect(link.tags).toEqual(['launch']);
    expect(link.iosClipboardEnabled).toBe(true);
  });
});
