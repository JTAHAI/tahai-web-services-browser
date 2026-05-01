import { app, clipboard, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CREDENTIAL_CLIPBOARD_TTL_MS, CREDENTIAL_MAX_RECORDS, CREDENTIAL_REVEAL_TTL_MS, assertCredentialId, cleanCredentialSecret, cleanCredentialText, normalizeCredentialField, normalizeCredentialUrl, publicCredentialVaultPathLabel, validateCredentialNotes } from '../shared/credential-boundary';

export type CredentialVaultRecord = {
  id: string;
  label: string;
  url: string;
  username: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  hasPassword: boolean;
};

export type CredentialVaultState = {
  ok: boolean;
  encryptionAvailable: boolean;
  path: string;
  reason: string;
  records: CredentialVaultRecord[];
};

export type CredentialVaultSaveInput = {
  id?: string;
  label: string;
  url: string;
  username: string;
  password?: string;
  notes: string;
  replacePassword?: boolean;
};

export type CredentialVaultRevealResult = {
  ok: boolean;
  id: string;
  password: string;
  reason: string;
  expiresAt: string;
};

export type CredentialVaultCopyResult = {
  ok: boolean;
  id: string;
  field: 'username' | 'password';
  reason: string;
};

type StoredCredentialRecord = {
  id: string;
  label: string;
  url: string;
  username: string;
  notes: string;
  password: string;
  createdAt: string;
  updatedAt: string;
};

type StoredCredentialVault = {
  version: 2;
  records: StoredCredentialRecord[];
};

function vaultPath(): string {
  return path.join(app.getPath('userData'), 'credential-vault.json');
}

function encryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function assertEncryptionAvailable(): void {
  if (!encryptionAvailable()) {
    throw new Error('OS-backed credential encryption is not available in this session. The TAHAI credential vault will not store secrets without safeStorage encryption.');
  }
}

function cleanText(value: unknown, limit: number): string {
  return cleanCredentialText(value, limit);
}

function defaultLabel(url: string, username: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '') || username || 'Credential';
  } catch {
    return username || url || 'Credential';
  }
}

function encryptField(value: string): string {
  assertEncryptionAvailable();
  return safeStorage.encryptString(value).toString('base64');
}

function decryptField(value: string): string {
  assertEncryptionAvailable();
  if (!value) return '';
  return safeStorage.decryptString(Buffer.from(value, 'base64'));
}

function scheduleClipboardClear(value: string): void {
  if (!value) return;
  const expected = value;
  setTimeout(() => {
    try {
      if (clipboard.readText() === expected) clipboard.clear();
    } catch {
      // Best-effort clipboard expiration only.
    }
  }, CREDENTIAL_CLIPBOARD_TTL_MS).unref?.();
}

function emptyVault(): StoredCredentialVault {
  return { version: 2, records: [] };
}

function readStoredVault(): StoredCredentialVault {
  const file = vaultPath();
  if (!fs.existsSync(file)) return emptyVault();
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<StoredCredentialVault>;
  return {
    version: 2,
    records: Array.isArray(raw.records)
      ? raw.records.filter((record): record is StoredCredentialRecord => Boolean(record && typeof record.id === 'string'))
      : []
  };
}

function writeStoredVault(vault: StoredCredentialVault): void {
  const file = vaultPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(vault, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}

function toVaultRecord(stored: StoredCredentialRecord): CredentialVaultRecord {
  return {
    id: stored.id,
    label: decryptField(stored.label),
    url: decryptField(stored.url),
    username: decryptField(stored.username),
    notes: decryptField(stored.notes),
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    hasPassword: Boolean(stored.password)
  };
}

function findStoredRecord(id: string): StoredCredentialRecord | undefined {
  const vault = readStoredVault();
  return vault.records.find((record) => record.id === id);
}

function decryptedPasswordFor(id: string): string {
  const record = findStoredRecord(assertCredentialId(id));
  if (!record) throw new Error('Credential record not found.');
  return decryptField(record.password || '');
}

export function listCredentialVaultRecords(): CredentialVaultState {
  const pathValue = vaultPath();
  if (!encryptionAvailable()) {
    return {
      ok: false,
      encryptionAvailable: false,
      path: publicCredentialVaultPathLabel(),
      reason: 'OS-backed safeStorage encryption is unavailable; credential storage is disabled to avoid plaintext secrets.',
      records: []
    };
  }
  const records = readStoredVault()
    .records
    .map(toVaultRecord)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  void pathValue;
  return { ok: true, encryptionAvailable: true, path: publicCredentialVaultPathLabel(), reason: '', records };
}

export function saveCredentialVaultRecord(input: CredentialVaultSaveInput): CredentialVaultRecord {
  assertEncryptionAvailable();
  const vault = readStoredVault();
  const id = input.id ? assertCredentialId(input.id) : randomUUID();
  const now = new Date().toISOString();
  const existingIndex = vault.records.findIndex((record) => record.id === id);
  const existing = existingIndex >= 0 ? vault.records[existingIndex] : undefined;
  const url = normalizeCredentialUrl(input.url);
  const username = cleanText(input.username, 320);
  const label = cleanText(input.label, 180) || defaultLabel(url, username);
  const notes = validateCredentialNotes(input.notes);
  const password = cleanCredentialSecret(input.password);
  const replacePassword = Boolean(input.replacePassword || !existing);

  if (!label && !url && !username) {
    throw new Error('Add at least a label, URL, or username before saving a credential.');
  }
  if (!existing && !password) {
    throw new Error('New credential records require a password or secret value.');
  }

  const stored: StoredCredentialRecord = {
    id,
    label: encryptField(label),
    url: encryptField(url),
    username: encryptField(username),
    notes: encryptField(notes),
    ['password']: replacePassword ? encryptField(password) : existing?.password || encryptField(''),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  if (existingIndex >= 0) vault.records[existingIndex] = stored;
  else {
    if (vault.records.length >= CREDENTIAL_MAX_RECORDS) throw new Error('Credential vault record limit reached.');
    vault.records.push(stored);
  }

  writeStoredVault(vault);
  return toVaultRecord(stored);
}

export function deleteCredentialVaultRecord(id: string): boolean {
  assertEncryptionAvailable();
  const cleanId = assertCredentialId(id);
  const vault = readStoredVault();
  const next = vault.records.filter((record) => record.id !== cleanId);
  if (next.length === vault.records.length) return false;
  writeStoredVault({ version: 2, records: next });
  return true;
}

export function revealCredentialVaultPassword(id: string): CredentialVaultRevealResult {
  assertEncryptionAvailable();
  const cleanId = assertCredentialId(id);
  return { ok: true, id: cleanId, password: decryptedPasswordFor(cleanId), reason: '', expiresAt: new Date(Date.now() + CREDENTIAL_REVEAL_TTL_MS).toISOString() };
}

export function copyCredentialVaultValue(id: string, field: 'username' | 'password'): CredentialVaultCopyResult {
  assertEncryptionAvailable();
  const cleanId = assertCredentialId(id);
  const cleanField = normalizeCredentialField(field);
  const record = findStoredRecord(cleanId);
  if (!record) return { ok: false, id: cleanId, field: cleanField, reason: 'Credential record not found.' };
  const value = cleanField === 'password' ? decryptField(record.password || '') : decryptField(record.username || '');
  clipboard.writeText(value);
  if (cleanField === 'password') scheduleClipboardClear(value);
  return { ok: true, id: cleanId, field: cleanField, reason: cleanField === 'password' ? 'Password copied. Clipboard auto-clears when unchanged.' : '' };
}
