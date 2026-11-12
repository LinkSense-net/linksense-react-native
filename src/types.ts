/** Public types exposed by `@linksense/react-native`. */

export type LinkSenseLogLevel = 'off' | 'error' | 'info' | 'debug';

export interface LinkSenseConfiguration {
  /** Publishable SDK key, format `ls_sdk_<8 hex>_<32 hex>`. */
  sdkKey: string;
  /** iOS only: read the clipboard once on first launch (shows the iOS paste prompt). Default `false`. */
  enableClipboard?: boolean;
  /** Android only: read the Play Install Referrer. Default `true`. */
  enableInstallReferrer?: boolean;
  /** Android only: send the probabilistic fingerprint. Default `true`. */
  enableFingerprint?: boolean;
  /** Native SDK logging. Default `'off'`. */
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
  metadata: { [key: string]: LinkMetadataValue } | null;
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

/** `name`, `tags` and `iosClipboardEnabled` can be changed but not cleared. */
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

/** `LinkSenseError.code`: SDK-local codes plus every server code, verbatim. */
export type LinkSenseErrorCode =
  | 'NOT_CONFIGURED'
  | 'INVALID_SDK_KEY'
  | 'NETWORK'
  | 'DECODE_FAILURE'
  | 'UNAUTHORIZED'
  | 'AUTH_REQUIRED'
  | 'NOT_FOUND'
  | 'CUSTOM_PATH_EXISTS'
  | 'INVALID_INPUT'
  | 'FORBIDDEN_FIELD'
  | 'FORBIDDEN_CROSS_SCOPE'
  | 'ACCESS_DENIED'
  | 'RATE_LIMITED'
  | (string & {});

export class LinkSenseError extends Error {
  readonly code: LinkSenseErrorCode;
  readonly status?: number;
  readonly retryAfterSeconds?: number;
  /** For `INVALID_INPUT` / `FORBIDDEN_FIELD`: field path → message. */
  readonly fieldErrors: Record<string, string>;

  constructor(
    code: LinkSenseErrorCode,
    message: string,
    details?: { status?: number; retryAfter?: number; fieldErrors?: Record<string, string> },
  ) {
    super(message);
    this.name = 'LinkSenseError';
    this.code = code;
    this.status = details?.status;
    this.retryAfterSeconds = details?.retryAfter;
    this.fieldErrors = details?.fieldErrors ?? {};
  }
}
