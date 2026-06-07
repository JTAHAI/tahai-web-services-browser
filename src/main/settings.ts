import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { rendererSafeDownloadSettings, sanitizeSettingsDirectoryValue, sanitizeSettingsHomeUrl, shouldRejectSettingsFileSize } from '../shared/settings-boundary';
import { applyEnterpriseAdminPolicyToSettings } from '../shared/enterprise-admin-policy-contract';
import { readEnterpriseAdminPolicy } from './enterprise-admin-policy';

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
    allowPopupsAsTabs: boolean;
  };
  privacy: {
    sendDoNotTrack: boolean;
    blockThirdPartyCookies: boolean;
    reduceCrossSiteReferrers: boolean;
    clearProfileDataOnExit: boolean;
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
    openExternalLinksInNewTab: true,
    allowPopupsAsTabs: true
  },
  privacy: {
    sendDoNotTrack: true,
    blockThirdPartyCookies: false,
    reduceCrossSiteReferrers: true,
    clearProfileDataOnExit: false
  }
};

function settingsFile(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export function getSettingsPath(): string {
  return settingsFile();
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
  const rawPrivacy = plainRecord(raw.privacy);

  return {
    homeUrl: sanitizeSettingsHomeUrl(raw.homeUrl, DEFAULT_BROWSER_SETTINGS.homeUrl),
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
      defaultDirectory: sanitizeSettingsDirectoryValue(rawDownloads.defaultDirectory)
    },
    ui: {
      showStatusBar: cleanBoolean(rawUi.showStatusBar, DEFAULT_BROWSER_SETTINGS.ui.showStatusBar),
      openExternalLinksInNewTab: cleanBoolean(rawUi.openExternalLinksInNewTab, DEFAULT_BROWSER_SETTINGS.ui.openExternalLinksInNewTab),
      allowPopupsAsTabs: cleanBoolean(rawUi.allowPopupsAsTabs, DEFAULT_BROWSER_SETTINGS.ui.allowPopupsAsTabs)
    },
    privacy: {
      sendDoNotTrack: cleanBoolean(rawPrivacy.sendDoNotTrack, DEFAULT_BROWSER_SETTINGS.privacy.sendDoNotTrack),
      blockThirdPartyCookies: cleanBoolean(rawPrivacy.blockThirdPartyCookies, DEFAULT_BROWSER_SETTINGS.privacy.blockThirdPartyCookies),
      reduceCrossSiteReferrers: cleanBoolean(rawPrivacy.reduceCrossSiteReferrers, DEFAULT_BROWSER_SETTINGS.privacy.reduceCrossSiteReferrers),
      clearProfileDataOnExit: cleanBoolean(rawPrivacy.clearProfileDataOnExit, DEFAULT_BROWSER_SETTINGS.privacy.clearProfileDataOnExit)
    }
  };
}

function applyManagedSettingsPolicy(settings: TahaiBrowserSettings): TahaiBrowserSettings {
  return sanitizeSettings(applyEnterpriseAdminPolicyToSettings(settings, readEnterpriseAdminPolicy().policy));
}

export function readBrowserSettings(): TahaiBrowserSettings {
  const file = settingsFile();
  if (!fs.existsSync(file)) return applyManagedSettingsPolicy({ ...DEFAULT_BROWSER_SETTINGS });
  try {
    const stat = fs.statSync(file);
    if (shouldRejectSettingsFileSize(stat.size)) return applyManagedSettingsPolicy({ ...DEFAULT_BROWSER_SETTINGS });
    return applyManagedSettingsPolicy(sanitizeSettings(JSON.parse(fs.readFileSync(file, 'utf8'))));
  } catch {
    return applyManagedSettingsPolicy({ ...DEFAULT_BROWSER_SETTINGS });
  }
}

function persistBrowserSettings(cleaned: TahaiBrowserSettings): TahaiBrowserSettings {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(cleaned, null, 2) + '\n', 'utf8');
  return cleaned;
}

export function writeBrowserSettings(next: unknown): TahaiBrowserSettings {
  const current = readBrowserSettings();
  const cleaned = applyManagedSettingsPolicy(sanitizeSettings(next));
  if (!readEnterpriseAdminPolicy().policy.lockedSettings.downloads?.defaultDirectory) cleaned.downloads.defaultDirectory = current.downloads.defaultDirectory;
  return persistBrowserSettings(cleaned);
}

export function resetBrowserSettings(): TahaiBrowserSettings {
  return persistBrowserSettings(applyManagedSettingsPolicy({ ...DEFAULT_BROWSER_SETTINGS, downloads: { ...DEFAULT_BROWSER_SETTINGS.downloads } }));
}

export function settingsForRenderer(settings: TahaiBrowserSettings): TahaiBrowserSettings {
  return {
    ...settings,
    downloads: rendererSafeDownloadSettings(settings.downloads)
  };
}
