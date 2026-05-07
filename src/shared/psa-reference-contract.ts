export const PSA_REFERENCE_PROVIDERS = [
  'autotask',
  'connectwise',
  'halo',
  'syncro',
  'zendesk',
  'freshservice',
  'jira-service-management',
  'servicenow',
  'generic'
] as const;

export type PsaReferenceProvider = typeof PSA_REFERENCE_PROVIDERS[number];

export type PsaReference = {
  provider: PsaReferenceProvider;
  ticketId: string;
  ticketDisplayKey: string;
  ticketTitle: string;
  ticketDeepLink?: string;
  status: string;
};

export type PsaReferenceContractState = {
  ok: boolean;
  checkedAt: string;
  mode: 'reference-only';
  writebackRoute: 'itdocs-server-side-connector';
  directBrowserApiCallsAllowed: false;
  providerSecretsAllowed: false;
  supportedProviders: PsaReferenceProvider[];
  message: string;
  disabledReason: string;
};

const MAX_DEEP_LINK_LENGTH = 2048;
const CONTROL_RE = /[\u0000-\u001f\u007f]/g;
const FORBIDDEN_PSA_REFERENCE_KEY_RE = /(token|secret|password|authorization|cookie|refresh|access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|private[_-]?key)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function cleanPsaText(value: unknown, max = 180): string {
  return String(value ?? '').replace(CONTROL_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function sanitizePsaProvider(value: unknown): PsaReferenceProvider {
  const cleaned = cleanPsaText(value, 80).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return (PSA_REFERENCE_PROVIDERS as readonly string[]).includes(cleaned) ? cleaned as PsaReferenceProvider : 'generic';
}

export function sanitizePsaDeepLink(value: unknown): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > MAX_DEEP_LINK_LENGTH) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return undefined;
    if (url.username || url.password) return undefined;
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

export function hasPsaForbiddenSecretField(value: unknown, path = 'psa'): string | undefined {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = hasPsaForbiddenSecretField(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_PSA_REFERENCE_KEY_RE.test(key)) return `${path}.${key}`;
    const found = hasPsaForbiddenSecretField(nested, `${path}.${key}`);
    if (found) return found;
  }
  return undefined;
}

export function sanitizePsaReference(value: unknown): PsaReference | null {
  if (!isRecord(value)) return null;
  const forbidden = hasPsaForbiddenSecretField(value);
  if (forbidden) return null;
  const provider = sanitizePsaProvider(value.provider);
  const ticketId = cleanPsaText(value.ticketId ?? value.id, 120);
  const ticketDisplayKey = cleanPsaText(value.ticketDisplayKey ?? value.key ?? ticketId, 80);
  const ticketTitle = cleanPsaText(value.ticketTitle ?? value.title, 180);
  const status = cleanPsaText(value.status, 80);
  const ticketDeepLink = sanitizePsaDeepLink(value.ticketDeepLink ?? value.deepLink ?? value.url);
  if (!ticketId && !ticketDisplayKey && !ticketTitle && !ticketDeepLink) return null;
  return {
    provider,
    ticketId,
    ticketDisplayKey,
    ticketTitle,
    ...(ticketDeepLink ? { ticketDeepLink } : {}),
    status
  };
}

export function localOnlyPsaReferenceContractState(): PsaReferenceContractState {
  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    mode: 'reference-only',
    writebackRoute: 'itdocs-server-side-connector',
    directBrowserApiCallsAllowed: false,
    providerSecretsAllowed: false,
    supportedProviders: [...PSA_REFERENCE_PROVIDERS],
    message: 'PSA is reference-only in the browser. Ticket display fields and HTTPS deep links may be staged locally; writeback must route through IT Docs server-side connectors.',
    disabledReason: 'No browser-side PSA API calls, OAuth refresh tokens, API keys, client secrets, cookies, or provider credentials are allowed.'
  };
}

export function psaReferenceMarkdown(reference: PsaReference | null | undefined, state = localOnlyPsaReferenceContractState()): string {
  const ref = reference || {
    provider: 'generic' as PsaReferenceProvider,
    ticketId: '',
    ticketDisplayKey: '',
    ticketTitle: '',
    status: ''
  };
  return `## PSA browser reference contract\n\n| Field | Value |\n| --- | --- |\n| Contract mode | ${state.mode} |\n| Writeback route | ${state.writebackRoute} |\n| Direct browser PSA API calls | ${state.directBrowserApiCallsAllowed ? 'allowed' : 'blocked'} |\n| Browser provider secrets | ${state.providerSecretsAllowed ? 'allowed' : 'blocked'} |\n| Provider | ${ref.provider} |\n| Ticket ID | ${ref.ticketId || '_not linked_'} |\n| Ticket display key | ${ref.ticketDisplayKey || '_not linked_'} |\n| Ticket title | ${ref.ticketTitle || '_not linked_'} |\n| Ticket deep link | ${ref.ticketDeepLink || '_not linked_'} |\n| Status | ${ref.status || '_unknown_'} |\n\n${state.message}\n`;
}
