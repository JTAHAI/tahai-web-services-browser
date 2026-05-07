export const MAX_BROWSER_NAVIGATION_URL_CHARS = 4096;

const REMOTE_NAVIGATION_PROTOCOLS = new Set(['https:', 'http:']);
const BLOCKED_NAVIGATION_PROTOCOLS = new Set(['javascript:', 'data:', 'vbscript:', 'ftp:', 'gopher:', 'about:', 'blob:']);
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/g;
const EXPLICIT_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const HOST_LIKE_RE = /^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i;
const LOCALHOST_RE = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?([/?#].*)?$/i;

export type NavigationBoundaryDecision = {
  ok: boolean;
  url: string;
  reason: string;
  protocol: string;
  kind: 'remote' | 'trusted-local' | 'blocked';
};

export type NavigationTargetOptions = {
  trustedLocalUrls?: string[];
  fallbackUrl?: string;
  searchUrl?: string;
};

function compactNavigationInput(value: unknown): string {
  return String(value ?? '').replace(CONTROL_CHARS_RE, '').trim().slice(0, MAX_BROWSER_NAVIGATION_URL_CHARS);
}

function trustedLocalMatch(value: string, trustedLocalUrls: readonly string[]): boolean {
  return trustedLocalUrls.some((trusted) => value === trusted || value.startsWith(`${trusted}?`) || value.startsWith(`${trusted}#`));
}

function blocked(reason: string, protocol = ''): NavigationBoundaryDecision {
  return { ok: false, url: '', reason, protocol, kind: 'blocked' };
}

export function evaluateBrowserNavigationUrl(input: unknown, trustedLocalUrls: readonly string[] = []): NavigationBoundaryDecision {
  const value = compactNavigationInput(input);
  if (!value) return blocked('Empty navigation target.');
  if (String(input ?? '').length > MAX_BROWSER_NAVIGATION_URL_CHARS) return blocked('Navigation target is too long.');

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return blocked('Navigation target is not an absolute URL.');
  }

  const protocol = parsed.protocol.toLowerCase();
  if (BLOCKED_NAVIGATION_PROTOCOLS.has(protocol)) return blocked(`Blocked navigation protocol: ${protocol}`, protocol);

  if (protocol === 'file:') {
    const normalized = parsed.toString();
    if (trustedLocalMatch(normalized, trustedLocalUrls)) {
      return { ok: true, url: normalized, reason: 'Trusted packaged TAHAI shell page.', protocol, kind: 'trusted-local' };
    }
    return blocked('Blocked untrusted local file navigation.', protocol);
  }

  if (!REMOTE_NAVIGATION_PROTOCOLS.has(protocol)) return blocked(`Unsupported navigation protocol: ${protocol}`, protocol);
  if (parsed.username || parsed.password) return blocked('Navigation target includes embedded credentials.', protocol);

  return { ok: true, url: parsed.toString(), reason: 'Remote HTTP(S) navigation allowed.', protocol, kind: 'remote' };
}

export function sanitizeBrowserNavigationUrl(input: unknown, trustedLocalUrls: readonly string[] = []): string {
  const decision = evaluateBrowserNavigationUrl(input, trustedLocalUrls);
  return decision.ok ? decision.url : '';
}

export function normalizeBrowserNavigationTarget(input: unknown, options: NavigationTargetOptions = {}): string {
  const trustedLocalUrls = options.trustedLocalUrls || [];
  const fallbackUrl = options.fallbackUrl || trustedLocalUrls[0] || '';
  if (String(input ?? '').length > MAX_BROWSER_NAVIGATION_URL_CHARS) return fallbackUrl;
  const value = compactNavigationInput(input);
  if (!value) return fallbackUrl;

  const direct = evaluateBrowserNavigationUrl(value, trustedLocalUrls);
  if (direct.ok) return direct.url;
  if (EXPLICIT_SCHEME_RE.test(value)) return fallbackUrl;

  const candidate = LOCALHOST_RE.test(value)
    ? `http://${value}`
    : HOST_LIKE_RE.test(value)
      ? `https://${value}`
      : '';
  if (candidate) {
    const normalized = evaluateBrowserNavigationUrl(candidate, trustedLocalUrls);
    if (normalized.ok) return normalized.url;
  }

  return options.searchUrl || fallbackUrl;
}

export function navigationBoundaryReason(input: unknown, trustedLocalUrls: readonly string[] = []): string {
  return evaluateBrowserNavigationUrl(input, trustedLocalUrls).reason;
}

export function isAllowedExternalNavigationUrl(input: unknown): boolean {
  const decision = evaluateBrowserNavigationUrl(input, []);
  return decision.ok && decision.kind === 'remote';
}

export function sanitizeExternalNavigationUrl(input: unknown): string {
  const decision = evaluateBrowserNavigationUrl(input, []);
  return decision.ok && decision.kind === 'remote' ? decision.url : '';
}
