export const ITDOCS_DEFAULT_ORIGIN = 'https://docs.tahaiportal.com';

export const ITDOCS_ALLOWED_ORIGINS = [
  'https://docs.tahaiportal.com',
  'https://itdocs.tahaiportal.com',
  'https://tahaiportal.com'
] as const;

export type ItDocsOrgRef = {
  orgId: string;
  orgName: string;
  deepLink?: string;
};

export type ItDocsPsaProviderCapability = {
  provider: string;
  label: string;
  canLinkTicket: boolean;
  canAppendTicketNote: boolean;
  deepLink?: string;
};

export type ItDocsMissionCapabilities = {
  ok: boolean;
  checkedAt: string;
  origin: string;
  signedIn: boolean;
  state: 'not-configured' | 'offline' | 'not-signed-in' | 'signed-in' | 'permission-denied' | 'contract-error';
  activeOrgs: ItDocsOrgRef[];
  canCreateMissionReference: boolean;
  canAppendEvidence: boolean;
  canAppendRunbookNote: boolean;
  psaProvidersAvailable: ItDocsPsaProviderCapability[];
  message: string;
  disabledReason: string;
};

function cleanText(value: unknown, max = 160): string {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function bool(value: unknown): boolean {
  return value === true;
}

export function normalizeItDocsOrigin(value: unknown): string {
  const raw = String(value ?? '').trim() || ITDOCS_DEFAULT_ORIGIN;
  try {
    const url = new URL(raw);
    url.pathname = '';
    url.search = '';
    url.hash = '';
    if (url.protocol !== 'https:') return ITDOCS_DEFAULT_ORIGIN;
    const origin = url.origin;
    return (ITDOCS_ALLOWED_ORIGINS as readonly string[]).includes(origin) ? origin : ITDOCS_DEFAULT_ORIGIN;
  } catch {
    return ITDOCS_DEFAULT_ORIGIN;
  }
}

export function sanitizeItDocsDeepLink(value: unknown): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > 2048) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return undefined;
    if (!(ITDOCS_ALLOWED_ORIGINS as readonly string[]).includes(url.origin)) return undefined;
    if (url.username || url.password) return undefined;
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

function sanitizeOrgRef(input: unknown): ItDocsOrgRef | undefined {
  const item = record(input);
  if (!item) return undefined;
  const orgId = cleanText(item.orgId ?? item.id, 120);
  const orgName = cleanText(item.orgName ?? item.name, 160);
  if (!orgId || !orgName) return undefined;
  const deepLink = sanitizeItDocsDeepLink(item.deepLink ?? item.url);
  return deepLink ? { orgId, orgName, deepLink } : { orgId, orgName };
}

function sanitizePsaProvider(input: unknown): ItDocsPsaProviderCapability | undefined {
  const item = record(input);
  if (!item) return undefined;
  const provider = cleanText(item.provider ?? item.id, 48).toLowerCase().replace(/[^a-z0-9_-]+/g, '').slice(0, 48);
  const label = cleanText(item.label ?? item.name ?? provider, 96);
  if (!provider || !label) return undefined;
  const deepLink = sanitizeItDocsDeepLink(item.deepLink ?? item.url);
  const output: ItDocsPsaProviderCapability = {
    provider,
    label,
    canLinkTicket: bool(item.canLinkTicket),
    canAppendTicketNote: bool(item.canAppendTicketNote)
  };
  if (deepLink) output.deepLink = deepLink;
  return output;
}

export function localOnlyItDocsCapabilities(origin = ITDOCS_DEFAULT_ORIGIN, message = 'Sign in to TAHAI IT Docs to link this mission.'): ItDocsMissionCapabilities {
  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    origin: normalizeItDocsOrigin(origin),
    signedIn: false,
    state: 'not-signed-in',
    activeOrgs: [],
    canCreateMissionReference: false,
    canAppendEvidence: false,
    canAppendRunbookNote: false,
    psaProvidersAvailable: [],
    message,
    disabledReason: 'Browser is local-only until IT Docs returns signed-in, server-authorized capabilities.'
  };
}

export function sanitizeItDocsCapabilities(input: unknown, origin = ITDOCS_DEFAULT_ORIGIN): ItDocsMissionCapabilities {
  const payload = record(input) || {};
  const normalizedOrigin = normalizeItDocsOrigin(payload.origin ?? origin);
  const activeOrgs = Array.isArray(payload.activeOrgs) ? payload.activeOrgs.map(sanitizeOrgRef).filter(Boolean) as ItDocsOrgRef[] : [];
  const psaProvidersAvailable = Array.isArray(payload.psaProvidersAvailable) ? payload.psaProvidersAvailable.map(sanitizePsaProvider).filter(Boolean) as ItDocsPsaProviderCapability[] : [];
  const signedIn = bool(payload.signedIn);
  const canCreateMissionReference = signedIn && bool(payload.canCreateMissionReference);
  const canAppendEvidence = signedIn && bool(payload.canAppendEvidence);
  const canAppendRunbookNote = signedIn && bool(payload.canAppendRunbookNote);
  const state = signedIn ? (activeOrgs.length ? 'signed-in' : 'permission-denied') : 'not-signed-in';
  const message = cleanText(payload.message, 220) || (signedIn ? 'IT Docs capabilities loaded. Server still authorizes every mission write.' : 'Sign in to TAHAI IT Docs to link this mission.');
  const disabledReason = cleanText(payload.disabledReason, 220) || (signedIn ? '' : 'Not signed in to IT Docs.');
  return { ok: true, checkedAt: new Date().toISOString(), origin: normalizedOrigin, signedIn, state, activeOrgs, canCreateMissionReference, canAppendEvidence, canAppendRunbookNote, psaProvidersAvailable, message, disabledReason };
}

export function itDocsCapabilityMarkdown(capabilities: ItDocsMissionCapabilities): string {
  const orgs = capabilities.activeOrgs.map((org) => `- ${org.orgName} (${org.orgId})`).join('\n') || '- _No authorized orgs returned._';
  const providers = capabilities.psaProvidersAvailable.map((provider) => `- ${provider.label}: link=${provider.canLinkTicket ? 'yes' : 'no'}, append=${provider.canAppendTicketNote ? 'yes' : 'no'}`).join('\n') || '- _No PSA provider capabilities returned._';
  return `## IT Docs browser contract state\n\n| Field | Value |\n| --- | --- |\n| Checked at | ${capabilities.checkedAt} |\n| Origin | ${capabilities.origin} |\n| State | ${capabilities.state} |\n| Signed in | ${capabilities.signedIn ? 'yes' : 'no'} |\n| Can create mission reference | ${capabilities.canCreateMissionReference ? 'yes' : 'no'} |\n| Can append evidence | ${capabilities.canAppendEvidence ? 'yes' : 'no'} |\n| Can append runbook note | ${capabilities.canAppendRunbookNote ? 'yes' : 'no'} |\n| Message | ${capabilities.message} |\n| Disabled reason | ${capabilities.disabledReason || 'none'} |\n\n### Authorized org refs\n\n${orgs}\n\n### PSA provider capabilities exposed by IT Docs\n\n${providers}\n`;
}
