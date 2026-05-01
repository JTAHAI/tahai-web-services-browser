export const CREDENTIAL_VAULT_VERSION = 2;
export const CREDENTIAL_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const CREDENTIAL_LABEL_LIMIT = 180;
export const CREDENTIAL_URL_LIMIT = 520;
export const CREDENTIAL_USERNAME_LIMIT = 320;
export const CREDENTIAL_NOTES_LIMIT = 1200;
export const CREDENTIAL_SECRET_LIMIT = 4000;
export const CREDENTIAL_MAX_RECORDS = 500;
export const CREDENTIAL_REVEAL_TTL_MS = 20000;
export const CREDENTIAL_CLIPBOARD_TTL_MS = 45000;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]+/g;
const SPACE_RUN = /\s+/g;
const SAFE_CREDENTIAL_URL_PROTOCOLS = new Set(['https:', 'http:', 'ssh:', 'sftp:', 'rdp:', 'vnc:', 'mailto:']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export type CredentialBoundaryField = 'username' | 'password';

export function cleanCredentialText(value: unknown, limit: number): string {
  return String(value ?? '').replace(CONTROL_CHARS, ' ').replace(SPACE_RUN, ' ').trim().slice(0, limit);
}

export function cleanCredentialSecret(value: unknown): string {
  return String(value ?? '').replace(/\u0000/g, '').slice(0, CREDENTIAL_SECRET_LIMIT);
}

export function assertCredentialId(value: unknown): string {
  const id = cleanCredentialText(value, 120);
  if (!CREDENTIAL_ID_PATTERN.test(id)) throw new Error('Invalid credential record identifier.');
  return id;
}

export function normalizeCredentialUrl(value: unknown): string {
  const clean = cleanCredentialText(value, CREDENTIAL_URL_LIMIT);
  if (!clean) return '';
  try {
    const parsed = new URL(clean);
    if (!SAFE_CREDENTIAL_URL_PROTOCOLS.has(parsed.protocol)) throw new Error('Unsupported credential URL protocol.');
    if (parsed.username || parsed.password) throw new Error('Do not store credentials inside URLs. Use the username and password fields.');
    if (parsed.protocol === 'http:' && !LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
      throw new Error('Use HTTPS for credential URLs unless the target is localhost.');
    }
    parsed.hash = '';
    return parsed.toString().slice(0, CREDENTIAL_URL_LIMIT);
  } catch (error) {
    if (error instanceof Error && /credential|HTTPS|protocol|URLs/.test(error.message)) throw error;
    return clean;
  }
}

export function normalizeCredentialField(field: unknown): CredentialBoundaryField {
  return field === 'username' || field === 'password' ? field : 'password';
}

export function isCredentialSecretLikeText(value: string): boolean {
  return /(authorization\s*:|cookie\s*:|set-cookie\s*:|bearer\s+[a-z0-9._~+/=-]{12,}|gh[pousr]_[a-z0-9_]{24,}|github_pat_[a-z0-9_]{24,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-[0-9A-Za-z-]{20,})/i.test(value);
}

export function validateCredentialNotes(value: unknown): string {
  const clean = cleanCredentialText(value, CREDENTIAL_NOTES_LIMIT);
  if (isCredentialSecretLikeText(clean)) {
    throw new Error('Credential notes cannot contain pasted tokens, cookies, authorization headers, or private key material. Store only location/rotation/MFA notes.');
  }
  return clean;
}

export function publicCredentialVaultPathLabel(): string {
  return 'local app data profile';
}
