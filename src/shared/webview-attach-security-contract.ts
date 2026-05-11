export const TAHAI_WEBVIEW_ATTACH_SECURITY_PASS = 'PASS153' as const;

export const TAHAI_WEBVIEW_ATTACH_POLICY = 'main-process-owned-popup-and-attach-boundary' as const;
export const TAHAI_DEFAULT_WEBVIEW_PARTITION = 'persist:tahai-profile-default' as const;
export const TAHAI_TRUSTED_WEBVIEW_PARTITION_PREFIX = 'persist:tahai-profile-' as const;

export const TAHAI_WEBVIEW_ATTACH_STRIPPED_PARAM_KEYS = Object.freeze([
  'allowpopups',
  'preload',
  'nodeintegration',
  'disablewebsecurity',
  'webpreferences'
] as const);

export const TAHAI_WEBVIEW_ATTACH_STRIPPED_WEBPREFERENCE_KEYS = Object.freeze([
  'preload',
  'nodeIntegrationInWorker',
  'nodeIntegrationInSubFrames',
  'enableRemoteModule',
  'disableBlinkFeatures'
] as const);

export type TahaiWebviewAttachRecord = Record<string, unknown>;

export type TahaiWebviewAttachDecision = {
  ok: boolean;
  sourceUrl: string;
  sanitizedPartition: string;
  strippedParams: string[];
  strippedWebPreferences: string[];
  blockedReasons: string[];
};

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isTrustedTahaiWebviewPartition(value: unknown): boolean {
  const partition = cleanString(value);
  return /^persist:tahai-profile-[a-zA-Z0-9_-]{1,80}$/.test(partition);
}

export function sanitizeTahaiWebviewPartition(value: unknown): string {
  const partition = cleanString(value);
  return isTrustedTahaiWebviewPartition(partition) ? partition : TAHAI_DEFAULT_WEBVIEW_PARTITION;
}

export function isTrustedTahaiWebviewAttachSource(value: unknown, trustedLocalUrls: readonly string[] = []): boolean {
  const sourceUrl = cleanString(value);
  if (!sourceUrl) return false;
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return false;
  }

  if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return true;
  if (parsed.protocol === 'file:') {
    return trustedLocalUrls.some((trusted) => sourceUrl === trusted || sourceUrl.startsWith(`${trusted}?`) || sourceUrl.startsWith(`${trusted}#`));
  }
  return false;
}

export function hardenWebviewAttachOptions(
  webPreferences: TahaiWebviewAttachRecord,
  params: TahaiWebviewAttachRecord,
  trustedLocalUrls: readonly string[] = []
): TahaiWebviewAttachDecision {
  const strippedParams: string[] = [];
  const strippedWebPreferences: string[] = [];
  const blockedReasons: string[] = [];
  const sourceUrl = cleanString(params.src);

  if (!isTrustedTahaiWebviewAttachSource(sourceUrl, trustedLocalUrls)) {
    blockedReasons.push('blocked-untrusted-webview-src');
  }

  const originalPartition = cleanString(params.partition);
  const sanitizedPartition = sanitizeTahaiWebviewPartition(originalPartition);
  if (originalPartition && originalPartition !== sanitizedPartition) {
    blockedReasons.push('sanitized-untrusted-webview-partition');
  }
  params.partition = sanitizedPartition;

  for (const key of TAHAI_WEBVIEW_ATTACH_STRIPPED_PARAM_KEYS) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      delete params[key];
      strippedParams.push(key);
    }
  }

  for (const key of TAHAI_WEBVIEW_ATTACH_STRIPPED_WEBPREFERENCE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(webPreferences, key)) {
      delete webPreferences[key];
      strippedWebPreferences.push(key);
    }
  }

  webPreferences.contextIsolation = true;
  webPreferences.nodeIntegration = false;
  webPreferences.sandbox = true;
  webPreferences.webSecurity = true;
  webPreferences.allowRunningInsecureContent = false;
  webPreferences.devTools = true;
  webPreferences.spellcheck = true;

  if (webPreferences.nodeIntegration === true) blockedReasons.push('blocked-nodeintegration');
  if (webPreferences.contextIsolation === false) blockedReasons.push('blocked-contextisolation-disabled');
  if (webPreferences.sandbox === false) blockedReasons.push('blocked-sandbox-disabled');
  if (webPreferences.webSecurity === false) blockedReasons.push('blocked-websecurity-disabled');
  if (webPreferences.allowRunningInsecureContent === true) blockedReasons.push('blocked-insecure-content');

  const fatalReasons = blockedReasons.filter((reason) => reason === 'blocked-untrusted-webview-src');
  return {
    ok: fatalReasons.length === 0,
    sourceUrl,
    sanitizedPartition,
    strippedParams,
    strippedWebPreferences,
    blockedReasons
  };
}

export function webviewAttachSecuritySummary(): string[] {
  return [
    `pass=${TAHAI_WEBVIEW_ATTACH_SECURITY_PASS}`,
    `policy=${TAHAI_WEBVIEW_ATTACH_POLICY}`,
    `partitionPrefix=${TAHAI_TRUSTED_WEBVIEW_PARTITION_PREFIX}`,
    `defaultPartition=${TAHAI_DEFAULT_WEBVIEW_PARTITION}`,
    `strippedParams=${TAHAI_WEBVIEW_ATTACH_STRIPPED_PARAM_KEYS.join(',')}`,
    `strippedWebPreferences=${TAHAI_WEBVIEW_ATTACH_STRIPPED_WEBPREFERENCE_KEYS.join(',')}`,
    'popupDefault=deny',
    'rendererWebviews=popupAttributeAbsent'
  ];
}
