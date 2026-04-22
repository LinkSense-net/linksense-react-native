/**
 * Public types exposed by `@linksense/react-native`. Strict TS on this
 * side; the Turbo Module spec uses wider `Object` types to satisfy
 * codegen constraints.
 */

export type LinkSenseLogLevel = 'off' | 'error' | 'info' | 'debug';

export interface LinkSenseConfiguration {
  /** Publishable SDK key, format `ls_sdk_<project>_<random>`. */
  sdkKey: string;
  /** Base URL override. Defaults to `https://linksense.net`. */
  baseUrl?: string;
  /** iOS only: opt-in clipboard read on first launch. Default `false`. */
  enableClipboard?: boolean;
  /** Android only: read Play Install Referrer. Default `true`. */
  enableInstallReferrer?: boolean;
  /** Enable probabilistic fingerprint fallback. Default `true`. */
  enableFingerprint?: boolean;
  /** Default `'off'`. Keep off for production ship. */
  logLevel?: LinkSenseLogLevel;
}

export interface LinkSenseLink {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  fullUrl: string;
  desktopUrl: string | null;
  iosFallbackUrl: string | null;
  androidFallbackUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  tags: string[];
  iosClipboardEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LinkMetadataValue =
  | string
  | number
  | boolean
  | null
  | LinkMetadataValue[]
  | { [key: string]: LinkMetadataValue };

export interface CreateLinkOptions {
  name: string;
  desktopUrl?: string;
  slug?: string;
  tags?: string[];
  metadata?: { [key: string]: LinkMetadataValue };
  iosClipboardEnabled?: boolean;
  iosFallbackUrl?: string;
  androidFallbackUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
}

/** Sentinel for `updateLink` — "send JSON null to clear this field".
 *  `undefined` is "don't send"; any concrete value is "set to this". */
export const CLEAR: unique symbol = Symbol('LinkSense.CLEAR');
export type LinkSenseClear = typeof CLEAR;

export interface UpdateLinkOptions {
  name?: string;
  desktopUrl?: string | LinkSenseClear;
  tags?: string[];
  metadata?: { [key: string]: LinkMetadataValue } | LinkSenseClear;
  iosClipboardEnabled?: boolean;
  iosFallbackUrl?: string | LinkSenseClear;
  androidFallbackUrl?: string | LinkSenseClear;
  ogTitle?: string | LinkSenseClear;
  ogDescription?: string | LinkSenseClear;
  ogImageUrl?: string | LinkSenseClear;
}

/** Error codes surfaced via `LinkSenseError.code`. Mirror the server-
 *  side error envelope plus a handful of plugin-local codes. */
export type LinkSenseErrorCode =
  | 'NOT_CONFIGURED'
  | 'INVALID_SDK_KEY'
  | 'NETWORK'
  | 'FORBIDDEN_CROSS_SCOPE'
  | 'FORBIDDEN_FIELD'
  | 'RATE_LIMITED'
  | 'DECODE_FAILURE'
  | string; // server codes pass through verbatim

export class LinkSenseError extends Error {
  readonly code: LinkSenseErrorCode;
  readonly status?: number;
  readonly retryAfterSeconds?: number;

  constructor(code: LinkSenseErrorCode, message: string, details?: { status?: number; retryAfter?: number }) {
    super(message);
    this.name = 'LinkSenseError';
    this.code = code;
    this.status = details?.status;
    this.retryAfterSeconds = details?.retryAfter;
  }
}
