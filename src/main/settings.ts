import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_HOME_URL = 'https://tahaiportal.com';

export type SearchProvider = 'google' | 'duckduckgo' | 'bing';
export type StartupMode = 'home' | 'launchpad';

export type TahaiBrowserSettings = {
  homeUrl: string;
  startup: StartupMode;
  searchProvider: SearchProvider;
  permissions: {
    allowClipboardRead: boolean;
    allowMedia: boolean;
    allowGeolocation: boolean;
    allowNotifications: boolean;
  };
  downloads: {
    askEveryTime: boolean;
    defaultDirectory: string;
  };
  ui: {
    showStatusBar: boolean;
    openExternalLinksInNewTab: boolean;
  };
};

export const DEFAULT_BROWSER_SETTINGS: TahaiBrowserSettings = {
  homeUrl: DEFAULT_HOME_URL,
  startup: 'home',
  searchProvider: 'google',
  permissions: {
    allowClipboardRead: false,
    allowMedia: true,
    allowGeolocation: false,
    allowNotifications: false
  },
  downloads: {
    askEveryTime: true,
    defaultDirectory: ''
  },
  ui: {
    showStatusBar: true,
    openExternalLinksInNewTab: true
  }
};

function settingsFile(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export function getSettingsPath(): string {
  return settingsFile();
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function cleanDirectory(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanSearchProvider(value: unknown): SearchProvider {
  return value === 'duckduckgo' || value === 'bing' || value === 'google' ? value : DEFAULT_BROWSER_SETTINGS.searchProvider;
}

function cleanStartup(value: unknown): StartupMode {
  return value === 'launchpad' || value === 'home' ? value : DEFAULT_BROWSER_SETTINGS.startup;
}

function cleanBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function plainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function sanitizeSettings(value: unknown): TahaiBrowserSettings {
  const raw = plainRecord(value);
  const rawPermissions = plainRecord(raw.permissions);
  const rawDownloads = plainRecord(raw.downloads);
  const rawUi = plainRecord(raw.ui);

  return {
    homeUrl: isHttpUrl(raw.homeUrl) ? raw.homeUrl.trim() : DEFAULT_BROWSER_SETTINGS.homeUrl,
    startup: cleanStartup(raw.startup),
    searchProvider: cleanSearchProvider(raw.searchProvider),
    permissions: {
      allowClipboardRead: cleanBoolean(rawPermissions.allowClipboardRead, DEFAULT_BROWSER_SETTINGS.permissions.allowClipboardRead),
      allowMedia: cleanBoolean(rawPermissions.allowMedia, DEFAULT_BROWSER_SETTINGS.permissions.allowMedia),
      allowGeolocation: cleanBoolean(rawPermissions.allowGeolocation, DEFAULT_BROWSER_SETTINGS.permissions.allowGeolocation),
      allowNotifications: cleanBoolean(rawPermissions.allowNotifications, DEFAULT_BROWSER_SETTINGS.permissions.allowNotifications)
    },
    downloads: {
      askEveryTime: cleanBoolean(rawDownloads.askEveryTime, DEFAULT_BROWSER_SETTINGS.downloads.askEveryTime),
      defaultDirectory: cleanDirectory(rawDownloads.defaultDirectory)
    },
    ui: {
      showStatusBar: cleanBoolean(rawUi.showStatusBar, DEFAULT_BROWSER_SETTINGS.ui.showStatusBar),
      openExternalLinksInNewTab: cleanBoolean(rawUi.openExternalLinksInNewTab, DEFAULT_BROWSER_SETTINGS.ui.openExternalLinksInNewTab)
    }
  };
}

export function readBrowserSettings(): TahaiBrowserSettings {
  const file = settingsFile();
  if (!fs.existsSync(file)) return { ...DEFAULT_BROWSER_SETTINGS };
  try {
    return sanitizeSettings(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return { ...DEFAULT_BROWSER_SETTINGS };
  }
}

export function writeBrowserSettings(next: unknown): TahaiBrowserSettings {
  const cleaned = sanitizeSettings(next);
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(cleaned, null, 2) + '\n', 'utf8');
  return cleaned;
}

export function resetBrowserSettings(): TahaiBrowserSettings {
  return writeBrowserSettings(DEFAULT_BROWSER_SETTINGS);
}
