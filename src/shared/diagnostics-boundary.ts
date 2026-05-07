import { sanitizeEvidenceUrl } from './evidence-safety';
import { scanAndRedact } from './redaction';

export const MAX_DIAGNOSTIC_URL_CHARS = 2048;
export const DIAGNOSTIC_TIMEOUT_MS = 15000;

const CONTROL_AND_BIDI = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g;
const HOST_LIKE_RE = /^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i;
const LOCALHOST_RE = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?([/?#].*)?$/i;
const SAFE_DIAGNOSTIC_PROTOCOLS = new Set(['http:', 'https:']);
const BLOCKED_DIAGNOSTIC_HEADERS = new Set(['set-cookie', 'cookie', 'authorization', 'proxy-authorization', 'www-authenticate', 'proxy-authenticate']);
const SAFE_DIAGNOSTIC_HEADERS = new Set([
  'status',
  'location',
  'content-type',
  'content-length',
  'cache-control',
  'etag',
  'last-modified',
  'strict-transport-security',
  'content-security-policy',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
  'access-control-allow-origin',
  'server',
  'x-powered-by',
  'cf-cache-status',
  'x-cache',
  'via'
]);


const METADATA_HOSTNAMES = new Set([
  'metadata',
  'metadata.google.internal',
  'metadata.google',
  'instance-data',
  'instance-data.ec2.internal',
  'metadata.azure.internal'
]);

const SPECIAL_METADATA_IPV4 = new Set([
  '169.254.169.254',
  '100.100.100.200'
]);

export type DiagnosticsHostScopeDecision = {
  ok: boolean;
  reason: string;
  hostname: string;
  resolvedAddresses: string[];
  blockedAddresses: string[];
};

export type DiagnosticsBoundaryDecision = {
  ok: boolean;
  url: string;
  reason: string;
  protocol: string;
  hostname: string;
};

function compact(value: unknown, max = MAX_DIAGNOSTIC_URL_CHARS): string {
  return String(value ?? '')
    .replace(CONTROL_AND_BIDI, '')
    .trim()
    .slice(0, max);
}

function proposedDiagnosticUrl(input: unknown, fallbackUrl: string): string {
  const clean = compact(input);
  if (!clean) return fallbackUrl;
  if (/^https?:\/\//i.test(clean)) return clean;
  if (LOCALHOST_RE.test(clean)) return `http://${clean}`;
  if (HOST_LIKE_RE.test(clean)) return `https://${clean}`;
  return fallbackUrl;
}

function block(reason: string, protocol = '', hostname = ''): DiagnosticsBoundaryDecision {
  return { ok: false, url: '', reason, protocol, hostname };
}

export function evaluateDiagnosticsRequestUrl(input: unknown, fallbackUrl: string): DiagnosticsBoundaryDecision {
  if (String(input ?? '').length > MAX_DIAGNOSTIC_URL_CHARS) return block('Diagnostic target is too long.');
  const proposed = proposedDiagnosticUrl(input, fallbackUrl);
  let parsed: URL;
  try {
    parsed = new URL(proposed);
  } catch {
    return block('Diagnostic target is not a valid absolute URL.');
  }

  const protocol = parsed.protocol.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();
  if (!SAFE_DIAGNOSTIC_PROTOCOLS.has(protocol)) return block(`Diagnostic protocol is not allowed: ${protocol}`, protocol, hostname);
  if (parsed.username || parsed.password) return block('Diagnostic target includes embedded credentials.', protocol, hostname);

  parsed.hash = '';
  const safe = sanitizeEvidenceUrl(parsed.toString(), 'operational-handoff');
  if (!safe) return block('Diagnostic target could not be sanitized safely.', protocol, hostname);
  return { ok: true, url: safe, reason: 'Cookie-free HTTP(S) diagnostic request allowed.', protocol, hostname };
}

export function safeDiagnosticsRequestUrl(input: unknown, fallbackUrl: string): string {
  const decision = evaluateDiagnosticsRequestUrl(input, fallbackUrl);
  return decision.ok ? decision.url : '';
}

export function safeDiagnosticText(value: unknown, max = 900): string {
  const normalized = String(value ?? '')
    .replace(CONTROL_AND_BIDI, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return '';
  const redacted = scanAndRedact(normalized).redacted.replace(/\s+/g, ' ').trim();
  return redacted.slice(0, max);
}

function safeHeaderValue(key: string, value: string | string[], baseUrl = ''): string {
  const joined = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  if (key === 'location') {
    if (/^\[BLOCKED_DIAGNOSTIC_REDIRECT:/i.test(joined)) return safeDiagnosticText(joined, 220);
    return sanitizeDiagnosticRedirectLocation(joined, baseUrl);
  }
  return safeDiagnosticText(joined, 900);
}


export function sanitizeDiagnosticHeaderMap(headers: Record<string, string | string[] | number | undefined>, baseUrl = ''): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(headers || {})) {
    const lower = key.toLowerCase().trim();
    if (BLOCKED_DIAGNOSTIC_HEADERS.has(lower)) continue;
    if (!SAFE_DIAGNOSTIC_HEADERS.has(lower)) continue;
    const value = safeHeaderValue(lower, Array.isArray(rawValue) ? rawValue.map(String) : String(rawValue ?? ''), baseUrl);
    if (value) output[lower] = value;
  }
  return output;
}


function stripHostnameDecorations(hostname: unknown): string {
  return compact(hostname, 260)
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/\.$/, '')
    .toLowerCase();
}

function parseIpv4(address: string): number[] | null {
  const parts = address.trim().split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return Number.NaN;
    const value = Number(part);
    return value >= 0 && value <= 255 ? value : Number.NaN;
  });
  return octets.every((value) => Number.isInteger(value)) ? octets : null;
}

function isBlockedIpv4Address(address: string): boolean {
  const ipv4 = parseIpv4(address);
  if (!ipv4) return false;
  const [a, b, c, d] = ipv4;
  if (SPECIAL_METADATA_IPV4.has(`${a}.${b}.${c}.${d}`)) return true;
  if (a === 0) return true; // this network / unspecified
  if (a === 10) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 192 && b === 0 && c === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
  if (a === 198 && b >= 18 && b <= 19) return true; // benchmark network
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast / reserved / broadcast
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;
  return false;
}

function isBlockedIpv6Address(address: string): boolean {
  const clean = stripHostnameDecorations(address).split('%')[0];
  if (!clean.includes(':')) return false;
  if (clean === '::' || clean === '::1') return true; // unspecified / loopback
  if (clean.startsWith('::ffff:')) {
    const mapped = clean.slice('::ffff:'.length);
    if (isBlockedIpv4Address(mapped)) return true;
  }
  const first = clean.split(':')[0] || '';
  if (/^f[c-d]/i.test(first)) return true; // unique local fc00::/7
  if (/^fe[89ab]/i.test(first)) return true; // link-local fe80::/10
  if (/^ff/i.test(first)) return true; // multicast
  if (clean.startsWith('2001:db8:') || clean === '2001:db8') return true; // documentation
  return false;
}

export function isBlockedDiagnosticsAddress(address: unknown): boolean {
  const clean = stripHostnameDecorations(address);
  if (!clean) return true;
  return isBlockedIpv4Address(clean) || isBlockedIpv6Address(clean);
}

export function isBlockedDiagnosticsHostname(hostname: unknown): boolean {
  const host = stripHostnameDecorations(hostname);
  if (!host) return true;
  if (METADATA_HOSTNAMES.has(host)) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.lan') || host.endsWith('.home.arpa') || host.endsWith('.internal')) return true;
  if (isBlockedDiagnosticsAddress(host)) return true;
  if (!host.includes('.') && !host.includes(':')) return true; // no single-label intranet names
  return false;
}

export function evaluateDiagnosticsHostScope(hostname: unknown, resolvedAddresses: unknown[] = []): DiagnosticsHostScopeDecision {
  const host = stripHostnameDecorations(hostname);
  const resolved = resolvedAddresses.map((address) => stripHostnameDecorations(address)).filter(Boolean).slice(0, 32);
  const blocked = resolved.filter((address) => isBlockedDiagnosticsAddress(address));
  if (isBlockedDiagnosticsHostname(host)) {
    return { ok: false, reason: 'Diagnostic target is local, private, link-local, metadata, or not public-routable.', hostname: host, resolvedAddresses: resolved, blockedAddresses: blocked };
  }
  if (blocked.length) {
    return { ok: false, reason: 'Diagnostic target DNS resolved to local, private, link-local, metadata, or reserved address space.', hostname: host, resolvedAddresses: resolved, blockedAddresses: blocked };
  }
  return { ok: true, reason: 'Diagnostic target is public-routable after hostname/IP boundary checks.', hostname: host, resolvedAddresses: resolved, blockedAddresses: [] };
}

export function sanitizeDiagnosticRedirectLocation(value: unknown, baseUrl = ''): string {
  const clean = safeDiagnosticText(value, MAX_DIAGNOSTIC_URL_CHARS);
  if (!clean) return '';
  let parsed: URL;
  try {
    parsed = baseUrl ? new URL(clean, baseUrl) : new URL(clean);
  } catch {
    return '[BLOCKED_DIAGNOSTIC_REDIRECT: invalid location]';
  }
  const decision = evaluateDiagnosticsRequestUrl(parsed.toString(), '');
  if (!decision.ok) return `[BLOCKED_DIAGNOSTIC_REDIRECT: ${safeDiagnosticText(decision.reason, 120)}]`;
  const scope = evaluateDiagnosticsHostScope(decision.hostname);
  if (!scope.ok) return `[BLOCKED_DIAGNOSTIC_REDIRECT: ${safeDiagnosticText(scope.reason, 120)}]`;
  return sanitizeEvidenceUrl(decision.url, 'operational-handoff') || '[BLOCKED_DIAGNOSTIC_REDIRECT: unsafe location]';
}

export function diagnosticBoundaryStatusLine(): string {
  return 'PASS102 cookie-free Node diagnostics boundary: no Electron session cookies, no Authorization/Cookie headers, sanitized redirect/header output.';
}
