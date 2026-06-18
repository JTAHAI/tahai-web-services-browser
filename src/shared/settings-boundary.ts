import { evaluateBrowserNavigationUrl } from './navigation-boundary';

export const PASS101_SETTINGS_PERSISTENCE_BOUNDARY = 'PASS101 settings persistence boundary';
export const MAX_SETTINGS_FILE_BYTES = 64 * 1024;
export const MAX_SETTINGS_HOME_URL_CHARS = 2048;
export const MAX_SETTINGS_DIRECTORY_CHARS = 512;

const CONTROL_AND_BIDI = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g;
const LOCAL_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export type SettingsDownloadBoundary = {
  askEveryTime: boolean;
  defaultDirectory: string;
  blockInsecureDownloads: boolean;
};

export type RendererSafeDownloads = {
  askEveryTime: boolean;
  defaultDirectory: string;
  defaultDirectoryLabel: string;
  hasCustomDirectory: boolean;
  blockInsecureDownloads: boolean;
};

function cleanSettingsString(value: unknown, maxChars: number): string {
  return String(value ?? '').replace(CONTROL_AND_BIDI, '').trim().slice(0, maxChars);
}

function isLocalHttp(parsed: URL): boolean {
  return parsed.protocol === 'http:' && LOCAL_HTTP_HOSTS.has(parsed.hostname.toLowerCase());
}

export function sanitizeSettingsHomeUrl(value: unknown, fallbackUrl: string): string {
  const raw = cleanSettingsString(value, MAX_SETTINGS_HOME_URL_CHARS);
  if (!raw || String(value ?? '').length > MAX_SETTINGS_HOME_URL_CHARS) return fallbackUrl;
  const decision = evaluateBrowserNavigationUrl(raw, []);
  if (!decision.ok || !decision.url) return fallbackUrl;
  try {
    const parsed = new URL(decision.url);
    if (parsed.protocol === 'https:' || isLocalHttp(parsed)) return parsed.toString();
  } catch {
    return fallbackUrl;
  }
  return fallbackUrl;
}

export function sanitizeSettingsDirectoryValue(value: unknown): string {
  return cleanSettingsString(value, MAX_SETTINGS_DIRECTORY_CHARS);
}

export function rendererSafeDownloadSettings(downloads: SettingsDownloadBoundary): RendererSafeDownloads {
  const raw = sanitizeSettingsDirectoryValue(downloads.defaultDirectory);
  const parts = raw.split(/[\\/]+/).filter(Boolean);
  const basename = parts.at(-1) || '';
  return {
    askEveryTime: downloads.askEveryTime === true,
    defaultDirectory: '',
    defaultDirectoryLabel: basename ? `Custom folder: ${basename}` : 'System Downloads folder',
    hasCustomDirectory: Boolean(basename),
    blockInsecureDownloads: downloads.blockInsecureDownloads === true
  };
}

export function shouldRejectSettingsFileSize(sizeBytes: number): boolean {
  return !Number.isFinite(sizeBytes) || sizeBytes < 0 || sizeBytes > MAX_SETTINGS_FILE_BYTES;
}
