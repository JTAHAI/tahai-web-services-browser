export const PASS98_SHELL_ORIGIN_BOUNDARY = 'PASS98_SHELL_ORIGIN_BOUNDARY';
export const MAX_SHELL_ORIGIN_URL_CHARS = 4096;

const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/g;

export type ShellOriginDecision = {
  ok: boolean;
  url: string;
  reason: string;
  protocol: string;
};

function compactShellUrl(value: unknown): string {
  return String(value ?? '').replace(CONTROL_CHARS_RE, '').trim().slice(0, MAX_SHELL_ORIGIN_URL_CHARS);
}

function stripShellHashAndQuery(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function normalizeTrustedShellSet(trustedShellUrls: readonly string[]): Set<string> {
  return new Set(trustedShellUrls.map((url) => stripShellHashAndQuery(url)).filter(Boolean));
}

export function normalizeShellFileUrl(input: unknown): string {
  if (String(input ?? '').length > MAX_SHELL_ORIGIN_URL_CHARS) return '';
  const value = compactShellUrl(input);
  if (!value) return '';
  try {
    const parsed = new URL(value);
    if (parsed.protocol.toLowerCase() !== 'file:') return '';
    if (parsed.username || parsed.password) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

export function evaluateShellOrigin(input: unknown, trustedShellUrls: readonly string[]): ShellOriginDecision {
  const normalized = normalizeShellFileUrl(input);
  if (!normalized) return { ok: false, url: '', reason: 'Shell origin is not a valid local file URL.', protocol: '' };
  const parsed = new URL(normalized);
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'file:') return { ok: false, url: '', reason: `Shell origin protocol is blocked: ${protocol}`, protocol };
  const trusted = normalizeTrustedShellSet(trustedShellUrls);
  const withoutHashOrQuery = stripShellHashAndQuery(normalized);
  if (!trusted.has(withoutHashOrQuery)) {
    return { ok: false, url: normalized, reason: 'Local file URL is not an allowlisted TAHAI shell page.', protocol };
  }
  return { ok: true, url: normalized, reason: 'Allowlisted TAHAI shell page.', protocol };
}

export function isTrustedShellOrigin(input: unknown, trustedShellUrls: readonly string[]): boolean {
  return evaluateShellOrigin(input, trustedShellUrls).ok;
}

export function assertTrustedShellOrigin(input: unknown, trustedShellUrls: readonly string[]): void {
  const decision = evaluateShellOrigin(input, trustedShellUrls);
  if (!decision.ok) throw new Error(`Privileged TAHAI browser IPC blocked: ${decision.reason}`);
}
