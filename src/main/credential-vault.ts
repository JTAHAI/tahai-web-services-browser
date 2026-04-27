import { app, clipboard, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

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
  version: 1;
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
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
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

function emptyVault(): StoredCredentialVault {
  return { version: 1, records: [] };
}

function readStoredVault(): StoredCredentialVault {
  const file = vaultPath();
  if (!fs.existsSync(file)) return emptyVault();
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<StoredCredentialVault>;
  return {
    version: 1,
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
  const record = findStoredRecord(cleanText(id, 120));
  if (!record) throw new Error('Credential record not found.');
  return decryptField(record.password || '');
}

export function listCredentialVaultRecords(): CredentialVaultState {
  const pathValue = vaultPath();
  if (!encryptionAvailable()) {
    return {
      ok: false,
      encryptionAvailable: false,
      path: pathValue,
      reason: 'OS-backed safeStorage encryption is unavailable; credential storage is disabled to avoid plaintext secrets.',
      records: []
    };
  }
  const records = readStoredVault()
    .records
    .map(toVaultRecord)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return { ok: true, encryptionAvailable: true, path: pathValue, reason: '', records };
}

export function saveCredentialVaultRecord(input: CredentialVaultSaveInput): CredentialVaultRecord {
  assertEncryptionAvailable();
  const vault = readStoredVault();
  const id = cleanText(input.id, 120) || randomUUID();
  const now = new Date().toISOString();
  const existingIndex = vault.records.findIndex((record) => record.id === id);
  const existing = existingIndex >= 0 ? vault.records[existingIndex] : undefined;
  const url = cleanText(input.url, 520);
  const username = cleanText(input.username, 320);
  const label = cleanText(input.label, 180) || defaultLabel(url, username);
  const notes = cleanText(input.notes, 1200);
  const password = String(input.password ?? '');
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
  else vault.records.push(stored);

  writeStoredVault(vault);
  return toVaultRecord(stored);
}

export function deleteCredentialVaultRecord(id: string): boolean {
  assertEncryptionAvailable();
  const cleanId = cleanText(id, 120);
  const vault = readStoredVault();
  const next = vault.records.filter((record) => record.id !== cleanId);
  if (next.length === vault.records.length) return false;
  writeStoredVault({ version: 1, records: next });
  return true;
}

export function revealCredentialVaultPassword(id: string): CredentialVaultRevealResult {
  assertEncryptionAvailable();
  const cleanId = cleanText(id, 120);
  return { ok: true, id: cleanId, password: decryptedPasswordFor(cleanId), reason: '' };
}

export function copyCredentialVaultValue(id: string, field: 'username' | 'password'): CredentialVaultCopyResult {
  assertEncryptionAvailable();
  const cleanId = cleanText(id, 120);
  const record = findStoredRecord(cleanId);
  if (!record) return { ok: false, id: cleanId, field, reason: 'Credential record not found.' };
  const value = field === 'password' ? decryptField(record.password || '') : decryptField(record.username || '');
  clipboard.writeText(value);
  return { ok: true, id: cleanId, field, reason: '' };
}
