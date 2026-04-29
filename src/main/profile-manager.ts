import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type BrowserProfileKind = 'local' | 'google' | 'microsoft' | 'work' | 'client';

export type BrowserProfile = {
  id: string;
  name: string;
  kind: BrowserProfileKind;
  color: string;
  partition: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string;
  isDefault: boolean;
};

export type BrowserProfileState = {
  activeProfileId: string;
  activeProfile: BrowserProfile;
  profiles: BrowserProfile[];
  path: string;
};

export type BrowserProfileInput = {
  name: string;
  kind?: BrowserProfileKind;
  color?: string;
};

export type BrowserProfileUpdateInput = {
  id: string;
  name?: string;
  kind?: BrowserProfileKind;
  color?: string;
};

type StoredProfileFile = {
  version: 1;
  activeProfileId: string;
  profiles: BrowserProfile[];
};

const DEFAULT_PROFILE_ID = 'default';
const DEFAULT_PROFILE_COLOR = '#77dbff';
const PROFILE_COLORS = ['#77dbff', '#6dffb7', '#ffd27a', '#b184ff', '#ff74ba', '#ff8f3d', '#00ddff'];
const PROFILE_KINDS = new Set<BrowserProfileKind>(['local', 'google', 'microsoft', 'work', 'client']);

function profilesPath(): string {
  return path.join(app.getPath('userData'), 'browser-profiles.json');
}

function stamp(): string {
  return new Date().toISOString();
}

function cleanProfileName(value: unknown, fallback: string): string {
  const clean = String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 72);
  return clean || fallback;
}

function cleanColor(value: unknown): string {
  const clean = String(value ?? '').trim();
  if (/^#[0-9a-f]{6}$/i.test(clean)) return clean.toLowerCase();
  return DEFAULT_PROFILE_COLOR;
}

function cleanKind(value: unknown): BrowserProfileKind {
  return PROFILE_KINDS.has(value as BrowserProfileKind) ? value as BrowserProfileKind : 'local';
}

function cleanId(value: unknown): string {
  return String(value ?? '').replace(/[^a-zA-Z0-9_-]+/g, '').slice(0, 80);
}

function profilePartition(id: string): string {
  return `persist:tahai-profile-${cleanId(id) || DEFAULT_PROFILE_ID}`;
}

function defaultProfile(): BrowserProfile {
  const now = stamp();
  return {
    id: DEFAULT_PROFILE_ID,
    name: 'Default',
    kind: 'local',
    color: DEFAULT_PROFILE_COLOR,
    partition: profilePartition(DEFAULT_PROFILE_ID),
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    isDefault: true
  };
}

function normalizeProfile(raw: Partial<BrowserProfile>, fallbackIndex: number): BrowserProfile {
  const fallbackId = fallbackIndex === 0 ? DEFAULT_PROFILE_ID : `profile-${randomUUID()}`;
  const id = cleanId(raw.id) || fallbackId;
  const now = stamp();
  return {
    id,
    name: cleanProfileName(raw.name, id === DEFAULT_PROFILE_ID ? 'Default' : 'Profile'),
    kind: cleanKind(raw.kind),
    color: cleanColor(raw.color || PROFILE_COLORS[fallbackIndex % PROFILE_COLORS.length]),
    partition: profilePartition(id),
    createdAt: String(raw.createdAt || now),
    updatedAt: String(raw.updatedAt || now),
    lastUsedAt: String(raw.lastUsedAt || raw.updatedAt || now),
    isDefault: id === DEFAULT_PROFILE_ID || Boolean(raw.isDefault && fallbackIndex === 0)
  };
}

function emptyFile(): StoredProfileFile {
  const profile = defaultProfile();
  return { version: 1, activeProfileId: profile.id, profiles: [profile] };
}

function readProfileFile(): StoredProfileFile {
  const file = profilesPath();
  if (!fs.existsSync(file)) return emptyFile();
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<StoredProfileFile>;
    const normalized = Array.isArray(raw.profiles)
      ? raw.profiles.map((profile, index) => normalizeProfile(profile, index))
      : [defaultProfile()];
    const deduped = new Map<string, BrowserProfile>();
    for (const profile of normalized) deduped.set(profile.id, profile);
    if (!deduped.has(DEFAULT_PROFILE_ID)) deduped.set(DEFAULT_PROFILE_ID, defaultProfile());
    const profiles = Array.from(deduped.values()).sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.createdAt.localeCompare(right.createdAt));
    const activeProfileId = profiles.some((profile) => profile.id === raw.activeProfileId) ? String(raw.activeProfileId) : DEFAULT_PROFILE_ID;
    return { version: 1, activeProfileId, profiles };
  } catch {
    return emptyFile();
  }
}

function writeProfileFile(fileValue: StoredProfileFile): void {
  const file = profilesPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(fileValue, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}

function toState(fileValue: StoredProfileFile): BrowserProfileState {
  const activeProfile = fileValue.profiles.find((profile) => profile.id === fileValue.activeProfileId) || fileValue.profiles[0] || defaultProfile();
  return {
    activeProfileId: activeProfile.id,
    activeProfile,
    profiles: fileValue.profiles,
    path: profilesPath()
  };
}

export function listBrowserProfiles(): BrowserProfileState {
  const fileValue = readProfileFile();
  writeProfileFile(fileValue);
  return toState(fileValue);
}

export function createBrowserProfile(input: BrowserProfileInput): BrowserProfileState {
  const fileValue = readProfileFile();
  const now = stamp();
  const id = `profile-${randomUUID()}`;
  const profile: BrowserProfile = {
    id,
    name: cleanProfileName(input.name, `${cleanKind(input.kind)} profile`),
    kind: cleanKind(input.kind),
    color: cleanColor(input.color || PROFILE_COLORS[fileValue.profiles.length % PROFILE_COLORS.length]),
    partition: profilePartition(id),
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    isDefault: false
  };
  fileValue.profiles.push(profile);
  fileValue.activeProfileId = profile.id;
  writeProfileFile(fileValue);
  return toState(fileValue);
}

export function updateBrowserProfile(input: BrowserProfileUpdateInput): BrowserProfileState {
  const fileValue = readProfileFile();
  const id = cleanId(input.id);
  const now = stamp();
  fileValue.profiles = fileValue.profiles.map((profile) => {
    if (profile.id !== id) return profile;
    return {
      ...profile,
      name: input.name === undefined ? profile.name : cleanProfileName(input.name, profile.name),
      kind: input.kind === undefined ? profile.kind : cleanKind(input.kind),
      color: input.color === undefined ? profile.color : cleanColor(input.color),
      updatedAt: now
    };
  });
  writeProfileFile(fileValue);
  return toState(fileValue);
}

export function setActiveBrowserProfile(idValue: string): BrowserProfileState {
  const fileValue = readProfileFile();
  const id = cleanId(idValue);
  const now = stamp();
  if (!fileValue.profiles.some((profile) => profile.id === id)) return toState(fileValue);
  fileValue.activeProfileId = id;
  fileValue.profiles = fileValue.profiles.map((profile) => profile.id === id ? { ...profile, lastUsedAt: now, updatedAt: now } : profile);
  writeProfileFile(fileValue);
  return toState(fileValue);
}

export function deleteBrowserProfile(idValue: string): BrowserProfileState {
  const fileValue = readProfileFile();
  const id = cleanId(idValue);
  if (!id || id === DEFAULT_PROFILE_ID) return toState(fileValue);
  fileValue.profiles = fileValue.profiles.filter((profile) => profile.id !== id);
  if (!fileValue.profiles.some((profile) => profile.id === fileValue.activeProfileId)) fileValue.activeProfileId = DEFAULT_PROFILE_ID;
  writeProfileFile(fileValue);
  return toState(fileValue);
}

export function profileSessionPartitions(): string[] {
  return listBrowserProfiles().profiles.map((profile) => profile.partition);
}

export function profileDataPath(idValue: string): string {
  const id = cleanId(idValue) || DEFAULT_PROFILE_ID;
  return path.join(app.getPath('userData'), 'Partitions', `tahai-profile-${id}`);
}
