import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { rendererSafeDownloadSettings, sanitizeSettingsDirectoryValue, sanitizeSettingsHomeUrl, shouldRejectSettingsFileSize, type RendererSafeDownloads } from '../shared/settings-boundary';
import { applyEnterpriseAdminPolicyToSettings } from '../shared/enterprise-admin-policy-contract';
import { readEnterpriseAdminPolicy } from './enterprise-admin-policy';

export const DEFAULT_HOME_URL = 'https://tahaiportal.com';

export type SearchProvider = 'google' | 'duckduckgo' | 'bing' | 'brave' | 'startpage';
export type StartupMode = 'home' | 'launchpad' | 'restore-session';
export type BrowserSurfaceMode = 'tahai-workbench' | 'daily-driver';

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
    blockInsecureDownloads: boolean;
  };
  ui: {
    showStatusBar: boolean;
    openExternalLinksInNewTab: boolean;
    allowPopupsAsTabs: boolean;
    defaultZoomPercent: number;
    launchToMaximized: boolean;
    confirmBeforeClosingMultipleTabs: boolean;
    surfaceMode: BrowserSurfaceMode;
    showWorkbenchTools: boolean;
  };
  privacy: {
    sendDoNotTrack: boolean;
    blockThirdPartyCookies: boolean;
    reduceCrossSiteReferrers: boolean;
    clearProfileDataOnExit: boolean;
  };
};

export type TahaiBrowserRendererSettings = Omit<TahaiBrowserSettings, 'downloads'> & {
  downloads: RendererSafeDownloads;
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
    defaultDirectory: '',
    blockInsecureDownloads: true
  },
  ui: {
    showStatusBar: true,
    openExternalLinksInNewTab: true,
    allowPopupsAsTabs: true,
    defaultZoomPercent: 100,
    launchToMaximized: false,
    confirmBeforeClosingMultipleTabs: false,
    surfaceMode: 'tahai-workbench',
    showWorkbenchTools: true
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
  return value === 'duckduckgo' || value === 'bing' || value === 'brave' || value === 'startpage' || value === 'google'
    ? value
    : DEFAULT_BROWSER_SETTINGS.searchProvider;
}

function cleanStartup(value: unknown): StartupMode {
  return value === 'launchpad' || value === 'restore-session' || value === 'home' ? value : DEFAULT_BROWSER_SETTINGS.startup;
}

function cleanSurfaceMode(value: unknown): BrowserSurfaceMode {
  return value === 'daily-driver' || value === 'tahai-workbench'
    ? value
    : DEFAULT_BROWSER_SETTINGS.ui.surfaceMode;
}

function cleanBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function cleanZoomPercent(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(50, Math.min(200, Math.round(numeric)));
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
      defaultDirectory: sanitizeSettingsDirectoryValue(rawDownloads.defaultDirectory),
      blockInsecureDownloads: cleanBoolean(rawDownloads.blockInsecureDownloads, DEFAULT_BROWSER_SETTINGS.downloads.blockInsecureDownloads)
    },
    ui: {
      showStatusBar: cleanBoolean(rawUi.showStatusBar, DEFAULT_BROWSER_SETTINGS.ui.showStatusBar),
      openExternalLinksInNewTab: cleanBoolean(rawUi.openExternalLinksInNewTab, DEFAULT_BROWSER_SETTINGS.ui.openExternalLinksInNewTab),
      allowPopupsAsTabs: cleanBoolean(rawUi.allowPopupsAsTabs, DEFAULT_BROWSER_SETTINGS.ui.allowPopupsAsTabs),
      defaultZoomPercent: cleanZoomPercent(rawUi.defaultZoomPercent, DEFAULT_BROWSER_SETTINGS.ui.defaultZoomPercent),
      launchToMaximized: cleanBoolean(rawUi.launchToMaximized, DEFAULT_BROWSER_SETTINGS.ui.launchToMaximized),
      confirmBeforeClosingMultipleTabs: cleanBoolean(rawUi.confirmBeforeClosingMultipleTabs, DEFAULT_BROWSER_SETTINGS.ui.confirmBeforeClosingMultipleTabs),
      surfaceMode: cleanSurfaceMode(rawUi.surfaceMode),
      showWorkbenchTools: cleanBoolean(rawUi.showWorkbenchTools, DEFAULT_BROWSER_SETTINGS.ui.showWorkbenchTools)
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
  const state = readEnterpriseAdminPolicy();
  return state.managed
    ? sanitizeSettings(applyEnterpriseAdminPolicyToSettings(settings, state.policy))
    : sanitizeSettings(settings);
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
  return writeBrowserSettingsWithOptions(next);
}

export function writeBrowserSettingsWithOptions(next: unknown, options?: { preserveDownloadDirectory?: boolean }): TahaiBrowserSettings {
  const current = readBrowserSettings();
  const cleaned = applyManagedSettingsPolicy(sanitizeSettings(next));
  if (options?.preserveDownloadDirectory !== false && !readEnterpriseAdminPolicy().policy.lockedSettings.downloads?.defaultDirectory) {
    cleaned.downloads.defaultDirectory = current.downloads.defaultDirectory;
  }
  return persistBrowserSettings(cleaned);
}

export function resetBrowserSettings(): TahaiBrowserSettings {
  return persistBrowserSettings(applyManagedSettingsPolicy({ ...DEFAULT_BROWSER_SETTINGS, downloads: { ...DEFAULT_BROWSER_SETTINGS.downloads } }));
}

export function setBrowserDownloadDirectory(nextDirectory: string): TahaiBrowserSettings {
  if (readEnterpriseAdminPolicy().policy.lockedSettings.downloads?.defaultDirectory) return readBrowserSettings();
  const current = readBrowserSettings();
  return persistBrowserSettings(applyManagedSettingsPolicy({
    ...current,
    downloads: {
      ...current.downloads,
      defaultDirectory: sanitizeSettingsDirectoryValue(nextDirectory)
    }
  }));
}

export function settingsForRenderer(settings: TahaiBrowserSettings): TahaiBrowserRendererSettings {
  return {
    ...settings,
    downloads: rendererSafeDownloadSettings(settings.downloads)
  };
}
