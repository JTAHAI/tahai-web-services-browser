import { contextBridge, ipcRenderer } from 'electron';
import type { ItDocsMissionCapabilities } from '../shared/itdocs-contract';
import type { BrowserDownloadState } from '../shared/download-boundary';
import type { MissionDeleteResult, MissionExportResult, MissionListResult, MissionLoadResult, MissionSaveResult, MissionState } from '../shared/mission-types';
import type { EnterpriseAdminPolicyState } from '../shared/enterprise-admin-policy-contract';
import type { EnterpriseSupportBundleResult } from '../shared/enterprise-support-bundle-contract';
import type { Pass188InputBoundaryPayload } from '../shared/webview-focus-input-boundary-contract';
import type { FirstRunOperatorMilestone } from '../shared/first-run-operator-walkthrough';

export type TahaiBrowserSettings = {
  homeUrl: string;
  startup: 'home' | 'launchpad' | 'restore-session';
  searchProvider: 'google' | 'duckduckgo' | 'bing' | 'brave' | 'startpage';
  permissions: {
    allowClipboardRead: boolean;
    allowMedia: boolean;
    allowGeolocation: boolean;
    allowNotifications: boolean;
  };
  downloads: {
    askEveryTime: boolean;
    defaultDirectory: string;
    defaultDirectoryLabel: string;
    hasCustomDirectory: boolean;
    blockInsecureDownloads: boolean;
  };
  ui: {
    showStatusBar: boolean;
    openExternalLinksInNewTab: boolean;
    allowPopupsAsTabs: boolean;
    defaultZoomPercent: number;
    launchToMaximized: boolean;
    confirmBeforeClosingMultipleTabs: boolean;
    surfaceMode: 'tahai-workbench' | 'daily-driver';
    showWorkbenchTools: boolean;
  };
  privacy: {
    sendDoNotTrack: boolean;
    blockThirdPartyCookies: boolean;
    reduceCrossSiteReferrers: boolean;
    clearProfileDataOnExit: boolean;
  };
};

export type FirstLaunchState = {
  product: string;
  defaultHome: string;
  initializedAt: string;
  sourceGuardrails: string[];
  operatorWalkthrough: {
    pass: string;
    version: number;
    startAnchor: string;
    query: string;
    privacySummary: string;
    milestones: FirstRunOperatorMilestone[];
  };
};


export type TahaiReleaseTruth = {
  productName: string;
  bundleName: string;
  version: string;
  releasePass: string;
  releaseChannel: string;
  releasePhase: string;
  updateChannel: string;
  updatePolicy: string;
  signingStatus: string;
  downloadOrigin: string;
  downloadAliasOrigin: string;
  publicRepoUrl: string;
};

export type TahaiBrowserConfig = {
  productName: string;
  bundleName: string;
  homeUrl: string;
  itDocsUrl: string;
  startupUrl: string;
  newTabUrl: string;
  settingsUrl: string;
  aboutUrl: string;
  errorPageUrl: string;
  onboardingUrl: string;
  bookmarksUrl: string;
  version: string;
  releaseChannel: string;
  releasePass: string;
  updateChannel: string;
  updatePolicy: string;
  signingStatus: string;
  releaseTruth: TahaiReleaseTruth;
  firstLaunch: FirstLaunchState;
  userDataLabel: string;
  settingsLabel: string;
  settings: TahaiBrowserSettings;
  profiles: BrowserProfileState;
  adminPolicy: EnterpriseAdminPolicyState;
  adminPolicySummary: string;
  enterpriseSupportBundlePass: string;
  runtimeControl: RuntimeControlState;
};

export type ClearBrowsingDataScope = 'active-profile' | 'selected-profile' | 'all-profiles';

export type ClearBrowsingDataOptions = {
  scope?: ClearBrowsingDataScope;
  profileId?: string;
};

export type ClearBrowsingDataResult = {
  ok: boolean;
  scope: ClearBrowsingDataScope;
  clearedProfileIds: string[];
  clearedPartitions: string[];
  error: string;
};

export type BrowserConfigFileResult = {
  ok: boolean;
  canceled: boolean;
  message: string;
  settings?: TahaiBrowserSettings;
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
  storageLabel: string;
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

export type DownloadState = BrowserDownloadState;

export type DownloadArtifactRevealResult = {
  ok: boolean;
  error: string;
};

export type DevOpsCaptureSaveResult = {
  saved: boolean;
  canceled: boolean;
  savedLabel: string;
  path?: never;
};

export type RuntimeControlState = {
  runtimeE2e: boolean;
  runtimeE2eQuit: boolean;
  diagnostics: boolean;
  resultPath: string;
  runId: string;
};

export type RuntimeE2eScenarioResult = {
  id: string;
  ok: boolean;
  detail: string;
};

export type RuntimeE2eHarnessResult = {
  ok: boolean;
  pass: 'PASS158';
  contractId?: string;
  scenarioCount?: number;
  error?: string;
  results?: RuntimeE2eScenarioResult[];
};

export type RuntimeE2eRendererReport = {
  reason: string;
  startedAt: string;
  result: RuntimeE2eHarnessResult;
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



export type MissionApiState = MissionState;
export type MissionApiListResult = MissionListResult;
export type MissionApiLoadResult = MissionLoadResult;
export type MissionApiSaveResult = MissionSaveResult;
export type MissionApiDeleteResult = MissionDeleteResult;
export type MissionApiExportResult = MissionExportResult;

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
  notifyRendererReady: (): Promise<boolean> => ipcRenderer.invoke('tahai-browser:renderer-ready'),
  getRuntimeControl: (): Promise<RuntimeControlState> => ipcRenderer.invoke('tahai-browser:get-runtime-control'),
  reportRuntimeE2eResult: (report: RuntimeE2eRendererReport): Promise<boolean> => ipcRenderer.invoke('tahai-browser:report-runtime-e2e-result', report),
  getConfig: (): Promise<TahaiBrowserConfig> => ipcRenderer.invoke('tahai-browser:get-config'),
  getSettings: (): Promise<TahaiBrowserSettings> => ipcRenderer.invoke('tahai-browser:get-settings'),
  getAdminPolicy: (): Promise<EnterpriseAdminPolicyState> => ipcRenderer.invoke('tahai-browser:get-admin-policy'),
  previewEnterpriseSupportBundle: (): Promise<EnterpriseSupportBundleResult> => ipcRenderer.invoke('tahai-browser:preview-enterprise-support-bundle'),
  copyEnterpriseSupportBundle: (): Promise<EnterpriseSupportBundleResult> => ipcRenderer.invoke('tahai-browser:copy-enterprise-support-bundle'),
  saveEnterpriseSupportBundle: (): Promise<EnterpriseSupportBundleResult> => ipcRenderer.invoke('tahai-browser:save-enterprise-support-bundle'),
  updateSettings: (settings: TahaiBrowserSettings): Promise<TahaiBrowserSettings> => ipcRenderer.invoke('tahai-browser:update-settings', settings),
  resetSettings: (): Promise<TahaiBrowserSettings> => ipcRenderer.invoke('tahai-browser:reset-settings'),
  chooseDownloadDirectory: (): Promise<TahaiBrowserSettings> => ipcRenderer.invoke('tahai-browser:choose-download-directory'),
  resetDownloadDirectory: (): Promise<TahaiBrowserSettings> => ipcRenderer.invoke('tahai-browser:reset-download-directory'),
  exportSettingsFile: (): Promise<BrowserConfigFileResult> => ipcRenderer.invoke('tahai-browser:export-settings-file'),
  importSettingsFile: (): Promise<BrowserConfigFileResult> => ipcRenderer.invoke('tahai-browser:import-settings-file'),
  revealDownloadArtifact: (artifactId: string): Promise<DownloadArtifactRevealResult> => ipcRenderer.invoke('tahai-browser:reveal-download-artifact', artifactId),
  clearBrowsingData: (options?: ClearBrowsingDataOptions): Promise<ClearBrowsingDataResult> => ipcRenderer.invoke('tahai-browser:clear-browsing-data', options),
  openUserData: (): Promise<boolean> => ipcRenderer.invoke('tahai-browser:open-user-data'),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('tahai-browser:open-external', url),
  openItDocs: (): Promise<boolean> => ipcRenderer.invoke('tahai-browser:open-itdocs'),
  getItDocsCapabilities: (): Promise<ItDocsMissionCapabilities> => ipcRenderer.invoke('tahai-browser:get-itdocs-capabilities'),
  copyItDocsCapabilities: (): Promise<boolean> => ipcRenderer.invoke('tahai-browser:copy-itdocs-capabilities'),
  copyPsaReferenceContract: (): Promise<boolean> => ipcRenderer.invoke('tahai-browser:copy-psa-reference-contract'),
  listMissions: (): Promise<MissionApiListResult> => ipcRenderer.invoke('tahai-browser:list-missions'),
  loadMission: (missionId: string): Promise<MissionApiLoadResult> => ipcRenderer.invoke('tahai-browser:load-mission', missionId),
  saveMission: (mission: MissionApiState): Promise<MissionApiSaveResult> => ipcRenderer.invoke('tahai-browser:save-mission', mission),
  deleteMission: (missionId: string): Promise<MissionApiDeleteResult> => ipcRenderer.invoke('tahai-browser:delete-mission', missionId),
  previewMissionExport: (mission: MissionApiState): Promise<MissionApiExportResult> => ipcRenderer.invoke('tahai-browser:preview-mission-export', mission),
  copyMissionExport: (mission: MissionApiState): Promise<MissionApiExportResult> => ipcRenderer.invoke('tahai-browser:copy-mission-export', mission),
  saveMissionExport: (mission: MissionApiState): Promise<MissionApiExportResult> => ipcRenderer.invoke('tahai-browser:save-mission-export', mission),
  copyDevOpsCapture: (markdown: string): Promise<boolean> => ipcRenderer.invoke('tahai-browser:copy-devops-capture', markdown),
  saveDevOpsCapture: (markdown: string, sourceUrl: string): Promise<DevOpsCaptureSaveResult> => ipcRenderer.invoke('tahai-browser:save-devops-capture', markdown, sourceUrl),
  runUrlDiagnostics: (sourceUrl: string): Promise<OpsUrlDiagnostics> => ipcRenderer.invoke('tahai-browser:run-url-diagnostics', sourceUrl),
  runItServiceCardDiagnostics: (sourceUrl: string): Promise<ItServiceCardDiagnostics> => ipcRenderer.invoke('tahai-browser:run-it-service-card-diagnostics', sourceUrl),
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
  },
  onPass188InputBoundary: (callback: (payload: Pass188InputBoundaryPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: Pass188InputBoundaryPayload) => callback(payload);
    ipcRenderer.on('tahai-browser:pass188-input-boundary', listener);
    return () => ipcRenderer.removeListener('tahai-browser:pass188-input-boundary', listener);
  }
});
