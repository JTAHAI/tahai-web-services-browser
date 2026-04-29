import { contextBridge, ipcRenderer } from 'electron';
import type { MissionDeleteResult, MissionListResult, MissionLoadResult, MissionSaveResult, MissionState } from '../shared/mission-types';

export type TahaiBrowserSettings = {
  homeUrl: string;
  startup: 'home' | 'launchpad';
  searchProvider: 'google' | 'duckduckgo' | 'bing';
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

export type FirstLaunchState = {
  product: string;
  defaultHome: string;
  initializedAt: string;
  sourceGuardrails: string[];
};

export type TahaiBrowserConfig = {
  productName: string;
  bundleName: string;
  homeUrl: string;
  startupUrl: string;
  newTabUrl: string;
  settingsUrl: string;
  aboutUrl: string;
  errorPageUrl: string;
  onboardingUrl: string;
  bookmarksUrl: string;
  version: string;
  releaseChannel: string;
  firstLaunch: FirstLaunchState;
  userDataPath: string;
  settingsPath: string;
  settings: TahaiBrowserSettings;
  profiles: BrowserProfileState;
};

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

export type DownloadState = {
  state: string;
  filename: string;
  path?: string;
};

export type DevOpsCaptureSaveResult = {
  saved: boolean;
  canceled: boolean;
  path: string;
};


export type OpsCheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export type OpsHeaderCheck = {
  label: string;
  status: OpsCheckStatus;
  detail: string;
};

export type OpsUrlDiagnostics = {
  ok: boolean;
  checkedAt: string;
  inputUrl: string;
  normalizedUrl: string;
  method: string;
  statusCode: number;
  statusMessage: string;
  durationMs: number;
  error: string;
  headers: Record<string, string>;
  checks: OpsHeaderCheck[];
};

export type DnsMxRecord = {
  exchange: string;
  priority: number;
};


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

export type MissionApiState = MissionState;
export type MissionApiListResult = MissionListResult;
export type MissionApiLoadResult = MissionLoadResult;
export type MissionApiSaveResult = MissionSaveResult;
export type MissionApiDeleteResult = MissionDeleteResult;

export type ItServiceCardDiagnostics = {
  ok: boolean;
  checkedAt: string;
  inputUrl: string;
  normalizedUrl: string;
  hostname: string;
  dnsEligible: boolean;
  durationMs: number;
  records: {
    a: string[];
    aaaa: string[];
    cname: string[];
    ns: string[];
    mx: DnsMxRecord[];
  };
  errors: Record<string, string>;
  notes: OpsHeaderCheck[];
};

contextBridge.exposeInMainWorld('tahaiBrowser', {
  getConfig: (): Promise<TahaiBrowserConfig> => ipcRenderer.invoke('tahai-browser:get-config'),
  getSettings: (): Promise<TahaiBrowserSettings> => ipcRenderer.invoke('tahai-browser:get-settings'),
  updateSettings: (settings: TahaiBrowserSettings): Promise<TahaiBrowserSettings> => ipcRenderer.invoke('tahai-browser:update-settings', settings),
  resetSettings: (): Promise<TahaiBrowserSettings> => ipcRenderer.invoke('tahai-browser:reset-settings'),
  clearBrowsingData: (): Promise<boolean> => ipcRenderer.invoke('tahai-browser:clear-browsing-data'),
  openUserData: (): Promise<boolean> => ipcRenderer.invoke('tahai-browser:open-user-data'),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('tahai-browser:open-external', url),
  listMissions: (): Promise<MissionApiListResult> => ipcRenderer.invoke('tahai-browser:list-missions'),
  loadMission: (missionId: string): Promise<MissionApiLoadResult> => ipcRenderer.invoke('tahai-browser:load-mission', missionId),
  saveMission: (mission: MissionApiState): Promise<MissionApiSaveResult> => ipcRenderer.invoke('tahai-browser:save-mission', mission),
  deleteMission: (missionId: string): Promise<MissionApiDeleteResult> => ipcRenderer.invoke('tahai-browser:delete-mission', missionId),
  copyDevOpsCapture: (markdown: string): Promise<boolean> => ipcRenderer.invoke('tahai-browser:copy-devops-capture', markdown),
  saveDevOpsCapture: (markdown: string, sourceUrl: string): Promise<DevOpsCaptureSaveResult> => ipcRenderer.invoke('tahai-browser:save-devops-capture', markdown, sourceUrl),
  runUrlDiagnostics: (sourceUrl: string): Promise<OpsUrlDiagnostics> => ipcRenderer.invoke('tahai-browser:run-url-diagnostics', sourceUrl),
  runItServiceCardDiagnostics: (sourceUrl: string): Promise<ItServiceCardDiagnostics> => ipcRenderer.invoke('tahai-browser:run-it-service-card-diagnostics', sourceUrl),
  listCredentials: (): Promise<CredentialVaultState> => ipcRenderer.invoke('tahai-browser:list-credentials'),
  saveCredential: (input: CredentialVaultSaveInput): Promise<CredentialVaultRecord> => ipcRenderer.invoke('tahai-browser:save-credential', input),
  deleteCredential: (id: string): Promise<boolean> => ipcRenderer.invoke('tahai-browser:delete-credential', id),
  revealCredentialPassword: (id: string): Promise<CredentialVaultRevealResult> => ipcRenderer.invoke('tahai-browser:reveal-credential-password', id),
  copyCredentialValue: (id: string, field: 'username' | 'password'): Promise<CredentialVaultCopyResult> => ipcRenderer.invoke('tahai-browser:copy-credential-value', id, field),
  listProfiles: (): Promise<BrowserProfileState> => ipcRenderer.invoke('tahai-browser:list-profiles'),
  createProfile: (input: BrowserProfileInput): Promise<BrowserProfileState> => ipcRenderer.invoke('tahai-browser:create-profile', input),
  updateProfile: (input: BrowserProfileUpdateInput): Promise<BrowserProfileState> => ipcRenderer.invoke('tahai-browser:update-profile', input),
  setActiveProfile: (id: string): Promise<BrowserProfileState> => ipcRenderer.invoke('tahai-browser:set-active-profile', id),
  deleteProfile: (id: string): Promise<BrowserProfileState> => ipcRenderer.invoke('tahai-browser:delete-profile', id),
  openProfileData: (id: string): Promise<boolean> => ipcRenderer.invoke('tahai-browser:open-profile-data', id),
  onOpenInTab: (callback: (url: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, url: string) => callback(url);
    ipcRenderer.on('tahai-browser:open-in-tab', listener);
    return () => ipcRenderer.removeListener('tahai-browser:open-in-tab', listener);
  },
  onMenuCommand: (callback: (command: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: string) => callback(command);
    ipcRenderer.on('tahai-browser:menu-command', listener);
    return () => ipcRenderer.removeListener('tahai-browser:menu-command', listener);
  },
  onToggleDevTools: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on('tahai-browser:toggle-devtools', listener);
    return () => ipcRenderer.removeListener('tahai-browser:toggle-devtools', listener);
  },
  onDownloadState: (callback: (state: DownloadState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: DownloadState) => callback(state);
    ipcRenderer.on('tahai-browser:download-state', listener);
    return () => ipcRenderer.removeListener('tahai-browser:download-state', listener);
  }
});
